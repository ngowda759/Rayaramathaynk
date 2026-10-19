/**
 * GET  /api/seva/settings/counters - counters with their C<n> and OF<n> series (temple admins, view-only included).
 * POST /api/seva/settings/counters - `{ name, place }` adds the next counter and answers its new series (settings.edit).
 */
import type { NextRequest } from "next/server";
import { counterSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { addCounter, listCounters } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const addCounterSchema = counterSchema.pick({ name: true, place: true });

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "reports.view");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson({ counters: await listCounters() });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const input = parseSevaInput(addCounterSchema, await readJsonBody(req));
    return sevaJson(await addCounter(input, guard.actor.staffId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
