-- Migration: admin-console tables (featured content, chat training data)
--
-- Two Firestore collections backed admin consoles that had no Supabase home:
-- `featuredContent` (the homepage "featured" carousel the admin curates) and
-- `chatTraining` (keyword -> response pairs Raya AI uses as curated answers).
-- Both are live features, so both get real tables rather than being dropped.
--
-- `featured_content` is public-readable: the homepage carousel renders active rows
-- through the anon key, which is why a SELECT policy is granted here. Writes stay
-- with the service role behind the guarded `/api/admin/featured` route.
--
-- `chat_training` is deny-all: training pairs are internal assistant configuration
-- and are only read server-side when answering a question.

-- ============================================================================
-- featured_content: curated homepage banners / highlighted content
-- ============================================================================
CREATE TABLE IF NOT EXISTS featured_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    content_id text NOT NULL DEFAULT '',
    content_type text NOT NULL DEFAULT 'custom',
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    image_url text,
    link_url text NOT NULL DEFAULT '',
    link_label text NOT NULL DEFAULT '',
    priority integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    start_date timestamptz,
    end_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT featured_content_type_check CHECK (
        content_type IN ('event', 'announcement', 'seva', 'knowledge', 'gallery', 'custom')
    )
);

ALTER TABLE featured_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to featured_content" ON featured_content;
CREATE POLICY "Deny all public access to featured_content" ON featured_content FOR ALL TO public USING (false);
DROP POLICY IF EXISTS "Allow public read of active featured content" ON featured_content;
CREATE POLICY "Allow public read of active featured content"
    ON featured_content
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);
CREATE INDEX IF NOT EXISTS idx_featured_content_priority ON featured_content (priority ASC);

-- ============================================================================
-- chat_training: curated keyword -> response pairs for Raya AI
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_training (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    keywords text[] NOT NULL DEFAULT '{}',
    response text NOT NULL,
    category text NOT NULL DEFAULT 'general',
    priority integer NOT NULL DEFAULT 1,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_training ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to chat_training" ON chat_training;
CREATE POLICY "Deny all public access to chat_training" ON chat_training FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_chat_training_active_priority ON chat_training (active, priority ASC);
