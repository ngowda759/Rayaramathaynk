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
 * True when a stored Firestore role (spelled as the console may store it) opens the admin console - the same
 * allow-list and normalisation this file's guard uses. Seva onboarding reads it so that only a super admin links an
 * existing account that already holds a website admin role (C-62).
 */
export function isAdminConsoleRole(role: unknown): boolean {
  return ADMIN_CONSOLE_ROLES.has(normalizeRole(role));
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

  // Load the user's profile to enforce role/active checks.
  try {
    const { getAdminFirestore } = await import("@/lib/admin-firebase");
    const db = await getAdminFirestore();
    const userSnap = await db.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      console.warn(`[verifyAdminUser] User ${decoded.uid} not found in Firestore`);
      return {
        ok: false,
        reason: "user_not_found",
        status: 403,
        message: "No admin profile found for this account.",
      };
    }

    const data = userSnap.data() || {};
    if (data.isActive === false) {
      console.warn(`[verifyAdminUser] User ${decoded.uid} is not active`);
      return {
        ok: false,
        reason: "inactive_user",
        status: 403,
        message: "This account is inactive.",
      };
    }

    const role = normalizeRole(data.role);
    if (!ADMIN_CONSOLE_ROLES.has(role)) {
      console.warn(
        `[verifyAdminUser] User ${decoded.uid} has role ${JSON.stringify(role)}, which is not an admin console role`
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
        uid: decoded.uid,
        email: String(data.email || decoded.email || ""),
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
