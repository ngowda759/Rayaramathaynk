-- Migration: Create settings_documents (lossless container for complex settings docs)
--
-- The Firestore `settings` collection holds several unrelated documents:
--   financeSettings, poojaSchedule, festivalCalendar, aboutUs, trustCommittee,
--   guruParampara  (plus the structured site_settings / social_links pair).
--
-- The first six are deeply nested, contain arrays of objects, and have no
-- stable relational shape. Normalising them would risk dropping fields, which
-- violates the migration's "no silent data loss" requirement. They are
-- therefore stored as their complete original document in JSONB.
--
-- site_settings and social_links keep their existing dedicated tables because
-- application code already reads those normalized shapes.
--
-- All statements are idempotent and non-destructive; safe to re-run.

CREATE TABLE IF NOT EXISTS settings_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    document_key text NOT NULL UNIQUE,
    data jsonb NOT NULL,
    source_field_count integer,
    created_at timestamptz,
    updated_at timestamptz
);

-- Reconcile columns on databases where an earlier revision of this table exists.
ALTER TABLE IF EXISTS settings_documents ADD COLUMN IF NOT EXISTS source_field_count integer;

ALTER TABLE settings_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'settings_documents'
          AND policyname = 'Deny all public access to settings_documents'
    ) THEN
        CREATE POLICY "Deny all public access to settings_documents"
            ON settings_documents
            FOR ALL
            TO public
            USING (false);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS settings_documents_document_key_key
    ON settings_documents (document_key);

CREATE INDEX IF NOT EXISTS idx_settings_documents_updated_at
    ON settings_documents (updated_at DESC);
