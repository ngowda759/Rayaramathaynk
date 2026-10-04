/**
 * Types for the pure review rules in `review-core.mjs`.
 *
 * The loop's scripts stay dependency-free JavaScript, so they are not compiled.
 * This declaration exists so the unit tests that import `review-core.mjs` are
 * type-checked against a real contract instead of an implicit `any`, which the
 * repository's strict lint rules forbid.
 */

export const REVIEW_MARKER_NAME: string;
export const VERDICTS: readonly string[];
export const SEVERITIES: readonly string[];
export const BLOCKING_SEVERITIES: ReadonlySet<string>;

export interface PrComment {
  body?: string;
}

export interface ReviewMarker {
  round: number;
  headSha: string;
  verdict: string | null;
}

export interface ReviewedHead {
  round: number;
  verdict: string | null;
}

export interface ReviewPlan {
  action: 'review' | 'skip';
  round: number;
  reason: string;
}

export interface RawCiCheck {
  name?: string;
  state?: string;
  bucket?: string;
  link?: string;
}

export interface CiCheck {
  name: string;
  state: string;
  bucket: string;
  link: string | null;
}

export interface CiSummary {
  status: 'success' | 'failure' | 'pending' | 'unknown';
  required: CiCheck[];
  failing: CiCheck[];
  missing: CiCheck[];
  pending: CiCheck[];
}

export interface Finding {
  id: string;
  severity: string;
  file: string;
  line?: number;
  summary: string;
  suggestion: string;
}

export interface AcceptanceCriterion {
  criterion: string;
  status: 'met' | 'unmet' | 'unverifiable';
  evidence: string;
}

export interface ReviewReport {
  taskId: string;
  pr: number;
  round: number;
  headSha: string;
  verdict: string;
  ciStatus: string;
  findings: Finding[];
  reviewedAt: string;
  summary?: string;
  acceptanceCriteria?: AcceptanceCriterion[];
}

export interface ReportFacts {
  taskId?: string;
  pr: number;
  round: number;
  headSha: string;
  ciStatus?: string;
  reviewedAt?: string;
}

export interface CoercedVerdict {
  verdict: string;
  forced: boolean;
  reason: string | null;
}

export interface Decision {
  action: 'fix' | 'ready' | 'blocked' | 'none';
  status: string;
  addLabels: string[];
  removeLabels: string[];
  message: string;
}

export interface ReviewRequestBody {
  model: string;
  instructions: string;
  input: string;
  text: {
    format: {
      type: string;
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
}

export function reviewMarker(round: number, headSha: string, verdict?: string): string;
export function parseReviewMarkers(text: string): ReviewMarker[];
export function reviewedHeads(comments: PrComment[]): Map<string, ReviewedHead>;
export function planReview(input: {
  comments: PrComment[];
  headSha: string;
  maxReviewRounds: number;
}): ReviewPlan;
export function classifyCi(checks: RawCiCheck[], requiredChecks: string[]): CiSummary;
export function ciFindings(ci: CiSummary): Finding[];
export function coerceVerdict(input: {
  requested: string;
  ci: CiSummary;
  round: number;
  maxReviewRounds: number;
}): CoercedVerdict;
export function normalizeModelReport(raw: unknown, facts: ReportFacts): ReviewReport;
export function validateReport(report: ReviewReport, facts?: ReportFacts): string[];
export function stripSchemaMeta(schema: Record<string, unknown>): Record<string, unknown>;
export function reviewApiKeyEnvVar(review: { apiKeyEnvVar?: string; provider?: string }): string;
export function reviewModelEnvVar(review: { provider?: string; modelEnvVar?: string }): string;
export function resolveApiKey(
  review: { apiKeyEnvVar?: string; provider?: string },
  env?: Record<string, string | undefined>,
): { apiKey: string; envVar: string };
export function reviewEndpoint(review: { endpoint?: string }): string;
export function resolveReviewModel(input?: {
  review?: { provider?: string; model?: string; modelEnvVar?: string };
  override?: string;
  env?: Record<string, string | undefined>;
}): string | undefined;
export function buildReviewRequestBody(input: {
  model: string;
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  name?: string;
}): ReviewRequestBody;
export function extractOutputText(payload: unknown): string;
export function parseModelJson(text: string): Record<string, unknown>;
export function decisionFor(input: {
  verdict: string;
  ciStatus: string;
  round: number;
  maxReviewRounds: number;
}): Decision;
export function buildComment(report: ReviewReport, decision: Decision): string;
export function buildFixContext(input: {
  report: ReviewReport;
  pr: number;
  branch: string;
  headSha: string;
  maxReviewRounds: number;
}): string;
