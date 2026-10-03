import {
  toIsoString,
  requireTimestamp,
  reconcileCounts,
  auditFieldCoverage,
  ValidationError,
} from "@/lib/supabase/migration-helpers";
import { migrationVersionFromFilename, diffMigrationLedger } from "@/lib/supabase/migration-coverage";

/**
 * Fixture helpers modelling the Firestore wire shapes the migrators consume.
 */
const firestoreTimestamp = (seconds: number) => ({
  _seconds: seconds,
  _nanoseconds: 0,
});

const withToDate = (iso: string) => ({
  toDate: () => new Date(iso),
});

describe("timestamp preservation (C)", () => {
  it("converts a Firestore Timestamp with toDate()", () => {
    expect(toIsoString(withToDate("2024-03-15T10:30:00.000Z"))).toBe(
      "2024-03-15T10:30:00.000Z"
    );
  });

  it("converts a raw {_seconds, _nanoseconds} object", () => {
    expect(toIsoString(firestoreTimestamp(1710500000))).toBe(
      new Date(1710500000 * 1000).toISOString()
    );
  });

  it("converts ISO strings and numeric epochs", () => {
    expect(toIsoString("2024-01-02T00:00:00.000Z")).toBe("2024-01-02T00:00:00.000Z");
    expect(typeof toIsoString(1710500000000)).toBe("string");
  });

  it("preserves the exact source instant rather than substituting the current time", () => {
    const original = new Date("2019-07-04T12:00:00.000Z");
    const result = toIsoString(withToDate("2019-07-04T12:00:00.000Z"));
    expect(result).toBe(original.toISOString());
    expect(new Date(result!).getTime()).toBe(original.getTime());
  });
});

describe("missing timestamp behaviour (D)", () => {
  it("returns null for absent timestamps instead of inventing one", () => {
    expect(toIsoString(undefined)).toBeNull();
    expect(toIsoString(null)).toBeNull();
  });

  it("returns null for unparseable values", () => {
    expect(toIsoString("not-a-date")).toBeNull();
    expect(toIsoString({ unexpected: true })).toBeNull();
  });

  it("requireTimestamp throws rather than defaulting a required column", () => {
    expect(() => requireTimestamp(undefined, "timestamp", "doc-1")).toThrow(
      /Missing or invalid required timestamp/
    );
    expect(() => requireTimestamp("bogus", "timestamp", "doc-1")).toThrow(ValidationError);
  });

  it("requireTimestamp returns the preserved instant when present", () => {
    expect(requireTimestamp(withToDate("2021-05-05T05:05:05.000Z"), "timestamp", "d")).toBe(
      "2021-05-05T05:05:05.000Z"
    );
  });
});

describe("reconciliation calculations (H)", () => {
  it("passes when source equals inserts + updates + failures", () => {
    const result = reconcileCounts({
      sourceCount: 10,
      inserts: 6,
      updates: 2,
      validationFailures: 1,
      writeFailures: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toBe(0);
    expect(result.accountedFor).toBe(10);
  });

  it("detects silently dropped documents", () => {
    const result = reconcileCounts({
      sourceCount: 10,
      inserts: 4,
      updates: 0,
      validationFailures: 0,
      writeFailures: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toBe(6);
  });

  it("detects over-accounting", () => {
    const result = reconcileCounts({
      sourceCount: 2,
      inserts: 5,
      updates: 0,
      validationFailures: 0,
      writeFailures: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toBe(-3);
  });

  it("handles the empty-collection case", () => {
    const result = reconcileCounts({
      sourceCount: 0,
      inserts: 0,
      updates: 0,
      validationFailures: 0,
      writeFailures: 0,
    });
    expect(result.ok).toBe(true);
  });
});

describe("field coverage / no silent field loss (K)", () => {
  it("flags a source field with no declared disposition", () => {
    const observed = new Set(["title", "description", "mysteryField"]);
    const result = auditFieldCoverage("sevas", observed, {
      mapped: ["title", "description"],
    });
    expect(result.unmapped).toEqual(["mysteryField"]);
  });

  it("passes when every observed field is accounted for", () => {
    const observed = new Set(["title", "createdAt", "legacy"]);
    const result = auditFieldCoverage("sevas", observed, {
      mapped: ["title"],
      transformed: ["createdAt"],
      intentionallyExcluded: [{ field: "legacy", why: "Superseded by title." }],
    });
    expect(result.unmapped).toEqual([]);
  });

  it("reports declared fields absent from the source without failing", () => {
    const observed = new Set(["title"]);
    const result = auditFieldCoverage("sevas", observed, {
      mapped: ["title", "description"],
    });
    expect(result.unmapped).toEqual([]);
    expect(result.absentFromSource).toEqual(["description"]);
  });
});

describe("migration ledger (I)", () => {
  it("extracts the version prefix from a migration filename", () => {
    expect(migrationVersionFromFilename("20260922000000_create_settings_documents.sql")).toBe(
      "20260922000000"
    );
  });

  it("reports pending migrations missing from the ledger", () => {
    const pending = diffMigrationLedger(
      ["20260907112632_a.sql", "20260922000000_b.sql"],
      ["20260907112632"]
    );
    expect(pending).toEqual(["20260922000000"]);
  });

  it("returns null when the ledger is unreadable, so no false success is claimed", () => {
    expect(diffMigrationLedger(["20260922000000_a.sql"], null)).toBeNull();
  });

  it("reports nothing pending when every file is recorded", () => {
    expect(diffMigrationLedger(["20260907112632_a.sql"], ["20260907112632"])).toEqual([]);
  });
});
