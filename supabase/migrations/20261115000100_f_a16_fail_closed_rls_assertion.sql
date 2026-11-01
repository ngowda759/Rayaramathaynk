-- Migration: F-A16-03 — make RLS auto-enable fail closed
--
-- Status: PROPOSED. NOT APPLIED. Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-03).
--
-- The problem
-- -----------
-- The platform installs an event trigger `ensure_rls` whose function
-- `public.rls_auto_enable()` runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on
-- every new `public` table. Its body already re-raises:
--
--     BEGIN
--       EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
--       RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
--     EXCEPTION
--       WHEN OTHERS THEN
--         RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
--         RAISE;                       -- <- the exception is NOT swallowed
--     END;
--
-- so a failure inside `rls_auto_enable` does abort the `CREATE TABLE`. What it does
-- NOT cover is the failure the audit is actually worried about: `ALTER TABLE ...
-- ENABLE ROW LEVEL SECURITY` succeeds only for the table's owner, so when the table
-- is created by a role other than the function owner the statement fails, and — more
-- importantly — the loop's `IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN
-- ('public')` guard means a table created in a *different* schema, or a table the
-- function simply does not reach, is left with RLS off and the creation still
-- succeeds. There is no post-condition check. That is the fail-open gap.
--
-- What this migration does — and what it deliberately does not
-- ------------------------------------------------------------
-- It does NOT touch, weaken, rename or drop `ensure_rls` or `rls_auto_enable()`. It
-- adds a *second*, repo-owned event trigger that fires after them and asserts the
-- post-condition: every `public` table created in this transaction must have
-- `relrowsecurity = true`, or the transaction is aborted. The enabler keeps doing the
-- work; the assertion makes a silent failure impossible.
--
-- Ordering: Postgres fires event triggers for the same event in name order, so
-- `ensure_rls` (e…) runs before `f_a16_assert_public_rls` (f…). The assertion always
-- sees the enabler's effect.
--
-- Idempotent: `DROP EVENT TRIGGER IF EXISTS` then `CREATE`; `CREATE OR REPLACE
-- FUNCTION`. Safe to re-run.
--
-- Scope note: this covers tables created *after* it is installed. It is a forward
-- guard, not a repair — it does not scan or change existing tables (F-A16-01).

-- ---------------------------------------------------------------------------------
-- 1. The assertion function.
-- ---------------------------------------------------------------------------------
-- SECURITY INVOKER and `search_path = pg_catalog`: it only reads `pg_event_trigger_
-- ddl_commands()` and `pg_class`, both in `pg_catalog`, and needs no elevated right to
-- read them. Every reference is schema-qualified.
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
              HINT = 'RLS auto-enable did not run or did not apply. Enable RLS explicitly (ALTER TABLE ... ENABLE ROW LEVEL SECURITY) before creating the table.';
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------------
-- 2. The trigger.
-- ---------------------------------------------------------------------------------
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
