/** PUT /api/seva/settings/counters/[id] - changes a counter's name, place, opening float or active flag (settings.edit). */
import type { NextRequest } from "next/server";
import { counterSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { parseCounterId, updateCounter } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const counterPatchSchema = counterSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to save");

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const { id } = await params;
    const counterId = parseCounterId(id);
    const patch = parseSevaInput(counterPatchSchema, await readJsonBody(req));
    await updateCounter(counterId, patch, guard.actor.staffId);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
