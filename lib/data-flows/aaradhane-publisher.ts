/**
 * Aaradhane generated-dataset publisher.
 *
 * The previous yearly dataset is preserved as a date-stamped snapshot before a
 * new one replaces it. If the existing dataset is present but invalid, the
 * publisher refuses to overwrite it: an unreadable last-known-good file is a
 * reason to stop, not a reason to replace it with a version nobody can compare.
 *
 * `current.json` is opt-in via `advanceCurrent`. Historical regeneration only
 * replaces `years/YYYY.json` and its snapshot, so an old year can never become
 * the current dataset by accident.
 */

import { jsonEqual, parseJson, serializeJson } from "./json";
import {
  aaradhaneCurrentPath,
  aaradhaneSnapshotPath,
  aaradhaneYearPath,
} from "./paths";
import {
  validateAaradhaneYearDataset,
  type AaradhaneYearDataset,
} from "./schemas";
import { isStorageNotFound, type ObjectStorage } from "./storage";

export type AaradhanePublishStep = "snapshot" | "yearly" | "current" | "verify-existing-year";

export class AaradhanePublishError extends Error {
  readonly step: AaradhanePublishStep;

  constructor(step: AaradhanePublishStep, message: string) {
    super(`[aaradhane:${step}] ${message}`);
    this.name = "AaradhanePublishError";
    this.step = step;
  }
}

export interface PublishAaradhaneOptions {
  /**
   * Advance `current.json` to this dataset. Off by default so regenerating a
   * historical year never makes an old dataset current.
   */
  advanceCurrent?: boolean;
  verifyAttempts?: number;
}

export interface PublishAaradhaneResult {
  year: number;
  yearPath: string;
  currentPath: string;
  currentUpdated: boolean;
  snapshotPath: string | null;
  eventCount: number;
  unchanged: boolean;
}

async function writeAndVerify(
  storage: ObjectStorage,
  path: string,
  value: unknown,
  step: AaradhanePublishStep,
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

  throw new AaradhanePublishError(step, lastError);
}

async function readExistingYear(
  storage: ObjectStorage,
  year: number
): Promise<AaradhaneYearDataset | null> {
  const result = await storage.getText(aaradhaneYearPath(year));
  if (!result.ok || result.text === null) {
    if (isStorageNotFound(result)) return null;
    throw new AaradhanePublishError(
      "verify-existing-year",
      result.error ?? "could not read the existing Aaradhane dataset"
    );
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    throw new AaradhanePublishError(
      "verify-existing-year",
      `existing Aaradhane dataset is not valid JSON (${parsed.error}); refusing to overwrite it`
    );
  }

  const validation = validateAaradhaneYearDataset(parsed.value, year);
  if (!validation.ok || !validation.value) {
    throw new AaradhanePublishError(
      "verify-existing-year",
      `existing Aaradhane dataset failed validation (${validation.errors.join("; ")}); refusing to overwrite it`
    );
  }
  return validation.value;
}

export async function publishAaradhaneYearDataset(
  storage: ObjectStorage,
  input: unknown,
  options: PublishAaradhaneOptions = {}
): Promise<PublishAaradhaneResult> {
  const validation = validateAaradhaneYearDataset(input);
  if (!validation.ok || !validation.value) {
    throw new AaradhanePublishError(
      "yearly",
      `generated dataset failed validation: ${validation.errors.join("; ")}`
    );
  }

  const dataset = validation.value;
  const year = dataset.year;
  const yearPath = aaradhaneYearPath(year);
  const currentPath = aaradhaneCurrentPath();
  const attempts = options.verifyAttempts ?? 2;

  const existing = await readExistingYear(storage, year);
  const unchanged = existing !== null && jsonEqual(existing, dataset);

  let snapshotPath: string | null = null;

  if (existing && !unchanged) {
    snapshotPath = aaradhaneSnapshotPath(year, existing.metadata.generated_at);
    const alreadyStored = await storage.getText(snapshotPath);
    if (!alreadyStored.ok || alreadyStored.text === null) {
      await writeAndVerify(storage, snapshotPath, existing, "snapshot", attempts);
    }
  }

  if (!unchanged) {
    await writeAndVerify(storage, yearPath, dataset, "yearly", attempts);
  }

  const currentUpdated = options.advanceCurrent === true;
  if (currentUpdated) {
    await writeAndVerify(storage, currentPath, dataset, "current", attempts);
  }

  return {
    year,
    yearPath,
    currentPath,
    currentUpdated,
    snapshotPath,
    eventCount: dataset.events.length,
    unchanged,
  };
}
