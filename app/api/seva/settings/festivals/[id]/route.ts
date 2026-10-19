/** PUT /api/seva/settings/festivals/[id] - edits a festival; the dates given replace its dates (settings.edit). */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { festivalSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody, sevaDbIdSchema } from "@/lib/seva/server/catalogue";
import { saveFestival } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const { id } = await params;
    const festivalId = parseSevaInput(sevaDbIdSchema, id);
    const festival = parseSevaInput(festivalSchema, await readJsonBody(req));
    if (festival.id !== undefined && festival.id.toLowerCase() !== festivalId.toLowerCase()) {
      throw new SevaError("validation", { field: "id", message: "The festival in the body is not the one being edited." });
    }
    return sevaJson(await saveFestival(festival, festivalId, guard.actor.staffId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
