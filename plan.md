# Plan: BOT-004 — AI Analytics Migration

1. **Audit & Preparation**
   - Create `docs/BOT_004_ANALYTICS_AUDIT.md`. Use `cat docs/BOT_004_ANALYTICS_AUDIT.md` to verify creation.
   - Create `docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md` template. Use `cat docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md` to verify creation.

2. **Supabase Schema Review & Verification**
   - RLS is already verified as enabled for `unknown_questions`, `ai_intent_distribution`, and `ai_latency_records` via `supabase/migrations/20260930000000_create_ai_tables.sql`. No action required.

3. **Repository/Service Cutover (Writes)**
   - Update `recordUnknownQuestion` in `services/ai-analytics.service.ts` to write to Supabase `unknown_questions` instead of Firestore. Verify edits using `cat services/ai-analytics.service.ts | grep -A 20 recordUnknownQuestion`.
   - Update `logUnknownQuestion` in `lib/ai/unknown-logger.ts` to write to Supabase `unknown_questions` instead of Firestore. Verify edits using `cat lib/ai/unknown-logger.ts | grep -A 20 logUnknownQuestion`.

4. **Repository/Service Cutover (Reads)**
   - Update `getLatencyMetrics` in `services/ai-analytics.service.ts` to read from Supabase `ai_latency_records` instead of Firestore.
   - Update `getIntentDistribution` in `services/ai-analytics.service.ts` to read from Supabase `ai_intent_distribution` instead of Firestore.
   - Update `getUnknownQuestions` in `services/ai-analytics.service.ts` to read from Supabase `unknown_questions` instead of Firestore.
   - Update `getRecentUnknownQuestions` and `getUnknownQuestionStats` in `lib/ai/unknown-logger.ts` to read from Supabase `unknown_questions`.
   - Update `getRecentUnknownQuestions` and `getUnknownQuestionStats` in `services/analytics.service.ts` to redirect to `services/ai-analytics.service.ts`.
   - Update `markUnknownQuestionReviewed` in `services/ai-analytics.service.ts` to update Supabase.
   - Verify edits by using `cat` on the modified files to ensure Firestore calls (`COLLECTIONS.LATENCY_RECORDS`, `COLLECTIONS.INTENT_DISTRIBUTION`, `COLLECTIONS.UNKNOWN_QUESTIONS`) are completely removed from the query logic.

5. **Migration Script**
   - Create `scripts/migrate-ai-analytics.ts` dedicated runner to handle the specific mapping and run using `npx tsx scripts/migrate-ai-analytics.ts`.
   - The script will import mappers from `lib/supabase/migration-mappers.ts` and will ensure stable IDs, idempotency, mapping failures, and reconciliation counts are met.

6. **Zod Validation**
   - Create Zod schemas for the analytics records in `lib/ai/analytics/validation.ts` since none exist in `types/ai-analytics.ts` or anywhere else according to grep.
   - The file will contain: `LatencyRecordSchema`, `IntentDistributionRecordSchema`, `UnknownQuestionRecordSchema`, etc.
   - Verify creation using `cat lib/ai/analytics/validation.ts`.

7. **Testing**
   - Modify `tests/unit/ai-analytics.test.ts` (if exists) or create it to test that `recordUnknownQuestion`, `getLatencyMetrics`, `getIntentDistribution`, and `getUnknownQuestions` from `services/ai-analytics.service.ts` make calls to the mocked Supabase client correctly.
   - Create a critical regression test `tests/unit/no-firestore-analytics.test.ts` to ensure no Firestore references exist for analytics reads by asserting that `services/ai-analytics.service.ts` and `lib/ai/unknown-logger.ts` do not contain the strings `collection(db, COLLECTIONS.LATENCY_RECORDS)`, `collection(db, COLLECTIONS.INTENT_DISTRIBUTION)`, etc.
   - Execute tests using `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` to verify correctness. Verify results via CLI output.

8. **Documentation & Wrap up**
   - Finalize `docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md` addressing all 20 points in the requirements. Verify completion using `cat docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md`.

9. **Pre-commit Steps**
   - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
