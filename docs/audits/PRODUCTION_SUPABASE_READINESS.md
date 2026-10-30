# Production Supabase Readiness — Rayaramathaynk

Read-only verification that the production website is Supabase-backed and identification of
missing data. **No production record, schema, policy, migration, authentication setting or
deployment was modified.** No write was issued to production.

- Repository: `ngowda759/Rayaramathaynk`
- Production URL: `https://rayaramathaynk.vercel.app`
- Production Supabase project: `kvrkraqjuyxbraccxntk` (PostgreSQL 17.6)
- Change under review: **PR #365** (`fix/fresh-seed-populated-db`), merge commit `b1401ae`
- Audit date: 2026-10-30
- Companion reports: `PRODUCTION_TABLE_INVENTORY.md`, `FIRESTORE_DEPENDENCY_AUDIT.md`,
  `PROPOSED_FRESH_DATA_SEED_PLAN.md`

> **Supersedes** the earlier `docs/PRODUCTION_SUPABASE_READINESS.md` (2026-10-28), which
> concluded that production row-count verification was **blocked by missing privileged
> read-only access**. That block is resolved here: the site's own public service-role
> endpoints (`/api/public/stats`, `/api/gallery/*`, `/api/quotes/stats`, `/api/knowledge`,
> `/api/testimonials/devotee`, `/api/public/settings/*`) return the true contents of the
> content tables, so this audit reports measured counts instead of "unknown".

---

## 1. Executive summary

**The website is Supabase-backed.** Every public page and API route reads application data
from Supabase; there is no Firestore fallback read anywhere in the request path. The data
cutover is functionally complete.

**Five things stand between the current state and a clean "production-ready" sign-off.** Item 5
is a code defect found during the review and fixed on this PR branch; items 1–4 need decisions
or production actions and are untouched.

1. **`proxy.ts` still writes `page_views` to Firestore** on every public GET — a live
   residual Firestore write (Firestore audit F-1, **High**).
2. **Two Firestore reads still gate behaviour**: the admin-role check
   (`lib/auth/admin.ts` `isUserAdmin`) and the login profile mirror
   (`services/auth.service.ts`) (Firestore audit F-2/F-3, **Medium**).
3. **Several public pages are empty because their tables have no rows**, not because of a
   bug: `announcements` (0), `temple_areas` (0), `daily_poojas` (0), `featured_content` (0),
   and four `settings_documents` keys (`trustCommittee`, `festivalCalendar`,
   `ekadashiCalendar`, `homepage`) out of nine. See §6.
4. **The production schema is not fully reproducible from the repository** — production has
   advanced past the migration comments (see §7 and the table inventory §4e).
5. **A read path used to write to the database, and several admin endpoints had no auth**
   (F-A11/F-A12). The quote fixes are **on this branch**; the same auth gap still covers
   `temple-areas`, `analytics` and `content` and is left open (F-A13).

All automated checks pass: unit **207/207 suites, 2668/2668 tests**; DB integration
**17/17 suites, 244/244 tests**; `tsc --noEmit` clean; ESLint **0 errors** (714 pre-existing
warnings). Two regression tests were added for F-A11/F-A12. See §8.

---

## 2. Scope, method and safety

| Requirement | How it was met |
|---|---|
| No migrations | None executed. |
| No insert/update/delete | Production touched with `GET` only; the one `POST` (`/api/public/pageview`) was **not** called. |
| No RLS changes | None. |
| No Firebase Auth changes | None; auth code read-only. |
| No Firestore fallback restored | None added. |
| No credential exposure | The production **anon** key is a `NEXT_PUBLIC_` value; no service-role key was ever printed. |
| Read-only DB access | PostgREST reads with the anon key + the site's own public service-role endpoints. |

Evidence sources: (a) source inspection of `app/`, `services/`, `lib/`, `hooks/`, `scripts/`,
`supabase/migrations/`; (b) live `GET` probes of `https://rayaramathaynk.vercel.app`; (c) the
`supabase/migrations/` schema reference. The sandbox `SUPABASE_DB_URL` points at a **different**
project (a "Tournament" schema) and was **not** used for production counts.

---

## 3. Data-access architecture (as implemented)

Three Supabase clients exist (`lib/supabase/`):

| Client | Key | Used by |
|---|---|---|
| `client.ts` | anon (`NEXT_PUBLIC_*`) | browser components that may read public rows |
| `server.ts` / `admin.ts` | **service_role** | API routes, server actions, server services |
| `admin.ts` `createAdminClient` | service_role | the dominant server path |

The consistent pattern is: **the browser never reads a deny-all table directly**; it calls a
`/api/**` route or a server action, which uses the service role. Public pages are Server
Components that call `services/*.server.ts`.

### 3.1 Firestore write/read surface that remains

Full detail is in `FIRESTORE_DEPENDENCY_AUDIT.md`. The production-reachable residual is:

| Path | Kind | Destination |
|---|---|---|
| `proxy.ts:83` | **write** | Firestore `page_views` (F-1) |
| `services/auth.service.ts:58,95` | write | Firestore `users` (F-2) |
| `services/auth.service.ts:90,123` | read | Firestore `users` (F-2) |
| `lib/auth/admin.ts:64` | read | Firestore `users` — **admin authorization** (F-3) |
| `lib/seva/server/identity-firebase.ts:92` | write | Firestore `users` (F-4) |

Everything else is dead code, type-only imports, or `workflow_dispatch`/CLI scripts.

---

## 4. Feature → Supabase table map

Counts are the measured production values (source in `PRODUCTION_TABLE_INVENTORY.md`).

| Website feature | Page / route | Supabase table(s) | Rows | Status |
|---|---|---|---:|---|
| Homepage (hero, featured, stats) | `/`, `app/api/public/homepage` | `settings_documents('homepage')` | 0 | **Defaults** — key missing |
| Homepage upcoming events | `/` | `events` | 74 | OK |
| Homepage stats strip | `/api/public/stats` | `events`, `users`, `donations`, `seva_bookings`, `members`, `volunteers` | 74 / 1 / 0 / 0 / 0 / 0 | OK (zeros are real) |
| Events list | `/events`, `/api/events` | `events` | 74 | OK |
| Aaradhane | `/aaradhane` | `aaradhanes` | 2 | OK |
| Gallery | `/gallery`, `/api/gallery/{albums,media}` | `gallery_albums`, `gallery_media` | 4 / 7 | OK |
| Quotes / daily shloka | `/api/quotes*`, `/` | `quotes` | 6 | **Thin** — seed defines 33; read path no longer writes (F-A11) |
| Testimonials | `/api/testimonials/devotee` | `testimonials` | 2 | OK |
| About / Facilities / Future Plans / Footer / Pooja schedule | `/about`, `/trust`, `/api/public/settings/*` | `settings_documents` | 5 of 9 keys | **Partial** |
| Trust Committee page | `/trust` | `settings_documents('trustCommittee')` | 0 | **Defaults** — key missing |
| Festival calendar | calendar pages | `settings_documents('festivalCalendar')`, `festival_days`, `festival_day_dates` | 0 / ? / ? | **Defaults** |
| Ekadashi calendar | calendar pages | `settings_documents('ekadashiCalendar')` | 0 | **Defaults** |
| Daily pooja schedule | `/pooja` | `daily_poojas` | 0 | **Empty** — page renders static timings only |
| Announcements banner | site-wide | `announcements` | 0 | **Empty** |
| Temple areas / map | `/api/temple-areas` | `temple_areas` | 0 | **Empty** |
| Featured carousel | homepage | `featured_content` | 0 | **Empty** |
| Site identity (name, contact) | site-wide | `site_settings` | 2 (1 valid + 1 stray) | See §5 |
| Social links | footer | `social_links` | 1 | OK |
| Raya AI knowledge | `/api/knowledge`, `/api/chat` | `ai_knowledge` | 19 | OK |
| Raya AI settings | `/api/ai/public-settings` | `ai_settings` | 1 | OK |
| Seva catalogue / counter | `/seva`, `/api/seva/**` | `sevas`, `seva_orders`, `seva_receipts`, `counters`, `staff`, … | 0 / ? | **Empty** — no catalogue |
| Donations | (no `/donate` route) | `donations`, `donation_campaigns` | 0 | **Empty** |
| Admin dashboard | `/admin` | `page_views`, `daily_page_stats`, chat/knowledge tables | >0 / 0 / 0 | Partial |
| Users / profiles | `/admin/users` | `users`, `profiles` | 1 / ? | OK |
| Web analytics | `/api/admin/web-analytics` | `page_views`, `daily_page_stats` | >0 / 0 | Partial |

---

## 5. Findings

### F-A1 — `proxy.ts` writes page views to Firestore — **High**
See `FIRESTORE_DEPENDENCY_AUDIT.md` §F-1. Live residual Firestore write on every public GET,
duplicating the Supabase beacon. **Affected**: `proxy.ts`, Firestore `page_views`, Supabase
`page_views`. **Action**: remove the Firebase branch from `proxy.ts`.

### F-A2 — Admin authorization still reads Firestore — **Medium**
`lib/auth/admin.ts:64` `isUserAdmin` reads `users/{uid}` from Firestore to authorize the
Supabase write in `app/actions/settings.ts`. A parallel Supabase-native gate
(`lib/auth/admin-auth.ts requireAdminUser`) already exists, so there are two admin checks with
different backends. **Affected**: `lib/auth/admin.ts`, `app/actions/settings.ts`,
`services/settings.service.ts`. **Action**: migrate `isUserAdmin` to Supabase `users`.

### F-A3 — Login/registration still mirrors the profile to Firestore — **Medium**
`services/auth.service.ts:58,89-95` write and read Firestore `users`. The Supabase `users` row
is authoritative for authorization. **Affected**: `services/auth.service.ts`,
`lib/auth/sign-in-profile.ts`. **Action**: drop the Firestore mirror or document it as
non-authoritative.

### F-A4 — `settings_documents` is missing 4 of its 9 seed keys — **High (data)**
Of the nine keys the seed defines (`lib/supabase/seed-data/settings-documents.ts`), **five are
present** in production — `aboutUs`, `facilities`, `futurePlans`, `poojaSchedule`, `footer` —
and **four are absent**:

| Missing key | Evidence | Consequence |
|---|---|---|
| `trustCommittee` | `/api/public/settings/trustCommittee` → `{"success":true,"data":null}` | `/trust` renders built-in defaults |
| `festivalCalendar` | `data: null` | festival calendar shows defaults |
| `ekadashiCalendar` | `data: null` | ekadashi calendar shows defaults |
| `homepage` | `settings_documents('homepage')` absent → `services/homepage.server.ts` returns `getDefaultConfig()` | homepage renders built-in copy, not owner copy |

`homepage` is confirmed absent because it is **not** in the route's `SETTINGS_DOCUMENT_KEYS`
allow-list (`services/settings-document.service.ts:22`), so `/api/public/settings/homepage`
answers `{"error":"Unknown settings document"}` while its dedicated reader
(`/api/public/homepage`) returns the built-in defaults.

The seed defines all four keys (`settings-documents.ts:93,125,135,164`), so a seed run would add
them — **only if the seed is allowed to run against production** (see
`PROPOSED_FRESH_DATA_SEED_PLAN.md`). **Affected tables**: `settings_documents`.
**Action**: seed the four missing keys.

### F-A5 — `homepage` settings document is missing — **Medium (data)**
Covered under F-A4. `settings_documents('homepage')` is absent, so
`services/homepage.server.ts` returns `getDefaultConfig()`. The homepage renders, but any
owner-customised homepage copy is not present. **Affected**: `settings_documents`.
**Action**: confirm whether the owner wants the seeded default homepage document or an edited one.

### F-A6 — Content tables are genuinely empty — **Medium (data)**
Measured zeros with service-role evidence: `announcements`, `temple_areas`, `daily_poojas`,
`featured_content`, `donations`, `donation_campaigns`, `seva_bookings`, `members`, `volunteers`,
`sevas`. These are **not** RLS-hidden (§6). Pages that depend on them show empty states.
**Action**: seed the content the owner wants (the fresh-seed plan covers
`announcements`, `daily_poojas`, `donation_campaigns`, `temple_areas`).

### F-A7 — `quotes` holds 6 rows where the seed defines 33 — **Low (data)**
`/api/quotes/stats` reports 6; `seed/quotes-seed-data.json` defines 33
(`lib/supabase/seed-data/quotes.ts`). The daily-quote rotation therefore repeats quickly.
**Action**: run the quotes seed (it is idempotent on `slug`).

### F-A8 — `site_settings` holds a stray `trustCommittee` document row — **Low (data hygiene)**
Two rows; the second has `firestore_id = 'trustCommittee'` and a generic temple name — a
mis-mapped legacy document. Readers tie-break `updated_at desc, id asc`, so the correct row
wins deterministically. **Action**: have the owner delete the stray row (a write — out of
scope here). See the table inventory §3.

### F-A9 — Sandbox `SUPABASE_DB_URL` is a different project — **Medium (process)**
The sandbox credential points at a "Tournament" schema, not the temple database. Any audit or
seed that trusts `SUPABASE_DB_URL` as "the production database" would read and write the wrong
place. `scripts/seed-fresh-supabase.ts` requires an explicit `--local` + `DATABASE_URL`, which
mitigates accidental targeting, but the risk is real. **Action**: never infer the target from
`SUPABASE_DB_URL`; pass the production URL explicitly and keep the project-ref guard.

### F-A10 — Repository migrations understate the applied production schema — **Low (process)**
`20261105000000_events_public_select_policy.sql` says "prepared, NOT applied", yet production
serves 74 published events to the anon key; `20261111000000_aaradhanas_public_select_policy.sql`
is likewise applied. **Action**: mark these migrations applied in the repo.

### F-A11 — Quote reads used to write to the database — **High (fixed)**
`QuoteService.getTodaysQuote` is reached from the public homepage render
(`app/(public)/page.tsx` → `services/daily-spiritual.server.ts` → `quoteService`) and from
`GET /api/quotes/today`. It performed two writes:

- **auto-seed**: when `getQuotes({active:true})` returned nothing it called
  `seedDefaultQuotes()`, inserting the 33 `DEFAULT_QUOTES_DATA` rows (`quote.server.ts:609-617`);
- **view counter**: on every non-cached call it fired `incrementViewCount(quote.id)`, a
  `quotes` UPDATE (`quote.server.ts:713-717`).

A page view, a build-time prerender or an SSR render could therefore mutate the database.
**Fixed** (this PR): both writes are removed from the read path. Seeding is now only
`POST /api/admin/quotes/seed`; `incrementViewCount` remains available but is not called from a
read. Regression test: `tests/unit/quote-read-no-write.test.ts`.
**Affected**: `services/quote.server.ts`, `services/quote.service.ts`.

### F-A12 — Four admin quote endpoints had no authentication — **High (fixed)**
`proxy.ts` does not gate `/api/admin/*`, so each handler must verify the caller. Only
`app/api/admin/quotes/route.ts` did. These were reachable without a token:

| Route | Effect |
|---|---|
| `POST /api/admin/quotes/seed` | inserts the default quotes |
| `POST /api/admin/quotes/bulk` | bulk import |
| `GET /api/admin/quotes/bulk` | exports every quote |
| `POST /api/admin/quotes/cache` | clears the in-memory cache |
| `GET/PUT/DELETE /api/admin/quotes/[id]` | read/update/delete any quote |

**Fixed** (this PR): every handler now calls `verifyAdminUser` and returns `401` otherwise.
The admin UI (`app/admin/quotes/page.tsx`) was switched from raw `fetch` to the `apiFetch`
helper (`lib/api/fetch.ts`), which attaches the caller's Firebase ID token, so the page keeps
working. Regression test: `tests/unit/admin-quotes-route-auth.test.ts`.
**Affected**: the five route files, `app/admin/quotes/page.tsx`.

### F-A13 — Other `/api/admin/**` routes are unguarded too — **High (open)**
The same `proxy.ts` gap that produced F-A12 leaves a second cluster unauthenticated. A scan of
all 35 `app/api/admin/**/route.ts` files for any of `verifyAdminUser`, `requireRayaAdminUser`,
`requireStaffAdmin`, `verifyIdToken` or `getUser(` found **six without a guard**:

| Route | Reaches | Severity |
|---|---|---|
| `GET/POST /api/admin/temple-areas` | `templeAreasService` → `temple_areas` **read + create** | **High** |
| `GET/PUT/DELETE /api/admin/temple-areas/[id]` | `temple_areas` **read + update + delete** | **High** |
| `GET /api/admin/analytics` | `getAnalyticsSummary()` — chat/intent metrics | **High** |
| `POST /api/admin/analytics` | `logIntentFeedback()` — inserts a feedback row | Medium |
| `GET/POST /api/admin/content` | `services/content.service.ts` | Low |
| `app/api/admin/users/{create-admin,set-role}` | *not actually unguarded* — they call `requireStaffAdmin` (a different symbol), so the scan flagged them by name only | — |

So the real gap is **`temple-areas` (both files), `analytics` (both methods)** and `content`.
`app/admin/temple-areas/page.tsx` calls the temple-areas routes with raw `fetch`, the same
reason the quote routes were unguarded.

**Why it matters**: `temple_areas` is read by the public site (`/api/temple-areas`), so an
unauthenticated `POST`/`DELETE` here lets anyone add or remove a public map entry.
**Action**: add `verifyAdminUser` to these handlers and move the calling pages onto `apiFetch`,
exactly as F-A12 does. Not fixed in this PR to keep the change reviewable — it is a distinct
surface from the quote endpoints and deserves its own reviewed change.
**Affected**: `app/api/admin/temple-areas/route.ts`, `app/api/admin/temple-areas/[id]/route.ts`,
`app/api/admin/analytics/route.ts`, `app/api/admin/content/route.ts`,
`app/admin/temple-areas/page.tsx`.

---

## 6. Genuinely empty vs RLS-hidden

Under PostgREST, a deny-all table returns `HTTP 200`, body `[]`, `content-range: */0` — the
same shape as a truly empty table. The audit therefore used the site's own service-role
endpoints to separate the two. Result:

- **Genuinely empty** (service-role confirmed): `announcements`, `temple_areas`,
  `featured_content`, `donations`, `seva_bookings`, `members`, `volunteers`, `sevas`,
  `daily_poojas`, `donation_campaigns`, and the analytics/chat tables (no traffic).
- **RLS-hidden, true count unknown** (401 to anon, no service-role reader): `staff`,
  `seva_orders`, `seva_receipts`, `seva_receipt_lines`, `counters`, `counter_devices`,
  `receipt_series*`, `day_closes`, `day_close_counts`, `audit_log`, `devotee_profiles`,
  `cash_denominations`, `ops_backup_runs`, `seva_settings`, `seva_list_items`,
  `group_counters`, `festival_days`, `festival_day_dates`, `bills`, `profiles`.
  These must be reported **UNKNOWN**, never 0.
- **RLS-hidden but revealed by app endpoints**: `quotes` (6), `gallery_albums` (4),
  `gallery_media` (7), `testimonials` (2), `ai_knowledge` (19), `ai_settings` (1),
  `site_settings` (2), `settings_documents` (5 of 9 keys), `users` (1).

PostgREST **planner estimates are unreliable** here (e.g. `site_settings` estimate 280 vs exact 2),
so no estimate was used as a count.

---

## 7. Missing data required by the website

Ranked by visible impact (details in `PROPOSED_FRESH_DATA_SEED_PLAN.md`):

| # | Missing data | Table / key | Page affected | Severity |
|---|---|---|---|---|
| 1 | Daily pooja schedule | `daily_poojas` (13 rows seeded) | `/pooja` | High |
| 2 | Announcements | `announcements` (1) | site-wide banner | High |
| 3 | Trust Committee | `settings_documents('trustCommittee')` | `/trust` | High |
| 4 | Temple areas | `temple_areas` (2) | `/api/temple-areas`, map | Medium |
| 5 | Homepage config | `settings_documents('homepage')` | `/` | Medium |
| 6 | Festival / Ekadashi calendars | `settings_documents(...)` | calendar pages | Medium |
| 7 | Donation campaign | `donation_campaigns` (1) | donation CTA | Medium |
| 8 | Featured carousel | `featured_content` | homepage | Low |
| 9 | Seva catalogue | `sevas` | `/seva` | Low (owner-owned) |
| 10 | Quote library | `quotes` (33 seeded, 6 present) | daily shloka | Low |

Items 1–7 are exactly the rows the **fresh-seed** process covers (18 tables / 69 rows, plus
9 `settings_documents` keys). Items 8–10 need a separate decision.

---

## 8. Tests and static checks

Run locally on this branch (read-only; no production connection):

| Check | Command | Result |
|---|---|---|
| Unit | `npx jest tests/unit --silent` | **209 suites passed, 2680 tests passed** |
| DB integration | `npm run test:db` | **17 suites passed, 244 tests passed** |
| Type check | `npx tsc --noEmit` | **clean** (0 errors) |
| Lint | `npx eslint .` | **0 errors**, 714 warnings (pre-existing, mostly unused imports) |
| Seed dry-run | `DATABASE_URL=… npm run seed:fresh:dry-run` | **18 tables, 69 rows**, "Nothing was written." |

The unit count grew from the 207/2668 on `main` @ `b1401ae` by the two regression tests added
for F-A11/F-A12:

- `tests/unit/quote-read-no-write.test.ts` (4 tests) — drives the real `QuoteService` against a
  recording Supabase stub and fails if `getTodaysQuote` issues an `insert`/`update`/`upsert`/
  `delete`. Verified to fail when the auto-seed is temporarily restored.
- `tests/unit/admin-quotes-route-auth.test.ts` (8 tests) — calls each handler with no token and
  asserts `401` with no service write, and that `seed` still runs when authorized.

**No test failures.** The DB suite connects to the sandbox Postgres, not production, and its
seva tests run against a local schema — it does **not** validate the production database.

The fresh-seed DB suite (`tests/db/fresh-seed.test.ts`) already encodes the guarantees the seed
plan depends on: seeds on the first run and nothing on the second (L135), preserves an admin
edit across a re-run (L167), never fabricates unverified facts (L188), skips a non-empty table
(L225), adds only missing `settings_documents` (L247), seeds gallery album+media together with
no orphans (L290), and aborts when the parent check fails (L364).

---

## 9. PR #365 seed process — safety analysis

### 9.1 What the seed does

`npm run seed:fresh` → `scripts/seed-fresh-supabase.ts` → `lib/supabase/seed-data/{plan,runner}.ts`.
Dry-run plan (verified locally):

```
18 tables, 69 rows to upsert (conflict-safe).
  site_settings 1, social_links 1, announcements 1, daily_poojas 13,
  donation_campaigns 1, gallery_albums 1, gallery_media 7, temple_areas 2,
  testimonials 0, members 0, volunteers 0, quotes 33, settings_documents 9,
  page_views / daily_page_stats / intent_metrics / intent_feedback / chat_metrics (table only)
```

### 9.2 Can the seed even run against production? — **No. It refuses production by design.**

`scripts/seed-fresh-supabase.ts:63-101` `checkGuards`:

- refuses when `NODE_ENV=production`, `VERCEL` or `CI` is set;
- `--project-ref` explicitly refuses the approved project (`:78` *"This command has no supported
  production seed path."*);
- `--local` refuses any `DATABASE_URL` that resolves to the approved project (`:88-97`), matched
  through `scripts/lib/approved-project.mjs` `APPROVED_PROJECT_REF = "kvrkraqjuyxbraccxntk"`.

So the seed **cannot** be the mechanism that populates production; a separately reviewed write
path is required (see `PROPOSED_FRESH_DATA_SEED_PLAN.md` §4).

### 9.3 Would it overwrite existing records if it were run? — **No**

- **`seedWhen: "empty"`** (content tables): the runner checks `port.tableHasRows(table)` and
  **skips the whole table** if any row exists (`runner.ts:95`). Existing rows are never touched.
- **`seedWhen: "always"`** (only `settings_documents`): `INSERT … ON CONFLICT (document_key)
  DO NOTHING` — it **adds missing keys and never rewrites an existing document**
  (`runner.ts:9-11`; `tests/db/fresh-seed.test.ts:247`).
- **`insertOnly`** (devotee/analytics data): never seeded at all (`runner.ts:84`).

The only rows it would add to an occupied table are the four missing `settings_documents` keys
(F-A4). It would not overwrite the owner's existing `aboutUs`, `facilities`, `futurePlans`,
`poojaSchedule` or `footer`, and it would not touch `quotes` (already non-empty → skipped).

### 9.4 Idempotency / repeatability — **Yes**

- Content tables: no-op on the second run (all non-empty).
- `settings_documents`: no-op for keys already present.
- `quotes`: conflict-safe on the `slug` unique key.
- `gallery_media`: only seeded when `gallery_albums` is seeded **in the same run**
  (`dependsOn`), so a re-run with albums already present seeds no media — no orphans.

### 9.5 Parent–child dependencies

`gallery_media.dependsOn = "gallery_albums"`. If the parent check fails, the runner **aborts
the entire run** (fail-safe, `tests/db/fresh-seed.test.ts:364`). No other seed entry declares a
dependency; no FK exists between content tables, so ordering risk is limited to gallery.

### 9.6 Duplicate protection

Unique keys used by the conflict clauses: `settings_documents.document_key`, `quotes.slug`,
`sevas.code`, and `firestore_id` on every content table. The runner asserts the conflict target
exists before inserting (`runner.ts`), so a missing unique index fails loudly rather than
silently duplicating.

### 9.7 Risk assessment of running the seed on production

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Seeds a table that actually holds rows the anon key cannot see | Low | Low | `seedWhen:"empty"` skips any non-empty table; only `settings_documents` inserts into an occupied table. |
| Duplicate `site_settings`/stray rows | Low | Low | `site_settings` is `seedWhen:"empty"`; the existing 2 rows make it a no-op. |
| Writes while the site serves traffic | Medium | Low | Seed rows are additive and the site reads tolerate missing keys. |
| Wrong database targeted | Medium | High | `--local` requires explicit `DATABASE_URL`; production must be passed deliberately with the project-ref guard. |
| `firestore_id` collision with a future migration | Low | Medium | `firestore_id` is nullable+unique; new rows use `seed-*` ids. |

**Conclusion**: the seed is safe **as an operation** — additive, conflict-safe, idempotent and
dependency-checked — and it **cannot run against production at all** (9.2). Filling production
data therefore requires a separately reviewed write path
(`PROPOSED_FRESH_DATA_SEED_PLAN.md` §4), not this command.

---

## 10. Answers to the nine work items

1. **Pages/routes/services/repositories that read or write data** — inventoried in §4; three
   Supabase clients; the browser is confined to `/api/**` and server actions for deny-all
   tables.
2. **Remaining Firestore dependencies / fallback paths** — no fallback reads; residual
   **writes/reads** to `users` and `page_views` (Firestore audit §2, F-1…F-5).
3. **Feature → Supabase table map** — §4.
4. **Schema, row counts, FKs, indexes, RLS** — `PRODUCTION_TABLE_INVENTORY.md` §4.
5. **Empty vs RLS-hidden** — §6.
6. **Missing data** — §7.
7. **Overwrite by the PR #365 seed** — §9.2 (no).
8. **Parent–child, duplicate protection, repeatability** — §9.3–9.5.
9. **Tests** — §8 (all pass; no failures).

---

## 11. Recommended actions (not executed)

| Priority | Action | Type |
|---|---|---|
| P0 | Remove the Firestore write from `proxy.ts` (F-A1) | Code |
| P0 | Obtain owner approval and fill the missing data through a reviewed write path — the seed command **refuses production** (`PROPOSED_FRESH_DATA_SEED_PLAN.md` §4) | Production write |
| P0 | Guard the remaining unauthenticated admin routes — `temple-areas` (read/write/delete), `analytics` (both methods), `content` (F-A13) | Code |
| P1 | Migrate `isUserAdmin` to Supabase (F-A2) | Code |
| P1 | Decide the `users` Firestore mirror (F-A3) | Code |
| P1 | Seed the `quotes` library (F-A7) | Production write |
| P2 | Delete the stray `site_settings` row (F-A8) | Production write |
| P2 | Mark applied migrations applied (F-A10) | Repo |
| P2 | Add `announcements`/`daily_poojas`/`temple_areas`/`featured_content` seed entries to the plan if the owner wants starter content | Code |
| P3 | Delete dead Firestore code (Firestore audit F-7/F-8) | Code |

### 11.1 Fixed in this PR

| Finding | Fix |
|---|---|
| F-A11 — quote reads wrote to the database | Removed the auto-seed and view-counter writes from `getTodaysQuote` in `services/quote.server.ts` and the duplicate `services/quote.service.ts`. |
| F-A12 — four admin quote endpoints had no auth | Added `verifyAdminUser` guards to `app/api/admin/quotes/{bulk,cache,seed,[id]}/route.ts`; moved `app/admin/quotes/page.tsx` onto `apiFetch`. |

**No production change was made.** Every action above that touches production data is proposed
and unexecuted; the F-A11/F-A12 fixes are code-only changes on the PR branch.
