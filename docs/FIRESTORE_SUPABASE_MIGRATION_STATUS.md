# Firestore to Supabase Migration Status & Identity Reconciliation

**Audit Date:** 2026-11-06  
**Last Reconciled:** 2026-11-13 (documentation reconciliation after production migration `20261116000000`)  
**Audit Scope:** Phase 1 Read-Only Identity & Authentication Reconciliation  
**Branch:** `auth-phase1-identity-audit` (PR #387)  
**Target Environments:**  
- **Supabase Production Project:** `kvrkraqjuyxbraccxntk` (PostgreSQL 17.6, region `ap-south-1`)
- **Firebase Project:** `sri-raghavendra-mutt` (Google Cloud multi-region)
**Live Data Modified:** **NO** (Strict read-only verification)

> [!NOTE]
> **2026-11-13 reconciliation.** Production migration `20261116000000_add_auth_user_id_to_staff.sql`
> has been applied: `public.staff.auth_user_id uuid UNIQUE` now exists (nullable, no foreign key).
> The findings below (F-ID-02, F-ID-06) and the "Supabase Auth is scoped only to `/admin/ai/*`"
> statement have been corrected to match the shipped code and schema. **Firebase has NOT been
> removed** — it remains a compatibility/fallback path (see §7). No staff backfill has been
> performed, so existing `public.staff` rows may still have `auth_user_id IS NULL`.

---

## 1. Authentication Systems: Current Coexistence vs. Target Architecture

The repository currently operates **two distinct authentication systems** with strictly segregated operational domains:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CURRENT REPOSITORY STATE                                │
├─────────────────────────────────────────────┬───────────────────────────────────────────┤
│ 1. Supabase Auth [PRIMARY / CANONICAL]      │ 2. Firebase Auth [COMPATIBILITY / FALLBACK]│
├─────────────────────────────────────────────┼───────────────────────────────────────────┤
│ • Primary token path in lib/auth/verify-id- │ • Secondary/fallback token path (legacy    │
│   token.ts (createAdminClient().auth.       │   Firebase ID tokens still verify)         │
│   getUser(token))                           │ • Devotee Portal: /login, /register,       │
│ • Seva API /api/seva/** (identity.ts        │   profile (Firestore profile mirror)       │
│   defaults to supabaseIdentityAdapter)      │ • Remaining Firestore runtime touchpoints  │
│ • Raya AI admin: /admin/ai/**, /api/ai/**   │   (proxy.ts page_views, admin.ts gate)     │
│ • Session: @supabase/ssr cookies / Bearer   │ • Legacy staff lookups keyed on            │
│ • Auth Source: Supabase auth.users          │   staff.firebase_uid (NOT NULL, retained)  │
│ • Role Source: public.users.auth_user_id    │ • Role Source: public.users.firestore_id   │
│ • Staff key: public.staff.auth_user_id      │   and Firestore users/{uid}                │
└─────────────────────────────────────────────┴───────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Clarification (reconciled 2026-11-13):** Supabase Authentication is the **canonical identity direction**. `lib/auth/verify-id-token.ts` verifies Supabase Auth access tokens on its **primary path**, and the Seva identity adapter (`lib/seva/server/identity.ts`) now defaults to `supabaseIdentityAdapter` (`getIdentityAdapter()` returns `testAdapter ?? supabaseIdentityAdapter`). Supabase Auth is therefore active across the Seva API (`/api/seva/**`), Raya AI administration (`/admin/ai/**`, `/api/ai/**`), and any route using the shared token verifier — **not** only `/admin/ai/*` as previously stated.
>
> **Firebase Authentication has NOT been removed.** It remains a **compatibility / fallback path**: the token verifier's secondary path still accepts legacy Firebase ID tokens, `public.staff.firebase_uid` remains `NOT NULL UNIQUE`, and several staff lookups still key on `firebase_uid` (see §7). Unifying the remaining Firebase surfaces under Supabase Auth is ongoing Phase 2 work, not complete.

---

## 2. Reconciled Firestore Runtime Status (HEAD Verification & Dependencies)

A rigorous verification against the **current HEAD of the repository** (`auth-phase1-identity-audit` / `origin/main`) establishes the exact state of Firestore elimination and isolates pre-existing findings from ongoing remediation tracks.

### 2.1 Content & Domain Services: Clean (Zero Fallback Reads)
All domain and content services have cleanly cut over to Supabase PostgreSQL. There are **zero fallback reads** from Supabase to Firestore in the request path:
* `events`, `sevas`, `quotes`, `gallery_albums`, `gallery_media`, `aaradhanes`, `ai_settings`, `ai_knowledge`, and `settings_documents` read exclusively from Supabase tables.
* Code in `services/chat.server.ts`, `services/knowledge-workflow.service.ts`, and `lib/ai/retrieval/announcements.ts` explicitly rejects Firestore fallback paths (failures fail closed).

### 2.2 Active Firestore Runtime Touchpoints (Current HEAD Verification)
Verification confirms that **three Firestore runtime touchpoints still physically exist in the current HEAD** (the Seva identity adapter, item 3 below, was reconciled on 2026-11-13 and no longer reads Firestore). The planned **Firestore runtime-elimination task/PR** is not yet merged into this branch. These items are classified as **pre-existing findings captured by the Phase-1 audit**, with the standalone **Firestore Runtime-Elimination PR** identified as their direct remediation dependency:

1. **Page View Logging (`proxy.ts` — Middleware) [PRE-EXISTING / PENDING RUNTIME ELIMINATION]:**
   * **Verification on Current HEAD:** `proxy.ts:4` imports `firebase/firestore` and lines 82–84 invoke `addDoc(collection(firestore, "page_views"), pageViewData)` on every public GET request.
   * **Current State:** Live residual write to Firestore still present in current HEAD.
   * **Remediation Dependency:** Scheduled for removal in the standalone Firestore runtime-elimination task (leaving the client-side Supabase `PageViewTracker.tsx` beacon as the sole analytics writer).
2. **Client-Side Auth Context & Profile Mirror (`services/auth.service.ts` & `context/AuthContext.tsx`) [PRE-EXISTING / PENDING RUNTIME ELIMINATION]:**
   * **Verification on Current HEAD:** `services/auth.service.ts:12-16` imports Firestore methods (`doc, getDoc, setDoc`). `login` and `register` write to `users/{uid}`, and `AuthContext.tsx:74` calls `getUserProfile(uid)`.
   * **Current State:** Client-side Firestore profile mirror remains present in current HEAD.
   * **Remediation Dependency:** Scheduled for elimination in the separate Firestore runtime-elimination task.
3. **Seva Identity Adapter (`lib/seva/server/identity-firebase.ts`) [RECONCILED 2026-11-13 — no longer a Firestore read]:**
   * **Verification on Current HEAD:** `lib/seva/server/identity-firebase.ts` imports `firebase-admin/auth` (for login verification) and reads the access profile from the **Supabase `public.users` table** (`auth_user_id` / `firestore_id`) — it no longer imports `getAdminFirestore` or executes a Firestore `.get()`. This adapter is also no longer the default; `getIdentityAdapter()` returns `supabaseIdentityAdapter`.
   * **Current State:** The adapter's profile read is Supabase-backed. Firebase Admin is still loaded for legacy ID-token verification (see §7.3).
   * **Remediation Dependency:** Optional Phase 2 cleanup to retire the now-unused `firebaseIdentityAdapter`.
4. **Site Settings Action Admin Gate (`lib/auth/admin.ts:58-75`) [PRE-EXISTING / PENDING RUNTIME ELIMINATION]:**
   * **Verification on Current HEAD:** `isUserAdmin(uid)` executes `getDoc(doc(db, "users", uid))` against Firestore before allowing `app/actions/settings.ts` to write `site_settings` in Supabase.
   * **Current State:** Lingering Firestore authorization check remains present in current HEAD.
   * **Remediation Dependency:** Scheduled for replacement by Supabase `public.users` role inspection in the Firestore runtime-elimination task.

---

## 3. Identity Verification & Admin Record Count

### 3.1 Observed vs. Authorized Admin Counts
* **Observed in Read-Only Inventory:** The read-only production table inventory (`docs/audits/PRODUCTION_TABLE_INVENTORY.md` §1a line 39) records **1 row** in `public.users` confirmed via the public statistics endpoint (`/api/public/stats` `totalUsers`).
* **Critical Distinction:** This single confirmed row reflects only what is surfaced through the public stats aggregation. It **does NOT imply that only one administrator exists** across the organization.
* **Lockout Exposure:** Any administrators or staff members created directly in Firebase Auth or via older scripts whose `firestore_id` or `auth_user_id` has not been mapped into `public.users` will be rejected by `lib/auth/admin-auth.ts` with `403 user_not_found`. Full enumeration requires a privileged service-role reconciliation query before migration.

### 3.2 Schema Structure on `public.users`
* `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
* `firestore_id text UNIQUE` (Provenance key matching Firebase Auth UID)
* `auth_user_id uuid UNIQUE` (Guarded by partial index `idx_users_auth_user_id WHERE auth_user_id IS NOT NULL`)
* `role text DEFAULT 'user'`, `active boolean DEFAULT true`

---

## 4. Reconciliation Findings Matrix

| Finding Code | Classification | Store / Component | Description & Current State in HEAD | Remediation Dependency |
|---|---|---|---|---|
| **F-ID-01** | **MATCHED** | Supabase Auth $\leftrightarrow$ `public.users` | Raya AI admin account mapped via `auth_user_id` with `active = true` and `role = 'super_admin'`. | None for `/admin/ai/*`. Works as designed. |
| **F-ID-02** | **MATCHED** | Supabase `public.staff` | `public.staff` now has `auth_user_id uuid UNIQUE` (nullable, no FK) — applied via migration `20261116000000_add_auth_user_id_to_staff.sql`. `lib/seva/server/auth.ts:findStaff()` uses it as the canonical lookup when the external UID is a UUID; `firebase_uid` is retained as a fallback. Existing rows may still be `NULL` (no backfill). | None (column shipped). Backfill of existing rows remains outstanding — see §7. |
| **F-ID-03** | **MISSING** | Supabase `public.users` | Onboarding staff via `onboardStaff` creates Firebase Auth, Firestore `users/{uid}`, and Supabase `staff`, but **no `public.users` record**. | Phase 2 Synchronized Onboarding. |
| **F-ID-04** | **MISMATCH** | General Admin Guard | `lib/auth/admin-auth.ts` verifies Firebase JWT and queries `public.users.firestore_id`. Missing rows answer `403 user_not_found`. | Phase 2 Dual-Token Verification. |
| **F-ID-05** | **MISMATCH** | Immutability Trigger | `seva_staff_guard` trigger raises an exception on any update to `staff.firebase_uid`. | Phase 2 Additive Column Migration. |
| **F-ID-06** | **RECONCILED** | Seva Identity Adapter | `lib/seva/server/identity.ts:getIdentityAdapter()` returns `testAdapter ?? supabaseIdentityAdapter` — i.e. it **defaults to the Supabase identity adapter**, not `firebaseIdentityAdapter`. `firebaseIdentityAdapter` is still exported as a compatibility adapter but is not selected by default. Both adapters read the access profile from the Supabase `public.users` table (`auth_user_id` / `firestore_id`), not from Firestore. | None for the default path. Retiring the unused Firebase adapter is optional Phase 2 cleanup. |
| **F-ID-07** | **LEGACY / PRE-EXISTING** | Devotee Profile Storage | `services/auth.service.ts` writes profile updates directly to Firestore on login/register. | Dedicated Firestore Runtime-Elimination PR. |
| **F-ID-08** | **LEGACY / PRE-EXISTING** | Request Middleware | `proxy.ts:83` writes page-view documents to Firestore `page_views` collection. | Dedicated Firestore Runtime-Elimination PR. |
| **F-ID-09** | **LEGACY / PRE-EXISTING** | Client Guard Blocker | `AdminAuthGuard.tsx` shows "Firebase Not Configured" screen if Firebase env vars are missing. | Phase 2 Admin Guard Unification. |

---

## 5. Phase 2 Prerequisites & Implementation Requirements

To ensure a seamless, zero-lockout transition to unified Supabase authentication, the following prerequisites must be implemented in **Phase 2**:

### 5.1 Full Privileged Identity Enumeration & Mapping
* Execute a server-side read-only diagnostic script using `SUPABASE_SERVICE_ROLE_KEY` and Firebase service credentials to compile a complete list of:
  - All Firebase Auth user UIDs and emails.
  - All Supabase Auth user IDs and emails.
  - All rows in `public.users` (`id`, `email`, `role`, `active`, `firestore_id`, `auth_user_id`).
  - All rows in `public.staff` (`id`, `email`, `staff_no`, `status`, `firebase_uid`).
* Ensure 100% of active administrators and staff have verified records in both Auth and database authorization tables before enabling cutover.

### 5.2 Additive Schema Migration for `public.staff` — **APPLIED**
* **Shipped.** The non-destructive migration `supabase/migrations/20261116000000_add_auth_user_id_to_staff.sql` was applied to production on 2026-11-13:
  ```sql
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;
  ```
* `seva_staff_guard` continues to protect `firebase_uid` (it raises only when `NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid`), so populating `auth_user_id` does not trip the immutability trigger.
* **No backfill was performed.** Existing `public.staff` rows may still have `auth_user_id IS NULL`; they fall back to the `firebase_uid` lookup. See §7.

### 5.3 Dual-Token Verification Architecture in `lib/auth/admin-auth.ts`
* Update `verifyAdminUserResult` with a safe fallback chain:
  1. **Primary Check (Supabase Auth):** Check for Supabase session cookie (`@supabase/ssr`) or Supabase Bearer token. Resolve caller and check authorization via `public.users.auth_user_id`.
  2. **Secondary Fallback (Firebase Auth):** If no Supabase token/session is present, verify the Firebase ID token and authorize via `public.users.firestore_id`.
* This ensures existing Firebase administrators remain fully functional while Supabase accounts are onboarded and verified.

### 5.4 Synchronized Admin & Staff Onboarding
* Update `/api/admin/users/create-admin` and `lib/seva/server/staff.ts:onboardStaff` so that any staff or administrator created is automatically provisioned with a matching authorization row in `public.users`.

---

## 6. Verification & Certification

* **Zero Live Mutations:** Confirmed. No production data, credentials, users, or schema objects were created, altered, or deleted during this diagnostic.
* **Credentials Protected:** Confirmed. No passwords, tokens, API keys, or secret strings are included in this document.
* **Repository Consistency:** Confirmed against current codebase HEAD on `auth-phase1-identity-audit`.

---

## 7. Staff Identity Unification — Current State (reconciled 2026-11-13)

This section records the shipped state after production migration `20261116000000` was applied. It exists to prevent the earlier "Firebase fully migrated away" reading.

### 7.1 Supabase Auth is the canonical direction

* `lib/auth/verify-id-token.ts` verifies **Supabase Auth** access tokens on its primary path (`createAdminClient().auth.getUser(token)`); Firebase ID token verification is the secondary/compatibility path.
* `lib/seva/server/identity.ts` defaults to `supabaseIdentityAdapter`.
* `lib/seva/server/auth.ts:findStaff()` looks up the staff row by `auth_user_id` **first** when the caller's external UID is a UUID, then falls back to `firebase_uid`.

### 7.2 `staff.auth_user_id` is populated for new staff, not existing rows

* `lib/seva/server/staff.ts:onboardStaff()` populates `staff.auth_user_id` (and the matching `public.users` row) for **newly onboarded or linked** staff when a Supabase identity is available.
* **No backfill has been performed.** Staff rows created before this rollout, or onboarded without a Supabase identity, may still have `auth_user_id IS NULL`. Such rows are resolved through the `firebase_uid` fallback and are **not** broken — they are simply not yet linked to Supabase Auth.

### 7.3 Firebase remains a compatibility / fallback path (NOT removed)

* The token verifier still accepts legacy Firebase ID tokens.
* `public.staff.firebase_uid` remains `NOT NULL UNIQUE` and is still used as a lookup key in several places (e.g. `lib/seva/server/staff.ts` `existingLogin()`/`setAccountRole()`, `app/api/admin/users/set-role/route.ts`, `lib/seva/server/counter.ts`).
* Other Firestore runtime touchpoints listed in §2.2 remain in place.
* Retiring Firebase entirely is ongoing Phase 2 work and is **not** complete.

### 7.4 Outstanding (not part of this documentation change)

* Backfilling `staff.auth_user_id` for existing rows (would require a reviewed, owner-run data migration).
* Optionally surfacing `auth_user_id` in `STAFF_COLUMNS` / the `StaffMember` DTO (`types/seva-staff.ts`), which currently omit it.
* Migrating the remaining `firebase_uid`-keyed lookups to the canonical key once a backfill exists.
