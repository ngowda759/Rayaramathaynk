/**
 * POST /api/seva/counter/refused - a registered counter PC reports the outbox items the office refused (A5-FIX F5-1,
 * review M-5): each one's receipt numbers, the office's code and when. Each becomes one `sync.refused` audit row for
 * this PC, written once, and the dashboard's sync_refused card lists it until a temple admin sets it aside on the PC.
 *
 * The counter's own guard, as the outbox sync: anyone who may issue at the counter, from the PC that holds the item.
 * Like the sync, a retired PC is allowed: its late uploads can be refused too.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { liveDevice, noteRefused, parseBody, readJsonBody, refusedReportSchema } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "counter.issue", { device: "required", retiredDevice: "allow" });
  if (!guard.ok) return guard.response;
  try {
    const device = liveDevice(guard.device);
    const { items } = parseBody(refusedReportSchema, await readJsonBody(req));
    return sevaJson(await noteRefused(guard.actor, device, items));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
