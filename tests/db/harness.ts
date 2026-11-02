/**
 * PGlite harness for the seva database tests.
 *
 * Each `freshDb()` call starts an empty in-process Postgres, recreates the
 * Supabase roles and default privileges (so the seva migrations' REVOKEs are
 * what the tests prove), applies the two base migrations the seva files depend
 * on, then every seva migration in name order. Nothing here talks to a live
 * database.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

export type DbRole = 'anon' | 'authenticated' | 'service_role';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'migrations');

/** The pre-seva migrations the seva files build on (`sevas`, `update_updated_at_column()`). */
const BASE_FILES = [
  '20260907112632_create_core_tables.sql',
  '20260908120000_create_sevas_table.sql',
] as const;

/**
 * Seva module migrations: `<14-digit timestamp>_seva_<name>.sql`. Anchoring the
 * `seva_` prefix to the timestamp keeps older files such as
 * `..._create_seva_bookings.sql` out of the set.
 */
const SEVA_FILE = /^\d{14}_seva_[a-z0-9_]+\.sql$/;

const DB_ROLES: readonly DbRole[] = ['anon', 'authenticated', 'service_role'];

const SUPABASE_ROLES_SQL = `
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

/**
 * The platform's RLS auto-enable trigger, reproduced from the Supabase docs.
 *
 * Supabase installs this before any project migration runs, so a test that replays
 * `supabase/migrations` against a bare Postgres must install it too or it is not
 * modelling production. The F-A16-03 assertion migration *requires* an enabled
 * enabler and refuses to install without one, which is exactly the behaviour these
 * tests want to exercise rather than bypass.
 */
export const PLATFORM_RLS_ENABLER_SQL = `
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
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

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
`;

/** Seva migration file names (not paths), sorted by name. */
export function sevaMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => SEVA_FILE.test(name))
    .sort();
}

/** Applies one migration, given as a file name inside supabase/migrations or as a path. */
export async function applyMigrationFile(db: PGlite, file: string): Promise<void> {
  const fullPath = path.isAbsolute(file) ? file : path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  try {
    await db.exec(sql);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration ${path.basename(fullPath)} failed: ${message}`);
  }
}

/** A new empty database with the Supabase roles, the base tables and every seva migration. */
export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);
  await db.exec(SUPABASE_ROLES_SQL);
  await db.exec(PLATFORM_RLS_ENABLER_SQL);
  for (const file of BASE_FILES) {
    await applyMigrationFile(db, file);
  }
  for (const file of sevaMigrationFiles()) {
    await applyMigrationFile(db, file);
  }
  return db;
}

/** Runs `fn` as one of the Supabase roles; always switches back to the owner afterwards. */
export async function asRole<T>(db: PGlite, role: DbRole, fn: (db: PGlite) => Promise<T>): Promise<T> {
  if (!DB_ROLES.includes(role)) {
    throw new Error(`Unknown database role: ${String(role)}`);
  }
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn(db);
  } finally {
    await db.exec('RESET ROLE');
  }
}
