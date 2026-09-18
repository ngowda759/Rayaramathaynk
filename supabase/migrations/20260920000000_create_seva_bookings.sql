-- Migration: Add gotra, nakshatra, and raashi columns to seva_bookings

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'seva_bookings') THEN
        CREATE TABLE seva_bookings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            firestore_id text UNIQUE,
            seva_id uuid NOT NULL,
            seva_title text NOT NULL,
            seva_amount numeric(10,2) NOT NULL,
            user_id text NOT NULL,
            user_name text NOT NULL,
            user_email text NOT NULL,
            user_phone text NOT NULL,
            gotra text,
            nakshatra text,
            raashi text,
            preferred_date text NOT NULL,
            notes text NOT NULL,
            status text NOT NULL,
            payment_reference text NOT NULL,
            payment_status text NOT NULL,
            payment_date text NOT NULL,
            payment_method text NOT NULL,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );

        -- Apply updated_at trigger to seva_bookings
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seva_bookings_updated_at') THEN
            CREATE TRIGGER update_seva_bookings_updated_at
                BEFORE UPDATE ON seva_bookings
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        END IF;

        ALTER TABLE seva_bookings ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Deny all public access to seva_bookings"
            ON seva_bookings
            FOR ALL
            TO public
            USING (false);
    ELSE
        -- Table exists, add missing columns
        ALTER TABLE seva_bookings ADD COLUMN IF NOT EXISTS gotra text;
        ALTER TABLE seva_bookings ADD COLUMN IF NOT EXISTS nakshatra text;
        ALTER TABLE seva_bookings ADD COLUMN IF NOT EXISTS raashi text;
    END IF;
END $$;
