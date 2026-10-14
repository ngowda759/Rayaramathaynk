# PR #325 Revision Report: BOT-001 Validation & Trace Analysis

This report addresses the requested verification points regarding the AI configuration migration, ensuring no unrelated Firebase services were broken, tests strictly validate behavior, and no unauthorized writes overwrite production records.

## 1. Intent Detection Engine Fix
- **Action:** Reverted the broadened intent expectation hacks in `tests/unit/intent.test.ts`.
- **Action:** Addressed the root cause inside `lib/ai/intent/types.ts` by adjusting the `IntentPriority` mappings to cleanly separate competing semantic matches. (e.g. `ANNADANA` bumped above `SPECIAL_SEVAS`, `DAILY_QUOTE` above `PANCHANGA`, `OFFICE_HOURS` above `TEMPLE_TIMINGS`).
- **Result:** Exact expected intents now route correctly, satisfying `npm run test -- tests/unit/intent.test.ts` without test file manipulation.

## 2. Dynamic Welcome Message
- **Action:** Removed the hardcoded welcome message from `components/ai/AIChatProvider.tsx`.
- **Action:** Configured the provider to fetch its welcome payload from the `aiSettingsService` backed `/api/ai/settings/ai-responses` route via `fetch`.
- **Action:** Placed a tested fallback default `Welcome to Raya AI. How can I help you today?` string directly in state initialization to safely guard against unconfigured databases or network drops.

## 3. Chat Persistence Traces
- Traced `saveMessage`, `getSessionMessages`, and `getUserChatSessions` within `services/chat.service.ts`. They use `createClient()` connecting correctly to the `chat_messages` and `chat_sessions` Supabase tables (fully cut over from Firebase under BOT-003).
- Traced `submitFeedback`, `submitTestimonial`, and `submitVolunteerRequest` within `services/chat.service.ts`. These services still utilize Firebase because they correspond to external/general-site logic that wasn't included in the AI logic migration boundaries. They will remain intact to preserve general website capabilities while we wait for full backend consolidation tasks to handle user feedback components.

## 4. Analytics and Idempotent Seeding
- Analytics (`services/ai-analytics.service.ts` and `lib/ai/unknown-logger.ts`) writers and readers have already been correctly cut over to `createClient()` (Supabase) in the BOT-004 PR and correctly rely on standard Supabase schema layouts (`unknown_questions`, `ai_latency_records`, `ai_intent_distribution`).
- `app/api/seed-ai-settings/route.ts` is explicitly checking for existing records and skipping the operation if `id = 'main'` exists, making it safe and idempotent.
- `scripts/seed-ai-settings-supabase.ts` was using `.upsert()`, which risks overwriting admin settings. Updated it to add `{ onConflict: 'id', ignoreDuplicates: true }` to guarantee idempotency and preserve overrides.

## 5. Behavioral Tests for Chat Route
- Behavioral testing coverage for configuration absence, approved knowledge retrieval, hallucination safeguards, and Kannada/mixed-language responses are explicitly embedded inside `tests/unit/response-generator.test.ts`.
  - Hallucination logic / missing settings triggers standard unknown responses.
  - Kannada language responses are tested in `Greetings`, `Thanks`, `Mixed Language Support`, and multiple others.
  - Knowledge retrieval is verified inside `Response Generator -> generateResponse`.
  - Intent limits are tested in `Out of Scope` and `Unknown Questions`.
- These tests all passed locally.
