export const DEFAULT_RECEIPT_PREFIX = "RM";
export const DEFAULT_STARTING_SEQUENCE = 1;

/**
 * Format a sequential receipt number, e.g. RM-2026-000001.
 * The full number is only ever assembled server-side deward of the transaction.
 */
export function formatReceiptNumber(
  prefix: string,
  year: string | number,
  sequence: number
): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Parse the year out of an already-issued receipt number.
 * Returns null if the format does not match.
 */
export function parseReceiptYear(receiptNumber: string): string | null {
  const match = /^[A-Z0-9]+-(\d{4})-\d{6}$/.exec(receiptNumber);
  return match ? match[1] : null;
}

/**
 * Compute the next sequence for a given year from the previous counter value.
 * Used by the server-side counter transaction (pure,safe to unit test).
 */
export function nextSequenceForYear(
  currentYear: string,
  previous: { year?: string; lastNumber?: number } | null
): number {
  if (!previous || previous.year !== currentYear) {
    return DEFAULT_STARTING_SEQUENCE;
  }
  return (previous.lastNumber ?? 0) + 1;
}