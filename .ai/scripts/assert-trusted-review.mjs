#!/usr/bin/env node
/**
 * Security regression guard for the trusted AI-loop workflows.
 *
 * The review and merge-gate workflows run with the base repository's token and
 * secrets (`workflow_run`), so a mistake in them is a privilege-escalation bug,
 * not a style issue. This script reads their YAML as text — no YAML parser is
 * available and the repository deliberately keeps its dependency surface small —
 * and fails when any of the rules that keep them trusted is broken:
 *
 *   1. no checkout of the pull request head, merge ref, or an event-controlled
 *      `ref:` expression;
 *   2. every `actions/checkout` step pins `ref:` to the default branch and sets
 *      `persist-credentials: false`;
 *   3. no `npm ci` / `npm install` / `npm run` / `yarn` / `pnpm` — nothing from
 *      the pull request is ever installed or executed;
 *   4. no shell `source`/`.` of a repository file;
 *   5. no `pull_request_target` trigger;
 *   6. no `contents: write` in the review workflow.
 *
 * Usage:
 *   node .ai/scripts/assert-trusted-review.mjs
 *   node .ai/scripts/assert-trusted-review.mjs --json
 *
 * Exit code 0 when every rule holds, 1 otherwise.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `AI_LOOP_ROOT` overrides the repository root so tests can point the guard at a
// deliberately broken copy of the workflows. Production and CI never set it.
const root =
  process.env.AI_LOOP_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowsDir = resolve(root, '.github', 'workflows');

/** Workflows that hold the base repository's secrets and therefore must stay trusted. */
const TRUSTED_WORKFLOWS = [
  'ai-loop-review.yml',
  'ai-loop-merge-gate.yml',
  'ai-loop-next-task.yml',
  'ai-loop-implement.yml',
];

/** Workflows that must never hold `contents: write`. */
const READ_ONLY_WORKFLOWS = [
  'ai-loop-review.yml',
  'ai-loop-next-task.yml',
  'ai-loop-implement.yml',
];

/** Command patterns that would execute pull-request-controlled code. */
const EXECUTION_PATTERNS = [
  { pattern: /\bnpm\s+(ci|install|i|run|test|exec)\b/, label: 'runs an npm command' },
  { pattern: /\b(yarn|pnpm)\b/, label: 'runs a yarn/pnpm command' },
  { pattern: /\bnpx\s+/, label: 'runs npx' },
  { pattern: /\bnode_modules\b/, label: 'references node_modules' },
  {
    pattern: /(^|\s)(source|\.)\s+\S+\.(sh|bash|mjs|cjs|js)\b/,
    label: 'sources a repository file',
  },
];

/** Checkout `ref:` expressions that would put PR-controlled code on disk. */
const UNSAFE_REF_PATTERNS = [
  { pattern: /pull_request\.head/, label: 'checkout ref uses the pull request head' },
  { pattern: /pull_request\.merge/, label: 'checkout ref uses the pull request merge ref' },
  { pattern: /workflow_run\.head_(sha|branch)/, label: 'checkout ref uses the workflow_run head' },
  { pattern: /github\.head_ref/, label: 'checkout ref uses github.head_ref' },
  { pattern: /github\.sha/, label: 'checkout ref uses github.sha' },
  { pattern: /github\.event\.pull_request/, label: 'checkout ref uses the pull request event' },
];

const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function checkWorkflow(file) {
  const path = join(workflowsDir, file);
  if (!existsSync(path)) {
    fail(file, 'missing trusted workflow');
    return;
  }
  const contents = readFileSync(path, 'utf8');
  const lines = contents.split('\n');

  if (/^\s*pull_request_target\s*:/m.test(contents)) {
    fail(file, 'uses the pull_request_target trigger');
  }

  lines.forEach((line, index) => {
    // Comments describe the rules; they do not break them.
    if (/^\s*#/.test(line)) return;
    for (const { pattern, label } of EXECUTION_PATTERNS) {
      if (pattern.test(line)) fail(file, `line ${index + 1}: ${label} (${line.trim()})`);
    }
  });

  // Every checkout must be pinned to the default branch and must not keep the
  // credentials in the working tree.
  let checkoutIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/uses:\s*actions\/checkout@/.test(line)) continue;
    checkoutIndex = index;
    const body = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor];
      if (candidate.trim().length > 0 && !/^\s{6,}/.test(candidate)) break;
      body.push(candidate);
    }
    const block = body.join('\n');
    if (!/ref:\s*\$\{\{\s*github\.event\.repository\.default_branch/.test(block)) {
      fail(file, `checkout at line ${index + 1} is not pinned to the default branch`);
    }
    if (!/persist-credentials:\s*false/.test(block)) {
      fail(file, `checkout at line ${index + 1} does not set persist-credentials: false`);
    }
    // Only the checkout's own `ref:` matters. A `HEAD_SHA`/`MERGED_SHA` passed
    // through `env:` is data the scripts read, not a ref the checkout follows.
    for (const refLine of body.filter((candidate) => /^\s*ref:/.test(candidate))) {
      for (const { pattern, label } of UNSAFE_REF_PATTERNS) {
        if (pattern.test(refLine)) fail(file, `checkout at line ${index + 1}: ${label}`);
      }
    }
  }
  if (checkoutIndex === -1) fail(file, 'has no actions/checkout step');

  if (READ_ONLY_WORKFLOWS.includes(file) && /^\s{2}contents:\s*write\s*$/m.test(contents)) {
    fail(file, 'declares contents: write but must stay read-only');
  }

  if (TRUSTED_WORKFLOWS.includes(file) && !/^\s*permissions:/m.test(contents)) {
    fail(file, 'has no explicit top-level permissions block');
  }
}

const present = readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file));
for (const file of TRUSTED_WORKFLOWS) checkWorkflow(file);

const report = {
  checked: TRUSTED_WORKFLOWS.filter((file) => present.includes(file)),
  failures,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
}

if (failures.length > 0) {
  console.error(`Trusted-workflow security check failed with ${failures.length} error(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Trusted-workflow security check passed for ${report.checked.length} workflow(s): ${report.checked.join(', ')}.`,
);
