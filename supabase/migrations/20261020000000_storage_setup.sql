-- Migration: Create storage buckets and policies for Supabase Storage

-- 1. Create 'temple-media' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('temple-media', 'temple-media', true, null, null)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Enable RLS for storage.objects
-- Note: 'storage' schema RLS is typically already enabled by Supabase, but it is safe to run this.

-- 2. Public read policy for 'temple-media'
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'temple-media');
