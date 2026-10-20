/**
 * POST /api/seva/receipts/refund - marks refund-due receipts as refunded (DB §9.9, A5-FIX M-3).
 * Body: { receiptIds, mode: 'upi' | 'bank_transfer' | 'cash', reference (required unless cash), note (3+ characters) }.
 * Temple admins and super admins only (receipt.cancel_any; view-only refused); from the office or a counter PC. The
 * SQL function seva_settle_refund refuses a receipt whose refund is not due and writes receipt.refund_done. Answers
 * the receipts as register rows.
 */
import type { NextRequest } from "next/server";
import { refundSettleSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseInput, readJson } from "@/lib/seva/server/read";
import { REFUND_SETTLE_ACTION, settleRefunds } from "@/lib/seva/server/refunds";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, REFUND_SETTLE_ACTION);
  if (!guard.ok) return guard.response;
  try {
    const body = parseInput(refundSettleSchema, await readJson(req));
    return sevaJson(await settleRefunds(guard.actor, body));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
