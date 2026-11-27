/**
 * Supabase Storage object paths for both flows.
 *
 * Builders validate their inputs before interpolating, so a caller cannot use a
 * date or year string to escape the folder (for example `../other`).
 */

import { isValidDateString, isValidYear } from "./time";

export const DATA_FLOWS_BUCKET = "RayaramathaYNK";
export const PANCHANGA_PREFIX = "Data_flows/Panchanga";
export const AARADHANE_PREFIX = "Data_flows/Aaradhane";

export function panchangaCurrentPath(): string {
  return `${PANCHANGA_PREFIX}/current.json`;
}

export function panchangaDailyPath(date: string): string {
  if (!isValidDateString(date)) throw new Error(`Invalid Panchanga date: ${date}`);
  return `${PANCHANGA_PREFIX}/daily/${date}.json`;
}

export function panchangaYearPath(year: number): string {
  if (!isValidYear(year)) throw new Error(`Invalid Panchanga year: ${year}`);
  return `${PANCHANGA_PREFIX}/years/${year}.json`;
}

export function aaradhaneCurrentPath(): string {
  return `${AARADHANE_PREFIX}/current.json`;
}

export function aaradhaneYearPath(year: number): string {
  if (!isValidYear(year)) throw new Error(`Invalid Aaradhane year: ${year}`);
  return `${AARADHANE_PREFIX}/years/${year}.json`;
}

/**
 * A date-stamped snapshot of a previously published yearly dataset.
 *
 * `generatedAt` comes from the dataset metadata and is sanitised so the object
 * key stays a single flat name under the year folder.
 */
export function aaradhaneSnapshotPath(year: number, generatedAt: string): string {
  if (!isValidYear(year)) throw new Error(`Invalid Aaradhane year: ${year}`);
  const safe = generatedAt.replace(/[^0-9A-Za-z._-]/g, "-");
  if (!safe) throw new Error("Snapshot timestamp is empty");
  return `${AARADHANE_PREFIX}/snapshots/${year}/${safe}.json`;
}

/** Prefix used by the historical import tool to enumerate yearly objects. */
export function panchangaYearsPrefix(): string {
  return `${PANCHANGA_PREFIX}/years`;
}

export function aaradhaneYearsPrefix(): string {
  return `${AARADHANE_PREFIX}/years`;
}
