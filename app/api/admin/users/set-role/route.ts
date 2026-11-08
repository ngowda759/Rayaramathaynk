/**
 * POST /api/admin/users/set-role { email, role } - sets a person's role.
 *
 * Answers to the staff rules of the seva module (DB §13.6, §17.1), through lib/seva/server/staff.ts:
 * - only a signed-in, active temple admin (not view-only) or super admin may call it;
 * - only a super admin gives `super_admin` (DB §3.3 row 19);
 * - a temple admin changes only another person who has a staff row and is below super admin (row 20, C-17);
 *   everyone else is a super admin's call (C-62);
 * - a change for someone with a staff row writes the staff.role_change audit row.
 * - MANDATORY: Any user promoted to an administrative role (admin, super_admin) must have a verified
 *   authoritative Supabase Auth identity (auth_user_id).
 * Errors use the seva shape `{ error: { code, message } }`.
 *
 * Identity resolution uses Supabase Auth primary with Firebase Auth fallback.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminConsoleRole } from "@/lib/auth/admin-auth";
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
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  role: z.enum(ROLES, { error: `Invalid role. Must be one of: ${ROLES.join(", ")}` }),
});

/** Resolves sign-in account identity via Supabase Auth primary and Firebase fallback. */
async function findLoginUid(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Primary: Supabase Auth Admin
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const adminAuth = (supabase as unknown as {
      auth?: {
        admin?: {
          getUserByEmail?: (e: string) => Promise<{ data?: { user?: { id?: string } }; error?: unknown }>;
          listUsers?: () => Promise<{ data?: { users?: any[] }; error?: unknown }>;
        };
      };
    })?.auth?.admin;

    if (typeof adminAuth?.getUserByEmail === "function") {
      const { data, error } = await adminAuth.getUserByEmail(normalizedEmail);
      if (!error && data?.user?.id) {
        return data.user.id;
      }
    }

    if (typeof adminAuth?.listUsers === "function") {
      const { data } = await adminAuth.listUsers();
      if (Array.isArray(data?.users)) {
        const found = data.users.find(
          (u: any) => u.email?.trim().toLowerCase() === normalizedEmail
        );
        if (found?.id) {
          return found.id;
        }
      }
    }
  } catch {
    // proceed to compatibility fallback
  }

  // 2. Compatibility fallback: Firebase Auth
  try {
    const { getAdminApp } = await import("@/lib/admin-firebase");
    const { getAuth } = await import("firebase-admin/auth");
    return (await getAuth(await getAdminApp()).getUserByEmail(normalizedEmail)).uid;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === "auth/user-not-found") {
      throw new SevaError("not_found", { entity: "user" });
    }
    throw error;
  }
}

/**
 * Ensures that promoted admin accounts have a verified, authoritative Supabase Auth identity.
 * Fails closed on any error (missing methods, lookup failure, creation failure, invalid UUID, update failure, or mismatch).
 */
async function requireAdminSupabaseIdentity(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const adminAuth = (supabase as unknown as {
    auth?: {
      admin?: {
        getUserByEmail?: (e: string) => Promise<{ data?: { user?: { id?: string } | null }; error?: unknown }>;
        inviteUserByEmail?: (e: string) => Promise<{ data?: { user?: { id?: string } | null }; error?: unknown }>;
        createUser?: (opts: Record<string, unknown>) => Promise<{ data?: { user?: { id?: string } | null }; error?: unknown }>;
      };
    };
  })?.auth?.admin;

  if (!adminAuth || typeof adminAuth.getUserByEmail !== "function") {
    throw new SevaError("internal", { message: "Supabase Auth Admin lookup service is unavailable" });
  }

  let authUserId: string | null = null;

  // 1. Look up existing Supabase Auth user
  const { data: existingUser, error: lookupError } = await adminAuth.getUserByEmail(normalizedEmail);
  if (lookupError) {
    console.error("[set-role] Supabase Auth getUserByEmail error:", lookupError);
    throw new SevaError("internal", { message: "Failed to query Supabase Auth user" });
  }

  if (existingUser?.user?.id) {
    authUserId = existingUser.user.id;
  } else {
    // 2. Provision Supabase Auth account via invitation or creation
    if (typeof adminAuth.inviteUserByEmail === "function") {
      const { data: invited, error: inviteErr } = await adminAuth.inviteUserByEmail(normalizedEmail);
      if (!inviteErr && invited?.user?.id) {
        authUserId = invited.user.id;
      }
    }

    if (!authUserId && typeof adminAuth.createUser === "function") {
      const { data: created, error: createErr } = await adminAuth.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { name: normalizedEmail.split("@")[0] },
      });
      if (createErr || !created?.user?.id) {
        console.error("[set-role] Supabase Auth createUser error:", createErr);
        throw new SevaError("internal", { message: "Failed to provision Supabase Auth identity for admin account" });
      }
      authUserId = created.user.id;
    }
  }

  if (!authUserId || !isUuid(authUserId)) {
    throw new SevaError("internal", { message: "Valid Supabase Auth UUID is required for admin role promotion" });
  }

  // 3. Update public.users.auth_user_id and verify synchronization
  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ auth_user_id: authUserId })
    .eq("email", normalizedEmail)
    .select("id, auth_user_id")
    .maybeSingle();

  if (updateError) {
    console.error("[set-role] Failed to update public.users.auth_user_id:", updateError);
    throw new SevaError("internal", { message: "Failed to synchronize auth_user_id on user record" });
  }

  if (updated && updated.auth_user_id !== authUserId) {
    throw new SevaError("internal", { message: "Identity mismatch after updating user record" });
  }

  return authUserId;
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
      db.from("staff").select("id, firebase_uid, view_only, status").eq("firebase_uid", loginUid).maybeSingle(),
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

    // 3. Mandatory fail-closed Supabase Auth identity for admin promotion
    let userId = loginUid;
    if (role === "admin" || role === "super_admin") {
      userId = await requireAdminSupabaseIdentity(email);
    }

    await setAccountRole(guard.actor, { externalUid: userId, role });
    return NextResponse.json(
      { success: true, message: `User ${email} has been set as ${role}`, userId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
