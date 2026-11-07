# Phase 2 — Supabase Authentication Identity Unification

## Overview

This document specifies the Phase 2 authentication and identity unification architecture for the Sri Raghavendra Swamy Matha Temple website (`Rayaramathaynk`).

The objective is moving the temple platform's administrative and operational authorization model toward **Supabase Auth + Supabase PostgreSQL**, while preserving existing Firebase Authentication functionality during the migration transition period.

---

## 1. Current Authentication Architecture

Historically, the platform utilized Firebase Authentication for end-user, staff, and admin authentication:
- **Firebase Auth** issued client-side ID tokens (JWTs) verified server-side with the Firebase Admin SDK (`firebase-admin/auth`).
- **PostgreSQL Database (`public.users`)** linked administrative accounts via `firestore_id` (representing the Firebase Auth UID).
- **PostgreSQL Database (`public.staff`)** linked staff members via `firebase_uid`. An immutability trigger (`seva_staff_guard`) prevents modifying `firebase_uid` once assigned.
- **Raya AI Endpoints** had already migrated to native Supabase Auth tokens (`sb_access_token` or bearer JWT verified against `auth.users`).
- Admin endpoints (`/admin/**`, `/api/admin/**`) and Seva operations (`/seva/**`, `/api/seva/**`) verified requests strictly through Firebase ID tokens, causing a dual-system state where Supabase Auth users lacked unified administrative access.

---

## 2. Dual-Token Transition Architecture

Phase 2 implements a dual-token verification chain in `lib/auth/admin-auth.ts`:

```
Incoming Request (Bearer Authorization or Token Cookie)
                       │
                       ▼
      ┌───────────────────────────────────┐
      │ 1. Attempt Supabase Auth Token    │
      └───────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼ Valid                     ▼ Invalid / Missing
┌─────────────────────────┐   ┌───────────────────────────┐
│ Verify via Supabase     │   │ 2. Fallback to Firebase   │
│ Client (auth.getUser)   │   │    Admin (verifyIdToken)  │
└─────────────────────────┘   └───────────────────────────┘
         │                                   │
         ▼ Authenticated UUID                ▼ Authenticated UID
┌─────────────────────────┐   ┌───────────────────────────┐
│ Query public.users:     │   │ Query public.users:       │
│ auth_user_id = UUID     │   │ firestore_id = UID        │
└─────────────────────────┘   └───────────────────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────────────────────────────────────────────┐
│ Verify: active = true AND role in allowed roles          │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
    Authorize Request with Provider Indication
    (provider = 'supabase' | 'firebase')
```

### Safety and Precedence Rules
1. **Supabase First**: The server attempts Supabase token verification first. If a valid Supabase Auth session/bearer token is presented, the Supabase UUID is extracted and mapped to `public.users.auth_user_id`.
2. **Firebase Fallback**: If no valid Supabase identity is found, the server validates the Firebase ID token cryptographically via `firebase-admin/auth`. The verified Firebase UID is mapped to `public.users.firestore_id`.
3. **Provider Attestation**: The returned `ServerAdminUser` structure explicitly reports `provider: 'supabase' | 'firebase'` without exposing client secrets or raw tokens.
4. **No Client Trust**: UIDs and emails provided in client payloads or headers are never trusted. Only cryptographically verified identities from either provider are recognized.

---

## 3. Identity Mapping Rules

The reconciliation model governs how identities in Firebase Auth, Supabase Auth, `public.users`, and `public.staff` interact:

| Identity Field | Table | Description |
|---|---|---|
| `firestore_id` | `public.users` | Stores Firebase Auth UID. Preserved for legacy Firebase admins. |
| `auth_user_id` | `public.users` | Stores Supabase Auth UUID. Primary lookup key for Supabase Auth admins. |
| `firebase_uid` | `public.staff` | Stores Firebase Auth UID for staff. Protected by `seva_staff_guard`. |
| `auth_user_id` | `public.staff` | Stores Supabase Auth UUID (additive column). Nullable, unique. |

### Reconciliation Categories
1. **Linked (`linked`)**: `auth_user_id` matches across Supabase Auth and PostgreSQL records, or `firestore_id`/`firebase_uid` matches across Firebase Auth and PostgreSQL records.
2. **Firebase Only (`firebase_only`)**: Identity exists in Firebase Auth (and optionally in `public.users` via `firestore_id`), but has no counterpart in Supabase Auth.
3. **Supabase Only (`supabase_only`)**: Identity exists in Supabase Auth (and optionally in `public.users` via `auth_user_id`), but has no counterpart in Firebase Auth.
4. **Email Match / Different ID (`email_match_different_id`)**: An account exists in both Firebase Auth and Supabase Auth with the same email, but different UIDs and has not yet been linked in `public.users`.
5. **Orphaned Privileged (`orphaned_privileged`)**: Identity is present in Firebase or Supabase with admin/staff expectations, or present in `public.staff`, but missing a corresponding active `public.users` authorization row.
6. **Ambiguous (`ambiguous`)**: Unmatched or conflicting entries where automated resolution is unsafe.

> **CRITICAL POLICY**: Automated linking based solely on email is strictly prohibited. Any ambiguous or conflicting identity must be inspected and reconciled via verified administrative process.

---

## 4. Zero-Lockout Behavior

To ensure business continuity for the temple operations during the migration:
1. **Existing Firebase Admins**: Existing administrators retaining Firebase ID tokens continue to be authorized through the secondary verification path (`public.users.firestore_id`).
2. **No Mass Cutover**: No requirement forces administrators to reset passwords or switch identities immediately.
3. **Graceful Failover**: If a user has both a Supabase session and a Firebase session, Supabase is preferred; if the Supabase token is expired or unlinked, the Firebase token is checked.
4. **Staff Immutability Protected**: Adding `auth_user_id` to `public.staff` is strictly additive. The trigger `seva_staff_guard` ensures existing `firebase_uid` values cannot be accidentally mutated or removed.

---

## 5. Synchronized Onboarding

Onboarding pathways for staff and administrators now synchronize both identity models:
- **`app/api/admin/users/create-admin/route.ts`**:
  - Validates caller permissions via dual-token authentication.
  - Passes `authUserId` (when available) to staff onboarding.
  - Ensures `public.users` row is upserted with `role: 'admin'`, `active: true`, and `auth_user_id: authUserId`.
  - Maintains `firestore_id` when the identity originates from Firebase.
  - Operation is idempotent (no duplicate key errors or overwriting existing active state).
- **`lib/seva/server/staff.ts:onboardStaff`**:
  - Inserts staff record via `seva_staff_onboard` RPC, populating `auth_user_id` if provided.
  - Upserts `public.users` with `auth_user_id` and `role`, ensuring authorization records exist immediately upon staff creation.
  - Never touches Firestore application collections.

---

## 6. Diagnostic Tooling

A read-only identity reconciliation CLI tool is provided:
```bash
npm run diagnose:auth-identities
```
- Safe for production execution (read-only; no writes to database or Auth services).
- Connects to Firebase Admin SDK, Supabase Admin client, and PostgreSQL (`public.users`, `public.staff`).
- Emits summary statistics and detailed categorization without printing secrets or API tokens.

---

## 7. Remaining Firebase Dependencies

The following isolated Firebase runtime dependencies remain exclusively for backward-compatibility during this transition:
- **`firebase-admin/auth`**: Used in `lib/auth/admin-auth.ts` to verify legacy Firebase ID tokens for administrative requests.
- **`firebase/auth` (Client SDK)**: Retained in `/login` and `/register` client components until client-side authentication is transitioned to Supabase Auth in Phase 3.
- **Firebase Initialization (`lib/firebase/config.ts`, `lib/firebase/admin.ts`)**: Initializes Firebase clients strictly for authentication token verification.

*Note: No runtime Firestore dependencies exist for application or domain data.*

---

## 8. Future Firebase Retirement Prerequisites

Before Firebase Authentication can be completely decommissioned:
1. **Phase 3 Client Migration**:
   - Update `/login`, `/register`, `/forgot-password` to authenticate directly against Supabase Auth.
   - Issue Supabase session tokens to all users.
2. **Privileged Account Cutover**:
   - Execute reconciliation diagnostic to confirm all active admins and staff have a verified `auth_user_id` populated in `public.users` and `public.staff`.
   - Reconcile any remaining `email_match_different_id` or `firebase_only` admin accounts.
3. **Deprecate Fallback in `lib/auth/admin-auth.ts`**:
   - Remove secondary Firebase verification path once 100% of admin requests use Supabase Auth.
4. **Schema Cleanup**:
   - Make `staff.auth_user_id` non-nullable.
   - Deprecate `users.firestore_id` and `staff.firebase_uid`.
   - Update `seva_staff_guard` trigger if `firebase_uid` is ever retired.
5. **Firebase SDK Removal**:
   - Uninstall `firebase` and `firebase-admin` packages.
   - Decommission Firebase project credentials from environment variables.
