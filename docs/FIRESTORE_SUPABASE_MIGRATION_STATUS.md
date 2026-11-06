# Firestore to Supabase Migration Status & Identity Reconciliation

**Audit Date:** 2026-11-06  
**Audit Scope:** Phase 1 Read-Only Identity & Authentication Reconciliation  
**Branch:** `auth-phase1-identity-audit` (PR #387)  
**Target Environments:**  
- **Supabase Production Project:** `kvrkraqjuyxbraccxntk` (PostgreSQL 17.6, region `ap-south-1`)
- **Firebase Project:** `sri-raghavendra-mutt` (Google Cloud multi-region)
**Live Data Modified:** **NO** (Strict read-only verification)

---

## 1. Authentication Systems: Current Coexistence vs. Target Architecture

The repository currently operates **two distinct authentication systems** with strictly segregated operational domains:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CURRENT REPOSITORY STATE                                │
├─────────────────────────────────────────────┬───────────────────────────────────────────┤
│ 1. Firebase Authentication [PRODUCTION GATE]│ 2. Supabase Authentication [SCOPED]       │
├─────────────────────────────────────────────┼───────────────────────────────────────────┤
│ • Devotee Portal: /login, /register, profile│ • Scoped ONLY to Raya AI administration   │
│ • General Admin Portal: /admin/**           │   (/admin/ai/** and /api/ai/**)           │
│ • General Admin API: /api/admin/**          │ • Session: @supabase/ssr cookies / Bearer │
│ • Seva Entry POS & Desk: /seva/**           │ • Auth Source: Supabase auth.users        │
│ • Seva API: /api/seva/**                    │ • Role Source: public.users.auth_user_id  │
│ • Token: Firebase ID token Bearer           │ • Independent of Firebase SDKs            │
│ • Role Source: public.users.firestore_id    │                                           │
│   and Firestore users/{uid}                 │                                           │
└─────────────────────────────────────────────┴───────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Clarification:** Supabase Authentication is **not** currently the primary provider for the overall administration portal or the temple website. It is active **exclusively** on `/admin/ai/*`. The rest of the temple administration (`/admin/*`) and Seva Counter (`/seva/*`) continue to run on Firebase Authentication. Unifying all admin surfaces under Supabase Auth is the objective of Phase 2, not the current state.

---

## 2. Reconciled Firestore Runtime Status (HEAD Verification & Dependencies)

A rigorous verification against the **current HEAD of the repository** (`auth-phase1-identity-audit` / `origin/main`) establishes the exact state of Firestore elimination and isolates pre-existing findings from ongoing remediation tracks.

### 2.1 Content & Domain Services: Clean (Zero Fallback Reads)
All domain and content services have cleanly cut over to Supabase PostgreSQL. There are **zero fallback reads** from Supabase to Firestore in the request path:
* `events`, `sevas`, `quotes`, `gallery_albums`, `gallery_media`, `aaradhanes`, `ai_settings`, `ai_knowledge`, and `settings_documents` read exclusively from Supabase tables.
* Code in `services/chat.server.ts`, `services/knowledge-workflow.service.ts`, and `lib/ai/retrieval/announcements.ts` explicitly rejects Firestore fallback paths (failures fail closed).

### 2.2 Active Firestore Runtime Touchpoints (Current HEAD Verification)
Verification confirms that **four Firestore runtime touchpoints still physically exist in the current HEAD**. The planned **Firestore runtime-elimination task/PR** is not yet merged into this branch. These items are classified as **pre-existing findings captured by the Phase-1 audit**, with the standalone **Firestore Runtime-Elimination PR** identified as their direct remediation dependency:

1. **Page View Logging (`proxy.ts` — Middleware) [PRE-EXISTING / PENDING RUNTIME ELIMINATION]:**
   * **Verification on Current HEAD:** `proxy.ts:4` imports `firebase/firestore` and lines 82–84 invoke `addDoc(collection(firestore, "page_views"), pageViewData)` on every public GET request.
   * **Current State:** Live residual write to Firestore still present in current HEAD.
   * **Remediation Dependency:** Scheduled for removal in the standalone Firestore runtime-elimination task (leaving the client-side Supabase `PageViewTracker.tsx` beacon as the sole analytics writer).
2. **Client-Side Auth Context & Profile Mirror (`services/auth.service.ts` & `context/AuthContext.tsx`) [PRE-EXISTING / PENDING RUNTIME ELIMINATION]:**
   * **Verification on Current HEAD:** `services/auth.service.ts:12-16` imports Firestore methods (`doc, getDoc, setDoc`). `login` and `register` write to `users/{uid}`, and `AuthContext.tsx:74` calls `getUserProfile(uid)`.
   * **Current State:** Client-side Firestore profile mirror remains present in current HEAD.
   * **Remediation Dependency:** Scheduled for elimination in the separate Firestore runtime-elimination task.
3. **Seva Identity Adapter (`lib/seva/server/identity-firebase.ts`) [PRE-EXISTING / PENDING RUNTIME ELIMINATION]:**
   * **Verification on Current HEAD:** `lib/seva/server/identity-firebase.ts:19-21` imports `getAdminFirestore` and line 41 executes `.get()` against Firestore `users/{uid}` to inspect `role` and `isActive`.
   * **Current State:** Server-side Firestore profile dependency remains present in `/api/seva/*`.
   * **Remediation Dependency:** Scheduled for elimination via the Seva `supabaseIdentityAdapter` transition in Phase 2 / Runtime Elimination.
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
| **F-ID-02** | **MISSING** | Supabase `public.staff` | `public.staff` schema has `firebase_uid text NOT NULL UNIQUE` but **no `auth_user_id` column**. | Phase 2 Staff Schema Migration. |
| **F-ID-03** | **MISSING** | Supabase `public.users` | Onboarding staff via `onboardStaff` creates Firebase Auth, Firestore `users/{uid}`, and Supabase `staff`, but **no `public.users` record**. | Phase 2 Synchronized Onboarding. |
| **F-ID-04** | **MISMATCH** | General Admin Guard | `lib/auth/admin-auth.ts` verifies Firebase JWT and queries `public.users.firestore_id`. Missing rows answer `403 user_not_found`. | Phase 2 Dual-Token Verification. |
| **F-ID-05** | **MISMATCH** | Immutability Trigger | `seva_staff_guard` trigger raises an exception on any update to `staff.firebase_uid`. | Phase 2 Additive Column Migration. |
| **F-ID-06** | **LEGACY / PRE-EXISTING** | Seva Identity Adapter | `lib/seva/server/identity.ts` defaults to `firebaseIdentityAdapter`, reading Firestore `users/{uid}` for `isActive`/`role`. | Dedicated Firestore Runtime-Elimination PR. |
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

### 5.2 Additive Schema Migration for `public.staff`
* Create a non-destructive migration in `supabase/migrations/`:
  ```sql
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;
  ```
* Ensure `seva_staff_guard` trigger is evaluated so it allows updating `auth_user_id` while continuing to protect `staff_no` and audit immutability.

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
