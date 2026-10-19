/**
 * GET /api/seva/reports/export?part&from&to&cursor&includePhones -> { rows; nextCursor } (DB 12.6, C-41).
 * One part a call, 1000 rows a page, test mode excluded. `includePhones=true` needs `export.with_phones` (non-view-only
 * temple admins and super admins, C-16); without it `export.basic` is enough and the phone is never read. The wanted
 * right depends on the query, so the query is read before the guard.
 */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { exportQuerySchema, loadExportPage, parseInput, queryOf } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const q = parseInput(exportQuerySchema, queryOf(req));

    const guard = await requireSevaActor(req, q.includePhones ? "export.with_phones" : "export.basic");
    if (!guard.ok) return guard.response;

    return sevaJson(await loadExportPage(q));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
