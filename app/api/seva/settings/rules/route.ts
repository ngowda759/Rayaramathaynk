/**
 * GET /api/seva/settings/rules - the counter rules and Tally ledger names (temple admins, view-only included). The
 * switches for the cash-difference note and the changed-amount reason are never exposed: both are always required.
 * PUT /api/seva/settings/rules - a partial update of those fields (settings.edit); other settings keys are refused.
 */
import type { NextRequest } from "next/server";
import { settingsPatchSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { getRules, saveSettings } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "reports.view");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson(await getRules());
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const patch = parseSevaInput(settingsPatchSchema, await readJsonBody(req));
    await saveSettings("rules", patch, guard.actor.staffId);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
