import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { USERS_EMAIL_CANONICAL_SQL_EXPRESSION } from "@/lib/auth/email-normalization";

const ROOT = resolve(__dirname, "..", "..");
const SCRIPT = resolve(ROOT, "scripts/lib/check-baseline-drift-scope.mjs");
const WORKFLOW = resolve(ROOT, ".github/workflows/prisma-baseline-drift-gate.yml");
const SCHEMA = resolve(ROOT, "prisma/schema.prisma");

const tmp = mkdtempSync(join(tmpdir(), "scoped-drift-"));

/** Run the checker against a supplied diff body (no database, no prisma). */
function runWithDiff(body: string) {
  const f = join(tmp, `diff-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(f, body);
  const r = spawnSync("node", [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SCOPED_DIFF_TEXT_FILE: f, PRISMA_DATABASE_URL: "" },
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const OUT_OF_SCOPE =
  "[+] Added tables\n  - events\n  - sevas\n  - volunteer_requests\n";

function report(inScope: string) {
  return (
    OUT_OF_SCOPE +
    "\n" +
    inScope
  );
}

describe("check-baseline-drift-scope", () => {
  it("passes when only out-of-scope tables differ, and lists them as deferred", () => {
    const r = runWithDiff(report(""));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/OUT OF SCOPE/);
    expect(r.out).toMatch(/events/);
    expect(r.out).toMatch(/SCOPED RESULT: PASS/);
  });

  it("fails when an in-scope table is removed (the missing-table case)", () => {
    const r = runWithDiff(report("[-] Removed tables\n  - ai_knowledge\n"));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/removed tables \(1\): ai_knowledge/);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("fails when an in-scope table is added", () => {
    const r = runWithDiff(report("[+] Added tables\n  - ai_knowledge\n"));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("fails when an in-scope table is changed", () => {
    const r = runWithDiff(report("[*] Changed the `ai_settings` table\n  [+] Added column `x`\n"));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/changed tables \(1\): ai_settings/);
  });

  const approvedIndex = (expression = USERS_EMAIL_CANONICAL_SQL_EXPRESSION) =>
    `  [*] Added index \`users_email_lower_btrim_key\` on columns \`${expression}\`\n`;

  const usersChange = (...lines: string[]) =>
    report("[*] Changed the `users` table\n" + lines.join(""));

  it("allows the known users email index with the exact approved expression", () => {
    const r = runWithDiff(usersChange(approvedIndex()));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/allowed known index change \(1\): users/);
    expect(r.out).toMatch(/SCOPED RESULT: PASS/);
  });

  it("rejects the same index name with lower(email)", () => {
    const r = runWithDiff(usersChange(approvedIndex("lower(email)")));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("rejects the same index name with the old lower(btrim(email)) expression", () => {
    const r = runWithDiff(usersChange(approvedIndex("lower(btrim(email))")));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("rejects the same index name with a different translate expression", () => {
    const r = runWithDiff(
      usersChange(
        approvedIndex(
          "translate(btrim(email), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')",
        ),
      ),
    );
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("rejects the same index name with no expression", () => {
    const r = runWithDiff(usersChange("  [*] Added index `users_email_lower_btrim_key`\n"));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("fails when users has the approved index plus any other change", () => {
    const r = runWithDiff(usersChange(approvedIndex(), "  [+] Added column `unexpected`\n"));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("fails when users has the approved index plus a second index", () => {
    const r = runWithDiff(
      usersChange(approvedIndex(), "  [*] Added index `another_index` on columns `lower(email)`\n"),
    );
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("fails on an unrelated constraint change on users", () => {
    const r = runWithDiff(
      usersChange(approvedIndex(), "  [*] Added constraint `users_email_check`\n"),
    );
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("does not allow a different index on users", () => {
    const r = runWithDiff(
      report("[*] Changed the `users` table\n  [*] Added index `some_other_index`\n"),
    );
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/SCOPED RESULT: FAIL/);
  });

  it("fails on a probable typo/mismap of an in-scope table (anti-evasion)", () => {
    const r = runWithDiff(report("[+] Added tables\n  - ai_knowledge_extra\n"));
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/ai_knowledge_extra/);
  });

  it("passes on a fully clean database", () => {
    const r = runWithDiff("No difference detected.\n");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/fully reconciled/);
  });

  it("keeps the derived scope equal to the baseline migration's tables", () => {
    // The checker derives scope from the schema's @@map(); the baseline migration is
    // the authority. If these diverge, the checker exits 2 with an IN-SCOPE MISMATCH.
    const schema = readFileSync(SCHEMA, "utf8");
    const scope = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]).sort();
    const baseline = readFileSync(
      resolve(ROOT, "prisma/migrations/20261015000000_baseline_raya_ai/migration.sql"),
      "utf8",
    );
    const created = [...baseline.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort();
    expect(scope).toEqual(created);
    expect(scope).toContain("ai_knowledge");
  });

  it("wires the scoped mode into the workflow as the default", () => {
    const wf = readFileSync(WORKFLOW, "utf8");
    expect(wf).toMatch(/prisma:drift:scoped/);
    expect(wf).toMatch(/default: scoped/);
    expect(wf).toMatch(/mode == 'scoped'/);
  });
});
