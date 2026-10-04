#!/usr/bin/env node
/**
 * Wait for the pull request's required checks to finish.
 *
 * The reviewer must not inspect a half-finished build, so the review workflow
 * calls this before `chatgpt-review.mjs`. It polls `gh pr checks` until every
 * check named in `.ai/loop.config.json` `requiredChecks` has a terminal state,
 * or the timeout expires.
 *
 * This script never fails the workflow on a red build: a failing check is a
 * review input, not a workflow error, and the reviewer is the stage that turns
 * it into a `changes-requested` verdict. It only fails when the checks cannot be
 * read at all.
 *
 * Usage:
 *   node .ai/scripts/wait-for-ci.mjs --pr 42
 *   node .ai/scripts/wait-for-ci.mjs --pr 42 --timeout-seconds 600 --interval-seconds 15
 *
 * Environment:
 *   GH_TOKEN       required for the `gh` calls
 *   AI_LOOP_ROOT   overrides the repository root (tests only)
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyCi } from './review-core.mjs';

const root =
  process.env.AI_LOOP_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = JSON.parse(readFileSync(resolve(root, '.ai/loop.config.json'), 'utf8'));

const DEFAULTS = { timeoutSeconds: 900, intervalSeconds: 15 };

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const args = parseArgs(process.argv.slice(2));
if (typeof args.pr !== 'string') {
  console.error(
    'usage: wait-for-ci.mjs --pr <number> [--timeout-seconds N] [--interval-seconds N]',
  );
  process.exit(2);
}

const prNumber = Number.parseInt(args.pr, 10);
if (!Number.isInteger(prNumber) || prNumber < 1) {
  console.error('--pr must be a positive integer');
  process.exit(2);
}

const timeoutSeconds = toPositiveInteger(args['timeout-seconds'], DEFAULTS.timeoutSeconds);
const intervalSeconds = toPositiveInteger(args['interval-seconds'], DEFAULTS.intervalSeconds);
const repoArgs = ['--repo', process.env.GITHUB_REPOSITORY ?? 'ngowda759/Rayaramathaynk'];

function readChecks() {
  const result = spawnSync(
    'gh',
    ['pr', 'checks', String(prNumber), ...repoArgs, '--json', 'name,state,bucket,link'],
    { cwd: root, encoding: 'utf8' },
  );

  // A pull request that has not been picked up by any workflow yet makes `gh`
  // exit non-zero with "no checks reported". That is a normal race on `opened`,
  // not an error: report it as an empty set so the loop keeps waiting.
  if (result.status !== 0) {
    const stderr = result.stderr ?? '';
    if (/no checks reported|no checks/i.test(stderr)) return [];
    console.error(`gh pr checks failed:\n${stderr.trim()}`);
    process.exit(1);
  }

  const stdout = result.stdout.trim();
  if (stdout.length === 0) return [];
  try {
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`gh pr checks returned non-JSON output: ${error.message}`);
    process.exit(1);
  }
}

function sleep(seconds) {
  // Synchronous sleep: the whole script is a simple polling loop, and GitHub
  // Actions has no other work to interleave here.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

const deadline = Date.now() + timeoutSeconds * 1000;

for (;;) {
  const ci = classifyCi(readChecks(), config.requiredChecks);

  if (ci.status !== 'pending') {
    console.log(`required checks finished with status: ${ci.status}`);
    for (const check of ci.required) {
      console.log(`  ${check.name}: ${check.state} (${check.bucket})`);
    }
    // A red build is a review input, not a workflow failure.
    process.exit(0);
  }

  if (Date.now() >= deadline) {
    console.log(
      `required checks still pending after ${timeoutSeconds}s; handing the current state to the reviewer`,
    );
    for (const check of ci.required) {
      console.log(`  ${check.name}: ${check.state} (${check.bucket})`);
    }
    process.exit(0);
  }

  console.log(`waiting for ${ci.pending.length} required check(s) ...`);
  sleep(intervalSeconds);
}
