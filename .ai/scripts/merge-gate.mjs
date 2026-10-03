#!/usr/bin/env node
/**
 * The AI development loop's merge gate.
 *
 * This is the only place the loop merges, and it merges only when every
 * automated gate passes. The gate re-derives all of its evidence at merge time
 * rather than trusting the earlier review: between the approval and the merge a
 * push, a label change or a new commit could have invalidated it, and a merge on
 * stale evidence is the failure this script exists to prevent.
 *
 * It never bypasses branch protection. It arms GitHub's native auto-merge when
 * the repository supports it (so the merge happens through the normal protected
 * path), and falls back to an explicit `gh pr merge` only when configured to.
 *
 * Usage:
 *   node .ai/scripts/merge-gate.mjs --pr 42
 *   node .ai/scripts/merge-gate.mjs --pr 42 --dry-run
 *   node .ai/scripts/merge-gate.mjs --pr 42 --json
 *
 * Environment:
 *   GH_TOKEN / GITHUB_TOKEN   required for every `gh` call
 *   GITHUB_REPOSITORY         owner/repo, injected by GitHub Actions
 *   AI_LOOP_ROOT              overrides the repository root (tests only)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { classifyCi, parseReviewMarkers } from './review-core.mjs';
import { evaluateMergeGate, loadConfig, REPO_ROOT } from './loop-core.mjs';

const root = process.env.AI_LOOP_ROOT ?? REPO_ROOT;
const config = loadConfig(root);
const repo = process.env.GITHUB_REPOSITORY ?? 'ngowda759/Rayaramathaynk';

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

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function log(message) {
  console.log(message);
}

function runGh(args) {
  const result = spawnSync('gh', args, { cwd: root, encoding: 'utf8' });
  if (result.error !== undefined) fail(`failed to run gh: ${result.error.message}`);
  if (result.status !== 0) fail(`gh ${args.join(' ')} failed:\n${result.stderr.trim()}`);
  return result.stdout;
}

function tryGh(args) {
  const result = spawnSync('gh', args, { cwd: root, encoding: 'utf8' });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function ghJson(args) {
  const stdout = runGh(args);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    fail(`gh ${args.join(' ')} returned non-JSON output: ${error.message}`);
  }
}

/**
 * The loop state, or null when it cannot be read.
 *
 * A missing state file is not fatal: the merge gate falls back to the pull
 * request's own evidence (see `evaluateMergeGate`). A *malformed* state file is
 * fatal, because that is corruption rather than absence.
 */
function readState() {
  const path = resolve(root, config.paths.state);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`the loop state is not valid JSON: ${error.message}`);
  }
}

/** The task queue, or null when it cannot be read. Used for task-id identity. */
function readQueue() {
  const path = resolve(root, config.paths.queue);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`the task queue is not valid JSON: ${error.message}`);
  }
}

/** The latest review verdict recorded in the PR comments, and the SHA it covered. */
function latestVerdict(comments) {
  let best = null;
  for (const comment of comments ?? []) {
    for (const marker of parseReviewMarkers(comment?.body ?? '')) {
      if (marker.verdict === null) continue;
      if (best === null || marker.round > best.round) best = marker;
    }
  }
  return best;
}

function changedPaths(prNumber) {
  const files = ghJson(['pr', 'view', String(prNumber), '--repo', repo, '--json', 'files']);
  return (files.files ?? []).map((file) => file.path).filter((path) => typeof path === 'string');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === true;
  const asJson = args.json === true;

  if (typeof args.pr !== 'string')
    fail('usage: merge-gate.mjs --pr <number> [--dry-run] [--json]', 2);
  const prNumber = Number.parseInt(args.pr, 10);
  if (!Number.isInteger(prNumber) || prNumber < 1) fail('--pr must be a positive integer', 2);

  const state = readState();

  const pr = ghJson([
    'pr',
    'view',
    String(prNumber),
    '--repo',
    repo,
    '--json',
    'number,title,state,mergedAt,baseRefName,headRefName,headRefOid,labels,comments,isCrossRepository,mergeable,mergeStateStatus',
  ]);

  const checks = ghJson([
    'pr',
    'checks',
    String(prNumber),
    '--repo',
    repo,
    '--json',
    'name,state,bucket,link',
  ]);
  const ci = classifyCi(checks, config.requiredChecks);

  const labels = (pr.labels ?? [])
    .map((label) => label.name)
    .filter((name) => typeof name === 'string');
  const verdict = latestVerdict(pr.comments);
  const paths = changedPaths(prNumber);

  const evaluation = evaluateMergeGate({
    pr: {
      number: pr.number,
      state: pr.state,
      merged: typeof pr.mergedAt === 'string' && pr.mergedAt.length > 0,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      headRefOid: pr.headRefOid,
      isCrossRepository: pr.isCrossRepository,
      mergeable: pr.mergeable,
      labels,
      title: pr.title,
    },
    state,
    verdict: verdict?.verdict ?? undefined,
    verdictHeadSha: verdict?.headSha ?? undefined,
    ci,
    changedPaths: paths,
    config,
    queue: readQueue(),
  });

  const report = {
    pr: prNumber,
    headSha: pr.headRefOid,
    allowed: evaluation.allowed,
    checks: evaluation.checks,
    reasons: evaluation.reasons,
    protectedPaths: evaluation.protectedHits,
    credentials: evaluation.credentials,
    verdict: verdict?.verdict ?? null,
    verdictHeadSha: verdict?.headSha ?? null,
    ciStatus: ci.status,
  };

  if (asJson) log(JSON.stringify(report, null, 2));

  if (!evaluation.allowed) {
    if (!asJson) {
      log(`merge denied for PR #${prNumber}:`);
      for (const reason of evaluation.reasons) log(`  - ${reason}`);
    }
    process.exit(1);
  }

  // A protected path or credential change is a human decision, not a CI failure.
  const humanReview =
    config.automation.stopOnHumanReviewRequired === true &&
    (evaluation.protectedHits.length > 0 || evaluation.credentials.length > 0);
  if (humanReview) {
    log(
      `PR #${prNumber} is otherwise mergeable but touches protected paths; a human must merge it.`,
    );
    process.exit(3);
  }

  if (config.mergeGate.enabled !== true || config.automation.autoMerge !== true) {
    log(`PR #${prNumber} passed every gate; auto-merge is disabled by configuration.`);
    process.exit(0);
  }

  if (dryRun) {
    log(`dry run: PR #${prNumber} passed every gate; the merge would be armed now.`);
    log(`  method: ${config.automation.mergeMethod}`);
    log(`  native auto-merge: ${config.automation.useNativeAutoMerge === true}`);
    process.exit(0);
  }

  // Prefer GitHub's own auto-merge: it merges through the protected path and
  // respects every branch-protection rule, rather than racing them.
  if (config.automation.useNativeAutoMerge === true) {
    const armed = tryGh([
      'pr',
      'merge',
      String(prNumber),
      '--repo',
      repo,
      '--auto',
      `--${config.automation.mergeMethod}`,
    ]);
    if (armed.ok) {
      log(`armed native auto-merge for PR #${prNumber} (${config.automation.mergeMethod}).`);
      process.exit(0);
    }
    // Repositories without auto-merge enabled fall through to an explicit merge
    // only when the PR is already mergeable; otherwise the gate stops here.
    log(`native auto-merge unavailable: ${armed.stderr.trim().split('\n')[0]}`);
    if (pr.mergeable !== 'MERGEABLE') {
      fail(
        'the pull request is not mergeable and native auto-merge is unavailable; a human is needed.',
      );
    }
  }

  const merged = tryGh([
    'pr',
    'merge',
    String(prNumber),
    '--repo',
    repo,
    `--${config.automation.mergeMethod}`,
  ]);
  if (!merged.ok) fail(`the merge failed: ${merged.stderr.trim()}`);
  log(`merged PR #${prNumber} with method ${config.automation.mergeMethod}.`);
}

main();
