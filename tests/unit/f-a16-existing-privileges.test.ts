/**
 * F-A16-01 / F-A16-02b — structural guards on the proposed migrations.
 *
 * These read the SQL and pin the properties a reviewer must not have to re-derive:
 * that the existing-privileges migration only revokes the three RLS-invisible
 * privileges, never DML or SELECT; that it is scoped to `public` and catalog-driven;
 * and that the forward function guard is hardened (SECURITY DEFINER, pinned
 * search_path) and scoped to `public`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

const EXISTING_PRIVS_FILE = "20261115000200_f_a16_existing_table_privileges.sql";
const GUARD_FILE = "20261114990000_f_a16_public_function_execute_guard.sql";

/** Strip `--` comments and dollar-quoted bodies, so structural regexes see only DDL. */
function statements(sql: string): string[] {
  const noComments = sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  const topLevel = noComments.replace(/\$\$[\s\S]*?\$\$/g, "<DO_BODY>");
  return topLevel
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("F-A16-01 existing table privileges (structural)", () => {
  const raw = fs.readFileSync(path.join(MIGRATIONS, EXISTING_PRIVS_FILE), "utf8");
  // Comments carry prose that names the very identifiers being asserted (and the
  // rollback block quotes GRANT statements), so structural checks run against the
  // comment-stripped text, not the raw file.
  const sql = raw
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  const stmts = statements(raw);

  it("is marked PROPOSED / NOT APPLIED", () => {
    expect(raw).toMatch(/Status: PROPOSED\. NOT APPLIED/);
  });

  it("revokes only TRUNCATE, REFERENCES and TRIGGER", () => {
    // Match only real revoke statements (and the dynamic `format('REVOKE …')` forms):
    // `REVOKE` followed by a privilege keyword. This deliberately does not match the
    // word "revoke"/"revokes" inside prose or RAISE HINT strings.
    const revokes = sql.match(/\bREVOKE\s+(?:TRUNCATE|REFERENCES|TRIGGER|ALL|SELECT|INSERT|UPDATE|DELETE)\b[^;]*/gi) ?? [];
    expect(revokes.length).toBeGreaterThan(0);
    for (const r of revokes) {
      expect(r).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE)\b/i);
      expect(r).toMatch(/\b(TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i);
    }
  });

  it("never revokes from PUBLIC on existing tables", () => {
    // PUBLIC is not a public-facing role for existing grants; the audit found no such
    // grants, and revoking ALL from PUBLIC could strip owner-intended access.
    for (const r of sql.match(/\bREVOKE\s+(?:TRUNCATE|REFERENCES|TRIGGER|ALL)\b[^;']*/gi) ?? []) {
      expect(r).not.toMatch(/\bFROM\b[^;]*\bPUBLIC\b/i);
    }
  });

  it("names only the three public-facing roles as grantees", () => {
    for (const r of sql.match(/\bREVOKE\s+(?:TRUNCATE|REFERENCES|TRIGGER|ALL)\b[^;']*/gi) ?? []) {
      const from = (r.split(/\bFROM\b/i)[1] ?? "").replace(/['\s]+/g, " ");
      for (const token of from.split(/[,\s]+/).filter(Boolean)) {
        expect(["service_role", "anon", "authenticated"]).toContain(token.toLowerCase());
      }
    }
  });

  it("scopes every table REVOKE to the public schema", () => {
    for (const r of sql.match(/\bREVOKE\s+(?:TRUNCATE|REFERENCES|TRIGGER|ALL)\b[^;']*/gi) ?? []) {
      if (/\bON TABLE\b/i.test(r)) {
        expect(r).toMatch(/ON TABLE public\./i);
      }
    }
  });

  it("never references Supabase Auth or platform-managed schemas", () => {
    // The catalog sweep is `n.nspname = 'public'`; nothing may name auth/storage/graphql.
    expect(sql).not.toMatch(/\bauth\./i);
    expect(sql).not.toMatch(/\bstorage\./i);
    expect(sql).not.toMatch(/\bgraphql/i);
    expect(sql).toMatch(/n\.nspname\s*=\s*'public'/i);
  });

  it("discovers tables from the catalog rather than hard-coding a list", () => {
    expect(sql).toMatch(/FROM\s+pg_catalog\.pg_class/i);
    expect(sql).toMatch(/relkind IN \('r', 'p'\)/i);
  });

  it("has no TRUNCATE exception: service_role loses all three on every table", () => {
    // F-A16-01 correction (2026-11-03): an earlier revision kept `TRUNCATE` for
    // service_role on tables carrying a BEFORE TRUNCATE guard, on the false premise that
    // the guard only fires for a role holding TRUNCATE. Measured on PostgreSQL 17 and 18,
    // the guard fires for the table owner and for superusers too, so the exception was
    // removed. The revoke path must not read pg_trigger, and every service_role revoke
    // must name all three privileges.
    expect(sql).not.toMatch(/pg_catalog\.pg_trigger/i);
    expect(sql).not.toMatch(/tgtype/i);
    expect(sql).not.toMatch(/has_truncate_guard/i);
    // The service_role sweep must revoke all three (the section-3 seva re-assert block
    // deliberately re-issues only TRIGGER/REFERENCES, matching the pre-existing hardening;
    // section 2 already removed TRUNCATE on those tables).
    expect(sql).toMatch(
      /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.%I FROM service_role/i
    );
  });

  it("asserts PUBLIC holds none of the three (effective check, no PUBLIC revoke)", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-01: PUBLIC holds TRUNCATE\/REFERENCES\/TRIGGER/i);
    expect(sql).toMatch(/has_table_privilege\('public', c\.oid, p\.priv\)/i);
  });

  it("asserts the four public-read tables keep their anon/authenticated SELECT grant", () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION 'F-A16-01: public-read table\(s\) lost their anon\/authenticated SELECT grant/i
    );
    expect(sql).toMatch(/has_table_privilege\(g\.r, c\.oid, 'SELECT'\)/i);
  });

  it("preserves public SELECT by asserting the four public-read policies", () => {
    expect(sql).toMatch(/unnest\(ARRAY\['events', 'aaradhanes', 'site_settings', 'social_links'\]\)/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-01: public-read table\(s\) lost their SELECT policy/i);
  });

  it("fails closed with a post-condition on the three privileges", () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION 'F-A16-01: public-facing roles still hold TRUNCATE\/REFERENCES\/TRIGGER: %'/i
    );
  });

  it("is idempotent: every top-level statement is a REVOKE or a guarded DO block", () => {
    for (const s of stmts) {
      expect(s).toMatch(/^(REVOKE|DO\s*<DO_BODY>)/i);
    }
  });
});

describe("F-A16-02b forward function-EXECUTE guard (structural)", () => {
  const raw = fs.readFileSync(path.join(MIGRATIONS, GUARD_FILE), "utf8");
  const sql = raw;

  it("is marked PROPOSED / NOT APPLIED", () => {
    expect(raw).toMatch(/Status: PROPOSED\. NOT APPLIED/);
  });

  it("hardens the guard function (SECURITY DEFINER, pinned search_path)", () => {
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = pg_catalog/i);
  });

  it("scopes the revoke to the public schema and keeps service_role executable", () => {
    expect(sql).toMatch(/cmd\.schema_name <> 'public'/i);
    // ON ROUTINE, not ON FUNCTION: a procedure is not a function, and ON FUNCTION would
    // abort CREATE PROCEDURE with `is not a function` (F-A16-02b correction, 2026-11-03).
    expect(sql).toMatch(/REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC, anon, authenticated/i);
    expect(sql).not.toMatch(/REVOKE EXECUTE ON FUNCTION %s/i);
    // service_role must not appear in the revoke list.
    expect(sql).not.toMatch(/FROM PUBLIC, anon, authenticated, service_role/i);
  });

  it("is idempotent (CREATE OR REPLACE + DROP EVENT TRIGGER IF EXISTS)", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_a16_public_fn_guard/i);
    expect(sql).toMatch(/DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard/i);
  });

  it("does not revoke EXECUTE on existing functions or touch other schemas", () => {
    // The guard only acts on functions created *after* it is installed; it must not
    // contain a bulk REVOKE against existing objects.
    expect(sql).not.toMatch(/REVOKE EXECUTE ON ALL FUNCTIONS/i);
    expect(sql).not.toMatch(/\bauth\./i);
    expect(sql).not.toMatch(/\bstorage\./i);
  });

  it("fails closed if the trigger is missing or disabled", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-02b: the forward function-EXECUTE guard was not installed'/i);
    expect(sql).toMatch(/RAISE EXCEPTION 'F-A16-02b: the forward function-EXECUTE guard is installed but disabled'/i);
  });
});
