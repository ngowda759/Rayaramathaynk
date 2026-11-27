/**
 * @jest-environment node
 *
 * Guard the historical data-flow import workflow. It is the only path that runs
 * `scripts/migrate-data-flows-to-storage.ts`, which writes ~734 objects into
 * production Supabase Storage, so every gate around it is asserted here: manual
 * dispatch only, exact confirmation phrase, production environment, default
 * branch only, approved-URL guard before the write, and the approval flag scoped
 * to the publish step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseWorkflow } from "../workflow-writer-inventory";

const root = join(__dirname, "../../..");
const yaml = readFileSync(
  join(root, ".github/workflows/data-flows-historical-import.yml"),
  "utf8"
);
const steps = parseWorkflow(yaml).flatMap((job) => job.steps);

const CONFIRMATION = "publish-historical-data-flows";

describe("historical data-flow import workflow", () => {
  it("is manual dispatch only", () => {
    expect(yaml).toMatch(/^on:\n\s+workflow_dispatch:/m);
    expect(yaml).not.toMatch(/^\s+schedule:/m);
    expect(yaml).not.toMatch(/^\s+push:/m);
    expect(yaml).not.toMatch(/^\s+pull_request/m);
  });

  it("requires the exact confirmation phrase as a dispatch input", () => {
    expect(yaml).toMatch(/confirm_production:/);
    expect(yaml).toMatch(/required: true/);
    expect(yaml).toContain(CONFIRMATION);
    // Documented *and* enforced: the step compares the env var to the phrase.
    expect(yaml).toContain(`!= "${CONFIRMATION}"`);
    expect(yaml).toContain("CONFIRM_PRODUCTION: ${{ inputs.confirm_production }}");
    // Untrusted dispatch input is read from env: no run: block may interpolate it,
    // or any other expression, into the script text.
    const runBodies = steps.map((step) => step.runBody).join("\n");
    expect(runBodies).not.toMatch(/inputs\./);
    expect(runBodies).not.toMatch(/\$\{\{/);
  });

  it("binds the job to the production environment", () => {
    expect(yaml).toMatch(/environment:\s*production/);
  });

  it("only runs the reviewed code from the default branch", () => {
    expect(yaml).toContain("github.ref == 'refs/heads/main'");
  });

  it("maps the two existing repository secrets by name", () => {
    expect(yaml).toContain(
      "NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}"
    );
    expect(yaml).toContain(
      "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
    );
  });

  it("runs the approved-URL guard before the publish command", () => {
    const guardAt = yaml.indexOf("node scripts/lib/guard-approved-supabase-url.mjs");
    const publishAt = yaml.indexOf(
      "scripts/migrate-data-flows-to-storage.ts",
      yaml.indexOf("Publish historical Panchanga and Aaradhane datasets")
    );
    expect(guardAt).toBeGreaterThan(-1);
    expect(publishAt).toBeGreaterThan(guardAt);
  });

  it("publishes with --publish --confirm-production and writes a report", () => {
    expect(yaml).toMatch(/--publish\b/);
    expect(yaml).toMatch(/--confirm-production\b/);
    expect(yaml).toMatch(/--report\s+artifacts\/data-flows\//);
  });

  it("sets the historical approval flag only on the publish step, after confirmation", () => {
    expect(yaml.match(/DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED: "true"/g) ?? []).toHaveLength(1);

    const jobEnv = yaml.slice(yaml.indexOf("    env:"), yaml.indexOf("    steps:"));
    expect(jobEnv).toContain("secrets.NEXT_PUBLIC_SUPABASE_URL");
    expect(jobEnv).not.toContain("DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED");

    const confirmAt = yaml.indexOf("Confirm production publication");
    const approvalAt = yaml.indexOf('DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED: "true"');
    const publishAt = yaml.indexOf(
      "scripts/migrate-data-flows-to-storage.ts",
      yaml.indexOf("Publish historical Panchanga and Aaradhane datasets")
    );
    expect(confirmAt).toBeGreaterThan(-1);
    expect(approvalAt).toBeGreaterThan(confirmAt);
    expect(publishAt).toBeGreaterThan(approvalAt);
  });

  it("is not gated by a repository variable and cannot advance current", () => {
    expect(yaml).not.toMatch(/vars\./);
    expect(yaml).not.toMatch(/--advance-current/);
    expect(yaml).not.toMatch(/--apply\b/);
  });

  it("deletes nothing", () => {
    expect(yaml).not.toMatch(/method:\s*DELETE/i);
    expect(yaml).not.toMatch(/\brm\s+-rf\b/);
    expect(yaml).not.toMatch(/storage\/v1\/object\/[^\s]*"?,?\s*-X\s*DELETE/);
  });

  it("uploads the report even when the import fails", () => {
    const upload = yaml.slice(yaml.indexOf("Upload import report"));
    expect(upload).toMatch(/if: always\(\)/);
    expect(upload).toMatch(/if-no-files-found: warn/);
  });

  it("uses Node 22 and a script-free install", () => {
    expect(yaml).toMatch(/node-version: "22"/);
    expect(yaml).toMatch(/npm ci --ignore-scripts/);
  });
});
