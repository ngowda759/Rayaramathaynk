/**
 * Format currency in INR.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Normalizes a value that might be a plain string/number/Date,
 * a Firestore Timestamp (has .toDate()), or a Timestamp that
 * was flattened to a plain { seconds, nanoseconds } object by
 * Next.js Server Component serialization, into a JS Date.
 */
function toJsDate(value: unknown): Date | null {
  if (!value) return null;

  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof (value as { seconds?: unknown }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    value instanceof Date
  ) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Format a date. Accepts a string, Date, or Firestore Timestamp
 * (real or serialized).
 */
export function formatDate(
  value: string | Date | { toDate: () => Date } | { seconds: number } | null | undefined
): string {
  const d = toJsDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date and time. Accepts a string, Date, or Firestore
 * Timestamp (real or serialized).
 */
export function formatDateTime(
  value: string | Date | { toDate: () => Date } | { seconds: number } | null | undefined
): string {
  const d = toJsDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/**
 * Format boolean values.
 */
export function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

/**
 * Format numbers with commas.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}
