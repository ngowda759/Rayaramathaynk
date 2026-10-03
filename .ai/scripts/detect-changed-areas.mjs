#!/usr/bin/env node
/**
 * Classify changed repository paths for the AI development loop.
 *
 * Reads the changed paths (arguments, or stdin when piped) and reports:
 *   - the architectural area each path belongs to;
 *   - whether any protected path was touched (which requires human review);
 *   - whether the change exceeds the configured size limits.
 *
 * Usage:
 *   git diff --name-only origin/main...HEAD | node .ai/scripts/detect-changed-areas.mjs
 *   node .ai/scripts/detect-changed-areas.mjs path/a path/b
 *   node .ai/scripts/detect-changed-areas.mjs --json
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = JSON.parse(readFileSync(resolve(root, '.ai', 'loop.config.json'), 'utf8'));

/** Ordered so the first matching rule wins; keep the most specific rules first. */
const AREAS = [
  { name: 'ai-loop', test: (path) => path.startsWith('.ai/') },
  { name: 'openhands-skill', test: (path) => path.startsWith('.openhands/') },
  { name: 'ci', test: (path) => path.startsWith('.github/') },
  { name: 'database', test: (path) => path.startsWith('prisma/') },
  { name: 'api', test: (path) => path.startsWith('apps/api/') },
  { name: 'web', test: (path) => path.startsWith('apps/web/') },
  { name: 'domain', test: (path) => path.startsWith('packages/domain/') },
  { name: 'validation', test: (path) => path.startsWith('packages/validation/') },
  { name: 'application', test: (path) => path.startsWith('packages/application/') },
  { name: 'infrastructure', test: (path) => path.startsWith('packages/infrastructure/') },
  { name: 'database-package', test: (path) => path.startsWith('packages/database/') },
  { name: 'config', test: (path) => path.startsWith('packages/config/') },
  { name: 'tests', test: (path) => path.startsWith('tests/') || path.startsWith('e2e/') },
  { name: 'docs', test: (path) => path.startsWith('docs/') || /\.(md|mdx)$/.test(path) },
];

const DOUBLE_STAR = '__DOUBLE_STAR__';

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, '[^/]*')
    .split(DOUBLE_STAR)
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

const protectedPatterns = config.protectedPaths.map((glob) => globToRegExp(glob));

function classify(path) {
  const area = AREAS.find((candidate) => candidate.test(path));
  return area === undefined ? 'other' : area.name;
}

function isProtected(path) {
  return protectedPatterns.some((pattern) => pattern.test(path));
}

function readPaths() {
  const fromArgs = process.argv.slice(2).filter((arg) => arg !== '--json');
  if (fromArgs.length > 0) return fromArgs;
  if (process.stdin.isTTY) return [];
  return readFileSync(0, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const paths = readPaths();
const areas = new Map();
const protectedHits = [];

for (const path of paths) {
  const area = classify(path);
  areas.set(area, (areas.get(area) ?? 0) + 1);
  if (isProtected(path)) protectedHits.push(path);
}

const report = {
  changedFiles: paths.length,
  areas: Object.fromEntries([...areas.entries()].sort(([a], [b]) => a.localeCompare(b))),
  protectedPaths: protectedHits,
  exceedsFileLimit:
    config.limits.maxChangedFiles !== undefined && paths.length > config.limits.maxChangedFiles,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`changed files: ${report.changedFiles}`);
  for (const [area, count] of Object.entries(report.areas)) {
    console.log(`  ${area}: ${count}`);
  }
  if (protectedHits.length > 0) {
    console.log('protected paths touched (human review required):');
    for (const path of protectedHits) console.log(`  - ${path}`);
  }
  if (report.exceedsFileLimit) {
    console.log(
      `warning: ${report.changedFiles} files exceeds maxChangedFiles ${config.limits.maxChangedFiles}`,
    );
  }
}

// A protected path does not fail the run; it flags it for human review.
// Only an oversized change is treated as a hard failure for the loop.
process.exit(report.exceedsFileLimit ? 1 : 0);
