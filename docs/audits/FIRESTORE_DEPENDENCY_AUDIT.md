# Firestore Dependency Audit — Rayaramathaynk

Read-only audit of every remaining Firebase/Firestore dependency and fallback path in the
production application. **No production record, schema, policy, migration, authentication
setting or deployment was changed.**

- Repository: `ngowda759/Rayaramathaynk`
- Production URL: `https://rayaramathaynk.vercel.app`
- Production Supabase project: `kvrkraqjuyxbraccxntk` (region `ap-south-1`)
- Audit date: 2026-10-30
- Method: source inspection + read-only probes of the live site (public anon key and the
  site's own public endpoints). No write call was issued.

---

## 1. Summary

The data cutover is **substantially complete**. There are **no Supabase→Firestore fallback
reads** in production code: every service that previously fell back to Firestore now throws
or returns an empty list and says so in its docstring. The residual Firestore surface is:

| Category | Count | Production impact |
|---|---|---|
| Firestore **data writes** reachable in production | **2 paths** (both to `users`) | Auth-time profile mirror only |
| Firestore **data writes** for analytics | **1 path** (`page_views`, `proxy.ts`) | **Live residual write** — see F-1 |
| Firestore **data reads** reachable in production | **2 paths** (`users`) | Admin auth + login profile |
| Dead / unreachable Firestore data code | 3 files | None |
| Type-only Firestore imports | 4 files | None |
| Firestore **data** scripts (CLI / CI, not request path) | ~20 scripts | None at runtime |
| Firebase **Authentication** | Site-wide | Intentional, unchanged |

The single most important finding is **F-1**: `proxy.ts` (Next 16's renamed middleware) still
writes a page-view document to the **Firestore** `page_views` collection on every public GET,
in parallel with the Supabase `page_views` beacon. This is a live residual Firestore write.

---

## 2. Findings

### F-1 — `proxy.ts` still writes `page_views` to Firestore — **HIGH**

**Evidence**

- `proxy.ts:3` `import { getFirestore, collection, addDoc, ... } from "firebase/firestore";`
- `proxy.ts:83` `await addDoc(collection(firestore, "page_views"), pageViewData);`
- `proxy.ts:118-126` the middleware calls `trackPageView(...)` on every non-static, non-API
  `GET` request.
- Next.js 16 docs (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:11`):
  *"The `middleware` file convention is deprecated and has been renamed to `proxy`."* The
  project root contains `proxy.ts` and no `middleware.ts`, so this file **is** the live
  request middleware.
- The Supabase path also exists and is wired: `components/analytics/PageViewTracker.tsx:5`
  → `services/pageviews.service.ts:42` → `POST /api/public/pageview` →
  `app/api/public/pageview/route.ts` inserts into Supabase `page_views`. `PageViewTracker`
  is mounted in `app/(public)/layout.tsx:11`.

**Impact**

- Every public page load performs a **write to Firestore** (`sri-raghavendra-mutt`) that the
  Supabase-only goal says should no longer happen. This is the only request-path Firestore
  **write** found.
- Page views are recorded twice (once in Firestore by `proxy.ts`, once in Supabase by the
  client beacon), so the analytics numbers have two sources.
- The `connect-src` CSP in `proxy.ts:47` still lists `https://*.firebaseio.com`, so removing
  the write also lets that CSP entry be tightened.

**Affected files / tables**: `proxy.ts` (Firestore `page_views`); Supabase `page_views`,
`daily_page_stats`.

**Severity**: High (contradicts the "fully Supabase-backed" objective; live cross-system write).

**Recommended action** (do not execute in this audit): delete `trackPageView` and the
Firebase imports from `proxy.ts` (keep only the security-header logic), leaving the Supabase
beacon in `PageViewTracker` as the single writer. Add a regression test asserting `proxy.ts`
imports no `firebase/*` module.

---

### F-2 — `services/auth.service.ts` writes the `users` profile to Firestore on register and login — **MEDIUM**

**Evidence**

- `services/auth.service.ts:12-16` imports `doc, getDoc, setDoc, serverTimestamp` from
  `firebase/firestore`.
- `services/auth.service.ts:58` `await setDoc(doc(db, "users", credential.user.uid), {...})`
  on register.
- `services/auth.service.ts:89-95` `getDoc` + merge `setDoc` on login.
- `services/auth.service.ts:123` `getDoc(doc(db, "users", uid))` in `getUserProfile`.
- Live: `authService` is imported by `context/AuthContext.tsx:18`, and `AuthProvider` is
  mounted in `app/layout.tsx:107`.

**Impact**: an authenticated user's `users/{uid}` document is still written to Firestore on
register/login. The authoritative admin role/active flag already lives in the Supabase
`users` table (keyed by `firestore_id`), read by `lib/auth/admin-auth.ts:236-238`, so the
Firestore document is a **mirror**. Because `firebase.rules` governs it and the service-role
`staff` API writes `role`/`isActive`, this path is also a **privilege-duplication risk** if
the mirror and the Supabase row ever disagree.

**Affected files / tables**: `services/auth.service.ts`, `lib/auth/sign-in-profile.ts`,
`lib/firebase.ts`; Firestore `users`; Supabase `users`.

**Severity**: Medium.

**Recommended action**: decide whether the client-side Firestore profile mirror is still
needed. If the Supabase `users` row is authoritative (it is, for authorization), remove the
Firestore write from `auth.service.ts` and keep only Firebase Auth (identity). Until then,
document that the mirror is non-authoritative.

---

### F-3 — `lib/auth/admin.ts` `isUserAdmin` reads the admin role from Firestore — **MEDIUM**

**Evidence**

- `lib/auth/admin.ts:7` `import { doc, getDoc } from "firebase/firestore";`
- `lib/auth/admin.ts:64` `const userDoc = await getDoc(doc(db, "users", uid));`
- `lib/auth/admin.ts:58` `isUserAdmin(uid)` returns true only when the Firestore document has
  `role === "admin" && isActive === true`.
- Callers: `app/actions/settings.ts:38` (`verifyAdminForAction`) →
  `app/actions/settings.ts:52,109` write `site_settings` in **Supabase**.
- `app/actions/settings.ts` is reached from `services/settings.service.ts:76,81`.

**Impact**: an authorization decision for a Supabase write (`site_settings`) is still made by
reading Firestore. This is the clearest remaining "authorization depends on Firestore" path.
Note that the site also has a Supabase-native admin gate (`lib/auth/admin-auth.ts`
`requireAdminUser`, which reads Supabase `users`), so the codebase has **two** admin checks
with different backends — a consistency risk.

**Affected files / tables**: `lib/auth/admin.ts`, `app/actions/settings.ts`,
`services/settings.service.ts`; Firestore `users`; Supabase `site_settings`, `users`.

**Severity**: Medium.

**Recommended action**: migrate `isUserAdmin` to read the Supabase `users` table (as
`lib/auth/admin-auth.ts` already does) so there is a single source of truth for admin
authorization.

---

### F-4 — `lib/seva/server/identity-firebase.ts` writes the staff `users` document via the Admin SDK — **MEDIUM**

**Evidence**

- `lib/seva/server/identity-firebase.ts:19-21` `getAdminFirestore()` →
  `db.collection("users").doc(externalUid)`.
- `lib/seva/server/identity-firebase.ts:41` `.get()` (read).
- `lib/seva/server/identity-firebase.ts:84,91-92` `FieldValue.serverTimestamp()` +
  `.set(write, { merge: true })` (write of `role`, `isActive`, `email`, `name`, `updatedAt`).
- `lib/admin-firebase.ts:11-12,157` provides `getAdminFirestore()` from `firebase-admin/firestore`.
- The adapter is consumed via `lib/seva/server/identity.ts:11,42`, used across the seva
  staff/counter/auth layer.

**Impact**: staff role changes write to Firestore's `users` collection through the Admin SDK
in addition to the Supabase `staff`/`users` tables. This is a server-side Firestore **write**
that survives the cutover.

**Affected files / tables**: `lib/seva/server/identity-firebase.ts`, `lib/admin-firebase.ts`,
`lib/seva/server/identity.ts`, `lib/seva/server/staff.ts`; Firestore `users`; Supabase
`staff`, `users`.

**Severity**: Medium.

**Recommended action**: point the identity adapter at Supabase (`staff`/`users`) and retire
the Admin-SDK Firestore write.

---

### F-5 — `lib/firebase.ts` hardcodes live Firebase credentials as fallbacks — **MEDIUM (security)**

**Evidence** — `lib/firebase.ts:58-64`:

```
apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY   || "AIzaSy…NeC4"
authDomain:        ... || "sri-raghavendra-mutt.firebaseapp.com"
projectId:         ... || "sri-raghavendra-mutt"
storageBucket:     ... || "sri-raghavendra-mutt.firebasestorage.app"
messagingSenderId: ... || "231035009940"
appId:             ... || "1:231035009940:web:dbc2c3b714c76ddb73ed81"
```

The same literals are duplicated in `proxy.ts:7-13`.

**Impact**: `isFirebaseConfigured()` (`lib/firebase.ts:46`) returns true even with no env
vars, so a misconfigured deployment silently talks to the live `sri-raghavendra-mutt`
project. These values are `NEXT_PUBLIC_` (shipped to the browser by design, not secrets), but
hardcoding them defeats environment isolation and hides configuration errors.

**Affected files**: `lib/firebase.ts`, `proxy.ts`.

**Severity**: Medium (configuration safety; not a secret leak — these are public client keys).

**Recommended action**: remove the literal fallbacks and let `isFirebaseConfigured()` return
false when the env vars are absent, so the existing "not configured" error path is used.

---

### F-6 — No Supabase→Firestore fallback reads remain — **INFO (verified clean)**

**Evidence** — explicit in-code denials of any fallback:

- `services/chat.server.ts:14` "There is no Firestore path."
- `services/knowledge-workflow.service.ts:37` "There is no Firestore path and no fallback: a
  failed write throws."
- `lib/ai/retrieval/announcements.ts:4,81` "no Firestore path … No Firestore fallback:
  report the failure with an empty list."
- `hooks/useGallery.ts:11-13`, `hooks/useHomepage.ts:14`, `hooks/useFinanceSettings.ts:12`,
  `hooks/useDonationNotifications.ts:29-30`, `hooks/useSettingsDocument.ts:14`.
- `services/{aaradhane,announcement,gallery,homepage,testimonial,conversation}.service.ts`
  each carry the same statement.

**Severity**: Info (positive finding). The risk is residual **writes**, not fallback reads.

---

### F-7 — Dead Firestore data code — **LOW**

**Evidence**

- `lib/firebase-admin-rest.ts` — a server-only Firestore REST client (`addDocument` L27,
  `updateDocument` L51, `deleteDocument` L73, `getDocuments` L90) with **zero importers**
  anywhere in `app/`, `lib/`, `services/`, `scripts/`, `tests/`.
- `lib/auth.ts` `registerUser` (L21) and `loginUser` (L73) have **no importers**; only
  `resendVerification` (L121) is used (`components/seva/shell/VerifyEmailNotice.tsx:8`).
  `registerUser`/`loginUser` still write Firestore `users` but are unreachable.
- `lib/date.ts` `formatEventDate` (L3, imports Firestore `Timestamp`) has no callers.

**Impact**: unused Firestore-writing code that could be re-enabled by accident; also inflates
the apparent Firestore surface.

**Severity**: Low.

**Recommended action**: delete `lib/firebase-admin-rest.ts` and the unreachable exports in
`lib/auth.ts` / `lib/date.ts`.

---

### F-8 — Type-only Firestore coupling — **LOW**

**Evidence**: `types/billing.ts:1`, `types/profile.ts:6`, `types/user.ts:1`,
`lib/date.ts:1` import `Timestamp`/`FieldValue` from `firebase/firestore` for typing only.

**Impact**: no runtime read/write, but keeps the `firebase/firestore` module in the type
graph, so a full Firestore removal still requires these to be re-typed.

**Severity**: Low. **Recommended action**: replace with local `Timestamp`/`FieldValue` type
aliases.

---

### F-9 — Firestore-capable scripts and CI workflows — **MEDIUM (operational)**

**Evidence** — Firestore **data writers** that bypass Supabase, all outside the request path:

- `scripts/seed-future-plans.ts:1-2,71-72` — `setDoc(doc(db, "settings", "futurePlans"))`;
  registered as npm script `seed-future-plans` (`package.json:25`). **Overwrites the
  `settings/futurePlans` Firestore document directly.**
- `scripts/setup-admin.ts:16,27,54` — Admin SDK `users` write.
- `scripts/seva/create-first-super-admin.ts:171,176,191` — Admin SDK `users` write.
- `scripts/{seed-ai-settings,seed-poojas,seed-sevas,seed-quotes,seed-testimonials,seed-trust-committee,update-finance-settings}.ts`
  and their `.js` twins.
- Migration/ETL readers: `scripts/migrate-*.ts`, `scripts/read-firestore-counts.ts`,
  `scripts/dump-firestore-*.ts`, `scripts/check-*.ts`.

CI workflows that reference Firestore (`workflow_dispatch`-only unless noted):

| Workflow | Trigger | Write behaviour |
|---|---|---|
| `firestore-batched-migration.yml` | manual | Appends `--dry-run` unless the operator clears the `dry_run` input (`:93,124`); **write-capable** when `dry_run=false`. |
| `firestore-staged-migration.yml` | manual | `--dry-run` unless `dry_run=false` **and** `confirm_production` set (`:85`). |
| `firestore-production-export.yml` | manual | `npm run firestore:dump` — reads Firestore, writes NDJSON artifacts. |
| `firestore-review-counts.yml`, `check-collisions.yml`, `diagnostic-sevaBookings.yml` | manual | read-only. |
| `ai-knowledge-migration-apply.yml`, `supabase-migrations.yml` | manual | guarded by `scripts/lib/guard-approved-project.mjs`; Supabase-side. |
| `aaradhane.yml` | **cron `30 3 1 1 *`** | **Verified read-only**: both generate steps pass `--dry-run` unconditionally (`:262,274`), including the `dry_run != true` branch (comment `:265-267`). `scripts/generate-aaradhane.ts` has no Firestore import and writes Supabase `events`. |

**Impact**: the Firestore **data writers** (`seed-future-plans.ts`, `setup-admin.ts`,
`create-first-super-admin.ts`, the seed/update scripts) can still mutate Firestore if run.
None is reachable from the website request path or from a schedule, so they are an
**operational** risk, not a runtime one.

**Severity**: Medium (operational). **Recommended action**: either delete the Firestore
writers or gate them behind an explicit `--legacy-firestore` flag with a printed warning; keep
the read-only export/dump scripts for the historical record.

---

## 3. Verified-clean named suspects

The following were previously suspected Firestore offenders and are **now Supabase-only**
(verified by reading the current source):

| File | Status | Evidence |
|---|---|---|
| `lib/ai/retrieval/announcements.ts` | Clean | `createClient` L8; `supabase.from(...)` L36-37; no Firestore import. |
| `services/chat.service.ts` | Clean | Comment L9 only; all calls go to `/api/ai/chat/**`. |
| `services/knowledge-workflow.service.ts` | Clean | Uses `firestore_id` **column** (Supabase), not Firestore. |
| `app/api/admin/knowledge/**` | Clean | Zero `firebase`/`firestore` matches. |
| `app/admin/ai/training/page.tsx` | Clean | Zero matches. |
| `services/knowledge.service.ts` | Clean | "Firestore" appears only in a comment. |
| `app/actions/sevas.ts` | Clean | Supabase only; filters `.eq('firestore_id', id)`. |
| `lib/aaradhane/firestore-admin.ts` | Does not exist | Directory holds `generator.ts`, `local-generator.ts`, `panchanga.ts`, `supabase-writer.ts`. |
| `app/api/chat/**`, `lib/ai/**` | Clean | No `firebase-admin`/`firebase/firestore` import. |

`app/api/chat/route.ts:231` contains a **commented-out** legacy fallback block
("OLD FALLBACK CODE - DISABLED FOR SAFETY") and a legacy `responseSource` label at L125 —
cosmetic only.

---

## 4. Firebase Authentication — intentionally retained

Firebase **Authentication** (not data) remains and must not be changed per the task. Confirmed
auth-only modules: `lib/auth/verify-id-token.ts:63-67`, `lib/auth/admin-auth.ts:104-107`,
`lib/auth/raya-admin-auth.ts` (Supabase Auth), `app/api/admin/users/create-admin/route.ts:34-43`,
`app/api/admin/users/set-role/route.ts:34-37`, `components/admin/layout/AdminAuthGuard.tsx`,
`components/auth/ProtectedRoute.tsx`, `components/seva/shell/VerifyEmailNotice.tsx`,
`context/AuthContext.tsx:11,119`.

---

## 5. Remediation order (recommended, not executed)

| # | Action | Severity |
|---|---|---|
| 1 | Remove the Firestore write from `proxy.ts` (F-1) | High |
| 2 | Move `isUserAdmin` to the Supabase `users` table (F-3) | Medium |
| 3 | Decide the fate of the client `users` Firestore mirror (F-2) | Medium |
| 4 | Move the seva identity adapter to Supabase (F-4) | Medium |
| 5 | Remove hardcoded Firebase fallbacks (F-5) | Medium |
| 6 | Delete/flag Firestore-capable scripts (F-9) | Medium |
| 7 | Delete dead Firestore code (F-7) and type-only imports (F-8) | Low |

No change above was performed by this audit.
