/**
 * The prasadam counter repository (DB §11, C-27, C-51, D35). Finds a receipt by QR token, full number or short form,
 * decides which screen it belongs to, and marks or undoes the give through the A2-2 SQL functions.
 * No amount and no phone number is ever selected or returned: the columns below are the whole read.
 */

import "server-only";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { parseLookupInput } from "@/lib/seva/numbering";
import { can, type SevaActor } from "@/lib/seva/permissions";
import type { PrasadamGiveRequest, PrasadamUndoRequest } from "@/lib/seva/schemas";
import { businessDate, istParts } from "@/lib/seva/time";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CancelReasonCode } from "@/types/seva";
import type { PrasadamLookupResult, PrasadamReceipt } from "@/types/seva-prasadam";
import {
  embedded,
  embeddedLines,
  int,
  readTimeRules,
  rowOf,
  rowsOf,
  staffNames,
  text,
  textOrNull,
  type Row,
} from "./read";
import { callRpc } from "./rpc";

/** What the number box sent: a scanner's URL plus Enter, a token, a full number or a short form. */
export const prasadamLookupQuerySchema = z.object({
  q: z.string().trim().min(1, "Type or scan a receipt number").max(300, "That is too long for a receipt number"),
});

/** At most this many receipts are offered in the pick list for an ambiguous short form. */
const MAX_OPTIONS = 10;

const PRASADAM_COLUMNS =
  "id, receipt_no, seva_date, issued_at, status, prasadam_state, prasadam_given_at, prasadam_given_by_staff_id, " +
  "cancelled_at, cancelled_by_staff_id, cancel_reason_code, cancel_note, position, order_id, " +
  "seva_orders!inner(devotee_name, group_no, receipts_count), " +
  "lines:seva_receipt_lines(line_no, seva_name_en, seva_name_kn, quantity, prasadam_items)";

/** The cancel reasons as the counter lists them (DB §9.9). */
const CANCEL_REASON_TEXT: Record<CancelReasonCode, string> = {
  wrong_seva: "Wrong seva entered",
  wrong_date: "Wrong date",
  wrong_amount: "Wrong amount",
  wrong_devotee: "Wrong devotee details",
  changed_mind: "Devotee changed their mind",
  entered_twice: "Entered twice",
  spoiled_print: "Spoiled print (paper jam or misprint)",
  other: "Other",
  not_printed_connection_lost: "Not printed - the connection was lost",
  refunded: "Refunded",
};

function cancelReason(code: string | null, note: string | null): string {
  if (code === "other" && note) return note;
  return code && code in CANCEL_REASON_TEXT ? CANCEL_REASON_TEXT[code as CancelReasonCode] : "Cancelled";
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function toPrasadamReceipt(row: Row): PrasadamReceipt {
  const order = embedded(row, "seva_orders");
  const count = int(order, "receipts_count");
  return {
    id: text(row, "id"),
    receiptNo: text(row, "receipt_no"),
    devoteeName: text(order, "devotee_name"),
    sevaDate: text(row, "seva_date"),
    issuedAt: text(row, "issued_at"),
    groupLine: count > 1 ? `${int(row, "position")} of ${count} · paid together · group ${text(order, "group_no")}` : null,
    lines: embeddedLines(row, "lines").map((line) => ({
      nameEn: text(line, "seva_name_en"),
      nameKn: textOrNull(line, "seva_name_kn"),
      quantity: int(line, "quantity"),
      prasadamItems: textOrNull(line, "prasadam_items"),
    })),
  };
}

/** The receipt of the same group whose seva date is today, so the volunteer can ask for that slip instead. */
async function todaysSlip(row: Row, today: string): Promise<{ receiptNo: string; position: number; count: number } | null> {
  const sibling = rowsOf(
    await createAdminClient()
      .from("seva_receipts")
      .select("receipt_no, position")
      .eq("order_id", text(row, "order_id"))
      .eq("seva_date", today)
      .eq("status", "issued")
      .neq("id", text(row, "id"))
      .order("position", { ascending: true })
      .limit(1),
  )[0];
  if (!sibling) return null;
  return {
    receiptNo: text(sibling, "receipt_no"),
    position: int(sibling, "position"),
    count: int(embedded(row, "seva_orders"), "receipts_count"),
  };
}

async function anotherDay(
  row: Row,
  today: string,
  offDate: "before" | "after",
  days: number,
): Promise<PrasadamLookupResult> {
  return { state: "another_day", receipt: toPrasadamReceipt(row), offDate, days, todaysSlip: await todaysSlip(row, today) };
}

/** The screen for one receipt (DB §11 table), judged in this order: cancelled, no prasadam, given, date, ready. */
async function classify(row: Row, today: string): Promise<PrasadamLookupResult> {
  const receipt = toPrasadamReceipt(row);
  if (row.status === "cancelled") {
    const by = textOrNull(row, "cancelled_by_staff_id");
    const names = await staffNames([by]);
    return {
      state: "cancelled",
      receipt,
      cancelledAt: text(row, "cancelled_at"),
      cancelledBy: (by && names.get(by)) || "Unknown staff",
      reason: cancelReason(textOrNull(row, "cancel_reason_code"), textOrNull(row, "cancel_note")),
    };
  }
  if (row.prasadam_state === "none") return { state: "no_prasadam", receipt };
  if (row.prasadam_state === "given") {
    const by = textOrNull(row, "prasadam_given_by_staff_id");
    const names = await staffNames([by]);
    return {
      state: "already_given",
      receipt,
      givenAt: text(row, "prasadam_given_at"),
      givenBy: (by && names.get(by)) || "Unknown staff",
    };
  }
  const sevaDate = receipt.sevaDate;
  if (sevaDate > today) return anotherDay(row, today, "before", daysBetween(today, sevaDate));
  if (sevaDate < today) return anotherDay(row, today, "after", daysBetween(sevaDate, today));
  return { state: "ready", receipt };
}

/**
 * Finds the receipt the volunteer typed or scanned. A short form ('124', 'C1 124') is read for the current IST year;
 * when it matches several series the answer is a pick list (C-51). Nothing matching is `not_found` with the input.
 */
export async function lookupPrasadam(raw: string, now: Date = new Date()): Promise<PrasadamLookupResult> {
  const query = raw.trim();
  const parsed = parseLookupInput(query, { year: istParts(now).year });
  if (parsed.kind === "invalid") return { state: "not_found", query };

  let request = createAdminClient().from("seva_receipts").select(PRASADAM_COLUMNS);
  if (parsed.kind === "token") {
    request = request.eq("qr_token", parsed.token);
  } else if (parsed.kind === "number") {
    request = request.eq("receipt_no", parsed.receiptNo);
  } else {
    request = request.eq("running_no", parsed.running).eq("year", parsed.year);
    if (parsed.series) request = request.eq("series_code", parsed.series);
  }
  const rows = rowsOf(await request.order("receipt_no", { ascending: true }).limit(MAX_OPTIONS));

  if (rows.length === 0) return { state: "not_found", query };
  if (rows.length > 1) {
    const options = rows.map((row) => ({
      receiptId: text(row, "id"),
      receiptNo: text(row, "receipt_no"),
      sevaDate: text(row, "seva_date"),
      devoteeName: text(embedded(row, "seva_orders"), "devotee_name"),
    }));
    options.sort((a, b) => a.receiptNo.localeCompare(b.receiptNo));
    return { state: "choose", options };
  }
  return classify(rows[0], businessDate(now));
}

async function readPrasadamRow(receiptId: string): Promise<Row | null> {
  return rowOf(await createAdminClient().from("seva_receipts").select(PRASADAM_COLUMNS).eq("id", receiptId).maybeSingle());
}

function sqlText(answer: Row, key: string): string | null {
  const value = answer[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Marks the receipt's prasadam given (seva_mark_prasadam) and answers the screen to show next. A successful give
 * answers `already_given` with this give's time and name, which the counter shows as "Marked given" with Undo.
 */
export async function givePrasadam(
  actor: SevaActor,
  body: PrasadamGiveRequest,
  now: Date = new Date(),
): Promise<PrasadamLookupResult> {
  let answer: unknown;
  try {
    answer = await callRpc<unknown>("seva_mark_prasadam", {
      p_receipt_id: body.receiptId,
      p_staff_id: actor.staffId,
      p_confirm_off_date: body.confirmOffDate,
    });
  } catch (error) {
    if (error instanceof SevaError && error.code === "not_found") return { state: "not_found", query: body.receiptId };
    throw error;
  }
  if (answer === null || typeof answer !== "object" || Array.isArray(answer)) throw new SevaError("internal");
  const sql = answer as Row;

  const row = await readPrasadamRow(body.receiptId);
  if (!row) return { state: "not_found", query: body.receiptId };
  const today = businessDate(now);

  switch (sql.state) {
    case "given":
    case "already_given":
      return {
        state: "already_given",
        receipt: toPrasadamReceipt(row),
        givenAt: sqlText(sql, "given_at") ?? text(row, "prasadam_given_at"),
        givenBy: sqlText(sql, "given_by_name") ?? (sql.state === "given" ? actor.name : "Unknown staff"),
      };
    case "needs_confirm": {
      const offDate = sql.off_date === "before" ? "before" : sql.off_date === "after" ? "after" : null;
      if (!offDate || typeof sql.days !== "number") throw new SevaError("internal");
      return anotherDay(row, today, offDate, sql.days);
    }
    case "cancelled":
    case "no_prasadam":
      return classify(row, today);
    default:
      throw new SevaError("internal");
  }
}

/**
 * Moves a given prasadam back to pending. The person who gave it may undo within the undo time; anyone else, or
 * later, needs prasadam.reverse (temple admin, super admin) and a reason (C-27). The SQL function checks again.
 */
export async function undoPrasadam(actor: SevaActor, body: PrasadamUndoRequest, now: Date = new Date()): Promise<void> {
  const [result, rules] = await Promise.all([
    createAdminClient()
      .from("seva_receipts")
      .select("prasadam_state, prasadam_given_at, prasadam_given_by_staff_id")
      .eq("id", body.receiptId)
      .maybeSingle(),
    readTimeRules(),
  ]);
  const row = rowOf(result);
  if (!row) throw new SevaError("not_found");

  const isAdmin = can(actor, "prasadam.reverse");
  if (row.prasadam_state === "given" && !isAdmin) {
    const givenAt = textOrNull(row, "prasadam_given_at");
    const ownInTime =
      textOrNull(row, "prasadam_given_by_staff_id") === actor.staffId &&
      givenAt !== null &&
      now.getTime() < Date.parse(givenAt) + rules.prasadamUndoSeconds * 1000;
    if (!ownInTime) throw new SevaError("forbidden", { reason: "undo_time_passed" });
  }

  await callRpc<unknown>("seva_undo_prasadam", {
    p_receipt_id: body.receiptId,
    p_staff_id: actor.staffId,
    p_reason: body.reason && body.reason !== "" ? body.reason : null,
    p_is_admin: isAdmin,
  });
}
