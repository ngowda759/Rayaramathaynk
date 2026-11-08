# Phase 3 — Repository-Wide Authentication & Authorization Audit

**Project:** Sri Raghavendra Swamy Matha Temple Website (`ngowda759/Rayaramathaynk`)  
**Phase:** 3A — Read-Only Architecture Audit  
**Date:** 2026-11-08  
**Scope:** Repository-wide audit of Firebase Auth, Firebase Admin SDK, Firestore runtime dependencies, identity mappings (`auth_user_id`, `firestore_id`, `firebase_uid`), client authentication, and server-side authorization.

---

## 1. Executive Summary

Phase 2 successfully introduced the foundation for Supabase Auth migration:
- `public.users.auth_user_id` (partial unique index `idx_users_auth_user_id`)
- `public.staff.auth_user_id` (unique column, non-breaking with `seva_staff_guard`)
- Dual-token verification chain in `lib/auth/admin-auth.ts` (Supabase primary + Firebase fallback)
- Identity reconciliation diagnostic tooling (`npm run diagnose:auth-identities`)

However, the application runtime still possesses substantial dual-system coupling:
1. **Client Auth**: Login, registration, password reset, and auth state listeners (`context/AuthContext.tsx`, `services/auth.service.ts`) remain tied to Firebase Auth client SDK.
2. **Client Persistence & Token Transport**: `AuthContext.tsx` sets `setAuthTokenGetter` using Firebase `currentUser.getIdToken()`.
3. **Route Guards**: `AdminAuthGuard.tsx` checks Firebase Auth for general admin and Seva pages, while using `useSupabaseSession` only for `/admin/ai/**`.
4. **Residual Firestore Runtime Calls**:
   - `services/auth.service.ts` performs Firestore reads and writes to `users/{uid}` on login and registration.
   - `proxy.ts` performs live Firestore writes to `page_views` on every public GET request.
   - `lib/seva/server/identity-firebase.ts` reads and writes `users/{uid}` in Firestore via Firebase Admin SDK.
   - `lib/auth/admin.ts` reads Firestore `users/{uid}` for `isUserAdmin`.
5. **Seva Identity & Authorization**:
   - `lib/seva/server/auth.ts` queries `staff` by `firebase_uid` and reads profile from Firestore via `firebaseIdentityAdapter`.
6. **API Route Token Verification**:
   - `/api/profile/**`, `/api/bookings/**`, and `/api/public/receipts` verify tokens using `lib/auth/verify-id-token.ts`, which currently only checks Firebase ID tokens.

This audit establishes the exact inventory of dependencies and classifies each for Phase 3 execution.

---

## 2. Complete Runtime Dependency Inventory & Classification

Each dependency is classified as one of:
- **REMOVE**: Obsolete, dead, or duplicate code to be deleted with no replacement.
- **REPLACE**: Active runtime path to be transitioned directly to Supabase Auth / Supabase PostgreSQL.
- **RETAIN TEMPORARILY**: Transitionally required for rollback safety, audit compatibility, or zero-lockout continuity.
- **AUTH-ONLY COMPATIBILITY**: Secondary server verification fallback reserved strictly for un-migrated legacy tokens during the cutover window.

| Component / File | Current Role | Target Role (Phase 3) | Classification |
|---|---|---|---|
| `context/AuthContext.tsx` | Firebase client auth listener (`onAuthStateChanged`), user state, profile loading from Firestore | Canonical Supabase Auth listener (`onAuthStateChange`), session resolution, profile loading from `public.users` via `auth_user_id` | **REPLACE** |
| `services/auth.service.ts` | Firebase `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, Firestore `setDoc`/`getDoc` | Supabase `auth.signInWithPassword`, `auth.signUp`, `auth.signOut`, `auth.resetPasswordForEmail`; profile persistence in `public.users` | **REPLACE** |
| `components/auth/LoginForm.tsx` | Calls `useAuth().login(...)` | Calls migrated `useAuth().login(...)` backed by Supabase Auth | **REPLACE** |
| `components/auth/RegisterForm.tsx` | Calls `useAuth().register(...)` | Calls migrated `useAuth().register(...)` backed by Supabase Auth + idempotent provisioning | **REPLACE** |
| `components/auth/ForgotPasswordForm.tsx` | Calls `useAuth().forgotPassword(...)` | Calls migrated `useAuth().forgotPassword(...)` via Supabase `resetPasswordForEmail` | **REPLACE** |
| `components/admin/layout/AdminAuthGuard.tsx` | Dual-bifurcated guard (Firebase for admin/seva, Supabase for `/admin/ai`) | Unified guard checking canonical Supabase session and `public.users` role | **REPLACE** |
| `lib/api/auth-token.ts` | Provides Bearer token getter for `apiFetch` (currently Firebase ID token) | Provides Supabase Auth access token for `apiFetch` | **REPLACE** |
| `lib/auth/admin-auth.ts` | Dual-token admin verifier (Supabase primary + Firebase fallback) | Hardened dual-token verifier with Supabase primary canonical path; Firebase fallback maintained | **AUTH-ONLY COMPATIBILITY** |
| `lib/auth/verify-id-token.ts` | Verifies bearer token via Firebase Admin only | Multi-provider verifier (verifies Supabase access token first, falls back to Firebase ID token) | **REPLACE / AUTH-ONLY COMPATIBILITY** |
| `lib/seva/server/auth.ts` | Staff guard querying `staff.firebase_uid` and Firestore access profile | Canonical staff guard querying `staff.auth_user_id` (fallback `firebase_uid`) and `public.users` profile | **REPLACE** |
| `lib/seva/server/identity.ts` | Identity adapter interface | Provider-neutral adapter selecting canonical Supabase adapter | **REPLACE** |
| `lib/seva/server/identity-firebase.ts` | Seva identity adapter using Firebase Auth + Admin Firestore | Retained as secondary fallback adapter for legacy operations | **AUTH-ONLY COMPATIBILITY** |
| `lib/seva/server/identity-supabase.ts` | (New) Supabase identity adapter | Canonical seva identity adapter using Supabase Auth admin + `public.users` | **NEW / REPLACE** |
| `lib/seva/server/staff.ts` | Staff onboarding and status management | Populates `auth_user_id` canonically on `staff` and `public.users` | **REPLACE** |
| `app/api/admin/users/create-admin/route.ts` | Creates admin via Firebase Auth + optional Supabase sync | Creates admin canonically via Supabase Auth Admin API + atomic `public.users` authorization | **REPLACE** |
| `app/api/admin/users/set-role/route.ts` | Finds UID by email in Firebase Auth | Resolves identity canonically via Supabase Auth / `public.users` (forbids email-only role escalation) | **REPLACE** |
| `components/seva/shell/VerifyEmailNotice.tsx` | Imports `User` from `firebase/auth` and `resendVerification` from `@/lib/auth` | Uses Supabase `User` and `supabase.auth.resend({ type: 'signup' })` | **REPLACE** |
| `proxy.ts` | Next 16 middleware writing page views to Firestore | Security headers only; remove Firestore `trackPageView` (Supabase beacon is active) | **REMOVE (Firestore calls)** |
| `lib/auth/admin.ts` | Legacy admin verifier reading Firestore `users` | Dead / obsolete; callers (`app/actions/settings.ts`) switched to `requireAdminUser` | **REMOVE** |
| `app/actions/settings.ts` | Server action using `lib/auth/admin.ts` | Migrated to canonical `requireAdminUser` from `lib/auth/admin-auth.ts` | **REPLACE** |
| `lib/auth.ts` | Dead duplicate of `auth.service.ts` importing `firebase/auth` and `firebase/firestore` | Completely dead code; unneeded | **REMOVE** |
| `lib/date.ts` | Dead date formatter importing `Timestamp` from `firebase/firestore` | Completely dead code; unneeded | **REMOVE** |
| `types/user.ts` | Imports `Timestamp` from `firebase/firestore` | Decoupled timestamp type definition (`string \| Date \| TimestampLike`) | **REPLACE** |
| `types/profile.ts` | Imports `Timestamp` from `firebase/firestore` | Decoupled timestamp type definition | **REPLACE** |
| `types/billing.ts` | Imports `Timestamp, FieldValue` from `firebase/firestore` | Decoupled timestamp type definition | **REPLACE** |
| `lib/firebase.ts` | Client Firebase initialization | Retained strictly for rollback/auth fallback compatibility; no Firestore runtime usage | **RETAIN TEMPORARILY** |
| `lib/admin-firebase.ts` | Firebase Admin SDK initialization | Retained strictly for token verification fallback in `lib/auth/admin-auth.ts` | **RETAIN TEMPORARILY** |

---

## 3. Detailed Audit by Subsystem

### 3.1 Client Authentication (`context/`, `services/`, `components/auth/`)
- **Current State**:
  - `context/AuthContext.tsx` sets up an `onAuthStateChanged(auth, ...)` listener on the client Firebase instance.
  - When user logs in, `loadProfile(firebaseUser.uid)` calls `authService.getUserProfile(uid)`, which executes `getDoc(doc(db, "users", uid))` against Firestore.
  - User registration calls `createUserWithEmailAndPassword(auth, ...)` and then executes `setDoc(doc(db, "users", credential.user.uid), ...)` into Firestore.
  - User login calls `signInWithEmailAndPassword(auth, ...)` and executes `setDoc(..., merge: true)` into Firestore.
  - Token getter `setAuthTokenGetter` evaluates `current.getIdToken()` from Firebase.
- **Phase 3 Requirements**:
  - Transition `AuthContext` to listen to `supabase.auth.onAuthStateChange`.
  - When an authenticated Supabase session exists, load profile from Supabase `public.users` where `auth_user_id = session.user.id`.
  - If a user exists in Supabase Auth but does not yet have a `public.users` row, automatically and idempotently provision a `devotee` profile.
  - `login` calls `supabase.auth.signInWithPassword`.
  - `register` calls `supabase.auth.signUp`, creates `public.users` row with `role: 'devotee'`, and sends confirmation.
  - `logout` calls `supabase.auth.signOut`.
  - `forgotPassword` calls `supabase.auth.resetPasswordForEmail`.
  - `setAuthTokenGetter` returns `session.access_token`.

### 3.2 Server-Side Authorization (`lib/auth/admin-auth.ts`, `lib/auth/verify-id-token.ts`)
- **Current State**:
  - `lib/auth/admin-auth.ts` already implements Supabase as the primary verification path and Firebase as secondary fallback.
  - For Supabase, it verifies bearer token via `supabase.auth.getUser(bearerToken)` or cookie session via `createClient()`.
  - It resolves identity via `public.users` where `auth_user_id = supabaseAuthUser.id`.
  - For Firebase, it verifies ID token via `firebase-admin/auth` and resolves `public.users` where `firestore_id = firebaseDecoded.uid`.
  - However, other routes (such as `/api/profile/**`, `/api/bookings/**`) use `lib/auth/verify-id-token.ts` which only checks Firebase ID tokens.
- **Phase 3 Requirements**:
  - Upgrade `lib/auth/verify-id-token.ts` to support Supabase access tokens primarily (extracting `user.id` as the caller UID), and maintain Firebase verification as compatibility fallback.
  - Ensure all admin and privileged route handlers resolve identity strictly from verified server-side tokens and query `public.users` by `auth_user_id`.
  - Prohibit accepting client-supplied user IDs, roles, or email matching for privilege resolution.

### 3.3 Staff Authorization (`lib/seva/server/`)
- **Current State**:
  - `lib/seva/server/auth.ts:requireSevaActor` calls `identity.verifyRequest(req)`, which calls `checkBearerIdToken(req, { checkRevoked: true })` in `identity-firebase.ts`.
  - It then calls `findStaff(caller.externalUid)`, which queries `staff` with `.eq("firebase_uid", externalUid)`.
  - It calls `identity.getAccessProfile(caller.externalUid)`, which reads Firestore `users/{externalUid}`.
- **Phase 3 Requirements**:
  - Introduce canonical Supabase-native Seva identity adapter (`identity-supabase.ts`) that verifies Supabase tokens with `supabase.auth.getUser(token)`.
  - Load access profile directly from `public.users` where `auth_user_id = user.id`. This completely eliminates the runtime Firestore read!
  - In `findStaff(externalUid)`: query `public.staff` with `auth_user_id = externalUid` as canonical, falling back to `firebase_uid = externalUid` if not found or if the token came from Firebase.
  - Maintain `firebase_uid` on `public.staff` without breaking `seva_staff_guard`.

### 3.4 User Provisioning & Administration (`app/api/admin/users/`)
- **Current State**:
  - `app/api/admin/users/create-admin/route.ts` creates user in Firebase Auth via `createPasswordLogin`. It attempts `syncSupabaseAdminIdentity`, but catches and ignores failures (`authUserId = null`).
  - `app/api/admin/users/set-role/route.ts` looks up UID by email in Firebase Auth (`findLoginUid`) and calls `setAccountRole`.
- **Phase 3 Requirements**:
  - `create-admin` must create the user canonically in Supabase Auth via `supabase.auth.admin.createUser` and verify `auth_user_id` exists.
  - Fail closed: if Supabase Auth identity creation fails, or `public.users` / `public.staff` mapping fails, the request must fail with an appropriate error (never silently return success with unprovisioned state).
  - `set-role` must resolve the user through `public.users` / Supabase Auth, validating that the target account exists and preventing email-only privilege escalation.

### 3.5 Firestore Zero-Runtime Decoupling
- **Current State**:
  - `proxy.ts`: Contains `trackPageView` which writes to Firestore `collection(firestore, "page_views")`.
  - `lib/auth/admin.ts`: Contains `isUserAdmin` reading Firestore `users/{uid}`.
  - `services/auth.service.ts`: Directly imports `firebase/firestore` and reads/writes `users/{uid}`.
  - `lib/seva/server/identity-firebase.ts`: Directly reads and writes Firestore `users/{uid}`.
  - `lib/auth.ts`: Unused duplicate importing `firebase/firestore`.
  - `lib/date.ts`: Unused helper importing `firebase/firestore`.
- **Phase 3 Requirements**:
  - Remove `trackPageView` and `firebase/firestore` imports from `proxy.ts`.
  - Remove Firestore reads/writes from `services/auth.service.ts`.
  - Replace Firestore reads/writes in `lib/seva/server/` with `public.users`.
  - Replace `app/actions/settings.ts` check with `requireAdminUser` and retire `lib/auth/admin.ts`.
  - Delete `lib/auth.ts` and `lib/date.ts`.
  - Replace Firestore `Timestamp` imports in `types/` with provider-neutral type definitions.
  - Attain: **Zero runtime Firestore reads, writes, and imports in application request paths**.

---

## 4. Verification Checkpoints

1. **Client Auth Flow**:
   - Devotee signs in at `/login` -> receives Supabase session -> `AuthContext` resolves `auth_user_id` -> queries `public.users` -> stores profile.
   - Devotee registers at `/register` -> Supabase Auth user created -> `public.users` row created (`role: 'devotee'`).
   - Admin signs in -> opens `/admin/**` -> `AdminAuthGuard` validates Supabase session & admin role from `AuthContext` -> authorized.
2. **Server Auth Flow**:
   - `apiFetch` attaches Supabase access token in `Authorization: Bearer <token>`.
   - Route handlers call `requireAdminUser(request)` -> token verified with Supabase Auth -> `auth_user_id` resolved -> `public.users` queried -> role checked.
   - Seva routes call `requireSevaActor(request, action)` -> verified with Supabase Auth -> `staff` queried by `auth_user_id` -> `public.users` queried -> authorized.
3. **Compatibility Fallback**:
   - If a legacy client sends a valid Firebase ID token -> `admin-auth.ts` and `verify-id-token.ts` successfully verify it via Firebase Admin SDK -> map to `public.users.firestore_id` / `public.staff.firebase_uid` -> operation succeeds.
4. **Security Assurance**:
   - Client-provided roles, user IDs, or emails in headers or payloads are strictly ignored for authorization decisions.
   - No user can escalate privileges by presenting an unverified email address.

---

## 5. Conclusion

The audit is complete. All runtime dependencies have been cataloged, classified, and analyzed.
No production records or infrastructure were modified.
We are ready to proceed to Phase 3B (Target Architecture Implementation Planning).
