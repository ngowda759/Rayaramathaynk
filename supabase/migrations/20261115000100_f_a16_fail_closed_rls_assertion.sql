-- Migration: F-A16-03 — make RLS auto-enable fail closed
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-03).
--
-- The problem
-- -----------
-- Supabase installs an event trigger named `ensure_rls` whose function
-- `public.rls_auto_enable()` runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on
-- every new `public` table. Its body already re-raises:
--
--     BEGIN
--       EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
--       RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
--     EXCEPTION
--       WHEN OTHERS THEN
--         RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
--         RAISE;                       -- the exception is NOT swallowed
--     END;
--
-- so a failure *inside* `rls_auto_enable` already aborts the `CREATE TABLE`. The
-- audit's concern is therefore not a swallowed exception; it is the absence of a
-- post-condition check. Two states reach a table with RLS off and no error:
--
--   (a) the enabler is absent, renamed, or disabled — nothing runs, and the new
--       table silently keeps RLS off (this is the fail-open state);
--   (b) a future platform change to the enabler swallows the error rather than
--       re-raising.
--
-- What this migration does — and what it deliberately does not
-- ------------------------------------------------------------
-- It does NOT touch, weaken, rename or drop `ensure_rls` or `rls_auto_enable()`. It
-- adds a *second*, repo-owned event trigger that fires after the enabler and asserts
-- the post-condition: every `public` table created in this transaction must have
-- `relrowsecurity = true`, or the transaction aborts. The enabler keeps doing the
-- work; the assertion makes a silent failure impossible.
--
-- Scope parity is deliberate: the assertion filters on exactly the same
-- `command_tag`/`object_type` set as the platform enabler, so it never fires where
-- the enabler would not. Combined with the name ordering (`ensure_rls` sorts before
-- `f_a16_assert_public_rls`), the assertion can only see a table the enabler already
-- had the chance to handle.
--
-- Ordering: Postgres fires event triggers for the same event in name order. Verified
-- empirically on Postgres 18 (PGlite) with two triggers created in the reverse order,
-- which still fired by name. See the remediation plan §3.3.
--
-- PRECONDITION — read this before applying
-- ----------------------------------------
-- Because the assertion blocks any `public` table that reaches `ddl_command_end` with
-- RLS off, it is incompatible with the repository's own
-- `CREATE TABLE ...; ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` pattern *unless* an
-- enabled enabler runs first. Production is expected to have `ensure_rls` (the audit
-- could not read its state — see the remediation plan §3.6), but this migration does
-- not assume it: section 0 verifies it and raises with an actionable message if the
-- enabler is missing or disabled. Installing the assertion without an enabler would
-- turn every future table creation into a hard failure, which is a worse outcome than
-- failing this migration.
--
-- Idempotent: `DROP EVENT TRIGGER IF EXISTS` then `CREATE`; `CREATE OR REPLACE
-- FUNCTION`. Safe to re-run.
--
-- Scope note: this covers tables created *after* it is installed. It is a forward
-- guard, not a repair — it does not scan or change existing tables (F-A16-01).

-- ---------------------------------------------------------------------------------
-- 0. Precondition — an enabled RLS enabler must exist, or this guard is a hazard.
-- ---------------------------------------------------------------------------------
DO $$
DECLARE
  enabler_name text;
  enabled      boolean;
BEGIN
  SELECT e.evtname, (e.evtenabled IN ('O', 'A'))
    INTO enabler_name, enabled
    FROM pg_catalog.pg_event_trigger e
   WHERE e.evtevent = 'ddl_command_end'
     AND e.evtfoid::regprocedure::text LIKE '%rls_auto_enable%'
   ORDER BY e.evtname
   LIMIT 1;

  IF enabler_name IS NULL THEN
    RAISE EXCEPTION 'F-A16-03: no ddl_command_end event trigger calls rls_auto_enable()'
      USING HINT = 'Installing this assertion without an RLS enabler would block every future public table creation. Install the Supabase platform enabler first (see docs/audits/F-A16_REMEDIATION_PLAN.md §3.6), or create the table with RLS already enabled and do not apply this migration.';
  END IF;

  IF NOT enabled THEN
    RAISE EXCEPTION 'F-A16-03: the RLS enabler trigger % exists but is not enabled', enabler_name
      USING HINT = 'Enable it first: ALTER EVENT TRIGGER ' || quote_ident(enabler_name) || ' ENABLE; Otherwise this assertion blocks every future public table creation.';
  END IF;

  RAISE NOTICE 'F-A16-03: RLS enabler % is enabled; installing the fail-closed assertion after it', enabler_name;
END $$;

-- ---------------------------------------------------------------------------------
-- 1. The assertion function.
-- ---------------------------------------------------------------------------------
-- SECURITY INVOKER and `search_path = pg_catalog`: it only reads
-- `pg_event_trigger_ddl_commands()` and `pg_class`, both in `pg_catalog`, and needs no
-- elevated right to read them. Every reference is schema-qualified.
CREATE OR REPLACE FUNCTION public.f_a16_assert_public_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
  rls_disabled boolean;
BEGIN
  FOR cmd IN
    SELECT *
      FROM pg_event_trigger_ddl_commands()
     WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       AND object_type IN ('table', 'partitioned table')
  LOOP
    CONTINUE WHEN cmd.schema_name IS NULL OR cmd.schema_name <> 'public';

    -- Read the flag on the object that was just created, by oid, so a table whose
    -- name shadows another cannot produce a false pass.
    SELECT (NOT c.relrowsecurity)
      INTO rls_disabled
      FROM pg_catalog.pg_class c
     WHERE c.oid = cmd.objid
       AND c.relkind IN ('r', 'p');

    IF rls_disabled THEN
      RAISE EXCEPTION
        'F-A16-03: refusing to create public table % with RLS disabled', cmd.object_identity
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'RLS auto-enable did not run or did not apply. Enable RLS explicitly (ALTER TABLE ... ENABLE ROW LEVEL SECURITY) in a separate statement after creating the table, or repair the enabler trigger.';
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------------
-- 2. The trigger.
-- ---------------------------------------------------------------------------------
-- The name is chosen so it sorts *after* `ensure_rls` (e < f) and therefore runs
-- after the enabler for the same event.
DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls;

CREATE EVENT TRIGGER f_a16_assert_public_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.f_a16_assert_public_rls();

-- ---------------------------------------------------------------------------------
-- 3. Least privilege on the new function itself.
-- ---------------------------------------------------------------------------------
-- An event-trigger function is not callable through PostgREST, but the default
-- `PUBLIC EXECUTE` (see F-A16-02) is still granted. Revoke it: nothing needs to call
-- this directly, only the event trigger does, and an event trigger runs the function
-- as its owner regardless of EXECUTE.
REVOKE EXECUTE ON FUNCTION public.f_a16_assert_public_rls() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
--   DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls;
--   DROP FUNCTION IF EXISTS public.f_a16_assert_public_rls();
-- Dropping the assertion restores the previous (fail-open) behaviour exactly; it does
-- not touch `ensure_rls`. See docs/audits/F-A16_REMEDIATION_PLAN.md §7.
