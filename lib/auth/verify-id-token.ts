/**
 * Server-only check of a signed-in caller's Supabase access token.
 *
 * Verifies the token with Supabase Auth only (`createAdminClient().auth.getUser(token)`). There is
 * no Firebase fallback: a token that Supabase does not accept is not a usable sign-in.
 *
 * For routes that serve any signed-in person (devotee or staff) their own data. It answers who the caller is and
 * nothing more: no profile, role or status checks (admin routes use lib/auth/admin-auth.ts for those).
 *
 * - `verifyBearerIdToken` returns null on every failure - no header, a malformed or expired token, or a server that
 *   cannot verify tokens - so the caller answers 401.
 * - `checkBearerIdToken` tells "this token is no good" (`invalid`) apart from "the server could not check it right now"
 *   (`unavailable`), for callers that must answer a sign-in provider outage with a 5xx so the client retries or works
 *   offline instead of asking the person to sign in again (the seva counter, DB §16.2).
 *
 * Logs carry the error message only, never the token.
 */

import "server-only";

export interface VerifiedCaller {
  uid: string;
  email: string | null;
}

/** `invalid` covers a missing header too: either way there is no usable sign-in on this request. */
export type IdTokenCheck =
  | { status: "ok"; caller: VerifiedCaller }
  | { status: "invalid" }
  | { status: "unavailable" };

const BEARER_PREFIX = "Bearer ";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * True when the failure means Supabase Auth itself could not answer (a 5xx), rather than the token being rejected.
 * A token rejection comes back as a resolved `{ error }` result with a 4xx status, handled before this check.
 */
function isUnavailableStatus(status: unknown): boolean {
  return typeof status === "number" && status >= 500;
}

export interface VerifyIdTokenOptions {
  /**
   * Retained for call-site compatibility. Supabase verifies the account's current state on every `getUser` call, so
   * a disabled or deleted account is refused without an extra round trip.
   */
  checkRevoked?: boolean;
}

export async function checkBearerIdToken(request: Request, _options: VerifyIdTokenOptions = {}): Promise<IdTokenCheck> {
  const token = bearerToken(request);
  if (!token) return { status: "invalid" };

  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    supabase = createAdminClient();
  } catch (error) {
    console.error("[checkBearerIdToken] Supabase admin client unavailable:", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }

  if (typeof supabase?.auth?.getUser !== "function") {
    console.error("[checkBearerIdToken] Supabase Auth client is not configured");
    return { status: "unavailable" };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      return {
        status: "ok",
        caller: {
          uid: data.user.id,
          email: typeof data.user.email === "string" ? data.user.email : null,
        },
      };
    }
    // A rejected token is the caller's problem, not a server outage; only a 5xx from Supabase is `unavailable`.
    if (isUnavailableStatus((error as { status?: unknown } | null)?.status)) {
      console.error("[checkBearerIdToken] Supabase Auth returned a server error");
      return { status: "unavailable" };
    }
    return { status: "invalid" };
  } catch (error) {
    console.error("[checkBearerIdToken] token verification unavailable:", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

export async function verifyBearerIdToken(
  request: Request,
  options: VerifyIdTokenOptions = {},
): Promise<VerifiedCaller | null> {
  const result = await checkBearerIdToken(request, options);
  return result.status === "ok" ? result.caller : null;
}
