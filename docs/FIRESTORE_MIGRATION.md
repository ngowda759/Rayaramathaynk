# Firestore to Supabase Migration Guide

This document describes how to safely migrate core application data (Sevas, Daily Poojas, Events) from the existing Firebase Firestore database into the new Supabase PostgreSQL database.

## Principles
- **No application downtime**: The migration runs purely in the backend.
- **Firestore remains active**: Existing Next.js API routes and UI components will continue to read/write to Firestore.
- **Idempotent writes**: The script uses `firestore_id` to `upsert` records into Supabase. You can safely run this migration script multiple times to sync updates without duplicating rows.
- **Zero modification to Source Data**: The script performs read-only operations against Firestore.
- **Strict Validation**: Documents missing required schema fields (like titles, start dates, or correct amounts) will be explicitly rejected as Validation Failures instead of migrated with fake default data.

## Prerequisites

You must provide credentials for both systems via environment variables:

1. **Firebase Admin Credentials**
   Set these to allow the script to bypass Firestore Security Rules and read the entire database.
   ```bash
   FIREBASE_PROJECT_ID="your-project-id"
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
   ```

2. **Supabase Admin Credentials**
   Set these to allow the script to insert/update rows overriding Row Level Security (RLS).
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

## Running the Migration Script

### 1. Dry Run (Recommended first step)

The dry run will fetch the actual data from Firestore, map and validate the values against the Supabase schema, and perform a lookup query against Supabase to see what already exists. It will then print the counts and any errors, but it **will not perform any writes** to Supabase.

```bash
npx tsx scripts/migrate-core-to-supabase.ts --dry-run
```

### 2. Normal Migration

Once you have verified the mappings and counts in the dry-run output, execute the actual migration:

```bash
npx tsx scripts/migrate-core-to-supabase.ts
```

### Other Migrations

The other collections each have a dedicated script. All of them accept
`--dry-run` and perform independent source/target reconciliation:

```bash
npx tsx scripts/migrate-content-to-supabase.ts   # users, profiles, donations, gallery, testimonials, aaradhanes, volunteer_requests
npx tsx scripts/migrate-ai-to-supabase.ts        # chat_sessions, chat_messages, unknown_questions, AI analytics
npx tsx scripts/migrate-seva-bookings-to-supabase.ts
npx tsx scripts/migrate-settings.ts
```

Equivalent npm aliases exist: `npm run migrate:core`, `migrate:content`,
`migrate:ai`, `migrate:seva-bookings`, `migrate:settings`.

### Data-preservation guarantees

Every migrator shares the same rules, enforced by
`lib/supabase/migration-runner.ts` and `lib/supabase/migration-mappers.ts`:

- **Persistent Checkpoints.** The batched migration workflow (`firestore-batched-migration.yml`) saves the `data/migration-manifest.json` state across GitHub Actions workflow runs using `actions/cache`. This ensures that `--retry-failed` knows exactly which collections previously succeeded (so they are skipped) and which failed or were unattempted.
- **No synthetic data.** A missing timestamp is never replaced with `new Date()`;
  a missing latency measurement is never replaced with `0`; an unrecorded
  `success` flag is never assumed `true`. Where a destination column is
  `NOT NULL`, an absent source value is a validation failure instead.
- **Nullable columns stay unset.** When a source timestamp is absent, the column
  is omitted so the schema default applies, rather than being written as `now()`.
- **Firestore IDs are copied verbatim.** `campaignId`, `albumId` and `sevaId` are
  arbitrary strings, never coerced to UUIDs (see the `*_align_*` migrations).
- **No silent field loss.** Each collection declares a field-coverage spec. Any
  source field with no declared disposition (`mapped`, `transformed`, or
  `intentionallyExcluded` with a reason) is reported and fails the run.
- **Non-zero exit on failure.** Validation failures, write failures,
  reconciliation gaps, and unmapped fields all cause exit code `1` — in dry-run
  mode too, so pre-flight validation stops before a live run.
- **Idempotent.** Every write is an upsert keyed by `firestore_id`, so re-running
  a migrator updates existing rows instead of duplicating them.

### Verifying which migrations have been applied

`scripts/verify-supabase-migrations.ts` runs in two clearly separated phases:

**Static schema expectations** — parsed purely from `supabase/migrations/*.sql`,
so they need no credentials and run anywhere (including CI). Reports declared
tables, expected columns, NOT NULL columns, and RLS coverage.

**Live database verification** — runs only when `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set. Reports which expected tables exist, and
the state of the Supabase migration ledger.

The script is strictly read-only — it never creates, alters, or drops anything.

```bash
npm run verify:supabase-migrations:static   # static checks only (no credentials)
npm run verify:supabase-migrations          # static + live
npm run verify:supabase-migrations:json     # machine-readable output
```

Exit codes: `0` = checks passed, `1` = a check failed, `2` = static checks passed
but live verification was skipped (no credentials).

> **Table existence is not proof that a migration was applied.** A table can
> exist from a manual `create table` while the migration declaring it was never
> recorded. When the migration ledger is readable, the verifier reports any
> migration file with no ledger entry and fails; when the ledger is unreadable it
> says so rather than assuming success. Apply migrations through the Supabase CLI
> so the ledger records them.


## Expected Output & Reconciliation

The script will produce a comprehensive report at the end of each collection run detailing exactly what was skipped and why:

```
REPORT FOR: SEVAS
Firestore documents: X
Mapped successfully: X
Validation failures: Y
Inserted: X
Updated: 0
Supabase write failures: Z
Total successful: X
✅ Reconciliation passed.
```

### Validating counts
- **Source Reconciliation**: `Firestore documents` must equal `Mapped successfully` + `Validation failures`.
- **Write Reconciliation**: `Total successful` must equal `Inserted` + `Updated`.
- **Duplicate Check**: The script assumes the `firestore_id` UNIQUE constraint in Supabase is enforced.

### Handling Failures
If individual documents fail, they will be logged under "Failures details:" along with the document ID and a type (either `[VALIDATION]` or `[WRITE]`).
- **Validation failures** mean the Firestore document was missing a required field or contained an invalid data type (e.g., missing an amount). You must fix the data in Firestore or update the schema before it can be migrated.
- **Write failures** occur when Supabase rejects the insertion (e.g., constraint error). The migration script isolates batch errors and will continue processing other documents.

## Next Steps

This migration phase **does not** cut over the application to use Supabase. Once the migration has been verified and data looks accurate, a subsequent phase will modify the repository services (`services/seva.service.ts`, etc.) to point to Supabase.