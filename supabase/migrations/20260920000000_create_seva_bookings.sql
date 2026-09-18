-- Migration: Create seva_bookings table

CREATE TABLE IF NOT EXISTS seva_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    seva_id uuid NOT NULL,
    seva_title text NOT NULL,
    seva_amount numeric(10,2) NOT NULL,
    user_id text NOT NULL,
    user_name text NOT NULL,
    user_email text NOT NULL,
    user_phone text NOT NULL,
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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seva_bookings_updated_at') THEN
        CREATE TRIGGER update_seva_bookings_updated_at
            BEFORE UPDATE ON seva_bookings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

ALTER TABLE seva_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all public access to seva_bookings"
    ON seva_bookings
    FOR ALL
    TO public
    USING (false);
