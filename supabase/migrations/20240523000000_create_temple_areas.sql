CREATE TABLE IF NOT EXISTS public.temple_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  name TEXT NOT NULL,
  name_kannada TEXT,
  description TEXT NOT NULL,
  significance TEXT,
  icon TEXT,
  category TEXT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  best_time_to_visit TEXT,
  tips JSONB DEFAULT '[]'::jsonb,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for ordering
CREATE INDEX IF NOT EXISTS temple_areas_order_idx ON public.temple_areas ("order");
CREATE INDEX IF NOT EXISTS temple_areas_category_idx ON public.temple_areas (category);

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
