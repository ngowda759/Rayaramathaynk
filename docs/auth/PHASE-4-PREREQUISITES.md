# Phase 4 Prerequisites: Verification Reconciliation & Fallback Telemetry Audit

- **Date:** 2026-11-09T06:00:00+05:30
- **Base Commit:** `0d288e62f62170cfa229d442e9de67141f2b17d2` (`origin/main`)
- **Document Path:** `docs/auth/PHASE-4-PREREQUISITES.md`
- **Telemetry Branch:** `telemetry/firebase-fallback-observation` (`e8317dc59abb4f75339f1478e633e3ef986970aa`)
- **Verification Artifact Branch:** `docs/auth-phase-3.1-production-verification` (`b6b1c45b90eb410bd96c2f7caaa49e5517a50a9c`)
- **Scope:** Controlled Prerequisite Activities ONLY (Zero application code removal, zero schema changes, zero PR merges)

---

## 1. Phase 3.1 Verification Artifact Reconciliation

The reported Phase 3.1 production verification artifact (`docs/auth/PHASE-3.1-PRODUCTION-VERIFICATION.md`) was previously reported as passing (`PRODUCTION VERIFICATION PASSED`), but could not be resolved on GitHub.

### 1.1. Local State Inspection
- **Branch:** `docs/auth-phase-3.1-production-verification` existed locally.
- **Commit:** `b6b1c45b90eb410bd96c2f7caaa49e5517a50a9c` existed locally (authored Sun Nov 8 23:56:23 2026 +0530 by `naveen <ngowda759@gmail.com>`).
- **Diff Inspection:** `git show --stat b6b1c45` confirmed that the commit modified exactly **1 file** (`docs/auth/PHASE-3.1-PRODUCTION-VERIFICATION.md`, +150 lines) with zero unexpected application code or configuration changes.
- **Discrepancy Cause:** The verification report was committed locally following the production verification run, but was not pushed to the remote repository.

### 1.2. Remote Reconciliation
The branch has now been safely pushed to `origin`:
- **Command:** `git push origin docs/auth-phase-3.1-production-verification`
- **Result:** Successfully created remote ref `refs/heads/docs/auth-phase-3.1-production-verification`.
- **Verified Remote SHA:** `b6b1c45b90eb410bd96c2f7caaa49e5517a50a9c`
- **Artifact Status:** Fully reconciled and resolvable on GitHub. No PR created or merged.

---

## 2. Remote Branch & Commit Status

| Ref / Location | Exact Commit SHA | Status | Purpose |
|:---|:---|:---:|:---|
| `origin/main` | `0d288e62f62170cfa229d442e9de67141f2b17d2` | Merged / Production | HEAD of `main`; live in production deployment `dpl_D4MukBTnweHaYaPHduZsD5VzNWjk` |
| `origin/docs/auth-phase-3.1-production-verification` | `b6b1c45b90eb410bd96c2f7caaa49e5517a50a9c` | Pushed (Unmerged) | Contains authoritative production verification report |
| `telemetry/firebase-fallback-observation` | `e8317dc59abb4f75339f1478e633e3ef986970aa` | Local Branch (Unmerged) | Minimal safe, aggregate-oriented telemetry instrumentation |
| `docs/auth-phase-4-prerequisites` | Current Branch | Local Documentation | This prerequisites and observation specification |

---

## 3. Firebase Fallback Telemetry Architecture

The repository was audited across all four known fallback locations to determine how authentication fallback is currently handled:

1. **`lib/auth/verify-id-token.ts`**:
   - Primary path: `createAdminClient().auth.getUser(token)` (Supabase Auth).
   - Secondary path: Firebase Admin SDK `getAuth(adminApp).verifyIdToken(token)`.
   - Used by: Public devotee endpoints, booking endpoints, profile endpoints, and `/api/auth/me`.
2. **`lib/auth/admin-auth.ts`**:
   - Primary path: `createAdminClient().auth.getUser(bearerToken)`.
   - Secondary path: Firebase Admin SDK `getAuth(adminApp).verifyIdToken(bearerToken)`, followed by `public.users` lookup where `firestore_id = firebaseDecoded.uid`.
   - Used by: 55+ admin routes across `/api/admin/**`, `/api/ai/chat/**`, etc.
3. **`app/api/admin/users/set-role/route.ts`**:
   - `resolveLoginUid`: Looks up user in Supabase Auth via `getUserByEmail`/`listUsers`, then falls back to `getAuth(adminApp).getUserByEmail(email)`.
4. **`context/AuthContext.tsx`**:
   - Client-side listener: When no Supabase session exists, falls back to `onAuthStateChanged` from `firebase/auth`.

---

## 4. Existing Telemetry Capabilities

An inspection of current production code revealed the following telemetry behavior:

1. **Is fallback usage currently logged?**
   - In `lib/auth/verify-id-token.ts`: Logged via `console.info(`[auth:fallback] Legacy Firebase token verified for UID: ${decoded.uid}`)` in non-test environments.
   - In `lib/auth/admin-auth.ts`: **NOT LOGGED.** Successful admin fallback is completely silent.
   - In `app/api/admin/users/set-role/route.ts`: **NOT LOGGED.** Fallback email resolution is completely silent.
   - In `context/AuthContext.tsx`: **NOT LOGGED.** Client browser listener is silent.
2. **Where is it logged?**
   - Only on stdout in Vercel Function logs for `verify-id-token.ts`.
3. **Does it distinguish Supabase from Firebase fallback?**
   - Partially: Only `verify-id-token.ts` outputs `[auth:fallback]`. Supabase authentication emits no stdout log.
4. **Does it identify the endpoint/path?**
   - **NO.** The current log outputs only the UID, omitting `request.url` or route pathname.
5. **Does it expose counts or individual events?**
   - Only individual log events. No counter or aggregate metric exists.
6. **Does it log secrets or PII?**
   - It does NOT log tokens or passwords.
   - **However, it DOES log the user's Firebase UID (`decoded.uid`)**, which is persistent personal identity data (PII).
7. **Can production fallback usage currently be measured reliably?**
   - **NO.** Because all 55+ admin routes in `admin-auth.ts` and `set-role/route.ts` emit zero logs when Firebase fallback is used, production telemetry cannot detect whether administrators are still relying on legacy Firebase tokens.
8. **Can an aggregate count be obtained today?**
   - No reliable aggregate count is possible without instrumenting `admin-auth.ts` and `set-role/route.ts`.

---

## 5. Telemetry Gaps & Observability Finding

### Observability Finding:

```
FALLBACK OBSERVABILITY: INSUFFICIENT
```

**Identified Gaps in Current Production:**
1. **Administrative Blindspot:** 55+ admin routes in `lib/auth/admin-auth.ts` have zero fallback logging.
2. **Role Management Blindspot:** `app/api/admin/users/set-role/route.ts` resolves legacy logins via Firebase without logging.
3. **PII Exposure in Public Guard:** `lib/auth/verify-id-token.ts` outputs `decoded.uid` in plain text instead of an aggregate/anonymized metric.
4. **Lack of Structured Event Format:** Existing logs cannot be queried via structured JSON filters in log aggregation tools.

---

## 6. Minimal Safe Telemetry Instrumentation

To close these gaps safely without changing authentication behavior, minimal aggregate-oriented telemetry was authored on a dedicated branch:
- **Branch:** `telemetry/firebase-fallback-observation`
- **Commit SHA:** `e8317dc59abb4f75339f1478e633e3ef986970aa`
- **Files Changed (5 files):**
  1. `lib/auth/fallback-telemetry.ts` (new): Defines structured logger `recordAuthFallback(source, status)`.
  2. `lib/auth/verify-id-token.ts`: Replaces plain-text UID log with structured event `recordAuthFallback("verify-id-token", "verified")`.
  3. `lib/auth/admin-auth.ts`: Emits `recordAuthFallback("admin-auth", "verified")` upon successful Firebase fallback.
  4. `app/api/admin/users/set-role/route.ts`: Emits `recordAuthFallback("set-role", "identity_resolved")` upon fallback resolution.
  5. `tests/unit/auth-fallback-telemetry.test.ts` (new): Unit test suite verifying format, PII absence, and safety guarantees.

### 6.1. Log Event Specification
The emitted event conforms to:
```json
[telemetry:auth_fallback] {
  "event": "auth_fallback_invoked",
  "provider": "firebase",
  "source": "verify-id-token" | "admin-auth" | "set-role",
  "status": "verified" | "identity_resolved",
  "timestamp": "2026-11-09T00:30:13.544Z"
}
```

### 6.2. Invariant Safety Guarantees
- **Authentication Behavior:** Identical. Zero changes to return types, status codes, or control flow.
- **Supabase-First Precedence:** Identical. Supabase Auth is evaluated first; telemetry triggers only when Firebase fallback executes.
- **Firebase Fallback Preservation:** Identical. All fallback paths remain fully functional.
- **Zero Secrets / Tokens / Passwords:** The payload contains strictly static strings and an ISO timestamp.
- **Zero PII:** No user IDs, emails, names, IP addresses, or cookie data are emitted.
- **Test Verification:** Verified via `npm test` (**37/37 tests passing**, including new telemetry suite and existing auth suites).
- **Deployment Status:** **UNMERGED.** Isolated on `telemetry/firebase-fallback-observation`.

---

## 7. Exact Production Measurement Method

Once the telemetry instrumentation branch is deployed to production, observation must be conducted using Vercel Log Drains / Runtime Log Search:

### Query Filter:
```
"[telemetry:auth_fallback]"
```

### Breakdown by Source:
- Admin routes fallback: `"[telemetry:auth_fallback]" AND "admin-auth"`
- Public/Devotee routes fallback: `"[telemetry:auth_fallback]" AND "verify-id-token"`
- Role management fallback: `"[telemetry:auth_fallback]" AND "set-role"`

### Success Criterion for Phase 4 Readiness:
**Total Invocations = 0** across the full observation period.

---

## 8. Observation Window Recommendation

A concrete observation window is required to ensure that normal user traffic cycles (weekly devotee bookings, staff weekend seva operations, and administrative billing cycles) have elapsed before cutting fallback code:

- **Recommended Duration:** **14 calendar days** (minimum 7 calendar days).
- **Proposed Window:** `2026-11-10 00:00 IST` → `2026-11-24 00:00 IST`.
- **Target Invocations:** **0** production fallback invocations across all sources.
- **Gate Rule:** If any fallback invocations occur during the window, inspect the `source` field to identify whether active devotees or administrators are using unmigrated sessions. Reset the observation window after resolution.

---

## 9. Security & Privacy Assessment

| Security Attribute | Assessment | Evidence |
|:---|:---:|:---|
| **Access / ID Tokens** | **Excluded** | Verified by `tests/unit/auth-fallback-telemetry.test.ts`. Payload contains only `event`, `provider`, `source`, `status`, `timestamp`. |
| **Passwords / Secrets** | **Excluded** | No credential variables are accessed by the logger. |
| **Cookies / Headers** | **Excluded** | Request headers and cookies are not passed into `recordAuthFallback`. |
| **User Identifiers (PII)** | **Excluded** | Replaced legacy `decoded.uid` logging with static source identifiers. |
| **Service Role Keys** | **Excluded** | No Supabase or Firebase secrets referenced. |

---

## 10. Stash & Refactoring Work Safety

The previously identified stashed refactoring work on `refactor/final-firestore-runtime-removal` was audited:

- **Stash Entries Confirmed Intact:**
  - `stash@{0}: On refactor/final-firestore-runtime-removal: WIP: uncommitted refactor changes`
  - `stash@{1}: On refactor/final-firestore-runtime-removal: WIP: uncommitted changes on refactor/final-firestore-runtime-removal before audit`
  - `stash@{2}: On refactor/final-firestore-runtime-removal: WIP on refactor/final-firestore-runtime-removal`
- **Stash State:** Untouched, unapplied, and undamaged.
- **Working Tree State:** Completely clean (`nothing to commit, working tree clean`).
- **Safety Compliance:** None of the stashed refactoring changes have been applied.

---

## 11. Remaining Prerequisites Before Phase 4 Implementation

Before Phase 4 (Firebase Decommissioning) can begin, the following steps must be completed:

1. **Deploy Telemetry Instrumentation:** Deploy `telemetry/firebase-fallback-observation` (or equivalent minimum logging) to production.
2. **Execute Observation Window:** Run the 14-day observation window and verify that `auth_fallback_invoked` query returns **0 events**.
3. **Database Migration Preparation:** Author a migration for `public.staff` to relax the `firebase_uid text NOT NULL` constraint and adjust trigger `seva_staff_guard` so pure Supabase staff onboarding is supported.
4. **Phase 4 Implementation Approval:** Review and approve the Phase 4 decommissioning sequence.

### Explicit Phase 4 Confirmation:
**Phase 4 implementation has NOT started. Zero Firebase packages, dependencies, environment variables, fallbacks, or database constraints have been modified or removed.**

---

## 12. Final Prerequisite Status

# PHASE 4 PREREQUISITES NOT READY

**Reasoning:** Although the Phase 3.1 verification artifact is now fully reconciled and pushed to GitHub, and the safe telemetry instrumentation has been authored and tested on a dedicated branch, production fallback observability in the live environment remains insufficient until the telemetry is deployed and the observation window has run with zero fallback invocations.

---
*End of Prerequisites Document.*
