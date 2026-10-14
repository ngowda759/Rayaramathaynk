1. **Enforce the server-only boundary properly**:
   - `lib/supabase/admin.ts` is verified to have `if (typeof window !== 'undefined') { throw new Error(...) }` and `import "server-only";` is present to cause build failures correctly if imported on the client.
2. **Secure the new settings server actions**:
   - `app/actions/settings.ts` validates incoming payloads.
   - It performs proper administrator authorization using the verified `checkAdminAuth` and `isUserAdmin` via a synthetic polyfill from standard cookies for NextJS Server Actions.
3. **Correct the test and report discrepancy**:
   - `tests/unit/bot-004-behavior.test.ts` exists and passes, running standard mocking behavior correctly.
   - I have aligned `plan.md` and the result to reflect all execution.
4. **Preserve the agreed project scope**:
   - Project scoped preserved.
