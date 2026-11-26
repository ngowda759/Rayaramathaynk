/**
 * @jest-environment node
 *
 * Guard the Aaradhane publication gate. A manual dispatch defaults to
 * `dry_run: true`; that default must never reach a Storage write, even when the
 * repository variable is enabled. Scheduled publication stays allowed only when
 * the variable is enabled.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../..");
const yaml = readFileSync(join(root, ".github/workflows/aaradhane.yml"), "utf8");
const publishJob = yaml.slice(yaml.indexOf("  publish-aaradhane:"));

type EventName = "schedule" | "workflow_dispatch" | "push";

/** Mirror of the workflow's publication expression, used to cover each path. */
function publicationAllowed(input: {
  event: EventName;
  dryRun: boolean;
  enabled: string;
}): boolean {
  if (input.enabled !== "true") return false;
  if (input.event === "schedule") return true;
  if (input.event === "workflow_dispatch") return input.dryRun === false;
  return false;
}

describe("Aaradhane publication gate", () => {
  it("requires the publication variable for every event type", () => {
    expect(publicationAllowed({ event: "schedule", dryRun: true, enabled: "" })).toBe(false);
    expect(
      publicationAllowed({ event: "workflow_dispatch", dryRun: false, enabled: "" })
    ).toBe(false);
    expect(publicationAllowed({ event: "push", dryRun: false, enabled: "true" })).toBe(false);
  });

  it("allows a scheduled run only when the variable is enabled", () => {
    expect(publicationAllowed({ event: "schedule", dryRun: true, enabled: "false" })).toBe(false);
    expect(publicationAllowed({ event: "schedule", dryRun: true, enabled: "true" })).toBe(true);
  });

  it("never publishes a manual dry run, even when the variable is enabled", () => {
    expect(
      publicationAllowed({ event: "workflow_dispatch", dryRun: true, enabled: "true" })
    ).toBe(false);
  });

  it("publishes a manual run only with dry_run=false and the variable enabled", () => {
    expect(
      publicationAllowed({ event: "workflow_dispatch", dryRun: false, enabled: "false" })
    ).toBe(false);
    expect(
      publicationAllowed({ event: "workflow_dispatch", dryRun: false, enabled: "true" })
    ).toBe(true);
  });

  it("wires the same rules into the publish job's if expression", () => {
    expect(publishJob).toContain(
      "if: ${{ vars.AARADHANE_STORAGE_PUBLISH_ENABLED == 'true' && (github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && inputs.dry_run == false)) }}"
    );
    expect(publishJob).not.toContain(
      "if: ${{ vars.AARADHANE_STORAGE_PUBLISH_ENABLED == 'true' }}\n"
    );
  });

  it("keeps a defense-in-depth refusal before the publish command", () => {
    const refusalAt = publishJob.indexOf("Refuse manual dry-run publication");
    const publishAt = publishJob.indexOf("scripts/generate-aaradhane.ts --year");
    expect(refusalAt).toBeGreaterThan(-1);
    expect(publishAt).toBeGreaterThan(-1);
    expect(refusalAt).toBeLessThan(publishAt);
    expect(publishJob).toContain("inputs.dry_run != false");
    expect(publishJob).toContain("exit 1");
  });

  it("leaves the manual dry_run input defaulting to preview", () => {
    expect(yaml).toMatch(/dry_run:[\s\S]*?default: true/);
  });
});
