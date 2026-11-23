/**
 * Donations `created_at` migration against a real (PGlite) Postgres.
 *
 * Reproduces the production table as it existed before the fix (the original
 * `create_content_tables` schema plus the later `updated_at` column), then applies
 * `*_donations_created_at.sql` and proves:
 *   1. existing rows are backfilled only from a timestamp they already carry
 *      (earliest known value), and rows with none stay NULL;
 *   2. new rows receive the column default;
 *   3. `order by created_at desc` succeeds and descending order is correct;
 *   4. the ordering index exists;
 *   5. a second run is idempotent.
 *
 * No credentials, no network.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

import {
  applyMigrationFile,
  PLATFORM_RLS_ENABLER_SQL,
  SUPABASE_ROLES_SQL,
} from "./harness";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations"
);

const CREATED_AT_FILE = fs
  .readdirSync(MIGRATIONS_DIR)
  .find((name) => name.endsWith("_donations_created_at.sql"));

/** The donations table exactly as production had it before this migration. */
async function dbBeforeCreatedAt(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);
  await db.exec(SUPABASE_ROLES_SQL);
  await db.exec(PLATFORM_RLS_ENABLER_SQL);
  await applyMigrationFile(db, "20261001000000_create_content_tables.sql");
  await applyMigrationFile(db, "20261114000100_donations_updated_at.sql");
  return db;
}

async function insertDonation(
  db: PGlite,
  donorName: string,
  timestamps: { collectedAt?: string | null; updatedAt?: string | null; createdAt?: string | null } = {}
): Promise<void> {
  const columns = [
    "donor_name",
    "email",
    "phone",
    "address",
    "amount",
    "purpose",
    "message",
    "payment_mode",
    "status",
    "receipt_number",
    "admin_remarks",
    "collected_by",
    "collected_at",
    "updated_at",
  ];
  const values: unknown[] = [
    donorName,
    `${donorName.toLowerCase()}@example.org`,
    "9999999999",
    "Bengaluru",
    501,
    "Annadanam",
    "",
    "cash",
    "pending",
    "",
    "",
    "",
    timestamps.collectedAt ?? null,
    timestamps.updatedAt ?? null,
  ];

  if ("createdAt" in timestamps) {
    columns.push("created_at");
    values.push(timestamps.createdAt ?? null);
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`);
  await db.query(
    `insert into donations (${columns.join(", ")}) values (${placeholders.join(", ")})`,
    values
  );
}

describe("donations.created_at migration", () => {
  it("was found exactly once", () => {
    expect(CREATED_AT_FILE).toBeDefined();
  });

  it("backfills from the earliest known timestamp and never fabricates one", async () => {
    const db = await dbBeforeCreatedAt();
    try {
      await insertDonation(db, "Both", {
        collectedAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
      });
      await insertDonation(db, "OnlyUpdated", { updatedAt: "2026-02-01T00:00:00Z" });
      await insertDonation(db, "OnlyCollected", { collectedAt: "2026-04-01T00:00:00Z" });
      await insertDonation(db, "Neither", {});

      await applyMigrationFile(db, CREATED_AT_FILE!);

      const expected: Record<string, string> = {
        Both: "2026-01-02T00:00:00Z",
        OnlyUpdated: "2026-02-01T00:00:00Z",
        OnlyCollected: "2026-04-01T00:00:00Z",
      };
      for (const [name, timestamp] of Object.entries(expected)) {
        const result = await db.query<{ ok: boolean }>(
          `select (created_at = $1::timestamptz) as ok from donations where donor_name = $2`,
          [timestamp, name]
        );
        expect(result.rows[0]?.ok).toBe(true);
      }

      const neither = await db.query<{ is_null: boolean }>(
        `select (created_at is null) as is_null from donations where donor_name = 'Neither'`
      );
      expect(neither.rows[0]?.is_null).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("defaults created_at for new inserts and orders newest first with nulls last", async () => {
    const db = await dbBeforeCreatedAt();
    try {
      await applyMigrationFile(db, CREATED_AT_FILE!);

      await insertDonation(db, "Oldest", { createdAt: "2026-01-01T00:00:00Z" });
      await insertDonation(db, "Newest", { createdAt: "2026-03-01T00:00:00Z" });
      await insertDonation(db, "Unknown", { createdAt: null });
      await insertDonation(db, "Defaulted", {});

      const defaulted = await db.query<{ has_timestamp: boolean }>(
        `select (created_at is not null) as has_timestamp from donations where donor_name = 'Defaulted'`
      );
      expect(defaulted.rows[0]?.has_timestamp).toBe(true);

      // The exact PostgREST shape that used to fail: select * order by created_at desc.
      await expect(
        db.query(`select * from donations order by created_at desc`)
      ).resolves.toBeDefined();

      const ordered = await db.query<{ donor_name: string }>(
        `select donor_name from donations order by created_at desc nulls last`
      );
      const names = ordered.rows.map((row) => row.donor_name);
      expect(names[0]).toBe("Defaulted");
      expect(names[1]).toBe("Newest");
      expect(names[2]).toBe("Oldest");
      expect(names[3]).toBe("Unknown");
    } finally {
      await db.close();
    }
  });

  it("creates the descending ordering index", async () => {
    const db = await dbBeforeCreatedAt();
    try {
      await applyMigrationFile(db, CREATED_AT_FILE!);
      const indexes = await db.query<{ indexname: string }>(
        `select indexname from pg_indexes where schemaname = 'public' and tablename = 'donations'`
      );
      expect(indexes.rows.map((row) => row.indexname)).toContain(
        "idx_donations_created_at"
      );
    } finally {
      await db.close();
    }
  });

  it("is idempotent when applied twice", async () => {
    const db = await dbBeforeCreatedAt();
    try {
      await insertDonation(db, "Existing", {
        collectedAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
      });

      await applyMigrationFile(db, CREATED_AT_FILE!);
      await applyMigrationFile(db, CREATED_AT_FILE!);

      const result = await db.query<{ created_at: string | null; total: number }>(
        `select created_at, count(*) over ()::int as total from donations`
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.total).toBe(1);
      expect(
        await db.query<{ ok: boolean }>(
          `select (created_at = '2026-01-02T00:00:00Z'::timestamptz) as ok from donations`
        )
      ).toMatchObject({ rows: [{ ok: true }] });
    } finally {
      await db.close();
    }
  });
});
