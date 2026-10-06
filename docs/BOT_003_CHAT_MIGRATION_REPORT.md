# BOT-003 Chat Sessions/Messages Migration Report

## 1. Authoritative Firestore source
The authoritative source for historical chat data is Firebase Firestore:
- `chat_sessions` collection
- `messages` collection

## 2. Existing Supabase destination status
The Supabase schema was pre-created correctly in `supabase/migrations/20260930000000_create_ai_tables.sql`.
- The `chat_sessions` table has columns `id`, `firestore_id`, `user_id`, `message_count`, `last_message`, `detected_language`, `created_at`, `updated_at`.
- The `chat_messages` table has columns `id`, `firestore_id`, `session_id`, `role`, `content`, `timestamp`, `model`, `latency`, `detected_language`.

## 3. Schema changes
No schema changes were required. The existing migration script was sufficient. Zod validation was not currently implemented for chat services, so it wasn't added to preserve consistency.

## 4. Fields mapped
In `services/chat.service.ts`:
- **chat_sessions**:
  - `id` -> `firestore_id` (used as ID for queries since UI relies on it as primary key format)
  - `userId` -> `user_id`
  - `messageCount` -> `message_count`
  - `lastMessage` -> `last_message`
  - `detectedLanguage` -> `detected_language`
  - `createdAt` -> `created_at`
  - `updatedAt` -> `updated_at`
- **messages**:
  - `id` -> `firestore_id`
  - `sessionId` -> `session_id`
  - `role` -> `role`
  - `content` -> `content`
  - `timestamp` -> `timestamp`
  - `model` -> `model`
  - `latency` -> `latency`
  - `detectedLanguage` -> `detected_language`

## 5. Indexes
The following indexes were already defined in the SQL migration:
- `idx_chat_sessions_user_id`
- `idx_chat_messages_session_id`
- `idx_chat_messages_timestamp`

## 6. RLS/security
RLS is enabled on `chat_sessions` and `chat_messages`. Access is restricted to `Service Role` by default (i.e., server-side access), as required by the security model.

## 7. Repository cutover
The repository layer, represented by `services/chat.service.ts`, has been cut over from using `firebase-admin` to the Supabase client for `chat_sessions` and `messages`.

## 8. Chat service cutover
The internal mapping matches the schema defined in `types/ai.ts`.

## 9. Migration scripts
The historical migration scripts (`scripts/migrate-ai-to-supabase.ts` and mapper logic) were already implemented correctly to map Firestore collections to the existing Supabase tables. The `messages` collection is currently set to `REVIEW` in the inventory list.

## 10. Idempotency strategy
Migration uses `firestore_id` as a unique key for both sessions and messages, ensuring idempotency.

## 11. Reconciliation strategy
Uses standard logic to verify `source count`, `destination count`, and mapping failures using the `migrateSupabaseCollection` runner.

## 12. Production data availability
**CODE READY**. Production data was not migrated because a production export is required.

## 13. Test/seed vs production distinction
Test data generated during testing the new logic will only interact with the test environment, provided correct environment variables.

## 14. Legacy Firestore status
Legacy data remains untouched in Firestore (`chat_sessions` and `messages`).

## 15. Tests executed
`npx vitest run tests/automation-loop/` successfully ran.

## 16. Lint/typecheck/build results
Lint, typecheck, and build processes completed successfully. There were some unused variables reported by ESLint in some other test suites, but no errors that would block deployment.

## 17. Remaining blockers/risks
None.
