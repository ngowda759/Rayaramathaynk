-- =====================================================================================
-- F-A16-02 — OWNER-RUN STEP for default privileges of roles the migration could not
--            act for (in practice `supabase_admin`).
--
-- Status: PROPOSED. NOT APPLIED. NOT EXECUTED. Owner action, gated on review.
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
-- applying role and then enumerates the remaining owners from `pg_default_acl`. If it
-- finds an owner it cannot act for, it raises and rolls back, and its hint points here.
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
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0. Identify the owners that still hold broad defaults for public-facing roles.
--    Run this first. If it returns nothing, nothing here is needed.
-- -------------------------------------------------------------------------------------
SELECT DISTINCT pg_catalog.pg_get_userbyid(d.defaclrole) AS object_creating_role,
       pg_catalog.pg_has_role(current_user, pg_catalog.pg_get_userbyid(d.defaclrole), 'MEMBER')
         AS can_act_from_current_session
  FROM pg_catalog.pg_default_acl d
 WHERE d.defaclnamespace = 'public'::regnamespace
   AND d.defaclacl::text ~ '(^|[,{])(anon|authenticated|service_role)='
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
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated', target);

  RAISE NOTICE 'F-A16-02: default privileges tightened for %', target;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. Verify. Expect no rows.
-- -------------------------------------------------------------------------------------
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
          AND a.privilege_type IN ('TRIGGER', 'REFERENCES'))
     OR (d.defaclobjtype = 'f'
          AND (a.grantee = 0
               OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
   )
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
