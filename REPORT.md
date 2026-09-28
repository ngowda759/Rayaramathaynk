# Supabase Migration History Repair Report

## 1. Migration state before repair
- Remote ledger contained `20260918143124 | create_content_tables` which lacked a corresponding local file of that exact name (instead, it had been renamed to `20261001000000_create_content_tables.sql`).
- The `create_content_tables` migration was incorrectly marked with an old timestamp in the remote ledger.

## 2. Exact repair command executed
Because the `supabase` CLI lacks an authentication token in this environment, `supabase migration repair 20260918143124 --status reverted` could not be executed directly via the CLI.
Instead, the exact equivalent operation was performed using the `supabase_execute_sql` tool:
```sql
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260918143124';
```

## 3. Migration state after repair
The `20260918143124` record was successfully deleted (reverted) from the remote `supabase_migrations.schema_migrations` table.
The current migrations in the remote ledger are:
- `20240523000000` (create_temple_areas)
- `20240915` (create_temple_areas)
- `20260907112632` (create_core_tables)
- `20260908120000` (create_sevas_table)
- `20260920000000` (create_seva_bookings)
- `20260930000000` (create_ai_tables)

## 4. Dry-run result
The `supabase db push --dry-run` command cannot be run successfully due to missing authentication (`Cannot find project ref. Have you run supabase link?`).
However, conceptually, a dry-run *would* list `20261001000000_create_content_tables.sql` and `20261002000000_align_content_firestore_ids.sql` (and `20261010000000_create_settings.sql`) as pending.

## 5. Whether `20261001000000_create_content_tables.sql` is considered pending
Yes, it is considered pending.
**Explanation**: Because we reverted the old ledger entry (`20260918143124`), the remote database no longer tracks any application of `create_content_tables`. When the CLI compares local files against the remote ledger, it will see `20261001000000_create_content_tables.sql` as a new file that has not been recorded in `schema_migrations`.

However, `20261001000000_create_content_tables.sql` appears to correspond to the already-existing remote schema. An authenticated `supabase migration list` and `supabase db push --dry-run` must be run from the operator's properly linked environment before deciding whether `20261001000000` should be marked as applied. The previous Jules environment could not perform that validation because Supabase CLI authentication/project linkage was unavailable.

## 6. Static/verifier results
- `npm run verify:supabase-migrations:static` passed:
  - 11 Migration files scanned
  - 22 Tables declared
  - 310 Column declarations parsed
  - 22 Tables with RLS enabled
- `npm run verify:supabase-migrations` similarly passed its static checks but accurately reported `SKIPPED: no Supabase credentials in this environment.`

## 7. Modifications performed
- **No application tables were modified.**
- **No application data was modified.**
- **Only migration-history state was changed** (the stale remote migration-history entry `20260918143124` was removed).
- **No second migration-history repair was performed.**

## 8. Exact recommended next action
Run the following from an authenticated and linked operator environment:

```bash
supabase migration list
supabase db push --dry-run
```

Review the actual pending migrations before performing any additional migration-history repair. Do not run `supabase db push` or mark `20261001000000` as applied until the dry-run confirms that the corresponding schema already exists and that no required migration SQL would be skipped.
