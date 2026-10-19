/**
 * GET  /api/seva/settings/festivals - named festivals with their dates (temple admins, view-only included).
 * POST /api/seva/settings/festivals - adds a festival (settings.edit).
 */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { festivalSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { listFestivals, saveFestival } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "reports.view");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson({ festivals: await listFestivals() });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const festival = parseSevaInput(festivalSchema, await readJsonBody(req));
    if (festival.id !== undefined) {
      throw new SevaError("validation", { field: "id", message: "A new festival has no id. Use the edit route to change one." });
    }
    return sevaJson(await saveFestival(festival, undefined, guard.actor.staffId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
