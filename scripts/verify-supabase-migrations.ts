import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDeclaredTables, diffTableCoverage } from "@/lib/supabase/migration-coverage";

/**
 * Read-only validator: reports which tables declared by supabase/migrations
 * actually exist in the target Supabase database.
 *
 * It never writes, alters or drops anything - a missing table is reported, not
 * created. Run with --json for machine-readable output.
 */
async function run() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const contents = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"));
  const expectedTables = extractDeclaredTables(contents);

  const supabase = createAdminClient();

  // Query the live schema through PostgREST's OpenAPI spec (read-only).
  let existingTables: string[] = [];
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
    const response = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`,
        Accept: "application/openapi+json",
      },
    });
    if (response.ok) {
      const openapi = (await response.json()) as {
        paths?: Record<string, unknown>;
      };
      existingTables = Object.keys(openapi.paths || {})
        .filter((p) => p !== "/")
        .map((p) => p.replace(/^\//, ""))
        .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
    }
  } catch {
    // handled below
  }

  if (existingTables.length === 0) {
    existingTables = await probeTablesIndividually(supabase, expectedTables);
  }

  const { missing, extra } = diffTableCoverage(expectedTables, existingTables);

  const report = {
    migrationsScanned: files.length,
    migrationFiles: files,
    expectedTables,
    existingTables: existingTables.sort(),
    missingTables: missing,
    extraTables: extra,
    allApplied: missing.length === 0,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== SUPABASE MIGRATION COVERAGE (READ-ONLY) ===");
    console.log(`Migration files scanned: ${report.migrationsScanned}`);
    console.log(`Tables declared in migrations: ${expectedTables.length}`);
    console.log(`Tables present in database:   ${report.existingTables.length}`);
    console.log(`\nMissing tables: ${missing.length === 0 ? "none" : missing.join(", ")}`);
    console.log(`Unexpected extra tables: ${extra.length === 0 ? "none" : extra.join(", ")}`);
    console.log(`\nRESULT: ${report.allApplied ? "ALL DECLARED TABLES PRESENT" : "NOT FULLY MIGRATED"}`);
  }

  if (missing.length > 0) process.exit(1);
}

async function probeTablesIndividually(supabase: any, tables: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (!error) found.push(table);
  }
  return found;
}

run().catch((error) => {
  console.error("Migration coverage check failed:", error?.message || error);
  process.exit(1);
});
