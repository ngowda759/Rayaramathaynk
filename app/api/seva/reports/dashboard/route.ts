/**
 * GET /api/seva/reports/dashboard?period=today|week|month|year -> { data: DashboardData; attention: NeedsAttentionCard[] }
 * (DB 12.1, 12.2). Like-for-like IST spans from `periodRange`; kept in the viewer's browser cache for 60 seconds.
 */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { dashboardQuerySchema, loadDashboard, parseInput, queryOf } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "reports.view");
    if (!guard.ok) return guard.response;

    const { period } = parseInput(dashboardQuerySchema, queryOf(req));
    const answer = await loadDashboard(period, new Date());
    return sevaJson(answer, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
