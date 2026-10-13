import { migrateSupabaseCollection, reportMigrationOutcome } from "../lib/supabase/migration-runner";
import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import { AI_MAPPERS, AI_FIELD_SPECS } from "../lib/supabase/migration-mappers";

/**
 * Migration script for AI Analytics.
 * Covers:
 * - ai_latency_records
 * - ai_intent_distribution
 * - ai_unknown_questions -> unknown_questions
 */
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`=== Starting AI Analytics Migration to Supabase${isDryRun ? " (DRY RUN)" : ""} ===`);

  const adminDb = await getAdminFirestore();
  const supabaseAdmin = createAdminClient();

  // 1. ai_latency_records
  const latencyStats = await migrateSupabaseCollection(
    adminDb,
    supabaseAdmin,
    "ai_latency_records",
    "ai_latency_records",
    AI_MAPPERS.ai_latency_records,
    isDryRun,
    AI_FIELD_SPECS.ai_latency_records
  );

  // 2. ai_intent_distribution
  const intentStats = await migrateSupabaseCollection(
    adminDb,
    supabaseAdmin,
    "ai_intent_distribution",
    "ai_intent_distribution",
    AI_MAPPERS.ai_intent_distribution,
    isDryRun,
    AI_FIELD_SPECS.ai_intent_distribution
  );

  // 3. unknown_questions
  // Based on audit, historical records may exist in both 'unknown_questions' and 'ai_unknown_questions'.
  // We migrate both into the canonical 'unknown_questions' table.
  const unknownQuestionsStats1 = await migrateSupabaseCollection(
    adminDb,
    supabaseAdmin,
    "unknown_questions",
    "unknown_questions",
    AI_MAPPERS.unknown_questions,
    isDryRun,
    AI_FIELD_SPECS.unknown_questions
  );

  const unknownQuestionsStats2 = await migrateSupabaseCollection(
    adminDb,
    supabaseAdmin,
    "ai_unknown_questions",
    "unknown_questions",
    AI_MAPPERS.unknown_questions,
    isDryRun,
    AI_FIELD_SPECS.unknown_questions
  );

  reportMigrationOutcome([latencyStats, intentStats, unknownQuestionsStats1, unknownQuestionsStats2]);

  console.log("\\n=== AI Analytics Migration Complete ===");
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
  });
}
