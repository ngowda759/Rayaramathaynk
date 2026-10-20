/**
 * GET /api/seva/prasadam/lookup?q= - finds a receipt for the prasadam counter by QR URL (a USB scanner types it and
 * presses Enter), bare token, full receipt number or short form ('C1 124', 'C1/124', '124' for this IST year), and
 * answers the screen to show (DB §11, C-51). A short form that matches several series answers `choose`.
 * Prasadam counter, temple admins, super admins. No amounts and no phone number in any answer.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { lookupPrasadam, prasadamLookupQuerySchema } from "@/lib/seva/server/prasadam";
import { parseInput, queryOf } from "@/lib/seva/server/read";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "prasadam.give");
  if (!guard.ok) return guard.response;
  try {
    const { q } = parseInput(prasadamLookupQuerySchema, queryOf(req, ["q"]));
    return sevaJson(await lookupPrasadam(q));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
