/**
 * Regression guards for two CI checks on `main` that were red independently of
 * application code:
 *
 *  1. GitHub Pages "build" (Jekyll). Pages is configured with `build_type: legacy`
 *     and serves the repository root, so Jekyll renders every tracked markdown file
 *     as Liquid. React/TSX-like snippets in docs (e.g. `{{ hidden: { opacity: 0 }`)
 *     are invalid Liquid and fail the build. A root `.nojekyll` file opts out.
 *
 *  2. Supabase integration "Supabase Preview". It compares the remote
 *     `supabase_migrations.schema_migrations` ledger with local files and fails on
 *     "Remote migration versions not found in local migrations directory." Two
 *     remote versions had no local file: the out-of-band ai_settings seed
 *     (`20261006101759`) and the Prisma baseline (`20261015000000`). Local
 *     comment-only marker files align the two without changing schema or data.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const REMOTE_ONLY_VERSIONS = [
  "20261006101759_seed_ai_settings",
  "20261015000000_baseline_raya_ai",
];

/** SQL with comment lines stripped, so only executable statements remain. */
function executableSql(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, "");
}

describe("GitHub Pages Jekyll opt-out", () => {
  it("ships a root .nojekyll so legacy Pages builds skip Jekyll", () => {
    expect(existsSync(join(ROOT, ".nojekyll"))).toBe(true);
  });
});

describe("Supabase ledger alignment", () => {
  for (const name of REMOTE_ONLY_VERSIONS) {
    const file = join(MIGRATIONS_DIR, `${name}.sql`);

    it(`has a local file for remote version ${name}`, () => {
      expect(existsSync(file)).toBe(true);
    });

    it(`${name} is a marker only (no DDL/DML)`, () => {
      const sql = readFileSync(file, "utf8");
      // A leading version comment keeps the file self-describing...
      expect(sql).toMatch(new RegExp(`^--\\s*Migration:\\s*${name}`));
      // ...but it must not execute anything: adding schema or data here would
      // either double-apply on a fresh database or overwrite production values.
      expect(executableSql(sql)).not.toMatch(
        /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE)\b/i,
      );
    });
  }

  it("the marker for the seed sorts before the ai_settings table it feeds", () => {
    // Ordering guard: the seed marker must precede create_ai_settings_table so a
    // fresh database never inserts settings into a table that does not yet exist.
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const marker = files.indexOf("20261006101759_seed_ai_settings.sql");
    const table = files.indexOf("20261012000000_create_ai_settings_table.sql");
    const seed = files.indexOf("20261012000001_seed_ai_settings.sql");
    expect(marker).toBeGreaterThanOrEqual(0);
    expect(table).toBeGreaterThanOrEqual(0);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(marker).toBeLessThan(table);
    expect(table).toBeLessThan(seed);
  });
});
