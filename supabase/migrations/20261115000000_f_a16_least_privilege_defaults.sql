-- Migration: F-A16-02 — least-privilege default privileges in `public`
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-02),
-- docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql (the split-out owner step)
-- and docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md.
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
-- The live ACLs come from the Supabase platform, which runs, for each object-owning
-- role, the equivalent of:
--
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
--
-- So every new `public` table arrives with INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER for `anon` and `authenticated`, and every new function arrives executable
-- by them.
--
-- Three mechanics matter. All three were verified against Postgres 18 (PGlite)
-- before this file was written; see the remediation plan §2.3.
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
--   3. Ownership: default privileges belong to the role that will *create* the
--      object, not to the schema. Every object-creating role therefore carries its
--      own default ACL, and `ALTER DEFAULT PRIVILEGES FOR ROLE x` may only be issued
--      by a role that is a member of `x` (or by a superuser). This file covers the
--      applying role directly and then *enumerates* the remaining owners from
--      `pg_default_acl` rather than assuming which they are — and fails closed if it
--      finds one it cannot cover.
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
-- remediation plan §2.5, not an oversight.
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
-- 4. Every other object-creating role — enumerate, cover, or fail closed.
-- ---------------------------------------------------------------------------------
-- Sections 1–3 only affect objects created by the *applying* role. Default
-- privileges are per-owner: `supabase_admin` (and any other role that creates
-- objects in `public`) carries its own default ACL that sections 1–3 do not touch.
--
-- Rather than assume which roles those are, this block reads `pg_default_acl` for
-- `public` and takes every owner whose ACL still names a public-facing grantee. For
-- each, it applies the same five revokes if the applying role may act for it
-- (`pg_has_role(..., 'MEMBER')`, which is the exact precondition Postgres enforces
-- for `ALTER DEFAULT PRIVILEGES FOR ROLE`), and otherwise records it.
--
-- If any owner could not be covered, the block raises. The whole migration then rolls
-- back, so the database is never left in a half-tightened state — and the remediation
-- cannot be described as complete while a role was skipped. The remedy is the
-- split-out owner-run step: docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql
DO $$
DECLARE
  target  text;
  skipped text[] := ARRAY[]::text[];
BEGIN
  FOR target IN
    SELECT DISTINCT pg_catalog.pg_get_userbyid(d.defaclrole)
      FROM pg_catalog.pg_default_acl d
     WHERE d.defaclnamespace = 'public'::regnamespace
       AND d.defaclacl::text ~ '(^|[,{])(anon|authenticated|service_role)='
     ORDER BY 1
  LOOP
    -- Already handled by sections 1–3.
    CONTINUE WHEN target = current_user;

    IF NOT pg_catalog.pg_has_role(current_user, target, 'MEMBER') THEN
      skipped := skipped || target;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated', target);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role', target);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated', target);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', target);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated', target);
  END LOOP;

  IF array_length(skipped, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-02: cannot tighten default privileges for object-creating role(s): %',
      array_to_string(skipped, ', ')
      USING HINT = 'Default privileges belong to the creating role and may only be changed by a member of it. Run docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql as that role (or as a superuser), then re-run this migration. F-A16-02 is NOT fully remediated until it succeeds.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 5. Post-condition — verify, do not assume.
-- ---------------------------------------------------------------------------------
-- Sections 1–4 are revokes, and revoking an unheld privilege is a no-op, so a typo or
-- a role that silently did nothing would otherwise pass unnoticed. This reads back
-- the default ACLs and refuses to commit while any public-facing grant remains.
-- `ALTER DEFAULT PRIVILEGES` is transactional (verified on PGlite), so a raise here
-- rolls the whole migration back.
DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(DISTINCT format('%s %s -> %s (%s)',
                                    pg_catalog.pg_get_userbyid(d.defaclrole),
                                    d.defaclobjtype,
                                    CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                         ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
                                    a.privilege_type), '; ')
    INTO offenders
    FROM pg_catalog.pg_default_acl d,
         pg_catalog.aclexplode(d.defaclacl) a
   WHERE d.defaclnamespace = 'public'::regnamespace
     AND (
          -- tables and sequences: nothing at all for the public-facing roles
          (d.defaclobjtype IN ('r', 'S')
            AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
          -- tables: service_role keeps DML, loses the two rights RLS cannot cover
       OR (d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRIGGER', 'REFERENCES'))
          -- functions: no public-facing role, and no implicit PUBLIC
       OR (d.defaclobjtype = 'f'
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
     );

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: default privileges in public are still broader than intended: %', offenders
      USING HINT = 'The migration rolled back. Investigate before re-running; do not weaken this check.';
  END IF;

  -- The implicit PUBLIC EXECUTE cannot be read from the ACL, so verify it is gone by
  -- requiring an explicit owner-only global entry for every role this migration
  -- covered. Without the global revoke no entry exists, which is precisely the state
  -- that leaves PUBLIC able to execute future functions.
  SELECT string_agg(r.rolname, ', ')
    INTO offenders
    FROM pg_catalog.pg_roles r
   WHERE (r.rolname = current_user
          OR (pg_catalog.pg_has_role(current_user, r.rolname, 'MEMBER')
              AND EXISTS (SELECT 1
                            FROM pg_catalog.pg_default_acl d
                           WHERE d.defaclrole = r.oid
                             AND d.defaclnamespace = 'public'::regnamespace)))
     AND NOT EXISTS (SELECT 1
                       FROM pg_catalog.pg_default_acl d,
                            pg_catalog.aclexplode(d.defaclacl) a
                      WHERE d.defaclrole = r.oid
                        AND d.defaclnamespace = 0
                        AND d.defaclobjtype = 'f'
                        AND a.grantee <> 0);

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: PUBLIC still has EXECUTE on future functions owned by: %', offenders
      USING HINT = 'The global form of the function revoke did not take effect for these roles.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- This migration records no marker and creates no object, so it is reversed by
-- restoring the previous defaults explicitly (there is no "undo" that reads them
-- back). See docs/audits/F-A16_REMEDIATION_PLAN.md §7 for the exact statements.
