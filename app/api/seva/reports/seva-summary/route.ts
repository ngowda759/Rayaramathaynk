/** GET /api/seva/reports/seva-summary?from&to -> SevaSummaryReport (DB 12.4; by seva date, with last year, C-63). */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { loadSevaSummary, parseInput, queryOf, rangeQuerySchema } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "reports.view");
    if (!guard.ok) return guard.response;

    const { from, to } = parseInput(rangeQuerySchema, queryOf(req));
    return sevaJson(await loadSevaSummary(from, to));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
