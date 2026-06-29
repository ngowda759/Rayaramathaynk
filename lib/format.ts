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
 * Format a date.
 */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Format a date and time.
 */
export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
