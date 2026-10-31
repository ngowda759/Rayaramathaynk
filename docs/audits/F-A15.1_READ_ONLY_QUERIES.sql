-- ============================================================================
-- F-A15.1 — Supabase Security Deep-Dive: read-only investigation queries
-- ============================================================================
--
-- Every statement in this file is a SELECT (or a catalog read). There are:
--   * no INSERT / UPDATE / DELETE / ALTER / DROP / CREATE / GRANT / REVOKE /
--     TRUNCATE statements,
--   * no function or RPC invocations,
--   * no writes of any kind.
--
-- Run these against a read-only connection only, e.g.
--     SET default_transaction_read_only = on;
-- and, when the production project is reachable, prefer the Supabase
-- Management API / SQL editor with a read-only role.
--
-- The production project (ref kvrkraqjuyxbraccxntk — see scripts/lib/approved-project.mjs)
-- was NOT reachable from the audit sandbox. The queries below are the ones the
-- investigation is built on; the sandbox that WAS reachable is a different,
-- unrelated Supabase project, so its results are used only as a platform-default
-- reference and are labelled as such in the report.
--
-- Nothing in this file targets Firestore. Supabase is the only intended database.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Tables, RLS flags and FORCE RLS (Investigation 3)
-- ---------------------------------------------------------------------------
SELECT n.nspname                AS schema,
       c.relname                AS table_name,
       c.relrowsecurity         AS rls_enabled,
       c.relforcerowsecurity    AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  c.relkind IN ('r', 'p')          -- ordinary and partitioned tables
ORDER  BY c.relname;


-- ---------------------------------------------------------------------------
-- 2. Effective table privileges per role (Investigation 3)
--    One row per (table, grantee, privilege).
-- ---------------------------------------------------------------------------
SELECT table_name,
       grantee,
       privilege_type,
       is_grantable
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public'
ORDER  BY table_name, grantee, privilege_type;

-- Privilege record count (reconciles the "1,088 table privilege records" finding)
SELECT count(*) AS public_privilege_records
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public';

-- Per-role totals
SELECT grantee, count(*) AS records
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public'
GROUP  BY grantee
ORDER  BY records DESC;


-- ---------------------------------------------------------------------------
-- 3. RLS policies: command, role, permissive/restrictive, USING/WITH CHECK
--    (Investigation 3)
-- ---------------------------------------------------------------------------
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual        AS using_expression,
       with_check  AS with_check_expression
FROM   pg_policies
WHERE  schemaname = 'public'
ORDER  BY tablename, policyname;

-- Policy census (count, and permissive-vs-restrictive split)
SELECT permissive, count(*) AS policies
FROM   pg_policies
WHERE  schemaname = 'public'
GROUP  BY permissive;

-- Tables that have RLS enabled but NO policy (default-deny; e.g. seva_list_items)
SELECT c.relname AS table_without_policy
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  c.relkind IN ('r', 'p')
  AND  c.relrowsecurity
  AND  NOT EXISTS (SELECT 1 FROM pg_policies p
                   WHERE p.schemaname = 'public' AND p.tablename = c.relname)
ORDER  BY c.relname;


-- ---------------------------------------------------------------------------
-- 4. SECURITY DEFINER functions and their EXECUTE grants (Investigation 1)
-- ---------------------------------------------------------------------------
SELECT p.oid::regprocedure              AS signature,
       pg_get_userbyid(p.proowner)      AS owner,
       p.prosecdef                      AS security_definer,
       p.proconfig                      AS function_settings,   -- e.g. search_path
       p.prorettype::regtype::text      AS return_type,
       p.proacl::text                   AS acl,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can_execute
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
ORDER  BY p.prosecdef DESC, signature;

-- Full definition of the one SECURITY DEFINER function (Investigation 1)
-- Read-only: pg_get_functiondef() only reads the catalog.
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.proname = 'rls_auto_enable';

-- Definition of the updated_at trigger helper
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.proname = 'update_updated_at_column';

-- Functions declared to return a trigger/event-trigger pseudotype (not RPC-callable)
SELECT p.oid::regprocedure AS signature,
       p.prorettype::regtype::text AS return_type,
       p.prosecdef AS security_definer
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.prorettype IN ('pg_catalog.trigger'::regtype,
                        'pg_catalog.event_trigger'::regtype)
ORDER  BY signature;

-- Event triggers and the function each one calls
SELECT e.evtname,
       e.evtevent,
       e.evtenabled,
       e.evtfoid::regprocedure AS function_called,
       pg_get_userbyid(e.evtowner) AS owner
FROM   pg_event_trigger e
ORDER  BY e.evtname;

-- Function census
SELECT count(*) AS public_functions
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public';

SELECT count(*) AS public_security_definer_functions
FROM   pg_proc p
JOIN   pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public' AND p.prosecdef;


-- ---------------------------------------------------------------------------
-- 5. Default privileges (Investigation 2)
--    defaclobjtype: r = table, S = sequence, f = function.
--    A NULL defaclnamespace means "all schemas" (global default).
-- ---------------------------------------------------------------------------
SELECT pg_get_userbyid(d.defaclrole)     AS owner_role,
       n.nspname                          AS schema,
       d.defaclobjtype                    AS object_type,   -- r / S / f
       d.defaclacl::text                  AS default_acl
FROM   pg_default_acl d
LEFT   JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER  BY owner_role, schema, object_type;

-- Global (all-schema) default privileges only
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       d.defaclobjtype               AS object_type,
       d.defaclacl::text             AS default_acl
FROM   pg_default_acl d
WHERE  d.defaclnamespace = 0
ORDER  BY owner_role, object_type;


-- ---------------------------------------------------------------------------
-- 6. Storage (Investigation 4) — catalog reads only
-- ---------------------------------------------------------------------------
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM   storage.buckets
ORDER  BY name;

SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM   pg_policies
WHERE  schemaname = 'storage'
ORDER  BY tablename, policyname;

-- Row counts in storage.objects (no row contents are read)
SELECT count(*) AS storage_object_rows FROM storage.objects;


-- ---------------------------------------------------------------------------
-- 7. Migration ledger (Investigation 6) — read-only
-- ---------------------------------------------------------------------------
SELECT version, name
FROM   supabase_migrations.schema_migrations
ORDER  BY version;

SELECT count(*) AS applied_migration_count
FROM   supabase_migrations.schema_migrations;


-- ---------------------------------------------------------------------------
-- 8. Extensions installed (context for the GraphQL / introspection lint family)
-- ---------------------------------------------------------------------------
SELECT extname, extversion
FROM   pg_extension
ORDER  BY extname;


-- ---------------------------------------------------------------------------
-- 9. Session safety guard (optional, read-only)
--    Confirms the session is read-only before any of the above is run.
-- ---------------------------------------------------------------------------
SHOW transaction_read_only;
SELECT current_setting('default_transaction_read_only') AS default_read_only;
