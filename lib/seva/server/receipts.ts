/**
 * The receipt repository (DB §9.8-9.9, §12.3, §9.2, §8.5): the register list, one receipt with its history, cancel,
 * spoiled-print reissue, the returning-devotee search and gap resolution. Writes go through the A2-1 / A2-2 SQL
 * functions; reads use the service-role client and select only the columns a screen shows - the devotee's phone is
 * never selected for a list or a receipt, and the devotee search keeps only its last four digits (C-16, C-31).
 * Test-mode receipts never appear in the register.
 */

import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { parseLookupInput } from "@/lib/seva/numbering";
import { can, type SevaActor } from "@/lib/seva/permissions";
import { newQrToken } from "@/lib/seva/qr";
import { devoteeSchema, type CancelRequest, type GapResolveRequest } from "@/lib/seva/schemas";
import { cancelDeadline, istParts } from "@/lib/seva/time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CancelReasonCode, IssueResponse, PaymentMode } from "@/types/seva";
import type {
  DevoteeMatch,
  ReceiptDetail,
  ReceiptListItem,
  ReceiptStatusFilter,
  RefundState,
} from "@/types/seva-receipts";
import { requireSevaActor, type ActorResult, type RequireSevaActorOptions } from "./auth";
import { fromSqlIssue } from "./counter";
import { readListsOrNone } from "./lists";
import {
  embedded,
  embeddedLines,
  int,
  intOrNull,
  isRow,
  oneOf,
  paise,
  readTimeRules,
  rowOf,
  rowsOf,
  staffNames,
  text,
  textOrNull,
  type Row,
} from "./read";
import { sevaErrorResponse } from "./respond";
import { callRpc } from "./rpc";

/** Ids the database made (any 8-4-4-4-12 hex form, as the shared schemas accept). */
export const receiptIdSchema = z.guid("Not a receipt id");

const PAYMENT_MODES: readonly PaymentMode[] = ["cash", "upi", "online"];
const REFUND_STATES: readonly RefundState[] = ["none", "due", "processing", "done", "failed"];
const PRASADAM_STATES = ["none", "pending", "given"] as const;
const RECEIPT_STATUSES = ["issued", "cancelled"] as const;
const CANCEL_REASONS: readonly CancelReasonCode[] = [
  "wrong_seva",
  "wrong_date",
  "wrong_amount",
  "wrong_devotee",
  "changed_mind",
  "entered_twice",
  "spoiled_print",
  "other",
  "not_printed_connection_lost",
  "refunded",
];

// ---------------------------------------------------------------------------------------------------------------
// Register list (DB §12.3; DB §9.9 for the counter's Today's receipts)
// ---------------------------------------------------------------------------------------------------------------

const PAGE_SIZE = 50;

const STATUS_FILTERS: readonly ReceiptStatusFilter[] = ["issued", "cancelled", "changed", "duplicate", "prasadam_pending"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-20");

export const RECEIPT_LIST_KEYS = ["from", "to", "sevaId", "mode", "status", "q", "cursor"] as const;

export const receiptListQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  sevaId: z.guid("Not a seva id").optional(),
  mode: z.enum(["cash", "upi", "online"]).optional(),
  status: z.enum(STATUS_FILTERS as [ReceiptStatusFilter, ...ReceiptStatusFilter[]]).optional(),
  q: z.string().trim().min(1).max(80, "Keep the search to 80 characters or fewer").optional(),
  cursor: z.string().max(200).optional(),
});

export type ReceiptListQuery = z.infer<typeof receiptListQuerySchema>;

/** Limits the list to one counter and one business date (a receptionist: their device's counter, today). */
export interface ReceiptListScope {
  counterId: number | null;
  businessDate: string | null;
}

const LIST_COLUMNS =
  "id, receipt_no, series_code, business_date, issued_at, total, status, has_changed_amount, print_count, " +
  "prasadam_state, position, issued_by_staff_id, refund_state, " +
  "seva_orders!inner(devotee_name, payment_mode, group_no, receipts_count, counter_id), " +
  "lines:seva_receipt_lines(line_no, seva_name_en, quantity)";

/** Only for the seva filter, so `lines` still lists every seva of the receipt. */
const SEVA_FILTER_EMBED = ", seva_match:seva_receipt_lines!inner(seva_id)";

function sevasText(lines: Row[]): string {
  return lines
    .map((line) => {
      const quantity = int(line, "quantity");
      return quantity > 1 ? `${text(line, "seva_name_en")} x${quantity}` : text(line, "seva_name_en");
    })
    .join(", ");
}

/** One register row. Only the listed fields are copied, so nothing else a query returns can leak out. */
export function toListItem(row: Row, cancelWindowMinutes: number): ReceiptListItem {
  const order = embedded(row, "seva_orders");
  const status = oneOf(row.status, RECEIPT_STATUSES);
  const issuedAt = text(row, "issued_at");
  return {
    id: text(row, "id"),
    receiptNo: text(row, "receipt_no"),
    series: text(row, "series_code"),
    businessDate: text(row, "business_date"),
    issuedAt,
    devoteeName: text(order, "devotee_name"),
    sevas: sevasText(embeddedLines(row, "lines")),
    totalPaise: paise(row, "total"),
    mode: oneOf(order.payment_mode, PAYMENT_MODES),
    status,
    changed: row.has_changed_amount === true,
    printCount: int(row, "print_count"),
    prasadam: oneOf(row.prasadam_state, PRASADAM_STATES),
    groupNo: text(order, "group_no"),
    position: int(row, "position"),
    count: int(order, "receipts_count"),
    issuedByStaffId: textOrNull(row, "issued_by_staff_id"),
    cancelDeadline: status === "issued" ? cancelDeadline(issuedAt, cancelWindowMinutes).toISOString() : null,
    refundState: oneOf(row.refund_state, REFUND_STATES),
  };
}

function encodeCursor(row: ReceiptListItem): string {
  return Buffer.from(JSON.stringify([row.issuedAt, row.id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { issuedAt: string; id: string } {
  const bad = new SevaError("validation", { field: "cursor", message: "The page marker is not valid. Start again." });
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw bad;
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw bad;
  const [issuedAt, id] = parsed as unknown[];
  if (typeof issuedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}(:?\d{2})?)$/.test(issuedAt)) throw bad;
  if (typeof id !== "string" || !receiptIdSchema.safeParse(id).success) throw bad;
  return { issuedAt, id };
}

/** `%`, `_` and `\` typed by a person match themselves in an ILIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Newest first, PAGE_SIZE rows a page, with a keyset cursor (issued_at, id) for the next page. */
export async function listReceipts(
  query: ReceiptListQuery,
  scope: ReceiptListScope,
  now: Date = new Date(),
): Promise<{ rows: ReceiptListItem[]; nextCursor: string | null }> {
  const columns = query.sevaId ? LIST_COLUMNS + SEVA_FILTER_EMBED : LIST_COLUMNS;
  let request = createAdminClient().from("seva_receipts").select(columns).eq("test_mode", false);

  if (scope.counterId !== null) request = request.eq("seva_orders.counter_id", scope.counterId);
  if (scope.businessDate !== null) {
    request = request.eq("business_date", scope.businessDate);
  } else {
    if (query.from) request = request.gte("business_date", query.from);
    if (query.to) request = request.lte("business_date", query.to);
  }
  if (query.mode) request = request.eq("seva_orders.payment_mode", query.mode);
  if (query.sevaId) request = request.eq("seva_match.seva_id", query.sevaId);

  switch (query.status) {
    case "issued":
    case "cancelled":
      request = request.eq("status", query.status);
      break;
    case "changed":
      request = request.eq("has_changed_amount", true);
      break;
    case "duplicate":
      request = request.gte("print_count", 2);
      break;
    case "prasadam_pending":
      request = request.eq("status", "issued").eq("prasadam_state", "pending");
      break;
    default:
      break;
  }

  if (query.q) {
    const lookup = parseLookupInput(query.q, { year: istParts(now).year });
    if (lookup.kind === "number") {
      request = request.eq("receipt_no", lookup.receiptNo);
    } else if (lookup.kind === "short") {
      request = request.eq("running_no", lookup.running).eq("year", lookup.year);
      if (lookup.series) request = request.eq("series_code", lookup.series);
    } else if (lookup.kind === "token") {
      request = request.eq("qr_token", lookup.token);
    } else {
      request = request.ilike("seva_orders.devotee_name", `%${escapeLike(query.q)}%`);
    }
  }

  if (query.cursor) {
    const { issuedAt, id } = decodeCursor(query.cursor);
    request = request.or(`issued_at.lt."${issuedAt}",and(issued_at.eq."${issuedAt}",id.lt.${id})`);
  }

  const [result, rules] = await Promise.all([
    request.order("issued_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1),
    readTimeRules(),
  ]);
  const items = rowsOf(result).map((row) => toListItem(row, rules.cancelWindowMinutes));
  const page = items.slice(0, PAGE_SIZE);
  const nextCursor = items.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null;
  return { rows: page, nextCursor };
}

/** The register rows of the given receipts (after a cancel), newest first. */
export async function listReceiptsByIds(ids: string[]): Promise<ReceiptListItem[]> {
  const [result, rules] = await Promise.all([
    createAdminClient()
      .from("seva_receipts")
      .select(LIST_COLUMNS)
      .in("id", ids)
      .order("issued_at", { ascending: false })
      .order("id", { ascending: false }),
    readTimeRules(),
  ]);
  return rowsOf(result).map((row) => toListItem(row, rules.cancelWindowMinutes));
}

// ---------------------------------------------------------------------------------------------------------------
// One receipt with its history (DB §12.3: prints, cancel, prasadam, audit rows)
// ---------------------------------------------------------------------------------------------------------------

/** What the guard and the detail need to know about a receipt before it is shown. */
export interface ReceiptFacts {
  id: string;
  orderId: string;
  counterId: number | null;
  businessDate: string;
  issuedAt: string;
  issuedByStaffId: string | null;
  issuedByName: string | null;
  status: "issued" | "cancelled";
  cancelledAt: string | null;
  cancelledByStaffId: string | null;
  cancelReasonCode: string | null;
  cancelNote: string | null;
  refundState: RefundState;
  firstPrintedAt: string | null;
  prasadamGivenAt: string | null;
  prasadamGivenByStaffId: string | null;
}

const FACT_COLUMNS =
  "id, order_id, business_date, issued_at, issued_by_staff_id, issued_by_name, status, cancelled_at, " +
  "cancelled_by_staff_id, cancel_reason_code, cancel_note, refund_state, first_printed_at, prasadam_given_at, " +
  "prasadam_given_by_staff_id, seva_orders!inner(counter_id)";

export async function readReceiptFacts(id: string): Promise<ReceiptFacts | null> {
  const row = rowOf(await createAdminClient().from("seva_receipts").select(FACT_COLUMNS).eq("id", id).maybeSingle());
  if (!row) return null;
  return {
    id: text(row, "id"),
    orderId: text(row, "order_id"),
    counterId: intOrNull(embedded(row, "seva_orders"), "counter_id"),
    businessDate: text(row, "business_date"),
    issuedAt: text(row, "issued_at"),
    issuedByStaffId: textOrNull(row, "issued_by_staff_id"),
    issuedByName: textOrNull(row, "issued_by_name"),
    status: oneOf(row.status, RECEIPT_STATUSES),
    cancelledAt: textOrNull(row, "cancelled_at"),
    cancelledByStaffId: textOrNull(row, "cancelled_by_staff_id"),
    cancelReasonCode: textOrNull(row, "cancel_reason_code"),
    cancelNote: textOrNull(row, "cancel_note"),
    refundState: oneOf(row.refund_state, REFUND_STATES),
    firstPrintedAt: textOrNull(row, "first_printed_at"),
    prasadamGivenAt: textOrNull(row, "prasadam_given_at"),
    prasadamGivenByStaffId: textOrNull(row, "prasadam_given_by_staff_id"),
  };
}

const HISTORY_LIMIT = 200;

export async function getReceiptDetail(facts: ReceiptFacts): Promise<ReceiptDetail> {
  const [orderJson, auditResult, lists] = await Promise.all([
    callRpc<unknown>("seva_order_json", { p_order_id: facts.orderId, p_duplicate: false }),
    createAdminClient()
      .from("audit_log")
      .select("at, action, actor_staff_id, reason")
      .eq("entity", "receipt")
      .eq("entity_id", facts.id)
      .order("at", { ascending: false })
      .limit(HISTORY_LIMIT),
    readListsOrNone(),
  ]);
  const issued = fromSqlIssue(orderJson, lists).receipts.find((receipt) => receipt.id === facts.id);
  if (!issued) throw new SevaError("internal");
  const audit = rowsOf(auditResult);
  const names = await staffNames([
    ...audit.map((row) => textOrNull(row, "actor_staff_id")),
    facts.cancelledByStaffId,
    facts.prasadamGivenByStaffId,
  ]);
  const nameOf = (id: string | null): string | null => (id ? names.get(id) ?? null : null);

  const history: ReceiptDetail["history"] = [
    { at: facts.issuedAt, action: "receipt.issue", by: facts.issuedByName, reason: null },
  ];
  if (facts.firstPrintedAt) history.push({ at: facts.firstPrintedAt, action: "receipt.print", by: null, reason: null });
  for (const row of audit) {
    history.push({
      at: text(row, "at"),
      action: text(row, "action"),
      by: nameOf(textOrNull(row, "actor_staff_id")),
      reason: textOrNull(row, "reason"),
    });
  }
  // A give on the seva date writes no audit row (an off-date give does), so the give itself is added here once.
  const givenAt = facts.prasadamGivenAt;
  if (givenAt && !audit.some((row) => row.action === "prasadam.given_off_date" && row.at === givenAt)) {
    history.push({ at: givenAt, action: "prasadam.given", by: nameOf(facts.prasadamGivenByStaffId), reason: null });
  }
  history.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const cancel: ReceiptDetail["cancel"] =
    facts.status === "cancelled" && facts.cancelledAt
      ? {
          at: facts.cancelledAt,
          by: nameOf(facts.cancelledByStaffId) ?? "Unknown staff",
          reasonCode: oneOf(facts.cancelReasonCode, CANCEL_REASONS),
          note: facts.cancelNote,
        }
      : null;

  return { ...issued, history, cancel, refundState: facts.refundState };
}

// ---------------------------------------------------------------------------------------------------------------
// Cancel and spoiled-print reissue (DB §9.8-9.9; DB §3.3 rows 3-4: own receipt inside the window, or any as admin)
// ---------------------------------------------------------------------------------------------------------------

/** Whose the receipts are and whether every one is still inside the cancel window, for the guard's context. */
interface Ownership {
  issuer: string | undefined;
  withinWindow: boolean;
  /** The counter of every receipt's order (null for an online W order); empty when a receipt was not found. */
  counters: (number | null)[];
}

async function readOwnership(ids: string[], now: Date): Promise<Ownership> {
  const [result, rules] = await Promise.all([
    createAdminClient().from("seva_receipts").select("id, issued_by_staff_id, issued_at, order_id").in("id", ids),
    readTimeRules(),
  ]);
  const rows = rowsOf(result);
  const unique = new Set(ids);
  if (rows.length !== unique.size) return { issuer: undefined, withinWindow: false, counters: [] };
  const issuers = new Set(rows.map((row) => textOrNull(row, "issued_by_staff_id")));
  const [only] = [...issuers];
  const withinWindow = rows.every(
    (row) => now.getTime() <= cancelDeadline(text(row, "issued_at"), rules.cancelWindowMinutes).getTime(),
  );
  const orderIds = [...new Set(rows.map((row) => textOrNull(row, "order_id")).filter((id): id is string => id !== null))];
  const orders =
    orderIds.length === 0 ? [] : rowsOf(await createAdminClient().from("seva_orders").select("id, counter_id").in("id", orderIds));
  const counterOf = new Map(orders.map((o) => [text(o, "id"), intOrNull(o, "counter_id")] as const));
  const counters = rows.map((row) => {
    const orderId = textOrNull(row, "order_id");
    return orderId === null ? null : (counterOf.get(orderId) ?? null);
  });
  return { issuer: issuers.size === 1 && only ? only : undefined, withinWindow, counters };
}

async function isForbidden(result: ActorResult): Promise<boolean> {
  if (result.ok || result.response.status !== 403) return false;
  try {
    const body: unknown = await result.response.clone().json();
    return isRow(body) && isRow(body.error) && body.error.code === "forbidden";
  } catch {
    return false;
  }
}

/**
 * The guard for cancel and reissue: the caller's own receipts inside the cancel window (receipt.cancel_own, any
 * counter role), otherwise any receipt (receipt.cancel_any, temple admin and super admin). The SQL function checks
 * the same rule again in its own transaction.
 */
export async function requireCancelRight(
  req: NextRequest,
  receiptIds: string[],
  device: NonNullable<RequireSevaActorOptions["device"]>,
  now: Date = new Date(),
): Promise<ActorResult> {
  const { issuer, withinWindow, counters } = await readOwnership(receiptIds, now);
  const own = await requireSevaActor(req, "receipt.cancel_own", {
    device,
    ctx: { receiptIssuedByStaffId: issuer, withinCancelWindow: withinWindow },
  });
  if (own.ok) {
    // A5-FIX L-4: a counter role cancels its own receipt only from the PC of that receipt's own counter.
    const onOwnCounter =
      own.device !== null && counters.length > 0 && counters.every((counterId) => counterId === own.device?.counterId);
    if (!can(own.actor, "receipt.cancel_any") && !onOwnCounter) {
      return {
        ok: false,
        response: sevaErrorResponse(new SevaError("forbidden", { reason: "another counter's receipt" })),
      };
    }
    return own;
  }
  if (!(await isForbidden(own))) return own;
  return requireSevaActor(req, "receipt.cancel_any", { device });
}

export async function cancelReceipts(
  actor: SevaActor,
  body: CancelRequest,
  /** The registered PC the cancel came from, recorded in the audit row (A5-FIX L-4); null from the office. */
  deviceId: string | null = null,
): Promise<{ receipts: ReceiptListItem[] }> {
  await callRpc<unknown>("seva_cancel_receipts", {
    ...(deviceId === null ? {} : { p_device_id: deviceId }),
    p_receipt_ids: body.receiptIds,
    p_reason_code: body.reasonCode,
    p_note: body.note && body.note !== "" ? body.note : null,
    p_staff_id: actor.staffId,
    p_is_admin: can(actor, "receipt.cancel_any"),
  });
  return { receipts: await listReceiptsByIds([...new Set(body.receiptIds)]) };
}

/** Cancels a spoiled slip and issues the next C number on the same payment with a fresh QR token (DB §9.8). */
export async function reissueSpoiled(actor: SevaActor, deviceId: string, receiptId: string): Promise<IssueResponse> {
  const [answer, lists] = await Promise.all([
    callRpc<unknown>("seva_reissue_spoiled", {
      p_receipt_id: receiptId,
      p_staff_id: actor.staffId,
      p_device_id: deviceId,
      p_qr_token: newQrToken(),
      // A5-FIX L-5: the SQL function re-checks the own-receipt and window rule unless the actor may cancel any receipt.
      p_is_admin: can(actor, "receipt.cancel_any"),
    }),
    readListsOrNone(),
  ]);
  return fromSqlIssue(answer, lists);
}

// ---------------------------------------------------------------------------------------------------------------
// Returning-devotee search (DB §9.2, C-32): at most five matches, never the full phone
// ---------------------------------------------------------------------------------------------------------------

const MAX_MATCHES = 5;

export const devoteeSearchQuerySchema = z
  .object({
    name: z.string().trim().min(3, "Type at least 3 letters of the name").max(80).optional(),
    phone: devoteeSchema.shape.phone,
  })
  .refine((q) => q.name !== undefined || q.phone !== undefined, {
    message: "Type at least 3 letters of the name or a full phone number",
    path: ["name"],
  });

export type DevoteeSearchQuery = z.infer<typeof devoteeSearchQuerySchema>;

export async function searchDevotees(query: DevoteeSearchQuery): Promise<DevoteeMatch[]> {
  let request = createAdminClient()
    .from("devotee_profiles")
    .select("name, gotra, gotra_id, nakshatra_id, rashi_id, phone_e164, last_seen_at");
  request = query.phone
    ? request.eq("phone_e164", query.phone)
    : request.ilike("name", `${escapeLike(query.name ?? "")}%`);
  const rows = rowsOf(await request.order("last_seen_at", { ascending: false }).limit(MAX_MATCHES));
  return rows.slice(0, MAX_MATCHES).map((row) => {
    const phone = textOrNull(row, "phone_e164");
    return {
      name: text(row, "name"),
      gotra: textOrNull(row, "gotra"),
      gotraId: intOrNull(row, "gotra_id"),
      nakshatraId: intOrNull(row, "nakshatra_id"),
      rashiId: intOrNull(row, "rashi_id"),
      phoneLast4: phone && phone.length >= 4 ? phone.slice(-4) : null,
      lastVisit: text(row, "last_seen_at"),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Number gaps (DB §8.5)
// ---------------------------------------------------------------------------------------------------------------

export const gapIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,14}$/, "Not a gap id")
  .transform((value) => Number(value));

export async function resolveGap(actor: SevaActor, gapId: number, body: GapResolveRequest): Promise<void> {
  await callRpc<unknown>("seva_resolve_gap", {
    p_gap_id: gapId,
    p_status: body.status,
    p_note: body.note,
    p_staff_id: actor.staffId,
  });
}
