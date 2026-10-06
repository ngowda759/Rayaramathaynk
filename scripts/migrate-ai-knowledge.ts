#!/usr/bin/env node

/**
 * Migration Script: AI Knowledge (Firestore -> Supabase)
 *
 * Collections: knowledge -> ai_knowledge
 *
 * Mapping and validation live in lib/supabase/migration-mappers.ts.
 *
 * Run with `--dry-run` to validate without writing.
 */

import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import {
  AI_FIELD_SPECS,
  mapAiKnowledge,
} from "../lib/supabase/migration-mappers";
import {
  migrateSupabaseCollection,
  reportMigrationOutcome,
  MigrationStats,
} from "../lib/supabase/migration-runner";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("==========================================");
    console.log(" DRY RUN MODE: No data will be written");
    console.log("==========================================");
  }

  const firestore = await getAdminFirestore();
  if (!firestore) {
    console.error("Firestore initialization failed");
    return;
  }
  const supabase = createAdminClient();

  const totalStats: Record<string, MigrationStats> = {};
  let globalSuccess = true;

  console.log("\n--- Migrating: Knowledge ---");
  const knowledgeStats = await migrateSupabaseCollection(
    firestore,
    supabase,
    "knowledge",
    "ai_knowledge",
    mapAiKnowledge,
    dryRun
  );
  totalStats["knowledge"] = knowledgeStats;
  if (!knowledgeStats.reconciliation.ok) globalSuccess = false;

  console.log("\n==========================================");
  console.log("          AI KNOWLEDGE MIGRATION SUMMARY        ");
  console.log("==========================================");

  let allReconciled = true;
  for (const [collection, stats] of Object.entries(totalStats)) {
    console.log(`\nCollection: ${collection}`);
    reportMigrationOutcome([stats]);
    if (!stats.reconciliation.ok) {
      allReconciled = false;
    }
  }

  console.log("\n==========================================");
  if (!globalSuccess || !allReconciled) {
    console.error("❌ Migration completed with reconciliation failures.");
    if (!dryRun) process.exit(1);
  } else {
    console.log("✅ All collections migrated and reconciled successfully.");
  }
}

main().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
