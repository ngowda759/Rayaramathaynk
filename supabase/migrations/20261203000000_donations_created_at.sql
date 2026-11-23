-- Migration: add the missing `created_at` column to `donations`.
--
-- `services/donation.server.ts` lists donations with
-- `.order("created_at", { ascending: false })`, which PostgREST renders as
-- `GET /rest/v1/donations?select=*&order=created_at.desc`. The table created in
-- `20261001000000_create_content_tables.sql` never declared `created_at`, so the
-- request failed with PostgreSQL 42703 (`column "created_at" does not exist`) and
-- PostgREST answered HTTP 400. The later `20261114000100_donations_updated_at.sql`
-- added only `updated_at`.
--
-- `created_at` is the documented chronological field (`docs/DATA-MODEL.md` declares
-- `createdAt` and indexes it). `updated_at` is the modification time and cannot
-- stand in for it: a status change would move an old donation to the top of the
-- admin list and make it look like a new one in the notification dropdown. Verified
-- against production on 2026-11-23: `donations` has 0 rows, so no history needs to
-- be reconstructed there.
--
-- Safety:
--   * additive and idempotent: one nullable column, a default for new rows and one
--     index; nothing is dropped or rewritten;
--   * existing rows are backfilled only from a timestamp the row already carries.
--     `LEAST(updated_at, collected_at)` is the earliest known lower bound on the
--     creation time. A row with neither timestamp stays NULL - creation time is
--     never invented;
--   * the default applies to new inserts (`createDonation` does not set the column),
--     matching the other content tables that use `DEFAULT now()`;
--   * apply this migration before deploying code that orders by `created_at`.

ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE donations
   SET created_at = LEAST(updated_at, collected_at)
 WHERE created_at IS NULL
   AND (updated_at IS NOT NULL OR collected_at IS NOT NULL);

ALTER TABLE donations
    ALTER COLUMN created_at SET DEFAULT now();

-- Matches the service's `.order("created_at", { ascending: false, nullsFirst: false })`.
CREATE INDEX IF NOT EXISTS idx_donations_created_at
    ON donations (created_at DESC NULLS LAST);
