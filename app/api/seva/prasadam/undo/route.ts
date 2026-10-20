/**
 * POST /api/seva/prasadam/undo - moves a given prasadam back to pending (DB §11, C-27). Body: { receiptId, reason? }.
 * The person who gave it may undo within the undo time (120 s by default); after that, or for anyone else, only a
 * temple admin or super admin (prasadam.reverse) with a reason of at least 3 characters.
 */
import type { NextRequest } from "next/server";
import { prasadamUndoSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { undoPrasadam } from "@/lib/seva/server/prasadam";
import { parseInput, readJson } from "@/lib/seva/server/read";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "prasadam.give");
  if (!guard.ok) return guard.response;
  try {
    const body = parseInput(prasadamUndoSchema, await readJson(req));
    await undoPrasadam(guard.actor, body);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
