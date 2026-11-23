# Google Sign-In — Implementation Plan

**Status:** Code implemented on `feat/google-signin`. **Provider not configured. Not enabled.**
**Date:** 2026-11-20 (revised: implementation landed; provider activation still deferred)
**Scope:** The application code, tests and documentation for PR 2 and PR 3 of §8 now exist
(`app/auth/callback/route.ts`, `lib/auth/oauth.ts`, `components/auth/GoogleSignInButton.tsx`, the
shared `provisionDevoteeRow` helper, CSP and robots changes). **Nothing is enabled**: the Google
provider is still off in the Supabase project, no Google Cloud OAuth client exists, no Vercel secret
was added and no migration was introduced. See §19 for what must still happen before this document
may say "enabled".

### 0.1 What is implemented, and what is still off

| Piece | State | Where |
| --- | --- | --- |
| PKCE callback (exchange, provisioning, safe redirect) | **Implemented**, inert until a provider exists | `app/auth/callback/route.ts` |
| OAuth initiation + callback-URL builder + feature flag | **Implemented** | `lib/auth/oauth.ts` |
| "Continue with Google" button on `/login` and `/register` | **Implemented**, hidden unless the flag is `"true"` | `components/auth/GoogleSignInButton.tsx` |
| Shared devotee provisioning (used by `/api/auth/me` and the callback) | **Implemented** | `lib/auth/provisioning.ts` → `provisionDevoteeRow` |
| `img-src https://*.googleusercontent.com` (CSP + `next/image`) | **Implemented** | `proxy.ts`, `next.config.ts` |
| `/auth/` in `robots.txt` disallow | **Implemented** | `app/robots.ts` |
| `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN` | **Implemented**, defaults to **off** | `lib/auth/oauth.ts` |
| Supabase Google provider | **NOT enabled** — owner action (§9) | — |
| Google Cloud OAuth client | **NOT created** — owner action (§10) | — |
| Redirect-URL allow-list entries | **NOT added** — owner action (§11) | — |
| Staging verification (§17) | **NOT run** | — |
| Database migration | **None added, none needed** | — |

### 0.2 The verified-email decision, as implemented

The callback reads `email_confirmed_at` from the **user returned by the verified code exchange**, not
from a token claim, a session field or a client payload, and it checks it **before any database read**.

- An identity with no confirmed email is refused (`?error=provisioning_failed`) and **no row is
  created**. This mirrors `/api/auth/register`, which requires the same field from
  `auth.admin.getUserById`.
- A confirmed email is **necessary but never sufficient**: it authorises *creating a new devotee
  row*, never *claiming an existing one*. A matching unlinked row still produces a neutral conflict
  (§5), exactly as for a password sign-in.
- Google's `email_verified` claim in `user_metadata` is treated as display data only. It is never
  read for a decision, and it can never grant a role.

> **Do not describe Google Sign-In as available** in any user-facing text, release note or
> documentation until the Phase 0 security remediation has merged (§5.2), the three Google PRs
> have merged, the owner has completed the dashboard steps in §9 and §10, and staging
> verification in §17 has passed.

> **Prerequisite:** Google OAuth must **not** be enabled until the Phase 0 provisioning
> vulnerabilities **S2**, **S3** and **S4** (§5.2) are remediated and merged in their own
> security PR. Adding a second identity provider on top of the current provisioning code would
> make existing-account takeover and duplicate-account creation easier to trigger, not harder.

---

## 1. Summary

The temple site authenticates with **Supabase Auth** (GoTrue) and nothing else. Adding
"Sign in with Google" means enabling a **native Supabase Auth OAuth provider** — not adding a
second authentication system, not adding a second identity store, and not adding an SDK.

| Question | Answer |
| --- | --- |
| New authentication system? | No. Same Supabase Auth, one extra provider. |
| New dependency? | No. `@supabase/supabase-js` already ships `signInWithOAuth`. |
| New database column? | No. |
| Role granted to a Google user? | `devotee`, always. See §7. |
| Does an existing admin change? | No. See §4. |
| Does an existing password user change? | No. See §3. |
| Automatic linking by matching email? | **Prohibited**, including when the email is verified. See §5. |
| Precondition? | Phase 0 remediation of S2, S3 and S4 must merge first. See §5.2. |

---

## 2. Current authentication architecture

### 2.1 One provider, three clients

| File | Runtime | Purpose |
| --- | --- | --- |
| `lib/supabase/client.ts` | Browser | `createBrowserClient` from `@supabase/ssr`. Persists the session in cookies so server route handlers see it. Substitutes a placeholder URL/key when the public env vars are absent so a build never fails. Captures the entry URL at module scope (recovery-link detection). |
| `lib/supabase/server.ts` | Server Components, Route Handlers | `createServerClient` bound to `next/headers` cookies. Its `setAll` swallows write errors from Server Components on the assumption that something else refreshes the session. |
| `lib/supabase/admin.ts` | Server only (`import "server-only"`) | Service-role client. Used for every authorization read and every Auth Admin call. Never reaches the browser. |

### 2.2 Session handling

- `context/AuthContext.tsx` is the browser's single source of session truth. It calls
  `supabase.auth.getSession()` once, then subscribes with `onAuthStateChange`.
- It registers `setAuthTokenGetter` (`lib/api/auth-token.ts`), so `lib/api/fetch.ts` attaches
  `Authorization: Bearer <access_token>` to every same-origin `/api/**` request.
- **Session refresh happens only in the browser.** `proxy.ts` (Next 16's renamed middleware)
  sets security headers and does nothing else; it has no `config.matcher` and no
  `supabase.auth.getUser()` refresh pass. Server-side code therefore sees whatever cookies the
  browser last wrote. This is a pre-existing characteristic, unchanged by this plan.

### 2.3 Server-side verification

- `lib/auth/verify-id-token.ts` — `verifyBearerIdToken` / `checkBearerIdToken`. Verifies with
  `supabase.auth.getUser(token)`. Distinguishes `invalid` (401 for the caller) from `unavailable`
  (a GoTrue 5xx, answered as 5xx so the client retries instead of asking the person to sign in
  again). Returns identity only: no role, no profile.
- `lib/auth/admin-auth.ts` — the admin authorization boundary. See §4.

### 2.4 Surfaces

| Surface | Path | Notes |
| --- | --- | --- |
| Public sign-in | `app/(auth)/login/page.tsx` → `components/auth/LoginForm.tsx` | Email + password. `GuestOnly` wrapper on `/register`. |
| Public sign-up | `app/(auth)/register/page.tsx` → `components/auth/RegisterForm.tsx` | `signUp` then `POST /api/auth/register`. |
| Password reset | `app/(auth)/forgot-password` | `resetPasswordForEmail`. |
| Admin console sign-in | `app/admin/ai/login`, `/forgot-password`, `/reset-password` | Addresses pinned in `lib/auth/raya-auth-routes.ts`. |
| Identity API | `app/api/auth/me`, `/register`, `/profile` | See §3. |
| Admin API | `app/api/admin/users/**`, `/api/ai/**` | Guarded by `admin-auth.ts`. |
| OAuth callback | `app/auth/callback/route.ts` | Exists (PR 2). Inert while the provider is disabled. |

### 2.5 Content-Security-Policy

The **effective** CSP is the one set in `proxy.ts`; the CSP declared in `next.config.ts`
`headers()` is overridden by it. `tests/unit/homepage-csp-supabase.test.ts` pins `proxy.ts` as the
real source. Any CSP change must be made in both files, and the test must be updated alongside.

---

## 3. Current user provisioning flow

`public.users` is the authorization table: `role`, `active` and `is_approved` live there and
nothing else. It is deny-all under RLS; every write goes through a service-role route handler.

There are four write paths today, and they do not deduplicate identically:

| # | Entry point | Behaviour |
| --- | --- | --- |
| 1 | `POST /api/auth/register` | Verifies the caller's identity first — a Bearer token whose `uid` **and** email must match the payload, or (for a freshly signed-up session that has no token yet) `auth.admin.getUserById` fail-closed. Rejects ambiguous `email`/`auth_user_id` matches with 409. Then **links an unlinked row by email (finding S2, §5.2)**, inserts `role: 'devotee', active: true`, or resolves a `23505` race idempotently. |
| 2 | `GET /api/auth/me` | After verifying the caller, **auto-inserts** a devotee row when no row matches `auth_user_id`. It does **not** consider email, so an existing manually created row yields a duplicate (**finding S3**), and its `23505` recovery can adopt an unlinked row (**finding S4**). See §5.2. |
| 3 | `POST /api/auth/profile` | Same auto-insert (`role: 'devotee'`, `active: true`, `is_approved: false`), with a strict schema that rejects privileged fields. |
| 4 | Admin/staff onboarding | `POST /api/admin/users/create-admin`, `POST /api/admin/users/set-role`, and `lib/seva/server/staff.ts:onboardStaff`. Creates or links the Supabase Auth login, writes the `users` row, the `staff` row and the audit row. Super-admin gated; `existingLogin()` already refuses an unverified email and requires a super admin to link an account that already holds an admin role. |

Paths 1 and 2 are the ones a Google user reaches first, and they are the reason Phase 0 (§5.2) is a
prerequisite.

### 3.1 Schema facts that constrain this plan

| Fact | Source |
| --- | --- |
| `users.email text NOT NULL`, **no UNIQUE constraint and no unique index** | `20261001000000_create_content_tables.sql` |
| `users.auth_user_id uuid`, **partial unique index** `idx_users_auth_user_id`; deliberately no FK to `auth.users` | `20261103000000_add_auth_user_id_to_users.sql` |
| `users.is_approved boolean NOT NULL DEFAULT false` | `20261201000000_add_is_approved_to_users.sql` |
| `users.role text NOT NULL DEFAULT 'user'` (code always writes `'devotee'` on self-provisioning) | `20261001000000_create_content_tables.sql` |
| `public.profiles` exists but is **not** part of authorization | `20261001000000_create_content_tables.sql` |
| `users` and `profiles` are deny-all under RLS | same migration |

Because `email` is not unique at the database level, duplicate prevention is application-level
only. That is the single largest correctness risk for this feature and is addressed in §5 and §15.

---

## 4. Current admin authorization flow

```
Request to /api/admin/** or /api/ai/**
  → lib/auth/admin-auth.ts: verifyAdminUserResult()
      ├ Bearer token present → supabase.auth.getUser(token)
      │   (else) no bearer  → cookie session via lib/supabase/server.ts: getUser()
      ├ no identity         → 401 missing_token / invalid_token / expired_token
      ├ GoTrue 5xx          → 503 auth_unavailable
      ├ load public.users WHERE auth_user_id = <verified uuid>
      │     no row          → 403 user_not_found
      ├ active === false    → 403 inactive_user
      ├ role normalized, must be on the allow-list:
      │     super_admin, temple_admin, admin, billing, priest, staff, office_staff
      │     otherwise       → 403 insufficient_role
      └ ok → { uid, email, role, provider: "supabase" }
```

Properties that must not change:

1. **Identity comes only from a verified Supabase access token or session cookie.** No
   client-supplied uid, email, query parameter or header is trusted.
2. **Role comes only from `public.users.role`**, read with the service-role client. Claims in
   `user_metadata` are ignored. Pinned by `tests/security/auth-unification-security.test.ts` and
   `tests/security/auth-cutover-rehearsal.test.ts`.
3. **`devotee` is not on the admin allow-list.** A user with the devotee role cannot reach any
   admin route, whichever provider authenticated them.
4. **Client-side guards (`AdminAuthGuard`, `AuthContext.normalizedRole`) only hide UI.** Every
   route re-verifies server-side.

Consequence for this feature: the admin flow is **indifferent to how the session was created**.
A Google session that has no `users` row receives `403 user_not_found`; one that has a devotee row
receives `403 insufficient_role`. "A Google user must not become an admin" is therefore already
structurally satisfied, provided no new code writes a privileged role. **No change to
`lib/auth/admin-auth.ts` is proposed.**

---

## 5. Identity rule (critical)

> **No automatic account linking based solely on a matching email address.**
>
> **This prohibition applies even when the email is verified.** Email verification proves control of
> an email address. It does **not** authorize automatic inheritance of an existing temple account's
> identity, role or history.

This restates the existing policy in `docs/auth/PHASE-2-IDENTITY-UNIFICATION.md`:

> **CRITICAL POLICY**: Automated linking based solely on email is strictly prohibited. Any
> ambiguous or conflicting identity must be inspected and reconciled via verified administrative
> process.

How this applies to Google Sign-In:

- **A Google sign-in with no `public.users` row** provisions a new row with
  `role = 'devotee'`, `active = true`. This is a *creation*, not a *link*, and it is the only
  automatic outcome the feature may produce.
- **A Google sign-in whose email matches an existing `public.users` row that has
  `auth_user_id IS NULL`** must **not** be linked automatically — **not even when Google reports
  `email_verified: true`**. The implementation must refuse to provision a duplicate row and must
  refuse to adopt the existing one. No `auth_user_id`, `role`, `display_name` or any other field
  is written. The person is told to contact the temple office.
- **A Google sign-in whose email matches a row owned by a different `auth_user_id`** must be
  refused with `409`. No write.
- **Matching emails must never cause duplicate account creation or privilege inheritance.**
  Creating a second `devotee` row for an email that already has a row is a defect, not a
  fallback: it splits a person's history and, for a staff or admin row, silently strips their
  access.
- **An unverified provider email must never be used as a matching key at all.** Google normally
  returns `email_verified: true`; the implementation must check it, not assume it.

### 5.1 Existing unlinked accounts require audited administrative reconciliation

An existing `public.users` row with `auth_user_id IS NULL` is an account the temple created
manually (or migrated from a previous system). It has no proven owner. Because email is the only
thing connecting a new sign-in to that row, and email alone is not proof of ownership of the
temple account, the **only** way such a row may become linked is an explicit, audited act by an
authorized human:

| Path | Who may run it | Audit |
| --- | --- | --- |
| `POST /api/admin/users/set-role` | Super admin for `super_admin`; permission-gated otherwise | Writes `auth_user_id` deliberately and records an audit row |
| Staff onboarding (`lib/seva/server/staff.ts`) | Super admin | Records an audit row; refuses an unverified email |
| `scripts/bootstrap-raya-admin.ts` | Operator, server-side only | Idempotent, fails closed on ambiguity, opt-in flags only |

None of these paths is changed by this plan. The point is that reconciliation is a **human
decision with an audit trail**, never an automatic consequence of a matching email string.

### 5.2 Confirmed security findings that block Google OAuth (Phase 0)

Three provisioning defects existed **independently of Google Sign-In**. They were remediated by
PR #428 (the Phase 0 security PR) before this OAuth work started; the findings are kept here as the
record of what that PR fixed and of the tests that now pin each one. The "CURRENT, VULNERABLE
behaviour" snippets below describe the code as it was **before** that PR and must not be
reintroduced.

| ID | Location | Finding | Severity |
| --- | --- | --- | --- |
| **S2** | `app/api/auth/register/route.ts` | Unsafe email-based linking of unlinked legacy rows | High |
| **S3** | `app/api/auth/me/route.ts` | Duplicate account creation for an existing email | High |
| **S4** | `app/api/auth/me/route.ts` | Unsafe `23505` race recovery can adopt an unlinked row | Medium |

#### S2 — unsafe email-based linking in `/api/auth/register`

The route links an unclaimed row to the caller's Auth UID purely because the email matches:

```ts
// app/api/auth/register/route.ts — CURRENT, VULNERABLE behaviour
// If email matches but auth_user_id was unpopulated (legacy record), link it
if (!existing.auth_user_id && existing.email?.toLowerCase() === email) {
  await supabase.from("users").update({ auth_user_id: userId, display_name: name })
    .eq("id", existing.id);
}
```

The route never inspects `email_confirmed_at`. An attacker who signs up with a victim's email —
before confirming it — can bind their own Auth identity to the victim's pre-existing unlinked row
and **inherit that row's role**. Google Sign-In would make this easier to trigger, because Google
identities arrive pre-verified.

**Required remediation:** remove the automatic link entirely. Refuse a matching unlinked row with
a neutral `409` and perform **no database write**. Preserve same-UID idempotency and preserve the
`409` for rows linked to a different identity. Require authoritative Supabase email verification
before provisioning a *new* account, and fail closed when verification status cannot be
established.

#### S3 — duplicate account creation in `/api/auth/me`

`/api/auth/me` matches **only** on `auth_user_id`; it never considers email:

```ts
// app/api/auth/me/route.ts — CURRENT, VULNERABLE behaviour
const filterQuery = `auth_user_id.eq.${callerUid},id.eq.${callerUid}`;
// ... no row found ...
const insertPayload = { email: callerEmail || "", role: "devotee", active: true, ... };
await supabase.from("users").insert(insertPayload);
```

If an admin was created manually (the manual path writes no `auth_user_id`) and later signs in,
`/api/auth/me` finds no row and inserts a **second** row with `role: 'devotee'`. The person gets a
duplicate account and silently loses their role.

**Required remediation:** before provisioning, detect a matching unlinked row by email and refuse
with a safe conflict. Do not link it, do not insert a duplicate, and do not expose its role.

#### S4 — unsafe `23505` race recovery in `/api/auth/me`

On a unique-constraint conflict, the route re-queries and returns whatever row it finds, **without
checking that the row belongs to the caller**:

```ts
// app/api/auth/me/route.ts — CURRENT, VULNERABLE behaviour
if (isConflict) {
  const { data: recheck } = await supabase.from("users")...maybeSingle();
  if (recheck) return NextResponse.json(mapRowToProfile(recheck, callerEmail));  // adopts an unlinked row
}
```

**Required remediation:** after a `23505`, return success **only** when the resulting row is
demonstrably linked to the requesting Auth UID. An unlinked row or a row linked to another UID
returns a safe conflict. Fail closed on database errors and on ambiguous results.

#### Why Phase 0 is a hard prerequisite

Google OAuth adds a second way to reach exactly these code paths. Enabling it first would widen
the S2 takeover window (pre-verified emails) and increase the S3 duplicate rate (more people
arriving with an email the temple already has on file). The remediation is therefore **not**
optional hardening; it is the foundation the OAuth work stands on.

#### Scope boundary

The Phase 0 PR covers S2, S3 and S4 **only**. It does not add OAuth, does not add admin-mediated
account claiming, does not change `admin-auth.ts` or `ADMIN_CONSOLE_ROLES`, does not change staff
authorization, and does not add an email-uniqueness migration.

---

## 6. Proposed Google OAuth flow

```
/login  (or /register)
  │  user presses "Continue with Google"
  ▼
supabase.auth.signInWithOAuth({ provider: "google",
                                options: { redirectTo: "<origin>/auth/callback?next=<sanitized>" } })
  │  browser navigates to  https://<project-ref>.supabase.co/auth/v1/authorize?provider=google...
  ▼
Google consent screen
  │  redirects to  https://<project-ref>.supabase.co/auth/v1/callback   ← the only Google-side URL
  ▼
GoTrue creates/links the auth user, then redirects to
  https://<app-origin>/auth/callback?code=<pkce-code>
  ▼
app/auth/callback/route.ts   (new, PR 2)
  ├ no `code`                      → redirect to /login?error=<safe code>
  ├ supabase.auth.exchangeCodeForSession(code)
  │     error                      → redirect to /login?error=<safe code>   (never a 500)
  ├ provision (§5): create devotee | refuse on email conflict
  ├ sanitize `next` with lib/auth/safe-return.ts: sanitizeReturnPath (server form)
  └ redirect to the sanitized path (default "/")
```

Design points:

- The callback is a **Route Handler**, not a page, so the code exchange happens server-side and
  the access token is written into the cookie session by `@supabase/ssr` — the same session
  mechanism email/password uses. Nothing about `AuthContext` changes.
- The callback must handle the **email-confirmation** link shape as well (`?code=` from a signup
  confirmation), because the same route is the natural destination for `emailRedirectTo`. This is
  a benefit, not a requirement, of the feature.
- `signInWithOAuth` returns a URL; the browser is navigated to it. No SDK is added.
- No change to `detectSessionInUrl`, no change to the storage key, no change to `flowType`.
  Existing sessions are therefore untouched.

---

## 7. Roles granted to OAuth users

**A person who signs in with Google receives exactly one role: `devotee`.** Concretely:

| Field | Value written | Where |
| --- | --- | --- |
| `role` | `'devotee'` | the provisioning path (PR 1) |
| `active` | `true` | same |
| `is_approved` | `false` (column default) | same |

`devotee` is **not** in `ADMIN_CONSOLE_ROLES`, so such a user:

- cannot open any `/admin/**` page (client guard) and
- cannot call any `/api/admin/**` or `/api/ai/**` route (server guard, 403 `insufficient_role`), and
- cannot read `users`, `staff`, or any other deny-all table directly (RLS).

Becoming staff or an admin is unchanged and remains an explicit act by an authorized human:
`POST /api/admin/users/create-admin` (super admin), `POST /api/admin/users/set-role`
(super admin for `super_admin`, permission-gated otherwise), or staff onboarding. None of those
paths is touched by this plan.

Google's `user_metadata` (`full_name`, `avatar_url`, `email_verified`) is used for **display only**
and must never influence `role`, `active` or `is_approved`.

---

## 8. Implementation sequence

Four PRs, in order. Each is independently reviewable and independently revertible. **PR 0 must
merge before PR 1 begins**, because PR 1 builds on the provisioning semantics PR 0 establishes.

### PR 0 — Phase 0 security remediation (prerequisite, no Google)

Purpose: remove the S2, S3 and S4 vulnerabilities (§5.2) *before* a second provider can reach
them. This PR is a **security fix in its own right**; it is not part of the Google feature and is
not gated on it.

- **S2 — `app/api/auth/register/route.ts`**: delete the automatic email-based linking of an
  unlinked row. A matching unlinked row is refused with a neutral `409` and **no database write**
  occurs. Same-UID idempotency and the different-UID `409` are preserved. Provisioning a new
  account requires authoritative Supabase email verification; a verification status that cannot be
  established fails closed.
- **S3 — `app/api/auth/me/route.ts`**: resolve the caller's row by Auth UID first. If none exists
  but an unlinked row matches the caller's email, refuse with a safe conflict — do not link it, do
  not insert a duplicate, and do not disclose its role.
- **S4 — `app/api/auth/me/route.ts`**: after a `23505`, return success only when the re-queried
  row is demonstrably linked to the requesting Auth UID. Unlinked, foreign-owned and ambiguous
  results return a safe conflict; database errors fail closed.
- Tests: the fifteen regression cases in the Phase 0 delivery report, each of which must fail
  against the vulnerable implementation and pass after the fix.

Touches: `app/api/auth/register/route.ts`, `app/api/auth/me/route.ts`, and their tests. Does
**not** touch `admin-auth.ts`, `ADMIN_CONSOLE_ROLES`, `verify-id-token.ts`, the seva module,
`/api/auth/profile`, or any migration.

### PR 1 — Shared provisioning helper (no Google)

- Extract the now-safe provisioning rules from PR 0 into one shared, email-aware helper used by
  `GET /api/auth/me` and `POST /api/auth/profile`, so the two paths cannot drift:
  - returns the existing row when `auth_user_id` matches (no write);
  - **refuses** (no write) when a row exists with the same `lower(email)` and
    `auth_user_id IS NULL` — per §5, no automatic linking;
  - **refuses with 409** when a row exists with the same email owned by a different
    `auth_user_id`;
  - inserts `role = 'devotee'`, `active = true` only when neither exists;
  - resolves a `23505` race by re-querying and returning the winner **only if it is linked to the
    caller**.
- Tests: the five cases above, including "one row after first sign-in".

### PR 2 — Callback route and CSP — **implemented**

- Add `app/auth/callback/route.ts` and `lib/auth/oauth.ts` (redirect builder + `signInWithOAuth`).
- Add `https://*.googleusercontent.com` to `img-src` in **both** `proxy.ts` and `next.config.ts`.
- Add `/auth/` to the `robots.ts` disallow list.
- Tests: callback error/success paths, `next` sanitization, CSP assertion.

The route exists after this PR but nothing links to it, so it is inert in production.

### PR 3 — UI, flag and documentation — **implemented** (provider still off)

- Add `components/auth/GoogleSignInButton.tsx` and place it on `/login` (and `/register`).
- Optional build-time kill-switch `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN`, defaulting to **off** when
  absent, so a rollout can be paused without touching the Supabase dashboard.
- Show a clear "not configured" state when `getSupabaseConfigStatus().isConfigured` is false,
  instead of a silent failure.
- Update `docs/SECURITY.md` to state the provider is enabled (only once §9–§10 are actually done),
  and update this document's status line.

### Separate, later (not part of PR 0–PR 3)

- **Optional** `CREATE UNIQUE INDEX ... ON public.users (lower(email))`. This is a production DDL
  change and needs its own PR and explicit owner approval — see §15 and the operational warning in
  §18.1.
- **Provider activation** is an owner action in the Supabase dashboard (§9), not a PR.

---

## 9. Supabase Dashboard configuration (owner action, not a PR)

Project → **Authentication**:

1. **Providers → Google** — enable. Paste the Client ID and Client Secret from §10. Leave
   "Skip nonce check" **off**.
2. **URL Configuration → Site URL** — `https://www.srsmathaynk.com` (the canonical host, matching
   `SITE_URL` in `lib/seo.ts`).
3. **URL Configuration → Redirect URLs** — add every entry in §11. Keep the existing
   `/admin/ai/reset-password` entries; do not replace the list.
4. **Confirm the account-linking behaviour** described in §5 and record the answer here before
   enabling the provider for the public.
5. Leave **email confirmations** and the existing email templates unchanged.

Ordering matters: enable the provider **after** PR 2 is deployed. A provider that is live while
no callback route exists sends people to a 404 with a spent `code`.

---

## 10. Google Cloud configuration

Google Cloud Console → APIs & Services → Credentials → **Create credentials → OAuth client ID →
Web application**.

| Setting | Value |
| --- | --- |
| Name | `Sri Raghavendra Swamy Matha — Supabase Auth` |
| Authorized JavaScript origins | Not required for the Supabase redirect flow. Add `https://www.srsmathaynk.com` and `http://localhost:3000` only if Google One Tap is adopted later. |
| Authorized redirect URIs | **`https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`** — exactly one, and this is the only one needed. |

Google only ever redirects to Supabase; it never sees the application origin.

**OAuth consent screen**

- App name: `Sri Raghavendra Swamy Matha`; support email; logo; the temple's privacy-policy and
  terms URLs.
- Scopes: `openid`, `email`, `profile` — all non-sensitive, so **no Google verification review**
  is required.
- Publishing status: while the app is in **Testing**, only listed test users can sign in. Publish
  it before the production rollout, or real devotees will be refused by Google.

**Secret handling:** the client secret is entered **only** in the Supabase dashboard. It must not
appear in `.env.example`, Vercel, GitHub Actions, the repository, or any log. Rotate it immediately
if it is ever pasted anywhere else.

---

## 11. Redirect URLs

### 11.1 Supabase → Redirect URLs allow-list

```
http://localhost:3000/auth/callback
https://www.srsmathaynk.com/auth/callback
https://srsmathaynk.com/auth/callback
https://*-<vercel-team-slug>.vercel.app/auth/callback
```

| Environment | App origin | Callback URL |
| --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:3000/auth/callback` |
| Staging / preview | `https://<deployment>.vercel.app` | `https://*-<vercel-team-slug>.vercel.app/auth/callback` |
| Production (canonical) | `https://www.srsmathaynk.com` | `https://www.srsmathaynk.com/auth/callback` |
| Production (apex) | `https://srsmathaynk.com` | `https://srsmathaynk.com/auth/callback` |

Notes:

- A URL that is not on this list is silently replaced by the **Site URL**, which produces the
  classic symptom "Google sent me back to the homepage". Add every origin actually in use.
- Wildcards are supported and are the practical way to cover Vercel preview deployments. If
  **Deployment Protection** is enabled on previews, a human cannot complete the round-trip there
  without a bypass; in that case restrict the allow-list to production and localhost and test
  previews by adding the specific deployment URL.
- Apex and `www` are separate origins and need separate entries.

### 11.2 Google Cloud

Only `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`. Application origins do not
belong in Google's redirect-URI list.

---

## 12. Vercel environment variables

**None are required for Google Sign-In.** The Google credentials live in Supabase, not in Vercel.

Unchanged and still required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY            # or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY                # server only
```

Optional, introduced by PR 3 and **off unless set to the literal `true`**:

```
NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true    # build-time; absent/anything else ⇒ button not rendered
```

`lib/auth/oauth.ts:isGoogleSignInEnabled` trims and lower-cases the value and requires `"true"`, so
`""`, `"false"`, `"1"` and `"yes"` all leave Google sign-in hidden. The value is read literally
(`process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN`), because Next replaces `NEXT_PUBLIC_*` at build
time.

The flag is enforced twice, and the second check is the one that matters:

1. **UI** — `components/auth/GoogleSignInButton.tsx` renders nothing when the flag is off, and
   `signInWithGoogle` refuses to call `signInWithOAuth` at all.
2. **Server** — `app/auth/callback/route.ts` checks the same flag **before** touching the code, so a
   hand-built or stale `/auth/callback?code=…` request cannot exchange a code or provision a row while
   Google sign-in is disabled. It answers with the ordinary `?error=provider_error` redirect.

No new GitHub Actions secret is needed; `ci.yml` and `supabase-migrations.yml` are unaffected.

---

## 13. CSP and avatar requirements

Google profile pictures are served from `*.googleusercontent.com`.

| Directive | Current state | Change |
| --- | --- | --- |
| `connect-src` | already contains `https://*.googleusercontent.com` | none |
| `img-src` | **missing** `*.googleusercontent.com` | **add it** |
| `frame-src` | no Google frame needed | none |

Without the `img-src` entry, avatars are blocked by the browser — a silent, confusing UI bug.

Because the CSP exists in two files and only one is effective:

1. update `proxy.ts` (authoritative), **and**
2. update `next.config.ts` so the two cannot drift, **and**
3. extend `tests/unit/homepage-csp-supabase.test.ts` to assert `googleusercontent` is present in
   the `img-src` produced by `proxy.ts`.

If avatars are rendered with `next/image`, `next.config.ts` `images.remotePatterns` also needs
`lh3.googleusercontent.com`. Rendering the avatar as a plain `<img>` with a `referrerPolicy` avoids
that configuration entirely and is the simpler option.

---

## 14. Security considerations

1. **No privilege from a provider.** A Google session carries no role. `role` is read from
   `public.users` with the service-role client and must be on `ADMIN_CONSOLE_ROLES`. Nothing in
   this plan writes a role other than `'devotee'`.
2. **Never trust `user_metadata`.** Display only. The existing security tests that assert this must
   stay green.
3. **Email is not an identity key.** See §5. Matching on email may only be used to *detect a
   conflict and refuse*, never to merge two identities.
4. **Unverified-email takeover.** An attacker who registers `someone@example.com` with a password
   and never confirms it must not be able to absorb — or be absorbed by — the real owner's Google
   identity. Require `email_verified === true` from the provider before provisioning a *new*
   account; `lib/seva/server/staff.ts` already enforces the same rule for staff. **Verification is
   necessary but never sufficient:** a verified email still does not authorize claiming an
   existing unlinked row (§5), so verification must never be treated as a linking permit.
5. **PKCE.** Keep the SDK default — the `@supabase/ssr` browser client uses the PKCE flow, and the
   existing Raya AI reset-password page already depends on that (`?code=` exchange). Exchange the
   code server-side in the callback. Do not set `flowType: 'implicit'`, do not disable
   `detectSessionInUrl`. Do not accept a `code` on a page that also renders authenticated content.
   A PKCE code is single-use and bound to the browser that started the flow.
6. **`state` / CSRF.** `signInWithOAuth` generates and verifies the `state` parameter; do not
   hand-roll the authorize URL, and do not bypass the SDK for the exchange.
7. **Safe redirects.** Both `redirectTo` and `next` are attacker-controllable. Route them through
   `lib/auth/safe-return.ts`: the server boundary uses `sanitizeReturnPath` (an explicit origin, no
   browser global), the browser uses `safeReturnPath`. Both handle `//host`, backslashes, control
   characters, look-alike Unicode slashes and multi-round percent-encoding, and fall back to `/`.
   Never pass a raw query value to `NextResponse.redirect`.
8. **No secrets in the browser.** The Google client secret and the service-role key stay
   server-side. The callback uses the anon key plus the caller's own code.
9. **Banned / deleted accounts.** `admin-auth.ts` calls `getUser()` on every request, so a banned
   or deleted Supabase user is refused regardless of provider. A ban applies to the user, not to
   the identity.
10. **Error surfaces.** The callback redirects with a coarse error code. It must never echo the
    provider's raw error, the `code`, or a token into the URL or the page.
11. **Privacy.** Google returns name, email and picture. The privacy policy must mention OAuth
    sign-in before the provider is enabled for the public.
12. **Existing sessions and authorization are unchanged**: no cookie name change, no storage-key
    change, no `flowType` change, no change to `admin-auth.ts`, no RLS change.

---

## 15. Production pre-flight checks (read-only)

Run these **before** PR 0 is merged, and again before the provider is enabled. They are read-only.
They must be executed by someone authorized to read production, through the read-only diagnostic
tooling — not by ad-hoc writes, and not from this document.

| # | Check | Why it matters | Pass condition |
| --- | --- | --- | --- |
| 1 | Count `public.users` rows grouped by `lower(email)` where `count(*) > 1` | Duplicate profiles would make "which row does this person get?" ambiguous | Zero groups |
| 2 | Count `public.users` rows with `email IS NOT NULL AND auth_user_id IS NULL` | Each is a row a Google sign-in could collide with; per §5 these are refused, not linked | Each one enumerated and understood |
| 3 | Enumerate the admin rows (`role` on the allow-list) and their `auth_user_id` | Confirm every admin is already linked, so no admin is affected by the refusal path | Every admin has a non-null `auth_user_id` |
| 4 | Confirm the Supabase project's account-linking behaviour (§5) | Decides whether GoTrue reuses an existing auth user or creates a second one. The application refuses email-based linking either way | Recorded in this document |
| 5 | Confirm the Site URL and the current Redirect-URL allow-list | A missing entry silently falls back to the Site URL | Matches §11 |
| 6 | Confirm `NEXT_PUBLIC_SUPABASE_URL` / key in Vercel are the project's real values, not placeholders | A placeholder build makes every sign-in look like a wrong password | `getSupabaseConfigStatus().isConfigured === true` on production |

Existing tooling that may help: `npm run diagnose:raya-admin-login` (read-only) and
`scripts/diagnose-supabase-connectivity.ts`. Note that `npm run diagnose:auth-identities` is cited
in `docs/auth/PHASE-2-IDENTITY-UNIFICATION.md` and `docs/auth/PHASE-3-AUTH-AUDIT.md` but **no such
script exists in `package.json` or `scripts/`** — the checks above must be run with whatever
read-only tooling the owner has approved, not by assuming that command works.

If check 1 is non-zero, **stop**: resolve the duplicates through the approved reconciliation
process before proceeding. Do not add a unique index and do not enable the provider over a
duplicate set.

---

## 16. Facebook and Instagram

### 16.1 Facebook — deferred

Technically feasible (Supabase supports it natively) but **not in scope now**:

- Requires a Meta app, Business Verification and App Review for the `email` permission before
  anyone outside the developer list can sign in.
- Facebook returns a missing or unverified email for a meaningful share of accounts (phone-only
  sign-ups). That collides directly with a `public.users` model keyed on email and with §5.
- It is a second dashboard, a second review process and a second privacy disclosure for an
  audience that is overwhelmingly Gmail-based.

Revisit only if sign-in analytics show a real non-Gmail cohort. It would be a fourth PR, following
the same pattern: callback route, devotee-only provisioning, no email-based linking.

### 16.2 Instagram — not supported for consumer authentication

Three independent blockers:

1. **Supabase has no Instagram provider.** Using it would mean a hand-rolled OAuth/OIDC flow — a
   second authentication path, which this architecture forbids.
2. **No email address is returned.** Instagram's API does not expose the user's email, so it cannot
   map to `public.users.email`, cannot be deduplicated against existing accounts, and would break
   staff linking, receipts and notifications.
3. **The consumer API is gone.** Instagram Basic Display was deprecated and shut down in
   December 2024. What remains (Instagram API with Instagram Login) is scoped to professional
   accounts for content publishing and insights, not consumer sign-in — so coverage would be near
   zero even ignoring the first two blockers.

Instagram is appropriate only as a **social embed / marketing** concern, never as an
authentication provider for this application.

---

## 17. Test plan

### Unit (Jest, no network)

- `lib/auth/oauth.ts` — redirect builder returns `<origin>/auth/callback?next=…`; hostile `next`
  values (`//evil.com`, `%2F%2Fevil.com`, `https://evil.com`, `javascript:…`, `/\evil.com`)
  collapse to `/`.
- `app/auth/callback/route.ts` — missing `code` redirects to `/login` with a coarse error; a failed
  exchange redirects and never 500s; success redirects to the sanitized `next`; an off-site `next`
  is refused; no token or code appears in any redirect URL.
- The provisioning helper — the five cases in §8/PR 1, plus "exactly one row after first sign-in"
  and "no write when refusing".
- **Phase 0 (PR 0) regression set** — every case in §5.2: an unverified identity cannot provision
  and cannot claim an unlinked row; a *verified* identity still cannot claim an unlinked row; the
  unlinked row is byte-for-byte unchanged after refusal; a manually created unlinked row with a
  matching email yields no duplicate in `/api/auth/me`; `23505` recovery resolves to a conflict
  when the winner is unlinked or foreign-owned, and to success only when it is the caller's own
  row; a database error fails closed.
- `GoogleSignInButton` — renders, calls `signInWithOAuth` once, exposes an accessible name, is
  keyboard focusable, and shows the "not configured" state when Supabase config is a placeholder.

### Regression (must remain green, unchanged)

- `tests/security/auth-unification-security.test.ts`, `auth-cutover-rehearsal.test.ts` —
  `user_metadata.role` is ignored.
- `tests/security/admin-role-fail-closed.test.ts` — the eight fail-closed promotion cases.
- `tests/unit/admin-auth.test.ts`, `dual-token-admin-auth.test.ts`, `admin-api-auth-guard.test.ts`,
  `admin-auth-guard-redirect.test.tsx`.
- `tests/unit/auth-context-supabase.test.tsx`, `auth-service-supabase.test.ts`,
  `login-form-redirect.test.tsx`, `api-auth-profile.test.ts`.
- `tests/unit/homepage-csp-supabase.test.ts` (extended) and `tests/unit/no-firebase-runtime.test.ts`.

### New security tests

- A Google-authenticated session with only a devotee row → 403 `insufficient_role` from
  `verifyAdminUserResult` and from `/api/admin/users`.
- A Google-authenticated session with **no** `users` row → 403 `user_not_found` (not 200, not 500).
- An unlinked row with a matching email → refused, and the row count is unchanged afterwards.
- A row with a matching email owned by a different `auth_user_id` → 409, and no write.

### Integration / e2e (Playwright)

- `/login` renders the Google button; with placeholder Supabase config it surfaces the
  configuration message rather than failing silently.
- Full OAuth round-trip against a **local** Supabase stack (the harness in
  `scripts/e2e/run-seva-e2e.mjs` already boots one): mock the Google token endpoint, assert the
  callback sets cookies and lands on `/`.
- A signed-in devotee is bounced from `/admin` and can open `/profile`.
- Existing `tests/e2e/auth/*.spec.ts` (AUTH-001…AUTH-009) still pass.

### Manual, staging only

- A Gmail account that has never used the site → one `users` row, `role = 'devotee'`.
- An existing password devotee signs in with Google → one row, same `auth_user_id`, role
  unchanged, the password still works.
- A super admin signs in with Google → one row, role unchanged, admin console accessible, and **no**
  new privileged row is created.
- Revoking the app's access in the Google account re-consents cleanly on the next sign-in.

### Baseline validation before each PR

```bash
npm run typecheck    # note: AGENTS.md says `type-check`; the real script is `typecheck`
npm run lint
npm run test
npm run build
```

---

## 18. Rollback

Every step is reversible without touching user data.

| Situation | Action |
| --- | --- |
| Google sign-in misbehaves in production | **Disable the Google provider** in Supabase → Authentication → Providers. Sign-in with Google stops immediately; every email/password session and every admin authorization path is unaffected. This is the primary kill-switch and requires no deployment. |
| The feature must disappear from the UI | Set `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=false` (or unset it) and redeploy. The button is not rendered; the callback route stays reachable but harmless. |
| A bad deploy | Revert the PR. PR 0, PR 1, PR 2 and PR 3 are independent, so the UI can be reverted without reverting the Phase 0 security remediation, and vice versa. |
| A callback bug is redirecting people wrongly | Disable the provider (row 1). No code change is needed to stop the flow. |
| A duplicate row was created by a bug | Do **not** delete rows as a first response. Disable the provider, capture the affected ids, and reconcile through the approved administrative process. |

Rollback does **not** require: a migration, a data restore, invalidating sessions, or rotating
secrets. Existing sessions survive all of the above.

### 18.1 Operational warning carried forward

`supabase/config.toml` documents that a Supabase GitHub integration applies every
`supabase/migrations/*.sql` to **production** on push to `main`, independently of the manual
workflow. The optional unique index in §8 would therefore be a production DDL change the moment its
PR merges. It needs its own PR, its own approval, and nothing else in that PR.

---

## 19. What must be true before this document says "enabled"

- [x] **PR 0 merged** — PR #428: S2, S3 and S4 remediated (no email-based linking anywhere, no
      duplicate provisioning, `23505` recovery can never adopt an unlinked row). Deployed.
- [x] PR 1 — the shared provisioning helper is `provisionDevoteeRow` in `lib/auth/provisioning.ts`,
      used by `/api/auth/me` and the OAuth callback. Merged with the Google implementation.
- [x] PR 2 — `/auth/callback` exists; `img-src` allows `https://*.googleusercontent.com` in both
      `proxy.ts` and `next.config.ts`; `/auth/` is disallowed in `robots.ts`.
- [x] PR 3 — the button, the `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN` flag (default off) and these docs.
- [ ] §15 pre-flight checks pass, including a zero duplicate-email count.
- [ ] §9 dashboard steps completed, with the Site URL and full Redirect-URL list in place.
- [ ] §10 Google Cloud client created, consent screen **published**, redirect URI exact.
- [ ] The owner has confirmed and recorded the Supabase account-linking behaviour for this
      project, and accepted that the application never links by email regardless of that
      behaviour (§5).
- [ ] §17 staging verification passed, including the three manual sign-in scenarios.
- [ ] `docs/SECURITY.md` provider table updated to "enabled" in the same change that completes the
      above.
- [ ] The status line at the top of this document updated.

---

## 20. References

- `docs/auth/PHASE-2-IDENTITY-UNIFICATION.md` — identity mapping and the no-email-linking policy.
- `docs/auth/PHASE-3-READINESS-REPORT.md` — architectural principles (server-derived identity,
  no client role escalation, fail-closed provisioning).
- `docs/auth/PHASE-3.1-PRODUCTION-HARDENING.md` — registration and admin-provisioning hardening.
- `docs/RAYA_AI_PASSWORD_RECOVERY.md` — the existing Redirect-URL allow-list procedure.
- `docs/SECURITY.md` — authentication, authorization and RLS summary.
- `docs/DATA-MODEL.md`, `docs/SUPABASE_DATABASE_SCHEMA.md` — table definitions.
- `supabase/config.toml` — the production auto-deploy switch for migrations (see §18.1).
