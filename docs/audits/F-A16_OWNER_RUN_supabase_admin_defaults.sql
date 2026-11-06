-- =====================================================================================
-- F-A16-02 — OWNER-RUN STEP for default privileges of roles the migration could not
--            act for (in practice `supabase_admin`).
--
-- Status: exists and is fully tested locally (unit + PGlite). NOT EXECUTED
--         against production. PRODUCTION APPLICATION PENDING.
--         Owner action, gated on review.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- Default privileges belong to the role that will *create* the object, not to the
-- schema. `ALTER DEFAULT PRIVILEGES FOR ROLE x` may only be issued by a member of `x`
-- (or by a superuser). On a Supabase project the object-creating roles are at least
-- `postgres` and `supabase_admin`, and objects created by `supabase_admin` carry a
-- separate default ACL that a migration running as `postgres` cannot change unless
-- `postgres` happens to be a member of `supabase_admin`.
--
-- `supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql` covers the
-- applying role and then enumerates the remaining candidate creators from TWO catalog
-- sources — every `pg_default_acl` row for `public` (no grantee filter), plus every role
-- with `CREATE` on `public` (which catches a creator that has no default-ACL row of its
-- own but still confers the implicit PUBLIC EXECUTE on functions it creates). If it
-- finds a creator it cannot act for, it raises and rolls back, and its hint points here.
-- That is deliberate: F-A16-02 must not be described as remediated while a role was
-- skipped.
--
-- Run this file ONLY if the migration reported that it could not cover a role. Run it
-- as that role (or as a superuser) so the statements take effect for the right owner.
-- Then re-run the migration, whose post-condition check will confirm coverage.
--
-- Everything below is a REVOKE on *default* privileges. No existing table, sequence,
-- function, policy or grant is touched. Idempotent: revoking an unheld privilege is a
-- no-op, so this is safe to re-run.
--
-- NOTE ON FUNCTIONS (F-A16-02 correction, 2026-11-03). The main migration no longer
-- issues the GLOBAL function revoke (`ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON
-- FUNCTIONS FROM PUBLIC`, no `IN SCHEMA`), because the 2026-11-03 production audit found
-- 0 global default ACL entries and a global statement would change the defaults for every
-- schema — including storage/graphql/graphql_public. The implicit PUBLIC EXECUTE on
-- future functions is instead closed forward by
-- `supabase/migrations/20261114990000_f_a16_public_function_execute_guard.sql`. The
-- per-role steps below therefore only revoke the platform's explicit per-schema
-- `GRANT ALL ON FUNCTIONS` to anon/authenticated — they do NOT issue a global statement.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0. Identify the creators that still hold broad defaults for public-facing roles.
--    Run this first. If it returns nothing, nothing here is needed.
--
--    Two sources, because one is not an inventory:
--      (a) every `pg_default_acl` row for `public` — NOT filtered by grantee, so a role
--          whose row names only some other grantee is still seen;
--      (b) every role that EFFECTIVELY holds CREATE on `public` — via
--          `has_schema_privilege`, which accounts for inheritance through membership and
--          for a CREATE granted to PUBLIC. A direct `aclexplode(nspacl)` join would miss
--          both. Such a role can create a function, which carries the implicit PUBLIC
--          EXECUTE, so it must be covered.
-- -------------------------------------------------------------------------------------
SELECT DISTINCT candidate AS candidate_creator,
       why,
       pg_catalog.pg_has_role(current_user, candidate, 'MEMBER')
         AS can_act_from_current_session
  FROM (
    SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS candidate,
           'has a public default ACL' AS why
      FROM pg_catalog.pg_default_acl d
     WHERE d.defaclnamespace = 'public'::regnamespace
    UNION
    SELECT r.rolname AS candidate,
           'effectively holds CREATE in public' AS why
      FROM pg_catalog.pg_roles r
     WHERE pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE')
  ) c
 WHERE candidate <> 'pg_database_owner'   -- pseudo-role; owns the schema, creates nothing
 ORDER BY 1;

-- -------------------------------------------------------------------------------------
-- 1. Repeat the tightening for each role the migration could not cover.
--
--    `target` is a literal here, not read from the catalog, so this file is safe to
--    paste into the Supabase SQL editor (which runs a single statement per editor tab
--    unless wrapped). Change the literal if step 0 named a different role. If it names
--    several, run this block once per role.
--
--    Run this block while connected as that role, or as a superuser.
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  target constant text := 'supabase_admin';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = target) THEN
    RAISE NOTICE 'F-A16-02: role % does not exist; nothing to do', target;
    RETURN;
  END IF;

  IF NOT pg_catalog.pg_has_role(current_user, target, 'MEMBER') THEN
    RAISE EXCEPTION 'F-A16-02: current role % may not change default privileges for %',
      current_user, target
      USING HINT = 'Reconnect as that role, or as a superuser, and run this block again.';
  END IF;

  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', target);
  -- Per-schema only. The GLOBAL function revoke (`FOR ROLE %I REVOKE EXECUTE ON
  -- FUNCTIONS FROM PUBLIC`, no IN SCHEMA) was removed: it changes the default for every
  -- schema and the audit found 0 global entries. The implicit PUBLIC EXECUTE on future
  -- functions is closed forward by 20261114990000_f_a16_public_function_execute_guard.sql.
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated', target);

  RAISE NOTICE 'F-A16-02: default privileges tightened for %', target;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. Verify. Expect no rows.
-- -------------------------------------------------------------------------------------
-- The function arm checks for a DIRECT grant to a named public-facing role only. A
-- per-schema PUBLIC function entry (grantee = 0) is deliberately NOT flagged: it cannot
-- be removed by a per-schema statement, and it is closed forward by the function-EXECUTE
-- guard migration — not by a global default revoke.
SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS object_creating_role,
       d.defaclobjtype                          AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
  FROM pg_catalog.pg_default_acl d,
       pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 'public'::regnamespace
   AND (
        (d.defaclobjtype IN ('r', 'S')
          AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
     OR (d.defaclobjtype = 'r'
          AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
          AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES'))
     OR (d.defaclobjtype = 'f'
          AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
   )
 ORDER BY 1, 2, 3, 4;

-- 2b. Global (defaclnamespace = 0) function default ACLs that name a named public-facing
--     role. Expect no rows. The 2026-11-03 audit found 0 global entries. A global PUBLIC
--     (grantee = 0) function entry is deliberately NOT flagged here: the corrected
--     remediation does not remove it with a global statement (that would change every
--     schema); it is closed forward by the function-EXECUTE guard migration. Note
--     `grantee = 0` must be tested explicitly if you do want to see PUBLIC entries:
--     `pg_get_userbyid(0)` returns 'unknown (OID=0)', not NULL, so an IN-list never
--     matches PUBLIC.
SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS object_creating_role,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
  FROM pg_catalog.pg_default_acl d,
       pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 0
   AND d.defaclobjtype = 'f'
   AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')
 ORDER BY 1, 2, 3;

-- 2c. Global (defaclnamespace = 0) TABLE and SEQUENCE default ACLs that name a
--     public-facing role or PUBLIC. Expect no rows. These are the ones a schema-scoped
--     REVOKE cannot subtract (measured on PGlite), so a residue here is the reason the
--     main migration stopped at its section 0b precondition.
SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS object_creating_role,
       CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
  FROM pg_catalog.pg_default_acl d,
       pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 0
   AND d.defaclobjtype IN ('r', 'S')
   AND (a.grantee = 0
        OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
 ORDER BY 1, 2, 3, 4;

-- -------------------------------------------------------------------------------------
-- 3. Rollback — restore the platform defaults for this role.
--    The counterpart of step 1; run only if the change must be undone.
-- -------------------------------------------------------------------------------------
-- DO $$
-- DECLARE
--   target constant text := 'supabase_admin';
-- BEGIN
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role', target);
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role', target);
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role', target);
-- END $$;

-- =====================================================================================
-- 4. GLOBAL table/sequence defaults — OWNER-REVIEWED, affects EVERY schema.
--
--    Run this ONLY if the main migration stopped at its section 0b precondition, which
--    means a GLOBAL default still grants future tables or sequences to a public-facing
--    role. A schema-scoped REVOKE cannot subtract such a grant, so it must be removed
--    with the global form (no `IN SCHEMA`).
--
--    ⚠️  READ THIS BEFORE RUNNING. The global form changes default privileges for objects
--    created in EVERY schema of the database, not only `public`. That is a broader blast
--    radius than F-A16-02 and it is why the main migration refuses to do it
--    automatically. Before running:
--
--      1. run the step 2c query above to see exactly which global entries exist;
--      2. confirm none of them is relied on by a platform-managed schema. If any is,
--         STOP — this is not the right remedy and needs a design discussion, not a
--         script. A per-schema GRANT can be re-added for a schema that genuinely needs it.
--      3. run it in a transaction, verify, then commit — or roll back if unsure.
--
--    service_role is NOT a public-facing role, and the main migration deliberately keeps its
--    DML defaults. But it revokes TRUNCATE, TRIGGER and REFERENCES from service_role per
--    schema (RLS cannot cover those three), and a GLOBAL grant of any survives that revoke —
--    measured: after the per-schema revoke a new public table still reported them as true.
--    Step 4 therefore removes them globally too. DML is left alone.
--
--    Note the asymmetry with functions. The corrected main migration does NOT revoke the
--    function default globally — it issues no global statement at all. For functions the
--    implicit PUBLIC EXECUTE is closed forward by
--    `20261114990000_f_a16_public_function_execute_guard.sql`, which is scoped to `public`
--    and therefore narrower than a global default change. For tables and sequences there
--    is no implicit PUBLIC grant — a PUBLIC entry exists only if someone created one — so
--    this step is narrower in motivation still, and is left to explicit owner review.
-- =====================================================================================
-- DO $$
-- DECLARE
--   -- Set to the creator whose global defaults are leaking (see step 2c).
--   target constant text := 'supabase_admin';
-- BEGIN
--   IF NOT pg_catalog.pg_has_role(current_user, target, 'MEMBER') THEN
--     RAISE EXCEPTION 'F-A16-02: current role % may not change default privileges for %', current_user, target
--       USING HINT = 'Run as that role, or as a superuser.';
--   END IF;
--
--   -- GLOBAL form: no `IN SCHEMA`. Affects every schema in the database.
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES    FROM anon, authenticated', target);
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES    FROM PUBLIC', target);
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM anon, authenticated', target);
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM PUBLIC', target);
--   -- service_role keeps DML, but these two survive the schema-scoped revoke in the main
--   -- migration and must be removed globally as well.
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role', target);
--
--   RAISE NOTICE 'F-A16-02: global table/sequence defaults tightened for %', target;
-- END $$;
--
-- Rollback of step 4 (restores the global defaults; again affects every schema):
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT ALL ON TABLES    TO anon, authenticated, service_role', target);
--   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT ALL ON SEQUENCES TO anon, authenticated, service_role', target);

-- 4b. Verify step 4 took effect for the three service_role privileges. Expect no rows.
--     A global TRUNCATE/TRIGGER/REFERENCES entry here means a future public table can still
--     be truncated, altered to attach a trigger, or referenced by a foreign key, by
--     service_role — exactly what section 1's schema-scoped revoke was meant to prevent.
SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS object_creating_role,
       a.privilege_type
  FROM pg_catalog.pg_default_acl d,
       pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 0
   AND d.defaclobjtype = 'r'
   AND a.grantee <> d.defaclrole
   AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
   AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
 ORDER BY 1, 2;
