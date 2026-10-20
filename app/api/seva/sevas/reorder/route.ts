/** PUT /api/seva/sevas/reorder - `{ ids }` in the new counter-key order 1..n (sevas.edit). */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody, reorderSevas, sevaDbIdSchema } from "@/lib/seva/server/catalogue";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const reorderSchema = z.object({
  ids: z
    .array(sevaDbIdSchema)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, "A seva is listed twice"),
});

export async function PUT(req: NextRequest) {
  const guard = await requireSevaActor(req, "sevas.edit");
  if (!guard.ok) return guard.response;
  try {
    const { ids } = parseSevaInput(reorderSchema, await readJsonBody(req));
    await reorderSevas(ids, guard.actor.staffId);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
