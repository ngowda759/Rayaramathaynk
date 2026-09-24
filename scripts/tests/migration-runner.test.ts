import { parseArgs, buildExecutionPlan } from "../migrate-all-batched";

describe("Migrate All Batched Orchestration", () => {
  it("determines deterministic batch creation and size", () => {
    let args = parseArgs(["--batch", "1", "--batch-size", "10"]);
    let plan = buildExecutionPlan(args, null);

    expect(plan.collectionsToRun.length).toBeLessThanOrEqual(10);
    plan.collectionsToRun.forEach(c => expect(c.batchIndex).toBe(1));

    args = parseArgs(["--batch", "2", "--batch-size", "5"]);
    plan = buildExecutionPlan(args, null);
    expect(plan.collectionsToRun.length).toBeLessThanOrEqual(5);
    plan.collectionsToRun.forEach(c => expect(c.batchIndex).toBe(2));
  });

  it("handles explicit collection selection", () => {
    const args = parseArgs(["--collections", "sevas,events"]);
    const plan = buildExecutionPlan(args, null);

    expect(plan.collectionsToRun.length).toBe(2);
    expect(plan.collectionsToRun.find(c => c.item.collection === "sevas")).toBeDefined();
    expect(plan.collectionsToRun.find(c => c.item.collection === "events")).toBeDefined();
  });

  it("handles authentication exclusion", () => {
    const args = parseArgs(["--collections", "users"]);
    expect(() => buildExecutionPlan(args, null)).toThrow(/authentication collection/);
  });

  it("handles system exclusion", () => {
    const args = parseArgs(["--collections", "system"]);
    expect(() => buildExecutionPlan(args, null)).toThrow(/system collection/);
  });

  it("rejects REVIEW collections", () => {
    const args = parseArgs(["--collections", "profiles"]);
    expect(() => buildExecutionPlan(args, null)).toThrow(/marked for REVIEW/);
  });

  it("empty arguments return an empty plan to abort migration execution", () => {
    const args = parseArgs([]);
    const plan = buildExecutionPlan(args, null);
    expect(plan.collectionsToRun.length).toBe(0);
  });

  it("retries failed collections only", () => {
    const mockManifest = {
      runId: "123",
      overallStatus: "PARTIAL" as any,
      inventoryVersion: "1",
      excludedCollections: [],
      reviewedCollections: [],
      records: {
        "sevas": {
          collection: "sevas",
          destination: "sevas",
          batch: 1,
          status: "SUCCESS" as any,
          sourceCount: 1,
          destinationCount: 1,
          migratedCount: 1,
          skippedCount: 0,
          failedCount: 0,
          startedAt: "time",
          completedAt: "time",
          verificationStatus: "PASS" as any
        },
        "events": {
          collection: "events",
          destination: "events",
          batch: 1,
          status: "FAILED" as any,
          sourceCount: 1,
          destinationCount: null,
          migratedCount: 0,
          skippedCount: 0,
          failedCount: 1,
          startedAt: "time",
          completedAt: "time",
          verificationStatus: "FAIL" as any,
          failureReason: "Testing"
        }
      }
    };

    const args = parseArgs(["--batch", "1", "--retry-failed"]);
    const plan = buildExecutionPlan(args, mockManifest);

    expect(plan.collectionsToRun.find(c => c.item.collection === "sevas")).toBeUndefined();
    expect(plan.collectionsToRun.find(c => c.item.collection === "events")).toBeDefined();
  });
});
