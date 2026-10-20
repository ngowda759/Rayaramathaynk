/**
 * GET /api/seva/me - any staff member (DB §6.5): role, staff no., view-only, allowed actions and, when a live counter
 * PC's header came with the call, its counter. An invited person's first call marks them active.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { loadSevaMe } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "me", { device: "optional" });
  if (!guard.ok) return guard.response;
  try {
    return sevaJson(await loadSevaMe(guard.actor, guard.device));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
