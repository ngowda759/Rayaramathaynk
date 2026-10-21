# Investigation and Fix Report

## Root Cause
The root cause of the authorization failure in the Raya AI Prompt Manager was twofold:
1. **Frontend Request Mismatch:** The frontend (`app/admin/ai/prompts/page.tsx`) was incorrectly passing the prompt ID as a query string parameter (`?id=...`) and entirely omitting the required `action` field in the payload for `PUT` requests (e.g., `update`, `publish`, `rollback`). The backend `PUT` endpoint strictly expects `versionId` and `action` in the JSON payload body. This mismatched contract likely caused HTTP 400 Bad Request responses (manifesting as authorization or saving errors in the UI due to generic catch blocks).
2. **Legacy Firebase Dependency:** There existed an outdated proxy route (`app/api/admin/prompts`) using `verifyAdminUser` from Firebase Auth. `adminFetch` automatically attaches Supabase Access tokens via headers, which are incompatible with this legacy Firebase route. However, the frontend was generally calling the new Supabase-backed API directly, but the unused legacy route and improper payload handling created friction and errors in the flow.

## Affected Files
*   `app/admin/ai/prompts/page.tsx`: Updated to correctly send `versionId` and `action` inside the JSON body instead of the URL query, and changed `DELETE` to a `PUT` with an `archived` status (as the backend does not implement `DELETE`).
*   `tests/unit/raya-admin-prompts.test.ts` (New): Created regression tests validating that only authorized admins can create master prompts via `POST`.
*   `app/api/admin/prompts/route.ts` & `app/api/admin/prompts/[id]/route.ts`: Removed entirely to eliminate legacy Firebase dependencies and enforce a single path for prompt management.

## Fix
*   **Payload Structuring:** Refactored `handleSave`, `handleStatusChange`, `handleDelete` (converted to archive), and `handleRollback` in `app/admin/ai/prompts/page.tsx` to align strictly with the expected server-side contract: `{ versionId, action, ...updates }`.
*   **Legacy Cleanup:** Removed the legacy Firebase-backed proxy routes under `app/api/admin/prompts` to prevent any possibility of fallback logic intercepting or failing on Supabase tokens.
*   **Test Coverage:** Added `tests/unit/raya-admin-prompts.test.ts` to mock Supabase Auth successfully and verify the creation logic.

## Test Results
-   **Unit Tests:** Executed `npx jest tests/unit/raya-admin-prompts.test.ts` successfully (3 passing tests).
-   **Static Analysis:** Executed `npm run typecheck` and `npm run lint` successfully.
-   **Build:** Executed `npm run build` and Next.js compiled the production build flawlessly.

## Deployment Steps
None outside of the standard CI/CD deployment pipeline.

The authorized administrator can now reliably save and retrieve the Raya AI master system prompt via Supabase Auth without triggering generic or mismatched errors.
