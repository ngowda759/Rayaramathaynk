/**
 * @jest-environment node
 *
 * Static tests for the prepared `events` provenance-columns migration.
 *
 * The migration is NOT applied here and must not be: this suite only reads the
 * SQL file. It asserts the properties that make it safe to hand to an owner for
 * review - additive-only, idempotent, no data rewrite, and exactly the columns
 * the writer reports as unmapped.
 *
 * This is the writer-schema half of the PR-D4b split; the public SELECT policy
 * is the reader half and lives in the PR-D4c branch.
 */

import fs from "fs";
import path from "path";

import { PROVENANCE_COLUMNS, MAPPED_COLUMNS } from "@/lib/aaradhane/supabase-writer";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const PROVENANCE_FILE = "20261104000000_add_events_provenance_columns.sql";

function read(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
}

/** Strip `--` line comments so assertions match statements, not prose. */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** Extract `ADD COLUMN [IF NOT EXISTS] <name>` targets from a file. */
function addedColumns(sql: string): string[] {
  return [...stripComments(sql).matchAll(/ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_]+)/gi)].map(
    (m) => m[1].toLowerCase(),
  );
}

describe("events provenance-columns migration", () => {
  const sql = read(PROVENANCE_FILE);
  const body = stripComments(sql);

  it("sorts after the migration that was newest before this change", () => {
    // `supabase db push` refuses an out-of-order file. The previous newest local
    // migration is 20261103000000_add_auth_user_id_to_users.sql. Deliberately not
    // "is the newest file": that would break on the next legitimate migration and
    // does not express what `db push` requires.
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const previousNewest = "20261103000000_add_auth_user_id_to_users.sql";
    expect(files.indexOf(PROVENANCE_FILE)).toBeGreaterThan(files.indexOf(previousNewest));
  });

  it("adds exactly the columns the writer reports as unmapped", () => {
    // The writer's PROVENANCE_COLUMNS must have a destination after this runs, or
    // the schema proposal and the code have drifted apart.
    expect(addedColumns(sql).sort()).toEqual([...PROVENANCE_COLUMNS].sort());
  });

  it("does not re-add a column the writer already maps", () => {
    // Re-declaring a mapped column would mean the writer's MAPPED/PROVENANCE split
    // no longer describes the schema.
    for (const column of MAPPED_COLUMNS) {
      expect(addedColumns(sql)).not.toContain(column);
    }
  });

  it("is idempotent, so a re-run cannot fail", () => {
    const addCount = (body.match(/ADD\s+COLUMN/gi) ?? []).length;
    const guarded = (body.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi) ?? []).length;
    expect(addCount).toBe(guarded);
    expect((body.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi) ?? []).length).toBeGreaterThan(0);
  });

  it("is additive only: it drops, renames and rewrites nothing", () => {
    expect(body).not.toMatch(/\bDROP\s+(COLUMN|TABLE|CONSTRAINT|NOT\s+NULL)/i);
    expect(body).not.toMatch(/\bRENAME\b/i);
    expect(body).not.toMatch(/\bUPDATE\s+/i);
    expect(body).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(body).not.toMatch(/\bTRUNCATE\b/i);
    expect(body).not.toMatch(/\bALTER\s+COLUMN\b/i);
  });

  it("leaves every new column nullable, so existing rows are untouched", () => {
    // `NOT NULL` may appear only inside a partial-index predicate, never as a
    // column constraint. Strip CREATE INDEX statements before checking.
    const withoutIndexes = body.replace(/CREATE\s+INDEX[\s\S]*?;/gi, "");
    expect(withoutIndexes).not.toMatch(/NOT\s+NULL/i);
  });

  it("does not enable the write or change RLS", () => {
    expect(body).not.toMatch(/ROW\s+LEVEL\s+SECURITY/i);
    expect(body).not.toMatch(/CREATE\s+POLICY/i);
  });

  it("does not touch a table other than events", () => {
    const tables = new Set(
      [...body.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_]+)/gi)].map((m) =>
        m[1].toLowerCase(),
      ),
    );
    expect([...tables]).toEqual(["events"]);
  });

  it("parses as plain SQL with no psql meta-commands", () => {
    const stripped = stripComments(read(PROVENANCE_FILE));
    expect(stripped).not.toMatch(/^\s*\\/m);
    expect(stripped.trim().endsWith(";")).toBe(true);
  });

  it("is not referenced by an executed workflow step", () => {
    // The migration is prepared for owner review; nothing may apply it
    // automatically. `supabase-migrations.yml` is a manual dispatch and is
    // excluded because it applies the directory by design.
    const workflows = fs
      .readdirSync(path.join(process.cwd(), ".github/workflows"))
      .filter((f) => f.endsWith(".yml") && f !== "supabase-migrations.yml");
    for (const file of workflows) {
      const yaml = fs.readFileSync(path.join(process.cwd(), ".github/workflows", file), "utf8");
      expect(yaml).not.toContain(PROVENANCE_FILE);
    }
  });
});
