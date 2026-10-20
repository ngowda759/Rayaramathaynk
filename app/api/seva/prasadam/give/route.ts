/**
 * POST /api/seva/prasadam/give - marks a receipt's prasadam given, once per receipt (DB §11, C-27, D35).
 * Body: { receiptId, confirmOffDate }. A seva date other than today first answers `another_day`; the second tap sends
 * confirmOffDate true (prasadam.give_off_date). A successful give answers `already_given` with this give's time and
 * name, shown as "Marked given" with Undo. Prasadam counter, temple admins, super admins. No amounts, no phone.
 */
import type { NextRequest } from "next/server";
import { prasadamGiveSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { givePrasadam } from "@/lib/seva/server/prasadam";
import { parseInput, readJson } from "@/lib/seva/server/read";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  try {
    const body = parseInput(prasadamGiveSchema, await readJson(req));
    const guard = await requireSevaActor(req, body.confirmOffDate ? "prasadam.give_off_date" : "prasadam.give");
    if (!guard.ok) return guard.response;
    return sevaJson(await givePrasadam(guard.actor, body));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
