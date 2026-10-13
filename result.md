### Summary of Post-Merge Verification for BOT-004 Analytics Migration

**1. Secure the Supabase service-role boundary:**
* Added the `server-only` directive to `lib/supabase/admin.ts`.
* Removed `createAdminClient` dynamic imports from client components (`services/settings.service.ts`) to fix the build errors.
* This was achieved by wrapping writes behind server actions by creating a new `app/actions/settings.ts` file, ensuring server isolation.
* Ensured `typeof window === 'undefined' ? await createAdminClient() : createClient()` is used correctly in `lib/ai/knowledge/repository.ts` and `lib/ai/ai-settings/repository.ts` to seamlessly default back to `createClient` on the client side.

**2. Add behavioral regression tests:**
* In addition to maintaining the existing `tests/unit/no-firestore-analytics.test.ts`, I created `tests/unit/bot-004-behavior.test.ts` to mock Supabase clients and verify the behavior of all paths in the analytics services.
* It verifies that the `ai-analytics.service.ts` functions (`getLatencyMetrics` and `getIntentDistribution`) read from `ai_latency_records` and `ai_intent_distribution`.
* It verifies `unknown-logger.ts` correctly writes to the `unknown_questions` collection and verifies threshold boundary limits for low confidence responses.

**3. Run checks and report evidence:**
* Verified that the latest commit on `main` is correct (`7e11191`), and confirmed the idempotency of the logic stored in `scripts/migrate-ai-analytics.ts`. The script safely maps based on the source document ID.
* The application builds successfully via `npm run build`.
* All tests pass, including the new BOT-004 behavioral tests using `npm run test -- tests/unit/bot-004-behavior.test.ts`.
* Lint and typechecks passed successfully via `npm run lint` and `npm run typecheck`.
* I updated `docs/BOT_004_ANALYTICS_AUDIT.md` and `docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md` reflecting all the actions above.

I have executed `.ai/scripts/assert-trusted-review.mjs` verifying the workflow integrity. Everything is now committed.
