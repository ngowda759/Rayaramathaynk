import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const script = resolve(root, "scripts/apply-ai-knowledge-migration.mjs");
const workflow = resolve(root, ".github/workflows/ai-knowledge-migration-apply.yml");
const migration = resolve(root, "supabase/migrations/20261013000000_create_ai_knowledge.sql");

function run(env: Record<string, string | undefined>) {
  const base = { ...process.env };
  for (const k of ["SUPABASE_PROJECT_REF", "SUPABASE_DB_PASSWORD", "SUPABASE_ACCESS_TOKEN", "PGURL_OVERRIDE"]) {
    delete base[k];
  }
  return spawnSync("node", [script], { cwd: root, env: { ...base, ...env }, encoding: "utf8" });
}

describe("apply-ai-knowledge-migration guard rails", () => {
  it("refuses to run without SUPABASE_PROJECT_REF", () => {
    const r = run({ SUPABASE_DB_PASSWORD: "x" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SUPABASE_PROJECT_REF is not set/);
  });

  it("refuses to run without SUPABASE_DB_PASSWORD", () => {
    const r = run({ SUPABASE_PROJECT_REF: "kvrkraqjuyxbraccxntk" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SUPABASE_DB_PASSWORD is not set/);
  });

  it("fails closed on an unreachable override and redacts the project ref", () => {
    const r = run({ PGURL_OVERRIDE: "postgresql://postgres.secretrefvalue1234@127.0.0.1:1/postgres" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/\[OVERRIDE\]/);
    expect(r.stderr).not.toMatch(/secretrefvalue1234/);
  });

  it("applies exactly one migration file and never shells out to the CLI", () => {
    const src = readFileSync(script, "utf8");
    expect(src).toMatch(/20261013000000_create_ai_knowledge\.sql/);
    // No process spawn: the migration is read as a file, not run via `supabase db push`.
    expect(src).not.toMatch(/child_process|spawnSync|execSync|exec\(/);
    // one transaction around the apply
    expect(src).toMatch(/begin/);
    expect(src).toMatch(/rollback/);
    expect(src).toMatch(/commit/);
  });

  it("does not read or write ai_settings data", () => {
    const src = readFileSync(script, "utf8");
    expect(src).not.toMatch(/insert into ai_settings/i);
    expect(src).not.toMatch(/update ai_settings/i);
    expect(src).not.toMatch(/delete from ai_settings/i);
  });

  it("is dispatch-only, environment-gated, and phrase-guarded", () => {
    expect(existsSync(workflow)).toBe(true);
    const wf = readFileSync(workflow, "utf8");
    expect(wf).toMatch(/workflow_dispatch/);
    expect(wf).not.toMatch(/\bpush:/);
    expect(wf).toMatch(/environment:\s*production/);
    expect(wf).toMatch(/apply-create-ai-knowledge/);
  });

  it("keeps the migration non-destructive and scoped to ai_knowledge", () => {
    const sql = readFileSync(migration, "utf8");
    expect(sql).toMatch(/CREATE TABLE ai_knowledge/);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/\b(ai_settings|chat_|unknown_questions|users|profiles)\b/);
  });
});
