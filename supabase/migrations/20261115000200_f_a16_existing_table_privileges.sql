-- Migration: F-A16-01 — revoke the non-RLS-covered privileges from existing tables
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16-01_PRIVILEGE_MATRIX.md (the table-by-table matrix),
-- docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-01) and
-- docs/audits/F-A16_EXECUTION_CHECKLISTS.md (preflight / post-execution / rollback).
--
-- WHAT THIS CHANGES
-- -----------------
-- It revokes exactly three privileges — `TRUNCATE`, `REFERENCES`, `TRIGGER` — from the
-- public-facing roles on the *existing* `public` tables:
--
--   * `anon` and `authenticated`: revoked on every `public` table.
--   * `service_role`: revoked on every `public` table EXCEPT the ones that carry a
--     `BEFORE TRUNCATE` guard trigger, where `service_role` keeps `TRUNCATE` so the guard
--     remains reachable (see "Why service_role keeps TRUNCATE on nine tables").
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
-- This migration applies the same principle to every remaining table.
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
--   * **No policy is created, altered or dropped.** Section 4 verifies the four public-read
--     policies still exist rather than assuming it.
--
-- WHY service_role KEEPS TRUNCATE ON NINE TABLES
-- ----------------------------------------------
-- A `BEFORE TRUNCATE` trigger fires only for a role that holds `TRUNCATE`; the table owner
-- and superusers bypass it. The repository attaches `BEFORE TRUNCATE` guard triggers (which
-- raise, or emit audit rows) on nine tables. Revoking `TRUNCATE` from `service_role` on
-- those would not break anything today (the app never truncates), but it would silently
-- disable the guard for the only non-owner role that could ever trip it. So `service_role`
-- keeps `TRUNCATE` there and the guard stays reachable. `TRIGGER` and `REFERENCES` are
-- still revoked from `service_role` on every table, including those nine.
--
-- The nine guarded tables are read from the catalog at apply time (`pg_trigger`), not
-- hard-coded, so a new `BEFORE TRUNCATE` guard is honoured automatically. The exclusion is
-- also listed in `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` for review.
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
-- 2. service_role — revoke TRIGGER / REFERENCES everywhere; TRUNCATE except on
--    tables that carry a BEFORE TRUNCATE guard.
-- ---------------------------------------------------------------------------------
-- The exclusion is read from `pg_trigger` (the `tgtype` bit 0x20 is TRUNCATE, and
-- `tgtype & 2 = 2` means BEFORE), so a future guard trigger is honoured without editing
-- this file. The guard trigger only fires for a role that holds TRUNCATE; keeping it on
-- service_role is what keeps the guard reachable for a non-owner role.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.relname,
           EXISTS (
             SELECT 1
               FROM pg_catalog.pg_trigger t
              WHERE t.tgrelid = c.oid
                AND NOT t.tgisinternal
                AND (t.tgtype & 2) = 2      -- BEFORE
                AND (t.tgtype & 32) = 32    -- TRUNCATE
           ) AS has_truncate_guard
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  LOOP
    IF rec.has_truncate_guard THEN
      -- Keep TRUNCATE so the BEFORE TRUNCATE guard remains reachable for service_role.
      EXECUTE format(
        'REVOKE REFERENCES, TRIGGER ON TABLE public.%I FROM service_role',
        rec.relname
      );
    ELSE
      EXECUTE format(
        'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM service_role',
        rec.relname
      );
    END IF;
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
-- nothing would otherwise pass. This reads the effective privileges back and refuses to
-- commit while a public-facing role still holds any of the three, or while a table that
-- should still grant a privilege no longer does. The migration is transactional, so a
-- raise rolls everything back.
--
-- It also asserts that this migration did not disturb public `SELECT`: the four
-- public-read tables must still carry their RLS `SELECT` policy. This migration never
-- touches policies or `SELECT`, so a failure here means something else changed underneath
-- it — exactly the kind of drift a post-condition exists to catch.
DO $$
DECLARE
  offenders text;
  missing_policy text;
BEGIN
  -- (a) no public-facing role may hold TRUNCATE/REFERENCES/TRIGGER on any public table,
  --     except service_role's TRUNCATE on a table that carries a BEFORE TRUNCATE guard.
  SELECT string_agg(DISTINCT format('%s.%s (%s)', c.relname, r.rolname, p.priv), '; ')
    INTO offenders
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
    CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND pg_catalog.has_table_privilege(r.rolname, c.oid, p.priv)
     AND NOT (
       r.rolname = 'service_role'
       AND p.priv = 'TRUNCATE'
       AND EXISTS (
         SELECT 1 FROM pg_catalog.pg_trigger t
          WHERE t.tgrelid = c.oid
            AND NOT t.tgisinternal
            AND (t.tgtype & 2) = 2
            AND (t.tgtype & 32) = 32
       )
     );

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-01: public-facing roles still hold TRUNCATE/REFERENCES/TRIGGER: %', offenders
      USING HINT = 'The migration rolled back. Investigate before re-running; do not weaken this check.';
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
