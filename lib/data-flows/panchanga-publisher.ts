/**
 * Panchanga publisher.
 *
 * Write order is deliberate:
 *   1. the historical daily object,
 *   2. the yearly dataset (merged into the existing one),
 *   3. `current.json` last.
 *
 * `current.json` is therefore only advanced after both the daily record and the
 * yearly dataset have been verified. A failure at any earlier step leaves the
 * previous `current.json` in place, so the last known-good record cannot be
 * replaced by a partial one.
 */

import { serializeJson, parseJson, jsonEqual } from "./json";
import { withoutGeneratedAt } from "./schemas";
import {
  panchangaCurrentPath,
  panchangaDailyPath,
  panchangaYearPath,
} from "./paths";
import {
  buildPanchangaYearDataset,
  validateCompletePanchangaYear,
  validatePanchangaRecord,
  validatePanchangaYearDataset,
  type PanchangaRecord,
  type PanchangaYearDataset,
} from "./schemas";
import { isStorageNotFound, type ObjectStorage } from "./storage";
import { yearOfDate } from "./time";

export type PanchangaPublishStep = "daily" | "yearly" | "current" | "verify-existing-year";

export class PanchangaPublishError extends Error {
  readonly step: PanchangaPublishStep;

  constructor(step: PanchangaPublishStep, message: string) {
    super(`[panchanga:${step}] ${message}`);
    this.name = "PanchangaPublishError";
    this.step = step;
  }
}

export interface PublishPanchangaOptions {
  /** The Asia/Kolkata date the run was generated for. */
  expectedDate?: string;
  generatedAt?: string;
  verifyAttempts?: number;
}

export interface PublishPanchangaResult {
  date: string;
  year: number;
  dailyPath: string;
  yearPath: string;
  currentPath: string;
  yearlyDayCount: number;
}

async function writeAndVerify(
  storage: ObjectStorage,
  path: string,
  value: unknown,
  step: PanchangaPublishStep,
  attempts: number
): Promise<void> {
  const body = serializeJson(value);
  let lastError = "unknown verification failure";

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
    const put = await storage.putText(path, body);
    if (!put.ok) {
      lastError = put.error ?? `upload failed with HTTP ${put.status}`;
      continue;
    }

    const stored = await storage.getText(path);
    if (!stored.ok || stored.text === null) {
      lastError = stored.error ?? "uploaded object could not be read back";
      continue;
    }

    const parsed = parseJson(stored.text);
    if (!parsed.ok) {
      lastError = `uploaded object is not valid JSON: ${parsed.error}`;
      continue;
    }
    if (!jsonEqual(parsed.value, value)) {
      lastError = "uploaded object does not match the intended payload";
      continue;
    }
    return;
  }

  throw new PanchangaPublishError(step, lastError);
}

async function loadExistingYear(
  storage: ObjectStorage,
  year: number
): Promise<PanchangaYearDataset | null> {
  const path = panchangaYearPath(year);
  const result = await storage.getText(path);
  if (!result.ok || result.text === null) {
    if (isStorageNotFound(result)) return null;
    throw new PanchangaPublishError(
      "verify-existing-year",
      result.error ?? "could not read the existing yearly dataset"
    );
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    throw new PanchangaPublishError(
      "verify-existing-year",
      `existing yearly dataset is not valid JSON (${parsed.error}); refusing to overwrite it`
    );
  }

  const validation = validatePanchangaYearDataset(parsed.value, year);
  if (!validation.ok || !validation.value) {
    throw new PanchangaPublishError(
      "verify-existing-year",
      `existing yearly dataset failed validation (${validation.errors.join("; ")}); refusing to overwrite it`
    );
  }
  return validation.value;
}

export async function publishPanchangaRecord(
  storage: ObjectStorage,
  input: unknown,
  options: PublishPanchangaOptions = {}
): Promise<PublishPanchangaResult> {
  const expectedDate = options.expectedDate;
  const validation = validatePanchangaRecord(input, expectedDate);
  if (!validation.ok || !validation.value) {
    throw new PanchangaPublishError(
      "daily",
      `generated record failed validation: ${validation.errors.join("; ")}`
    );
  }

  const record: PanchangaRecord = validation.value;
  const year = yearOfDate(record.date);
  const dailyPath = panchangaDailyPath(record.date);
  const yearPath = panchangaYearPath(year);
  const currentPath = panchangaCurrentPath();
  const attempts = options.verifyAttempts ?? 2;

  // Preflight: read the existing yearly dataset before writing anything, so an
  // unreadable last-known-good file aborts the run without even writing the day.
  const existing = await loadExistingYear(storage, year);

  // 1. Daily historical record.
  await writeAndVerify(storage, dailyPath, record, "daily", attempts);

  // 2. Yearly dataset, merged into the existing one only when that one is valid.
  const generatedAt =
    options.generatedAt ?? existing?.metadata.generated_at ?? new Date().toISOString();
  const days = existing ? { ...existing.days } : {};
  days[record.date] = record;
  const dataset = buildPanchangaYearDataset(
    year,
    Object.values(days),
    generatedAt,
    existing?.metadata.generator ?? "Rayara Panchanga Engine",
    existing?.metadata.version ?? "1.0.0"
  );
  const datasetValidation = validatePanchangaYearDataset(dataset, year);
  if (!datasetValidation.ok || !datasetValidation.value) {
    throw new PanchangaPublishError(
      "yearly",
      `merged yearly dataset failed validation: ${datasetValidation.errors.join("; ")}`
    );
  }
  await writeAndVerify(storage, yearPath, datasetValidation.value, "yearly", attempts);

  // 3. Current record last, so it never points at a partially published day.
  await writeAndVerify(storage, currentPath, record, "current", attempts);

  return {
    date: record.date,
    year,
    dailyPath,
    yearPath,
    currentPath,
    yearlyDayCount: Object.keys(datasetValidation.value.days).length,
  };
}

export interface PublishPanchangaYearOptions {
  updateCurrent?: boolean;
  verifyAttempts?: number;
  /**
   * Require every calendar date in the year. Defaults to true for bulk imports;
   * set false only for a deliberately partial audit copy.
   */
  requireCompleteYear?: boolean;
}

export interface PublishPanchangaYearResult {
  year: number;
  yearPath: string;
  dailyPaths: string[];
  currentPath: string | null;
  dayCount: number;
}

/** Read one existing object and decide whether it can be written. */
async function preflightYearObject(
  storage: ObjectStorage,
  path: string,
  expected: unknown,
  step: "daily" | "yearly"
): Promise<"write" | "skip"> {
  const existing = await storage.getText(path);
  if (!existing.ok || existing.text === null) {
    if (isStorageNotFound(existing)) return "write";
    throw new PanchangaPublishError(step, existing.error ?? `could not read ${path}`);
  }

  const parsed = parseJson(existing.text);
  if (!parsed.ok) {
    throw new PanchangaPublishError(
      step,
      `${path} already exists but is not valid JSON (${parsed.error}); refusing to overwrite it`
    );
  }
  if (jsonEqual(parsed.value, expected)) return "skip";
  if (step === "yearly" && jsonEqual(withoutGeneratedAt(parsed.value), withoutGeneratedAt(expected))) {
    return "skip";
  }
  throw new PanchangaPublishError(
    step,
    `${path} already exists with different content; refusing to overwrite it`
  );
}

/**
 * Publish an already-built yearly dataset (used by the historical import tool).
 *
 * Unlike the daily path this never advances `current.json` unless explicitly
 * asked, because importing history must not make an old day the current record.
 * It also requires every calendar date in the year by default, so an incomplete
 * history cannot be published.
 */
export async function publishPanchangaYearDataset(
  storage: ObjectStorage,
  input: unknown,
  options: PublishPanchangaYearOptions = {}
): Promise<PublishPanchangaYearResult> {
  const validation =
    options.requireCompleteYear === false
      ? validatePanchangaYearDataset(input)
      : validateCompletePanchangaYear(input);
  if (!validation.ok || !validation.value) {
    throw new PanchangaPublishError(
      "yearly",
      `yearly dataset failed validation: ${validation.errors.join("; ")}`
    );
  }

  const dataset = validation.value;
  const attempts = options.verifyAttempts ?? 2;
  const dailyPaths: string[] = [];
  const plannedWrites: Array<{
    path: string;
    value: unknown;
    step: "daily" | "yearly";
  }> = [];

  // Atomic preflight: inspect every object before the first write. A conflict,
  // invalid JSON or unreadable object on the last daily record still leaves
  // Storage untouched.
  for (const [date, record] of Object.entries(dataset.days).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const path = panchangaDailyPath(date);
    dailyPaths.push(path);
    const decision = await preflightYearObject(storage, path, record, "daily");
    if (decision === "write") plannedWrites.push({ path, value: record, step: "daily" });
  }

  const yearPath = panchangaYearPath(dataset.year);
  const yearDecision = await preflightYearObject(storage, yearPath, dataset, "yearly");
  if (yearDecision === "write") {
    plannedWrites.push({ path: yearPath, value: dataset, step: "yearly" });
  }

  for (const write of plannedWrites) {
    await writeAndVerify(storage, write.path, write.value, write.step, attempts);
  }

  let currentPath: string | null = null;
  if (options.updateCurrent) {
    currentPath = panchangaCurrentPath();
    const latest = Object.values(dataset.days).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    if (latest) {
      await writeAndVerify(storage, currentPath, latest, "current", attempts);
    }
  }

  return {
    year: dataset.year,
    yearPath,
    dailyPaths,
    currentPath,
    dayCount: Object.keys(dataset.days).length,
  };
}
