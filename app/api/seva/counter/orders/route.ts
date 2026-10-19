/**
 * POST /api/seva/counter/orders - issue an online counter order (DB §6.5 F1, §8.2) from a registered counter PC.
 * The body is the CounterOrderPayload; seva_issue_counter_order re-prices it from the catalogue and refuses it whole
 * when anything changed (price_changed, seva_inactive, ...), so nothing prints.
 */
import type { NextRequest } from "next/server";
import { counterOrderSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { fromSqlIssue, liveDevice, parseBody, readJsonBody, toSqlOrder } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { callRpc } from "@/lib/seva/server/rpc";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "counter.issue", { device: "required" });
  if (!guard.ok) return guard.response;
  try {
    const device = liveDevice(guard.device);
    const order = parseBody(counterOrderSchema, await readJsonBody(req));
    const answer = await callRpc<unknown>("seva_issue_counter_order", {
      p_order: toSqlOrder(order),
      p_staff_id: guard.actor.staffId,
      p_device_id: device.id,
    });
    return sevaJson(fromSqlIssue(answer));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
