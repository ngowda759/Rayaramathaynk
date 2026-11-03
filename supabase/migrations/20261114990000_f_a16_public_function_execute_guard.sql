-- Migration: F-A16-02b — forward guard against PUBLIC EXECUTE on new `public` functions
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (findings F-A16-02, F-A16-02b and F-A16-07)
-- and docs/audits/F-A16-01_PRIVILEGE_MATRIX.md.
--
-- WHY THIS EXISTS
-- ---------------
-- Postgres grants the implicit `PUBLIC` EXECUTE on every new function, and a
-- *per-schema* `ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` is a
-- documented no-op. The only default-privilege statement that removes it is the GLOBAL
-- form (no `IN SCHEMA`), and F-A16-02 deliberately does not issue a global statement
-- because that would change the defaults for every schema in the database — including
-- the Supabase-managed `storage`, `graphql` and `graphql_public` schemas the remediation
-- must not touch. The 2026-11-03 production audit found **0 global default ACL entries**,
-- so a global statement would only *create* a new global entry.
--
-- This migration closes the same residual without a global statement: an event trigger
-- on `ddl_command_end` that fires for each new function in `public` and revokes EXECUTE
-- from `PUBLIC, anon, authenticated`, while leaving `service_role` executable.
--
-- WHAT IT DOES NOT DO
-- -------------------
-- It does NOT touch existing functions (the audit named two that already carry PUBLIC
-- EXECUTE — `rls_auto_enable` and `update_updated_at_column`; see the review document and
-- the owner-run step for those). It does NOT touch `rls_auto_enable`, `ensure_rls` or any
-- Supabase platform object. It does NOT change any default privilege. It is scoped to
-- `public` only.
--
-- HOW IT WORKS (measured on Postgres / PGlite)
-- --------------------------------------------
-- The guard function is `SECURITY DEFINER`, so it runs with its owner's rights and can
-- revoke on a function created by a different role when its owner can manage that
-- function (true when the owner is a superuser, or is the same role, or is a member).
-- Measured: a `SECURITY DEFINER` guard owned by role `G` revokes EXECUTE on a function
-- created by `G` (which is the normal case — migrations run as `postgres`, which owns the
-- guard); a function created by a role `G` cannot manage raises `must be owner of
-- function`, which aborts the creating transaction — the deliberate fail-closed outcome.
--
-- Ordering: this file sorts *before* `20261115000000_f_a16_least_privilege_defaults.sql`
-- (14990000 < 15000000), so F-A16-02's section 3b can verify the guard is installed, and
-- so any function created by the later F-A16 migrations is covered.
--
-- Idempotent: `CREATE OR REPLACE FUNCTION`, `DROP EVENT TRIGGER IF EXISTS` then `CREATE`.
-- Safe to re-run.
--
-- Rollback:
--   DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard;
--   DROP FUNCTION IF EXISTS public.f_a16_public_fn_guard();

-- ---------------------------------------------------------------------------------
-- 0. Preconditions.
-- ---------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'F-A16-02b: the service_role role is missing'
      USING HINT = 'This migration is written for a Supabase project. The guard keeps service_role executable; without the role there is nothing to preserve.';
  END IF;

  IF NOT pg_catalog.has_schema_privilege(current_user, 'public', 'USAGE') THEN
    RAISE EXCEPTION 'F-A16-02b: current role % cannot see schema public', current_user
      USING HINT = 'The guard only manages objects in public; run it as a role with USAGE (and object-management rights) on public.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 1. The guard function.
-- ---------------------------------------------------------------------------------
-- SECURITY DEFINER so the revoke is performed with the guard owner's rights, which is
-- what lets it act on a function created by the same role (the normal migration case).
-- `search_path = pg_catalog` pins every reference; all identifiers are schema-qualified.
CREATE OR REPLACE FUNCTION public.f_a16_public_fn_guard()
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

    -- Revoke the implicit PUBLIC EXECUTE and the platform's per-schema grant from the
    -- public-facing roles. service_role keeps EXECUTE by design (the seva RPC surface
    -- depends on it — see F-A16-02 §2.5). If the guard owner cannot manage the new
    -- function this RAISES, which aborts the creating transaction: fail closed.
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      cmd.object_identity
    );
  END LOOP;
END;
$$;

-- The guard's own function must not be world-executable either. It is only ever invoked
-- by the event trigger, which runs it as its owner regardless of EXECUTE.
REVOKE EXECUTE ON FUNCTION public.f_a16_public_fn_guard() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------
-- 2. The trigger.
-- ---------------------------------------------------------------------------------
DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard;

CREATE EVENT TRIGGER f_a16_public_fn_guard
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
  EXECUTE FUNCTION public.f_a16_public_fn_guard();

-- ---------------------------------------------------------------------------------
-- 3. Post-condition — verify, do not assume.
-- ---------------------------------------------------------------------------------
-- The trigger must be installed and enabled, and the guard function must not carry
-- PUBLIC/anon/authenticated EXECUTE. A silently-missing trigger would leave every future
-- function world-executable, so this refuses to commit.
DO $$
DECLARE
  enabled boolean;
  public_exec boolean;
BEGIN
  SELECT (e.evtenabled IN ('O', 'A'))
    INTO enabled
    FROM pg_catalog.pg_event_trigger e
   WHERE e.evtname = 'f_a16_public_fn_guard';

  IF enabled IS NULL THEN
    RAISE EXCEPTION 'F-A16-02b: the forward function-EXECUTE guard was not installed';
  END IF;

  IF NOT enabled THEN
    RAISE EXCEPTION 'F-A16-02b: the forward function-EXECUTE guard is installed but disabled';
  END IF;

  SELECT pg_catalog.has_function_privilege('anon', 'public.f_a16_public_fn_guard()', 'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated', 'public.f_a16_public_fn_guard()', 'EXECUTE')
    INTO public_exec;

  IF public_exec THEN
    RAISE EXCEPTION 'F-A16-02b: the guard function itself is executable by a public-facing role';
  END IF;
END $$;
