
export function formatEventDate(date?: Date) {
  if (!date) return "-";

  return date
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
}
