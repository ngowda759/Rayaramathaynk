/**
 * GET /api/seva/settings/denominations - the notes and coins day close counts (temple admins, view-only included).
 * PUT /api/seva/settings/denominations - replaces them (settings.edit); values Rs 0.01 to Rs 2,000, note or coin.
 */
import type { NextRequest } from "next/server";
import { denominationsSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { getDenominations, saveDenominations } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "reports.view");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson(await getDenominations());
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const input = parseSevaInput(denominationsSchema, await readJsonBody(req));
    await saveDenominations(input, guard.actor.staffId);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
