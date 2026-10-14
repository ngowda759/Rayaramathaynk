1. **Update `useAdminFetch`**
   - Modify `hooks/useAdminFetch.ts` to throw an error if `user` is null or if `getIdToken()` fails.
   - Ensure it correctly merges caller-supplied headers with the `Authorization` header.

2. **Update `app/admin/ai/settings/page.tsx`**
   - Check HTTP status codes for all reads (`Promise.all` in `loadSettings`) and writes (`handleSave`).
   - Prevent showing a success message if any write request fails.
   - Retain form values on failure.

3. **Verify `/api/seed-ai-settings`**
   - Review `app/api/seed-ai-settings/route.ts` and `scripts/seed-ai-settings.ts` (or `lib/ai/ai-settings/seed-data.ts`) to see what gets seeded and ensure it's idempotent.
   - Update `app/admin/ai/settings/page.tsx`'s `handleSeedData` to correctly interpret the API response.

4. **Expand Tests**
   - Update `tests/unit/useAdminFetch.test.tsx` to handle missing user and token retrieval failures (expecting errors).
   - Add/update tests for `ai-settings` initialization behavior.

5. **Clean up**
   - Removed `patch_fix.mjs`.
   - Run linter and formatter to clean up indentation.

6. **Validate**
   - Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test`.

7. **Commit and Submit**
   - Commit changes to the current branch.
