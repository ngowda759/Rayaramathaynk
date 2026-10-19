/** GET /api/seva/reports/festival?festivalId&compareYear -> FestivalReport (DB 12.4 festival view). */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { festivalQuerySchema, loadFestivalReport, parseInput, queryOf } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "reports.view");
    if (!guard.ok) return guard.response;

    const { festivalId, compareYear } = parseInput(festivalQuerySchema, queryOf(req));
    return sevaJson(await loadFestivalReport(festivalId, compareYear));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
