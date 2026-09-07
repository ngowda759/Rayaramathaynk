-- Migration: Create core tables (sevas, daily_poojas, events)

-- 1. Function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Create `sevas` table
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

-- 3. Create `daily_poojas` table
CREATE TABLE daily_poojas (
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

-- 4. Create `events` table
CREATE TABLE events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    start_date timestamptz NOT NULL,
    end_date timestamptz NOT NULL,
    start_time text,
    end_time text,
    featured boolean NOT NULL DEFAULT false,
    published boolean NOT NULL DEFAULT false,
    category text,
    image_url text,
    status text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Apply updated_at trigger to events
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE sevas ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_poojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies (all DB access should be Server-Side with Service Role)
-- These policies ensure no public client (anon or authenticated via Supabase Auth)
-- can directly access or modify the data, since application auth is managed by Firebase.
CREATE POLICY "Deny all public access to sevas"
    ON sevas
    FOR ALL
    TO public
    USING (false);

CREATE POLICY "Deny all public access to daily_poojas"
    ON daily_poojas
    FOR ALL
    TO public
    USING (false);

CREATE POLICY "Deny all public access to events"
    ON events
    FOR ALL
    TO public
    USING (false);

-- 6. Create Indexes based on docs/SUPABASE_DATABASE_SCHEMA.md
-- sevas
CREATE INDEX idx_sevas_display_order_active ON sevas (display_order, active);

-- daily_poojas
CREATE INDEX idx_daily_poojas_display_order_is_active ON daily_poojas (display_order, is_active);

-- events
CREATE INDEX idx_events_start_date ON events (start_date);
CREATE INDEX idx_events_featured_published ON events (featured, published);
