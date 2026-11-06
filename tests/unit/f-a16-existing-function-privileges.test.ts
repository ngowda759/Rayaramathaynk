/**
 * @jest-environment node
 *
 * F-A16-07 — structural guard for the proposed existing-function privilege migration.
 *
 * These assertions read the SQL from disk; they do not connect to any database. They pin
 * the properties a reviewer must not have to re-derive:
 *
 *   - it revokes EXECUTE on exactly the two named existing functions, and from exactly
 *     `PUBLIC`, `anon` and `authenticated` — never from `service_role` or the owner;
 *   - it never drops, recreates, renames or re-owns either function, and never touches a
 *     trigger or event trigger;
 *   - it is scoped to `public` and touches no table, sequence, policy, default privilege
 *     or storage schema;
 *   - it fails closed (a precondition and a post-condition that raise).
 *
 * The behavioural counterpart lives in `tests/db/f-a16-existing-function-privileges.test.ts`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const FILE = "supabase/migrations/20261115000300_f_a16_existing_function_privileges.sql";

const raw = fs.readFileSync(path.join(ROOT, FILE), "utf8");
/** SQL with `--` line comments removed, so assertions test statements not prose. */
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const TARGETS = ["public.rls_auto_enable()", "public.update_updated_at_column()"];

describe("F-A16-07 existing function privileges (structural)", () => {
  it("is marked PROPOSED / NOT APPLIED", () => {
    expect(raw).toMatch(/Status: PROPOSED\. NOT APPLIED/);
  });

  it("revokes EXECUTE on exactly the two named functions", () => {
    const revokes = sql.match(/REVOKE EXECUTE ON FUNCTION[^;]*;/gi) ?? [];
    expect(revokes).toHaveLength(2);
    for (const sig of TARGETS) {
      expect(revokes.some((r) => r.includes(sig))).toBe(true);
    }
  });

  it("revokes from PUBLIC, anon and authenticated only — never service_role or postgres", () => {
    const revokes = sql.match(/REVOKE EXECUTE ON FUNCTION[^;]*;/gi) ?? [];
    expect(revokes.length).toBeGreaterThan(0);
    for (const r of revokes) {
      expect(r).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated\s*;/i);
      expect(r).not.toMatch(/service_role/i);
      expect(r).not.toMatch(/\bpostgres\b/i);
    }
  });

  it("does not drop, create, alter or re-own either function", () => {
    // The function bodies, triggers and event triggers must remain untouched: a trigger
    // fires as the function owner regardless of EXECUTE, so only the grant is changed.
    expect(sql).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(sql).not.toMatch(/\bALTER\s+FUNCTION\b/i);
  });

  it("does not touch any trigger or event trigger", () => {
    expect(sql).not.toMatch(/\b(CREATE|DROP|ALTER)\s+EVENT\s+TRIGGER\b/i);
    expect(sql).not.toMatch(/\b(CREATE|DROP|ALTER)\s+TRIGGER\b/i);
  });

  it("touches no table, sequence, policy, index or default privilege", () => {
    expect(sql).not.toMatch(/\bALTER\s+DEFAULT\s+PRIVILEGES\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+(TABLE|POLICY|INDEX|SEQUENCE)\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|POLICY|INDEX|SEQUENCE)\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
  });

  it("never references a non-public schema (no storage/graphql/auth change)", () => {
    expect(sql).not.toMatch(/\bstorage\./i);
    expect(sql).not.toMatch(/\bgraphql/i);
    expect(sql).not.toMatch(/\bauth\./i);
    // Every function it names is in `public`.
    const revokes = sql.match(/REVOKE EXECUTE ON FUNCTION[^;]*;/gi) ?? [];
    for (const r of revokes) {
      expect(r).toMatch(/ON FUNCTION public\./i);
    }
  });

  it("has no destructive unrelated statement (no DML, no TRUNCATE command)", () => {
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("fails closed with a precondition and a post-condition that raise", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-07: required Supabase roles are missing/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-07: expected function\(s\) not found/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-07: cannot change EXECUTE on target function\(s\) owned by a role this session may not act for/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-07: function\(s\) still executable by anon\/authenticated/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-07: function\(s\) lost EXECUTE for service_role/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-07: function\(s\) lost EXECUTE for the owner/i);
  });

  it("resolves the target owner from the catalog and gates on it before any REVOKE (B-1)", () => {
    // Do not assume owner=postgres. The precondition must read proowner and refuse unless
    // the session may act for the owner — the exact condition PostgreSQL enforces to change
    // the ACL. A non-owner REVOKE only WARNS, so this is the fail-closed signal.
    expect(sql).toMatch(/p\.proowner/);
    expect(sql).toMatch(/pg_has_role\(current_user,\s*fn_owner,\s*'MEMBER'\)/i);
    // It must NOT hard-code a specific owner name in the precondition.
    expect(sql).not.toMatch(/pg_has_role\(current_user,\s*'postgres'/i);
    expect(sql).not.toMatch(/pg_has_role\(current_user,\s*'supabase_admin'/i);
    // The ownership gate must precede the first REVOKE.
    const gateAt = sql.search(/pg_has_role\(current_user,\s*fn_owner,\s*'MEMBER'\)/i);
    const firstRevokeAt = sql.search(/REVOKE EXECUTE ON FUNCTION public\.rls_auto_enable\(\)/i);
    expect(gateAt).toBeGreaterThan(-1);
    expect(firstRevokeAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(firstRevokeAt);
  });

  it("verifies the owner keeps EXECUTE without naming the owner", () => {
    expect(sql).toMatch(/p\.proowner::regrole::text/);
    expect(sql).toMatch(/function\(s\) lost EXECUTE for the owner/i);
  });

  it("verifies the effective privilege with has_function_privilege, not just the revoke", () => {
    // A REVOKE a role may not perform only WARNS; the post-condition must re-read.
    expect(sql).toMatch(/has_function_privilege\('anon',[^)]*'EXECUTE'\)/i);
    expect(sql).toMatch(/has_function_privilege\('authenticated',[^)]*'EXECUTE'\)/i);
    expect(sql).toMatch(/has_function_privilege\('service_role',[^)]*'EXECUTE'\)/i);
  });

  it("is idempotent: every top-level statement is a REVOKE or a DO block", () => {
    const topLevel = sql.replace(/\$\$[\s\S]*?\$\$/g, "<DO_BODY>");
    const statements = topLevel
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const stmt of statements) {
      expect(stmt).toMatch(/^(REVOKE EXECUTE ON FUNCTION|DO\s*<DO_BODY>)/i);
    }
  });

  it("documents that service_role and the owner keep EXECUTE", () => {
    expect(raw).toMatch(/service_role`?\*?\*?\s*KEEPS EXECUTE/i);
    expect(raw).toMatch(/owner/i);
  });
});
