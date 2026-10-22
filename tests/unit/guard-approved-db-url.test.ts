/**
 * @jest-environment node
 *
 * Guard rails for the approved-database-URL guard and the two Seva workflows
 * that run raw `psql`. Everything here reads files or spawns the guard with a
 * controlled environment: no database, no network, no credentials.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const guard = resolve(root, "scripts/lib/guard-approved-db-url.mjs");

const APPROVED = "kvrkraqjuyxbraccxntk";
const OTHER = "zzzzzzzzzzzzzzzzzzzz";
/** A sentinel that must never appear in the guard's output. */
const PW_SENTINEL = "sup3rs3cret-pw-must-not-leak";

const APPROVED_POOLER = `postgresql://postgres.${APPROVED}:${PW_SENTINEL}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
const APPROVED_DIRECT = `postgresql://postgres:${PW_SENTINEL}@db.${APPROVED}.supabase.co:5432/postgres`;

/** Run the guard with a clean environment plus the given URL value. */
function runGuard(value: string | undefined, varName = "SEVA_BACKUP_DB_URL") {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  delete env.SEVA_BACKUP_DB_URL;
  delete env.GUARD_DB_URL_VAR;
  if (value !== undefined) env[varName] = value;
  return spawnSync("node", [guard], { cwd: root, env, encoding: "utf8" });
}

describe("approved database URL guard", () => {
  it("passes for the approved project in a Supavisor pooler URL", () => {
    const r = runGuard(APPROVED_POOLER);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/guard passed/);
  });

  it("passes for the approved project in a direct db.<ref>.supabase.co URL", () => {
    const r = runGuard(APPROVED_DIRECT);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/guard passed/);
  });

  it("refuses when the URL is unset", () => {
    const r = runGuard(undefined);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/is not set/);
  });

  it("refuses when the URL is empty or whitespace", () => {
    for (const value of ["", "   "]) {
      const r = runGuard(value);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/is not set/);
    }
  });

  it("refuses a malformed URL", () => {
    const r = runGuard("not a url");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/well-formed/);
  });

  it("refuses a well-formed URL with no recognisable project ref", () => {
    const r = runGuard(`postgresql://postgres:${PW_SENTINEL}@localhost:5432/db`);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not resolve to a Supabase project ref/);
  });

  it("refuses a well-formed but unapproved project, and leaks no value", () => {
    const wrong = `postgresql://postgres.${OTHER}:${PW_SENTINEL}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
    const r = runGuard(wrong);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not the approved production project/);
    expect(r.stderr).not.toContain(OTHER);
    expect(r.stderr).not.toContain(PW_SENTINEL);
  });

  it("refuses a hostname-suffix spoof", () => {
    const spoof = `postgresql://postgres:${PW_SENTINEL}@db.${APPROVED}.supabase.co.evil.com:5432/postgres`;
    const r = runGuard(spoof);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not resolve to a Supabase project ref/);
    expect(r.stderr).not.toContain(PW_SENTINEL);
  });

  it("refuses an ambiguous URL whose username and host disagree", () => {
    const ambiguous = `postgresql://postgres.${APPROVED}:${PW_SENTINEL}@db.${OTHER}.supabase.co:5432/postgres`;
    const r = runGuard(ambiguous);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/names two different projects/);
    expect(r.stderr).not.toContain(PW_SENTINEL);
  });

  it("never prints the password or the full connection string", () => {
    for (const value of [APPROVED_POOLER, APPROVED_DIRECT, `postgresql://postgres.${OTHER}:${PW_SENTINEL}@x:5432/db`]) {
      const r = runGuard(value);
      const combined = `${r.stdout}${r.stderr}`;
      expect(combined).not.toContain(PW_SENTINEL);
      expect(combined).not.toContain(value);
      expect(combined).not.toMatch(/postgresql:\/\//);
    }
  });

  it("reads the URL from the environment, not from argv, and hardcodes no ref", () => {
    const src = readFileSync(guard, "utf8");
    expect(src).toMatch(/process\.env\[VAR\]/);
    expect(src).not.toMatch(/process\.argv/);
    expect(src).not.toContain(APPROVED);
  });

  it("honours the configurable variable name so it can guard other secrets", () => {
    const env: Record<string, string> = { ...(process.env as Record<string, string>) };
    delete env.SEVA_BACKUP_DB_URL;
    env.GUARD_DB_URL_VAR = "OTHER_DB_URL";
    env.OTHER_DB_URL = APPROVED_DIRECT;
    const r = spawnSync("node", [guard], { cwd: root, env, encoding: "utf8" });
    expect(r.status).toBe(0);
  });
});

/**
 * Extract every `run:` shell body from a workflow, and the step boundaries, using
 * the same regex-based approach as the existing migration-safety suite (no YAML
 * library is a declared dependency).
 */
interface Step {
  name: string;
  runBody: string;
  index: number;
}

function parseSteps(yaml: string): Step[] {
  const lines = yaml.split("\n");
  const steps: Step[] = [];
  let current: Step | null = null;
  for (let i = 0; i < lines.length; i++) {
    const nameMatch = /^\s*-\s*name:\s*(.+?)\s*$/.exec(lines[i]);
    if (nameMatch) {
      if (current) steps.push(current);
      current = { name: nameMatch[1], runBody: "", index: steps.length };
      continue;
    }
    const runMatch = /^(\s*)run:\s*(\||>)?\s*(.*)$/.exec(lines[i]);
    if (!runMatch || !current) continue;
    const indent = runMatch[1].length;
    const inline = runMatch[3];
    if (inline) {
      current.runBody += inline + "\n";
      continue;
    }
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break;
      current.runBody += line.trim() + "\n";
    }
  }
  if (current) steps.push(current);
  return steps;
}

const DB_URL_VAR = "SEVA_BACKUP_DB_URL";

/**
 * Statements in a shell body that actually run `psql` against the database.
 *
 * Detected by the presence of both the `psql` token and the connection-string
 * variable on the same statement, which covers `psql "$VAR" …` and the command
 * substitution form `removed="$(psql "$VAR" …)"`. It deliberately excludes the
 * `command -v psql` install check, which never opens a connection.
 */
function psqlDbStatements(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((s) => /\bpsql\b/.test(s) && s.includes(DB_URL_VAR));
}

describe.each(["seva-backup.yml", "seva-maintenance.yml"])(
  "%s runs the database URL guard before every psql command",
  (file) => {
    const yaml = readFileSync(resolve(root, ".github/workflows", file), "utf8");
    const steps = parseSteps(yaml);

    it("declares the guard and at least one psql command (non-vacuity)", () => {
      const guardSteps = steps.filter((s) => s.runBody.includes("scripts/lib/guard-approved-db-url.mjs"));
      const psqlSteps = steps.filter((s) => psqlDbStatements(s.runBody).length > 0);
      expect(guardSteps.length).toBe(1);
      expect(psqlSteps.length).toBeGreaterThan(0);
    });

    it("orders the guard before every psql invocation", () => {
      const guardStep = steps.findIndex(
        (s) =>
          s.runBody.includes("scripts/lib/guard-approved-db-url.mjs") &&
          /\bnode\b/.test(s.runBody),
      );
      expect(guardStep).toBeGreaterThanOrEqual(0);

      const violations: string[] = [];
      steps.forEach((s, i) => {
        if (psqlDbStatements(s.runBody).length === 0) return;
        if (i <= guardStep)
          violations.push(`step "${s.name}" (index ${i}) runs psql at or before the guard (index ${guardStep})`);
      });
      expect(violations).toEqual([]);
    });

    it("passes the URL through env, never interpolated into the shell", () => {
      const block = /- name: Guard approved database URL\n([\s\S]*?)\n\n/.exec(yaml)?.[0] ?? "";
      expect(block).toMatch(/SEVA_BACKUP_DB_URL:\s*\$\{\{\s*secrets\.SEVA_BACKUP_DB_URL\s*\}\}/);
      expect(block).not.toMatch(/\$\{\{\s*inputs\./);
      expect(block).not.toMatch(/SEVA_BACKUP_DB_URL.*\$\{\{\s*secrets[^}]*\}\}[^"']*psql/);
    });
  },
);
