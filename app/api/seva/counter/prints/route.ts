/**
 * POST /api/seva/counter/prints - records that slips came out of the printer (DB §9.8, C-22, C-23). A first print is
 * part of issuing (counter.issue). When any receipt was printed before, this is a DUPLICATE reprint and needs
 * receipt.reprint in that receipt's context - for a receptionist, only receipts of this PC's counter and of today
 * (DB §3.3 row 5); the guard decides, with the own-counter context taken from the verified PC.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import {
  fromSqlPrints,
  liveDevice,
  parseBody,
  printsRequestSchema,
  readJsonBody,
  readPrintTargets,
} from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { callRpc } from "@/lib/seva/server/rpc";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "counter.issue", { device: "required" });
  if (!guard.ok) return guard.response;
  try {
    const device = liveDevice(guard.device);
    const { receiptIds } = parseBody(printsRequestSchema, await readJsonBody(req));

    // One reprint check per counter and business date among the receipts printed before.
    const checked = new Set<string>();
    for (const target of await readPrintTargets(receiptIds)) {
      if (target.printCount < 1) continue;
      const key = `${target.counterId ?? "online"}|${target.businessDate}`;
      if (checked.has(key)) continue;
      checked.add(key);
      const reprint = await requireSevaActor(req, "receipt.reprint", {
        device: "required",
        ctx: {
          counterIdOfDevice: device.counterId,
          receiptCounterId: target.counterId ?? undefined,
          receiptBusinessDate: target.businessDate,
        },
      });
      if (!reprint.ok) return reprint.response;
    }

    const answer = await callRpc<unknown>("seva_record_prints", {
      p_receipt_ids: receiptIds,
      p_staff_id: guard.actor.staffId,
      p_device_id: device.id,
    });
    return sevaJson(fromSqlPrints(answer));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
