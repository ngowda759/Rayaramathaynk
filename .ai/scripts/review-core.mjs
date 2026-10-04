/**
 * Pure logic for the review stage of the AI development loop.
 *
 * Everything here is deterministic and side-effect free so the loop's decision
 * rules can be tested directly. The CLI that talks to GitHub and the reviewer
 * provider lives in `chatgpt-review.mjs` and does nothing but wire these
 * functions to the network.
 *
 * The review stage is an external, non-OpenHands reviewer (the loop's default is
 * OpenRouter's free model router). OpenHands never reviews its own work; it only
 * fixes what this stage reports. The provider, endpoint, model and credential
 * environment variable are read from `config.review`, so the stage stays
 * provider-neutral.
 */

/** Name used in the machine-readable PR marker. */
export const REVIEW_MARKER_NAME = 'ai-loop-review';

/**
 * The dedupe marker. It is an HTML comment so it stays invisible in the rendered
 * PR while remaining greppable, and it records the exact head SHA that was
 * reviewed so the same commit can never be reviewed twice.
 */
const MARKER_PATTERN =
  /<!--\s*ai-loop-review\s+round=(\d+)\s+head=([0-9a-f]{7,40})(?:\s+verdict=([a-z-]+))?\s*-->/g;

/** GitHub check buckets that mean the check did not pass. */
const FAIL_BUCKETS = new Set(['fail', 'cancel']);
const PASS_BUCKETS = new Set(['pass', 'skipping']);
/** `gh` check states that mean the check has finished. */
const DONE_STATES = new Set([
  'SUCCESS',
  'FAILURE',
  'ERROR',
  'CANCELLED',
  'SKIPPED',
  'NEUTRAL',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
]);

/** The verdicts the reviewer may return. */
export const VERDICTS = ['approved', 'changes-requested', 'blocked'];

/** Severities a finding may carry, most severe first. */
export const SEVERITIES = ['blocker', 'major', 'minor', 'nit'];

/**
 * Findings a fix round must address. Minor/nit findings are advisory.
 */
export const BLOCKING_SEVERITIES = new Set(['blocker', 'major']);

export function reviewMarker(round, headSha, verdict) {
  const suffix = typeof verdict === 'string' && verdict.length > 0 ? ` verdict=${verdict}` : '';
  return `<!-- ${REVIEW_MARKER_NAME} round=${round} head=${headSha}${suffix} -->`;
}

/**
 * Extract every loop marker from a block of text.
 *
 * @returns {{ round: number, headSha: string, verdict: string | null }[]}
 */
export function parseReviewMarkers(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const found = [];
  // A fresh regex per call: a module-level /g regex carries lastIndex state.
  const pattern = new RegExp(MARKER_PATTERN.source, 'g');
  let match = pattern.exec(text);
  while (match !== null) {
    found.push({
      round: Number.parseInt(match[1], 10),
      headSha: match[2],
      verdict: match[3] ?? null,
    });
    match = pattern.exec(text);
  }
  return found;
}

/**
 * Map every reviewed head SHA to the highest round that reviewed it.
 *
 * Comments are the durable record: they survive across workflow runs, which is
 * what makes "the same head SHA is never reviewed twice" hold even when the
 * repository state file is stale.
 *
 * @param {{ body?: string }[]} comments
 * @returns {Map<string, { round: number, verdict: string | null }>}
 */
export function reviewedHeads(comments) {
  const heads = new Map();
  for (const comment of comments ?? []) {
    for (const marker of parseReviewMarkers(comment?.body ?? '')) {
      const previous = heads.get(marker.headSha);
      if (previous === undefined || marker.round > previous.round) {
        heads.set(marker.headSha, { round: marker.round, verdict: marker.verdict });
      }
    }
  }
  return heads;
}

/**
 * Decide whether this head SHA needs a review, and at which round.
 *
 * @param {object} input
 * @param {{ body?: string }[]} input.comments  Existing PR comments.
 * @param {string} input.headSha                The current PR head.
 * @param {number} input.maxReviewRounds        From `.ai/loop.config.json`.
 * @returns {{ action: 'review' | 'skip', round: number, reason: string }}
 */
export function planReview({ comments, headSha, maxReviewRounds }) {
  const heads = reviewedHeads(comments);
  const already = heads.get(headSha);
  if (already !== undefined) {
    return {
      action: 'skip',
      round: already.round,
      reason: `head ${headSha.slice(0, 7)} was already reviewed in round ${already.round}`,
    };
  }

  const completed = [...heads.values()].reduce(
    (highest, entry) => Math.max(highest, entry.round),
    0,
  );
  const round = completed + 1;

  if (round > maxReviewRounds) {
    return {
      action: 'skip',
      round,
      reason: `round ${round} exceeds maxReviewRounds ${maxReviewRounds}; a human must intervene`,
    };
  }

  return { action: 'review', round, reason: `reviewing round ${round}` };
}

/**
 * Classify the pull request's checks against the configured required checks.
 *
 * Only the required checks can fail the gate; the loop's own reporting jobs are
 * ignored so they cannot influence the verdict.
 *
 * @param {{ name?: string, state?: string, bucket?: string, link?: string }[]} checks
 * @param {string[]} requiredChecks
 */
export function classifyCi(checks, requiredChecks) {
  const byName = new Map();
  for (const check of checks ?? []) {
    if (typeof check?.name === 'string') byName.set(check.name, check);
  }

  const required = requiredChecks.map((name) => {
    const check = byName.get(name);
    if (check === undefined) {
      return { name, state: 'MISSING', bucket: 'missing', link: null };
    }
    return {
      name,
      state: check.state ?? 'UNKNOWN',
      bucket: check.bucket ?? 'unknown',
      link: check.link ?? null,
    };
  });

  const failing = required.filter(
    (check) =>
      FAIL_BUCKETS.has(check.bucket) || check.state === 'FAILURE' || check.state === 'ERROR',
  );
  const missing = required.filter((check) => check.state === 'MISSING');
  const pending = required.filter(
    (check) =>
      !failing.includes(check) &&
      !missing.includes(check) &&
      !DONE_STATES.has(check.state) &&
      !PASS_BUCKETS.has(check.bucket),
  );

  let status = 'success';
  if (failing.length > 0) status = 'failure';
  else if (pending.length > 0) status = 'pending';
  else if (missing.length > 0) status = 'unknown';

  return { status, required, failing, missing, pending };
}

/**
 * Turn a failing or missing required check into a review finding.
 *
 * The reviewer must never approve past a red build, and it must name the CI
 * failure as a finding so the fix round knows where to look.
 */
export function ciFindings(ci) {
  const findings = [];
  for (const check of ci.failing) {
    findings.push({
      id: `CI-${findings.length + 1}`,
      severity: 'blocker',
      file: '.github/workflows/ci.yml',
      summary: `Required CI check "${check.name}" did not pass (state ${check.state}).`,
      suggestion:
        `Open the failed run${check.link === null ? '' : ` (${check.link})`}, read the failing step's log, ` +
        'and fix the cause on this same branch. If the failure is a transient infrastructure or ' +
        'flake failure rather than a defect, re-run the failed job and record that you did so ' +
        'instead of changing product code.',
    });
  }
  for (const check of ci.missing) {
    findings.push({
      id: `CI-${findings.length + 1}`,
      severity: 'blocker',
      file: '.github/workflows/ci.yml',
      summary: `Required CI check "${check.name}" has not reported on this head commit.`,
      suggestion:
        'Confirm the workflow is triggered for this branch and that the job name still matches ' +
        '`requiredChecks` in `.ai/loop.config.json`, then re-run CI.',
    });
  }
  return findings;
}

/**
 * Apply the loop's own rules on top of the model's requested verdict.
 *
 * The model is an advisor, not the authority: a red build can never be approved,
 * and the round limit can never be exceeded.
 *
 * @returns {{ verdict: string, forced: boolean, reason: string | null }}
 */
export function coerceVerdict({ requested, ci, round, maxReviewRounds }) {
  if (ci.status === 'failure') {
    return {
      verdict: 'changes-requested',
      forced: requested !== 'changes-requested',
      reason: 'a required CI check failed',
    };
  }
  if (ci.status === 'unknown' && requested === 'approved') {
    return {
      verdict: 'changes-requested',
      forced: true,
      reason: 'a required CI check never reported',
    };
  }
  if (requested === 'changes-requested' && round >= maxReviewRounds) {
    return {
      verdict: 'blocked',
      forced: true,
      reason: `round ${round} reached maxReviewRounds ${maxReviewRounds} with findings still open`,
    };
  }
  return { verdict: requested, forced: false, reason: null };
}

/**
 * Compose the full review report from the model's findings and the facts the
 * loop knows for itself.
 *
 * The model never supplies the head SHA, PR number or round: those are recorded
 * from GitHub so a review can never claim to have reviewed a different commit
 * than the one it was given.
 */
export function normalizeModelReport(raw, facts) {
  const findings = (Array.isArray(raw?.findings) ? raw.findings : []).map((finding, index) => {
    const normalized = {
      id:
        typeof finding?.id === 'string' && finding.id.length > 0 ? finding.id : `REV-${index + 1}`,
      severity: SEVERITIES.includes(finding?.severity) ? finding.severity : 'major',
      file: typeof finding?.file === 'string' && finding.file.length > 0 ? finding.file : 'unknown',
      summary: typeof finding?.summary === 'string' ? finding.summary : '',
      suggestion: typeof finding?.suggestion === 'string' ? finding.suggestion : '',
    };
    if (Number.isInteger(finding?.line) && finding.line >= 1) normalized.line = finding.line;
    return normalized;
  });

  const report = {
    taskId: facts.taskId,
    pr: facts.pr,
    round: facts.round,
    headSha: facts.headSha,
    verdict: raw?.verdict,
    ciStatus: facts.ciStatus,
    findings,
    reviewedAt: facts.reviewedAt,
  };
  if (typeof raw?.summary === 'string' && raw.summary.length > 0) report.summary = raw.summary;
  if (Array.isArray(raw?.acceptanceCriteria)) {
    report.acceptanceCriteria = raw.acceptanceCriteria
      .filter((entry) => typeof entry?.criterion === 'string' && entry.criterion.length > 0)
      .map((entry) => ({
        criterion: entry.criterion,
        status: ['met', 'unmet', 'unverifiable'].includes(entry.status)
          ? entry.status
          : 'unverifiable',
        evidence: typeof entry.evidence === 'string' ? entry.evidence : '',
      }));
  }
  return report;
}

/**
 * Structural checks that JSON Schema cannot express.
 *
 * @returns {string[]} errors; empty means the report may be published.
 */
export function validateReport(report, facts) {
  const errors = [];
  if (!VERDICTS.includes(report?.verdict)) {
    errors.push(`verdict ${JSON.stringify(report?.verdict)} is not one of ${VERDICTS.join(', ')}`);
  }
  if (report?.verdict === 'changes-requested' && (report.findings ?? []).length === 0) {
    errors.push('a changes-requested review must carry at least one finding');
  }
  if (facts !== undefined) {
    if (report?.headSha !== facts.headSha) {
      errors.push(`report headSha ${String(report?.headSha)} does not match the reviewed head`);
    }
    if (report?.pr !== facts.pr) errors.push('report pr does not match the pull request');
    if (report?.round !== facts.round) errors.push('report round does not match the review round');
  }
  for (const [index, finding] of (report?.findings ?? []).entries()) {
    if (!SEVERITIES.includes(finding.severity)) {
      errors.push(`findings[${index}].severity is not one of ${SEVERITIES.join(', ')}`);
    }
    if (typeof finding.summary !== 'string' || finding.summary.length === 0) {
      errors.push(`findings[${index}].summary is empty`);
    }
  }
  return errors;
}

/**
 * The schema the reviewer must satisfy, minus the keys that only describe the
 * document rather than the payload. Strict structured-output modes reject
 * `$schema`/`$id` as schema properties.
 */
export function stripSchemaMeta(schema) {
  const { $schema: _schema, $id: _id, ...rest } = schema;
  return rest;
}

/**
 * The credential environment variable a provider-neutral review reads.
 *
 * `apiKeyEnvVar` is the explicit, provider-neutral field. When it is absent the
 * variable is derived from `provider` (`<PROVIDER>_API_KEY`), so the default
 * loop configuration resolves `OPENROUTER_API_KEY` without any provider being
 * hard-coded in this script.
 */
export function reviewApiKeyEnvVar(review) {
  const explicit = typeof review?.apiKeyEnvVar === 'string' ? review.apiKeyEnvVar.trim() : '';
  if (explicit.length > 0) return explicit;
  const provider =
    typeof review?.provider === 'string' && review.provider.trim().length > 0
      ? review.provider.trim()
      : 'openrouter';
  return `${provider.toUpperCase()}_API_KEY`;
}

/**
 * The model-override environment variable for the configured reviewer.
 *
 * Defaults to `<provider>_REVIEW_MODEL` (e.g. `OPENROUTER_REVIEW_MODEL`) so a
 * provider swap changes the variable without a second hard-coded copy.
 */
export function reviewModelEnvVar(review) {
  if (typeof review?.modelEnvVar === 'string' && review.modelEnvVar.trim().length > 0) {
    return review.modelEnvVar.trim();
  }
  const provider =
    typeof review?.provider === 'string' && review.provider.trim().length > 0
      ? review.provider.trim()
      : 'openrouter';
  return `${provider.toUpperCase()}_REVIEW_MODEL`;
}

/**
 * Resolve the reviewer's credential from the environment.
 *
 * GitHub Actions supplies an empty string for an unset variable, so a blank or
 * whitespace-only value counts as absent. The key is returned, never logged.
 *
 * @returns {{ apiKey: string, envVar: string }}
 */
export function resolveApiKey(review, env = process.env) {
  const envVar = reviewApiKeyEnvVar(review);
  const raw = env?.[envVar];
  const apiKey = typeof raw === 'string' ? raw.trim() : '';
  return { apiKey, envVar };
}

/**
 * The configured Responses endpoint, normalised to a full URL.
 *
 * `endpoint` may be the base URL (`https://openrouter.ai/api/v1`) or the full
 * endpoint (`https://openrouter.ai/api/v1/responses`); both resolve to the same
 * request URL.
 */
export function reviewEndpoint(review) {
  const raw = typeof review?.endpoint === 'string' ? review.endpoint.trim() : '';
  if (raw.length === 0) return '';
  const withoutSlash = raw.replace(/\/+$/, '');
  return withoutSlash.endsWith('/responses') ? withoutSlash : `${withoutSlash}/responses`;
}

/**
 * Resolve the review model: an explicit override, then the model override
 * environment variable, then the configured default.
 *
 * GitHub supplies an empty string for an unset Actions variable, so a blank or
 * whitespace-only override must fall through to the configured model.
 */
export function resolveReviewModel({ review, override, env = process.env } = {}) {
  if (typeof override === 'string' && override.trim().length > 0) return override.trim();
  const envVar = reviewModelEnvVar(review);
  const raw = env?.[envVar];
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return review?.model;
}

/**
 * Build the Responses API request for a strict structured review.
 *
 * `text.format` with `strict: true` is the Responses API's structured-output
 * contract and is supported by OpenRouter's OpenAI-compatible Responses API as
 * well as OpenAI's. The model's decoding is constrained to the schema, so the
 * response is parseable JSON rather than prose that happens to contain JSON.
 */
export function buildReviewRequestBody({
  model,
  instructions,
  input,
  schema,
  name = 'ai_loop_review',
}) {
  return {
    model,
    instructions,
    input,
    text: {
      format: {
        type: 'json_schema',
        name,
        strict: true,
        schema: stripSchemaMeta(schema),
      },
    },
  };
}

/**
 * Pull the assistant's text out of a Responses API payload.
 *
 * Handles the Responses shape (`output[].content[].text`) that both OpenAI and
 * OpenRouter return, a convenience `output_text` field some gateways add, and
 * the Chat Completions fallback. Throws when the payload carries no text at all.
 */
export function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const messageParts = [];
  const reasoningParts = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type === 'refusal' && typeof item.refusal === 'string') {
      throw new Error(`the reviewer refused to answer: ${item.refusal}`);
    }
    const isReasoning = item?.type === 'reasoning';
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'refusal' && typeof content.refusal === 'string') {
        throw new Error(`the reviewer refused to answer: ${content.refusal}`);
      }
      if (typeof content?.text !== 'string' || content.text.length === 0) continue;
      // A reasoning item is the model thinking out loud, not the answer. It is
      // kept only as a last resort so the final message always wins.
      (isReasoning ? reasoningParts : messageParts).push(content.text);
    }
  }
  if (messageParts.length > 0) return messageParts.join('\n');
  if (reasoningParts.length > 0) return reasoningParts.join('\n');

  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : undefined;
  if (typeof choice?.message?.content === 'string' && choice.message.content.length > 0) {
    return choice.message.content;
  }

  throw new Error('the reviewer returned no text content');
}

/**
 * Pull the first balanced JSON object out of a string.
 *
 * Some free/OpenAI-compatible gateways ignore the structured-output contract and
 * wrap the JSON in prose or a fenced code block. Scanning for the first balanced
 * object lets the reviewer be parsed without weakening the schema: the extracted
 * value is still validated against the full review-report schema, and anything
 * that is not a JSON object is still a hard failure.
 *
 * Returns the object text, or `null` when no balanced object is present.
 */
function extractJsonObject(text) {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
  }
  return null;
}

/**
 * Parse the reviewer's JSON, rejecting anything that is not a JSON object.
 *
 * A malformed response is a hard failure: publishing a half-parsed review would
 * hand OpenHands instructions nobody wrote.
 */
export function parseModelJson(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('the reviewer returned an empty body');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const objectText = extractJsonObject(text);
    if (objectText === null) {
      throw new Error(`the reviewer returned invalid JSON: ${error.message}`, { cause: error });
    }
    try {
      parsed = JSON.parse(objectText);
    } catch (nested) {
      throw new Error(`the reviewer returned invalid JSON: ${nested.message}`, { cause: nested });
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the reviewer returned JSON that is not an object');
  }
  return parsed;
}

/**
 * The loop's action for a published review.
 *
 * `fix` dispatches OpenHands on the same PR; `ready` marks the PR merge-ready;
 * `blocked` stops the loop for a human.
 */
export function decisionFor({ verdict, ciStatus, round, maxReviewRounds }) {
  if (verdict === 'blocked') {
    return {
      action: 'blocked',
      status: 'blocked',
      addLabels: ['ai-blocked'],
      removeLabels: ['ai-ready'],
      message:
        'The reviewer blocked this pull request (hard stop: reviewer-blocked). A human decision is required.',
    };
  }

  if (verdict === 'changes-requested') {
    if (round >= maxReviewRounds) {
      return {
        action: 'blocked',
        status: 'blocked',
        addLabels: ['ai-blocked'],
        removeLabels: ['ai-ready'],
        message:
          `Maximum automated review rounds reached (${round}/${maxReviewRounds}) ` +
          '(hard stop: max-rounds-exceeded). Human intervention required.',
      };
    }
    return {
      action: 'fix',
      status: 'fixing',
      addLabels: [],
      removeLabels: ['ai-ready', 'ai-blocked'],
      message: `Round ${round}/${maxReviewRounds} requested changes; dispatching a fix on the same PR.`,
    };
  }

  if (verdict === 'approved' && ciStatus === 'success') {
    return {
      action: 'ready',
      status: 'ready-to-merge',
      addLabels: ['ai-ready'],
      removeLabels: ['ai-blocked'],
      message:
        'Approved with green CI. The merge gate re-checks every condition and merges automatically.',
    };
  }

  return {
    action: 'none',
    status: 'reviewing',
    addLabels: [],
    removeLabels: [],
    message: `Approved but CI is ${ciStatus}; waiting for a green build before marking ready.`,
  };
}

/**
 * The blocking findings a fix round must still address.
 *
 * Advisory findings (minor/nit) do not by themselves justify stopping the loop
 * at the round limit, so the caller can tell the two apart.
 */
export function unresolvedBlockingFindings(report) {
  return (report?.findings ?? []).filter((finding) => BLOCKING_SEVERITIES.has(finding.severity));
}

/** Render a review report as the PR comment body, marker first. */
export function buildComment(report, decision) {
  const lines = [
    reviewMarker(report.round, report.headSha, report.verdict),
    '',
    `## AI review — round ${report.round} — \`${report.verdict}\``,
    '',
    `- **Task:** ${report.taskId}`,
    `- **Head SHA:** \`${report.headSha}\``,
    `- **CI:** ${report.ciStatus}`,
    `- **Reviewed at:** ${report.reviewedAt}`,
  ];

  if (typeof report.summary === 'string' && report.summary.length > 0) {
    lines.push('', report.summary);
  }

  if (Array.isArray(report.acceptanceCriteria) && report.acceptanceCriteria.length > 0) {
    lines.push(
      '',
      '### Acceptance criteria',
      '',
      '| Criterion | Status | Evidence |',
      '| --- | --- | --- |',
    );
    for (const entry of report.acceptanceCriteria) {
      lines.push(`| ${entry.criterion} | ${entry.status} | ${entry.evidence} |`);
    }
  }

  lines.push('', '### Findings', '');
  if (report.findings.length === 0) {
    lines.push('No findings.');
  } else {
    for (const finding of report.findings) {
      const location =
        finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
      lines.push(
        `- **${finding.id}** (\`${finding.severity}\`) — \`${location}\``,
        `  - ${finding.summary}`,
        finding.suggestion.length > 0
          ? `  - **Required change:** ${finding.suggestion}`
          : '  - **Required change:** (none given)',
      );
    }
  }

  lines.push(
    '',
    '### Loop action',
    '',
    decision.message,
    '',
    '---',
    '',
    'This review was produced by an AI agent (an external reviewer model, orchestrated by GitHub Actions) on behalf of the user.',
  );

  return `${lines.join('\n')}\n`;
}

/**
 * Build the context handed to OpenHands for a fix round.
 *
 * It restates the non-negotiables so the fix conversation cannot mistake this
 * for a licence to open a new branch or merge.
 */
export function buildFixContext({ report, pr, branch, headSha, maxReviewRounds }) {
  const blocking = report.findings.filter((finding) => BLOCKING_SEVERITIES.has(finding.severity));
  const advisory = report.findings.filter((finding) => !BLOCKING_SEVERITIES.has(finding.severity));

  const lines = [
    '## Fix request — review round ' + report.round,
    '',
    '### Facts',
    '',
    `- Pull request: #${pr} (do not open another one)`,
    `- Branch: \`${branch}\` (do not create another one)`,
    `- Reviewed head SHA: \`${headSha}\``,
    `- Review round: ${report.round} of ${maxReviewRounds}`,
    `- Review verdict: \`${report.verdict}\``,
    `- CI status at review time: ${report.ciStatus}`,
    '',
    '### Blocking findings to fix',
    '',
  ];

  if (blocking.length === 0) {
    lines.push('None. If the only findings are advisory, say so and make no change.');
  } else {
    for (const finding of blocking) {
      const location =
        finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
      lines.push(
        `- **${finding.id}** (\`${finding.severity}\`) — \`${location}\``,
        `  - Problem: ${finding.summary}`,
        `  - Required change: ${finding.suggestion.length > 0 ? finding.suggestion : '(none given)'}`,
      );
    }
  }

  lines.push('', '### Advisory findings (minor/nit — use judgement)', '');
  if (advisory.length === 0) {
    lines.push('None.');
  } else {
    for (const finding of advisory) {
      const location =
        finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
      lines.push(
        `- **${finding.id}** (\`${finding.severity}\`) — \`${location}\`: ${finding.summary}`,
      );
    }
  }

  lines.push(
    '',
    '### Required behaviour for this round',
    '',
    '- Fix the findings on the **SAME** pull request and the **SAME** branch.',
    '- Do **NOT** create another PR. Do **NOT** create another branch.',
    '- Do **NOT** merge, close, reopen or convert any PR.',
    "- Do **NOT** force-push over another author's commits.",
    '- For **every** finding, do exactly one of: `FIXED` or `DECLINED — <explanation>`.',
    '  Never silently ignore a finding.',
    '- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before pushing.',
    '- Run `npm run test:e2e` when the change can affect browser behaviour.',
    '- Commit and push to the existing branch. The push triggers CI and the next review round.',
    '',
    '### Verification requirement',
    '',
    'Your report must state, for each finding, which command you ran and its result. If a finding was',
    'declined, give the reason and the evidence. If a command was not run, say so explicitly rather',
    'than implying it passed.',
  );

  return `${lines.join('\n')}\n`;
}
