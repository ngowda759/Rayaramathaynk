# Runbook: apply the `ai_knowledge` migration to the target

**Status: prepared, not authorized, not executed.** Nothing in this document has been
run against production. It is the operator procedure for the one database change needed
to reconcile the baseline drift found in `PRISMA-SCHEMA-BASELINE.md` §4.1.2.

## Why this change

`prisma/schema.prisma` declares `ai_knowledge` (model `AiKnowledge`), and
`supabase/migrations/20261013000000_create_ai_knowledge.sql` defines it, but the table is
**absent from the target database**. Keeping the table (path 1) preserves the intended
Raya AI data model and lets the Prisma baseline represent the complete AI domain.
Removing `AiKnowledge` from the baseline (path 2) would defer the table and need another
reviewed change later; it is chosen only if the project owner confirms the table should
not exist.

## Confirmed target and evidence

- Target project: `kvrkraqjuyxbraccxntk`, region `ap-south-1`, reachable only through the
  Supavisor **session pooler** (`aws-1-ap-south-1.pooler.supabase.com:5432`). The direct
  host is IPv6-only and neither CI nor the sandbox has IPv6 egress, so a direct,
  non-pooled connection is not possible from the environments that can run this.
- Read-only catalog gate (run 38851246600): `pg_catalog` shows 23 tables in `public` and
  `ai_knowledge` absent; PostgREST returns **HTTP 404** for it and 200 for
  `ai_settings` / `unknown_questions`.
- Migration history (`supabase_migrations.schema_migrations`, read-only, run 38855889576)
  records **14** applied migrations. The target is **missing exactly one** reviewed
  migration: `20261013000000_create_ai_knowledge`.

## Preconditions (verified read-only before any write)

| Check | Value |
| --- | --- |
| `ai_knowledge` present | no (apply is required; a re-run is a no-op) |
| `update_updated_at_column()` present | yes (defined in `20260907112632_create_core_tables.sql`; `ai_settings` already uses it) |
| `ai_settings` rows | 1 (non-empty, so the target is the real project) |
| `RLS` on `ai_settings` | deny-all (unrelated; the migration grants only read on `ai_knowledge`) |

## Why not `supabase db push`

`npm run supabase:migrations:push` is `supabase db push`, which applies **every** pending
migration. Pending here would also include the local `20261012000001_seed_ai_settings.sql`,
whose remote history row was recorded under a different id (`20261006101759_seed_ai_settings`).
That seed is `INSERT ... ON CONFLICT (id) DO NOTHING` so it would not overwrite data, but
it is out of scope for this change. The existing `Deploy Supabase Migrations` workflow
also depends on `supabase link`, which uses the stale `SUPABASE_ACCESS_TOKEN`. This runbook
therefore applies exactly one file instead, and never uses `db push`.

A comment-only marker, `supabase/migrations/20261006101759_seed_ai_settings.sql`, now
records the remote id locally so the Supabase integration's ledger comparison stops
reporting "Remote migration versions not found in local migrations directory." It
executes nothing, and it sorts before `20261012000000_create_ai_settings_table.sql`, so
it cannot cause the seed to run before the table exists on a fresh database.

## The change

`scripts/apply-ai-knowledge-migration.mjs` applies, in **one transaction**:

- `ai_knowledge` with 14 columns exactly as `AiKnowledge` declares them;
- three indexes: `idx_ai_knowledge_category`, `idx_ai_knowledge_approved`, `idx_ai_knowledge_slug`;
- the `update_ai_knowledge_updated_at` trigger;
- RLS enabled, with the four policies from the migration file.

It aborts unless `ai_knowledge` is absent, the helper function exists, and `ai_settings`
is populated. It then inserts the version row into `supabase_migrations.schema_migrations`
so a later `db push` will not re-apply it. It does **not** read or modify `ai_settings`
data.

The workflow `.github/workflows/ai-knowledge-migration-apply.yml` wraps the script:
`workflow_dispatch` only, bound to the **`production` environment** (if that environment
requires approval, a human must approve the run), and it refuses to start unless the
confirmation phrase is typed exactly.

## Procedure

1. **Preflight (read-only).** Confirm state with the catalog gate:
   ```bash
   gh workflow run prisma-baseline-drift-gate.yml --repo ngowda759/Rayaramathaynk \
     --ref main -f mode=catalog -f tables="ai_knowledge"
   ```
   Require: `ai_knowledge` absent; `=== applied migrations ===` lists 14 and does not
   include `20261013000000`.

2. **Authorize.** A repo or project owner states that `ai_knowledge` should exist in the
   target and authorizes a one-time production change. Without this, stop.

3. **Apply (one run).**
   ```bash
   gh workflow run ai-knowledge-migration-apply.yml --repo ngowda759/Rayaramathaynk \
     --ref main -f confirm=apply-create-ai-knowledge
   gh run watch "$(gh run list --workflow ai-knowledge-migration-apply.yml --limit 1 \
     --json databaseId --jq '.[0].databaseId')" --repo ngowda759/Rayaramathaynk
   ```
   The job log prints preconditions, the verification summary, and the before/after
   `ai_settings` row count. It never prints a credential.

4. **Verify (read-only).**
   ```bash
   gh workflow run prisma-baseline-drift-gate.yml --repo ngowda759/Rayaramathaynk \
     --ref main -f mode=catalog -f tables="ai_knowledge"
   ```
   Require: `ai_knowledge` present with the 14 columns, 3 indexes, and the trigger; the
   history now lists 15 migrations. Then run `mode=drift` and confirm the AI tables no
   longer appear as removed/changed.

5. **Baseline gate.** Only if step 4 shows the AI scope reconciled and the drift gate
   passes, mark the Prisma baseline applied:
   ```bash
   npx prisma migrate resolve --applied 20261015000000_baseline_raya_ai
   ```
   This records the migration; it does not create objects.

## Rollback / recovery

The change creates one new table and nothing else; no existing table or row is touched.
Recovery options, in order of preference:

1. **Forward fix** if the table is created but wrong: a reviewed `ALTER`/`CREATE INDEX`
   migration, avoiding a drop of a table that may already hold rows.
2. **Drop** if the table should not exist after all (only if it holds no needed data):
   ```sql
   begin;
   drop table if exists ai_knowledge cascade;
   delete from supabase_migrations.schema_migrations where version = '20261013000000';
   commit;
   ```
3. **Pre-apply backup.** Before applying, an operator may take a schema-only dump of the
   target (`pg_dump --schema-only`) as a reference. `ai_knowledge` has no data, so a data
   backup is not required.

## Limits

- The migration file is not idempotent (no `IF NOT EXISTS`); the apply script guards this
  by aborting when the table already exists, so a second run is a safe no-op.
- `SUPABASE_ACCESS_TOKEN` is currently stale (Management API 401). The apply script falls
  back to a region scan, so a stale token does not block it.
- No deploy, no baseline resolve, and no Super Admin acceptance test are performed by
  this runbook. Those remain separate, later steps.

_This document was created by an AI agent (OpenHands) on behalf of the repository owner._
