/**
 * Consolidated missing-settings initialization against a real (PGlite) Postgres.
 *
 * Applies every migration in `supabase/migrations` to a throwaway in-process
 * Postgres, then runs `runSettingsInitialization` through a port that mirrors the
 * production script's `settings_documents` reads/inserts (an insert-only
 * `ON CONFLICT (document_key) DO NOTHING`). Proves:
 *   1. a missing `homepage` row is inserted under the exact key;
 *   2. an existing `homepage` row is NOT overwritten;
 *   3. an existing `trustCommittee` row is NOT touched;
 *   4. every other populated settings document survives untouched;
 *   5. a re-run is idempotent (inserts nothing);
 *   6. a dry run performs zero writes; and
 *   7. post-execution verification detects a missing or incorrect document.
 *
 * No credentials, no network, no Firestore.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

import {
  runSettingsInitialization,
  settingsSeedFor,
  verifySettingsInitialization,
  type SettingsInitPort,
} from "../../lib/supabase/seed-data/settings-initialization";
import { PLATFORM_RLS_ENABLER_SQL, SUPABASE_ROLES_SQL } from "./harness";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations"
);

/** The production script's `settings_documents` port, over PGlite. */
function pglitePort(db: PGlite): SettingsInitPort {
  return {
    async readRow(documentKey: string) {
      const result = await db.query<{ data: unknown }>(
        "select data from settings_documents where document_key = $1",
        [documentKey]
      );
      return result.rows[0]?.data ?? null;
    },
    async insertRow(documentKey: string, data: Record<string, unknown>, fieldCount: number) {
      // Mirrors `supabase.from('settings_documents').upsert(..., { ignoreDuplicates: true })`.
      await db.query(
        `insert into settings_documents (document_key, data, source_field_count, updated_at)
         values ($1, $2::jsonb, $3, now())
         on conflict (document_key) do nothing`,
        [documentKey, JSON.stringify(data), fieldCount]
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
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
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

describe("missing settings initialization (PGlite)", () => {
  let db: PGlite;
  let port: SettingsInitPort;
  const homepageSeed = settingsSeedFor("homepage")!.data;

  beforeAll(async () => {
    db = await migratedDb();
    port = pglitePort(db);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("inserts the missing homepage row", async () => {
    const before = await db.query("select 1 from settings_documents");
    expect(before.rows).toHaveLength(0);

    const result = await runSettingsInitialization(port, { execute: true });
    expect(result.wrote).toBe(true);
    expect(result.inserted).toEqual(["homepage"]);

    const row = await db.query<{ document_key: string; data: Record<string, unknown>; source_field_count: number }>(
      "select document_key, data, source_field_count from settings_documents"
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].document_key).toBe("homepage");
    expect(row.rows[0].data).toEqual(homepageSeed);
    expect(row.rows[0].source_field_count).toBe(Object.keys(homepageSeed).length);

    expect(await verifySettingsInitialization(port)).toEqual([]);
  });

  it("is idempotent: a second execute run inserts nothing", async () => {
    const second = await runSettingsInitialization(port, { execute: true });
    expect(second.wrote).toBe(false);
    expect(second.inserted).toEqual([]);
    expect(second.untouched).toEqual(["homepage"]);

    const rows = await db.query("select 1 from settings_documents");
    expect(rows.rows).toHaveLength(1);
  });

  it("does not overwrite an owner-edited homepage row", async () => {
    const ownerEdit = { ...homepageSeed, heroTitle: "Owner Edited Hero" };
    await db.query("update settings_documents set data = $1::jsonb where document_key = $2", [
      JSON.stringify(ownerEdit),
      "homepage",
    ]);

    const result = await runSettingsInitialization(port, { execute: true });
    expect(result.wrote).toBe(false);

    const stored = await db.query<{ data: { heroTitle: string } }>(
      "select data from settings_documents where document_key = 'homepage'"
    );
    expect(stored.rows[0].data.heroTitle).toBe("Owner Edited Hero");
  });

  it("does not touch trustCommittee, aboutUs, facilities or footer", async () => {
    const rows: Array<[string, Record<string, unknown>]> = [
      ["trustCommittee", { members: [{ id: "1", name: "Owner Member" }] }],
      ["aboutUs", { templeName: "Owner Temple" }],
      ["facilities", { facilities: [{ id: "1" }] }],
      ["footer", { copyright: "Owner Copyright" }],
    ];
    for (const [key, data] of rows) {
      await db.query(
        `insert into settings_documents (document_key, data, source_field_count)
         values ($1, $2::jsonb, 1)
         on conflict (document_key) do nothing`,
        [key, JSON.stringify(data)]
      );
    }

    // Remove the homepage row so the run has something to insert again.
    await db.query("delete from settings_documents where document_key = 'homepage'");
    const result = await runSettingsInitialization(port, { execute: true });
    expect(result.inserted).toEqual(["homepage"]);

    for (const [key, data] of rows) {
      const stored = await db.query<{ data: Record<string, unknown> }>(
        "select data from settings_documents where document_key = $1",
        [key]
      );
      expect(stored.rows[0].data).toEqual(data);
    }
  });

  it("performs zero writes on a dry run", async () => {
    await db.query("delete from settings_documents where document_key = 'homepage'");
    const countBefore = await db.query<{ n: number }>("select count(*)::int as n from settings_documents");

    const result = await runSettingsInitialization(port, { execute: false });
    expect(result.wrote).toBe(false);
    expect(result.entries[0].action).toBe("insert");

    const countAfter = await db.query<{ n: number }>("select count(*)::int as n from settings_documents");
    expect(countAfter.rows[0].n).toBe(countBefore.rows[0].n);
    const homepage = await db.query("select 1 from settings_documents where document_key = 'homepage'");
    expect(homepage.rows).toHaveLength(0);
  });

  it("verification detects a still-missing document", async () => {
    const failures = await verifySettingsInitialization(port);
    expect(failures.join("\n")).toMatch(/homepage: still missing/);
  });

  it("verification detects an incorrect document", async () => {
    await db.query(
      `insert into settings_documents (document_key, data, source_field_count)
       values ('homepage', $1::jsonb, 1)`,
      [JSON.stringify({ heroTitle: "wrong" })]
    );
    const failures = await verifySettingsInitialization(port);
    expect(failures.join("\n")).toMatch(/homepage: stored document does not match/);
  });
});
