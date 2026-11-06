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

## 2. Reconciled Firestore Runtime Status (Code Reality vs. Historical Findings)

A comprehensive cross-check between historical documentation (`docs/audits/FIRESTORE_DEPENDENCY_AUDIT.md`) and the active codebase establishes the exact boundary of Firestore elimination:

### 2.1 Content & Domain Services: Clean (Zero Fallback Reads)
All domain and content services have successfully cut over to Supabase PostgreSQL. There are **zero fallback reads** from Supabase to Firestore in the request path:
* `events`, `sevas`, `quotes`, `gallery_albums`, `gallery_media`, `aaradhanes`, `ai_settings`, `ai_knowledge`, and `settings_documents` read exclusively from Supabase tables.
* Code in `services/chat.server.ts`, `services/knowledge-workflow.service.ts`, and `lib/ai/retrieval/announcements.ts` explicitly rejects Firestore fallback paths (failures fail closed).

### 2.2 Active Firestore Runtime Touchpoints (Current Code)
Four specific runtime touchpoints still depend on Firestore and must be addressed during phased migration:

1. **Page View Logging (`proxy.ts` — Middleware):**
   * **Behavior:** Next.js 16 request proxy imports `firebase/firestore` and writes a document to `page_views` collection on every public GET request (`proxy.ts:83`), in parallel with the Supabase client-side beacon (`PageViewTracker.tsx`).
   * **Status:** Live residual write to Firestore.
2. **Client-Side Auth Context & Profile Mirror (`services/auth.service.ts` & `context/AuthContext.tsx`):**
   * **Behavior:** User login (`authService.login`) and registration (`authService.register`) execute `setDoc` on Firestore `users/{uid}`, while `getUserProfile` and `AuthContext` read `users/{uid}` via `getDoc`.
   * **Status:** Client-side Firestore read/write mirror for non-AI users.
3. **Seva Identity Adapter (`lib/seva/server/identity-firebase.ts`):**
   * **Behavior:** In `getAccessProfile(externalUid)`, the adapter reads Firestore `users/{uid}` via Firebase Admin SDK (`db.collection("users").doc(externalUid).get()`) to inspect `role` and `isActive`. In `setAccessProfile`, it writes role/status updates to Firestore.
   * **Status:** Server-side Firestore read/write dependency in `/api/seva/*`.
4. **Site Settings Action Admin Gate (`lib/auth/admin.ts:58-75`):**
   * **Behavior:** `isUserAdmin(uid)` executes `getDoc(doc(db, "users", uid))` against Firestore before allowing `app/actions/settings.ts` to update `site_settings` in Supabase.
   * **Status:** Lingering Firestore authorization dependency for site settings.

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

| Finding Code | Classification | Store / Component | Description & Current State | Risk / Impact |
|---|---|---|---|---|
| **F-ID-01** | **MATCHED** | Supabase Auth $\leftrightarrow$ `public.users` | Raya AI admin account mapped via `auth_user_id` with `active = true` and `role = 'super_admin'`. | None for `/admin/ai/*`. Works as designed. |
| **F-ID-02** | **MISSING** | Supabase `public.staff` | `public.staff` schema has `firebase_uid text NOT NULL UNIQUE` but **no `auth_user_id` column**. | Blocks Seva Counter from using native Supabase Auth. |
| **F-ID-03** | **MISSING** | Supabase `public.users` | Onboarding staff via `onboardStaff` creates Firebase Auth, Firestore `users/{uid}`, and Supabase `staff`, but **no `public.users` record**. | Staff cannot access `/admin/*` without manual row insertion. |
| **F-ID-04** | **MISMATCH** | General Admin Guard | `lib/auth/admin-auth.ts` verifies Firebase JWT and queries `public.users.firestore_id`. Missing rows answer `403 user_not_found`. | Immediate admin lockout if Firebase accounts lack `public.users` rows. |
| **F-ID-05** | **MISMATCH** | Immutability Trigger | `seva_staff_guard` trigger raises an exception on any update to `staff.firebase_uid`. | `firebase_uid` cannot be mutated; migration must add `auth_user_id`. |
| **F-ID-06** | **LEGACY** | Seva Identity Adapter | `lib/seva/server/identity.ts` defaults to `firebaseIdentityAdapter`, reading Firestore `users/{uid}` for `isActive`/`role`. | Dual-datastore dependency for counter operations. |
| **F-ID-07** | **LEGACY** | Devotee Profile Storage | `services/auth.service.ts` writes profile updates directly to Firestore on login/register. | Prevents complete removal of client Firebase SDK. |
| **F-ID-08** | **LEGACY** | Client Guard Blocker | `AdminAuthGuard.tsx` shows "Firebase Not Configured" screen if Firebase env vars are missing. | Blocks access to admin dashboard even when Supabase is up. |

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
* **Repository Consistency:** Confirmed against current codebase on `auth-phase1-identity-audit`.
