/**
 * F-A16-07 — behavioural tests for the existing-function privilege migration.
 *
 * These apply the F-A16-07 migration to a throwaway in-process Postgres (PGlite). They
 * prove it revokes EXECUTE on exactly the two named functions from PUBLIC/anon/authenticated,
 * keeps it for service_role and the owner, does not touch the functions' definitions or
 * their triggers, and fails closed when a target is missing.
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
const MIGRATION = "20261115000300_f_a16_existing_function_privileges.sql";

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

/** The two target functions, created the way production has them. */
const TARGET_FUNCTIONS = `
CREATE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM 1;
END; $$;
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
-- The platform's broad grant that makes them world-executable today.
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC, anon, authenticated, service_role;
`;

async function newDb(): Promise<PGlite> {
  const db = await PGliteCtor.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  return db;
}

async function apply(db: PGlite, file: string): Promise<void> {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
}

/** EXECUTE flags for the two targets, keyed by function signature. */
async function executeFlags(
  db: PGlite
): Promise<Record<string, { anon: boolean; auth: boolean; svc: boolean; pub: boolean }>> {
  const r = await db.query<{ sig: string; anon: boolean; auth: boolean; svc: boolean; pub: boolean }>(
    `SELECT sig,
            pg_catalog.has_function_privilege('anon', sig, 'EXECUTE')          AS anon,
            pg_catalog.has_function_privilege('authenticated', sig, 'EXECUTE') AS auth,
            pg_catalog.has_function_privilege('service_role', sig, 'EXECUTE')  AS svc,
            pg_catalog.has_function_privilege('public', sig, 'EXECUTE')        AS pub
       FROM (VALUES ('public.rls_auto_enable()'), ('public.update_updated_at_column()')) AS t(sig)
      ORDER BY sig`
  );
  const out: Record<string, { anon: boolean; auth: boolean; svc: boolean; pub: boolean }> = {};
  for (const row of r.rows) out[row.sig] = { anon: row.anon, auth: row.auth, svc: row.svc, pub: row.pub };
  return out;
}

describe("F-A16-07 existing function privileges (behavioural)", () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  it("baseline: both functions are world-executable before the migration", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(TARGET_FUNCTIONS);
    const flags = await executeFlags(db);
    for (const sig of Object.keys(flags)) {
      expect(flags[sig]).toEqual({ anon: true, auth: true, svc: true, pub: true });
    }
  });

  it("after the migration: anon/authenticated/PUBLIC cannot execute; service_role and owner can", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(TARGET_FUNCTIONS);
    await apply(db, MIGRATION);

    const flags = await executeFlags(db);
    for (const sig of Object.keys(flags)) {
      expect(flags[sig]).toEqual({ anon: false, auth: false, svc: true, pub: false });
    }
    // The owner keeps EXECUTE.
    const owner = await db.query<{ o: boolean }>(
      `SELECT pg_catalog.has_function_privilege(current_user, 'public.rls_auto_enable()', 'EXECUTE') AS o`
    );
    expect(owner.rows[0]!.o).toBe(true);
  });

  it("does not change the function definitions or ownership", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(TARGET_FUNCTIONS);
    const before = await db.query<{ proname: string; prosrc: string; owner: string }>(
      `SELECT p.proname, p.prosrc, pg_catalog.pg_get_userbyid(p.proowner) AS owner
         FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' ORDER BY p.proname`
    );

    await apply(db, MIGRATION);

    const after = await db.query<{ proname: string; prosrc: string; owner: string }>(
      `SELECT p.proname, p.prosrc, pg_catalog.pg_get_userbyid(p.proowner) AS owner
         FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' ORDER BY p.proname`
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("leaves triggers that call update_updated_at_column working", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(TARGET_FUNCTIONS);
    await db.exec(`
      CREATE TABLE public.widgets (id int primary key, updated_at timestamptz DEFAULT now());
      CREATE TRIGGER widgets_touch BEFORE UPDATE ON public.widgets
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `);

    await apply(db, MIGRATION);

    // A trigger fires as the function owner regardless of EXECUTE, so the UPDATE works.
    await db.exec(`INSERT INTO public.widgets (id, updated_at) VALUES (1, '2000-01-01');`);
    await db.exec(`UPDATE public.widgets SET updated_at = updated_at WHERE id = 1;`);
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.widgets WHERE updated_at > '2000-01-01'`
    );
    expect(r.rows[0]!.n).toBe(1);
  });

  it("is idempotent: applying it twice changes nothing further", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    await db.exec(TARGET_FUNCTIONS);
    await apply(db, MIGRATION);
    await apply(db, MIGRATION);
    const flags = await executeFlags(db);
    for (const sig of Object.keys(flags)) {
      expect(flags[sig]).toEqual({ anon: false, auth: false, svc: true, pub: false });
    }
  });

  it("fails closed when a target function is missing", async () => {
    db = await newDb();
    await db.exec(SUPABASE_ROLES);
    // Only one of the two exists.
    await db.exec(`
      CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; END; $$;
    `);
    await expect(apply(db, MIGRATION)).rejects.toThrow(
      /F-A16-07: expected function\(s\) not found: public\.update_updated_at_column\(\)/
    );
  });

  it("fails closed when a required role is missing", async () => {
    db = await newDb();
    // Both functions exist, but no anon/authenticated/service_role at all. The function
    // definitions carry the implicit PUBLIC EXECUTE, so no explicit grant to the missing
    // roles is needed (and would itself fail).
    await db.exec(`
      CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; END; $$;
      CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
    `);
    await expect(apply(db, MIGRATION)).rejects.toThrow(
      /F-A16-07: required Supabase roles are missing:/
    );
  });
});
