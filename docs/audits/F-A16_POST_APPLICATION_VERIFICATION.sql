-- ---------------------------------------------------------------------------
-- F-A16 — Production Post-Application Verification (READ-ONLY)
-- ---------------------------------------------------------------------------
-- Purpose
-- -------
-- Reproduces the evidence recorded in
-- docs/audits/F-A16_PRODUCTION_VERIFICATION_2026-11-06.md: after the F-A16 migrations
-- were applied to production, confirm the intended privilege changes took effect and
-- that the application surface is intact.
--
-- SAFETY
-- ------
-- This file contains ONLY SELECT statements. It issues no DDL, DML, GRANT, REVOKE or
-- ALTER. Run it in a read-only session; §0 asserts that the session is read-only before
-- anything else and you should stop if it reports otherwise.
--
-- Approved production project: kvrkraqjuyxbraccxntk
-- Reproduce: paste into the SQL editor, or run through a read-only client.
--
-- Expected results are stated per section. A FAIL is evidence, not authorization to
-- change production: report it, do not "fix" it here.
-- ---------------------------------------------------------------------------


-- §0. Session safety guard — prove read-only BEFORE anything else.
-- Expect: transaction_read_only = on, default_transaction_read_only = on.
-- If either is off, STOP and re-establish a read-only session.
SELECT current_setting('transaction_read_only')       AS transaction_read_only,
       current_setting('default_transaction_read_only') AS default_transaction_read_only,
       current_user                                    AS connected_role,
       current_database()                              AS database,
       current_setting('server_version')               AS server_version;


-- ---------------------------------------------------------------------------
-- §1. Item 1 — anon / authenticated EXECUTE on the two target functions
-- ---------------------------------------------------------------------------
-- Expect: anon_can_execute = false, authenticated_can_execute = false for both rows;
--         service_role_can_execute = true and owner_can_execute = true.
SELECT p.oid::regprocedure                                AS signature,
       pg_catalog.pg_get_userbyid(p.proowner)             AS owner,
       p.prosecdef                                        AS security_definer,
       p.proacl::text                                     AS raw_acl,
       pg_catalog.has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       pg_catalog.has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can_execute,
       pg_catalog.has_function_privilege(pg_catalog.pg_get_userbyid(p.proowner),
                                         p.oid, 'EXECUTE') AS owner_can_execute
FROM   pg_catalog.pg_proc p
WHERE  p.oid IN (pg_catalog.to_regprocedure('public.rls_auto_enable()'),
                 pg_catalog.to_regprocedure('public.update_updated_at_column()'))
ORDER  BY signature;

-- Sweep: no OTHER public function should be executable by anon or authenticated either.
-- Expect: 0 rows.
SELECT p.oid::regprocedure                                 AS signature,
       pg_catalog.has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM   pg_catalog.pg_proc p
JOIN   pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND (pg_catalog.has_function_privilege('anon',          p.oid, 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER  BY 1;

-- Implicit PUBLIC EXECUTE residue on public functions (ACL entry with grantee = 0).
-- Expect: 0.
SELECT count(*) AS public_functions_with_public_execute
FROM   pg_catalog.pg_proc p
JOIN   pg_catalog.pg_namespace n ON n.oid = p.pronamespace
CROSS  JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
WHERE  n.nspname = 'public'
  AND  a.grantee = 0;


-- ---------------------------------------------------------------------------
-- §2. Item 3 — public default privileges per grantee
-- ---------------------------------------------------------------------------
-- Expect: rows ONLY for owner_role = 'postgres' (its tightened, owner-only defaults are
--         filtered out below because the owner self-entry is excluded). Any row with
--         owner_role = 'supabase_admin' is the documented R-1 residual: report it, do
--         not attempt to change it from the customer role (it will be denied).
SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner_role,
       d.defaclobjtype                          AS object_type,  -- r=table S=sequence f=function
       CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
FROM   pg_catalog.pg_default_acl d
CROSS  JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
WHERE  d.defaclnamespace = 'public'::regnamespace
  AND  a.grantee <> d.defaclrole          -- the owner's own entry is inherent, not a leak
ORDER  BY 1, 2, 3, 4;

-- Raw public default ACLs, by owner (context for the row above).
SELECT pg_catalog.pg_get_userbyid(defaclrole) AS owner_role,
       defaclobjtype                          AS object_type,
       defaclacl::text                        AS default_acl
FROM   pg_catalog.pg_default_acl
WHERE  defaclnamespace = 'public'::regnamespace
ORDER  BY 1, 2;

-- Global (all-schema) default ACLs. Expect: owner-only entries, nothing public-facing.
SELECT pg_catalog.pg_get_userbyid(defaclrole) AS owner_role,
       defaclobjtype                          AS object_type,
       defaclacl::text                        AS default_acl
FROM   pg_catalog.pg_default_acl
WHERE  defaclnamespace = 0
ORDER  BY 1, 2;

-- Can the connected role act for each public default-ACL owner? (Explains R-1.)
SELECT DISTINCT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner_role,
       pg_catalog.pg_has_role(current_user, d.defaclrole, 'MEMBER') AS applier_may_act_for_it
FROM   pg_catalog.pg_default_acl d
WHERE  d.defaclnamespace = 'public'::regnamespace
ORDER  BY 1;

-- Ownership census: which roles own objects in public? (R-1 reachability.)
SELECT pg_catalog.pg_get_userbyid(c.relowner) AS owner,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned_table'
                      WHEN 'S' THEN 'sequence' WHEN 'v' THEN 'view'
                      WHEN 'm' THEN 'materialized_view' ELSE c.relkind::text END AS object_type,
       count(*) AS objects
FROM   pg_catalog.pg_class c
JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
GROUP  BY 1, 2
ORDER  BY 1, 2;


-- ---------------------------------------------------------------------------
-- §3. Item 4 — application surface intact (tables, RLS, policies, functions, triggers)
-- ---------------------------------------------------------------------------
-- Expect (2026-11-06 reference): tables 67, rls_enabled 67, policies 81,
-- functions 89, triggers 52.
SELECT (SELECT count(*) FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')) AS public_tables,
       (SELECT count(*) FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity) AS rls_enabled,
       (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public') AS public_policies,
       (SELECT count(*) FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public') AS public_functions,
       (SELECT count(*) FROM pg_catalog.pg_trigger t
          JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS public_triggers;

-- F-A16-01 residue: no TRUNCATE / REFERENCES / TRIGGER for a public-facing role.
-- Expect: 0 rows.
SELECT grantee, privilege_type, count(*) AS tables
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public'
  AND  grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  AND  privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
GROUP  BY 1, 2
ORDER  BY 1, 2;

-- Event triggers — the F-A16 guards and the platform's own, all enabled.
-- Expect: f_a16_public_fn_guard, f_a16_assert_public_rls present with evtenabled = 'O'.
SELECT evtname,
       evtevent,
       evtenabled,                                  -- O = enabled
       evtfoid::regprocedure  AS function_called,
       pg_catalog.pg_get_userbyid(evtowner) AS owner
FROM   pg_catalog.pg_event_trigger
ORDER  BY evtname;

-- Guard hardening: SECURITY DEFINER and a pinned search_path on the F-A16 functions.
SELECT p.oid::regprocedure                       AS signature,
       p.prosecdef                               AS security_definer,
       p.proconfig                               AS function_settings,
       pg_catalog.pg_get_userbyid(p.proowner)    AS owner
FROM   pg_catalog.pg_proc p
JOIN   pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE  n.nspname = 'public'
  AND  p.proname IN ('f_a16_public_fn_guard', 'f_a16_assert_public_rls', 'rls_auto_enable')
ORDER  BY signature;

-- Full definition of the forward guard, so the installed body can be compared to the
-- repository file (a catalog read; the function is NOT executed).
SELECT pg_catalog.pg_get_functiondef(
         pg_catalog.to_regprocedure('public.f_a16_public_fn_guard()')) AS function_definition;


-- ---------------------------------------------------------------------------
-- §4. Item 5 — migration ledger
-- ---------------------------------------------------------------------------
-- Expect: all five F-A16 versions present.
SELECT version, name
FROM   supabase_migrations.schema_migrations
WHERE  version LIKE '202611%'
ORDER  BY version;

SELECT count(*) AS applied_migration_count
FROM   supabase_migrations.schema_migrations;
