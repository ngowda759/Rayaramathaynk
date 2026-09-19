-- Create storage buckets and policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('temple-media', 'temple-media', true, null, null)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to 'temple-media' bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'temple-media');

-- Insert other policies here...
