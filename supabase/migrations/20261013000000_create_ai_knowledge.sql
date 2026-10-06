-- Migration: Create ai_knowledge table

CREATE TABLE ai_knowledge (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    kannada_title text,
    category text NOT NULL DEFAULT 'general',
    keywords text[] NOT NULL DEFAULT '{}'::text[],
    content text NOT NULL,
    kannada_content text,
    language text NOT NULL DEFAULT 'en',
    last_reviewed timestamptz,
    approved boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Apply updated_at trigger
CREATE TRIGGER update_ai_knowledge_updated_at
    BEFORE UPDATE ON ai_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ai_knowledge ENABLE ROW LEVEL SECURITY;

-- Allow public read access to approved articles
CREATE POLICY "Allow public read access to approved articles"
    ON ai_knowledge
    FOR SELECT
    TO public
    USING (approved = true);

-- Deny public write access (requires service role)
CREATE POLICY "Deny public write access to ai_knowledge"
    ON ai_knowledge
    FOR INSERT
    TO public
    WITH CHECK (false);

CREATE POLICY "Deny public update access to ai_knowledge"
    ON ai_knowledge
    FOR UPDATE
    TO public
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny public delete access to ai_knowledge"
    ON ai_knowledge
    FOR DELETE
    TO public
    USING (false);

-- Indexes for search and retrieval
CREATE INDEX idx_ai_knowledge_category ON ai_knowledge(category);
CREATE INDEX idx_ai_knowledge_approved ON ai_knowledge(approved);
CREATE INDEX idx_ai_knowledge_slug ON ai_knowledge(slug);
