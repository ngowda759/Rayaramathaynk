#!/usr/bin/env node

/**
 * Migration Script: AI Collections (Firestore -> Supabase)
 *
 * Collections: chat_sessions, messages -> chat_messages, unknown_questions,
 *              ai_intent_distribution, ai_latency_records
 *
 * Mapping and validation live in lib/supabase/migration-mappers.ts so the exact
 * transforms are unit tested against fixtures. Historical event timestamps and
 * latency measurements are required rather than defaulted, so analytics cannot
 * be silently corrupted.
 *
 * Run with `--dry-run` to validate without writing.
 */

import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import {
  AI_FIELD_SPECS,
  mapChatSession,
  mapChatMessage,
  mapUnknownQuestion,
  mapIntentDistribution,
  mapLatencyRecord,
} from "../lib/supabase/migration-mappers";
import {
  migrateSupabaseCollection,
  reportMigrationOutcome,
  MigrationStats,
} from "../lib/supabase/migration-runner";

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=== AI MIGRATION (Firestore -> Supabase) ===");
  console.log(isDryRun ? "=== DRY-RUN MODE: no data will be written ===" : "=== LIVE MODE ===");

  const results: MigrationStats[] = [];
  const collections: [string, string, (id: string, data: any) => any][] = [
    ["chat_sessions", "chat_sessions", mapChatSession],
    ["messages", "chat_messages", mapChatMessage],
    ["unknown_questions", "unknown_questions", mapUnknownQuestion],
    ["ai_intent_distribution", "ai_intent_distribution", mapIntentDistribution],
    ["ai_latency_records", "ai_latency_records", mapLatencyRecord],
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
          AI_FIELD_SPECS[collection]
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
