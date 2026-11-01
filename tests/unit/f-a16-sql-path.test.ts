/**
 * @jest-environment node
 *
 * Regression guard for the F-A16 audit SQL path.
 *
 * The workflow passes the audit SQL file to the runner as a positional argument.
 * A previous revision referenced `F_A16_READ_ONLY_CATALOG_AUDIT.sql` (underscore)
 * while the tracked file is `F-A16_READ_ONLY_CATALOG_AUDIT.sql` (hyphen), so the
 * runner would have failed to open its input. This test extracts the path from the
 * workflow itself, so any future rename or typo fails here instead of in a
 * production run.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const WORKFLOW = path.join(ROOT, ".github/workflows/f-a16-production-catalog-audit.yml");
const RUNNER = path.join(ROOT, "scripts/lib/run-catalog-audit.mjs");
const EXPECTED_SQL = "docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql";

const workflow = readFileSync(WORKFLOW, "utf8");
const runner = readFileSync(RUNNER, "utf8");

/** The `.sql` path the workflow hands to the runner, read from the workflow itself. */
function sqlPathFromWorkflow(): string | null {
  const idx = workflow.indexOf("run-catalog-audit.mjs");
  expect(idx).toBeGreaterThan(-1);
  const block = workflow.slice(idx, idx + 400);
  const match = block.match(/^\s*([^\s\\]+\.sql)\s*\\?$/m);
  return match ? match[1] : null;
}

describe("F-A16 audit SQL path", () => {
  it("the workflow passes the tracked SQL file, by its exact name", () => {
    expect(sqlPathFromWorkflow()).toBe(EXPECTED_SQL);
  });

  it("the workflow-provided path exists on disk", () => {
    const p = sqlPathFromWorkflow();
    expect(p).not.toBeNull();
    expect(existsSync(path.join(ROOT, p as string))).toBe(true);
  });

  it("the workflow-provided path is the tracked file in git", () => {
    const p = sqlPathFromWorkflow() as string;
    const r = spawnSync("git", ["ls-files", "--error-unmatch", p], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(p);
  });

  it("no underscore variant of the filename is referenced anywhere in the workflow", () => {
    expect(workflow).not.toContain("F_A16_READ_ONLY_CATALOG_AUDIT");
  });

  it("the runner documents the same hyphenated path", () => {
    expect(runner).toContain(EXPECTED_SQL);
    expect(runner).not.toContain("F_A16_READ_ONLY_CATALOG_AUDIT");
  });

  it("the SQL file still parses as 37 read-only statements", () => {
    const p = sqlPathFromWorkflow() as string;
    const raw = readFileSync(path.join(ROOT, p), "utf8")
      .split("\n")
      .map((l) => l.replace(/--.*$/, ""))
      .join("\n");
    const statements = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(37);
    expect(statements.every((s) => /^(SELECT|SHOW|WITH)\b/i.test(s))).toBe(true);
  });
});
