# PR-D4d — Reader cutover completion plan

Status: **PLAN ONLY — nothing in this document is implemented.** No migration is applied,
no schema is changed, no Firestore read is removed, no database write is enabled.
Production migration status remains **HOLD**.

Parent: `docs/PR-D4c_READER_CUTOVER.md` (which cut over `events` and fixed the
`event.service.ts` read-failure swallow). This document is the concrete plan for the
readers that PR-D4c left behind. It enumerates the remaining Firestore-backed readers,
names the schema decisions they are blocked on, and splits the work into independently
reviewable units. It proposes no refactor.

Why a plan and not the change: most of the remaining collections have **no Supabase
table**, so their cutover is a schema decision that belongs to the owner, not a mechanical
rewrite. Even the mechanical part touches user-facing pages, so each unit needs its own
review. PR-D4c assumed seven collections; the census in §2 finds 47.

---

## 1. What is already done (PR-D4c)

| Item | State |
|---|---|
| `events` public `SELECT` policy | Prepared, **not applied** (`20261105000000_events_public_select_policy.sql`) |
| `event.service.ts` read failure | Surfaces `EventReadError` instead of returning `[]` |
| `EVENTS_COLLECTION` dead constant | Removed |
| IST civil-date classification | Fixed in `determineEventStatus` |
| Reader cutover for populations A and B | **Not done** — see §10 of PR-D4c |

The `events` reader (`services/event.service.ts`) still uses the **anon** key and depends
on the unapplied policy. That is the one live defect; everything else below is an
unfinished migration, not a bug.

---

## 2. The remaining Firestore-backed readers

Produced by grepping every `firebase/firestore` import and every `collection(db, …)` /
`doc(db, …)` / `*COLLECTION = "…"` in `app/`, `components/`, `services/`, `lib/`, `hooks/`
and `utils/`. The reader surface is **much larger than PR-D4c assumed** — PR-D4c §10 listed
seven collections; the census below yields **47 distinct collection names** (including two
debug ones). That scale difference is the main finding of this document.

Table status uses the camelCase → snake_case convention the migration writer applies
(`galleryAlbums` → `gallery_albums`, `dailyPoojas` → `daily_poojas`, `sevaBookings` →
`seva_bookings`). A collection whose snake_case name has no `CREATE TABLE` is a blocker.

### 2.1 Group 1 — destination table exists (mechanical rewrite)

No schema decision needed. Each is an independent change.

| Firestore collection | Supabase table | Readers |
|---|---|---|
| `galleryAlbums` | `gallery_albums` | `services/gallery.service.ts`, `app/admin/media/page.tsx` |
| `galleryMedia` | `gallery_media` | `services/gallery.service.ts`, `hooks/useGallery.ts`, `app/admin/media/page.tsx` |
| `donations` | `donations` | `services/donation.service.ts`, `hooks/useDonationNotifications.ts`, `app/api/public/stats/route.ts` |
| `donation_campaigns` | `donation_campaigns` | `services/donationCampaign.service.ts` — **dead, delete** (§2.4) |
| `sevas` | `sevas` | `services/seva.service.ts`, `app/admin/content/page.tsx`, `app/admin/featured/page.tsx` |
| `sevaBookings` | `seva_bookings` | `services/sevaBooking.service.ts`, `app/api/public/stats/route.ts` |
| `testimonials` | `testimonials` | `services/testimonial.service.ts`, `services/chat.service.ts`, `app/admin/content/page.tsx` |
| `dailyPoojas` | `daily_poojas` | `services/pooja.service.ts` |
| `volunteer_requests` | `volunteer_requests` | `services/chat.service.ts`, `app/admin/content/page.tsx` |
| `unknown_questions` | `unknown_questions` | `services/analytics.service.ts` |
| `chat_sessions` | `chat_sessions` | `app/admin/page.tsx` (count) |
| `users` | `users` | `services/auth.service.ts`, `services/user.service.ts`, `lib/auth.ts`, `lib/auth/admin.ts`, `app/admin/page.tsx` (count), `app/api/public/stats/route.ts` (count) — server-side, `EXCLUDE_AUTH` (§4.3) |
| `settings/<doc>` | `settings_documents` | 4 public pages + **11** `app/admin/settings/**` pages + `app/admin/billing/**` + `components/layout/Footer.tsx` + `hooks/useFinanceSettings.ts` + `lib/device/settings.ts` — §3.1. `guru-parampara` is **already migrated** (PR #360, §3.4) and `homepage` reads `homepage/config`, not `settings/<doc>`; neither is counted here. |
| `events` | `events` | `lib/firebase.ts` (`getNextUpcomingEvent`), `services/daily-spiritual.service.ts`, `app/admin/content/page.tsx` (count), `app/admin/featured/page.tsx`, `app/admin/test-firebase/page.tsx` |

### 2.2 Group 2 — no Supabase table (schema decision required)

Pointing these readers at Supabase would silently return nothing.

| Firestore collection | Readers | Decision |
|---|---|---|
| `announcements` | `services/announcement.service.ts`, `services/daily-spiritual.service.ts:388`, `lib/ai/retrieval/announcements.ts`, `app/admin/featured/page.tsx`, `app/admin/content/page.tsx:91` | §4.1 |
| `homepage` | `services/homepage.service.ts`, `hooks/useHomepage.ts` | §4.4 |
| `featuredContent` | `app/admin/featured/page.tsx` | §4.5 |
| `quotes` | `services/quote.service.ts` (18 callers) | §4.6 |
| `members`, `volunteers` | `services/volunteer.service.ts`, `app/admin/page.tsx` (count), `app/api/public/stats/route.ts` (count) | §4.7 |
| `gallery`, `poojas` | `app/admin/content/page.tsx` (counts) | §4.7 |
| `notifications` | `services/testimonial.service.ts` | §4.9 |
| `timings` | `services/dashboard.service.ts` (dead code — §2.4) | §4.2 |
| `bills` | `services/billing.service.ts`, `app/admin/billing/**` | §4.10 |
| `bookmarks`, `profiles` | `services/profile.service.ts` | §4.11 |
| `knowledge` | `app/api/admin/knowledge/route.ts`, `app/api/admin/knowledge/[id]/route.ts`, `app/admin/content/page.tsx`, `app/admin/featured/page.tsx` | §4.12 |
| `chat_metrics`, `intent_metrics`, `intent_feedback` | `services/analytics.service.ts` | §4.13 |
| `page_views`, `daily_page_stats` | `services/pageviews.service.ts`, `components/analytics/PageViewTracker.tsx`, `app/admin/page.tsx` | §4.13 |
| `feedback` | `services/chat.service.ts` | §4.13 |
| `knowledge_workflow*` (7 collections) | `services/knowledge-workflow.service.ts` → `app/api/knowledge/workflow/**` | §4.14 |
| `chatTraining` | `app/admin/ai/training/page.tsx` | `EXCLUDE_SYSTEM` — out of scope |
| `test` | `app/admin/test/page.tsx` | debug page — out of scope |
| `sessions` | `services/pageviews.service.ts:11` | `EXCLUDE_AUTH`; a pageview "session" is **not** a Firebase Auth session — this reference needs a separate decision (§4.13) |

### 2.3 Group 3 — count-only reads

Two files read whole collections only to count them:

- `app/admin/page.tsx:113-123,184` — counts `users`, `volunteers`, `members`, `donations`,
  `sevaBookings`, `events`, `chat_sessions`, plus upcoming events and completed donors.
- `app/api/public/stats/route.ts:34-44` — the public stats endpoint, counting `users`,
  `volunteers`, `members`, `donations`, `sevaBookings`, `events`.

These are the readers that make the missing tables visible. They cannot cut over until
`members`, `volunteers` and `gallery` have a destination or those counts are dropped.

### 2.4 Dead code — do not plan work around it

Four service files read Firestore but **nothing imports them** (verified by grepping every
import path across `app/`, `components/`, `services/`, `lib/`, `hooks/`):

- `services/dashboard.service.ts` + `services/dashboard.service.client.ts` — read eight
  collections (`users`, `events`, `sevas`, `gallery`, `announcements`, `timings`, `donations`,
  `sevaBookings`).
- `services/donationCampaign.service.ts` — reads `donation_campaigns` (a table that exists).
- `services/profile.service.ts` — reads `bookmarks`, `profiles`.

None is a cutover target: delete them (U0). They appear in the tables above only so a future
reader does not mistake them for live readers. Deleting them removes five collections
(`timings`, `gallery`, `donation_campaigns`, `bookmarks`, `profiles`) from the live surface
outright — the cheapest available reduction in migration scope.

### 2.5 Scope reality

This is a **multi-PR programme, not one change.** The 47-collection surface splits into
~11 independently shippable units (§5). PR-D4c's "seven collections" figure undercounted by
roughly 6×; any plan that assumes a single reader-cutover PR will either balloon or ship
half-migrated readers that return empty.

---

## 3. Reference patterns (do not invent new ones)

Three patterns already exist in the repository. Every unit below reuses one of them.

### 3.1 Container documents — `settings_documents`

`settings_documents (firestore_id, document_key, data jsonb, …)` is the lossless
container for whole settings documents. `services/guru-parampara.service.ts:98,117` is the
worked example: it reads and upserts a named document through `createAdminClient()` on the
server.

**The exact key format matters.** `mapSettingsDocument` (`lib/supabase/migration-mappers.ts:837-846`)
sets `document_key: id` — the **raw Firestore document id**, not a collection-qualified
path. So `settings/aboutUs` migrates to `document_key = "aboutUs"`, and `homepage/config`
migrates to `document_key = "config"`. The four public settings pages therefore read:

| Page | `settings` doc id | `document_key` |
|---|---|---|
| `app/(public)/about/page.tsx:112` | `aboutUs` | `aboutUs` |
| `app/(public)/facilities/page.tsx:126` | `facilities` | `facilities` |
| `app/(public)/future-plans/page.tsx:108` | `futurePlans` | `futurePlans` |
| `app/(public)/trust/page.tsx:61` | `trustCommittee` | `trustCommittee` |

`document_key` is `UNIQUE`. Because `settings` and `homepage` both map into this one table
with an unqualified id, a `settings/config` document and `homepage/config` would collide on
`document_key = "config"`. That collision does not exist today (there is no `settings/config`
document), but the reader for §4.4 must be written with this in mind, and the owner should
decide whether to qualify the key going forward. **This is the single most likely way a
cutover silently returns nothing.**

### 3.2 Deny-all server table — `services/temple-areas.supabase.service.ts`

`temple_areas` is deny-all under RLS, so `TempleAreasSupabaseService` reads it with
`createAdminClient()` on the server. This is the pattern for any table with no `SELECT`
policy: read it server-side, not with the anon key. `settings_documents` is in the same
class.

### 3.3 Public read table — `services/settings.service.ts`

`site_settings` and `social_links` have permissive `SELECT` policies, so
`services/settings.service.ts:43,83` reads them with the plain client. Use this only for a
table that already has a public `SELECT` policy; do not add one as part of a reader change
without the owner's approval (the `events` policy in PR-D4c is the precedent for how that
approval is requested and recorded).

### 3.4 Already migrated — admin `guru-parampara` (PR #360)

`app/admin/settings/guru-parampara/page.tsx` no longer reads or writes Firestore. PR #360
replaced its browser-side `getDoc`/`setDoc` on `settings/guruParampara` with an
admin-guarded route (`app/api/admin/settings/guru-parampara/route.ts`) over
`services/guru-parampara.service.ts`, which reads/upserts a `settings_documents` row with
`document_key = "guruParampara"` (§3.1). This is the first `settings/<doc>` reader off
Firestore, so the §2.1 `settings/<doc>` row excludes it.

**This is a code cutover only — the data dependency is unresolved and must be stated, not
assumed.** `services/guru-parampara.service.ts` `get()` returns `null` when no
`settings_documents` row exists yet, and the page then falls back to its in-file
`defaultData`. The Firestore document is moved into that row only by
`npm run migrate:settings` (`scripts/migrate-settings.ts`, which reads the `settings`
collection and maps `guruParampara` via `mapSettingsDocument`). Until that migration runs,
an admin opening the page sees the built-in defaults rather than the live Firestore
content, and the first **Save** writes those defaults over the container — a silent
content loss that looks like a successful save.

**Owner decision (new):** confirm the ordering before the admin page is used in
production — either (a) run `npm run migrate:settings` so the `guruParampara` row exists
before the cutover is deployed, or (b) keep the Firestore read until the settings data
migration has run. Do **not** treat the code cutover as complete on its own. Verify with a
read-only `select data from settings_documents where document_key = 'guruParampara'`.


---

## 4. The schema decisions (owner-gated)

Each subsection states the decision, the recommended option, and what it unblocks.
**None of these is implemented by this PR.**

### 4.1 `announcements` — needs a table

- **Shape** (`types/announcement.ts:1-9`): `id`, `title`, `message`, `link?`, `isActive`,
  `createdAt`, `updatedAt`. Flat, small, no nesting.
- **Readers**: the `announcement.service.ts` service (6 callers: the admin list, the new/edit
  forms, `app/api/announcements/route.ts`, `components/home/AnnouncementBar.tsx`), the
  daily-spiritual featured strip (`services/daily-spiritual.service.ts:388`), the admin
  content count (`app/admin/content/page.tsx:91`), and Raya AI's
  `lib/ai/retrieval/announcements.ts`.
- **Recommended**: create `announcements` with the columns above and a **public `SELECT`
  policy limited to `is_active = true`**, mirroring the `events` policy
  (`20261105000000_events_public_select_policy.sql`). The admin list needs inactive rows, so
  it reads server-side (pattern §3.2) — the same split PR-D4c chose for `events`.
- **Also note**: `lib/ai/retrieval/announcements.ts` currently reads Firestore and is on the
  `/api/chat` path; it is the one AI reader still on Firestore. It is listed in the backlog's
  Raya-AI gap and should move with this table, not before it.
- **Unblocks**: `announcement.service.ts`, the daily-spiritual strip, the admin content count,
  and one Raya AI retrieval path.

### 4.2 `timings` — no live reader; do not create a table

- **Only reference**: `services/dashboard.service.ts:25`, a `getCountFromServer` in a file
  **nothing imports** (§2.4). The public temple-timings UI
  (`components/home/TempleTimings.tsx`) does **not** read this collection — it reads
  `homepage/config` via `useHomepage()`. So `timings` has no live reader at all.
- **Recommended**: **create nothing.** Delete the dead service (§2.4). If a timings count is
  ever wanted, read it from `homepage/config`, which already holds the timings.
- **Unblocks**: nothing — this is a deletion, not a migration.

### 4.3 `users` — server-side only

- `users` is `EXCLUDE_AUTH` in `MIGRATION_INVENTORY`. Readers are `services/auth.service.ts`,
  `services/user.service.ts`, `lib/auth.ts`, `lib/auth/admin.ts` — all already server-side.
  Application data attached to a user (`profiles`, `bookmarks`) is a separate item, but its
  only reader is dead (§4.11).
- **Recommended**: keep these reads server-side and do **not** add a public policy. This is
  the least-risky group; it can proceed independently of §4.1/§4.2 because the table exists.

### 4.4 `homepage/config` — reuse `settings_documents`

- `services/homepage.service.ts:17,35` reads/writes a single `homepage/config` document;
  `hooks/useHomepage.ts` reads it; `components/home/TempleTimings.tsx` consumes it.
- **Recommended**: treat it as one more `settings_documents` row, read server-side. The
  migrated key is `config` (§3.1) — unqualified, so confirm no `settings/config` document
  exists before reading by that key. No new table.

### 4.5 `featuredContent` — needs a table

- **Only reader/writer**: `app/admin/featured/page.tsx:109,218,235`. Admin-only.
- **Recommended**: a small `featured_content` table (admin-only, deny-all, server-side reads
  via §3.2). Low priority — it has no public reader, so it does not block the public site.

### 4.6 `quotes` — needs a table

- `services/quote.service.ts` (18 callers) reads/writes `quotes`; public pages show a quote
  of the day.
- **Recommended**: a `quotes` table with a public `SELECT` policy for the active/visible
  subset, and server-side reads for the admin list. Larger than the others because of the
  caller count; split the read path from the write path so the public quote-of-the-day can
  cut over first.

### 4.7 `members`, `volunteers`, `gallery`, `poojas` — count-only collections

- Read by the public stats endpoint (`app/api/public/stats/route.ts:34-44`, counts only) and
  the admin dashboard (`app/admin/page.tsx:113-123`, counts only), and `members`/`volunteers`
  also by `services/volunteer.service.ts` (full CRUD). `gallery`/`poojas` appear only as
  counts in `app/admin/content/page.tsx:93-95`.
- **Recommended**: these are counts on a public endpoint. Either give each a small table, or
  drop the counts from the public stats response. `volunteer_requests` already exists;
  `volunteers`/`members` are the aggregates. `gallery` is superseded by
  `gallery_albums`/`gallery_media` and `poojas` by `daily_poojas` — for those two, drop the
  count rather than create a table. Decide with the owner which the stats page should show.

### 4.8 `settings/<doc>` container — confirm the data migration precedes the code cutover

- The `settings/<doc>` readers land in `settings_documents` (§3.1). One of them,
  `guru-parampara`, is **already code-cut-over** in PR #360 (§3.4); the rest (U3) follow the
  same container.
- **Decision:** confirm the ordering — the `settings_documents` rows must exist before the
  readers are cut over, because a reader with no row returns nothing (or the page's
  defaults) and the next save can overwrite live content. `npm run migrate:settings` is the
  only writer of those rows. Record the check (read-only) as the gate for U3.

### 4.9 `notifications` — check before creating anything

- Referenced by `services/testimonial.service.ts`. Confirm whether it is live before
  deciding; if it is dead, delete the reference rather than migrate it.

### 4.10 `bills` — needs a table

- `services/billing.service.ts` (imported by `app/admin/billing/page.tsx` and
  `app/admin/billing/create/page.tsx`) reads/writes `bills`.
- **Recommended**: a `bills` table, admin-only, deny-all, server-side reads (§3.2). The
  `app/admin/billing/**` pages also read `settings/<doc>` (Group 1) for billing settings, so
  this unit moves both at once.

### 4.11 `bookmarks`, `profiles` — dead; delete rather than migrate

- The only reader is `services/profile.service.ts`, which **nothing imports** (§2.4). Both
  collections are `REVIEW` in the inventory as "application data linked to auth".
- **Recommended**: delete `services/profile.service.ts` (U0) and drop both collections from
  the live surface. If a profile/bookmarks feature is later wanted, build it against the
  existing `profiles` table then — do not migrate a dead reader.

### 4.12 `knowledge` — needs a table, and it is AI-facing

- Read by `app/api/admin/knowledge/route.ts:10` and `app/api/admin/knowledge/[id]/route.ts:8`
  (both via `lib/firebase-admin-rest`), `app/admin/content/page.tsx:96,121` and
  `app/admin/featured/page.tsx:147`. The inventory classifies it `MIGRATE` (destination "AI
  Knowledge Base"), but no `knowledge` table exists — the AI knowledge table is `ai_knowledge`,
  which is a **different shape** (`ai_knowledge` is article-shaped with
  `slug`/`content`/`keywords`).
- **Recommended**: this is the highest-uncertainty item. Confirm whether `knowledge` and
  `ai_knowledge` are the same data before mapping one to the other; a blind map would corrupt
  the knowledge base. Treat as its own investigation, not a mechanical rewrite.

### 4.13 Analytics — `chat_metrics`, `intent_metrics`, `intent_feedback`, `page_views`, `daily_page_stats`, `feedback`, `sessions`

- `services/analytics.service.ts` (Firestore-only, imported by
  `app/api/admin/analytics/route.ts` and `services/ml.service.ts`) reads `chat_metrics`,
  `intent_metrics`, `intent_feedback` (and `unknown_questions`, which already has a table —
  Group 1); `services/pageviews.service.ts` (Firestore-only, imported by `app/admin/page.tsx`
  and `components/analytics/PageViewTracker.tsx`) reads `page_views`, `daily_page_stats`,
  `sessions`; `services/chat.service.ts` reads `feedback`.
- **`sessions` warning**: `pageviews.service.ts:11` names a collection `sessions`, but a
  pageview session is **not** a Firebase Auth session. `sessions` is `EXCLUDE_AUTH` because
  the *auth* collection is excluded — do not let that classification silently drop a
  pageview collection of the same name. Confirm what this collection holds before deciding.
- **Recommended**: these are high-volume, append-only, analytics data. They are the lowest
  priority (no user-facing read) and the best candidates to be **dropped rather than
  migrated** if the analytics UI is not required. Owner call.

### 4.14 `knowledge_workflow` family — 7 collections, largest single unit

- `services/knowledge-workflow.service.ts` reads/writes `knowledge_workflow`,
  `knowledge_versions`, `knowledge_workflow_actions`, `knowledge_review_comments`,
  `knowledge_committee_approvals`, `knowledge_audit_log`, `knowledge_drafts`, surfaced through
  `app/api/knowledge/workflow/**`.
- **Recommended**: none of the seven has a Supabase table. This is a self-contained subsystem
  (articles → versions → review → committee approval → audit). It should be migrated as one
  unit or explicitly deferred; do not half-migrate it, because its states reference each
  other by id.

---

## 5. Proposed work units

Each unit is independently reviewable and leaves the repository consistent. Order matters:
U1 is the live defect; U0 and U3-U4 are mechanical; U5-U10 need the schema decisions.

| Unit | Scope | Depends on | Risk |
|---|---|---|---|
| **U0** | Delete dead `services/dashboard.service.ts` + `.client.ts` (§2.4) | none | trivial |
| **U1** | Apply the `events` `SELECT` policy; verify the public list and homepage strip against the live DB | owner approval (PR-D4c §9) | low |
| **U2** | Population-B admin `events` reader → server route (service-role, existing admin guard) | U1 | low |
| **U3** | `settings/<doc>` readers (public pages, admin settings, billing, footer, finance hook, device) → `settings_documents` via §3.1 (`guru-parampara` already done in PR #360) | confirm `document_key` format; confirm the `settings_documents` rows exist first (§4.8) | low |
| **U4** | Group 1 mechanical readers (gallery, donations, donation_campaigns, sevas, sevaBookings, testimonials, dailyPoojas, volunteer_requests, unknown_questions, chat_sessions, users, events, remaining `daily-spiritual`) | none | medium (volume) |
| **U5** | `announcements` table + policy + readers (§4.1) | owner schema decision | medium |
| **U6** | `homepage` → `settings_documents` (§4.4) | owner decision | low |
| **U7** | `quotes`, `featuredContent`, `notifications`, `bills`, `profiles`/`bookmarks`, `members`/`volunteers`/`gallery`/`poojas` counts (§4.5-4.7, §4.9-4.11) | owner decisions | low-medium |
| **U8** | `knowledge` investigation + cutover (§4.12) | owner decision | high (data shape) |
| **U9** | `knowledge_workflow` family, 7 collections (§4.14) | owner decision | medium-high |
| **U10** | Analytics collections: migrate or drop (§4.13) | owner decision | low |

**U1 is the only unit that fixes a user-visible bug.** It should ship first and alone.

---

## 6. Acceptance criteria

- No reader listed in §2 still imports `firebase/firestore`, **or** its remaining import is
  justified in a comment and covered by a test.
- Every cut-over reader has a test that asserts it queries the Supabase table, not Firestore
  (the `tests/unit/event-service-supabase-reads.test.ts` pattern).
- A reader pointed at a table with no `SELECT` policy reads server-side; no new public policy
  is added without a recorded owner decision.
- `grep -rn "firebase/firestore" services lib app components hooks` returns only the
  `EXCLUDE_AUTH` server-side auth files (§4.3) and the Firebase client bootstrap.

---

## 7. Explicitly not in scope

- Any writer change. Firestore writes are already retired (PR-D4a/D4b).
- Any RLS change other than the `events` policy already prepared in PR-D4c.
- Enabling the Supabase Aaradhane write, or any workflow change.
- The population-B admin reader implementation (U2 is a plan line, not this PR).
- Deleting the Firestore SDK. `lib/firebase.ts` stays until every reader is off it.

## 8. Risks

- **Silent-empty reads.** The whole class of bug here is a reader that returns `[]` on a
  denial (PR-D4c §2). Every cut-over must surface the error, not swallow it.
- **`document_key` drift.** If the reader's key format differs from the migration writer's,
  reads return nothing. Confirm against `lib/supabase/migration-mappers.ts:837`.
- **Count semantics.** Several readers are counts. A `count` on a table with a `SELECT`
  policy is fine; a `count` on a deny-all table must be server-side.
- **Bundle size.** Removing Firestore reads from client components shrinks the bundle; doing
  it half-way can leave both SDKs loaded. Cut whole components over, not half of one.

## 9. Owner decisions required

1. Approve the `events` policy and apply it (U1) — unchanged from PR-D4c §9.
2. Approve the `announcements` table and its public-`is_active` policy (U5).
3. Choose the `members`/`volunteers`/`gallery`/`poojas` count outcomes (§4.7).
4. Confirm `notifications` is live before deciding §4.9.
5. Decide whether `settings_documents.document_key` should be collection-qualified, given
   `settings` and `homepage` share the table with unqualified ids (§3.1).
6. Approve deleting the dead `services/dashboard.service.ts` / `.client.ts` (U0).
7. Confirm whether `knowledge` and `ai_knowledge` are the same data (§4.12) — highest risk.
8. Confirm what `pageviews.service.ts`'s `sessions` collection holds (§4.13).
9. Decide whether the analytics collections are migrated or dropped (§4.13).
10. Decide whether the `knowledge_workflow` family is migrated or deferred (§4.14).
11. **Confirm the `guruParampara` data-migration ordering** (§3.4): the admin page is
    already code-cut-over to `settings_documents` in PR #360, but the row is only populated
    by `npm run migrate:settings`. Confirm the row exists (read-only) before the page is
    used, or the first Save overwrites live content with the in-file defaults.
