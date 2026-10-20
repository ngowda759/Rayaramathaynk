/**
 * POST /api/seva/counter/refused/set-aside - a temple admin set office-refused outbox items aside on this PC after
 * writing them in the paper book (A5-FIX F5-1, review M-5). Each becomes one `sync.refused_set_aside` audit row with
 * the reason and when, written once, which takes the item off the dashboard's sync_refused card.
 *
 * Only someone who may resolve number gaps (a temple admin or super admin, not view-only), from the PC that held the
 * item; a retired PC is allowed, as for the outbox sync.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { liveDevice, noteSetAside, parseBody, readJsonBody, setAsideReportSchema } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "gap.resolve", { device: "required", retiredDevice: "allow" });
  if (!guard.ok) return guard.response;
  try {
    const device = liveDevice(guard.device);
    const { items } = parseBody(setAsideReportSchema, await readJsonBody(req));
    return sevaJson(await noteSetAside(guard.actor, device, items));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
