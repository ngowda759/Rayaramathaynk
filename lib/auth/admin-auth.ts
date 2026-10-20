/**
 * Server-only admin authentication for admin API routes.
 *
 * Verifies the Firebase ID token sent by the admin UI (Authorization: Bearer)
 * using the Firebase Admin SDK and checks the user's role in Firestore.
 * Public/unauthenticated callers are rejected.
 *
 * The verifier distinguishes *why* a request was rejected so that API routes
 * can return an accurate status code and diagnostics instead of a blanket 401
 * for every failure (expired token, missing profile, inactive user, blocked
 * role, or unavailable server credentials). The distinction is safe to expose:
 * an authorized caller is already authenticated, so the reason never leaks
 * information to an anonymous client beyond "your request was rejected".
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseImpl } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ServerAdminUser {
  uid: string;
  email: string;
  role: string;
}

export type AdminAuthFailureReason =
  | "missing_token"
  | "invalid_token"
  | "expired_token"
  | "user_not_found"
  | "inactive_user"
  | "insufficient_role"
  | "auth_unavailable";

export type AdminAuthResult =
  | { ok: true; user: ServerAdminUser }
  | { ok: false; reason: AdminAuthFailureReason; status: number; message: string };

/**
 * Roles that may use the admin console and the routes guarded here (DB §17.4).
 * This is an allow-list: an empty, unknown or misspelt role is refused. The
 * seva roles `receptionist` and `prasadam_counter` are deliberately absent -
 * they reach only `/api/seva/*` through the seva route guard.
 */
export const ADMIN_CONSOLE_ROLES: ReadonlySet<string> = new Set([
  "super_admin",
  "temple_admin",
  "admin",
  "billing",
  "priest",
  "staff",
  "office_staff",
]);

/** Trims, lower-cases and joins words with `_`; anything not a string becomes "". */
function normalizeRole(role: unknown): string {
  if (typeof role !== "string") return "";
  return role.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Verify the caller is an authorized admin.
 * Returns a structured result that identifies the failure reason so routes can
 * respond with an accurate HTTP status and actionable diagnostics.
 */
export async function verifyAdminUserResult(
  request: NextRequest
): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      reason: "missing_token",
      status: 401,
      message: "Missing or malformed Authorization header.",
    };
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    return {
      ok: false,
      reason: "missing_token",
      status: 401,
      message: "Empty bearer token.",
    };
  }

  // Verify the ID token using Supabase Auth.
  let decodedUser: { id: string; email?: string };
  let supabase;

  try {
    supabase = createAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(idToken);

    if (error || !user) {
      // Handle known Supabase Auth errors
      const isExpired = error?.name === "AuthSessionMissingError" || error?.message?.toLowerCase().includes("expired");

      console.warn(
        `[verifyAdminUser] Rejected ${isExpired ? "expired" : "invalid"} token: ${error?.message || "Unknown error"}`
      );

      return {
        ok: false,
        reason: isExpired ? "expired_token" : "invalid_token",
        status: 401,
        message: isExpired
          ? "Authentication token has expired."
          : "Authentication token is invalid.",
      };
    }

    decodedUser = { id: user.id, email: user.email };
  } catch (error) {
    console.error(
      "[verifyAdminUser] Supabase verification unavailable:",
      error instanceof Error ? error.message : error
    );
    return {
      ok: false,
      reason: "auth_unavailable",
      status: 503,
      message:
        "Server authentication is temporarily unavailable (Supabase Admin not configured).",
    };
  }

  if (!decodedUser.email) {
    return {
      ok: false,
      reason: "invalid_token",
      status: 401,
      message: "Authentication token does not contain an email address.",
    };
  }

  // Load the user's profile from the authoritative Supabase "users" table using their email.
  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('uid:firestore_id, email, role, active')
      .eq('email', decodedUser.email)
      .maybeSingle();

    if (error) throw error;

    if (!userData) {
      console.warn(`[verifyAdminUser] User ${decodedUser.email} not found in Supabase users table`);
      return {
        ok: false,
        reason: "user_not_found",
        status: 403,
        message: "No admin profile found for this account.",
      };
    }

    if (userData.active === false) {
      console.warn(`[verifyAdminUser] User ${decodedUser.email} is not active`);
      return {
        ok: false,
        reason: "inactive_user",
        status: 403,
        message: "This account is inactive.",
      };
    }

    const role = normalizeRole(userData.role);
    if (!ADMIN_CONSOLE_ROLES.has(role)) {
      console.warn(
        `[verifyAdminUser] User ${decodedUser.email} has role ${JSON.stringify(role)}, which is not an admin console role`
      );
      return {
        ok: false,
        reason: "insufficient_role",
        status: 403,
        message: "This account does not have administrator permissions.",
      };
    }

    return {
      ok: true,
      user: {
        // Fallback to the Supabase ID if firestore_id is missing, though we select uid as firestore_id.
        uid: userData.uid || decodedUser.id,
        email: String(userData.email || decodedUser.email || ""),
        role,
      },
    };
  } catch (error) {
    console.error(
      "[verifyAdminUser] Failed to load admin profile:",
      error instanceof Error ? error.message : error
    );
    return {
      ok: false,
      reason: "auth_unavailable",
      status: 503,
      message:
        "Server authentication is temporarily unavailable (profile lookup failed).",
    };
  }
}

/**
 * Backwards-compatible wrapper. Returns the admin user, or null when the
 * caller is not an authorized admin. Prefer {@link verifyAdminUserResult} when
 * an accurate status code and reason are needed.
 */
export async function verifyAdminUser(
  request: NextRequest
): Promise<ServerAdminUser | null> {
  const result = await verifyAdminUserResult(request);
  return result.ok ? result.user : null;
}

/**
 * Convenience guard for route handlers. Returns a `NextResponse` describing
 * the failure (with the correct status) when the caller is not authorized, or
 * the authenticated admin user on success.
 */
export async function requireAdminUser(
  request: NextRequest
): Promise<
  { ok: true; user: ServerAdminUser } | { ok: false; response: NextResponse }
> {
  const result = await verifyAdminUserResult(request);
  if (result.ok) {
    return { ok: true, user: result.user };
  }

  return {
    ok: false,
    response: NextResponseImpl.json(
      { error: result.message, reason: result.reason },
      { status: result.status }
    ),
  };
}
