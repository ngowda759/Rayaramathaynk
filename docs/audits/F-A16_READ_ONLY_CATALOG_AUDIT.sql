-- ============================================================================
-- F-A16 — Production Supabase Catalog Audit (READ-ONLY)
-- ============================================================================
--
-- Purpose
-- -------
-- F-A15.1 reproduced the security posture from repository migrations, and F-A16
-- verified the *effective API* layer (what the `anon` role can read) against the
-- live production project. Neither read the production **catalog**. This file is
-- the catalog read: it is what turns the outstanding F-A15.1 / F-A16 catalog
-- items from "Unverified" into "Verified from PostgreSQL catalog".
--
-- Approved production project: kvrkraqjuyxbraccxntk
--   (see scripts/lib/approved-project.mjs — APPROVED_PROJECT_REF)
--
-- SAFETY — READ THIS FIRST
-- ------------------------
--   * Every statement below is a SELECT / SHOW / catalog read. There are NO
--     INSERT, UPDATE, DELETE, UPSERT, TRUNCATE, CREATE, ALTER, DROP, GRANT,
--     REVOKE, COMMENT, CALL, DO, COPY, SET (persistent), or migration statements.
--   * No function is invoked. `pg_get_functiondef()` and `has_function_privilege()`
--     only READ the catalog; they do not run the function they describe.
--   * No row contents are read from application tables. Storage is inspected via
--     catalog/metadata only — never `storage.objects` row contents.
--   * Run inside a read-only session. Confirm §0 before anything else.
--
-- HOW TO RUN (owner)
-- ------------------
--   Option A — Supabase SQL editor (recommended): paste one section at a time.
--     The SQL editor runs as the `postgres` owner role, which can read the whole
--     catalog. To be certain nothing can write, first run, in the same editor
--     session, only §0; then run §1–§11.
--   Option B — a read-only Postgres session, e.g.:
--       psql "$READONLY_DB_URL" \
--         -c "SET default_transaction_read_only = on;" -f F-A16_READ_ONLY_CATALOG_AUDIT.sql
--     Prefer the Supabase **pooler** host (IPv4) rather than
--     `db.<ref>.supabase.co`, which is IPv6-only and unreachable from many
--     sandboxes (that is exactly why F-A16 could not read the catalog).
--
-- ACCESS CAVEATS (do not assume success)
-- --------------------------------------
--   * `information_schema.*` shows only objects the current role has some
--     privilege on; a row missing there is not proof of absence. `pg_*` catalogs
--     show objects the role can see at all. Cross-check both.
--   * `pg_policies`, `pg_class`, `pg_proc` are world-readable in a stock
--     Postgres, but a hardened deployment may restrict them. Record any
--     permission error verbatim rather than working around it.
--   * `supabase_migrations.schema_migrations` and `storage.*` exist only on
--     Supabase; they may be absent or restricted on a given project.
--   * If a section errors, note the section number and the exact error; do not
--     escalate privileges to get past it.
--
-- WHAT EACH SECTION PROVES — AND WHAT IT CANNOT
-- ---------------------------------------------
--   Each section carries an "Proves / Cannot prove" note. In short: a catalog
--   read proves the *configuration* (flags, grants, policy text, ACLs, ledger).
--   It does NOT prove runtime behaviour, and an API observation does NOT prove
--   configuration. Keep the two apart (see F-A16 report §1.1).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- §0. Session safety guard — PROVE READ-ONLY BEFORE ANYTHING ELSE
-- ---------------------------------------------------------------------------
-- Proves: the session will reject writes.
-- Cannot prove: that the role is otherwise least-privileged.
-- Expect: transaction_read_only = on, default_transaction_read_only = on.
-- If either is off, STOP and re-establish a read-only session.
SELECT current_setting('transaction_read_only')         AS transaction_read_only,
       current_setting('default_transaction_read_only') AS default_transaction_read_only,
       current_database()                               AS connected_database,
       current_user                                     AS connected_role,
       inet_server_addr()                               AS server_addr,
       version()                                        AS server_version;

-- Confirm the target is the approved project (identity, not credentials).
-- Proves: the connection points at the expected Supabase project ref.
SELECT current_setting('supabase.project_ref', true) AS supabase_project_ref;  -- may be NULL


-- ---------------------------------------------------------------------------
-- §1. Public tables, RLS flags, FORCE RLS, owner  → F-A15.1-4, F-A16 §4A/§5
-- ---------------------------------------------------------------------------
-- Proves: relrowsecurity (RLS on/off) and relforcerowsecurity (FORCE RLS) for
--         every public ordinary/partitioned table, and the table owner.
-- Cannot prove: whether any policy actually filters rows (see §3).
SELECT n.nspname                  AS schema,
       c.relname                  AS table_name,
       c.relkind                  AS relkind,            -- r=table, p=partitioned
       c.relrowsecurity           AS rls_enabled,
       c.relforcerowsecurity      AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  c.relkind IN ('r', 'p')
ORDER  BY c.relname;

-- Counts to compare against the F-A15.1 reproduction (67 tables / 0 FORCE RLS).
SELECT count(*)                                   AS public_tables,
       count(*) FILTER (WHERE c.relrowsecurity)    AS rls_enabled,
       count(*) FILTER (WHERE c.relforcerowsecurity) AS force_rls
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public' AND c.relkind IN ('r', 'p');

-- Cross-check via the pg_tables convenience view. NOTE: pg_tables covers ordinary
-- and foreign tables but NOT partitioned parents, so its count can be lower than
-- the pg_class count above (pg_class relkind 'r' only). Record both; a mismatch is
-- expected when partitioned tables exist, not an error.
-- Proves: the same table set from a second, independent view.
SELECT tablename, tableowner, rowsecurity AS rls_enabled, tablespace, hasindexes
FROM   pg_tables
WHERE  schemaname = 'public'
ORDER  BY tablename;

SELECT count(*) AS public_tables_pg_tables_view
FROM   pg_tables
WHERE  schemaname = 'public';


-- ---------------------------------------------------------------------------
-- §2. Effective table privileges (the grant matrix)  → F-A15.1-3, F-A16 §5
-- ---------------------------------------------------------------------------
-- Proves: the privileges each role actually holds on each public table —
--         SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER — and whether
--         they are grantable. This is the "1,088 privilege records" figure.
-- Cannot prove: that a granted privilege is usable at runtime (RLS may still
--         deny rows); and it shows only the roles the reader may see.
SELECT table_name,
       grantee,
       privilege_type,
       is_grantable
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public'
ORDER  BY table_name, grantee, privilege_type;

-- Total privilege records (F-A15.1 reproduced 1,088).
SELECT count(*) AS public_privilege_records
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public';

-- Per-role totals.
SELECT grantee, count(*) AS records
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public'
GROUP  BY grantee
ORDER  BY records DESC;

-- The roles that matter for a Supabase project, cross-checked against the
-- information_schema view (the view can omit a role with no grants at all).
SELECT r.rolname,
       r.rolcanlogin,
       r.rolbypassrls,
       r.rolsuper
FROM   pg_roles r
WHERE  r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres',
                     'supabase_admin', 'dashboard_user')
ORDER  BY r.rolname;

-- Cross-check via information_schema.table_privileges. Unlike role_table_grants
-- (one row per grantee-with-grants), table_privileges also emits rows for the
-- current role's own privileges and is the view the task names explicitly.
-- Proves: the same grant matrix from a second, independent view; useful to
-- reconcile the record count when a role is a member of another role.
SELECT table_name, grantor, grantee, privilege_type, is_grantable, with_hierarchy
FROM   information_schema.table_privileges
WHERE  table_schema = 'public'
ORDER  BY table_name, grantee, privilege_type;

SELECT count(*) AS public_table_privileges_records
FROM   information_schema.table_privileges
WHERE  table_schema = 'public';


-- ---------------------------------------------------------------------------
-- §3. RLS policies: text, command, roles, permissive/restrictive → F-A15.1-5
-- ---------------------------------------------------------------------------
-- Proves: every policy's definition — cmd (ALL/SELECT/…), roles, permissive vs
--         restrictive, and the USING / WITH CHECK expressions.
-- Cannot prove: runtime effect for a specific request (policy composition,
--         role membership, row data). Text is the ground truth for "a policy
--         exists and says X".
SELECT schemaname,
       tablename,
       policyname,
       permissive,               -- PERMISSIVE | RESTRICTIVE
       roles,
       cmd,                      -- ALL | SELECT | INSERT | UPDATE | DELETE
       qual        AS using_expression,
       with_check  AS with_check_expression
FROM   pg_policies
WHERE  schemaname = 'public'
ORDER  BY tablename, policyname;

-- Policy census (F-A15.1 reproduced 81 policies) and permissive/restrictive split.
SELECT count(*) AS public_policy_count FROM pg_policies WHERE schemaname = 'public';
SELECT permissive, count(*) AS policies
FROM   pg_policies WHERE schemaname = 'public'
GROUP  BY permissive ORDER BY permissive;

-- Tables with RLS enabled but NO policy (default-deny) — e.g. F-A15.1-5
-- `seva_list_items`. Proves the invariant exists; does not prove it is intended.
SELECT c.relname AS table_with_rls_no_policy
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  c.relkind IN ('r', 'p')
  AND  c.relrowsecurity
  AND  NOT EXISTS (SELECT 1 FROM pg_policies p
                   WHERE p.schemaname = 'public' AND p.tablename = c.relname)
ORDER  BY c.relname;

-- Policies that grant to the pseudo-role PUBLIC (roles = '{0}' or 'public').
-- Useful for the "anon holds broad access" question.
SELECT tablename, policyname, cmd, roles
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  (roles::text LIKE '%public%' OR roles::text LIKE '%{0}%')
ORDER  BY tablename, policyname;


-- ---------------------------------------------------------------------------
-- §4. Functions and EXECUTE privileges → F-A15.1-1, F-A15.1-2
-- ---------------------------------------------------------------------------
-- Proves: each public function's owner, SECURITY DEFINER flag, `search_path`
--         (proconfig), return type, raw ACL, and effective EXECUTE for the key
--         roles. The definition is read with pg_get_functiondef() — a catalog
--         read; the function is NOT executed.
-- Cannot prove: whether a function is reachable over PostgREST `/rpc/`
--         (that depends on the schema exposed in the API and on the request),
--         nor what it would do if invoked.
SELECT p.oid::regprocedure              AS signature,
       pg_get_userbyid(p.proowner)      AS owner,
       p.prosecdef                      AS security_definer,
       p.proconfig                      AS function_settings,
       p.prorettype::regtype::text      AS return_type,
       p.proacl::text                   AS acl,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can_execute
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
ORDER  BY p.prosecdef DESC, signature;

-- Function census (F-A15.1 reproduced 87 public functions, 1 SECURITY DEFINER).
SELECT count(*)                                    AS public_functions,
       count(*) FILTER (WHERE p.prosecdef)         AS security_definer_functions
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public';

-- Full definitions of the two functions called out by F-A15.1-1 / F-A15.1-2.
SELECT p.oid::regprocedure AS signature,
       pg_get_functiondef(p.oid) AS function_definition
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.proname IN ('rls_auto_enable', 'update_updated_at_column')
ORDER  BY signature;

-- Trigger / event-trigger pseudotype functions (not RPC-callable by design).
SELECT p.oid::regprocedure AS signature,
       p.prorettype::regtype::text AS return_type,
       p.prosecdef AS security_definer
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.prorettype IN ('pg_catalog.trigger'::regtype,
                        'pg_catalog.event_trigger'::regtype)
ORDER  BY signature;

-- Event triggers (the `rls_auto_enable` mechanism, if present).
SELECT e.evtname,
       e.evtevent,
       e.evtenabled,
       e.evtfoid::regprocedure      AS function_called,
       pg_get_userbyid(e.evtowner)  AS owner
FROM   pg_event_trigger e
ORDER  BY e.evtname;

-- Effective EXECUTE via information_schema as a cross-check.
SELECT routine_name, grantee, privilege_type, is_grantable
FROM   information_schema.routine_privileges
WHERE  routine_schema = 'public'
ORDER  BY routine_name, grantee;


-- ---------------------------------------------------------------------------
-- §5. Default privileges → F-A15.1-3 (root cause)
-- ---------------------------------------------------------------------------
-- Proves: what privileges will be granted on FUTURE objects — the mechanism
--         behind "every new table is broadly granted by default".
-- defaclobjtype: r=table, S=sequence, f=function, T=type, n=schema.
-- A NULL/0 defaclnamespace means "all schemas" (global default).
-- Cannot prove: privileges on objects that already exist (that is §2).
SELECT pg_get_userbyid(d.defaclrole)     AS owner_role,
       n.nspname                          AS schema,
       d.defaclobjtype                    AS object_type,
       d.defaclacl::text                  AS default_acl
FROM   pg_default_acl d
LEFT   JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER  BY owner_role, schema, object_type;

-- Global (all-schema) defaults only (F-A15.1 reproduced 6 entries).
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       d.defaclobjtype               AS object_type,
       d.defaclacl::text             AS default_acl
FROM   pg_default_acl d
WHERE  d.defaclnamespace = 0
ORDER  BY owner_role, object_type;

SELECT count(*) AS default_acl_entries FROM pg_default_acl;


-- ---------------------------------------------------------------------------
-- §6. Storage — buckets, policies, object COUNT only → F-A15.1-7
-- ---------------------------------------------------------------------------
-- Proves: bucket metadata (name, public flag, size/mime limits) and any Storage
--         policies; and how many objects exist.
-- Cannot prove: what the objects are. NO object contents, filenames, paths or
--         user metadata are read — only a COUNT.
-- Note: `storage.*` is Supabase-specific and may be absent/restricted.
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM   storage.buckets
ORDER  BY name;

SELECT count(*) AS storage_bucket_count FROM storage.buckets;

SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check AS with_check_expression
FROM   pg_policies
WHERE  schemaname = 'storage'
ORDER  BY tablename, policyname;

SELECT count(*) AS storage_policy_count FROM pg_policies WHERE schemaname = 'storage';

-- Object COUNT only (no contents / names / paths).
SELECT count(*) AS storage_object_rows FROM storage.objects;


-- ---------------------------------------------------------------------------
-- §7. Migration ledger → F-A15.1-8, F-A16 §5
-- ---------------------------------------------------------------------------
-- Proves: which migrations the production project has recorded as applied.
-- Cannot prove: that the recorded DDL matches the repository file byte-for-byte
--         (a ledger entry is a claim, not the DDL). Compare names/versions
--         against supabase/migrations/ by hand.
SELECT version, name
FROM   supabase_migrations.schema_migrations
ORDER  BY version;

SELECT count(*) AS applied_migration_count
FROM   supabase_migrations.schema_migrations;

-- Repository migration count for comparison (run locally, not on production):
--   ls supabase/migrations | wc -l


-- ---------------------------------------------------------------------------
-- §8. Extensions → the pg_graphql / introspection lint family
-- ---------------------------------------------------------------------------
-- Proves: which extensions are installed and at what version (e.g. pg_graphql,
--         pgcrypto, pg_net). Cannot prove: whether their API surface is exposed.
SELECT extname, extversion, n.nspname AS schema
FROM   pg_extension e
JOIN   pg_namespace n ON n.oid = e.extnamespace
ORDER  BY extname;


-- ---------------------------------------------------------------------------
-- §9. RLS auto-enable surface (context for F-A15.1-1)
-- ---------------------------------------------------------------------------
-- Proves: whether the `rls_auto_enable` event trigger exists and is enabled.
-- Cannot prove: intent. Included here because §4 reads the function body.
SELECT e.evtname, e.evtevent, e.evtenabled, e.evtfoid::regprocedure AS fn
FROM   pg_event_trigger e
WHERE  e.evtfoid::regprocedure::text LIKE '%rls_auto_enable%';


-- ---------------------------------------------------------------------------
-- §10. (Optional) per-table policy summary — joins §1 and §3
-- ---------------------------------------------------------------------------
-- Proves: for each public table, whether RLS is on and how many policies it has.
-- Handy single view for the "RLS on + no policy" and "RLS off" questions.
SELECT c.relname                       AS table_name,
       c.relrowsecurity                AS rls_enabled,
       c.relforcerowsecurity           AS force_rls,
       count(p.policyname)             AS policy_count
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
LEFT   JOIN pg_policies p
       ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE  n.nspname = 'public' AND c.relkind IN ('r', 'p')
GROUP  BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER  BY c.relname;


-- ---------------------------------------------------------------------------
-- §11. (Optional) sequence / identity grants — completeness only
-- ---------------------------------------------------------------------------
-- Proves: privileges on public sequences (relevant to INSERT-into-serial paths).
SELECT sequence_name, grantee, privilege_type
FROM   information_schema.role_usage_grants
WHERE  object_schema = 'public' AND object_type = 'SEQUENCE'
ORDER  BY sequence_name, grantee;

-- ============================================================================
-- END OF FILE — SELECT/SHOW only. No statement here modifies database state.
-- ============================================================================
