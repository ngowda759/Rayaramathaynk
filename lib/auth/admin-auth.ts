/**
 * Server-only admin authentication for admin API routes.
 *
 * Verifies the caller's identity with Supabase Auth only:
 *   - A Supabase session cookie, or a Supabase access token in `Authorization: Bearer`.
 *   - The authenticated Supabase Auth UUID is used to load the authorization record
 *     from Supabase (`public.users`, keyed by `auth_user_id`).
 *
 * There is no Firebase fallback. In all cases:
 *   - The user must exist in `public.users`
 *   - `active` must not be false
 *   - `role` must be on the admin console allow-list
 *   - Client-supplied claims, uids, or emails are never trusted
 *   - Service-role credentials are never exposed
 *   - The result reports `provider = "supabase"`
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseImpl } from "next/server";

export interface ServerAdminUser {
  uid: string;
  email: string;
  role: string;
  provider: "supabase";
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
  | { ok: true; user: ServerAdminUser; provider: "supabase" }
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
 * True when a stored `public.users.role` (spelled as the console may store it) opens the admin console - the same
 * allow-list and normalisation this file's guard uses. Seva onboarding reads it so that only a super admin links an
 * existing account that already holds a website admin role (C-62).
 */
export function isAdminConsoleRole(role: unknown): boolean {
  return ADMIN_CONSOLE_ROLES.has(normalizeRole(role));
}

/**
 * Verify the caller is an authorized admin using Supabase Auth only.
 * Returns a structured result that identifies the failure reason.
 */
export async function verifyAdminUserResult(
  request: NextRequest
): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("authorization");
  let bearerToken: string | null = null;

  if (authHeader) {
    if (!authHeader.startsWith("Bearer ")) {
      return {
        ok: false,
        reason: "missing_token",
        status: 401,
        message: "Missing or malformed Authorization header.",
      };
    }
    bearerToken = authHeader.slice("Bearer ".length).trim();
    if (!bearerToken) {
      return {
        ok: false,
        reason: "missing_token",
        status: 401,
        message: "Empty bearer token.",
      };
    }
  }

  // --------------------------------------------------------------------------
  // Supabase Auth identity resolution
  // --------------------------------------------------------------------------
  let supabaseAuthUser: { id: string; email: string | null } | null = null;
  let supabaseExpired = false;
  let supabaseUnavailable = false;

  if (bearerToken) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      if (typeof supabase?.auth?.getUser === "function") {
        const { data, error } = await supabase.auth.getUser(bearerToken);
        if (data?.user) {
          supabaseAuthUser = { id: data.user.id, email: data.user.email ?? null };
        } else if (error) {
          if (/expir/i.test(error.message)) {
            supabaseExpired = true;
          } else if (typeof (error as { status?: unknown }).status === "number" && (error as { status: number }).status >= 500) {
            supabaseUnavailable = true;
          }
        }
      }
    } catch (error) {
      console.error(
        "[verifyAdminUser] Supabase Auth unavailable:",
        error instanceof Error ? error.message : error
      );
      supabaseUnavailable = true;
    }
  } else {
    // Cookie session resolution when no bearer token is supplied
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      if (typeof supabase?.auth?.getUser === "function") {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          supabaseAuthUser = { id: data.user.id, email: data.user.email ?? null };
        }
      }
    } catch {
      // No cookie session available
    }
  }

  if (!supabaseAuthUser) {
    if (!bearerToken) {
      return {
        ok: false,
        reason: "missing_token",
        status: 401,
        message: "Missing or malformed Authorization header.",
      };
    }
    if (supabaseUnavailable) {
      return {
        ok: false,
        reason: "auth_unavailable",
        status: 503,
        message: "Server authentication is temporarily unavailable (Supabase not reachable).",
      };
    }
    return {
      ok: false,
      reason: supabaseExpired ? "expired_token" : "invalid_token",
      status: 401,
      message: supabaseExpired
        ? "Authentication token has expired."
        : "Authentication token is invalid.",
    };
  }

  const profile = await loadAuthorizationProfile({ authUserId: supabaseAuthUser.id });

  if (!profile.ok) {
    if (profile.reason === "user_not_found") {
      console.warn(`[verifyAdminUser] No authorization profile for Supabase uid ${supabaseAuthUser.id}`);
      return {
        ok: false,
        reason: "user_not_found",
        status: 403,
        message: "No admin profile found for this account.",
      };
    }
    return {
      ok: false,
      reason: "auth_unavailable",
      status: 503,
      message: "Server authentication is temporarily unavailable (profile lookup failed).",
    };
  }

  if (profile.active === false) {
    console.warn(`[verifyAdminUser] Supabase user ${supabaseAuthUser.id} is not active`);
    return {
      ok: false,
      reason: "inactive_user",
      status: 403,
      message: "This account is inactive.",
    };
  }

  const role = normalizeRole(profile.role);
  if (!ADMIN_CONSOLE_ROLES.has(role)) {
    console.warn(`[verifyAdminUser] Supabase user ${supabaseAuthUser.id} has non-admin role ${role || "(empty)"}`);
    return {
      ok: false,
      reason: "insufficient_role",
      status: 403,
      message: "This account does not have administrator permissions.",
    };
  }

  return {
    ok: true,
    provider: "supabase",
    user: {
      uid: supabaseAuthUser.id,
      email: String(profile.email || supabaseAuthUser.email || ""),
      role,
      provider: "supabase",
    },
  };
}

type AuthorizationProfile =
  | { ok: true; role: unknown; active: boolean | null; email: string | null }
  | { ok: false; reason: "user_not_found" | "auth_unavailable" };

/**
 * Load the authorization profile from Supabase public.users, keyed by `auth_user_id` (Supabase Auth UUID).
 */
async function loadAuthorizationProfile(
  target: { authUserId: string }
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
    .eq("auth_user_id", target.authUserId)
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
