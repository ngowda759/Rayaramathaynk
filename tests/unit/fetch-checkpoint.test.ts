import { validateMigrationCheckpoint, ExpectedMetadata, Manifest } from "../../scripts/migrate-all-batched";
import * as fs from "fs";
import * as path from "path";
import * as fetchScript from "../../scripts/fetch-checkpoint";

// Mock the dependencies
jest.mock("fs", () => {
  const original = jest.requireActual("fs");
  return {
    ...original,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    copyFileSync: jest.fn(),
    rmSync: jest.fn()
  };
});
jest.mock("child_process", () => ({
  execSync: jest.fn()
}));

const mockManifest: Manifest = {
  runId: "123",
  overallStatus: "RUNNING",
  inventoryVersion: "1.0",
  migrationType: "production",
  batchSize: 10,
  checkpointVersion: "1.0",
  excludedCollections: [],
  reviewedCollections: [],
  records: {}
};

describe("validateMigrationCheckpoint logic", () => {
  const expected: ExpectedMetadata = {
    migrationType: "production",
    inventoryVersion: "1.0",
    batchSize: 10,
    checkpointVersion: "1.0"
  };

  it("should accept a fully valid production checkpoint", () => {
    expect(validateMigrationCheckpoint(mockManifest, expected)).toBe(true);
  });

  it("should reject a newer run if it is a dry-run checkpoint for a live migration", () => {
    const dryRunManifest = { ...mockManifest, migrationType: "dry-run" };
    expect(validateMigrationCheckpoint(dryRunManifest as any, expected)).toBe(false);
  });

  it("should reject an older run if the batch size does not match", () => {
    const wrongBatchManifest = { ...mockManifest, batchSize: 5 };
    expect(validateMigrationCheckpoint(wrongBatchManifest, expected)).toBe(false);
  });
});

describe("fetchLatestValidCheckpoint deterministic selection", () => {
  let existsSyncSpy: jest.SpyInstance;
  let readFileSyncSpy: jest.SpyInstance;
  let execSyncMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    readFileSyncSpy = jest.spyOn(fs, "readFileSync");

    execSyncMock = require("child_process").execSync;
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("Test A: Newer candidate invalid, older candidate valid -> selects older", () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.includes("run list")) {
        return JSON.stringify([
          { databaseId: 200, headBranch: "main", createdAt: "2025-02-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }, // Newer
          { databaseId: 100, headBranch: "main", createdAt: "2025-01-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }  // Older
        ]);
      }
      if (command.includes("artifacts")) return JSON.stringify({ artifacts: [{ name: "migration-manifest" }] });
      return "";
    });

    // Mock file reads sequentially
    readFileSyncSpy.mockImplementationOnce(() => JSON.stringify({ ...mockManifest, runId: "200", batchSize: 999 })) // Invalid metadata
                   .mockImplementationOnce(() => JSON.stringify({ ...mockManifest, runId: "100" })); // Valid

    const result = fetchScript.fetchLatestValidCheckpoint(false, 10);
    expect(result?.runId).toBe(100);
  });

  it("Test B: Newer candidate dry-run, older candidate production -> selects older production", () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.includes("run list")) {
        return JSON.stringify([
          { databaseId: 200, headBranch: "main", createdAt: "2025-02-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }, // Newer
          { databaseId: 100, headBranch: "main", createdAt: "2025-01-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }  // Older
        ]);
      }
      if (command.includes("artifacts")) return JSON.stringify({ artifacts: [{ name: "migration-manifest" }] });
      return "";
    });

    readFileSyncSpy.mockImplementationOnce(() => JSON.stringify({ ...mockManifest, runId: "200", migrationType: "dry-run" })) // dry-run
                   .mockImplementationOnce(() => JSON.stringify({ ...mockManifest, runId: "100" })); // production

    const result = fetchScript.fetchLatestValidCheckpoint(false, 10);
    expect(result?.runId).toBe(100);
  });

  it("Test C: Two valid production candidates -> selects newest valid", () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.includes("run list")) {
        // GH returns them unordered to simulate testing deterministic sorting
        return JSON.stringify([
          { databaseId: 100, headBranch: "main", createdAt: "2025-01-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }, // Older
          { databaseId: 200, headBranch: "main", createdAt: "2025-02-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }  // Newer
        ]);
      }
      if (command.includes("artifacts")) return JSON.stringify({ artifacts: [{ name: "migration-manifest" }] });
      return "";
    });

    // Because fetchLatestValidCheckpoint sorts them deterministically by createdAt DESC, ID 200 will be checked FIRST.
    readFileSyncSpy.mockImplementationOnce(() => JSON.stringify({ ...mockManifest, runId: "200" }));

    const result = fetchScript.fetchLatestValidCheckpoint(false, 10);
    expect(result?.runId).toBe(200);
    // readFileSync is only called once because the first one is valid
    expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
  });

  it("Test D: Artifact belongs to expected workflow but manifest.runId conflicts -> rejected", () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.includes("run list")) {
        return JSON.stringify([
          { databaseId: 200, headBranch: "main", createdAt: "2025-02-01T10:00:00Z", name: "Batched Firestore to Supabase Migration" }
        ]);
      }
      if (command.includes("artifacts")) return JSON.stringify({ artifacts: [{ name: "migration-manifest" }] });
      return "";
    });

    // Return a manifest where runId claims to be "999" but artifact is from run "200"
    readFileSyncSpy.mockImplementationOnce(() => JSON.stringify({ ...mockManifest, runId: "999" }));

    const result = fetchScript.fetchLatestValidCheckpoint(false, 10);
    expect(result).toBeNull();
  });

  it("Test E: Wrong workflow identity -> rejected", () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.includes("run list")) {
        return JSON.stringify([
          { databaseId: 200, headBranch: "main", createdAt: "2025-02-01T10:00:00Z", name: "Some Other Unrelated Action" }
        ]);
      }
      if (command.includes("artifacts")) return JSON.stringify({ artifacts: [{ name: "migration-manifest" }] });
      return "";
    });

    const result = fetchScript.fetchLatestValidCheckpoint(false, 10);
    expect(result).toBeNull();
    // readFileSync shouldn't even be called because workflow name failed
    expect(readFileSyncSpy).toHaveBeenCalledTimes(0);
  });

  it("Test F: Missing checkpoint -> start fresh", () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.includes("run list")) return JSON.stringify([]);
      return "";
    });

    const result = fetchScript.fetchLatestValidCheckpoint(false, 10);
    expect(result).toBeNull();
  });
});
