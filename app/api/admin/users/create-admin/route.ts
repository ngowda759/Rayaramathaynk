/**
 * POST /api/admin/users/create-admin { email, password, name } - adds another super admin (older admin route, kept for
 * its callers; same body and a success answer with `success` and `message` as before).
 *
 * This route used to be open to anyone. It now answers to the staff rules of the seva module (DB §13.6, §17.1):
 * - only a signed-in, active super admin may call it (giving the super admin role is DB §3.3 row 19);
 * - the new person is onboarded exactly as on the Staff and roles page (DB §3.2): login, Firestore profile (role
 *   super_admin, active), Supabase staff row with the next staff number (invited until the first sign-in) and the
 *   staff.onboard audit row - so they can later be offboarded like anyone else;
 * - unlike the page, the caller sets the first password, as this route always did.
 * A step that fails after an earlier one went through answers 502 partial_failure. Errors use the seva shape
 * `{ error: { code, message } }`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRateLimitResponse, getClientIP, rateLimit } from "@/lib/rate-limit";
import { SevaError } from "@/lib/seva/errors";
import { parseInput, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse } from "@/lib/seva/server/respond";
import { onboardStaff, requireStaffAdmin } from "@/lib/seva/server/staff";

const createAdminSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Keep the password to 128 characters or fewer"),
  name: z.string().trim().min(1, "Name is required").max(80, "Keep the name to 80 characters or fewer"),
});

/** Makes the Firebase Auth login with the caller's password (this route is Firebase-specific by nature). */
async function createPasswordLogin(
  login: { email: string; displayName: string },
  password: string,
): Promise<{ externalUid: string }> {
  const { getAdminApp } = await import("@/lib/admin-firebase");
  const { getAuth } = await import("firebase-admin/auth");
  try {
    const user = await getAuth(await getAdminApp()).createUser({
      email: login.email,
      password,
      displayName: login.displayName,
      emailVerified: false,
      disabled: false,
    });
    return { externalUid: user.uid };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "auth/email-already-exists") {
      throw new SevaError("validation", { field: "email", message: "This email already has a sign-in account." });
    }
    if (code === "auth/invalid-password") {
      throw new SevaError("validation", { field: "password", message: "Choose a longer password." });
    }
    if (code === "auth/invalid-email") {
      throw new SevaError("validation", { field: "email", message: "Invalid email format" });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`admin-create:${getClientIP(request)}`, { windowMs: 60 * 1000, maxRequests: 5 });
  if (!limit.success) return createRateLimitResponse(limit);

  const guard = await requireStaffAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    const { email, password, name } = parseInput(createAdminSchema, await readJson(request));
    const { staffId, staffNo } = await onboardStaff(
      guard.actor,
      { fullName: name, email, role: "super_admin", viewOnly: false },
      { createLogin: (login) => createPasswordLogin(login, password) },
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
