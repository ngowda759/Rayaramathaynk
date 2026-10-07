# AI Analytics Audit

This document describes the current architecture for analytics in the Raya AI chatbot system before the Supabase migration.

## 1. Identified Analytics Paths

### 1.1 `ai_latency_records`
*   **Source:** Firestore (`ai_latency_records`) - Actually partially written to Supabase! (See `recordLatency` in `services/ai-analytics.service.ts`). Wait, let me double check this. `recordLatency` writes to Supabase.
*   **Reads:** Firestore (`getLatencyMetrics` in `services/ai-analytics.service.ts`). **Split brain identified!** Writes go to Supabase, reads come from Firestore.
*   **Destination Table (Supabase):** `ai_latency_records`

### 1.2 `ai_intent_distribution`
*   **Source:** Firestore (`ai_intent_distribution`). Similar to latency, `recordIntentDistribution` in `services/ai-analytics.service.ts` writes to Supabase.
*   **Reads:** Firestore (`getIntentDistribution` in `services/ai-analytics.service.ts`). **Split brain identified!** Writes go to Supabase, reads come from Firestore.
*   **Destination Table (Supabase):** `ai_intent_distribution`

### 1.3 `unknown_questions`
*   **Naming Confusion:**
    *   Firestore Collection Name is sometimes referred to as `ai_unknown_questions` (e.g. `services/ai-analytics.service.ts:COLLECTIONS.UNKNOWN_QUESTIONS = "ai_unknown_questions"`). Wait, let's check `services/ai-analytics.service.ts`. The constant is `UNKNOWN_QUESTIONS: "ai_unknown_questions"`.
    *   BUT `lib/ai/unknown-logger.ts` uses `COLLECTION_NAME = "unknown_questions"`.
    *   BUT `lib/ai/ai-settings/repository.ts` uses `UNKNOWN_QUESTIONS_COLLECTION = "unknown_questions"` and writes to Supabase table `unknown_questions`.
    *   AND `lib/ai/ai-settings/admin-repository.ts` uses `UNKNOWN_QUESTIONS_COLLECTION = "unknown_questions"`.
    *   The Supabase destination table is `unknown_questions`.
    *   We need to definitively consolidate on the name `unknown_questions` for both the Supabase table and the conceptual entity.
*   **Writes:**
    *   `logUnknownQuestion` in `lib/ai/unknown-logger.ts` writes to Firestore `unknown_questions`!
    *   `recordUnknownQuestion` in `services/ai-analytics.service.ts` writes to Firestore `ai_unknown_questions`!
    *   `AISettingsRepository` writes to Supabase `unknown_questions`.
*   **Reads:**
    *   `getUnknownQuestions` in `services/ai-analytics.service.ts` reads from Firestore `ai_unknown_questions`.
    *   `getRecentUnknownQuestions` in `lib/ai/unknown-logger.ts` reads from Firestore `unknown_questions`.
    *   `getRecentUnknownQuestions` in `services/analytics.service.ts` reads from Firestore `unknown_questions`.
    *   `getUnknownQuestionsStats` in `lib/ai/unknown-logger.ts` reads from Firestore `unknown_questions`.
    *   `getUnknownQuestionsStats` in `services/analytics.service.ts` reads from Firestore `unknown_questions`.
    *   `getUnknownQuestions` in `lib/ai/ai-settings/repository.ts` reads from Supabase `unknown_questions`.

## 2. Naming Reconciliation Decision

*   **Canonical Table (Supabase):** `unknown_questions`
*   **Historical Source (Firestore):** Both `unknown_questions` and `ai_unknown_questions` appear to have been used in code, though `unknown_questions` seems to be the primary one in terms of data migration (batch scripts refer to `unknown_questions`).
*   **Decision:** The canonical name going forward for all code and Supabase interactions will be `unknown_questions`. We will migrate reads and writes across the board to use the `unknown_questions` Supabase table. `ai_unknown_questions` will be treated as legacy/deprecated.

## 3. Scope of Migration

The migration will target the following operations to completely eliminate Firestore dependency for analytics reads and writes:

1.  **`ai_latency_records`**: Update `getLatencyMetrics` to query Supabase `ai_latency_records`.
2.  **`ai_intent_distribution`**: Update `getIntentDistribution` to query Supabase `ai_intent_distribution`.
3.  **`unknown_questions`**:
    *   Update `recordUnknownQuestion` (in `ai-analytics.service.ts`) to write to Supabase `unknown_questions`.
    *   Update `logUnknownQuestion` (in `unknown-logger.ts`) to write to Supabase `unknown_questions`.
    *   Update `getUnknownQuestions` (in `ai-analytics.service.ts`) to read from Supabase `unknown_questions`.
    *   Update `getRecentUnknownQuestions` (in `unknown-logger.ts` and `analytics.service.ts`) to read from Supabase `unknown_questions`.
    *   Update `getUnknownQuestionStats` (in `unknown-logger.ts` and `analytics.service.ts`) to read from Supabase `unknown_questions`.
    *   Update `markUnknownQuestionReviewed` to update Supabase.

## 4. Other Collections Mentioned (Out of Scope / To Be Confirmed)

*   `chat_metrics`, `intent_metrics`, `intent_feedback`: These are listed in `PRODUCTION_REVIEW_COLLECTIONS_INVENTORY.md` but are currently marked as `REVIEW` with "No destination model explicitly defined yet". They are used in `services/analytics.service.ts`. The prompt explicitly says to document which collections are genuinely part of Raya AI analytics runtime. These appear to be an older/alternative set of metrics (perhaps from before the `ai_` prefixed ones). I will leave them alone for now as they are not explicitly called out as primary targets, but I will note them as legacy in the report.
