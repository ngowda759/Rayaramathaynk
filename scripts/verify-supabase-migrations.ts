#!/usr/bin/env node

/**
 * Read-only Supabase schema/migration verifier.
 *
 * Two clearly separated phases:
 *
 *   STATIC SCHEMA EXPECTATIONS
 *     Derived purely from supabase/migrations/*.sql - no credentials needed.
 *     Reports expected tables, columns, NOT NULL columns and RLS coverage.
 *
 *   LIVE DATABASE VERIFICATION
 *     Runs only when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
 *     present. Reports which expected tables exist, and the state of the
 *     Supabase migration ledger.
 *
 * This script NEVER creates, alters or drops anything.
 *
 * Exit codes:
 *   0 - checks passed
 *   1 - a check failed
 *   2 - static checks passed but live verification was skipped (no creds)
 */

import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildStaticSchemaReport,
  diffTableCoverage,
  isCanonicalMigration,
  migrationVersionFromFilename,
} from "@/lib/supabase/migration-coverage";

interface LiveVerification {
  attempted: boolean;
  existingTables: string[];
  missingTables: string[];
  extraTables: string[];
  ledger: {
    status: string;
    schema: string | null;
    pendingVersions: string[] | null;
    note: string;
  };
}

async function readMigrationFiles(): Promise<{ files: string[]; contents: string[] }> {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const contents = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"));
  return { files, contents };
}

function printStaticReport(report: ReturnType<typeof buildStaticSchemaReport>, files: string[], legacyFiles: string[] = []) {
  console.log("=== STATIC SCHEMA EXPECTATIONS (from migrations, no credentials needed) ===");
  console.log(`Migration files scanned:        ${files.length}`);
  if (legacyFiles.length > 0) {
    console.log(`Legacy/noncanonical migration files: ${legacyFiles.join(", ")}`);
  }
  console.log(`Tables declared:                ${report.tables.length}`);
  console.log(`Column declarations parsed:     ${report.columns.length}`);
  console.log(`Tables with RLS enabled:        ${report.rlsEnabledTables.length}`);

  if (report.tablesMissingRls.length > 0) {
    console.log(`Tables WITHOUT RLS:             ${report.tablesMissingRls.join(", ")}`);
  } else {
    console.log(`Tables WITHOUT RLS:             none`);
  }
}

/**
 * Look for a Supabase migration ledger. Supabase CLI normally records applied
 * migrations in `supabase_migrations.schema_migrations`. If the schema is not
 * exposed (common when it is not in the PostgREST schema list) the ledger is
 * reported as unavailable rather than assumed applied.
 */
async function checkMigrationLedger(supabase: any, files: string[]) {
  const candidates = [
    { schema: "supabase_migrations", table: "schema_migrations" },
    { schema: "public", table: "schema_migrations" },
  ];

  for (const candidate of candidates) {
    try {
      const { data, error } = await supabase
        .schema(candidate.schema)
        .from(candidate.table)
        .select("version");

      if (error) continue;

      const applied = (data || []).map((row: any) => String(row.version));
      const appliedSet = new Set(applied);
      const pending = files
        .filter(isCanonicalMigration)
        .map(migrationVersionFromFilename)
        .filter((v) => !appliedSet.has(v))
        .sort();

      return {
        status: "available",
        schema: candidate.schema,
        pendingVersions: pending,
        note:
          pending.length === 0
            ? "All migration files are recorded as applied."
            : `${pending.length} migration file(s) have no ledger entry.`,
      };
    } catch {
      // try next candidate
    }
  }

  return {
    status: "unavailable",
    schema: null,
    pendingVersions: null,
    note:
      "Migration ledger not readable. Table existence is NOT proof that every " +
      "migration was applied; apply migrations via the Supabase CLI so the ledger " +
      "records them.",
  };
}

async function liveVerify(expectedTables: string[], files: string[]): Promise<LiveVerification> {
  const supabase = createAdminClient();

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
      const openapi = (await response.json()) as { paths?: Record<string, unknown> };
      existingTables = Object.keys(openapi.paths || {})
        .filter((p) => p !== "/")
        .map((p) => p.replace(/^\//, ""))
        .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
    }
  } catch {
    // fall through to individual probes
  }

  if (existingTables.length === 0) {
    for (const table of expectedTables) {
      const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (!error) existingTables.push(table);
    }
  }

  const { missing, extra } = diffTableCoverage(expectedTables, existingTables);
  const ledger = await checkMigrationLedger(supabase, files);

  return {
    attempted: true,
    existingTables: existingTables.sort(),
    missingTables: missing,
    extraTables: extra,
    ledger,
  };
}

async function run() {
  const asJson = process.argv.includes("--json");
  const staticOnly = process.argv.includes("--static");

  const { files, contents } = await readMigrationFiles();
  const canonicalFiles = files.filter(isCanonicalMigration);
  const legacyFiles = files.filter(f => !isCanonicalMigration(f));
  const staticReport = buildStaticSchemaReport(contents);

  const hasLiveCredentials = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let live: LiveVerification | null = null;
  let liveError: string | null = null;

  if (!staticOnly && hasLiveCredentials) {
    try {
      live = await liveVerify(staticReport.tables, files);
    } catch (error: any) {
      liveError = error?.message || String(error);
    }
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          static: {
            migrationFiles: files,
            canonicalFiles,
            legacyFiles,
            tables: staticReport.tables,
            rlsEnabledTables: staticReport.rlsEnabledTables,
            tablesMissingRls: staticReport.tablesMissingRls,
            columns: staticReport.columns,
          },
          live: live,
          liveSkipped: !live,
          liveError,
          liveSkippedReason: !hasLiveCredentials
            ? "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set"
            : null,
        },
        null,
        2
      )
    );
  } else {
    printStaticReport(staticReport, files, legacyFiles);

    console.log("\n=== LIVE DATABASE VERIFICATION ===");
    if (staticOnly) {
      console.log("SKIPPED (--static).");
    } else if (!hasLiveCredentials) {
      console.log("SKIPPED: no Supabase credentials in this environment.");
      console.log("Static expectations above are authoritative and require no credentials.");
    } else if (!live) {
      console.log(`FAILED to contact the database: ${liveError}`);
    } else {
      console.log(`Tables present in database:     ${live.existingTables.length}`);
      console.log(
        `Missing tables:                 ${live.missingTables.length === 0 ? "none" : live.missingTables.join(", ")}`
      );
      console.log(
        `Unexpected extra tables:        ${live.extraTables.length === 0 ? "none" : live.extraTables.join(", ")}`
      );
      console.log(`Migration ledger status:        ${live.ledger.status}`);
      if (live.ledger.schema) console.log(`Migration ledger schema:        ${live.ledger.schema}`);
      if (live.ledger.pendingVersions) {
        console.log(
          `Migrations not in ledger:       ${
            live.ledger.pendingVersions.length === 0
              ? "none"
              : live.ledger.pendingVersions.join(", ")
          }`
        );
      }
      console.log(`Ledger note: ${live.ledger.note}`);
    }

    console.log("\n=== RESULT ===");
    if (!live) {
      console.log("STATIC CHECKS PASSED (live verification not performed)");
    } else if (live.missingTables.length > 0) {
      console.log("NOT FULLY MIGRATED: expected tables are missing.");
    } else if (live.ledger.status === "available" && (live.ledger.pendingVersions || []).length > 0) {
      console.log(
        "TABLES PRESENT BUT MIGRATION LEDGER INCOMPLETE: do not treat this as 'all migrations applied'."
      );
    } else {
      console.log("LIVE VERIFICATION PASSED");
    }
  }

  if (live && live.missingTables.length > 0) process.exit(1);
  if (live && live.ledger.status === "available" && (live.ledger.pendingVersions || []).length > 0) {
    process.exit(1);
  }
  if (!live) process.exit(2);
}

run().catch((error) => {
  console.error("Migration coverage check failed:", error?.message || error);
  process.exit(1);
});
