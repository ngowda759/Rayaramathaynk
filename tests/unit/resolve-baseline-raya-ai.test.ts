import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const script = resolve(root, "scripts/resolve-baseline-raya-ai.mjs");
const lib = resolve(root, "scripts/lib/target-connection.mjs");
const workflow = resolve(root, ".github/workflows/resolve-raya-ai-baseline.yml");

function run(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  for (const k of [
    "SUPABASE_PROJECT_REF", "SUPABASE_DB_PASSWORD", "SUPABASE_ACCESS_TOKEN",
    "PGURL_OVERRIDE", "RESOLVE_CONFIRM",
  ]) {
    delete base[k];
  }
  return spawnSync("node", [script], { cwd: root, env: { ...base, ...env }, encoding: "utf8" });
}

describe("resolve-baseline-raya-ai guard rails", () => {
  it("refuses to run without the exact confirmation phrase", () => {
    const r = run({ SUPABASE_PROJECT_REF: "kvrkraqjuyxbraccxntk", SUPABASE_DB_PASSWORD: "x" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/RESOLVE_CONFIRM did not equal/);
  });

  it("refuses a wrong confirmation phrase", () => {
    const r = run({ RESOLVE_CONFIRM: "resolve-baseline", SUPABASE_PROJECT_REF: "x", SUPABASE_DB_PASSWORD: "y" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refusing to run/);
  });

  it("refuses to run without SUPABASE_PROJECT_REF", () => {
    const r = run({ RESOLVE_CONFIRM: "resolve-baseline-raya-ai", SUPABASE_DB_PASSWORD: "x" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SUPABASE_PROJECT_REF is not set/);
  });

  it("refuses to run without SUPABASE_DB_PASSWORD", () => {
    const r = run({ RESOLVE_CONFIRM: "resolve-baseline-raya-ai", SUPABASE_PROJECT_REF: "kvrkraqjuyxbraccxntk" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SUPABASE_DB_PASSWORD is not set/);
  });

  it("fails closed on an unreachable override, redacting the project ref", () => {
    const r = run({
      RESOLVE_CONFIRM: "resolve-baseline-raya-ai",
      PGURL_OVERRIDE: "postgresql://postgres.secretrefvalue1234@127.0.0.1:1/postgres",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/\[OVERRIDE\]/);
    expect(r.stderr).not.toMatch(/secretrefvalue1234/);
  });

  it("writes exactly one history row and never runs a migration or the CLI", () => {
    const src = readFileSync(script, "utf8");
    // The only write is an idempotent history insert.
    expect(src).toMatch(/insert into supabase_migrations\.schema_migrations/);
    expect(src).toMatch(/on conflict \(version\) do nothing/);
    // Only the write matters; ignore explanatory comments that name the CLI command.
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    // It must not execute migrations through any CLI path.
    expect(code).not.toMatch(/spawnSync\(\s*"prisma"|npx|execSync|db push|supabase db/);
    // It must not touch table data.
    expect(code).not.toMatch(/insert into ai_settings|update ai_settings|delete from ai_settings/i);
    // One transaction around the write.
    expect(code).toMatch(/begin/);
    expect(code).toMatch(/rollback/);
    expect(code).toMatch(/commit/);
  });

  it("runs the read-only scoped drift gate before writing, and aborts if it fails", () => {
    const src = readFileSync(script, "utf8");
    expect(src).toMatch(/check-baseline-drift-scope\.mjs/);
    // The gate result must gate the write: a non-zero code aborts.
    expect(src).toMatch(/code !== 0/);
    expect(src).toMatch(/must not suppress unresolved drift/);
    // A missing declared table also aborts before any write.
    expect(src).toMatch(/declared tables are missing/);
  });

  it("derives the in-scope tables from the schema rather than hardcoding them", () => {
    const src = readFileSync(script, "utf8");
    expect(src).toMatch(/@@map/);
    expect(src).toMatch(/schema\.prisma/);
  });

  it("is dispatch-only, environment-gated, and phrase-guarded", () => {
    expect(existsSync(workflow)).toBe(true);
    const wf = readFileSync(workflow, "utf8");
    expect(wf).toMatch(/workflow_dispatch/);
    expect(wf).not.toMatch(/\bpush:/);
    expect(wf).toMatch(/environment:\s*production/);
    expect(wf).toMatch(/resolve-baseline-raya-ai/);
    expect(wf).toMatch(/RESOLVE_CONFIRM:\s*resolve-baseline-raya-ai/);
  });
});

describe("shared target connection helper", () => {
  it("redacts the project ref from arbitrary text", () => {
    const r = spawnSync(
      "node",
      ["-e", 'import("./scripts/lib/target-connection.mjs").then(m=>process.stdout.write(m.redact("connect postgres.abcdefghijkl fail")))'],
      { cwd: root, encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("connect postgres.<ref> fail");
  });

  it("does not embed any credential literal", () => {
    const src = readFileSync(lib, "utf8");
    expect(src).not.toMatch(/postgresql:\/\/postgres\.[a-z0-9]+:[^$]/);
  });
});
