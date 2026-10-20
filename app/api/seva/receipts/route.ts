/**
 * GET /api/seva/receipts - the register list (DB §12.3) and the counter's Today's receipts (DB §9.9).
 * Filters: from, to, sevaId, mode, status (issued | cancelled | changed | duplicate | prasadam_pending), q (number or
 * name), cursor. Temple admins (also view-only) and super admins see every counter; a receptionist must call from the
 * registered PC and sees only that counter's receipts of today's IST business date, whatever filters are sent
 * (DB §3.3, C-59). Test-mode receipts are left out; no phone number is ever returned. The PC's counter comes from the
 * guard, which verifies the PC only after the sign-in (A3 security gate L-1).
 */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { can } from "@/lib/seva/permissions";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseInput, queryOf } from "@/lib/seva/server/read";
import { listReceipts, RECEIPT_LIST_KEYS, receiptListQuerySchema } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { businessDate } from "@/lib/seva/time";

export async function GET(req: NextRequest) {
  try {
    const today = businessDate(new Date());
    // The list a receptionist may see is named by the PC they call from, so its counter is part of the check.
    const guard = await requireSevaActor(req, "receipts.list", {
      device: "optional",
      counterFromDevice: true,
      ctx: { receiptBusinessDate: today },
    });
    if (!guard.ok) return guard.response;

    const query = parseInput(receiptListQuerySchema, queryOf(req, RECEIPT_LIST_KEYS));
    const ownCounterOnly = !can(guard.actor, "receipts.list");
    if (ownCounterOnly && !guard.device) throw new SevaError("device_required");
    const scope =
      ownCounterOnly && guard.device
        ? { counterId: guard.device.counterId, businessDate: today }
        : { counterId: null, businessDate: null };
    return sevaJson(await listReceipts(query, scope));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
