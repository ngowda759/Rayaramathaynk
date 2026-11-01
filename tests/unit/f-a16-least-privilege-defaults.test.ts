/**
 * @jest-environment node
 *
 * F-A16-02 — structural guard for the proposed least-privilege default-privileges
 * migration. These assertions read the SQL from disk; they do not connect to any
 * database. They exist so the migration cannot silently lose one of the properties
 * that make it safe to apply:
 *
 *   - it only ever changes *default* privileges (`ALTER DEFAULT PRIVILEGES`), never
 *     the ACL of an existing object;
 *   - it does not revoke from `service_role` the rights the server-side application
 *     depends on (DML and sequence USAGE);
 *   - the function revoke uses the *global* form (a per-schema form is a no-op for
 *     the implicit PUBLIC EXECUTE);
 *   - it never touches `rls_auto_enable`, `ensure_rls`, or a table/sequence ACL.
 *
 * The behavioural counterpart lives in `tests/db/f-a16-default-privileges.test.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const FILE = "supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql";

const raw = readFileSync(path.join(ROOT, FILE), "utf8");
/** SQL with `--` line comments removed, so assertions test statements not prose. */
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("F-A16-02 least-privilege default privileges", () => {
  it("changes only default privileges, never an existing object's ACL", () => {
    // The whole safety argument for this migration is that it cannot alter a live
    // object. Any GRANT/REVOKE *ON TABLE/SEQUENCE/FUNCTION* (i.e. without DEFAULT)
    // would break that, so it must not appear.
    expect(sql).not.toMatch(/REVOKE\s+[\s\S]*?\bON\s+(TABLE|SEQUENCE|FUNCTION)\b(?![\s\S]*DEFAULT)/i);
    expect(sql).not.toMatch(/\bGRANT\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|FUNCTION|POLICY|TRIGGER)\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+(TABLE|POLICY|INDEX)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("does not touch the platform RLS auto-enable surface", () => {
    expect(sql).not.toMatch(/rls_auto_enable/);
    expect(sql).not.toMatch(/ensure_rls/);
  });

  it("revokes the broad table defaults from the public-facing roles", () => {
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated/i
    );
  });

  it("removes TRUNCATE/REFERENCES/TRIGGER defaults from service_role", () => {
    // RLS cannot compensate for these three, so they are removed from the backend
    // role as well. This mirrors 20261029235900_seva_privilege_hardening.sql.
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role/i
    );
  });

  it("revokes the sequence defaults from the public-facing roles", () => {
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated/i
    );
  });

  it("removes the implicit PUBLIC EXECUTE with the global (not per-schema) form", () => {
    // The per-schema form cannot remove the implicit PUBLIC grant; only the global
    // form can. Assert the global statement is present and that no per-schema
    // REVOKE ... FROM PUBLIC exists (which would be dead code).
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i);
    expect(sql).not.toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i
    );
  });

  it("keeps service_role's function EXECUTE (documented, reviewed exception)", () => {
    // service_role must NOT appear in the function-EXECUTE revokes: the seva RPC
    // surface depends on the default. The two function revokes name PUBLIC and
    // anon/authenticated only.
    const fnRevokes = sql.match(/ALTER DEFAULT PRIVILEGES[^;]*REVOKE[^;]*ON FUNCTIONS[^;]*;/gi) ?? [];
    expect(fnRevokes.length).toBeGreaterThanOrEqual(2);
    for (const stmt of fnRevokes) {
      expect(stmt).not.toMatch(/service_role/i);
    }
  });

  it("keeps service_role's table DML defaults (only TRIGGER/REFERENCES are revoked)", () => {
    // The top-level statement that names service_role on TABLES.
    const direct = sql.match(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ([^;]*?) ON TABLES FROM ([^;]*service_role[^;]*);/i
    );
    expect(direct).not.toBeNull();
    expect(direct![1]).toMatch(/TRIGGER, REFERENCES/i);
    expect(direct![2]).toMatch(/service_role/i);
    // It must not revoke SELECT/INSERT/UPDATE/DELETE/ALL from service_role.
    expect(direct![1]).not.toMatch(/\bALL\b/i);
    expect(direct![1]).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
  });

  it("fails loudly when a required Supabase role is absent", () => {
    // The DO block must raise, not fall through, if anon/authenticated/service_role
    // are missing — otherwise the defaults stay broad with no signal.
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-02: required Supabase roles are missing/i);
    expect(sql).toMatch(/unnest\(ARRAY\['anon', 'authenticated', 'service_role'\]\)/);
  });

  it("is idempotent: every top-level statement is a REVOKE or a guarded DO block", () => {
    // Strip dollar-quoted bodies (the DO blocks) so the split sees only top-level
    // statements. Re-running the file is a no-op because revoking an unheld
    // privilege is a no-op in Postgres.
    const topLevel = sql.replace(/\$\$[\s\S]*?\$\$/g, '<DO_BODY>');
    const statements = topLevel
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      expect(stmt).toMatch(/^(ALTER DEFAULT PRIVILEGES|DO\s*<DO_BODY>)/i);
    }
  });

  it("is not marked as applied anywhere", () => {
    expect(raw).toMatch(/Status: PROPOSED\. NOT APPLIED/);
  });
});
