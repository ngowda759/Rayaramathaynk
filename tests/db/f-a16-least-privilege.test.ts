/**
 * F-A16-02 / F-A16-03 — behavioural tests on an in-process Postgres (PGlite).
 *
 * These apply the two PROPOSED migrations to a throwaway database that first
 * recreates the Supabase platform's roles and default privileges (the same
 * baseline `tests/db/harness.ts` uses for the seva suite). They prove the
 * migrations do what their headers claim:
 *
 *   - F-A16-02: after the defaults migration, a NEW public table/sequence/function
 *     created by the object-owning role carries no privilege for `anon` or
 *     `authenticated`, while `service_role` keeps the rights the application needs;
 *   - F-A16-03: after the assertion migration, a public table created with RLS off
 *     is rejected, and one created with RLS on is accepted.
 *
 * Nothing here connects to a live database. The migrations are *not* applied
 * anywhere except this in-memory instance.
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

/** The Supabase platform's starting state: roles plus the broad default ACLs. */
const PLATFORM_BASELINE = `
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

async function platformDb(): Promise<PGlite> {
  const db = await PGliteCtor.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await db.exec(PLATFORM_BASELINE);
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

describe("F-A16-02 least-privilege defaults (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  it("baseline: a new public table is broadly writable by anon before the migration", async () => {
    db = await platformDb();
    await db.exec(`CREATE TABLE public.before_mig (id int);`);
    const anon = await tablePrivs(db, "anon", "before_mig");
    // The platform default is the whole set; if this ever stops being true the
    // migration's premise is wrong and this test should be revisited, not deleted.
    expect(anon).toEqual(
      expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
    );
  });

  it("after the migration, a new public table grants anon/authenticated nothing", async () => {
    db = await platformDb();
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE TABLE public.after_mig (id serial primary key);`);

    expect(await tablePrivs(db, "anon", "after_mig")).toEqual([]);
    expect(await tablePrivs(db, "authenticated", "after_mig")).toEqual([]);
  });

  it("after the migration, service_role keeps DML but loses TRIGGER and REFERENCES", async () => {
    db = await platformDb();
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE TABLE public.backend_table (id int);`);

    const svc = await tablePrivs(db, "service_role", "backend_table");
    expect(svc).toEqual(expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE"]));
    expect(svc).not.toContain("TRIGGER");
    expect(svc).not.toContain("REFERENCES");
  });

  it("after the migration, anon/authenticated get no USAGE on a new sequence", async () => {
    db = await platformDb();
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
    db = await platformDb();
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE FUNCTION public.new_fn() RETURNS int LANGUAGE sql AS 'select 1';`);

    const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
      `SELECT has_function_privilege('anon', 'public.new_fn()', 'EXECUTE')          AS anon,
              has_function_privilege('authenticated', 'public.new_fn()', 'EXECUTE') AS auth,
              has_function_privilege('service_role', 'public.new_fn()', 'EXECUTE')  AS svc`
    );
    expect(r.rows[0]).toEqual({ anon: false, auth: false, svc: true });
  });

  it("does not change the ACL of an object that already exists", async () => {
    db = await platformDb();
    await db.exec(`CREATE TABLE public.preexisting (id int);`);
    const before = await tablePrivs(db, "anon", "preexisting");

    await apply(db, DEFAULTS_MIGRATION);

    expect(await tablePrivs(db, "anon", "preexisting")).toEqual(before);
  });

  it("is idempotent: applying it twice changes nothing further", async () => {
    db = await platformDb();
    await apply(db, DEFAULTS_MIGRATION);
    await apply(db, DEFAULTS_MIGRATION);
    await db.exec(`CREATE TABLE public.after_twice (id int);`);
    expect(await tablePrivs(db, "anon", "after_twice")).toEqual([]);
  });
});

describe("F-A16-03 fail-closed RLS assertion (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  /**
   * Install the assertion plus a *working* enabler, so the success path can be
   * exercised. The enabler mirrors the platform body; the assertion is the file
   * under test.
   */
  async function withWorkingEnabler(): Promise<PGlite> {
    const d = await platformDb();
    await d.exec(`
CREATE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      AND object_type IN ('table','partitioned table') LOOP
    IF cmd.schema_name = 'public' THEN
      EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
    END IF;
  END LOOP;
END; $$;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
`);
    return d;
  }

  it("accepts a public table that the enabler turned RLS on for", async () => {
    db = await withWorkingEnabler();
    await apply(db, ASSERTION_MIGRATION);
    await db.exec(`CREATE TABLE public.ok_table (id int);`);

    const r = await db.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'ok_table'`
    );
    expect(r.rows[0].relrowsecurity).toBe(true);
  });

  it("rejects a public table created with RLS off (enabler absent)", async () => {
    db = await platformDb(); // no enabler installed
    await apply(db, ASSERTION_MIGRATION);

    await expect(db.exec(`CREATE TABLE public.unsafe_table (id int);`)).rejects.toThrow(
      /F-A16-03: refusing to create public table/
    );

    // The failed creation must not have left a table behind.
    const r = await db.query<{ relname: string }>(
      `SELECT relname FROM pg_class WHERE relname = 'unsafe_table'`
    );
    expect(r.rows).toHaveLength(0);
  });

  it("rejects a table created with RLS explicitly disabled after creation", async () => {
    // A CREATE TABLE AS that disables RLS in the same statement still ends with
    // RLS off, so the assertion must catch it.
    db = await platformDb();
    await apply(db, ASSERTION_MIGRATION);

    await expect(
      db.exec(`CREATE TABLE public.cta_unsafe AS SELECT 1 AS id; ALTER TABLE public.cta_unsafe DISABLE ROW LEVEL SECURITY;`)
    ).rejects.toThrow(/F-A16-03/);
  });

  it("is idempotent and leaves the platform trigger untouched", async () => {
    db = await withWorkingEnabler();
    await apply(db, ASSERTION_MIGRATION);
    await apply(db, ASSERTION_MIGRATION);

    const r = await db.query<{ evtname: string }>(
      `SELECT evtname FROM pg_event_trigger WHERE evtname IN ('ensure_rls', 'f_a16_assert_public_rls') ORDER BY evtname`
    );
    expect(r.rows.map((row) => row.evtname)).toEqual(["ensure_rls", "f_a16_assert_public_rls"]);
  });

  it("does not affect tables created outside the public schema", async () => {
    db = await platformDb();
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
