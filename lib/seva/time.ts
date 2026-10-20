/**
 * Asia/Kolkata time for the seva module. India has no daylight saving, so every function goes through one
 * fixed +05:30 shift ({@link toIstWall} / {@link fromIstWall}) instead of the runtime's time-zone database.
 */

export const IST = "Asia/Kolkata";

export type Period = "today" | "week" | "month" | "year";

export interface PeriodRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: "hour" | "day" | "month";
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC instant -> a Date whose UTC fields read as IST wall-clock time. */
function toIstWall(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

/** IST wall-clock time held in UTC fields (ms) -> the real UTC instant. */
function fromIstWall(wallMs: number): Date {
  return new Date(wallMs - IST_OFFSET_MS);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new RangeError("invalid_date");
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Calendar fields of an instant in IST; weekday 1 = Monday ... 7 = Sunday. */
export function istParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const w = toIstWall(d);
  return {
    year: w.getUTCFullYear(),
    month: w.getUTCMonth() + 1,
    day: w.getUTCDate(),
    hour: w.getUTCHours(),
    minute: w.getUTCMinutes(),
    weekday: ((w.getUTCDay() + 6) % 7) + 1,
  };
}

/** The IST calendar date of an instant: 'YYYY-MM-DD'. */
export function businessDate(d: Date): string {
  const p = istParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** 00:00 IST of a calendar date: '2026-10-18' -> 2026-10-17T18:30:00.000Z. */
export function istStartOfDay(date: string): Date {
  const { y, m, d } = parseDate(date);
  return fromIstWall(Date.UTC(y, m - 1, d));
}

/**
 * The same wall-clock moment `monthsBack` months earlier, on the same day number and time. When that day does not
 * exist in the earlier month, it is capped at the end of that month (00:00 of the following 1st).
 */
function sameMomentMonthsBack(now: Date, monthsBack: number): Date {
  const w = toIstWall(now);
  const timeOfDay = w.getTime() - Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
  const target = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth() - monthsBack, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  if (w.getUTCDate() > daysInMonth(ty, tm + 1)) {
    return fromIstWall(Date.UTC(ty, tm + 1, 1));
  }
  return fromIstWall(Date.UTC(ty, tm, w.getUTCDate()) + timeOfDay);
}

/** Current and like-for-like previous spans for the dashboard (Design Book 12.1; C-04, C-05, C-13). */
export function periodRange(period: Period, now: Date): PeriodRange {
  const w = toIstWall(now);
  const y = w.getUTCFullYear();
  const mo = w.getUTCMonth();
  const day = w.getUTCDate();

  switch (period) {
    case "today": {
      const from = fromIstWall(Date.UTC(y, mo, day));
      return {
        from,
        to: now,
        prevFrom: new Date(from.getTime() - DAY_MS),
        prevTo: new Date(now.getTime() - DAY_MS),
        bucket: "hour",
      };
    }
    case "week": {
      const sinceMonday = (w.getUTCDay() + 6) % 7;
      const from = fromIstWall(Date.UTC(y, mo, day - sinceMonday));
      return {
        from,
        to: now,
        prevFrom: new Date(from.getTime() - 7 * DAY_MS),
        prevTo: new Date(now.getTime() - 7 * DAY_MS),
        bucket: "day",
      };
    }
    case "month":
      return {
        from: fromIstWall(Date.UTC(y, mo, 1)),
        to: now,
        prevFrom: fromIstWall(Date.UTC(y, mo - 1, 1)),
        prevTo: sameMomentMonthsBack(now, 1),
        bucket: "day",
      };
    case "year":
      return {
        from: fromIstWall(Date.UTC(y, 0, 1)),
        to: now,
        prevFrom: fromIstWall(Date.UTC(y - 1, 0, 1)),
        prevTo: sameMomentMonthsBack(now, 12),
        bucket: "month",
      };
  }
}

/** Hour buckets for the Today chart: '05' .. '22'. */
export function hourBuckets(): string[] {
  return Array.from({ length: 18 }, (_, i) => pad2(i + 5));
}

/** Adds n calendar days to 'YYYY-MM-DD'. */
export function addDays(date: string, n: number): string {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Allowed seva dates: from today to today + daysAhead (C-29). */
export function sevaDateBounds(today: string, daysAhead: number): { min: string; max: string } {
  return { min: today, max: addDays(today, daysAhead) };
}

/** Seva date as printed: '2027-08-28' -> 'Sat 28 Aug 2027'. */
export function formatSevaDate(date: string): string {
  const { y, m, d } = parseDate(date);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** The moment after which a receptionist can no longer cancel their own receipt. */
export function cancelDeadline(issuedAtIso: string, windowMinutes: number): Date {
  return new Date(new Date(issuedAtIso).getTime() + windowMinutes * 60 * 1000);
}
