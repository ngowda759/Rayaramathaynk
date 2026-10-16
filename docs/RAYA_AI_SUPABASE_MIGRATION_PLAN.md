# Raya AI Supabase Migration Plan

Status: proposed
Owner: to be assigned
Related: PR #329 (auth diagnostics + AI Health), docs/SUPABASE_DATABASE_SCHEMA.md

## 1. Objective

Move all Raya AI configuration and runtime data off Firestore onto Supabase
PostgreSQL, with Prisma as the data-access layer and Supabase Auth as the
identity provider, and remove Firestore from Raya AI workflows.

Success criteria:

- No Raya AI runtime path reads or writes Firestore.
- All AI settings, prompts, intents, default rules and initialization are served
  from Supabase.
- Knowledge retrieval, chatbot runtime data, analytics and operational history
  are served from Supabase.
- AI Health and Data Integrity report against Supabase only.
- Existing Firebase data is preserved; nothing is deleted globally.
- Firestore is not used as a runtime fallback for Raya AI.

## 2. Current state (verified)

This plan is grounded in an inspection of `main` after PR #329.

### 2.1 What already exists

| Area | State |
| --- | --- |
| `ai_settings` table | Exists (`supabase/migrations/20261012000000_create_ai_settings_table.sql`), seeded by `20261012000001_seed_ai_settings.sql` (the remote ledger records its version as `20261006101759`, mirrored locally by a comment-only marker file). |
| AI runtime tables | `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records` exist (`20260930000000_create_ai_tables.sql`). |
| `ai_knowledge` table | Exists (`20261013000000_create_ai_knowledge.sql`) with an approved-article read policy. |
| AI settings service | `lib/ai/ai-settings/*` already reads/writes Supabase via `@supabase/supabase-js`. |
| Knowledge repository | `lib/ai/knowledge/repository.ts` already reads Supabase. |
| Content services | `services/event.service.ts` and `services/settings.service.ts` already use Supabase. |
| Supabase clients | `lib/supabase/{admin,client,server}.ts`. `createAdminClient()` uses the service-role key. |
| ETL helpers | `lib/supabase/migration-{runner,helpers,inventory,coverage,mappers}.ts` provide dry-run-safe collection migration with reconciliation. |

### 2.2 What is missing

| Gap | Evidence |
| --- | --- |
| Prisma | No `prisma/` directory, no `@prisma/client`, no dependency. Data access is raw `.from()` queries. |
| Supabase Auth | Zero `supabase.auth` calls. Auth is Firebase Auth (`services/auth.service.ts` uses `signInWithEmailAndPassword`; `context/AuthContext.tsx` uses `onAuthStateChanged`). |
| Supabase-backed roles | The admin role is read from Firestore `users/{uid}` in `lib/auth/admin-auth.ts`. |
| RLS beyond deny-all | Every table is `ENABLE ROW LEVEL SECURITY` with `FOR ALL TO public USING (false)`. All access goes through the service-role key, which bypasses RLS. |

### 2.3 Remaining Firestore usage inside Raya AI

| File | Lines | Role |
| --- | --- | --- |
| `lib/ai/retrieval/announcements.ts` | 168 | Chatbot retrieval source |
| `lib/ai/retrieval/settings.ts` | 221 | Chatbot retrieval source |
| `lib/ai/retrieval/aaradhane.ts` | 238 | Chatbot retrieval source |
| `lib/ai/retrieval/sevas.ts` | 307 | Chatbot retrieval source |
| `lib/ai/retrieval/events.ts` | 232 | Chatbot retrieval source |
| `app/api/ai/knowledge/import/route.ts` | 156 | Knowledge import |
| `app/api/ai/knowledge/coverage/route.ts` | 143 | Knowledge coverage |
| `app/admin/ai/page.tsx` | 407 | Admin overview |
| `app/admin/ai/analytics/page.tsx` | 782 | Admin analytics |
| `app/admin/ai/training/page.tsx` | 607 | Admin training |

Also Firestore-based: `services/chat.service.ts`, `services/ai-analytics.service.ts`,
`services/conversation.service.ts`.

`services/knowledge-workflow.service.ts` also still reads and writes Firestore
(`ARTICLES`, `VERSIONS`, `DRAFTS`, `REVIEW_COMMENTS`, `COMMITTEE_APPROVALS`,
`WORKFLOW_ACTIONS`, `AUDIT_LOG`) and is reachable from eight
`app/api/knowledge/workflow/*` routes. It was missing from the earlier inventory and
is assigned to PR-6.


## 3. Target architecture

```
Browser
  |  Supabase Auth session (cookie, @supabase/ssr)
  v
Next.js (App Router)
  |  middleware refreshes the session; server components/route handlers
  |  read the user via supabase.auth.getUser()
  |  RBAC: role read from public.users (Supabase), not Firestore
  v
Prisma Client  --->  Supabase PostgreSQL
  |                    - ai_settings, ai_knowledge
  |                    - chat_sessions, chat_messages, unknown_questions
  |                    - ai_intent_distribution, ai_latency_records
  |                    - users, profiles (role source)
  v
RLS: policies keyed on auth.uid() / auth.jwt() for user-scoped rows
```

Two access modes, applied deliberately:

- User-scoped reads (a signed-in admin's own data) use a request-scoped Supabase
  client carrying the user JWT, so RLS applies.
- Server-only operations that legitimately need cross-user access (analytics
  aggregation, ETL, initialization) use a dedicated server role through Prisma.
  This is a narrower replacement for the current blanket service-role bypass.

## 4. Non-negotiables

1. **Preserve Firebase data.** Firestore remains intact and readable. Nothing is
   deleted. Only the Raya AI runtime code paths move.
2. **No Firestore runtime fallback for Raya AI.** Once a workflow is cut over, it
   must not silently read Firestore when Supabase fails. Failures surface as
   errors. (This is distinct from `lib/ai/knowledge/repository.ts`, which falls
   back to bundled seed data when no Supabase client is configured; that fallback
   should be reviewed and made explicit, not extended.)
3. **Authorization stays strict.** No universal admin access. A Supabase Auth
   user is an admin only if the role source says so.
4. **Idempotent initialization.** `/api/seed-ai-settings` semantics from PR #329
   (preserve existing values, repair only missing sections) carry over unchanged.
5. **No destructive migrations in CI.** Migration tests run against a disposable
   database, never production.
6. **No secrets in code or logs.** Tokens and keys are never logged or returned.

## 5. PR sequence

Each PR is independently reviewable, reversible and testable. Later PRs assume
earlier ones merged.

### PR-1 — Prisma foundation and schema baseline

- Add `prisma`, `@prisma/client`; create `prisma/schema.prisma` mirroring the
  existing SQL tables (`ai_settings`, `ai_knowledge`, `chat_sessions`,
  `chat_messages`, `unknown_questions`, `ai_intent_distribution`,
  `ai_latency_records`, `users`, `profiles`).
- Generate the initial migration from the existing schema with
  `prisma migrate diff` so the database is not redefined. Do **not** drop or
  alter existing columns in this PR.
- Add `lib/prisma.ts` (singleton client, server-only).
- Add a schema-drift test asserting Prisma models match the live/migrated schema.
- Wire `prisma generate` into the build.

Exit criteria: schema parity verified, build green, no runtime behavior change.

### PR-2 — Supabase Auth session integration

- Add `@supabase/ssr` middleware that refreshes the session cookie on every
  request.
- Add a server-side helper to resolve the current Supabase user
  (`supabase.auth.getUser()`), replacing `firebase-admin` verification for
  Raya AI routes.
- Keep the Firebase session working in parallel during this PR; do not switch
  enforcement yet.
- Add tests for: no session, expired session, valid session.

Exit criteria: sessions resolve server-side; existing Firebase auth untouched.

### PR-3 — Supabase-backed role source and RBAC

- Make `public.users.role` / `active` the authoritative role source for Raya AI
  admin routes (replacing the Firestore `users/{uid}` lookup in
  `lib/auth/admin-auth.ts`).
- Backfill role/active from the Firestore users collection using the existing
  ETL helpers (dry-run first, reconciled counts).
- Replace `requireAdminUser` internals with the Supabase check while preserving
  the structured failure reasons and status codes introduced in PR #329
  (`missing_token`, `expired_token`, `invalid_token`, `user_not_found`,
  `inactive_user`, `insufficient_role`, `auth_unavailable`).
- RLS policies: add `auth.uid()`-keyed read policies for user-scoped tables.
  Deny-all remains the default for everything else.

Exit criteria: an admin request authorizes via Supabase; unauthorized users are
blocked with the same reason vocabulary; Firestore role lookup is unused by Raya AI.

### PR-4 — AI settings, prompts, intents, default rules, initialization

Scope correction (recorded by PR-1): the AI settings data layer is **already on
Supabase**. `lib/ai/ai-settings/repository.ts` uses `createAdminClient` /
`createClient` and queries `ai_settings` and `unknown_questions` directly. There is
no `firebase/firestore` import anywhere under `lib/ai/ai-settings/`. PR-4 is
therefore **not** a Firestore-to-Supabase move. It is two narrower things:

- Align the existing Supabase data layer with Prisma, so all data access goes
  through one client.
- Remove the residual Firestore reads that the settings and initialization paths
  still reach.

Work items:

- Move `lib/ai/ai-settings/*` onto Prisma while preserving the current service
  interface, so callers do not change.
- Keep `/api/seed-ai-settings` semantics identical (idempotent; preserve existing
  values; repair only empty sections; report initialized / already_present /
  repaired / skipped / failed).
- Preserve the authentication diagnostics added by PR #329: the structured
  `reason` field from `lib/auth/admin-auth.ts` and its fail-closed guards. The
  current vocabulary is `missing_token`, `expired_token`, `invalid_token`,
  `auth_unavailable`, `user_not_found`, `inactive_user`, `insufficient_role`.
  Do not collapse these into a blanket "Unauthorized".
- Confirm response payloads for all five settings endpoints still match the
  frontend types in `types/ai-settings.ts`.
- Tests: all five endpoints valid; one fails while others succeed; save and
  initialization preserve existing values.

Exit criteria: AI Settings reads and writes Supabase through Prisma only, and the
PR #329 diagnostic contract is unchanged.


### PR-5 — Knowledge retrieval and `lib/ai/retrieval/*`

- Rewrite the five retrieval modules to read Supabase through Prisma, using the
  existing Supabase content services where they already exist
  (`services/event.service.ts`, `services/settings.service.ts`) instead of
  duplicating queries.
- Port `app/api/ai/knowledge/{import,coverage}` to Supabase.
- Verify retrieval parity: for a fixture set of questions, the Supabase-backed
  retrieval returns the same or better results than Firestore.
- Tests: retrieval contract tests per source, plus a parity test against a
  frozen Firestore snapshot.

Exit criteria: no `lib/ai/retrieval/*` module imports Firestore.

### PR-6 — Chatbot runtime data, analytics, feedback, operational history

- Move `services/chat.service.ts`, `services/conversation.service.ts`,
  `services/ai-analytics.service.ts` and `services/knowledge-workflow.service.ts`
  to Prisma/Supabase.
- Map to `chat_sessions`, `chat_messages`, `unknown_questions`,
  `ai_intent_distribution`, `ai_latency_records`. The workflow service needs a
  destination for drafts, versions, review comments, committee approvals and the
  audit log; either add tables or fold them into `ai_knowledge` metadata. Decide
  before starting, since it is a schema addition.
- Migrate existing Firestore history with the ETL helpers (dry-run, reconcile,
  then commit), preserving identifiers and timestamps.
- Tests: write-then-read round trips; analytics aggregation matches the migrated
  dataset.

Exit criteria: chatbot runtime writes only to Supabase.

### PR-7 — AI Health and Data Integrity on Supabase

- Point `/api/ai/health` and the Data Integrity checks at Supabase exclusively.
- Keep the PR #329 classification contract: authentication failures, permission
  failures, server failures, connectivity failures, missing data and unreadable
  data stay distinct. The dashboard must not report a 401 as a connectivity
  failure.
- Confirm health checks remain read-only.
- Tests: authenticated success, 401 reported as auth, connectivity failure
  distinguished from 401, missing distinguished from inaccessible.

Exit criteria: AI Health reflects Supabase state accurately.

### PR-8 — Admin AI pages and Firestore removal

- Port `app/admin/ai/{page,analytics,training}` to Supabase-backed services.
- Remove Firestore imports from the Raya AI scope.
- Add a guard test asserting no file under `app/api/ai`, `app/admin/ai` or
  `lib/ai` imports Firestore, so the dependency cannot silently return.

Exit criteria: the guard test passes; Firestore is absent from Raya AI.

### PR-9 — Migration validation and documentation

- Full reconciliation report: source counts vs destination counts per collection.
- Update `docs/SUPABASE_DATABASE_SCHEMA.md`, `docs/DATA-MODEL.md`,
  `docs/RAYA_AI_ARCHITECTURE.md`, `docs/RAYA_AI_DATA_FLOW.md`.
- Record the final Firestore disposition (retained read-only, no Raya AI runtime
  dependency).

Exit criteria: documentation matches the implemented system.

## 6. Ordering and dependencies

```
PR-1 Prisma foundation
  -> PR-2 Supabase Auth session
       -> PR-3 Role source + RBAC
            -> PR-4 AI settings/init
            -> PR-5 Knowledge retrieval
            -> PR-6 Chatbot runtime
                 -> PR-7 AI Health
                      -> PR-8 Admin pages + Firestore removal
                           -> PR-9 Validation + docs
```

PR-4, PR-5 and PR-6 can proceed in parallel once PR-3 lands, but each must land
before PR-7.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Prisma schema drifts from the SQL migrations | Drift test in PR-1; generate migrations with `prisma migrate diff`, never hand-write drops. |
| Dual auth during PR-2/PR-3 leaves a window where either path is bypassable | Enforce exactly one path per route; add a test that a Firebase-only session cannot reach Raya AI admin routes after PR-3. |
| RLS misconfiguration exposes user data | Keep deny-all default; add policies one table at a time with tests for allowed and denied access. |
| Retrieval parity regression | Frozen Firestore snapshot fixture; parity test in PR-5. |
| History migration loses records | ETL helpers already guarantee accounting and non-zero exit on gaps; dry-run first. |
| Scope creep into non-AI modules | PRs touch only `app/api/ai`, `app/admin/ai`, `lib/ai`, the three AI services, and the auth/role path. |

## 8. Blockers

1. **Supabase database credentials are invalid.** The configured pooler URL
   fails at the Supavisor layer (see section 9). No migration can be verified
   until valid credentials are supplied. Do not guess a replacement URL.
2. **No authorized Super Admin account** is available to this environment, so the
   AI Settings and AI Health acceptance tests cannot be executed here.
3. **Firebase Auth is the live provider.** PR-2 and PR-3 require Supabase Auth to
   be enabled for the project and admin users to exist there. That is a product
   decision plus a user-provisioning step, not a code change.

## 9. Supabase connectivity diagnosis

Diagnosed on 2026-10-15 in the OpenHands sandbox. No credentials are reproduced.

Findings:

- The URL parses as a Supavisor **pooler** connection:
  `aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`, database
  `postgres`. Region resolves to `ap-northeast-2`.
- The transaction-pooler URL points at the **same host** on port 6543.
- **DNS is healthy.** The host resolves to three addresses in `ap-northeast-2`
  (an AWS ELB), via the sandbox resolver. An earlier `ENOTFOUND` was a
  transient or differently-configured resolution, not a permanent DNS failure.
- **Network is healthy.** A TCP/TLS connection reaches the pooler.
- **TLS is intercepted.** The sandbox presents a self-signed certificate in the
  chain (`SELF_SIGNED_CERT_IN_CHAIN`). With `sslmode` removed and verification
  disabled for the probe, the connection proceeds past TLS to the pooler
  protocol layer.
- **The pooler rejects the credentials.** The authoritative error is
  `XX000 (ENOTFOUND) tenant/user postgres.<ref> not found`.

Interpretation:

The pooler resolves the tenant from the `<ref>` embedded in the **hostname** and
the user from the **username**. In the configured URL those two disagree: the
hostname carries one 20-character project ref, while the username and
`SUPABASE_PROJECT_REF` carry a different 20-character ref. The pooler therefore
cannot find a tenant matching the presented user, which is exactly the
`tenant/user ... not found` error.

Note also that the ref in this environment's variables differs from the Supabase
project referenced by the repository's CI (`Supabase Preview` links to a
different project). So the configured URL does not correspond to this
application's database.

Conclusion: this is a **credential/configuration mismatch**, not a DNS or network
problem. Resolution requires the correct pooler connection string (or a direct
connection string) for this application's Supabase project, supplied out of band.
Because Supavisor session mode is IPv4-friendly, a corrected pooler URL should
work from this sandbox once the hostname and username agree.

Action requested: provide the correct `SUPABASE_DB_URL` / `SUPABASE_DB_URL_TX`
for the project used by this application, plus confirmation of which Supabase
project is authoritative. Until then, migration PRs can be written and
unit-tested but **cannot be verified against the live database**, and no
migration should be applied to production.
