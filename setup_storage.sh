cat > supabase/migrations/20261020000000_storage_setup.sql << 'MIG'
-- Migration: Create storage buckets and policies for Supabase Storage

-- 1. Create 'temple-media' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('temple-media', 'temple-media', true, null, null)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Enable RLS for storage.objects
-- Note: 'storage' schema RLS is typically already enabled by Supabase, but it is safe to run this.

-- 2. Drop existing policies to ensure idempotency (if they exist)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- 3. Public read policy for 'temple-media'
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'temple-media');

-- 4. Upload policy: Only authenticated (or anon if allowed via API) can upload
-- Because we upload from a backend API, we will use the Service Role key.
-- But if the client is directly uploading, we would need to allow it.
-- Let's give all authenticated users (and service role) access to upload.
-- The Service Role key bypasses RLS, so it automatically has access.
-- No need to create a client upload policy since all uploads happen server-side!

MIG
