/**
 * GET /api/seva/devotees/search?name=|phone= - returning-devotee matches for the counter (DB §9.2, C-32): 3+ letters
 * of a name (prefix) or a full mobile number. At most five matches `{ name, gotra, gotraId, nakshatraId, rashiId,
 * phoneLast4, lastVisit }`, newest visit first; never the full phone. Receptionists, temple admins, super admins.
 */
import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseInput, queryOf } from "@/lib/seva/server/read";
import { devoteeSearchQuerySchema, searchDevotees } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "devotees.search");
  if (!guard.ok) return guard.response;
  try {
    const query = parseInput(devoteeSearchQuerySchema, queryOf(req, ["name", "phone"]));
    return sevaJson({ matches: await searchDevotees(query) });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
