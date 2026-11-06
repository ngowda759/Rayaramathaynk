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
-- already existed. The 2026-11-03 catalog audit (attested evidence — see the provenance
-- note below) identified exactly two `public` functions executable by
-- `anon`/`authenticated`:
--
--   * `public.rls_auto_enable()` — the Supabase platform RLS auto-enable function, invoked
--     by the `ensure_rls` DDL event trigger. `SECURITY DEFINER`, `search_path = pg_catalog`.
--     It is never called directly by a client; the event trigger invokes it. Its OWNER is
--     NOT established from repository evidence: the repository carries contradictory
--     assumptions (`postgres` in F-A15.1; `supabase_admin` in the F-A16 preflight), and no
--     production catalog read has confirmed it. The ownership precondition below does not
--     assume either — it reads the actual owner at apply time.
--   * `public.update_updated_at_column()` — a repo-created `SECURITY INVOKER` trigger
--     function used by the `update_updated_at` triggers on many tables. A trigger fires as
--     the function owner regardless of EXECUTE, so no client needs EXECUTE on it.
--
-- This migration revokes EXECUTE on each of them from `PUBLIC`, `anon` and `authenticated`,
-- and from nothing else:
--
--   * `service_role` KEEPS EXECUTE — the server-side application calls functions through
--     `createAdminClient()`, and the audit records `service_role = true` as the intended
--     state. This migration must not revoke it.
--   * the OWNER (whoever it is) KEEPS EXECUTE — an owner always retains it.
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
-- `storage` defaults. It revokes EXECUTE on exactly these two functions — there is no
-- wildcard, no `ALL FUNCTIONS IN SCHEMA`, and no default-privilege statement.
--
-- PROVENANCE OF THE TARGET LIST (evidence layers — do not conflate)
-- -----------------------------------------------------------------
--   * ATTESTED (2026-11-03 catalog audit): exactly two `public` functions carry
--     `PUBLIC`/`anon`/`authenticated` EXECUTE — `rls_auto_enable`, `update_updated_at_column`.
--     This figure comes from a prior audit record; it was NOT re-measured here. There is NO
--     "2026-11-05 read-only production inventory": no such run, artifact or commit exists.
--   * LOCAL INTEGRATION (this repository): the revoke behaviour, the ownership precondition
--     and the trigger-safety are demonstrated on a disposable `supabase/postgres:15.19.0.018`
--     container — see docs/audits/F-A16_INTEGRATION_VERIFICATION.md.
--   * UNRESOLVED (production): the OWNER of `rls_auto_enable()` is not established from
--     repository evidence (contradictory assumptions; no confirming catalog read). The
--     ownership precondition below resolves it at apply time rather than assuming it.
--
-- IDEMPOTENT: every statement is a `REVOKE`, and revoking an unheld privilege is a no-op.
-- Re-running is safe.
--
-- FAIL CLOSED ON OWNERSHIP FIRST (the ownership precondition). `REVOKE` on a routine the
-- executing role does not own does NOT raise — PostgreSQL only emits
-- `WARNING: no privileges could be revoked` and leaves the routine world-executable
-- (measured on the Supabase `postgres:15.19.0.018` image: as `postgres`, a REVOKE on a
-- `supabase_admin`-owned function warned and `has_function_privilege('anon', …, 'EXECUTE')`
-- stayed `true`). Relying on that WARNING as success would let this migration "pass" while
-- the exposure remained. The precondition below therefore resolves each target's actual
-- owner from the catalog and ABORTS, with an F-A16-07-specific error, unless the executing
-- role owns the target or is a member of the owning role — the exact condition PostgreSQL
-- requires to change the ACL. It does not assume a particular owner.
--
-- FAIL CLOSED ON THE RESULT: the post-condition re-reads the effective privilege and
-- raises (rolling the migration back) if `anon`/`authenticated` can still execute either
-- function, or if `service_role` or the owner lost it. Nothing is left half-applied.

-- ---------------------------------------------------------------------------------
-- 0. Preconditions — fail loudly, never partially.
-- ---------------------------------------------------------------------------------
DO $$
DECLARE
  missing_roles text;
  missing_fns   text[] := ARRAY[]::text[];
  unmanageable  text[] := ARRAY[]::text[];
  sig           text;
  fn_oid        oid;
  fn_owner      oid;
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
  -- For each present target, also resolve its ACTUAL owner and refuse to continue unless the
  -- executing role may change that owner's ACLs. This is the ownership precondition: it is
  -- what makes the migration fail closed instead of silently no-op'ing (a REVOKE a role may
  -- not perform only WARNS — see the header).
  FOREACH sig IN ARRAY ARRAY['public.rls_auto_enable()', 'public.update_updated_at_column()'] LOOP
    fn_oid := pg_catalog.to_regprocedure(sig);
    IF fn_oid IS NULL THEN
      missing_fns := missing_fns || sig;
      CONTINUE;
    END IF;

    SELECT p.proowner INTO fn_owner FROM pg_catalog.pg_proc p WHERE p.oid = fn_oid;

    -- `pg_has_role(current_user, owner, 'MEMBER')` is true when the executing role IS the
    -- owner or is a member of it — exactly the condition PostgreSQL requires to change the
    -- routine's ACL. It is false for a role the executing role cannot act for (the measured
    -- `postgres` vs a `supabase_admin`-owned function). Do NOT replace this with a check that
    -- assumes a particular owner name; the owner is read here, not assumed.
    IF NOT pg_catalog.pg_has_role(current_user, fn_owner, 'MEMBER') THEN
      unmanageable := unmanageable
        || format('%s (owner %s)', sig, pg_catalog.pg_get_userbyid(fn_owner));
    END IF;
  END LOOP;

  IF array_length(missing_fns, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-07: expected function(s) not found: %', array_to_string(missing_fns, ', ')
      USING HINT = 'This migration revokes EXECUTE on two specific existing functions. A missing target means the database is not the expected project, or the platform renamed rls_auto_enable(). Confirm the target before re-running; do not drop this check.';
  END IF;

  IF array_length(unmanageable, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-07: cannot change EXECUTE on target function(s) owned by a role this session may not act for: %', array_to_string(unmanageable, ', ')
      USING HINT = 'A REVOKE a role may not perform only WARNS ("no privileges could be revoked") and leaves the function world-executable, so this migration refuses to run and claim remediation. Resolve by one of: (a) apply as a role that owns the target or is a member of the owning role; (b) apply the equivalent REVOKE as the owner (an owner-run step); (c) if the owner is a platform superuser (supabase_admin) that the customer role cannot act for, treat this as a platform-assisted step and record it, do not weaken this check. The two functions are NOT dropped, recreated or re-owned by this migration.';
  END IF;

  RAISE NOTICE 'F-A16-07: revoking EXECUTE from PUBLIC, anon, authenticated on 2 public function(s)';
END $$;

-- ---------------------------------------------------------------------------------
-- 1. Revoke EXECUTE from PUBLIC, anon and authenticated — and nothing else.
-- ---------------------------------------------------------------------------------
-- `service_role` and the owner (whoever it is) keep EXECUTE. Written as literal, fully
-- qualified signatures so the target set is explicit and cannot drift. Exactly two
-- statements, one per named target — no wildcard, no `ALL FUNCTIONS IN SCHEMA`.
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
  owner_missing text[] := ARRAY[]::text[];
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

    -- The owner (whoever it is) must still hold EXECUTE. Resolved from the catalog rather
    -- than named, because the owner is not assumed.
    IF NOT pg_catalog.has_function_privilege(
             (SELECT p.proowner::regrole::text
                FROM pg_catalog.pg_proc p
               WHERE p.oid = pg_catalog.to_regprocedure(target.sig)),
             target.sig, 'EXECUTE')
    THEN
      owner_missing := owner_missing || target.sig;
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

  IF array_length(owner_missing, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-07: function(s) lost EXECUTE for the owner: %', array_to_string(owner_missing, ', ')
      USING HINT = 'An owner must always retain EXECUTE. A loss here means the ACL is not in the expected state; investigate before re-running. Do not weaken this check.';
  END IF;

  RAISE NOTICE 'F-A16-07: rls_auto_enable() and update_updated_at_column() are no longer executable by anon/authenticated; service_role and the owner keep EXECUTE.';
END $$;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- Restores the pre-migration over-grant exactly (this is the point of a rollback):
-- GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC, anon, authenticated;
