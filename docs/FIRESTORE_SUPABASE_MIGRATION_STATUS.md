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
> This document was **re-verified line-by-line against the current `origin/main`** (commit `467eb6d`),
> which corrected several findings that were written against the older 2026-11-06 audit branch:
> F-ID-02, F-ID-03, F-ID-04, F-ID-06, F-ID-07, F-ID-08, F-ID-09, the "Supabase Auth is scoped only
> to `/admin/ai/*`" statement, and §2.2 (there is **no live Firestore runtime touchpoint** on the
> request path). **Firebase has NOT been removed** — it remains a compatibility/fallback path
> (see §7). No staff backfill has been performed, so existing `public.staff` rows may still have
> `auth_user_id IS NULL`.

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
│ • Seva API /api/seva/** (identity.ts        │   profile (Firebase Auth session)          │
│   defaults to supabaseIdentityAdapter)      │ • Firebase Auth SDKs still initialised     │
│ • Raya AI admin: /admin/ai/**, /api/ai/**   │   (lib/firebase.ts, lib/admin-firebase.ts) │
│ • Session: @supabase/ssr cookies / Bearer   │ • Legacy staff lookups keyed on            │
│ • Auth Source: Supabase auth.users          │   staff.firebase_uid (NOT NULL, retained)  │
│ • Role Source: public.users.auth_user_id    │ • Role Source: public.users.firestore_id   │
│ • Staff key: public.staff.auth_user_id      │   (= Firebase UID)                         │
└─────────────────────────────────────────────┴───────────────────────────────────────────┘
```

> [!NOTE]
> **No live Firestore runtime touchpoint remains on the request path.** `proxy.ts` writes no Firestore; page views go to Supabase `page_views`. The Firebase column above lists **Firebase *Auth*** fallbacks (identity), not Firestore data access — see §2.2 for the full re-verification.

> [!IMPORTANT]
> **Clarification (reconciled 2026-11-13):** Supabase Authentication is the **canonical identity direction**. `lib/auth/verify-id-token.ts` verifies Supabase Auth access tokens on its **primary path**, and the Seva identity adapter (`lib/seva/server/identity.ts`) now defaults to `supabaseIdentityAdapter` (`getIdentityAdapter()` returns `testAdapter ?? supabaseIdentityAdapter`). Supabase Auth is therefore active across the Seva API (`/api/seva/**`), Raya AI administration (`/admin/ai/**`, `/api/ai/**`), and any route using the shared token verifier — **not** only `/admin/ai/*` as previously stated.
>
> **Firebase Authentication has NOT been removed.** It remains a **compatibility / fallback path**: the token verifier's secondary path still accepts legacy Firebase ID tokens, `public.staff.firebase_uid` remains `NOT NULL UNIQUE`, and several staff lookups still key on `firebase_uid` (see §7). Unifying the remaining Firebase surfaces under Supabase Auth is ongoing Phase 2 work, not complete.

---

## 2. Reconciled Firestore Runtime Status (HEAD Verification & Dependencies)

A rigorous re-verification against the **current `origin/main`** (commit `467eb6d`, 2026-11-13) establishes the exact state of Firestore elimination and corrects the findings originally captured against the 2026-11-06 audit branch (`auth-phase1-identity-audit` / PR #387).

### 2.1 Content & Domain Services: Clean (Zero Fallback Reads)
All domain and content services have cleanly cut over to Supabase PostgreSQL. There are **zero fallback reads** from Supabase to Firestore in the request path:
* `events`, `sevas`, `quotes`, `gallery_albums`, `gallery_media`, `aaradhanes`, `ai_settings`, `ai_knowledge`, and `settings_documents` read exclusively from Supabase tables.
* Code in `services/chat.server.ts`, `services/knowledge-workflow.service.ts`, and `lib/ai/retrieval/announcements.ts` explicitly rejects Firestore fallback paths (failures fail closed).

### 2.2 Firestore Runtime Touchpoints (re-verified against `origin/main`, 2026-11-13)
A line-by-line re-verification against the **current `origin/main`** (commit `467eb6d`) — not the original 2026-11-06 audit branch — finds **no live Firestore runtime touchpoint on the request path**. Every item the original audit listed has since been eliminated or was already Supabase-backed:

1. **Page-view logging (`proxy.ts`) — ELIMINATED.** `proxy.ts` is now 47 lines and only sets security headers; it contains **no** `firebase/firestore` import and **no** `addDoc(...page_views...)`. Page-view analytics are written to **Supabase** `page_views` via `/api/public/pageview` and read via `/api/admin/web-analytics`; `services/pageviews.service.ts` states "There is no Firestore path."
2. **Devotee profile storage (`services/auth.service.ts`, `context/AuthContext.tsx`) — NO FIRESTORE WRITE.** `services/auth.service.ts` imports only `@/lib/supabase/client` — no Firestore `doc/getDoc/setDoc` (the `firestore_id` strings are the Supabase **column** name). `context/AuthContext.tsx` retains a Firebase **Auth** listener (`firebase/auth` `onAuthStateChanged`) as a rollback / zero-lockout path, but performs no Firestore write.
3. **Seva identity adapter (`lib/seva/server/identity-firebase.ts`) — NO FIRESTORE READ.** It imports `firebase-admin/auth` for login verification and reads the access profile from **Supabase** `public.users`; it does not import `getAdminFirestore`. It is also no longer the default: `getIdentityAdapter()` returns `supabaseIdentityAdapter`.
4. **Site-settings admin gate (`lib/auth/admin.ts`) — ELIMINATED.** `lib/auth/admin.ts` is a 5-line compatibility re-export; `isUserAdmin()` now lives in `lib/auth/admin-auth-compat.ts` and queries **Supabase** `public.users`, not Firestore.

**What remains on `main` (not a Firestore runtime touchpoint):**
* **Firebase Auth (compatibility).** `lib/firebase.ts` (client) and `lib/admin-firebase.ts` `getAdminApp()` / `getAuth()` still back the token verifier's Firebase fallback and the Firebase identity adapter — the "Firebase not removed" path described in §7.3.
* **A residual static import.** `lib/admin-firebase.ts` imports `firebase-admin/firestore` and defines `getAdminFirestore()`, but **no runtime code calls it** (only `scripts/*` ETL/dump tooling does). It is a candidate for a later cleanup PR, not a request-path touchpoint.

**Out of scope:** the `scripts/*` Firestore ETL/dump tooling still reads Firestore directly by design (migration support) and is not part of the application request path.

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
| **F-ID-03** | **RECONCILED** | Supabase `public.users` | `onboardStaff()` **does** provision a matching `public.users` authorization record (upsert by email, setting `role`, `active`, `firestore_id`, and `auth_user_id`), in addition to the Supabase `staff` row. The original "no `public.users` record" finding is stale. | None (onboarding already synchronized). |
| **F-ID-04** | **RECONCILED** | General Admin Guard | `lib/auth/admin-auth.ts` performs **dual-token** verification: **PRIMARY** Supabase Auth (`auth_user_id`), **SECONDARY** Firebase ID token (`firestore_id`) as fallback. Missing rows answer `403 user_not_found`. It no longer verifies *only* Firebase. | None for the primary path; Firebase fallback retained (see §7.3). |
| **F-ID-05** | **MATCHED** | Immutability Trigger | `seva_staff_guard` raises on any change to `staff.id` / `staff.staff_no` / `staff.firebase_uid` and on deletes; it does **not** block `auth_user_id` updates, so the additive column is safe. | None. |
| **F-ID-06** | **RECONCILED** | Seva Identity Adapter | `lib/seva/server/identity.ts:getIdentityAdapter()` returns `testAdapter ?? supabaseIdentityAdapter` — i.e. it **defaults to the Supabase identity adapter**, not `firebaseIdentityAdapter`. `firebaseIdentityAdapter` is still exported as a compatibility adapter but is not selected by default. Both adapters read the access profile from the Supabase `public.users` table (`auth_user_id` / `firestore_id`), not from Firestore. | None for the default path. Retiring the unused Firebase adapter is optional Phase 2 cleanup. |
| **F-ID-07** | **RECONCILED** | Devotee Profile Storage | `services/auth.service.ts` imports only `@/lib/supabase/client` and reads/writes `public.users`; it performs **no Firestore write**. The original "writes profile updates directly to Firestore" finding is stale. | None. |
| **F-ID-08** | **ELIMINATED** | Request Middleware | `proxy.ts` is 47 lines of security-header logic with **no Firestore write**; page views go to Supabase `page_views`. The original `proxy.ts:83` finding is stale. | None. |
| **F-ID-09** | **RECONCILED** | Client Guard Blocker | `components/admin/layout/AdminAuthGuard.tsx` no longer shows a "Firebase Not Configured" screen — it uses the Supabase session as canonical (Firebase config is not required client-side). | None for Supabase-auth paths. |

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

### 5.3 Dual-Token Verification Architecture in `lib/auth/admin-auth.ts` — **SHIPPED**
* `lib/auth/admin-auth.ts` implements the safe fallback chain:
  1. **Primary Check (Supabase Auth):** verifies the Supabase session / Bearer token and authorizes via `public.users.auth_user_id`.
  2. **Secondary Fallback (Firebase Auth):** if no Supabase token/session is present, verifies the Firebase ID token and authorizes via `public.users.firestore_id`.
* This keeps existing Firebase administrators functional while Supabase accounts are onboarded and verified.

### 5.4 Synchronized Admin & Staff Onboarding — **SHIPPED**
* `lib/seva/server/staff.ts:onboardStaff()` provisions a matching `public.users` authorization row (and populates `staff.auth_user_id`) for any staff member it creates; `/api/admin/users/create-admin` does the same for administrators.

---

## 6. Verification & Certification

* **Zero Live Mutations:** Confirmed. No production data, credentials, users, or schema objects were created, altered, or deleted during this diagnostic.
* **Credentials Protected:** Confirmed. No passwords, tokens, API keys, or secret strings are included in this document.
* **Repository Consistency:** Re-verified 2026-11-13 against current `origin/main` (commit `467eb6d`); the findings matrix and §2.2 reflect that revision, not the original 2026-11-06 audit branch.

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

* The token verifier still accepts legacy Firebase ID tokens (secondary path), and `lib/firebase.ts` / `lib/admin-firebase.ts` still initialize the Firebase client/admin SDKs for that fallback.
* `public.staff.firebase_uid` remains `NOT NULL UNIQUE` and is still used as a lookup key in several places (e.g. `lib/seva/server/auth.ts:findStaff()` fallback, `lib/seva/server/staff.ts` `existingLogin()`/`setAccountRole()`, `app/api/admin/users/set-role/route.ts`).
* `lib/admin-firebase.ts` still imports `firebase-admin/firestore` and defines `getAdminFirestore()`; **no runtime code calls it** (only `scripts/*` tooling), and there is no live Firestore write on the request path (§2.2).
* Retiring Firebase entirely is ongoing Phase 2 work and is **not** complete.

### 7.4 Outstanding (not part of this documentation change)

* Backfilling `staff.auth_user_id` for existing rows (would require a reviewed, owner-run data migration).
* Optionally surfacing `auth_user_id` in `STAFF_COLUMNS` / the `StaffMember` DTO (`types/seva-staff.ts`), which currently omit it.
* Migrating the remaining `firebase_uid`-keyed lookups to the canonical key once a backfill exists.
