# Prisma Schema Baseline — Raya AI

Status: PR-1 of `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md`.
Scope: schema, configuration, tests, documentation. **No runtime behaviour change.**

## 1. Objective

Establish the Prisma foundation for the Raya AI domain and record exactly how the
existing data contracts map onto it, without touching production data.

Success criteria:

- A `prisma/schema.prisma` that mirrors the live database.
- Prisma client initialisation that follows the repository's `server-only` convention.
- A migration workflow that is safe against a database that already has the tables.
- Tests that prove the schema mirrors the SQL, runnable without credentials.
- An explicit list of decisions that still need a human to confirm.

Deliberate scope boundary: `lib/prisma.ts` is added as **foundation only**. Nothing
imports it yet, and no existing data access is changed. Wiring data access onto Prisma
is PR-4 onward. This keeps PR-1 free of runtime risk and independently revertible.

## 2. What was inspected

Nothing in this document is inferred from memory. Each claim below cites the file
it came from.

| Contract | File |
| --- | --- |
| Settings table DDL | `supabase/migrations/20261012000000_create_ai_settings_table.sql` |
| Runtime tables DDL | `supabase/migrations/20260930000000_create_ai_tables.sql` |
| Knowledge table DDL | `supabase/migrations/20261013000000_create_ai_knowledge.sql` |
| Users / profiles DDL | `supabase/migrations/20261001000000_create_content_tables.sql` |
| Settings domain types | `types/ai-settings.ts` |
| Analytics record types | `types/ai-analytics.ts` |
| Knowledge article type | `lib/ai/knowledge/types.ts` |
| Settings access layer | `lib/ai/ai-settings/repository.ts`, `admin-repository.ts`, `service.ts` |
| Seed definitions | `lib/ai/ai-settings/seed-data.ts` |
| Collection inventory | `lib/supabase/migration-inventory.ts` |
| Authorization | `lib/auth/admin-auth.ts` |
| Server-only convention | `lib/supabase/admin.ts`, `scripts/test-boundary.sh` |

### 2.1 Correction to the migration plan's premise

`docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` §2.1 already states that the AI settings
service reads Supabase. Inspection confirms it, and this is worth restating plainly
because it changes the shape of the work:

**AI settings is already on Supabase.** `lib/ai/ai-settings/repository.ts` imports
`createAdminClient` from `@/lib/supabase/admin` and queries
`.from("ai_settings").select("*").eq("id", "main")`. There are no `firebase/firestore`
imports in `lib/ai/ai-settings/*`.

So PR-4 is not "move AI settings to Supabase". It is narrower: align the settings
service with Prisma, and remove the remaining Firestore reads elsewhere. This PR-1
records that finding so later PRs are scoped correctly.

### 2.2 Remaining Firestore usage inside Raya AI

Verified by import scan:

| File | Remaining Firestore dependency |
| --- | --- |
| `lib/ai/retrieval/announcements.ts` | Retrieval source |
| `lib/ai/retrieval/settings.ts` | Retrieval source |
| `lib/ai/retrieval/aaradhane.ts` | Retrieval source |
| `lib/ai/retrieval/sevas.ts` | Retrieval source |
| `lib/ai/retrieval/events.ts` | Retrieval source |
| `app/api/ai/knowledge/import/route.ts` | Knowledge import |
| `app/api/ai/knowledge/coverage/route.ts` | Knowledge coverage |
| `app/admin/ai/page.tsx` | Admin overview |
| `app/admin/ai/analytics/page.tsx` | Admin analytics |
| `app/admin/ai/training/page.tsx` | Admin training |
| `lib/auth/admin-auth.ts` | Role lookup (`users/{uid}`) |
| `services/ai-analytics.service.ts` | Firestore `AI_SETTINGS`, `CHAT_MESSAGES`, `CHAT_SESSIONS`, `TOKEN_USAGE`; some methods already use Supabase (`ai_latency_records`) |
| `services/conversation.service.ts` | Firestore conversation sessions |
| `services/knowledge-workflow.service.ts` | Firestore draft / review / publish workflow: `ARTICLES`, `VERSIONS`, `DRAFTS`, `REVIEW_COMMENTS`, `COMMITTEE_APPROVALS`, `WORKFLOW_ACTIONS`, `AUDIT_LOG`. Reachable from eight `app/api/knowledge/workflow/*` routes |

`services/chat.service.ts` is already Supabase for chat sessions and messages, but
still imports Firestore for unrelated testimonials, volunteer requests and feedback
collections.


## 3. Field mapping

`created_at` / `updated_at` are omitted from the tables below unless they carry a
special rule. Every table has both, and the DB trigger owns `updated_at`.

### 3.1 `ai_settings` — single row, `id = 'main'`

Source: `20261012000000_create_ai_settings_table.sql`.
The TypeScript contract is `AISettings` in `types/ai-settings.ts`.

| Postgres column | Prisma field | Type | TS interface |
| --- | --- | --- | --- |
| `id` | `id` | `text`, PK, default `'main'` | `id` |
| `general` | `general` | `jsonb` | `AIGeneralSettings` |
| `safety` | `safety` | `jsonb` | `AISafetySettings` |
| `extended_behavior` | `extendedBehavior` | `jsonb` | `AIExtendedBehaviorSettings` |
| `temple_information` | `templeInformation` | `jsonb` | `TempleInformation` |
| `visitor_information` | `visitorInformation` | `jsonb` | `VisitorInformation` |
| `temple_policies` | `templePolicies` | `jsonb` | `TemplePolicies` |
| `ai_responses` | `aiResponses` | `jsonb` | `AIResponses` |
| `ai_behavior` | `aiBehavior` | `jsonb` | `AIBehaviorSettings` (legacy) |
| `prompt` | `prompt` | `jsonb` | `PromptSettings` |
| `intents` | `intents` | `jsonb` | `IntentSettings` |
| `updated_by` | `updatedBy` | `text`, nullable | `updatedBy` |
| `version` | `version` | `integer`, default 1 | not exposed in TS |

The sections are `jsonb` rather than normalised tables. That is the existing design:
the application validates each section with Zod (`lib/ai/ai-settings/validation.ts`)
after reading. PR-1 preserves it. Normalising these sections would be a redesign, and
is explicitly out of scope — see §5.

### 3.2 `ai_knowledge`

Source: `20261013000000_create_ai_knowledge.sql`. TS contract: `KnowledgeArticle`
in `lib/ai/knowledge/types.ts`.

| Postgres column | Prisma field | Notes |
| --- | --- | --- |
| `id` | `id` | `uuid`, `gen_random_uuid()` |
| `firestore_id` | `firestoreId` | unique; provenance from the Firestore ETL |
| `slug` | `slug` | unique; public identifier |
| `title` | `title` | |
| `kannada_title` | `kannadaTitle` | maps to TS `kannadaTitle` |
| `category` | `category` | `text`, default `'general'` |
| `keywords` | `keywords` | `text[]` |
| `content` | `content` | |
| `kannada_content` | `kannadaContent` | |
| `language` | `language` | `text`, default `'en'` |
| `last_reviewed` | `lastReviewed` | nullable |
| `approved` | `approved` | drives the public read policy |

### 3.3 Runtime tables

Source: `20260930000000_create_ai_tables.sql`.

| Table | Notable columns | Note |
| --- | --- | --- |
| `chat_sessions` | `firestore_id`, `user_id`, `message_count`, `last_message`, `detected_language` | `user_id` is a loose Firebase UID reference. The SQL declares **no** foreign key. |
| `chat_messages` | `firestore_id`, `session_id`, `role`, `content`, `timestamp`, `model`, `latency`, `detected_language` | See §5, item 2. |
| `unknown_questions` | `question`, `question_lower`, `detected_intent`, `confidence`, `status`, `assigned_to`, `times_asked`, `reviewed_by`, `reviewed_at`, `response`, `added_to_knowledge_article_id`, `notes` | `status` default `'pending'`; `assigned_to` default `'unassigned'` |
| `ai_intent_distribution` | `intent`, `category`, `language`, `confidence`, `session_id`, `message_id` | |
| `ai_latency_records` | `total_latency`, `intent_detection_time`, `retrieval_time`, `generation_time`, `success`, `error_type`, `model`, `session_id` | `numeric(10,2)` |

Two contract notes, both grounded in the source:

- `types/ai-analytics.ts` marks `LatencyRecord.messageId` and `LatencyRecord.intent`
  as *"Deprecated/Removed in Supabase schema"*. The SQL confirms it: neither column
  exists. Prisma therefore does not declare them.
- `unknown_questions.status` is `text`, not an enum. The TS union is
  `"pending" | "in_review" | "resolved" | "added_to_knowledge"`. Prisma keeps `text`
  so it matches the database; the union stays enforced in TypeScript.

### 3.4 Role source — `users` and `profiles`

Source: `20261001000000_create_content_tables.sql`.

| `users` column | Prisma field | Note |
| --- | --- | --- |
| `id` | `id` | `uuid` |
| `firestore_id` | `firestoreId` | unique |
| `email` | `email` | |
| `display_name` | `displayName` | |
| `phone_number` | `phoneNumber` | |
| `photo_url` | `photoUrl` | |
| `role` | `role` | `text`, default `'user'` |
| `active` | `active` | `boolean`, default `true` |

`lib/auth/admin-auth.ts` normalises `role` and rejects `BLOCKED_ROLES`
(`devotee`, `volunteer`), and denies when `active` is false. Those two columns are
what PR-3 will read instead of Firestore `users/{uid}`.

Included in PR-1 because the migration plan names this table as the authorization
authority. **PR-1 declares the model only; it does not change authorization.**

## 4. Baseline strategy

The tables already exist in production. `prisma migrate dev` would therefore try to
create tables that are already there and fail. The baseline approach:

1. `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql` is generated
   with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
   It is a faithful `CREATE TABLE` script for the models above.
2. **Before marking it applied, verify the target database actually matches the
   baseline.** This step is mandatory and is described in §4.0.
3. That migration is marked **already applied** in the target environment, without
   being executed:

   ```bash
   npx prisma migrate resolve --applied 20261015000000_baseline_raya_ai
   ```

4. Only then do later migrations apply incrementally.

Step 3 is what makes this safe: it records the baseline as applied while running no
DDL against production.

Because the resolution records the version only in the Prisma ledger, a comment-only
marker `supabase/migrations/20261015000000_baseline_raya_ai.sql` mirrors it into the
Supabase ledger so the Supabase integration's "remote versions not found in local
migrations" comparison passes. The marker declares no DDL - the baseline represents
tables that already exist. The authoritative baseline SQL remains
`prisma/migrations/20261015000000_baseline_raya_ai/migration.sql`.

### 4.0 Prerequisite: verify the target schema matches the baseline first

`migrate resolve --applied` records a migration as done. It does **not** check that
the database actually matches. Marking the baseline applied against a database that
has drifted hides that drift permanently, because Prisma will then never generate the
missing objects.

Do not mark the baseline applied merely to silence a drift report. Verify first:

```bash
# 1. Point PRISMA_DATABASE_URL at the target database (direct connection).
# 2. Diff the schema against that database.
npm run prisma:drift
```

Interpretation:

- **Exit 0, no difference** — the database matches the baseline. Proceed to
  `migrate resolve --applied`.
- **Non-empty diff** — stop. The database is not the schema the baseline describes.
  Reconcile the difference explicitly, as its own reviewed change, before recording
  anything as applied. Do not paper over it.

In practice this means the baseline may only be marked applied after the schema has
been diffed against the real production database, not just against a database built
from the SQL migrations. See §6 for the current status of that check.

### 4.1 Drift detection

```bash
npm run prisma:drift
```

This diffs the schema against the live datasource. A non-empty diff means the schema
has drifted from the database, which is the signal to reconcile before writing any
new migration.

#### 4.1.1 Result against the live target (2026-10-16) — drift detected

The drift check was run against the live Supabase project through
`.github/workflows/prisma-baseline-drift-gate.yml` (see §7.4). It **connected
successfully** to the target database and the result was a **non-empty diff**
(`prisma:drift` exit 2), so **the baseline is not eligible to be marked applied** and
`migrate resolve --applied` must not be run yet.

To run the check from CI:

```bash
gh workflow run prisma-baseline-drift-gate.yml --repo ngowda759/Rayaramathaynk --ref main
gh run watch "$(gh run list --workflow prisma-baseline-drift-gate.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --repo ngowda759/Rayaramathaynk
```

Note that the gate must exist on the default branch to be dispatchable, and it may be
run from any branch ref once it does.

The command is `prisma migrate diff --from-schema prisma/schema.prisma
--to-config-datasource`, so the source is the schema and the destination is the live
database. `[+]` lists what must be added to the source to reach the destination,
i.e. what the **live database has and the schema does not**; `[-]` is the reverse.

Raw findings:

| Label | Finding |
| --- | --- |
| `[+] Added tables` (in live, not in schema) | 15 non-AI tables: `aaradhanes`, `daily_poojas`, `donation_campaigns`, `donations`, `events`, `gallery_albums`, `gallery_media`, `settings_documents`, `seva_bookings`, `sevas`, `site_settings`, `social_links`, `temple_areas`, `testimonials`, `volunteer_requests` |
| `[-] Removed tables` (in schema, not matched in live) | `ai_knowledge` |
| `[*] Changed` | 15 tables — all non-AI; missing indexes, incl. a unique index on `firestore_id` on 14 of them, plus secondary indexes on the non-AI tables |

Two things are true here and only the second one gates this baseline:

1. **The range difference is not this baseline's concern.** The live database
   contains the whole application schema; `prisma/schema.prisma` deliberately models
   only the AI tables (plus `users`/`profiles`). So the 15 non-AI tables correctly
   appear as "added". This is exactly the case §7.3 warns about ("the out-of-scope
   tables are absent from the schema, so a full-database drift check will report
   differences for them"). Note that **no AI table appears under `[*] Changed`** —
   against a scoped reading, the other eight AI tables are consistent with the schema.

2. **The one AI-scope finding was `ai_knowledge`**, reported as present in the schema
   but not matched in the live database. It has since been reconciled — see §4.1.2.

**Decision: do not run `migrate resolve --applied`.** Recording the baseline as applied
now would permanently hide the `ai_knowledge` discrepancy. See §4.1.2 for the
reconciled cause and the required next step.

An operator with `SUPABASE_ACCESS_TOKEN` rotated (the stored secret currently returns
HTTP 401 from the Management API — see §7.4) can also run the check directly against a
direct connection.

#### 4.1.2 Reconciliation of `ai_knowledge` (2026-10-16)

The full-database diff alone could not say whether `ai_knowledge` was missing, or just
differently shaped, because the non-AI tables dominate the range difference. The gate
was extended with a read-only `mode=catalog` (see §7.4) and run against the same target.
It settled the question with two independent methods in a single run.

Evidence, from workflow run 38851246600:

| Method | `ai_settings` | `ai_knowledge` | `unknown_questions` |
| --- | --- | --- | --- |
| `pg_catalog.pg_tables` (public schema) | present | **absent** | present |
| `information_schema.columns` | 15 columns as declared | n/a | 18 columns |
| PostgREST `HEAD /rest/v1/<table>` | HTTP 200 | **HTTP 404** | HTTP 200 |

The live `public` schema has **23 tables** and does not contain `ai_knowledge`; no
similar table name exists in any schema. PostgREST returns **404** for it while
returning 200 for `ai_settings` and `unknown_questions`, which rules out a
catalog-vs-PostgREST disagreement and rules out a name/`@@map` mismatch.

**Cause: an incomplete migration.** `supabase/migrations/20261013000000_create_ai_knowledge.sql`
defines the table exactly as the `AiKnowledge` model expects, but it has **not been
applied to the target database**. The other eight AI tables are present and, per the
`[*] Changed` section of the diff, match `prisma/schema.prisma` exactly.

> Correction to an earlier claim: the connectivity diagnostic previously reported
> `ai_knowledge: reachable, ? rows`. That result is wrong and is superseded by the two
> methods above. A count-only PostgREST probe there did not surface the 404.

**What this means for the baseline.** `prisma/schema.prisma` declares a table that does
not exist in production. Marking the baseline applied now would record `ai_knowledge` as
already-created and Prisma would never create it. Reconciliation is required **before**
any `migrate resolve --applied`, and it is a database change, so it is an operator
action — not performed here. The two legitimate paths are:

1. Apply `20261013000000_create_ai_knowledge.sql` to the target (creating the table),
   then re-run the drift check and expect the AI scope to be clean; or
2. Remove `AiKnowledge` from the baseline schema until the table is created, as its own
   reviewed change.

Path 1 is preferred: it preserves the intended data model and lets the baseline represent
the complete AI domain. The operator procedure for it — guarded, single-migration,
transactional, with a rollback plan — is in `docs/RUNBOOK-AI-KNOWLEDGE-APPLY.md`.

**Path 1 was authorized and executed on 2026-10-16.** See §4.1.3.

#### 4.1.3 Apply result (2026-10-16)

An owner confirmed `ai_knowledge` should exist in the target and authorized a one-time
apply. The guarded workflow `Apply ai_knowledge migration` (run 38862796014) applied
`20261013000000_create_ai_knowledge.sql` in a single transaction.

| Check | Before | After |
| --- | --- | --- |
| `public` tables | 23 | **24** |
| Applied migrations | 14 | **15** (includes `20261013000000`) |
| `ai_knowledge` columns | — | 14 |
| `ai_knowledge` indexes | — | 6 (pkey, `firestore_id` unique, `slug` unique, `idx_*_approved`, `idx_*_category`, `idx_*_slug`) |
| `ai_knowledge` trigger | — | `update_ai_knowledge_updated_at` |
| `ai_settings` rows | 1 | **1 (unchanged)** |
| All other table row counts | — | **unchanged** |

Read-only confirmation: catalog run 38863125828 shows 24 tables, 15 applied migrations,
and the table with its columns, indexes and trigger. `ai_settings` data was neither read
nor modified by the apply.

**Drift after the apply (run 38862933835):** the AI scope is **fully reconciled** — no
`ai_settings`, `ai_knowledge`, `AiSettings`, `AiKnowledge`, `unknown_questions` or
`chat_*` entries appear anywhere in the diff. The gate still exits 2 because of the 15
non-AI tables that §5 item 5 deliberately defers to their own PRs; that is by design and
not an AI-scope finding.

**Baseline resolve: held.** §5 item 5 defines the *intended* baseline as the AI/user
domain, and that domain is now reconciled, so the resolve is eligible. It is not performed
here because the *raw* whole-schema gate does not exit 0 (the deferred non-AI tables), and
this document's rule is to resolve only when the gate passes. The gate now has a **scoped**
mode that does pass on the reconciled state — see §4.1.4 — but running the resolve remains
a separate, explicitly authorized operator action.

#### 4.1.4 Gate scoping (implemented)

Before this change, the gate ran a **whole-schema** `prisma migrate diff`, so it exited 2
whenever any deferred non-AI table differed — which is always. That made exit 0
unreachable and hid the one signal that mattered (whether the *declared* schema is
reconciled) behind fifteen permanent, expected differences.

The gate now defaults to a **scoped** check (`npm run prisma:drift:scoped`,
`scripts/lib/check-baseline-drift-scope.mjs`). It runs the same `prisma migrate diff`,
parses its output, and decides the exit code from the **in-scope** tables only — the
nine tables the schema declares via `@@map()` and the baseline migration creates.
Out-of-scope tables are still printed and recorded as deferred; they are never hidden.

Scope cannot be silently narrowed:

- the scope is **derived from `prisma/schema.prisma`** (`@@map()` names), not hardcoded;
- the schema's table set must equal the baseline migration's `CREATE TABLE` set, or the
  checker exits 2 with an `IN-SCOPE MISMATCH` — so a table cannot be dropped from scope
  by deleting it from one place;
- a missing, added, or changed in-scope table still fails;
- a table whose name is a probable typo/mismap of an in-scope name (e.g.
  `ai_knowledge_extra`) still fails, so a wrong `@@map` is not excused.

The raw whole-schema diff remains available as `mode: drift` for inspection. With this in
place, the scoped gate returns **exit 0** on the current production state (all AI tables
present; only deferred non-AI tables differ), which makes the baseline eligible for
`migrate resolve --applied`.

#### 4.1.5 Baseline resolution (guarded)

Marking the baseline applied requires writing one row to
`supabase_migrations.schema_migrations`. That is a production change and must never be
used to suppress unresolved drift, so it is done by a guarded command,
`npm run prisma:resolve:baseline` (`scripts/resolve-baseline-raya-ai.mjs`), driven by the
dispatch-only, `production`-environment-gated, phrase-guarded workflow
`.github/workflows/resolve-raya-ai-baseline.yml`.

Guard rails:

- it re-runs the **read-only scoped drift gate** against the live database first and
  **aborts without writing** if any in-scope table is missing, added, or changed;
- it aborts if any declared table is absent, and is a no-op if the version is already
  recorded (idempotent);
- its only write is `insert ... on conflict (version) do nothing`; it runs no migration,
  never calls `supabase db push`, touches no table data, and redacts the project ref from
  every error.

Because the command defers to the scoped gate, resolving the baseline records history
without hiding any remaining drift: if the AI schema regresses later, the gate fails again
regardless of the history row.



## 5. Decisions requiring confirmation

These are flagged rather than silently decided. Each one changes the database, so
none is applied in PR-1.

1. **`ai_settings` normalisation.** The eleven settings sections are `jsonb`. Keep
   them, or normalise into tables? Keeping them is the conservative choice and is
   what PR-1 does. Normalising would improve queryability but is a redesign with a
   data migration attached.

2. **`chat_messages.session_id` has no foreign key — confirmed.** The SQL comment
   says it references `chat_sessions.firestore_id`, but no constraint exists. This
   was verified against a database built from the migrations: `prisma migrate diff`
   reported the FK as a difference when the schema declared one, and reported no
   difference once it was removed. The schema therefore models `session_id` as a
   plain column and declares no relation. Adding a real FK is a schema change that
   can fail on orphan rows, so it needs an explicit decision. Note also that
   `session_id` does not point at the session's primary key (`id`), which makes the
   intended semantics worth settling before any constraint is added.

3. **`users.email` uniqueness.** The DDL does not mark `email` unique. Authorization
   looks users up by Firebase UID, so this has not mattered. If PR-3 looks users up
   by email, uniqueness becomes a correctness requirement. Not changed here.

4. **`profiles` vs `users`.** Both exist and both carry identity data. Which one
   becomes authoritative for a Supabase Auth user is unresolved. PR-1 models both
   and asserts nothing about precedence.

5. **Out-of-scope tables.** `events`, `sevas`, `seva_bookings`, `gallery_*`,
   `testimonials`, `aaradhanes`, `daily_poojas`, `site_settings`, `social_links`,
   `donation_*`, `temple_areas`, `settings_documents`, `volunteer_requests` are in
   the database but not in this schema. They belong to other modules and are deferred
   to their own PRs.

## 5a. What the baseline migration does not contain

Worth stating explicitly, because it limits what `prisma migrate` can ever own.

The generated baseline contains tables, columns, defaults and indexes. It does
**not** contain:

- the `update_updated_at_column()` function,
- the `update_*_updated_at` triggers,
- `ENABLE ROW LEVEL SECURITY`,
- any RLS policy.

Prisma's schema language cannot express triggers or RLS policies, so `prisma migrate`
will never manage them. This is why the SQL migrations remain the source of truth for
those objects, and why the baseline is marked *applied* rather than executed:
production already has them, and re-creating them is not Prisma's job.

Practical consequence: a database created from the Prisma baseline alone would be
missing the triggers and the deny-all policies. Anyone provisioning a new environment
must apply `supabase/migrations/*.sql` as well. Recorded here so it is not discovered
later.

## 6. Assumptions

- The SQL migrations are the source of truth. The schema was verified against a
  database **built from those migrations** (see §7). It has since been diffed against
  the live Supabase project (§7.4); that diff is non-empty (§4.1.1), so the baseline is
  still not eligible to be marked applied.
- **Consequence — the baseline is not yet eligible to be marked applied.** §4.0
  requires a clean diff against the *target* database. The check has now been run
  against production and returned differences (§4.1.1), so `migrate resolve --applied`
  must not be run. Reconcile the reported differences explicitly, as their own reviewed
  change, first.
- `gen_random_uuid()` is available. The SQL migrations already depend on it, so
  `pgcrypto` (or Postgres 13+) is present.
- Prisma is pinned to 7.10.0 for both `prisma` and `@prisma/client`. Note that
  `prisma@latest` currently resolves to an `8.0.0-rc`, so the pin is deliberate;
  see §8.

## 7. Validation

### 7.1 Checks that need no database

| Check | Command | Result |
| --- | --- | --- |
| Schema validity | `npm run prisma:validate` | valid |
| Formatting | `npm run prisma:format` | applied |
| Client generation | `npm run prisma:generate` | generates with no URL |
| Schema/migration parity | `npx jest tests/unit/prisma-schema-baseline.test.ts` | pass |
| Typecheck | `npm run typecheck` | pass |
| Lint | `npm run lint` | pass (0 errors) |
| Unit suite | `npm test` | pass |
| Build | `npm run build` | pass |

`prisma generate` intentionally works with no `DATABASE_URL`, so CI can generate the
client without any database credentials.

### 7.2 Verification against a real PostgreSQL database

These were run against a disposable PostgreSQL 16 container, using the repository's
own SQL migrations as the source of truth. No production system was contacted.

| Step | Result |
| --- | --- |
| Apply `supabase/migrations/*.sql` to a fresh database | all 9 in-scope tables created |
| `prisma migrate diff --from-schema … --to-config-datasource --exit-code` | **No difference detected** (exit 0) |
| Apply the baseline migration to an empty database | applied cleanly |
| `prisma migrate resolve --applied …` then `prisma migrate deploy` | marked applied; `No pending migrations to apply` |
| Read/write through the generated client + `PrismaPg` adapter | JSONB round-tripped; `ai_settings.general` returned as expected |

The drift check is what caught three defects in the first draft of the schema, all
now fixed and covered by tests:

1. an invented `@relation` on `chat_messages.session_id`, where the database has no
   foreign key;
2. `times_asked` marked required, where the DDL allows null;
3. index names that did not match the DDL, which Prisma would have reported as
   permanent drift (`ai_knowledge_slug_idx` versus `idx_ai_knowledge_slug`, etc.).

A further confirmed behaviour: `updated_at` is changed by the database trigger on
update, not by the client. The schema has no `@updatedAt`, so Prisma does not compete
with the trigger.

### 7.3 What is still unverified

- The schema has not been diffed against the **live** Supabase project. That needs
  production credentials and is the operator step in §4.1.

### 7.4 Verification against the live target (2026-10-16)

Run from CI via `.github/workflows/prisma-baseline-drift-gate.yml`, a read-only
`workflow_dispatch` workflow. It derives a session-pooler connection from the existing
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` secrets and
runs `npm run prisma:drift`. It never applies or resolves a migration.

| Step | Result |
| --- | --- |
| Resolve the target region | Management API returned **401** — the stored `SUPABASE_ACCESS_TOKEN` is stale |
| Fall back to a region scan | tenant found on `aws-1-ap-south-1.pooler.supabase.com` (session pooler, port 5432) |
| Connect with `SUPABASE_DB_PASSWORD` | **connected** (`select 1` succeeds) |
| `prisma migrate diff --from-schema … --to-config-datasource` | **non-empty diff**, exit 2 — see §4.1.1 |

Notes worth keeping:

- The target's direct host `db.<ref>.supabase.co` is **IPv6-only**, and GitHub-hosted
  runners have no IPv6 egress, so a direct `PRISMA_DATABASE_URL` cannot be used in CI.
  The Supavisor session pooler (port 5432) has IPv4 and works for `migrate`.
- Supavisor presents a self-signed certificate chain. A URL that carries
  `sslmode=require` makes `pg` force verification and the handshake fails before
  authentication; the probe drops `sslmode` and relies on
  `ssl: { rejectUnauthorized: false }`.
- The following are still unverified and remain operator actions: rotating
  `SUPABASE_ACCESS_TOKEN`, and running the AI-scoped diff that §4.1.1 calls for.

### 7.5 Catalog mode (2026-10-16)

The gate gained a read-only `mode=catalog` input so the live catalog can be inspected
over the same derived connection. It runs `scripts/lib/dump-ai-catalog.mjs`, which reads
`pg_tables`, `information_schema.columns`, `pg_constraint`, `pg_indexes` and
`pg_trigger` only, and a PostgREST `HEAD` cross-check. Neither writes nor prints a
credential. The default `mode` is `drift`, so existing behaviour is unchanged.

```bash
gh workflow run prisma-baseline-drift-gate.yml --repo ngowda759/Rayaramathaynk \
  --ref main -f mode=catalog -f tables="ai_settings ai_knowledge unknown_questions"
```

Runs:

| Run | Purpose | Result |
| --- | --- | --- |
| 38850577583 | `ai_knowledge` catalog | absent from `public`; no similar table |
| 38850986950 | full AI table set | eight AI tables match the schema; `ai_knowledge` absent |
| 38851246600 | catalog + PostgREST cross-check | pg catalog: absent; PostgREST: HTTP 404 (200 for known tables) |

The reconciliation conclusion is in §4.1.2.



## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Prisma 7 is a major version with changed conventions (`prisma-client` generator, URL in `prisma.config.ts`, a required driver adapter, renamed `migrate diff` flags). | Both packages pinned to `7.10.0`. Conventions were taken from a generated template and from the CLI's own help, not from memory. |
| Prisma 7 requires a driver adapter; the URL can no longer be passed to the constructor. | `@prisma/adapter-pg` (with `pg`) is installed, and `lib/prisma.ts` constructs the client with it. Verified against a real database. |
| `prisma@latest` resolves to an RC. | Explicit pin; `postinstall` runs the local binary. |
| Prisma would ship a database driver to the browser. | `lib/prisma.ts` starts with `import "server-only"`, and `scripts/test-boundary.sh` fails the build if a Client Component imports it. |
| The baseline migration could be applied to production by accident. | It is only ever marked applied via `migrate resolve`. No migration is run in PR-1. |
| Schema drift between Prisma and the SQL migrations. | `tests/unit/prisma-schema-baseline.test.ts` parses the migrations and fails if a column is missing or invented. |

## 9. Rollback

PR-1 changes no database and no runtime behaviour, so rollback is a revert:

- `prisma/`, `prisma.config.ts`, `lib/prisma.ts`, `generated/prisma` are additive.
- `package.json` gains `prisma`, `@prisma/client`, `dotenv` and Prisma scripts.
- If the baseline migration was marked applied, undo with
  `DELETE FROM _prisma_migrations WHERE migration_name = '20261015000000_baseline_raya_ai';`
  Run only by an operator, and only if no later migration depends on it.
- No table, column or row is created, altered or deleted by this PR.
