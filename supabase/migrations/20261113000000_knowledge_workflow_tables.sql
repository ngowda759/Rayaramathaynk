-- Migration: Knowledge workflow tables (draft -> review -> publish pipeline)
--
-- These seven collections backed the admin Knowledge Workflow console in Firestore:
-- knowledge_workflow (articles), knowledge_versions, knowledge_workflow_actions,
-- knowledge_review_comments, knowledge_committee_approvals, knowledge_audit_log and
-- knowledge_drafts. Every one of them is read or written by
-- `services/knowledge-workflow.service.ts`, so all seven are in scope for the data
-- cutover; none is dead code.
--
-- All seven are deny-all under RLS. The server reaches them with the service role from
-- behind the guarded `/api/knowledge/workflow/**` routes; there is no public reader and
-- no anonymous grant, because the pipeline holds unreleased drafts and internal review
-- notes. `firestore_id` is kept nullable and UNIQUE so the server can still map a
-- Firestore document id if one is ever passed in, without making it the primary key.

-- ============================================================================
-- knowledge_workflow: one row per article, carrying its pipeline status
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_workflow (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    slug text NOT NULL,
    title text NOT NULL,
    content text NOT NULL DEFAULT '',
    category text NOT NULL,
    keywords text[] NOT NULL DEFAULT '{}',
    language text NOT NULL DEFAULT 'en',
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    created_by text NOT NULL DEFAULT '',
    updated_by text NOT NULL DEFAULT '',
    reviewed_at timestamptz,
    reviewed_by text NOT NULL DEFAULT '',
    submitted_at timestamptz,
    submitted_by text NOT NULL DEFAULT '',
    published_by text NOT NULL DEFAULT '',
    archived_at timestamptz,
    archived_by text NOT NULL DEFAULT '',
    current_version integer NOT NULL DEFAULT 1,
    version_id uuid,
    is_featured boolean NOT NULL DEFAULT false,
    is_archived boolean NOT NULL DEFAULT false,
    CONSTRAINT knowledge_workflow_status_check CHECK (
        status IN ('draft', 'pending_review', 'in_review', 'changes_requested',
                   'pending_approval', 'approved', 'published', 'archived')
    )
);

ALTER TABLE knowledge_workflow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_workflow" ON knowledge_workflow;
CREATE POLICY "Deny all public access to knowledge_workflow" ON knowledge_workflow FOR ALL TO public USING (false);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_workflow_slug ON knowledge_workflow (slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_workflow_status_updated ON knowledge_workflow (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_workflow_category ON knowledge_workflow (category);

-- ============================================================================
-- knowledge_versions: immutable content snapshots, one per article revision
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    article_id uuid NOT NULL REFERENCES knowledge_workflow (id) ON DELETE CASCADE,
    version integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL DEFAULT '',
    keywords text[] NOT NULL DEFAULT '{}',
    category text NOT NULL,
    language text NOT NULL DEFAULT 'en',
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text NOT NULL DEFAULT '',
    change_description text NOT NULL DEFAULT '',
    previous_version_id uuid REFERENCES knowledge_versions (id) ON DELETE SET NULL,
    CONSTRAINT knowledge_versions_unique_per_article UNIQUE (article_id, version)
);

ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_versions" ON knowledge_versions;
CREATE POLICY "Deny all public access to knowledge_versions" ON knowledge_versions FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_article_version ON knowledge_versions (article_id, version DESC);

-- ============================================================================
-- knowledge_workflow_actions: the audit trail of status transitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_workflow_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    article_id uuid NOT NULL REFERENCES knowledge_workflow (id) ON DELETE CASCADE,
    action text NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    performed_by text NOT NULL DEFAULT '',
    performed_at timestamptz NOT NULL DEFAULT now(),
    comment text,
    previous_version_id uuid REFERENCES knowledge_versions (id) ON DELETE SET NULL,
    new_version_id uuid REFERENCES knowledge_versions (id) ON DELETE SET NULL
);

ALTER TABLE knowledge_workflow_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_workflow_actions" ON knowledge_workflow_actions;
CREATE POLICY "Deny all public access to knowledge_workflow_actions" ON knowledge_workflow_actions FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_knowledge_workflow_actions_article ON knowledge_workflow_actions (article_id, performed_at DESC);

-- ============================================================================
-- knowledge_review_comments: reviewer notes against an article or a version
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_review_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    article_id uuid NOT NULL REFERENCES knowledge_workflow (id) ON DELETE CASCADE,
    version_id uuid REFERENCES knowledge_versions (id) ON DELETE SET NULL,
    content text NOT NULL,
    created_by text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved boolean NOT NULL DEFAULT false,
    resolved_by text NOT NULL DEFAULT '',
    resolved_at timestamptz
);

ALTER TABLE knowledge_review_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_review_comments" ON knowledge_review_comments;
CREATE POLICY "Deny all public access to knowledge_review_comments" ON knowledge_review_comments FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_comments_article ON knowledge_review_comments (article_id, created_at ASC);

-- ============================================================================
-- knowledge_committee_approvals: one committee vote record per article review
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_committee_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    article_id uuid NOT NULL REFERENCES knowledge_workflow (id) ON DELETE CASCADE,
    required_approvals integer NOT NULL DEFAULT 2,
    current_approvals integer NOT NULL DEFAULT 0,
    approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    deadline timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT knowledge_committee_approvals_status_check CHECK (
        status IN ('pending', 'approved', 'rejected')
    )
);

ALTER TABLE knowledge_committee_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_committee_approvals" ON knowledge_committee_approvals;
CREATE POLICY "Deny all public access to knowledge_committee_approvals" ON knowledge_committee_approvals FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_knowledge_committee_approvals_article ON knowledge_committee_approvals (article_id, created_at DESC);

-- ============================================================================
-- knowledge_audit_log: cross-entity audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    performed_by text NOT NULL DEFAULT '',
    performed_at timestamptz NOT NULL DEFAULT now(),
    previous_state jsonb,
    new_state jsonb,
    metadata jsonb,
    ip_address text,
    user_agent text,
    CONSTRAINT knowledge_audit_log_entity_type_check CHECK (
        entity_type IN ('article', 'version', 'workflow', 'comment', 'approval')
    )
);

ALTER TABLE knowledge_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_audit_log" ON knowledge_audit_log;
CREATE POLICY "Deny all public access to knowledge_audit_log" ON knowledge_audit_log FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_log_entity ON knowledge_audit_log (entity_type, entity_id, performed_at DESC);

-- ============================================================================
-- knowledge_drafts: per-contributor unsaved work
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT 'general',
    keywords text[] NOT NULL DEFAULT '{}',
    language text NOT NULL DEFAULT 'en',
    created_by text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_saved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to knowledge_drafts" ON knowledge_drafts;
CREATE POLICY "Deny all public access to knowledge_drafts" ON knowledge_drafts FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_knowledge_drafts_created_by ON knowledge_drafts (created_by, updated_at DESC);
