1. **Create an `adminFetch` helper**
   - Create a new utility function `lib/api/admin-fetch.ts` that will wrap the standard `fetch` call but injects the `Authorization: Bearer <token>` header dynamically by using the Firebase Auth token.
   - However, since this is in Next.js, and components might be client-side, using `useAuth` to get the token and passing it directly into the component is generally easier unless we write a custom hook. I will write a custom hook `useAdminFetch` in `hooks/useAdminFetch.ts` that returns a fetch function which automatically appends the token from the user context.

2. **Update all AI Admin Pages**
   - Import `useAuth` in each affected AI Admin page.
   - Modify the `fetch` calls to include the `Authorization` header: `headers: { Authorization: \`Bearer \${await user?.getIdToken()}\` }`.
   - Pages to modify:
     - `app/admin/ai/settings/page.tsx`
     - `app/admin/ai/health/page.tsx`
     - `app/admin/ai/intents/page.tsx`
     - `app/admin/ai/prompts/page.tsx`
     - `app/admin/ai/knowledge/page.tsx`
     - `app/admin/ai/playground/page.tsx`
     - `app/admin/ai/unknown-questions/page.tsx`
     - `app/admin/ai/page.tsx`

3. **Verify API Routes Security**
   - The API routes (`/api/ai/settings/*`, `/api/seed-ai-settings/`) already use `verifyAdminUser(request)` which correctly looks for the `Authorization: Bearer <token>` header and verifies it via the Firebase Admin SDK.
   - We need to confirm that `seed-ai-settings.ts` respects existing values and is idempotent. Looking at the code in `app/api/seed-ai-settings/route.ts`:
     ```typescript
     const { data: existingData } = await supabase
         .from("ai_settings")
         .select("id")
         .eq("id", "main")
         .maybeSingle();

     if (existingData) {
         return NextResponse.json({
             message: "AI settings already exist. Seed operation skipped to prevent overwriting admin changes.",
         });
     }
     ```
     This confirms idempotency and prevention of duplicate records or overwriting.

4. **Testing**
   - Add/update tests for successful authentication, missing tokens, insufficient privileges, successful initialization.
   - The current repository unit tests include `tests/unit/ai-settings.test.ts` and `tests/unit/admin-firebase.test.ts`. I will need to ensure `verifyAdminUser` is well tested, or test the API routes appropriately.

5. **Execute pre-commit steps**
   - Follow instructions from `pre_commit_instructions`.

6. **Submit PR**
   - Submit the PR with a detailed description of the changes.
