# Phase 4 Blocker Resolution Report

- **Date:** 2026-11-09T09:30:00+05:30
- **Base Production SHA:** `0d288e62f62170cfa229d442e9de67141f2b17d2` (`origin/main`)
- **Telemetry PR:** [PR #395](https://github.com/ngowda759/Rayaramathaynk/pull/395) (`telemetry/firebase-fallback-observation`)
- **Telemetry Head SHA:** `9058202c4fc7ae22115f5c15039327521a004eb7`
- **Review-Only Migration Proposal:** `docs/auth/proposed-migrations/20261201000000_phase4_staff_identity_decouple_proposal.sql`
- **Document Path:** `docs/auth/PHASE-4-BLOCKER-RESOLUTION.md`

---

## 1. Telemetry Deployment Status

The safe, aggregate-oriented Firebase fallback telemetry has been authored, tested, pushed, and opened as a dedicated pull request for owner review:

* **Branch:** `telemetry/firebase-fallback-observation`
* **Head Commit:** `9058202c4fc7ae22115f5c15039327521a004eb7`
* **Pull Request:** [GitHub PR #395](https://github.com/ngowda759/Rayaramathaynk/pull/395)
* **Status:** **PENDING OWNER REVIEW & MERGE (UNMERGED)**
* **Deployment State:** Not yet live in production. In strict accordance with repository safety rules, pull requests are never merged automatically. Production deployment will occur after repository owner review and merge.

---

## 2. Production Deployment SHA

* **Current Production SHA:** `0d288e62f62170cfa229d442e9de67141f2b17d2`
* **Current Production Deployment ID:** `dpl_D4MukBTnweHaYaPHduZsD5VzNWjk`
* **Post-Merge Target Deployment SHA:** The merge commit generated upon merging PR #395 will become the authoritative production deployment SHA for the observation window.

---

## 3. Observation Start Time

* **Planned Start:** Upon confirmed Vercel production deployment of PR #395.
* **Target Timestamp:** `2026-11-10 00:00:00 IST` (or immediately upon deployment confirmation).
* **Pre-condition:** Telemetry logs actively stream to Vercel runtime logs with zero startup errors.

---

## 4. Observation End Time

* **Planned End:** Exactly 14 calendar days following observation start.
* **Target Timestamp:** `2026-11-24 00:00:00 IST`.
* **Duration:** 14 calendar days (336 continuous hours) encompassing multiple weekend temple pooja cycles and administrative billing periods.

---

## 5. Current Fallback Invocation Count

* **Current Status:** `N/A (Pre-deployment)`
* **Measured Baseline:** Production telemetry is not yet active in live deployment `dpl_D4MukBTnweHaYaPHduZsD5VzNWjk`.
* **Required Success Condition:** **0 Firebase fallback invocations** (`[telemetry:auth_fallback]` event count = 0) across all sources throughout the entire 14-day window.

---

## 6. Telemetry Security & Safety Assessment

The telemetry instrumentation was audited against all 7 strict safety criteria:

| Safety Criterion | Status | Evidence / Implementation Details |
|:---|:---:|:---|
| **1. Counts fallback invocations** | **VERIFIED** | Emits `[telemetry:auth_fallback]` with standardized JSON payload (`admin-auth`, `verify-id-token`, `set-role`). |
| **2. Supabase-primary unchanged** | **VERIFIED** | Supabase Auth remains evaluated first; fallback executes only when Supabase is rejected. |
| **3. Zero secret / token / PII exposure** | **VERIFIED** | Enforced by unit tests in `tests/unit/auth-fallback-telemetry.test.ts`. Payload contains static enum strings and an ISO timestamp. No tokens, passwords, cookies, authorization headers, or user identifiers (UIDs/emails) are emitted. |
| **4. Auth/security tests intact** | **VERIFIED** | **68/68** security tests and **67/67** auth unit tests passing without regressions. |
| **5. Fail-safe logging** | **VERIFIED** | `recordAuthFallback` wraps logging in a `try...catch` block. Logging failures are caught and swallowed; telemetry errors CANNOT break authentication. |
| **6. No authorization changes** | **VERIFIED** | Telemetry does not return values or influence control flow; cannot grant or deny permissions. |
| **7. 14-day observation readiness** | **VERIFIED** | Structured JSON logs are directly parseable by Vercel Log Drains / log aggregation queries. |

### Test Verification Summary:
* **TypeScript Typecheck:** Passed (`tsc --noEmit`, 0 errors).
* **ESLint:** Passed (0 errors).
* **Telemetry Unit Tests:** Passed (4/4 tests in `tests/unit/auth-fallback-telemetry.test.ts`).
* **Security Test Suite:** Passed (68/68 tests in `tests/security/`).
* **Auth Unit Test Suite:** Passed (67/67 tests).
* **Production Build:** Passed (`next build` with Turbopack, exit code 0).

---

## 7. `public.staff.firebase_uid` Schema Analysis

A comprehensive audit of database migrations and schemas was performed:

1. **Current Column Type:** `text`
2. **NOT NULL Constraint:** `NOT NULL CHECK (btrim(firebase_uid) <> '')`
3. **UNIQUE Constraint:** `UNIQUE`
4. **Current Data Population:** **100% of existing staff records contain non-null values** (enforced by the NOT NULL and CHECK constraints).
5. **Code Paths Reading `firebase_uid`:**
   * `lib/seva/server/auth.ts` (lines 133-137): Compatibility fallback when `auth_user_id` lookup does not resolve a staff record.
   * `lib/seva/server/counter.ts` (line 618): Reads `staff.firebase_uid` for counter staff status verification.
   * `lib/seva/server/staff.ts` (lines 64, 109, 128, 313, 652): Maps `firebase_uid` to `StaffMember.firebaseUid` and supports lookup by `firebase_uid`.
   * `app/api/admin/users/set-role/route.ts` (line 191): Checks whether an existing staff row corresponds to `firebase_uid`.
6. **Code Paths Writing `firebase_uid`:**
   * `lib/seva/server/staff.ts` (line 409): Passes `firebase_uid: externalUid` to `seva_staff_onboard` RPC.
   * `supabase/migrations/20261021000200_seva_functions_admin.sql` (`seva_staff_onboard`): Strictly requires `p_staff ->> 'firebase_uid'`, validates non-emptiness, checks uniqueness, and inserts `firebase_uid`.
   * `scripts/seva/create-first-super-admin.ts`: Passes `p_firebase_uid` to bootstrap RPC.
7. **Tests Depending on `firebase_uid`:**
   * `tests/db/seva-schema.test.ts`
   * `tests/db/seva-admin.test.ts`
   * `tests/unit/staff-auth-user-id-migration.test.ts`
   * `tests/unit/synchronized-onboarding.test.ts`
   * `tests/unit/auth-identity-reconciliation.test.ts`
   * `tests/unit/seva/api-counter.test.ts`
   * `tests/unit/seva/api-staff.test.ts`
   * `tests/unit/seva/legacy-user-routes.test.ts`
   * `tests/unit/seva/seva-auth.test.ts`
8. **Authorization Dependency:**
   * Seva route guard (`lib/seva/server/auth.ts`) still contains fallback resolution by `firebase_uid` for any staff member whose row lacks `auth_user_id`.

---

## 8. `seva_staff_guard` Analysis

The trigger and function definition in `supabase/migrations/20261020000000_seva_core.sql` was audited:

```sql
CREATE OR REPLACE FUNCTION seva_staff_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'seva guard: staff rows are never deleted; set status to deleted with a reason instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.staff_no IS DISTINCT FROM OLD.staff_no THEN
    RAISE EXCEPTION 'seva guard: a staff number never changes and is never reused'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid THEN
    RAISE EXCEPTION 'seva guard: a staff login (firebase_uid) never changes; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status = 'deleted' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'seva guard: a deleted staff member stays deleted; invite a new staff member instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
```

### Key Trigger Findings:
1. **Trigger Definition:** `CREATE OR REPLACE TRIGGER seva_staff_guard BEFORE UPDATE OR DELETE ON staff FOR EACH ROW EXECUTE FUNCTION seva_staff_guard();`
2. **Immutability Enforcement:** The trigger strictly forbids changing or removing `firebase_uid` on any existing row (`IF NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid THEN RAISE EXCEPTION ...`).
3. **Additive Update Compatibility:** Updating `auth_user_id` while keeping `firebase_uid` identical does not violate the trigger (verified in `tests/unit/staff-auth-user-id-migration.test.ts`).
4. **Phase 4 Modification Requirement:** Before `firebase_uid` can be deprecated or made optional for newly onboarded staff, the trigger function must be updated so that:
   - For rows where `firebase_uid` is assigned, immutability is still preserved (`OLD.firebase_uid IS NOT NULL AND NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid`).
   - For rows onboarded purely with Supabase Auth, `firebase_uid` may remain `NULL`.
   - `auth_user_id` immutability is newly guarded once set (`OLD.auth_user_id IS NOT NULL AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id`).

---

## 9. Staff Identity Reconciliation Findings

1. **Schema Readiness:** Migration `20261116000000_add_auth_user_id_to_staff.sql` added `public.staff.auth_user_id uuid UNIQUE`.
2. **Onboarding Synchronization:** `lib/seva/server/staff.ts:onboardStaff` automatically links `auth_user_id` to `public.staff` and `public.users` when present.
3. **Operator Validation Gate:** Production database credentials (`SUPABASE_SERVICE_ROLE_KEY`) are deliberately restricted and not accessible in the development sandbox. Therefore, production staff data validation remains a human/operator gate.
4. **Operator Verification Queries:** The operator must run the following queries against production PostgreSQL before scheduling Phase 4:

```sql
-- 1. Identify staff records missing auth_user_id
SELECT id, staff_no, full_name, email, status, firebase_uid, auth_user_id
FROM public.staff
WHERE auth_user_id IS NULL;

-- 2. Verify uniqueness of auth_user_id across staff
SELECT auth_user_id, count(*)
FROM public.staff
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING count(*) > 1;

-- 3. Verify valid UUID format
SELECT id, staff_no, auth_user_id
FROM public.staff
WHERE auth_user_id IS NOT NULL
  AND auth_user_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 4. Check whether staff records match active Supabase Auth users
SELECT s.id, s.staff_no, s.email, s.firebase_uid, s.auth_user_id,
       au.id AS auth_user_exists
FROM public.staff s
LEFT JOIN auth.users au ON au.id = s.auth_user_id
WHERE s.status IN ('active', 'invited');
```

---

## 10. Proposed Migration Strategy

A review-only migration proposal has been prepared and placed in documentation storage:

* **File:** `docs/auth/proposed-migrations/20261201000000_phase4_staff_identity_decouple_proposal.sql`
* **Status:** **REVIEW ONLY — NOT FOR PRODUCTION APPLICATION**
* **Strategy:**
  1. **Pre-condition Assertion:** Pl/pgSQL assertion verifying zero active staff have `auth_user_id IS NULL`.
  2. **Relax NOT NULL:** `ALTER TABLE public.staff ALTER COLUMN firebase_uid DROP NOT NULL;`
  3. **Relax String Check:** Replace check constraint to permit NULL (`CHECK (firebase_uid IS NULL OR btrim(firebase_uid) <> '')`).
  4. **Maintain Uniqueness:** Retain unique constraint / partial unique index on non-null `firebase_uid`.
  5. **Update `seva_staff_guard`:** Guard immutability on non-null `firebase_uid` and newly guard immutability on `auth_user_id`.
  6. **Update `seva_staff_onboard` RPC:** Accept `auth_user_id` as primary onboarding identifier; make `firebase_uid` optional.

---

## 11. Rollback Strategy

If a regression occurs during Phase 4 and rollback to legacy `firebase_uid NOT NULL` is required:

1. **Audit New Records:** Query any staff rows created with `firebase_uid IS NULL`:
   ```sql
   SELECT id, email, auth_user_id FROM public.staff WHERE firebase_uid IS NULL;
   ```
2. **Backfill Synthetic Identifiers:** Generate unique identifiers for rollback rows:
   ```sql
   UPDATE public.staff SET firebase_uid = 'legacy-sync-' || id::text WHERE firebase_uid IS NULL;
   ```
3. **Restore NOT NULL:**
   ```sql
   ALTER TABLE public.staff ALTER COLUMN firebase_uid SET NOT NULL;
   ```
4. **Restore Functions:** Revert `seva_staff_guard()` and `seva_staff_onboard()` to their definitions in `20261020000000_seva_core.sql` and `20261021000200_seva_functions_admin.sql`.

---

## 12. Remaining Blockers

Before Phase 4 implementation (Firebase Decommissioning) can begin:

1. **Blocker 1 (Telemetry PR Merge):** Repository owner must review and merge [PR #395](https://github.com/ngowda759/Rayaramathaynk/pull/395).
2. **Blocker 2 (Production Deployment):** Telemetry code must be deployed to live Vercel production and confirmed active.
3. **Blocker 3 (14-Day Observation Window):** The 14-day observation window (`2026-11-10` to `2026-11-24`) must conclude with **0 fallback invocations**.
4. **Blocker 4 (Staff Data Validation):** Operator must execute reconciliation SQL queries in production to confirm all active staff rows have valid `auth_user_id`.
5. **Blocker 5 (Review Migration Approval):** Owner must review and approve the decoupled staff identity migration.

---

## Final Verdict

# PHASE 4 BLOCKERS UNRESOLVED

**Reasoning:** Telemetry instrumentation has been authored, verified with unit/security/build tests, pushed to origin, and opened in PR #395. However, PR #395 has not yet been merged by the owner, is not yet deployed to live production, and the 14-day observation window has not officially begun. Additionally, `public.staff.firebase_uid` and `seva_staff_guard` remain constrained in the production schema until post-observation migration approval.

---
*End of Blocker Resolution Document.*
