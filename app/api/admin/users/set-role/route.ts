/**
 * POST /api/admin/users/set-role { email, role } - sets a person's Firestore role (older admin route, kept for its
 * callers; same body, same role names and the same success answer as before).
 *
 * It answers to the staff rules of the seva module (DB §13.6, §17.1), through lib/seva/server/staff.ts:
 * - only a signed-in, active temple admin (not view-only) or super admin may call it;
 * - only a super admin gives `super_admin` (DB §3.3 row 19);
 * - a temple admin changes only another person who has a staff row and is below super admin (row 20, C-17);
 *   everyone else - and any legacy role - is a super admin's call (C-62);
 * - a change for someone with a staff row writes the staff.role_change audit row.
 * Errors use the seva shape `{ error: { code, message } }`.
 *
 * The person is found by their sign-in email in Firebase Auth, never by the Firestore profile's own email field, which
 * the person can edit (A1 security gate L-4). An account that never signed in has no profile and is not found.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRateLimitResponse, getClientIP, rateLimit } from "@/lib/rate-limit";
import { SevaError } from "@/lib/seva/errors";
import { parseInput, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse } from "@/lib/seva/server/respond";
import { requireStaffAdmin, setAccountRole } from "@/lib/seva/server/staff";

const ROLES = ["devotee", "volunteer", "admin", "billing", "super_admin"] as const;

const setRoleSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  role: z.enum(ROLES, { error: `Invalid role. Must be one of: ${ROLES.join(", ")}` }),
});

/** The Firebase Auth account for a sign-in email (this route is Firebase-specific by nature). */
async function findLoginUid(email: string): Promise<string> {
  const { getAdminApp } = await import("@/lib/admin-firebase");
  const { getAuth } = await import("firebase-admin/auth");
  try {
    return (await getAuth(await getAdminApp()).getUserByEmail(email)).uid;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "auth/user-not-found") {
      throw new SevaError("not_found", { entity: "user" });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`set-role:${getClientIP(request)}`, { windowMs: 60 * 1000, maxRequests: 10 });
  if (!limit.success) return createRateLimitResponse(limit);

  const guard = await requireStaffAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const { email, role } = parseInput(setRoleSchema, await readJson(request));
    const userId = await findLoginUid(email);
    await setAccountRole(guard.actor, { externalUid: userId, role });
    return NextResponse.json(
      { success: true, message: `User ${email} has been set as ${role}`, userId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
