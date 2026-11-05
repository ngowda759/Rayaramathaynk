/**
 * F-A16-01 / F-A16-02b — behavioural tests on an in-process Postgres (PGlite).
 *
 * F-A16-01 revokes TRUNCATE / REFERENCES / TRIGGER on *existing* public tables. Those
 * three are the privileges RLS cannot compensate for, so revoking them is safe for
 * reads and writes; the tests below prove that, and prove the four public-read tables
 * keep their SELECT policy. F-A16-02b installs a forward guard that removes the
 * implicit PUBLIC EXECUTE from new public functions.
 *
 * Nothing here connects to a live database.
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

const EXISTING_PRIVS_MIGRATION = "20261115000200_f_a16_existing_table_privileges.sql";
const GUARD_MIGRATION = "20261114990000_f_a16_public_function_execute_guard.sql";

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

/** The platform's broad defaults, applied for the current role (as Supabase does for postgres). */
const PLATFORM_DEFAULTS_SELF = `
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
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

/** A public table plus its RLS SELECT policy, as the repo's public-read tables look. */
const PUBLIC_READ_TABLES = `
CREATE TABLE events (id int, published boolean);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read of published events" ON events FOR SELECT TO anon, authenticated USING (published = true);

CREATE TABLE aaradhanes (id int);
ALTER TABLE aaradhanes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read of aaradhanes" ON aaradhanes FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE site_settings (id int);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to site_settings" ON site_settings FOR SELECT TO public USING (true);

CREATE TABLE social_links (id int);
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to social_links" ON social_links FOR SELECT TO public USING (true);
`;

/** A table with a BEFORE TRUNCATE guard, as the seva tables have. */
const GUARDED_TABLE = `
CREATE TABLE guarded_tbl (id int);
CREATE FUNCTION public.no_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'no truncate'; END; $$;
CREATE TRIGGER guarded_no_truncate BEFORE TRUNCATE ON guarded_tbl
  FOR EACH STATEMENT EXECUTE FUNCTION public.no_truncate();
`;

describe("F-A16-01 existing table privileges (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  it("revokes TRUNCATE/REFERENCES/TRIGGER from anon and authenticated on existing tables", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE TABLE plain_tbl (id int);`);

    // Baseline: the platform grant gave both roles the whole set.
    expect(await tablePrivs(db, "anon", "plain_tbl")).toEqual(
      expect.arrayContaining(["TRUNCATE", "REFERENCES", "TRIGGER"])
    );

    await apply(db, EXISTING_PRIVS_MIGRATION);

    for (const role of ["anon", "authenticated"]) {
      const privs = await tablePrivs(db, role, "plain_tbl");
      expect(privs).not.toContain("TRUNCATE");
      expect(privs).not.toContain("REFERENCES");
      expect(privs).not.toContain("TRIGGER");
      // DML is deliberately left alone in this phase.
      expect(privs).toEqual(expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE"]));
    }
  });

  it("preserves public SELECT on the four approved public-read tables", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(PUBLIC_READ_TABLES);

    await apply(db, EXISTING_PRIVS_MIGRATION);

    for (const t of ["events", "aaradhanes", "site_settings", "social_links"]) {
      expect(await tablePrivs(db, "anon", t)).toContain("SELECT");
      expect(await tablePrivs(db, "authenticated", t)).toContain("SELECT");
      // And the RLS SELECT policy is untouched (the post-condition asserts this too).
      const pol = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_catalog.pg_policies
          WHERE schemaname = 'public' AND tablename = $1 AND cmd IN ('SELECT', 'ALL')
            AND permissive = 'PERMISSIVE' AND qual <> 'false'`,
        [t]
      );
      expect(pol.rows[0]!.n).toBeGreaterThan(0);
    }
  });

  it("keeps service_role DML but removes its TRUNCATE, TRIGGER and REFERENCES", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE TABLE backend_tbl (id int);`);

    await apply(db, EXISTING_PRIVS_MIGRATION);

    const privs = await tablePrivs(db, "service_role", "backend_tbl");
    expect(privs).toEqual(expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE"]));
    expect(privs).not.toContain("TRUNCATE");
    expect(privs).not.toContain("TRIGGER");
    expect(privs).not.toContain("REFERENCES");
  });

  it("revokes TRUNCATE from service_role even on a table with a BEFORE TRUNCATE guard", async () => {
    // F-A16-01 correction (2026-11-03): the guard does NOT depend on service_role holding
    // TRUNCATE — a BEFORE TRUNCATE trigger fires for the table owner and for superusers
    // too (measured on PostgreSQL 17/18). So there is no exception: service_role loses all
    // three here as everywhere else.
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(GUARDED_TABLE);

    await apply(db, EXISTING_PRIVS_MIGRATION);

    const privs = await tablePrivs(db, "service_role", "guarded_tbl");
    expect(privs).not.toContain("TRUNCATE");
    expect(privs).not.toContain("TRIGGER");
    expect(privs).not.toContain("REFERENCES");
    // And anon loses TRUNCATE too.
    expect(await tablePrivs(db, "anon", "guarded_tbl")).not.toContain("TRUNCATE");
  });

  it("leaves the BEFORE TRUNCATE guard effective for the owner (why the exception was removed)", async () => {
    // The premise behind the removed exception: the guard must remain effective even
    // without a TRUNCATE grant. Here the table owner truncates and the guard still fires.
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(GUARDED_TABLE);
    await db.exec(`INSERT INTO guarded_tbl VALUES (1);`);

    await apply(db, EXISTING_PRIVS_MIGRATION);

    await expect(db.exec(`TRUNCATE guarded_tbl;`)).rejects.toThrow(/no truncate/);
  });

  it("revokes TRUNCATE from service_role on a table without a guard", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE TABLE unguarded_tbl (id int);`);

    await apply(db, EXISTING_PRIVS_MIGRATION);
    expect(await tablePrivs(db, "service_role", "unguarded_tbl")).not.toContain("TRUNCATE");
  });

  it("does not touch any table outside the public schema", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE SCHEMA other; CREATE TABLE other.keep_me (id int);`);
    await db.exec(`CREATE TABLE public.public_tbl (id int);`);
    await db.exec(`GRANT ALL ON TABLE other.keep_me TO anon;`);

    await apply(db, EXISTING_PRIVS_MIGRATION);

    const privs = await db.query<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE grantee = 'anon' AND table_schema = 'other' AND table_name = 'keep_me'
        ORDER BY privilege_type`
    );
    expect(privs.rows.map((r) => r.privilege_type)).toEqual(
      expect.arrayContaining(["TRUNCATE", "REFERENCES", "TRIGGER", "SELECT"])
    );
  });

  it("is idempotent: applying it twice changes nothing further", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(PUBLIC_READ_TABLES);
    await db.exec(GUARDED_TABLE);

    await apply(db, EXISTING_PRIVS_MIGRATION);
    const after1 = await tablePrivs(db, "service_role", "guarded_tbl");
    await apply(db, EXISTING_PRIVS_MIGRATION);
    expect(await tablePrivs(db, "service_role", "guarded_tbl")).toEqual(after1);
    expect(await tablePrivs(db, "anon", "events")).toContain("SELECT");
  });

  it("fails closed when a public-read table's SELECT policy was removed", async () => {
    // The post-condition asserts the public-read surface is intact. If a policy is gone
    // it must raise (and roll back) rather than silently "succeed".
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(PUBLIC_READ_TABLES);
    await db.exec(`DROP POLICY "Allow public read of published events" ON events;`);

    await expect(apply(db, EXISTING_PRIVS_MIGRATION)).rejects.toThrow(
      /F-A16-01: public-read table\(s\) lost their SELECT policy: events/
    );

    // Rolled back: TRUNCATE is still present on an ordinary table (proving nothing stuck).
    const privs = await db.query<{ t: boolean }>(
      `SELECT has_table_privilege('anon', 'public.events', 'TRUNCATE') AS t`
    );
    expect(privs.rows[0]!.t).toBe(true);
  });
});

describe("F-A16-02b forward function-EXECUTE guard (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  it("revokes EXECUTE on a new public function from PUBLIC/anon/authenticated but not service_role", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, GUARD_MIGRATION);

    await db.exec(`CREATE FUNCTION public.brand_new() RETURNS int LANGUAGE sql AS 'SELECT 1';`);

    const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `SELECT has_function_privilege('anon', 'public.brand_new()', 'EXECUTE')          AS anon,
              has_function_privilege('authenticated', 'public.brand_new()', 'EXECUTE') AS auth,
              has_function_privilege('service_role', 'public.brand_new()', 'EXECUTE')  AS svc`
    );
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
  });

  it("revokes EXECUTE on a new public PROCEDURE too (ON ROUTINE, not ON FUNCTION)", async () => {
    // F-A16-02b correction (2026-11-03): `ON FUNCTION` rejects a procedure with
    // `is not a function`, which aborted the creating statement. The guard must use
    // `ON ROUTINE` so CREATE PROCEDURE succeeds and is still locked down.
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, GUARD_MIGRATION);

    await db.exec(`CREATE PROCEDURE public.brand_new_proc() LANGUAGE sql AS $$ SELECT 1; $$;`);

    const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `SELECT has_function_privilege('anon', 'public.brand_new_proc()', 'EXECUTE')          AS anon,
              has_function_privilege('authenticated', 'public.brand_new_proc()', 'EXECUTE') AS auth,
              has_function_privilege('service_role', 'public.brand_new_proc()', 'EXECUTE')  AS svc`
    );
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
  });

  it("does not touch functions created outside the public schema", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await db.exec(`CREATE SCHEMA other;`);
    await apply(db, GUARD_MIGRATION);

    await db.exec(`CREATE FUNCTION other.brand_new() RETURNS int LANGUAGE sql AS 'SELECT 1';`);
    const r = await db.query<{ p: boolean }>(
      `SELECT has_function_privilege('anon', 'other.brand_new()', 'EXECUTE') AS p`
    );
    expect(r.rows[0]!.p).toBe(true);
  });

  it("is idempotent and leaves exactly one guard trigger", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(PLATFORM_DEFAULTS_SELF);
    await apply(db, GUARD_MIGRATION);
    await apply(db, GUARD_MIGRATION);

    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_catalog.pg_event_trigger WHERE evtname = 'f_a16_public_fn_guard'`
    );
    expect(r.rows[0]!.n).toBe(1);
  });
});
