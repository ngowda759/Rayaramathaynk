/**
 * Fresh Supabase initialization: the seed plan against a real (PGlite) Postgres.
 *
 * Applies every migration in `supabase/migrations` to a throwaway in-process Postgres,
 * then runs `runSeedPlan` twice through a `SeedPort` that mirrors the production
 * `pgPort` (`INSERT ... ON CONFLICT (conflict) DO NOTHING`).
 *
 * Proves the four properties the initialization promises:
 *   1. every required table exists after the migrations (no missing table),
 *   2. the first run creates the starter rows,
 *   3. the second run inserts nothing (idempotent, conflict-safe), and
 *   4. an administrator's edit to a seeded row survives the next run untouched.
 *
 * No credentials, no network, no Firebase.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

import { runSeedPlan, SEED_PLAN, type SeedPort } from '../../lib/supabase/seed-data';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'migrations'
);

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
`;

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error(`Unsafe identifier: ${identifier}`);
  return `"${identifier}"`;
}

/** The production seeder's semantics: insert unless the conflict target already exists. */
function pglitePort(db: PGlite): SeedPort {
  return {
    async upsert(table, rows, conflict) {
      if (rows.length === 0) return 0;
      const columns = Object.keys(rows[0]);
      const values: unknown[] = [];
      const tuples = rows.map((row) => {
        const placeholders = columns.map((column) => {
          values.push(row[column] ?? null);
          return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });
      const sql =
        `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) ` +
        `VALUES ${tuples.join(', ')} ON CONFLICT (${quoteIdent(conflict)}) DO NOTHING`;
      const result = await db.query(sql, values);
      return result.affectedRows ?? 0;
    },
    async tableExists(table) {
      const result = await db.query<{ exists: boolean }>(
        "select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = $1)",
        [table]
      );
      return result.rows[0]?.exists === true;
    },
  };
}

async function migratedDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);
  await db.exec(SUPABASE_ROLES_SQL);
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(
        `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return db;
}

describe('fresh Supabase initialization seed', () => {
  let db: PGlite;
  let port: SeedPort;

  beforeAll(async () => {
    db = await migratedDb();
    port = pglitePort(db);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('declares every required table in the migrations', async () => {
    const missing: string[] = [];
    for (const op of SEED_PLAN) {
      if (!(await port.tableExists(op.table))) missing.push(op.table);
    }
    expect(missing).toEqual([]);
  });

  it('seeds the starter rows on the first run and nothing on the second', async () => {
    const first = await runSeedPlan(port);
    expect(first.missingTables).toEqual([]);
    expect(first.totalInserted).toBeGreaterThan(0);

    // Every non-insert-only table with rows was created; analytics tables were skipped.
    const expectedTables = SEED_PLAN.filter((op) => !op.insertOnly && op.rows.length > 0).map(
      (op) => op.table
    );
    expect(Object.keys(first.inserted).sort()).toEqual([...expectedTables].sort());
    for (const table of expectedTables) {
      expect(first.inserted[table]).toBeGreaterThan(0);
    }

    const second = await runSeedPlan(port);
    expect(second.missingTables).toEqual([]);
    // Conflict-safe: a repeat run inserts no duplicate rows.
    expect(second.totalInserted).toBe(0);
    for (const count of Object.values(second.inserted)) {
      expect(count).toBe(0);
    }

    // Row counts match the plan exactly (no duplication from the second run).
    for (const op of SEED_PLAN) {
      if (op.insertOnly || op.rows.length === 0) continue;
      const result = await db.query<{ n: number }>(
        `select count(*)::int as n from ${quoteIdent(op.table)}`
      );
      expect(result.rows[0].n).toBe(op.rows.length);
    }
  });

  it('preserves an administrator edit across a later seed run', async () => {
    // The owner edits a seeded announcement title (a real admin action).
    const before = await db.query<{ id: string; title: string }>(
      'select id, title from announcements order by display_order asc limit 1'
    );
    expect(before.rows).toHaveLength(1);
    const editedTitle = 'Owner-edited announcement title';
    await db.query('update announcements set title = $1 where id = $2', [
      editedTitle,
      before.rows[0].id,
    ]);

    const summary = await runSeedPlan(port);
    expect(summary.totalInserted).toBe(0);

    const after = await db.query<{ title: string }>('select title from announcements where id = $1', [
      before.rows[0].id,
    ]);
    expect(after.rows[0].title).toBe(editedTitle);
  });

  it('keeps unverified owner facts as placeholders, never fabricated values', async () => {
    const docs = await db.query<{ document_key: string; data: Record<string, unknown> }>(
      'select document_key, data from settings_documents'
    );
    expect(docs.rows.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(docs.rows);
    // The placeholder convention is the go-live signal; at least one must remain.
    expect(serialized).toContain('PLACEHOLDER - ');
    // No Firebase artifact leaked into the seeded documents.
    expect(serialized).not.toContain('firestore');
  });
});
