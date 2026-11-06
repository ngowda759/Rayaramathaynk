-- Migration: F-A16-02 — least-privilege default privileges in `public`
--
-- Status: exists and is fully tested locally (unit + PGlite + real-PostgreSQL
--         integration). PRODUCTION APPLICATION PENDING.
--         Applying it is an owner action, gated on review.
-- See docs/audits/F-A16_REMEDIATION_PLAN.md (finding F-A16-02),
-- docs/audits/F-A16_EXECUTION_CHECKLISTS.md (preflight / post-execution / rollback)
-- and docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md.
--
-- HOSTED-SUPABASE CONSTRAINT — why this migration does NOT touch `supabase_admin`
-- -----------------------------------------------------------------------------
-- `supabase_admin` is a platform-INTERNAL, superuser role on hosted Supabase. The
-- customer `postgres` session is not a superuser and is not a member of
-- `supabase_admin`, so `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` is denied by
-- PostgreSQL and can never be part of a customer-applied migration. This is a platform
-- property, not a repository defect, and it is not remediable from the customer role.
--
-- F-A16-02 therefore remediates only the default privileges a customer role CAN own and
-- change: those owned by the applying role (`postgres` on hosted Supabase) and by any
-- role the applying role is a member of. Default privileges owned by a role the applying
-- role cannot act for — in practice `supabase_admin` — are OUT OF SCOPE: they are
-- documented here, reported with a `RAISE NOTICE`, and are NOT failed closed on. Whether
-- any object actually exists under such a role's defaults is UNRESOLVED: no production
-- catalog read has established it (the repository carries contradictory assumptions, and
-- no "2026-11-05 read-only production inventory" exists — see
-- docs/audits/F-A16_INTEGRATION_VERIFICATION.md §10). Because it cannot be assumed away,
-- the runtime checks below gate on the applying role's own membership rather than on any
-- claim about what objects exist. No production owner-run `supabase_admin` SQL is required
-- for this path.
--
-- The migration still FAILS CLOSED on the customer-controllable state. After the revokes
-- it verifies (section 3) that every `public` default ACL owned by a role the applying
-- role may act for carries no public-facing grantee, and section 0b refuses to run while
-- a global default confers future objects on a public-facing role for such an owner. If
-- the applying role's own `public` defaults are not in the expected least-privilege
-- state, the migration aborts.
--
-- What this changes
-- -----------------
-- Nothing that exists today. `ALTER DEFAULT PRIVILEGES` only rewrites the ACL that
-- Postgres will stamp on objects created *later* by the target role. No table,
-- sequence, function, policy or existing grant is touched. That separation is the
-- point: the audit found broad *existing* grants too (F-A16-01), and those are
-- handled by their own migration (20261115000200_f_a16_existing_table_privileges.sql),
-- not here.
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
-- The 2026-11-03 production catalog audit recorded 24 schema-scoped default ACL
-- entries and **0 global default ACL entries** for this project. That is the fact
-- that decides the shape of this migration (see "Why this file does NOT use the
-- global form" below).
--
-- SCHEMA SCOPE — this migration only ever touches `public`
-- -------------------------------------------------------
-- Every statement below carries `IN SCHEMA public`. This file deliberately issues
-- **no** global (`ALTER DEFAULT PRIVILEGES` with no `IN SCHEMA`) statement, because a
-- global statement changes the defaults for objects created in EVERY schema of the
-- database — including the Supabase-managed `storage`, `graphql` and
-- `graphql_public` schemas this remediation must not modify. Section 3c is a
-- post-condition that fails the migration if a public-facing role holds default
-- privileges in a non-`public` schema.
--
-- Why this file does NOT use the global form (the F-A16-02 correction)
-- -------------------------------------------------------------------
-- The documented way to remove the implicit `PUBLIC` EXECUTE from *future* functions
-- is the global form:
--
--     ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;   -- GLOBAL
--
-- because a per-schema `REVOKE … FROM PUBLIC` is a documented no-op for functions
-- (per-schema defaults can only add to, never subtract from, the global default;
-- re-measured on PGlite: a per-schema revoke of EXECUTE … FROM PUBLIC leaves a new
-- function's `has_function_privilege('anon', …, 'EXECUTE')` true). An earlier revision
-- of this migration used that global statement. It has been removed, for two reasons
-- the 2026-11-03 audit made decisive:
--
--   1. The audit found **0 global default ACL entries** in production. There is
--      therefore nothing global to revoke, and the global statement would only
--      *create* a new global entry (`postgres=X/postgres`, owner-only) that changes
--      the default for every schema — exactly the blast radius this task forbids.
--   2. Revoking `PUBLIC` EXECUTE globally is broader than "application remediation in
--      `public`": it would also apply to functions created in `storage`, `graphql`
--      and `graphql_public`.
--
-- The residual is handled without a global statement:
--
--   * a *direct* default grant to `anon`/`authenticated` is removed per schema
--     (sections 1 and 2) — this is what actually matters, because those roles are the
--     public-facing ones;
--   * the implicit `PUBLIC` EXECUTE that remains on future functions is closed
--     **forward** by `20261114990000_f_a16_public_function_execute_guard.sql`, an
--     event trigger that revokes EXECUTE from `PUBLIC, anon, authenticated` on each
--     new `public` function and keeps `service_role`. That is narrower than a global
--     default change and is scoped to `public`;
--   * section 0b still **fails closed** if production ever carries a global default
--     that leaks tables/sequences to a public-facing role, or a global direct
--     function grant to `anon`/`authenticated`, for a role the applying role MAY act
--     for. Removing such an entry needs the global form, which changes every schema in
--     the database and is therefore an owner-reviewed action, not something this file
--     does automatically. (A global default owned by `supabase_admin` is out of scope:
--     the customer role cannot change it and no customer object is created under it.)
--
-- Mechanics that matter. All were verified against Postgres (PGlite) before this file
-- was written; see the remediation plan §2.3.
--
--   1. Tables and sequences: a per-schema REVOKE *does* subtract from the platform's
--      per-schema GRANT — for named roles AND for `PUBLIC` (measured: a per-schema
--      `GRANT SELECT ON TABLES TO PUBLIC` is removed by a per-schema
--      `REVOKE ALL ON TABLES FROM PUBLIC`, and a new table is then not anon-readable).
--      Revoking `ALL ON TABLES`/`ALL ON SEQUENCES` from
--      `anon, authenticated, PUBLIC` is therefore sufficient.
--
--   2. Functions: the platform's explicit `GRANT ALL ON FUNCTIONS` to
--      `anon`/`authenticated` is removed per schema. The implicit `PUBLIC` EXECUTE is
--      NOT removable per schema and is closed by the forward guard migration, not
--      here.
--
--   3. Ownership: default privileges belong to the role that will *create* the
--      object, not to the schema. `ALTER DEFAULT PRIVILEGES FOR ROLE x` may only be
--      issued by a role that is a member of `x` (or by a superuser). On hosted Supabase
--      the customer `postgres` role cannot act for `supabase_admin` (see the HOSTED-
--      SUPABASE CONSTRAINT above). This file covers the applying role directly (section
--      1) and then every other role whose `public` default ACL the applying role MAY act
--      for (section 2). A role the applying role cannot act for is reported, not failed
--      closed on; whether any object exists under that role's defaults is UNRESOLVED (no
--      production catalog read), which is why the runtime check gates on the applying
--      role's membership rather than on that question.
--
-- What is deliberately kept
-- -------------------------
-- `service_role` keeps SELECT/INSERT/UPDATE/DELETE and sequence USAGE, because the
-- server-side application writes through it (`createAdminClient()`) and reads
-- sequences on insert. Its TRUNCATE, TRIGGER and REFERENCES defaults are revoked: the
-- same reasoning as `20261029235900_seva_privilege_hardening.sql` (a role holding
-- TRIGGER can attach a trigger that rewrites NEW after a guard has checked it) and the
-- same set F-A16-01 revokes on existing tables, so a new table and an existing table end
-- in the same state. TRUNCATE is included because it is not row-filtered by RLS and the
-- application never truncates; the earlier "keep TRUNCATE on guarded tables" exception
-- was removed (see F-A16-01: a BEFORE TRUNCATE guard fires for the owner too, so the
-- grant protected nothing).
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
--
-- Scope and limitations — what this file does and does not establish
-- -----------------------------------------------------------------
-- Stated plainly, because it is easy to over-read:
--
--   * Section 2 enumerates the COMPLETE creator inventory: the union of (A) every role
--     that owns a `pg_default_acl` row for `public` — with NO grantee filter, because a
--     filter for `anon`/`authenticated`/`service_role` is a targeted search that misses a
--     role whose public default ACL names only some other grantee — and (B) every role
--     that effectively holds CREATE on `public` but owns no default ACL. Class (A) is
--     revoked and failed closed on. Class (B) is inventoried and reported but not revoked
--     and not failed closed on: it has no default privilege to change, its new
--     tables/sequences are owner-only by the hardwired default, and its new functions'
--     implicit `PUBLIC` EXECUTE is closed forward by the guard migration. An earlier
--     revision enumerated only class (A) and described class (B) as a limitation; that
--     left a creator invisible to the operator. The union closes that gap. The
--     grantee-filtered miss is reproduced in tests/db/f-a16-least-privilege.test.ts.
--
--   * A GLOBAL default privilege (no `IN SCHEMA`) is out of scope for remediation here
--     and is handled fail-closed instead. Measured on PGlite: a schema-scoped REVOKE
--     CANNOT subtract a global grant, so
--     `ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC` leaves every new
--     `public` table readable by `anon` even after sections 1–2 succeed. Section 0b
--     therefore refuses to run while such a default exists. The same applies to a global
--     `TRUNCATE`, `TRIGGER` or `REFERENCES` grant on tables to `service_role`: those are
--     exactly the three privileges section 1 revokes per schema, and a global grant of any
--     survives that revoke (measured: a new public table still reports
--     `has_table_privilege('service_role', …, 'TRIGGER')` as true afterwards). Section 0b
--     refuses on those too. It is NOT remediated in this file, because removing a global
--     default requires the global form — which changes defaults for every schema in the
--     database, including platform-managed ones this migration must not touch. That is an
--     owner-reviewed action, not something this file does automatically.
--
--   * The catalog cannot enumerate roles that do not exist yet. A role created after
--     this migration runs carries no default ACL of its own, so it reverts to the
--     hardwired defaults: tables owner-only (safe), functions with the implicit
--     `PUBLIC` EXECUTE (not safe for a role that will create functions). And if the
--     platform later attaches a broad per-role default ACL to any role, that ACL is
--     equally invisible to this run. This migration cannot close either case: both are
--     provisioning events, not a grant it can revoke. Recorded in the remediation plan
--     §2.6 as a residual risk with the control that covers it (creating a role or
--     changing platform defaults is a deliberate, reviewed act; `service_role`-only
--     tables are additionally protected by RLS and by explicit REVOKEs in their own
--     migrations; and the forward function guard covers a new role's functions for
--     `PUBLIC`/`anon`/`authenticated`).
--
--   * The post-condition (section 3) verifies the scope the migration actually
--     established: for every role that owns a `public` default ACL, no public-facing
--     grantee (including `PUBLIC`) remains, and no global table/sequence default still
--     leaks. It does NOT and cannot assert that every future creator has been
--     enumerated — no catalog query can, for the reasons above. Read it as "the roles
--     this file could see are covered", not "all creators are covered".
--
--   * "Covered" is per-role and the run is all-or-nothing FOR THE ROLES THIS MIGRATION
--     MAY ACT FOR. If the applying role is not a member of a `public` default-ACL owner
--     (`pg_has_role(..., 'MEMBER')` is false) — the exact precondition Postgres enforces
--     for `ALTER DEFAULT PRIVILEGES FOR ROLE` — that role is OUT OF SCOPE. On hosted
--     Supabase this is the expected state for `supabase_admin`, the platform-internal
--     superuser: the customer `postgres` session can never act for it, and whether any
--     object exists under its defaults is UNRESOLVED (no production catalog read). Such a
--     role is reported with a `RAISE NOTICE`, not failed closed on, so the migration
--     converges on hosted Supabase. The customer-controllable state — every `public`
--     default ACL owned by the applying role or a role it may act for — is still verified
--     and fails closed (section 3).

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
-- 0b. Precondition — refuse to proceed while a GLOBAL default grants future tables,
--     sequences, or a direct function grant to a public-facing role.
-- ---------------------------------------------------------------------------------
-- A global default privilege (`ALTER DEFAULT PRIVILEGES … ` with no `IN SCHEMA`) applies
-- to objects created in EVERY schema, and — measured on Postgres (PGlite) — a
-- schema-scoped REVOKE CANNOT subtract it:
--
--     ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC;      -- global
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--     CREATE TABLE public.t (id int);
--     -- has_table_privilege('anon', 'public.t', 'SELECT')  =>  true   (still!)
--
-- So sections 1–2 below, which are schema-scoped, would report success while every new
-- `public` table remained readable by `anon` through the global entry. This block makes
-- that state impossible to overlook: it raises, and the whole migration rolls back.
--
-- The 2026-11-03 production audit recorded **0 global default ACL entries**, so this
-- block is expected to pass. It is retained as a fail-closed guard against a future
-- provisioning change.
--
-- OWNER SCOPE. The check is limited to global defaults OWNED BY a role the applying role
-- may act for (`pg_has_role(current_user, d.defaclrole, 'MEMBER')`). A global default
-- owned by `supabase_admin` is not customer-controllable — the customer `postgres` session
-- can neither change it nor be affected by it, and whether any object exists under it is
-- UNRESOLVED (no production catalog read) — so it is out of scope and must not
-- block the migration. Only the customer-controllable global state fails closed.
--
-- Scope of this check:
--   * tables and sequences — any global grant to `PUBLIC` or to `anon`/`authenticated`;
--   * tables — a global grant of `TRUNCATE`, `TRIGGER` or `REFERENCES` to `service_role`.
--     Those are exactly the privileges section 1 revokes from `service_role` per schema,
--     and a global grant survives that schema-scoped revoke (measured: after
--     `IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role`,
--     a new public table still reports `has_table_privilege('service_role', …, 'TRIGGER')`
--     and `… 'REFERENCES'` as true). `service_role` keeps DML, so only these three are
--     checked — refusing on a global DML grant to `service_role` would be wrong;
--   * functions — a global grant DIRECTLY to `anon`/`authenticated`. The global grant to
--     `PUBLIC` is deliberately excluded here: this migration no longer issues a global
--     statement, and a global `PUBLIC` function default is instead closed *forward* by
--     the function-EXECUTE guard migration. Refusing here on a global `PUBLIC` function
--     default would block a state the forward guard handles.
--
-- The owner's own entry (`a.grantee = d.defaclrole`) is excluded: it is inherent to every
-- default ACL and cannot be revoked (measured: `REVOKE … FROM anon` leaves
-- `{anon=X/anon}`), so treating it as a leak would false-positive on a creator named like
-- a public-facing role.
--
-- The fix for what this block catches is deliberately NOT attempted here. Removing a
-- global default means issuing the global form (no `IN SCHEMA`), which changes defaults
-- for EVERY schema in the database — including platform-managed schemas this migration
-- must not touch. That is a broader action than F-A16-02 supports and is an owner-reviewed
-- decision, not an automated step.
DO $$
DECLARE
  global_leaks text;
BEGIN
  SELECT string_agg(DISTINCT format('%s %s -> %s (%s)',
                                    pg_catalog.pg_get_userbyid(d.defaclrole),
                                    CASE d.defaclobjtype WHEN 'r' THEN 'TABLES'
                                                         WHEN 'S' THEN 'SEQUENCES'
                                                         WHEN 'f' THEN 'FUNCTIONS' END,
                                    CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                         ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
                                    a.privilege_type), '; ')
    INTO global_leaks
    FROM pg_catalog.pg_default_acl d,
         pg_catalog.aclexplode(d.defaclacl) a
   WHERE d.defaclnamespace = 0
     AND a.grantee <> d.defaclrole
     -- Only customer-controllable owners: a global default owned by a role the applying
     -- role cannot act for (e.g. supabase_admin) is not ours to change and must not block.
     AND pg_catalog.pg_has_role(current_user, d.defaclrole, 'MEMBER')
     AND (
          -- tables and sequences: PUBLIC or a named public-facing role
          (d.defaclobjtype IN ('r', 'S')
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          -- functions: a DIRECT grant to a named public-facing role (not PUBLIC)
       OR (d.defaclobjtype = 'f'
            AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
          -- tables: the three privileges section 1 revokes from service_role per schema.
          -- A global grant of any survives that schema-scoped revoke.
       OR (d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES'))
         );

  IF global_leaks IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: global default privileges confer future objects on public-facing roles: %', global_leaks
      USING HINT = 'A schema-scoped REVOKE cannot subtract a GLOBAL default. Remediate with the global form (no IN SCHEMA), which affects every schema in the database — an owner-reviewed action. F-A16-02 is NOT remediated until this succeeds.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 0c. Precondition — refuse to proceed if a public-facing role can itself create in
--     `public`.
-- ---------------------------------------------------------------------------------
-- A public-facing role holding CREATE on `public` is a misconfiguration this migration
-- cannot fix: removing it means changing the *schema ACL* (a `REVOKE CREATE ON SCHEMA`),
-- which is existing-object grant territory (F-A16-01) and is deliberately deferred. It
-- also makes the remediation ambiguous — such a role can create objects whose defaults
-- it also owns, so "public-facing role" and "creator" stop being disjoint sets.
--
-- The check uses `has_schema_privilege`, so it catches a direct grant, a grant inherited
-- through membership, and a grant to PUBLIC (measured: `GRANT CREATE ON SCHEMA public TO
-- PUBLIC` makes every role report CREATE). Failing closed here is deliberate — this is a
-- state that needs a human decision, not a silent pass.
DO $$
DECLARE
  rogue text;
BEGIN
  SELECT string_agg(r.rolname, ', ')
    INTO rogue
    FROM pg_catalog.pg_roles r
   WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
     AND pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE');

  IF rogue IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: public-facing role(s) hold CREATE on schema public: %', rogue
      USING HINT = 'A public-facing role must not be able to create objects in public. Removing CREATE is a schema-ACL change (F-A16-01 scope, deferred) and needs owner review. Investigate whether CREATE was granted to these roles directly, via a role they are members of, or via PUBLIC. F-A16-02 is NOT remediated until this succeeds.';
  END IF;
END $$;
-- ---------------------------------------------------------------------------------
-- 0d. Snapshot — record the non-`public` default ACLs BEFORE this migration touches
--     anything, so section 3c can prove this file changed none of them.
-- ---------------------------------------------------------------------------------
-- Section 3c must assert that THIS migration did not alter a non-`public` schema. A bare
-- "no public-facing grant exists in a non-`public` schema" assertion cannot do that: a
-- stock Supabase project ALREADY carries such entries, provisioned by the platform —
-- e.g. `storage.<owner> -> anon/authenticated` and `graphql*.<owner> -> anon/authenticated`
-- (measured on the Supabase `postgres:15` image: 9 of the 24 schema-scoped default ACL
-- entries are non-`public` and name `anon`/`authenticated`). Asserting their absence would
-- fail the migration on a correct, unmodified project. So the snapshot is taken here, and
-- section 3c fails only on a difference. It is a session-scoped temp table (not
-- `ON COMMIT DROP`, which would vanish under a per-statement-autocommit apply such as
-- `psql -f`), dropped at the end of section 3c.
DROP TABLE IF EXISTS f_a16_02_pre_nonpublic_defaults;
CREATE TEMP TABLE f_a16_02_pre_nonpublic_defaults AS
SELECT d.defaclrole,
       d.defaclnamespace,
       d.defaclobjtype,
       a.grantee,
       a.privilege_type
  FROM pg_catalog.pg_default_acl d
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace <> 0
   AND d.defaclnamespace <> 'public'::regnamespace;

-- ---------------------------------------------------------------------------------
-- 1. The applying role — tighten its own defaults.
-- ---------------------------------------------------------------------------------
-- Removes SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER for anon and
-- authenticated on new tables. A new table therefore starts with NO privilege for either
-- role; a public read is added explicitly, per table, with a GRANT plus an RLS SELECT
-- policy (the pattern `20261105000000_events_public_select_policy.sql` and
-- `20261111000000_aaradhanes_public_select_policy.sql` already follow).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- A per-schema PUBLIC table default would make every future table world-readable. The
-- audit found none, so this is a no-op today; it is issued so the state cannot arise
-- silently. (A per-schema revoke FROM PUBLIC *does* work for tables — measured.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;

-- TRUNCATE and REFERENCES are not row-filtered by RLS and TRIGGER is a DDL right, so
-- they are the part of the broad grant that RLS could never compensate for. service_role
-- does not need them (see the header). This set matches F-A16-01 exactly: existing tables
-- lose the same three from the same three roles, so a future table and an existing table
-- end in the same state. (An earlier revision kept TRUNCATE here; that made a *new* table
-- broader than an *existing* one and is corrected.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role;

-- No public-facing role needs to advance a sequence.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- Per-schema: removes the platform's explicit `GRANT ALL ON FUNCTIONS` to the two
-- public-facing roles, so a new `public` function is not directly executable by them.
-- The implicit `PUBLIC` EXECUTE is NOT removed here — the per-schema form cannot do
-- that, and this migration deliberately issues no global statement (see the header).
-- The residual is closed forward by
-- `20261114990000_f_a16_public_function_execute_guard.sql`, which is scoped to
-- `public` and leaves `service_role` executable.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- ---------------------------------------------------------------------------------
-- 2. Creator inventory — every role that owns a `public` default ACL, and every role
--    that can create objects in `public`. Cover what this migration MAY act for;
--    report what it may not.
-- ---------------------------------------------------------------------------------
-- Section 1 only affects objects created by the *applying* role. Default privileges
-- are per-owner, so this section must cover every *other* role whose `public` defaults
-- the applying role may change. On hosted Supabase the applying role is the customer
-- `postgres`, which owns its own defaults and is a member of the roles it may act for;
-- it is NOT a member of `supabase_admin` (the platform-internal superuser), so that
-- role is out of scope (see the HOSTED-SUPABASE CONSTRAINT in the header).
--
-- THE INVENTORY IS THE UNION OF TWO CLASSES (F-A16-02 correction, 2026-11-03)
-- -------------------------------------------------------------------------
-- An earlier revision enumerated only `pg_default_acl` rows, and separately documented
-- the second class as an out-of-scope limitation. That is an incomplete inventory: a role
-- can create objects in `public` while owning no default ACL of its own, and the operator
-- could not see it. This block now enumerates BOTH, and reports the class of each, so the
-- inventory is complete and the difference is explicit rather than buried:
--
--   (A) DEFAULT-ACL OWNERS — a role with a `pg_default_acl` row for `public`. It has had
--       `ALTER DEFAULT PRIVILEGES` issued for it, so its new objects carry those defaults.
--       Those the applying role MAY act for are the ones that must be REVOKED (the six
--       statements in the loop). A default-ACL owner the applying role may NOT act for is
--       reported, not failed closed on (see CONVERGENCE below).
--
--   (B) EFFECTIVE-CREATE HOLDERS — a role for which `has_schema_privilege(role, 'public',
--       'CREATE')` is true but that owns NO `pg_default_acl` row for `public`. Its new
--       objects fall back to the hardwired Postgres defaults. For TABLES and SEQUENCES
--       those defaults grant nothing to anyone but the owner (measured: `relacl IS NULL`),
--       so there is nothing to revoke and this role needs no default-privilege action. Its
--       new FUNCTIONS do carry the implicit `PUBLIC` EXECUTE, which a per-schema REVOKE
--       cannot remove; that residual is closed forward by
--       `20261114990000_f_a16_public_function_execute_guard.sql`.
--
-- So class (B) is INVENTORIED and REPORTED (a `RAISE NOTICE`, so the operator sees the
-- full creator set), but it is deliberately NOT revoked and NOT failed closed on: there is
-- no default privilege to change, and aborting on it would widen the fail-closed set
-- without closing any residual (the trap an earlier revision fell into). Class (A) is
-- revoked and verified.
--
-- `has_schema_privilege` is used for class (B), not a raw `aclexplode(nspacl)` join: it
-- accounts for CREATE inherited through role membership and for a CREATE granted to
-- PUBLIC, both of which a direct ACL join misses.
--
-- Two entries are skipped deliberately:
--   * the applying role — already handled by section 1;
--   * `pg_database_owner`, a pseudo-role that always owns the `public` schema in PG 15+
--     and always holds CREATE on it. It creates nothing itself; the `public` schema's
--     owner is the database owner. It is named in the code and in a test rather than
--     silently filtered.
--
-- CONVERGENCE (F-A16-02 correction, hosted-Supabase redesign 2026-11-05). A CLASS-(A)
-- candidate the applying role cannot act for (`pg_has_role(..., 'MEMBER')` is false — the
-- exact precondition Postgres enforces for `ALTER DEFAULT PRIVILEGES FOR ROLE`) is OUT OF
-- SCOPE, not a failure. On hosted Supabase that is the expected, permanent state for
-- `supabase_admin`: the customer `postgres` session can never act for it, and whether any
-- object exists under its defaults is UNRESOLVED (no production catalog read). Such a role
-- is reported with a `RAISE NOTICE` so the operator sees it, and the migration proceeds.
-- This is what lets F-A16-02 apply on hosted Supabase at all. The customer-controllable
-- state — every `public` default ACL owned by a role the applying role MAY act for — is
-- still verified in section 3 and fails closed if it is not least-privilege.
DO $$
DECLARE
  create_only text[] := ARRAY[]::text[];
  out_of_scope text[] := ARRAY[]::text[];
  inv         record;
BEGIN
  -- The complete creator inventory: class (A) union class (B), each labelled.
  FOR inv IN
    SELECT candidate, bool_or(has_default_acl) AS has_default_acl
      FROM (
        SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS candidate, true AS has_default_acl
          FROM pg_catalog.pg_default_acl d
         WHERE d.defaclnamespace = 'public'::regnamespace
        UNION ALL
        SELECT r.rolname AS candidate, false AS has_default_acl
          FROM pg_catalog.pg_roles r
         WHERE pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE')
      ) c
     GROUP BY candidate
     ORDER BY candidate
  LOOP
    -- Already handled by section 1.
    CONTINUE WHEN inv.candidate = current_user;

    -- A pseudo-role that owns the schema but creates nothing.
    CONTINUE WHEN inv.candidate = 'pg_database_owner';

    IF NOT inv.has_default_acl THEN
      -- Class (B): inventoried and reported, not revoked (nothing to revoke).
      create_only := create_only || inv.candidate;
      CONTINUE;
    END IF;

    IF NOT pg_catalog.pg_has_role(current_user, inv.candidate, 'MEMBER') THEN
      -- Not a member: Postgres will not let us run `ALTER DEFAULT PRIVILEGES FOR ROLE`.
      -- On hosted Supabase this is the expected, permanent state for the platform-internal
      -- superuser `supabase_admin`. Out of scope, not a failure: report it so the operator
      -- sees the full set, and proceed. The customer-controllable state is verified in
      -- section 3.
      out_of_scope := out_of_scope || inv.candidate;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated', inv.candidate);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', inv.candidate);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role', inv.candidate);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated', inv.candidate);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', inv.candidate);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated', inv.candidate);
  END LOOP;

  IF array_length(create_only, 1) > 0 THEN
    RAISE NOTICE 'F-A16-02: creator(s) with CREATE on public but no default ACL (hardwired defaults; tables/sequences owner-only, functions closed by the forward guard): %',
      array_to_string(create_only, ', ');
  END IF;

  IF array_length(out_of_scope, 1) > 0 THEN
    RAISE NOTICE 'F-A16-02: role(s) whose public default ACL the applying role may not change (platform-internal / not a member; out of scope on hosted Supabase): %',
      array_to_string(out_of_scope, ', ');
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 3. Post-condition — verify, do not assume.
-- ---------------------------------------------------------------------------------
-- Sections 1–2 are revokes, and revoking an unheld privilege is a no-op, so a typo or
-- a role that silently did nothing would otherwise pass unnoticed. This reads back the
-- default ACLs and refuses to commit while any public-facing grant remains.
-- `ALTER DEFAULT PRIVILEGES` is transactional (verified on PGlite), so a raise here
-- rolls the whole migration back.
--
-- The scope is deliberately stated: this verifies every role that owns a `public`
-- default ACL AND that the applying role MAY act for (the section-2 revoked set), and
-- that no GLOBAL default owned by such a role still leaks a table or sequence to a
-- public-facing role. A `public` default ACL owned by a role the applying role may NOT
-- act for (e.g. `supabase_admin` on hosted Supabase) is out of scope and is not checked
-- here — the customer cannot change it, and whether any object exists under it is
-- UNRESOLVED (no production catalog read). It also does NOT assert that every possible
-- future creator has been enumerated, because no catalog query can (see "Scope and
-- limitations" in the header).
--
-- Note on `PUBLIC`: `pg_get_userbyid(0)` returns the string `'unknown (OID=0)'`, NOT
-- NULL, so `pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')` never matches a
-- PUBLIC entry. Every check below therefore tests `a.grantee = 0` explicitly. Getting
-- this wrong is exactly how a PUBLIC grant hides from a post-condition.
--
-- Note on the owner's own entry: `ALTER DEFAULT PRIVILEGES` always keeps an implicit
-- `owner=<privs>/owner` entry in the ACL, and it CANNOT be revoked (measured on PGlite:
-- `REVOKE … FROM anon` leaves `{anon=X/anon}`). So a check of the form "the owner's name
-- appears as a grantee" would false-positive on a creator that happens to be named like
-- a public-facing role. Every clause below therefore requires `a.grantee <> d.defaclrole`,
-- i.e. the grant is to someone *other* than the owner. This matters because section 0c
-- guarantees a public-facing role is never a creator, so excluding the self-entry loses
-- no real coverage while removing a class of false positives.
--
-- The implicit `PUBLIC` EXECUTE on future functions is NOT asserted here: this migration
-- no longer removes it (that would need a global statement). It is closed forward by
-- `20261114990000_f_a16_public_function_execute_guard.sql`, whose own precondition checks
-- that guard is installed. Section 3b below records the residual explicitly instead of
-- pretending it is gone.
DO $$
DECLARE
  offenders text;
BEGIN
  -- (a) No public-facing grantee may remain in the `public` default ACLs, and no global
  --     default ACL may name a public-facing role for tables or sequences.
  SELECT string_agg(DISTINCT format('%s %s -> %s (%s)',
                                    pg_catalog.pg_get_userbyid(d.defaclrole),
                                    d.defaclobjtype,
                                    CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                         ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
                                    a.privilege_type), '; ')
    INTO offenders
    FROM pg_catalog.pg_default_acl d,
         pg_catalog.aclexplode(d.defaclacl) a
   WHERE a.grantee <> d.defaclrole   -- the owner's own entry is inherent, not a leak
     -- Only customer-controllable owners: a `public` default ACL owned by a role the
     -- applying role cannot act for (e.g. supabase_admin on hosted Supabase) is out of
     -- scope and is not this migration's to remediate.
     AND pg_catalog.pg_has_role(current_user, d.defaclrole, 'MEMBER')
     AND (
          -- tables and sequences in public: nothing at all for the public-facing roles,
          -- including via PUBLIC (grantee = 0)
          (d.defaclnamespace = 'public'::regnamespace
            AND d.defaclobjtype IN ('r', 'S')
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          -- tables in public: service_role keeps DML, loses the three rights RLS cannot
          -- cover (TRUNCATE, REFERENCES, TRIGGER). The set matches F-A16-01's revoke.
       OR (d.defaclnamespace = 'public'::regnamespace
            AND d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES'))
          -- functions in public: no DIRECT grant to a public-facing role. A per-schema
          -- PUBLIC entry (grantee = 0) is allowed here — it cannot be removed per schema
          -- and is closed forward by the function-EXECUTE guard migration.
       OR (d.defaclnamespace = 'public'::regnamespace
            AND d.defaclobjtype = 'f'
            AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
          -- GLOBAL function default ACLs: no direct grant to a public-facing role.
       OR (d.defaclnamespace = 0
            AND d.defaclobjtype = 'f'
            AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
          -- GLOBAL table/sequence default ACLs: a schema-scoped REVOKE cannot subtract
          -- these, so a residue here means section 0b's precondition was bypassed.
       OR (d.defaclnamespace = 0
            AND d.defaclobjtype IN ('r', 'S')
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          -- GLOBAL table default ACLs: TRUNCATE/TRIGGER/REFERENCES for service_role survive
          -- the schema-scoped revoke in section 1, so verify none is left behind.
       OR (d.defaclnamespace = 0
            AND d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES'))
         );

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: default privileges in public are still broader than intended: %', offenders
      USING HINT = 'The migration rolled back. Investigate before re-running; do not weaken this check.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 3b. Record the implicit PUBLIC EXECUTE residual (notice, not a failure).
-- ---------------------------------------------------------------------------------
-- This migration cannot remove the implicit PUBLIC EXECUTE on future `public` functions
-- without a global statement, which it deliberately does not issue. Rather than pretend
-- the residual is closed, this block records it explicitly and names the compensating
-- control, so an operator reading the log cannot mistake F-A16-02 for a complete closure
-- of the function surface.
--
-- The residual is closed FORWARD by
-- `20261114990000_f_a16_public_function_execute_guard.sql` (an event trigger that revokes
-- EXECUTE from PUBLIC/anon/authenticated on each new `public` function). That file sorts
-- before this one, so on the normal `supabase db push` path the guard is already in
-- place when this migration runs. This block deliberately does NOT raise when the guard
-- is absent: F-A16-02's own safety properties (schema scope, owner fail-closed,
-- service_role preservation, no global change) are independent of it, and a hard
-- dependency would make F-A16-02 un-appliable on its own. The guard is a separate
-- finding with its own precondition and post-condition.
DO $$
DECLARE
  guard_installed boolean;
BEGIN
  SELECT EXISTS (
           SELECT 1 FROM pg_catalog.pg_event_trigger e
            WHERE e.evtevent = 'ddl_command_end'
              AND e.evtfoid::regprocedure::text LIKE '%f_a16_public_fn_guard%'
         )
    INTO guard_installed;

  IF guard_installed THEN
    RAISE NOTICE 'F-A16-02: default privileges tightened in public; the implicit PUBLIC EXECUTE on future functions is closed by f_a16_public_fn_guard.';
  ELSE
    RAISE NOTICE 'F-A16-02: default privileges tightened in public; the forward function-EXECUTE guard is NOT installed, so future public functions still carry the implicit PUBLIC EXECUTE. Apply 20261114990000_f_a16_public_function_execute_guard.sql to close it.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- 3c. Post-condition — this migration must not have changed any non-`public` schema.
-- ---------------------------------------------------------------------------------
-- Every statement above is `IN SCHEMA public`, so no default ACL for `storage`,
-- `graphql`, `graphql_public` or any other schema may have been altered. This block
-- asserts that scope positively, as a DIFF against the snapshot section 0d took before
-- any statement ran. It is the guard for the F-A16-02 correction ("explicitly scope
-- application remediation to the public schema").
--
-- WHY A DIFF, NOT AN ABSENCE CHECK. A stock Supabase project ALREADY carries non-`public`
-- default ACLs that name `anon`/`authenticated` — the platform provisions them for
-- `storage`, `graphql` and `graphql_public` (measured on the Supabase `postgres:15`
-- image: 9 of the 24 schema-scoped default ACL entries are non-`public` and name
-- `anon`/`authenticated`). Those are outside F-A16-02's scope (F-A16-01 territory) and
-- this migration does not touch them. An "assert none exist" check would therefore fail
-- the migration on a correct, unmodified project — which is exactly what happened in the
-- F-A16 integration verification. Asserting the *difference* is the property that
-- actually matters and is provable here: this file changed none of them.
DO $$
DECLARE
  foreign_leaks text;
BEGIN
  SELECT string_agg(DISTINCT format('%s.%s %s -> %s (%s)',
                                    n.nspname,
                                    pg_catalog.pg_get_userbyid(x.defaclrole),
                                    x.defaclobjtype,
                                    CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                                         ELSE pg_catalog.pg_get_userbyid(x.grantee) END,
                                    x.privilege_type), '; ')
    INTO foreign_leaks
    FROM (
      -- Non-public default ACLs present AFTER this migration that were NOT present
      -- BEFORE it (added, or re-granted), for a public-facing grantee.
      SELECT d.defaclrole, d.defaclnamespace, d.defaclobjtype, a.grantee, a.privilege_type
        FROM pg_catalog.pg_default_acl d
        CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
       WHERE d.defaclnamespace <> 0
         AND d.defaclnamespace <> 'public'::regnamespace
      EXCEPT
      SELECT defaclrole, defaclnamespace, defaclobjtype, grantee, privilege_type
        FROM f_a16_02_pre_nonpublic_defaults
    ) x
    JOIN pg_catalog.pg_namespace n ON n.oid = x.defaclnamespace
   WHERE x.grantee <> x.defaclrole
     AND pg_catalog.pg_get_userbyid(x.grantee) IN ('anon', 'authenticated');

  IF foreign_leaks IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: this migration added public-facing default privileges in non-public schemas: %', foreign_leaks
      USING HINT = 'Every statement in this file is `IN SCHEMA public`; a new non-public entry means a statement escaped its scope. Investigate before re-running. F-A16-02 does not remediate pre-existing non-public defaults (storage/graphql/graphql_public) — those are F-A16-01 scope.';
  END IF;
END $$;

DROP TABLE IF EXISTS f_a16_02_pre_nonpublic_defaults;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- This migration records no marker and creates no object, so it is reversed by
-- restoring the previous defaults explicitly (there is no "undo" that reads them
-- back). See docs/audits/F-A16_REMEDIATION_PLAN.md §7 for the exact statements.
