/**
 * @jest-environment node
 *
 * Regression guards for the two obsolete back-dated `members` / `volunteers`
 * migrations.
 *
 * `20261110000000_fresh_supabase_native_content.sql` is the authoritative creator of
 * both tables and is recorded as applied. `20261109000000_create_members_table.sql`
 * and `20261109000001_create_volunteers_table.sql` were committed later (2026-11-09)
 * with a version prefix that sorts BEFORE it. Left as executable SQL they would fail
 * on an already-migrated database (`relation "members" already exists`, 42P07) and,
 * on a fresh database, would win the filename-order race and create a divergent shape
 * before 20261110000000's `CREATE TABLE IF NOT EXISTS` silently no-ops.
 *
 * They are therefore no-op ledger markers. These tests pin that property so it cannot
 * regress. They read files only: no database, no network, no workflow dispatch.
 *
 * The marker assertion reuses the pattern established for the two existing marker
 * migrations (`20261006101759_seed_ai_settings`, `20261015000000_baseline_raya_ai`)
 * in `ci-pages-and-supabase-ledger.test.ts`.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { extractDeclaredTables, migrationVersionFromFilename } from "@/lib/supabase/migration-coverage";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

/** The obsolete back-dated migrations, as `[filename, canonical version]`. */
const OBSOLETE = [
  ["20261109000000_create_members_table.sql", "20261109000000"],
  ["20261109000001_create_volunteers_table.sql", "20261109000001"],
] as const;

/** The single authoritative creator of `members` and `volunteers`. */
const AUTHORITATIVE = "20261110000000_fresh_supabase_native_content.sql";

/** SQL with comment lines stripped, so only executable statements remain. */
function executableSql(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, "");
}

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

describe("obsolete members/volunteers migrations are no-op markers", () => {
  it.each(OBSOLETE)("%s still exists", (name) => {
    expect(existsSync(join(MIGRATIONS_DIR, name))).toBe(true);
  });

  it.each(OBSOLETE)("%s keeps its original version prefix", (name, version) => {
    // Re-versioning the file would create a new out-of-order entry and discard the
    // historical record, so the filename (and thus its version) must not change.
    expect(migrationVersionFromFilename(name)).toBe(version);
  });

  it.each(OBSOLETE)("%s contains no executable SQL", (name) => {
    const sql = readMigration(name);
    // A leading version comment keeps the file self-describing...
    expect(sql).toMatch(/^--\s*Migration:\s*\S+/);
    // ...but it must not execute anything: schema or data here would double-apply on
    // a fresh database or fail against the already-migrated one.
    expect(executableSql(sql)).not.toMatch(
      /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE)\b/i,
    );
  });

  it.each(OBSOLETE)("%s declares no tables", (name) => {
    expect(extractDeclaredTables([readMigration(name)])).toEqual([]);
  });
});

describe("20261110000000 is the sole declarer of members and volunteers", () => {
  it("declares both tables", () => {
    const tables = extractDeclaredTables([readMigration(AUTHORITATIVE)]);
    expect(tables).toContain("members");
    expect(tables).toContain("volunteers");
  });

  it.each(["members", "volunteers"])(
    "no obsolete 20261109 file declares %s",
    (table) => {
      for (const [name] of OBSOLETE) {
        expect(extractDeclaredTables([readMigration(name)])).not.toContain(table);
      }
    },
  );
});

describe("fresh-database migration-order safety", () => {
  // Migrations apply in filename order. The obsolete 20261109 files sort BEFORE the
  // authoritative 20261110 file, so if they still declared the tables they would win
  // the race and 20261110000000's `CREATE TABLE IF NOT EXISTS` would no-op — leaving
  // the divergent shape on a fresh database. This test proves that cannot happen: the
  // only file declaring each table is the authoritative one.
  const ordered = [...OBSOLETE.map(([name]) => name), AUTHORITATIVE].sort();

  it("the obsolete files sort before the authoritative creator", () => {
    const authoritativeIndex = ordered.indexOf(AUTHORITATIVE);
    for (const [name] of OBSOLETE) {
      expect(ordered.indexOf(name)).toBeLessThan(authoritativeIndex);
    }
  });

  it("the authoritative creator is the first (and only) declarer of each table", () => {
    for (const table of ["members", "volunteers"] as const) {
      const declarers = ordered.filter((name) =>
        extractDeclaredTables([readMigration(name)]).includes(table),
      );
      expect(declarers).toEqual([AUTHORITATIVE]);
    }
  });
});
