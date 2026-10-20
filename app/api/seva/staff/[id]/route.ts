/**
 * PUT /api/seva/staff/[id] - change another person's role, view-only switch or status (DB §3.3 rows 19-23, §3.4).
 *
 * Temple admins (not view-only) change roles and view-only below super admin and reactivate; only super admins give
 * Super admin, deactivate (offboard) and delete, and those two need a reason. A step that fails after an earlier one
 * went through answers 502 partial_failure with what was done and what failed (lib/seva/server/staff.ts).
 */

import type { NextRequest } from "next/server";
import { staffUpdateSchema } from "@/lib/seva/schemas";
import { parseInput, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { requireStaffAdmin, updateStaff } from "@/lib/seva/server/staff";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaffAdmin(req);
  if (!guard.ok) return guard.response;
  try {
    const { id } = await params;
    const patch = parseInput(staffUpdateSchema, await readJson(req));
    await updateStaff(guard.actor, id, patch);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
