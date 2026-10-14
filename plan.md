1. **Fix `ai-behavior` API Payload Handling**
   - In `app/api/ai/settings/ai-behavior/route.ts`, if `setting` is `"all"`, strictly reconstruct the `AIBehaviorSettings` object from the request payload to ensure properties like `setting: "all"` are entirely stripped out before updating the database.
   - Use `cat app/api/ai/settings/ai-behavior/route.ts` to verify the changes.

2. **Add Regression Tests**
   - In `tests/unit/ai-settings.test.ts`, add a test to verify that the initialization logic handles idempotency correctly without overwriting existing data.
   - Use `cat tests/unit/ai-settings.test.ts` to verify the new test blocks were added correctly.

3. **Verify changes**
   - Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test` (including the specific updated files).

4. **Execute pre-commit steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

5. **Submit PR**
   - Submit the PR with a detailed description of the changes.
