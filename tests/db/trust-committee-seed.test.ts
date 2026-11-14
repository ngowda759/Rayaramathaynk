/**
 * Trust Committee initialization against a real (PGlite) Postgres.
 *
 * Applies every migration in `supabase/migrations` to a throwaway in-process
 * Postgres, then runs `runTrustCommitteeInitialization` through a port that
 * mirrors the production script's `settings_documents` reads/writes. Proves:
 *   1. a missing row is created under `document_key = 'trustCommittee'`;
 *   2. the stored document holds the 13 canonical, all-active members;
 *   3. a re-run is a no-op (idempotent), and
 *   4. an owner-edited populated document is refused without `--force` and is
 *      left untouched.
 *
 * No credentials, no network, no Firestore.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

import {
  TRUST_COMMITTEE_DATA,
  TRUST_COMMITTEE_DOCUMENT_KEY,
  countActiveMembers,
  countMembers,
  runTrustCommitteeInitialization,
  type TrustCommitteeData,
  type TrustCommitteeSeedPort,
} from '../../lib/supabase/seed-data/trust-committee';
import { PLATFORM_RLS_ENABLER_SQL, SUPABASE_ROLES_SQL } from './harness';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'migrations'
);

/** The production script's `settings_documents` port, over PGlite. */
function pglitePort(db: PGlite): TrustCommitteeSeedPort {
  return {
    async readDocument() {
      const result = await db.query<{ data: unknown }>(
        'select data from settings_documents where document_key = $1',
        [TRUST_COMMITTEE_DOCUMENT_KEY]
      );
      return result.rows[0]?.data ?? null;
    },
    async writeDocument(document: TrustCommitteeData, fieldCount: number) {
      // Mirrors `supabase.from('settings_documents').upsert(..., { onConflict: 'document_key' })`.
      await db.query(
        `insert into settings_documents (document_key, data, source_field_count, updated_at)
         values ($1, $2::jsonb, $3, now())
         on conflict (document_key) do update
           set data = excluded.data,
               source_field_count = excluded.source_field_count,
               updated_at = excluded.updated_at`,
        [TRUST_COMMITTEE_DOCUMENT_KEY, JSON.stringify(document), fieldCount]
      );
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
  await db.exec(PLATFORM_RLS_ENABLER_SQL);
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

describe('Trust Committee Supabase initialization', () => {
  let db: PGlite;
  let port: TrustCommitteeSeedPort;

  beforeAll(async () => {
    db = await migratedDb();
    port = pglitePort(db);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('creates the trustCommittee row with 13 active members', async () => {
    const before = await db.query('select 1 from settings_documents');
    expect(before.rows).toHaveLength(0);

    const result = await runTrustCommitteeInitialization(port, { execute: true, force: false });
    expect(result.action).toBe('create');
    expect(result.wrote).toBe(true);
    expect(result.after).toEqual({ present: true, memberCount: 13, activeCount: 13 });

    const stored = await port.readDocument();
    expect(countMembers(stored)).toBe(13);
    expect(countActiveMembers(stored)).toBe(13);
    expect(stored).toEqual(TRUST_COMMITTEE_DATA);

    // Stored under the exact key, with the field count recorded.
    const row = await db.query<{ document_key: string; source_field_count: number }>(
      'select document_key, source_field_count from settings_documents'
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].document_key).toBe('trustCommittee');
    expect(row.rows[0].source_field_count).toBe(5);
  });

  it('is idempotent: a second execute run writes nothing', async () => {
    const second = await runTrustCommitteeInitialization(port, { execute: true, force: false });
    expect(second.action).toBe('noop');
    expect(second.wrote).toBe(false);

    const rows = await db.query('select 1 from settings_documents');
    expect(rows.rows).toHaveLength(1);
  });

  it('does not touch other settings documents', async () => {
    // A pre-existing, unrelated document that must survive untouched.
    await db.query(
      `insert into settings_documents (document_key, data, source_field_count)
       values ('aboutUs', $1::jsonb, 1)`,
      [JSON.stringify({ templeName: 'Owner Value' })]
    );

    await runTrustCommitteeInitialization(port, { execute: true, force: true });

    const about = await db.query<{ data: { templeName: string } }>(
      `select data from settings_documents where document_key = 'aboutUs'`
    );
    expect(about.rows[0].data.templeName).toBe('Owner Value');
    expect((await db.query('select 1 from settings_documents')).rows).toHaveLength(2);
  });

  it('refuses to overwrite a populated document without --force, then replaces it with --force', async () => {
    const ownerEdit = {
      ...TRUST_COMMITTEE_DATA,
      members: [{ ...TRUST_COMMITTEE_DATA.members[0], name: 'Owner Edited Name' }],
    };
    await db.query(`update settings_documents set data = $1::jsonb where document_key = $2`, [
      JSON.stringify(ownerEdit),
      TRUST_COMMITTEE_DOCUMENT_KEY,
    ]);

    const refused = await runTrustCommitteeInitialization(port, { execute: true, force: false });
    expect(refused.action).toBe('refused');
    expect(refused.wrote).toBe(false);
    const stillEdited = await port.readDocument();
    expect(countMembers(stillEdited)).toBe(1);
    expect((stillEdited as TrustCommitteeData).members[0].name).toBe('Owner Edited Name');

    const replaced = await runTrustCommitteeInitialization(port, { execute: true, force: true });
    expect(replaced.action).toBe('replace');
    expect(replaced.wrote).toBe(true);
    expect(await port.readDocument()).toEqual(TRUST_COMMITTEE_DATA);
  });
});
