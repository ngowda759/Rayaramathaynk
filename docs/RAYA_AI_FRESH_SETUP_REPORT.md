# Raya AI Fresh Setup & Selective Data Reconciliation Report

## 1. Audit of Existing vs Missing Functionality

**Already Implemented & Working:**
- The core Supabase tables (`ai_settings`, `unknown_questions`, `chat_messages`, `ai_latency_records`, `ai_intent_distribution`) exist and are populated with required schemas and constraints.
- Seed logic for `ai_settings` exists via `scripts/seed-ai-settings-supabase.ts` and API endpoints.
- `AISettingsService` successfully reads from the new `ai_settings` PostgreSQL structure.
- The hybrid intent-detection and data retrieval layer (`lib/ai/generator.ts`, `lib/ai/intent/`, `lib/ai/retrieval/`) is implemented and connects to `aiSettingsService`.

**Implemented But Not Correctly Wired:**
- Legacy Firebase dependencies (`lib/ai/firebaseChat.ts`, `lib/ai/settings.ts`) were still present and imported by the chat API route and frontend context, bypassing the new Supabase-backed logic.
- Tests (e.g., `tests/unit/response-generator.test.ts`) were not mocking Supabase correctly, leading to credential failure errors during automated runs.

**Missing or Incomplete:**
- Clean cutover for UI components; `components/ai/AIChatProvider.tsx` still referenced legacy Firebase settings getters.

## 2. Configuration to be Freshly Initialized

The following configurations have been migrated from Firestore and now reside cleanly in Supabase's `ai_settings` row (`id = 'main'`), seeded by default logic:

- **General Settings:** Bot name ("Raya AI"), language definitions.
- **Safety Settings:** Retrieval requirements, strict hallucination guards (LLM-only responses blocked).
- **Behavior Settings:** Confidence thresholds (e.g., 60 for low confidence), conversation timeouts.
- **Temple Information & Policies:** Base temple timings, contact info, guidelines, and dress codes embedded within the `jsonb` column for fast retrieval.
- **Prompts & Responses:** The `SYSTEM_PROMPT_V2`, welcome strings, and intent mappings.

*Decision:* These are managed strictly by Supabase and seed scripts. No legacy Firestore pulls should happen for AI configuration.

## 3. Dataset Reconciliation Matrix

| Dataset Category | Classification | Decision / Evidence |
| :--- | :--- | :--- |
| **A. Present & Correct in Supabase** | `ai_settings`, schema structures | Migration scripts applied and seeded successfully. No further migration needed. |
| **B. Fresh Initialization** | Bot Configuration Defaults | System prompts and intent behaviors rely on approved code constants inserted via `seed-ai-settings-supabase.ts`. |
| **C. Required Missing Data** | `chat_messages`, `unknown_questions` | Historical data is blocked pending Firestore quota resolution (`RESOURCE_EXHAUSTED`). Data will be migrated when quota lifts. Current operations use empty Supabase tables safely. |
| **D. Optional Historical Data** | Analytics records | Same as (C). |
| **E. Other Website Features** | `sevas`, `events`, `donations` | Core temple data retrieval still queries Firebase collections (`events`, `settings` fallback) within the hybrid `lib/ai/retrieval/` layer where Supabase equivalents aren't fully cut over. This dependency is preserved for site stability. |

*Note on Data Migration:* Previous reviews confirmed a Google Cloud Quota (HTTP 429) blocker for Firestore exports. Thus, no live data extraction is performed during this task. The Supabase schema is ready and active for *new* data.

## 4. Remaining Firebase Dependencies

| Dependency | Location | Reason for Remaining |
| :--- | :--- | :--- |
| **Temple Data Collections** | `lib/ai/retrieval/events.ts`, etc. | The primary website still uses Firestore for `events`, `timings`, etc. The AI retrieval layer must continue reading from Firebase until the core website data is migrated. |
| **Obsolete AI Config** | `lib/ai/firebaseChat.ts`, `lib/ai/settings.ts` | **Removed.** Replaced entirely by Supabase `aiSettingsService`. |
