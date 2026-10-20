/**
 * GET /api/seva/settings/template - the receipt slip header, footer and which devotee details print (temple admins,
 * view-only included).
 * PUT /api/seva/settings/template - a partial update of those fields (settings.edit); other settings keys are refused.
 */
import type { NextRequest } from "next/server";
import { settingsPatchSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { getTemplate, saveSettings } from "@/lib/seva/server/settings";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "reports.view");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson(await getTemplate());
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const patch = parseSevaInput(settingsPatchSchema, await readJsonBody(req));
    await saveSettings("template", patch, guard.actor.staffId);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
