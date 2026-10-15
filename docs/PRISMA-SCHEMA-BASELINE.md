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
2. That migration is marked **already applied** in the target environment, without
   being executed:

   ```bash
   npx prisma migrate resolve --applied 20261015000000_baseline_raya_ai
   ```

3. Only then do later migrations apply incrementally.

Step 2 is what makes this safe: it records the baseline as applied while running no
DDL against production.

### 4.1 Drift detection

```bash
npm run prisma:drift
```

This diffs the schema against the live datasource. A non-empty diff means the schema
has drifted from the database, which is the signal to reconcile before writing any
new migration.

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
  database **built from those migrations** (see §7). It has **not** been checked
  against the live Supabase project — the drift check in §4.1 is that step, and it
  needs production credentials.
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
- The out-of-scope tables are absent from the schema, so a full-database drift check
  will report differences for them until their own PRs land. Run the drift check
  scoped to the AI tables in the meantime.

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
