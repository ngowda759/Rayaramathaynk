# Firestore to Supabase Migration Status & Identity Reconciliation

**Audit Date:** 2026-11-06  
**Audit Scope:** Phase 1 Read-Only Identity & Authentication Reconciliation  
**Branch:** `auth-phase1-identity-audit`  
**Target Environments:**  
- **Supabase Target:** `kvrkraqjuyxbraccxntk` (PostgreSQL 17.6, region `ap-south-1`)
- **Firebase Legacy:** `sri-raghavendra-mutt` (Google Cloud multi-region)
**Live Data Modified:** **NO** (Strict read-only verification)

---

## 1. Executive Summary & Identity Reconciliation Matrix

This diagnostic reconciles identities across the four authorization stores operating in the repository:
1. **Firebase Authentication** (Legacy Auth provider for public devotees, general admins, and seva staff)
2. **Supabase Authentication** (Native Auth provider for Raya AI administration)
3. **Supabase `public.users`** (Authoritative application RBAC table)
4. **Supabase `public.staff`** (Authoritative counter terminal operations and POS staff table)

### Identity Cross-Reference Summary

| Store / Table | Key Identifier | Active Records | Role / Permission Authority | Target Architecture Status |
|---|---|---:|---|---|
| **Firebase Auth** | `uid` (Firebase UID) | Legacy admin / devotee base | Issued client JWT | **LEGACY** (Retain until Phase 4/5 cutover) |
| **Supabase Auth** | `id` (UUID `auth.users.id`) | Admin account(s) (`/admin/ai`) | Native session cookies / JWT | **TARGET** (Primary for all administrative surfaces) |
| **Supabase `public.users`** | `id` (UUID), `firestore_id`, `auth_user_id` | 1 confirmed admin row (live inventory) | Authoritative `role`, `active` | **TARGET** (Authoritative RBAC for `/admin/*`) |
| **Supabase `public.staff`** | `id` (UUID), `firebase_uid`, `staff_no` | Counter staff & admin operators | Operational POS status (`active`, `view_only`) | **TRANSITIONAL / NEEDS ACTION** (Requires `auth_user_id`) |
| **Firestore `users/{uid}`** | `uid` | Mirror of devotee/staff profiles | Legacy mirror read by Seva & Client | **LEGACY** (Phase out reads/writes) |

---

## 2. Methodology & Evidence Sources

1. **Production Table Inventory:** Corroborated against read-only catalog and service-endpoint proofs (`docs/audits/PRODUCTION_TABLE_INVENTORY.md` §1a line 39, confirming `users` count = 1).
2. **Schema & Migration Analysis:** Evaluated 45+ migrations in `supabase/migrations/` (notably `20261001000000_create_content_tables.sql`, `20261020000000_seva_core.sql`, and `20261103000000_add_auth_user_id_to_users.sql`).
3. **Guard Code Inspection:** Audited `lib/auth/admin-auth.ts`, `lib/auth/raya-admin-auth.ts`, `lib/seva/server/auth.ts`, and `lib/seva/server/identity-firebase.ts`.
4. **Zero Live Mutation:** Verified that no DDL, DML, user creation, linking, or credential mutation occurred during this audit.

---

## 3. Reconciliation Findings by Category

### A. MATCHED
* **Raya AI Admin Identity:**
  * **Mechanism:** Verified Supabase Auth identity matching `public.users.auth_user_id` with `active = true` and `role = 'super_admin'`.
  * **Status:** Fully functional and isolated under `lib/auth/raya-admin-auth.ts` for `/admin/ai/*` and `/api/ai/*`.
  * **Integrity Control:** Guarded by partial unique index `idx_users_auth_user_id` on `public.users (auth_user_id) WHERE auth_user_id IS NOT NULL`.

### B. MISSING
* **`auth_user_id` on `public.staff` Table:**
  * **Finding:** Supabase `staff` schema (`20261020000000_seva_core.sql`) currently defines only `firebase_uid text NOT NULL UNIQUE`. It completely lacks an `auth_user_id uuid` column.
  * **Impact:** Seva Counter staff cannot authenticate through native Supabase Auth until a column and identity mapping are introduced.
* **Supabase `public.users` Rows for Seva-Onboarded Staff:**
  * **Finding:** When a staff member or administrator is onboarded via `/api/admin/users/create-admin` or `lib/seva/server/staff.ts:onboardStaff`, rows are created in Firebase Auth, Firestore `users/{uid}`, and Supabase `staff`, but **no record is created in Supabase `public.users`**.

### C. MISMATCH & LOCKOUT RISKS
* **The `403 user_not_found` Admin Failure:**
  * **Finding:** General admin route guard (`lib/auth/admin-auth.ts:147-164`) decodes the Firebase ID token and queries:
    ```sql
    SELECT role, active, email FROM public.users WHERE firestore_id = $1;
    ```
  * **Failure Mode:** If an administrator account exists in Firebase Auth but has no matching row in `public.users` where `firestore_id = firebase_uid`, the API returns `403 user_not_found`, locking out the administrator from all general admin functions.
* **Trigger-Enforced Immutability on `staff.firebase_uid`:**
  * **Finding:** Trigger `seva_staff_guard` on `public.staff` raises an exception (`seva guard: a staff login (firebase_uid) never changes`) on any update to `firebase_uid`.
  * **Impact:** Modifying `firebase_uid` in-place is impossible; migrating staff to Supabase Auth requires adding a distinct `auth_user_id` column.

### D. LEGACY DEPENDENCIES
* **General Admin API Route Token Verification:**
  * `lib/auth/admin-auth.ts` still requires the server-side Firebase Admin SDK (`firebase-admin/auth`) to decode bearer tokens.
* **Seva Counter Identity Adapter:**
  * `lib/seva/server/identity.ts` defaults to `firebaseIdentityAdapter`, which queries Firestore `users/{uid}` via Admin SDK to check `isActive` and `role`.
* **Client-Side Profile Storage:**
  * `services/auth.service.ts` and `context/AuthContext.tsx` read and write `users/{uid}` in Firestore on user login and registration.
* **Client Environment Hardening:**
  * `components/admin/layout/AdminAuthGuard.tsx` still renders a blocking "Firebase Not Configured" screen if Firebase environment variables are missing, even when Supabase is fully configured.

### E. NEEDS ACTION (Prerequisites for Phase 2 Migration)
1. **Dual-Token Verification in `lib/auth/admin-auth.ts`:**
   * Extend the admin verifier to check for Supabase Auth session/token first (matching `auth_user_id`), falling back to Firebase bearer token (`firestore_id`).
2. **Staff Schema Migration:**
   * Prepare an additive SQL migration to add `auth_user_id uuid NULL UNIQUE` to `public.staff`, allowing counter operators to bind to Supabase Auth identities.
3. **Identity Sync Script:**
   * Provide a safe, read-only diagnostic report script to verify that any admin email intended to access `/admin/*` possesses both a Supabase Auth account and a mapped `public.users` authorization row.

---

## 4. Collection-Level Migration Inventory

| Collection / Entity | Firestore Status | Supabase Target Table | Migration / State | Action Required |
|---|---|---|---|---|
| `users` (Admin authorization) | Non-authoritative mirror | `public.users` | Migrated (1 confirmed admin row in prod) | Dual-auth support in route guards |
| `staff` (Counter staff) | Firestore `users` mirror | `public.staff` | Migrated (POS tables live in Supabase) | Add `auth_user_id` column |
| `profiles` (Devotee bookmarks/preferences) | Legacy datastore | `public.profiles` | Schema exists; data unmigrated | Plan devotee migration in Phase 5 |
| `events` | Deprecated | `public.events` | Fully cut over (74 published rows) | Clean |
| `sevas` / `seva_bookings` | Deprecated | `public.sevas`, `seva_bookings` | Fully cut over | Clean |
| `quotes` | Deprecated | `public.quotes` | Fully cut over (6 seed rows) | Clean |
| `gallery` | Deprecated | `public.gallery_albums`, `gallery_media` | Fully cut over (4 albums, 7 media) | Clean |
| `ai_settings` / `ai_knowledge` | Deprecated | `public.ai_settings`, `ai_knowledge` | Fully cut over (19 articles) | Clean |
| `page_views` | **Residual write** (`proxy.ts`) | `public.page_views` | Dual-write active | Remove Firestore write in `proxy.ts` |

---

## 5. Certification

* **Zero Live Data Modified:** Confirmed. No production data or schemas were altered.
* **Credentials & Secrets Protected:** Confirmed. No API keys, passwords, hashes, or tokens are logged or persisted in this document.
* **Verification Status:** Ready for review and promotion to PR.
