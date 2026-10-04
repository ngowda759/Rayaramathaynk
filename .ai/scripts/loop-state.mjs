#!/usr/bin/env node
/**
 * Read and update the AI development loop state.
 *
 * Every stage of the loop uses this helper instead of editing the JSON files by
 * hand, so each write is schema-validated and each transition is recorded in the
 * history. Transitions are checked against the loop's state machine
 * (`.ai/scripts/loop-core.mjs`): a step that is not legal from the current status
 * is refused unless `--force` is passed, and a forced step is logged like any
 * other.
 *
 * Usage:
 *   node .ai/scripts/loop-state.mjs status
 *   node .ai/scripts/loop-state.mjs set --status implementing --task AI-002
 *   node .ai/scripts/loop-state.mjs set --status reviewing --pr 42 \
 *       --branch automation/ai-002 --head <sha> --round 1
 *   node .ai/scripts/loop-state.mjs next-round
 *   node .ai/scripts/loop-state.mjs log --task AI-002 --pr 42 --round 1 \
 *       --verdict changes-requested --ci failure [--findings findings.json]
 *   node .ai/scripts/loop-state.mjs stop --event max-rounds-exceeded
 *   node .ai/scripts/loop-state.mjs complete --task AI-002
 *   node .ai/scripts/loop-state.mjs reset --note "task merged"
 *   node .ai/scripts/loop-state.mjs recover --note "stale state repaired"
 *
 * `stop` is the hard-stop entry point: it resolves the event through the
 * hard-stop table, moves the loop to `blocked` or `human-review-required`, and
 * records the reason so the next stage cannot miss it. Passing a normal event
 * (e.g. `changes-requested`) is refused, because stopping for one would break
 * the autonomous path.
 *
 * `AI_LOOP_ROOT` overrides the repository root so tests can drive the real state
 * machine against a throwaway copy of `.ai/`. Production and CI never set it.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  classifyEvent,
  isTransitionAllowed,
  loadConfig,
  REPO_ROOT,
  TRANSITIONS,
} from './loop-core.mjs';
import { validateAgainstSchema } from './loop-schema.mjs';

const root = process.env.AI_LOOP_ROOT ?? REPO_ROOT;
const config = loadConfig(root);
const statePath = resolve(root, config.paths.state);
const reviewLogPath = resolve(root, config.paths.reviewLog);
const schemasDir = resolve(root, '.ai/schemas');

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readState() {
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function validateState(state) {
  const errors = validateAgainstSchema(state, resolve(schemasDir, 'loop-state.schema.json'));
  if (errors.length > 0) {
    console.error('Refusing to write an invalid loop state:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
}

function writeState(state, note) {
  state.maxReviewRounds = config.maxReviewRounds;
  state.updatedAt = nowIso();
  if (note !== undefined) state.history.push({ at: state.updatedAt, status: state.status, note });
  validateState(state);
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
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

function toInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.error(`--${label} must be a non-negative integer`);
    process.exit(2);
  }
  return parsed;
}

function commandStatus() {
  const state = readState();
  console.log(`loop      ${state.loopId}`);
  console.log(`status    ${state.status}`);
  console.log(`round     ${state.round}/${state.maxReviewRounds}`);
  console.log(`task      ${state.currentTaskId ?? '-'}`);
  const pr =
    state.currentPr === null
      ? '-'
      : `#${state.currentPr.number} (${state.currentPr.branch} @ ${state.currentPr.headSha.slice(0, 7)})`;
  console.log(`pr        ${pr}`);
  console.log(`verdict   ${state.lastVerdict ?? '-'} (ci ${state.lastCiStatus ?? '-'})`);
  if (state.blockedReason !== null && state.blockedReason !== undefined) {
    console.log(`blocked   ${state.blockedReason}`);
  }
  console.log(`updated   ${state.updatedAt}`);
  const last = state.history.at(-1);
  if (last !== undefined) console.log(`last note ${last.note}`);
}

function commandSet(args) {
  const state = readState();
  const previousStatus = state.status;

  if (args.status !== undefined) {
    const next = requireString(args, 'status');
    if (!isTransitionAllowed(previousStatus, next)) {
      if (args.force !== true) {
        console.error(
          `refusing the transition ${previousStatus} -> ${next}: not a legal step of the loop state machine`,
        );
        console.error(
          `  legal next states from ${previousStatus}: ${(TRANSITIONS[previousStatus] ?? []).join(', ') || '(none)'}, blocked, human-review-required`,
        );
        console.error(
          '  pass --force to record the transition anyway (it is logged in the history)',
        );
        process.exit(1);
      }
      console.error(`forcing the transition ${previousStatus} -> ${next}`);
    }
    state.status = next;
    if (!['blocked', 'human-review-required'].includes(next)) state.blockedReason = null;
  }

  if (args.round !== undefined) state.round = toInteger(args.round, 'round');
  if (args.task !== undefined) state.currentTaskId = args.task === 'none' ? null : args.task;
  if (args.pr !== undefined) {
    state.currentPr = {
      number: toInteger(args.pr, 'pr'),
      branch: requireString(args, 'branch'),
      headSha: requireString(args, 'head'),
    };
  }
  if (args['clear-pr'] === true) state.currentPr = null;
  if (args.verdict !== undefined) state.lastVerdict = args.verdict === 'none' ? null : args.verdict;
  if (args.ci !== undefined) state.lastCiStatus = args.ci === 'none' ? null : args.ci;
  if (args.head !== undefined) state.reviewedHeadSha = args.head;
  if (args['complete-task'] !== undefined) {
    const completed = requireString(args, 'complete-task');
    state.completedTasks = [...new Set([...(state.completedTasks ?? []), completed])].sort();
  }
  writeState(state, typeof args.note === 'string' ? args.note : undefined);
  commandStatus();
}

function commandNextRound(args) {
  const state = readState();
  if (state.round >= config.maxReviewRounds) {
    state.status = 'blocked';
    state.blockedReason = 'max-rounds-exceeded';
    writeState(
      state,
      typeof args.note === 'string'
        ? args.note
        : `review round limit reached (${state.round}/${config.maxReviewRounds}); blocked for a human`,
    );
    console.error(
      `round limit reached (${state.round}/${config.maxReviewRounds}); the loop is now blocked and needs a human`,
    );
    process.exit(1);
  }
  state.round += 1;
  if (!['blocked', 'human-review-required'].includes(state.status)) state.status = 'reviewing';
  writeState(state, typeof args.note === 'string' ? args.note : `review round ${state.round}`);
  commandStatus();
}

function commandStop(args) {
  const state = readState();
  const event = requireString(args, 'event');
  const classification = classifyEvent(event);
  if (!classification.hardStop) {
    console.error(
      `event "${event}" is a normal loop event, not a hard stop: ${classification.description}`,
    );
    console.error('the loop must handle it automatically; refusing to stop for a human');
    process.exit(1);
  }
  state.status = args.status === 'human-review-required' ? 'human-review-required' : 'blocked';
  state.blockedReason = event;
  const suffix = typeof args.note === 'string' ? ` (${args.note})` : '';
  writeState(state, `${classification.description}${suffix}`);
  console.error(`hard stop: ${classification.description}`);
  commandStatus();
}

function commandComplete(args) {
  const state = readState();
  const taskId = requireString(args, 'task');
  if (!isTransitionAllowed(state.status, 'completed')) {
    console.error(`refusing the transition ${state.status} -> completed: not a legal step`);
    process.exit(1);
  }
  state.completedTasks = [...new Set([...(state.completedTasks ?? []), taskId])].sort();
  state.status = 'completed';
  state.blockedReason = null;
  writeState(state, `task ${taskId} completed`);
  commandStatus();
}

function commandReset(args) {
  const state = readState();
  state.status = 'idle';
  state.round = 0;
  state.currentTaskId = null;
  state.currentPr = null;
  state.lastVerdict = null;
  state.lastCiStatus = null;
  state.reviewedHeadSha = null;
  state.blockedReason = null;
  writeState(state, typeof args.note === 'string' ? args.note : 'loop reset for the next task');
  commandStatus();
}

/**
 * Recover a stale state: a task and pull request that already completed, but a
 * persistent state that never advanced to `next-task`.
 *
 * This is not a second state machine and it never invents a task. It repairs the
 * *bookkeeping* only: the recorded active task and pull request are cleared and
 * the loop is placed in `next-task`, so the next-task automation can generate the
 * successor. The repair is allowed only from a finished state — `completed`,
 * `next-task` or `idle` — where no implementation is in flight; from any active
 * status (`implementing`, `reviewing`, `ready-to-merge`, …) it refuses, because
 * clearing the active record there would drop live work on the floor.
 */
function commandRecover(args) {
  const state = readState();
  const previous = state.status;
  const finished = ['idle', 'completed', 'next-task'].includes(previous);
  if (!finished) {
    console.error(
      `refusing to recover from status "${previous}": the loop may still own active work. ` +
        'Recovery is only valid from idle, completed or next-task.',
    );
    process.exit(1);
  }

  const note =
    typeof args.note === 'string'
      ? args.note
      : 'stale-state recovery: the recorded task and pull request had already completed but the persistent state never advanced';
  state.status = 'next-task';
  state.currentTaskId = null;
  state.currentPr = null;
  state.lastVerdict = null;
  state.lastCiStatus = null;
  state.reviewedHeadSha = null;
  state.blockedReason = null;
  writeState(state, note);
  commandStatus();
}

function commandLog(args) {
  const record = {
    taskId: requireString(args, 'task'),
    pr: toInteger(requireString(args, 'pr'), 'pr'),
    round: toInteger(requireString(args, 'round'), 'round'),
    verdict: requireString(args, 'verdict'),
    ciStatus: typeof args.ci === 'string' ? args.ci : 'unknown',
    // The review report schema requires these three; the state machine records
    // the head SHA, so fall back to it when no explicit --head is given.
    headSha: typeof args.head === 'string' ? args.head : (readState().reviewedHeadSha ?? 'unknown'),
    summary: typeof args.summary === 'string' ? args.summary : '(no summary recorded)',
    acceptanceCriteria: [],
    findings: [],
    reviewedAt: nowIso(),
  };
  if (typeof args.findings === 'string') {
    if (!existsSync(args.findings)) {
      console.error(`--findings file not found: ${args.findings}`);
      process.exit(2);
    }
    const parsed = JSON.parse(readFileSync(args.findings, 'utf8'));
    if (!Array.isArray(parsed)) {
      console.error('--findings must contain a JSON array of findings');
      process.exit(2);
    }
    record.findings = parsed;
  }
  const errors = validateAgainstSchema(record, resolve(schemasDir, 'review-report.schema.json'));
  if (errors.length > 0) {
    console.error('Refusing to append an invalid review record:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  appendFileSync(reviewLogPath, `${JSON.stringify(record)}\n`);
  console.log(`appended review round ${record.round} for ${record.taskId} (${record.verdict})`);
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

switch (command) {
  case 'status':
    commandStatus();
    break;
  case 'set':
    commandSet(args);
    break;
  case 'next-round':
    commandNextRound(args);
    break;
  case 'stop':
    commandStop(args);
    break;
  case 'complete':
    commandComplete(args);
    break;
  case 'log':
    commandLog(args);
    break;
  case 'reset':
    commandReset(args);
    break;
  case 'recover':
    commandRecover(args);
    break;
  default:
    console.error(
      'usage: loop-state.mjs <status|set|next-round|stop|complete|log|reset|recover> [--key value ...]',
    );
    process.exit(2);
}
