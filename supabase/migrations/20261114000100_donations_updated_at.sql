-- Migration: add the missing `updated_at` column to `donations`.
--
-- Additive and non-destructive: one nullable-with-default column plus the standard
-- `update_updated_at_column()` trigger. No table, column or row is dropped.
--
-- Why it is needed
-- ----------------
-- `services/donation.server.ts` writes `updated_at` on every status change and every
-- edit (`updateDonationStatus`, `updateDonation`). The `donations` table created in
-- `20261001000000_create_content_tables.sql` never declared that column, so PostgREST
-- rejects the write with `PGRST204: Could not find the 'updated_at' column of
-- 'donations' in the schema cache`. Admin donation edits and status changes therefore
-- failed against a fresh Supabase dataset.
--
-- Every other content table in that migration carries `created_at`/`updated_at`; this
-- brings `donations` in line with them.

ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
