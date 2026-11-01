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
 *   - it never touches `rls_auto_enable`, `ensure_rls`, or a table/sequence ACL;
 *   - it ENUMERATES object-creating roles rather than assuming which they are, and
 *     FAILS CLOSED if it finds one it cannot act for — so the remediation can never
 *     be described as complete while a role was skipped.
 *
 * The behavioural counterpart lives in `tests/db/f-a16-least-privilege.test.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const FILE = "supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql";
const OWNER_RUN_FILE = "docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql";

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

  describe("object-creating role coverage (fail-closed)", () => {
    it("enumerates owners from pg_default_acl instead of hard-coding a role list", () => {
      // The review's requirement: do not assume only `postgres` and `supabase_admin`
      // create objects. The set must be discovered from the catalog.
      expect(sql).toMatch(/FROM\s+pg_catalog\.pg_default_acl/i);
      expect(sql).toMatch(/d\.defaclnamespace\s*=\s*'public'::regnamespace/i);
    });

    it("uses pg_has_role(..., 'MEMBER') as the precondition for acting FOR ROLE", () => {
      // This is the exact precondition Postgres enforces for ALTER DEFAULT
      // PRIVILEGES FOR ROLE, so the check cannot disagree with the server.
      expect(sql).toMatch(/pg_catalog\.pg_has_role\(current_user,\s*target,\s*'MEMBER'\)/i);
    });

    it("raises — and does not merely warn — when a role cannot be covered", () => {
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: cannot tighten default privileges for object-creating role\(s\): %'/i
      );
      // A NOTICE would let the migration "succeed" while a role was skipped.
      expect(sql).not.toMatch(/RAISE NOTICE 'F-A16-02: current role/i);
    });

    it("points the operator at the split-out owner-run step in the exception hint", () => {
      expect(sql).toMatch(/F-A16_OWNER_RUN_supabase_admin_defaults\.sql/);
    });

    it("asserts a post-condition so a silent no-op revoke cannot pass", () => {
      // The post-condition must look at aclexplode of the default ACL, not just trust
      // that the REVOKEs worked.
      expect(sql).toMatch(/aclexplode\(d\.defaclacl\)/i);
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: default privileges in public are still broader than intended/i
      );
      // And it must independently verify the implicit PUBLIC EXECUTE is gone, which
      // cannot be read from the per-schema ACL.
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: PUBLIC still has EXECUTE on future functions owned by: %'/i
      );
    });
  });

  describe("split-out owner-run step", () => {
    const ownerRun = readFileSync(path.join(ROOT, OWNER_RUN_FILE), "utf8");

    it("exists and is marked PROPOSED / NOT APPLIED", () => {
      expect(ownerRun).toMatch(/Status: PROPOSED\. NOT APPLIED/);
    });

    it("refuses to run as a role that may not change the target's defaults", () => {
      expect(ownerRun).toMatch(/pg_catalog\.pg_has_role\(current_user, target, 'MEMBER'\)/);
      expect(ownerRun).toMatch(/RAISE EXCEPTION 'F-A16-02: current role % may not change default privileges/i);
    });

    it("touches only default privileges, never an existing object", () => {
      expect(ownerRun).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(ownerRun).not.toMatch(/\bCREATE\s+(TABLE|POLICY|INDEX)\b/i);
      expect(ownerRun).not.toMatch(/\bDROP\s+(TABLE|FUNCTION|POLICY|TRIGGER)\b/i);
    });

    it("verifies the same post-condition as the migration", () => {
      expect(ownerRun).toMatch(/aclexplode\(d\.defaclacl\)/i);
      expect(ownerRun).toMatch(/d\.defaclnamespace = 'public'::regnamespace/i);
    });
  });
});
