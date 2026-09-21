-- Migration: Align content-table ID columns with Firestore document IDs
--
-- Problem: `donations.campaign_id` and `gallery_media.album_id` were declared
-- `uuid`. Both hold a Firestore document ID (the `campaignId` / `albumId` field
-- written by the application), which is an arbitrary string, not a UUID.
-- Application types and services treat these values as strings. As `uuid`, the
-- columns reject real source data and the data migration fails for every
-- affected row.
--
-- Widening uuid -> text is a lossless superset and matches how the ETL already
-- maps these fields (verbatim copy of the Firestore ID). No UUID is ever
-- invented.
--
-- Idempotent and non-destructive: the cast only runs while the column is still
-- uuid, no rows are deleted or rewritten, and the migration is safe to re-run
-- against an already-deployed database.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'donations'
          AND column_name = 'campaign_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.donations
            ALTER COLUMN campaign_id TYPE text USING campaign_id::text;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'gallery_media'
          AND column_name = 'album_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.gallery_media
            ALTER COLUMN album_id TYPE text USING album_id::text;
    END IF;
END $$;

-- Support the campaign_id / album_id lookups the application performs.
CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON donations (campaign_id);
CREATE INDEX IF NOT EXISTS idx_gallery_media_album_id ON gallery_media (album_id);
