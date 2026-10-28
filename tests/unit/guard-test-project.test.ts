/**
 * @jest-environment node
 *
 * Regression tests for `scripts/lib/guard-test-project.mjs`, the destination guard
 * for the test-only migration verification workflow
 * (`.github/workflows/supabase-migrations-test.yml`).
 *
 * The guard is executed as a real child process with a controlled environment,
 * exactly as the other guard suites in this repository do. Nothing here touches a
 * database, the network, or a production workflow: every assertion is about the
 * guard's exit code and message. The approved production ref is read from the
 * shared library in a child process, so the test cannot drift from the value the
 * guard compares against (ts-jest cannot import an `.mjs` module directly).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(__dirname, "../..");
const guard = resolve(root, "scripts/lib/guard-test-project.mjs");
const approvedLib = resolve(root, "scripts/lib/approved-project.mjs");

const APPROVED_PROJECT_REF = (() => {
  const r = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as m from ${JSON.stringify(pathToFileURL(approvedLib).href)}; process.stdout.write(m.APPROVED_PROJECT_REF)`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`could not read the approved ref: ${r.stderr}`);
  return r.stdout.trim();
})();

const TEST_REF = "abcdefghijklmnopqrst";
const OTHER_REF = "zzzzzzzzzzzzzzzzzzzz";

/** Run the guard with a clean TEST_-environment plus the given overrides. */
function runGuard(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  for (const k of [
    "TEST_SUPABASE_PROJECT_REF",
    "TEST_SUPABASE_PROJECT_REFS",
    "TEST_SUPABASE_URL",
    "SUPABASE_PROJECT_REF",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]) {
    delete base[k];
  }
  return spawnSync("node", [guard], { cwd: root, env: { ...base, ...env }, encoding: "utf8" });
}

describe("test-project guard refuses the approved production project", () => {
  it("refuses the approved ref even when it is allow-listed", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: APPROVED_PROJECT_REF,
      TEST_SUPABASE_PROJECT_REFS: APPROVED_PROJECT_REF,
      TEST_SUPABASE_URL: `https://${APPROVED_PROJECT_REF}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/approved production project/i);
    // The ref value itself is never printed; only a fingerprint.
    expect(r.stderr).not.toContain(APPROVED_PROJECT_REF);
  });

  it("refuses an allowlist that contains the approved production project", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: TEST_REF,
      TEST_SUPABASE_PROJECT_REFS: `${TEST_REF},${APPROVED_PROJECT_REF}`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/allowlist must contain test project refs only/i);
    expect(r.stderr).not.toContain(APPROVED_PROJECT_REF);
  });

  it("never reads the production SUPABASE_PROJECT_REF variable", () => {
    const src = readFileSync(guard, "utf8");
    expect(src).toMatch(/TEST_SUPABASE_PROJECT_REF/);
    expect(src).not.toMatch(/process\.env\.SUPABASE_PROJECT_REF/);
    expect(src).not.toMatch(/process\.argv/);
    expect(src).not.toMatch(new RegExp(APPROVED_PROJECT_REF));
  });
});

describe("test-project guard fails safely when the test project is not configured", () => {
  it("refuses when the target ref is missing", () => {
    const r = runGuard({ TEST_SUPABASE_PROJECT_REFS: TEST_REF });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/TEST_SUPABASE_PROJECT_REF is not set/);
  });

  it("refuses a malformed target ref", () => {
    const r = runGuard({ TEST_SUPABASE_PROJECT_REF: "too-short", TEST_SUPABASE_PROJECT_REFS: TEST_REF });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not a valid 20-character project ref/);
  });

  it("refuses when the allowlist is missing or empty", () => {
    for (const refs of [undefined, "", "   "]) {
      const r = runGuard({ TEST_SUPABASE_PROJECT_REF: TEST_REF, TEST_SUPABASE_PROJECT_REFS: refs });
      expect(`${refs}:${r.status}`).toBe(`${refs}:1`);
      expect(r.stderr).toMatch(/TEST_SUPABASE_PROJECT_REFS is empty/);
    }
  });

  it("refuses a malformed allowlist entry rather than ignoring it", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: TEST_REF,
      TEST_SUPABASE_PROJECT_REFS: `${TEST_REF},not-a-ref`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/malformed/);
  });

  it("refuses a target ref that is not in the allowlist", () => {
    const r = runGuard({ TEST_SUPABASE_PROJECT_REF: TEST_REF, TEST_SUPABASE_PROJECT_REFS: OTHER_REF });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/is not in the TEST_SUPABASE_PROJECT_REFS allowlist/);
    expect(r.stderr).not.toContain(TEST_REF);
  });
});

describe("test-project guard refuses a mismatched URL instead of inferring the project", () => {
  it("refuses a URL that names a different project", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: TEST_REF,
      TEST_SUPABASE_PROJECT_REFS: TEST_REF,
      TEST_SUPABASE_URL: `https://${OTHER_REF}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not resolve to TEST_SUPABASE_PROJECT_REF/);
  });

  it("refuses a hostname-suffix spoof", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: TEST_REF,
      TEST_SUPABASE_PROJECT_REFS: TEST_REF,
      TEST_SUPABASE_URL: `https://${TEST_REF}.supabase.co.evil.com`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not resolve to TEST_SUPABASE_PROJECT_REF/);
  });

  it("refuses a URL that hides the ref in userinfo", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: TEST_REF,
      TEST_SUPABASE_PROJECT_REFS: TEST_REF,
      TEST_SUPABASE_URL: `https://${TEST_REF}.supabase.co@evil.com`,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/does not resolve to TEST_SUPABASE_PROJECT_REF/);
  });
});

describe("test-project guard accepts only an allow-listed, non-production target", () => {
  it("passes for an allow-listed test ref with a matching URL", () => {
    const r = runGuard({
      TEST_SUPABASE_PROJECT_REF: TEST_REF,
      TEST_SUPABASE_PROJECT_REFS: TEST_REF,
      TEST_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/guard passed/);
  });

  it("passes for an allow-listed test ref when no URL is configured", () => {
    const r = runGuard({ TEST_SUPABASE_PROJECT_REF: TEST_REF, TEST_SUPABASE_PROJECT_REFS: TEST_REF });
    expect(r.status).toBe(0);
  });

  it("accepts a whitespace- or comma-separated allowlist", () => {
    for (const refs of [`${TEST_REF} ${OTHER_REF}`, `${OTHER_REF}, ${TEST_REF}`]) {
      const r = runGuard({ TEST_SUPABASE_PROJECT_REF: TEST_REF, TEST_SUPABASE_PROJECT_REFS: refs });
      expect(`${refs}:${r.status}`).toBe(`${refs}:0`);
    }
  });
});

describe("test-only migration verification workflow safety properties", () => {
  const wfPath = resolve(root, ".github/workflows/supabase-migrations-test.yml");
  const wf = readFileSync(wfPath, "utf8");
  // Assertions about what the workflow *does* must ignore comment prose, which
  // legitimately mentions production and `db push` while describing what it does not do.
  const effective = wf
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");

  it("is dispatch-only and never runs on push or a schedule", () => {
    expect(wf).toMatch(/workflow_dispatch/);
    expect(wf).not.toMatch(/^\s{2}push:/m);
    expect(wf).not.toMatch(/^\s{2}schedule:/m);
  });

  it("never applies migrations: no bare `db push`, no seed, no write command", () => {
    // A bare `supabase db push` (without --dry-run) applies migrations. Assert the
    // only `db push` present is the `--dry-run` form, and that no seed command or
    // SQL write appears at all.
    expect(effective).toMatch(/supabase db push --dry-run/);
    const barePush = effective
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /\bsupabase\s+db\s+push\b/.test(l) && !/--dry-run/.test(l));
    expect(barePush).toEqual([]);
    expect(effective).not.toMatch(/seed-fresh-supabase|seed:supabase|--yes-this-is-a-test-project/);
    expect(effective).not.toMatch(/\bpsql\b/);
    expect(effective).not.toMatch(/db reset|db clean|db seed/);
  });

  it("references no production secret and binds no production environment", () => {
    // Every credential is TEST_-prefixed; the production names must not appear as a
    // secret reference, and there is no `environment: production` binding.
    const secretRefs = [...effective.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
    expect(secretRefs.length).toBeGreaterThan(0);
    for (const name of secretRefs) {
      expect(`${name}:${name.startsWith("TEST_")}`).toBe(`${name}:true`);
    }
    expect(effective).not.toMatch(/environment:\s*production/);
    expect(effective).not.toMatch(/secrets\.SUPABASE_(ACCESS_TOKEN|DB_PASSWORD|SERVICE_ROLE_KEY|PROJECT_REF)\b/);
  });

  it("never interpolates an untrusted expression into a run: block", () => {
    // Same rule the repository-wide injection test enforces: `${{ ... }}` in a
    // `run:` body is substituted as text, so a value like `$(...)` would execute.
    const lines = wf.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /^(\s*)run:\s*(.*)$/.exec(lines[i]);
      if (!m) continue;
      const indent = m[1].length;
      const body: string[] = m[2] && !m[2].startsWith("|") ? [m[2]] : [];
      if (!m[2] || m[2].startsWith("|")) {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === "") continue;
          if (lines[j].length - lines[j].trimStart().length <= indent) break;
          body.push(lines[j]);
        }
      }
      expect(body.join("\n")).not.toMatch(/\$\{\{\s*(inputs|secrets|github\.event)\./);
    }
  });

  it("runs the test-project guard before any Supabase command", () => {
    const guardIdx = effective.indexOf("node scripts/lib/guard-test-project.mjs");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    for (const cmd of ["supabase link", "supabase migration list", "supabase db push --dry-run"]) {
      const idx = effective.indexOf(cmd);
      expect(`${cmd}:${idx > guardIdx}`).toBe(`${cmd}:true`);
    }
  });

  it("requires the confirmation phrase and test-only configuration, with an actionable message", () => {
    expect(wf).toMatch(/verify-test-supabase-migrations/);
    expect(wf).toMatch(/confirmation phrase did not match/);
    expect(wf).toMatch(/dedicated TEST Supabase project/);
    expect(wf).toMatch(/TEST_SUPABASE_PROJECT_REFS/);
    expect(wf).toMatch(/Nothing was linked, listed or pushed/);
  });

  it("hardcodes no credential or project ref", () => {
    expect(wf).not.toMatch(/eyJ[A-Za-z0-9._-]{20,}/);
    expect(wf).not.toMatch(/postgresql:\/\//);
    expect(wf).not.toMatch(new RegExp(APPROVED_PROJECT_REF));
  });

  it("serialises runs and pins third-party actions to full commit SHAs", () => {
    expect(wf).toMatch(/concurrency:/);
    expect(wf).toMatch(/group:\s*supabase-migrations-test/);
    expect(wf).not.toMatch(/cancel-in-progress:\s*true/);
    for (const line of wf.split("\n")) {
      const m = /^\s*uses:\s*(\S+)\s*(?:#.*)?$/.exec(line);
      if (!m || m[1].startsWith("./")) continue;
      const at = m[1].lastIndexOf("@");
      expect(`${m[1]}:${/^[0-9a-f]{40}$/.test(m[1].slice(at + 1))}`).toBe(`${m[1]}:true`);
    }
  });
});
