-- Migration: F-A16-01 — revoke the non-RLS-covered privileges from existing tables
--
-- Status: exists and is fully tested locally (unit + PGlite + real-PostgreSQL
--         integration). PRODUCTION APPLICATION PENDING.
--         Applying it is an owner action, gated on review.
-- See docs/audits/F-A16-01_PRIVILEGE_MATRIX.md (the table-by-table matrix),
-- docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-01) and
-- docs/audits/F-A16_EXECUTION_CHECKLISTS.md (preflight / post-execution / rollback).
--
-- WHAT THIS CHANGES
-- -----------------
-- It revokes exactly three privileges — `TRUNCATE`, `REFERENCES`, `TRIGGER` — from the
-- public-facing roles on the *existing* `public` tables, from **every** role including
-- `service_role`:
--
--   * `anon`, `authenticated` and `service_role`: all three revoked on every `public` table.
--
-- Those three privileges are the part of the platform's broad grant that **RLS cannot
-- compensate for**:
--
--   * `TRUNCATE` destroys every row in one statement and is not row-filtered by RLS;
--   * `REFERENCES` lets a role point a foreign key at the table, which RLS does not
--     govern;
--   * `TRIGGER` is a DDL right: a role holding it can attach a trigger that rewrites
--     `NEW` *after* a guard trigger has checked it.
--
-- The repository already recognised this for the seva tables:
-- `20261029235900_seva_privilege_hardening.sql` revokes `TRIGGER, REFERENCES` from
-- `service_role, anon, authenticated` on seven guarded tables with the same rationale.
-- This migration applies the same principle to every remaining table, and to `TRUNCATE`.
--
-- WHY service_role LOSES TRUNCATE TOO (F-A16-01 correction, 2026-11-03)
-- ---------------------------------------------------------------------
-- An earlier revision of this migration kept `TRUNCATE` for `service_role` on tables
-- carrying a `BEFORE TRUNCATE` guard, on the theory that the guard "only fires for a role
-- that holds TRUNCATE", so revoking it would make the guard unreachable. That theory is
-- **wrong**, and the exception is removed. Measured on PostgreSQL 17.11 and 18.6:
--
--   * a `BEFORE TRUNCATE` trigger fires for the **table owner** (non-superuser):
--       CREATE ROLE owner2; SET ROLE owner2; CREATE TABLE t; CREATE TRIGGER ... BEFORE TRUNCATE;
--       TRUNCATE t;  --  ERROR: blocked TRUNCATE on t
--   * it also fires for a **superuser**, including a superuser truncating a table it does
--     not own;
--   * it fires for a non-owner that holds `TRUNCATE` as well.
--
-- So the guard is reachable for *every* role that can truncate, and keeping `TRUNCATE` on
-- `service_role` protected nothing: the guard already fires for the owner. Revoking
-- `TRUNCATE` from `service_role` everywhere therefore removes a real (if unused) privilege
-- without weakening any guard. The app never truncates (a repository search finds no
-- `TRUNCATE` statement in any function body, script or application path — only in the
-- `seva_forbid_change()` guards that *raise* on it), and the two append-only tables that
-- once carried an explicit `REVOKE DELETE, TRUNCATE … FROM service_role`
-- (`receipt_number_gaps`, `receipt_series_years`, `20261102000000_seva_final_fixes.sql`)
-- are consistent with this outcome, not exceptions to it.
--
-- The reviewed exception list is therefore **empty**. There is no `pg_trigger` read in the
-- revoke path; the previous `tgtype & 32` exclusion is gone. See
-- `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` §2.1 for the per-table trigger review.
--
-- WHAT THIS DELIBERATELY DOES NOT CHANGE
-- --------------------------------------
--   * **No `SELECT`/`INSERT`/`UPDATE`/`DELETE` revocation.** Those are row-filtered by
--     RLS, so revoking them is an application-dependency change, not a hygiene fix. The
--     2026-11-03 audit's API census (anon reads only `events`, `aaradhanes`,
--     `site_settings`, `social_links`; denied on 21 tables; 42 return zero rows because
--     RLS denies) is evidence for a *later, owner-gated* DML phase, not for this one.
--     That phase is specified table-by-table in `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md`
--     and is NOT executed here.
--   * **Public `SELECT` on the four public-read tables is preserved** — this migration
--     never touches `SELECT` or any RLS policy. `events`, `aaradhanes`, `site_settings`
--     and `social_links` keep both their `SELECT` grant and their RLS `SELECT` policy.
--   * **`service_role` keeps DML and sequence `USAGE`.** The admin dashboard and the seva
--     RPC surface write through `createAdminClient()`.
--   * **Supabase Auth is untouched.** This migration only ever names tables found in
--     schema `public` (the catalog sweep filters `n.nspname = 'public'`), and it never
--     references `auth.*`, `storage.*`, `graphql*` or any other schema.
--   * **No policy is created, altered or dropped.** Section 3 verifies the four public-read
--     policies still exist rather than assuming it.
--
-- IDEMPOTENT: every statement is a `REVOKE`, and revoking an unheld privilege is a no-op.
-- Re-running is safe. Nothing here drops a table, changes a policy, or touches a row.
--
-- PRECONDITION — read before applying
-- -----------------------------------
-- This is the one F-A16 change that alters *existing* object ACLs. It is deliberately
-- narrow (the three RLS-invisible privileges only), but the operator should still read the
-- preflight checklist and confirm the four public-read tables are the intended public
-- surface. If a table legitimately needs `REFERENCES` for a role (none is known), that is a
-- reason to hold this migration, not to weaken it.

-- ---------------------------------------------------------------------------------
-- 0. Preconditions — fail loudly, never partially.
-- ---------------------------------------------------------------------------------
DO $$
DECLARE
  missing text;
  n_tables int;
BEGIN
  SELECT string_agg(r, ', ')
    INTO missing
    FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = r);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-01: required Supabase roles are missing: %', missing
      USING HINT = 'This migration is written for a Supabase project. Do not run it against a database without these roles.';
  END IF;

  SELECT count(*) INTO n_tables
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p');

  IF n_tables = 0 THEN
    RAISE EXCEPTION 'F-A16-01: schema public has no tables to remediate'
      USING HINT = 'This migration revokes existing table privileges; on a database with no public tables it is almost certainly pointed at the wrong target. Stop and confirm the target.';
  END IF;

  RAISE NOTICE 'F-A16-01: remediating % public table(s)', n_tables;
END $$;

-- ---------------------------------------------------------------------------------
-- 1. anon + authenticated — revoke TRUNCATE / REFERENCES / TRIGGER on every table.
-- ---------------------------------------------------------------------------------
-- Catalog-driven so the set cannot drift from the schema. `relkind IN ('r','p')` covers
-- ordinary and partitioned tables. The three privileges are never needed by a public-facing
-- role: the browser client only ever SELECTs, and RLS does not govern any of the three.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated',
      rec.relname
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------
-- 2. service_role — revoke TRUNCATE / REFERENCES / TRIGGER on every table.
-- ---------------------------------------------------------------------------------
-- No exception list. An earlier revision kept `TRUNCATE` on the tables carrying a
-- `BEFORE TRUNCATE` guard so the guard stayed "reachable"; that was based on a wrong
-- premise (see the header). Measured on PostgreSQL 17.11 and 18.6: a `BEFORE TRUNCATE`
-- trigger fires for the table owner and for a superuser as well as for a non-owner that
-- holds `TRUNCATE`, so revoking `TRUNCATE` cannot make any guard unreachable. `TRIGGER`
-- and `REFERENCES` are likewise revoked everywhere, matching the pre-existing seva
-- hardening (`20261029235900_seva_privilege_hardening.sql`).
--
-- Catalog-driven so the set cannot drift from the schema. `relkind IN ('r','p')` covers
-- ordinary and partitioned tables. service_role keeps `SELECT`/`INSERT`/`UPDATE`/`DELETE`
-- and sequence `USAGE`; only these three are removed.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.relname
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM service_role',
      rec.relname
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------
-- 3. Re-assert the pre-existing seva hardening (idempotent, for a clean audit trail).
-- ---------------------------------------------------------------------------------
-- 20261029235900_seva_privilege_hardening.sql already revoked TRIGGER/REFERENCES on seven
-- guarded tables; 20261102000000_seva_final_fixes.sql already revoked DELETE/TRUNCATE from
-- service_role on two. Re-issuing the TRIGGER/REFERENCES revokes here is a no-op on a
-- database that has them, and makes this migration's intent self-contained on one that does
-- not (e.g. a replayed local database). DELETE is deliberately NOT re-issued: it is a DML
-- revocation and belongs to the deferred phase.
--
-- Catalog-guarded so the file also applies on a database where a named table is absent
-- (a partial local replay); on production all seven exist. Sections 1–2 already cover every
-- table, so this block is belt-and-braces for the audit trail.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_log', 'staff', 'seva_rate_history', 'seva_orders',
                           'seva_receipts', 'seva_receipt_lines', 'day_closes']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format(
        'REVOKE TRIGGER, REFERENCES ON TABLE public.%I FROM service_role, anon, authenticated',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------
-- 4. Post-condition — verify, do not assume.
-- ---------------------------------------------------------------------------------
-- A `REVOKE` on an unheld privilege is a no-op, so a typo or a role that silently did
-- nothing would otherwise pass. This reads the *effective* privileges back
-- (`has_table_privilege` accounts for inheritance and for a `PUBLIC` grant) and refuses to
-- commit while a public-facing role still holds any of the three. The migration is
-- transactional, so a raise rolls everything back.
--
-- It also asserts that this migration did not disturb public `SELECT`: the four
-- public-read tables must still carry their `SELECT` grant *and* their RLS `SELECT` policy.
-- This migration never touches grants other than the three, or any policy, so a failure
-- here means something else changed underneath it — exactly the drift a post-condition
-- exists to catch.
DO $$
DECLARE
  offenders text;
  public_grants text;
  missing_policy text;
  missing_grant text;
BEGIN
  -- (a) no public-facing role may hold TRUNCATE/REFERENCES/TRIGGER on any public table.
  --     Effective check: this also fails if the privilege reaches a role through a
  --     membership or through a grant to PUBLIC. No exception — service_role loses all
  --     three too (see the header).
  SELECT string_agg(DISTINCT format('%s.%s (%s)', c.relname, r.rolname, p.priv), '; ')
    INTO offenders
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND pg_catalog.has_table_privilege(r.rolname, c.oid, p.priv);

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-01: public-facing roles still hold TRUNCATE/REFERENCES/TRIGGER: %', offenders
      USING HINT = 'The migration rolled back. Investigate before re-running; do not weaken this check.';
  END IF;

  -- (a2) `PUBLIC` itself must not hold any of the three on a public table. The audit found
  --      no such grant, so a row here is a pre-existing condition the operator must resolve
  --      (this migration deliberately never revokes from PUBLIC — see the header).
  SELECT string_agg(DISTINCT format('%s (%s)', c.relname, p.priv), '; ')
    INTO public_grants
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND pg_catalog.has_table_privilege('public', c.oid, p.priv);

  IF public_grants IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-01: PUBLIC holds TRUNCATE/REFERENCES/TRIGGER on public table(s): %', public_grants
      USING HINT = 'These were not created by this migration and are not revoked by it. Investigate the source before proceeding.';
  END IF;

  -- (b) the four public-read tables must still have their RLS SELECT policy. This is the
  --     positive assertion that the remediation preserved public reads.
  SELECT string_agg(t, ', ')
    INTO missing_policy
    FROM unnest(ARRAY['events', 'aaradhanes', 'site_settings', 'social_links']) AS t
   WHERE EXISTS (
           SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r', 'p')
         )
     AND NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_policies pol
            WHERE pol.schemaname = 'public' AND pol.tablename = t AND pol.cmd IN ('SELECT', 'ALL')
              AND pol.permissive = 'PERMISSIVE'
              AND pol.qual <> 'false'
         );

  IF missing_policy IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-01: public-read table(s) lost their SELECT policy: %', missing_policy
      USING HINT = 'This migration does not touch policies. A missing policy means the public-read surface changed underneath it — investigate before proceeding.';
  END IF;

  -- (c) the four public-read tables must still grant SELECT to anon and authenticated.
  SELECT string_agg(format('%s.%s', t, r), ', ')
    INTO missing_grant
    FROM unnest(ARRAY['events', 'aaradhanes', 'site_settings', 'social_links']) AS t
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS g(r)
   WHERE EXISTS (
           SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r', 'p')
         )
     AND NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = t
             AND pg_catalog.has_table_privilege(g.r, c.oid, 'SELECT')
         );

  IF missing_grant IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-01: public-read table(s) lost their anon/authenticated SELECT grant: %', missing_grant
      USING HINT = 'This migration never revokes SELECT. A missing grant means the ACL changed underneath it — investigate before proceeding.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- This migration records no marker. To restore the platform defaults for the three
-- privileges, re-grant them (this restores the *pre-migration* over-grant, which is the
-- point of a rollback):
--
--   GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
--
-- Then re-run the pre-existing seva hardening so the guarded tables stay tight:
--   REVOKE TRIGGER, REFERENCES ON TABLE audit_log, staff, seva_rate_history, seva_orders,
--     seva_receipts, seva_receipt_lines, day_closes FROM service_role, anon, authenticated;
--
-- See docs/audits/F-A16_EXECUTION_CHECKLISTS.md §Rollback for the full procedure.
