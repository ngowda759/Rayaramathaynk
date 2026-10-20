/**
 * Receipt and group numbers (Design Book 8.1).
 * Counter:  C1-023-10-2026/000124   Offline: OF1-023-10-2026/000007
 * Online:   W-WEB-10-2026/000045    Test:    WT-APP-10-2026/000001
 */

import { isQrToken } from "./qr";

export interface ReceiptNoParts {
  series: string;
  staffNo: number | null;
  channel: "WEB" | "APP" | null;
  month: number;
  year: number;
  running: number;
}

export type LookupQuery =
  | { kind: "token"; token: string }
  | { kind: "number"; receiptNo: string }
  | { kind: "short"; series: string | null; running: number; year: number }
  | { kind: "invalid" };

const COUNTER_PATTERN = /^((?:C|OF)[0-9]{1,2})-([0-9]{3})-([0-9]{2})-([0-9]{4})\/([0-9]{6})$/;
const ONLINE_PATTERN = /^(W|WT)-(WEB|APP)-([0-9]{2})-([0-9]{4})\/([0-9]{6})$/;
const URL_TOKEN_PATTERN = /\/r\/([A-Za-z0-9_-]{22})\/?$/;
const SHORT_PATTERN = /^(?:((?:C|OF)[0-9]{1,2}|W|WT)\s*[\s/]\s*)?([0-9]{1,6})$/;

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

/** Formats the parts of a receipt number. A channel ('WEB' or 'APP') selects the online form. */
export function formatReceiptNo(p: ReceiptNoParts): string {
  const tail = `${pad(p.month, 2)}-${pad(p.year, 4)}/${pad(p.running, 6)}`;
  if (p.channel !== null) {
    return `${p.series}-${p.channel}-${tail}`;
  }
  return `${p.series}-${pad(p.staffNo ?? 0, 3)}-${tail}`;
}

/** Parses a receipt number after trim and upper-case; null when it does not match the 8.1 formats. */
export function parseReceiptNo(s: string): ReceiptNoParts | null {
  const text = s.trim().toUpperCase();
  const counter = COUNTER_PATTERN.exec(text);
  if (counter) {
    return {
      series: counter[1],
      staffNo: Number(counter[2]),
      channel: null,
      month: Number(counter[3]),
      year: Number(counter[4]),
      running: Number(counter[5]),
    };
  }
  const online = ONLINE_PATTERN.exec(text);
  if (online) {
    return {
      series: online[1],
      staffNo: null,
      channel: online[2] === "WEB" ? "WEB" : "APP",
      month: Number(online[3]),
      year: Number(online[4]),
      running: Number(online[5]),
    };
  }
  return null;
}

/**
 * Reads what the prasadam counter typed or scanned (Design Book 10.3, 11; C-51): the QR URL, the bare token,
 * a full receipt number, or a short form 'C1 124', 'C1/124', '124' for the given year.
 */
export function parseLookupInput(raw: string, opts: { year: number }): LookupQuery {
  const text = raw.trim();
  if (text === "") return { kind: "invalid" };

  const urlToken = URL_TOKEN_PATTERN.exec(text);
  if (urlToken) return { kind: "token", token: urlToken[1] };

  const parts = parseReceiptNo(text);
  if (parts) return { kind: "number", receiptNo: formatReceiptNo(parts) };

  if (isQrToken(text)) return { kind: "token", token: text };

  const short = SHORT_PATTERN.exec(text.toUpperCase());
  if (short) {
    const running = Number(short[2]);
    if (running > 0) {
      return { kind: "short", series: short[1] ?? null, running, year: opts.year };
    }
  }
  return { kind: "invalid" };
}

/** Online group number: 'G-2610-0042'. */
export function formatGroupNo(p: { yymm: string; n: number }): string {
  return `G-${p.yymm}-${pad(p.n, 4)}`;
}

/** Offline group number, unique per OF series (C-19): 'G-2610-OF1-007'. */
export function formatOfflineGroupNo(p: { yymm: string; series: string; n: number }): string {
  return `G-${p.yymm}-${p.series}-${pad(p.n, 3)}`;
}
