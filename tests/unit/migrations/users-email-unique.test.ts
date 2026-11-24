import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const FILE = join(
  ROOT,
  "supabase/migrations/20261204000000_users_email_lower_btrim_unique.sql",
);
const sql = readFileSync(FILE, "utf8");

describe("N-05 users.email unique expression index", () => {
  it("creates a unique index on lower(btrim(email))", () => {
    expect(sql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+users_email_lower_btrim_key/i,
    );
    expect(sql).toMatch(
      /ON\s+public\.users\s*\(\s*lower\s*\(\s*btrim\s*\(\s*email\s*\)\s*\)\s*\)/i,
    );
  });

  it("does not use CONCURRENTLY and does not mutate data", () => {
    expect(sql).not.toMatch(/\bCONCURRENTLY\b/i);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
  });
});
