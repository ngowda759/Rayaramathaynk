# BOT-002: Knowledge Audit Report

## 1. Authoritative Knowledge Source
The codebase reveals two distinct knowledge implementations:

1.  **Public/AI Knowledge (Authoritative):** Uses the `knowledge` Firestore collection.
    *   **Files:** `lib/ai/knowledge/repository.ts`, `lib/ai/knowledge/types.ts`, `services/knowledge.service.ts`
    *   **Retrieval:** The AI chatbot uses this to fetch articles (`searchArticles` in `lib/ai/knowledge/repository.ts` called from `lib/ai/composer/composer.ts`).
    *   **Model:** `KnowledgeArticle` in `lib/ai/knowledge/types.ts`.
    *   **Schema:** `id`, `slug`, `title`, `kannadaTitle`, `category`, `keywords`, `content`, `kannadaContent`, `language`, `lastReviewed`, `approved`, `createdAt`, `updatedAt`.

2.  **Workflow Knowledge (Legacy / Sprint B):** Uses collections prefixed with `knowledge_` (`knowledge_workflow`, `knowledge_versions`, etc.).
    *   **Files:** `services/knowledge-workflow.service.ts`, `types/knowledge-workflow.ts`.
    *   **Usage:** A complex Draft -> Review -> Publish workflow.
    *   **Note:** The system uses the `knowledge` collection for public display and AI response. This task focuses on migrating the `knowledge` collection. The `knowledge_workflow` collections are marked as `REVIEW` in `lib/supabase/migration-inventory.ts` and their complex state machine is not the primary data source for the AI system.

**Conclusion:** The `knowledge` collection is the authoritative source for the AI's knowledge base. We will migrate this to a new `ai_knowledge` Supabase table. The `knowledge_workflow` collections will be ignored in this phase as per memory instructions (treat `knowledge_*` workflows as a separate domain requiring distinct migration design decisions, although they actually share the prefix). We'll migrate the `knowledge` collection to the `ai_knowledge` table.

## 2. Dependencies & Consumers
*   **AI Chat Composer:** `lib/ai/composer/composer.ts` uses `searchArticles` to ground AI responses.
*   **Knowledge API:** `app/api/knowledge/route.ts` and `app/api/knowledge/article/[slug]/route.ts` fetch data for the public knowledge center UI.
*   **Data Types:** `lib/ai/knowledge/types.ts` defines the interfaces.

## 3. Current Retrieval Logic
`lib/ai/knowledge/repository.ts` -> `searchArticles` performs a simple client-side/in-memory fuzzy match by pulling *all* approved articles and scoring them based on:
*   Title match (10 points)
*   Content match (5 points)
*   Keyword match (15 points)

We will preserve this logic in the initial Supabase cutover by fetching from Supabase and applying the same scoring locally.

## 4. Next Steps
1.  **Schema:** Create `supabase/migrations/20261013000000_create_ai_knowledge.sql` for `ai_knowledge`.
2.  **Types:** Add Zod validation schemas to `lib/ai/knowledge/validation.ts`.
3.  **Repository:** Update `lib/ai/knowledge/repository.ts` to read/write from Supabase instead of Firestore.
4.  **Migration Script:** Create `scripts/migrate-ai-knowledge.ts` utilizing `migration-mappers.ts` and `migration-runner.ts`.
