-- ============================================================================
-- F-A16 — Production Supabase Catalog Audit EXTENSION (READ-ONLY)
-- ============================================================================
--
-- Purpose
-- -------
-- The baseline query set (docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql) reads
-- pg_default_acl, information_schema grants, pg_policies, pg_proc and the ledger.
-- It does NOT read *effective* privilege: it never calls has_schema_privilege(),
-- has_table_privilege(), has_function_privilege() or has_sequence_privilege(),
-- and it never reads pg_auth_members / pg_has_role. It also never expands an ACL
-- with aclexplode(), so a grant to PUBLIC (grantee = 0) is invisible to it.
--
-- Those are exactly the questions the F-A16 migration's preconditions ask
-- (section 0c "can a public-facing role create in public?", section 4 "is the
-- applying role a member of every candidate creator?"), and exactly what the
-- F-A16 production preflight (2026-11-02) could not answer over PostgREST.
--
-- This file adds them. It is additive: it does not modify or replace the
-- baseline file, and it is designed to run through the same runner
-- (scripts/lib/run-catalog-audit.mjs), in the same read-only session.
--
-- Approved production project: kvrkraqjuyxbraccxntk
--   (see scripts/lib/approved-project.mjs — APPROVED_PROJECT_REF)
--
-- SAFETY — READ THIS FIRST
-- ------------------------
--   * Every statement is a SELECT. There are NO INSERT, UPDATE, DELETE, UPSERT,
--     TRUNCATE, CREATE, ALTER, DROP, GRANT, REVOKE, COMMENT, CALL, DO, COPY or
--     migration statements. Nothing here changes grants, policies or data.
--   * No function is invoked. has_*_privilege() and aclexplode() only READ the
--     catalog; they do not execute the object they describe.
--   * No row contents are read from application tables.
--   * Run inside a read-only session, through the existing runner, which proves
--     the session is read-only before any statement is sent.
--
-- HOW TO RUN (owner)
-- ------------------
--   The runner accepts more than one SQL file; all arguments except the last are
--   inputs, and the last is the output file:
--
--       node scripts/lib/run-catalog-audit.mjs \
--         docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql \
--         docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql \
--         "$RUNNER_TEMP/f-a16-audit.log"
--
--   The read-only catalog audit workflow exposes this as its `include_extension`
--   input. The whole set runs in one read-only session, so both files share one
--   identity verification and one session-safety proof.
--
-- ACCESS CAVEATS (do not assume success)
-- --------------------------------------
--   * `pg_auth_members` column set differs by server version: PG16 added
--     `inherit_option` and `set_option`. Only the version-stable columns are
--     selected here, so the statement does not fail on an older server.
--   * has_*_privilege() answers for the role NAMED, not for the connected role.
--     A FALSE means "this role does not hold it *as far as the catalog says*";
--     it does not mean "no role does".
--   * `information_schema.role_table_grants` omits a role that holds no grant at
--     all, and never shows a grant to PUBLIC. Cross-check with pg_class.relacl
--     via aclexplode() (section E4/E5), which does show PUBLIC.
--   * Record any permission error verbatim; do not escalate privileges to get
--     past it.
--
-- WHAT EACH SECTION PROVES — AND WHAT IT CANNOT
-- ---------------------------------------------
--   A catalog read proves the *configuration* (effective privilege, membership,
--   default ACLs). It does NOT prove runtime behaviour, and an API observation
--   does NOT prove configuration. Keep the two apart.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- §E0. Session safety guard — the same proof as the baseline, restated here so
--      this file is safe to run on its own.
-- ---------------------------------------------------------------------------
-- Proves: the session will reject writes.
-- Expect: transaction_read_only = on, default_transaction_read_only = on.
-- If either is off, STOP and re-establish a read-only session.
SELECT current_setting('transaction_read_only')         AS transaction_read_only,
       current_setting('default_transaction_read_only') AS default_transaction_read_only,
       current_database()                               AS connected_database,
       current_user                                     AS connected_role,
       version()                                        AS server_version;

-- Target identity, independent of credentials. May be NULL.
SELECT current_setting('supabase.project_ref', true) AS supabase_project_ref;


-- ---------------------------------------------------------------------------
-- §E1. Candidate object creators in `public`  → F-A16 §9 items 7 / 7d / 7e
-- ---------------------------------------------------------------------------
-- Proves: which roles can *effectively* create in `public` — the union of
--         direct schema privilege and privilege inherited through membership.
--         This is the question the migration's section 0c fails closed on.
-- Cannot prove: that a role will actually create; only that it may.
SELECT r.rolname,
       r.rolcanlogin,
       r.rolsuper,
       r.rolbypassrls,
       r.rolinherit,
       has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create_in_public,
       pg_has_role(current_user, r.oid, 'MEMBER')      AS applying_role_is_member
FROM   pg_roles r
WHERE  has_schema_privilege(r.oid, 'public', 'CREATE')
   OR  r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres',
                     'supabase_admin', 'dashboard_user', 'pg_database_owner',
                     'authenticator')
ORDER  BY r.rolname;

-- Proves: whether CREATE on `public` was granted to PUBLIC itself. A grant to
--         PUBLIC makes every role an effective creator, and section 0c refuses.
--         `nspacl` is expanded with aclexplode so grantee = 0 (PUBLIC) is
--         visible — a plain `nspacl::text LIKE '%CREATE%'` cannot tell you who.
-- Cannot prove: the effective result per role (that is the statement above).
SELECT n.nspname                              AS schema_name,
       n.nspacl::text                         AS schema_acl,
       a.grantee                              AS grantee_oid,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type,
       a.is_grantable
FROM   pg_namespace n
CROSS  JOIN LATERAL aclexplode(n.nspacl) a
WHERE  n.nspname = 'public'
ORDER  BY a.grantee, a.privilege_type;

-- Proves: the source-(a) creators — owners that hold a default ACL, which is
--         what makes a role able to create objects that receive those defaults.
-- Cannot prove: roles that can create but hold no default ACL (source (b),
--         covered by §E1).
SELECT DISTINCT pg_get_userbyid(d.defaclrole) AS default_acl_owner
FROM   pg_default_acl d
WHERE  d.defaclnamespace = 'public'::regnamespace
   OR  d.defaclnamespace = 0
ORDER  BY 1;


-- ---------------------------------------------------------------------------
-- §E2. Role membership graph  → F-A16 §9 item 7
-- ---------------------------------------------------------------------------
-- Proves: the membership edges behind every inherited privilege — which role
--         holds which other role. An inherited CREATE or EXECUTE is invisible
--         to a direct nspacl/relacl join; this is where it shows up.
-- Cannot prove: privilege *use*; membership alone is not a grant.
-- Version note: only version-stable columns are selected. PG16 added
-- `inherit_option` and `set_option`, which are deliberately not referenced.
SELECT m.roleid::regrole::text AS member_role,
       m.member::regrole::text AS granted_role,
       pg_get_userbyid(m.grantor) AS granted_by,
       m.admin_option
FROM   pg_auth_members m
ORDER  BY 1, 2;

-- Proves: whether the role that would APPLY the migration is a member of each
--         role that can create in `public`. The migration's section 4 covers a
--         creator by applying the tightening as that role, which is only
--         possible if the applying role is a member of it (or is it).
-- Cannot prove: that the migration will run as this role; the runner reports it.
SELECT r.rolname                                          AS candidate_creator,
       pg_has_role(current_user, r.oid, 'MEMBER')         AS applying_role_is_member,
       pg_has_role(current_user, r.oid, 'USAGE')          AS applying_role_can_use,
       current_user                                       AS applying_role
FROM   pg_roles r
WHERE  has_schema_privilege(r.oid, 'public', 'CREATE')
ORDER  BY r.rolname;


-- ---------------------------------------------------------------------------
-- §E3. Effective schema privilege for the roles that matter  → F-A16 §9 item 7d
-- ---------------------------------------------------------------------------
-- Proves: the direct answer to "can anon / authenticated / service_role create
--         in public?", which is what the F-A16 production preflight could not
--         obtain (PostgREST exposes only `public` and `graphql_public`).
-- Cannot prove: why. Pair with §E1 and §E2 to see whether it is direct or
--         inherited.
SELECT r.rolname AS role_name,
       has_schema_privilege(r.rolname, 'public', 'CREATE') AS effective_create_on_public,
       has_schema_privilege(r.rolname, 'public', 'USAGE')  AS effective_usage_on_public,
       r.rolcanlogin,
       r.rolsuper,
       r.rolbypassrls
FROM   pg_roles r
WHERE  r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres',
                     'supabase_admin', 'dashboard_user', 'authenticator')
ORDER  BY r.rolname;


-- ---------------------------------------------------------------------------
-- §E4. Default privileges, expanded by grantee  → F-A16-02
-- ---------------------------------------------------------------------------
-- Proves: every default ACL entry, split into (owner, scope, object type,
--         grantee, privilege). This is the root-cause surface for F-A16-02, and
--         it makes a grant to PUBLIC visible via `grantee = 0`.
--         `defaclnamespace = 0` is a GLOBAL default: it applies to objects
--         created in EVERY schema, and a schema-scoped REVOKE cannot subtract it.
-- Cannot prove: privileges on objects that already exist (see §E5).
SELECT pg_get_userbyid(d.defaclrole)                    AS owner_role,
       CASE WHEN d.defaclnamespace = 0
            THEN '(GLOBAL: all schemas)'
            ELSE n.nspname END                          AS schema_scope,
       CASE d.defaclobjtype
            WHEN 'r' THEN 'TABLES'
            WHEN 'S' THEN 'SEQUENCES'
            WHEN 'f' THEN 'FUNCTIONS'
            WHEN 'T' THEN 'TYPES'
            WHEN 'n' THEN 'SCHEMAS'
            ELSE d.defaclobjtype::text END              AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type,
       a.is_grantable
FROM   pg_default_acl d
LEFT   JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS  JOIN LATERAL aclexplode(d.defaclacl) a
ORDER  BY 1, 2, 3, 4, 5;

-- Proves: the GLOBAL defaults only (defaclnamespace = 0). Section 0b of the
--         migration fails closed on these, because a schema-scoped revoke
--         silently no-ops against them — including a global table default that
--         grants TRIGGER / REFERENCES to service_role.
-- Cannot prove: which schemas they will affect; by definition, all of them.
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       CASE d.defaclobjtype
            WHEN 'r' THEN 'TABLES'
            WHEN 'S' THEN 'SEQUENCES'
            WHEN 'f' THEN 'FUNCTIONS'
            WHEN 'T' THEN 'TYPES'
            ELSE d.defaclobjtype::text END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type,
       a.is_grantable
FROM   pg_default_acl d
CROSS  JOIN LATERAL aclexplode(d.defaclacl) a
WHERE  d.defaclnamespace = 0
ORDER  BY 1, 2, 3, 4;

-- Proves: the counts, split by scope and object type, so an empty result is
--         distinguishable from an unread one.
SELECT CASE WHEN d.defaclnamespace = 0 THEN 'GLOBAL' ELSE 'SCHEMA' END AS scope,
       d.defaclobjtype AS object_type_code,
       count(*)       AS entries
FROM   pg_default_acl d
GROUP  BY 1, 2
ORDER  BY 1, 2;

-- Proves: every default ACL that names a public-facing grantee, at any scope.
--         This is the F-A16-02 finding expressed as a single result set: a row
--         here is a default that will apply to future objects.
-- Cannot prove: whether the future object is ever created.
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       CASE WHEN d.defaclnamespace = 0 THEN '(GLOBAL: all schemas)' ELSE n.nspname END AS schema_scope,
       CASE d.defaclobjtype
            WHEN 'r' THEN 'TABLES'
            WHEN 'S' THEN 'SEQUENCES'
            WHEN 'f' THEN 'FUNCTIONS'
            WHEN 'T' THEN 'TYPES'
            ELSE d.defaclobjtype::text END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
FROM   pg_default_acl d
LEFT   JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS  JOIN LATERAL aclexplode(d.defaclacl) a
WHERE  a.grantee = 0
   OR  pg_get_userbyid(a.grantee) IN ('anon', 'authenticated', 'service_role')
ORDER  BY 1, 2, 3, 4, 5;


-- ---------------------------------------------------------------------------
-- §E5. Effective table privileges — grant TYPES, including TRUNCATE,
--      TRIGGER and REFERENCES  → F-A16-01
-- ---------------------------------------------------------------------------
-- Proves: exactly the privileges the API cannot reveal. A row-visibility probe
--         (the F-A16 preflight) distinguishes "has a grant" from "no grant", but
--         it CANNOT tell SELECT from TRUNCATE / TRIGGER / REFERENCES, because
--         those never surface as a row response. This is the only place those
--         three are answered.
-- Cannot prove: that a privilege is usable at runtime; RLS may still deny rows.
SELECT r.rolname  AS role_name,
       c.relname  AS table_name,
       p.privilege AS privilege_type
FROM   (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
CROSS  JOIN (SELECT c.oid, c.relname
             FROM   pg_class c
             JOIN   pg_namespace n ON n.oid = c.relnamespace
             WHERE  n.nspname = 'public' AND c.relkind = 'r') AS c
CROSS  JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(privilege)
WHERE  has_table_privilege(r.rolname, c.oid, p.privilege)
ORDER  BY 1, 2, 3;

-- Proves: the three high-risk privileges on their own, so a reviewer can see at
--         a glance whether any public-facing role holds one. An empty result is
--         the desired state and is evidence in itself.
-- Cannot prove: intent; only that the privilege is held.
SELECT c.relname  AS table_name,
       r.rolname  AS role_name,
       p.privilege AS privilege_type
FROM   (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
CROSS  JOIN (SELECT c.oid, c.relname
             FROM   pg_class c
             JOIN   pg_namespace n ON n.oid = c.relnamespace
             WHERE  n.nspname = 'public' AND c.relkind = 'r') AS c
CROSS  JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(privilege)
WHERE  has_table_privilege(r.rolname, c.oid, p.privilege)
ORDER  BY 1, 2, 3;

-- Proves: the grant TYPES recorded in the ACL itself, per role, from a second
--         independent source (relacl expanded) — so a missing row in the
--         statement above can be reconciled against the raw ACL.
-- Cannot prove: effective privilege for a role that inherits (see §E2).
SELECT c.relname AS table_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type,
       a.is_grantable
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
CROSS  JOIN LATERAL aclexplode(c.relacl) a
WHERE  n.nspname = 'public' AND c.relkind = 'r'
ORDER  BY 1, 2, 3;

-- Proves: the aggregate view of the three high-risk privileges across all public
--         tables, by role — the compact form of the F-A16-01 finding.
SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type,
       count(*) AS table_count
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
CROSS  JOIN LATERAL aclexplode(c.relacl) a
WHERE  n.nspname = 'public'
   AND c.relkind = 'r'
   AND a.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
GROUP  BY 1, 2
ORDER  BY 1, 2;


-- ---------------------------------------------------------------------------
-- §E6. Effective function EXECUTE for public-facing roles  → F-A16-03
-- ---------------------------------------------------------------------------
-- Proves: which functions `anon` / `authenticated` / `service_role` can actually
--         execute, resolved through ownership and membership rather than by
--         reading a single ACL. The F-A16 preflight confirmed from the API that
--         `anon` can reach rls_auto_enable(); this is the catalog-side proof,
--         and it covers the functions the API cannot enumerate.
-- Cannot prove: what the function does when called.
-- Note: a FALSE does not mean "no role can execute it".
SELECT p.proname                                       AS function_name,
       pg_get_function_identity_arguments(p.oid)       AS identity_arguments,
       p.prosecdef                                     AS security_definer,
       p.provolatile                                   AS volatility,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can_execute
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
     OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER  BY 1, 2;

-- Proves: whether the implicit EXECUTE-to-PUBLIC is still present on any public
--         function (the ACL has an entry for grantee = 0). Revoking it is part of
--         the F-A16-02 function default tightening.
-- Cannot prove: whether a named role separately holds EXECUTE (see above).
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.proacl::text AS function_acl,
       a.privilege_type
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
CROSS  JOIN LATERAL aclexplode(p.proacl) a
WHERE  n.nspname = 'public'
   AND a.grantee = 0
ORDER  BY 1, 2;

-- Proves: the count of public functions carrying a grantee = 0 (PUBLIC) entry,
--         so "none" is distinguishable from "not read".
SELECT count(*) AS public_functions_with_public_execute
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
CROSS  JOIN LATERAL aclexplode(p.proacl) a
WHERE  n.nspname = 'public'
   AND a.grantee = 0;


-- ---------------------------------------------------------------------------
-- §E7. Sequence privileges for public-facing roles  → F-A16-01 (completeness)
-- ---------------------------------------------------------------------------
-- Proves: whether a public-facing role can advance or read a sequence. Sequence
--         access is the other half of "can a future object be abused", and the
--         baseline reads only information_schema.role_usage_grants, which omits
--         a role with no grant and never shows PUBLIC.
-- Cannot prove: that the sequence is reachable from the API surface.
SELECT r.rolname AS role_name,
       c.relname AS sequence_name,
       has_sequence_privilege(r.rolname, c.oid, 'USAGE')  AS can_use,
       has_sequence_privilege(r.rolname, c.oid, 'SELECT') AS can_select,
       has_sequence_privilege(r.rolname, c.oid, 'UPDATE') AS can_update
FROM   (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
CROSS  JOIN (SELECT c.oid, c.relname
             FROM   pg_class c
             JOIN   pg_namespace n ON n.oid = c.relnamespace
             WHERE  n.nspname = 'public' AND c.relkind = 'S') AS c
WHERE  has_sequence_privilege(r.rolname, c.oid, 'USAGE')
   OR  has_sequence_privilege(r.rolname, c.oid, 'SELECT')
   OR  has_sequence_privilege(r.rolname, c.oid, 'UPDATE')
ORDER  BY 1, 2;


-- ---------------------------------------------------------------------------
-- §E8. Summary — one row, so the extension is self-describing in the evidence
--      file and a zero is distinguishable from a failure.
-- ---------------------------------------------------------------------------
SELECT (SELECT count(*) FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r')            AS public_tables,
       (SELECT count(*) FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S')            AS public_sequences,
       (SELECT count(*) FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public')                                AS public_functions,
       (SELECT count(*) FROM pg_default_acl)                       AS default_acl_entries,
       (SELECT count(*) FROM pg_default_acl WHERE defaclnamespace = 0) AS global_default_acl_entries,
       (SELECT count(*) FROM pg_auth_members)                      AS membership_entries,
       (SELECT count(*) FROM pg_roles r
        WHERE has_schema_privilege(r.oid, 'public', 'CREATE'))     AS roles_with_create_on_public;
