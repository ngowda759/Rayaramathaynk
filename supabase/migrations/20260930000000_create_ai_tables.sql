-- Migration: Create AI tables (chat_sessions, chat_messages, unknown_questions, ai_intent_distribution, ai_latency_records)

-- 1. Create `chat_sessions` table
CREATE TABLE chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    user_id text, -- Loose reference to Firebase Auth UID or anonymous session
    message_count integer NOT NULL DEFAULT 0,
    last_message text,
    detected_language text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Apply updated_at trigger to chat_sessions
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Create `chat_messages` table
CREATE TABLE chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    session_id text NOT NULL, -- references chat_sessions.firestore_id conceptually
    role text NOT NULL,
    content text NOT NULL,
    timestamp timestamptz NOT NULL,
    model text,
    latency numeric(10,2),
    detected_language text
);

-- 3. Create `unknown_questions` table
CREATE TABLE unknown_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    question text NOT NULL,
    question_lower text,
    detected_intent text,
    confidence numeric(5,2),
    language text,
    timestamp timestamptz DEFAULT now(),
    session_id text,
    times_asked integer DEFAULT 1,
    status text NOT NULL DEFAULT 'pending',
    assigned_to text DEFAULT 'unassigned',
    last_asked timestamptz,
    reviewed_by text,
    reviewed_at timestamptz,
    response text,
    added_to_knowledge_article_id text,
    notes text
);

-- 4. Create `ai_intent_distribution` table
CREATE TABLE ai_intent_distribution (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    intent text NOT NULL,
    category text,
    language text,
    confidence numeric(5,2),
    timestamp timestamptz DEFAULT now(),
    session_id text,
    message_id text
);

-- 5. Create `ai_latency_records` table
CREATE TABLE ai_latency_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    total_latency numeric(10,2) NOT NULL,
    intent_detection_time numeric(10,2) NOT NULL,
    retrieval_time numeric(10,2) NOT NULL,
    generation_time numeric(10,2) NOT NULL,
    timestamp timestamptz DEFAULT now(),
    success boolean NOT NULL DEFAULT true,
    error_type text,
    model text,
    session_id text
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unknown_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_intent_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_latency_records ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies (all DB access should be Server-Side with Service Role)
CREATE POLICY "Deny all public access to chat_sessions" ON chat_sessions FOR ALL TO public USING (false);
CREATE POLICY "Deny all public access to chat_messages" ON chat_messages FOR ALL TO public USING (false);
CREATE POLICY "Deny all public access to unknown_questions" ON unknown_questions FOR ALL TO public USING (false);
CREATE POLICY "Deny all public access to ai_intent_distribution" ON ai_intent_distribution FOR ALL TO public USING (false);
CREATE POLICY "Deny all public access to ai_latency_records" ON ai_latency_records FOR ALL TO public USING (false);

-- 7. Create Indexes
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions (user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages (session_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages (timestamp);
CREATE INDEX idx_unknown_questions_timestamp ON unknown_questions (timestamp);
CREATE INDEX idx_ai_intent_dist_timestamp ON ai_intent_distribution (timestamp);
CREATE INDEX idx_ai_latency_records_timestamp ON ai_latency_records (timestamp);
