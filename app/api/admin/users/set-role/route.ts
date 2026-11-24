/**
 * POST /api/admin/users/set-role { email, role } - sets a person's role.
 *
 * Answers to the staff rules of the seva module (DB §13.6, §17.1), through lib/seva/server/staff.ts:
 * - only a signed-in, active temple admin (not view-only) or super admin may call it;
 * - only a super admin gives `super_admin` (DB §3.3 row 19);
 * - a temple admin changes only another person who has a staff row and is below super admin (row 20, C-17);
 *   everyone else is a super admin's call (C-62);
 * - a change for someone with a staff row writes the staff.role_change audit row.
 * - Identity is resolved from Supabase Auth and the `public.users` row by `auth_user_id`; the route never
 *   links or re-points a row by matching an email. A user without a linked profile is `404 not_found`.
 * Errors use the seva shape `{ error: { code, message } }`.
 *
 * Identity resolution uses Supabase Auth only.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminConsoleRole } from "@/lib/auth/admin-auth";
import { normalizedEmailSchema, tryNormalizeEmailAddress } from "@/lib/auth/email-normalization";
import { createRateLimitResponse, getClientIP, rateLimit } from "@/lib/rate-limit";
import { SevaError } from "@/lib/seva/errors";
import { can, mapFirestoreRole } from "@/lib/seva/permissions";
import { parseInput, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse } from "@/lib/seva/server/respond";
import { getIdentityAdapter } from "@/lib/seva/server/identity";
import { requireStaffAdmin, setAccountRole } from "@/lib/seva/server/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";

const ROLES = ["devotee", "volunteer", "admin", "billing", "super_admin"] as const;

const setRoleSchema = z.object({
  email: normalizedEmailSchema("Invalid email format"),
  role: z.enum(ROLES, { error: `Invalid role. Must be one of: ${ROLES.join(", ")}` }),
});

/**
 * Resolves the sign-in account identity for an email via Supabase Auth only.
 * Fails closed: when the Auth service cannot answer (missing service, thrown
 * error, or a non-"not found" error result) it throws `internal` (500) rather
 * than `not_found`, so an outage can never be read as "this user does not exist".
 */
async function findLoginUid(email: string): Promise<string> {
  const normalized = tryNormalizeEmailAddress(email);
  if (!normalized.ok) {
    throw new SevaError("validation", { field: "email", message: "Invalid email format" });
  }
  const normalizedEmail = normalized.email;

  let adminAuth: {
    getUserByEmail?: (e: string) => Promise<{ data?: { user?: { id?: string } | null } | null; error?: unknown }>;
    listUsers?: () => Promise<{ data?: { users?: { id?: string; email?: string | null }[] } | null; error?: unknown }>;
  } | undefined;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    adminAuth = (supabase as unknown as { auth?: { admin?: typeof adminAuth } })?.auth?.admin;
  } catch (error) {
    console.error("[set-role] Supabase Auth client unavailable:", error);
    throw new SevaError("internal", { message: "Supabase Auth is unavailable" });
  }

  if (!adminAuth || typeof adminAuth.getUserByEmail !== "function") {
    throw new SevaError("internal", { message: "Supabase Auth Admin lookup service is unavailable" });
  }

  try {
    const { data, error } = await adminAuth.getUserByEmail(normalizedEmail);
    if (!error && data?.user?.id) {
      return data.user.id;
    }
    // A "user not found" result is the only outcome that means the account does not exist; any other
    // error is a service failure and must fail closed.
    if (error && !isUserNotFoundError(error)) {
      throw new SevaError("internal", { message: "Supabase Auth lookup failed" });
    }

    if (typeof adminAuth.listUsers === "function") {
      const { data: listed, error: listError } = await adminAuth.listUsers();
      if (listError) {
        throw new SevaError("internal", { message: "Supabase Auth lookup failed" });
      }
      const found = listed?.users?.find((u) => {
        const candidate = tryNormalizeEmailAddress(u.email);
        return candidate.ok && candidate.email === normalizedEmail;
      });
      if (found?.id) {
        return found.id;
      }
    }
  } catch (error) {
    if (error instanceof SevaError) throw error;
    console.error("[set-role] Supabase Auth identity lookup failed:", error);
    throw new SevaError("internal", { message: "Supabase Auth lookup failed" });
  }

  throw new SevaError("not_found", { entity: "user" });
}

/** True when a Supabase Auth admin error means the requested user simply does not exist. */
function isUserNotFoundError(error: unknown): boolean {
  const message = typeof error === "string"
    ? error
    : (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && /not found|no user/i.test(message);
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`set-role:${getClientIP(request)}`, { windowMs: 60 * 1000, maxRequests: 10 });
  if (!limit.success) return createRateLimitResponse(limit);

  const guard = await requireStaffAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const { email, role } = parseInput(setRoleSchema, await readJson(request));

    // Permission gate: only super admin may grant super_admin
    if (role === "super_admin" && !can(guard.actor, "staff.grant_super_admin")) {
      return sevaErrorResponse(new SevaError("forbidden"));
    }

    // 1. Resolve login identity first (fails with 404 not_found if user has never signed in / does not exist)
    const loginUid = await findLoginUid(email);

    // 2. Pre-validate target account existence and caller permissions
    const db = createAdminClient();
    const identity = getIdentityAdapter();
    const [profile, target] = await Promise.all([
      identity.getAccessProfile(loginUid),
      db.from("staff").select("id, view_only, status").eq("auth_user_id", loginUid).maybeSingle(),
    ]);

    if (!profile) {
      throw new SevaError("not_found", { entity: "user" });
    }
    const staffRow = (target as { data?: { id?: string; status?: string } | null })?.data;
    if (loginUid === guard.actor.uid || staffRow?.id === guard.actor.staffId) {
      throw new SevaError("forbidden");
    }
    if (staffRow?.status === "deleted") {
      throw new SevaError("validation", { field: "status", message: "A deleted staff member stays deleted." });
    }

    const currentRole = mapFirestoreRole(profile.role) ?? undefined;
    const newRole = mapFirestoreRole(role) ?? undefined;
    if (newRole === undefined && guard.actor.role !== "super_admin") {
      throw new SevaError("forbidden");
    }
    if (newRole === "super_admin" && !can(guard.actor, "staff.grant_super_admin")) {
      throw new SevaError("forbidden");
    }
    if (!can(guard.actor, "staff.change_role", { targetRole: currentRole, targetStaffId: staffRow?.id, newRole })) {
      throw new SevaError("forbidden");
    }

    // 3. The Supabase Auth identity is already resolved (`loginUid`) and owns the `public.users` row checked above.
    // Promoting the role updates that row by `auth_user_id`; it never links a row by matching an email.
    if ((role === "admin" || role === "super_admin") && !isUuid(loginUid)) {
      throw new SevaError("internal", { message: "Supabase Auth returned an invalid identity" });
    }
    const userId = loginUid;

    await setAccountRole(guard.actor, { externalUid: userId, role });
    return NextResponse.json(
      { success: true, message: `User ${email} has been set as ${role}`, userId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
