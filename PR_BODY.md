feat(bot): migrate chat sessions and messages to Supabase

This PR implements BOT-003, migrating the Raya AI chat persistence layer from Firestore to Supabase.

It updates `services/chat.service.ts` to use Supabase for `chat_sessions` and `messages`, preserving existing behavior and schema shapes.

**Note:** The implementation is CODE READY. No production data was fabricated. Production chat history migration requires a production Firestore export, which was not available in this environment.
