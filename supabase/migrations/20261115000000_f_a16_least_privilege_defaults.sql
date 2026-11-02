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
--      object, not to the schema. `ALTER DEFAULT PRIVILEGES FOR ROLE x` may only be
--      issued by a role that is a member of `x` (or by a superuser). This file covers
--      the applying role directly (sections 1–3) and then enumerates every other role
--      that could create in `public` (section 4), failing closed on any it cannot
--      cover. The enumeration is deliberately NOT filtered by grantee — see
--      "Scope and limitations" below.
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
--
-- Scope and limitations — what this file does and does not establish
-- -----------------------------------------------------------------
-- Stated plainly, because it is easy to over-read:
--
--   * Section 4 enumerates candidate creator roles from two catalog sources, not one:
--     (a) every role with a `pg_default_acl` row in `public`, with NO grantee filter,
--     and (b) every role that EFFECTIVELY holds `CREATE` on `public`, read with
--     `has_schema_privilege(r.oid, 'public', 'CREATE')`. Source (b) matters because a
--     role can create objects in `public` while holding no `pg_default_acl` row at all,
--     and such a role's new FUNCTIONS still carry the implicit `PUBLIC` EXECUTE
--     (measured on PGlite: `has_function_privilege('anon', …)` is true for a function
--     created by a role with no default ACL row). Reading it with `has_schema_privilege`
--     rather than joining `aclexplode(nspacl)` is also deliberate: the join sees only a
--     *direct* grantee, so it misses a role that inherits CREATE through membership and
--     it drops a `CREATE` granted to `PUBLIC` (grantee OID 0, which matches no
--     `pg_roles` row). Both misses were reproduced on PGlite. See §4's block comment.
--
--     Note the asymmetry, so this is not over-read: a creator with no default ACL row
--     produces owner-only TABLES (the hardwired default; measured `relacl IS NULL`), so
--     for source (b) the function revoke is the one that changes anything. The table and
--     sequence revokes are still issued for those roles — they are no-ops when the
--     privilege is not held, and they keep the covered set uniform.
--
--   * A GLOBAL default privilege (no `IN SCHEMA`) is out of scope for remediation here
--     and is handled fail-closed instead. Measured on PGlite: a schema-scoped REVOKE
--     CANNOT subtract a global grant, so
--     `ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC` leaves every new
--     `public` table readable by `anon` even after sections 1–2 succeed. Section 0b
--     therefore refuses to run while such a default exists. The same applies to a global
--     `TRIGGER` or `REFERENCES` grant on tables to `service_role`: those are exactly the
--     two privileges section 1 revokes per schema, and a global grant of either survives
--     that revoke (measured: a new public table still reports
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
--     migrations).
--
--   * The post-condition (section 5) verifies the scope the migration actually
--     established: for every role it covered, no public-facing grantee and no implicit
--     PUBLIC EXECUTE remains, and no global table/sequence default still leaks. It does
--     NOT and cannot assert that every future creator has been enumerated — no catalog
--     query can, for the reasons above. Read it as "the roles this file could see are
--     covered", not "all creators are covered".
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
-- to objects created in EVERY schema, and — measured on Postgres 18 (PGlite) — a
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
-- Scope of this check:
--   * tables and sequences — any global grant to `PUBLIC` or to `anon`/`authenticated`;
--   * tables — a global grant of `TRIGGER` or `REFERENCES` to `service_role`. Those two
--     are exactly the privileges section 1 revokes from `service_role` per schema, and a
--     global grant survives that schema-scoped revoke (measured: after
--     `IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role`, a new
--     public table still reports `has_table_privilege('service_role', …, 'TRIGGER')` and
--     `… 'REFERENCES'` as true). `service_role` keeps DML, so only these two are checked —
--     refusing on a global DML grant to `service_role` would be wrong;
--   * functions — a global grant DIRECTLY to `anon`/`authenticated`. The global grant to
--     `PUBLIC` is deliberately excluded here, because section 3 DOES remediate it (that
--     is the documented, necessary global function revoke) — so it must not trip this
--     precondition.
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
          -- tables: the two privileges section 1 revokes from service_role per schema.
          -- A global grant of either survives that schema-scoped revoke.
       OR (d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRIGGER', 'REFERENCES'))
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
-- Sections 1–3 only affect objects created by the *applying* role. Default privileges
-- are per-owner: `supabase_admin` (and any other role that creates objects in
-- `public`) carries its own default ACL that sections 1–3 do not touch.
--
-- Candidate creators come from two catalog sources, UNIONed:
--
--   (a) every role with a `pg_default_acl` row for `public` — with NO grantee filter.
--       A filter for `anon`/`authenticated`/`service_role` (as an earlier revision
--       used) is a targeted search, not an inventory: it misses a role whose public
--       default ACL names only some other grantee, and it silently reports "covered"
--       for a role it never examined.
--
--   (b) every role that EFFECTIVELY holds `CREATE` on schema `public`. This is read with
--       `has_schema_privilege(r.oid, 'public', 'CREATE')`, not by joining the schema ACL
--       directly, for two measured reasons:
--
--         * a direct `aclexplode(nspacl)` join only sees the role that was *granted*
--           CREATE. A role that inherits it through membership is invisible to it —
--           measured: `child_c`, a member of `parent_c`, was absent from `nspacl` yet
--           could `CREATE TABLE`. `has_schema_privilege` reports it, because it
--           accounts for membership;
--         * `CREATE` granted to `PUBLIC` has `grantee = 0` and matches no row in
--           `pg_roles`, so a direct join silently drops it. `has_schema_privilege`
--           reflects it for every role.
--
--       Either way the hazard is the same: such a role can create a function, and that
--       function carries the implicit `PUBLIC` EXECUTE.
--
-- Source (a) alone was the earlier revision's approach and is insufficient; the
-- grantee-filtered variant was worse still. All three cases — a non-public grantee, a
-- role with no default-ACL row, and a role with only inherited or PUBLIC-derived CREATE
-- — are reproduced in tests/db/f-a16-least-privilege.test.ts.
--
-- Two entries are skipped deliberately:
--   * the applying role — already handled by sections 1–3;
--   * `pg_database_owner`, a pseudo-role that always owns the `public` schema in PG 15+
--     and always holds CREATE on it. It creates nothing itself; the `public` schema's
--     owner is the database owner. It is named in the code and in a test rather than
--     silently filtered.
--
-- If any candidate cannot be covered (`pg_has_role(..., 'MEMBER')` is false — the exact
-- precondition Postgres enforces for `ALTER DEFAULT PRIVILEGES FOR ROLE`), the block
-- raises. The whole migration then rolls back, so the database is never left in a
-- half-tightened state — and the remediation cannot be described as complete while a
-- role was skipped. The remedy is the split-out owner-run step:
-- docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql
DO $$
DECLARE
  target  text;
  skipped text[] := ARRAY[]::text[];
BEGIN
  FOR target IN
    SELECT DISTINCT candidate
      FROM (
        -- (a) any owner with a default ACL in public — NOT filtered by grantee.
        SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS candidate
          FROM pg_catalog.pg_default_acl d
         WHERE d.defaclnamespace = 'public'::regnamespace
        UNION
        -- (b) any role that EFFECTIVELY holds CREATE on public — direct, inherited
        --     through membership, or derived from a PUBLIC grant. `has_schema_privilege`
        --     is the catalog function that accounts for all three; a direct nspacl join
        --     accounts for only the first.
        SELECT r.rolname AS candidate
          FROM pg_catalog.pg_roles r
         WHERE pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE')
      ) AS candidates
     ORDER BY 1
  LOOP
    -- Already handled by sections 1–3.
    CONTINUE WHEN target = current_user;

    -- A pseudo-role that owns the schema but creates nothing.
    CONTINUE WHEN target = 'pg_database_owner';

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
-- a role that silently did nothing would otherwise pass unnoticed. This reads back the
-- default ACLs and refuses to commit while any public-facing grant remains.
-- `ALTER DEFAULT PRIVILEGES` is transactional (verified on PGlite), so a raise here
-- rolls the whole migration back.
--
-- The scope is deliberately stated: this verifies the roles the migration could see and
-- covered — the UNION of default-ACL owners and roles that effectively hold CREATE,
-- minus `pg_database_owner` — and it verifies that no GLOBAL default still leaks a table
-- or sequence to a public-facing role. It does NOT assert that every possible future
-- creator has been enumerated, because no catalog query can (see "Scope and limitations"
-- in the header). It fails if a covered role's revoke did not take effect, which is the
-- property that matters.
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
DO $$
DECLARE
  offenders text;
BEGIN
  -- (a) No public-facing grantee may remain in the `public` default ACLs, and no global
  --     default ACL may name a public-facing role for functions, tables or sequences.
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
          -- tables in public: service_role keeps DML, loses the two rights RLS cannot cover
       OR (d.defaclnamespace = 'public'::regnamespace
            AND d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRIGGER', 'REFERENCES'))
          -- functions in public: no public-facing role, and no implicit PUBLIC
       OR (d.defaclnamespace = 'public'::regnamespace
            AND d.defaclobjtype = 'f'
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          -- GLOBAL function default ACLs: no direct grant to a public-facing role or PUBLIC
       OR (d.defaclnamespace = 0
            AND d.defaclobjtype = 'f'
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          -- GLOBAL table/sequence default ACLs: a schema-scoped REVOKE cannot subtract
          -- these, so a residue here means section 0b's precondition was bypassed.
       OR (d.defaclnamespace = 0
            AND d.defaclobjtype IN ('r', 'S')
            AND (a.grantee = 0
                 OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          -- GLOBAL table default ACLs: TRIGGER/REFERENCES for service_role survive the
          -- schema-scoped revoke in section 1, so verify none is left behind.
       OR (d.defaclnamespace = 0
            AND d.defaclobjtype = 'r'
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRIGGER', 'REFERENCES'))
         );

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'F-A16-02: default privileges in public are still broader than intended: %', offenders
      USING HINT = 'The migration rolled back. Investigate before re-running; do not weaken this check.';
  END IF;

  -- (b) The implicit PUBLIC EXECUTE cannot be read from the ACL, so verify it is gone by
  --     requiring an explicit owner-only *global* entry for every candidate creator the
  --     migration covered. Without the global revoke no such entry exists, which is
  --     precisely the state that leaves PUBLIC able to execute future functions.
  --
  --     The candidate set is recomputed exactly as section 4 does — including effective
  --     (inherited or PUBLIC-derived) CREATE — so this cannot drift from what was covered.
  --     Any candidate that section 4 could not cover would have raised there, so every
  --     candidate reaching this point was covered.
  SELECT string_agg(DISTINCT c.rolname, ', ')
    INTO offenders
    FROM (
      SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS rolname
        FROM pg_catalog.pg_default_acl d
       WHERE d.defaclnamespace = 'public'::regnamespace
      UNION
      SELECT r.rolname
        FROM pg_catalog.pg_roles r
       WHERE pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE')
    ) AS c
   WHERE c.rolname <> 'pg_database_owner'
     AND NOT EXISTS (SELECT 1
                       FROM pg_catalog.pg_default_acl d,
                            pg_catalog.aclexplode(d.defaclacl) a,
                            pg_catalog.pg_roles rr
                      WHERE rr.rolname = c.rolname
                        AND d.defaclrole = rr.oid
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
