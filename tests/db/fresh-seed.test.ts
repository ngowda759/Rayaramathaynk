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
    async tableHasRows(table) {
      const result = await db.query<{ has_rows: boolean }>(
        `select exists (select 1 from ${quoteIdent(table)} limit 1) as has_rows`
      );
      return result.rows[0]?.has_rows === true;
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

/**
 * A project that already holds its own content — for example one that previously
 * imported its own rows under different identifiers — must never receive a parallel
 * starter copy. The `empty` seed mode is what guarantees that.
 */
describe('fresh Supabase initialization on an already-populated database', () => {
  let db: PGlite;
  let port: SeedPort;

  beforeAll(async () => {
    db = await migratedDb();
    port = pglitePort(db);
    // A pre-existing, owner-curated daily_poojas row that does not use a `seed-` key.
    await db.query(
      `insert into daily_poojas (firestore_id, title, description, start_time, duration, category, seva_amount, days, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      ['legacy-arati', 'Arati', 'Arati', '07:00', '30 mins', 'Daily', 20, ['All'], 'system']
    );
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('does not seed a table that already holds rows, and leaves those rows intact', async () => {
    const summary = await runSeedPlan(port);

    // The populated table is reported as skipped, not seeded.
    expect(summary.alreadyPopulated).toContain('daily_poojas');
    expect(summary.inserted.daily_poojas).toBeUndefined();

    // No starter copy was added next to the owner's row.
    const poojas = await db.query<{ n: number }>('select count(*)::int as n from daily_poojas');
    expect(poojas.rows[0].n).toBe(1);

    // Empty tables were still seeded.
    const announcements = await db.query<{ n: number }>(
      'select count(*)::int as n from announcements'
    );
    expect(announcements.rows[0].n).toBeGreaterThan(0);

    // A second run is a no-op for the populated table and adds nothing anywhere.
    const second = await runSeedPlan(port);
    expect(second.totalInserted).toBe(0);
  });

  it('adds only missing settings documents and never rewrites an existing one', async () => {
    // The owner has already edited one settings document.
    const ownerData = { heading: 'Owner-edited heading', items: [] };
    await db.query('update settings_documents set data = $1 where document_key = $2', [
      JSON.stringify(ownerData),
      'aboutUs',
    ]);

    const summary = await runSeedPlan(port);
    // settings_documents always runs, but conflicts on document_key: nothing inserted.
    expect(summary.inserted.settings_documents ?? 0).toBe(0);

    const row = await db.query<{ data: { heading: string } }>(
      'select data from settings_documents where document_key = $1',
      ['aboutUs']
    );
    expect(row.rows[0].data.heading).toBe('Owner-edited heading');
  });
});

/**
 * `gallery_media.album_id` carries the seed-only album identifier
 * (`seed-gallery-album-temple`), and there is no enforced foreign key. These tests
 * prove the runner's `dependsOn` guard keeps the child table from being seeded when
 * its parent album seed was skipped.
 */
describe('fresh Supabase initialization: gallery dependency', () => {
  const countMedia = (db: PGlite) =>
    db.query<{ n: number }>('select count(*)::int as n from gallery_media');
  const orphans = (db: PGlite) =>
    db.query<{ n: number }>(
      `select count(*)::int as n from gallery_media
        where not exists (
          select 1 from gallery_albums a
          where a.firestore_id = gallery_media.album_id or a.id::text = gallery_media.album_id
        )`
    );

  async function emptyDb(): Promise<{ db: PGlite; port: SeedPort }> {
    const db = await migratedDb();
    return { db, port: pglitePort(db) };
  }

  it('seeds album and media together when both are empty, with no orphaned media', async () => {
    const { db, port } = await emptyDb();
    try {
      const summary = await runSeedPlan(port);
      expect(summary.inserted.gallery_albums).toBeGreaterThan(0);
      expect(summary.inserted.gallery_media).toBeGreaterThan(0);

      // Every seeded media row resolves to a real album (structural, not an FK error).
      expect((await orphans(db)).rows[0].n).toBe(0);

      // A second run inserts nothing.
      const second = await runSeedPlan(port);
      expect(second.totalInserted).toBe(0);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('does not seed gallery_media when the album seed is skipped (no orphaned media)', async () => {
    const { db, port } = await emptyDb();
    try {
      // The project already owns an album with a real identifier, so the seed album
      // (`seed-gallery-album-temple`) is never inserted.
      await db.query(
        `insert into gallery_albums (firestore_id, title, slug, description, cover_image, active, display_order)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        ['real-album-owner', 'Owner Album', 'owner-album', 'owner album', '/images/temple/Ananda.jpg', true, 1]
      );

      const summary = await runSeedPlan(port);

      // The parent is reported as populated, and the dependent child is skipped by
      // dependency rather than seeded.
      expect(summary.alreadyPopulated).toContain('gallery_albums');
      expect(summary.dependencySkipped).toContain('gallery_media');
      expect(summary.inserted.gallery_media).toBeUndefined();

      // No media row references the seed-only album identifier, and none was added.
      expect((await orphans(db)).rows[0].n).toBe(0);
      expect((await countMedia(db)).rows[0].n).toBe(0);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('preserves an owner gallery_media set untouched when albums already exist', async () => {
    const { db, port } = await emptyDb();
    try {
      const album = await db.query<{ id: string }>(
        `insert into gallery_albums (firestore_id, title, slug, description, cover_image, active, display_order)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        ['real-album-owner', 'Owner Album', 'owner-album', 'owner album', '/images/temple/Ananda.jpg', true, 1]
      );
      await db.query(
        `insert into gallery_media (firestore_id, album_id, title, description, category, type, image_path, alt_text, uploaded_by, is_featured, display_order, tags)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        ['owner-media-1', album.rows[0].id, 'Owner photo', 'owner photo', 'Owner Category', 'photo', '/images/temple/Seva.jpg', 'owner photo', 'owner', true, 1, ['owner']]
      );

      const summary = await runSeedPlan(port);

      expect(summary.dependencySkipped).toContain('gallery_media');
      expect((await countMedia(db)).rows[0].n).toBe(1);
      const owned = await db.query<{ title: string }>(
        'select title from gallery_media where firestore_id = $1',
        ['owner-media-1']
      );
      expect(owned.rows[0].title).toBe('Owner photo');
      expect((await orphans(db)).rows[0].n).toBe(0);
    } finally {
      await db.close();
    }
  }, 60_000);

  it('aborts the whole run when the parent existence check fails (fail-safe)', async () => {
    const { db, port } = await emptyDb();
    try {
      const failing: SeedPort = {
        ...port,
        async tableHasRows(table) {
          if (table === 'gallery_albums') throw new Error('connection reset');
          return port.tableHasRows(table);
        },
      };

      await expect(runSeedPlan(failing)).rejects.toThrow('connection reset');

      // Fail-safe: the run aborts at the parent, so the dependent child is never seeded.
      expect((await countMedia(db)).rows[0].n).toBe(0);
    } finally {
      await db.close();
    }
  }, 60_000);
});
