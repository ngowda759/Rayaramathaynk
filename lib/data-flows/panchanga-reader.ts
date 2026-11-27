/** Read-only Panchanga access over Supabase Storage. */

import { getIstDateString, isValidDateString, isValidYear } from "./time";
import { jsonEqual, parseJson } from "./json";
import { panchangaCurrentPath, panchangaDailyPath, panchangaYearPath } from "./paths";
import {
  isCurrentPanchangaRecord,
  validatePanchangaRecord,
  validatePanchangaYearDataset,
  type PanchangaRecord,
  type PanchangaYearDataset,
} from "./schemas";
import { isStorageNotFound, type ObjectStorage } from "./storage";

export type DataReadStatus = "ok" | "stale" | "unavailable";

export interface CurrentPanchangaRead {
  status: DataReadStatus;
  source: "supabase-storage";
  record: PanchangaRecord | null;
  expectedDate: string;
  error?: string;
}

export interface DailyPanchangaRead {
  status: "ok" | "unavailable";
  source: "supabase-storage";
  record: PanchangaRecord | null;
  date: string;
  error?: string;
}

export interface YearlyPanchangaRead {
  status: "ok" | "unavailable";
  source: "supabase-storage";
  dataset: PanchangaYearDataset | null;
  year: number;
  error?: string;
}

/**
 * Read `current.json` and classify it against the Asia/Kolkata date.
 *
 * A record from a previous day is returned with `status: "stale"` so a caller
 * can choose to show an explicit "not published today" state. It is never
 * classified as `ok`, which is what prevents yesterday's Panchanga from being
 * presented as today's.
 */
export async function readCurrentPanchanga(
  storage: ObjectStorage,
  now: Date = new Date()
): Promise<CurrentPanchangaRead> {
  const expectedDate = getIstDateString(now);
  const result = await storage.getText(panchangaCurrentPath());

  if (!result.ok || result.text === null) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      expectedDate,
      error: isStorageNotFound(result)
        ? "current.json has not been published"
        : result.error ?? "Storage read failed",
    };
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      expectedDate,
      error: `current.json is not valid JSON: ${parsed.error}`,
    };
  }

  const validation = validatePanchangaRecord(parsed.value);
  if (!validation.ok || !validation.value) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      expectedDate,
      error: `current.json failed validation: ${validation.errors.join("; ")}`,
    };
  }

  return {
    status: isCurrentPanchangaRecord(validation.value, expectedDate) ? "ok" : "stale",
    source: "supabase-storage",
    record: validation.value,
    expectedDate,
  };
}

/** Read a single historical day from `daily/YYYY-MM-DD.json`. */
export async function readDailyPanchanga(
  storage: ObjectStorage,
  date: string
): Promise<DailyPanchangaRead> {
  if (!isValidDateString(date)) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      date,
      error: "date must be a real YYYY-MM-DD calendar date",
    };
  }

  const result = await storage.getText(panchangaDailyPath(date));
  if (!result.ok || result.text === null) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      date,
      error: isStorageNotFound(result)
        ? `No Panchanga published for ${date}`
        : result.error ?? "Storage read failed",
    };
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      date,
      error: `daily/${date}.json is not valid JSON: ${parsed.error}`,
    };
  }

  const validation = validatePanchangaRecord(parsed.value, date);
  if (!validation.ok || !validation.value) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      record: null,
      date,
      error: `daily/${date}.json failed validation: ${validation.errors.join("; ")}`,
    };
  }

  return {
    status: "ok",
    source: "supabase-storage",
    record: validation.value,
    date,
  };
}

/** Read the complete yearly dataset from `years/YYYY.json`. */
export async function readYearlyPanchanga(
  storage: ObjectStorage,
  year: number
): Promise<YearlyPanchangaRead> {
  if (!isValidYear(year)) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: "year must be a four-digit year",
    };
  }

  const result = await storage.getText(panchangaYearPath(year));
  if (!result.ok || result.text === null) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: isStorageNotFound(result)
        ? `No yearly Panchanga published for ${year}`
        : result.error ?? "Storage read failed",
    };
  }

  const parsed = parseJson(result.text);
  if (!parsed.ok) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: `years/${year}.json is not valid JSON: ${parsed.error}`,
    };
  }

  const validation = validatePanchangaYearDataset(parsed.value, year);
  if (!validation.ok || !validation.value) {
    return {
      status: "unavailable",
      source: "supabase-storage",
      dataset: null,
      year,
      error: `years/${year}.json failed validation: ${validation.errors.join("; ")}`,
    };
  }

  return { status: "ok", source: "supabase-storage", dataset: validation.value, year };
}

/** Compare a stored object with the payload the caller intended to write. */
export function storedTextMatches(stored: string, intended: unknown): boolean {
  const parsed = parseJson(stored);
  return parsed.ok && jsonEqual(parsed.value, intended);
}
