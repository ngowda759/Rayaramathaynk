/**
 * The Export page's data side (DESIGN-BOOK 12.6, C-41): pages each export part out of `GET /api/seva/reports/export`
 * until `nextCursor` is null, then shapes what the file builders and the board print summary need. Pure TypeScript
 * apart from the API calls it is handed; no React and no browser APIs, so it runs in unit tests.
 *
 * Money stays in integer paise until it is written as text; dates are ISO `YYYY-MM-DD` (IST business dates).
 */
import { buildCsv, lineCsv } from "@/lib/seva/export/csv";
import { paiseToRupees, toDayMonthYear } from "@/lib/seva/export/columns";
import type { ZipEntry } from "@/lib/seva/export/zip";
import { formatRupees } from "@/lib/seva/money";
import { EXPORT_PARTS, type ExportPart } from "@/lib/seva/schemas";
import { addDays, businessDate } from "@/lib/seva/time";
import type {
  ExportData,
  ExportLineRow,
  ExportOptions,
  ExportRateChangeRow,
  ExportReceiptRow,
  ExportSevaRow,
  SheetCell,
} from "@/types/seva-export";
import type { NeedsAttentionId } from "@/types/seva-reports";
import type { AuditEntry, AuditType } from "@/lib/seva/server/reports";

// ---------------------------------------------------------------------------------------------------------------
// Paging the API
// ---------------------------------------------------------------------------------------------------------------

export interface ExportPageAnswer {
  rows: unknown[];
  nextCursor: string | null;
}

/** The one call of `reportsApi()` this module needs (structural, so tests can hand in a fake). */
export interface ExportApi {
  export(p: { part: ExportPart; from: string; to: string; cursor?: string; includePhones: boolean }): Promise<ExportPageAnswer>;
}

export interface CollectParams {
  from: string;
  to: string;
  parts: string[];
  includePhones: boolean;
}

/** A safety stop far above any real range (1000 rows a page): a server that never ends paging is an error, not a hang. */
const MAX_PAGES = 2000;

function isExportPart(value: string): value is ExportPart {
  return (EXPORT_PARTS as readonly string[]).includes(value);
}

async function allRows(api: ExportApi, part: ExportPart, p: CollectParams): Promise<unknown[]> {
  const rows: unknown[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const answer = await api.export({ part, from: p.from, to: p.to, cursor, includePhones: p.includePhones });
    rows.push(...answer.rows);
    if (answer.nextCursor === null) return rows;
    if (seen.has(answer.nextCursor)) throw new Error("export_paging");
    seen.add(answer.nextCursor);
    cursor = answer.nextCursor;
  }
  throw new Error("export_paging");
}

/**
 * Reads every page of each asked part (parts one after the other, so the server sees one request at a time) and
 * returns an `ExportData`. The caller fills in `range.label`, `preparedBy` and `preparedAt` for the file it builds.
 * Throws Error('unknown_part') for a part the API does not have, Error('export_paging') when paging never ends.
 */
export async function collectExportData(p: CollectParams, api: ExportApi): Promise<ExportData> {
  const parts: ExportPart[] = [];
  for (const part of p.parts) {
    if (!isExportPart(part)) throw new Error("unknown_part");
    if (!parts.includes(part)) parts.push(part);
  }

  const data: ExportData = {
    range: { from: p.from, to: p.to, label: "" },
    preparedBy: "",
    preparedAt: new Date().toISOString(),
    summary: [],
    receipts: [],
    lines: [],
    sevas: [],
    cancelledChanged: [],
    dayCloses: [],
    prasadam: [],
    rateChanges: [],
  };

  for (const part of parts) {
    const rows = await allRows(api, part, p);
    switch (part) {
      case "receipts":
        data.receipts = rows as ExportReceiptRow[];
        data.summary = summaryItems(data.receipts);
        break;
      case "lines":
        data.lines = rows as ExportLineRow[];
        break;
      case "sevas":
        data.sevas = rows as ExportSevaRow[];
        break;
      case "cancelled":
        data.cancelledChanged = rows as ExportReceiptRow[];
        break;
      case "dayCloses":
        data.dayCloses = rows as Record<string, string | number>[];
        break;
      case "prasadam":
        data.prasadam = rows as Record<string, string | number>[];
        break;
      case "rateChanges":
        data.rateChanges = rows as ExportRateChangeRow[];
        break;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------------------------------------------

export interface RangeTotals {
  totalPaise: number;
  issued: number;
  cashPaise: number;
  upiPaise: number;
  onlinePaise: number;
  cancelled: number;
  changed: number;
}

/** DB 12.1 metric rules: issued receipts only; a cancelled receipt counts in "Cancelled", never in money. */
export function rangeTotals(receipts: ExportReceiptRow[]): RangeTotals {
  const t: RangeTotals = { totalPaise: 0, issued: 0, cashPaise: 0, upiPaise: 0, onlinePaise: 0, cancelled: 0, changed: 0 };
  for (const r of receipts) {
    if (r.status === "cancelled") {
      t.cancelled += 1;
      continue;
    }
    t.issued += 1;
    t.totalPaise += r.amountPaise;
    if (r.mode === "cash") t.cashPaise += r.amountPaise;
    else if (r.mode === "upi") t.upiPaise += r.amountPaise;
    else t.onlinePaise += r.amountPaise;
    if (r.changed) t.changed += 1;
  }
  return t;
}

/** The Summary sheet's lines (English labels; the sheet is for the accountant). */
export function summaryItems(receipts: ExportReceiptRow[]): { label: string; value: string }[] {
  const t = rangeTotals(receipts);
  return [
    { label: "Total collected", value: formatRupees(t.totalPaise) },
    { label: "Receipts issued", value: String(t.issued) },
    { label: "Cash", value: formatRupees(t.cashPaise) },
    { label: "UPI", value: formatRupees(t.upiPaise) },
    { label: "Online", value: formatRupees(t.onlinePaise) },
    { label: "Cancelled", value: String(t.cancelled) },
    { label: "Changed amounts", value: String(t.changed) },
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// The form's choices
// ---------------------------------------------------------------------------------------------------------------

export type ExportFormat = "xlsx" | "csv" | "tally" | "print";

/** What the person ticks under "What is included" (Summary is built from the receipts). */
export const EXPORT_TICKS = ["summary", "receipts", "sevas", "cancelled", "dayCloses", "prasadam", "rateChanges"] as const;
export type ExportTick = (typeof EXPORT_TICKS)[number];

export type QuickRange = "today" | "month" | "lastMonth" | "year" | "lastYear";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * The quick ranges in IST: Today, This month (1st to today), Last month (whole), This year (1 January to today), Last
 * year (whole).
 */
export function quickRange(kind: QuickRange, now: Date): { from: string; to: string } {
  const today = businessDate(now);
  const [y, m] = today.split("-").map(Number);
  switch (kind) {
    case "today":
      return { from: today, to: today };
    case "month":
      return { from: `${y}-${pad2(m)}-01`, to: today };
    case "lastMonth": {
      const firstOfThis = `${y}-${pad2(m)}-01`;
      const last = addDays(firstOfThis, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    }
    case "year":
      return { from: `${y}-01-01`, to: today };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
}

/** The API parts a format needs for the ticked items, in a fixed order, each once. */
export function partsFor(format: ExportFormat, ticks: readonly ExportTick[]): ExportPart[] {
  if (format === "tally") return ["receipts"];
  const out: ExportPart[] = [];
  const add = (part: ExportPart): void => {
    if (!out.includes(part)) out.push(part);
  };
  for (const tick of EXPORT_TICKS) {
    if (!ticks.includes(tick)) continue;
    if (tick === "summary") add("receipts");
    else if (tick === "receipts") add(format === "csv" ? "lines" : "receipts");
    else add(tick);
  }
  return out;
}

/** Leaves out of the data what was fetched only to work out another part (receipts fetched for the Summary). */
export function forTicks(data: ExportData, ticks: readonly ExportTick[]): ExportData {
  return {
    ...data,
    summary: ticks.includes("summary") ? data.summary : [],
    receipts: ticks.includes("receipts") ? data.receipts : [],
  };
}

export function exportFileName(format: Exclude<ExportFormat, "print">, from: string, to: string): string {
  const span = `${from}-to-${to}`;
  if (format === "xlsx") return `seva-export-${span}.xlsx`;
  if (format === "csv") return `seva-export-${span}.zip`;
  return `tally-receipts-${span}.csv`;
}

// ---------------------------------------------------------------------------------------------------------------
// CSV files (each ticked part one file, zipped by the caller)
// ---------------------------------------------------------------------------------------------------------------

const CSV_NAMES: Record<ExportTick, string> = {
  summary: "summary",
  receipts: "receipts",
  sevas: "sevas",
  cancelled: "cancelled-and-changed",
  dayCloses: "day-closes",
  prasadam: "prasadam",
  rateChanges: "rate-changes",
};

const rupeeText = (paise: number | null): SheetCell => (paise === null ? "" : paiseToRupees(paise).toFixed(2));

function recordCsv(records: Record<string, string | number>[]): string {
  const header: string[] = [];
  for (const record of records) for (const key of Object.keys(record)) if (!header.includes(key)) header.push(key);
  return buildCsv(header, records.map((record) => header.map((key) => record[key] ?? "")));
}

function csvFor(tick: ExportTick, data: ExportData, opts: ExportOptions): string {
  switch (tick) {
    case "summary":
      return buildCsv(
        ["Item", "Value"],
        [
          ["Range", `${toDayMonthYear(data.range.from)} to ${toDayMonthYear(data.range.to)}`],
          ["Prepared by", data.preparedBy],
          ["Prepared at", data.preparedAt],
          ...data.summary.map((s): SheetCell[] => [s.label, s.value]),
        ],
      );
    case "receipts":
      return lineCsv(data.lines, opts);
    case "sevas":
      return buildCsv(
        ["seva", "count", "amount", "last_year_count", "last_year_amount"],
        data.sevas.map((s) => [s.name, s.count, rupeeText(s.amountPaise), s.lastYearCount ?? "", rupeeText(s.lastYearAmountPaise)]),
      );
    case "cancelled": {
      const header = ["receipt_no", "date", "devotee", "sevas", "amount", "mode", "status", "changed", "reason", "issued_by"];
      if (opts.includePhones) header.push("phone");
      return buildCsv(
        header,
        data.cancelledChanged.map((r) => {
          const cells: SheetCell[] = [
            r.receiptNo,
            toDayMonthYear(r.date),
            r.devoteeName,
            r.sevas,
            rupeeText(r.amountPaise),
            r.mode,
            r.status,
            r.changed ? "yes" : "no",
            r.cancelReason,
            r.issuedBy,
          ];
          if (opts.includePhones) cells.push(r.phone ?? "");
          return cells;
        }),
      );
    }
    case "dayCloses":
      return recordCsv(data.dayCloses);
    case "prasadam":
      return recordCsv(data.prasadam);
    case "rateChanges":
      return buildCsv(
        ["seva", "old_rate", "new_rate", "reason", "changed_by", "changed_at"],
        data.rateChanges.map((c) => [c.seva, rupeeText(c.oldPaise), rupeeText(c.newPaise), c.reason, c.by, c.at]),
      );
  }
}

/** One CSV per ticked item, in the fixed order; the Receipts file has one row per seva line (DB 12.6). */
export function csvFiles(data: ExportData, ticks: readonly ExportTick[], opts: ExportOptions): ZipEntry[] {
  const span = `${data.range.from}-to-${data.range.to}`;
  return EXPORT_TICKS.filter((tick) => ticks.includes(tick)).map((tick) => ({
    name: `${CSV_NAMES[tick]}-${span}.csv`,
    content: csvFor(tick, data, opts),
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Board print summary
// ---------------------------------------------------------------------------------------------------------------

export interface CollectionsChartData {
  buckets: { key: string; label: string; cashPaise: number; upiPaise: number; onlinePaise: number }[];
  prev: { key: string; totalPaise: number }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day buckets up to this many days; months beyond it. */
const MAX_DAY_BUCKETS = 62;

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function monthNumber(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Days in the range, both ends included. */
export function rangeDays(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from) + 1;
}

/** The same calendar date one year earlier (29 February becomes 28 February). */
function yearEarlier(date: string): string {
  const y = Number(date.slice(0, 4)) - 1;
  const md = date.slice(5);
  return md === "02-29" ? `${y}-02-28` : `${y}-${md}`;
}

/**
 * The board summary's "previous period". Up to 62 days (the chart is by day) it is the span of the same length just
 * before the range. A longer range is charted by month, so the previous period is the same dates one year earlier:
 * month buckets then line up with the same months (January 2026 against January 2025), never with a half month.
 */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = rangeDays(from, to);
  if (days > MAX_DAY_BUCKETS) return { from: yearEarlier(from), to: yearEarlier(to) };
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

/**
 * The Collections chart for a range (`heroOption` input): issued receipts by business date, stacked by mode; by day up
 * to 62 days, else by month. The previous span is laid onto the same positions (its first day or month on the
 * range's first) for the ghost line; null leaves it out.
 */
export function collectionsChart(
  receipts: ExportReceiptRow[],
  prevReceipts: ExportReceiptRow[],
  range: { from: string; to: string },
  prevRange: { from: string; to: string } | null,
): CollectionsChartData {
  const byDay = rangeDays(range.from, range.to) <= MAX_DAY_BUCKETS;
  const position = (date: string, start: string): number =>
    byDay ? dayNumber(date) - dayNumber(start) : monthNumber(date) - monthNumber(start);
  const count = position(range.to, range.from) + 1;

  const buckets: CollectionsChartData["buckets"] = [];
  for (let i = 0; i < count; i += 1) {
    let label: string;
    if (byDay) {
      const date = addDays(range.from, i);
      label = `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
    } else {
      const month = monthNumber(range.from) + i;
      label = `${MONTHS[month % 12]} ${Math.floor(month / 12)}`;
    }
    buckets.push({ key: `${byDay ? "d" : "m"}${i}`, label, cashPaise: 0, upiPaise: 0, onlinePaise: 0 });
  }

  for (const r of receipts) {
    if (r.status !== "issued") continue;
    const bucket = buckets[position(r.date, range.from)];
    if (!bucket) continue;
    if (r.mode === "cash") bucket.cashPaise += r.amountPaise;
    else if (r.mode === "upi") bucket.upiPaise += r.amountPaise;
    else bucket.onlinePaise += r.amountPaise;
  }

  if (!prevRange) return { buckets, prev: [] };
  const prevTotals = buckets.map(() => 0);
  for (const r of prevReceipts) {
    if (r.status !== "issued") continue;
    const i = position(r.date, prevRange.from);
    if (i >= 0 && i < prevTotals.length) prevTotals[i] += r.amountPaise;
  }
  return { buckets, prev: buckets.map((b, i) => ({ key: b.key, totalPaise: prevTotals[i] })) };
}

/** What the board summary shows, for its `export.download` audit row (format 'print'). */
export const BOARD_AUDIT_PARTS: ExportPart[] = ["receipts", "sevas", "cancelled", "dayCloses", "rateChanges"];

/** Parts the board summary pages out of the export API (sevas, day closes and rate changes come from the reports). */
export const BOARD_EXPORT_PARTS: ExportPart[] = ["receipts", "cancelled"];

export type BoardAttentionId = Extract<
  NeedsAttentionId,
  "changed_amounts" | "cancellations" | "day_close_difference" | "number_gaps" | "prasadam_pending"
>;

export interface BoardAttentionItem {
  id: BoardAttentionId;
  level: "ok" | "attention" | "critical";
  count: number;
}

/**
 * Needs-attention lines for the board (DB 12.2, counted over the chosen range): changed amounts, cancellations,
 * day closes with a difference, open number gaps and prasadam still pending. A line with nothing to report is "ok".
 */
export function boardAttention(input: {
  receipts: ExportReceiptRow[];
  dayCloseDifferences: number;
  openGaps: number;
}): BoardAttentionItem[] {
  const issued = input.receipts.filter((r) => r.status === "issued");
  const item = (id: BoardAttentionId, count: number, level: "attention" | "critical"): BoardAttentionItem => ({
    id,
    count,
    level: count > 0 ? level : "ok",
  });
  return [
    item("day_close_difference", input.dayCloseDifferences, "critical"),
    item("number_gaps", input.openGaps, "critical"),
    item("changed_amounts", issued.filter((r) => r.changed).length, "attention"),
    item("cancellations", input.receipts.length - issued.length, "attention"),
    item("prasadam_pending", issued.filter((r) => r.prasadam === "pending").length, "attention"),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Change reasons for the board summary
// ---------------------------------------------------------------------------------------------------------------

/** The audit call of `reportsApi()` the board summary needs (structural, so tests can hand in a fake). */
export interface AuditApi {
  audit(f: { type?: AuditType; from?: string; to?: string; cursor?: string }): Promise<{
    rows: Pick<AuditEntry, "receiptNo" | "reason" | "after">[];
    nextCursor: string | null;
  }>;
}

/**
 * Days after the range's end still searched for a changed amount's audit row: an offline receipt is audited when the
 * counter syncs, which can be after its business date.
 */
const CHANGE_REASON_SYNC_DAYS = 7;

/**
 * The reasons for changed amounts, by receipt number, from the `receipt.amount_changed` audit rows (one per changed
 * line, DB 9.4), paged until `nextCursor` is null. Rows that only note an offline rate differing from today's
 * catalogue (C-58, `after.offline_rate`) do not mark a receipt as changed and are left out. Each reason is kept once
 * per receipt, in line order. Throws Error('export_paging') when paging never ends.
 */
export async function collectChangeReasons(
  api: AuditApi,
  range: { from: string; to: string },
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  const seen = new Set<string>();
  const to = addDays(range.to, CHANGE_REASON_SYNC_DAYS);
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const answer = await api.audit({ type: "changed_amounts", from: range.from, to, cursor });
    // The server sends newest first; each page is read oldest first so a receipt's lines keep their order.
    for (const row of [...answer.rows].reverse()) {
      if (!row.receiptNo) continue;
      if (row.after && Object.prototype.hasOwnProperty.call(row.after, "offline_rate")) continue;
      const reason = row.reason?.trim();
      if (!reason) continue;
      const list = (out[row.receiptNo] ??= []);
      if (!list.includes(reason)) list.push(reason);
    }
    if (answer.nextCursor === null) return out;
    if (seen.has(answer.nextCursor)) throw new Error("export_paging");
    seen.add(answer.nextCursor);
    cursor = answer.nextCursor;
  }
  throw new Error("export_paging");
}

/**
 * The reason shown for a cancelled or changed receipt on the board summary: the cancel reason, the change reasons
 * (joined), or both. Null when none was recorded, so the page says so instead of showing anything else.
 */
export function boardReason(
  row: Pick<ExportReceiptRow, "receiptNo" | "status" | "changed" | "cancelReason">,
  changeReasons: Record<string, string[]>,
): string | null {
  const parts: string[] = [];
  if (row.status === "cancelled" && row.cancelReason.trim()) parts.push(row.cancelReason.trim());
  if (row.changed) parts.push(...(changeReasons[row.receiptNo] ?? []));
  return parts.length > 0 ? parts.join("; ") : null;
}
