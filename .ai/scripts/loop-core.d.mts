/**
 * Types for the pure loop rules in `loop-core.mjs`.
 *
 * The loop's scripts stay dependency-free JavaScript, so they are not compiled.
 * This declaration exists so the unit tests that import `loop-core.mjs` are
 * type-checked against a real contract instead of an implicit `any`, which the
 * repository's strict lint rules forbid.
 */

export const REPO_ROOT: string;
export const TRANSITIONS: Record<string, string[]>;
export const ACTIVE_STATUSES: readonly string[];
export const STOPPED_STATUSES: readonly string[];

export interface LoopConfig {
  version: number;
  loopId: string;
  maxReviewRounds: number;
  baseBranch: string;
  branchPrefix: string;
  ciWorkflow: string;
  ciWorkflowFile: string;
  requiredChecks: string[];
  protectedPaths: string[];
  secrets: { required: string[]; optional: string[]; note: string };
  review: {
    provider: string;
    endpoint: string;
    model: string;
    apiKeyEnvVar?: string;
    modelEnvVar: string;
    schema: string;
    markerName: string;
    commentOnEveryRound: boolean;
  };
  mergeGate: {
    enabled: boolean;
    requireCiGreen: boolean;
    requireReviewPassed: boolean;
    requireHumanApproval: boolean;
  };
  reviewers: Record<string, string>;
  automation: {
    enabled: boolean;
    autoAdvanceTasks: boolean;
    autoMerge: boolean;
    maxConcurrentTasks: number;
    nextTaskEnabled: boolean;
    stopOnHumanReviewRequired: boolean;
    stopOnProtectedPath: boolean;
    triggerLabel: string;
    reviewLabel: string;
    blockedLabel: string;
    readyLabel: string;
    nextTaskBranchPrefix: string;
    mergeMethod: string;
    useNativeAutoMerge: boolean;
  };
  limits: { maxChangedFiles: number; maxDiffLines: number };
  paths: {
    state: string;
    queue: string;
    reviewLog: string;
    taskDocs: string;
  };
}

export interface TaskBrief {
  id: string;
  title: string;
  phase: string;
  status: string;
  summary: string;
  acceptanceCriteria: string[];
  outOfScope: string[];
  humanApproval: boolean;
  dependsOn?: string[];
  references?: string[];
  createdAt: string;
  pr?: number | null;
  branch?: string | null;
  headSha?: string | null;
  startedAt?: string | null;
  mergedAt?: string | null;
  completedAt?: string | null;
  reviewFindings?: string[];
}

export interface TaskQueue {
  version: number;
  updatedAt: string;
  tasks: TaskBrief[];
}

export interface LoopState {
  version: number;
  loopId: string;
  status: string;
  round: number;
  maxReviewRounds: number;
  currentTaskId: string | null;
  currentPr: { number: number; branch: string; headSha: string } | null;
  lastVerdict: string | null;
  lastCiStatus: string | null;
  reviewedHeadSha: string | null;
  blockedReason: string | null;
  completedTasks?: string[];
  updatedAt: string;
  history: { at: string; status: string; note: string }[];
}

export interface EventClassification {
  event: string;
  hardStop: boolean;
  description: string;
}

export interface MergeGatePr {
  number?: number;
  state?: string;
  merged?: boolean;
  mergedAt?: string | null;
  mergeCommit?: { oid?: string } | null;
  baseRefName?: string;
  headRefName?: string;
  headRefOid?: string;
  isCrossRepository?: boolean;
  mergeable?: string;
  labels?: string[];
  title?: string;
  comments?: { body?: string }[];
}

export interface MergeGateInput {
  pr: MergeGatePr;
  state: LoopState | null;
  // `exactOptionalPropertyTypes` is on, and the callers deliberately pass
  // `undefined` when the pull request carries no review marker, so the optional
  // fields accept it explicitly.
  verdict?: string | undefined;
  verdictHeadSha?: string | undefined;
  ci?: { status: string } | null | undefined;
  changedPaths: string[];
  config: LoopConfig;
  queue?: TaskQueue | null;
}

export interface MergeGateDecision {
  allowed: boolean;
  reasons: string[];
  checks: Record<string, boolean>;
  protectedHits: string[];
  credentials: string[];
}

export const CREDENTIAL_PATTERNS: readonly string[];
export const HARD_STOPS: Record<string, string>;
export const NORMAL_EVENTS: Record<string, string>;

export function loadConfig(root?: string): LoopConfig;
export function taskNumber(taskId: string): number | null;
export function isAiManagedPullRequest(input: {
  pr: MergeGatePr | null;
  state?: LoopState | null;
  queue?: TaskQueue | null;
  config: LoopConfig;
  mergeCommitSha?: string;
}): boolean;
export function sortTaskIds(ids: string[]): string[];
export function labelsForStop(config: LoopConfig): { add: string[]; remove: string[] };
export function loadState(root?: string): LoopState | null;
export function loadQueue(root?: string): TaskQueue | null;
export function isTransitionAllowed(from: string, to: string): boolean;
export function taskStatusForLoopStatus(loopStatus: string): string;
export function selectActiveTask(queue: TaskQueue): TaskBrief | null;
export function resolveNextTaskId(ids: string[]): string;
export function validateTaskSequence(ids: string[]): string[];
export function globToRegExp(pattern: string): RegExp;
export function matchesProtectedPath(path: string, patterns: string[]): boolean;
export function protectedPathViolations(paths: string[], patterns: string[]): string[];
export function credentialViolations(paths: string[]): string[];
export function evaluateMergeGate(input: MergeGateInput): MergeGateDecision;
export function classifyEvent(event: string): EventClassification;
export function assertSingleActiveTask(input: {
  state: LoopState | null;
  queue: TaskQueue | null;
  openPrs:
    { number: number; branch: string; base: string; title: string; isAutomation: boolean }[] | null;
  config: LoopConfig;
}): { ok: boolean; errors: string[]; activePr: number | null };
export function isRecoverableNextTaskState(
  state: LoopState | null | undefined,
  queue?: TaskQueue | null,
): boolean;
export function classifyMergedLoopPr(input: {
  pr: MergeGatePr | null;
  state?: LoopState | null;
  queue?: TaskQueue | null;
}): {
  kind: 'task' | 'infrastructure' | 'unattributable';
  task: TaskBrief | null;
  taskId: string | null;
};
export function selectMergedTaskPr(input: {
  mergedPrs: MergeGatePr[];
  state?: LoopState | null;
  queue?: TaskQueue | null;
  config: LoopConfig;
}): { pr: MergeGatePr; task: TaskBrief; taskId: string } | null;
