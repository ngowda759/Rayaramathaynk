/**
 * @jest-environment node
 *
 * Static tests for the prepared `events` public-read policy migration.
 *
 * The migration is NOT applied here and must not be: this suite only reads the SQL
 * file. It asserts the properties that make the policy safe to hand to an owner for
 * review — SELECT-only, published-only, no draft exposure, no write grant — because
 * the whole point of the policy is that it must be *narrow enough* that turning it
 * on cannot leak unpublished events.
 *
 * This is the reader/RLS half of the PR-D4c split; the writer-schema half
 * (provenance columns) lives in `provenance-migration.test.ts`.
 */

import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const POLICY_FILE = "20261105000000_events_public_select_policy.sql";

function read(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
}

/** Strip `--` line comments so assertions match statements, not prose. */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("events public-read policy migration", () => {
  const sql = read(POLICY_FILE);
  const body = stripComments(sql);

  it("sorts after the migration that was newest before this change", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const previousNewest = "20261104000000_add_events_provenance_columns.sql";
    expect(files.indexOf(POLICY_FILE)).toBeGreaterThan(files.indexOf(previousNewest));
  });

  it("grants SELECT only — never ALL, INSERT, UPDATE or DELETE", () => {
    expect(body).toMatch(/CREATE\s+POLICY[\s\S]*?FOR\s+SELECT\b/i);
    expect(body).not.toMatch(/FOR\s+ALL\b/i);
    expect(body).not.toMatch(/FOR\s+(?:INSERT|UPDATE|DELETE)\b/i);
    expect(body).not.toMatch(/\bGRANT\b/i);
  });

  it("exposes only published rows, so a draft can never be enumerated", () => {
    // The predicate must be `published = true` (or equivalent), not `USING (true)`.
    expect(body).toMatch(/USING\s*\(\s*published\s*(?:=\s*true|IS\s+TRUE)\s*\)/i);
    expect(body).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it("targets the public read roles, not a privileged one", () => {
    expect(body).toMatch(/TO\s+anon\s*,\s*authenticated\b/i);
    expect(body).not.toMatch(/TO\s+(?:service_role|postgres)\b/i);
  });

  it("touches only the events table", () => {
    const tables = new Set(
      [...body.matchAll(/\bON\s+(?:public\.)?([a-z_]+)\b/gi)].map((m) => m[1].toLowerCase()),
    );
    expect([...tables]).toEqual(["events"]);
  });

  it("is idempotent, so a re-run cannot fail on an existing policy", () => {
    expect(body).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS/i);
  });

  it("changes nothing but the policy — no schema, no data, no other RLS", () => {
    expect(body).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(body).not.toMatch(/\b(?:ADD|DROP)\s+COLUMN\b/i);
    expect(body).not.toMatch(/\bUPDATE\s+/i);
    expect(body).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(body).not.toMatch(/\bTRUNCATE\b/i);
    expect(body).not.toMatch(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  });

  it("parses as plain SQL with no psql meta-commands", () => {
    expect(body).not.toMatch(/^\s*\\/m);
    expect(body.trim().endsWith(";")).toBe(true);
  });

  it("is not referenced by an executed workflow step", () => {
    // The policy is prepared for owner review; nothing may apply it automatically.
    // `supabase-migrations.yml` is a manual dispatch and applies the directory by
    // design, so it is excluded.
    const workflows = fs
      .readdirSync(path.join(process.cwd(), ".github/workflows"))
      .filter((f) => f.endsWith(".yml") && f !== "supabase-migrations.yml");
    for (const file of workflows) {
      const yaml = fs.readFileSync(path.join(process.cwd(), ".github/workflows", file), "utf8");
      expect(yaml).not.toContain(POLICY_FILE);
    }
  });
});

/**
 * The ordering invariant that decides whether this PR can be merged before the policy
 * is applied.
 *
 * `docs/EVENTS_POLICY_DEPLOYMENT_SEQUENCE.md` §4 says the policy must be applied
 * *before* the merge, because merging deploys. That claim rests on the deploy path
 * being ungated. These tests pin the parts of that claim the repository can actually
 * prove, and — importantly — do **not** pretend `deploy.yml` is the live deployer: it
 * is disabled, and the real deployer (Vercel's Git integration) lives outside this
 * repo, so no static test can observe it. See §4 and §8 of the doc.
 */
describe("deploy-on-merge coupling (the reason the policy must be applied first)", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");

  it("deploy.yml would deploy to production on push to main if it were enabled", () => {
    // Static property of the file. This does NOT mean deploy.yml is what deploys:
    // it is disabled (see the next test). It matters because enabling it would
    // deploy straight to production on a push.
    const deploy = fs.readFileSync(path.join(workflowDir, "deploy.yml"), "utf8");
    expect(deploy).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
    expect(deploy).toMatch(/vercel deploy --prebuilt --prod/);
  });

  it("deploy.yml carries no approval gate, so enabling it would be ungated", () => {
    // No `environment:` on the job means no required-reviewer pause. Kept as an
    // assertion so that adding a gate is a deliberate, visible change.
    const deploy = fs.readFileSync(path.join(workflowDir, "deploy.yml"), "utf8");
    expect(deploy).not.toMatch(/^\s*environment:/m);
  });

  it("no in-repo workflow gates a production deploy", () => {
    // The repository-side half of "merging is deploying". The live deployer is the
    // Vercel Git integration, which is not in this repo and cannot be asserted here;
    // what this can prove is that nothing in the repo would stop it either.
    const gated = fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith(".yml"))
      .filter((f) => {
        const yaml = fs.readFileSync(path.join(workflowDir, f), "utf8");
        return /vercel\s+(deploy|build)/.test(yaml) && /^\s*environment:/m.test(yaml);
      });
    expect(gated).toEqual([]);
  });

  it("applying the policy is manual only, so it cannot race the deploy", () => {
    const migrations = fs.readFileSync(
      path.join(workflowDir, "supabase-migrations.yml"),
      "utf8",
    );
    // Dispatch-gated, and it must not be reachable from a push.
    expect(migrations).toMatch(/workflow_dispatch:/);
    expect(migrations).not.toMatch(/^\s*push:/m);
  });
});
