/** GET /api/seva/reports/continuity?from&to -> ContinuityRow[] (DB 12.3, the register's number continuity card). */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { loadContinuity, parseInput, queryOf, rangeQuerySchema } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "reports.view");
    if (!guard.ok) return guard.response;

    const { from, to } = parseInput(rangeQuerySchema, queryOf(req));
    return sevaJson(await loadContinuity(from, to));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
