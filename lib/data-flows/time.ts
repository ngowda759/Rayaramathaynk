/**
 * IST date helpers for the Panchanga and Aaradhane data flows.
 *
 * A Panchanga record is "today's" only for the Asia/Kolkata calendar day. Using
 * `Date#toISOString().slice(0, 10)` derives the UTC day, which is still the
 * previous day between 00:00 and 05:29 IST — exactly the window in which the
 * scheduled publishers run. Every date boundary in this module is therefore
 * computed in Asia/Kolkata.
 */

export const IST_TIME_ZONE = "Asia/Kolkata";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The Asia/Kolkata calendar date for `date`, as `YYYY-MM-DD`. */
export function getIstDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The Asia/Kolkata calendar year for `date`. */
export function getIstYear(date: Date = new Date()): number {
  return Number(getIstDateString(date).slice(0, 4));
}

/**
 * True when `value` is a real `YYYY-MM-DD` calendar date.
 *
 * A regex alone accepts `2026-02-31`; constructing the UTC date and checking the
 * round-trip rejects impossible days and also rejects `2026-2-3`.
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** True when `value` is a four-digit year in a plausible range. */
export function isValidYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1900 &&
    value <= 2200
  );
}

/** The year component of a validated `YYYY-MM-DD` string. */
export function yearOfDate(date: string): number {
  return Number(date.slice(0, 4));
}

/** True when `date` falls inside `year`. */
export function isDateInYear(date: string, year: number): boolean {
  return isValidDateString(date) && yearOfDate(date) === year;
}

/** Number of whole days from `start` to `end`, inclusive. */
export function daysInclusive(start: string, end: string): number {
  if (!isValidDateString(start) || !isValidDateString(end)) {
    throw new Error("Invalid date passed to daysInclusive");
  }
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

/** The ISO 8601 timestamp shape the Panchanga generator emits (offset required). */
export function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  );
}

/**
 * An ISO 8601 local timestamp, with or without an offset.
 *
 * `metadata.generated_at` is written by Python's `datetime.now().isoformat()`,
 * which is naive; it is a generation marker, not an astronomical instant. The
 * astronomical fields (`sunrise`, `tithi.start`, ...) still require an explicit
 * offset through `isIsoTimestamp`.
 */
export function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
  );
}
