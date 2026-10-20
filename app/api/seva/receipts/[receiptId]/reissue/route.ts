/**
 * POST /api/seva/receipts/[receiptId]/reissue - spoiled print: cancels the slip and issues the next number of this
 * counter on the same payment with a fresh QR token (DB §9.8, C-21). Today's receipts only: the SQL function refuses
 * an earlier day's slip with `validation` / `reissue_only_today`, and the counter offers a DUPLICATE reprint instead.
 * From the registered counter PC; the caller's own receipt inside the cancel window, or any as temple admin or super
 * admin (DB §6.5). Answers the order as the counter reads it (IssueResponse).
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import { parseInput } from "@/lib/seva/server/read";
import { receiptIdSchema, reissueSpoiled, requireCancelRight } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const paramsSchema = z.object({ receiptId: receiptIdSchema });

export async function POST(req: NextRequest, { params }: { params: Promise<{ receiptId: string }> }) {
  try {
    const { receiptId } = parseInput(paramsSchema, await params);
    const guard = await requireCancelRight(req, [receiptId], "required");
    if (!guard.ok) return guard.response;
    if (!guard.device) throw new SevaError("device_required");
    return sevaJson(await reissueSpoiled(guard.actor, guard.device.id, receiptId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
