-- Migration: F-A16-07 — revoke EXECUTE on the two existing world-executable functions
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-07),
-- docs/audits/F-A16_EXECUTION_CHECKLISTS.md (preflight / post-execution / rollback) and
-- docs/audits/F-A16_INTEGRATION_VERIFICATION.md.
--
-- WHAT THIS CHANGES
-- -----------------
-- Postgres grants the implicit `PUBLIC` EXECUTE on every function, and the platform's
-- per-schema `GRANT ALL ON FUNCTIONS` adds a direct `anon`/`authenticated` grant on top.
-- The forward guard (`20261114990000_f_a16_public_function_execute_guard.sql`) closes that
-- for functions created *after* it is installed, but it cannot retro-fit functions that
-- already existed. The 2026-11-05 read-only production inventory found exactly two
-- `public` functions still executable by `anon`/`authenticated`:
--
--   * `public.rls_auto_enable()` — the Supabase platform RLS auto-enable function, invoked
--     by the `ensure_rls` DDL event trigger. `SECURITY DEFINER`, `search_path = pg_catalog`.
--     It is never called directly by a client; the event trigger invokes it.
--   * `public.update_updated_at_column()` — a repo-created `SECURITY INVOKER` trigger
--     function used by the `update_updated_at` triggers on many tables. A trigger fires as
--     the function owner regardless of EXECUTE, so no client needs EXECUTE on it.
--
-- This migration revokes EXECUTE on each of them from `PUBLIC`, `anon` and `authenticated`,
-- and from nothing else:
--
--   * `service_role` KEEPS EXECUTE — the server-side application calls functions through
--     `createAdminClient()`, and the inventory records `service_role = true` as the
--     intended state. This migration must not revoke it.
--   * `postgres` (the owner) KEEPS EXECUTE — an owner always retains it.
--
-- WHY THIS IS SAFE FOR TRIGGERS AND EVENT TRIGGERS
-- ------------------------------------------------
-- EXECUTE privilege is not checked when a trigger or event-trigger function is invoked:
-- PostgreSQL runs the function as the trigger's owner. Revoking EXECUTE therefore removes
-- the client-reachable surface without affecting the `update_updated_at` triggers (which
-- call `update_updated_at_column()`) or the `ensure_rls` event trigger (which calls
-- `rls_auto_enable()`). This migration does NOT drop, recreate, rename, alter or re-own
-- either function, and it does NOT touch any trigger or event trigger.
--
-- SCOPE
-- -----
-- Two named functions in `public`, and nothing else. No table, sequence, view, policy,
-- default privilege, trigger or event trigger is changed. It never references `auth.*`,
-- `storage.*`, `graphql*` or any other schema, and it does not touch the platform-managed
-- `storage` defaults.
--
-- IDEMPOTENT: every statement is a `REVOKE`, and revoking an unheld privilege is a no-op.
-- Re-running is safe.
--
-- FAIL CLOSED: a precondition confirms both functions and the required roles are present;
-- the post-condition re-reads the effective privilege and raises (rolling the migration
-- back) if `anon`/`authenticated` can still execute either function, or if `service_role`
-- or the owner lost it. Nothing is left half-applied.

-- ---------------------------------------------------------------------------------
-- 0. Preconditions — fail loudly, never partially.
-- ---------------------------------------------------------------------------------
DO $$
DECLARE
  missing_roles text;
  missing_fns   text[] := ARRAY[]::text[];
  sig           text;
BEGIN
  SELECT string_agg(r, ', ')
    INTO missing_roles
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = r);

  IF missing_roles IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-07: required Supabase roles are missing: %', missing_roles
      USING HINT = 'This migration is written for a Supabase project. Do not run it against a database without these roles.';
  END IF;

  -- Both target functions must exist. A missing one means the target is not the expected
  -- project (or the platform renamed the enabler), which is a reason to stop, not to skip.
  FOREACH sig IN ARRAY ARRAY['public.rls_auto_enable()', 'public.update_updated_at_column()'] LOOP
    IF pg_catalog.to_regprocedure(sig) IS NULL THEN
      missing_fns := missing_fns || sig;
    END IF;
  END LOOP;

  IF array_length(missing_fns, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-07: expected function(s) not found: %', array_to_string(missing_fns, ', ')
      USING HINT = 'This migration revokes EXECUTE on two specific existing functions. A missing target means the database is not the expected project, or the platform renamed rls_auto_enable(). Confirm the target before re-running; do not drop this check.';
  END IF;

  RAISE NOTICE 'F-A16-07: revoking EXECUTE from PUBLIC, anon, authenticated on 2 public function(s)';
END $$;

-- ---------------------------------------------------------------------------------
-- 1. Revoke EXECUTE from PUBLIC, anon and authenticated — and nothing else.
-- ---------------------------------------------------------------------------------
-- `service_role` and the owner (`postgres`) keep EXECUTE. Written as literal, fully
-- qualified signatures so the target set is explicit and cannot drift.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------
-- 2. Post-condition — verify, do not assume.
-- ---------------------------------------------------------------------------------
-- A REVOKE a role may not perform only WARNS (`no privileges could be revoked`) instead
-- of raising, so re-read the EFFECTIVE privilege. `has_function_privilege` accounts for
-- the implicit `PUBLIC` EXECUTE as well as any direct grant, so an `anon`/`authenticated`
-- result of `false` proves the function is not world-executable by either route.
-- The owner keeps EXECUTE, and `service_role` must still have it.
DO $$
DECLARE
  target      record;
  offenders   text[] := ARRAY[]::text[];
  svc_missing text[] := ARRAY[]::text[];
BEGIN
  FOR target IN
    SELECT * FROM (VALUES ('public.rls_auto_enable()'),
                          ('public.update_updated_at_column()')) AS t(sig)
  LOOP
    IF pg_catalog.has_function_privilege('anon', target.sig, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', target.sig, 'EXECUTE')
    THEN
      offenders := offenders || target.sig;
    END IF;

    IF NOT pg_catalog.has_function_privilege('service_role', target.sig, 'EXECUTE') THEN
      svc_missing := svc_missing || target.sig;
    END IF;
  END LOOP;

  IF array_length(offenders, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-07: function(s) still executable by anon/authenticated: %', array_to_string(offenders, ', ')
      USING HINT = 'The revoke did not take effect. Confirm the applying role owns the function (a non-owner REVOKE only warns). Investigate before re-running; do not weaken this check.';
  END IF;

  IF array_length(svc_missing, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-07: function(s) lost EXECUTE for service_role: %', array_to_string(svc_missing, ', ')
      USING HINT = 'service_role must keep EXECUTE (the server-side application calls functions through createAdminClient()). This migration must not revoke it; investigate the privilege state before re-running.';
  END IF;

  RAISE NOTICE 'F-A16-07: rls_auto_enable() and update_updated_at_column() are no longer executable by anon/authenticated; service_role and the owner keep EXECUTE.';
END $$;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- Restores the pre-migration over-grant exactly (this is the point of a rollback):
-- GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC, anon, authenticated;
