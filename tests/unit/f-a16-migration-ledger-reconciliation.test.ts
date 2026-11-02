/**
 * @jest-environment node
 *
 * F-A16-06 — migration-ledger reconciliation guard.
 *
 * The audit snapshot reported 41 migration-ledger entries, some with version
 * identifiers dated later than the audit date (2026-11-01). This suite reproduces the
 * reconciliation from the repository alone, so the claims in
 * `docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md` cannot drift from the files:
 *
 *   - the exact file count and the canonical-version count;
 *   - the one file whose version prefix is not 14 digits (`20240915_…`);
 *   - the duplicate *names* (`create_temple_areas`, `seed_ai_settings`) that are NOT
 *     duplicate versions;
 *   - the set of versions later than the audit date;
 *   - that `migrationVersionFromFilename` ignores the 8-digit legacy file.
 *
 * Nothing here touches a database or a migration ledger.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { migrationVersionFromFilename } from "@/lib/supabase/migration-coverage";

const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
/** The audit snapshot date, as YYYYMMDD (docs/audits/F-A16_PRODUCTION_CATALOG_RESULTS.md). */
const AUDIT_DATE = "20261101";
/** First canonical version strictly later than the audit date (i.e. 2026-11-02 00:00). */
const FIRST_VERSION_AFTER_AUDIT = "20261102000000";

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const versions = files.map(migrationVersionFromFilename);

describe("F-A16-06 migration ledger reconciliation", () => {
  it("counts exactly the files present (41 at the audit base commit 3048196)", () => {
    // Pinned so a new migration forces a conscious update of the reconciliation doc.
    // Two F-A16 remediation migrations were added on top of the audit base; the
    // reconciliation document records both numbers.
    const baseline = 41;
    const proposed = files.filter((f) => /_f_a16_/.test(f)).length;
    expect(proposed).toBe(2);
    expect(files.length).toBe(baseline + proposed);
  });

  it("has exactly one file with a non-14-digit version prefix", () => {
    const nonCanonical = files.filter((f) => migrationVersionFromFilename(f) === null);
    expect(nonCanonical).toEqual(["20240915_create_temple_areas.sql"]);
  });

  it("has no duplicate version prefixes (every canonical file is uniquely ordered)", () => {
    const canonical = versions.filter((v): v is string => v !== null);
    const seen = new Set<string>();
    const dupes = canonical.filter((v) => (seen.has(v) ? true : (seen.add(v), false)));
    expect(dupes).toEqual([]);
  });

  it("has two duplicate migration *names* that are distinct versions, not collisions", () => {
    const names = files.map((f) => f.replace(/^\d+_/, "").replace(/\.sql$/, ""));
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))].sort();
    expect(dupes).toEqual(["create_temple_areas", "seed_ai_settings"]);

    // create_temple_areas: 20240523000000 (uuid id) then 20240915 (text id).
    expect(files).toContain("20240523000000_create_temple_areas.sql");
    expect(files).toContain("20240915_create_temple_areas.sql");
    // seed_ai_settings: the marker (no DDL) and the real seed.
    expect(files).toContain("20261006101759_seed_ai_settings.sql");
    expect(files).toContain("20261012000001_seed_ai_settings.sql");
  });

  it("lists the versions dated later than the audit date", () => {
    const future = files.filter((f) => {
      const v = migrationVersionFromFilename(f);
      return v !== null && v >= FIRST_VERSION_AFTER_AUDIT;
    });
    // 14 at the audit base, plus the two F-A16 remediation migrations this PR adds.
    const proposed = future.filter((f) => /_f_a16_/.test(f));
    expect(proposed).toEqual([
      "20261115000000_f_a16_least_privilege_defaults.sql",
      "20261115000100_f_a16_fail_closed_rls_assertion.sql",
    ]);
    expect(future.length - proposed.length).toBe(14);
    expect(future).toContain("20261114000100_donations_updated_at.sql");
    // Same-day as the audit, not later.
    expect(future).not.toContain("20261101000000_seva_paper_size_not_null.sql");
  });

  it("the 8-digit legacy file is not treated as a pending canonical migration", () => {
    // `supabase db push` keys on the 14-digit version; the legacy file is not a
    // canonical version, which is why the reconciliation treats it separately.
    expect(migrationVersionFromFilename("20240915_create_temple_areas.sql")).toBeNull();
    expect(migrationVersionFromFilename("20240523000000_create_temple_areas.sql")).toBe(
      "20240523000000"
    );
  });

  it("the reconciliation document exists and is not a stub", () => {
    const doc = readFileSync(
      path.join(ROOT, "docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md"),
      "utf8"
    );
    expect(doc.length).toBeGreaterThan(1500);
    expect(doc).toMatch(/NOT APPLIED TO PRODUCTION/i);
  });
});
