-- Migration: Align seva_bookings with Firestore source data
--
-- Context: 20260920000000_create_seva_bookings.sql created `seva_id` as uuid.
-- Firestore `sevaBookings` documents store `sevaId` as the Firestore document ID
-- (a non-UUID string), so the data migration cannot load rows while the column is
-- uuid. This migration widens `seva_id` to text, which is a lossless superset of
-- uuid and matches the application types (types/seva-booking.ts uses `string`).
--
-- All statements are idempotent and non-destructive: no rows are deleted or
-- rewritten, existing uuid values cast cleanly to text, and it is safe to re-run
-- against an already-deployed database.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'seva_bookings'
          AND column_name = 'seva_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.seva_bookings
            ALTER COLUMN seva_id TYPE text USING seva_id::text;
    END IF;
END $$;

-- Ensure the optional cultural fields exist on already-deployed databases.
ALTER TABLE IF EXISTS public.seva_bookings ADD COLUMN IF NOT EXISTS gotra text;
ALTER TABLE IF EXISTS public.seva_bookings ADD COLUMN IF NOT EXISTS nakshatra text;
ALTER TABLE IF EXISTS public.seva_bookings ADD COLUMN IF NOT EXISTS raashi text;

-- Ensure RLS and the restrictive policy are present without erroring on re-run.
ALTER TABLE IF EXISTS public.seva_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'seva_bookings'
          AND policyname = 'Deny all public access to seva_bookings'
    ) THEN
        CREATE POLICY "Deny all public access to seva_bookings"
            ON public.seva_bookings
            FOR ALL
            TO public
            USING (false);
    END IF;
END $$;

-- Traceability lookup used by the migrator/reconciler.
CREATE UNIQUE INDEX IF NOT EXISTS seva_bookings_firestore_id_key
    ON public.seva_bookings (firestore_id);
