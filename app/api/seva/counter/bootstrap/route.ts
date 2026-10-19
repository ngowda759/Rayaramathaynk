/**
 * GET /api/seva/counter/bootstrap - receptionists, temple admins and super admins on a registered counter PC
 * (DB §6.5): catalogue, settings, slip header, denominations, festival chips, next numbers, the offline number and
 * group label floors, today's totals and UPI.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { liveDevice, loadBootstrap } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "counter.issue", { device: "required" });
  if (!guard.ok) return guard.response;
  try {
    return sevaJson(await loadBootstrap(guard.actor, liveDevice(guard.device), { origin: req.nextUrl.origin }));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
