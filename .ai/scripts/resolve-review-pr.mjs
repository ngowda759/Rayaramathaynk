#!/usr/bin/env node
/**
 * Resolve which pull request a trusted `workflow_run` job should act on.
 *
 * A `workflow_run` event does not always carry the pull request number — for a
 * fork it is empty, and for a branch push there is no pull request at all. This
 * script resolves the number from the event, the branch name or an explicit
 * input, verifies the pull request is an AI-loop pull request from this
 * repository, and writes `number` to `$GITHUB_OUTPUT`.
 *
 * It writes an empty `number` (and exits 0) when there is nothing to review, so
 * the calling job can skip rather than fail on an unrelated CI run.
 *
 * Usage (from a workflow step):
 *   node .ai/scripts/resolve-review-pr.mjs
 *
 * Environment:
 *   GH_TOKEN, GITHUB_REPOSITORY, HEAD_BRANCH, HEAD_SHA, EVENT_PR, INPUT_PR
 *   GITHUB_OUTPUT   the file to append the `number=` output to
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isAiManagedPullRequest, loadConfig, REPO_ROOT } from './loop-core.mjs';

const config = loadConfig(REPO_ROOT);
const repo = process.env.GITHUB_REPOSITORY ?? 'ngowda759/Rayaramathaynk';
const outputFile = process.env.GITHUB_OUTPUT;

function readJsonIfPresent(relativePath) {
  const path = resolve(REPO_ROOT, relativePath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const loopState = readJsonIfPresent(config.paths.state);
const taskQueue = readJsonIfPresent(config.paths.queue);

function emit(number) {
  if (outputFile !== undefined) appendFileSync(outputFile, `number=${number}\n`);
  console.log(`review target: ${number === '' ? '(none)' : `PR #${number}`}`);
}

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function ghJson(args) {
  const result = gh(args);
  if (!result.ok) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function isLoopPullRequest(pr) {
  return isAiManagedPullRequest({ pr, state: loopState, queue: taskQueue, config });
}

const candidates = [];
if (typeof process.env.INPUT_PR === 'string' && process.env.INPUT_PR.length > 0) {
  candidates.push(Number.parseInt(process.env.INPUT_PR, 10));
}
if (typeof process.env.EVENT_PR === 'string' && process.env.EVENT_PR.length > 0) {
  candidates.push(Number.parseInt(process.env.EVENT_PR, 10));
}

// Resolve by the head branch whether or not it uses the loop prefix: an AI task
// may live on `feat/*` or `fix/*`. The PR is still required to be AI-managed, so
// widening the lookup does not widen what gets reviewed.
const branch = process.env.HEAD_BRANCH ?? '';
if (branch.length > 0) {
  const list = ghJson([
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number,headRefName,baseRefName,isCrossRepository,labels,title',
    '--limit',
    '10',
  ]);
  for (const pr of Array.isArray(list) ? list : []) {
    if (isLoopPullRequest(pr)) candidates.push(pr.number);
  }
}

for (const number of candidates.filter((value) => Number.isInteger(value) && value > 0)) {
  const pr = ghJson([
    'pr',
    'view',
    String(number),
    '--repo',
    repo,
    '--json',
    'number,headRefName,baseRefName,isCrossRepository,labels,title,state',
  ]);
  if (isLoopPullRequest(pr) && pr.state === 'OPEN') {
    emit(number);
    process.exit(0);
  }
}

// Nothing to review: an unrelated CI run, a closed PR, or a fork. Not an error.
emit('');
process.exit(0);
