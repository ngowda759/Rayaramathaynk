#!/usr/bin/env node

/**
 * Migration Script: Core Collections (Firestore -> Supabase)
 *
 * Collections: sevas, dailyPoojas -> daily_poojas, events
 *
 * Mapping and validation live in lib/supabase/migration-mappers.ts so the exact
 * transforms are unit tested against fixtures. Nullable timestamps are left
 * unset rather than defaulted to `now()`; required event dates are validation
 * failures when absent.
 *
 * Run with `--dry-run` to validate without writing.
 */

import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import {
  CORE_FIELD_SPECS,
  mapSeva,
  mapDailyPooja,
  mapEvent,
} from "../lib/supabase/migration-mappers";
import {
  migrateSupabaseCollection,
  reportMigrationOutcome,
  MigrationStats,
} from "../lib/supabase/migration-runner";

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=== CORE MIGRATION (Firestore -> Supabase) ===");
  console.log(isDryRun ? "=== DRY-RUN MODE: no data will be written ===" : "=== LIVE MODE ===");

  const results: MigrationStats[] = [];
  const collections: [string, string, (id: string, data: any) => any][] = [
    ["sevas", "sevas", mapSeva],
    ["dailyPoojas", "daily_poojas", mapDailyPooja],
    ["events", "events", mapEvent],
  ];

  try {
    const db = await getAdminFirestore();
    const supabase = createAdminClient();

    for (const [collection, table, mapper] of collections) {
      results.push(
        await migrateSupabaseCollection(
          db,
          supabase,
          collection,
          table,
          mapper,
          isDryRun,
          CORE_FIELD_SPECS[collection]
        )
      );
    }

    reportMigrationOutcome(results);
  } catch (error: any) {
    console.error("\nMigration could not run:", error?.message || error);
    console.log(`\n=== OVERALL SUMMARY ===\nRESULT: BLOCKED\nReason: ${error?.message || error}`);
    process.exit(1);
  }
}

run();
