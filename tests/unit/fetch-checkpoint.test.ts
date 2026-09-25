import { validateMigrationCheckpoint, ExpectedMetadata, Manifest } from "../../scripts/migrate-all-batched";

describe("fetch-checkpoint logic", () => {
  const expected: ExpectedMetadata = {
    migrationType: "production",
    inventoryVersion: "1.0",
    batchSize: 10,
    checkpointVersion: "1.0"
  };

  const validManifest: Manifest = {
    runId: "123",
    overallStatus: "RUNNING",
    inventoryVersion: "1.0",
    migrationType: "production",
    batchSize: 10,
    checkpointVersion: "1.0",
    excludedCollections: [],
    reviewedCollections: [],
    records: {
      "sevas": {
        collection: "sevas",
        destination: "sevas",
        batch: 1,
        status: "SUCCESS",
        sourceCount: 1,
        destinationCount: 1,
        migratedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        startedAt: "",
        completedAt: "",
        verificationStatus: "PASS"
      }
    }
  };

  it("should accept a fully valid production checkpoint", () => {
    expect(validateMigrationCheckpoint(validManifest, expected)).toBe(true);
  });

  it("should reject a newer run if it is a dry-run checkpoint for a live migration", () => {
    const dryRunManifest = { ...validManifest, migrationType: "dry-run" };
    expect(validateMigrationCheckpoint(dryRunManifest, expected)).toBe(false);
  });

  it("should reject an older run if the batch size does not match", () => {
    const wrongBatchManifest = { ...validManifest, batchSize: 5 };
    expect(validateMigrationCheckpoint(wrongBatchManifest, expected)).toBe(false);
  });
});
