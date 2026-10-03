#!/usr/bin/env node
/**
 * Advance the loop after a pull request merge.
 *
 * Runs on `pull_request: closed`. It decides whether the merge completes the
 * loop's active task and, if so, records it: the task becomes `done`, the loop
 * moves through `completed` to `next-task`, and the reviewer's outstanding
 * findings are carried onto the task record so the architect can read them.
 *
 * A pull request that closed *without* merging is a hard stop, not a normal
 * event: the loop must not silently generate the next task when its own pull
 * request was abandoned, and it must not merge anything either.
 *
 * A merged AI-managed pull request that is not a queued task is classified
 * before it can stop the loop: an `[AI-INFRA]` tooling PR (which is never in the
 * task queue) reconciles to a no-op so the loop carries on with the task in
 * flight, while any other unattributable merge is still `state-corruption` and
 * stops for a human. This is the stale-state reconciliation: an infrastructure
 * PR that merges while a task is open must not be attributed to that task.
 *
 * The same reconciliation also runs on two recovery triggers, both of which
 * reuse this one implementation rather than a second merge-transition path:
 *
 *   * `push` to `.ai/state/loop-state.json` (`EVENT_NAME=push`) — a recovery
 *     *check* only. When the state is a legitimate `next-task` state with no
 *     active task or pull request it reports `managed=true` so the workflow
 *     dispatches the architect. It never advances a merge, creates a task or
 *     touches a pull request.
 *   * `workflow_dispatch` (`EVENT_NAME=workflow_dispatch`) — operator recovery.
 *     It discovers an already-merged AI pull request that completes a task the
 *     loop's own records still show as open (the `pull_request: closed` delivery
 *     was missed, or the state on the base branch was never advanced) and runs
 *     the *same* merge reconciliation on it. If nothing needs reconciling it
 *     reports `managed=false`, so a recovery run over an already-consistent
 *     state cannot re-complete a task or generate a duplicate next task.
 *
 * Usage (from a workflow step):
 *   node .ai/scripts/advance-after-merge.mjs
 *
 * Environment:
 *   GH_TOKEN, GITHUB_REPOSITORY, MERGED_PR, MERGED_SHA, MERGED_BRANCH
 *   EVENT_NAME     `push` / `workflow_dispatch` select a recovery path;
 *                  anything else is a PR close
 *   AI_LOOP_ROOT   overrides the repository root (tests only)
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  classifyMergedLoopPr,
  isAiManagedPullRequest,
  isRecoverableNextTaskState,
  loadConfig,
  REPO_ROOT,
  selectMergedTaskPr,
} from './loop-core.mjs';
import { parseReviewMarkers } from './review-core.mjs';

const root = process.env.AI_LOOP_ROOT ?? REPO_ROOT;
const config = loadConfig(root);
const repo = process.env.GITHUB_REPOSITORY ?? 'ngowda759/Rayaramathaynk';

function log(message) {
  console.log(message);
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function readJson(path, label) {
  if (!existsSync(path)) fail(`missing ${label}: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ghJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0) fail(`gh ${args.join(' ')} failed:\n${result.stderr.trim()}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`gh ${args.join(' ')} returned non-JSON output: ${error.message}`);
  }
}

function runState(args) {
  const result = spawnSync('node', [resolve(root, '.ai/scripts/loop-state.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(`loop-state ${args.join(' ')} failed:\n${result.stderr.trim()}`);
  return result.stdout;
}

function stop(event, note) {
  runState(['stop', '--event', event, '--note', note]);
  console.error(`hard stop recorded: ${event}`);
  process.exit(1);
}

/**
 * Write a `managed=` output for the workflow to gate on.
 *
 * The workflow cannot evaluate the loop's identity rules in a GitHub expression,
 * so this script — which runs from the trusted base branch — decides whether the
 * closed pull request is AI-managed and reports it. Anything other than a clear
 * `true` leaves the job skipped.
 */
function emitManaged(value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile !== undefined) {
    try {
      appendFileSync(outputFile, `managed=${value ? 'true' : 'false'}\n`);
    } catch (error) {
      fail(`could not write GITHUB_OUTPUT: ${error.message}`);
    }
  }
}

const statePath = resolve(root, config.paths.state);
const queuePath = resolve(root, config.paths.queue);

/** The recently merged pull requests, newest first. Used by dispatch recovery. */
function listMergedPrs() {
  return ghJson([
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'merged',
    '--limit',
    '100',
    '--json',
    'number,state,mergedAt,mergeCommit,headRefName,baseRefName,isCrossRepository,labels,comments,title',
  ]);
}

/**
 * Reconcile one merged AI pull request against the loop's own records.
 *
 * This is the *single* merge-transition implementation. The `pull_request:
 * closed` path calls it for the pull request that closed; the
 * `workflow_dispatch` recovery calls it for the merge it discovered. It resolves
 * which task the merge completes, is idempotent on the task's `status`, and
 * walks the state machine `ready-to-merge -> merging -> completed -> next-task`.
 *
 * Resolve which task the pull request completes. The loop's recorded active task
 * is authoritative, but the state on the base branch is only as current as the
 * last state commit — the implementation and review stages record `implementing`/
 * `ci-running`/`reviewing` locally and those commits are not guaranteed to reach
 * the base branch before the merge (and the review stage is skipped entirely when
 * no reviewer credential is configured). The queue is the durable record: the
 * implementation records the task's `pr`/`branch` before opening it, so a merge
 * is attributed to the task that owns that PR (or branch).
 *
 * A merged AI-managed pull request that is *not* a queued task is one of two
 * things, and they are not the same event:
 *
 *   * loop infrastructure (`[AI-INFRA]` tooling — a reviewer fix, a workflow
 *     hardening) that merges while a task is still open. It is never in the task
 *     queue, so attributing it to a task would invent a completion and lose
 *     history. It reconciles to a no-op and lets the loop carry on with the task
 *     that is actually in flight.
 *   * a genuinely unattributable loop PR (an AI-managed merge that names no
 *     queued task and is not infrastructure). That is real corruption and must
 *     stop for a human — never invent a task.
 *
 * @returns {'advanced'|'noop'|'infrastructure'} what the reconciliation did.
 */
function reconcileMerge({ pr, prNumber, state, queue }) {
  const classified = classifyMergedLoopPr({ pr, state, queue });
  if (classified.kind === 'infrastructure') {
    // Reconciled: an infrastructure merge does not complete a task. A no-op here
    // is what stops the state-corruption hard stop and lets the next-task
    // workflow continue to the implementation the queue already holds.
    log(
      `PR #${prNumber} is loop infrastructure (not a queued task); no task advances. The loop carries on with the task in flight.`,
    );
    return 'infrastructure';
  }
  if (classified.kind === 'unattributable') {
    stop(
      'state-corruption',
      `PR #${prNumber} merged but neither the loop state nor the task queue records it as a task`,
    );
  }
  const task = classified.task;
  const taskId = classified.taskId;

  // Idempotency: a duplicate `pull_request: closed` delivery (or an operator
  // re-run) must not generate the next task twice. The task's own `status` is the
  // discriminator — the implementation stage already records `task.pr` before the
  // merge, so the PR number alone cannot tell "about to advance" from "already
  // advanced". A task already recorded `done` means the transition happened.
  if (task.status === 'done') {
    log(`task ${taskId} is already recorded as done; nothing to advance.`);
    return 'noop';
  }

  // Carry the reviewer's outstanding findings onto the task so the architect can
  // read what the review actually found, not just that it approved.
  const verdicts = [];
  for (const comment of pr.comments ?? []) {
    for (const marker of parseReviewMarkers(comment?.body ?? '')) {
      if (marker.verdict !== null) verdicts.push(marker);
    }
  }
  const lastVerdict = verdicts.sort((a, b) => a.round - b.round).at(-1);

  task.status = 'done';
  task.pr = prNumber;
  task.branch = pr.headRefName;
  task.headSha = pr.mergeCommit?.oid ?? process.env.MERGED_SHA ?? task.headSha ?? null;
  task.mergedAt = pr.mergedAt ?? new Date().toISOString();
  task.completedAt = new Date().toISOString();
  if (lastVerdict !== undefined && lastVerdict.verdict === 'changes-requested') {
    task.reviewFindings = [`round ${lastVerdict.round}: ${lastVerdict.verdict}`];
  }
  queue.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
  log(`recorded ${taskId} as done (PR #${prNumber} merged).`);

  // ready-to-merge -> merging -> completed -> next-task. The state machine
  // requires the `merging` step, so the loop records it explicitly; jumping
  // straight to `completed` would be refused as an illegal transition. A state
  // that has already reached `merging` (a re-run) is not re-recorded.
  const statusBeforeComplete = state.status;
  if (statusBeforeComplete === 'idle') {
    log('recovering idle state to next-task before completion');
    runState(['recover', '--note', 'bootstrap recovery before completion']);
  } else if (statusBeforeComplete === 'ready-to-merge') {
    runState(['set', '--status', 'merging', '--note', `PR #${prNumber} merged`]);
  }
  runState(['complete', '--task', taskId, '--note', `PR #${prNumber} merged`]);
  runState(['set', '--status', 'next-task', '--note', 'advancing to next-task generation']);
  log('the loop is ready to generate the next task.');
  return 'advanced';
}

// --- recovery: push and workflow_dispatch ----------------------------------
//
// Two recovery triggers reuse the same reconciliation as the normal
// `pull_request: closed` path rather than a second merge-transition path:
//
//   * `push` to the state file — a recovery *check* only. When the state is a
//     legitimate `next-task` state with no active task or pull request (a merge
//     whose architect dispatch never ran) it reports `managed=true` so the
//     workflow dispatches the architect. It never advances a merge, creates a
//     task or touches a pull request.
//   * `workflow_dispatch` — operator recovery. The `pull_request: closed`
//     delivery that should have advanced the loop may have been missed (or the
//     state on the base branch was never advanced), so it *discovers* the merge
//     the loop missed and reconciles it through the same logic above. If nothing
//     needs reconciling it falls back to the between-tasks check, so a recovery
//     run over an already-consistent state cannot re-complete a task or generate
//     a duplicate next task.
if (process.env.EVENT_NAME === 'push' || process.env.EVENT_NAME === 'workflow_dispatch') {
  const state = readJson(statePath, 'loop state');
  const queue = readJson(queuePath, 'task queue');

  // Discovery queries GitHub, so it runs only for the operator recovery trigger;
  // the push trigger stays a pure, network-free state check.
  if (process.env.EVENT_NAME === 'workflow_dispatch') {
    const merged = selectMergedTaskPr({ mergedPrs: listMergedPrs(), state, queue, config });
    if (merged !== null && merged.pr.number !== undefined) {
      const outcome = reconcileMerge({ pr: merged.pr, prNumber: merged.pr.number, state, queue });
      if (outcome === 'advanced') {
        emitManaged(true);
        process.exit(0);
      }
    }
  }

  // Nothing to reconcile (or a push): a `next-task` state with no active task or
  // pull request is a merge whose architect dispatch never ran. The queue is the
  // durable record — a pending/in-flight task there means the dispatch already
  // ran and re-dispatching would generate a duplicate next task.
  if (isRecoverableNextTaskState(state, queue)) {
    emitManaged(true);
    log(
      'the loop is in a recoverable next-task state with no active task or pull request; dispatching the architect.',
    );
    process.exit(0);
  }
  emitManaged(false);
  log('nothing to reconcile and the loop is not in a recoverable next-task state.');
  process.exit(0);
}

const prNumber = Number.parseInt(process.env.MERGED_PR ?? '', 10);
if (!Number.isInteger(prNumber) || prNumber < 1) fail('MERGED_PR must be a pull request number', 2);

const state = readJson(statePath, 'loop state');
const queue = readJson(queuePath, 'task queue');

const pr = ghJson([
  'pr',
  'view',
  String(prNumber),
  '--repo',
  repo,
  '--json',
  'number,state,mergedAt,mergeCommit,headRefName,baseRefName,isCrossRepository,labels,comments,title',
]);

// Only an AI-managed pull request can affect the loop. The identity is the
// loop's own record — the recorded active PR, the trigger label, a trusted
// review marker, a queued task id — plus the loop's own `automation/*` branch.
// An implementation task on `feat/*` or `fix/*` is just as much the loop's own
// work, so branch naming alone must never be the test. This check runs first so
// that an unrelated pull request closing (with or without a merge) is a no-op
// rather than a hard stop.
const aiManaged = isAiManagedPullRequest({
  pr,
  state,
  queue,
  config,
  mergeCommitSha: pr.mergeCommit?.oid,
});
if (!aiManaged) {
  emitManaged(false);
  log(`PR #${prNumber} is not an AI-managed loop pull request; nothing to advance.`);
  process.exit(0);
}

// `gh pr view` has no `merged` boolean field; a merged pull request is one whose
// `mergedAt` is set. Asking for a non-existent field makes `gh` exit non-zero, so
// the previous field list made every next-task run fail before it advanced.
if (typeof pr.mergedAt !== 'string' || pr.mergedAt.length === 0) {
  // The loop's own pull request was closed without merging. That is a human
  // decision the loop cannot interpret, so it stops rather than guessing.
  stop('merge-conflict', `PR #${prNumber} was closed without merging`);
}

const outcome = reconcileMerge({ pr, prNumber, state, queue });
if (outcome === 'advanced') emitManaged(true);
else emitManaged(false);
