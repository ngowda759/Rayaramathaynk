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
--     function grant to `anon`/`authenticated`. Removing such an entry needs the
--     global form and is left to the owner-run step
--     (docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql §4).
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
--      issued by a role that is a member of `x` (or by a superuser). The audit found
--      both `postgres` and `supabase_admin` own default privileges in `public`, and
--      that `postgres` cannot manage `supabase_admin`'s through current membership.
--      This file covers the applying role directly (section 1) and then every other
--      role that owns a default ACL in `public` (section 2), failing closed on any it
--      cannot cover. The remedy is the split-out owner-run step.
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
--     owner-reviewed action; see the owner-run step §4 and its verification §4b.
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
--   * "Covered" is per-role and the run is all-or-nothing: if any candidate creator
--     cannot be acted for (`pg_has_role(..., 'MEMBER')` is false), the file raises and
--     the entire migration rolls back. There is no partial-success state.

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
-- must not touch. That is a broader action than F-A16-02 supports and is left to an
-- owner-reviewed step: docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql §4.
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
      USING HINT = 'A schema-scoped REVOKE cannot subtract a GLOBAL default. Remediate with the global form (no IN SCHEMA), which affects every schema in the database — an owner-reviewed action. See docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql section 4. F-A16-02 is NOT remediated until this succeeds.';
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
--    that can create objects in `public`. Cover what must be covered; fail closed on
--    what cannot be.
-- ---------------------------------------------------------------------------------
-- Section 1 only affects objects created by the *applying* role. Default privileges
-- are per-owner, so this section must cover every *other* role that can create an object
-- in `public`. The 2026-11-03 audit confirmed `postgres` and `supabase_admin` both own
-- default privileges in `public`, and that `postgres` cannot manage `supabase_admin`'s
-- through current membership — so this section is expected to stop and hand the operator
-- the owner-run step.
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
--       These are the roles that must be REVOKED (the six statements in the loop), and the
--       ones this migration must fail closed on when it cannot act for them.
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
-- without closing any residual (the trap an earlier revision fell into). Class (A) is both
-- revoked and failed closed on.
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
-- If any CLASS-(A) candidate cannot be covered (`pg_has_role(..., 'MEMBER')` is false — the
-- exact precondition Postgres enforces for `ALTER DEFAULT PRIVILEGES FOR ROLE`), the block
-- raises. The whole migration then rolls back, so the database is never left in a
-- half-tightened state — and the remediation cannot be described as complete while a
-- role was skipped. The remedy is the split-out owner-run step:
-- docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql
DO $$
DECLARE
  skipped     text[] := ARRAY[]::text[];
  create_only text[] := ARRAY[]::text[];
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
      skipped := skipped || inv.candidate;
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

  IF array_length(skipped, 1) > 0 THEN
    RAISE EXCEPTION 'F-A16-02: cannot tighten default privileges for object-creating role(s): %',
      array_to_string(skipped, ', ')
      USING HINT = 'Default privileges belong to the creating role and may only be changed by a member of it. Run docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql as that role (or as a superuser), then re-run this migration. F-A16-02 is NOT fully remediated until it succeeds.';
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
-- default ACL (the section-2 candidate set), and that no GLOBAL default still leaks a
-- table or sequence to a public-facing role. It does NOT assert that every possible
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
-- asserts that scope positively: it fails if a default ACL exists for a schema other
-- than `public` that names a public-facing grantee. It is the guard for the F-A16-02
-- correction ("explicitly scope application remediation to the public schema").
--
-- Note this is a *pre-existing-state* assertion, not a diff: the migration has no way to
-- read the pre-change ACLs back, so it asserts the property that must hold after it runs.
-- The 2026-11-03 audit found no such entries; a failure here means something outside this
-- migration put them there.
DO $$
DECLARE
  foreign_leaks text;
BEGIN
  SELECT string_agg(DISTINCT format('%s.%s %s -> %s (%s)',
                                    n.nspname,
                                    pg_catalog.pg_get_userbyid(d.defaclrole),
                                    d.defaclobjtype,
                                    CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                         ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
                                    a.privilege_type), '; ')
    INTO foreign_leaks
    FROM pg_catalog.pg_default_acl d
    JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
   WHERE d.defaclnamespace <> 0
     AND n.nspname <> 'public'
     AND a.grantee <> d.defaclrole
     AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated');

  IF foreign_leaks IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: public-facing roles hold default privileges in non-public schemas: %', foreign_leaks
      USING HINT = 'This migration must not touch storage/graphql/graphql_public. If these entries exist, they were NOT created by this migration — investigate their origin. F-A16-02 does not remediate them.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------------
-- This migration records no marker and creates no object, so it is reversed by
-- restoring the previous defaults explicitly (there is no "undo" that reads them
-- back). See docs/audits/F-A16_REMEDIATION_PLAN.md §7 for the exact statements.
