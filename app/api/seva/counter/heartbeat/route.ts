/**
 * POST /api/seva/counter/heartbeat - every 60 s from a registered counter PC (DB §8.3, §9.12): stores the outbox size,
 * clock skew and app version and answers the server time, the OF number floor, the group label floor and whether
 * today is closed for the counter.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { fromSqlHeartbeat, heartbeatRequestSchema, liveDevice, parseBody, readJsonBody } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { callRpc } from "@/lib/seva/server/rpc";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "counter.heartbeat", { device: "required" });
  if (!guard.ok) return guard.response;
  try {
    const device = liveDevice(guard.device);
    const beat = parseBody(heartbeatRequestSchema, await readJsonBody(req));
    const answer = await callRpc<unknown>("seva_heartbeat", {
      p_device_id: device.id,
      p_outbox_count: beat.outboxCount,
      p_clock_skew_ms: beat.clockSkewMs,
      p_app_version: beat.appVersion,
    });
    return sevaJson(fromSqlHeartbeat(answer));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
