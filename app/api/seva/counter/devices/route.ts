/**
 * POST /api/seva/counter/devices - temple admins and super admins (DB §6.5, §8.4): register this PC for a counter, or
 * "Replace this PC" with the number on the last slip the old PC printed. Only the SHA-256 hash of the PC's secret is
 * sent and stored. No device header is needed: the PC is not registered yet.
 */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { deviceRegisterSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseBody, readJsonBody } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { callRpc } from "@/lib/seva/server/rpc";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "device.register");
  if (!guard.ok) return guard.response;
  try {
    const body = parseBody(deviceRegisterSchema, await readJsonBody(req));
    const deviceId =
      body.action === "register"
        ? await callRpc<unknown>("seva_register_device", {
            p_counter_id: body.counterId,
            p_secret_hash: body.secretHash,
            p_label: body.label,
            p_staff_id: guard.actor.staffId,
          })
        : await callRpc<unknown>("seva_replace_device", {
            p_counter_id: body.counterId,
            p_secret_hash: body.secretHash,
            p_label: body.label,
            p_last_printed_of_no: body.lastPrintedOfNo,
            // The slip's IST year (A5-FIX M-4); without it the six-argument form means this year.
            ...(body.lastPrintedYear === undefined ? {} : { p_last_printed_year: body.lastPrintedYear }),
            p_reason: body.reason,
            p_staff_id: guard.actor.staffId,
          });
    if (typeof deviceId !== "string") throw new SevaError("internal");
    return sevaJson({ deviceId });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
