/**
 * Reports repository (DB §12): dashboard and needs attention, number continuity, seva summary, festival view, audit
 * trail, day-close list, paged export data and the export audit row.
 *
 * Aggregates come from the A2-3 SQL functions; the register, audit, day-close and export reads use the service-role
 * query builder and are read-only. The only write here is the `export.download` audit row, through `seva_audit`.
 * SQL answers carry money as rupee strings; everything leaving this module is integer paise. Test-mode receipts never
 * reach a report or an export (C-18), and the devotee phone is read only for an export that asked for it with the
 * `export.with_phones` right (C-16).
 */

import "server-only";
import { z } from "zod";
import { NAKSHATRAS } from "@/lib/seva/domain/nakshatras";
import { findOption } from "@/lib/seva/domain/options";
import { RASHIS } from "@/lib/seva/domain/rashis";
import { SevaError } from "@/lib/seva/errors";
import { paiseToRupees, toDayMonthYear } from "@/lib/seva/export/columns";
import { defaultIncomeLedger } from "@/lib/seva/export/tally";
import { toPaise } from "@/lib/seva/money";
import type { SevaActor } from "@/lib/seva/permissions";
import { EXPORT_PARTS, type ExportAuditRequest, type ExportPart } from "@/lib/seva/schemas";
import { addDays, businessDate, istParts, istStartOfDay, periodRange, type Period } from "@/lib/seva/time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CancelReasonCode, PaymentMode } from "@/types/seva";
import type {
  ExportLineRow,
  ExportPrasadamState,
  ExportRateChangeRow,
  ExportReceiptRow,
  ExportSevaRow,
} from "@/types/seva-export";
import type {
  ContinuityGap,
  ContinuityRow,
  DashboardData,
  DashboardTotals,
  NeedsAttentionCard,
  NeedsAttentionId,
  OfflineCancelEntry,
} from "@/types/seva-reports";
import { callRpc } from "./rpc";

// ---------------------------------------------------------------------------------------------------------------
// Wire types of the report pages that have no shared DTO yet (browser clients import them as types only)
// ---------------------------------------------------------------------------------------------------------------

export interface DashboardAnswer {
  data: DashboardData;
  attention: NeedsAttentionCard[];
}

export interface SevaSummaryReport {
  from: string;
  to: string;
  lastYearFrom: string;
  lastYearTo: string;
  sevas: {
    sevaId: string;
    nameEn: string;
    nameKn: string | null;
    category: string | null;
    receipts: number;
    quantity: number;
    amountPaise: number;
    lastYear: { receipts: number; quantity: number; amountPaise: number };
  }[];
  totals: { receipts: number; amountPaise: number; lastYearReceipts: number; lastYearAmountPaise: number };
  rateChanges: { sevaId: string; nameEn: string; oldPaise: number | null; newPaise: number; changedAt: string; reason: string }[];
}

export interface FestivalReportPart {
  dates: string[];
  receipts: number;
  amountPaise: number;
  prasadamReceipts: number;
  prasadamGiven: number;
  sevas: { sevaId: string; nameEn: string; nameKn: string | null; quantity: number; amountPaise: number }[];
  perDay: { date: string; receipts: number; amountPaise: number }[];
}

export interface FestivalReport {
  festival: { id: string; nameEn: string; nameKn: string | null };
  year: number;
  compareYear: number;
  current: FestivalReportPart;
  compare: FestivalReportPart;
}

export interface AuditEntry {
  id: number;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  receiptNo: string | null;
  reason: string | null;
  by: { staffId: string; name: string | null; staffNo: number | null } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface DayCloseListRow {
  id: string;
  counterId: number;
  counterName: string | null;
  businessDate: string;
  status: "closed" | "reopened";
  receipts: number;
  cancelled: number;
  changed: number;
  cashExpectedPaise: number;
  cashCountedPaise: number;
  cashDifferencePaise: number;
  upiCount: number;
  upiExpectedPaise: number;
  upiBankTotalPaise: number | null;
  upiDifferencePaise: number;
  badge: "balanced" | "short" | "extra";
  note: string | null;
  closedBy: string | null;
  closedAt: string;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  counts: { kind: "note" | "coin"; valuePaise: number; count: number; amountPaise: number }[];
}

export interface ExportPage {
  rows: unknown[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const isoDateParam = z.string().refine(isRealDate, "Use a date like 2026-10-20");

/** The first issue becomes SevaError('validation') whose detail names the field and carries the plain message. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue && issue.path.length > 0 ? issue.path.map(String).join(".") : "query";
  throw new SevaError("validation", { field, message: issue?.message ?? "Check the details and try again." });
}

/** The query string as a plain object; a key that is not in the URL is left out (so `.optional()` applies). */
export function queryOf(req: { nextUrl: URL }): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

/** The JSON body of a request; a body that is not JSON is a validation error. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    throw new SevaError("validation", { field: "body", message: "The request body is not valid JSON." });
  }
}

const rangeShape = { from: isoDateParam, to: isoDateParam };
const rangeOrder = { path: ["to"], message: "The end date is before the start date" };

export const rangeQuerySchema = z.object(rangeShape).refine((q) => q.from <= q.to, rangeOrder);

export const dashboardQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "year"]).default("today"),
});

export const festivalQuerySchema = z.object({
  festivalId: z.guid(),
  compareYear: z.coerce.number().int().min(2000).max(2100),
});

export const AUDIT_TYPES = {
  rate_changes: ["seva.rate_change"],
  cancellations: ["receipt.cancel", "receipt.reissue_spoiled", "receipt.superseded"],
  changed_amounts: ["receipt.amount_changed"],
  day_closes: ["dayclose.close", "dayclose.reopen"],
  staff: [
    "staff.onboard",
    "staff.role_change",
    "staff.view_only_change",
    "staff.deactivate",
    "staff.reactivate",
    "staff.delete",
  ],
  settings: [
    "seva.create",
    "seva.update",
    "settings.update",
    "denominations.update",
    "festival.update",
    "settings.list_item",
    "device.register",
    "device.replace",
    "gap.resolve",
    "settings.upi_changed",
  ],
  prasadam: ["prasadam.given_off_date", "prasadam.undo", "prasadam.reversed"],
  exports: ["export.download", "export.phones_read"],
} as const satisfies Record<string, readonly string[]>;

export type AuditType = keyof typeof AUDIT_TYPES;

export const auditQuerySchema = z
  .object({
    type: z.enum(Object.keys(AUDIT_TYPES) as [AuditType, ...AuditType[]]).optional(),
    staffId: z.guid().optional(),
    from: isoDateParam.optional(),
    to: isoDateParam.optional(),
    cursor: z.string().regex(/^\d{1,18}$/, "Use the cursor from the previous page").optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, rangeOrder);

export const exportQuerySchema = z
  .object({
    ...rangeShape,
    part: z.enum(EXPORT_PARTS),
    cursor: z.string().regex(/^\d{1,7}$/, "Use the cursor from the previous page").optional(),
    includePhones: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
  })
  .refine((q) => q.from <= q.to, rangeOrder);

export type ExportQuery = z.output<typeof exportQuerySchema>;

// ---------------------------------------------------------------------------------------------------------------
// Value readers (a malformed database answer is an internal error, never a guess)
// ---------------------------------------------------------------------------------------------------------------

type Row = Record<string, unknown>;

function rec(value: unknown): Row {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new SevaError("internal");
  return value as Row;
}

function recOrNull(value: unknown): Row | null {
  if (Array.isArray(value)) return value.length > 0 ? rec(value[0]) : null;
  return value === null || value === undefined ? null : rec(value);
}

function rows(value: unknown): Row[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new SevaError("internal");
  return value.map(rec);
}

function int(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  throw new SevaError("internal");
}

function intOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : int(value);
}

/** Rupees (string or number, possibly negative) to paise. */
function paise(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new SevaError("internal");
  const text = String(value).trim();
  const negative = text.startsWith("-");
  try {
    const amount = toPaise(negative ? text.slice(1) : text);
    return negative ? -amount : amount;
  } catch {
    throw new SevaError("internal");
  }
}

function paiseOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : paise(value);
}

function str(value: unknown): string {
  if (typeof value !== "string") throw new SevaError("internal");
  return value;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** A timestamp from Postgres ('2026-10-21T06:30:00+00:00') as an ISO-8601 UTC string. */
function iso(value: unknown): string {
  const date = new Date(str(value));
  if (Number.isNaN(date.getTime())) throw new SevaError("internal");
  return date.toISOString();
}

function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

/** 'HH:MM' in IST. */
function istTime(isoText: string): string {
  const p = istParts(new Date(isoText));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function dbFailed(error: unknown): void {
  if (error) throw new SevaError("internal");
}

/** [00:00 IST of `from`, 00:00 IST of the day after `to`) as ISO strings. */
function dayBounds(from: string, to: string): { start: string; end: string } {
  return { start: istStartOfDay(from).toISOString(), end: istStartOfDay(addDays(to, 1)).toISOString() };
}

// ---------------------------------------------------------------------------------------------------------------
// Dashboard and needs attention (DB 12.1, 12.2)
// ---------------------------------------------------------------------------------------------------------------

function totals(raw: unknown): DashboardTotals {
  const t = rec(raw);
  return {
    totalPaise: paise(t.total),
    receipts: int(t.receipts),
    cashPaise: paise(t.cash),
    upiPaise: paise(t.upi),
    onlinePaise: paise(t.online),
  };
}

export function fromSqlDashboard(raw: unknown, period: Period): DashboardData {
  const d = rec(raw);
  const tiles = rec(d.tiles);
  const hero = rec(d.hero);
  const mode = rec(d.mode);
  return {
    period,
    asOf: iso(d.as_of),
    tiles: { ...totals(tiles), prev: tiles.prev === null || tiles.prev === undefined ? null : totals(tiles.prev) },
    hero: {
      buckets: rows(hero.buckets).map((b) => ({
        key: str(b.key),
        label: str(b.label),
        cashPaise: paise(b.cash),
        upiPaise: paise(b.upi),
        onlinePaise: paise(b.online),
      })),
      prev: rows(hero.prev).map((p) => ({ key: str(p.key), totalPaise: paise(p.total) })),
    },
    topSevas: rows(d.top_sevas).map((s) => ({
      sevaId: str(s.seva_id),
      nameEn: str(s.name_en),
      nameKn: strOrNull(s.name_kn),
      amountPaise: paise(s.amount),
      quantity: int(s.quantity),
      prevAmountPaise: paise(s.prev_amount),
    })),
    mode: { cashPaise: paise(mode.cash), upiPaise: paise(mode.upi), onlinePaise: paise(mode.online) },
    rush: rows(d.rush).map((r) => ({ dow: int(r.dow), hour: int(r.hour), count: int(r.count) })),
    calendar: rows(d.calendar).map((c) => ({ date: str(c.date), totalPaise: paise(c.total) })),
    festivalDates: (Array.isArray(d.festival_dates) ? d.festival_dates : []).map(str),
  };
}

const NEEDS_ATTENTION_IDS: ReadonlySet<string> = new Set<NeedsAttentionId>([
  "changed_amounts",
  "cancellations",
  "day_close_difference",
  "day_not_closed",
  "waiting_to_sync",
  "number_gaps",
  "prasadam_pending",
  "upi_refunds_due",
  "clock_skew",
  "backup",
  "database_size",
  "in_doubt_duplicates",
  "future_offline",
  "offline_cancels",
  "upi_changed",
  "synced_into_closed_day",
]);

/** One entry of the offline_cancels card; the times pass through as the SQL wrote them. */
function offlineCancelEntry(value: unknown): OfflineCancelEntry {
  const e = rec(value);
  if (typeof e.flagged !== "boolean") throw new SevaError("internal");
  return {
    receiptNo: str(e.receipt_no),
    recordedAt: str(e.recorded_at),
    receivedAt: str(e.received_at),
    cancelledBy: str(e.cancelled_by),
    syncedBy: str(e.synced_by),
    flagged: e.flagged,
  };
}

/** Cards as the SQL gives them; a money detail ('amount', rupees) goes out as 'amountPaise'. */
export function fromSqlAttention(raw: unknown): NeedsAttentionCard[] {
  return rows(raw).map((card) => {
    const id = str(card.id);
    const level = str(card.level);
    if (!NEEDS_ATTENTION_IDS.has(id) || (level !== "ok" && level !== "attention" && level !== "critical")) {
      throw new SevaError("internal");
    }
    const detail: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(recOrNull(card.detail) ?? {})) {
      if (key === "amount") detail.amountPaise = paise(value);
      else if (typeof value === "string" || typeof value === "number") detail[key] = value;
    }
    const out: NeedsAttentionCard = { id: id as NeedsAttentionId, level, count: int(card.count), detail };
    if (card.entries !== undefined && card.entries !== null) out.entries = rows(card.entries).map(offlineCancelEntry);
    return out;
  });
}

export async function loadDashboard(period: Period, now: Date): Promise<DashboardAnswer> {
  const range = periodRange(period, now);
  const span = { p_from: range.from.toISOString(), p_to: range.to.toISOString() };
  const [dashboard, attention] = await Promise.all([
    callRpc<unknown>("seva_dashboard", {
      ...span,
      p_prev_from: range.prevFrom.toISOString(),
      p_prev_to: range.prevTo.toISOString(),
      p_bucket: range.bucket,
    }),
    callRpc<unknown>("seva_needs_attention", { ...span, p_today: businessDate(now) }),
  ]);
  return { data: fromSqlDashboard(dashboard, period), attention: fromSqlAttention(attention) };
}

// ---------------------------------------------------------------------------------------------------------------
// Number continuity (DB 12.3)
// ---------------------------------------------------------------------------------------------------------------

export async function loadContinuity(from: string, to: string): Promise<ContinuityRow[]> {
  const raw = rows(await callRpc<unknown>("seva_continuity", { p_from: from, p_to: to }));
  if (raw.length === 0) return [];
  const parsed = raw.map((r) => ({
    series: str(r.series_code),
    year: int(r.year),
    first: intOrNull(r.first_no),
    last: intOrNull(r.last_no),
    issued: int(r.issued),
    cancelled: int(r.cancelled),
    openGaps: int(r.open_gaps),
  }));
  const codes = [...new Set(parsed.map((p) => p.series))];
  const numbers = [...new Set(parsed.flatMap((p) => [p.first, p.last]).filter((n): n is number => n !== null))];

  const client = createAdminClient();
  const [seriesRead, receiptRead] = await Promise.all([
    client.from("receipt_series").select("code, counters(name)").in("code", codes),
    numbers.length > 0
      ? client
          .from("seva_receipts")
          .select("series_code, year, running_no, receipt_no")
          .in("series_code", codes)
          .in("running_no", numbers)
      : Promise.resolve({ data: [], error: null }),
  ]);
  dbFailed(seriesRead.error);
  dbFailed(receiptRead.error);

  const counterNames = new Map<string, string | null>();
  for (const s of rows(seriesRead.data)) counterNames.set(str(s.code), strOrNull(recOrNull(s.counters)?.name));
  const receiptNos = new Map<string, string>();
  for (const r of rows(receiptRead.data)) {
    receiptNos.set(`${str(r.series_code)}|${int(r.year)}|${int(r.running_no)}`, str(r.receipt_no));
  }
  const numberOf = (series: string, year: number, no: number | null): string | null =>
    no === null ? null : (receiptNos.get(`${series}|${year}|${no}`) ?? null);

  const gaps = await openGapsOf(parsed.filter((p) => p.openGaps > 0));

  return parsed.map((p) => {
    const row: ContinuityRow = {
      series: p.series,
      year: p.year,
      counterName: counterNames.get(p.series) ?? null,
      firstNo: numberOf(p.series, p.year, p.first),
      lastNo: numberOf(p.series, p.year, p.last),
      numbers: p.first !== null && p.last !== null ? p.last - p.first + 1 : 0,
      issued: p.issued,
      cancelled: p.cancelled,
      openGaps: p.openGaps,
    };
    if (p.openGaps > 0) row.gaps = gaps.filter((g) => g.series === p.series && g.year === p.year);
    return row;
  });
}

/** The open gaps of the given series-years (the register resolves them by id, DB 8.5); no read when there are none. */
async function openGapsOf(seriesYears: { series: string; year: number }[]): Promise<ContinuityGap[]> {
  if (seriesYears.length === 0) return [];
  const codes = [...new Set(seriesYears.map((s) => s.series))];
  const years = [...new Set(seriesYears.map((s) => s.year))];
  const { data, error } = await createAdminClient()
    .from("receipt_number_gaps")
    .select("id, series_code, year, from_no, to_no, cause, detected_at")
    .eq("status", "open")
    .in("series_code", codes)
    .in("year", years)
    .order("series_code", { ascending: true })
    .order("from_no", { ascending: true });
  dbFailed(error);
  const wanted = new Set(seriesYears.map((s) => `${s.series}|${s.year}`));
  return rows(data)
    .map((g): ContinuityGap => {
      const cause = str(g.cause);
      if (cause !== "device_replaced" && cause !== "missing_in_sync") throw new SevaError("internal");
      return {
        id: int(g.id),
        series: str(g.series_code),
        year: int(g.year),
        fromNo: int(g.from_no),
        toNo: int(g.to_no),
        cause,
        detectedAt: iso(g.detected_at),
      };
    })
    .filter((g) => wanted.has(`${g.series}|${g.year}`));
}

// ---------------------------------------------------------------------------------------------------------------
// Seva summary and festival view (DB 12.4)
// ---------------------------------------------------------------------------------------------------------------

export function fromSqlSevaSummary(raw: unknown): SevaSummaryReport {
  const s = rec(raw);
  const t = rec(s.totals);
  return {
    from: str(s.from),
    to: str(s.to),
    lastYearFrom: str(s.last_year_from),
    lastYearTo: str(s.last_year_to),
    sevas: rows(s.sevas).map((v) => {
      const ly = rec(v.last_year);
      return {
        sevaId: str(v.seva_id),
        nameEn: str(v.name_en),
        nameKn: strOrNull(v.name_kn),
        category: strOrNull(v.category),
        receipts: int(v.receipts),
        quantity: int(v.quantity),
        amountPaise: paise(v.amount),
        lastYear: { receipts: int(ly.receipts), quantity: int(ly.quantity), amountPaise: paise(ly.amount) },
      };
    }),
    totals: {
      receipts: int(t.receipts),
      amountPaise: paise(t.amount),
      lastYearReceipts: int(t.last_year_receipts),
      lastYearAmountPaise: paise(t.last_year_amount),
    },
    rateChanges: rows(s.rate_changes).map((r) => ({
      sevaId: str(r.seva_id),
      nameEn: str(r.name_en),
      oldPaise: paiseOrNull(r.old_amount),
      newPaise: paise(r.new_amount),
      changedAt: iso(r.changed_at),
      reason: str(r.reason),
    })),
  };
}

export async function loadSevaSummary(from: string, to: string): Promise<SevaSummaryReport> {
  return fromSqlSevaSummary(await callRpc<unknown>("seva_seva_summary", { p_from: from, p_to: to }));
}

function festivalPart(raw: unknown): FestivalReportPart {
  const p = rec(raw);
  return {
    dates: (Array.isArray(p.dates) ? p.dates : []).map(str),
    receipts: int(p.receipts),
    amountPaise: paise(p.amount),
    prasadamReceipts: int(p.prasadam_receipts),
    prasadamGiven: int(p.prasadam_given),
    sevas: rows(p.sevas).map((s) => ({
      sevaId: str(s.seva_id),
      nameEn: str(s.name_en),
      nameKn: strOrNull(s.name_kn),
      quantity: int(s.quantity),
      amountPaise: paise(s.amount),
    })),
    perDay: rows(p.per_day).map((d) => ({ date: str(d.date), receipts: int(d.receipts), amountPaise: paise(d.amount) })),
  };
}

export async function loadFestivalReport(festivalId: string, compareYear: number): Promise<FestivalReport> {
  const r = rec(await callRpc<unknown>("seva_festival_report", { p_festival_id: festivalId, p_compare_year: compareYear }));
  const f = rec(r.festival);
  return {
    festival: { id: str(f.id), nameEn: str(f.name_en), nameKn: strOrNull(f.name_kn) },
    year: int(r.year),
    compareYear: int(r.compare_year),
    current: festivalPart(r.current),
    compare: festivalPart(r.compare),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Staff names (one read for a page of rows)
// ---------------------------------------------------------------------------------------------------------------

async function staffNames(ids: (string | null)[]): Promise<Map<string, { name: string; staffNo: number }>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  const names = new Map<string, { name: string; staffNo: number }>();
  if (unique.length === 0) return names;
  const { data, error } = await createAdminClient().from("staff").select("id, full_name, staff_no").in("id", unique);
  dbFailed(error);
  for (const s of rows(data)) names.set(str(s.id), { name: str(s.full_name), staffNo: int(s.staff_no) });
  return names;
}

// ---------------------------------------------------------------------------------------------------------------
// Audit trail (DB 12.4) - newest first, 50 a page, keyset on id
// ---------------------------------------------------------------------------------------------------------------

const AUDIT_PAGE = 50;

export async function loadAudit(
  q: z.output<typeof auditQuerySchema>,
): Promise<{ rows: AuditEntry[]; nextCursor: string | null }> {
  let query = createAdminClient()
    .from("audit_log")
    .select("id, at, actor_staff_id, action, entity, entity_id, receipt_no, reason, before, after");
  if (q.type) query = query.in("action", [...AUDIT_TYPES[q.type]]);
  if (q.staffId) query = query.eq("actor_staff_id", q.staffId);
  if (q.from) query = query.gte("at", istStartOfDay(q.from).toISOString());
  if (q.to) query = query.lt("at", istStartOfDay(addDays(q.to, 1)).toISOString());
  if (q.cursor) query = query.lt("id", Number(q.cursor));
  const { data, error } = await query.order("id", { ascending: false }).limit(AUDIT_PAGE + 1);
  dbFailed(error);

  const page = rows(data);
  const more = page.length > AUDIT_PAGE;
  const shown = page.slice(0, AUDIT_PAGE);
  const names = await staffNames(shown.map((r) => strOrNull(r.actor_staff_id)));
  return {
    rows: shown.map((r) => {
      const staffId = strOrNull(r.actor_staff_id);
      const who = staffId ? names.get(staffId) : undefined;
      return {
        id: int(r.id),
        at: iso(r.at),
        action: str(r.action),
        entity: str(r.entity),
        entityId: strOrNull(r.entity_id),
        receiptNo: strOrNull(r.receipt_no),
        reason: strOrNull(r.reason),
        by: staffId ? { staffId, name: who?.name ?? null, staffNo: who?.staffNo ?? null } : null,
        before: recOrNull(r.before),
        after: recOrNull(r.after),
      };
    }),
    nextCursor: more && shown.length > 0 ? String(int(shown[shown.length - 1].id)) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Day closes (DB 12.4)
// ---------------------------------------------------------------------------------------------------------------

const DAY_CLOSE_COLUMNS =
  "id, counter_id, business_date, status, receipts_count, cancelled_count, changed_count, cash_expected, cash_counted, " +
  "cash_difference, upi_count, upi_expected, upi_bank_total, upi_difference, note, closed_by_staff_id, closed_at, " +
  "reopened_by_staff_id, reopened_at, reopen_reason, counters(name), day_close_counts(kind, value, count, amount)";

/** At most a year of closes for a handful of counters, read in pages the PostgREST row cap (1000) allows. */
const DAY_CLOSE_LIMIT = 2000;
/** The most rows one PostgREST answer carries (supabase/config.toml `max_rows`, also the hosted default). */
const DB_MAX_ROWS = 1000;

function badgeOf(cash: number, upi: number): DayCloseListRow["badge"] {
  if (cash < 0 || upi < 0) return "short";
  if (cash > 0 || upi > 0) return "extra";
  return "balanced";
}

async function readDayCloses(from: string, to: string, offset: number, limit: number): Promise<Row[]> {
  const { data, error } = await createAdminClient()
    .from("day_closes")
    .select(DAY_CLOSE_COLUMNS)
    .gte("business_date", from)
    .lte("business_date", to)
    .order("business_date", { ascending: false })
    .order("counter_id", { ascending: true })
    .range(offset, offset + limit - 1);
  dbFailed(error);
  return rows(data);
}

async function toDayCloseRows(raw: Row[]): Promise<DayCloseListRow[]> {
  const names = await staffNames(raw.flatMap((r) => [strOrNull(r.closed_by_staff_id), strOrNull(r.reopened_by_staff_id)]));
  return raw.map((r) => {
    const status = str(r.status);
    if (status !== "closed" && status !== "reopened") throw new SevaError("internal");
    const cashDifferencePaise = paise(r.cash_difference);
    const upiDifferencePaise = paise(r.upi_difference);
    const closedBy = strOrNull(r.closed_by_staff_id);
    const reopenedBy = strOrNull(r.reopened_by_staff_id);
    return {
      id: str(r.id),
      counterId: int(r.counter_id),
      counterName: strOrNull(recOrNull(r.counters)?.name),
      businessDate: str(r.business_date),
      status,
      receipts: int(r.receipts_count),
      cancelled: int(r.cancelled_count),
      changed: int(r.changed_count),
      cashExpectedPaise: paise(r.cash_expected),
      cashCountedPaise: paise(r.cash_counted),
      cashDifferencePaise,
      upiCount: int(r.upi_count),
      upiExpectedPaise: paise(r.upi_expected),
      upiBankTotalPaise: paiseOrNull(r.upi_bank_total),
      upiDifferencePaise,
      badge: badgeOf(cashDifferencePaise, upiDifferencePaise),
      note: strOrNull(r.note),
      closedBy: closedBy ? (names.get(closedBy)?.name ?? null) : null,
      closedAt: iso(r.closed_at),
      reopenedBy: reopenedBy ? (names.get(reopenedBy)?.name ?? null) : null,
      reopenedAt: isoOrNull(r.reopened_at),
      reopenReason: strOrNull(r.reopen_reason),
      counts: rows(r.day_close_counts)
        .map((c): DayCloseListRow["counts"][number] => {
          const kind = str(c.kind);
          if (kind !== "note" && kind !== "coin") throw new SevaError("internal");
          return { kind, valuePaise: paise(c.value), count: int(c.count), amountPaise: paise(c.amount) };
        })
        .sort((a, b) => (a.kind === b.kind ? b.valuePaise - a.valuePaise : a.kind === "note" ? -1 : 1)),
    };
  });
}

export async function loadDayCloses(from: string, to: string): Promise<DayCloseListRow[]> {
  const all: Row[] = [];
  while (all.length < DAY_CLOSE_LIMIT) {
    const take = Math.min(DB_MAX_ROWS, DAY_CLOSE_LIMIT - all.length);
    const page = await readDayCloses(from, to, all.length, take);
    all.push(...page);
    if (page.length < take) break;
  }
  return toDayCloseRows(all);
}

// ---------------------------------------------------------------------------------------------------------------
// Exports (DB 12.6, C-41): one part a call, 1000 rows a page, test mode excluded, phones only when asked and allowed
// ---------------------------------------------------------------------------------------------------------------

/** Equal to the PostgREST row cap: a page asks for exactly this many rows, never one more (it would never arrive). */
export const EXPORT_PAGE_SIZE = DB_MAX_ROWS;

const CANCEL_REASON_LABELS: Record<CancelReasonCode, string> = {
  wrong_seva: "Wrong seva",
  wrong_date: "Wrong date",
  wrong_amount: "Wrong amount",
  wrong_devotee: "Wrong devotee",
  changed_mind: "Devotee changed their mind",
  entered_twice: "Entered twice",
  spoiled_print: "Spoiled print",
  other: "Other",
  not_printed_connection_lost: "Not printed - connection lost",
  refunded: "Refunded",
};

function mode(value: unknown): PaymentMode {
  const m = str(value);
  if (m !== "cash" && m !== "upi" && m !== "online") throw new SevaError("internal");
  return m;
}

function receiptStatus(value: unknown): "issued" | "cancelled" {
  const s = str(value);
  if (s !== "issued" && s !== "cancelled") throw new SevaError("internal");
  return s;
}

function prasadamState(value: unknown): ExportPrasadamState {
  const s = str(value);
  if (s !== "none" && s !== "pending" && s !== "given") throw new SevaError("internal");
  return s;
}

function cancelReason(code: unknown, note: unknown): string {
  if (typeof code !== "string") return "";
  const label = (CANCEL_REASON_LABELS as Record<string, string | undefined>)[code] ?? code;
  const extra = typeof note === "string" && note.trim() !== "" ? ` - ${note.trim()}` : "";
  return `${label}${extra}`;
}

function receiptSelect(includePhones: boolean): string {
  const order =
    "devotee_name, gotra, nakshatra_id, nakshatra_text, rashi_id, rashi_text, payment_mode, upi_ref_last6, test_mode" +
    (includePhones ? ", phone_e164" : "");
  return (
    "id, receipt_no, series_code, business_date, issued_at, total, status, cancel_reason_code, cancel_note, " +
    "prasadam_state, has_changed_amount, issued_by_name, " +
    `seva_orders!inner(${order}), ` +
    "seva_receipt_lines(line_no, seva_code, seva_name_en, quantity, unit_rate, amount, sevas(income_ledger))"
  );
}

export function toExportReceiptRow(raw: Row, includePhones: boolean): ExportReceiptRow {
  const order = rec(Array.isArray(raw.seva_orders) ? raw.seva_orders[0] : raw.seva_orders);
  const lines = rows(raw.seva_receipt_lines).sort((a, b) => int(a.line_no) - int(b.line_no));
  const issuedAt = iso(raw.issued_at);
  const nakshatra = findOption(NAKSHATRAS, intOrNull(order.nakshatra_id))?.en ?? strOrNull(order.nakshatra_text) ?? "";
  const rashi = findOption(RASHIS, intOrNull(order.rashi_id))?.en ?? strOrNull(order.rashi_text) ?? "";

  const ledgers = new Map<string, number>();
  for (const line of lines) {
    const ledger = strOrNull(recOrNull(line.sevas)?.income_ledger)?.trim() || defaultIncomeLedger(str(line.seva_name_en));
    ledgers.set(ledger, (ledgers.get(ledger) ?? 0) + paise(line.amount));
  }

  const row: ExportReceiptRow = {
    receiptNo: str(raw.receipt_no),
    series: str(raw.series_code),
    date: str(raw.business_date),
    time: istTime(issuedAt),
    devoteeName: str(order.devotee_name),
    sevas: lines.map((l) => `${str(l.seva_name_en)}${int(l.quantity) > 1 ? ` x ${int(l.quantity)}` : ""}`).join(", "),
    amountPaise: paise(raw.total),
    mode: mode(order.payment_mode),
    status: receiptStatus(raw.status),
    gotra: strOrNull(order.gotra) ?? "",
    nakshatra,
    rashi,
    sevaCodes: lines.map((l) => strOrNull(l.seva_code) ?? "").filter((c) => c !== "").join(", "),
    upiRefLast6: strOrNull(order.upi_ref_last6) ?? "",
    issuedBy: strOrNull(raw.issued_by_name) ?? "",
    prasadam: prasadamState(raw.prasadam_state),
    changed: raw.has_changed_amount === true,
    cancelReason: cancelReason(raw.cancel_reason_code, raw.cancel_note),
    incomeLedgers: [...ledgers].map(([ledger, amountPaise]) => ({ ledger, amountPaise })),
  };
  if (includePhones) row.phone = strOrNull(order.phone_e164) ?? "";
  return row;
}

/**
 * A full page means another may follow, so it carries a cursor; a short page is the last. When the total is an exact
 * multiple of the page size, the caller makes one extra call that comes back empty.
 */
function pageOf<T>(raw: T[], offset: number): { page: T[]; nextCursor: string | null } {
  const full = raw.length >= EXPORT_PAGE_SIZE;
  return { page: raw.slice(0, EXPORT_PAGE_SIZE), nextCursor: full ? String(offset + EXPORT_PAGE_SIZE) : null };
}

async function exportReceipts(q: ExportQuery, offset: number, onlyCancelledOrChanged: boolean): Promise<ExportPage> {
  let query = createAdminClient()
    .from("seva_receipts")
    .select(receiptSelect(q.includePhones))
    .gte("business_date", q.from)
    .lte("business_date", q.to)
    .eq("test_mode", false)
    .eq("seva_orders.test_mode", false);
  if (onlyCancelledOrChanged) query = query.or("status.eq.cancelled,has_changed_amount.eq.true");
  const { data, error } = await query
    .order("issued_at", { ascending: true })
    .order("receipt_no", { ascending: true })
    .range(offset, offset + EXPORT_PAGE_SIZE - 1);
  dbFailed(error);
  const { page, nextCursor } = pageOf(rows(data), offset);
  return { rows: page.map((r) => toExportReceiptRow(r, q.includePhones)), nextCursor };
}

async function exportLines(q: ExportQuery, offset: number): Promise<ExportPage> {
  const order = "payment_mode, test_mode" + (q.includePhones ? ", phone_e164" : "");
  const { data, error } = await createAdminClient()
    .from("seva_receipt_lines")
    .select(
      "receipt_id, line_no, seva_code, seva_name_en, quantity, unit_rate, amount, sevas(income_ledger), " +
        `seva_receipts!inner(receipt_no, series_code, business_date, status, test_mode, seva_orders!inner(${order}))`,
    )
    .gte("seva_receipts.business_date", q.from)
    .lte("seva_receipts.business_date", q.to)
    .eq("seva_receipts.test_mode", false)
    .eq("seva_receipts.seva_orders.test_mode", false)
    // Append-only order (the parent receipt's issue time and number), so receipts issued during a live-day export
    // land after the pages already read instead of shifting them.
    .order("seva_receipts(issued_at)", { ascending: true })
    .order("seva_receipts(receipt_no)", { ascending: true })
    .order("line_no", { ascending: true })
    .range(offset, offset + EXPORT_PAGE_SIZE - 1);
  dbFailed(error);
  const { page, nextCursor } = pageOf(rows(data), offset);
  return {
    rows: page.map((l): ExportLineRow => {
      const receipt = rec(Array.isArray(l.seva_receipts) ? l.seva_receipts[0] : l.seva_receipts);
      const o = rec(Array.isArray(receipt.seva_orders) ? receipt.seva_orders[0] : receipt.seva_orders);
      const row: ExportLineRow = {
        receiptNo: str(receipt.receipt_no),
        series: str(receipt.series_code),
        date: str(receipt.business_date),
        sevaCode: strOrNull(l.seva_code) ?? "",
        sevaName: str(l.seva_name_en),
        quantity: int(l.quantity),
        unitRatePaise: paise(l.unit_rate),
        amountPaise: paise(l.amount),
        mode: mode(o.payment_mode),
        status: receiptStatus(receipt.status),
        incomeLedger: strOrNull(recOrNull(l.sevas)?.income_ledger)?.trim() || defaultIncomeLedger(str(l.seva_name_en)),
      };
      if (q.includePhones) row.phone = strOrNull(o.phone_e164) ?? "";
      return row;
    }),
    nextCursor,
  };
}

async function exportSevas(q: ExportQuery): Promise<ExportPage> {
  const summary = await loadSevaSummary(q.from, q.to);
  return {
    rows: summary.sevas.map(
      (s): ExportSevaRow => ({
        name: s.nameEn,
        count: s.quantity,
        amountPaise: s.amountPaise,
        lastYearCount: s.lastYear.receipts > 0 ? s.lastYear.quantity : null,
        lastYearAmountPaise: s.lastYear.receipts > 0 ? s.lastYear.amountPaise : null,
      }),
    ),
    nextCursor: null,
  };
}

async function exportDayCloses(q: ExportQuery, offset: number): Promise<ExportPage> {
  const { page, nextCursor } = pageOf(await readDayCloses(q.from, q.to, offset, EXPORT_PAGE_SIZE), offset);
  const list = await toDayCloseRows(page);
  return {
    rows: list.map((d) => ({
      Date: toDayMonthYear(d.businessDate),
      Counter: d.counterName ?? String(d.counterId),
      Receipts: d.receipts,
      Cancelled: d.cancelled,
      "Cash expected": paiseToRupees(d.cashExpectedPaise),
      "Cash counted": paiseToRupees(d.cashCountedPaise),
      "Cash difference": paiseToRupees(d.cashDifferencePaise),
      "UPI expected": paiseToRupees(d.upiExpectedPaise),
      "UPI confirmed": d.upiBankTotalPaise === null ? "" : paiseToRupees(d.upiBankTotalPaise),
      "UPI difference": paiseToRupees(d.upiDifferencePaise),
      Result: d.badge === "balanced" ? "Balanced" : d.badge === "short" ? "Short" : "Extra",
      Status: d.status === "closed" ? "Closed" : "Reopened",
      "Closed by": d.closedBy ?? "",
      Note: d.note ?? "",
    })),
    nextCursor,
  };
}

async function exportPrasadam(q: ExportQuery, offset: number): Promise<ExportPage> {
  const { data, error } = await createAdminClient()
    .from("seva_receipts")
    .select("receipt_no, seva_date, prasadam_state, prasadam_given_at, prasadam_given_by_staff_id, seva_orders!inner(devotee_name, test_mode)")
    .gte("seva_date", q.from)
    .lte("seva_date", q.to)
    .eq("status", "issued")
    .in("prasadam_state", ["pending", "given"])
    .eq("test_mode", false)
    .eq("seva_orders.test_mode", false)
    .order("seva_date", { ascending: true })
    .order("receipt_no", { ascending: true })
    .range(offset, offset + EXPORT_PAGE_SIZE - 1);
  dbFailed(error);
  const { page, nextCursor } = pageOf(rows(data), offset);
  const names = await staffNames(page.map((r) => strOrNull(r.prasadam_given_by_staff_id)));
  return {
    rows: page.map((r) => {
      const order = rec(Array.isArray(r.seva_orders) ? r.seva_orders[0] : r.seva_orders);
      const givenAt = isoOrNull(r.prasadam_given_at);
      const givenBy = strOrNull(r.prasadam_given_by_staff_id);
      return {
        "Seva date": toDayMonthYear(str(r.seva_date)),
        "Receipt no.": str(r.receipt_no),
        Devotee: str(order.devotee_name),
        Prasadam: prasadamState(r.prasadam_state) === "given" ? "Given" : "Pending",
        "Given at": givenAt ? `${toDayMonthYear(businessDate(new Date(givenAt)))} ${istTime(givenAt)}` : "",
        "Given by": givenBy ? (names.get(givenBy)?.name ?? "") : "",
      };
    }),
    nextCursor,
  };
}

async function exportRateChanges(q: ExportQuery, offset: number): Promise<ExportPage> {
  const { start, end } = dayBounds(q.from, q.to);
  const { data, error } = await createAdminClient()
    .from("seva_rate_history")
    .select("id, old_amount, new_amount, reason, changed_by_staff_id, changed_at, sevas(name)")
    .not("old_amount", "is", null)
    .gte("changed_at", start)
    .lt("changed_at", end)
    .order("changed_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + EXPORT_PAGE_SIZE - 1);
  dbFailed(error);
  const { page, nextCursor } = pageOf(rows(data), offset);
  const names = await staffNames(page.map((r) => strOrNull(r.changed_by_staff_id)));
  return {
    rows: page.map((r): ExportRateChangeRow => {
      const at = iso(r.changed_at);
      const by = strOrNull(r.changed_by_staff_id);
      return {
        seva: strOrNull(recOrNull(r.sevas)?.name) ?? "",
        oldPaise: paiseOrNull(r.old_amount),
        newPaise: paise(r.new_amount),
        reason: strOrNull(r.reason) ?? "",
        by: by ? (names.get(by)?.name ?? "") : "",
        at: `${toDayMonthYear(businessDate(new Date(at)))} ${istTime(at)}`,
      };
    }),
    nextCursor,
  };
}

export async function loadExportPage(q: ExportQuery): Promise<ExportPage> {
  const offset = q.cursor ? Number(q.cursor) : 0;
  const part: ExportPart = q.part;
  switch (part) {
    case "receipts":
      return exportReceipts(q, offset, false);
    case "cancelled":
      return exportReceipts(q, offset, true);
    case "lines":
      return exportLines(q, offset);
    case "sevas":
      return exportSevas(q);
    case "dayCloses":
      return exportDayCloses(q, offset);
    case "prasadam":
      return exportPrasadam(q, offset);
    case "rateChanges":
      return exportRateChanges(q, offset);
  }
}

/** Every export writes `export.download` (DB 12.6): format, range, parts and whether phones were included. */
export async function writeExportAudit(actor: SevaActor, b: ExportAuditRequest): Promise<void> {
  await callRpc<unknown>("seva_audit", {
    p_action: "export.download",
    p_entity: "export",
    p_entity_id: null,
    p_receipt_no: null,
    p_reason: null,
    p_before: null,
    p_after: { format: b.format, from: b.from, to: b.to, parts: b.parts, include_phones: b.includePhones },
    p_staff_id: actor.staffId,
  });
}

/**
 * A phone export is audited by the server, whatever the browser reports afterwards (A3 security gate M-3, DB 12.6,
 * C-16): `export.phones_read` with the part, range and cursor, written on every page that includes phones before any
 * row is read, so a failed write means no phone number leaves the server. The cursor is a number the client chooses,
 * so a page is never trusted to have been audited by an earlier one (M-3 re-review: `cursor=0`, a later cursor on its
 * own, a cursor over another range).
 */
export async function writePhoneExportAudit(actor: SevaActor, q: ExportQuery): Promise<void> {
  await callRpc<unknown>("seva_audit", {
    p_action: "export.phones_read",
    p_entity: "export",
    p_entity_id: q.part,
    p_receipt_no: null,
    p_reason: null,
    p_before: null,
    p_after: { part: q.part, from: q.from, to: q.to, cursor: q.cursor ?? null, include_phones: true },
    p_staff_id: actor.staffId,
  });
}
