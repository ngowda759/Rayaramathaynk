/**
 * Server-only check of a signed-in caller's Firebase ID token.
 *
 * For routes that serve any signed-in person (devotee or staff) their own data. It answers who the caller is and
 * nothing more: no Firestore profile, role or status checks (admin routes use lib/auth/admin-auth.ts for those).
 * Every failure - no header, a malformed or expired token, or a server that cannot verify tokens - returns null,
 * so the caller answers 401. Logs carry the error code only, never the token.
 */

import "server-only";

export interface VerifiedCaller {
  uid: string;
  email: string | null;
}

const BEARER_PREFIX = "Bearer ";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export async function verifyBearerIdToken(request: Request): Promise<VerifiedCaller | null> {
  const token = bearerToken(request);
  if (!token) return null;

  try {
    const { getAdminApp } = await import("@/lib/admin-firebase");
    const adminApp = await getAdminApp();
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return { uid: decoded.uid, email: typeof decoded.email === "string" ? decoded.email : null };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    // A bad or expired token is the caller's problem and is not logged; anything else means the server could not verify.
    if (typeof code !== "string" || !code.startsWith("auth/")) {
      console.error("[verifyBearerIdToken] token verification unavailable:", typeof code === "string" ? code : "no_code");
    }
    return null;
  }
}
