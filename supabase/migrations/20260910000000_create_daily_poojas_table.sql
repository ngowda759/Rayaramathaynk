-- Migration: Create daily_poojas table if it doesn't already exist from a previous schema file

CREATE TABLE IF NOT EXISTS public.daily_poojas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    start_time text NOT NULL,
    duration text NOT NULL,
    category text NOT NULL,
    seva_amount numeric(10,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    days text[] NOT NULL,
    notes text,
    created_by text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_poojas ENABLE ROW LEVEL SECURITY;

-- Deny public access completely (application relies on server-side admin access for daily_poojas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'daily_poojas' AND policyname = 'Deny all public access to daily_poojas'
    ) THEN
        CREATE POLICY "Deny all public access to daily_poojas"
            ON public.daily_poojas
            FOR ALL
            TO public
            USING (false);
    END IF;
END
$$;

-- Create index for display querying
CREATE INDEX IF NOT EXISTS idx_daily_poojas_display_order_is_active
    ON public.daily_poojas (display_order, is_active);
