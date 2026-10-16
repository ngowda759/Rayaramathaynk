# AI Settings & AI Health — Production Verification Plan

Status: prepared, **not executed**. Step (4) requires explicit owner authorization.
Owner decision on record: deployment and Super Admin acceptance are held until the
owner explicitly authorizes them. No deployment or credential rotation has been
performed by the agent.

## 1. What is already true (verified read-only, 2026-10-16)

- The diagnostics fixes are on `main` and appear **already deployed**:
  - `8d54714` — "fix(admin-ai): accurate auth diagnostics for AI Settings and AI
    Health" — merged via PR #329 (closed/merged 2026-10-15T17:02:40Z).
  - An unauthenticated probe of production returns the *new* structured shape,
    which only exists in that commit:
    `GET https://www.srsmathaynk.com/api/ai/health` →
    `401 {"error":"Missing or malformed Authorization header.","reason":"missing_token"}`.
  - The apex host `srsmathaynk.com` issues a `308` redirect to `www.srsmathaynk.com`;
    all checks below use the canonical `www.` host.
- Both admin pages return `200` (HTML shell) unauthenticated; the API routes return
  `401 missing_token` unauthenticated, as designed.
- The Prisma/Raya AI baseline is resolved and the scoped drift gate passes (PR #338 +
  PR #339), so the migration path is not a blocker for these pages.

Conclusion: this is a **verification/acceptance** exercise, not an outstanding code
fix. If the sign-in walkthrough below fails, the failure is investigated before any
deployment.

## 2. Where each required behavior lives

| Requirement | Implementation |
| --- | --- |
| Wait for auth init before protected calls | `hooks/useAdminFetch.ts` — returns `503 auth_initializing` while `loading` |
| Send a fresh ID token | `useAdminFetch` — `user.getIdToken()` → `Authorization: Bearer <token>` |
| Preserve method/headers/body | `useAdminFetch` spreads `requestInit`; only adds the auth header |
| Bounded timeout | `useAdminFetch` — `timeoutMs` default 15000 → synthetic `408 timeout` |
| No infinite spinner | `app/admin/ai/settings/page.tsx` — `if (loading)` shows a spinner, `if (!settings)` shows an actionable error + Retry |
| Per-endpoint diagnostics | settings page collects `EndpointFailure[]`; `describeFailure()` maps reason→message |
| 401 ≠ connectivity | `lib/ai/health-classify.ts` — `classifyHttpResult` categorises `auth`/`forbidden`/`server`/`connectivity` separately |
| Missing vs inaccessible data | `classifyDataIntegrity` — inaccessible ⇒ `auth`/`server`; empty ⇒ `missing-data`/`partial-data` |
| Strict authorization, no bypass | `lib/auth/admin-auth.ts` — `requireAdminUser` on every route; blocked roles `{devotee, volunteer}` |
| No retry loop on permanent 401/403 | health page classifies without auto-retry; settings Retry is user-initiated |

## 3. Environment prerequisites (must be present on the production deployment)

Server-side (verified to be in use by the code):

- `FIREBASE_SERVICE_ACCOUNT_JSON` (or `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
  + `FIREBASE_PROJECT_ID`) — Firebase Admin SDK token verification.
- `NEXT_PUBLIC_FIREBASE_*` — client auth SDK.
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — datastore probe
  (`lib/supabase/admin.ts`, `lib/ai/ai-settings/admin-repository.ts`).

If a Firebase Admin credential is missing, the correct symptom is `503
auth_unavailable` / category `server` — **not** `401`. Distinguish accordingly.

## 4. Verification steps

### 4a. Unauthenticated (already passing — re-run to confirm)

```bash
base=https://www.srsmathaynk.com
for u in /admin/ai/settings /admin/ai/health /api/ai/health \
         /api/ai/settings/temple-information /api/seed-ai-settings; do
  printf '%s  ' "$(curl -sL -o /dev/null -w '%{http_code}' "$base$u")"; echo "$u"
done
```

Expected: pages `200`; `/api/ai/health`, `/api/ai/settings/*` → `401` with
`reason:"missing_token"`; `/api/seed-ai-settings` POST → `401` (never "Initialized").
Unauthorized users must remain blocked.

### 4b. Signed in as Super Admin (requires owner authorization for step 4)

1. Sign in with a **Super Admin** account (`role` not in `{devotee, volunteer}`,
   `isActive !== false`, profile exists in Firestore `users/{uid}`).
2. `/admin/ai/settings`:
   - the spinner resolves (never infinite);
   - all five sections render: temple-information, visitor-information, policies,
     ai-responses, ai-behavior;
   - DevTools → Network: each `/api/ai/settings/*` → `200` with a `Bearer` header;
   - if any request fails, the page shows the per-endpoint list and a working Retry.
3. `/admin/ai/health`:
   - run OpenRanks / open the dashboard; every endpoint row in the table reports
     status + latency:
     - the 5 settings endpoints → `200 healthy`;
     - prompts, intents, unknown-questions → expected status;
   - the "Supabase Connection" card → connected;
   - Data Integrity reflects the **real** data state: a `warning` must name the empty
     sections; it must **not** say "unauthorized"/"could not be read" while signed in.
4. Confirm **no unexplained 401** remains for the authorized account. Any 401 → inspect
   the response `reason` to distinguish expired vs invalid vs profile/role problems.

### 4c. Deployed-commit verification (only if step 4 deploys)

```bash
gh api repos/ngowda759/Rayaramathaynk/commits/main --jq .sha   # intended fix
vercel ls --prod                       # identify the production deployment
vercel inspect <production-url>        # confirm its commit matches
```

There is no `/api/version` route, so the commit is confirmed from the Vercel
deployment metadata rather than the app.

## 5. Pass / fail criteria (acceptance)

- AI Settings loads for an authorized Super Admin; no infinite spinner.
- Auth and load errors are visible, actionable, and per-endpoint.
- AI Health reports Firebase/Supabase and API status accurately; 401 is reported as
  an authentication failure, not connectivity.
- Data Integrity warnings reflect actual data state, not unauthorized reads.
- Unauthorized users remain blocked (401/403).
- Existing settings and customizations are preserved; initialization is idempotent.
- No unexplained 401 for the authorized account.

## 6. Evidence to attach to the step-4 report

- The 4a status table (before/after deploy if a deploy occurs).
- Screenshots of both pages while signed in, including the health endpoint table and
  the Data Integrity card.
- Network capture showing `Authorization: Bearer` on the settings requests.
- Vercel deployment id + commit, confirmed against `main`.

## 7. Explicitly out of scope for this plan

- Token rotation — tracked as a separate security task (see
  `docs/SECURITY_SUPABASE_ACCESS_TOKEN_ROTATION.md`).
- Any deployment — performed only after explicit owner authorization.
- Claiming Super Admin acceptance without the signed-in walkthrough above.
