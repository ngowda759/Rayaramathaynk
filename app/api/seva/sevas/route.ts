/**
 * GET  /api/seva/sevas - the whole catalogue in counter-key order (receptionists, temple admins, super admins).
 * POST /api/seva/sevas - adds a seva (sevas.edit); Supabase `sevas` is the source of truth (no Firestore mirror).
 */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { sevaUpsertSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { listCatalogue, parseSevaInput, readJsonBody, saveSeva } from "@/lib/seva/server/catalogue";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "sevas.read");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson({ sevas: await listCatalogue() });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "sevas.edit");
  if (!guard.ok) return guard.response;
  try {
    const seva = parseSevaInput(sevaUpsertSchema, await readJsonBody(req));
    if (seva.id !== undefined) {
      throw new SevaError("validation", { field: "id", message: "A new seva has no id. Use the edit route to change one." });
    }
    return sevaJson(await saveSeva(seva, undefined, guard.actor.staffId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
