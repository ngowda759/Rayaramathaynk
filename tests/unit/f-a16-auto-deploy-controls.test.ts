/**
 * @jest-environment node
 *
 * Guards for the F-A16 production auto-deploy control surface.
 *
 * A Supabase GitHub integration (the "Supabase Preview" check, app slug `supabase`)
 * is configured in the Supabase dashboard for this repository with "Deploy to
 * production" enabled. It is NOT a repository workflow: on every push to `main` it
 * applies pending `supabase/migrations/*.sql` to the production project, on its own
 * schedule (every `main` push, including the daily panchanga bot commits).
 *
 * The integration is controlled from the dashboard, not from this repository, so it
 * cannot be switched off by a commit. What this suite pins is everything about it
 * that *is* repository-side:
 *
 *   1. No repository workflow auto-applies migrations on `push` or a schedule — the
 *      only `supabase db push` is behind `workflow_dispatch` with a project-ref guard.
 *   2. `supabase/config.toml` does not disable migrations, so both the manual
 *      workflow and the dashboard integration still function as documented.
 *   3. If someone sets the documented switch (`[db.migrations] enabled = false`),
 *      both migration workflows fail closed with a clear message rather than
 *      reporting a vacuous green pass. This is executed, not merely grepped.
 *
 * Nothing here touches a database, the network, the GitHub API, or a dashboard.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parseWorkflow, readWorkflow, workflowFiles } from "./workflow-writer-inventory";

const root = resolve(__dirname, "../..");

/** Workflows whose job runs `supabase db push` (directly or via an npm script). */
const MIGRATION_WORKFLOWS = [
  "supabase-migrations.yml",
  "supabase-migrations-test.yml",
];

const CONFIG = resolve(root, "supabase/config.toml");

/** Return the `run:` shell body of the named step, dedented, from a workflow YAML. */
function stepScript(yaml: string, stepName: string): string {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  if (start === -1) throw new Error(`step not found: ${stepName}`);
  for (let i = start; i < lines.length; i++) {
    const m = /^(\s*)run:\s*\|?\s*$/.exec(lines[i]) ?? /^(\s*)run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const inline = m[2];
    if (inline) return inline;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") {
        body.push("");
        continue;
      }
      if (line.length - line.trimStart().length <= indent) break;
      body.push(line.slice(indent + 2));
    }
    return body.join("\n");
  }
  throw new Error(`no run body for step: ${stepName}`);
}

/** Run a shell script in a throwaway directory holding `supabase/config.toml`. */
function runGuard(script: string, configToml: string): { status: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "fa16-guard-"));
  try {
    mkdirSync(join(dir, "supabase"), { recursive: true });
    writeFileSync(join(dir, "supabase", "config.toml"), configToml);
    const r = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8" });
    return { status: r.status ?? -1, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const GUARD_STEP = "Assert migrations are enabled in config.toml";

describe("F-A16 auto-deploy: no repository workflow applies migrations on push", () => {
  it("has exactly the two known migration workflows", () => {
    const pushing = workflowFiles().filter((f) => {
      const steps = parseWorkflow(readWorkflow(f)).flatMap((j) => j.steps);
      // Match the command in a step body, not in a comment: ai-knowledge-migration-apply.yml
      // mentions `supabase db push` in prose precisely to say it does NOT run it.
      return steps.some((s) => /\bsupabase\s+db\s+push\b/.test(s.runBody));
    });
    expect(pushing.sort()).toEqual([...MIGRATION_WORKFLOWS].sort());
  });

  it.each(MIGRATION_WORKFLOWS)("%s is dispatch-only and never runs on push or a schedule", (file) => {
    const yaml = readWorkflow(file);
    expect(yaml).toMatch(/workflow_dispatch/);
    // A workflow that ran `supabase db push` on push would be an auto-apply path
    // inside this repository, duplicating the dashboard integration.
    expect(yaml).not.toMatch(/^\s{2}push:/m);
    expect(yaml).not.toMatch(/^\s{2}schedule:/m);
  });

  it.each(MIGRATION_WORKFLOWS)("%s runs the config guard before linking or pushing", (file) => {
    const jobs = parseWorkflow(readWorkflow(file));
    const steps = jobs.flatMap((j) => j.steps);
    const guard = steps.find((s) => s.name === GUARD_STEP);
    const link = steps.find((s) => /supabase link/.test(s.runBody));
    expect(guard).toBeDefined();
    expect(link).toBeDefined();
    expect(link!.index).toBeGreaterThan(guard!.index);
  });
});

describe("F-A16 auto-deploy: repository config keeps migrations enabled", () => {
  it("supabase/config.toml does not disable migrations", () => {
    const toml = readFileSync(CONFIG, "utf8");
    const disabled =
      /^\s*\[db\.migrations\]/m.test(toml) && /^\s*enabled\s*=\s*(false|"false")/m.test(toml);
    expect(disabled).toBe(false);
  });

  it("documents the auto-deploy switch in config.toml", () => {
    const toml = readFileSync(CONFIG, "utf8");
    expect(toml).toMatch(/PRODUCTION AUTO-DEPLOY SWITCH/);
    expect(toml).toMatch(/F-A16_INTEGRATION_VERIFICATION\.md §13/);
  });
});

describe("F-A16 auto-deploy: the config guard fails closed when migrations are disabled", () => {
  const scripts = MIGRATION_WORKFLOWS.map((f) => [f, stepScript(readWorkflow(f), GUARD_STEP)] as const);

  it.each(scripts)("%s rejects `enabled = false`", (_file, script) => {
    const r = runGuard(script, 'project_id = "x"\n\n[db.migrations]\nenabled = false\n');
    expect(r.status).not.toBe(0);
    expect(r.output).toMatch(/ERROR/);
  });

  it.each(scripts)("%s rejects `enabled = \"false\"`", (_file, script) => {
    const r = runGuard(script, 'project_id = "x"\n\n[db.migrations]\nenabled = "false"\n');
    expect(r.status).not.toBe(0);
  });

  it.each(scripts)("%s accepts `enabled = true`", (_file, script) => {
    const r = runGuard(script, 'project_id = "x"\n\n[db.migrations]\nenabled = true\n');
    expect(r.status).toBe(0);
  });

  it.each(scripts)("%s accepts a config with no [db.migrations] block", (_file, script) => {
    const r = runGuard(script, 'project_id = "x"\n\n[db]\nmajor_version = 15\n');
    expect(r.status).toBe(0);
  });

  it.each(scripts)("%s accepts the repository's real config.toml", (_file, script) => {
    const r = runGuard(script, readFileSync(CONFIG, "utf8"));
    expect(r.status).toBe(0);
  });
});

describe("F-A16 auto-deploy: workflow YAML is structurally valid", () => {
  it.each(MIGRATION_WORKFLOWS)("%s parses into jobs with steps", (file) => {
    const jobs = parseWorkflow(readWorkflow(file));
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.steps.length > 0)).toBe(true);
  });
});
