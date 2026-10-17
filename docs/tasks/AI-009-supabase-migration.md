# Task Brief: AI-009 - Migrate Raya AI Settings to Supabase

**Phase:** migration
**Status:** approved

## Summary
Migrate the Raya AI configuration (ai_settings) from Firestore to Supabase. This requires creating the target migration table schema, running the data migration, and pointing the active API route and application to Supabase instead of Firestore.

## Acceptance Criteria
- A valid migration file exists in `supabase/migrations/` setting up the table structure for `ai_settings` (if not already existing in a consolidated settings structure) according to `docs/RAYA_AI_SETTINGS.md` and `docs/SUPABASE_MIGRATIONS.md`.
- The data migration pipeline (scripts or services) is capable of transferring the Raya AI configuration to the Supabase table.
- The client-facing AI chatbot configuration API `app/api/ai/public-settings/route.ts` correctly reads from the Supabase configuration instead of Firestore.
- Unit tests are added or updated to cover the Supabase integration for AI settings retrieval.
- Running `npm run type-check` returns 0 errors.
- Running `npm run lint` returns 0 errors.
- Tests pass successfully using `npm run test`.

## Out of Scope
- Migrating other general settings (like site settings) not related to Raya AI.
- Modifying the frontend AI chatbot UI code significantly.
- Mobile implementation.

## References
- `docs/RAYA_AI_SETTINGS.md`
- `docs/SUPABASE_MIGRATIONS.md`
- `docs/FIRESTORE_MIGRATION.md`
