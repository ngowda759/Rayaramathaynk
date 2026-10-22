/**
 * @jest-environment node
 *
 * Pins the migration-inventory census so the number quoted in planning documents
 * cannot drift from the code. Audit text has twice mis-stated this count (14 and
 * 59) by counting source text with a regex instead of reading the array, which
 * misses the two spread-built `EXCLUDE_AUTH` entries.
 */
import {
  EXCLUDED_AUTH_COLLECTIONS,
  MIGRATION_INVENTORY,
} from "@/lib/supabase/migration-inventory";

describe("migration inventory census", () => {
  const byClassification = MIGRATION_INVENTORY.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.classification] = (acc[item.classification] ?? 0) + 1;
      return acc;
    },
    {},
  );

  it("contains 61 entries", () => {
    expect(MIGRATION_INVENTORY).toHaveLength(61);
  });

  it("matches the documented classification split", () => {
    expect(byClassification).toEqual({
      EXCLUDE_AUTH: 2,
      EXCLUDE_SYSTEM: 2,
      MIGRATE: 15,
      REVIEW: 42,
    });
  });

  it("includes the auth-excluded collections as real entries, not just a constant", () => {
    // Guards the exact mistake the audit made: the spread is inside the array.
    const authItems = MIGRATION_INVENTORY.filter(
      (i) => i.classification === "EXCLUDE_AUTH",
    ).map((i) => i.collection);
    expect(authItems.sort()).toEqual([...EXCLUDED_AUTH_COLLECTIONS].sort());
  });

  it("has unique collection names", () => {
    const names = MIGRATION_INVENTORY.map((i) => i.collection);
    expect(new Set(names).size).toBe(names.length);
  });

  it("documents the one MIGRATE entry that has no destination table", () => {
    // `knowledge` is classified MIGRATE but has no `destinationTable`, so
    // `scripts/migrate-all-batched.ts` logs "Skipping … (no destination table
    // mapped)" and `continue`s WITHOUT marking the run failed. A migration would
    // therefore report success while silently omitting AI knowledge. Fix by
    // mapping `knowledge` -> `ai_knowledge` (or reclassifying it), then update
    // this expectation. Tracked as backlog item B-5 / C-1.
    const migrateWithoutDestination = MIGRATION_INVENTORY.filter(
      (i) => i.classification === "MIGRATE" && !i.destinationTable,
    ).map((i) => i.collection);
    expect(migrateWithoutDestination).toEqual(["knowledge"]);

    const migratable = MIGRATION_INVENTORY.filter(
      (i) => i.classification === "MIGRATE" && i.destinationTable,
    );
    // This is the number the root-level reports quoted as "14 MIGRATE".
    expect(migratable).toHaveLength(14);
  });
});
