# Rayaramathaynk Production Readiness Audit

- **Repository:** `ngowda759/Rayaramathaynk`
- **Branch / commit:** `main` @ `ce19560` (Merge PR #416 — "retire-firebase-supabase-only")
- **Production:** https://rayaramathaynk.vercel.app
- **Date:** 2026-11-17
- **Type:** READ-ONLY production readiness audit. No application code, data, migrations, workflows, Vercel configuration, or infrastructure were modified. All database access was read-only.

---

## Executive Summary

PR #416 successfully retired Firebase from every reachable production application path. The repository's own regression guard (`tests/unit/no-firebase-runtime.test.ts`) passes, `package.json` carries no Firebase dependency, `npm ci` installs with **zero** Firebase packages, and a full scan of `app/`, `lib/`, `services/`, `components/`, `hooks/`, `context/`, `middleware`, `next.config.ts`, `types/`, `scripts/` and `.github/` found **no active Firebase/Firestore SDK, endpoint, or auth-fallback reference**. Authentication, authorization, data access, profile management, file storage, settings, analytics and Raya AI are all Supabase-backed (with Vercel Blob for binary object storage — **not** Firebase Storage).

The architecture requirement — *"Supabase is the only authentication, database, and identity backend; there must be no Firebase runtime fallback"* — **is met.**

The audit did, however, surface issues that are **unrelated to Firebase** and that affect production readiness:

1. **A public debug page leaks a live OpenAI API key prefix** (`app/debug/page.tsx`). This is the single most serious finding.
2. **Two unauthenticated Vercel Blob endpoints** (`/api/reports/save`, `/api/reports/list`) allow anonymous write and read of blob storage.
3. **Unauthenticated chat IDOR** — `/api/ai/chat/messages` and `/api/ai/chat/sessions` read any session/user's data without authentication.
4. **An unauthenticated cache-revalidation endpoint** (`/api/revalidate`).
5. **Production data gaps** (empty `donations`, `gallery_media`, `ai_knowledge`, `chat_training`, `featured_content`) and missing `settings_documents` rows for the festival/ekadashi calendars.
6. **Two broken internal links** (`/contact`, `/ai/chat`) and **no `robots.txt`/`sitemap.xml`**.
7. **Stale Firebase entries in `package-lock.json`** that npm ignores but that should be regenerated.

> **Remediation status (branch `fix/security-debug-secret-and-api-authz`):** the five
> code-level findings (C-1, H-1, H-2, H-3, M-1) have been fixed on this branch and are
> covered by `tests/unit/security-audit-fixes.test.ts`. The report below records the
> audit-time state; see each finding for the applied fix. Data/document gaps
> (M-4, M-5), link/SEO items (M-2, M-3) and the `package-lock.json` cleanup (M-6)
> remain open and are owner decisions.

---

## Overall Status

| Area | Verdict |
|---|---|
| Firebase retirement | ✅ Complete — no active runtime path |
| Authentication | ✅ Supabase-only, fail-closed |
| Authorization | 🟢 Solid after fix — the previously-open routes are now guarded |
| Supabase connectivity | ✅ Healthy |
| Database / schema | ✅ Complete, RLS on every public table |
| Migration status | ✅ As expected (one intentional pending + one non-canonical legacy file) |
| Staff identity | ✅ Matches expected state |
| Public website | 🟠 All pages render; two broken links, no robots/sitemap |
| Admin | ✅ All 37 admin routes guarded |
| Profile | ✅ Supabase Auth + Vercel Blob |
| Seva / Staff | ✅ NULL-safe, fail-closed |
| Raya AI | 🟡 Supabase-only, but knowledge base is empty |
| Settings / data | 🟡 Several documents/rows missing (UI falls back to defaults) |
| API health | 🟢 After fix — open blob/chat/revalidate routes are guarded |
| Security | 🟡 Code fixed; **owner must rotate the OpenAI key** |
| Production configuration | ✅ Supabase-only; no Firebase env required |
| CI / CD | ✅ All green on `main`; one pre-existing, unrelated test failure |

---

## Critical Findings

### 🔴 C-1 — Public `/debug` page leaks a live OpenAI API key prefix

- **Where:** `app/debug/page.tsx` (client component, no auth guard).
- **Evidence:** `GET https://rayaramathaynk.vercel.app/debug` returned HTTP 200 and its server-rendered HTML contained a live OpenAI key **prefix** (`OPENAI_API_KEY`, first 20 characters, per line 26: `openaiApiKey.substring(0, 20)`). It also rendered `AI_PROVIDER` and a truncated `NEXT_PUBLIC_SUPABASE_URL`.
- **Mechanism:** a `"use client"` component is still server-rendered by Next.js; on the server `process.env.OPENAI_API_KEY` is populated, and the truncated value is serialized into the HTML response.
- **Impact:** partial disclosure of a production secret to any anonymous visitor. Even a prefix materially weakens the key and violates the repository's own "never expose secrets" rule.
- **Note:** the value was observed only as a 20-character prefix. The full key was **not** extracted. Secret value is intentionally **redacted** in this report.
- **Recommendation (owner action, not performed here):** remove `app/debug/page.tsx` from the deployment (delete or gate behind admin auth), and rotate the OpenAI key.
- **Fix applied (branch `fix/security-debug-secret-and-api-authz`):** deleted `app/debug/page.tsx` and `components/debug/ClientEnvDebug.tsx` (no importers) and removed the `/debug` link from `app/admin/ai/page.tsx`. **Owner action still required:** rotate the OpenAI key, since a 20-character prefix was disclosed publicly.

---

## High Findings

### 🟠 H-1 — Unauthenticated write to Vercel Blob (`/api/reports/save`)

- **Where:** `app/api/reports/save/route.ts` — `POST` has **no** auth check; it writes screenshots/PDF/JSON/Excel/markdown into Vercel Blob via `storageService`.
- **Evidence:** `POST /api/reports/save` with an arbitrary body returned HTTP 200 (the handler has no guard at all — see lines 28–95).
- **Impact:** anonymous arbitrary file upload to paid blob storage (cost/abuse), potential hosting of unwanted content under the site's storage domain.
- **Recommendation:** require an authenticated admin token (e.g. `requireAdminUser`) or remove the route if it is only a CI/dev tool.
- **Fix applied:** `POST /api/reports/save` now calls `requireAdminUser`. The out-of-band tooling that legitimately saves reports (`lib/reports/report-saver.ts`, `scripts/save-report.ts`, Playwright `tests/reports/save-reports.spec.ts`) sends a `Authorization: Bearer <REPORTS_API_TOKEN>` header (a signed-in admin's Supabase access token); `.env.example` documents the variable.

### 🟠 H-2 — Unauthenticated read of Vercel Blob (`/api/reports/list`)

- **Where:** `app/api/reports/list/route.ts` — `GET` has **no** auth check and lists blobs by prefix via `storageService.listReports`.
- **Impact:** anonymous enumeration of report objects (URLs, sizes, names).
- **Recommendation:** gate behind admin auth.
- **Fix applied:** `GET /api/reports/list` now calls `requireAdminUser`.

### 🟠 H-3 — Unauthenticated chat IDOR (`/api/ai/chat/messages`, `/api/ai/chat/sessions`)

- **Where:**
  - `app/api/ai/chat/messages/route.ts` — `GET ?session=<id>` reads **any** session's messages (`getSessionMessages` uses the service-role client, no ownership check). Verified: an anonymous request returned a real conversation transcript.
  - `app/api/ai/chat/sessions/route.ts` — `GET ?user=<uuid>` returns any user's chat sessions for an arbitrary `user` id.
- **Impact:** any visitor who knows or guesses a session id / user id can read another person's Raya AI conversation history. Today the data is low-sensitivity, but this is a textbook IDOR and will become a privacy incident as usage grows.
- **Recommendation:** derive the session owner from the verified Supabase token and reject mismatches; or make chat sessions anonymous-only with unguessable ids and no cross-read.
- **Fix applied:** every `/api/ai/chat/session*` and `/api/ai/chat/messages` route now resolves the caller from the verified Supabase access token (`verifyBearerIdToken`):
  - `messages` (GET/POST) and `session/[id]` (GET/PATCH) enforce that a session with an owner (`chat_sessions.user_id`) may only be read/written by that owner (mismatch → 404); anonymous ownerless sessions remain reachable by their unguessable id.
  - `sessions` (GET) derives the owner from the token and ignores the `user` query parameter.
  - `session` (POST) binds a new session to the verified caller, never to a body-supplied `userId`.
  - `session/[id]` (PATCH) accepts only presentation fields, so a caller cannot reassign `user_id`.

---

## Medium Findings

### 🟡 M-1 — Unauthenticated cache revalidation (`/api/revalidate`)

- `app/api/revalidate/route.ts` — `POST` calls `revalidatePath` with caller-supplied paths and **no** auth. Verified: anonymous `POST` returned `{"revalidated":true,...}`. Allows cache churn / minor DoS.
- **Recommendation:** require a shared secret header or admin auth.
- **Fix applied:** `POST /api/revalidate` now calls `requireAdminUser`; the admin homepage settings form (`components/admin/settings/homepage/useHomepageForm.ts`) sends the signed-in admin's Supabase access token.

### 🟡 M-2 — Broken internal links

- `app/(public)/trust/page.tsx:189` links to `/contact` → **404**.
- `app/(public)/journey/page.tsx:306` links to `/ai/chat` → **404**.
- **Recommendation:** point `/contact` to the real contact page/route and `/ai/chat` to the actual assistant entry point.

### 🟡 M-3 — No `robots.txt` / `sitemap.xml`

- Both return **404**. SEO/discoverability gap for a public temple site.

### 🟡 M-4 — Production data gaps

Empty tables required by UI/admin modules: `donations` (0), `gallery_media` (0), `seva_receipts` (0), `ai_knowledge` (0), `chat_training` (0), `featured_content` (0). `members` (1) and `volunteers` (1) are near-empty.
- **Impact:** admin dashboards and public modules render empty states; Raya AI knowledge coverage is effectively zero.
- **Recommendation:** populate via the existing admin flows; do **not** seed here.

### 🟡 M-5 — Missing `settings_documents` rows

`settings_documents` currently holds 9 rows: `aboutUs, ai, facilities, financeSettings, footer, futurePlans, homepage, poojaSchedule, trustCommittee`. Missing from the runtime registry (`SETTINGS_DOCUMENT_KEYS`, 12 keys): **`festivalCalendar`, `ekadashiCalendar`, `socialLinks`, `shlokas`, `device`**.
- The public settings API returns HTTP 200 with `data: null` for `festivalCalendar`/`ekadashiCalendar`, so the UI silently falls back to built-in defaults. `socialLinks` is served from the `social_links` **table** (1 row), and `shlokas` from `data/shlokas.ts` — so those two are covered by other sources.
- **Recommendation:** create the festival/ekadashi documents via the admin settings pages.

### 🟡 M-6 — Stale Firebase entries in `package-lock.json`

The lockfile's root `packages[""].dependencies` still lists `firebase`, `google-auth-library` and devDeps `firebase-admin`, `firebase-tools`, `@firebase/rules-unit-testing`, with ~37 lock entries and `node_modules/firebase*` trees recorded.
- **Important:** this is **not** a runtime path. A clean `npm ci` (verified in an isolated directory) installed **874** packages, produced **no** `firebase`/`firebase-admin`/`firebase-tools`/`@firebase` directories, and `npm ls firebase firebase-admin` reports `(empty)`. `package.json` is clean and the retirement guard enforces that.
- **Impact:** lockfile/source-of-truth drift; a future `npm install` may resurrect phantom trees.
- **Recommendation:** regenerate the lockfile from the clean `package.json` (`npm install --package-lock-only`) and commit.

---

## Low Findings

- 🔵 **L-1 — CSP / image `remotePatterns` hardcode the Supabase hostname** (`next.config.ts` lines 34 and 55). Not a secret (the project URL is public to the browser), but it bypasses env interpolation and will need editing if the project ref changes.
- 🔵 **L-2 — `google-auth-library` remains a transitive lock entry** with no runtime import; it is explicitly forbidden in `package.json` by the guard test.
- 🔵 **L-3 — Non-canonical migration filename** `supabase/migrations/20240915_create_temple_areas.sql` (8-digit prefix) is never in the ledger and is documented as "silently a no-op / unclear". The canonical `20240523000000` version is the applied one.
- 🔵 **L-4 — `firebase_uid` still written (never read)** in `lib/seva/server/staff.ts:422` via the `seva_staff_onboard` RPC (column is `NOT NULL`). This is inert provenance; see §Staff Identity Audit.
- 🔵 **L-5 — Agent-state files under `.claude/state/`** (`chunks.json`, `delta/2026-10-18/delta.json`) reference Firebase/Firestore extensively. These are historical planning snapshots, not code, and are correctly outside the runtime scan.

---

## Firebase Retirement Verification

**Searched for:** `firebase`, `firebase-admin`, `firebase_uid`, `firestore_id`, `NEXT_PUBLIC_FIREBASE`, `FIREBASE_`, `googleapis`, `firestore`, `firebaseapp.com`, `google.firebase`.

| Class | Examples | Count / Notes |
|---|---|---|
| **A. ACTIVE RUNTIME** | — | **None.** No `firebase`/`firebase-admin`/`@firebase/*` import anywhere in runtime code. |
| **B. LEGACY DATA** | `firebase_uid` (`staff`, `NOT NULL`; written once, never read), `firestore_id` (stable public ids, e.g. `row.firestore_id \|\| row.id`) | Provenance only. ⚠️ One **read** as a lookup key: `app/actions/sevas.ts:29` (`.eq('firestore_id', id)`). |
| **C. HISTORICAL DOCUMENTATION** | `docs/FIREBASE*.md`, `docs/FIRESTORE*.md`, `docs/audits/*`, `data/exports/*firestore*.json`, `.claude/state/*`, migration comments ("retired Firestore", "no Firestore path") | Not runtime. |
| **D. REGRESSION TEST** | `tests/unit/no-firebase-runtime.test.ts`, `tests/unit/aaradhane/firestore-write-retirement.test.ts` | Assert Firebase is absent. |
| **E. FALSE POSITIVE** | `lib/seva/permissions.ts` → `mapFirestoreRole` (a **name** for the role mapper; pure Supabase role strings), `.ai/scripts/dispatch-conversation.mjs` → `jules.googleapis.com` (Google Jules, unrelated to Firebase) | Not Firebase. |

**Conclusion:** ✅ **No Firebase SDK, Admin SDK, Firebase API, authentication fallback, Firestore access, or Firebase Storage access is reachable through production application code.** The one residual runtime dependency on a legacy column name is the `firestore_id` lookup in `app/actions/sevas.ts` (a Supabase table column, not Firebase).

---

## Authentication Audit

Traced path: **Browser → Supabase Auth → JWT/session → API auth → `public.users` → `public.staff` → roles/permissions.**

| Entry point | File | Verified behaviour |
|---|---|---|
| Bearer token verification | `lib/auth/verify-id-token.ts` | `createAdminClient().auth.getUser(token)` only; no Firebase fallback; `invalid` vs `unavailable` distinguished so provider outages answer 5xx (offline counter) and bad tokens answer 401. |
| Admin auth | `lib/auth/admin-auth.ts` → `admin-auth-compat.ts` | `checkAdminAuth` verifies Supabase token (plus optional `ADMIN_API_KEY`); `isUserAdmin` reads `users.role` (`admin`/`super_admin`/`temple_admin`) **and** `active !== false`. |
| Seva identity adapter | `lib/seva/server/identity-supabase.ts` | `checkBearerIdToken(..., {checkRevoked:true})`; profile matched on `auth_user_id` (fallback `id`). "No Firestore id is consulted." |
| Seva actor guard | `lib/seva/server/auth.ts` | `findStaff` matches `staff.auth_user_id` only; `firebase_uid` no longer read; unlinked row → no staff row → **deny**. |
| Client session | `context/AuthContext.tsx` | "Supabase Auth is the only sign-in provider; there is no Firebase listener." |

**Results:** Supabase JWT accepted ✅; session refresh/logout via Supabase ✅; expired/invalid/missing tokens fail (401) ✅; admin auth Supabase-only ✅; staff auth Supabase-only ✅; no Firebase fallback ✅; authorization fails closed ✅; unlinked staff cannot obtain privileged access ✅ (`findStaff` returns null → `deny("forbidden")`); `firebase_uid` is **not** used as an active identity lookup ✅.

---

## Authorization Audit

- **All 37 `app/api/admin/**` routes** carry an explicit guard (`requireAdminUser`, `requireStaffAdmin`, `requireSevaActor`, or `requireRayaAdminUser`). A scan for admin routes **without** a guard token returned **zero**.
- Anonymous probes to admin surfaces returned **401** (e.g. `/api/admin/dashboard-stats`, `/api/ai/settings`, `/api/ai/knowledge/coverage`).
- **Gaps (see Findings):** `/api/reports/save` (write), `/api/reports/list` (read), `/api/revalidate` (cache), `/api/ai/chat/messages` + `/api/ai/chat/sessions` (IDOR), `/api/ai/chat/session` + `/api/ai/chat/feedback` (anonymous by design) are not authorization-checked.
- No user-controlled role field was found: profiles are written from the verified token uid and validated against allow-lists (`lib/validation/public-submissions.ts`); role changes flow through `requireStaffAdmin` + `can(actor, …)`.
- IDOR: profile routes key on the verified token uid (safe); chat routes key on caller-supplied ids (unsafe — H-3).

---

## Supabase Database Audit

- **Read-only inspection** of `information_schema`, `pg_class`, `pg_policies`, `pg_tables` and the migration ledger.
- **Tables present** (public schema) include: `users`, `staff`, `sevas`, `events`, `announcements`, `gallery_albums`, `gallery_media`, `donations`, `donation_campaigns`, `volunteers`, `members`, `devotee_profiles`, `quotes`, `aaradhanes`, `temple_areas`, `settings_documents`, `social_links`, `daily_poojas`, `festival_days`, `festival_day_dates`, the AI tables (`ai_settings`, `ai_knowledge`, `chat_sessions`, `chat_messages`, `chat_metrics`, `chat_training`, `ai_testimonials`, `ai_volunteer_requests`, `ai_chat_feedback`, `ai_intent_distribution`, `ai_latency_records`), the knowledge-workflow tables, and the seva counter tables (`counters`, `counter_devices`, `bills`, `day_closes`, …).
- **RLS:** ✅ every public table has RLS enabled (0 tables without RLS); **81** policies in total. `settings_documents` is deny-all (`USING (false)`); `aaradhanes` allows public `SELECT`.
- **No missing expected table, no table without RLS, no schema drift detected** against the app's expected set.
- **Data emptiness** (not schema problems): see M-4. `page_views` 467, `gallery_albums` 4, `events` 74, `daily_poojas` 26, `sevas` 23, `quotes` 6, `aaradhanes` 2, `announcements` 1, `users` 3, `staff` 2.

---

## Migration Status

- **Ledger head:** `20261201000000_add_is_approved_to_users` — **APPLIED**.
- **Committed files:** 51. **Ledger rows:** 49.
- **In repo, not in ledger:**
  - `20240915_create_temple_areas.sql` — **non-canonical 8-digit prefix**; documented in `docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md` as "silently a no-op". The canonical `20240523000000_create_temple_areas.sql` is the applied one. (L-3)
  - `20261202000000_backfill_staff_auth_user_id.sql` — **committed, intentionally pending.** ✅ Matches the expected state. It is on the reviewed allowlist in `scripts/lib/pending-migrations.mjs` (`APPROVED_PENDING_MIGRATIONS`) and only applies via the dispatch-gated `supabase-migrations.yml` (`mode=apply` + exact phrase `apply-supabase-migrations`). No migration was applied during this audit.
- **Workflow safety:** `supabase-migrations.yml` is `workflow_dispatch`-only, defaults to dry-run, gates the real apply in a single `if: inputs.mode == 'apply'` step, requires the confirmation phrase, enforces an approved-ref guard and the pending-migration allowlist. **CI does not apply production migrations** (`ci.yml` contains no `db push`/`link` step).

---

## Staff Identity Audit

Read-only `SELECT` on `public.staff`:

| staff_no | status | `auth_user_id` linked | `firebase_uid` present | view_only |
|---|---|---|---|---|
| 1 | `active` | ✅ yes | yes | false |
| 2 | `invited` | ❌ **NULL** | yes (UUID-shaped = Supabase Auth UUID) | false |

- **Total staff:** 2. **Linked:** 1. **Unlinked:** 1. **Active:** 1. **Invited:** 1.
- **No active staff member is unlinked.** ✅ Matches the expected production state (staff_no 1 active+linked; staff_no 2 invited+unlinked).
- The unlinked row (staff_no 2) **cannot** obtain privileged access: `findStaff` matches on `auth_user_id` only, so an unlinked caller has no staff row → `deny("forbidden")`. Its `firebase_uid` equals the `auth_user_id` of its `users` row (`keerti.veena@gmail.com`), which is exactly what the pending backfill `20261202000000` would link.
- **`firebase_uid` write (L-4):** `lib/seva/server/staff.ts:422` still passes `firebase_uid: externalUid` into the `seva_staff_onboard` RPC. The column is `NOT NULL`, the value is always a Supabase Auth UUID, and it is **never read**. Recommendation: **keep** it as inert provenance for now (removing it is a schema change that should follow the pending backfill and a stable period); optionally rename in a later cleanup.

---

## Public Website Audit

All 32 probed public routes return **200** (homepage, about, events, sevas, gallery, donation, volunteer, trust, guruparampara, shlokas, quotes, facilities, future-plans, pooja, temple-explorer, live, search, profile, login, admin, calendar, knowledge, aaradhane, stotras, timeline, journey, notifications, testimonials, receipts, qr, favorites, display).

| Page | UI | API | Table | Data | Notes |
|---|---|---|---|---|---|
| Homepage | ✅ | ✅ (`/api/public/homepage`, `/api/public/stats`) | ✅ | ✅ | Server-rendered; uses static gallery + `daily_spiritual` |
| Temple timings / Pooja | ✅ | ✅ (`/api/public/settings/poojaSchedule`) | ✅ | ✅ | |
| Panchanga / calendar | ✅ | ✅ | ✅ (`data/panchanga`, `data/calendar.ts`) | ✅ | |
| Events | ✅ | ✅ (`/api/events`) | ✅ | ✅ (74) | |
| Announcements | ✅ | ✅ (`/api/announcements`) | ✅ | ✅ (1) | |
| Sevas | ✅ | ✅ (`/api/seva/sevas`) | ✅ | ✅ (23) | Public `sevas` page renders |
| Gallery | ✅ | ✅ (`/api/gallery/local-assets`) + client `@vercel/blob list` | ✅ | 🟡 (`gallery_media` 0; albums 4; local images + blob videos) | |
| Donations | ✅ | ✅ | ✅ | 🟡 (`donations` 0) | |
| Volunteer | ✅ | ✅ (`/api/volunteer`) | ✅ | 🟡 (1) | |
| Trust committee | ✅ | ✅ (`/api/public/settings/trustCommittee`) | ✅ | ✅ | ⚠️ link to `/contact` → 404 (M-2) |
| Guru parampara | ✅ | 🟡 (no public settings key; uses component data) | ⚪ | ✅ | `/api/public/settings/guruParampara` → 404 by design |
| Facilities | ✅ | ✅ | ✅ | ✅ | |
| Festival / Ekadashi calendar | ✅ | ✅ (200, `data:null`) | ✅ (no row) | 🟡 | Falls back to defaults (M-5) |
| Quotes | ✅ | ✅ (`/api/quotes/random`, `/today`) | ✅ | ✅ (6) | |
| Footer / social | ✅ | ✅ (`social_links` table) | ✅ | ✅ (1) | |

**Issues:** broken links M-2; no robots/sitemap M-3.

---

## Admin Audit

All modules (`Dashboard, Users, Staff, Sevas, Events, Announcements, Gallery, Donations, Volunteers, Members, AI, Quotes, Settings, Profile, …`) resolve UI → API → guard → service → repository → Supabase with **no Firebase assumption**.

- **Guards:** 37/37 admin API routes are guarded (see Authorization Audit).
- **No broken endpoint or 500 observed** in read-only probing; anonymous access correctly answers 401.
- **Empty-state modules:** Donations, Gallery media, AI knowledge, Featured content, Chat training, Seva receipts render empty because their tables are empty (M-4) — a data issue, not a code defect.
- **Settings:** admin settings pages write `settings_documents` (deny-all RLS; service-role writes only). Guru Parampara uses optimistic concurrency (`expectedRevision`); `homepage` admin route is `requireAdminUser`-guarded. No misleading success responses found.
- **No Firebase assumptions** in any admin route (comments only, e.g. "There is no Firestore path").

---

## Profile Audit

| Route | Auth | Behaviour |
|---|---|---|
| `app/api/profile/route.ts` | ✅ Bearer Supabase token; uid from token | GET/POST caller's own profile; body validated against allow-list |
| `app/api/auth/profile/route.ts` | ✅ token; matched on `auth_user_id`/`id` | Returns `is_approved`; new profiles default `role=devotee, active=true, is_approved=false` |
| `app/api/auth/me/route.ts` | ✅ token | Identity summary |
| `app/api/profile/image/route.ts` | ✅ token + rate-limit + magic-byte validation | Upload/delete own image |

- **Image storage = Vercel Blob** (`@vercel/blob` via `services/storage.service.ts`, called from `services/profile.server.ts`). **This is NOT Firebase Storage.** ✅
- Upload target is the verified token uid (no IDOR); type sniffed by magic bytes; 5 MB cap; 429 on abuse.
- **Note:** `is_approved` defaults to `false` for new devotees and all three current `users` rows are `is_approved = false` — this is a data/approval-workflow observation, not a code defect (no route was found that hard-blocks on `isApproved`).

---

## Seva / Staff Audit

Traced `lib/seva/server/auth.ts`, `counter.ts`, `staff.ts`, `identity-supabase.ts`.

- **`auth.ts`:** `findStaff` matches `staff.auth_user_id` only; `firebase_uid` no longer read; an unlinked row yields `null` → `deny("forbidden")`. **Unlinked staff fail closed.** ✅
- **Role mapping:** `mapFirestoreRole(profile.role)` (a name only) maps Supabase role strings; unknown role → `deny("forbidden")`.
- **`counter.ts`:** NULL-safe handling confirmed (`strOrNull`/`intOrNull`/`row()`/`liveDevice(null)` all return `null`/empty rather than throwing; `verifyDeviceHeader(null)` short-circuits). ✅
- **`staff.ts`:** onboarding writes `auth_user_id` from `externalUid` (Supabase Auth UUID) and `public.users` role/active; `firebase_uid` written once via RPC and never read (L-4).
- **`create-admin`:** requires a signed-in active super admin, `can(actor, "staff.grant_super_admin")`, and a mandatory Supabase Auth identity (`syncSupabaseAdminIdentity` + `isUuid` check) — cannot complete without Supabase Auth. ✅

---

## Raya AI Audit

- **Data access is Supabase-only:** `lib/ai/knowledge/repository.ts` → table `ai_knowledge`; `services/chat.server.ts` → `chat_sessions`/`chat_messages`/`ai_testimonials`; settings via `ai_settings`. No Firebase fallback.
- **Admin authorization:** every `/api/ai/**` admin route uses `requireRayaAdminUser` (verified: `/api/ai/settings`, `/api/ai/knowledge/coverage`, `/api/ai/multi-source/*`, `/api/ai/health` → 401/405 anonymous; `/api/ai/health` returns `{"error":"No authenticated Supabase session.","reason":"missing_token"}`).
- **Public by design:** `/api/ai/public-settings` (200) and public knowledge reads (200).
- **No 500/503 from missing Supabase config** observed; `/api/supabase-check` reports `hasUrl/hasAnonKey/hasServiceRoleKey` true.
- **Gaps:** `ai_knowledge` and `chat_training` are **empty**, so Raya AI has effectively no curated knowledge base (🟡). Anonymous chat read/write IDOR is H-3.

---

## Settings / Data Completeness

| Domain | Table/Config | Schema | Row | API | UI | Status |
|---|---|---|---|---|---|---|
| financeSettings | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| poojaSchedule | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| festivalCalendar | `settings_documents` | ✅ | ❌ | ✅ (`data:null`) | ✅ (defaults) | 🟡 |
| aboutUs | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| trustCommittee | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| guruParampara | `settings_documents` | ✅ | ❌ | ⚪ (not public) | ✅ (component) | 🟡 |
| futurePlans | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| shlokas | `settings_documents` + `data/shlokas.ts` | ✅ | ❌ doc / ✅ static | ✅ (defaults) | ✅ | 🟡 |
| footer | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| ekadashiCalendar | `settings_documents` | ✅ | ❌ | ✅ (`data:null`) | ✅ (defaults) | 🟡 |
| facilities | `settings_documents` | ✅ | ✅ | ✅ | ✅ | ✅ |
| homepage config | `settings_documents` | ✅ | ✅ | ✅ (`homepage.server.ts`) | ✅ | ✅ |
| socialLinks | `social_links` **table** | ✅ | ✅ | ✅ | ✅ | ✅ |
| device | `settings_documents` | ✅ | ❌ | ⚪ (404 by design) | ✅ (defaults) | ✅ |

No data was seeded or modified.

---

## API Health

181 route handlers. Classification of the probed surface:

- **PUBLIC (200):** `/api/events`, `/api/announcements`, `/api/aaradhane`, `/api/temple-areas`, `/api/quotes/random`, `/api/quotes/today`, `/api/public/settings/*`, `/api/public/stats`, `/api/public/homepage`, `/api/knowledge/categories`, `/api/search`, `/api/gallery/local-assets`, `/api/ai/public-settings`, `/api/supabase-check`.
- **AUTHENTICATED (401 anonymous):** `/api/profile`, `/api/auth/me`, `/api/auth/profile`, `/api/volunteer`.
- **ADMIN (401 anonymous):** all `/api/admin/**`, `/api/ai/settings`, `/api/ai/knowledge/coverage`, `/api/ai/multi-source/statistics`.
- **AI (405/401):** `/api/ai/multi-source/query`, `/api/ai/knowledge/import` (405 on GET, guarded on POST).
- **SYSTEM / unguarded (⚠️):** `/api/reports/save` (200 write), `/api/reports/list`, `/api/revalidate` (200), `/api/storage/videos` (200), `/api/ai/chat/messages`, `/api/ai/chat/sessions`, `/api/ai/chat/session` (201), `/api/ai/chat/feedback`.
- No unexpected 500/503 observed. No legacy Firebase dependency on any route. No server/client boundary error observed.

---

## Security Audit

- **Secret exposure (🔴 C-1):** live OpenAI key prefix in `/debug` HTML.
- **Unauthenticated writes (🟠 H-1):** `/api/reports/save` → Vercel Blob.
- **Unauthenticated reads / IDOR (🟠 H-2, H-3):** `/api/reports/list`, `/api/ai/chat/messages`, `/api/ai/chat/sessions`.
- **RLS:** ✅ enabled on all public tables; `settings_documents` deny-all; service-role used only server-side.
- **Service-role usage:** confined to server modules (`lib/supabase/admin.ts`), never imported into client components.
- **Input validation:** Zod schemas on submissions (`lib/validation/*`), magic-byte image checks, allow-list profile fields.
- **SQL injection:** no string-concatenated SQL found; Supabase query builder with `.eq()`/`.or()` filters (`rowIdFilter`/`identifier.ts` centralise id filtering).
- **IDOR:** profile routes safe (token-derived); chat routes unsafe (H-3).
- **Privilege escalation:** role changes gated by `requireStaffAdmin` + `can(...)`; new devotee defaults to `is_approved=false`, `role=devotee`.
- **Error messages:** server errors return generic messages; logs carry error message only, never tokens.
- **Secrets in VCS:** ✅ none tracked (`.env*` ignored except `.env.example`); no key-shaped string in tracked source.
- **One additional note:** `next.config.ts` hardcodes the Supabase project hostname in CSP/`remotePatterns` (L-1) — a public value, not a secret.

*If a secret is accidentally discovered, report only: "Secret detected — value intentionally redacted."* (Applied to C-1.)

---

## Production Configuration

- **`.env.example`** documents Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), Vercel Blob (`BLOB_READ_WRITE_TOKEN`), and OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_PROVIDER`). It explicitly states "no Firebase Storage" and **no `FIREBASE_*` variable is required**.
- **`vercel.json`** contains only cache-control headers for `/data/panchanga/*`. No Firebase.
- **`next.config.ts`** sets security headers (CSP, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) and image `remotePatterns` for Unsplash, Vercel Blob and the Supabase storage host.
- **Deployment:** `.github/workflows/deploy.yml` runs on push to `main` (`vercel build --prod` / `vercel deploy --prebuilt --prod`). No production mutation.
- **Migrations:** only `supabase-migrations.yml` (dispatch, dry-run default, phrase-gated) and `ai-knowledge-migration-apply.yml` (dispatch, phrase-gated, single reviewed file) can write to the DB. **CI never applies migrations.**
- **Guard status:** `production` environment is dispatch-gated but the workflow header notes it may carry **no required reviewers** — enabling required reviewers is an owner action.

---

## CI/CD Status

Latest runs on `main` @ `ce19560`:

### PASS
- **CI** — success (7m52s)
- **CodeQL** — success (2m47s)
- **AI UAT Tests** — success (1m44s)
- **AI loop validation / review / merge gate** — success
- **Lighthouse CI Performance Monitoring** — success
- **pages-build-deployment** — success
- **Firebase retirement guard** (`tests/unit/no-firebase-runtime.test.ts`) — **PASS**

### PRE-EXISTING FAILURE (not related to this audit)
- `tests/unit/seed-fresh-supabase-guards.test.ts` — 1 of 11 fails: "refuses the approved production ref even with test-project confirmation". Root cause: `npm notice` echoes argv (including the project ref) into the child process's stderr, so `expect(r.stderr).not.toContain(APPROVED_PROJECT_REF)` fails. Reproduces identically on `main`; unrelated to Firebase retirement.

### NEW FAILURE
- None.

---

## Production Data Readiness Matrix

| Module | Table/API | Schema | Data | API | UI | Production Status |
|---|---|---|---|---|---|---|
| Homepage | `settings_documents`/homepage, `/api/public/homepage` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Temple timings | `daily_poojas` (26), `/api/public/settings/poojaSchedule` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Panchanga | `data/panchanga` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Events | `events` (74), `/api/events` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Announcements | `announcements` (1) | ✅ | 🟡 | ✅ | ✅ | 🟡 Incomplete |
| Sevas | `sevas` (23), `/api/seva/sevas` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Gallery | `gallery_albums` (4) / `gallery_media` (0) | ✅ | 🟡 | ✅ | ✅ | 🟠 Needs attention |
| Donations | `donations` (0) | ✅ | 🔴 empty | ✅ | ✅ | 🟠 Needs attention |
| Volunteer | `volunteers` (1) | ✅ | 🟡 | ✅ | ✅ | 🟡 Incomplete |
| Members | `members` (1) | ✅ | 🟡 | ✅ | ✅ | 🟡 Incomplete |
| Trust committee | `settings_documents`/trustCommittee | ✅ | ✅ | ✅ | ✅ | 🟡 (broken `/contact` link) |
| Guru parampara | component data | ✅ | ✅ | ⚪ | ✅ | ✅ Ready |
| Facilities | `settings_documents`/facilities | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Festival calendar | `settings_documents` (no row) | ✅ | 🟡 | ✅ | ✅ | 🟡 Incomplete |
| Ekadashi calendar | `settings_documents` (no row) | ✅ | 🟡 | ✅ | ✅ | 🟡 Incomplete |
| Quotes | `quotes` (6) | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Shlokas | `data/shlokas.ts` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Footer / social | `social_links` (1) | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Profile | `devotee_profiles`/`users`, `/api/profile*` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Admin | 37 guarded routes | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Seva counter | `counters`/`bills`/… | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Raya AI | `ai_settings`(1)/`ai_knowledge`(0)/`chat_*` | ✅ | 🔴 knowledge empty | ✅ | ✅ | 🟠 Needs attention |
| Analytics | `page_views` (467), `daily_page_stats` | ✅ | ✅ | ✅ | ✅ | ✅ Ready |
| Reports (blob) | `/api/reports/*` | ✅ | ✅ | ✅ guarded (fixed) | ✅ | ✅ Ready |

---

## Recommended Fix Order

1. ✅ **Remove/gate `app/debug/page.tsx`** — done on branch `fix/security-debug-secret-and-api-authz` (C-1). **Owner still must rotate the OpenAI key.**
2. ✅ **Add admin auth to `/api/reports/save` and `/api/reports/list`** — done (H-1, H-2).
3. ✅ **Fix chat IDOR** — owner derived from the verified token across all `/api/ai/chat/**` routes (H-3).
4. ✅ **Protect `/api/revalidate`** with admin auth (M-1).
5. 🟡 **Fix broken links** `/contact` and `/ai/chat`; add `robots.txt` + `sitemap.xml` (M-2, M-3).
6. 🟡 **Populate production data** — donations, gallery media, AI knowledge, festival/ekadashi settings (M-4, M-5). Owner/data action; do not seed blindly.
7. 🟡 **Regenerate `package-lock.json`** to drop the stale Firebase trees (M-6).
8. 🟠 **Apply the pending staff backfill `20261202000000`** *only after* confirming staff_no 2's identity — it is already allowlisted and dispatch-gated; it is **not** required for current correctness (unlinked staff fail closed).
9. 🔵 **Cleanup:** env-interpolate the Supabase host in `next.config.ts` (L-1); resolve the non-canonical `20240915` migration (L-3); consider enabling required reviewers on the `production` environment.
10. 🔵 **Defer** removing `firebase_uid`/`firestore_id` until production is stable and the pending backfill has run.

**Verification for the applied fixes:** `npm run typecheck` ✅, `npm run lint` ✅, `npm run build` ✅ (268 pages), `tests/unit/security-audit-fixes.test.ts` ✅ 28/28. The full Jest suite is 238/239 suites green (3522 passing); the one failure is the pre-existing `seed-fresh-supabase-guards.test.ts` npm-notice case documented below.

---

## Explicitly Verified Safe

- ✅ **No active Firebase runtime path** — SDK, Admin SDK, endpoints, auth fallback, Firestore, Firebase Storage all absent from production code.
- ✅ `tests/unit/no-firebase-runtime.test.ts` passes; `package.json` has no Firebase dependency; a clean `npm ci` installs **zero** Firebase packages.
- ✅ Authentication is Supabase-only and fails closed; unlinked staff cannot obtain privileged access; `firebase_uid` is never read as an identity key.
- ✅ All 37 admin API routes are authorization-guarded; anonymous access answers 401.
- ✅ RLS is enabled on **every** public table; `settings_documents` is deny-all.
- ✅ Profile image storage is **Vercel Blob**, not Firebase Storage.
- ✅ Seva counter NULL-safety and `findStaff` fail-closed behaviour confirmed.
- ✅ Raya AI data access is Supabase-only.
- ✅ No production data, schema, migration, workflow, or configuration was modified during this audit.

---

## Items Requiring Owner Decision

1. **OpenAI key rotation** after removing `/debug` (C-1) — the exposed prefix means the key should be considered compromised.
2. **Whether `/api/reports/*` and `/api/revalidate` are internal tooling** (delete) or should stay (gate them).
3. **Chat session ownership model** — anonymous sessions with unguessable ids, or require sign-in for history reads.
4. **`firebase_uid` / `firestore_id` retirement timeline** — keep as inert provenance until post-backfill stability; then plan a rename/drop migration.
5. **Applying `20261202000000`** — confirm staff_no 2 (`keerti.veena@gmail.com`) is the intended, still-relevant identity before linking.
6. **Enabling required reviewers** on the GitHub `production` environment (makes the migration workflow human-gated).
7. **The non-canonical `20240915_create_temple_areas.sql`** — delete or canonicalise.

---

## Recommended Next Actions

```
1. ✅ Code done: app/debug/page.tsx removed (C-1). 🔴 OWNER: rotate the OpenAI key — the prefix was public.
2. ✅ Done: admin auth on /api/reports/save and /api/reports/list (H-1, H-2).
3. ✅ Done: chat IDOR fixed across /api/ai/chat/messages, /sessions, /session, /session/[id] (H-3).
4. ✅ Done: /api/revalidate is admin-only (M-1).
5. 🟡 Fix /contact and /ai/chat links; add robots.txt + sitemap.xml.
6. 🟡 Populate missing production data (donations, gallery, AI knowledge, festival/ekadashi settings).
7. 🟡 Regenerate package-lock.json to drop stale Firebase entries.
8. 🟠 Apply the pending staff backfill 20261202000000 only after identity confirmation.
9. 🔵 Cleanup: env-interpolate Supabase host in next.config.ts; resolve the non-canonical 20240915 migration.
10. 🔵 Defer removing firebase_uid / firestore_id until production is stable and the backfill has run.
```

---

### 🟡 PRODUCTION READY WITH FOLLOW-UP ITEMS

- **Firebase retirement is complete and verified:** no active Firebase runtime path remains; the guard test passes; `package.json` is clean; a clean install pulls zero Firebase packages.
- **Core architecture is sound:** Supabase-only auth (fail-closed), RLS on every public table, guarded admin routes, Vercel Blob storage, Supabase-backed Raya AI.
- **The blockers were not Firebase-related, and the code-level ones are now fixed on this branch:** the public debug page (C-1) is removed, the unauthenticated blob endpoints (H-1/H-2), the chat IDOR (H-3) and `/api/revalidate` (M-1) are all guarded. The remaining hard requirement is the **owner's OpenAI key rotation**.
- **Data completeness is the main functional gap:** several tables are empty and two calendar settings documents are missing, so some modules show empty/default states.
- **None of these findings requires reverting PR #416;** they are targeted follow-up fixes plus data population. Production is safe to keep live while the owner rotates the key and the data/SEO items are scheduled.
