/**
 * @jest-environment node
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Task A2-8: the nightly encrypted backup and the monthly maintenance job (DB 16.1, D9, C-57, C-64).
// The workflows and scripts are read as text; nothing here talks to a database or to GitHub.

const ROOT = path.resolve(__dirname, "..", "..", "..");
const BACKUP_WORKFLOW = ".github/workflows/seva-backup.yml";
const MAINTENANCE_WORKFLOW = ".github/workflows/seva-maintenance.yml";
const BACKUP_SCRIPT = "scripts/seva/backup.sh";
const VERIFY_SCRIPT = "scripts/seva/verify-backup.sh";
const ALL_FILES = [BACKUP_WORKFLOW, MAINTENANCE_WORKFLOW, BACKUP_SCRIPT, VERIFY_SCRIPT];

/** Reads a repository file with LF line endings (git stores LF; a Windows checkout may show CRLF). */
function read(rel: string): string {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) throw new Error(`missing ${rel}`);
  return readFileSync(full, "utf8").replace(/\r\n/g, "\n");
}

/** The `- ` items under the job's `steps:` key, each as one text block, in order (each workflow has one job). */
function steps(workflow: string): string[] {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => /^\s+steps:\s*$/.test(line));
  if (start < 0) return [];
  const blocks: string[] = [];
  let indent = -1;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    const lead = line.search(/\S/);
    if (indent < 0) indent = lead;
    if (lead < indent) break;
    if (lead === indent && line.slice(lead).startsWith("- ")) blocks.push(line);
    else if (blocks.length > 0) blocks[blocks.length - 1] += `\n${line}`;
  }
  return blocks;
}

function secretLines(workflow: string): string[] {
  return workflow.split("\n").filter((line) => /\$\{\{[^}]*secrets\./.test(line));
}

const bashProbe = spawnSync("bash", ["-c", "exit 0"], { encoding: "utf8" });
const hasBash = bashProbe.status === 0;

describe("seva backup and maintenance workflows", () => {
  it("runs the backup at 02:30 IST and on demand", () => {
    const workflow = read(BACKUP_WORKFLOW);
    expect(workflow).toContain("cron: '0 21 * * *'");
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain('bash scripts/seva/backup.sh "$RUNNER_TEMP/seva-backup"');
  });

  it("runs the monthly purge on the 1st", () => {
    const workflow = read(MAINTENANCE_WORKFLOW);
    expect(workflow).toContain("cron: '30 21 1 * *'");
    expect(workflow).toContain("seva_purge_devotee_profiles()");
    expect(workflow).toContain("ON_ERROR_STOP=1");
    expect(workflow).toContain("workflow_dispatch");
  });

  it("grants read-only repository permissions", () => {
    for (const rel of [BACKUP_WORKFLOW, MAINTENANCE_WORKFLOW]) {
      const workflow = read(rel);
      expect(workflow).toMatch(/^permissions:\n\s+contents: read$/m);
      expect(workflow).not.toContain("contents: write");
      expect(workflow).not.toMatch(/:\s*write\b/);
      expect(workflow).not.toContain("write-all");
    }
  });

  it("never traces or echoes secrets", () => {
    for (const rel of ALL_FILES) {
      const text = read(rel);
      expect(text).not.toContain("set -x");
      expect(text).not.toMatch(/\bset\s+-[A-Za-z]*x/);
      expect(text).not.toMatch(/set\s+-o\s+xtrace/);
      expect(text).not.toMatch(/\bbash\s+-[A-Za-z]*x/);
      const leaks = text
        .split("\n")
        .filter((line) => /\b(echo|printf)\b/.test(line))
        .filter((line) => /\$\{\{\s*secrets\./.test(line) || /\$\{?SEVA_BACKUP/.test(line));
      expect({ file: rel, leaks }).toEqual({ file: rel, leaks: [] });
    }

    // Secrets reach the steps only through env: mappings, and only the ones the owner sets.
    const expected: [string, string[]][] = [
      [BACKUP_WORKFLOW, ["SEVA_BACKUP_AGE_RECIPIENT", "SEVA_BACKUP_DB_URL"]],
      [MAINTENANCE_WORKFLOW, ["SEVA_BACKUP_DB_URL"]],
    ];
    for (const [rel, names] of expected) {
      const lines = secretLines(read(rel));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line).toMatch(/^\s+([A-Z][A-Z0-9_]*): \$\{\{ secrets\.\1 \}\}$/);
      const used = new Set(lines.map((line) => /secrets\.([A-Z0-9_]+)/.exec(line)?.[1] ?? ""));
      expect([...used].sort()).toEqual(names);
    }
  });

  it("encrypts a custom-format dump with age", () => {
    const script = read(BACKUP_SCRIPT);
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("--format=custom");
    expect(script).toContain("--no-owner");
    expect(script).toContain("--no-privileges");
    expect(script).toContain("age -r");
    // The plain dump only ever flows through the pipe into age; it is never written to a file.
    expect(script).toMatch(/pg_dump --format=custom[^|]*\|\s*age -r/);
    expect(script).not.toMatch(/--file\b/);
    expect(script).toContain("sha256sum");

    // pg_dump must be the server's major version: read it with the default client, then install that client.
    const workflow = read(BACKUP_WORKFLOW);
    expect(workflow).toContain("show server_version_num");
    expect(workflow).toContain("postgresql-client-${major}");
    expect(workflow).toMatch(/apt-get install[^\n]*\bage\b/);

    // The owner's restore drill decrypts with the offline key and reads the archive's contents.
    const verify = read(VERIFY_SCRIPT);
    expect(verify).toContain("set -euo pipefail");
    expect(verify).toContain("age -d -i");
    expect(verify).toContain("pg_restore --list");
  });

  it("records failed runs too", () => {
    const blocks = steps(read(BACKUP_WORKFLOW));
    const recordIndex = blocks.findIndex(
      (block) => /^\s+if: always\(\)\s*$/m.test(block) && block.includes("ops_backup_runs"),
    );
    expect(recordIndex).toBeGreaterThanOrEqual(0);
    const record = blocks[recordIndex];
    expect(record).toContain("insert into public.ops_backup_runs (started_at, finished_at, ok, bytes, sha256, error)");
    expect(record).toContain("steps.backup.outcome");
    expect(record).toContain("steps.upload_daily.outcome");
    expect(record).toContain("steps.upload_monthly.outcome");

    // It comes after the backup and both uploads, so their outcomes decide `ok`.
    const backupIndex = blocks.findIndex((block) => /^\s+id: backup$/m.test(block));
    const uploadIndexes = blocks
      .map((block, index) => (block.includes("actions/upload-artifact@") ? index : -1))
      .filter((index) => index >= 0);
    expect(backupIndex).toBeGreaterThanOrEqual(0);
    expect(uploadIndexes).toHaveLength(2);
    for (const index of [backupIndex, ...uploadIndexes]) expect(recordIndex).toBeGreaterThan(index);
  });

  it("keeps daily copies 30 days and monthly copies 90 days", () => {
    const uploads = steps(read(BACKUP_WORKFLOW)).filter((block) => block.includes("actions/upload-artifact@"));
    expect(uploads).toHaveLength(2);
    const daily = uploads.find((block) => block.includes("retention-days: 30")) ?? "";
    const monthly = uploads.find((block) => block.includes("retention-days: 90")) ?? "";

    expect(daily).toContain("name: seva-${{ steps.backup.outputs.date }}");
    expect(daily).not.toMatch(/^\s+if:/m);
    expect(monthly).toContain("name: seva-monthly-${{ steps.backup.outputs.month }}");
    expect(monthly).toMatch(/^\s+if: steps\.backup\.outputs\.first_of_month == 'true'$/m);
    for (const block of [daily, monthly]) {
      expect(block).toContain("${{ steps.backup.outputs.file }}");
      expect(block).toContain("${{ steps.backup.outputs.sha256_file }}");
      expect(block).toContain("if-no-files-found: error");
    }

    // File dates, the month and "the 1st" are IST: 02:30 IST is still the previous day in UTC.
    const script = read(BACKUP_SCRIPT);
    expect(script).toContain("TZ=Asia/Kolkata");
    expect(script).toContain(".dump.age");
    expect(script).toContain(".sha256");
  });

  (hasBash ? it : it.skip)(
    hasBash ? "scripts parse as bash" : "scripts parse as bash (skipped: bash is not on PATH)",
    () => {
      for (const rel of [BACKUP_SCRIPT, VERIFY_SCRIPT]) {
        const text = read(rel);
        expect(text.startsWith("#!/usr/bin/env bash\n")).toBe(true);
        const result = spawnSync("bash", ["-n"], { input: text, encoding: "utf8" });
        expect({ file: rel, status: result.status, stderr: result.stderr }).toEqual({
          file: rel,
          status: 0,
          stderr: "",
        });
      }
    },
  );
});
