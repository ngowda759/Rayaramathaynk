/**
 * POST /api/seva/receipts/cancel - cancels one or more receipts with a reason (DB §9.9, C-01, C-20).
 * Body: { receiptIds, reasonCode, note? } ('other' needs a note). A receptionist cancels their own receipts inside the
 * cancel window; a temple admin or super admin any receipt at any time (DB §3.3 rows 3-4). The SQL function is told
 * which rule applies (p_is_admin = the caller's receipt.cancel_any right) and checks it again in its transaction.
 * Answers the cancelled receipts as register rows (refundState 'done' = cash handed back from the drawer).
 * A receptionist cancels from the registered counter PC only; admins may cancel from the office (A3 security gate L-2).
 */
import type { NextRequest } from "next/server";
import { cancelSchema } from "@/lib/seva/schemas";
import { parseInput, readJson } from "@/lib/seva/server/read";
import { cancelReceipts, requireCancelRight } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  try {
    const body = parseInput(cancelSchema, await readJson(req));
    const guard = await requireCancelRight(req, body.receiptIds, "required_for_receptionist");
    if (!guard.ok) return guard.response;
    return sevaJson(await cancelReceipts(guard.actor, body, guard.device?.id ?? null));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
