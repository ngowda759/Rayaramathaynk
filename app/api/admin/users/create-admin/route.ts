/**
 * POST /api/admin/users/create-admin { email, password, name } - adds another super admin (older admin route, kept for
 * its callers; same body and a success answer with `success` and `message` as before).
 *
 * This route answers to the staff rules of the seva module (DB §13.6, §17.1):
 * - only a signed-in, active super admin may call it (giving the super admin role is DB §3.3 row 19);
 * - the new person is onboarded exactly as on the Staff and roles page (DB §3.2): login, public.users profile (role
 *   super_admin, active), Supabase staff row with the next staff number and the staff.onboard audit row;
 * - MANDATORY: Every admin account must have an authoritative Supabase Auth identity (auth_user_id).
 *   Cannot complete without a valid Supabase Auth identity.
 * - unlike the page, the caller sets the first password, as this route always did.
 * A step that fails after an earlier one went through answers 502 partial_failure. Errors use the seva shape
 * `{ error: { code, message } }`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRateLimitResponse, getClientIP, rateLimit } from "@/lib/rate-limit";
import { SevaError } from "@/lib/seva/errors";
import { can } from "@/lib/seva/permissions";
import { parseInput, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse } from "@/lib/seva/server/respond";
import { onboardStaff, requireStaffAdmin } from "@/lib/seva/server/staff";
import { isUuid } from "@/lib/supabase/identifier";

const createAdminSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Keep the password to 128 characters or fewer"),
  name: z.string().trim().min(1, "Name is required").max(80, "Keep the name to 80 characters or fewer"),
});

/** Synchronizes or creates Supabase Auth identity for authoritative admin unification (fail-closed, single canonical identity). */
async function syncSupabaseAdminIdentity(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
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

  if (!adminAuth) {
    throw new SevaError("internal", { message: "Supabase Auth admin service is unavailable" });
  }

  if (typeof adminAuth.getUserByEmail === "function") {
    const { data: existing, error: getError } = await adminAuth.getUserByEmail(email);
    if (!getError && existing?.user?.id) {
      return existing.user.id;
    }
  }

  if (typeof adminAuth.createUser === "function") {
    const { data: created, error } = await adminAuth.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, name: displayName },
    });

    if (error || !created?.user?.id) {
      console.error("[create-admin] Supabase Auth createUser failed:", error);
      throw new SevaError("internal", { message: "Failed to provision administrative identity" });
    }

    return created.user.id;
  }

  throw new SevaError("internal", { message: "Failed to provision administrative identity" });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`admin-create:${getClientIP(request)}`, { windowMs: 60 * 1000, maxRequests: 5 });
  if (!limit.success) return createRateLimitResponse(limit);

  const guard = await requireStaffAdmin(request);
  if (!guard.ok) return guard.response;

  // Caller permission check: only super admin may create another super admin
  if (!can(guard.actor, "staff.grant_super_admin")) {
    return sevaErrorResponse(new SevaError("forbidden"));
  }

  try {
    const { email, password, name } = parseInput(createAdminSchema, await readJson(request));

    let authUserId = "";
    const onboardOpts = {
      createLogin: async () => {
        authUserId = await syncSupabaseAdminIdentity(email, password, name);
        if (!authUserId || !isUuid(authUserId)) {
          throw new SevaError("internal", { message: "Supabase Auth identity is required for admin provisioning" });
        }
        return { externalUid: authUserId };
      },
      get authUserId() {
        return authUserId;
      },
    };

    const { staffId, staffNo } = await onboardStaff(
      guard.actor,
      { fullName: name, email, role: "super_admin", viewOnly: false },
      onboardOpts,
    );

    return NextResponse.json(
      {
        success: true,
        message: `Super admin ${email} added as staff no. ${String(staffNo).padStart(3, "0")}; they can sign in with this password.`,
        staffId,
        staffNo,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
