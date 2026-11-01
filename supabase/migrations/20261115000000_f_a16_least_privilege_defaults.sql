-- Migration: F-A16-02 — least-privilege default privileges in `public`
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-02) and
-- docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md.
--
-- What this changes
-- -----------------
-- Nothing that exists today. `ALTER DEFAULT PRIVILEGES` only rewrites the ACL that
-- Postgres will stamp on objects created *later* by the target role. No table,
-- sequence, function, policy or existing grant is touched. That separation is the
-- point: the audit found broad *existing* grants too (F-A16-01), and those are
-- deliberately NOT revoked here because their application dependencies have not been
-- audited (see the remediation plan §4).
--
-- Why the defaults are broad today
-- --------------------------------
-- The broad defaults are NOT set by any migration in this repository. A repo-wide
-- search for `ALTER DEFAULT PRIVILEGES` finds only `tests/db/harness.ts`, which
-- recreates the platform's defaults so the seva migrations' REVOKEs are meaningful.
-- The live ACLs come from the Supabase platform, which runs, for the object-owning
-- roles (`postgres`, `supabase_admin`):
--
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
--
-- So every new `public` table arrives with INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER for `anon` and `authenticated`, and every new function arrives executable
-- by them.
--
-- Two mechanics matter, and both were verified against Postgres 18 (PGlite) before
-- this file was written:
--
--   1. Tables and sequences: a per-schema REVOKE *does* subtract from the platform's
--      per-schema GRANT. Revoking `ALL ON TABLES`/`ALL ON SEQUENCES` from
--      `anon`/`authenticated` is therefore sufficient — no global statement needed.
--
--   2. Functions: a per-schema REVOKE cannot remove the implicit `PUBLIC` EXECUTE
--      that Postgres grants globally to every new function. `ALTER DEFAULT PRIVILEGES
--      IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` is a documented
--      no-op. The global form (no `IN SCHEMA`) is required. Because `anon` and
--      `authenticated` inherit through `PUBLIC`, removing the per-schema grant alone
--      also leaves them executable; both statements are needed.
--
-- What is deliberately kept
-- -------------------------
-- `service_role` keeps SELECT/INSERT/UPDATE/DELETE and sequence USAGE, because the
-- server-side application writes through it (`createAdminClient()`) and reads
-- sequences on insert. Its TRIGGER and REFERENCES defaults are revoked: the same
-- reasoning as `20261029235900_seva_privilege_hardening.sql`, which already revokes
-- those two on the guarded seva tables (a role holding TRIGGER can attach a trigger
-- that rewrites NEW after a guard has checked it).
--
-- `service_role` keeps EXECUTE on new functions on purpose. The seva RPC surface
-- (`lib/seva/server/rpc.ts` → `createAdminClient().rpc(...)`) is ~90 functions, and
-- most of them rely on this default rather than an explicit GRANT. Revoking it would
-- require adding an explicit `GRANT EXECUTE` to every future function, which is a
-- larger change than this finding supports. Recorded as a reviewed exception in the
-- remediation plan §4.3, not an oversight.
--
-- Idempotent: every statement is a REVOKE, and revoking a privilege that is not held
-- is a no-op. Safe to re-run.

-- ---------------------------------------------------------------------------------
-- 0. Preconditions — fail loudly rather than silently leaving the defaults broad.
-- ---------------------------------------------------------------------------------
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(r, ', ')
    INTO missing
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = r);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: required Supabase roles are missing: %', missing
      USING HINT = 'This migration is written for a Supabase project. Do not run it against a database without these roles.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 1. Tables — new public tables must not arrive writable by public-facing roles.
-- ---------------------------------------------------------------------------------
-- Removes SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for anon and
-- authenticated. A new table therefore starts with NO privilege for either role; a
-- public read is added explicitly, per table, with a GRANT plus an RLS SELECT policy
-- (the pattern `20261105000000_events_public_select_policy.sql` and
-- `20261111000000_aaradhanes_public_select_policy.sql` already follow).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- TRUNCATE and REFERENCES are not row-filtered by RLS and TRIGGER is a DDL right, so
-- they are the part of the broad grant that RLS could never compensate for. service_role
-- does not need them (see the header).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role;

-- ---------------------------------------------------------------------------------
-- 2. Sequences — no public-facing role needs to advance a sequence.
-- ---------------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ---------------------------------------------------------------------------------
-- 3. Functions — remove the implicit PUBLIC EXECUTE and the platform's explicit grant.
-- ---------------------------------------------------------------------------------
-- Global (no `IN SCHEMA`): this is the only form that removes the implicit
-- `PUBLIC EXECUTE` on future functions. `IN SCHEMA public` here would be a no-op.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Per-schema: removes the platform's explicit `GRANT ALL ON FUNCTIONS` to the two
-- public-facing roles, so they do not inherit through their own ACL entry either.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ---------------------------------------------------------------------------------
-- 4. Best effort for `supabase_admin` — the other object-owning role.
-- ---------------------------------------------------------------------------------
-- Objects created by `supabase_admin` carry its own default ACL. This block applies
-- the same revokes when the current role may act for it; otherwise it records a
-- NOTICE and leaves it to the owner, rather than failing the whole migration or
-- pretending the default was changed. `postgres` on Supabase is a member of
-- `supabase_admin`, so in practice this succeeds.
DO $$
DECLARE
  target constant text := 'supabase_admin';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = target) THEN
    RAISE NOTICE 'F-A16-02: role % does not exist; its default privileges are not applicable', target;
    RETURN;
  END IF;

  IF NOT pg_catalog.pg_has_role(current_user, target, 'MEMBER') THEN
    RAISE NOTICE 'F-A16-02: current role % cannot act for %; run section 4 manually as %',
      current_user, target, target;
    RETURN;
  END IF;

  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', target);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated', target);
END $$;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- This migration records no marker and creates no object, so it is reversed by
-- restoring the previous defaults explicitly (there is no "undo" that reads them
-- back). See docs/audits/F-A16_REMEDIATION_PLAN.md §7 for the exact statements.
