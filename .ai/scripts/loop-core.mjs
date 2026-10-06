/**
 * Pure logic for the autonomous AI development loop.
 *
 * Everything here is deterministic and side-effect free, so the loop's
 * scheduling rules — task sequencing, single-active-task enforcement, the merge
 * gate and hard-stop classification — can be tested directly without a network,
 * a GitHub token or a live pull request.
 *
 * The CLIs (`loop-state.mjs`, `loop-tasks.mjs`, `merge-gate.mjs`) do nothing but
 * wire these functions to `gh`, the state files and the workflows.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseReviewMarkers } from "./review-core.mjs";

export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export function loadConfig(root = REPO_ROOT) {
  return JSON.parse(
    readFileSync(resolve(root, ".ai/loop.config.json"), "utf8"),
  );
}

// --- AI-managed pull request identity --------------------------------------

/**
 * Is this pull request one the AI loop owns?
 *
 * Branch naming is only *one* of the signals, and deliberately not the
 * authoritative one: an AI-managed implementation task may legitimately live on
 * `automation/*`, `feat/*`, `fix/*` or any other valid task branch, so a loop
 * that equated "AI task" with `automation/*` silently skipped its own next-task
 * transition. Identity is therefore derived from the loop's own records, all of
 * which an unrelated pull request cannot forge:
 *
 *   1. the branch uses the loop prefix (`automation/`) — the loop's own branch;
 *   2. the loop recorded this number as its active pull request;
 *   3. any task in the queue records this pull request number or branch as its
 *      implementation — the queue keeps that record even after the state moves on;
 *   4. the pull request carries the loop's trigger label (`ai-task`);
 *   5. a trusted review marker on the pull request covers its head or
 *      merge commit — only the loop's review stage writes one;
 *   6. the title or branch names a task id that exists in the loop's queue.
 *
 * A cross-repository (fork) pull request, or one targeting a different base
 * branch, is never AI-managed regardless of the other signals.
 *
 * @param {{ pr: object | null, state?: object | null, queue?: object | null, config: object, mergeCommitSha?: string }} input
 * @returns {boolean}
 */
export function isAiManagedPullRequest({
  pr,
  state = null,
  queue = null,
  config,
  mergeCommitSha,
}) {
  if (pr === null || typeof pr !== "object") return false;
  if (pr.isCrossRepository === true) return false;
  if (
    typeof pr.baseRefName === "string" &&
    pr.baseRefName !== config.baseBranch
  )
    return false;

  const branch = typeof pr.headRefName === "string" ? pr.headRefName : "";
  if (branch.startsWith(config.branchPrefix)) return true;

  const recorded = state?.currentPr ?? null;
  if (
    recorded !== null &&
    typeof recorded.number === "number" &&
    recorded.number === pr.number
  ) {
    return true;
  }

  // The queue records the pull request a task was implemented in. Any task's
  // recorded PR number (or branch) identifies the loop's own work — this holds
  // even when the loop state has already moved on to a later task.
  const tasks = queue?.tasks ?? [];
  if (
    typeof pr.number === "number" &&
    tasks.some((task) => task?.pr === pr.number)
  ) {
    return true;
  }
  if (branch.length > 0 && tasks.some((task) => task?.branch === branch)) {
    return true;
  }

  const labels = (pr.labels ?? []).map((label) =>
    typeof label === "string" ? label : label?.name,
  );
  if (labels.includes(config.automation.triggerLabel)) return true;

  const heads = [pr.headRefOid, mergeCommitSha].filter(
    (head) => typeof head === "string" && head.length > 0,
  );
  for (const comment of pr.comments ?? []) {
    for (const marker of parseReviewMarkers(comment?.body ?? "")) {
      if (
        heads.some(
          (head) =>
            head.startsWith(marker.headSha) || marker.headSha.startsWith(head),
        )
      ) {
        return true;
      }
    }
  }

  const match = /AI-\d+(?:-T\d+)?/.exec(`${pr.title ?? ""} ${branch}`);
  if (
    match !== null &&
    (queue?.tasks ?? []).some((task) => task.id === match[0])
  )
    return true;

  return false;
}

// --- classifying a merged loop pull request --------------------------------

/**
 * Classify a merged, AI-managed loop pull request against the loop's own records.
 *
 * A merged loop pull request either completes a queued task (the normal path) or
 * is loop *infrastructure* that is not a task at all: an `[AI-INFRA]` tooling PR
 * (a reviewer fix, a workflow hardening) that merges while an implementation
 * task is still open. The task queue is the durable record of tasks and an
 * `[AI-INFRA]` PR is never in it, so it must never be attributed to a task —
 * inventing a completion would corrupt the queue and lose legitimate history.
 * Every other merged loop pull request that cannot be attributed to a queued task
 * is genuine corruption and must stop for a human.
 *
 * Task attribution order (most authoritative first):
 *   1. the queue task that records this PR number or head branch — the loop's
 *      explicit record that this pull request is that task's implementation;
 *   2. loop infrastructure (`[AI-INFRA]`) — checked before the weaker signals so
 *      an infrastructure PR can never be misattributed to an active task just
 *      because the title mentions one;
 *   3. the task id named in the PR title or branch — only to an existing task;
 *   4. the loop's recorded active task, but only when the queue records no
 *      PR/branch for it (otherwise the exact match in (1) would have caught it,
 *      and a mismatch means this is not that task's pull request).
 *
 * @param {{ pr: object | null, state?: object | null, queue?: object | null }} input
 * @returns {{ kind: 'task' | 'infrastructure' | 'unattributable', task: object | null, taskId: string | null }}
 */
export function classifyMergedLoopPr({ pr, state = null, queue = null }) {
  const tasks = queue?.tasks ?? [];
  const number = pr?.number;
  const branch = typeof pr?.headRefName === "string" ? pr.headRefName : "";

  let task =
    tasks.find(
      (candidate) =>
        (number !== undefined && candidate.pr === number) ||
        (branch.length > 0 && candidate.branch === branch),
    ) ?? null;

  if (task === null && /\[AI-INFRA\]/i.test(pr?.title ?? "")) {
    return { kind: "infrastructure", task: null, taskId: null };
  }

  if (task === null && !branch.includes("next-task")) {
    const named = /AI-\d+(?:-T\d+)?/.exec(`${pr?.title ?? ""} ${branch}`);
    if (named !== null)
      task = tasks.find((candidate) => candidate.id === named[0]) ?? null;
  }

  if (
    task === null &&
    typeof state?.currentTaskId === "string" &&
    state.currentTaskId.length > 0
  ) {
    const recorded =
      tasks.find((candidate) => candidate.id === state.currentTaskId) ?? null;
    if (recorded !== null && recorded.pr == null && recorded.branch == null)
      task = recorded;
  }

  if (task !== null) return { kind: "task", task, taskId: task.id };
  return { kind: "unattributable", task: null, taskId: null };
}

/**
 * Find the already-merged AI pull request that completes a task still recorded
 * as open in the loop's own records.
 *
 * The `pull_request: closed` path is told which pull request closed, so it only
 * has to attribute that one. A manual `workflow_dispatch` recovery has no such
 * event: the merge happened earlier (its `closed` delivery may have been missed
 * or the state on the base branch was never advanced) and it must *discover*
 * which merge it missed. This function is that discovery, expressed in terms of
 * the same identity and classification rules the normal path uses — it never
 * invents a task, never matches an unrelated pull request and never re-completes
 * a task already recorded `done`.
 *
 * A task is a candidate when it is anything other than `done` (an `approved`
 * task whose PR merged, an `in-review` task whose PR merged while the state was
 * stale, the state's recorded active task) — those are exactly the records that
 * a merge should have advanced but did not. A merged pull request is a match
 * only when it is AI-managed and `classifyMergedLoopPr` attributes it to one of
 * those tasks; an `[AI-INFRA]` merge and an unrelated merge are therefore never
 * a match.
 *
 * @param {{ mergedPrs: object[], state?: object | null, queue?: object | null, config: object }} input
 * @returns {{ pr: object, task: object, taskId: string } | null}
 */
export function selectMergedTaskPr({
  mergedPrs,
  state = null,
  queue = null,
  config,
}) {
  const tasks = queue?.tasks ?? [];
  const targets = new Set(
    tasks.filter((task) => task?.status !== "done").map((task) => task.id),
  );
  if (
    typeof state?.currentTaskId === "string" &&
    state.currentTaskId.length > 0
  ) {
    targets.add(state.currentTaskId);
  }
  if (targets.size === 0) return null;

  for (const pr of mergedPrs ?? []) {
    if (pr === null || typeof pr !== "object") continue;
    if (typeof pr.mergedAt !== "string" || pr.mergedAt.length === 0) continue;
    if (
      !isAiManagedPullRequest({
        pr,
        state,
        queue,
        config,
        mergeCommitSha: pr.mergeCommit?.oid,
      })
    ) {
      continue;
    }
    const classified = classifyMergedLoopPr({ pr, state, queue });
    if (
      classified.kind === "task" &&
      classified.taskId !== null &&
      targets.has(classified.taskId) &&
      classified.task?.status !== "done"
    ) {
      return { pr, task: classified.task, taskId: classified.taskId };
    }
  }
  return null;
}

// --- task identity and sequencing -----------------------------------------

/**
 * Task ids are `AI-<n>` with an optional `-T<m>` sub-task suffix. The loop
 * progresses strictly one number at a time: AI-001, AI-002, AI-003, …
 *
 * @returns {number | null} the numeric part, or null when the id is malformed.
 */
export function taskNumber(taskId) {
  if (typeof taskId !== "string") return null;
  const match = /^AI-(\d+)(?:-T\d+)?$/.exec(taskId);
  if (match === null) return null;
  return Number.parseInt(match[1], 10);
}

/** Sort task ids by their numeric part, then by sub-task. */
export function sortTaskIds(ids) {
  return [...ids].sort((a, b) => {
    const na = taskNumber(a) ?? 0;
    const nb = taskNumber(b) ?? 0;
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

/**
 * The next task id after the highest id already present.
 *
 * @param {string[]} existingIds every id in the queue
 * @returns {string} e.g. `AI-003` when AI-002 is the highest
 */
export function resolveNextTaskId(existingIds) {
  const highest = (existingIds ?? []).reduce(
    (max, id) => Math.max(max, taskNumber(id) ?? 0),
    0,
  );
  return `AI-${String(highest + 1).padStart(3, "0")}`;
}

/**
 * Sequencing invariants for the queue.
 *
 * The loop must never skip an id and must never hold more than one task beyond
 * the active one — the queue is a queue, not a speculative backlog.
 *
 * @returns {string[]} errors; empty means the sequence is sound.
 */
export function validateTaskSequence(existingIds) {
  const errors = [];
  const ids = existingIds ?? [];
  const numbers = ids.map(taskNumber);
  if (numbers.some((value) => value === null)) {
    errors.push(`task ids must match AI-<n> or AI-<n>-T<m>: ${ids.join(", ")}`);
    return errors;
  }
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) errors.push("task ids are not unique");

  const sorted = [...unique].sort((a, b) => a - b);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index + 1) {
      errors.push(
        `task ids must be contiguous starting at AI-001; found ${sorted.map((n) => `AI-${String(n).padStart(3, "0")}`).join(", ")}`,
      );
      break;
    }
  }
  return errors;
}

/**
 * Enforce exactly one active task across the state file, the queue and GitHub.
 *
 * `state` is authoritative but not trusted on its own: an interrupted run can
 * leave the state idle while a pull request is still open, and starting a second
 * task in that window would put two implementations in flight at once.
 *
 * @returns {{ ok: boolean, errors: string[], activePr: number | null }}
 */
export function assertSingleActiveTask({ state, queue, openPrs, config }) {
  const errors = [];
  const max = config?.automation?.maxConcurrentTasks ?? 1;

  const inFlight = (queue?.tasks ?? []).filter((task) =>
    ["in-progress", "in-review", "blocked"].includes(task.status),
  );
  const live = inFlight.filter((task) => task.status !== "blocked");

  if (live.length > max) {
    errors.push(
      `${live.length} tasks are active (${live.map((task) => task.id).join(", ")}); maxConcurrentTasks is ${max}`,
    );
  }

  const automationPrs = (openPrs ?? []).filter(
    (pr) => pr.isAutomation === true,
  );
  if (automationPrs.length > max) {
    errors.push(
      `${automationPrs.length} automation pull requests are open (${automationPrs
        .map((pr) => `#${pr.number}`)
        .join(", ")}); maxConcurrentTasks is ${max}`,
    );
  }

  const stateStatus = state?.status ?? "idle";
  // Only the implementation statuses own an active pull request. `next-task`
  // (like `completed` and `idle`) sits *between* two tasks: the previous one
  // merged and the next brief has not been generated yet, so demanding an open
  // automation pull request there is exactly what silently stalled the loop.
  // The status is `completed`, not `complete` — the previous check misspelled
  // it, so a finished loop was itself treated as active.
  const stateActive = ACTIVE_STATUSES.includes(stateStatus);
  if (stateActive && automationPrs.length === 0 && state?.currentPr === null) {
    errors.push(
      `loop state is "${stateStatus}" but no automation pull request is open`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    activePr: state?.currentPr?.number ?? automationPrs[0]?.number ?? null,
  };
}

/**
 * Is the loop sitting in a legitimate `next-task` state with no active work?
 *
 * This is the recovery predicate. A merge advances the loop to `next-task` and
 * the workflow is supposed to dispatch the architect immediately, but if that
 * dispatch never ran (a lost event, a run before the workflow reached the
 * default branch, an interrupted job) the state is left waiting forever. The
 * loop must notice and restart itself, because a stalled loop looks exactly like
 * a finished one.
 *
 * The condition is deliberately narrow: the status must be `next-task`, no task
 * and no pull request may be recorded. Any recorded task or PR means real work
 * is in flight and the normal path owns it. A `next-task` state that still names
 * a task is a state/queue mismatch, not a recovery — that is a `state-corruption`
 * hard stop for a human, not something the loop should paper over.
 *
 * The queue is the durable record and is checked too: if it already holds a task
 * awaiting implementation (`proposed`/`queued`/`approved`) or one in flight
 * (`in-progress`/`in-review`/`ready-to-merge`), the architect's dispatch already
 * ran. Re-dispatching it there would generate a duplicate or premature next task
 * while the real one is still open, so that state is *not* a recovery — the loop
 * is legitimately waiting on the task in the queue.
 *
 * @param {object | null | undefined} state
 * @param {object | null} [queue] the task queue; when omitted, only the state is checked
 * @returns {boolean}
 */
const RECOVERABLE_PENDING_STATUSES = [
  "proposed",
  "queued",
  "approved",
  "in-progress",
  "in-review",
  "ready-to-merge",
];

export function isRecoverableNextTaskState(state, queue = null) {
  if (
    state?.status !== "next-task" ||
    state.currentTaskId !== null ||
    state.currentPr !== null
  ) {
    return false;
  }
  const hasPendingTask = (queue?.tasks ?? []).some((task) =>
    RECOVERABLE_PENDING_STATUSES.includes(task?.status),
  );
  return !hasPendingTask;
}

// --- protected paths -------------------------------------------------------

const DOUBLE_STAR = "__DOUBLE_STAR__";

/**
 * Translate a repository glob into a regular expression.
 *
 * `**` crosses path separators, `*` does not — the same semantics as the
 * `.gitignore`-style patterns the config uses.
 */
export function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, "[^/]*")
    .split(DOUBLE_STAR)
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Which changed paths hit a protected pattern.
 *
 * A protected path is never a CI failure — it is a hard stop that hands the
 * decision to a human, because the loop must not silently rewrite migrations,
 * CI definitions or credentials.
 *
 * @returns {string[]} the offending paths, sorted and de-duplicated
 */
export function protectedPathViolations(paths, protectedPaths) {
  const patterns = (protectedPaths ?? []).map(globToRegExp);
  const hits = (paths ?? []).filter((path) =>
    patterns.some((pattern) => pattern.test(path)),
  );
  return [...new Set(hits)].sort();
}

/**
 * Extra hard-stop patterns that are not plain protected paths.
 *
 * `.env` files and credential material are treated as hard stops in their own
 * right, so a task that needs to touch them always stops for a human even if the
 * config's `protectedPaths` is later relaxed.
 */
export const CREDENTIAL_PATTERNS = [
  ".env",
  ".env.*",
  "**/*.pem",
  "**/*.key",
  "**/credentials*",
];

export function credentialViolations(paths) {
  return protectedPathViolations(paths, CREDENTIAL_PATTERNS);
}

// --- the loop state machine ------------------------------------------------

/**
 * The autonomous lifecycle. Each key lists the statuses it may move to.
 *
 * `blocked` and `human-review-required` are reachable from anywhere: a stage
 * that cannot proceed must always be allowed to stop for a human.
 */
export const TRANSITIONS = {
  idle: ["architecting", "implementing"],
  architecting: ["implementing", "blocked"],
  implementing: ["ci-running", "blocked"],
  "ci-running": ["reviewing", "fixing", "blocked"],
  reviewing: ["fixing", "ready-to-merge", "blocked", "human-review-required"],
  fixing: ["ci-running", "reviewing", "blocked"],
  "ready-to-merge": ["merging", "blocked", "human-review-required"],
  merging: ["completed", "blocked", "human-review-required"],
  completed: ["next-task"],
  // After a merge the loop either generates the next task (`architecting`) or
  // goes straight to implementation when the brief is already queued.
  "next-task": ["architecting", "implementing", "completed", "blocked"],
  "human-review-required": [
    "idle",
    "implementing",
    "reviewing",
    "ready-to-merge",
  ],
  blocked: ["idle", "implementing", "reviewing", "fixing", "ready-to-merge"],
};

/** Statuses in which the loop owns an active task and a pull request. */
export const ACTIVE_STATUSES = [
  "architecting",
  "implementing",
  "ci-running",
  "reviewing",
  "fixing",
  "ready-to-merge",
  "merging",
];

/** Statuses that mean automation has stopped and a human is needed. */
export const STOPPED_STATUSES = ["blocked", "human-review-required"];

export function isTransitionAllowed(from, to) {
  if (from === to) return true;
  if (STOPPED_STATUSES.includes(to)) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** The task-queue status that matches a loop status. */
export function taskStatusForLoopStatus(loopStatus) {
  switch (loopStatus) {
    case "architecting":
    case "implementing":
      return "in-progress";
    case "ci-running":
    case "reviewing":
    case "fixing":
      return "in-review";
    case "ready-to-merge":
    case "merging":
      return "ready-to-merge";
    case "completed":
      return "done";
    case "blocked":
    case "human-review-required":
      return "blocked";
    default:
      return "queued";
  }
}

/** The single task that may be implemented, or null. */
export function selectActiveTask(queue) {
  const tasks = queue?.tasks ?? [];
  const inFlight = tasks.filter((task) =>
    ["in-progress", "in-review"].includes(task.status),
  );
  if (inFlight.length > 0) return inFlight[0];
  const ready = tasks
    .filter((task) => task.status === "approved")
    .sort((a, b) => (taskNumber(a.id) ?? 0) - (taskNumber(b.id) ?? 0));
  return ready[0] ?? null;
}

// --- the merge gate --------------------------------------------------------

/**
 * The merge-gate decision.
 *
 * Every check is re-derived at merge time from GitHub rather than trusted from
 * the earlier review: between the approval and the merge a push, a label change
 * or a new commit could have invalidated it, and merging on stale evidence is
 * the failure this function exists to prevent.
 *
 * The authoritative record of *what* was approved is the review marker on the
 * pull request, because the trusted review workflow writes it. The state file
 * supplies the loop's own bookkeeping (which task and pull request are active);
 * when it is present it is enforced strictly, and when it is missing the
 * pull-request evidence alone must carry the decision, so a lost state commit
 * cannot silently authorise a merge of the wrong pull request.
 *
 * @returns {{ allowed: boolean, reasons: string[], checks: Record<string, boolean>, protectedHits: string[], credentials: string[] }}
 */
export function evaluateMergeGate({
  pr,
  state,
  verdict,
  verdictHeadSha,
  ci,
  changedPaths,
  config,
  queue = null,
}) {
  const reasons = [];
  const checks = {};

  const record = (name, ok, reason) => {
    checks[name] = ok;
    if (!ok && reason !== undefined) reasons.push(reason);
    return ok;
  };

  const recordedPr = state?.currentPr ?? null;
  const aiManaged = isAiManagedPullRequest({ pr, state, queue, config });

  record(
    "prOpen",
    pr?.state === "OPEN" && pr?.merged !== true,
    "the pull request is not open",
  );
  record(
    "correctBase",
    pr?.baseRefName === config.baseBranch,
    `the pull request does not target ${config.baseBranch}`,
  );
  record(
    "sameRepository",
    pr?.isCrossRepository !== true,
    "the pull request comes from a fork",
  );
  // Identity is the loop's own record (state, label, review marker or a queued
  // task id), not the branch name alone — an AI task may live on `feat/*` or
  // `fix/*` just as legitimately as on `automation/*`.
  record(
    "aiManaged",
    aiManaged,
    "the pull request is not an AI-managed loop task (branch, state, label, review marker or task id)",
  );

  if (recordedPr !== null && typeof recordedPr.number === "number") {
    record(
      "activePr",
      recordedPr.number === pr?.number,
      `PR #${pr?.number} is not the loop's recorded active pull request (#${recordedPr.number})`,
    );
    record(
      "activeBranch",
      recordedPr.branch === pr?.headRefName,
      "the pull request branch does not match the recorded active branch",
    );
  } else {
    // No usable state: the pull request's own evidence must carry the decision,
    // and it still refuses an unrelated pull request.
    record(
      "activePr",
      aiManaged,
      "the pull request is not an AI-managed loop task",
    );
  }

  record(
    "notBlocked",
    !STOPPED_STATUSES.includes(state?.status) &&
      !(pr?.labels ?? []).includes(config.automation.blockedLabel),
    "the loop is blocked and needs a human decision",
  );
  record(
    "reviewApproved",
    verdict === "approved",
    verdict === undefined
      ? "no review verdict is recorded for this pull request"
      : `the latest review verdict is "${verdict}"`,
  );
  // The approval must belong to the commit being merged. This is what makes
  // "a push after approval invalidates the approval" hold.
  record(
    "headMatchesApproval",
    verdictHeadSha !== undefined && verdictHeadSha === pr?.headRefOid,
    verdictHeadSha === undefined
      ? "the approval records no head commit"
      : "the head commit changed after the approval; the new commit must be reviewed",
  );
  record(
    "ciGreen",
    ci?.status === "success",
    `required CI is ${ci?.status ?? "unknown"}`,
  );
  record(
    "mergeable",
    pr?.mergeable !== "CONFLICTING",
    "the pull request has merge conflicts",
  );

  const protectedHits = protectedPathViolations(
    changedPaths,
    config.protectedPaths,
  );
  const credentials = credentialViolations(changedPaths);
  if (
    config.automation.stopOnProtectedPath === true &&
    protectedHits.length > 0
  ) {
    record(
      "noProtectedPaths",
      false,
      `protected paths changed: ${protectedHits.join(", ")}`,
    );
  } else {
    record("noProtectedPaths", true);
  }
  if (
    config.automation.stopOnProtectedPath === true &&
    credentials.length > 0
  ) {
    record(
      "noCredentials",
      false,
      `credential files changed: ${credentials.join(", ")}`,
    );
  } else {
    record("noCredentials", true);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    checks,
    protectedHits,
    credentials,
  };
}

/**
 * Classify a failure as a hard stop (a human is required) or a normal event
 * (the loop handles it and carries on).
 *
 * Getting this wrong in either direction is expensive: treating a normal event
 * as a hard stop breaks the autonomous path, and treating a real exception as
 * normal lets the loop spin or merge something it should not.
 */
export const HARD_STOPS = {
  "max-rounds-exceeded":
    "The maximum number of review rounds was reached with findings still open.",
  "reviewer-blocked": "The reviewer explicitly blocked the pull request.",
  "protected-path": "A protected path was modified.",
  "migration-change": "A database migration was modified.",
  "credential-change": "A credential or environment file was modified.",
  "ci-workflow-change": "The CI workflow definition was modified.",
  "security-sensitive": "A security-sensitive change needs human review.",
  "contradictory-task": "The task brief contradicts the repository state.",
  "ambiguous-roadmap": "The next task could not be determined unambiguously.",
  "auth-failure-github": "GitHub authentication failed and cannot be retried.",
  "auth-failure-jules": "Jules authentication failed and cannot be retried.",
  "auth-failure-openai": "OpenAI authentication failed.",
  "auth-failure-openrouter": "OpenRouter authentication or quota failed.",
  "merge-conflict": "The pull request has a merge conflict that needs a human.",
  "branch-protection": "Branch protection prevents the merge.",
  "no-valid-next-task": "No valid next task could be generated.",
  "multiple-active-tasks": "More than one implementation task is active.",
  "state-corruption": "The loop state is invalid or inconsistent.",
  "unexpected-pr":
    "The pull request/branch relationship is not the one the loop recorded.",
  "head-sha-mismatch": "The head commit changed between approval and merge.",
};

export const NORMAL_EVENTS = {
  "changes-requested":
    "The reviewer requested changes; the loop dispatches a fix.",
  "fix-round": "Jules needs another fix round on the same pull request.",
  "ci-defect":
    "CI failed because of a code defect; the fix round addresses it.",
  "ci-rerun": "CI needs another run.",
  "task-completed": "A task completed normally.",
  "next-task-generated": "A next task was generated normally.",
  "pr-created": "A pull request was created normally.",
  "pr-merged": "A pull request merged normally.",
  approved: "The reviewer approved; the loop proceeds to merge.",
};

export function classifyEvent(event) {
  if (Object.hasOwn(HARD_STOPS, event))
    return { hardStop: true, description: HARD_STOPS[event] };
  if (Object.hasOwn(NORMAL_EVENTS, event))
    return { hardStop: false, description: NORMAL_EVENTS[event] };
  return { hardStop: true, description: `unrecognised event "${event}"` };
}

/** The label set a stop should leave behind. */
export function labelsForStop(config) {
  return {
    add: [config.automation.blockedLabel],
    remove: [config.automation.readyLabel],
  };
}
