/**
 * Supabase OAuth / PKCE callback (docs/auth/GOOGLE-SIGNIN.md §6, PR 2).
 *
 * Google → GoTrue → here, with a single-use PKCE `code`. The exchange happens in this route handler so
 * `@supabase/ssr` writes the session into the same cookie the password flow uses; nothing about
 * `AuthContext`, the storage key or the flow type changes.
 *
 * Security contract:
 * - The identity is the Supabase user returned by the verified exchange. No client-supplied uid, email
 *   or provider metadata is trusted, and none of it can grant a role.
 * - `next` is a path on this origin or nothing. An absolute URL, `//host`, `javascript:` or an encoded
 *   equivalent collapses to `/` (lib/auth/safe-return.ts), so this route cannot be an open redirect.
 * - A refused or failed sign-in redirects with a coarse enum key. The code, tokens and the provider's
 *   raw error are never echoed to the URL, the page or the log.
 * - Provisioning reuses lib/auth/provisioning.ts: an existing row is used only when it carries this
 *   `auth_user_id`; an address held by an unlinked or foreign-owned row is refused, never claimed.
 */

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { provisionDevoteeRow } from "@/lib/auth/provisioning";
import { sanitizeReturnPath } from "@/lib/auth/safe-return";
import {
  buildOAuthFailureUrl,
  isAllowedAuthOrigin,
  isGoogleSignInEnabled,
  type OAuthFailureCode,
} from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

interface OAuthSessionUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

function failure(origin: string, reason: OAuthFailureCode, next: string | null): NextResponse {
  return NextResponse.redirect(buildOAuthFailureUrl(origin, reason, next));
}

/** A display name for the devotee row. Display only — it never influences role, `active` or approval. */
function displayNameFor(user: OAuthSessionUser): string {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const candidate = (metadataName || "").trim();
  if (candidate) return candidate.slice(0, 100);
  const email = (user.email || "").trim();
  return email ? email.split("@")[0] : "Devotee";
}

/**
 * The origin this callback answers on.
 *
 * It is the request's own origin rather than `SITE_URL`, because the PKCE verifier lives in a cookie
 * scoped to the host the flow started on: a preview deployment must return to that same host or the
 * exchange fails. The value is only accepted when it is on the explicit allow-list
 * (`isAllowedAuthOrigin`), so a spoofed `Host` header cannot turn this route into an open redirect.
 */
function callbackOrigin(request: NextRequest): string | null {
  const origin = request.nextUrl.origin;
  return isAllowedAuthOrigin(origin) ? new URL(origin).origin : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = callbackOrigin(request);
  if (!origin) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // Sanitized once, up front: every branch below redirects with this value and nothing raw.
  const next = sanitizeReturnPath(request.nextUrl.searchParams.get("next"), "/", origin);

  // The same flag that hides the button also closes this endpoint, so "disabled by default" holds at the
  // server boundary and not only in the UI. A code cannot be obtained while the provider is off anyway;
  // this keeps a stale or hand-built callback from provisioning anything.
  if (!isGoogleSignInEnabled()) {
    console.warn("[auth/callback] Google sign-in is disabled; ignoring callback");
    return failure(origin, "provider_error", next);
  }

  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");

  if (providerError) {
    console.warn("[auth/callback] Provider returned an error; sign-in not completed");
    return failure(origin, "provider_error", next);
  }

  if (!code) {
    console.warn("[auth/callback] Callback arrived without a code");
    return failure(origin, "missing_code", next);
  }

  let sessionUser: OAuthSessionUser | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn("[auth/callback] Code exchange failed");
      return failure(origin, "exchange_failed", next);
    }
    sessionUser = (data?.user ?? null) as OAuthSessionUser | null;
  } catch (error) {
    console.error(
      "[auth/callback] Code exchange threw:",
      error instanceof Error ? error.message : "unknown error"
    );
    return failure(origin, "exchange_failed", next);
  }

  if (!sessionUser?.id) {
    console.warn("[auth/callback] Exchange returned no verified identity");
    return failure(origin, "exchange_failed", next);
  }

  // A new devotee row is only ever created for an address Supabase reports as confirmed. An unverified
  // address cannot self-provision — the same rule /api/auth/register applies — and it is checked before
  // any database read so an unverified caller cannot probe which addresses already have a profile.
  // Verification is necessary but never sufficient: it does not authorize claiming an existing row.
  if (!sessionUser.email_confirmed_at) {
    console.warn("[auth/callback] Identity has no confirmed email; not provisioning");
    return failure(origin, "provisioning_failed", next);
  }

  try {
    const admin = createAdminClient();
    const outcome = await provisionDevoteeRow<{ auth_user_id: string | null }>(admin, {
      uid: sessionUser.id,
      email: sessionUser.email ?? null,
      emailConfirmedAt: sessionUser.email_confirmed_at ?? null,
      displayName: displayNameFor(sessionUser),
      columns: "id, auth_user_id",
    });

    if (outcome.status === "unverified") {
      console.warn("[auth/callback] Identity lost its confirmed email; not provisioning");
      return failure(origin, "provisioning_failed", next);
    }

    if (outcome.status === "conflict") {
      // The address belongs to an unlinked or foreign-owned row. Nothing was written; the person is
      // told to contact the temple office, which is the only place that row can be reconciled.
      console.warn("[auth/callback] Email conflict; no row claimed and none created");
      return failure(origin, "account_conflict", next);
    }

    if (outcome.status === "error") {
      console.error("[auth/callback] Provisioning failed");
      return failure(origin, "provisioning_failed", next);
    }
  } catch (error) {
    console.error(
      "[auth/callback] Provisioning threw:",
      error instanceof Error ? error.message : "unknown error"
    );
    return failure(origin, "provisioning_failed", next);
  }

  // Only an internal path can reach here; it was sanitized against this request's own origin.
  const destination = new URL(next, origin);
  if (destination.origin !== origin) {
    return NextResponse.redirect(new URL("/", origin));
  }
  return NextResponse.redirect(destination);
}
