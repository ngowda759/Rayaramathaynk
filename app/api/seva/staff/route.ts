/**
 * GET  /api/seva/staff?filter=all|active|inactive - the staff list with each person's role (StaffListResponse).
 * GET  /api/seva/staff?view=next-staff-no         - the next free staff number for the onboard form.
 * POST /api/seva/staff                            - onboard a person -> 201 StaffOnboardResponse.
 *
 * For temple admins who are not view-only and for super admins (DB §6.5, §13.6). Which role a person may give is
 * judged per request in lib/seva/server/staff.ts (only a super admin gives Super admin). After a successful onboard
 * the client sends Firebase's own set-password email (C-56).
 */

import type { NextRequest } from "next/server";
import { staffOnboardSchema } from "@/lib/seva/schemas";
import { parseInput, queryOf, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { listStaff, nextStaffNo, onboardStaff, requireStaffAdmin, staffListQuerySchema } from "@/lib/seva/server/staff";
import type { NextStaffNoResponse, StaffListResponse } from "@/types/seva-staff";

export async function GET(req: NextRequest) {
  const guard = await requireStaffAdmin(req);
  if (!guard.ok) return guard.response;
  try {
    const query = parseInput(staffListQuerySchema, queryOf(req));
    if (query.view === "next-staff-no") {
      return sevaJson<NextStaffNoResponse>({ nextStaffNo: await nextStaffNo() });
    }
    return sevaJson<StaffListResponse>({ staff: await listStaff(query.filter) });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffAdmin(req);
  if (!guard.ok) return guard.response;
  try {
    const body = parseInput(staffOnboardSchema, await readJson(req));
    return sevaJson(await onboardStaff(guard.actor, body), { status: 201 });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
