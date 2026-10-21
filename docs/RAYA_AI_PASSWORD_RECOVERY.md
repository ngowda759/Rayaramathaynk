# Raya AI password recovery (Supabase Auth)

Raya AI administration signs in with **Supabase Auth** (email + password). It is
separate from the temple's Firebase login, which still serves every other
`/admin/**` page. This document covers the three unauthenticated pages and the
one piece of **manual Supabase configuration** the flow needs.

| Page | Address | Purpose |
| --- | --- | --- |
| Sign in | `/admin/ai/login` | `signInWithPassword` |
| Request reset | `/admin/ai/forgot-password` | `resetPasswordForEmail` |
| Choose new password | `/admin/ai/reset-password` | `updateUser({ password })` |

## Required manual configuration: the redirect allow-list

The reset email link must be allowed to return to this site. Supabase sends the
link to the project's **Site URL** when the `redirectTo` is not on the allow-list,
which produces the symptom "the recovery email arrives, but the link opens the
public homepage with no reset form".

An administrator must set, in the Supabase dashboard:

1. **Authentication → URL Configuration → Redirect URLs** — add every origin the
   console is served from, with the reset path:

   ```
   https://www.<production-domain>/admin/ai/reset-password
   http://localhost:3000/admin/ai/reset-password
   https://<preview-or-staging-domain>/admin/ai/reset-password
   ```

   Wildcards are supported and are convenient for Vercel preview deployments:

   ```
   https://*-<team-slug>.vercel.app/admin/ai/reset-password
   ```

2. **Authentication → URL Configuration → Site URL** — set it to the production
   site. It is the fallback destination, so it should never be a page without a
   reset form.

3. **Authentication → Emails → Reset Password** — the template must carry the
   token to the reset page. The default `{{ .ConfirmationURL }}` template works:
   it produces a PKCE `?code=` link when the request came from the same browser,
   and a `?token_hash=` link otherwise. Both shapes are handled by the reset page.

No secret, service-role key or database change is required for recovery: the
flow runs entirely through the public `anon` key and the person's own session.

## Why the sign-in page used to say "Invalid email or password" for everything

`lib/supabase/client.ts` substitutes a placeholder URL/key when
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent, so a
build without them still compiles. Before this change the login page collapsed
every failure - a wrong password, an unconfirmed email, a rate limit, a network
error, or that placeholder client - into one message. A deployment missing its
Supabase variables therefore looked exactly like a forgotten password.

The page now maps the failure:

- a rejected credential keeps the shared wording, and an unknown email is
  deliberately indistinguishable from a wrong password (no account enumeration);
- an unconfirmed email, a rate limit, a weak password and a reused reset link
  each get their own message;
- a transport failure or an unconfigured deployment says so instead of blaming
  the password.

## How a recovery link is redeemed

A Supabase recovery link arrives in one of three shapes, and
`app/admin/ai/reset-password/page.tsx` handles all three without consuming the
credential twice:

| Shape | How it is redeemed |
| --- | --- |
| `?code=<uuid>` (PKCE) | The browser client redeems it during initialization (`detectSessionInUrl`); `getSession()` awaits that. An explicit `exchangeCodeForSession` is only a fallback. |
| `?token_hash=<hash>&type=recovery` | `verifyOtp({ type: "recovery", token_hash })`. |
| `#access_token=...&type=recovery` | Redeemed during initialization; the client emits `PASSWORD_RECOVERY`, which the page listens for. |

The form is shown only for a session that came from a recovery link. A session
that did not (an ordinary signed-in session) is refused, so the page cannot be
used to change a password without the emailed link.

### Why the page must read the *entry* URL, not the live one

The Supabase browser client is a singleton whose SDK **auto-initializes in its
constructor** (`GoTrueClient` calls `this.initialize()`), and that initialization
is what redeems a `?code=` or `#access_token=` link. It then **deletes the
credential from the address bar**.

That interacts badly with the layout. `app/admin/layout.tsx` wraps every admin
page in `AdminAuthGuard`, and the guard mounts *before* the page and calls
`useSupabaseSession()` → `createClient()`. So by the time the reset page's effect
runs:

1. the guard has already constructed the client,
2. the SDK has already redeemed the `?code=` link and created a session,
3. the SDK has already erased `?code=` from `window.location`.

A page that read `window.location` at that moment saw a session but no
credential, and rendered *"Open this page from the password reset link in your
email to choose a new password"* — even though the person had just clicked that
exact link. This was the reported production symptom, and it was an ordering
race, not a credential problem.

`lib/supabase/client.ts` therefore captures the entry URL **at module scope**.
That placement is what makes it correct: the module defines
`createBrowserClient`, so it has necessarily been evaluated before any client can
be constructed, and the capture cannot lose the race. A capture inside a page
component would race the guard again. The captured value is a URL (already in the
address bar and browser history), never a secret, and the page reduces it to a
boolean with `hasRecoveryCredential` before using it.

The gate accepts a session when either the page redeemed the credential itself
(`recoveryVerified`) or the credential was observed at entry
(`sawRecoveryCredential`). The second case is the one the SDK's own redemption
produces.

## Diagnosing a recovery failure

The reset page writes one redacted line to the console per attempt, for example:

```
raya-ai/recovery reason=not-recovery link=none credential=absent session=present verified=no config=ok
```

Every field is a boolean or a member of a closed set, so the line cannot carry a
`code`, `token_hash`, `access_token` or session. The `reason` names the category:

| `reason` | Meaning | What to do |
| --- | --- | --- |
| `link-error` | The redirect carried an error, or the deployment is unconfigured | Check `config=`; request a new link |
| `expired-link` | The credential was present but rejected | Request a new link |
| `no-session` | No session after the attempt; `credential=present` means it was opened in another browser | Open the newest link in the same browser that requested it |
| `not-recovery` | A session exists but no recovery credential was ever seen | Open the link from the email, not the address directly |
| `ready` | The form is shown | — |

The page also shows the matching sentence to the person, so a screenshot is
enough to identify the category.

## Diagnosing a sign-in failure

`signInWithPassword` answers the same `invalid_credentials` for an unknown email
and a wrong password, so the client cannot tell them apart. An operator with the
service-role key can:

```bash
RAYA_ADMIN_EMAIL="<address>" \
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
npx tsx scripts/diagnose-raya-admin-login.ts
```

The script only reads (Auth Admin `listUsers` and a `public.users` select) and
prints structure: how many Auth accounts share the address, whether the account
has an email/password identity, whether the authorization row is linked by
`auth_user_id`, and the role/active flags. It never reads, prints or changes a
password, and it never writes. Its verdicts are pinned by
`tests/unit/raya-login-diagnosis.test.ts`.

A verdict of `ok` with a failing sign-in means the stored password does not
match; set a new one through the reset flow above rather than recreating the
account. Authorization is untouched by recovery: `public.users` keeps its `role`
and `active`, and `lib/auth/raya-admin-auth.ts` still enforces them on every
`/api/ai` request.

## Tests

| File | Covers |
| --- | --- |
| `tests/unit/raya-ai-auth-errors.test.ts` | Failure mapping, no enumeration, no raw server text |
| `tests/unit/raya-password-recovery.test.ts` | Link shapes, the reset gate, password rules |
| `tests/unit/raya-login-diagnosis.test.ts` | Each diagnosis verdict |
| `tests/unit/supabase-public-config.test.ts` | Placeholder/missing configuration detection |
| `tests/unit/raya-ai-recovery-wiring.test.ts` | Supabase-native wiring, no Firebase, no service-role key in a client component |
| `tests/unit/components/admin/raya-ai-login-page.test.tsx` | Sign-in failures and success |
| `tests/unit/components/admin/raya-ai-forgot-password-page.test.tsx` | Reset request, `redirectTo`, enumeration safety |
| `tests/unit/components/admin/raya-ai-reset-password-page.test.tsx` | Link redemption, gating, `updateUser` |
| `tests/unit/admin-auth-guard-redirect.test.tsx` | The recovery pages render ungated |
| `tests/unit/raya-ai-recovery-entry-url.test.ts` | The real `@supabase/ssr` client strips `?code=` during construction; the entry URL still holds it |
| `tests/unit/raya-recovery-diagnostics.test.ts` | The redacted diagnostic names each failure category and cannot carry a credential |
