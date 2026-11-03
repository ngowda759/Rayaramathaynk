/**
 * @jest-environment node
 *
 * Regression guard for the F-A16 read-only catalog audit EXTENSION
 * (docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql).
 *
 * The extension exists because the baseline query set cannot answer the
 * questions the F-A16 migration's preconditions ask: it never calls
 * has_schema_privilege() / has_table_privilege() / has_function_privilege() /
 * has_sequence_privilege(), never reads pg_auth_members, and never expands an
 * ACL with aclexplode() — so a grant to PUBLIC (grantee = 0) is invisible to it.
 *
 * These tests prove the extension actually closes that gap, that it stays
 * read-only under the runner's classifier, and that the baseline file is left
 * exactly as it was (37 statements). They are static: no database is contacted.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const BASELINE = "docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql";
const EXT = "docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql";
const RUNNER = path.join(ROOT, "scripts/lib/run-catalog-audit.mjs");
const WORKFLOW = path.join(ROOT, ".github/workflows/f-a16-production-catalog-audit.yml");

/** Strip `--` line comments exactly as the runner does, then split on `;`. */
function statementsOf(relPath: string): string[] {
  return readFileSync(path.join(ROOT, relPath), "utf8")
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const extStatements = statementsOf(EXT);
const baselineStatements = statementsOf(BASELINE);
/** Statement text only — assertions about SQL must not match header comments. */
const extSql = extStatements.join("\n");
const runnerSrc = readFileSync(RUNNER, "utf8");
const workflowSrc = readFileSync(WORKFLOW, "utf8");

describe("F-A16 audit extension — the baseline is untouched", () => {
  it("the baseline still parses as exactly 37 read-only statements", () => {
    expect(baselineStatements).toHaveLength(37);
    expect(baselineStatements.every((s) => /^(SELECT|SHOW|WITH)\b/i.test(s))).toBe(true);
  });

  it("the baseline file name is still the hyphenated one the workflow passes", () => {
    expect(workflowSrc).toContain(BASELINE);
    expect(workflowSrc).not.toContain("F_A16_READ_ONLY_CATALOG_AUDIT");
    expect(runnerSrc).toContain(BASELINE);
  });

  it("the extension is a separate file, not a rewrite of the baseline", () => {
    expect(EXT).not.toBe(BASELINE);
    // The extension must not restate the baseline's grant-matrix statement.
    expect(extSql).not.toContain("information_schema.role_table_grants");
  });
});

describe("F-A16 audit extension — read-only under the runner's own classifier", () => {
  it("every statement starts with SELECT/SHOW/WITH", () => {
    expect(extStatements.length).toBeGreaterThan(0);
    expect(extStatements.every((s) => /^(SELECT|SHOW|WITH)\b/i.test(s))).toBe(true);
  });

  it("the runner's classify() accepts every statement", () => {
    // The runner is an ES module; Jest's ts-jest transform cannot import it, so
    // it is exercised the way the existing F-A16 hardening tests do: in a node
    // subprocess, using the runner's own exported classify().
    const script = `
      import { readFileSync } from "node:fs";
      import { classify } from ${JSON.stringify(RUNNER)};
      const raw = readFileSync(${JSON.stringify(path.join(ROOT, EXT))}, "utf8")
        .split("\\n").map((l) => l.replace(/--.*$/, "")).join("\\n");
      const stmts = raw.split(";").map((s) => s.trim()).filter(Boolean);
      const bad = stmts.map((s, i) => ({ i: i + 1, v: classify(s) })).filter((x) => !x.v.ok);
      console.log("__RESULT__" + JSON.stringify(bad));
    `;
    const r = spawnSync("node", ["--input-type=module", "-e", script], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const line = r.stdout.split("\n").find((l) => l.startsWith("__RESULT__"));
    expect(line).toBeDefined();
    expect(JSON.parse((line as string).slice("__RESULT__".length))).toEqual([]);
  });

  it("contains no mutating keyword anywhere outside a comment", () => {
    const forbidden = [
      "INSERT", "UPDATE", "DELETE", "UPSERT", "TRUNCATE", "CREATE", "ALTER",
      "DROP", "GRANT", "REVOKE", "COMMENT", "CALL", "DO", "COPY", "VACUUM",
      "ANALYZE", "REINDEX", "CLUSTER", "MERGE", "LOCK", "SET", "RESET",
      "EXECUTE", "PERFORM",
    ];
    // `TRUNCATE` appears as a privilege NAME in quotes; the runner strips string
    // literals before checking, so replicate that here.
    for (const s of extStatements) {
      const noStrings = s.replace(/'(?:[^']|'')*'/g, "''");
      for (const kw of forbidden) {
        const re = new RegExp(`(?<![A-Za-z0-9_])${kw}(?![A-Za-z0-9_])`, "i");
        expect(re.test(noStrings)).toBe(false);
      }
    }
  });
});

describe("F-A16 audit extension — coverage the task requires", () => {
  const required: Array<[string, RegExp]> = [
    ["pg_default_acl", /\bpg_default_acl\b/],
    ["pg_roles", /\bpg_roles\b/],
    ["pg_auth_members", /\bpg_auth_members\b/],
    ["has_schema_privilege()", /\bhas_schema_privilege\s*\(/],
    ["aclexplode()", /\baclexplode\s*\(/],
  ];
  it.each(required)("covers %s", (_label, re) => {
    expect(re.test(extSql)).toBe(true);
  });

  it("covers effective table privileges, including the three high-risk types", () => {
    expect(/\bhas_table_privilege\s*\(/.test(extSql)).toBe(true);
    expect(extSql).toMatch(/'TRUNCATE'/);
    expect(extSql).toMatch(/'REFERENCES'/);
    expect(extSql).toMatch(/'TRIGGER'/);
  });

  it("covers effective function EXECUTE and sequence privileges", () => {
    expect(/\bhas_function_privilege\s*\(/.test(extSql)).toBe(true);
    expect(/\bhas_sequence_privilege\s*\(/.test(extSql)).toBe(true);
  });

  it("covers global AND schema-scoped defaults", () => {
    // defaclnamespace = 0 is the global (all-schemas) scope.
    expect(extSql).toMatch(/defaclnamespace\s*=\s*0/);
    expect(extSql).toMatch(/defaclnamespace\s*=\s*'public'::regnamespace/);
  });

  it("covers table, sequence AND function default object types", () => {
    expect(extSql).toMatch(/WHEN 'r' THEN 'TABLES'/);
    expect(extSql).toMatch(/WHEN 'S' THEN 'SEQUENCES'/);
    expect(extSql).toMatch(/WHEN 'f' THEN 'FUNCTIONS'/);
  });

  it("resolves PUBLIC as grantee = 0, not via pg_get_userbyid", () => {
    // pg_get_userbyid(0) returns 'unknown (OID=0)', never NULL and never
    // 'PUBLIC', so a filter built only on a role-name IN-list silently misses
    // PUBLIC. Every place the extension names public-facing roles must OR in an
    // explicit `grantee = 0`, and PUBLIC must be labelled from that test.
    expect(extSql).toMatch(/grantee\s*=\s*0\s+THEN\s*'PUBLIC'/);
    const nameFilters = extSql.match(
      /pg_get_userbyid\s*\(\s*a\.grantee\s*\)\s+IN\s*\(\s*'anon'[^)]*\)/g
    );
    expect(nameFilters).not.toBeNull();
    for (const f of nameFilters as string[]) {
      // Each must sit in an OR with the OID test, never stand alone.
      const around = extSql.slice(extSql.indexOf(f) - 60, extSql.indexOf(f) + f.length);
      expect(around).toMatch(/a\.grantee\s*=\s*0/);
    }
  });

  it("covers the effective privilege of candidate object creators", () => {
    // The migration's section 0c question, answered directly.
    expect(extSql).toMatch(/can_create_in_public/);
    expect(extSql).toMatch(/pg_has_role\s*\(\s*current_user/);
  });

  it("avoids version-fragile pg_auth_members columns", () => {
    // PG16 added inherit_option / set_option; selecting them breaks older servers.
    expect(extSql).not.toMatch(/\binherit_option\b/);
    expect(extSql).not.toMatch(/\bset_option\b/);
  });

  it("does not read application row contents", () => {
    // Catalog objects only. `storage.objects` is the classic leak.
    expect(extSql).not.toMatch(/storage\.objects/);
    expect(extSql).not.toMatch(/FROM\s+public\./i);
  });
});

describe("F-A16 audit extension — runner and workflow wiring", () => {
  it("the runner accepts multiple SQL inputs and treats the last arg as the output", () => {
    // The extension is only usable if the runner reads more than one input file.
    expect(runnerSrc).toMatch(/SQL_FILES/);
    expect(runnerSrc).toMatch(/ARGS\.slice\(0,\s*-1\)/);
  });

  it("the workflow can include the extension", () => {
    expect(workflowSrc).toMatch(/include_extension/);
    expect(workflowSrc).toMatch(/INCLUDE_EXTENSION/);
  });

  it("the workflow passes the baseline first, so existing runs are unchanged", () => {
    const idxBase = workflowSrc.indexOf(BASELINE);
    const idxExt = workflowSrc.indexOf(EXT);
    expect(idxBase).toBeGreaterThan(-1);
    expect(idxExt).toBeGreaterThan(-1);
    expect(idxBase).toBeLessThan(idxExt);
  });

  it("the extension is never named with an underscore variant", () => {
    expect(workflowSrc).not.toContain("F_A16_READ_ONLY_CATALOG_AUDIT_EXT");
    expect(runnerSrc).not.toContain("F_A16_READ_ONLY_CATALOG_AUDIT_EXT");
  });
});
