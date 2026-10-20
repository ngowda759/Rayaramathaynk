/**
 * Small pure helpers for the seva dashboard (DB §12.1): the change against the previous period and the "as of" clock.
 * Kept apart from the chart code so the page does not pull in ECharts to format a number.
 */
import { istParts } from "@/lib/seva/time";

/**
 * (now - prev) / prev as '+12%', '-5%' or '0%'; 'no data' when there is no previous figure or it was zero
 * (DB §12.1 metric "Change"; the first year has no previous-year data, section 5.1 item 12).
 */
export function changeLabel(now: number, prev: number | null | undefined): string {
  if (prev === null || prev === undefined || !Number.isFinite(prev) || prev <= 0) return "no data";
  const change = Math.round(((now - prev) / prev) * 100);
  if (change > 0) return `+${change}%`;
  if (change < 0) return `${change}%`;
  return "0%";
}

/** The direction of a change label, for its colour and arrow. */
export function changeTrend(label: string): "up" | "down" | "level" | "none" {
  if (label === "no data") return "none";
  if (label.startsWith("+")) return "up";
  if (label.startsWith("-")) return "down";
  return "level";
}

/** An ISO time as 'HH:MM' in IST (the "as of 18:05" note); the text itself when it is not a date. */
export function asOfClock(asOf: string): string {
  if (/^\d{1,2}:\d{2}$/.test(asOf.trim())) return asOf.trim();
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return asOf;
  const p = istParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
