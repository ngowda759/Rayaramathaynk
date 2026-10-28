/**
 * Browser access-token provider.
 *
 * Application data lives in Supabase behind deny-all RLS, so admin reads and all
 * writes must go through the guarded route handlers with the signed-in admin's
 * Firebase ID token. Service modules cannot call `useAuth()` (they are plain
 * modules, not components), so `AuthContext` registers a getter here once the
 * signed-in user changes and the service modules call {@link getAuthToken}.
 *
 * This module holds no token: it only stores a callback that reads the current
 * one on demand, so an expired token is never cached and the token never leaves
 * the browser except as a request header to a same-origin route.
 */

type AuthTokenGetter = () => Promise<string | null>;

let getter: AuthTokenGetter | null = null;

/** Register the getter that reads the current user's ID token. */
export function setAuthTokenGetter(next: AuthTokenGetter | null): void {
  getter = next;
}

/** The current ID token, or `null` when nobody is signed in. Never throws. */
export async function getAuthToken(): Promise<string | null> {
  if (!getter) return null;
  try {
    return await getter();
  } catch {
    return null;
  }
}
