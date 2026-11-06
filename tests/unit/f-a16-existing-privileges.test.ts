/**
 * F-A16-01 / F-A16-02b — structural guards on the migrations.
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
const OWNER_RUN_SU_GUARD_FILE = "docs/audits/F-A16_OWNER_RUN_supabase_admin_function_guard.sql";

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

  it("is marked locally tested with production application pending", () => {
    expect(raw).toMatch(/Status: exists and is fully tested locally/);
    expect(raw).toMatch(/PRODUCTION APPLICATION PENDING/);
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

  it("is marked locally tested with production application pending", () => {
    expect(raw).toMatch(/Status: exists and is fully tested locally/);
    expect(raw).toMatch(/PRODUCTION APPLICATION PENDING/);
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

  it("re-reads the effective privilege after the REVOKE and raises if it survived", () => {
    // A REVOKE the guard owner may not perform only WARNS (`no privileges could be
    // revoked`) and leaves the routine world-executable — measured on real PostgreSQL
    // 15.19 and 17.11. The guard must therefore re-read the effective privilege with
    // `has_function_privilege` and RAISE, so an unmanageable creator fails closed.
    // See docs/audits/F-A16_INTEGRATION_VERIFICATION.md (Test A.3).
    expect(sql).toMatch(/has_function_privilege\('anon', cmd\.object_identity, 'EXECUTE'\)/i);
    expect(sql).toMatch(/has_function_privilege\('authenticated', cmd\.object_identity, 'EXECUTE'\)/i);
    expect(sql).toMatch(/F-A16-02b: could not revoke EXECUTE on %/i);
    // And the header must no longer claim the REVOKE itself raises.
    expect(sql).not.toMatch(/cannot manage raises `must be owner of/i);
  });
});

describe("F-A16-02b superuser-owned owner-run guard (structural)", () => {
  const raw = fs.readFileSync(path.join(ROOT, OWNER_RUN_SU_GUARD_FILE), "utf8");
  // Structural checks run against comment-stripped text: the header prose names the very
  // identifiers being asserted (e.g. it says the file does NOT issue ALTER DEFAULT
  // PRIVILEGES), which would otherwise produce false failures.
  const sql = raw
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");

  it("is marked locally tested, not executed, production application pending", () => {
    expect(raw).toMatch(/Status: exists and is fully tested locally/);
    expect(raw).toMatch(/NOT EXECUTED/);
    expect(raw).toMatch(/PRODUCTION APPLICATION PENDING/);
  });

  it("installs a second, distinctly named guard function and trigger", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_a16_public_fn_guard_su\(\)/i);
    expect(sql).toMatch(/DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard_su/i);
    expect(sql).toMatch(/CREATE EVENT TRIGGER f_a16_public_fn_guard_su/i);
  });

  it("hardens the guard and scopes the revoke to public, keeping service_role executable", () => {
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = pg_catalog/i);
    expect(sql).toMatch(/cmd\.schema_name <> 'public'/i);
    expect(sql).toMatch(/REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC, anon, authenticated/i);
    expect(sql).not.toMatch(/FROM PUBLIC, anon, authenticated, service_role/i);
  });

  it("fails closed if the revoke did not take effect", () => {
    expect(sql).toMatch(/F-A16-02b\(su\): could not revoke EXECUTE on %/i);
    expect(sql).toMatch(/has_function_privilege\('anon', cmd\.object_identity, 'EXECUTE'\)/i);
    expect(sql).toMatch(/has_function_privilege\('authenticated', cmd\.object_identity, 'EXECUTE'\)/i);
  });

  it("verifies the trigger is superuser-owned, or supautils would skip it", () => {
    expect(sql).toMatch(/F-A16-02b\(su\): the superuser-owned guard was not installed/i);
    expect(sql).toMatch(/F-A16-02b\(su\): guard owner % is not a superuser/i);
    expect(sql).toMatch(/rolname = trg\.owner AND rolsuper/i);
  });

  it("does not change any default privilege (that is the sibling owner-run file)", () => {
    expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES/i);
  });

  it("touches no existing user object: only its own guard function/trigger", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|POLICY|INDEX)\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bauth\./i);
    expect(sql).not.toMatch(/\bstorage\./i);
  });
});
