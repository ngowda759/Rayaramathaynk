-- Migration: AI chat workflow tables (AI testimonials, volunteer requests, chat feedback)
--
-- The public site and the admin console both use these three collections. Before this
-- migration they lived in Firestore (`testimonials`, `volunteer_requests`, `feedback`)
-- as part of the Firestore data cutover. All three are deny-all under RLS: the server
-- reads and writes them with the service role behind the guarded API routes, exactly
-- like the other application tables.

-- AI testimonials collected by the Raya AI chat assistant. Distinct from the devotee
-- `testimonials` table: the shape (session, city, experience, rating) matches the chat
-- form, not the public homepage form.
CREATE TABLE IF NOT EXISTS ai_testimonials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    session_id text NOT NULL DEFAULT '',
    name text NOT NULL,
    city text NOT NULL DEFAULT '',
    experience text NOT NULL,
    rating integer NOT NULL DEFAULT 5,
    permission_to_publish boolean NOT NULL DEFAULT false,
    approved boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to ai_testimonials" ON ai_testimonials;
CREATE POLICY "Deny all public access to ai_testimonials" ON ai_testimonials FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_ai_testimonials_approved_created ON ai_testimonials (approved, created_at DESC);

-- Volunteer requests collected by the Raya AI chat assistant.
CREATE TABLE IF NOT EXISTS ai_volunteer_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    session_id text NOT NULL DEFAULT '',
    name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    service text NOT NULL,
    preferred_date text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_volunteer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to ai_volunteer_requests" ON ai_volunteer_requests;
CREATE POLICY "Deny all public access to ai_volunteer_requests" ON ai_volunteer_requests FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_ai_volunteer_requests_created ON ai_volunteer_requests (created_at DESC);

-- Feedback left on individual Raya AI answers.
CREATE TABLE IF NOT EXISTS ai_chat_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    session_id text NOT NULL DEFAULT '',
    message_id text NOT NULL DEFAULT '',
    rating text,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_chat_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to ai_chat_feedback" ON ai_chat_feedback;
CREATE POLICY "Deny all public access to ai_chat_feedback" ON ai_chat_feedback FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_ai_chat_feedback_created ON ai_chat_feedback (created_at DESC);
