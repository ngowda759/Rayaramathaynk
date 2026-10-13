import { migrateSupabaseCollection, reportMigrationOutcome } from "../lib/supabase/migration-runner";
import { getAdminFirestore } from "../lib/admin-firebase";
import { AI_MAPPERS } from "../lib/supabase/migration-mappers";

/**
 * Migration script for AI Analytics.
 * Covers:
 * - ai_latency_records
 * - ai_intent_distribution
 * - ai_unknown_questions -> unknown_questions
 */
async function main() {
  console.log("=== Starting AI Analytics Migration to Supabase ===");

  const adminDb = await getAdminFirestore();

  const latencyStats = await migrateSupabaseCollection(
    "ai_latency_records",
    "ai_latency_records",
    adminDb,
    AI_MAPPERS.ai_latency_records,
    { batchSize: 500, continueOnError: false }
  );

  const intentStats = await migrateSupabaseCollection(
    "ai_intent_distribution",
    "ai_intent_distribution",
    adminDb,
    AI_MAPPERS.ai_intent_distribution,
    { batchSize: 500, continueOnError: false }
  );

  const unknownQuestionsStats = await migrateSupabaseCollection(
    "unknown_questions",
    "unknown_questions",
    adminDb,
    AI_MAPPERS.unknown_questions,
    { batchSize: 500, continueOnError: false }
  );

  reportMigrationOutcome([latencyStats, intentStats, unknownQuestionsStats]);

  console.log("\\n=== AI Analytics Migration Complete ===");
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
  });
}
