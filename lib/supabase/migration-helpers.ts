/**
 * Shared helpers for the Firestore -> Supabase migration scripts.
 *
 * Centralising these keeps the "no synthetic data" and "correct reconciliation"
 * requirements identical across every migrator instead of drifting per script.
 */

/**
 * Convert a Firestore timestamp representation to an ISO string.
 *
 * Returns `null` when the value is absent or unparseable. Callers must decide
 * whether a missing timestamp is a validation failure or a legitimately
 * nullable column - this helper never invents a value.
 */
export function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "object") {
    const candidate = value as {
      toDate?: () => Date;
      _seconds?: number;
    };
    if (typeof candidate.toDate === "function") {
      const d = candidate.toDate();
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof candidate._seconds === "number") {
      return new Date(candidate._seconds * 1000).toISOString();
    }
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

/**
 * Resolve a timestamp that must be present, otherwise record a validation
 * failure. Used for NOT NULL destination columns instead of substituting
 * `new Date()`.
 */
export function requireTimestamp(
  value: unknown,
  fieldName: string,
  recordId: string
): string {
  const iso = toIsoString(value);
  if (!iso) {
    throw new ValidationError(
      `Missing or invalid required timestamp '${fieldName}' on document '${recordId}'`
    );
  }
  return iso;
}

/**
 * Count the number of leaf-bearing top-level fields in a document. Used to
 * record how much source data a JSONB settings blob carried, so coverage can
 * be asserted during reconciliation.
 */
export function countTopLevelFields(data: Record<string, unknown>): number {
  return Object.keys(data).length;
}

export interface ReconciliationInput {
  sourceCount: number;
  inserts: number;
  updates: number;
  validationFailures: number;
  writeFailures: number;
}

export interface ReconciliationResult {
  ok: boolean;
  accountedFor: number;
  missing: number;
  details: string;
}

/**
 * Verify the core invariant of a migration run:
 *
 *   source documents = inserts + updates + validation failures + write failures
 *
 * A non-zero `missing` means documents vanished without explanation, which is
 * exactly the silent-data-loss condition the audit must never allow.
 */
export function reconcileCounts(input: ReconciliationInput): ReconciliationResult {
  const accountedFor =
    input.inserts + input.updates + input.validationFailures + input.writeFailures;
  const missing = input.sourceCount - accountedFor;

  const details =
    `source=${input.sourceCount}, inserts=${input.inserts}, updates=${input.updates}, ` +
    `validationFailures=${input.validationFailures}, writeFailures=${input.writeFailures}, ` +
    `accountedFor=${accountedFor}`;

  return { ok: missing === 0, accountedFor, missing, details };
}

/**
 * A mapper rejected a document that cannot be migrated without inventing data
 * or that violates a NOT NULL destination constraint.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * How a Firestore source field is handled by a mapper. Every field observed in
 * the source must fall into one of these buckets, otherwise it would silently
 * disappear - the exact failure mode this audit exists to prevent.
 */
export type FieldDisposition = "mapped" | "transformed" | "intentionallyExcluded";

export interface FieldCoverageSpec {
  /** Source fields written to a destination column, in some form. */
  mapped: string[];
  /** Source fields deliberately reshaped (e.g. Timestamp -> ISO string). */
  transformed?: string[];
  /** Source fields excluded on purpose; `why` documents the reason. */
  intentionallyExcluded?: { field: string; why: string }[];
}

export interface FieldCoverageResult {
  collection: string;
  /** Source fields with no declared disposition - potential silent loss. */
  unmapped: string[];
  /** Declared fields that never appeared in the source. */
  absentFromSource: string[];
}

/**
 * Compare the fields actually present in the source documents against the
 * dispositions declared by a mapper.
 *
 * Any field observed in the source but absent from the spec is reported as
 * `unmapped`; the migrator treats a non-empty `unmapped` list as a failure.
 */
export function auditFieldCoverage(
  collection: string,
  observedFields: Set<string>,
  spec: FieldCoverageSpec
): FieldCoverageResult {
  const declared = new Set<string>([
    ...spec.mapped,
    ...(spec.transformed || []),
    ...(spec.intentionallyExcluded || []).map((e) => e.field),
  ]);

  const unmapped = [...observedFields].filter((f) => !declared.has(f)).sort();

  const absentFromSource = [...declared].filter((f) => !observedFields.has(f)).sort();

  return { collection, unmapped, absentFromSource };
}
