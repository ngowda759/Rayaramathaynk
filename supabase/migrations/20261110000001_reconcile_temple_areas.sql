-- Migration: Reconcile temple_areas with the shape the application actually uses
--
-- Two earlier migrations define `temple_areas` differently and both use
-- `CREATE TABLE IF NOT EXISTS`, so the second silently did nothing:
--   20240523000000_create_temple_areas.sql  -> id uuid, no image_url, no has360_view
--   20240915_create_temple_areas.sql        -> id text,    image_url,    has360_view
-- The earlier (uuid) definition wins, because migrations apply in filename order.
--
-- The live application requires the later shape:
--   services/temple-areas.supabase.service.ts writes `image_url`, `has360_view` and
--   an id derived from the area name (a slug such as `garbhagriha`). Against the
--   uuid definition every admin insert fails: the slug is not a valid uuid, and the
--   two columns do not exist. The public read of `temple_areas` also returns no
--   usable rows.
--
-- This migration brings the table to the shape the code needs, idempotently, without
-- dropping data. `id` is converted uuid -> text (the 20240915 definition) so slug ids
-- work; no table references `temple_areas.id`, so no foreign key is affected.
--
-- Safe to re-run.

-- 1. Add the two columns the service reads/writes when they are absent.
ALTER TABLE IF EXISTS public.temple_areas ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE IF EXISTS public.temple_areas ADD COLUMN IF NOT EXISTS has360_view boolean;

-- 2. Convert `id` to text so slug ids are valid. Guarded so a re-run is a no-op and a
--    database already on the text definition is untouched.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'temple_areas'
           AND column_name = 'id'
           AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.temple_areas ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE public.temple_areas ALTER COLUMN id TYPE text USING id::text;
    END IF;
END $$;
