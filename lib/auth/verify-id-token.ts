/**
 * Server-only check of a signed-in caller's Firebase ID token.
 *
 * For routes that serve any signed-in person (devotee or staff) their own data. It answers who the caller is and
 * nothing more: no Firestore profile, role or status checks (admin routes use lib/auth/admin-auth.ts for those).
 *
 * - `verifyBearerIdToken` returns null on every failure - no header, a malformed or expired token, or a server that
 *   cannot verify tokens - so the caller answers 401.
 * - `checkBearerIdToken` tells "this token is no good" (`invalid`) apart from "the server could not check it right now"
 *   (`unavailable`), for callers that must answer a Firebase Auth outage with a 5xx so the client retries or works
 *   offline instead of asking the person to sign in again (the seva counter, DB §16.2).
 *
 * Logs carry the error code only, never the token.
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

/**
 * `auth/` codes that mean Firebase Auth itself failed, not the token: an unexpected backend answer, or the project's
 * quota running out. Every other `auth/` code (revoked, disabled, expired, malformed, unknown user...) is the token's.
 */
const UNAVAILABLE_AUTH_CODES: ReadonlySet<string> = new Set(["auth/internal-error", "auth/quota-exceeded"]);

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/** No code (missing credentials, a thrown plain Error), a non-auth code (`app/network-error`...) or a backend failure. */
function isUnavailable(code: unknown): boolean {
  return typeof code !== "string" || !code.startsWith("auth/") || UNAVAILABLE_AUTH_CODES.has(code);
}

export interface VerifyIdTokenOptions {
  /**
   * Also refuse a token whose account is disabled or whose refresh tokens were revoked after it was issued
   * (Firebase `checkRevoked`; one extra call to Firebase Auth). The seva routes use it so an offboarded person is
   * shut out at once (DB §3.2).
   */
  checkRevoked?: boolean;
}

export async function checkBearerIdToken(request: Request, options: VerifyIdTokenOptions = {}): Promise<IdTokenCheck> {
  const token = bearerToken(request);
  if (!token) return { status: "invalid" };

  try {
    const { getAdminApp } = await import("@/lib/admin-firebase");
    const adminApp = await getAdminApp();
    const { getAuth } = await import("firebase-admin/auth");
    const auth = getAuth(adminApp);
    const decoded = options.checkRevoked ? await auth.verifyIdToken(token, true) : await auth.verifyIdToken(token);
    return { status: "ok", caller: { uid: decoded.uid, email: typeof decoded.email === "string" ? decoded.email : null } };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    // A bad or expired token is the caller's problem and is not logged; anything else means the server could not verify.
    if (isUnavailable(code)) {
      console.error("[verifyBearerIdToken] token verification unavailable:", typeof code === "string" ? code : "no_code");
      return { status: "unavailable" };
    }
    return { status: "invalid" };
  }
}

export async function verifyBearerIdToken(
  request: Request,
  options: VerifyIdTokenOptions = {},
): Promise<VerifiedCaller | null> {
  const result = await checkBearerIdToken(request, options);
  return result.status === "ok" ? result.caller : null;
}
