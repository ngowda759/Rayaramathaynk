/**
 * The Raya AI authentication addresses (PR #349 surface).
 *
 * The sign-in, recovery-request and reset-password pages are all *unauthenticated*
 * entry points: they are what establishes or repairs a Supabase session, so the
 * admin guard must let them render. Keeping the three paths here (rather than as
 * string literals in the guard, the pages and the tests) means the guard and its
 * tests cannot drift apart from the pages that actually exist.
 *
 * No runtime imports, so a client component and a server component can both use it.
 */

const RAYA_AI_ROOT = "/admin/ai";

export const RAYA_AI_AUTH_ROUTES = {
  login: `${RAYA_AI_ROOT}/login`,
  forgotPassword: `${RAYA_AI_ROOT}/forgot-password`,
  resetPassword: `${RAYA_AI_ROOT}/reset-password`,
} as const;

/**
 * True for the pages that establish or repair the Raya AI session. These render
 * without a session (that is the point) and must never be bounced to the sign-in
 * page - a redirect would drop the recovery `?code=`/`?token_hash=` before it can
 * be exchanged.
 */
export function isRayaAiPublicAuthPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === RAYA_AI_AUTH_ROUTES.login ||
    pathname === RAYA_AI_AUTH_ROUTES.forgotPassword ||
    pathname === RAYA_AI_AUTH_ROUTES.resetPassword
  );
}
