/**
 * GET /api/seva/reports/audit?type&staffId&from&to&cursor -> { rows: AuditEntry[]; nextCursor } (DB 12.4 audit trail,
 * newest first). Read-only; audit rows never carry phone numbers (stripped when written).
 */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { auditQuerySchema, loadAudit, parseInput, queryOf } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "reports.view");
    if (!guard.ok) return guard.response;

    const q = parseInput(auditQuerySchema, queryOf(req));
    return sevaJson(await loadAudit(q));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
