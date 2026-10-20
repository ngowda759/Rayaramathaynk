/**
 * GET /api/seva/devotees/search?name=|phone= - returning-devotee matches for the counter (DB §9.2, C-32): 3+ letters
 * of a name (prefix) or a full mobile number. At most five matches `{ name, gotra, gotraId, nakshatraId, rashiId,
 * phoneLast4, lastVisit }`, newest visit first; never the full phone. Receptionists, temple admins, super admins.
 * A receptionist searches from the registered counter PC only, and everyone is held to a per-person limit, so the
 * profiles cannot be listed by walking name prefixes (A3 security gate L-2, C-37, C-59).
 */
import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { rateLimit } from "@/lib/seva/server/rate-limit";
import { parseInput, queryOf } from "@/lib/seva/server/read";
import { devoteeSearchQuerySchema, searchDevotees } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

/** Searches per person per minute: far above a counter's real pace, far below a walk through every name prefix. */
const SEARCH_LIMIT = { limit: 60, windowMs: 60_000 };

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "devotees.search", { device: "required_for_receptionist" });
  if (!guard.ok) return guard.response;
  try {
    // The limiter is in memory, so it counts per server instance (lib/seva/server/rate-limit.ts).
    if (!rateLimit(`devotees.search:${guard.actor.staffId}`, SEARCH_LIMIT)) throw new SevaError("rate_limited");
    const query = parseInput(devoteeSearchQuerySchema, queryOf(req, ["name", "phone"]));
    return sevaJson({ matches: await searchDevotees(query) });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
