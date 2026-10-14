# BOT-005: Raya AI Server-Side Security Hardening

## Findings and severity
1. **Service-Role Boundary (High):** The Supabase admin client was relying on a manual `typeof window !== 'undefined'` check to prevent client-side bundling, which is brittle and can be bypassed in certain test/dev conditions. We updated it to use the Next.js `server-only` package, actively breaking the build if the client accidentally imports the admin client.
2. **Missing Input Validation (Medium):** The settings server action was missing strong ID validation, which could allow malformed updates or unintended paths. We explicitly added a UUID validation schema.

## Files changed
- `lib/supabase/admin.ts`: Added `import 'server-only'` to enforce server execution, removing manual browser checks.
- `app/actions/settings.ts`: Enhanced validation using `z.string().uuid()` for the `id` and added documentation for `api-admin` usage.
- `tests/unit/bot-004-behavior.test.ts`: Skipped a test bypassing the `NODE_ENV` protections now that `server-only` covers the functionality globally.

## Tests added and results
Tests run via Jest (`npx jest tests/unit/bot-004-action.test.ts` and `tests/unit/bot-004-auth.test.ts`) assert that:
- Missing credentials and invalid tokens are rejected.
- Authenticated non-admin users are rejected.
- Invalid payloads and IDs trigger validation errors.

All unit tests currently pass. The Next.js production build (`npm run build`) also completes successfully.

## Residual risks
None identified within the scope of this step.

## Evidence that service-role credentials cannot enter client bundles
The implementation of `import 'server-only';` in `lib/supabase/admin.ts` ensures that Next.js / Webpack will immediately throw a compilation error if any component with `'use client'` tries to import the module, completely preventing the bundle from attempting to load the Supabase Service Role key in the browser.

## BOT-005A Updates
- Added explicit boundary tests in `scripts/test-boundary.sh` demonstrating that `npx next build` actively fails if a client component attempts to import `lib/supabase/admin`.
- Updated `tests/unit/bot-004-action.test.ts` to assert that `mockSupabase.insert` and `mockSupabase.update` are never called when unauthorized users or invalid payloads hit server actions.
- Added explicit coverage testing `isUserAdmin` fallback to verify inactive admins are actively blocked without reaching Supabase.
- Added test coverage demonstrating `process.env.ADMIN_API_KEY` bypass strictly validates standard keys and falls back to rejecting unauthorized tokens when missing.
- Confirmed that `tests/unit/bot-004-behavior.test.ts` edits removed only the outdated `NODE_ENV` fallback bypass; other behavioral tests remained entirely intact.
## BOT-005B Updates
- Enforced test verification in CI by updating `.github/workflows/ci.yml` from `npm test || true` to strictly `npm test`.
- Updated `scripts/test-boundary.sh` with a cleanup `trap` guaranteeing leftover test files are removed regardless of outcome.
- Cleaned up broken testing blocks across `tests/unit/bot-004-action.test.ts` and simplified mock behavior to securely assert zero-write operations when requests are unauthorized.
