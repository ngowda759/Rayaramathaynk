/** GET /api/seva/reports/day-closes?from&to -> DayCloseListRow[] (DB 12.4: one row per counter per day, with counts). */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { loadDayCloses, parseInput, queryOf, rangeQuerySchema } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "reports.view");
    if (!guard.ok) return guard.response;

    const { from, to } = parseInput(rangeQuerySchema, queryOf(req));
    return sevaJson(await loadDayCloses(from, to));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
