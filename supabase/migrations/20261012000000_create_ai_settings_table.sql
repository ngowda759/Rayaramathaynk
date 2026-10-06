-- Migration: Create ai_settings table

CREATE TABLE ai_settings (
    id text PRIMARY KEY DEFAULT 'main',
    general jsonb NOT NULL DEFAULT '{}'::jsonb,
    safety jsonb NOT NULL DEFAULT '{}'::jsonb,
    extended_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
    temple_information jsonb NOT NULL DEFAULT '{}'::jsonb,
    visitor_information jsonb NOT NULL DEFAULT '{}'::jsonb,
    temple_policies jsonb NOT NULL DEFAULT '{}'::jsonb,
    ai_responses jsonb NOT NULL DEFAULT '{}'::jsonb,
    ai_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
    prompt jsonb NOT NULL DEFAULT '{}'::jsonb,
    intents jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    updated_by text,
    version integer DEFAULT 1
);

-- Apply updated_at trigger
CREATE TRIGGER update_ai_settings_updated_at
    BEFORE UPDATE ON ai_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Deny all public access to ai_settings
CREATE POLICY "Deny all public access to ai_settings" ON ai_settings FOR ALL TO public USING (false);
