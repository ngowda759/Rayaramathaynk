/**
 * POST /api/seva/reports/export/audit { format, from, to, parts, includePhones } - the browser builds the files
 * (C-41) and reports each export here; writes `export.download` with format, range, parts and the phone flag (DB 12.6).
 */

import type { NextRequest } from "next/server";
import { exportAuditSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseInput, readJson, writeExportAudit } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  try {
    const body = parseInput(exportAuditSchema, await readJson(req));

    const guard = await requireSevaActor(req, body.includePhones ? "export.with_phones" : "export.basic");
    if (!guard.ok) return guard.response;

    await writeExportAudit(guard.actor, body);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
