/**
 * Day-close repository (DB §9.10, C-24 to C-26). Reads and writes go through the A2-2 SQL functions
 * `seva_prepare_day_close`, `seva_close_day` and `seva_reopen_day`; money crosses the wire as integer paise and the
 * SQL as rupee strings.
 */

import "server-only";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { fromPaise, toPaise } from "@/lib/seva/money";
import type { SevaActor } from "@/lib/seva/permissions";
import { reasonText, type DayCloseRequest } from "@/lib/seva/schemas";
import type { DayClosePrep } from "@/types/seva-dayclose";
import { isoDateParam } from "./reports";
import { callRpc } from "./rpc";

/** `GET /api/seva/day-close?counterId&date` - both optional (the device's counter, today in IST). */
export const dayClosePrepareQuerySchema = z.object({
  counterId: z.coerce.number().int().min(1).max(99).optional(),
  date: isoDateParam.optional(),
});

/** `POST /api/seva/day-close/reopen` (C-24: a reason of at least 3 characters). */
export const dayCloseReopenSchema = z.object({
  dayCloseId: z.guid(),
  // A5-FIX L-11: 3 visible characters, as the table check day_closes_reopen_reason asks.
  reason: reasonText(3, 500),
});

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new SevaError("internal");
  return value as Record<string, unknown>;
}

function int(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  throw new SevaError("internal");
}

function paise(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new SevaError("internal");
  try {
    return toPaise(value);
  } catch {
    throw new SevaError("internal");
  }
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new SevaError("internal");
  return value;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The snake_case answer of `seva_prepare_day_close` in wire form. */
export function fromSqlPrep(raw: unknown): DayClosePrep {
  const row = record(raw);
  const status = text(row.status);
  if (status !== "open" && status !== "closed" && status !== "reopened") throw new SevaError("internal");
  return {
    counterId: int(row.counter_id),
    businessDate: text(row.business_date),
    status,
    openingFloatPaise: paise(row.opening_float),
    receipts: int(row.receipts),
    cancelled: int(row.cancelled),
    changed: int(row.changed),
    cashExpectedPaise: paise(row.cash_expected),
    upiCount: int(row.upi_count),
    upiExpectedPaise: paise(row.upi_expected),
    outboxPending: int(row.outbox_pending),
    seriesRanges: list(row.series_ranges).map((item) => {
      const r = record(item);
      return {
        series: text(r.series),
        first: textOrNull(r.first),
        last: textOrNull(r.last),
        issued: int(r.issued),
        cancelled: int(r.cancelled),
        openGaps: int(r.open_gaps),
      };
    }),
    denominations: list(row.denominations).map((item) => {
      const d = record(item);
      const kind = text(d.kind);
      if (kind !== "note" && kind !== "coin") throw new SevaError("internal");
      return { kind, valuePaise: paise(d.value) };
    }),
  };
}

export async function prepareDayClose(counterId: number, businessDate: string): Promise<DayClosePrep> {
  const raw = await callRpc<unknown>("seva_prepare_day_close", { p_counter_id: counterId, p_business_date: businessDate });
  return fromSqlPrep(raw);
}

/**
 * Closes the day; the SQL function re-checks the outbox (and that the counter PC was seen in the last 2 minutes), the
 * difference note and an already-closed day. Only a temple admin may close with the counter offline (A5-FIX M-2).
 */
export async function closeDay(actor: SevaActor, body: DayCloseRequest): Promise<{ dayCloseId: string }> {
  const offlineOk = body.counterOfflineOk === true && (actor.role === "temple_admin" || actor.role === "super_admin");
  const id = await callRpc<unknown>("seva_close_day", {
    ...(offlineOk ? { p_counter_offline_ok: true } : {}),
    p_counter_id: body.counterId,
    p_business_date: body.businessDate,
    // seva_close_day wants JSON numbers in rupees; a denomination is at most Rs 2,000.00, so this is exact.
    p_counts: body.counts.map((c) => ({ kind: c.kind, value: Number(fromPaise(c.valuePaise)), count: c.count })),
    p_upi_bank_total:
      body.upiBankTotalPaise === null || body.upiBankTotalPaise === undefined ? null : fromPaise(body.upiBankTotalPaise),
    p_note: body.note ? body.note : null,
    p_staff_id: actor.staffId,
  });
  if (typeof id !== "string") throw new SevaError("internal");
  return { dayCloseId: id };
}

export async function reopenDay(actor: SevaActor, dayCloseId: string, reason: string): Promise<void> {
  await callRpc<unknown>("seva_reopen_day", { p_day_close_id: dayCloseId, p_reason: reason, p_staff_id: actor.staffId });
}
