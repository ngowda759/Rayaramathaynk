-- Migration: Add provenance columns to `events` for generated Aaradhane rows.
--
-- Additive and non-destructive: no table, column or row is dropped or rewritten,
-- and every column is nullable so existing rows keep working untouched.
--
-- Why these columns exist
-- -----------------------
-- The Aaradhane generator emits 19 fields. The `events` table originally had a
-- destination column for 9 of them, so the remaining provenance fields
-- (auto_generated, year, guru, parampara_number, raghavendra_phase,
-- lunar_calendar, rituals, offerings, significance) had nowhere to go. The
-- Supabase writer (`lib/aaradhane/supabase-writer.ts`) therefore drops them by
-- default and reports the drop through `unmappedFields()` rather than losing
-- them silently.
--
-- Once this migration is applied, the writer can persist them by passing
-- `includeProvenanceColumns: true`. That flag must stay false until this
-- migration is reviewed and applied - the writer's default is deliberately the
-- lossy-but-reported one.
--
-- This migration adds storage only. It does not backfill, does not change any
-- existing column, and does not enable the scheduled Supabase write.
--
-- Status: prepared, NOT applied. Applying it is an owner action.

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS auto_generated boolean,
    ADD COLUMN IF NOT EXISTS year integer,
    ADD COLUMN IF NOT EXISTS guru text,
    ADD COLUMN IF NOT EXISTS parampara_number integer,
    ADD COLUMN IF NOT EXISTS raghavendra_phase text,
    ADD COLUMN IF NOT EXISTS lunar_calendar jsonb,
    ADD COLUMN IF NOT EXISTS rituals jsonb,
    ADD COLUMN IF NOT EXISTS offerings jsonb,
    ADD COLUMN IF NOT EXISTS significance text;

-- Supports the writer's ownership/read scoping (find generated rows for a year)
-- and the per-guru lookups the public calendar needs. Partial, so the index only
-- covers generated rows and stays small.
CREATE INDEX IF NOT EXISTS idx_events_auto_generated_year
    ON events (year)
    WHERE auto_generated IS TRUE;

CREATE INDEX IF NOT EXISTS idx_events_guru
    ON events (guru)
    WHERE guru IS NOT NULL;
