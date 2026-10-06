BOT-002: Knowledge Migration
When rewriting a repository (e.g. from Firestore to Supabase), if the search/retrieval algorithm exists in the application tier (in-memory matching) and relies on fetching all records, preserve the fetching array signature and the search mapping logic perfectly to ensure zero regressions in AI grounding.
