import { buildExecutionPlan, parseArgs, Manifest } from "../../scripts/migrate-all-batched";
import { getBatchedMigratableCollections } from "../../lib/supabase/migration-inventory";

jest.mock("../../lib/supabase/migration-inventory", () => {
  const original = jest.requireActual("../../lib/supabase/migration-inventory");
  return {
    ...original,
    getBatchedMigratableCollections: jest.fn().mockReturnValue([
      [
        { collection: "sevas", destinationTable: "sevas", classification: "MIGRATE" },
        { collection: "dailyPoojas", destinationTable: "daily_poojas", classification: "MIGRATE" }
      ],
      [
        { collection: "events", destinationTable: "events", classification: "MIGRATE" }
      ]
    ])
  };
});

describe("Batched Migration Execution Plan", () => {
  const mockManifest: Manifest = {
    runId: "test-run",
    overallStatus: "RUNNING",
    inventoryVersion: "1.0",
    isDryRun: false,
    excludedCollections: [],
    reviewedCollections: [],
    records: {
      "sevas": {
        collection: "sevas",
        destination: "sevas",
        batch: 1,
        status: "SUCCESS",
        sourceCount: 10,
        destinationCount: 10,
        migratedCount: 10,
        skippedCount: 0,
        failedCount: 0,
        startedAt: "",
        completedAt: "",
        verificationStatus: "PASS"
      },
      "dailyPoojas": {
        collection: "dailyPoojas",
        destination: "daily_poojas",
        batch: 1,
        status: "FAILED",
        sourceCount: 10,
        destinationCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 10,
        startedAt: "",
        completedAt: "",
        verificationStatus: "FAIL",
        failureReason: "Test failure"
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should populate all collections when --retry-failed is passed with no other filters", () => {
    const args = parseArgs(["--retry-failed"]);
    const plan = buildExecutionPlan(args, mockManifest);

    // Total batches
    expect(plan.allBatchesCount).toBeGreaterThan(0);

    // It should include dailyPoojas (which failed) but EXCLUDE sevas (which succeeded)
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    const poojasInPlan = plan.collectionsToRun.find(c => c.item.collection === "dailyPoojas");

    expect(sevasInPlan).toBeUndefined();
    expect(poojasInPlan).toBeDefined();

    // It should also include collections not present in the manifest (unattempted)
    const eventsInPlan = plan.collectionsToRun.find(c => c.item.collection === "events");
    expect(eventsInPlan).toBeDefined();
  });

  it("should return empty execution plan by default if no arguments are provided", () => {
    const args = parseArgs([]);
    const plan = buildExecutionPlan(args, null);

    expect(plan.collectionsToRun.length).toBe(0);
  });

  it("should select specific batch if --batch is provided", () => {
    const args = parseArgs(["--batch", "1"]);
    const plan = buildExecutionPlan(args, null);

    expect(plan.collectionsToRun.length).toBeGreaterThan(0);
    expect(plan.collectionsToRun.every(c => c.batchIndex === 1)).toBe(true);
  });

  it("should discard dry-run checkpoint on a live migration run", () => {
    const args = parseArgs(["--retry-failed"]);
    const dryRunManifest = { ...mockManifest, isDryRun: true };

    // Live migration (args.dryRun = false) + dry-run manifest = discard manifest
    const plan = buildExecutionPlan(args, dryRunManifest);

    // Without manifest, it includes ALL collections (because no "SUCCESS" records exist to filter)
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });
});
