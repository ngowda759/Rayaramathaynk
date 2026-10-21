/**
 * @jest-environment node
 *
 * Guard rails for the Supabase connectivity diagnostic and the production
 * migration workflow. Everything here reads files or spawns scripts that touch
 * nothing: no database, no GitHub API, no network.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(__dirname, "../..");
const diagnostic = resolve(root, "scripts/diagnose-supabase-connectivity.ts");
const guard = resolve(root, "scripts/lib/guard-approved-project.mjs");
const approvedLib = resolve(root, "scripts/lib/approved-project.mjs");
const workflow = resolve(root, ".github/workflows/supabase-migrations.yml");

const APPROVED = "kvrkraqjuyxbraccxntk";

/** Spawn the diagnostic with a clean Supabase environment plus `env`. */
function runDiagnostic(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  for (const k of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_PROJECT_REF",
  ]) {
    delete base[k];
  }
  return spawnSync("npx", ["--no-install", "tsx", diagnostic], {
    cwd: root,
    env: { ...base, ...env },
    encoding: "utf8",
  });
}

function runGuard(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  delete base.SUPABASE_PROJECT_REF;
  return spawnSync("node", [guard], { cwd: root, env: { ...base, ...env }, encoding: "utf8" });
}

describe("approved-project library", () => {
  /** Evaluate an expression against the library inside a real node process. */
  function evalInLib(expr: string): unknown {
    const url = pathToFileURL(approvedLib).href;
    const r = spawnSync(
      "node",
      ["--input-type=module", "-e", `import * as m from ${JSON.stringify(url)}; process.stdout.write(JSON.stringify(${expr}))`],
      { cwd: root, encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`lib eval failed: ${r.stderr}`);
    return JSON.parse(r.stdout);
  }

  it("names exactly one approved project and derives its URL", () => {
    expect(evalInLib("m.APPROVED_PROJECT_REF")).toBe(APPROVED);
    expect(evalInLib("m.APPROVED_PROJECT_URL")).toBe(`https://${APPROVED}.supabase.co`);
  });

  it("fingerprints without containing the original value", () => {
    const fp = evalInLib("m.fingerprint(m.APPROVED_PROJECT_REF)") as string;
    expect(fp).toMatch(/^[0-9a-f]{12}$/);
    expect(fp).not.toContain(APPROVED);
    expect(evalInLib('m.fingerprint("")')).toBe("(empty)");
  });

  it("derives the ref from a pooler DB URL username and from a direct host", () => {
    expect(
      evalInLib(`m.refFromDbUrl("postgresql://postgres.${APPROVED}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres")`),
    ).toBe(APPROVED);
    expect(evalInLib(`m.refFromDbUrl("postgresql://postgres:pw@db.${APPROVED}.supabase.co:5432/postgres")`)).toBe(APPROVED);
    expect(evalInLib('m.refFromDbUrl("not-a-url")')).toBe("");
  });

  it("derives the ref from a Supabase API URL", () => {
    expect(evalInLib(`m.refFromSupabaseUrl("https://${APPROVED}.supabase.co")`)).toBe(APPROVED);
    expect(evalInLib('m.refFromSupabaseUrl("https://example.com")')).toBe("");
  });

  it("embeds no credential literal", () => {
    const src = readFileSync(approvedLib, "utf8");
    expect(src).not.toMatch(/postgresql:\/\/[^$]*:[^$@]*@/);
    expect(src).not.toMatch(/eyJ[A-Za-z0-9._-]{20,}/);
  });
});

describe("connectivity diagnostic exits non-zero when it cannot verify the project", () => {
  it("fails closed when no project-ref source is configured", () => {
    const r = runDiagnostic({});
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/No project-ref source is configured/);
    expect(r.stdout).toMatch(/1 check\(s\) failed/);
  });

  it("fails on a mismatched project ref and does not probe any layer", () => {
    const r = runDiagnostic({ SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa" });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/does not resolve to the approved project/);
    // Identity failed, so the probe sections must be skipped entirely.
    expect(r.stdout).not.toMatch(/REST \/ PostgREST data path/);
    expect(r.stdout).not.toMatch(/Auth admin API/);
  });

  it("fails when the API URL points at a different project", () => {
    const r = runDiagnostic({
      SUPABASE_PROJECT_REF: APPROVED,
      NEXT_PUBLIC_SUPABASE_URL: "https://bbbbbbbbbbbbbbbbbbbb.supabase.co",
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/NEXT_PUBLIC_SUPABASE_URL \(ref from host\): present but no project ref|does not resolve to the approved project/);
  });

  it("verifies identity, then still fails when required keys are missing", () => {
    const r = runDiagnostic({
      SUPABASE_PROJECT_REF: APPROVED,
      NEXT_PUBLIC_SUPABASE_URL: `https://${APPROVED}.supabase.co`,
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/resolve to the approved project/);
    expect(r.stdout).toMatch(/Need both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    expect(r.stdout).toMatch(/check\(s\) failed/);
  });

  it("never exits 0 unconditionally and never claims success on failure", () => {
    const src = readFileSync(diagnostic, "utf8");
    // No bare `process.exit(0)` anywhere: the old code always reported success.
    expect(src).not.toMatch(/process\.exit\(0\)/);
    // The crash handler must not swallow failures.
    expect(src).toMatch(/process\.exitCode = 1/);
  });

  it("prints no credential and does not log the raw ref as evidence", () => {
    const src = readFileSync(diagnostic, "utf8");
    expect(src).not.toMatch(/console\.(log|error)\([^)]*(serviceKey|dbUrl|projectRef)/);
    // The key is sent in request headers (required) but never printed.
    expect(src).not.toMatch(/console\.(log|error)\([^)]*\$\{serviceKey\}/);
    // The ref is compared and fingerprinted, never echoed as a value.
    expect(src).toMatch(/fingerprint/);
  });

  it("documents why the ref cannot be un-masked in CI logs", () => {
    const src = readFileSync(diagnostic, "utf8");
    expect(src).toMatch(/masks/i);
    expect(src).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("project ref guard refuses anything but the approved project", () => {
  it("refuses when the ref is missing", () => {
    const r = runGuard({});
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/REFUSING: SUPABASE_PROJECT_REF is not set/);
  });

  it("refuses a malformed ref", () => {
    const r = runGuard({ SUPABASE_PROJECT_REF: "too-short" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not a valid 20-character project ref/);
  });

  it("refuses a well-formed but unapproved ref, and leaks no ref value", () => {
    const r = runGuard({ SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not the approved production project/);
    expect(r.stderr).not.toContain("zzzzzzzzzzzzzzzzzzzz");
  });

  it("passes only for the approved ref", () => {
    const r = runGuard({ SUPABASE_PROJECT_REF: APPROVED });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/guard passed/);
  });

  it("reads the ref from the environment, not from argv", () => {
    const src = readFileSync(guard, "utf8");
    expect(src).toMatch(/process\.env\.SUPABASE_PROJECT_REF/);
    expect(src).not.toMatch(/process\.argv/);
  });
});

describe("migration workflow safety properties", () => {
  const wf = readFileSync(workflow, "utf8");

  it("is dispatch-only and never runs on push or a schedule", () => {
    expect(wf).toMatch(/workflow_dispatch/);
    expect(wf).not.toMatch(/^\s{2}push:/m);
    expect(wf).not.toMatch(/^\s{2}schedule:/m);
  });

  it("is bound to the production environment for human approval", () => {
    expect(wf).toMatch(/environment:\s*production/);
  });

  it("serialises runs with a concurrency group", () => {
    expect(wf).toMatch(/concurrency:/);
    expect(wf).toMatch(/group:\s*supabase-migrations-production/);
    expect(wf).toMatch(/cancel-in-progress:\s*false/);
  });

  it("requires a typed confirmation phrase", () => {
    expect(wf).toMatch(/apply-supabase-migrations/);
    expect(wf).toMatch(/confirmation phrase did not match/);
  });

  it("runs the project-ref guard before any database-changing command", () => {
    // Match the step commands, not prose in the header comment.
    const guardAt = wf.indexOf("run: node scripts/lib/guard-approved-project.mjs");
    const linkAt = wf.indexOf("run: supabase link --project-ref");
    const dryRunAt = wf.indexOf("run: npm run supabase:migrations:dry-run");
    const pushAt = wf.indexOf("run: npm run supabase:migrations:push");
    expect(guardAt).toBeGreaterThan(-1);
    expect(linkAt).toBeGreaterThan(-1);
    expect(dryRunAt).toBeGreaterThan(-1);
    expect(pushAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(linkAt);
    expect(guardAt).toBeLessThan(dryRunAt);
    expect(guardAt).toBeLessThan(pushAt);
  });

  it("keeps least-privilege permissions", () => {
    expect(wf).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    expect(wf).not.toMatch(/contents:\s*write/);
    expect(wf).not.toMatch(/pull-requests:\s*write/);
  });

  it("hardcodes no credential or project ref", () => {
    expect(wf).not.toMatch(/eyJ[A-Za-z0-9._-]{20,}/);
    expect(wf).not.toMatch(/postgresql:\/\//);
    // The approved ref belongs in scripts/lib/approved-project.mjs only.
    expect(wf).not.toMatch(new RegExp(APPROVED));
  });

  it("notes that environment protection must be configured by the owner", () => {
    expect(wf).toMatch(/required reviewers|protection rules/i);
  });
});
