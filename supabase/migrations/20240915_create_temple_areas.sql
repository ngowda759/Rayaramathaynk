CREATE TABLE IF NOT EXISTS public.temple_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kannada TEXT,
  description TEXT,
  significance TEXT,
  icon TEXT,
  image_url TEXT,
  category TEXT NOT NULL,
  features JSONB,
  best_time_to_visit TEXT,
  tips JSONB,
  has360_view BOOLEAN,
  "order" INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  firestore_id TEXT UNIQUE
);

-- Enable RLS
ALTER TABLE public.temple_areas ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'temple_areas' AND policyname = 'Allow public read access to temple_areas'
  ) THEN
    CREATE POLICY "Allow public read access to temple_areas"
      ON public.temple_areas FOR SELECT
      USING (true);
  END IF;
END $$;
