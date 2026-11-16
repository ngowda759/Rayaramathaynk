# Firebase Retirement Audit

**Repository:** `ngowda759/Rayaramathaynk` (temple-portal)
**Target branch:** `main`
**Date:** 2026-11-16
**Scope:** Every occurrence of Firebase / Firestore in the repository, and its removal from the application runtime.

---

## 1. Objective and acceptance criterion

Supabase is the sole backend for authentication, database operations, profile management, file
storage, settings, analytics and Raya AI. There is no Firebase fallback, no Firestore fallback, no
Firebase Auth compatibility and no Firebase Storage dependency in the application runtime.

**Acceptance criterion:** no Firebase SDK, Firebase Admin SDK or Firebase API call can be reached
through any production application path. This is enforced by
`tests/unit/no-firebase-runtime.test.ts`, which scans the runtime tree and fails if any Firebase
import, entry point, environment read or endpoint reappears.

---

## 2. Classification key

| # | Class | Meaning |
|---|-------|---------|
| 1 | **Active production runtime connection** | Executable code on a request path that reaches Firebase. |
| 2 | **Legacy compatibility connection** | A retained shim or column name that still points at Firebase. |
| 3 | **Migration or diagnostic tooling** | One-off scripts, dumps, exports, CI workflows. |
| 4 | **Tests and mocks** | Test fixtures, emulator harnesses, rules tests. |
| 5 | **Documentation only** | Prose, plans, audit reports. |

**Headline result:** at the end of this work, the number of Class 1 occurrences is **0**. The
repository now contains **no** Class 1 or Class 2 Firebase connection; the remaining occurrences are
Class 3 (removed), Class 4 (removed) or Class 5 (retained, historical).

---

## 3. Inventory

### 3.1 Class 1 — Active production runtime connections

**Result after this change: none.**

Before this change, the following runtime modules reached Firebase. All were already Supabase-native
at the start of this work except the items marked *removed here*:

| Path | Previous Firebase use | Current state |
|------|----------------------|---------------|
| `lib/firebase.ts` | Client SDK init (`initializeApp`, `getAuth`, `getFirestore`, `getStorage`) | **Deleted** |
| `lib/admin-firebase.ts` | Admin SDK init, `getAdminFirestore`, `getAdminApp`, `getFirebaseConfigStatus` | **Deleted** |
| `lib/seva/server/identity-firebase.ts` | Firebase Auth + Firestore identity adapter | **Deleted** |
| `lib/utils/firebase-key-parser.ts` | Parsed `FIREBASE_PRIVATE_KEY` | **Deleted** |
| `lib/auth/fallback-telemetry.ts` | Counted Firebase fallback attempts | **Deleted** |
| `context/AuthContext.tsx` | `onAuthStateChanged` session restoration | Supabase-native (`supabase.auth.getSession` / `onAuthStateChange`) |
| `lib/auth/verify-id-token.ts` | Firebase ID-token verification | Supabase-native (`createAdminClient().auth.getUser`) |
| `lib/auth/admin-auth.ts` | Firebase admin claims | Supabase-native (`public.users`, `auth_user_id`) |
| `lib/seva/server/identity.ts` | Firebase identity | Supabase-native (Supabase Auth + `public.users` + `public.staff`) |
| `services/auth.service.ts` | Firebase Auth | Supabase-native (`signInWithPassword`, `signUp`, `signOut`) |
| `app/api/auth/profile/route.ts`, `app/api/profile/route.ts`, `app/api/auth/me/route.ts` | Firestore profile reads/writes | Supabase-native |
| `app/api/admin/users/set-role/route.ts` | Firestore role writes | Supabase-native |
| `components/auth/*`, `components/ai/AIChatProvider.tsx`, `components/admin/**` | Firebase clients | Supabase-native |
| `next.config.ts` / `proxy.ts` CSP | `*.firebaseapp.com`, `*.firebaseio.com` | Removed; `*.supabase.co` allowed |

### 3.2 Class 2 — Legacy compatibility connections

Two column names survive as inert provenance keys. They are **not** Firebase connections: no SDK,
no endpoint, no credential. They exist because the data migrated from Firestore kept its original
document ids so that existing public URLs and bookmarks keep working.

| Symbol | Where | Why retained |
|--------|-------|--------------|
| `firestore_id` | `users`, `events`, `announcements`, `sevas`, `seva_bookings`, `ai_knowledge`, gallery and other content tables | The public API returns a row's `firestore_id` when present and its primary key otherwise (`lib/supabase/identifier.ts`). Dropping it would break existing links. |
| `firebase_uid` | `staff` (`NOT NULL`, `UNIQUE`), `users` | Legacy sign-in key. `lib/seva/server/auth.ts` still matches a staff row by `firebase_uid` as a compatibility fallback; the canonical key is `auth_user_id`. |
| `mapFirestoreRole()` | `lib/seva/permissions.ts` | Maps legacy role strings (`admin`, `devotee`, ...) to `SevaRole`. Pure function; no Firebase. |

These names are documented in `docs/DATA-MODEL.md`. They are covered by the guard's column-name
exception: the guard forbids the Firebase *SDK/endpoint* surface, not the two legacy column names.

### 3.3 Class 3 — Migration / diagnostic tooling (removed)

Deleted scripts (no runtime reachability; superseded by Supabase tooling):

- `scripts/dump-firestore-live.ts`, `scripts/dump-firestore-staged.ts`, `scripts/dump-firestore-configs.sh`
- `scripts/convert-firestore-export.ts`, `scripts/read-firestore-counts.ts`, `scripts/check-firestore-sevas.ts`
- `scripts/migrate-*.ts` (14 files: ai-analytics, ai-knowledge, ai-to-supabase, all-batched, content, core, daily-poojas, events, settings, seva-bookings, sevas, staged-phase1)
- `scripts/lib/firestore-values.ts`, `scripts/lib/admin-credentials.{ts,cjs}`, `scripts/lib/auth-identity-reconciliation.ts`
- `scripts/fetch-checkpoint.ts`, `scripts/diagnose-auth-identities.ts`, `scripts/check-collisions.ts`, `scripts/check-collections.ts`, `scripts/export-events.ts`
- Old Firebase seeding scripts superseded by `scripts/seed-*-supabase.ts`

Deleted CI workflows:

- `.github/workflows/firestore-batched-migration.yml`
- `.github/workflows/firestore-production-export.yml`
- `.github/workflows/firestore-review-counts.yml`
- `.github/workflows/firestore-staged-migration.yml`
- `.github/workflows/auth-identity-reconciliation.yml`, `check-collisions.yml`, `diagnostic-sevaBookings.yml`

### 3.4 Class 4 — Tests and mocks (removed or rewritten)

Deleted:

- `tests/rules/*` (rules-test-env, settings, sevas, sign-in-merge, users-create, users-update) and `jest.rules.config.ts`
- `tests/e2e/firestore/firestore.spec.ts`, `tests/e2e/storage/storage.spec.ts`
- `tests/unit/admin-firebase.test.ts`, `dump-firestore-live*.test.ts`, `firebase-key-parser.test.ts`, `firestore-export-artifact-safety.test.ts`, `migrate-*.test.ts`, `auth-fallback-telemetry.test.ts`, `auth-identity-reconciliation.test.ts`, `fetch-checkpoint.test.ts`, `seva/no-embedded-keys.test.ts`

Rewritten for Supabase:

- `tests/e2e/seva/global-setup.ts` — seeds the local Supabase stack instead of the Auth + Firestore emulators.
- `tests/e2e/seva/playwright.config.ts` — passes local Supabase values to the dev server.
- `tests/unit/seva/e2e-isolation.test.ts` — asserts no `FIREBASE_*` variable is read or set.
- `tests/e2e/{performance,api-integration,error-handling}/*.spec.ts`, `tests/e2e/test-utils.ts` — wording and the removed `getFirestoreDoc` helper.

### 3.5 Class 5 — Documentation only (retained)

Historical documents are retained as an audit trail. They describe the migration that already
happened and are not executable:

- `docs/FIREBASE.md` — marked superseded; kept for history.
- `docs/FIRESTORE_MIGRATION.md`, `docs/FIRESTORE_SUPABASE_MIGRATION_{BACKLOG,GAP_AUDIT,STATUS}.md`
- `docs/audits/FIRESTORE_DEPENDENCY_AUDIT.md`
- `FIREBASE_MIGRATION_PHASE1_AUDIT.md`, `FIRESTORE_*_REPORT.md` (repo root)
- Plan documents under `docs/superpowers/plans/`

---

## 4. Environment variables

### 4.1 Removed

Removed from `.env.example` (all `NEXT_PUBLIC_FIREBASE_*`): `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`,
`STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`, `MEASUREMENT_ID`.

Removed from the e2e dev-server environment (never set again): `NEXT_PUBLIC_FIREBASE_EMULATORS`,
`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_API_KEY`, `GCLOUD_PROJECT`, `FIREBASE_AUTH_EMULATOR_HOST`,
`FIRESTORE_EMULATOR_HOST`, `GOOGLE_APPLICATION_CREDENTIALS`.

### 4.2 Kept

Supabase variables only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAYA_ADMIN_EMAIL`,
`PRISMA_DATABASE_URL` (migrations only), plus `BLOB_*` and the AI provider keys.

---

## 5. Remaining Firebase references (justification)

| Location | Class | Justification |
|----------|-------|---------------|
| `firestore_id`, `firebase_uid` columns and `mapFirestoreRole()` | 2 (inert) | Legacy id provenance; see §3.2. No SDK, endpoint or credential. |
| `docs/FIREBASE.md` and the `FIRESTORE_*` docs | 5 | Historical audit trail. |
| `tests/unit/no-firestore-analytics.test.ts`, `tests/unit/seva/no-firestore-receipt-links.test.ts`, `tests/unit/aaradhane/firestore-write-retirement.test.ts` | 4 | Regression tests that assert the *absence* of Firestore writes. |
| Comments in runtime files that say "no Firebase fallback" / "no Firestore path" | 5 | Documentation of the Supabase-only decision; they describe what is *not* there. |

No remaining reference is a Class 1 connection.

---

## 6. Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 errors) |
| `npm test` | pass (one pre-existing, unrelated `seed-fresh-supabase-guards` failure) |
| `npm run build` | pass |
| `tests/unit/no-firebase-runtime.test.ts` | pass |

See the pull request for the full validation report.
