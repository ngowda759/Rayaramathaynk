/**
 * Server-only admin authentication for admin API routes.
 *
 * Verifies the Firebase ID token sent by the admin UI (Authorization: Bearer)
 * using the Firebase Admin SDK, then checks the user's role and active flag in
 * Supabase (`public.users`, keyed by `firestore_id` = the Firebase UID).
 * Public/unauthenticated callers are rejected, and access is denied by default:
 * a valid token alone is never sufficient.
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
 * Roles permitted to use the admin AI APIs.
 *
 * This is an allowlist: access is denied unless the profile's role is
 * explicitly recognized. `users.role` defaults to `user` in the schema, so a
 * denylist would wrongly grant access to any un-migrated account.
 */
const ALLOWED_ROLES = new Set(["super_admin", "admin", "billing"]);

function normalizeRole(role: unknown): string {
  return String(role || "").toLowerCase().replace(/\s+/g, "_");
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

  // Verify the ID token. A failure here is either a bad/expired token (401) or
  // a server-side problem such as missing Firebase Admin credentials (503).
  let decoded: { uid: string; email?: string };
  try {
    const { getAdminApp } = await import("@/lib/admin-firebase");
    const adminApp = await getAdminApp();
    const { getAuth } = await import("firebase-admin/auth");
    decoded = await getAuth(adminApp).verifyIdToken(idToken);
  } catch (error) {
    const code = (error as { code?: string })?.code || "";
    const isTokenError =
      code.startsWith("auth/") &&
      code !== "auth/internal-error" &&
      code !== "auth/network-request-failed";

    if (isTokenError) {
      const expired =
        code === "auth/id-token-expired" || code === "auth/argument-error";
      console.warn(
        `[verifyAdminUser] Rejected ${expired ? "expired" : "invalid"} token: ${code}`
      );
      return {
        ok: false,
        reason: expired ? "expired_token" : "invalid_token",
        status: 401,
        message: expired
          ? "Authentication token has expired."
          : "Authentication token is invalid.",
      };
    }

    // Non-token failure: the Admin SDK itself could not verify (missing or
    // malformed server credentials, network failure, etc.). This is a server
    // misconfiguration, not a client authentication error.
    console.error(
      "[verifyAdminUser] Firebase Admin verification unavailable:",
      error instanceof Error ? error.message : error
    );
    return {
      ok: false,
      reason: "auth_unavailable",
      status: 503,
      message:
        "Server authentication is temporarily unavailable (Firebase Admin not configured).",
    };
  }

  // Load the authorization profile from Supabase to enforce role/active checks.
  //
  // The authoritative source is `public.users`, keyed by `firestore_id` (the
  // Firebase Auth UID written by the migration mappers). `role` and `active`
  // live there. `profiles` has neither column, and its `id` is a generated
  // uuid, so it must not be used for authorization.
  const profile = await loadAuthorizationProfile(decoded.uid);

  if (!profile.ok) {
    if (profile.reason === "user_not_found") {
      console.warn(`[verifyAdminUser] No authorization profile for uid ${decoded.uid}`);
      return {
        ok: false,
        reason: "user_not_found",
        status: 403,
        message: "No admin profile found for this account.",
      };
    }
    // A datastore or credential failure is a server problem, never a client
    // authentication denial. Reporting it as 403 would hide a real outage.
    return {
      ok: false,
      reason: "auth_unavailable",
      status: 503,
      message:
        "Server authentication is temporarily unavailable (profile lookup failed).",
    };
  }

  if (profile.active === false) {
    console.warn(`[verifyAdminUser] User ${decoded.uid} is not active`);
    return {
      ok: false,
      reason: "inactive_user",
      status: 403,
      message: "This account is inactive.",
    };
  }

  const role = normalizeRole(profile.role);
  if (!ALLOWED_ROLES.has(role)) {
    console.warn(`[verifyAdminUser] User ${decoded.uid} has non-admin role ${role || "(empty)"}`);
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
      uid: decoded.uid,
      email: String(profile.email || decoded.email || ""),
      role,
    },
  };
}

type AuthorizationProfile =
  | { ok: true; role: unknown; active: boolean | null; email: string | null }
  | { ok: false; reason: "user_not_found" | "auth_unavailable" };

/**
 * Load the authorization profile for a verified Firebase UID from Supabase.
 *
 * Returns `auth_unavailable` when the Supabase admin client cannot be created
 * (missing service-role credentials) or the query fails, so the caller can
 * distinguish a datastore problem from a genuine authorization denial.
 */
async function loadAuthorizationProfile(
  uid: string
): Promise<AuthorizationProfile> {
  let supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>
  >;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "[verifyAdminUser] Supabase admin client unavailable:",
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "auth_unavailable" };
  }

  const { data, error } = await supabase
    .from("users")
    .select("role, active, email")
    .eq("firestore_id", uid)
    .maybeSingle();

  if (error) {
    console.error("[verifyAdminUser] Authorization profile lookup failed:", error.message);
    return { ok: false, reason: "auth_unavailable" };
  }

  if (!data) {
    return { ok: false, reason: "user_not_found" };
  }

  return {
    ok: true,
    role: (data as { role?: unknown }).role,
    active: (data as { active?: boolean | null }).active ?? null,
    email: (data as { email?: string | null }).email ?? null,
  };
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
