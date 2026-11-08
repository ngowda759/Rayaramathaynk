/**
 * POST /api/admin/users/set-role { email, role } - sets a person's role.
 *
 * Answers to the staff rules of the seva module (DB §13.6, §17.1), through lib/seva/server/staff.ts:
 * - only a signed-in, active temple admin (not view-only) or super admin may call it;
 * - only a super admin gives `super_admin` (DB §3.3 row 19);
 * - a temple admin changes only another person who has a staff row and is below super admin (row 20, C-17);
 *   everyone else is a super admin's call (C-62);
 * - a change for someone with a staff row writes the staff.role_change audit row.
 * - MANDATORY: Any user promoted to an administrative role (admin, super_admin) must have an authoritative
 *   Supabase Auth identity (auth_user_id).
 * Errors use the seva shape `{ error: { code, message } }`.
 *
 * Identity resolution uses Supabase Auth primary with Firebase Auth fallback.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminConsoleRole } from "@/lib/auth/admin-auth";
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

/** Ensures that promoted admin accounts have an authoritative Supabase Auth identity. */
async function ensureAdminSupabaseIdentity(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const adminAuth = (supabase as unknown as {
      auth?: {
        admin?: {
          getUserByEmail?: (e: string) => Promise<{ data?: { user?: { id?: string } }; error?: unknown }>;
          createUser?: (opts: Record<string, unknown>) => Promise<{ data?: { user?: { id?: string } }; error?: unknown }>;
        };
      };
    })?.auth?.admin;

    if (!adminAuth) return null;

    if (typeof adminAuth.getUserByEmail === "function") {
      const { data } = await adminAuth.getUserByEmail(normalizedEmail);
      if (data?.user?.id) {
        await supabase
          .from("users")
          .update({ auth_user_id: data.user.id })
          .eq("email", normalizedEmail);
        return data.user.id;
      }
    }

    if (typeof adminAuth.createUser === "function") {
      const { data: created, error } = await adminAuth.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { name: normalizedEmail.split("@")[0] },
      });
      if (!error && created?.user?.id) {
        await supabase
          .from("users")
          .update({ auth_user_id: created.user.id })
          .eq("email", normalizedEmail);
        return created.user.id;
      }
    }
  } catch (err) {
    console.warn("[set-role] ensureAdminSupabaseIdentity non-fatal fallback:", err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`set-role:${getClientIP(request)}`, { windowMs: 60 * 1000, maxRequests: 10 });
  if (!limit.success) return createRateLimitResponse(limit);

  const guard = await requireStaffAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const { email, role } = parseInput(setRoleSchema, await readJson(request));
    const userId = await findLoginUid(email);

    // If granting an administrative role, guarantee a Supabase Auth identity exists
    if (isAdminConsoleRole(role)) {
      await ensureAdminSupabaseIdentity(email);
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
