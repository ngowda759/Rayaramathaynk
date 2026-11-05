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
 *   - it issues NO global (`ALTER DEFAULT PRIVILEGES` without `IN SCHEMA`) statement:
 *     every statement is scoped to `public`, and the implicit PUBLIC EXECUTE on future
 *     functions is closed forward by the guard migration instead;
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
    expect(sql).not.toMatch(/\bCREATE\s+(TABLE|POLICY|INDEX)\b/i);
    // The only DROP allowed is the snapshot temp table's own lifecycle (created and dropped
    // by this file); any other DROP would mean it touches an existing object.
    expect(sql.replace(/DROP TABLE IF EXISTS f_a16_02_pre_nonpublic_defaults/gi, "")).not.toMatch(
      /\bDROP\s+(TABLE|FUNCTION|POLICY|TRIGGER)\b/i
    );
    // No TRUNCATE *command* (a data-destroying statement). Strip `--` comments and single
    // quoted literals first, then require every remaining TRUNCATE token to sit inside a
    // REVOKE (the privilege list). The post-condition's `privilege_type IN ('TRUNCATE', …)`
    // is a literal and disappears here, so only the REVOKE can match.
    const code = sql.replace(/--[^\n]*/g, "").replace(/'[^']*'/g, "''");
    const truncateTokens = (code.match(/\bTRUNCATE\b/gi) ?? []).length;
    const truncateInRevoke = (code.match(/REVOKE[^;]*\bTRUNCATE\b/gi) ?? []).length;
    expect(truncateTokens).toBeGreaterThan(0);
    expect(truncateTokens).toBe(truncateInRevoke);
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
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role/i
    );
  });

  it("revokes the sequence defaults from the public-facing roles", () => {
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated/i
    );
  });

  it("scopes every ALTER DEFAULT PRIVILEGES to the public schema (no global statement)", () => {
    // The F-A16-02 correction: a global (`ALTER DEFAULT PRIVILEGES` with no `IN SCHEMA`)
    // statement changes the defaults for EVERY schema, including Supabase-managed
    // storage/graphql/graphql_public. The audit found 0 global entries, so the migration
    // must not create one. Every default-privilege statement must carry `IN SCHEMA public`.
    const stmts = sql.match(/ALTER DEFAULT PRIVILEGES[^;]*;/gi) ?? [];
    expect(stmts.length).toBeGreaterThan(0);
    for (const s of stmts) {
      // Both the direct form and the `FOR ROLE x IN SCHEMA public` form are acceptable;
      // a bare global form (no IN SCHEMA) is not.
      expect(s).toMatch(/ALTER DEFAULT PRIVILEGES(\s+FOR ROLE \S+)?\s+IN SCHEMA public /i);
    }
    // And no bare global revoke of the function default.
    expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i);
  });

  it("removes the platform's per-schema function grant to anon/authenticated", () => {
    // The implicit PUBLIC EXECUTE is closed forward by the guard migration, not here;
    // what this file does remove is the platform's explicit per-schema GRANT ALL.
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated/i
    );
  });

  it("asserts it did not change any non-public schema's default ACLs (as a diff)", () => {
    // Scope assertion: the migration must fail if it ADDS a default ACL for a schema other
    // than `public` that names a public-facing grantee. It is a diff against a snapshot,
    // not an absence check: a stock Supabase project already carries non-public defaults
    // (storage/graphql/graphql_public) that F-A16-02 does not touch, so an absence check
    // would fail on a correct project.
    expect(sql).toMatch(
      /RAISE EXCEPTION 'F-A16-02: this migration added public-facing default privileges in non-public schemas/i
    );
    expect(sql).toMatch(/f_a16_02_pre_nonpublic_defaults/);
    // The snapshot must be taken before the default-privilege statements, and dropped after.
    const snapAt = sql.search(/CREATE TEMP TABLE f_a16_02_pre_nonpublic_defaults/);
    const firstAlter = sql.search(/ALTER DEFAULT PRIVILEGES/);
    expect(snapAt).toBeGreaterThan(-1);
    expect(snapAt).toBeLessThan(firstAlter);
  });

  it("converges after the owner-run step instead of failing closed on membership forever", () => {
    // A role the applier is not a member of must still fail closed WHILE it leaks, but a
    // non-member the owner-run step already remediated must not block the re-run. The
    // inline EXISTS check encodes that distinction without creating any helper object.
    expect(sql).toMatch(/IF NOT pg_catalog\.pg_has_role\(current_user, inv\.candidate, 'MEMBER'\)/);
    expect(sql).toMatch(/SELECT EXISTS \(/);
    expect(sql).toMatch(/pg_catalog\.pg_get_userbyid\(d\.defaclrole\) = inv\.candidate/);
    expect(sql).toMatch(/already remediated by the owner-run step/i);
    expect(sql).toMatch(/IF leaks THEN/);
  });

  it("records (but does not fail on) the implicit PUBLIC EXECUTE residual", () => {
    // The residual is closed forward by the function-EXECUTE guard; this migration
    // records it with a NOTICE rather than pretending it is gone or hard-depending on it.
    expect(sql).toMatch(/the forward function-EXECUTE guard is NOT installed/i);
    expect(sql).toMatch(/f_a16_public_function_execute_guard\.sql/);
  });

  it("keeps service_role's function EXECUTE (documented, reviewed exception)", () => {
    // service_role must NOT appear in the function-EXECUTE revokes: the seva RPC
    // surface depends on the default. The remaining function revoke names
    // anon/authenticated only.
    const fnRevokes = sql.match(/ALTER DEFAULT PRIVILEGES[^;]*REVOKE[^;]*ON FUNCTIONS[^;]*;/gi) ?? [];
    expect(fnRevokes.length).toBeGreaterThanOrEqual(1);
    for (const stmt of fnRevokes) {
      expect(stmt).not.toMatch(/service_role/i);
    }
  });

  it("keeps service_role's table DML defaults (only TRUNCATE/TRIGGER/REFERENCES are revoked)", () => {
    // The top-level statement that names service_role on TABLES.
    const direct = sql.match(
      /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ([^;]*?) ON TABLES FROM ([^;]*service_role[^;]*);/i
    );
    expect(direct).not.toBeNull();
    expect(direct![1]).toMatch(/TRUNCATE, REFERENCES, TRIGGER/i);
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

  it("is idempotent: every top-level statement is a REVOKE, a guarded DO block, or the snapshot lifecycle", () => {
    // Strip dollar-quoted bodies (the DO blocks) so the split sees only top-level
    // statements. Re-running the file is a no-op because revoking an unheld privilege is a
    // no-op in Postgres, and the snapshot table is dropped before it is recreated.
    const topLevel = sql.replace(/\$\$[\s\S]*?\$\$/g, '<DO_BODY>');
    const statements = topLevel
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      expect(stmt).toMatch(
        /^(ALTER DEFAULT PRIVILEGES|DO\s*<DO_BODY>|CREATE TEMP TABLE|DROP TABLE IF EXISTS)/i
      );
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

    it("does not use a direct nspacl join for creator discovery", () => {
      // Regression guard: a direct `aclexplode(nspacl)` join silently misses inherited and
      // PUBLIC-derived CREATE, so it must never be used for creator discovery. (The
      // migration enumerates default-ACL owners; effective-CREATE holders are handled by
      // the forward guard and the owner-run step — see the next test.)
      expect(sql).not.toMatch(/aclexplode\(n\.nspacl\)/i);
    });

    it("inventories effective-CREATE holders as well as default-ACL owners", () => {
      // F-A16-02 correction (2026-11-03): the creator inventory is the union of
      // (A) default-ACL owners (revoked, fail-closed) and (B) effective-CREATE holders
      // (inventoried/reported, not revoked). The earlier revision enumerated only (A)
      // and left (B) invisible to the operator. The discovery loop must now read both
      // sources, and must use `has_schema_privilege` for (B) so inherited and
      // PUBLIC-derived CREATE are seen.
      const discovery = sql.slice(sql.indexOf("FOR inv IN"), sql.indexOf("LOOP"));
      expect(discovery).toMatch(/FROM pg_catalog\.pg_default_acl/i);
      expect(discovery).toMatch(/has_schema_privilege\(r\.oid,\s*'public',\s*'CREATE'\)/i);
      // A default-ACL owner must never be downgraded to class (B) by the union.
      expect(discovery).toMatch(/bool_or\(has_default_acl\)/i);
    });

    it("fails closed when a public-facing role can itself create in public", () => {
      // A public-facing role with CREATE makes "creator" and "public-facing role"
      // overlap, and removing it is a schema-ACL change (F-A16-01 scope, deferred).
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: public-facing role\(s\) hold CREATE on schema public: %'/i
      );
      expect(sql).toMatch(/has_schema_privilege\(r\.oid,\s*'public',\s*'CREATE'\)/i);
    });

    it("skips the pg_database_owner pseudo-role explicitly", () => {
      // It always holds CREATE on `public` in PG 15+ but creates nothing itself, so
      // treating it as an uncoverable creator would fail the migration everywhere.
      expect(sql).toMatch(/CONTINUE WHEN inv\.candidate = 'pg_database_owner'/i);
    });

    it("uses pg_has_role(..., 'MEMBER') as the precondition for acting FOR ROLE", () => {
      // This is the exact precondition Postgres enforces for ALTER DEFAULT
      // PRIVILEGES FOR ROLE, so the check cannot disagree with the server.
      expect(sql).toMatch(/pg_catalog\.pg_has_role\(current_user,\s*inv\.candidate,\s*'MEMBER'\)/i);
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
      // that the REVOKEs worked. The implicit PUBLIC EXECUTE is NOT asserted here: the
      // corrected migration does not remove it (that needs a global statement) and
      // records the residual instead; the guard migration closes it forward.
      expect(sql).toMatch(/aclexplode\(d\.defaclacl\)/i);
      expect(sql).toMatch(
        /RAISE EXCEPTION 'F-A16-02: default privileges in public are still broader than intended/i
      );
    });

    it("post-condition checks the same default-ACL sources as the discovery", () => {
      // The post-condition must read the default-ACL catalog (per-schema and global) so a
      // covered-but-unverified role cannot slip through.
      const post = postConditionBlock();
      expect(post).toMatch(/FROM\s+pg_catalog\.pg_default_acl/i);
      expect(post).toMatch(/d\.defaclnamespace\s*=\s*'public'::regnamespace/i);
      expect(post).toMatch(/d\.defaclnamespace\s*=\s*0/i);
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

    it("0b also fails closed on a global TRUNCATE/TRIGGER/REFERENCES default for service_role", () => {
      // Section 1 revokes these three from service_role with an IN SCHEMA statement, but a
      // GLOBAL grant survives that revoke and still lands on future public tables. The
      // precondition must refuse on it — and must NOT refuse on ordinary service_role DML.
      const check = sql.slice(sql.indexOf("global_leaks"), sql.indexOf("global default privileges confer future objects"));
      expect(check).toMatch(/d\.defaclobjtype = 'r'/);
      expect(check).toMatch(/pg_get_userbyid\(a\.grantee\) = 'service_role'/);
      expect(check).toMatch(/a\.privilege_type IN \('TRUNCATE', 'TRIGGER', 'REFERENCES'\)/);
    });

    it("0b excludes the owner's own entry", () => {
      // The owner self-entry is inherent and non-revocable, so it must not be read as a leak.
      const check = sql.slice(sql.indexOf("global_leaks"), sql.indexOf("global default privileges confer future objects"));
      expect(check).toMatch(/a\.grantee <> d\.defaclrole/);
    });

    it("excludes the global PUBLIC function default from the 0b precondition", () => {
      // The corrected migration does NOT remove the global PUBLIC function default (that
      // would need a global statement, which it deliberately does not issue). The residual
      // is closed forward by the guard migration, so 0b must not reject it. Only a DIRECT
      // global function grant to a named public-facing role is refused.
      const anchor = sql.indexOf("global default privileges confer future objects");
      expect(anchor).toBeGreaterThan(-1);
      // The function arm of the 0b check must not include `a.grantee = 0`.
      const check = sql.slice(sql.indexOf("global_leaks"), anchor);
      const funcArm = check.slice(check.indexOf("d.defaclobjtype = 'f'"));
      expect(funcArm).not.toMatch(/a\.grantee = 0/);
    });

    it("closes the implicit PUBLIC EXECUTE residual forward, not with a global statement", () => {
      // The corrected design: the migration issues no global statement; the residual is
      // handled by the guard migration, and section 3b records it as a NOTICE rather than
      // pretending it is gone.
      expect(sql).toMatch(/f_a16_public_fn_guard/);
      expect(sql).toMatch(/RAISE NOTICE 'F-A16-02: default privileges tightened in public/);
      // No global function revoke anywhere.
      expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES\s+REVOKE\s+EXECUTE/i);
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

    it("post-condition also rejects a global TRUNCATE/TRIGGER/REFERENCES default for service_role", () => {
      const post = postConditionBlock();
      expect(post).toMatch(/d\.defaclobjtype = 'r'/);
      expect(post).toMatch(/pg_get_userbyid\(a\.grantee\) = 'service_role'/);
      expect(post).toMatch(/a\.privilege_type IN \('TRUNCATE', 'TRIGGER', 'REFERENCES'\)/);
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

    it("owner-run remediates the global service_role TRUNCATE/TRIGGER/REFERENCES defaults", () => {
      // The global form must be present, documented as affecting every schema, and paired
      // with a verification query (4b) that excludes the owner self-entry.
      expect(ownerRun).toMatch(
        /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role/
      );
      expect(ownerRun).toMatch(/EVERY schema/i);
      expect(ownerRun).toMatch(/4b\./);
      expect(ownerRun).toMatch(/a\.grantee <> d\.defaclrole/);
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
