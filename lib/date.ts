import { Timestamp } from "firebase/firestore";

export function formatEventDate(date?: Timestamp) {
  if (!date) return "-";

  return date
    .toDate()
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
}
