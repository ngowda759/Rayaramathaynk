#!/usr/bin/env node
/**
 * Manage the AI development loop's task queue.
 *
 * This is where the loop's sequencing rules live: exactly one task may be
 * active, ids advance one at a time, and only one task may exist beyond the
 * active one. Every command validates the queue against
 * `.ai/schemas/task-queue.schema.json` before writing, and refuses a change that
 * would break the sequence.
 *
 * Usage:
 *   node .ai/scripts/loop-tasks.mjs active
 *   node .ai/scripts/loop-tasks.mjs next-id
 *   node .ai/scripts/loop-tasks.mjs start --task AI-002
 *   node .ai/scripts/loop-tasks.mjs complete --task AI-002 --pr 42 --merged-sha <sha>
 *   node .ai/scripts/loop-tasks.mjs append --file /tmp/task.json
 *   node .ai/scripts/loop-tasks.mjs enforce-single
 *   node .ai/scripts/loop-tasks.mjs status
 *
 * `enforce-single` is the concurrency guard: it cross-checks the queue against
 * the open automation pull requests, so an interrupted run that left the state
 * idle while a PR is still open cannot start a second task.
 *
 * `AI_LOOP_ROOT` overrides the repository root for tests.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertSingleActiveTask,
  isAiManagedPullRequest,
  loadConfig,
  REPO_ROOT,
  resolveNextTaskId,
  selectActiveTask,
  validateTaskSequence,
} from './loop-core.mjs';
import { validateAgainstSchema } from './loop-schema.mjs';

const root = process.env.AI_LOOP_ROOT ?? REPO_ROOT;
const config = loadConfig(root);
const queuePath = resolve(root, config.paths.queue);
const schemasDir = resolve(root, '.ai/schemas');

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readJson(path, label) {
  if (!existsSync(path)) {
    console.error(`missing file: ${label}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readQueue() {
  return readJson(queuePath, config.paths.queue);
}

function validateQueue(queue) {
  const errors = validateAgainstSchema(queue, resolve(schemasDir, 'task-queue.schema.json'));
  if (errors.length > 0) {
    console.error('Refusing to write an invalid task queue:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
}

function writeQueue(queue) {
  queue.updatedAt = nowIso();
  validateQueue(queue);
  writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function requireString(args, key) {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    console.error(`missing required option --${key}`);
    process.exit(2);
  }
  return value;
}

/** Open pull requests, flagged with whether each is AI-managed. Empty when gh is absent. */
function openAutomationPrs() {
  const repo = process.env.GITHUB_REPOSITORY ?? 'ngowda759/Rayaramathaynk';
  const result = spawnSync(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      repo,
      '--state',
      'open',
      '--json',
      'number,headRefName,baseRefName,isCrossRepository,title,labels',
      '--limit',
      '100',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return null;
  let prs;
  try {
    prs = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const state = readJson(resolve(root, config.paths.state), config.paths.state);
  const queue = readJson(queuePath, config.paths.queue);
  return prs.map((pr) => ({
    number: pr.number,
    branch: pr.headRefName,
    base: pr.baseRefName,
    title: pr.title,
    // Identity is the loop's own record, not the branch name alone: an AI task
    // may live on `feat/*` or `fix/*`. A fork PR is never AI-managed.
    isAutomation: isAiManagedPullRequest({
      pr: {
        number: pr.number,
        headRefName: pr.headRefName,
        baseRefName: pr.baseRefName,
        isCrossRepository: pr.isCrossRepository,
        labels: pr.labels,
        title: pr.title,
      },
      state,
      queue,
      config,
    }),
  }));
}

function commandStatus() {
  const queue = readQueue();
  const active = selectActiveTask(queue);
  console.log(`queue      ${queue.tasks.length} task(s)`);
  for (const task of queue.tasks) {
    const marker = active !== null && task.id === active.id ? '*' : ' ';
    console.log(`${marker} ${task.id.padEnd(10)} ${task.status.padEnd(16)} ${task.title}`);
  }
  console.log(`active     ${active === null ? '-' : `${active.id} (${active.status})`}`);
  console.log(`next id    ${resolveNextTaskId(queue.tasks.map((task) => task.id))}`);
}

function commandActive(args) {
  const queue = readQueue();
  const active = selectActiveTask(queue);
  if (active === null) {
    console.error('no task is ready for implementation');
    process.exit(1);
  }
  if (args.json === true) console.log(JSON.stringify(active, null, 2));
  else console.log(active.id);
}

function commandStart(args) {
  const queue = readQueue();
  const taskId = requireString(args, 'task');

  const sequenceErrors = validateTaskSequence(queue.tasks.map((task) => task.id));
  if (sequenceErrors.length > 0) {
    console.error('the task queue violates its sequencing rules:');
    for (const error of sequenceErrors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const task = queue.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    console.error(`task ${taskId} is not present in ${config.paths.queue}`);
    process.exit(2);
  }

  const alreadyActive = queue.tasks.filter((candidate) =>
    ['in-progress', 'in-review'].includes(candidate.status),
  );
  const otherActive = alreadyActive.filter((candidate) => candidate.id !== taskId);
  if (otherActive.length > 0) {
    console.error(
      `refusing to start ${taskId}: ${otherActive.map((candidate) => candidate.id).join(', ')} is already active`,
    );
    console.error(`maxConcurrentTasks is ${config.automation.maxConcurrentTasks}`);
    process.exit(1);
  }

  if (!['approved', 'queued', 'proposed'].includes(task.status)) {
    console.error(`refusing to start ${taskId}: its status is "${task.status}"`);
    process.exit(1);
  }

  const openPrs = openAutomationPrs();
  if (openPrs !== null) {
    const state = readJson(resolve(root, config.paths.state), config.paths.state);
    const guard = assertSingleActiveTask({ state, queue, openPrs, config });
    if (!guard.ok) {
      console.error('refusing to start a task: the loop already has work in flight');
      for (const error of guard.errors) console.error(`  - ${error}`);
      process.exit(1);
    }
  }

  task.status = 'in-progress';
  task.startedAt = nowIso();
  writeQueue(queue);
  console.log(`started ${task.id}: ${task.title}`);
}

function commandComplete(args) {
  const queue = readQueue();
  const taskId = requireString(args, 'task');
  const task = queue.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    console.error(`task ${taskId} is not present in ${config.paths.queue}`);
    process.exit(2);
  }
  if (typeof args.pr === 'string') task.pr = Number.parseInt(args.pr, 10);
  if (typeof args.branch === 'string') task.branch = args.branch;
  if (typeof args['merged-sha'] === 'string') task.headSha = args['merged-sha'];
  task.status = 'done';
  task.completedAt = nowIso();
  writeQueue(queue);
  console.log(`completed ${task.id}`);
}

function commandAppend(args) {
  const queue = readQueue();
  const file = requireString(args, 'file');
  if (!existsSync(file)) {
    console.error(`--file not found: ${file}`);
    process.exit(2);
  }
  const brief = JSON.parse(readFileSync(file, 'utf8'));

  const errors = validateAgainstSchema(brief, resolve(schemasDir, 'task-brief.schema.json'));
  if (errors.length > 0) {
    console.error('Refusing to append an invalid task brief:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const expected = resolveNextTaskId(queue.tasks.map((task) => task.id));
  if (brief.id !== expected) {
    console.error(`task id ${brief.id} is out of sequence; the next id must be ${expected}`);
    process.exit(1);
  }

  const active = selectActiveTask(queue);
  if (active !== null && active.status !== 'done') {
    console.error(
      `refusing to append ${brief.id}: ${active.id} is still active (${active.status}); ` +
        'only one task may exist beyond the active one',
    );
    process.exit(1);
  }

  if (queue.tasks.some((task) => task.id === brief.id)) {
    console.error(`task ${brief.id} is already in the queue`);
    process.exit(1);
  }

  // A generated task depends on the task it follows, and never needs a human
  // sign-off: the brief is the implementation contract.
  brief.humanApproval = false;
  brief.status = 'approved';
  brief.dependsOn = brief.dependsOn ?? [];
  queue.tasks.push(brief);
  writeQueue(queue);
  console.log(`appended ${brief.id}: ${brief.title}`);
}

function commandEnforceSingle() {
  const queue = readQueue();
  const state = readJson(resolve(root, config.paths.state), config.paths.state);
  const openPrs = openAutomationPrs();
  if (openPrs === null) {
    console.error(
      'could not read the open pull requests; refusing to assert the concurrency bound',
    );
    process.exit(2);
  }
  const guard = assertSingleActiveTask({ state, queue, openPrs, config });
  if (!guard.ok) {
    console.error('the single-active-task invariant is violated:');
    for (const error of guard.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`single-active-task invariant holds (active PR: ${guard.activePr ?? 'none'})`);
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

switch (command) {
  case 'status':
    commandStatus();
    break;
  case 'active':
    commandActive(args);
    break;
  case 'next-id':
    console.log(resolveNextTaskId(readQueue().tasks.map((task) => task.id)));
    break;
  case 'start':
    commandStart(args);
    break;
  case 'complete':
    commandComplete(args);
    break;
  case 'append':
    commandAppend(args);
    break;
  case 'enforce-single':
    commandEnforceSingle();
    break;
  default:
    console.error(
      'usage: loop-tasks.mjs <status|active|next-id|start|complete|append|enforce-single> [--key value ...]',
    );
    process.exit(2);
}
