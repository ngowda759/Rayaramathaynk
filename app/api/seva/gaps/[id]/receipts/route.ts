/**
 * POST /api/seva/gaps/[id]/receipts - enters one receipt of an open number gap from the paper book (C-52, DB §8.5,
 * A5-FIX M-6). Body: { receiptNo (as printed), issuedOn, sevaDate, devotee, lines [{ sevaId, quantity,
 * unitRatePaise? }], totalPaise, payment { mode: 'cash' } | { mode: 'upi', upiRefLast6 }, note }. Temple admins and
 * super admins (gap.resolve; view-only refused). seva_enter_paper_receipt stores the receipt under its printed number,
 * shrinks the gap and closes it as entered_from_paper with its last number; audited receipt.entered_from_paper.
 * Answers { receipt (a register row), gapStatus: 'open' | 'entered_from_paper' }.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { paperReceiptSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { enterPaperReceipt, PAPER_ENTRY_ACTION } from "@/lib/seva/server/gaps";
import { parseInput, readJson } from "@/lib/seva/server/read";
import { gapIdSchema } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const paramsSchema = z.object({ id: gapIdSchema });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSevaActor(req, PAPER_ENTRY_ACTION);
  if (!guard.ok) return guard.response;
  try {
    const { id } = parseInput(paramsSchema, await params);
    const body = parseInput(paperReceiptSchema, await readJson(req));
    return sevaJson(await enterPaperReceipt(guard.actor, id, body));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
