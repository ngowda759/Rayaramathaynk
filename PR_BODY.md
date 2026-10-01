No production migration was executed.
No database schema was changed.

Exact tests run and results:
- \`npm run test tests/unit/migration-mappers.test.ts\` (PASS)
- \`npm run test tests/unit/migrate-all-batched.test.ts\` (PASS)
- \`npm run typecheck\` (PASS)

Fixes missing sevaBookings mapper implementation, resolving mapping bugs and properly integrating it into the codebase along with unit tests.
Additionally, corrects the alias mapping from 'messages' in Firestore to 'chat_messages' in Supabase to prevent the batched runner from incorrectly reading from a non-existent 'chat_messages' collection, and modifies the inventory appropriately without setting 'messages' to be actively migrated yet (remains in REVIEW).
