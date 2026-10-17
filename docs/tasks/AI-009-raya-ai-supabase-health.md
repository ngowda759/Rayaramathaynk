# Task Brief: AI-009 - Fix Raya AI Production Health Failures and Enforce Supabase-Only Architecture

**Phase:** migration
**Status:** approved

## Summary
Investigate and permanently fix the Raya AI production health failures returning HTTP 503 across Supabase connection and settings APIs. Transition Raya AI persistence (settings, knowledge retrieval, chat, analytics) strictly to Supabase-only architecture, removing Firestore dependencies without migrating live data, using versioned schemas and idempotent seeding.

## Acceptance Criteria
- A valid Supabase migration setting up tables for Raya AI in-scope paths (e.g. ai_settings) exists.
- The data initialization pipeline correctly seeds approved default data idempotently into Supabase.
- No in-scope Raya AI runtime path (settings, chat, knowledge, analytics) queries Firestore; they strictly use Supabase.
- Missing or invalid credentials return safely worded 503 error responses rather than leaking stack traces or internal secrets.
- Unit and API tests cover the credential failure scenarios and the authorized happy path for Supabase settings retrieval.
- Tests pass successfully using `npm run test`.
- Running `npm run type-check` returns 0 errors.
- Running `npm run lint` returns 0 errors.

## Out of Scope
- Migrating existing active Firestore records (as live Raya AI data to preserve doesn't exist).
- Fabricating new temple information not already verified in the repository.
- Running production writes or executing production migrations without explicit human authorization.
- Modifying unrelated legacy Firestore features.
- Mobile app implementation.

## References
- `docs/RAYA_AI_SETTINGS.md`
- `docs/SUPABASE_MIGRATIONS.md`
- `docs/FIRESTORE_MIGRATION.md`
