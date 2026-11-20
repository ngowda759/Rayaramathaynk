/**
 * Google sign-in, initiated through the Supabase Auth provider.
 *
 * Supabase Auth remains the only identity provider: this module starts a native Supabase OAuth flow,
 * it does not add a second authentication system, a second identity store or an SDK. Google
 * credentials (client id/secret) live in the Supabase project, never in this repository or in Vercel.
 *
 * The flow (docs/auth/GOOGLE-SIGNIN.md §6):
 *
 *   signInWithOAuth({ provider: "google", options: { redirectTo: "<origin>/auth/callback?next=…" } })
 *     → Google consent → GoTrue callback → <origin>/auth/callback?code=<pkce code>
 *     → app/auth/callback/route.ts exchanges the code server-side and provisions the devotee row.
 *
 * Everything that decides who the person *is* happens on the server. Nothing here grants a role,
 * reads a profile, or trusts provider metadata.
 */

import { getSupabaseConfigStatus, supabaseConfigMessage } from "@/lib/supabase/config";
import { sanitizeReturnPath } from "@/lib/auth/safe-return";
import { SITE_URL } from "@/lib/seo";

/** The one internal path the provider is allowed to return to. */
export const OAUTH_CALLBACK_PATH = "/auth/callback";

/** Where a failed or refused sign-in lands: the page that renders the failure message. */
export const OAUTH_FAILURE_PATH = "/login";

/** The most a failed sign-in says. Coarse on purpose: no provider error, code or token is echoed. */
export const OAUTH_FAILURE_MESSAGES = {
  missing_code: "Sign-in could not be completed. Please try again.",
  exchange_failed: "Sign-in could not be completed. Please try again.",
  provisioning_failed: "Sign-in could not be completed. Please try again.",
  provider_error: "Sign-in was cancelled or refused. Please try again.",
  account_conflict:
    "An account with this email already exists and cannot be claimed automatically. Please contact the temple office.",
} as const;

export type OAuthFailureCode = keyof typeof OAUTH_FAILURE_MESSAGES;

export interface GoogleSignInEnv {
  NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN?: string | null;
}

/**
 * Read the feature flag. Default disabled: a deployment that forgets the variable must not show a
 * sign-in path whose provider is not configured.
 */
export function isGoogleSignInEnabled(env?: GoogleSignInEnv | null): boolean {
  // Read literally: `process.env.NEXT_PUBLIC_*` is replaced at build time and cannot be destructured.
  const value = env ? env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN : process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN;
  return (value ?? "").trim().toLowerCase() === "true";
}

/**
 * The absolute callback URL Supabase returns to, carrying the sanitized post-sign-in path.
 *
 * `next` is attacker-controllable (it arrives from `?redirect=` on the login page), so it goes through
 * the same sanitizer the password flow uses: only a path on this origin survives, everything else
 * collapses to `/`.
 */
export function buildOAuthRedirectTo(origin: string, next: string | null | undefined): string {
  const target = sanitizeReturnPath(next, "/", origin);
  const url = new URL(OAUTH_CALLBACK_PATH, origin);
  if (target !== "/") url.searchParams.set("next", target);
  return url.toString();
}

/**
 * The failure URL. The reason travels as a coarse enum key, never as provider text, and `next` is
 * sanitized again so a refusal cannot be turned into an off-site bounce.
 */
export function buildOAuthFailureUrl(
  origin: string,
  reason: OAuthFailureCode,
  next?: string | null
): string {
  const url = new URL(OAUTH_FAILURE_PATH, origin);
  url.searchParams.set("error", reason);
  const target = sanitizeReturnPath(next, "/", origin);
  if (target !== "/") url.searchParams.set("redirect", target);
  return url.toString();
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Hosts this application answers sign-in on.
 *
 * The callback redirects to an origin, so that origin must not come from the request alone: a
 * misdirected proxy or an attacker-chosen `Host` header would otherwise turn the callback into an open
 * redirect. The list is explicit — the canonical production host and its apex, Vercel preview
 * deployments (https only) and loopback for local development.
 *
 * To serve sign-in from a new host, add it here; do not widen this to a wildcard.
 */
export function isAllowedAuthOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return true;
  if (url.protocol !== "https:") return false;

  const siteHost = new URL(SITE_URL).hostname.toLowerCase();
  const apex = siteHost.replace(/^www\./, "");
  if (host === siteHost || host === apex) return true;
  return host.endsWith(".vercel.app");
}

export type GoogleSignInOutcome =
  | { ok: true }
  | { ok: false; reason: "disabled" | "not_configured" | "unavailable"; message: string };

/**
 * Start the Google flow. On success the browser is navigating away, so the caller only needs to keep
 * its loading state; on failure it renders `message`.
 */
export async function signInWithGoogle(
  next: string | null | undefined,
  deps: { origin?: string; env?: GoogleSignInEnv } = {}
): Promise<GoogleSignInOutcome> {
  if (!isGoogleSignInEnabled(deps.env)) {
    return {
      ok: false,
      reason: "disabled",
      message: "Google sign-in is not available on this site yet.",
    };
  }

  const config = getSupabaseConfigStatus();
  if (!config.isConfigured) {
    return { ok: false, reason: "not_configured", message: supabaseConfigMessage(config) };
  }

  const origin = deps.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) {
    return { ok: false, reason: "unavailable", message: "Google sign-in is unavailable in this context." };
  }

  // Loaded lazily: this module is also imported by the server callback route, which must not pull the
  // browser SDK into its bundle.
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: buildOAuthRedirectTo(origin, next) },
  });

  if (error) {
    // The provider's own message can carry request detail, so only a fixed sentence is surfaced.
    return {
      ok: false,
      reason: "unavailable",
      message: "Google sign-in could not be started. Please try again or use your email and password.",
    };
  }

  return { ok: true };
}
