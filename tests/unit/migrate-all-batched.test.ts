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
    migrationType: "production",
    batchSize: 10,
    checkpointVersion: "1.0",
    checkpointSourceRunId: "test-run-0",
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

  it("should throw error when --retry-failed is passed without scope", () => {
    const args = parseArgs(["--retry-failed"]);
    expect(() => buildExecutionPlan(args, mockManifest)).toThrow("retry-failed requires either --batch or --collections to be specified.");
  });

  it("should populate failed and unattempted collections when --retry-failed and --batch is passed", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const plan = buildExecutionPlan(args, mockManifest);

    expect(plan.allBatchesCount).toBeGreaterThan(0);

    // It should include dailyPoojas (which failed) but EXCLUDE sevas (which succeeded)
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    const poojasInPlan = plan.collectionsToRun.find(c => c.item.collection === "dailyPoojas");

    expect(sevasInPlan).toBeUndefined();
    expect(poojasInPlan).toBeDefined();
  });

  it("should discard dry-run checkpoint on a live migration run", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const dryRunManifest = { ...mockManifest, migrationType: "dry-run" as const };

    // Live migration (args.dryRun = false) + dry-run manifest = discard manifest
    const plan = buildExecutionPlan(args, dryRunManifest);

    // Without manifest, it includes ALL collections from batch 1 (because no "SUCCESS" records exist to filter)
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should discard checkpoint with missing migrationType metadata", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest };
    delete (invalidManifest as any).migrationType;

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should discard checkpoint if batch size mismatches", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const sizeMismatchManifest = { ...mockManifest, batchSize: 500 };

    const plan = buildExecutionPlan(args, sizeMismatchManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

    it("should discard checkpoint with missing checkpointVersion", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest };
    delete (invalidManifest as any).checkpointVersion;

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined(); // If discarded, defaults to whole batch 1
  });

  it("should discard checkpoint with incompatible checkpointVersion", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest, checkpointVersion: "0.1" };

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should discard checkpoint with missing runId", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest };
    delete (invalidManifest as any).runId;

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should discard checkpoint with invalid checkpointSourceRunId structure", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest, checkpointSourceRunId: 12345 as any };

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should discard checkpoint with incompatible inventory version", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest, inventoryVersion: "0.1" };

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should discard checkpoint with missing or invalid records structure", () => {
    const args = parseArgs(["--retry-failed", "--batch", "1"]);
    const invalidManifest = { ...mockManifest, records: null } as unknown as Manifest;

    const plan = buildExecutionPlan(args, invalidManifest);
    const sevasInPlan = plan.collectionsToRun.find(c => c.item.collection === "sevas");
    expect(sevasInPlan).toBeDefined();
  });

  it("should select explicitly chosen collections and ignore others when --collections is used with --retry-failed", () => {
    const args = parseArgs(["--retry-failed", "--collections", "dailyPoojas"]);
    const plan = buildExecutionPlan(args, mockManifest);

    expect(plan.collectionsToRun.length).toBe(1);
    expect(plan.collectionsToRun[0].item.collection).toBe("dailyPoojas");
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
});
