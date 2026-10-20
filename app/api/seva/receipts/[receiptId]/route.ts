/**
 * GET /api/seva/receipts/[receiptId] - one receipt with its history (prints, cancel, prasadam, audit rows), for the
 * same people as the register: temple admins (also view-only) and super admins any receipt; a receptionist only a
 * receipt of their PC's counter and today (DB §6.5, §12.3). An unknown id answers 404 only after the guard, so the
 * answer never tells a stranger which receipts exist.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { SevaError } from "@/lib/seva/errors";
import type { PermissionContext } from "@/lib/seva/permissions";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseInput } from "@/lib/seva/server/read";
import { getReceiptDetail, readReceiptFacts, receiptIdSchema } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const paramsSchema = z.object({ receiptId: receiptIdSchema });

export async function GET(req: NextRequest, { params }: { params: Promise<{ receiptId: string }> }) {
  try {
    const { receiptId } = parseInput(paramsSchema, await params);
    const facts = await readReceiptFacts(receiptId);
    const ctx: PermissionContext = {};
    if (facts) {
      if (facts.counterId !== null) ctx.receiptCounterId = facts.counterId;
      ctx.receiptBusinessDate = facts.businessDate;
    }
    const guard = await requireSevaActor(req, "receipts.list", { device: "optional", ctx });
    if (!guard.ok) return guard.response;
    if (!facts) throw new SevaError("not_found");
    return sevaJson(await getReceiptDetail(facts));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
