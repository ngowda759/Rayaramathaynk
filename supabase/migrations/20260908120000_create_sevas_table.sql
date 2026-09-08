-- Check if table sevas exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sevas') THEN

        -- Make sure the updated_at function exists
        IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
            CREATE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $func$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $func$ language 'plpgsql';
        END IF;

        -- Create `sevas` table
        CREATE TABLE sevas (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            firestore_id text UNIQUE,
            name text NOT NULL,
            description text NOT NULL,
            category text NOT NULL,
            amount numeric(10,2) NOT NULL,
            duration integer NOT NULL,
            image_url text,
            active boolean NOT NULL DEFAULT true,
            display_order integer NOT NULL DEFAULT 0,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );

        -- Apply updated_at trigger to sevas
        CREATE TRIGGER update_sevas_updated_at
            BEFORE UPDATE ON sevas
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        -- Enable Row Level Security (RLS)
        ALTER TABLE sevas ENABLE ROW LEVEL SECURITY;

        -- Create restrictive policies
        CREATE POLICY "Deny all public access to sevas"
            ON sevas
            FOR ALL
            TO public
            USING (false);

        -- Create Indexes
        CREATE INDEX idx_sevas_display_order_active ON sevas (display_order, active);
    END IF;
END $$;
