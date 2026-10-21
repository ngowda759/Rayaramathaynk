/**
 * Server-only admin authentication for the Raya AI administration API.
 *
 * Raya AI administration uses **Supabase Auth**, not Firebase Auth. This module
 * resolves the signed-in caller from the Supabase session (the `@supabase/ssr`
 * cookie, or a Supabase access token in `Authorization: Bearer` for non-cookie
 * callers), then loads the caller's `role` and `active` from `public.users`,
 * keyed by `auth_user_id` (the `auth.users.id`).
 *
 * Authorization is denied by default: a valid session alone is never enough. A
 * row must exist in `public.users`, `active` must not be false, and `role` must
 * be on the admin-console allow-list.
 *
 * This module is deliberately separate from `lib/auth/admin-auth.ts` (the
 * Firebase path) so the rest of the temple admin keeps working unchanged. The
 * only route surface that uses it is `app/api/ai/**`.
 *
 * The failure reason and HTTP status are safe to expose: an authorized caller is
 * already authenticated, so the reason tells an authorized client why its
 * request was rejected without leaking anything to an anonymous caller.
 */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseImpl } from "next/server";

export interface ServerAdminUser {
  /** Supabase Auth user id (auth.users.id). */
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
 * Roles that may use the Raya AI administration console. Same allow-list as the
 * Firebase admin guard (DB §17.4). An empty, unknown or misspelt role is refused.
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

interface Caller {
  uid: string;
  email: string | null;
}

type CallerResolution =
  | { ok: true; caller: Caller }
  | { ok: false; reason: "missing_token" | "invalid_token" | "expired_token" | "auth_unavailable"; status: number; message: string };

const BEARER_PREFIX = "Bearer ";

/**
 * Resolve the caller from either a Supabase access token (`Authorization:
 * Bearer`) or the Supabase session cookie.
 *
 * A Supabase `getUser()` failure that is not a plain "no session" is a server
 * problem, not a client denial: it is reported as 503 so an outage is not masked
 * as an authentication failure.
 */
async function resolveCaller(request: NextRequest): Promise<CallerResolution> {
  const authHeader = request.headers.get("authorization");

  // A malformed Authorization header is treated as absent so cookie sessions on
  // the normal admin pages still work.
  if (authHeader && authHeader.startsWith(BEARER_PREFIX)) {
    const token = authHeader.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      return {
        ok: false,
        reason: "missing_token",
        status: 401,
        message: "Empty bearer token.",
      };
    }
    return resolveCallerFromToken(token);
  }

  if (authHeader) {
    return {
      ok: false,
      reason: "missing_token",
      status: 401,
      message: "Malformed Authorization header.",
    };
  }

  return resolveCallerFromCookie();
}

async function resolveCallerFromToken(token: string): Promise<CallerResolution> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    supabase = createAdminClient();
  } catch (error) {
    return authUnavailable(error, "create admin client for token verification");
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      // Supabase answers 401 for both an invalid and an expired token, so the
      // message is the only signal that separates them.
      const isExpired = /expir/i.test(error?.message ?? "");
      return {
        ok: false,
        reason: isExpired ? "expired_token" : "invalid_token",
        status: 401,
        message: isExpired
          ? "Authentication token has expired."
          : "Authentication token is invalid.",
      };
    }
    return {
      ok: true,
      caller: { uid: data.user.id, email: data.user.email ?? null },
    };
  } catch (error) {
    return authUnavailable(error, "verify Supabase access token");
  }
}

async function resolveCallerFromCookie(): Promise<CallerResolution> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    supabase = await createClient();
  } catch (error) {
    return authUnavailable(error, "create server Supabase client");
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return {
        ok: false,
        reason: "missing_token",
        status: 401,
        message: "No authenticated Supabase session.",
      };
    }
    return {
      ok: true,
      caller: { uid: data.user.id, email: data.user.email ?? null },
    };
  } catch (error) {
    return authUnavailable(error, "read Supabase session");
  }
}

function authUnavailable(error: unknown, action: string): CallerResolution {
  console.error(
    `[raya-admin-auth] Supabase auth unavailable (${action}):`,
    error instanceof Error ? error.message : error
  );
  return {
    ok: false,
    reason: "auth_unavailable",
    status: 503,
    message: "Server authentication is temporarily unavailable (Supabase not configured).",
  };
}

type AuthorizationProfile =
  | { ok: true; role: unknown; active: boolean | null; email: string | null }
  | { ok: false; reason: "user_not_found" | "auth_unavailable" };

/**
 * Load the authorization profile for a Supabase Auth user id from
 * `public.users`, keyed by `auth_user_id`.
 *
 * `auth_unavailable` is returned when the Supabase admin client cannot be created
 * or the query fails, so the caller can distinguish a datastore problem from a
 * genuine authorization denial.
 */
async function loadAuthorizationProfile(uid: string): Promise<AuthorizationProfile> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "[raya-admin-auth] Supabase admin client unavailable:",
      error instanceof Error ? error.message : error
    );
    return { ok: false, reason: "auth_unavailable" };
  }

  const { data, error } = await supabase
    .from("users")
    .select("role, active, email")
    .eq("auth_user_id", uid)
    .maybeSingle();

  if (error) {
    console.error("[raya-admin-auth] Authorization profile lookup failed:", error.message);
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
 * Verify the caller is an authorized Raya AI administrator using Supabase Auth.
 * Returns a structured result that identifies the failure reason so routes can
 * respond with an accurate HTTP status.
 */
export async function verifyRayaAdminUserResult(
  request: NextRequest
): Promise<AdminAuthResult> {
  const resolution = await resolveCaller(request);
  if (!resolution.ok) {
    return resolution;
  }

  const { caller } = resolution;
  const profile = await loadAuthorizationProfile(caller.uid);

  if (!profile.ok) {
    if (profile.reason === "user_not_found") {
      console.warn(`[raya-admin-auth] No authorization profile for uid ${caller.uid}`);
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
    console.warn(`[raya-admin-auth] User ${caller.uid} is not active`);
    return {
      ok: false,
      reason: "inactive_user",
      status: 403,
      message: "This account is inactive.",
    };
  }

  const role = normalizeRole(profile.role);
  if (!ADMIN_CONSOLE_ROLES.has(role)) {
    console.warn(`[raya-admin-auth] User ${caller.uid} has non-admin role ${role || "(empty)"}`);
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
      uid: caller.uid,
      email: String(profile.email || caller.email || ""),
      role,
    },
  };
}

/**
 * Convenience guard for Raya AI route handlers. Returns a `NextResponse`
 * describing the failure (with the correct status) when the caller is not
 * authorized, or the authenticated admin user on success.
 */
export async function requireRayaAdminUser(
  request: NextRequest
): Promise<
  { ok: true; user: ServerAdminUser } | { ok: false; response: NextResponse }
> {
  const result = await verifyRayaAdminUserResult(request);
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
