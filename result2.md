# Investigation and Fix Report (Follow-up)

## Root Cause Confirmed
1. **Frontend Request Mismatch:** The frontend (`app/admin/ai/prompts/page.tsx`) was incorrectly passing the prompt ID as a query string parameter (`?id=...`) and omitting the required `action` field in the payload for `PUT` requests (e.g., `update`, `publish`, `rollback`). The backend `PUT` endpoint strictly expects `versionId` and `action` in the JSON payload body. This mismatched contract caused HTTP 400 Bad Request responses (manifesting as generic saving errors in the UI due to lacking error parsing).
2. **Legacy Firebase Dependency:** There existed an outdated proxy route (`app/api/admin/prompts`) using `verifyAdminUser` from Firebase Auth. `adminFetch` automatically attaches Supabase Access tokens via headers, which are incompatible with this legacy Firebase route. The frontend is correctly calling the new Supabase-backed API directly `/api/ai/settings/prompts`.
3. **UI Error Masking:** The UI in `app/admin/ai/prompts/page.tsx` was discarding specific server errors (401, 403, 503) from the API response payload and presenting generic hardcoded errors to the user upon failures.

## Fixes Implemented
*   **Payload Structuring:** Refactored `handleSave`, `handleStatusChange`, `handleDelete` (converted to archive), and `handleRollback` in `app/admin/ai/prompts/page.tsx` to align strictly with the expected server-side contract: `{ versionId, action, ...updates }`.
*   **Error Handling in UI:** Updated UI functions to parse the server error message (`data.error`) and display it using `showMsg("error", data.error || "Fallback error message")` whenever `!response.ok`. This surfaces HTTP 401, 403, and 503 authentication errors.
*   **Legacy Cleanup:** Removed the legacy Firebase-backed proxy routes under `app/api/admin/prompts` to prevent fallback logic intercepting or failing on Supabase tokens.
*   **Test Coverage:** Added `tests/unit/raya-admin-prompts.test.ts` to mock Supabase Auth successfully and verify the creation logic. Added test scenarios for expired/invalid tokens, authenticated non-admins, update, publish, archive, and rollback logic to ensure all flows are secured via Supabase Auth without Firebase fallback.

## Verification
-   **Unit Tests:** Executed `npx jest tests/unit/raya-admin-prompts.test.ts` successfully (11 passing tests, encompassing all endpoint methods and auth states).
-   **Static Analysis:** Executed `npm run typecheck` and `npm run lint` successfully.
-   **Build:** Executed `npm run build` and Next.js compiled the production build seamlessly.
-   **Architecture check:** Service and repository layer use Supabase natively. RLS policies are preserved as changes route through admin repository bypassing client level restrictions natively.

## Remaining Risks
Minimal risks remain. The system correctly implements secure Supabase verification for admin management paths while displaying coherent client-side error states on failure.
