# Phase 1 Migration: Fix events.featured null constraint and reporting logic

This PR resolves the `null value in column "featured" of relation "events" violates not-null constraint` failure encountered during the latest Phase 1 GitHub Actions run.

## 1. Investigation & Root Cause
- The database schema strictly defines `featured boolean NOT NULL DEFAULT false` and `published boolean NOT NULL DEFAULT false`.
- The application contract (`types/event.ts`) requires these as booleans.
- The previous mapping logic in `lib/supabase/migration-mappers.ts` omitted these fields entirely if they were undefined in legacy data. During `supabase.from('events').upsert(rows)`, PostgREST fills any omitted fields in an array with `null` if other objects in the array specify the field, resulting in the NOT NULL constraint violation.

## 2. Safe Fixes Implemented
- Updated `mapEvent` to assign `false` for both `featured` and `published` if they are missing in the legacy data. This safely aligns with the database's `DEFAULT false` contract and preserves any existing explicit true/false values.
- Updated `scripts/migrate-staged-phase1.ts` to properly account for batch and row fallback write failures. It now accurately prints `RESULT: PASS` only when there are no write failures and exits with `1` if any failures occur.
- **Unrelated Columns**: While inspecting the schema, I noticed `description`, `location`, and `status` are defined as `NOT NULL` in the database, but the mapper still resolves them to `null` if absent (via `optionalString`). As per instructions, I did not modify these speculatively and am reporting them here as confirmed mismatches for future action.

## 3. Reporting Metrics
- **Featured presence count:** Unable to definitively count because the 36 staged documents from the GH Action artifact could not be downloaded locally due to GH API auth constraints (HTTP 404). However, the structural batch UPSERT error and local seed analysis prove that some documents in production lack the key entirely while others possess it.
- **Dry-run result:** Success. (Tested locally via `npx tsx scripts/migrate-staged-phase1.ts --dry-run`).
- **Production writes:** Confirmed no additional production writes were performed by the script or agent.

## 4. Tests
- Added regression tests in `tests/unit/migration-mappers.test.ts` to verify `featured` and `published` correctly default to `false`.
- Ran `npm run test`, `npm run lint`, and `npm run typecheck` successfully.
