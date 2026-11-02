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

/**
 * The post-condition `DO` block, as stripped SQL. Extracted by locating the block that
 * contains its RAISE message, then walking back to its opening `DO $$` — because the
 * WHERE clauses this guard cares about precede the message, slicing forward from the
 * message alone would miss them.
 */
function postConditionBlock(): string {
  const msg = sql.indexOf("default privileges in public are still broader than intended");
  if (msg < 0) throw new Error("post-condition RAISE message not found");
  const start = sql.lastIndexOf("DO $$", msg);
  const end = sql.indexOf("END $$;", msg);
  return sql.slice(start, end);
}

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

    it("does NOT filter discovery by grantee (a filtered search is not an inventory)", () => {
      // An earlier revision filtered pg_default_acl rows with a text pattern for
      // anon/authenticated/service_role. That is a targeted search: it misses a role
      // whose public default ACL names only some other grantee, and it silently
      // reports "covered" for a role it never examined. The discovery must not
      // reintroduce such a filter.
      expect(sql).not.toMatch(/defaclacl::text\s*~/i);
      expect(sql).not.toMatch(/\(anon\|authenticated\|service_role\)=/i);
    });

    it("enumerates creators by EFFECTIVE CREATE privilege, not a direct ACL join", () => {
      // A role can create in `public` while holding no `pg_default_acl` row at all, so
      // the default-ACL catalog alone cannot enumerate creators. The second source must
      // use `has_schema_privilege`, which accounts for inheritance through membership
      // and for a CREATE granted to PUBLIC. A direct `aclexplode(nspacl)` join sees only
      // the directly-granted role, and drops a PUBLIC grant (grantee OID 0, no pg_roles
      // row) entirely.
      expect(sql).toMatch(/has_schema_privilege\(r\.oid,\s*'public',\s*'CREATE'\)/i);
    });

    it("does not use a direct nspacl join for creator discovery", () => {
      // Regression guard: the join was the earlier (insufficient) form. It must not come
      // back — it silently misses inherited and PUBLIC-derived CREATE.
      expect(sql).not.toMatch(/aclexplode\(n\.nspacl\)/i);
    });

    it("fails closed when a public-facing role can itself create in public", () => {
      // A public-facing role with CREATE makes "creator" and "public-facing role"
      // overlap, and removing it is a schema-ACL change (F-A16-01 scope, deferred).
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: public-facing role\(s\) hold CREATE on schema public: %'/i
      );
      expect(sql).toMatch(/has_schema_privilege\(r\.oid,\s*'public',\s*'CREATE'\)/i);
    });

    it("unions both discovery sources rather than picking one", () => {
      // Both sources must contribute. UNION (not UNION ALL) also de-duplicates a role
      // that appears in both, which keeps the loop from acting on it twice.
      const union = sql.match(/\bUNION\b/gi) ?? [];
      expect(union.length).toBeGreaterThanOrEqual(1);
      expect(sql).not.toMatch(/\bUNION ALL\b/i);
    });

    it("skips the pg_database_owner pseudo-role explicitly", () => {
      // It always holds CREATE on `public` in PG 15+ but creates nothing itself, so
      // treating it as an uncoverable creator would fail the migration everywhere.
      expect(sql).toMatch(/CONTINUE WHEN target = 'pg_database_owner'/i);
      expect(sql).toMatch(/c\.rolname <> 'pg_database_owner'/i);
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

    it("post-condition recomputes the same candidate set as the discovery", () => {
      // If the post-condition used a narrower set than section 4, a covered-but-unverified
      // role could slip through. Both must read the same two sources.
      const post = postConditionBlock();
      expect(post).toMatch(/FROM\s+pg_catalog\.pg_default_acl/i);
      expect(post).toMatch(/has_schema_privilege\(r\.oid, 'public', 'CREATE'\)/i);
    });

    it("fails closed on global table/sequence defaults before doing anything", () => {
      // A schema-scoped REVOKE cannot subtract a globally-granted default, so the
      // migration must refuse to run while one grants tables or sequences to a
      // public-facing role — otherwise it would report a success that is not real.
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: global default privileges confer future objects on public-facing roles: %'/i
      );
      expect(sql).toMatch(/d\.defaclnamespace\s*=\s*0/);
      expect(sql).toMatch(/d\.defaclobjtype IN \('r', 'S'\)/);
    });

    it("excludes the global PUBLIC function default from the 0b precondition", () => {
      // Section 3 remediates the global PUBLIC function default (the only way to remove
      // the implicit PUBLIC EXECUTE), so 0b must not reject it. Only a DIRECT global
      // function grant to a named public-facing role is refused.
      const anchor = sql.indexOf("global default privileges confer future objects");
      expect(anchor).toBeGreaterThan(-1);
      // The function arm of the 0b check must not include `a.grantee = 0`.
      const check = sql.slice(sql.indexOf("global_leaks"), anchor);
      const funcArm = check.slice(check.indexOf("d.defaclobjtype = 'f'"));
      expect(funcArm).not.toMatch(/a\.grantee = 0/);
    });

    it("post-condition also covers global (ns=0) function default ACLs", () => {
      // The review asked for global default ACL entries to be assessed separately. The
      // post-condition must check ns=0 for direct grants to the public-facing roles, not
      // only the per-schema rows.
      expect(postConditionBlock()).toMatch(/d\.defaclnamespace\s*=\s*0/i);
    });

    it("post-condition excludes the owner's own default-ACL entry", () => {
      // `ALTER DEFAULT PRIVILEGES` always keeps an implicit owner=<privs>/owner entry
      // that cannot be revoked. Checking "the owner's name appears as a grantee" would
      // false-positive on a creator named like a public-facing role, so the check must
      // require the grant to be to someone other than the owner.
      expect(postConditionBlock()).toMatch(/a\.grantee <> d\.defaclrole/);
    });

    it("detects PUBLIC via grantee = 0, not via pg_get_userbyid", () => {
      // pg_get_userbyid(0) returns 'unknown (OID=0)', not NULL, so an IN-list never
      // matches PUBLIC. Every public-facing check must test grantee = 0 explicitly.
      expect(sql).toMatch(/a\.grantee = 0/);
    });

    it("documents its scope and limits in the file itself", () => {
      // The migration must not imply it enumerated every possible future creator.
      expect(raw).toMatch(/Scope and limitations/i);
      expect(raw).toMatch(/cannot enumerate roles that do not exist yet/i);
      expect(raw).toMatch(/not "all creators are covered"/i);
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

    it("discovers candidates from both sources, not a grantee-filtered search", () => {
      // It must not re-introduce the filter the migration dropped, and it must use
      // effective CREATE (inheritance + PUBLIC aware) rather than a direct nspacl join.
      expect(ownerRun).not.toMatch(/defaclacl::text\s*~/i);
      expect(ownerRun).not.toMatch(/aclexplode\(n\.nspacl\)/i);
      expect(ownerRun).toMatch(/has_schema_privilege\(r\.oid, 'public', 'CREATE'\)/i);
      expect(ownerRun).toMatch(/candidate <> 'pg_database_owner'/i);
    });

    it("documents the owner-reviewed global table/sequence remediation", () => {
      // The global fix affects every schema, so it must be a documented owner action,
      // not something the main migration does automatically.
      expect(ownerRun).toMatch(/GLOBAL table\/sequence defaults/);
      expect(ownerRun).toMatch(/EVERY schema/i);
      expect(ownerRun).toMatch(/REVOKE ALL ON TABLES\s+FROM PUBLIC/);
      expect(ownerRun).toMatch(/REVOKE ALL ON SEQUENCES FROM PUBLIC/);
    });

    it("touches only default privileges, never an existing object", () => {
      expect(ownerRun).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(ownerRun).not.toMatch(/\bCREATE\s+(TABLE|POLICY|INDEX)\b/i);
      expect(ownerRun).not.toMatch(/\bDROP\s+(TABLE|FUNCTION|POLICY|TRIGGER)\b/i);
    });

    it("verifies the same post-condition as the migration, including global rows", () => {
      expect(ownerRun).toMatch(/aclexplode\(d\.defaclacl\)/i);
      expect(ownerRun).toMatch(/d\.defaclnamespace = 'public'::regnamespace/i);
      expect(ownerRun).toMatch(/d\.defaclnamespace = 0/i);
    });
  });
});
