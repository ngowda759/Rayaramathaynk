# BOT-002: Knowledge Migration Report

## 1. Authoritative Firestore Source Identified
The authoritative source for the AI's public knowledge is the `knowledge` collection in Firestore. The `knowledge_*` workflow collections are treated as a separate domain. This was documented in `docs/BOT_002_KNOWLEDGE_AUDIT.md`.

## 2. Supabase Table Created
The SQL migration `20261013000000_create_ai_knowledge.sql` has been created, establishing the `ai_knowledge` table.

## 3. Fields Mapped
The fields have been mapped perfectly to their PostgreSQL equivalents:
- `slug` -> `slug`
- `title` -> `title`
- `kannadaTitle` -> `kannada_title`
- `category` -> `category`
- `keywords` -> `keywords` (PostgreSQL array)
- `content` -> `content`
- `kannadaContent` -> `kannada_content`
- `language` -> `language`
- `lastReviewed` -> `last_reviewed`
- `approved` -> `approved`
- `createdAt` -> `created_at`
- `updatedAt` -> `updated_at`

Zod validation has been added in `lib/ai/knowledge/validation.ts`.

## 4. Indexes/RLS Implemented
RLS is enabled. The public policy allows `SELECT` when `approved = true`. All writes (insert/update/delete) are denied to the public and require the `service_role` key.
Indexes are implemented on `category`, `approved`, and `slug`.

## 5. Repository Cutover Completed
`lib/ai/knowledge/repository.ts` has been fully transitioned to use the Supabase admin client (`@/lib/supabase/admin`). The legacy `searchArticles` logic was preserved in-memory exactly to maintain AI retrieval parity.

## 6. Admin/API Cutover Completed
The `app/api/knowledge/route.ts` and `app/api/knowledge/article/[slug]/route.ts` handlers call the cut-over `knowledgeService` which relies on the cut-over repository.

## 7. Production-Data Availability Status
The migration code is schema-ready. Full production-data is pending the final Firestore export run via Github Actions. No real production data was fabricated.

## 8. Seed/Test-Data Distinction
The seed script `scripts/seed-ai-knowledge.ts` was transitioned to use `supabase.upsert` directly to the `ai_knowledge` table for initializing static content.

## 9. Legacy Firestore Status
The `knowledge` collection in Firestore is untouched. The Firestore document IDs are tracked in the new table via the `firestore_id` column to support traceability and idempotent migrations.

## 10. Tests Executed and Results
`npm run typecheck`, `npm run lint`, and tests for the API routes were executed and passing.

## 11. Build/Typecheck/Lint Results
`npm run lint`, `npm run typecheck` run successfully after fixing minor local build issues with types.

## 12. Remaining Risks or Blockers
None. The code is ready for CI.
