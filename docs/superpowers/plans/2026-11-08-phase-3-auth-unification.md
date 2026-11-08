# Phase 3 — Firebase → Supabase Auth Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Supabase Auth as the single canonical authentication provider across Rayaramathaynk, eliminate all runtime Firestore dependencies, canonicalize `public.users.auth_user_id` and `public.staff.auth_user_id`, preserve zero-lockout continuity, and guarantee non-bypassable server authorization.

**Architecture:** Client authentication routes and hooks use Supabase Auth client SDK with cookie and local session management. Server authorization verifies tokens via Supabase Auth admin/server clients, maps identities via `auth_user_id` to `public.users` and `public.staff`, and strictly enforces application roles. Firebase Auth is retained strictly as removable secondary fallback compatibility infrastructure for unexpired legacy tokens during the cutover window.

**Tech Stack:** Next.js 14 (App Router), Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`), PostgreSQL (RLS, `public.users`, `public.staff`), TypeScript strict mode, Jest.

**Spec:** USER_REQUEST and `docs/auth/PHASE-3-AUTH-AUDIT.md`.

---

## Global Constraints

- Never commit secrets or modify production database records.
- Zero runtime Firestore dependencies (0 reads, 0 writes, 0 imports in application request paths).
- No email-only identity linking or client-supplied role/user-id trust.
- Maintain `public.users.auth_user_id` as canonical user identity.
- Maintain `public.staff.auth_user_id` as canonical staff identity.
- Preserve `firebase_uid` on `public.staff` without violating `seva_staff_guard`.
- Preserve backward compatibility for existing admin/staff/devotee sessions.
- All code must pass `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

---

## Review Focus

1. **Forged or mismatched client identity**: An attacker sending arbitrary `auth_user_id`, `userId`, `email`, or `role` in the request body/headers cannot elevate privileges or impersonate another user.
2. **Expired or invalid Supabase token**: Returns 401 with structured reason (`expired_token` or `invalid_token`), never 500 or fallback privilege leakage.
3. **Inactive user account**: An authenticated user with `active: false` in `public.users` is immediately denied with 403 `inactive_user`.
4. **Provisioning idempotency & atomic admin creation**: `create-admin` must not return success if Supabase Auth user or `public.users` authorization row fails to persist.
5. **Zero Firestore runtime execution**: Runtime request paths must execute zero calls to Firestore `collection`, `doc`, `getDoc`, `setDoc`, `addDoc`, or `getAdminFirestore`.

---

## Task Decomposition

### Task 1: Type Decoupling & Dead Code Removal
Eliminate Firestore `Timestamp` imports from type definitions and delete unneeded dead files.

**Files:**
- Modify: `types/user.ts`
- Modify: `types/profile.ts`
- Modify: `types/billing.ts`
- Remove: `lib/auth.ts`
- Remove: `lib/date.ts`

**Interfaces:**
- Produces: `TimestampLike` in `types/user.ts`, allowing dates to be formatted/parsed without `@firebase/firestore` runtime dependency.

- [ ] **Step 1: Write test verifying decoupled types and absence of Firestore imports**
- [ ] **Step 2: Update `types/user.ts`, `types/profile.ts`, `types/billing.ts` to replace `Timestamp` imports with decoupled type**
- [ ] **Step 3: Remove dead files `lib/auth.ts` and `lib/date.ts`**
- [ ] **Step 4: Update any dangling imports of `lib/auth.ts` (`VerifyEmailNotice.tsx`, `tests/unit/sign-in-profile.test.ts`)**
- [ ] **Step 5: Run tests and typecheck**
- [ ] **Step 6: Commit changes**

---

### Task 2: Middleware & Server Action Firestore Decoupling
Remove residual Firestore writes in `proxy.ts` and migrate `app/actions/settings.ts` from `lib/auth/admin.ts` to `lib/auth/admin-auth.ts`.

**Files:**
- Modify: `proxy.ts`
- Modify: `app/actions/settings.ts`
- Remove: `lib/auth/admin.ts`
- Test: `tests/unit/proxy-security.test.ts` or `tests/unit/settings-action.test.ts`

**Interfaces:**
- Consumes: `requireAdminUser` from `lib/auth/admin-auth.ts`
- Produces: Pure Next.js middleware in `proxy.ts` setting security headers with zero Firebase calls.

- [ ] **Step 1: Write unit tests verifying `proxy.ts` has no Firestore imports and `app/actions/settings.ts` requires admin auth**
- [ ] **Step 2: Strip `trackPageView` and Firebase imports from `proxy.ts`**
- [ ] **Step 3: Update `app/actions/settings.ts` to use `requireAdminUser` and remove `lib/auth/admin.ts`**
- [ ] **Step 4: Run tests and verify zero Firestore calls**
- [ ] **Step 5: Commit changes**

---

### Task 3: Client Authentication & Service Migration
Migrate `services/auth.service.ts` and `context/AuthContext.tsx` to canonical Supabase Auth.

**Files:**
- Modify: `services/auth.service.ts`
- Modify: `context/AuthContext.tsx`
- Modify: `components/auth/LoginForm.tsx`
- Modify: `components/auth/RegisterForm.tsx`
- Modify: `components/auth/ForgotPasswordForm.tsx`
- Modify: `components/admin/layout/AdminAuthGuard.tsx`
- Test: `tests/unit/auth-service-supabase.test.ts`, `tests/unit/auth-context-supabase.test.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`
- Produces: `AuthContextType` providing canonical Supabase `user`, `profile` (from `public.users`), `login`, `register`, `logout`, `forgotPassword`, and token getter returning Supabase `session.access_token`.

- [ ] **Step 1: Write unit tests for Supabase `auth.service.ts` and `AuthContext.tsx`**
- [ ] **Step 2: Implement Supabase Auth methods in `services/auth.service.ts` (signUp, signInWithPassword, signOut, resetPasswordForEmail, profile retrieval from `public.users`)**
- [ ] **Step 3: Update `context/AuthContext.tsx` to subscribe to `supabase.auth.onAuthStateChange` and register Supabase token getter**
- [ ] **Step 4: Update `LoginForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx` for Supabase error handling**
- [ ] **Step 5: Update `AdminAuthGuard.tsx` to validate Supabase session across all admin routes**
- [ ] **Step 6: Run tests and verify client auth flows**
- [ ] **Step 7: Commit changes**

---

### Task 4: Server-Side Token Verification & API Protection
Unify bearer token verification in `lib/auth/verify-id-token.ts` and ensure all protected routes enforce Supabase-primary authorization.

**Files:**
- Modify: `lib/auth/verify-id-token.ts`
- Modify: `lib/auth/admin-auth.ts`
- Test: `tests/unit/verify-id-token-unified.test.ts`, `tests/unit/admin-auth-unified.test.ts`

**Interfaces:**
- Produces: `verifyBearerIdToken(request)` and `requireAdminUser(request)` that verify Supabase tokens as primary canonical path, with Firebase fallback.

- [ ] **Step 1: Write tests for unified token verification (Supabase valid, Supabase expired, Firebase fallback, invalid token)**
- [ ] **Step 2: Update `lib/auth/verify-id-token.ts` to verify Supabase Auth access tokens primarily**
- [ ] **Step 3: Harden `lib/auth/admin-auth.ts` to ensure `auth_user_id` takes strict precedence**
- [ ] **Step 4: Verify protected routes (`/api/profile/**`, `/api/bookings/**`, `/api/admin/**`)**
- [ ] **Step 5: Run tests and verify**
- [ ] **Step 6: Commit changes**

---

### Task 5: Seva Staff Authorization & Identity Adapter
Create canonical Supabase Seva identity adapter and align staff authorization with `public.staff.auth_user_id`.

**Files:**
- Create: `lib/seva/server/identity-supabase.ts`
- Modify: `lib/seva/server/identity.ts`
- Modify: `lib/seva/server/auth.ts`
- Modify: `lib/seva/server/staff.ts`
- Modify: `components/seva/shell/VerifyEmailNotice.tsx`
- Test: `tests/unit/seva/identity-supabase.test.ts`, `tests/unit/seva/staff-auth-unified.test.ts`

**Interfaces:**
- Produces: `supabaseIdentityAdapter` implementing `IdentityAdapter` using Supabase Auth Admin and `public.users`.
- Consumes: `public.staff.auth_user_id` for staff lookup.

- [ ] **Step 1: Write unit tests for Supabase Seva identity adapter and staff authorization**
- [ ] **Step 2: Implement `lib/seva/server/identity-supabase.ts` and set as canonical in `identity.ts`**
- [ ] **Step 3: Update `lib/seva/server/auth.ts:findStaff` to check `auth_user_id` as canonical, fallback to `firebase_uid`**
- [ ] **Step 4: Update `lib/seva/server/staff.ts` to ensure canonical `auth_user_id` synchronization**
- [ ] **Step 5: Update `VerifyEmailNotice.tsx` for Supabase user verification resend**
- [ ] **Step 6: Run seva unit tests**
- [ ] **Step 7: Commit changes**

---

### Task 6: Authoritative User Provisioning & Admin Onboarding
Harden user onboarding and admin creation routes against partial success and privilege escalation.

**Files:**
- Modify: `app/api/admin/users/create-admin/route.ts`
- Modify: `app/api/admin/users/set-role/route.ts`
- Test: `tests/unit/admin-user-provisioning.test.ts`

**Interfaces:**
- Produces: Idempotent, fail-closed admin creation where `auth_user_id` and `public.users` role mapping must succeed atomically.

- [ ] **Step 1: Write tests for atomic admin creation and role update validation**
- [ ] **Step 2: Update `create-admin/route.ts` to create Supabase Auth user canonically and fail closed if provisioning fails**
- [ ] **Step 3: Update `set-role/route.ts` to resolve user through Supabase Auth / `public.users` and reject unverified email escalation**
- [ ] **Step 4: Run tests and verify**
- [ ] **Step 5: Commit changes**

---

### Task 7: Comprehensive Security Testing
Implement rigorous security test suite covering the 20 required security assertions.

**Files:**
- Create: `tests/security/auth-unification-security.test.ts`

**Test Cases:**
- Valid Supabase user
- Invalid Supabase token
- Expired token
- Missing token
- Inactive user
- Admin authorization
- Staff authorization
- Devotee authorization
- Unauthorized admin access
- Unauthorized staff access
- Role escalation attempt
- Forged client user ID
- Forged client role
- Email mismatch
- Firebase UID mismatch
- Supabase `auth_user_id` mismatch
- Missing `public.users`
- Duplicate identity mapping
- Provisioning failure
- Partial provisioning

- [ ] **Step 1: Implement security test suite in `tests/security/auth-unification-security.test.ts`**
- [ ] **Step 2: Run test suite and confirm all assertions pass**
- [ ] **Step 3: Commit changes**

---

### Task 8: Complete Verification & Readiness Report
Execute full test suite, lint, typecheck, build, and generate `docs/auth/PHASE-3-READINESS-REPORT.md`.

**Files:**
- Create: `docs/auth/PHASE-3-READINESS-REPORT.md`

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run typecheck`**
- [ ] **Step 3: Run `npm run lint`**
- [ ] **Step 4: Run `npm run build`**
- [ ] **Step 5: Run repo-wide search verifying zero runtime Firestore dependencies**
- [ ] **Step 6: Write `docs/auth/PHASE-3-READINESS-REPORT.md`**
- [ ] **Step 7: Final commit and summary report**
