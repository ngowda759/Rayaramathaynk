#!/usr/bin/env node
/**
 * Structural validation of the repository's GitHub Actions workflows.
 *
 * Node ships no YAML parser and the project deliberately keeps its dependency
 * surface small, so this script checks the invariants that actually break a
 * workflow or violate the repository's CI policy:
 *
 *   - no tab characters used for indentation;
 *   - a top-level `name:`, `on:` and `jobs:` key;
 *   - every job declares `runs-on`;
 *   - every `uses:` reference is pinned to a tag or SHA (never a moving branch);
 *   - every workflow declares an explicit top-level `permissions:` block.
 *
 * GitHub parses the YAML itself on push, so this complements that with the
 * policy checks GitHub does not enforce.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowsDir = resolve(root, '.github', 'workflows');

const UNPINNED = new Set(['main', 'master', 'HEAD', 'latest']);
const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function checkWorkflow(file) {
  const contents = readFileSync(join(workflowsDir, file), 'utf8');
  const lines = contents.split('\n');

  lines.forEach((line, index) => {
    if (/^\s*\t/.test(line)) fail(file, `line ${index + 1}: tab used for indentation`);
  });

  for (const key of ['name:', 'on:', 'jobs:']) {
    if (!lines.some((line) => line.startsWith(key))) {
      fail(file, `missing top-level "${key}"`);
    }
  }

  if (!lines.some((line) => line.startsWith('permissions:'))) {
    fail(file, 'missing an explicit top-level "permissions:" block');
  }

  const jobsIndex = lines.findIndex((line) => line.startsWith('jobs:'));
  if (jobsIndex !== -1) {
    for (let index = jobsIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.length > 0 && !/^\s/.test(line)) break; // next top-level key
      const jobMatch = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (jobMatch === null) continue;
      const body = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor];
        if (candidate.length > 0 && !/^ {3,}/.test(candidate)) break;
        body.push(candidate);
      }
      if (!body.some((candidate) => /^\s{4}runs-on:/.test(candidate))) {
        fail(file, `job "${jobMatch[1]}" (line ${index + 1}) does not declare runs-on`);
      }
    }
  }

  lines.forEach((line, index) => {
    const match = /uses:\s*(\S+)/.exec(line);
    if (match === null) return;
    const reference = match[1];
    if (reference.startsWith('./')) return;
    const at = reference.lastIndexOf('@');
    if (at === -1) {
      fail(file, `line ${index + 1}: action "${reference}" is not pinned to a version`);
      return;
    }
    if (UNPINNED.has(reference.slice(at + 1))) {
      fail(file, `line ${index + 1}: action "${reference}" is pinned to a moving ref`);
    }
  });
}

const files = readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file));
if (files.length === 0) fail('workflows', 'no workflow files found');

for (const file of files) checkWorkflow(file);

if (failures.length > 0) {
  console.error(`Workflow validation failed with ${failures.length} error(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Validated ${files.length} workflow file(s): ${files.join(', ')}.`);
