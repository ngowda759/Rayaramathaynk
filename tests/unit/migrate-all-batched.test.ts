jest.mock("server-only", () => { return {}; }, { virtual: true });
import * as fs from "fs";
import { buildExecutionPlan, parseArgs, executePlan, getMapperFn, Manifest } from "../../scripts/migrate-all-batched";
import { getBatchedMigratableCollections } from "../../lib/supabase/migration-inventory";

// Automocked: executePlan must never reach a real database or migration runner
// in this suite. Only the behaviour of the plan/exit logic is under test.
jest.mock("../../lib/supabase/migration-runner");
jest.mock("../../lib/admin-firebase");
jest.mock("../../lib/supabase/admin");

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
  beforeAll(() => { process.env.NODE_ENV = "test"; });
  it("should return mapChatMessage for messages collection", () => {
    const { getMapperFn } = require("../../scripts/migrate-all-batched");
    const fn = getMapperFn("messages");
    expect(fn).toBeDefined();
    expect(fn.name).toBe("mapChatMessage");
  });

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

// --- Silent-omission containment (P0) ---------------------------------------
// A collection classified MIGRATE with no destinationTable must FAIL the run,
// never be silently skipped while the run reports success.
describe("executePlan fails closed on a MIGRATE collection with no destination", () => {
  const MANIFEST = "data/migration-manifest.json";
  let existedBefore = false;
  let saved: string | undefined;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    // Snapshot any pre-existing manifest so real state is preserved. A real
    // migration always runs from the repository root, so this is the same path.
    existedBefore = fs.existsSync(MANIFEST);
    if (existedBefore) saved = fs.readFileSync(MANIFEST, "utf-8");
  });

  afterEach(() => {
    if (existedBefore) {
      fs.writeFileSync(MANIFEST, saved as string);
    } else {
      fs.rmSync(MANIFEST, { force: true });
    }
  });

  function plan(items: Array<{ collection: string; destinationTable?: string; classification: string }>) {
    return {
      collectionsToRun: items.map((item, i) => ({ item, batchIndex: i + 1 })),
      allBatchesCount: 1,
    } as any;
  }

  it("marks overallStatus FAILED and records a FAILED entry when a destination is missing", async () => {
    const manifest = await executePlan(
      plan([{ collection: "knowledge", classification: "MIGRATE" }]),
      parseArgs(["--dry-run"]),
    );

    expect(manifest.overallStatus).toBe("FAILED");
    expect(manifest.overallStatus).not.toBe("SUCCESS");
    expect(manifest.records["knowledge"]).toBeDefined();
    expect(manifest.records["knowledge"].status).toBe("FAILED");
    expect(manifest.records["knowledge"].failureReason).toMatch(/destination/i);
  });

  it("fails the run even when a healthy collection is migrated alongside the orphan", async () => {
    const { migrateSupabaseCollection } = require("../../lib/supabase/migration-runner");
    (migrateSupabaseCollection as jest.Mock).mockResolvedValue({
      sourceCount: 3,
      existingRecords: 0,
      inserts: 3,
      updates: 0,
      validationFailures: 0,
      writeFailures: 0,
      destinationRecords: 3,
      reconciliation: { ok: true, details: "3/3" },
    });

    const manifest = await executePlan(
      plan([
        { collection: "sevas", destinationTable: "sevas", classification: "MIGRATE" },
        { collection: "knowledge", classification: "MIGRATE" }, // orphan
      ]),
      parseArgs(["--dry-run"]),
    );

    // The healthy collection may succeed, but the run as a whole must not.
    expect(manifest.records["sevas"]?.status).toBe("SUCCESS");
    expect(manifest.records["knowledge"].status).toBe("FAILED");
    expect(manifest.overallStatus).not.toBe("SUCCESS");
    expect(["FAILED", "PARTIAL"]).toContain(manifest.overallStatus);
  });

  it("exits non-zero because the manifest is not SUCCESS", async () => {
    const manifest = await executePlan(
      plan([{ collection: "knowledge", classification: "MIGRATE" }]),
      parseArgs(["--dry-run"]),
    );
    // The CLI maps a non-SUCCESS overallStatus to process.exitCode = 1.
    const wouldExitNonZero = manifest.overallStatus !== "SUCCESS";
    expect(wouldExitNonZero).toBe(true);
  });
});
