# Raya AI — Supabase-native Configuration & Admin Authentication

Status: implemented (feature branch, not merged)
Related: PR #345 (Supabase-only Raya AI), docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md

This document records the discovery for this change, the design decisions, the
exact environment variables required, and the operator procedure to bootstrap the
first Raya AI administrator. Nothing here is applied to production automatically.

## 1. Findings (current `main`, after PR #345)

### 1.1 What was already Supabase-native

- `ai_settings`, `ai_knowledge`, `chat_sessions`, `chat_messages`,
  `unknown_questions`, `ai_intent_distribution`, `ai_latency_records` exist in
  `supabase/migrations/` and are mirrored by `prisma/schema.prisma`.
- `lib/ai/ai-settings/{repository,admin-repository,service}.ts` read/write
  `ai_settings` and `unknown_questions` through `@supabase/supabase-js`. No
  `firebase/firestore` import lives under `lib/ai/ai-settings/`.
- `lib/ai/retrieval/settings.ts`, `lib/ai/knowledge/repository.ts`,
  `services/{chat,conversation,ai-analytics}.service.ts` are Supabase-based
  (they retain `firestore_id` only as a provenance key on the row).
- All `app/api/ai/**` routes are guarded by `requireAdminUser`.

### 1.2 What still depended on Firebase for Raya AI administration

- `lib/auth/admin-auth.ts` verified a **Firebase ID token** with the Firebase
  Admin SDK (`@/lib/admin-firebase` → `firebase-admin/auth`). This is the single
  Firebase Admin credential dependency in the Raya AI admin path.
- `hooks/useAdminFetch.ts` obtained a **Firebase ID token** (`user.getIdToken()`)
  and attached it as `Authorization: Bearer`. Only `app/admin/ai/**` pages use it.
- `components/admin/layout/AdminAuthGuard.tsx` gates every `/admin/**` page with
  a Firebase session, so a Supabase-only administrator could not reach
  `/admin/ai/*` at all.
- `app/admin/ai/training/page.tsx` and `lib/ai/retrieval/announcements.ts` import
  Firebase/Firestore directly.

### 1.3 Remaining Firebase outside the approved scope (deliberately untouched)

| File | Why it stays | Impact if changed |
| --- | --- | --- |
| `lib/ai/retrieval/announcements.ts` | Announcement content is still authored/stored by `services/announcement.service.ts` in Firestore; there is **no** Supabase `announcements` table. | Porting only the read path would silently empty the chatbot's announcements. |
| `app/admin/ai/training/page.tsx` | Chat-training data (`chatTraining`) is classified EXCLUDE_SYSTEM in the migration inventory; it has no Supabase destination. | Would require a new schema object and a product decision. |
| `lib/auth/admin.ts`, `lib/auth/verify-id-token.ts` | Used by non-AI features (`app/actions/settings.ts`, seva receipts) that still run on Firebase Auth. | Out of scope: the temple website's authentication is not being replaced. |
| `services/chat.service.ts` (testimonials / volunteers / feedback), `services/user.service.ts` | Not Raya AI configuration/administration. | Out of scope. |

Announcements is a dependency of Raya AI **retrieval**; it is flagged here so the
implication (chatbot cannot answer announcement questions until announcements
move) is explicit rather than silently introduced.

## 2. Design

Two auth modes coexist, each enforced on the server for its own surface:

- **Raya AI administration** (`app/api/ai/**`) → **Supabase Auth**. A new
  server-only module `lib/auth/raya-admin-auth.ts` resolves the caller from the
  Supabase session cookie (or a Supabase access token in
  `Authorization: Bearer`), then loads `role`/`active` from `public.users`
  keyed by `auth_user_id`.
- **The rest of the temple admin** → unchanged Firebase Auth. `lib/auth/admin-auth.ts`
  and `AdminAuthGuard` keep their existing behaviour for every path except
  `/admin/ai/*`.

`public.users` is the authorization source of truth (as it already was for the
Firebase path). It gains a nullable `auth_user_id uuid` with a partial unique index
(no FK to `auth.users` - see section 5.1). `role` is matched against the same allow-list; `active = false`
denies. A Supabase user with no `public.users` row is denied (`user_not_found`).

Client: `hooks/useAdminFetch.ts` now reads the Supabase session instead of the
Firebase user, and the AI pages are gated by `RayaAiAuthGuard`. `AdminAuthGuard`
permits `/admin/ai/*` to be satisfied by a Supabase session so the Raya AI pages
are reachable without a Firebase login — no other `/admin/**` path changes.

### Failure vocabulary (unchanged shape, now Supabase reasons)

`missing_token`, `expired_token`, `invalid_token`, `user_not_found`,
`inactive_user`, `insufficient_role`, `auth_unavailable`. `401` = unauthenticated,
`403` = authenticated but unauthorized, `503` = Supabase not configured /
datastore failure. A missing settings record is reported by the settings service
as absent data, never as an auth failure.

## 3. Required environment variables

Server-side (Vercel → Settings → Environment Variables, never committed):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key (used by the browser client for
  `signInWithPassword` and cookie session storage).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only. Used for role lookups and the
  bootstrap script. **Never** exposed to the browser bundle or logs.

No Firebase variable is read by the Raya AI admin path after this change.

## 4. Bootstrap the first Raya AI administrator

Operator-run, server-side only (`SUPABASE_SERVICE_ROLE_KEY` required). Idempotent,
fails closed, and never lets a public user self-assign a role.

```bash
# Creates/updates the Supabase Auth user and its public.users authorization row.
RAYA_ADMIN_EMAIL="admin@example.org" \
RAYA_ADMIN_PASSWORD="<a strong password>" \
RAYA_ADMIN_ROLE="super_admin" \
npx tsx scripts/bootstrap-raya-admin.ts
```

The script is the only writer of `auth_user_id`/`role`, and it requires the
service-role key, which is never available to the browser.

### 4.1 Safety contract

Identity is never inferred from an email address. `public.users.email` is
`NOT NULL` but **not unique** (verified against a Postgres 17 instance built from
the repo's own migrations — two rows with the same email insert without error),
so the script treats an email match as a hint, not as identity:

- Linking an existing unlinked `public.users` row to a Supabase Auth user
  requires `RAYA_ADMIN_LINK_LEGACY_EMAIL=1`.
- An email matching **two or more** unlinked rows always fails closed
  (`ambiguous_legacy_email`), even with the opt-in flag.
- The email lookup is `ilike`-escaped, so a `%` or `_` in an address cannot widen
  the match.
- A Supabase Auth email matching two or more Auth users also fails closed.

An existing authorization row is never silently changed:

- The role is only overwritten with `RAYA_ADMIN_FORCE_ROLE=1`
  (`role_change_requires_opt_in` otherwise).
- An inactive account is only re-enabled with `RAYA_ADMIN_REACTIVATE=1`
  (`inactive_profile_requires_opt_in` otherwise).

Every refusal exits non-zero and prints a non-sensitive reason. Re-running with
the same inputs converges to a no-op. A `link` update is guarded by
`auth_user_id IS NULL` (and the partial unique index) so a concurrent run cannot
claim a row already linked.

| Flag | Effect |
| --- | --- |
| `RAYA_ADMIN_FORCE_ROLE=1` | Allow changing an existing role to `RAYA_ADMIN_ROLE`. |
| `RAYA_ADMIN_REACTIVATE=1` | Allow re-enabling an inactive authorization row. |
| `RAYA_ADMIN_LINK_LEGACY_EMAIL=1` | Allow linking a single unlinked row that shares the email. |

The decision rules are in `scripts/lib/raya-admin-bootstrap.ts` (pure, unit
tested); the CLI only performs I/O around them.

## 5. Schema change

`supabase/migrations/20261103000000_add_auth_user_id_to_users.sql` adds
`public.users.auth_user_id uuid` plus a **partial** unique index
(`WHERE auth_user_id IS NOT NULL`). It is additive and non-destructive: no table,
column or row is dropped. It is **not** applied automatically; apply it through
the reviewed Supabase migration path.

The version prefix must sort **after** every migration already applied in
production (`20261102000300_seva_final_touches`). `supabase db push` aborts with
*"Found local migration files to be inserted before the last migration on remote
database"* for an out-of-order file unless `--include-all` is passed, and the
repo's `supabase:migrations:push` script is deliberately bare. An earlier version
prefix (`20261022000000`) would therefore make the reviewed push fail.
`tests/unit/raya-admin-schema-migration.test.ts` pins this ordering.

The partial index matters: `public.users` holds many legacy rows whose
`auth_user_id` is `NULL`, and a bare `UNIQUE` constraint would reject the second
such row.

### 5.1 Why there is no foreign key to `auth.users`

The migration deliberately declares **no** foreign key to `auth.users`. This is a
correctness requirement, not an oversight.

`prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource`
backs both `prisma:drift` and `prisma:drift:scoped`. As soon as a cross-schema
constraint exists in the database, that command aborts during introspection with
**P4002**: *"Cross schema references are only allowed when the target schema is
listed in the schemas property of your datasource."* The two ways to satisfy it
are both rejected:

| Approach | Why it is rejected |
| --- | --- |
| Add `schemas = ["public", "auth"]` | Prisma then treats Supabase's `auth.users` as owned by this repository and proposes `ALTER TABLE "auth"."users" ADD COLUMN ...` (verified: `aud`, `created_at`, `email_confirmed_at`, `encrypted_password`, `raw_app_meta_data`, `role`). Worse, the scoped checker derives its table scope from `@@map()`, and both models map to `users`, so `users` appears twice and the scope is corrupted. |
| Keep the FK, scope Prisma to `public` | `P4002` still fires - it is raised from the *database* side during introspection, before any model set is consulted. `relationMode = "prisma"` does not help either. |

With the FK removed, `prisma:drift:scoped` passes (exit 0) and the declared schema
reconciles.

**Integrity is not weakened.** The security-relevant control is the partial unique
index: at most one authorization row per Auth identity, so role resolution is
unambiguous. Orphan protection is inherent to the design -
`verifyRayaAdminUserResult` resolves the caller from a *verified* Supabase session
and then looks up `public.users` by that session's `auth_user_id`. A stored value
can therefore only ever be the id of an account that can obtain a session; a stale
or orphaned value can never be matched to a session and is inert (fail-closed), and
a deleted Auth user cannot obtain a session at all.

> Optional hardening (operator decision): an `AFTER DELETE ON auth.users` trigger
> could null `public.users.auth_user_id` to reproduce `ON DELETE SET NULL`. It is
> omitted because it would require the migration role to hold `TRIGGER` privilege
> on the Supabase-managed `auth.users` table, which cannot be verified from the
> build sandbox. Do not add it without confirming that privilege in production.

### 5.2 Verified against a real Postgres

The migration was applied to a `postgres:17-alpine` instance built from the repo's
own migrations (with a stub `auth.users` and the `anon`/`authenticated`/`service_role`
roles), and the following were confirmed empirically (not just by reading the SQL):

- the column is `uuid` and nullable;
- the index is partial and unique (`WHERE auth_user_id IS NOT NULL`);
- there is **no** `users_auth_user_id_fkey` constraint;
- two rows with the same `email` insert without error (confirmed **no** uniqueness
  on `email`) - this is why the bootstrap treats email as a hint only;
- a duplicate non-null `auth_user_id` is rejected by the partial unique index;
- the migration is idempotent: a second run is a no-op;
- existing `NOT NULL`/`DEFAULT` semantics on `email`, `role`, `active` are unchanged;
- the deny-all RLS policy on `users` is preserved.

`prisma/schema.prisma` mirrors the column so the Prisma baseline stays in sync.

## 6. Deployment steps

1. Review and apply the SQL migration (Supabase migration path / reviewed PR).
2. Set the three Supabase env vars in Vercel for Production (and Preview).
3. Run `scripts/bootstrap-raya-admin.ts` once with the operator's credentials.
4. Deploy. Verify `/admin/ai/settings`, `/admin/ai/prompts`, `/admin/ai/health`.
5. Confirm a non-admin Supabase account receives `403`, and an anonymous request
   receives `401`.

## 7. Regression guards (tests)

| Test file | What it pins |
| --- | --- |
| `tests/unit/raya-admin-bootstrap.test.ts` | The bootstrap safety contract: opt-in role/reactivation/linking, ambiguity fails closed, idempotent no-ops, LIKE-escaping. |
| `tests/unit/raya-ai-auth-isolation.test.ts` | Service-role key stays server-side; the guard reads only the DB record; the two auth providers stay separated; the non-AI Firebase gate is intact; no Firestore fallback in the approved paths. |
| `tests/unit/admin-auth-guard-redirect.test.tsx` | A Supabase session satisfies only `/admin/ai/*`; the AI login is not gated; redirects stay same-origin. |
| `tests/unit/raya-admin-schema-migration.test.ts` | The migration is a nullable uuid, partial-unique, has no cross-schema FK, sorts after the last applied production migration, is idempotent and additive; Prisma mirrors it and does not declare the `auth` schema. |
| `tests/unit/ai-api-auth-wiring.test.ts` | Every protected AI route authenticates via `requireRayaAdminUser` and none reimports Firebase Admin. |
