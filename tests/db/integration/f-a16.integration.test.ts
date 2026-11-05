/**
 * F-A16 — REAL-PostgreSQL integration tests for the proposed migrations.
 *
 * These are NOT PGlite tests. They connect over the wire with `pg` to a DISPOSABLE
 * PostgreSQL/Supabase database and apply the two F-A16 migrations against a real role and
 * privilege model. They exist because PGlite runs as a superuser and cannot reproduce:
 *
 *   - the Supabase event-trigger privilege path (non-superuser `postgres` managing event
 *     triggers via supautils);
 *   - the fact that a `REVOKE` a role may not perform only WARNS
 *     (`no privileges could be revoked`) instead of raising;
 *   - `ALTER DEFAULT PRIVILEGES FOR ROLE` failing for a non-member;
 *   - the implicit `PUBLIC` EXECUTE on a function created by a superuser.
 *
 * SAFETY. The test refuses to run unless the target is positively identified as isolated:
 *   - `FA16_ALLOW_DISPOSABLE_DB=1` must be set, AND
 *   - `FA16_TEST_DB_URL` must point at localhost/127.0.0.1, OR its database name must
 *     contain `test`/`fa16`/`disposable`/`scratch`, AND
 *   - the URL must not name the production project ref (`SUPABASE_PROJECT_REF`).
 * If `FA16_TEST_DB_URL` is unset the whole suite is skipped. The connection string and any
 * password are never logged.
 *
 * Two connections are used:
 *   - `admin`  — the migration applier, as `postgres` (non-superuser on Supabase). This is
 *                the role the production migrations run as.
 *   - `super`  — a superuser (`supabase_admin` on the Supabase image), used only for the
 *                owner-run step and for environment prep. It never applies the migrations.
 *
 * Run: `npm run test:db:integration` with the environment described in
 * docs/audits/F-A16_INTEGRATION_VERIFICATION.md.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "..", "supabase", "migrations");

const GUARD_MIGRATION = "20261114990000_f_a16_public_function_execute_guard.sql";
const DEFAULTS_MIGRATION = "20261115000000_f_a16_least_privilege_defaults.sql";

const RAW_URL = process.env.FA16_TEST_DB_URL ?? "";
/** The superuser role on the disposable target (Supabase image default). */
const SUPER_ROLE = process.env.FA16_SUPERUSER_ROLE ?? "supabase_admin";

/**
 * Positively identify the target as an isolated, disposable database. Returns the parsed
 * URL or throws. Never includes the password in any thrown message.
 */
function assertDisposableTarget(raw: string): URL {
  const u = new URL(raw);
  const allowed = process.env.FA16_ALLOW_DISPOSABLE_DB === "1";
  const localHost = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
  const dbName = u.pathname.replace(/^\//, "");
  const looksDisposable = /(^|[_-])(test|fa16|disposable|scratch)/i.test(dbName);
  const prodRef = process.env.SUPABASE_PROJECT_REF ?? "";
  const namesProd = prodRef.length > 0 && raw.includes(prodRef);

  if (namesProd) {
    throw new Error(
      "FA16 integration test refused: the URL names the production project ref. Use a disposable database."
    );
  }
  if (!allowed) {
    throw new Error(
      "FA16 integration test refused: set FA16_ALLOW_DISPOSABLE_DB=1 to confirm the target is disposable."
    );
  }
  if (!localHost && !looksDisposable) {
    throw new Error(
      "FA16 integration test refused: target is neither localhost nor a name that looks disposable (test/fa16/disposable/scratch)."
    );
  }
  return u;
}

/** Replace the user in a connection URL, preserving host/port/db. Never logs the URL. */
function withUser(raw: string, user: string): string {
  const u = new URL(raw);
  u.username = user;
  return u.toString();
}

/** Quote an identifier for safe interpolation into DDL. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Quote a string literal for safe interpolation into DDL. Never logged. */
function pgLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The owner-run step for supabase_admin's public defaults, mirroring
 * docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql. Kept inline so the test does
 * not depend on the doc's exact line layout.
 */
const OWNER_RUN_PUBLIC_SQL = `
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
`;

/**
 * The owner-run superuser-owned forward guard, mirroring
 * docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql §5. supautils skips a
 * NON-superuser-owned event-trigger function when the DDL role is a superuser
 * (src/supautils.c, supautils_fmgr_hook), so a `supabase_admin`-created function is only
 * covered by a guard that is itself superuser-owned. `postgres` cannot create that, which
 * is why it is an owner-run step. Kept inline so the test does not depend on file layout.
 */
const OWNER_RUN_SU_GUARD_SQL = `
  CREATE OR REPLACE FUNCTION public.f_a16_public_fn_guard_su()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog
  AS $guard$
  DECLARE
    cmd record;
  BEGIN
    FOR cmd IN
      SELECT * FROM pg_event_trigger_ddl_commands()
       WHERE command_tag IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
         AND object_type IN ('function', 'procedure')
    LOOP
      CONTINUE WHEN cmd.schema_name IS NULL OR cmd.schema_name <> 'public';
      EXECUTE format(
        'REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC, anon, authenticated',
        cmd.object_identity
      );
      IF pg_catalog.has_function_privilege('anon', cmd.object_identity, 'EXECUTE')
         OR pg_catalog.has_function_privilege('authenticated', cmd.object_identity, 'EXECUTE')
      THEN
        RAISE EXCEPTION
          'F-A16-02b(su): could not revoke EXECUTE on % from anon/authenticated',
          cmd.object_identity;
      END IF;
    END LOOP;
  END;
  $guard$;
  REVOKE EXECUTE ON FUNCTION public.f_a16_public_fn_guard_su() FROM PUBLIC, anon, authenticated;
  DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su;
  CREATE EVENT TRIGGER f_a16_public_fn_guard_su
    ON ddl_command_end
    WHEN TAG IN ('CREATE FUNCTION', 'CREATE PROCEDURE')
    EXECUTE FUNCTION public.f_a16_public_fn_guard_su();
`;

const describeIf = RAW_URL ? describe : describe.skip;

/** A throwaway password for the disposable test roles. Not a secret: local container. */
const TEST_ROLE_PASSWORD = "fa16_disposable_pw";

describeIf("F-A16 real-PostgreSQL integration", () => {
  let admin: Client;
  let superClient: Client | null = null;
  let haveSuper = false;

  const sqlFile = (name: string): string => fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");

  /** Apply a migration file as `postgres` (the production applier). */
  async function applyAsPostgres(file: string): Promise<void> {
    await admin.query(`SET ROLE postgres`);
    try {
      await admin.query(sqlFile(file));
    } finally {
      await admin.query(`RESET ROLE`);
    }
  }

  /** Run SQL over the superuser connection (owner-run step / environment prep). */
  async function runAsSuper(sql: string): Promise<void> {
    if (!superClient) throw new Error("superuser connection unavailable");
    await superClient.query(`SET ROLE ${SUPER_ROLE}`);
    try {
      await superClient.query(sql);
    } finally {
      await superClient.query(`RESET ROLE`);
    }
  }

  /** Create (or recreate) a login role with a password, granting CREATE on public. */
  async function ensureLoginRole(role: string): Promise<void> {
    await dropRole(role);
    await admin.query(
      `CREATE ROLE ${quoteIdent(role)} LOGIN PASSWORD ${pgLiteral(TEST_ROLE_PASSWORD)}`
    );
    await admin.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${quoteIdent(role)}`);
  }

  /** Drop a role, removing its privileges on public first so the drop can succeed. */
  async function dropRole(role: string): Promise<void> {
    await admin
      .query(`REVOKE ALL ON SCHEMA public FROM ${quoteIdent(role)}`)
      .catch(() => undefined);
    await admin.query(`DROP OWNED BY ${quoteIdent(role)}`).catch(() => undefined);
    await admin.query(`DROP ROLE IF EXISTS ${quoteIdent(role)}`).catch(() => undefined);
  }

  /** Connect as a disposable login role. */
  async function connectAs(role: string): Promise<Client> {
    const u = new URL(RAW_URL);
    u.username = role;
    u.password = TEST_ROLE_PASSWORD;
    const c = new Client({ connectionString: u.toString() });
    await c.connect();
    return c;
  }

  beforeAll(async () => {
    const u = assertDisposableTarget(RAW_URL);
    const dbName = u.pathname.replace(/^\//, "");

    admin = new Client({ connectionString: RAW_URL });
    await admin.connect();

    // Try to establish a superuser connection. On the Supabase image this succeeds with
    // `supabase_admin`; on stock PostgreSQL it may not exist.
    try {
      superClient = new Client({ connectionString: withUser(RAW_URL, SUPER_ROLE) });
      await superClient.connect();
      await superClient.query(`SELECT 1`);
      haveSuper = true;
    } catch {
      haveSuper = false;
      superClient = null;
    }

    // Reproduce the production ownership: the database and public schema belong to
    // `postgres`, so `postgres` has the implicit CREATE on public that a real Supabase
    // project gives it. On the fresh image the DB defaults to `supabase_admin`'s
    // ownership, which would otherwise make the applier unable to create in public.
    if (haveSuper) {
      await superClient!.query(`ALTER DATABASE ${quoteIdent(dbName)} OWNER TO postgres`);
      await superClient!.query(`ALTER SCHEMA public OWNER TO pg_database_owner`);
    }

    // Public-facing roles. Created if missing; the image provides them already.
    await admin.query(`
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
    `);

    // Reproduce the Supabase platform's public-schema bootstrap. The image applies this
    // from docker-entrypoint-initdb.d/init-scripts/00000000000000-initial-schema.sql at
    // cluster init, so a database created later with CREATE DATABASE does NOT inherit it.
    // Without it a newly created function would not carry the platform's explicit
    // anon/authenticated/service_role EXECUTE that the F-A16 migrations exist to remove,
    // and the tests would silently stop exercising the real starting state. Statements are
    // the image's, run for each object-creating role (`postgres`, `supabase_admin`) the way
    // the image's separate `alter default privileges for user supabase_admin` lines do.
    const PLATFORM_PUBLIC_DEFAULTS = `
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
    `;
    await admin.query(`SET ROLE postgres`).then(() => admin.query(PLATFORM_PUBLIC_DEFAULTS));
    await admin.query(`RESET ROLE`);
    if (haveSuper) {
      await runAsSuper(PLATFORM_PUBLIC_DEFAULTS);
    }
  });

  afterAll(async () => {
    const cleanup = `
      DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard;
      DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su;
      DROP FUNCTION IF EXISTS public.f_a16_public_fn_guard();
      DROP FUNCTION IF EXISTS public.f_a16_public_fn_guard_su();
      DROP FUNCTION IF EXISTS public.fa16_a1_fn();
      DROP FUNCTION IF EXISTS public.fa16_a2_fn();
      DROP FUNCTION IF EXISTS public.fa16_a3_fn();
      DROP FUNCTION IF EXISTS public.fa16_a7_fn();
      DROP FUNCTION IF EXISTS public.fa16_b7_fn();
      DROP PROCEDURE IF EXISTS public.fa16_a6_proc();
      DROP TABLE IF EXISTS public.fa16_b4_tbl;
      DROP SEQUENCE IF EXISTS public.fa16_b4_seq;
      DROP FUNCTION IF EXISTS public.fa16_b4_fn();
      DROP SCHEMA IF EXISTS fa16_other CASCADE;
    `;
    await admin?.query(cleanup).catch(() => undefined);
    await dropRole("fa16_rogue_owner").catch(() => undefined);
    await dropRole("fa16_owner_member").catch(() => undefined);
    await admin?.end().catch(() => undefined);
    await superClient?.end().catch(() => undefined);
  });

  // ---------------------------------------------------------------------------------
  // Test A — F-A16-02b event trigger
  // ---------------------------------------------------------------------------------
  describe("Test A — F-A16-02b event trigger", () => {
    it("A.8 — the guard installs as postgres, is enabled, pinned, and not world-executable", async () => {
      await applyAsPostgres(GUARD_MIGRATION);

      const et = await admin.query<{ enabled: string; owner: string }>(
        `SELECT e.evtenabled::text AS enabled, pg_catalog.pg_get_userbyid(e.evtowner) AS owner
           FROM pg_event_trigger e WHERE e.evtname = 'f_a16_public_fn_guard'`
      );
      expect(et.rows).toHaveLength(1);
      expect(["O", "A"]).toContain(et.rows[0]!.enabled);

      const fn = await admin.query<{ owner: string; secdef: boolean; cfg: string[] }>(
        `SELECT pg_catalog.pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS secdef, p.proconfig AS cfg
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'f_a16_public_fn_guard'`
      );
      expect(fn.rows[0]!.secdef).toBe(true);
      expect((fn.rows[0]!.cfg ?? []).join(",")).toMatch(/search_path=pg_catalog/);

      const exec = await admin.query<{ anon: boolean; auth: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.f_a16_public_fn_guard()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('authenticated', 'public.f_a16_public_fn_guard()', 'EXECUTE') AS auth`
      );
      expect(exec.rows[0]).toEqual({ anon: false, auth: false });

      // On the Supabase image `postgres` is not a superuser yet creates the event trigger
      // (supautils). Record that the trigger is owned by the applier in that case.
      const who = await admin.query<{ r: string }>(
        `SELECT rolsuper::text AS r FROM pg_roles WHERE rolname = 'postgres'`
      );
      if (who.rows[0]!.r === "false") {
        expect(et.rows[0]!.owner).toBe("postgres");
      }
    });

    it("A.1 — a function created by postgres is not executable by anon/authenticated but is by service_role", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a1_fn();`);
      await admin.query(`CREATE FUNCTION public.fa16_a1_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
      const r = await admin.query<{ anon: boolean; auth: boolean; svc: boolean; owner: string }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.fa16_a1_fn()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('authenticated', 'public.fa16_a1_fn()', 'EXECUTE') AS auth,
                pg_catalog.has_function_privilege('service_role', 'public.fa16_a1_fn()', 'EXECUTE') AS svc,
                pg_catalog.pg_get_userbyid(p.proowner) AS owner
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'fa16_a1_fn'`
      );
      expect(r.rows[0]).toMatchObject({ anon: false, auth: false, svc: true });
      await admin.query(`SET ROLE ${r.rows[0]!.owner}`);
      const own = await admin.query(`SELECT public.fa16_a1_fn() AS v`);
      await admin.query(`RESET ROLE`);
      expect(own.rows[0]).toEqual({ v: 1 });
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a1_fn();`);
    });

    it("A.2 — a function created by an owner the guard CAN manage is created and locked down", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await ensureLoginRole("fa16_owner_member");
      await admin.query(`GRANT fa16_owner_member TO postgres`);
      // Give the member the platform-style function default ACL, so this mirrors a
      // production creator that has one. Without it, service_role would get EXECUTE only
      // through the implicit PUBLIC grant, which the guard removes.
      await admin.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE fa16_owner_member IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role`
      );
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a2_fn();`);
      const member = await connectAs("fa16_owner_member");
      try {
        await member.query(`CREATE FUNCTION public.fa16_a2_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
      } finally {
        await member.end();
      }
      const r = await admin.query<{ anon: boolean; auth: boolean; svc: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.fa16_a2_fn()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('authenticated', 'public.fa16_a2_fn()', 'EXECUTE') AS auth,
                pg_catalog.has_function_privilege('service_role', 'public.fa16_a2_fn()', 'EXECUTE') AS svc`
      );
      // The guard revoked anon/authenticated (and PUBLIC). service_role keeps EXECUTE from
      // the creator's own default ACL.
      expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a2_fn();`);
    });

    it("A.3 — a function created by a role the guard cannot manage fails closed; nothing survives", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await ensureLoginRole("fa16_rogue_owner");
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a3_fn();`);

      const rogue = await connectAs("fa16_rogue_owner");
      let failed = false;
      let message = "";
      try {
        await rogue.query(`CREATE FUNCTION public.fa16_a3_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
      } catch (e) {
        failed = true;
        message = e instanceof Error ? e.message : String(e);
      } finally {
        await rogue.end();
      }
      expect(failed).toBe(true);
      expect(message).toMatch(/F-A16-02b: could not revoke EXECUTE on/);

      const survived = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'fa16_a3_fn'`
      );
      expect(survived.rows[0]!.n).toBe("0");
    });

    it("A.4 — a function created outside public is not touched by the guard", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await admin.query(`
        CREATE SCHEMA IF NOT EXISTS fa16_other;
        DROP FUNCTION IF EXISTS fa16_other.fn();
        CREATE FUNCTION fa16_other.fn() RETURNS int LANGUAGE sql AS 'SELECT 1';
      `);
      const r = await admin.query<{ anon: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'fa16_other.fn()', 'EXECUTE') AS anon`
      );
      // Outside public the guard must not run, so the implicit PUBLIC EXECUTE remains.
      expect(r.rows[0]!.anon).toBe(true);
      await admin.query(`DROP SCHEMA IF EXISTS fa16_other CASCADE;`);
    });

    it("A.5 — CREATE OR REPLACE re-runs the guard and keeps the ACL correct", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a1_fn();`);
      await admin.query(`CREATE FUNCTION public.fa16_a1_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
      await admin.query(
        `CREATE OR REPLACE FUNCTION public.fa16_a1_fn() RETURNS int LANGUAGE sql AS 'SELECT 2'`
      );
      const r = await admin.query<{ anon: boolean; auth: boolean; svc: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.fa16_a1_fn()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('authenticated', 'public.fa16_a1_fn()', 'EXECUTE') AS auth,
                pg_catalog.has_function_privilege('service_role', 'public.fa16_a1_fn()', 'EXECUTE') AS svc`
      );
      expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a1_fn();`);
    });

    it("A.6 — a procedure in public is created and locked down (ON ROUTINE, not ON FUNCTION)", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await admin.query(`DROP PROCEDURE IF EXISTS public.fa16_a6_proc();`);
      await admin.query(`CREATE PROCEDURE public.fa16_a6_proc() LANGUAGE sql AS 'SELECT 1'`);
      const r = await admin.query<{ anon: boolean; svc: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.fa16_a6_proc()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('service_role', 'public.fa16_a6_proc()', 'EXECUTE') AS svc`
      );
      expect(r.rows[0]).toEqual({ anon: false, svc: true });
      await admin.query(`DROP PROCEDURE IF EXISTS public.fa16_a6_proc();`);
    });

    it("A.7 — a failing guard aborts the creating transaction atomically (no orphan)", async () => {
      await applyAsPostgres(GUARD_MIGRATION);
      await ensureLoginRole("fa16_rogue_owner");
      await admin.query(`DROP FUNCTION IF EXISTS public.fa16_a7_fn();`);
      const rogue = await connectAs("fa16_rogue_owner");
      let failed = false;
      try {
        await rogue.query("BEGIN");
        await rogue.query(`CREATE FUNCTION public.fa16_a7_fn() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
        await rogue.query("COMMIT");
      } catch {
        failed = true;
        await rogue.query("ROLLBACK").catch(() => undefined);
      } finally {
        await rogue.end();
      }
      expect(failed).toBe(true);
      const survived = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'fa16_a7_fn'`
      );
      expect(survived.rows[0]!.n).toBe("0");
    });
  });

  // ---------------------------------------------------------------------------------
  // Test B — F-A16-02 owner-specific default privileges
  // ---------------------------------------------------------------------------------
  describe("Test B — F-A16-02 owner-specific default privileges", () => {
    it("B.2 — F-A16-02 as postgres fails closed on supabase_admin and rolls back atomically", async () => {
      if (!haveSuper) {
        console.warn("B.2 skipped: no superuser connection (set FA16_SUPERUSER_ROLE)");
        return;
      }
      const before = await admin.query<{ rows: string }>(
        `SELECT coalesce(string_agg(defaclacl::text, '|' ORDER BY defaclobjtype), '') AS rows
           FROM pg_catalog.pg_default_acl
          WHERE defaclnamespace = 'public'::regnamespace`
      );
      let failed = false;
      let message = "";
      try {
        await applyAsPostgres(DEFAULTS_MIGRATION);
      } catch (e) {
        failed = true;
        message = e instanceof Error ? e.message : String(e);
      }
      expect(failed).toBe(true);
      expect(message).toMatch(
        /cannot tighten default privileges for object-creating role\(s\):.*supabase_admin/
      );
      const after = await admin.query<{ rows: string }>(
        `SELECT coalesce(string_agg(defaclacl::text, '|' ORDER BY defaclobjtype), '') AS rows
           FROM pg_catalog.pg_default_acl
          WHERE defaclnamespace = 'public'::regnamespace`
      );
      expect(after.rows[0]!.rows).toBe(before.rows[0]!.rows);
    });

    it("B.3 — the owner-run step tightens supabase_admin's public defaults", async () => {
      if (!haveSuper) {
        console.warn("B.3 skipped: no superuser connection");
        return;
      }
      await runAsSuper(OWNER_RUN_PUBLIC_SQL);

      const rows = await admin.query<{ defaclobjtype: string; acl: string }>(
        `SELECT defaclobjtype, defaclacl::text AS acl
           FROM pg_catalog.pg_default_acl
          WHERE defaclnamespace = 'public'::regnamespace
            AND pg_catalog.pg_get_userbyid(defaclrole) = 'supabase_admin'
          ORDER BY defaclobjtype`
      );
      const byType = Object.fromEntries(rows.rows.map((r) => [r.defaclobjtype, r.acl]));
      for (const t of ["r", "S", "f"]) {
        expect(byType[t] ?? "").not.toMatch(/(^|[,{])anon=/);
        expect(byType[t] ?? "").not.toMatch(/(^|[,{])authenticated=/);
      }
      // No PUBLIC entry (empty grantee) survives on tables; service_role keeps DML but
      // loses TRUNCATE.
      expect(byType["r"] ?? "").not.toMatch(/=r\//);
      expect(byType["r"] ?? "").toMatch(/service_role=arwd/);
      expect(byType["r"] ?? "").not.toMatch(/service_role=[a-zA-Z]*T/);
    });

    it("B.4 — new objects as supabase_admin follow the model; the superuser function gap is recorded", async () => {
      if (!haveSuper) {
        console.warn("B.4 skipped: no superuser connection");
        return;
      }
      // Ensure the superuser-owned guard is absent so the "before closure" gap is
      // observable on a re-run (B.7 installs it).
      await runAsSuper(`DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su;`);
      await runAsSuper(`
        DROP TABLE IF EXISTS public.fa16_b4_tbl;
        DROP SEQUENCE IF EXISTS public.fa16_b4_seq;
        DROP FUNCTION IF EXISTS public.fa16_b4_fn();
        CREATE TABLE public.fa16_b4_tbl (id serial primary key);
        CREATE SEQUENCE public.fa16_b4_seq;
        CREATE FUNCTION public.fa16_b4_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';
      `);
      const r = await admin.query<{
        tbl_anon: boolean;
        tbl_svc_select: boolean;
        tbl_svc_truncate: boolean;
        seq_anon: boolean;
        seq_svc: boolean;
        fn_anon: boolean;
        fn_auth: boolean;
        fn_svc: boolean;
      }>(
        `SELECT pg_catalog.has_table_privilege('anon', 'public.fa16_b4_tbl', 'SELECT')          AS tbl_anon,
                pg_catalog.has_table_privilege('service_role', 'public.fa16_b4_tbl', 'SELECT') AS tbl_svc_select,
                pg_catalog.has_table_privilege('service_role', 'public.fa16_b4_tbl', 'TRUNCATE') AS tbl_svc_truncate,
                pg_catalog.has_sequence_privilege('anon', 'public.fa16_b4_seq', 'USAGE')       AS seq_anon,
                pg_catalog.has_sequence_privilege('service_role', 'public.fa16_b4_seq', 'USAGE') AS seq_svc,
                pg_catalog.has_function_privilege('anon', 'public.fa16_b4_fn()', 'EXECUTE')    AS fn_anon,
                pg_catalog.has_function_privilege('authenticated', 'public.fa16_b4_fn()', 'EXECUTE') AS fn_auth,
                pg_catalog.has_function_privilege('service_role', 'public.fa16_b4_fn()', 'EXECUTE')  AS fn_svc`
      );
      expect(r.rows[0]).toMatchObject({
        tbl_anon: false,
        tbl_svc_select: true,
        tbl_svc_truncate: false,
        seq_anon: false,
        seq_svc: true,
      });
      const isSuper = await admin.query<{ r: boolean }>(
        `SELECT rolsuper AS r FROM pg_roles WHERE rolname = '${SUPER_ROLE}'`
      );
      if (isSuper.rows[0]!.r) {
        expect(r.rows[0]).toMatchObject({ fn_anon: true, fn_auth: true, fn_svc: true });
      }
      await admin.query(`
        DROP TABLE IF EXISTS public.fa16_b4_tbl;
        DROP SEQUENCE IF EXISTS public.fa16_b4_seq;
        DROP FUNCTION IF EXISTS public.fa16_b4_fn();
      `);
    });

    it("B.5 + convergence — the re-run converges after the owner-run, and is idempotent", async () => {
      if (!haveSuper) {
        console.warn("B.5 skipped: no superuser connection");
        return;
      }
      await expect(applyAsPostgres(DEFAULTS_MIGRATION)).resolves.toBeUndefined();
      await expect(applyAsPostgres(DEFAULTS_MIGRATION)).resolves.toBeUndefined();
    });

    it("B.6 — an unauthorized owner operation fails safely and changes nothing", async () => {
      if (!haveSuper) {
        console.warn("B.6 skipped: no superuser connection");
        return;
      }
      const before = await admin.query<{ acl: string }>(
        `SELECT defaclacl::text AS acl FROM pg_catalog.pg_default_acl
          WHERE defaclnamespace = 'public'::regnamespace
            AND pg_catalog.pg_get_userbyid(defaclrole) = 'supabase_admin'
            AND defaclobjtype = 'r'`
      );
      let failed = false;
      let message = "";
      try {
        await admin.query(
          `SET ROLE postgres;
           ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;`
        );
      } catch (e) {
        failed = true;
        message = e instanceof Error ? e.message : String(e);
      } finally {
        await admin.query(`RESET ROLE`).catch(() => undefined);
      }
      expect(failed).toBe(true);
      expect(message).toMatch(
        /must be member of role "supabase_admin"|permission denied|may not change/i
      );
      const after = await admin.query<{ acl: string }>(
        `SELECT defaclacl::text AS acl FROM pg_catalog.pg_default_acl
          WHERE defaclnamespace = 'public'::regnamespace
            AND pg_catalog.pg_get_userbyid(defaclrole) = 'supabase_admin'
            AND defaclobjtype = 'r'`
      );
      expect(after.rows[0]?.acl).toBe(before.rows[0]?.acl);
    });

    it("B.7 — the owner-run supabase_admin guard closes the superuser creator gap", async () => {
      if (!haveSuper) {
        console.warn("B.7 skipped: no superuser connection");
        return;
      }
      // 1. Under the postgres-owned migration guard alone, a supabase_admin-created
      //    function keeps PUBLIC EXECUTE and is reachable by anon/authenticated.
      await runAsSuper(`DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su;`);
      await applyAsPostgres(GUARD_MIGRATION);
      await runAsSuper(`DROP FUNCTION IF EXISTS public.fa16_b7_fn();`);
      await runAsSuper(
        `CREATE FUNCTION public.fa16_b7_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';`
      );
      const before = await admin.query<{ anon: boolean; auth: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.fa16_b7_fn()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('authenticated', 'public.fa16_b7_fn()', 'EXECUTE') AS auth`
      );
      expect(before.rows[0]).toMatchObject({ anon: true, auth: true });

      // 2. Install the superuser-owned guard (owner-run §5) and create again.
      await runAsSuper(OWNER_RUN_SU_GUARD_SQL);
      await runAsSuper(`DROP FUNCTION IF EXISTS public.fa16_b7_fn();`);
      await runAsSuper(
        `CREATE FUNCTION public.fa16_b7_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';`
      );
      const after = await admin.query<{ anon: boolean; auth: boolean; svc: boolean }>(
        `SELECT pg_catalog.has_function_privilege('anon', 'public.fa16_b7_fn()', 'EXECUTE') AS anon,
                pg_catalog.has_function_privilege('authenticated', 'public.fa16_b7_fn()', 'EXECUTE') AS auth,
                pg_catalog.has_function_privilege('service_role', 'public.fa16_b7_fn()', 'EXECUTE') AS svc`
      );
      expect(after.rows[0]).toMatchObject({ anon: false, auth: false, svc: true });
    });
  });
});
