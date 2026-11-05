-- =====================================================================================
-- F-A16-02b — OWNER-RUN STEP: superuser-owned forward guard for functions that
--             `supabase_admin` creates in `public`.
--
-- Status: PROPOSED. NOT APPLIED. NOT EXECUTED. Owner action, gated on review.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- `supabase/migrations/20261114990000_f_a16_public_function_execute_guard.sql` installs a
-- forward guard owned by `postgres`. On a Supabase project `supautils` installs an `fmgr`
-- hook (supabase/supautils, `src/supautils.c`, `supautils_fmgr_hook`) that turns an
-- event-trigger function into a no-op when the role running the DDL does not match the
-- function's owner class. One of its rules: if the executing role is a **superuser** and
-- the event-trigger function is **not superuser-owned**, it is skipped. `supabase_admin`
-- is the only superuser, so a `CREATE FUNCTION` it runs does NOT fire the `postgres`-owned
-- guard. The implicit `PUBLIC` EXECUTE then survives.
--
-- The gap is REACHABLE, not theoretical: on a fresh Supabase database `anon` and
-- `authenticated` hold `USAGE` on `public`, so a `SECURITY DEFINER` function that
-- `supabase_admin` creates there (with no explicit grant) can be invoked as `anon` or
-- `authenticated` through PostgREST. Measured 2026-11-04; see
-- docs/audits/F-A16_INTEGRATION_VERIFICATION.md §9.
--
-- CLOSURE. Because the executing role is a superuser, the guard function must ALSO be
-- superuser-owned, and the trigger must be owned by the same superuser. `postgres` cannot
-- create that: `SET ROLE supabase_admin` is denied, and an event trigger's owner must be a
-- superuser (`ALTER EVENT TRIGGER … OWNER TO` is denied too). So this is an owner-run step.
--
-- Run this file as `supabase_admin` (or another superuser that owns both the function and
-- the trigger). It uses only `CREATE OR REPLACE FUNCTION`, `REVOKE … ON FUNCTION` (the
-- guard's own function) and `CREATE EVENT TRIGGER` — no default privilege is changed, and
-- no existing user object is touched. The one `REVOKE … ON ROUTINE` inside the guard body
-- runs only for functions created *after* this guard is installed.
--
-- This file deliberately does NOT install any `ALTER DEFAULT PRIVILEGES`. Default
-- privileges for `supabase_admin` are handled by the sibling file
-- `F-A16_OWNER_RUN_supabase_admin_defaults.sql`. Keeping them separate keeps each file's
-- "changes only X" invariant checkable.
--
-- Existing objects: functions `supabase_admin` created BEFORE this guard was installed
-- still carry PUBLIC EXECUTE. Step 3 lists them (read-only). They are remediated by the
-- F-A16-07 existing-object step (docs/audits/F-A16_REMEDIATION_PLAN.md §12), not here.
--
-- Idempotent: `CREATE OR REPLACE FUNCTION`, `DROP EVENT TRIGGER IF EXISTS` then `CREATE`.
-- Safe to re-run.
--
-- Rollback:
--   DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su;
--   DROP FUNCTION IF EXISTS public.f_a16_public_fn_guard_su();
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. The superuser-owned guard function. Same body as the migration's guard.
--    SECURITY DEFINER so the revoke runs with the owner's rights (a superuser's);
--    `search_path = pg_catalog` pins every reference, and every identifier is qualified.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_a16_public_fn_guard_su()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
      FROM pg_event_trigger_ddl_commands()
     WHERE command_tag IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
       AND object_type IN ('function', 'procedure')
  LOOP
    CONTINUE WHEN cmd.schema_name IS NULL OR cmd.schema_name <> 'public';

    -- `ON ROUTINE`, not `ON FUNCTION`: a procedure is not a function.
    EXECUTE format(
      'REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC, anon, authenticated',
      cmd.object_identity
    );

    -- Fail closed: a REVOKE the owner may not perform only WARNS, so re-read the
    -- effective privilege and abort the creating transaction if the grant survived.
    IF pg_catalog.has_function_privilege('anon', cmd.object_identity, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', cmd.object_identity, 'EXECUTE')
    THEN
      RAISE EXCEPTION
        'F-A16-02b(su): could not revoke EXECUTE on % from anon/authenticated; the guard owner cannot manage the routine',
        cmd.object_identity;
    END IF;
  END LOOP;
END;
$$;

-- The guard's own function must not be world-executable either.
REVOKE EXECUTE ON FUNCTION public.f_a16_public_fn_guard_su() FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 2. The superuser-owned trigger.
-- -------------------------------------------------------------------------------------
DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su;

CREATE EVENT TRIGGER f_a16_public_fn_guard_su
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
  EXECUTE FUNCTION public.f_a16_public_fn_guard_su();

-- -------------------------------------------------------------------------------------
-- 2b. Post-condition — verify, do not assume. The trigger must exist, be enabled, and be
--     owned by a superuser (otherwise supautils will skip it for a superuser creator).
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  trg record;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(e.evtowner) AS owner,
         (e.evtenabled IN ('O', 'A'))           AS enabled
    INTO trg
    FROM pg_catalog.pg_event_trigger e
   WHERE e.evtname = 'f_a16_public_fn_guard_su';

  IF trg IS NULL THEN
    RAISE EXCEPTION 'F-A16-02b(su): the superuser-owned guard was not installed';
  END IF;
  IF NOT trg.enabled THEN
    RAISE EXCEPTION 'F-A16-02b(su): the superuser-owned guard is installed but disabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = trg.owner AND rolsuper) THEN
    RAISE EXCEPTION 'F-A16-02b(su): guard owner % is not a superuser; supautils will skip it for a superuser creator', trg.owner;
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 3. Verification (read-only). Functions in `public` that are STILL executable by
--    anon/authenticated. After step 1 these can only be functions created BEFORE the
--    guard existed. Expect no rows once the F-A16-07 existing-object step has run.
-- -------------------------------------------------------------------------------------
SELECT p.oid::regprocedure                        AS function_still_world_executable,
       pg_catalog.pg_get_userbyid(p.proowner)     AS owner,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind IN ('f', 'p')
   AND (pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
        OR pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'))
 ORDER BY 1;

-- -------------------------------------------------------------------------------------
-- 4. Functional check (run interactively as `supabase_admin`). Expect anon=false
--    auth=false. Commented so this file stays an install + read-only verification script.
-- -------------------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.f_a16_su_probe() RETURNS int LANGUAGE sql AS 'SELECT 1';
-- SELECT pg_catalog.has_function_privilege('anon', 'public.f_a16_su_probe()', 'EXECUTE')          AS anon,
--        pg_catalog.has_function_privilege('authenticated', 'public.f_a16_su_probe()', 'EXECUTE') AS authenticated;
-- DROP FUNCTION public.f_a16_su_probe();
