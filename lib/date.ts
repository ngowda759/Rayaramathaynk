// This utility handles both Firebase Timestamp and ISO date strings
// for backward compatibility

export function formatEventDate(date?: string | Date | null) {
  if (!date) return "-";

  let d: Date;

  // Handle Firebase Timestamp-like objects
  if (typeof date === "object" && "toDate" in date && typeof date.toDate === "function") {
    d = (date as any).toDate();
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === "string") {
    d = new Date(date);
  } else {
    return "-";
  }

  if (isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
