/**
 * @jest-environment node
 *
 * Static tests for the prepared `events` public-read policy migration.
 *
 * The migration is NOT applied here and must not be: this suite only reads the SQL
 * file. It asserts the properties that make the policy safe to hand to an owner for
 * review — SELECT-only, published-only, no draft exposure, no write grant — because
 * the whole point of the policy is that it must be *narrow enough* that turning it
 * on cannot leak unpublished events.
 *
 * This is the reader/RLS half of the PR-D4c split; the writer-schema half
 * (provenance columns) lives in `provenance-migration.test.ts`.
 */

import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const POLICY_FILE = "20261105000000_events_public_select_policy.sql";

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

describe("events public-read policy migration", () => {
  const sql = read(POLICY_FILE);
  const body = stripComments(sql);

  it("sorts after the migration that was newest before this change", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const previousNewest = "20261104000000_add_events_provenance_columns.sql";
    expect(files.indexOf(POLICY_FILE)).toBeGreaterThan(files.indexOf(previousNewest));
  });

  it("grants SELECT only — never ALL, INSERT, UPDATE or DELETE", () => {
    expect(body).toMatch(/CREATE\s+POLICY[\s\S]*?FOR\s+SELECT\b/i);
    expect(body).not.toMatch(/FOR\s+ALL\b/i);
    expect(body).not.toMatch(/FOR\s+(?:INSERT|UPDATE|DELETE)\b/i);
    expect(body).not.toMatch(/\bGRANT\b/i);
  });

  it("exposes only published rows, so a draft can never be enumerated", () => {
    // The predicate must be `published = true` (or equivalent), not `USING (true)`.
    expect(body).toMatch(/USING\s*\(\s*published\s*(?:=\s*true|IS\s+TRUE)\s*\)/i);
    expect(body).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("targets the public read roles, not a privileged one", () => {
    expect(body).toMatch(/TO\s+anon\s*,\s*authenticated\b/i);
    expect(body).not.toMatch(/TO\s+(?:service_role|postgres)\b/i);
  });

  it("touches only the events table", () => {
    const tables = new Set(
      [...body.matchAll(/\bON\s+(?:public\.)?([a-z_]+)\b/gi)].map((m) => m[1].toLowerCase()),
    );
    expect([...tables]).toEqual(["events"]);
  });

  it("is idempotent, so a re-run cannot fail on an existing policy", () => {
    expect(body).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS/i);
  });

  it("changes nothing but the policy — no schema, no data, no other RLS", () => {
    expect(body).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(body).not.toMatch(/\b(?:ADD|DROP)\s+COLUMN\b/i);
    expect(body).not.toMatch(/\bUPDATE\s+/i);
    expect(body).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(body).not.toMatch(/\bTRUNCATE\b/i);
    expect(body).not.toMatch(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  });

  it("parses as plain SQL with no psql meta-commands", () => {
    expect(body).not.toMatch(/^\s*\\/m);
    expect(body.trim().endsWith(";")).toBe(true);
  });

  it("is not referenced by an executed workflow step", () => {
    // The policy is prepared for owner review; nothing may apply it automatically.
    // `supabase-migrations.yml` is a manual dispatch and applies the directory by
    // design, so it is excluded.
    const workflows = fs
      .readdirSync(path.join(process.cwd(), ".github/workflows"))
      .filter((f) => f.endsWith(".yml") && f !== "supabase-migrations.yml");
    for (const file of workflows) {
      const yaml = fs.readFileSync(path.join(process.cwd(), ".github/workflows", file), "utf8");
      expect(yaml).not.toContain(POLICY_FILE);
    }
  });
});
