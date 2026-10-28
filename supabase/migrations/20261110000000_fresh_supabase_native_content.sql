-- Migration: Fresh Supabase-native tables for modules that previously read Firestore
--
-- The temple site is being moved off Firestore data entirely (Firebase Auth stays).
-- Several application modules read Firestore collections that had no Supabase
-- destination table, so they could never be cut over. This migration adds those
-- tables. It creates no data: `scripts/seed-fresh-supabase.ts` seeds the rows.
--
-- Tables added (each grounded in a live application reader/writer):
--   announcements        services/announcement.service.ts, lib/ai/retrieval/announcements.ts,
--                        services/daily-spiritual.service.ts, app/api/announcements/*
--   quotes               services/quote.service.ts, app/api/quotes/**, app/api/admin/quotes/**
--   page_views           services/pageviews.service.ts
--   daily_page_stats     services/pageviews.service.ts
--   intent_metrics       services/analytics.service.ts
--   intent_feedback      services/analytics.service.ts, app/api/admin/analytics/route.ts
--   chat_metrics         services/analytics.service.ts
--   bills                services/billing.service.ts, app/admin/billing/**
--   members              services/volunteer.service.ts, app/admin/sevas/**
--   volunteers           services/volunteer.service.ts, app/admin/sevas/**
--
-- Every statement is idempotent and non-destructive; safe to re-run.
--
-- `firestore_id` is kept on each table as a nullable, unique, non-authoritative
-- column. It is not required for fresh data and carries no Firestore read/write
-- path; it is retained only so a future, separately-reviewed cleanup can drop it
-- without a second schema change. No application code reads it.

-- Ensure the shared updated_at function exists (declared in 20261001000000).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public write access to announcements" ON announcements;
CREATE POLICY "Deny all public write access to announcements" ON announcements
    FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public update access to announcements" ON announcements;
CREATE POLICY "Deny all public update access to announcements" ON announcements
    FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny all public delete access to announcements" ON announcements;
CREATE POLICY "Deny all public delete access to announcements" ON announcements
    FOR DELETE USING (false);
-- Active announcements are public website content, like site_settings/social_links.
DROP POLICY IF EXISTS "Allow public read access to active announcements" ON announcements;
CREATE POLICY "Allow public read access to active announcements" ON announcements
    FOR SELECT USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_announcements_active_order
    ON announcements (is_active, display_order);

-- ---------------------------------------------------------------------------
-- quotes (devotional quote engine)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    category text NOT NULL,
    priority integer NOT NULL DEFAULT 5,
    language text NOT NULL DEFAULT 'en',
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    source text NOT NULL DEFAULT '',
    author text,
    verse_number integer,
    tags text[] NOT NULL DEFAULT '{}'::text[],
    active boolean NOT NULL DEFAULT true,
    featured boolean NOT NULL DEFAULT false,
    festival_only boolean NOT NULL DEFAULT false,
    festival_names text[] NOT NULL DEFAULT '{}'::text[],
    weekday_only integer,
    panchanga_rules jsonb,
    event_rules jsonb,
    display_from text,
    display_to text,
    display_weight integer NOT NULL DEFAULT 1,
    rotation_group text,
    stats jsonb NOT NULL DEFAULT '{"viewCount": 0}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by text
);

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
-- The quote engine is read only through the server (API routes / services) with the
-- service-role client; the public `/quotes` page goes through `/api/quotes`. Deny all
-- direct client access, matching settings_documents.
DROP POLICY IF EXISTS "Deny all public access to quotes" ON quotes;
CREATE POLICY "Deny all public access to quotes" ON quotes FOR ALL TO public USING (false);

CREATE INDEX IF NOT EXISTS idx_quotes_active ON quotes (active);
CREATE INDEX IF NOT EXISTS idx_quotes_category ON quotes (category);
CREATE INDEX IF NOT EXISTS idx_quotes_slug ON quotes (slug);
CREATE INDEX IF NOT EXISTS idx_quotes_featured ON quotes (featured);

-- ---------------------------------------------------------------------------
-- page_views / daily_page_stats (site analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS page_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path text NOT NULL,
    referrer text,
    device_type text,
    language text,
    country text,
    visitor_id text,
    view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to page_views" ON page_views;
CREATE POLICY "Deny all public access to page_views" ON page_views FOR ALL TO public USING (false);

CREATE INDEX IF NOT EXISTS idx_page_views_view_date ON page_views (view_date);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path);

CREATE TABLE IF NOT EXISTS daily_page_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date date NOT NULL UNIQUE,
    page_views integer NOT NULL DEFAULT 0,
    unique_visitors integer NOT NULL DEFAULT 0,
    top_pages jsonb NOT NULL DEFAULT '[]'::jsonb,
    traffic_sources jsonb NOT NULL DEFAULT '{"direct":0,"organic":0,"referral":0,"social":0}'::jsonb,
    device_breakdown jsonb NOT NULL DEFAULT '{"mobile":0,"desktop":0,"tablet":0}'::jsonb,
    avg_session_duration numeric(10,2) NOT NULL DEFAULT 0,
    bounce_rate numeric(5,2) NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_daily_page_stats_updated_at ON daily_page_stats;
CREATE TRIGGER update_daily_page_stats_updated_at BEFORE UPDATE ON daily_page_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE daily_page_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to daily_page_stats" ON daily_page_stats;
CREATE POLICY "Deny all public access to daily_page_stats" ON daily_page_stats FOR ALL TO public USING (false);

-- ---------------------------------------------------------------------------
-- intent_metrics / intent_feedback / chat_metrics (Raya AI analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    intent text NOT NULL,
    confidence numeric(5,2),
    used_fallback boolean NOT NULL DEFAULT false,
    metric_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
    session_id text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE intent_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to intent_metrics" ON intent_metrics;
CREATE POLICY "Deny all public access to intent_metrics" ON intent_metrics FOR ALL TO public USING (false);

CREATE INDEX IF NOT EXISTS idx_intent_metrics_date ON intent_metrics (metric_date);

CREATE TABLE IF NOT EXISTS intent_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    question text NOT NULL,
    detected_intent text NOT NULL,
    correct_intent text NOT NULL,
    is_correct boolean NOT NULL,
    session_id text,
    admin_id text,
    notes text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE intent_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to intent_feedback" ON intent_feedback;
CREATE POLICY "Deny all public access to intent_feedback" ON intent_feedback FOR ALL TO public USING (false);

CREATE TABLE IF NOT EXISTS chat_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    metric_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
    total_queries integer NOT NULL DEFAULT 0,
    successful_queries integer NOT NULL DEFAULT 0,
    fallback_queries integer NOT NULL DEFAULT 0,
    unknown_questions integer NOT NULL DEFAULT 0,
    average_confidence numeric(5,2) NOT NULL DEFAULT 0,
    language_breakdown jsonb NOT NULL DEFAULT '{"en":0,"kn":0,"mixed":0}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_chat_metrics_updated_at ON chat_metrics;
CREATE TRIGGER update_chat_metrics_updated_at BEFORE UPDATE ON chat_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE chat_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to chat_metrics" ON chat_metrics;
CREATE POLICY "Deny all public access to chat_metrics" ON chat_metrics FOR ALL TO public USING (false);

-- ---------------------------------------------------------------------------
-- bills (temple billing / invoicing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    invoice_number text NOT NULL,
    bill_date timestamptz,
    due_date timestamptz,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    customer_address text,
    customer_gstin text,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    subtotal numeric(12,2) NOT NULL DEFAULT 0,
    tax_amount numeric(12,2) NOT NULL DEFAULT 0,
    discount_amount numeric(12,2) NOT NULL DEFAULT 0,
    total_amount numeric(12,2) NOT NULL DEFAULT 0,
    amount_paid numeric(12,2) NOT NULL DEFAULT 0,
    balance_due numeric(12,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'draft',
    payment_status text NOT NULL DEFAULT 'pending',
    payments jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes text,
    created_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_bills_updated_at ON bills;
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to bills" ON bills;
CREATE POLICY "Deny all public access to bills" ON bills FOR ALL TO public USING (false);

CREATE INDEX IF NOT EXISTS idx_bills_invoice_number ON bills (invoice_number);

-- ---------------------------------------------------------------------------
-- members / volunteers (seva roster managed from the admin console)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    member_id text NOT NULL DEFAULT '',
    name text NOT NULL,
    phone text NOT NULL DEFAULT '',
    sex text NOT NULL DEFAULT 'Male',
    active boolean NOT NULL DEFAULT true,
    address text NOT NULL DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to members" ON members;
CREATE POLICY "Deny all public access to members" ON members FOR ALL TO public USING (false);

CREATE TABLE IF NOT EXISTS volunteers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    volunteer_id text NOT NULL DEFAULT '',
    name text NOT NULL,
    phone text NOT NULL DEFAULT '',
    sex text NOT NULL DEFAULT 'Male',
    active boolean NOT NULL DEFAULT true,
    address text NOT NULL DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_volunteers_updated_at ON volunteers;
CREATE TRIGGER update_volunteers_updated_at BEFORE UPDATE ON volunteers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to volunteers" ON volunteers;
CREATE POLICY "Deny all public access to volunteers" ON volunteers FOR ALL TO public USING (false);
