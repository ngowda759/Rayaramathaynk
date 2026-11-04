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
-- RESIDUAL: a function created by a superuser is NOT covered (measured, 2026-11-04).
-- ---------------------------------------------------------------------------------
-- A function created by `supabase_admin` (the only superuser on a Supabase project)
-- keeps the implicit PUBLIC EXECUTE. Measured on the Supabase `postgres:15.19.0.018`
-- image: `CREATE FUNCTION` executed by `supabase_admin` does not fire this event trigger
-- at all — the resulting `proacl` is
-- `{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,service_role=X/supabase_admin}`
-- and `has_function_privilege('anon'|'authenticated', …)` is true. The cause is
-- Supabase-specific: `supautils` runs privileged DDL in a non-`origin` replication role,
-- and a default (`ENABLE ORIGIN`) event trigger does not fire in that mode; a plain
-- non-superuser `postgres` DDL is unaffected. Confirmed by contrast — on stock
-- PostgreSQL 17.11 the same trigger DOES fire for a superuser, and on a
-- Supabase image with `supautils` absent it also fires for `supabase_admin`. So this is
-- not "event triggers never fire for superusers"; it is the Supabase platform's
-- privileged-DDL path. This migration cannot close it: it never sees the statement.
-- The residual is `service_role`-only in practice (anon/authenticated cannot reach a
-- superuser-created function without an explicit grant), and it is recorded here rather
-- than papered over. Closing it needs a different mechanism (e.g. a superuser-run
-- remediation for objects `supabase_admin` creates), out of scope for F-A16-02b. See
-- docs/audits/F-A16_INTEGRATION_VERIFICATION.md (Test B.4).
--
-- HOW IT WORKS (measured on PostgreSQL 17 and 18 / PGlite)
-- --------------------------------------------------------
-- The guard function is `SECURITY DEFINER`, so it runs with its owner's rights and can
-- revoke on a function created by a different role when its owner can manage that
-- function (true when the owner is a superuser, or is the same role, or is a member).
-- Measured: a `SECURITY DEFINER` guard owned by role `G` revokes EXECUTE on a routine
-- created by `G` (which is the normal case — migrations run as `postgres`, which owns the
-- guard). When the guard owner CANNOT manage the routine the REVOKE does NOT raise
-- `must be owner of function`: PostgreSQL emits `WARNING: no privileges could be revoked`
-- and leaves the routine world-executable (measured on real PostgreSQL 15.19 and 17.11).
-- The guard therefore re-reads the effective privilege with `has_function_privilege`
-- after the REVOKE and RAISES if the grant survived, so an unmanageable creator aborts the
-- creating transaction — the deliberate fail-closed outcome. See
-- docs/audits/F-A16_INTEGRATION_VERIFICATION.md.
--
-- `ON ROUTINE`, not `ON FUNCTION` (F-A16-02b correction, 2026-11-03)
-- -----------------------------------------------------------------
-- The revoke is written `REVOKE EXECUTE ON ROUTINE <identity>`. `ON FUNCTION` rejects a
-- procedure with `is not a function`, and because the guard's `EXECUTE` raises, that
-- error aborted the *creating* statement — so the previous revision of this file made
-- `CREATE PROCEDURE` in `public` impossible while the guard was installed. Reproduced on
-- PostgreSQL 17.11 and 18.6:
--
--     CREATE PROCEDURE public.p1() LANGUAGE sql AS $$ SELECT 1; $$;
--     ERROR:  public.p1() is not a function
--     CONTEXT:  SQL statement "REVOKE EXECUTE ON FUNCTION public.p1() FROM PUBLIC, anon, authenticated"
--               PL/pgSQL function public.f_a16_public_fn_guard() line 17 at EXECUTE
--
-- `ON ROUTINE` accepts both functions and procedures (`prokind` `f` and `p`), and
-- `cmd.object_identity` already carries the full signature the syntax needs
-- (`public.p1()`, `public.f(int,text)`), so no `pg_get_function_identity_arguments` call
-- is required. Verified on both versions: after `ON ROUTINE` the procedure is created,
-- `anon`/`authenticated` cannot execute it and `service_role` can.
--
-- SUPABASE COMPATIBILITY (why this is not claimed from PGlite alone)
-- -----------------------------------------------------------------
-- `CREATE EVENT TRIGGER` is a superuser-only operation in stock PostgreSQL — measured on
-- PostgreSQL 17.11 and 18.6: a non-superuser role gets
-- `permission denied to create event trigger`. Supabase's `postgres` role is **not** a
-- superuser (`rolsuper = false`); it can create event triggers only because the
-- Supabase-managed `supautils` extension intercepts the statement, elevates briefly to a
-- superuser, and then makes the event trigger owned by its "privileged role"
-- (supabase/supautils; supabase.com/docs/guides/database/postgres/event-triggers states
-- "With our Supautils extension … the postgres user has the ability to create and manage
-- event triggers"). This repository's test suite cannot load `supautils`, so:
--
--   * PGlite/PostgreSQL runs here prove the *SQL* is correct (scoping, `ON ROUTINE`,
--     fail-closed, `service_role` preservation, rollback), but they run as a superuser
--     and therefore do **not** prove the Supabase privilege path;
--   * whether `postgres` on the production project may create event triggers is
--     **unverified** and must be confirmed in preflight (`docs/audits/
--     F-A16_EXECUTION_CHECKLISTS.md` §Preflight). It is not assumed here.
--   * because we cannot detect the Supautils grant from the catalog, this migration does
--     NOT gate on `rolsuper`. The `CREATE EVENT TRIGGER` statement failing is the
--     fail-closed signal: the transaction aborts, no guard is installed, and the operator
--     gets a clear error rather than a silent no-op.
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
    -- depends on it — see F-A16-02 §2.5).
    --
    -- `ON ROUTINE`, not `ON FUNCTION`: a procedure is not a function, and `ON FUNCTION`
    -- would raise `is not a function` and abort the CREATE PROCEDURE. `ON ROUTINE`
    -- covers both `prokind` `f` and `p`. See the header.
    EXECUTE format(
      'REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC, anon, authenticated',
      cmd.object_identity
    );

    -- Fail closed. A REVOKE the guard owner may NOT perform does not raise: PostgreSQL
    -- only emits `WARNING: no privileges could be revoked` and leaves the routine
    -- world-executable. Measured on real PostgreSQL 15.19 and 17.11 — see
    -- docs/audits/F-A16_INTEGRATION_VERIFICATION.md (Test A.3). Relying on the REVOKE to
    -- raise was the defect this check fixes. Re-read the EFFECTIVE privilege and abort
    -- the creating transaction if the grant survived, so a routine whose owner the guard
    -- cannot manage is never left executable by a public-facing role.
    --
    -- `has_function_privilege` accepts a procedure as well as a function, and
    -- `cmd.object_identity` already carries the full signature.
    IF pg_catalog.has_function_privilege('anon', cmd.object_identity, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', cmd.object_identity, 'EXECUTE')
    THEN
      RAISE EXCEPTION
        'F-A16-02b: could not revoke EXECUTE on % from anon/authenticated; the guard owner cannot manage the routine, so it would remain world-executable',
        cmd.object_identity
        USING HINT = 'Create functions in public only from a role the guard owner can manage (a member of it, or the same role). See docs/audits/F-A16_INTEGRATION_VERIFICATION.md.';
    END IF;
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
