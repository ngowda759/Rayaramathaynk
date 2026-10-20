/**
 * GET  /api/seva/settings/lists - the gotra, nakshatra and rashi lists (temple admins, view-only included).
 * POST /api/seva/settings/lists - adds a gotra or changes one list item (settings.edit, so view-only gets 403).
 * Plan A4P-5: nakshatra and rashi names are fixed except their Kannada spelling; nothing is deleted; every change is
 * audited by the SQL function.
 */
import type { NextRequest } from "next/server";
import { listItemSaveSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseSevaInput, readJsonBody } from "@/lib/seva/server/catalogue";
import { readLists, saveListItem } from "@/lib/seva/server/lists";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  const guard = await requireSevaActor(req, "reports.view");
  if (!guard.ok) return guard.response;
  try {
    return sevaJson(await readLists());
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "settings.edit");
  if (!guard.ok) return guard.response;
  try {
    const input = parseSevaInput(listItemSaveSchema, await readJsonBody(req));
    return sevaJson(await saveListItem(input, guard.actor.staffId));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
