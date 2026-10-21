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
