#!/usr/bin/env node
/**
 * Review stage of the AI development loop.
 *
 * An external reviewer model is the reviewer; Jules is the
 * implementer/fixer. This script is the orchestrator between them, and it is the
 * *only* place a review verdict is produced. The provider is configuration, not
 * code: `config.review` supplies the provider, endpoint, model and credential
 * environment variable, and the loop's default is OpenRouter's free model router
 * (`openrouter/free`) so the autonomous loop does not need a paid API.
 *
 * What it does, in order:
 *   1. reads the pull request (metadata, diff, checks, existing comments);
 *   2. decides whether this head SHA still needs a review (never twice);
 *   3. asks the configured Responses API for a strict, schema-constrained verdict;
 *   4. validates the verdict and applies the loop's own rules on top;
 *   5. records the review in `.ai/state/review-log.jsonl`;
 *   6. posts the review as a PR comment carrying the dedupe marker;
 *   7. sets the loop state and labels;
 *   8. on `changes-requested`, hands the findings to Jules on the SAME PR.
 *
 * Security: the pull request is treated purely as data. Nothing from the PR is
 * executed, installed, built or sourced — the diff is read as text and sent to
 * the model. No repository secret is ever printed.
 *
 * Retry behaviour: a 429 / quota / rate-limit response is an infrastructure
 * failure and stops the run. There is deliberately no automatic retry — the free
 * router has a daily request budget and a retry loop would burn it. The operator
 * re-runs the workflow once the quota resets.
 *
 * Usage:
 *   node .ai/scripts/chatgpt-review.mjs --pr 42
 *   node .ai/scripts/chatgpt-review.mjs --pr 42 --dry-run
 *   node .ai/scripts/chatgpt-review.mjs --pr 42 --response-file canned.json
 *
 * Environment:
 *   OPENROUTER_API_KEY      required unless --dry-run/--response-file; the
 *                           variable name comes from `config.review.apiKeyEnvVar`
 *   OPENROUTER_REVIEW_MODEL optional; defaults to the configured review model
 *   JULES_API_KEY       optional; absent means the fix dispatch skips cleanly
 *   OPENHANDS_HOST          optional; defaults to https://app.all-hands.dev
 *   GH_TOKEN                required for every `gh` call
 *   AI_LOOP_ROOT            overrides the repository root (tests only)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildComment,
  buildFixContext,
  buildReviewRequestBody,
  classifyCi,
  ciFindings,
  coerceVerdict,
  decisionFor,
  extractOutputText,
  normalizeModelReport,
  parseModelJson,
  planReview,
  resolveApiKey,
  resolveReviewModel,
  reviewEndpoint,
  validateReport,
} from './review-core.mjs';
import { validateAgainstSchema } from './loop-schema.mjs';
import { credentialViolations, protectedPathViolations } from './loop-core.mjs';

const root =
  process.env.AI_LOOP_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = JSON.parse(readFileSync(resolve(root, '.ai/loop.config.json'), 'utf8'));

/** The diff is truncated before it reaches the model; say so when it happens. */
const MAX_DIFF_CHARS = 120_000;

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
  if (result.status !== 0) {
    fail(`gh ${args.join(' ')} failed:\n${result.stderr.trim()}`);
  }
  return result.stdout;
}

function ghJson(args) {
  const stdout = runGh(args);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    fail(`gh ${args.join(' ')} returned non-JSON output: ${error.message}`);
  }
}

function tryGh(args) {
  const result = spawnSync('gh', args, { cwd: root, encoding: 'utf8' });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Resolve the task id for the PR: loop state first, then the title/branch. */
function resolveTaskId(pr) {
  const statePath = resolve(root, config.paths.state);
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (typeof state.currentTaskId === 'string' && state.currentTaskId.length > 0) {
      return state.currentTaskId;
    }
  }
  const haystack = `${pr.title ?? ''} ${pr.headRefName ?? ''}`;
  const match = /AI-\d+(-T\d+)?/.exec(haystack);
  if (match !== null) return match[0];

  const queue = JSON.parse(readFileSync(resolve(root, config.paths.queue), 'utf8'));
  const inReview = queue.tasks.find((task) => task.status === 'in-review');
  if (inReview !== undefined) return inReview.id;
  return config.loopId;
}

function taskBrief(taskId) {
  const queue = JSON.parse(readFileSync(resolve(root, config.paths.queue), 'utf8'));
  return queue.tasks.find((task) => task.id === taskId) ?? null;
}

function readPrompt(fileName) {
  const absolute = resolve(root, '.ai/prompts', fileName);
  if (!existsSync(absolute)) fail(`missing prompt file: .ai/prompts/${fileName}`, 2);
  return readFileSync(absolute, 'utf8').trim();
}

function repositoryRules() {
  const agents = resolve(root, 'AGENTS.md');
  if (!existsSync(agents)) return '(AGENTS.md not found)';
  const text = readFileSync(agents, 'utf8');
  return text.length > 20_000 ? `${text.slice(0, 20_000)}\n\n[truncated]` : text;
}

/**
 * The paths the pull request changes, as GitHub reports them.
 *
 * `--changed-paths-file` exists so tests can drive the protected-path hard stop
 * without a network round trip.
 */
function changedPaths(args, prNumber, repoArgs) {
  if (typeof args['changed-paths-file'] === 'string') {
    if (!existsSync(args['changed-paths-file'])) {
      fail(`--changed-paths-file not found: ${args['changed-paths-file']}`, 2);
    }
    return readFileSync(args['changed-paths-file'], 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  const files = ghJson(['pr', 'view', String(prNumber), ...repoArgs, '--json', 'files']);
  return (files.files ?? []).map((file) => file.path).filter((path) => typeof path === 'string');
}

/**
 * Protected-path hard stop.
 *
 * The loop must never merge a change to a migration, the CI definition or a
 * credential file on its own judgement, so this is checked before the reviewer
 * is even asked and short-circuits to a human.
 */
function protectedPathStop(paths) {
  const protectedHits = protectedPathViolations(paths, config.protectedPaths);
  const credentials = credentialViolations(paths);
  if (config.automation.stopOnProtectedPath !== true) return null;
  if (protectedHits.length === 0 && credentials.length === 0) return null;
  return { protectedHits, credentials };
}

function buildInstructions() {
  return [readPrompt('system.md'), readPrompt('review.md')].join('\n\n---\n\n');
}

function buildReviewInput({ pr, task, ci, diff, diffTruncated, round, maxReviewRounds }) {
  const lines = [
    '## Pull request under review',
    '',
    `- Number: #${pr.number}`,
    `- Title: ${pr.title}`,
    `- Head branch: ${pr.headRefName}`,
    `- Head SHA: \`${pr.headRefOid}\``,
    `- Base branch: ${pr.baseRefName}`,
    `- Review round: ${round} of ${maxReviewRounds}`,
    '',
    '### Pull request body',
    '',
    typeof pr.body === 'string' && pr.body.length > 0 ? pr.body : '(empty)',
    '',
    '### Task brief',
    '',
    '```json',
    JSON.stringify(task ?? { id: 'unknown', note: 'no brief found in the queue' }, null, 2),
    '```',
    '',
    '### CI results (authoritative)',
    '',
    `- Required checks: ${config.requiredChecks.join(', ')}`,
    `- Overall status: **${ci.status}**`,
    '',
    '| Check | State | Result |',
    '| --- | --- | --- |',
    ...ci.required.map((check) => `| ${check.name} | ${check.state} | ${check.bucket} |`),
    '',
    '### Repository rules (AGENTS.md)',
    '',
    repositoryRules(),
    '',
    `### Diff${diffTruncated ? ' (truncated)' : ''}`,
    '',
    diffTruncated
      ? 'The diff below was truncated to fit the request budget. If you cannot verify a claim from what you can see, say so in the finding rather than assuming.'
      : 'The complete diff of the head commit against the base branch follows.',
    '',
    '```diff',
    diff,
    '```',
    '',
    '### Required output',
    '',
    'Respond with **one JSON object only**, matching `.ai/schemas/review-report.schema.json`.',
    'Do not include any prose, explanation or markdown code fence around it — the first',
    'character of your response must be `{` and the last must be `}`.',
  ];
  return lines.join('\n');
}

async function callReviewer({ apiKey, body, endpoint, provider }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    // The key is never echoed; only the status and the server's message.
    const detail =
      response.status === 429
        ? '\nThis is a rate-limit / quota failure (HTTP 429). The loop does not retry ' +
          'automatically — the free reviewer has a daily request budget. Re-run the workflow ' +
          'after the quota resets rather than looping.'
        : '';
    fail(
      `${provider} review request failed: HTTP ${response.status}\n${text.slice(0, 2000)}${detail}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${provider} returned a non-JSON envelope: ${error.message}`);
  }
}

function appendReviewLog(report) {
  const logPath = resolve(root, config.paths.reviewLog);
  const errors = validateAgainstSchema(
    report,
    resolve(root, '.ai/schemas/review-report.schema.json'),
  );
  if (errors.length > 0) {
    fail(`refusing to record an invalid review:\n  - ${errors.join('\n  - ')}`);
  }
  const existing = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  writeFileSync(logPath, `${existing}${JSON.stringify(report)}\n`);
  log(`recorded review round ${report.round} (${report.verdict}) in ${config.paths.reviewLog}`);
}

function setLoopState({ status, round, pr, taskId, verdict, ciStatus }) {
  const args = [
    resolve(root, '.ai/scripts/loop-state.mjs'),
    'set',
    '--status',
    status,
    '--round',
    String(round),
    '--task',
    taskId,
    '--pr',
    String(pr.number),
    '--branch',
    pr.headRefName,
    '--head',
    pr.headRefOid,
    '--verdict',
    verdict,
    '--ci',
    ciStatus,
    '--note',
    `review round ${round}: ${status}`,
  ];
  const result = spawnSync('node', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr.trim());
    fail(`failed to record loop state ${status}`);
  }
}

function applyLabels({ pr, add, remove }) {
  for (const label of add) {
    const result = tryGh(['pr', 'edit', String(pr.number), '--add-label', label]);
    if (!result.ok) log(`note: could not add label ${label}: ${result.stderr.trim()}`);
  }
  for (const label of remove) {
    const result = tryGh(['pr', 'edit', String(pr.number), '--remove-label', label]);
    // Removing a label the PR does not carry is not an error worth reporting.
    if (!result.ok && !/not found|does not have/i.test(result.stderr)) {
      log(`note: could not remove label ${label}: ${result.stderr.trim()}`);
    }
  }
}

function dispatchFix({ report, pr, contextFile }) {
  const apiKey = process.env.JULES_API_KEY ?? '';
  const command = [
    resolve(root, '.ai/scripts/dispatch-conversation.mjs'),
    '--stage',
    'fix',
    '--pr',
    String(pr.number),
    '--branch',
    pr.headRefName,
    '--task',
    report.taskId,
    '--context-file',
    contextFile,
  ];

  if (apiKey.length === 0) {
    log(
      'JULES_API_KEY is not configured; skipping the fix dispatch (no conversation started).',
    );
    return;
  }

  const result = spawnSync('node', command, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) fail('the fix dispatch failed; see the log above');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === true;

  if (typeof args.pr !== 'string') {
    fail('usage: chatgpt-review.mjs --pr <number> [--dry-run] [--response-file <path>]', 2);
  }
  const prNumber = Number.parseInt(args.pr, 10);
  if (!Number.isInteger(prNumber) || prNumber < 1) fail('--pr must be a positive integer', 2);

  const repoArgs = ['--repo', process.env.GITHUB_REPOSITORY ?? 'ngowda759/Rayaramathaynk'];

  const pr = ghJson([
    'pr',
    'view',
    String(prNumber),
    ...repoArgs,
    '--json',
    'number,title,body,headRefName,headRefOid,baseRefName,headRepositoryOwner,comments,labels,isCrossRepository',
  ]);

  // Fork pull requests get a read-only token and would be reviewed with a diff
  // we cannot verify against the base repository. Refuse rather than guess.
  if (pr.isCrossRepository === true) {
    log(`PR #${prNumber} comes from a fork; the loop reviews repository branches only. Skipping.`);
    process.exit(0);
  }

  const comments = pr.comments ?? [];
  const plan = planReview({
    comments,
    headSha: pr.headRefOid,
    maxReviewRounds: config.maxReviewRounds,
  });

  if (plan.action === 'skip') {
    log(`no review needed: ${plan.reason}`);
    process.exit(0);
  }

  // A protected-path change is a hard stop that outranks the reviewer: the loop
  // must not merge a migration, a CI definition or a credential file on its own
  // judgement, so the pull request is parked for a human before any review.
  const paths = changedPaths(args, prNumber, repoArgs);
  const pathStop = protectedPathStop(paths);
  if (pathStop !== null) {
    const detail = [
      ...pathStop.protectedHits.map((path) => `- ${path} (protected path)`),
      ...pathStop.credentials.map((path) => `- ${path} (credential file)`),
    ];
    log(`protected-path hard stop on PR #${prNumber}:`);
    for (const line of detail) log(`  ${line}`);

    if (dryRun) {
      log('dry run: the loop would stop here for a human (hard stop: protected-path).');
      process.exit(0);
    }

    const comment = [
      `<!-- ${config.review.markerName} round=${plan.round} head=${pr.headRefOid} verdict=blocked -->`,
      '',
      '## AI review - hard stop: protected path',
      '',
      `- **Head SHA:** ${pr.headRefOid}`,
      '',
      'This pull request changes files the loop must never merge on its own judgement:',
      '',
      ...detail,
      '',
      'The loop has stopped and will not review, fix or merge it. A human must review the change',
      'and merge it manually if it is correct. No further task will start until this is resolved.',
      '',
      '---',
      '',
      'This review was produced by an AI agent (an external reviewer model, orchestrated by GitHub Actions) on behalf of the user.',
    ].join('\n');
    const commentFile = resolve(root, '.ai/state/.review-comment.md');
    writeFileSync(commentFile, `${comment}\n`);
    tryGh(['pr', 'comment', String(prNumber), ...repoArgs, '--body-file', commentFile]);

    const stop = spawnSync(
      'node',
      [
        resolve(root, '.ai/scripts/loop-state.mjs'),
        'stop',
        '--event',
        'protected-path',
        '--status',
        'human-review-required',
        '--note',
        `PR #${prNumber} changes ${[...pathStop.protectedHits, ...pathStop.credentials].join(', ')}`,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    if (stop.status !== 0) log(`note: could not record the stop: ${stop.stderr.trim()}`);

    applyLabels({
      pr,
      add: [config.automation.blockedLabel],
      remove: [config.automation.readyLabel],
    });
    log('stopped for a human; the loop will not continue on this pull request.');
    process.exit(0);
  }

  const checks = ghJson([
    'pr',
    'checks',
    String(prNumber),
    ...repoArgs,
    '--json',
    'name,state,bucket,link',
  ]);
  const ci = classifyCi(checks, config.requiredChecks);
  log(`CI on ${pr.headRefOid.slice(0, 7)}: ${ci.status}`);

  const diffOutput = runGh(['pr', 'diff', String(prNumber), ...repoArgs]);
  const diffTruncated = diffOutput.length > MAX_DIFF_CHARS;
  const diff = diffTruncated ? diffOutput.slice(0, MAX_DIFF_CHARS) : diffOutput;

  const taskId = resolveTaskId(pr);
  const task = taskBrief(taskId);
  const reviewedAt = nowIso();

  // GitHub supplies an empty string for an unset Actions variable, so a blank
  // --model/OPENROUTER_REVIEW_MODEL must fall through to the configured default.
  const model = resolveReviewModel({
    review: config.review,
    override: typeof args.model === 'string' ? args.model : undefined,
  });

  const schema = JSON.parse(
    readFileSync(resolve(root, '.ai/schemas/review-report.schema.json'), 'utf8'),
  );

  const body = buildReviewRequestBody({
    model,
    instructions: buildInstructions(),
    input: buildReviewInput({
      pr,
      task,
      ci,
      diff,
      diffTruncated,
      round: plan.round,
      maxReviewRounds: config.maxReviewRounds,
    }),
    schema,
  });

  let modelPayload;
  if (typeof args['response-file'] === 'string') {
    if (!existsSync(args['response-file']))
      fail(`--response-file not found: ${args['response-file']}`, 2);
    const raw = readFileSync(args['response-file'], 'utf8');
    const parsed = JSON.parse(raw);
    // Accept a bare review report, a model response object, or a full API
    // envelope — whichever the caller has to hand.
    modelPayload =
      typeof parsed?.verdict === 'string' ? { output_text: JSON.stringify(parsed) } : parsed;
    log(`using the canned reviewer response from ${args['response-file']}`);
  } else {
    const { apiKey, envVar } = resolveApiKey(config.review);
    if (apiKey.length === 0) {
      fail(
        `${envVar} is not configured; refusing to run the review stage.\n` +
          `The reviewer provider is "${config.review.provider}" and reads its credential from ` +
          `${envVar}. Configure the secret (Settings -> Secrets and variables -> Actions) and re-run.`,
      );
    }
    if (dryRun) {
      log('dry run: the review request would be sent with:');
      log(
        JSON.stringify(
          {
            endpoint: reviewEndpoint(config.review),
            ...body,
            input: `<${body.input.length} chars>`,
            instructions: `<${body.instructions.length} chars>`,
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }
    log(
      `requesting a review from ${config.review.provider} (${model}) at ` +
        `${reviewEndpoint(config.review)} (round ${plan.round})`,
    );
    modelPayload = await callReviewer({
      apiKey,
      body,
      endpoint: reviewEndpoint(config.review),
      provider: config.review.provider,
    });
  }

  const modelText = extractOutputText(modelPayload);
  const rawReport = parseModelJson(modelText);

  const report = normalizeModelReport(rawReport, {
    taskId,
    pr: prNumber,
    round: plan.round,
    headSha: pr.headRefOid,
    ciStatus: ci.status,
    reviewedAt,
  });

  // The loop's own rules outrank the model: a red build is never approved and
  // the round limit is never exceeded.
  const coerced = coerceVerdict({
    requested: report.verdict,
    ci,
    round: plan.round,
    maxReviewRounds: config.maxReviewRounds,
  });
  if (coerced.forced) {
    log(`overriding the model verdict ${report.verdict} -> ${coerced.verdict} (${coerced.reason})`);
  }
  report.verdict = coerced.verdict;

  // CI failures are findings in their own right, so a fix round cannot miss them.
  const ciIssues = ciFindings(ci);
  if (ciIssues.length > 0) report.findings = [...ciIssues, ...report.findings];

  const errors = validateReport(report, {
    headSha: pr.headRefOid,
    pr: prNumber,
    round: plan.round,
  });
  if (errors.length > 0) {
    fail(`the reviewer returned an unusable report:\n  - ${errors.join('\n  - ')}`);
  }

  const decision = decisionFor({
    verdict: report.verdict,
    ciStatus: ci.status,
    round: plan.round,
    maxReviewRounds: config.maxReviewRounds,
  });

  const comment = buildComment(report, decision);

  if (dryRun) {
    log('--- review report ---');
    log(JSON.stringify(report, null, 2));
    log('--- planned actions ---');
    log(`verdict: ${report.verdict}`);
    log(`decision: ${decision.action} (${decision.message})`);
    log(`state: ${decision.status}`);
    log(`labels +${JSON.stringify(decision.addLabels)} -${JSON.stringify(decision.removeLabels)}`);
    log(`comment marker: ${comment.split('\n')[0]}`);
    if (decision.action === 'fix') {
      log(`fix dispatch: --stage fix --pr ${prNumber} --branch ${pr.headRefName}`);
    } else {
      log('fix dispatch: none');
    }
    process.exit(0);
  }

  appendReviewLog(report);

  const commentFile = resolve(root, '.ai/state/.review-comment.md');
  writeFileSync(commentFile, comment);
  const posted = tryGh([
    'pr',
    'comment',
    String(prNumber),
    ...repoArgs,
    '--body-file',
    commentFile,
  ]);
  if (!posted.ok) fail(`failed to post the review comment: ${posted.stderr.trim()}`);
  log(`posted the round ${report.round} review to PR #${prNumber}`);

  setLoopState({
    status: decision.status,
    round: plan.round,
    pr,
    taskId: report.taskId,
    verdict: report.verdict,
    ciStatus: ci.status,
  });
  applyLabels({ pr, add: decision.addLabels, remove: decision.removeLabels });

  if (decision.action === 'fix') {
    const contextFile = resolve(root, '.ai/state/.review-fix-context.md');
    writeFileSync(
      contextFile,
      buildFixContext({
        report,
        pr: prNumber,
        branch: pr.headRefName,
        headSha: pr.headRefOid,
        maxReviewRounds: config.maxReviewRounds,
      }),
    );
    dispatchFix({ report, pr, contextFile });
  } else if (decision.action === 'blocked') {
    const blockedFile = resolve(root, '.ai/state/.review-blocked.md');
    writeFileSync(
      blockedFile,
      [
        `## ${decision.message}`,
        '',
        `- Round: ${plan.round} of ${config.maxReviewRounds}`,
        `- Head SHA: \`${pr.headRefOid}\``,
        `- Last verdict: \`${report.verdict}\``,
        '',
        'The loop will not dispatch another fix. A human must review the findings, decide whether to',
        'continue manually, or close the pull request.',
      ].join('\n'),
    );
    tryGh(['pr', 'comment', String(prNumber), ...repoArgs, '--body-file', blockedFile]);
    log(decision.message);
  } else {
    log(decision.message);
  }
}

await main();
