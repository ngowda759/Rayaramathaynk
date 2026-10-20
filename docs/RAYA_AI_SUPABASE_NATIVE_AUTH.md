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
Firebase path). It gains a nullable `auth_user_id uuid UNIQUE` referencing
`auth.users(id)`. `role` is matched against the same allow-list; `active = false`
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

Operator-run, server-side only (`SUPABASE_SERVICE_ROLE_KEY` required). Idempotent.

```bash
# Creates/updates the Supabase Auth user and its public.users authorization row.
RAYA_ADMIN_EMAIL="admin@example.org" \
RAYA_ADMIN_PASSWORD="<a strong password>" \
RAYA_ADMIN_ROLE="super_admin" \
npx tsx scripts/bootstrap-raya-admin.ts
```

Then sign in at `/admin/ai/login` with that email/password. Public users cannot
self-assign a role: the script is the only writer of `auth_user_id`/`role`, and it
requires the service-role key, which is never available to the browser.

## 5. Schema change

`supabase/migrations/20261022000000_add_auth_user_id_to_users.sql` adds
`public.users.auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL`
plus a partial unique index. It is additive and non-destructive: no table, column
or row is dropped. It is **not** applied automatically; apply it through the
reviewed Supabase migration path.

`prisma/schema.prisma` mirrors the column so the Prisma baseline stays in sync.

## 6. Deployment steps

1. Review and apply the SQL migration (Supabase migration path / reviewed PR).
2. Set the three Supabase env vars in Vercel for Production (and Preview).
3. Run `scripts/bootstrap-raya-admin.ts` once with the operator's credentials.
4. Deploy. Verify `/admin/ai/settings`, `/admin/ai/prompts`, `/admin/ai/health`.
5. Confirm a non-admin Supabase account receives `403`, and an anonymous request
   receives `401`.
