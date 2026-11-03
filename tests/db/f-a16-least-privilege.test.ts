/**
 * F-A16-02 / F-A16-03 — behavioural tests on an in-process Postgres (PGlite).
 *
 * These apply the two PROPOSED migrations to a throwaway database that first
 * recreates the Supabase platform's roles and default privileges (the same baseline
 * `tests/db/harness.ts` uses for the seva suite). They prove the migrations do what
 * their headers claim, including the cases the review asked to be covered:
 *
 *   - F-A16-02 covers *every* object-creating role it can act for, and FAILS CLOSED
 *     (raising, and committing nothing) when a role it cannot act for still holds
 *     broad defaults — so the remediation can never be described as complete while a
 *     role was skipped;
 *   - F-A16-03 refuses to install without an enabled enabler, and rejects a public
 *     table created with RLS off even when the enabler is disabled.
 *
 * Nothing here connects to a live database. The migrations are *not* applied anywhere
 * except this in-memory instance.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { PGlite as PGliteCtor } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations"
);

const DEFAULTS_MIGRATION = "20261115000000_f_a16_least_privilege_defaults.sql";
const ASSERTION_MIGRATION = "20261115000100_f_a16_fail_closed_rls_assertion.sql";
const GUARD_MIGRATION = "20261114990000_f_a16_public_function_execute_guard.sql";
const EXISTING_PRIVS_MIGRATION = "20261115000200_f_a16_existing_table_privileges.sql";

const SUPABASE_ROLES = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`;

/** The platform's broad defaults, applied for the *current* role (as Supabase does for postgres). */
const PLATFORM_DEFAULTS_SELF = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

/** The same defaults, but owned by another role (`supabase_admin`). */
const PLATFORM_DEFAULTS_FOR_ADMIN = `
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

const RLS_ENABLER = `
CREATE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      AND object_type IN ('table','partitioned table') LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed on %', cmd.object_identity;
        RAISE;
      END;
    END IF;
  END LOOP;
END; $$;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
`;

async function newDb(): Promise<PGlite> {
  const db = await PGliteCtor.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  return db;
}

async function apply(db: PGlite, file: string): Promise<void> {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
}

/** Table privileges of `role` on `table`, as a sorted list. */
async function tablePrivs(db: PGlite, role: string, table: string): Promise<string[]> {
  const r = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = $1 AND table_schema = 'public' AND table_name = $2
      ORDER BY privilege_type`,
    [role, table]
  );
  return r.rows.map((row) => row.privilege_type);
}

/** Default-ACL rows for `public` that still name a public-facing grantee. */
async function publicFacingDefaults(
  db: PGlite
): Promise<Array<{ owner: string; objtype: string; grantee: string; privilege: string }>> {
  const r = await db.query<{ owner: string; objtype: string; grantee: string; privilege: string }>(
    `SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner,
            d.defaclobjtype                          AS objtype,
            CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                 ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
            a.privilege_type                         AS privilege
       FROM pg_catalog.pg_default_acl d,
            pg_catalog.aclexplode(d.defaclacl) a
      WHERE d.defaclnamespace = 'public'::regnamespace
        AND a.grantee <> d.defaclrole
        AND (
             (d.defaclobjtype IN ('r', 'S')
               AND (a.grantee = 0
                    OR pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated')))
          OR (d.defaclobjtype = 'r'
               AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
               AND a.privilege_type IN ('TRIGGER', 'REFERENCES'))
             -- Functions: only a DIRECT grant to a named role. The implicit PUBLIC
             -- EXECUTE (grantee = 0) is NOT removable per schema; it is closed forward
             -- by the function-EXECUTE guard migration, so it is not a "leak" here.
          OR (d.defaclobjtype = 'f'
               AND pg_catalog.pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'))
        )
      ORDER BY 1, 2, 3, 4`
  );
  return r.rows;
}

describe("F-A16-02 least-privilege defaults (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  it("baseline: a new public table is broadly writable by anon before the migration", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE TABLE public.before_mig (id int);`);
    const anon = await tablePrivs(db, "anon", "before_mig");
    // The platform default is the whole set; if this ever stops being true the
    // migration's premise is wrong and this test should be revisited, not deleted.
    expect(anon).toEqual(
      expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
    );
  });

  it("after the migration, a new public table grants anon/authenticated nothing", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE TABLE public.after_mig (id serial primary key);`);

    expect(await tablePrivs(db, "anon", "after_mig")).toEqual([]);
    expect(await tablePrivs(db, "authenticated", "after_mig")).toEqual([]);
  });

  it("after the migration, service_role keeps DML but loses TRIGGER and REFERENCES", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE TABLE public.backend_table (id int);`);

    const svc = await tablePrivs(db, "service_role", "backend_table");
    expect(svc).toEqual(expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE"]));
    expect(svc).not.toContain("TRIGGER");
    expect(svc).not.toContain("REFERENCES");
  });

  it("after the migration, anon/authenticated get no USAGE on a new sequence", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE SEQUENCE public.new_seq;`);

    const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `SELECT has_sequence_privilege('anon', 'public.new_seq', 'USAGE')          AS anon,
              has_sequence_privilege('authenticated', 'public.new_seq', 'USAGE') AS auth,
              has_sequence_privilege('service_role', 'public.new_seq', 'USAGE')  AS svc`
    );
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
  });

  it("after the migration, a new function is not executable by anon/authenticated but is by service_role", async () => {
    // The platform grants ALL ON FUNCTIONS to all three roles. The migration removes the
    // explicit grant to anon/authenticated per schema; the implicit PUBLIC EXECUTE it
    // leaves behind is closed by the forward guard migration, so the guard is applied
    // here to assert the end state an operator sees after both migrations.
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, DEFAULTS_MIGRATION);
    await apply(db, GUARD_MIGRATION);
    await db.exec(`CREATE FUNCTION public.new_fn() RETURNS int LANGUAGE sql AS 'select 1';`);

    const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `SELECT has_function_privilege('anon', 'public.new_fn()', 'EXECUTE')          AS anon,
              has_function_privilege('authenticated', 'public.new_fn()', 'EXECUTE') AS auth,
              has_function_privilege('service_role', 'public.new_fn()', 'EXECUTE')  AS svc`
    );
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
  });

  it("does not change the ACL of an object that already exists", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE TABLE public.preexisting (id int);`);
    const before = await tablePrivs(db, "anon", "preexisting");

    await apply(db, DEFAULTS_MIGRATION);

    expect(await tablePrivs(db, "anon", "preexisting")).toEqual(before);
  });

  it("is idempotent: applying it twice changes nothing further", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, DEFAULTS_MIGRATION);
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE TABLE public.after_twice (id int);`);
    expect(await tablePrivs(db, "anon", "after_twice")).toEqual([]);
  });

  it("leaves no public-facing default privilege behind (post-condition holds)", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, DEFAULTS_MIGRATION);
    expect(await publicFacingDefaults(db)).toEqual([]);
  });

  describe("multi-owner coverage and fail-closed behaviour", () => {
    /**
     * `supabase_admin` owns a separate default ACL. Whether the applying role can act
     * for it decides between "covered" and "must fail closed", and that is exactly the
     * distinction the review asked to be proven.
     */
    async function withAdminOwnedDefaults(canActForAdmin: boolean): Promise<PGlite> {
      const d = await newDb();
      await d.exec(SUPABASE_ROLES);
      await d.exec(`CREATE ROLE supabase_admin NOLOGIN;`);
      await d.exec(`GRANT USAGE, CREATE ON SCHEMA public TO supabase_admin;`);
      await d.exec(PLATFORM_DEFAULTS_FOR_ADMIN);
      if (canActForAdmin) {
        // Make the applying role a member of supabase_admin, which is the exact
        // precondition Postgres enforces for ALTER DEFAULT PRIVILEGES FOR ROLE.
        await d.exec(
          "DO $$ BEGIN EXECUTE 'GRANT supabase_admin TO ' || quote_ident(current_user); END $$;"
        );
      }
      return d;
    }

    it("tightens the defaults of another object-creating role when it may act for it", async () => {
      db = await withAdminOwnedDefaults(true);
      await apply(db, DEFAULTS_MIGRATION);

      expect(await publicFacingDefaults(db)).toEqual([]);

      // And the tightening is real for that role, not just for the applier: a table
      // created as supabase_admin gets nothing for anon.
      await db.exec(`SET ROLE supabase_admin; CREATE TABLE public.admin_table (id int); RESET ROLE;`);
      expect(await tablePrivs(db, "anon", "admin_table")).toEqual([]);
    });

    it("fails closed, and commits nothing, when a role it cannot act for keeps broad defaults", async () => {
      // The PGlite default session is a superuser, and Postgres reports a superuser as
      // a member of every role, so the applier is switched to a plain role to model a
      // non-superuser Supabase `postgres`.
      db = await withAdminOwnedDefaults(false);
      await db.exec(`CREATE ROLE applier NOLOGIN; GRANT USAGE, CREATE ON SCHEMA public TO applier;`);

      const before = await publicFacingDefaults(db);
      expect(before.length).toBeGreaterThan(0);

      await db.exec(`SET ROLE applier;`);
      // The message names every creator the applier cannot act for. `supabase_admin` is
      // the one this test set up; `postgres` also appears because a superuser reports
      // CREATE via `has_schema_privilege` and the applier is not a superuser.
      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: cannot tighten default privileges for object-creating role\(s\): .*supabase_admin/
      );
      await db.exec(`RESET ROLE;`);

      // The raise rolled the whole migration back: nothing was half-applied, and the
      // skipped role's defaults are untouched.
      expect(await publicFacingDefaults(db)).toEqual(before);
    });
  });

  /**
   * Discovery must be a complete inventory, not a targeted search for rows that name
   * `anon`/`authenticated`/`service_role`. The two cases below are exactly what a
   * grantee-filtered discovery misses, and both leave a creator whose future functions
   * are executable by the public-facing roles.
   */
  /**
   * Discovery must be a complete inventory, not a targeted search for rows that name
   * `anon`/`authenticated`/`service_role`. A grantee-filtered discovery misses a role
   * whose public default ACL names only some other grantee, and silently reports it as
   * covered.
   */
  describe("discovery is an inventory, not a grantee-filtered search", () => {
    it("enumerates a creator whose public default ACL names only a non-public grantee", async () => {
      // `temple_creator` owns a `pg_default_acl` row for `public`, but it names
      // `reporting_role` — not anon/authenticated/service_role. A grantee-filtered
      // discovery would not see this role at all, and would silently succeed. The
      // unfiltered inventory puts it in the candidate set, so an applier that cannot
      // act for it must fail closed rather than skip it.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(`
        CREATE ROLE reporting_role NOLOGIN;
        CREATE ROLE temple_creator NOLOGIN;
        GRANT USAGE ON SCHEMA public TO reporting_role, temple_creator;
        GRANT CREATE ON SCHEMA public TO temple_creator;
      `);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(
        `ALTER DEFAULT PRIVILEGES FOR ROLE temple_creator IN SCHEMA public GRANT SELECT ON TABLES TO reporting_role;`
      );

      // Pre-condition: the old grantee filter really would have missed it.
      const filtered = await db.query<{ owner: string }>(
        `SELECT DISTINCT pg_catalog.pg_get_userbyid(d.defaclrole) AS owner
           FROM pg_catalog.pg_default_acl d
          WHERE d.defaclnamespace = 'public'::regnamespace
            AND d.defaclacl::text ~ '(^|[,{])(anon|authenticated|service_role)='`
      );
      expect(filtered.rows.map((r) => r.owner)).not.toContain("temple_creator");

      // As an applier that is not a member of temple_creator, the migration must name it
      // and fail closed — proof it was enumerated rather than silently skipped.
      await db.exec(`CREATE ROLE applier NOLOGIN; GRANT USAGE, CREATE ON SCHEMA public TO applier;`);
      await db.exec(`SET ROLE applier;`);
      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: cannot tighten default privileges for object-creating role\(s\): .*temple_creator/
      );
      await db.exec(`RESET ROLE;`);
    });

    it("does NOT enumerate a CREATE holder with no default ACL row (documented limitation)", async () => {
      // `ghost_creator` can create in `public` but owns no `pg_default_acl` row, so no
      // query against that catalog can discover it. This migration does NOT claim to
      // cover it — a deliberate, documented limitation (migration header; plan §2.6).
      // The properties that matter are proven here:
      //   1. it is absent from the candidate set, so the migration still runs;
      //   2. its new TABLES are owner-only anyway (the hardwired default);
      //   3. its new FUNCTIONS' implicit PUBLIC EXECUTE is closed by the forward guard.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(`
        CREATE ROLE ghost_creator NOLOGIN;
        GRANT USAGE, CREATE ON SCHEMA public TO ghost_creator;
      `);
      await db.exec(PLATFORM_DEFAULTS_SELF);

      // Pre-condition: genuinely absent from the default-ACL catalog.
      const rows = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM pg_catalog.pg_default_acl d
          WHERE pg_catalog.pg_get_userbyid(d.defaclrole) = 'ghost_creator'`
      );
      expect(rows.rows[0]!.n).toBe(0);

      await apply(db, DEFAULTS_MIGRATION);

      // (2) A table ghost_creator creates is owner-only (no anon privilege).
      await db.exec(`SET ROLE ghost_creator; CREATE TABLE public.gc_tbl (id int); RESET ROLE;`);
      expect(await tablePrivs(db, "anon", "gc_tbl")).toEqual([]);

      // (3) A function it creates IS anon-executable through the implicit PUBLIC
      // EXECUTE before the guard is installed...
      await db.exec(
        `SET ROLE ghost_creator; CREATE FUNCTION public.gc_before() RETURNS int LANGUAGE sql AS 'SELECT 1'; RESET ROLE;`
      );
      const before = await db.query<{ p: boolean }>(
        `SELECT has_function_privilege('anon', 'public.gc_before()', 'EXECUTE') AS p`
      );
      expect(before.rows[0]!.p).toBe(true);

      // ...and the forward guard closes it for any creator, including one this
      // migration cannot enumerate.
      await apply(db, GUARD_MIGRATION);
      await db.exec(
        `SET ROLE ghost_creator; CREATE FUNCTION public.gc_after() RETURNS int LANGUAGE sql AS 'SELECT 1'; RESET ROLE;`
      );
      const after = await db.query<{ p: boolean }>(
        `SELECT has_function_privilege('anon', 'public.gc_after()', 'EXECUTE') AS p`
      );
      expect(after.rows[0]!.p).toBe(false);
    });

    it("skips pg_database_owner rather than failing on the pseudo-role", async () => {
      // `pg_database_owner` always holds CREATE on `public` in PG 15+, and in some setups
      // also owns a default ACL there. It creates nothing itself, so treating it as an
      // uncoverable creator would make the migration fail on every database. It must be
      // skipped, and the run must still succeed.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);

      const owners = await db.query<{ rolname: string }>(
        `SELECT r.rolname
           FROM pg_catalog.pg_namespace n,
                pg_catalog.aclexplode(n.nspacl) a,
                pg_catalog.pg_roles r
          WHERE n.nspname = 'public' AND a.privilege_type = 'CREATE' AND r.oid = a.grantee`
      );
      expect(owners.rows.map((r) => r.rolname)).toContain("pg_database_owner");

      await expect(apply(db, DEFAULTS_MIGRATION)).resolves.toBeUndefined();
      expect(await publicFacingDefaults(db)).toEqual([]);
    });
  });

  /**
   * A public-facing role must never hold CREATE on `public`: it is a misconfiguration the
   * migration cannot fix (removing it is a schema-ACL change, F-A16-01 scope), and it
   * makes "public-facing role" and "creator" overlap. Section 0c fails closed on it.
   */
  describe("public-facing role holding CREATE on public (fail closed)", () => {
    it("fails closed when CREATE is granted to PUBLIC", async () => {
      // `GRANT CREATE ON SCHEMA public TO PUBLIC` has grantee OID 0, which matches no
      // `pg_roles` row, so a direct join drops it entirely — yet it makes every role
      // (including anon/authenticated) an effective creator.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(`GRANT CREATE ON SCHEMA public TO PUBLIC;`);
      await db.exec(PLATFORM_DEFAULTS_SELF);

      const eff = await db.query<{ rolname: string; c: boolean }>(
        `SELECT r.rolname, pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE') AS c
           FROM pg_catalog.pg_roles r
          WHERE r.rolname IN ('anon', 'authenticated', 'service_role') ORDER BY 1`
      );
      expect(eff.rows.every((r) => r.c)).toBe(true);

      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: public-facing role\(s\) hold CREATE on schema public:/
      );
    });

    it("fails closed when a public-facing role is granted CREATE directly", async () => {
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(`GRANT CREATE ON SCHEMA public TO authenticated;`);
      await db.exec(PLATFORM_DEFAULTS_SELF);

      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: public-facing role\(s\) hold CREATE on schema public: authenticated/
      );
    });
  });

  /**
   * Global default ACLs. A schema-scoped REVOKE cannot subtract a globally-granted
   * default, so for tables and sequences the migration must refuse to run rather than
   * report a success that is not real.
   */
  describe("global table and sequence default ACLs (fail closed)", () => {
    it("global GRANT SELECT ON TABLES TO PUBLIC is not subtracted by a schema REVOKE", async () => {
      // This is the measurement that motivates the precondition: prove the bypass exists
      // before asserting the migration refuses it.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC;`);
      await db.exec(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;`
      );
      await db.exec(`CREATE TABLE public.bypass_tbl (id int);`);

      const r = await db.query<{ p: boolean }>(
        `SELECT has_table_privilege('anon', 'public.bypass_tbl', 'SELECT') AS p`
      );
      expect(r.rows[0]!.p).toBe(true);
    });

    it("refuses to run while a global table default grants a public-facing role", async () => {
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon;`);

      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: global default privileges confer future objects on public-facing roles:/
      );
    });

    it("refuses to run while a global sequence default grants a public-facing role", async () => {
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT USAGE ON SEQUENCES TO authenticated;`);

      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: global default privileges confer future objects on public-facing roles:/
      );
    });

    it("still applies when only a global PUBLIC function default exists (handled forward, not refused)", async () => {
      // A global PUBLIC function default is deliberately NOT refused by section 0b and is
      // NOT remediated by this migration (removing it needs a global statement, which
      // would change every schema). It is closed forward by the guard migration. So the
      // migration must apply cleanly and leave the global PUBLIC entry alone.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;`);

      await expect(apply(db, DEFAULTS_MIGRATION)).resolves.toBeUndefined();
      expect(await publicFacingDefaults(db)).toEqual([]);
    });
  });

  /**
   * Global table defaults for `service_role`. Section 1 revokes TRIGGER and REFERENCES
   * from service_role with an `IN SCHEMA public` statement — but a GLOBAL grant of either
   * survives that schema-scoped revoke and still lands on future public tables. The
   * migration must refuse rather than report a success that is not real.
   */
  describe("global service_role TRIGGER/REFERENCES defaults (fail closed)", () => {
    it("a global TRIGGER grant to service_role survives the schema-scoped revoke", async () => {
      // Measure the bypass first, so the refusal below is anchored in a real behaviour.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT TRIGGER ON TABLES TO service_role;`);
      await db.exec(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role;`
      );
      await db.exec(`CREATE TABLE public.sr_trg (id int);`);

      const r = await db.query<{ trg: boolean }>(
        `SELECT has_table_privilege('service_role', 'public.sr_trg', 'TRIGGER') AS trg`
      );
      expect(r.rows[0]!.trg).toBe(true);
    });

    it("a global REFERENCES grant to service_role survives the schema-scoped revoke", async () => {
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT REFERENCES ON TABLES TO service_role;`);
      await db.exec(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role;`
      );
      await db.exec(`CREATE TABLE public.sr_ref (id int);`);

      const r = await db.query<{ refs: boolean }>(
        `SELECT has_table_privilege('service_role', 'public.sr_ref', 'REFERENCES') AS refs`
      );
      expect(r.rows[0]!.refs).toBe(true);
    });

    it("refuses to run while a global TRIGGER default grants service_role", async () => {
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT TRIGGER ON TABLES TO service_role;`);

      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: global default privileges confer future objects on public-facing roles:/
      );
    });

    it("refuses to run while a global REFERENCES default grants service_role", async () => {
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT REFERENCES ON TABLES TO service_role;`);

      await expect(apply(db, DEFAULTS_MIGRATION)).rejects.toThrow(
        /F-A16-02: global default privileges confer future objects on public-facing roles:/
      );
    });

    it("still applies when a global DML default grants service_role (not refused)", async () => {
      // service_role keeps DML on future tables by design. Only TRIGGER and REFERENCES are
      // the exception, so a global SELECT/INSERT/UPDATE/DELETE default must NOT be refused.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;`);

      await expect(apply(db, DEFAULTS_MIGRATION)).resolves.toBeUndefined();
      expect(await publicFacingDefaults(db)).toEqual([]);
    });

    it("the owner-run global remediation removes both privileges and keeps DML", async () => {
      // Reproduces owner-run step 4 + 4b: after the explicit global revoke, no global
      // TRIGGER/REFERENCES entry remains for service_role, and a new table still carries
      // the DML defaults the application depends on.
      db = await newDb();
      await db.exec(SUPABASE_ROLES);
      await db.exec(PLATFORM_DEFAULTS_SELF);
      await db.exec(`ALTER DEFAULT PRIVILEGES GRANT TRIGGER, REFERENCES ON TABLES TO service_role;`);

      // Owner-run step 4 (global form — the operator's explicit, reviewed action).
      await db.exec(
        `ALTER DEFAULT PRIVILEGES REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role;`
      );

      // Owner-run step 4b: no residue.
      const residue = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM pg_catalog.pg_default_acl d, pg_catalog.aclexplode(d.defaclacl) a
          WHERE d.defaclnamespace = 0 AND d.defaclobjtype = 'r'
            AND a.grantee <> d.defaclrole
            AND pg_catalog.pg_get_userbyid(a.grantee) = 'service_role'
            AND a.privilege_type IN ('TRIGGER', 'REFERENCES')`
      );
      expect(residue.rows[0]!.n).toBe(0);

      // And the migration now proceeds, leaving nothing behind.
      await expect(apply(db, DEFAULTS_MIGRATION)).resolves.toBeUndefined();
      expect(await publicFacingDefaults(db)).toEqual([]);

      // Ordinary service_role DML on a future table is intact.
      await db.exec(`CREATE TABLE public.sr_dml (id int);`);
      const dml = await db.query<{ s: boolean; i: boolean; u: boolean; d: boolean; trg: boolean; refs: boolean }>(
        `SELECT has_table_privilege('service_role','public.sr_dml','SELECT')     AS s,
                has_table_privilege('service_role','public.sr_dml','INSERT')     AS i,
                has_table_privilege('service_role','public.sr_dml','UPDATE')     AS u,
                has_table_privilege('service_role','public.sr_dml','DELETE')     AS d,
                has_table_privilege('service_role','public.sr_dml','TRIGGER')    AS trg,
                has_table_privilege('service_role','public.sr_dml','REFERENCES') AS refs`
      );
      expect(dml.rows[0]).toMatchObject({ s: true, i: true, u: true, d: true, trg: false, refs: false });
    });
  });
});

describe("F-A16-03 fail-closed RLS assertion (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  /** Roles plus an enabled platform-style enabler. */
  async function withEnabledEnabler(): Promise<PGlite> {
    const d = await newDb();
    await d.exec(SUPABASE_ROLES);
    await d.exec(RLS_ENABLER);
    return d;
  }

  it("installs only when an enabled enabler exists, and leaves the repo pattern working", async () => {
    db = await withEnabledEnabler();
    await apply(db, ASSERTION_MIGRATION);

    // The repository's own pattern: CREATE TABLE followed by an explicit ENABLE.
    await db.exec(
      `CREATE TABLE public.repo_pattern (id int); ALTER TABLE public.repo_pattern ENABLE ROW LEVEL SECURITY;`
    );

    const r = await db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'repo_pattern'`
    );
    expect(r.rows[0].relrowsecurity).toBe(true);
  });

  it("refuses to install when no enabler is present", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);

    await expect(apply(db, ASSERTION_MIGRATION)).rejects.toThrow(
      /F-A16-03: no ddl_command_end event trigger calls rls_auto_enable\(\)/
    );

    // And it did not leave a half-installed assertion behind.
    const r = await db.query<{ evtname: string }>(
      `SELECT evtname FROM pg_event_trigger WHERE evtname = 'f_a16_assert_public_rls'`
    );
    expect(r.rows).toHaveLength(0);
  });

  it("refuses to install when the enabler exists but is disabled", async () => {
    db = await withEnabledEnabler();
    await db.exec(`ALTER EVENT TRIGGER ensure_rls DISABLE;`);

    await expect(apply(db, ASSERTION_MIGRATION)).rejects.toThrow(
      /F-A16-03: the RLS enabler trigger ensure_rls exists but is not enabled/
    );
  });

  it("rejects a public table created with RLS off once the enabler is disabled", async () => {
    db = await withEnabledEnabler();
    await apply(db, ASSERTION_MIGRATION);
    await db.exec(`ALTER EVENT TRIGGER ensure_rls DISABLE;`);

    await expect(db.exec(`CREATE TABLE public.unsafe_table (id int);`)).rejects.toThrow(
      /F-A16-03: refusing to create public table/
    );

    // The failed creation must not have left a table behind.
    const r = await db.query<{ relname: string }>(
      `SELECT relname FROM pg_class WHERE relname = 'unsafe_table'`
    );
    expect(r.rows).toHaveLength(0);
  });

  it("does not fire when CREATE TABLE IF NOT EXISTS skips an existing table", async () => {
    db = await withEnabledEnabler();
    await apply(db, ASSERTION_MIGRATION);
    await db.exec(`CREATE TABLE public.once (id int);`);

    // The event does not fire for a skipped IF NOT EXISTS, so re-running a migration
    // file is not a spurious failure.
    await expect(db.exec(`CREATE TABLE IF NOT EXISTS public.once (id int);`)).resolves.toBeDefined();
  });

  it("is idempotent and leaves the platform trigger untouched", async () => {
    db = await withEnabledEnabler();
    await apply(db, ASSERTION_MIGRATION);
    await apply(db, ASSERTION_MIGRATION);

    const r = await db.query<{ evtname: string }>(
      `SELECT evtname FROM pg_event_trigger WHERE evtname IN ('ensure_rls', 'f_a16_assert_public_rls') ORDER BY evtname`
    );
    expect(r.rows.map((row) => row.evtname)).toEqual(["ensure_rls", "f_a16_assert_public_rls"]);
  });

  it("does not affect tables created outside the public schema", async () => {
    db = await withEnabledEnabler();
    await db.exec(`CREATE SCHEMA other;`);
    await apply(db, ASSERTION_MIGRATION);

    // RLS is not auto-enabled outside public and the assertion must not fire.
    await db.exec(`CREATE TABLE other.not_public (id int);`);
    const r = await db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'not_public'`
    );
    expect(r.rows[0].relrowsecurity).toBe(false);
  });
});
