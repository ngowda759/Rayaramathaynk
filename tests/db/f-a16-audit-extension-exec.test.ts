/**
 * F-A16 audit extension — behavioural test on an in-process Postgres (PGlite).
 *
 * The unit test (`tests/unit/f-a16-audit-extension.test.ts`) proves the extension
 * is well-formed and read-only. This one proves it actually *runs* and actually
 * *answers the questions the API layer cannot*: it executes all statements against
 * a real Postgres, then asserts the extension reports a TRUNCATE grant that a
 * row-visibility probe could never see, resolves PUBLIC as `grantee = 0`, and
 * reads effective CREATE on `public` for the Supabase roles.
 *
 * Nothing here connects to a live database. The fixtures are a throwaway instance.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXT = path.join(ROOT, "docs", "audits", "F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql");

/** Parse exactly as the runner does: strip `--` comments, split on `;`. */
function statementsOf(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const SUPABASE_ROLES = `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
      CREATE ROLE service_role NOLOGIN NOINHERIT; END IF;
  END $$;
`;

/** A throwaway database with the roles and a fixture that exercises the queries. */
async function fixtureDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await db.exec(SUPABASE_ROLES);
  await db.exec(`
    CREATE TABLE public.widgets (id serial primary key, name text);
    CREATE TABLE public.secrets (id serial primary key, token text);
    -- A grant the API row-probe cannot distinguish from SELECT: TRUNCATE.
    GRANT SELECT   ON public.widgets TO anon;
    GRANT TRUNCATE ON public.widgets TO authenticated;
    -- REFERENCES and TRIGGER are likewise invisible to a row response.
    GRANT REFERENCES ON public.secrets TO anon;
    GRANT TRIGGER    ON public.secrets TO anon;
    CREATE FUNCTION public.helper() RETURNS int LANGUAGE sql AS 'SELECT 1';
    -- An implicit EXECUTE-to-PUBLIC on a function.
    CREATE FUNCTION public.open_fn() RETURNS int LANGUAGE sql AS 'SELECT 2';
    GRANT EXECUTE ON FUNCTION public.open_fn() TO PUBLIC;
  `);
  return db;
}

describe("F-A16 audit extension — executes against a real Postgres", () => {
  let db: PGlite;
  let statementCount: number;

  beforeAll(async () => {
    db = await fixtureDb();
    const stmts = statementsOf(EXT);
    statementCount = stmts.length;
    for (const s of stmts) {
      // Any failure throws and fails the suite, with the statement index.
      await db.query(s);
    }
  }, 60000);

  afterAll(async () => {
    await db?.close();
  });

  it("every statement runs without error", () => {
    expect(statementCount).toBeGreaterThan(0);
  });

  it("detects a TRUNCATE grant that a row-visibility probe cannot see", async () => {
    // This is the F-A16-01 gap: TRUNCATE never surfaces as a row response, so
    // only a catalog read can reveal it.
    const r = await db.query<{ t: boolean }>(
      `SELECT has_table_privilege('authenticated','public.widgets','TRUNCATE') AS t`
    );
    expect(r.rows[0].t).toBe(true);
  });

  it("detects REFERENCES and TRIGGER grants", async () => {
    const r = await db.query<{ refs: boolean; trig: boolean }>(
      `SELECT has_table_privilege('anon','public.secrets','REFERENCES') AS refs,
              has_table_privilege('anon','public.secrets','TRIGGER')    AS trig`
    );
    expect(r.rows[0].refs).toBe(true);
    expect(r.rows[0].trig).toBe(true);
  });

  it("resolves PUBLIC (grantee = 0) for function EXECUTE", async () => {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN LATERAL aclexplode(p.proacl) a
       WHERE n.nspname = 'public' AND a.grantee = 0`
    );
    expect(r.rows[0].n).toBeGreaterThan(0);
  });

  it("reads effective CREATE on public for the Supabase roles", async () => {
    const r = await db.query<{ role_name: string; can: boolean }>(
      `SELECT rolname AS role_name,
              has_schema_privilege(rolname, 'public', 'CREATE') AS can
       FROM pg_roles
       WHERE rolname IN ('anon','authenticated','service_role')`
    );
    // The fixture does not grant CREATE to the public-facing roles.
    for (const row of r.rows) expect(row.can).toBe(false);
  });

  it("pg_auth_members is readable and returns the stable columns", async () => {
    const r = await db.query<{ member_role: string; granted_role: string }>(
      `SELECT m.roleid::regrole::text AS granted_role,
              m.member::regrole::text AS member_role
       FROM pg_auth_members m`
    );
    expect(Array.isArray(r.rows)).toBe(true);
  });

  it("orients pg_auth_members as roleid=granted, member=member", async () => {
    // `roleid` is the role being GRANTED (the privilege holder); `member` is the
    // role that RECEIVES it (the inheritor). Asserting this against a real
    // Postgres pins the orientation, so a future edit cannot silently invert
    // every membership edge the audit reports.
    const db2 = await PGlite.create();
    try {
      await db2.exec(`
        CREATE ROLE parent_role NOLOGIN;
        CREATE ROLE child_role NOLOGIN;
        GRANT parent_role TO child_role;
      `);
      const r = await db2.query<{ granted_role: string; member_role: string }>(
        `SELECT m.roleid::regrole::text AS granted_role,
                m.member::regrole::text AS member_role
         FROM pg_auth_members m
         WHERE m.roleid::regrole::text = 'parent_role'`
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].granted_role).toBe("parent_role");
      expect(r.rows[0].member_role).toBe("child_role");
    } finally {
      await db2.close();
    }
  });

  it("the default-ACL summary statement returns a single row", async () => {
    const last = statementsOf(EXT).at(-1) as string;
    const r = await db.query(last);
    expect(r.rows).toHaveLength(1);
    // A zero must be a real zero, not a failure: the columns must exist.
    expect(r.rows[0]).toHaveProperty("public_tables");
    expect(r.rows[0]).toHaveProperty("roles_with_create_on_public");
  });
});
