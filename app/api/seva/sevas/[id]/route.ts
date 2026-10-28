/**
 * GET /api/seva/sevas/[id] - the seva's rate history (sevas.read).
 * PUT /api/seva/sevas/[id] - edits a seva (sevas.edit); a rate change needs `reason` (SQL: change_reason_required).
 * The save writes Supabase only; the answer keeps the `{ id, mirror: 'ok' }` shape for existing callers.
 */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { sevaUpsertSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, rateHistory, readJsonBody, saveSeva, sevaDbIdSchema } from "@/lib/seva/server/catalogue";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireSevaActor(req, "sevas.read");
  if (!guard.ok) return guard.response;
  try {
    const { id } = await params;
    const sevaId = parseSevaInput(sevaDbIdSchema, id);
    return sevaJson({ history: await rateHistory(sevaId) });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSevaActor(req, "sevas.edit");
  if (!guard.ok) return guard.response;
  try {
    const { id } = await params;
    const sevaId = parseSevaInput(sevaDbIdSchema, id);
    const seva = parseSevaInput(sevaUpsertSchema, await readJsonBody(req));
    if (seva.id !== undefined && seva.id.toLowerCase() !== sevaId.toLowerCase()) {
      throw new SevaError("validation", { field: "id", message: "The seva in the body is not the one being edited." });
    }
    return sevaJson(await saveSeva(seva, sevaId, guard.actor.staffId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
