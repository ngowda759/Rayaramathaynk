/**
 * @jest-environment node
 *
 * F-A16 post-application verification artifact. Pins the read-only property of
 * `docs/audits/F-A16_POST_APPLICATION_VERIFICATION.sql` and the presence of the
 * verification report it reproduces. These assertions run against the file text
 * (comments stripped for the statement-level checks, because the header prose
 * names the very keywords being guarded).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const SQL = path.join(ROOT, "docs/audits/F-A16_POST_APPLICATION_VERIFICATION.sql");
const REPORT = path.join(ROOT, "docs/audits/F-A16_PRODUCTION_VERIFICATION_2026-11-06.md");

const raw = readFileSync(SQL, "utf8");
/** Comment-stripped text: `--` runs to end of line. */
const sql = raw
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

describe("F-A16 post-application verification SQL", () => {
  it("exists and is not a stub", () => {
    expect(raw.length).toBeGreaterThan(1500);
  });

  it("is read-only: every statement starts with SELECT", () => {
    expect(statements.length).toBeGreaterThan(10);
    for (const s of statements) {
      expect(s).toMatch(/^SELECT\b/i);
    }
  });

  it("contains no mutating keyword at statement level", () => {
    // Strip single-quoted string literals first: `TRUNCATE` legitimately appears as a
    // privilege_type value in a WHERE clause, and that is data, not a statement verb.
    const mutating =
      /\b(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE|COMMENT\s+ON|CALL|COPY)\b/i;
    for (const s of statements) {
      const noLiterals = s.replace(/'(?:[^']|'')*'/g, "''");
      expect(noLiterals).not.toMatch(mutating);
    }
  });

  it("asserts the session is read-only before anything else", () => {
    expect(statements[0]).toMatch(/transaction_read_only/);
    expect(statements[0]).toMatch(/default_transaction_read_only/);
  });

  it("covers the two target functions and the default-ACL, RLS, event-trigger and ledger evidence", () => {
    expect(raw).toMatch(/rls_auto_enable/);
    expect(raw).toMatch(/update_updated_at_column/);
    expect(raw).toMatch(/pg_default_acl/);
    expect(raw).toMatch(/pg_event_trigger/);
    expect(raw).toMatch(/pg_policies/);
    expect(raw).toMatch(/supabase_migrations\.schema_migrations/);
  });
});

describe("F-A16 post-application verification report", () => {
  it("exists and is not a stub", () => {
    const doc = readFileSync(REPORT, "utf8");
    expect(doc.length).toBeGreaterThan(3000);
  });

  it("records the outcome for every item and the open residual", () => {
    const doc = readFileSync(REPORT, "utf8");
    expect(doc).toMatch(/PASS/);
    expect(doc).toMatch(/FAIL/);
    expect(doc).toMatch(/supabase_admin/);
    expect(doc).toMatch(/read-only/i);
  });
});
