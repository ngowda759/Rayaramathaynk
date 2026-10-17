# M11 - Data model, Firestore/Supabase persistence, rules, indexes, seeds and the Supabase migration
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "Which database does this app actually use - Firebase or Supabase?" (both, per-domain, and inconsistently)
- "What Firestore collections exist, and which file reads/writes each one?"
- "What Supabase tables exist, what are their columns and RLS policies?"
- "If I edit a seva in the admin, why doesn't the change show on the public site?"
- "Why don't my social-link edits appear in the footer?" (admin writes Firestore, site reads Supabase)
- "Where are the Firestore security rules and what do they actually allow?"
- "Which collections have NO security rule at all, and what happens to client reads on them?"
- "Where are the composite indexes declared, and which queries are missing one?"
- "How do I add a field to a collection end to end (type -> service -> rules -> index -> Supabase column)?"
- "How do I add a new Firestore collection or a new Supabase table?"
- "What does `npm run firestore:dump` do and why does it keep hitting 429?"
- "Which seed script populates X, is it idempotent, and will it wipe production?"
- "Where are the hardcoded service-account private keys?" (yes, there are some)
- "What is still served from static `data/*.ts` files instead of a database?"
- "Where does panchanga data live?" (JSON files on disk, not Firestore)
- "What is in `data/exports/` and which script consumes each file?"
- "What does the `firestore_id` column mean in Supabase?"
- "Which Supabase migrations conflict with each other?"
- "Which migration files are dated in the future relative to today?"
- "What would a React Native client need from the data layer?"
- "Where is `settings/aboutUs` / `settings/trustCommittee` / `settings/footer` read from?"
- "Which collections does the AI read versus the public site?"
- "Is there an ORM / query builder / schema type generation?" (no)
- "Where is the storage (bucket) rule file and what does it allow?"

## Purpose and business role

This module is the persistence floor of the temple portal. It holds every artefact that decides
*where a byte lives*: the Firestore security rules and composite-index manifest, the Supabase SQL
migrations, the two Supabase client factories, the static seed and reference data shipped in the repo,
and the whole family of Node scripts that dump Firestore, convert its wire format, seed collections
and push data into Supabase.

Business-wise it serves nobody directly - no devotee or admin ever opens a page in this chunk
(the single HTTP route, `app/api/supabase-check/route.ts`, is a developer diagnostic). Its role is
to make the temple's operational data - seva catalogue, poojas, events, aaradhane calendar,
donations, receipts, gallery, testimonials, chat transcripts, AI settings and knowledge - durable,
queryable and (eventually) portable off Firebase.

The defining fact about this module is that **the migration is half done and was never finished**.
Firestore is still the system of record for most domains, Supabase already owns a few
(`sevas` reads, `events`, `site_settings`, `social_links` reads, `temple_areas`,
`unknown_questions`), and several domains are written to one store and read from the other
(sevas M11-F01, social links M11-F30, AI analytics M11-F04). Anyone changing data
behaviour must first establish which store the domain currently lives in - Section
"Migration state per domain" is the map.

## Code roots

From `.claude/state/chunks.json` (id M11):

```
firestore.rules
firestore.indexes.json
firebase.json
storage.rules
supabase/migrations/*.sql
lib/supabase/{client,server,admin}.ts
data/*.ts            data/exports/   data/firestore-dump/
seed/                seed/ai/*.json
scripts/migrate-*.ts scripts/dump-*  scripts/convert-firestore-export.ts
scripts/check-*.ts   scripts/seed-*.ts  scripts/seed-*.js
scripts/setup-admin.ts  scripts/verify-supabase-sevas.ts  scripts/lib/
quotes-seed-data.json   FIRESTORE_IMPORT.md
app/api/supabase-check/route.ts
```

**Adopted from the Unassigned list** (`.claude/state/inventory/SUMMARY.md:26-39`) - these are
Firestore/export data-plumbing scripts with no other owner:

| adopted file | lines | why it belongs here |
|---|---|---|
| `scripts/export-events.ts` | 97 | writes `data/exports/aaradhane-events-<year>.json` |
| `scripts/import-events.ts` | 93 | reads that export, `db.collection("events").add()` |
| `scripts/generate-events-firestore.ts` | 345 | reads `data/panchanga/<year>/`, upserts Firestore `events`, writes exports |
| `scripts/update-finance-settings.ts` | 114 | `set()`s the whole `settings/financeSettings` document (UPI id, bank block, three special sevas); contains a hardcoded private key (M11-F02). The admin page that edits the same document is `app/admin/settings/finance/page.tsx` - **M05** |
| `scripts/update-finance-settings.js` | 133 | compiled `tsc` twin of the above, committed alongside it - M11-F32 |

## Entry points

| route or entry | file | server/client | auth required | what it renders or does |
|---|---|---|---|---|
| `GET /api/supabase-check` | `app/api/supabase-check/route.ts` | server (route handler) | **none** | Reports whether `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are set; instantiates both clients. Queries no table. |
| `createClient()` (browser) | `lib/supabase/client.ts:3` | client | no | `@supabase/ssr` browser client; falls back to `https://placeholder.supabase.co` + `"placeholder"` when env is absent. |
| `createClient()` (server) | `lib/supabase/server.ts:4` | server only (`next/headers` cookies) | no | Cookie-bound anon client for RSC/route handlers. |
| `createAdminClient()` | `lib/supabase/admin.ts:3` | server only | n/a | Service-role client, RLS bypassed. Throws if env missing. |
| `npm run firestore:dump` | `scripts/dump-firestore-live.ts` | CLI (node/tsx) | service account | Full REST v1 dump of every collection -> `data/firestore-export/*.ndjson` + `data/firestore-dump/*.json` + `MANIFEST.json`. |
| `npm run firestore:convert` | `scripts/convert-firestore-export.ts` | CLI | none | Converts an existing NDJSON export dir into decoded JSON + MANIFEST. |
| `npm run firestore:dump:cli` | `scripts/dump-firestore-configs.sh:25` | CLI (bash) | service account | Legacy wrapper: `exec npm run --silent firestore:dump`. Does nothing else. |
| `npx tsx scripts/migrate-core-to-supabase.ts [--dry-run]` | `scripts/migrate-core-to-supabase.ts:231` | CLI | both | sevas / dailyPoojas / events -> Supabase, with validation + reconciliation report. |
| `npx tsx scripts/migrate-content-to-supabase.ts [--dry-run]` | `scripts/migrate-content-to-supabase.ts:156` | CLI | both | users, profiles, donation_campaigns, donations, galleryAlbums, galleryMedia, testimonials, aaradhane, volunteer_requests. |
| `npx tsx scripts/migrate-ai-to-supabase.ts [--dry-run]` | `scripts/migrate-ai-to-supabase.ts:168` | CLI | both | chat_sessions, messages->chat_messages, unknown_questions, ai_intent_distribution, ai_latency_records. |
| `npx tsx scripts/migrate-settings.ts [--dry-run]` | `scripts/migrate-settings.ts:4` | CLI | both | `settings/*` -> `site_settings` + `social_links`. |
| `npx tsx scripts/migrate-sevas.ts` / `migrate-daily-poojas.ts` | `scripts/migrate-sevas.ts:30`, `scripts/migrate-daily-poojas.ts:32` | CLI | both | Single-collection variants of the core migration. |
| `npx tsx scripts/migrate-events-to-supabase-from-json.ts` | `scripts/migrate-events-to-supabase-from-json.ts:18` | CLI | Supabase only | Upserts `data/exports/supabase-events-all.json` into `events`. No dry run. |
| `npm run setup-admin` | `scripts/setup-admin.ts:39` | CLI | Firebase admin | Writes one `users/<uid>` doc with `role: "super_admin"`. |
| `npm run seed:ai` | `scripts/seed-ai-knowledge.ts` | CLI | Firebase web SDK | Seeds `seed/ai/*.json` into the **`articles`** collection (see M11-F03). |
| `npm run seed-receipt-sevas` / `seed-future-plans` / `seed-testimonials` / `seed:guru-parampara` | `scripts/seed-*.ts` | CLI | Firebase | See "Seed and import scripts". |

There is **no** `page.tsx`, `layout.tsx` or UI component in this chunk.

## Component trees

This chunk owns no React components. What matters instead is the **store-access tree**: which
component touches which service and therefore which store. These are the four trees a developer
actually needs; every leaf marked `(client)` means the query runs in the browser with the public
anon/Firebase key.

### Tree A - Sevas (split-brain: read Supabase, write Firestore)

```
SevaBooking (client)                       components/home/SevaBooking.tsx
└─ sevaService.getAllSevas()               services/seva.service.ts:9       [M10]
   └─ getAllSevasAction()  "use server"    app/actions/sevas.ts:4
      └─ createAdminClient()               lib/supabase/admin.ts:3
         └─ supabase.from('sevas').select('*')      -> SUPABASE  sevas

AdminSevaForm / admin seva pages (client)  [M07]
└─ sevaService.createSeva / updateSeva / deleteSeva   services/seva.service.ts:76,81,86
   └─ addDoc/updateDoc/deleteDoc(collection(db,"sevas"))  -> FIRESTORE  sevas

RayaAI retrieval (server)                  lib/ai/retrieval/sevas.ts:124    [M08]
└─ query(collection(db,"sevas"), where("active","==",true), orderBy("displayOrder"))
                                                       -> FIRESTORE  sevas
```

Consequence: an admin's edit lands in Firestore; the public page keeps serving the Supabase row
until someone re-runs `scripts/migrate-sevas.ts`. See M11-F01.

### Tree B - Events (dual-written, read split by consumer)

```
EventGrid (client)                         components/events/EventGrid.tsx
EventDetail (client)                       app/(public)/events/[id]/page.tsx
└─ eventService.getEvents/getEvent         services/event.service.ts:46,58  [M10]
   └─ createClient()  (browser anon)       lib/supabase/client.ts:3
      └─ supabase.from('events').select()            -> SUPABASE  events   (RLS: deny-all)

Admin events pages (client)                app/admin/events/page.tsx        [M06]
└─ eventService.createEvent/updateEvent/deleteEvent  services/event.service.ts:90,114,123
   └─ supabase.from('events').insert/update/delete   -> SUPABASE  events

Admin content + featured dashboards (client)  app/admin/content/page.tsx:89, app/admin/featured/page.tsx:143
└─ getDocs(collection(db,"events"))                  -> FIRESTORE  events

Aaradhane generator (server)               lib/aaradhane/firestore.ts:41,296  [M14]
└─ collection(db, "events")                          -> FIRESTORE  events

RayaAI retrieval (server)                  lib/ai/retrieval/events.ts:65      [M08]
└─ query(collection(db,"events"), where("published","==",true), orderBy("startDate"))
                                                     -> FIRESTORE  events
```

### Tree C - Site settings / social links (Supabase only, public-read RLS)

```
Navbar (client)        components/layout/Navbar.tsx
SocialBar (client)     components/home/SocialBar.tsx
Display board (client) app/(public)/display/page.tsx
└─ settingsService.getSettings / getSocialLinks   services/settings.service.ts:40,118
   └─ createClient() (browser anon)               lib/supabase/client.ts:3
      └─ .from("site_settings" | "social_links")  -> SUPABASE  (RLS allows public SELECT)

Admin settings page (client)  app/admin/settings/page.tsx:69,71             [M05]
└─ settingsService.createSettings / updateSettings  services/settings.service.ts:69,95
   └─ await import("@/lib/supabase/admin") -> createAdminClient()  (service role)

Admin SOCIAL LINKS page (client)  app/admin/settings/social-links/page.tsx   [M05]
└─ setDoc(doc(db,"settings","socialLinks"))  :32-33 (names), :65 (read), :89 (write)
                                             -> FIRESTORE  settings/socialLinks
```

**Second split-brain, missed on the first pass:** the public site reads `social_links` from
**Supabase** (`services/settings.service.ts:121`) but the only admin editor writes the Firestore
document `settings/socialLinks` (`app/admin/settings/social-links/page.tsx:32-33,89`). No code
anywhere writes the Supabase `social_links` table - `grep -rn "\.from(" app services lib` returns
exactly one `social_links` hit, the read at `services/settings.service.ts:121`. The table is only
ever populated by `scripts/migrate-settings.ts:102-103`. See M11-F30.

Note the separate, Firestore-backed settings documents that this does **not** cover:
`settings/aboutUs` (`app/(public)/about/page.tsx:112`), `settings/trustCommittee`
(`app/(public)/trust/page.tsx:61`), `settings/facilities` (`app/(public)/facilities/page.tsx:126`),
`settings/futurePlans` (`app/(public)/future-plans/page.tsx:108`), `settings/footer`
(`components/layout/Footer.tsx:70`), `settings/ai` (`lib/ai/settings.ts:39`), `settings/device`
(`lib/device/settings.ts:53`), `settings/config`
(`services/proof-report/database-export.service.ts:85`), `settings/financeSettings`
(`scripts/update-finance-settings.ts:52`).

### Tree D - Temple areas (Supabase only, with a static fallback)

```
GET /api/temple-areas (server)          app/api/temple-areas/route.ts        [M12]
GET /api/admin/temple-areas (server)    app/api/admin/temple-areas/route.ts  [M12]
└─ templeAreasService                   services/temple-areas.service.ts:1   [M10]
   └─ TempleAreasSupabaseService        services/temple-areas.supabase.service.ts:8
      ├─ getPublicAreas -> createClient() (server anon)  -> SUPABASE temple_areas (public SELECT ok)
      └─ getAreas/getArea -> createAdminClient()          -> SUPABASE temple_areas
   └─ fallback constant TEMPLE_AREAS    types/temple-explorer.ts
```

### Tree E - AI settings + unknown questions (one repository, two stores)

```
Admin AI console (client)                 app/admin/ai/**                     [M09]
└─ aiSettingsRepository                   lib/ai/ai-settings/repository.ts    [M08]
   ├─ doc(db,"ai_settings","main")                    -> FIRESTORE ai_settings/main   (:62)
   └─ createClient().from('unknown_questions')        -> SUPABASE unknown_questions   (:391)
└─ aiSettingsAdminRepository              lib/ai/ai-settings/admin-repository.ts
   ├─ db.collection("ai_settings").doc(docId)         -> FIRESTORE (admin SDK)        (:39)
   └─ createAdminClient().from('unknown_questions')   -> SUPABASE                     (:272)
```

## Data flow

### 1. Full Firestore dump (`npm run firestore:dump`)

1. `scripts/dump-firestore-live.ts:26` reads the service-account JSON from
   `process.env.FIREBASE_SERVICE_ACCOUNT` or `<root>/.firebase-adminsdk.json`.
2. `:27` mints a `google-auth-library` JWT with the `datastore` scope; `:28` builds the REST v1 base
   URL from `k.project_id`.
3. `collectionIds()` (`:34`) POSTs `:listCollectionIds`, retrying up to **48** times with linear
   backoff (3s x attempt) - this is the quota-wait loop.
4. For each discovered collection not in `EXCLUDED` (`:23` - `users, profiles, bookmarks, sessions`),
   `listAll()` (`:48`) pages at `pageSize=300`, retrying 5x with exponential backoff on 429/5xx and a
   90s abort timeout.
5. Raw wire docs go to `data/firestore-export/<c>.ndjson` (`:104`); decoded docs, via
   `convertDoc` in `scripts/lib/firestore-values.ts:62`, go to `data/firestore-dump/<c>.json` (`:106`).
6. `:133` writes `data/firestore-dump/MANIFEST.json` classifying every collection as
   `present` / `expected-known-missing` / `intentionallyExcluded` / `unexpected` / `failed`
   against the `EXPECTED` list at `:11-22`.
7. Both output dirs are git-ignored (`.gitignore:36-38`, only the README is kept).

### 2. Firestore -> Supabase core migration (`scripts/migrate-core-to-supabase.ts`)

1. `run()` (`:231`) parses `--dry-run`, then `getAdminFirestore()` (`lib/admin-firebase.ts`, [M10])
   and `createAdminClient()` (`lib/supabase/admin.ts:3`).
2. `migrateCollection()` (`:70`) counts the source with `db.collection(c).count().get()` (`:81`).
3. It pages the source with `orderBy("__name__").limit(BATCH_SIZE)` where `BATCH_SIZE = 50` (`:87`),
   + `startAfter` (`:94`, `:183`).
4. Each doc goes through a per-collection `mapper` that **throws** on a missing required field -
   e.g. sevas require `name/description/category/amount/duration` (`:248-252`); daily poojas require
   `title/description/startTime/duration/category/sevaAmount/days` (`:276-282`); events require
   `title/description/location/status` and parseable `startDate`/`endDate` (`:307-315`).
5. `:121-122` pre-selects existing `firestore_id`s so insert-vs-update counts are right even in dry run.
6. `:147` `supabase.from(table).upsert(records, { onConflict: "firestore_id" })`; on batch error it
   falls back to one-by-one upserts to isolate the bad row (`:151-166`).
7. `:201-228` prints the reconciliation report (source docs = mapped + validation failures;
   successful = inserts + updates) and exits with details of every failure.
8. Idempotent by construction: `firestore_id` is `UNIQUE` on every target table.

### 3. Seva read path (why admin edits disappear)

1. `components/home/SevaBooking.tsx` (client) calls `sevaService.getAllSevas()`.
2. `services/seva.service.ts:11` calls the server action `getAllSevasAction()`.
3. `app/actions/sevas.ts:5-6` builds a **service-role** client and runs
   `from('sevas').select('*')` - RLS bypassed (the table's only policy is deny-all,
   `supabase/migrations/20260907112632_create_core_tables.sql:86`).
4. Rows are mapped back to the `Seva` shape using `item.firestore_id` as `id`
   (`services/seva.service.ts:13`).
5. Admin writes go the other way: `services/seva.service.ts:76` `addDoc(collection(db,"sevas"), ...)`
   straight into **Firestore**. Nothing syncs the two.

### 4. Aaradhane event generation -> export -> Supabase

1. `scripts/generate-events-firestore.ts:86` reads `data/panchanga/<year>/*.json` (730 files across
   `data/panchanga/2026` and `data/panchanga/2027`).
2. `:161-219` looks up existing Firestore `events` by key and `update()`s or `add()`s.
3. `:252-259` writes `data/exports/aaradhane-events-<year>.json`.
4. `data/exports/supabase-events-{2026,2027,all}.json` hold the same events already renamed to
   snake_case (`firestore_id, title, description, location, start_date, ...`).
5. `scripts/migrate-events-to-supabase-from-json.ts:19-30` reads `supabase-events-all.json`
   (38 rows) and upserts it into `events` on `firestore_id`. No validation, no dry run.

### 5. AI knowledge seeding (two incompatible paths)

1. `scripts/seed-ai-knowledge.ts:15` reads `seed/ai/*.json` (15 files) and writes each into
   Firestore collection **`articles`** with doc id `category.replace(/-/g,"_")` (`:143-145`).
2. `app/api/ai/knowledge/import/route.ts:61,73` reads the *same* `seed/ai` directory but writes into
   collection **`knowledge`** - which is what `lib/ai/knowledge/repository.ts:27` actually reads.
3. `articles` has no rule in `firestore.rules`, so the web-SDK write in step 1 is denied by default.

## Key files

### Rules, indexes and platform config

| file | lines | role | key exports | notes |
|---|---|---|---|---|
| `firestore.rules` | 280 | All Firestore access control | - | 38 `match` blocks; `settings` matched **twice** (`:136` and `:231`), the second with `allow write: if true`. |
| `firestore.indexes.json` | 180 | Composite index manifest | - | 22 indexes; several are single-field (no-ops) and several needed ones are absent. |
| `firebase.json` | 10 | Points the CLI at the two rule files | - | No hosting/emulator/function config. |
| `storage.rules` | 17 | Storage bucket rules | - | `testimonials/{allPaths}` is world-readable **and world-writable** (`storage.rules:5-8`); everything else needs only "signed in" (`storage.rules:11-14`). |

### Supabase schema

| file | lines | role | tables created | notes |
|---|---|---|---|---|
| `supabase/migrations/20240523000000_create_temple_areas.sql` | 37 | temple_areas v1 | `temple_areas` (PK `uuid`) | public SELECT policy. |
| `supabase/migrations/20240915_create_temple_areas.sql` | 35 | temple_areas v2 | `temple_areas` (PK **`text`**) | `IF NOT EXISTS` - whichever runs first wins; adds `image_url`, `has360_view`. Conflicts with the above. |
| `supabase/migrations/20260907112632_create_core_tables.sql` | 114 | Core | `sevas`, `daily_poojas`, `events` + `update_updated_at_column()` | deny-all RLS; indexes `idx_sevas_display_order_active`, `idx_events_featured_published`. |
| `supabase/migrations/20260908120000_create_sevas_table.sql` | 53 | Idempotent re-create of `sevas` | - | Whole body wrapped in `IF NOT EXISTS (... pg_tables ...)`; dead if the core migration ran. |
| `supabase/migrations/20260920000000_create_seva_bookings.sql` | 52 | Bookings | `seva_bookings` | Header comment says "Add gotra/nakshatra/raashi columns" but the file creates the table. Dated **after** today. |
| `supabase/migrations/20260930000000_create_ai_tables.sql` | 105 | AI/chat | `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records` | deny-all RLS. Dated after today. |
| `supabase/migrations/20261001000000_create_content_tables.sql` | 218 | Content | `users`, `profiles`, `donation_campaigns`, `donations`, `gallery_albums`, `gallery_media`, `testimonials`, `aaradhanes`, `volunteer_requests` | deny-all RLS. Dated after today. |
| `supabase/migrations/20261010000000_create_settings.sql` | 105 | Settings | `site_settings`, `social_links` | **Only** tables with a public SELECT policy plus explicit write denials. Dated after today. |

No `ai_token_usage`, `announcements`, `knowledge`, `quotes`, `receipts`, `receiptSevas`, `bills`,
`homepage` or `members` table exists in any migration.

### Supabase clients

| file | lines | role | key exports | notes |
|---|---|---|---|---|
| `lib/supabase/client.ts` | 12 | Browser anon client | `createClient` | Silently falls back to `placeholder.supabase.co` - failures surface as empty arrays, not errors. |
| `lib/supabase/server.ts` | 30 | Cookie-bound server anon client | `createClient` | `await cookies()` from `next/headers`; swallows `setAll` errors in RSC. |
| `lib/supabase/admin.ts` | 19 | Service-role client | `createAdminClient` | Throws when env is missing. Must never be imported into a client bundle. |
| `app/api/supabase-check/route.ts` | 56 | Env diagnostic | `GET` | Unauthenticated; leaks which env vars are configured. `catch (error: any)` at `:48`. |

### Static data shipped in the repo (`data/`)

| file | lines | role | notes |
|---|---|---|---|
| `data/shlokas.ts` | 251 | `Shloka[]`, `shlokaCategories` | The only substantial static dataset still rendered. Consumed by `app/(public)/shlokas/page.tsx`, `app/admin/shlokas/page.tsx`, `app/admin/settings/shlokas/page.tsx`. |
| `data/calendar.ts` | 56 | `calendar: CalendarData` - ekadashi + festival dates for 2026-2027 | Consumed by 10 files incl. `app/calendar/page.tsx`, `components/calendar/EkadashiTable.tsx`, `lib/festival-utils.ts`. Hard-coded; expires after 2027-04. |
| `data/galleryCategories.ts` | 9 | `galleryCategories: string[]` | **Imported by nothing** - dead. |
| `data/announcements.ts`, `data/bookings.ts`, `data/donations.ts`, `data/events.ts`, `data/gallery.ts`, `data/poojas.ts`, `data/sevas.ts`, `data/timings.ts` | 2 each | - | All **empty files** (a single blank line). Dead placeholders. |
| `data/panchanga/2026`, `data/panchanga/2027` | 730 JSON files | Daily panchanga | Read by `lib/aaradhane/panchanga.ts:65,101` and `scripts/generate-events-firestore.ts:86`. Never in Firestore, despite `docs/DATA-MODEL.md:708` documenting a `panchanga` collection. |
| `data/testimonials.xlsx` | binary | source spreadsheet | Not read by any code. |

### Exports and dumps

| file | lines | role | consumer |
|---|---|---|---|
| `data/exports/aaradhane-events-2026.json`, `data/exports/aaradhane-events-2027.json` | 168 each | 11 generator-shaped events per year | `scripts/import-events.ts:44` |
| `data/exports/aaradhane-events-2026-firestore.json`, `data/exports/aaradhane-events-2027-firestore.json` | 424 / 423 | 19 Firestore-shaped events per year | Firebase console manual import (`FIRESTORE_IMPORT.md:27`) |
| `data/exports/supabase-events-2026.json`, `data/exports/supabase-events-2027.json` | 287 each | 19 snake_case rows per year | reference only |
| `data/exports/supabase-events-all.json` | 572 | 38 snake_case rows | `scripts/migrate-events-to-supabase-from-json.ts:19` |
| `data/firestore-dump/README.md` | 76 | Live inventory probed 2026-09-10 | Documents 27 live collections, ~47k `page_views` docs, and the 429 quota wall. |
| `FIRESTORE_IMPORT.md` | 107 | Manual import runbook + the 2026/2027 aaradhane date tables | Says import to `aaradhanes`; the generator writes to `events`. |

### Seed data

| file | lines | role | notes |
|---|---|---|---|
| `seed/ai/*.json` (15 files: about-trust, accommodation, brindavana, contact, donation, dress-code, facilities, faq, history, parking, photography, raghavendra-swamy, temple-timings, visitor-guidelines, volunteer) | 15 each, `faq.json` 48 | Knowledge-base seed articles: `slug, title, category, language, keywords, summary, content, approved, version, lastReviewed, reviewedBy, tags` | Read by `scripts/seed-ai-knowledge.ts:15` (-> `articles`) and `app/api/ai/knowledge/import/route.ts:61` (-> `knowledge`). |
| `seed/quotes-seed-data.json` | 884 | 33-entry **array**, written by `scripts/seed-quotes.ts:844` as a side effect of seeding | generated artefact checked in |
| `quotes-seed-data.json` (repo root) | 743 | Same quotes as an **object keyed by slug** (`raghavendra-stotra-1` ...) | Referenced by no code. Firestore-console import shape. Dead duplicate. |

### Migration scripts

| file | lines | role | dry run | idempotent |
|---|---|---|---|---|
| `scripts/migrate-core-to-supabase.ts` | 348 | sevas, dailyPoojas, events | yes | yes (`onConflict: firestore_id`) |
| `scripts/migrate-content-to-supabase.ts` | 382 | users, profiles, donation_campaigns, donations, galleryAlbums, galleryMedia, testimonials, aaradhane, volunteer_requests | yes | yes |
| `scripts/migrate-ai-to-supabase.ts` | 292 | chat_sessions, messages->chat_messages, unknown_questions, ai_intent_distribution, ai_latency_records | yes | yes |
| `scripts/migrate-settings.ts` | 117 | `settings/*` -> site_settings, social_links | yes | yes |
| `scripts/migrate-sevas.ts` | 250 | sevas only (+ post-migration count check at `:104`) | yes | yes |
| `scripts/migrate-daily-poojas.ts` | 249 | dailyPoojas only | yes | yes |
| `scripts/migrate-events-to-supabase-from-json.ts` | 41 | JSON file -> events | **no** | yes |

### Dump / convert / inspect scripts

| file | lines | role | notes |
|---|---|---|---|
| `scripts/dump-firestore-live.ts` | 144 | REST v1 live dumper | 48x discovery retry, 5x per collection, 90s timeout. Reads `.firebase-adminsdk.json`. |
| `scripts/convert-firestore-export.ts` | 72 | NDJSON -> decoded JSON + MANIFEST | `--project/--export-dir/--dump-dir` flags. Fails the run if an `EXPECTED` collection is absent (`:65-67`). |
| `scripts/dump-firestore-configs.sh` | 25 | Legacy bash wrapper | Body is one `exec npm run --silent firestore:dump`. |
| `scripts/lib/firestore-values.ts` | 80 | Wire-format decoder | `decodeValue`, `docId`, `convertDoc`, `FirestoreWireDoc`, `STATUS_*`. The only properly typed, reusable helper in the chunk. |
| `scripts/check-collections.ts` | 66 | Counts `aaradhane` vs `aaradhanes` vs `events` | Env-var credentials. |
| `scripts/check-firestore-sevas.ts` | 34 | Counts `sevas`, detects `RESOURCE_EXHAUSTED` | Uses `getAdminFirestore()`. |
| `scripts/check-about-us.ts` | 69 | Prints `settings/aboutUs` | **Hardcoded private key at `:5-32`.** |
| `scripts/check-trust-committee.ts` | 74 | Prints `settings/trustCommittee` | **Hardcoded private key at `:5-32`.** |
| `scripts/verify-supabase-sevas.ts` | 33 | Counts Supabase `sevas` | Expected count `10` is hardcoded ("From Image", `:16`). |

### Seed scripts

| file | lines | target | destructive? | idempotent? |
|---|---|---|---|---|
| `scripts/seed-ai-knowledge.ts` | 181 | Firestore `articles` | no | yes (skips existing category) |
| `scripts/seed-ai-settings.ts` | 535 | Firestore `ai_settings/main` (`:504`) | overwrites via `.set()` (`:518`) | yes (full replace) |
| `scripts/seed-future-plans.ts` | 82 | `settings/futurePlans` via `setDoc` (`:71`) | overwrites | yes |
| `scripts/seed-trust-committee.ts` | 242 | `settings/trustCommittee` via `.set()` (`:231`) | overwrites | yes. **Hardcoded private key at `:171-198`.** |
| `scripts/seed-guru-parampara.ts` | 416 | `guruParampara/aaradhanaes` (`:378`) via web SDK | overwrites | yes. Exports `seedGuruParampara`. |
| `scripts/seed-guru-to-firestore.ts` | 362 | Same doc (`:300,327`) via admin SDK | overwrites | yes. Near-duplicate of the above. |
| `scripts/seed-poojas.ts` | 111 | Firestore `dailyPoojas` | **YES - deletes every existing doc at `:86-89`** | no (re-adds with new ids). **Hardcoded private key at `:36-63`.** |
| `scripts/seed-poojas.js` | 144 | same | **YES** | compiled twin. **Hardcoded private key at `:89`.** |
| `scripts/seed-sevas.ts` | 110 | Firestore `sevas` | no, but `.add()`s unconditionally (`:93`, inside the loop opened at `:92`) -> duplicates on re-run | **no**. **Hardcoded private key at `:36-63`.** |
| `scripts/seed-sevas.js` | 141 | same | same | compiled twin. **Hardcoded private key at `:89`.** |
| `scripts/seed-quotes.ts` | 852 | Firestore `quotes` (33 quotes) | with `--force` deletes all (`:801-806`) | yes without `--force`. Env-var credentials. |
| `scripts/seed-receipt-sevas.ts` | 126 | Firestore `receiptSevas` | no | yes - per-name `where("name","==",...)` check (`:98-101`) |
| `scripts/seed-testimonials.ts` | 119 | Firestore `testimonials` | no | yes - aborts if collection non-empty (`:87-93`) |
| `scripts/seed-supabase-sevas.ts` | 166 | Supabase `sevas` - 10 hardcoded Aradhana sevas with synthetic ids `seed_aradhana_seva_<n>` (`:135`) | no | yes (`onConflict: firestore_id`, `:150`). Has `--dry-run`. Overlaps `scripts/seed-receipt-sevas.ts` in content but targets a different store. |
| `scripts/seed-temple-areas.ts` | 50 | Supabase `temple_areas` | no | yes-ish; spreads **camelCase** keys into a snake_case table (`:37-40`) so it will error |
| `scripts/seed-temple-areas-supabase.ts` | 72 | Supabase `temple_areas` | no | yes; maps keys correctly and upserts on `id` (`:47-57`) |
| `scripts/setup-admin.ts` | 85 | `users/<uid>` with `role: super_admin` | overwrites | yes. Placeholder guard is broken (see M11-F14). |

## Types and stores

### TypeScript types this module's data must satisfy

`types/seva.ts` (`Seva`, `SevaRequest`), `types/seva-booking.ts` (`SevaBooking` - note `userId`/
`userName`/`userEmail`/`userPhone`, **not** the `devotee*` fields `docs/DATA-MODEL.md:130-134`
claims), `types/pooja.ts`, `types/event.ts`, `types/settings.ts`, `types/temple-explorer.ts`
(also exports the `TEMPLE_AREAS` constant used as a fallback and as seed input),
`types/receiptSeva.ts`, `types/calendar.ts` (`CalendarData` for `data/calendar.ts`),
`types/shlokas.ts`, `types/ai-analytics.ts`, `types/knowledge.ts`, `types/user.ts`.

No generated Supabase types exist (`supabase gen types` is not wired up), so every `.from(...)`
call is untyped - `data` flows as `any` into hand-written mappers such as
`mapSupabaseEventToTempleEvent` (`services/event.service.ts:21`).

### Firestore collections referenced anywhere in the code

Derived by scanning `collection(db, X)`, `db.collection(X)` and `doc(db, X, ...)` across
`app/ services/ lib/ hooks/ components/ scripts/`. "Rule?" = has a `match` block in
`firestore.rules`. "Index?" = appears in `firestore.indexes.json`.

*Field-level detail is deliberately not repeated here:* Firestore is schemaless and this repo has no
schema file, so the authoritative field list for a collection is its TypeScript type in `types/`
(mapping in "TypeScript types this module's data must satisfy" below) plus the write payload in the
service named in the "representative call site" column. Where a collection has no type - `trust`,
`chatTraining`, `chat_metrics`, `intent_metrics`, `intent_feedback`, `daily_page_stats`,
`featuredContent`, `articles`, `test` - the write site is the only definition of its shape.

| collection | reads/writes | rule? | index? | representative call site | docs/DATA-MODEL.md |
|---|---|---|---|---|---|
| `users` | R/W | yes `:34` | yes | `app/api/admin/users/set-role/route.ts:63` | documented §1 |
| `profiles` | R/W | **no** | no | `services/profile.service.ts:78` | not documented |
| `bookmarks` | R/W | **no** | no | `services/profile.service.ts:333` | not documented |
| `sevas` | R/W | yes `:76` | yes | `lib/ai/retrieval/sevas.ts:124` | documented §2 |
| `receiptSevas` | R/W | yes `:85` (validated) | no | `scripts/seed-receipt-sevas.ts:93` | not documented |
| `receipts` | R (admin) | yes `:102` (server-write only) | no | `app/api/admin/receipts/route.ts:38` | not documented |
| `system` | R/W server only | yes `:108` (deny all) | no | `lib/receipt/admin.ts:46` (receipt counter) | not documented |
| `sevaBookings` | R/W | yes `:113` | yes (userId+preferredDate, status+createdAt) | `services/sevaBooking.service.ts:36` | documented §3 |
| `dailyPoojas` | R/W | **no** | no | `services/pooja.service.ts:43` | not documented |
| `poojas` | R | **no** | no | `app/admin/content/page.tsx:95` | not documented |
| `events` | R/W | yes `:50` | yes | `lib/ai/retrieval/events.ts:65` | documented §4 |
| `aaradhane` | R/W | yes `:125` | no | `services/aaradhane.service.ts:164` | documented §12 |
| `aaradhanes` | R/W | yes `:130` | no | `services/aaradhane.service.ts:175` | not documented |
| `guruParampara` | R/W | **no** | no | `lib/aaradhane/firestore-source.ts:33` | not documented |
| `announcements` | R/W | yes `:45` | yes (`active`+priority) | `services/announcement.service.ts:48` (queries **`isActive`**) | documented §6 |
| `gallery` | R | yes `:55` | yes | `services/dashboard.service.ts:23` | documented §5 |
| `galleryAlbums` | R/W | yes `:61` | no | `services/gallery.service.ts:114` | not documented |
| `galleryMedia` | R/W | yes `:66` | no | `services/gallery.service.ts:182` | not documented |
| `timings` | R | yes `:71` | no | `lib/ai/retrieval/settings.ts:87` | not documented |
| `donations` | R/W | yes `:119` | yes (collectedAt) | `services/donation.service.ts:46` (orders by **`createdAt`**) | documented §7 |
| `donation_campaigns` | R/W | **no** | no | `services/donationCampaign.service.ts:68` | documented §8 as `donationCampaigns` |
| `bills` | R/W | yes `:142` | no | `services/billing.service.ts:108` | not documented |
| `settings` | R/W | yes `:136` **and** `:231` | no | `app/(public)/about/page.tsx:112` | documented §9 |
| `homepage` | R/W | yes `:149` | no | `services/homepage.service.ts:17` | not documented |
| `futurePlans` | - | yes `:155` | no | *no code uses it*; data lives in `settings/futurePlans` | not documented |
| `trustCommittee` | - | yes `:161` | no | *no code uses it*; data lives in `settings/trustCommittee` | not documented |
| `trust` | R | **no** | no | `lib/ai/firebaseChat.ts:120` | not documented |
| `testimonials` | R/W | yes `:167` (public create) | yes | `services/testimonial.service.ts:77` | not documented |
| `members` | R/W | yes `:174` | no | `services/volunteer.service.ts:42` | not documented |
| `volunteers` | R/W | yes `:180` | no | `services/volunteer.service.ts:87` | not documented |
| `volunteer_requests` | R/W | **no** | no | `services/chat.service.ts:217` | not documented |
| `notifications` | W | **no** | no | `services/testimonial.service.ts:361` | not documented |
| `feedback` | R/W | yes `:245` | no | `services/chat.service.ts:260` | not documented |
| `chat_sessions` | R/W | yes `:186` (public write) | yes | `services/chat.service.ts:39` | documented §11 |
| `messages` | R/W | yes `:237` | index declared on `chat_messages` instead | `services/chat.service.ts:101,118` | not documented |
| `chatTraining` | R | **no** | no | `lib/ai/firebaseChat.ts:153` | not documented |
| `chat_metrics` | W | **no** | no | `services/analytics.service.ts:54` | not documented |
| `intent_metrics` | R/W | **no** | no | `services/analytics.service.ts:166` | not documented |
| `intent_feedback` | W | **no** | no | `services/analytics.service.ts:204` | not documented |
| `ai_settings` | R/W | yes `:226` (**public write**) | no | `lib/ai/ai-settings/repository.ts:62` | not documented |
| `ai_token_usage` | R/W | yes `:201` | yes (timestamp) | `services/ai-analytics.service.ts:44` (`COLLECTIONS.TOKEN_USAGE`) | not documented |
| `ai_latency_records` | R/W | yes `:207` | yes | `app/admin/ai/analytics/page.tsx:247` | not documented |
| `ai_intent_distribution` | R/W | yes `:213` | yes | `app/admin/ai/analytics/page.tsx:245` | not documented |
| `unknown_questions` | R/W | yes `:219` | no | `services/analytics.service.ts:31`, `lib/ai/unknown-logger.ts:13` | documented §14 |
| `ai_unknown_questions` | R/W | **no** | no | `services/ai-analytics.service.ts:47` (`COLLECTIONS.UNKNOWN_QUESTIONS`, in the `COLLECTIONS` map at `:43-50`) | not documented - **a second, parallel name** |
| `page_views` | R/W | yes `:193` (public create) | no | `services/pageviews.service.ts:46` | not documented |
| `daily_page_stats` | R/W | **no** | no | `services/pageviews.service.ts:58` | not documented |
| `knowledge` | R/W | yes `:258` | yes (approved+category+title) | `lib/ai/knowledge/repository.ts:27` | documented §10 |
| `knowledge_articles`, `knowledge_categories` | - | yes `:263,:268` | no | *no code uses them* | not documented |
| `knowledge_workflow`, `knowledge_versions`, `knowledge_workflow_actions`, `knowledge_review_comments`, `knowledge_committee_approvals`, `knowledge_audit_log`, `knowledge_drafts` | R/W | **no** | **no** | `services/knowledge-workflow.service.ts:46-54` | not documented |
| `articles` | R/W | **no** | no | `scripts/seed-ai-knowledge.ts:65,143` | not documented |
| `featuredContent` | R/W | **no** | no | `app/admin/featured/page.tsx:108` | not documented |
| `quotes` | R/W | yes `:274` | yes (2) | `services/quote.service.ts:288` | not documented |
| `temple_areas` | - | yes `:252` | no | Firestore path unused - the service reads Supabase | not documented |
| `test` | R | **no** | no | `app/admin/test/page.tsx:15` | debug leftover |
| `panchanga` | - | **no** | no | *documented at `docs/DATA-MODEL.md:708` but never queried* - data is in `data/panchanga/` | documented §13 |

### Supabase tables

| table | migration | columns (abridged) | RLS | app code that reads/writes it |
|---|---|---|---|---|
| `sevas` | 20260907112632 (+20260908120000) | id uuid PK, firestore_id uniq, name, description, category, amount numeric(10,2), duration int, image_url, active, display_order, created_at, updated_at | deny-all to `public` | R: `app/actions/sevas.ts:6,13` (service role). W: none - writes go to Firestore. |
| `daily_poojas` | 20260907112632 | + start_time, duration text, seva_amount, is_active, days text[], notes, created_by | deny-all | **no app code** - only `scripts/migrate-daily-poojas.ts` |
| `events` | 20260907112632 | + location, start_date/end_date timestamptz, start_time/end_time, featured, published, category, image_url, status | deny-all | R/W: `services/event.service.ts:46,58,90,114,123` via **anon** client |
| `seva_bookings` | 20260920000000 | seva_id uuid, seva_title, seva_amount, user_id/name/email/phone, gotra, nakshatra, raashi, preferred_date, notes, status, payment_* | deny-all | **no app code** |
| `chat_sessions` | 20260930000000 | user_id, message_count, last_message, detected_language | deny-all | **no app code** |
| `chat_messages` | 20260930000000 | session_id text, role, content, timestamp, model, latency, detected_language | deny-all | **no app code** |
| `unknown_questions` | 20260930000000 | question, question_lower, detected_intent, confidence, language, timestamp, session_id, times_asked, status, assigned_to, reviewed_by/at, response, added_to_knowledge_article_id, notes | deny-all | R/W: `lib/ai/ai-settings/repository.ts:391,416,427,453,513,523` (anon) and `lib/ai/ai-settings/admin-repository.ts:272,327,337` (service role) |
| `ai_intent_distribution` | 20260930000000 | intent, category, language, confidence, timestamp, session_id, message_id | deny-all | R: `services/ai-analytics.service.ts:170` (anon) |
| `ai_latency_records` | 20260930000000 | total_latency, intent_detection_time, retrieval_time, generation_time, timestamp, success, error_type, model, session_id | deny-all | R: `services/ai-analytics.service.ts:134` (anon) |
| `users` | 20261001000000 | email, display_name, phone_number, photo_url, role, active | deny-all | **no app code** |
| `profiles` | 20261001000000 | uid, name, email, phone, profile_image, bio, gotra, nakshatra, preferences jsonb, favorites text[], recently_viewed text[], bookmarks jsonb | deny-all | **no app code** |
| `donation_campaigns` | 20261001000000 | title, description, image_url, suggested_amount, active, display_order | deny-all | **no app code** |
| `donations` | 20261001000000 | donor_name, email, phone, address, amount, purpose, campaign_id uuid, message, payment_mode, status, receipt_number, admin_remarks, collected_by, collected_at | deny-all | **no app code** |
| `gallery_albums` | 20261001000000 | title, slug, description, cover_image, active, display_order | deny-all | **no app code** |
| `gallery_media` | 20261001000000 | album_id uuid, title, description, category, type, image_path, video_url, alt_text, is_featured, display_order, tags text[], uploaded_by/at | deny-all | **no app code** |
| `testimonials` | 20261001000000 | name, location, quote, years, image, phone, approved, rejected, rejection_reason, submitted_by | deny-all | **no app code** |
| `aaradhanes` | 20261001000000 | title, guru_name, dates text[], description, significance, rituals text[], offerings text[], image_url, seva_details jsonb, is_upcoming, display_order, created_by | deny-all | **no app code** |
| `volunteer_requests` | 20261001000000 | volunteer_id, name, phone, sex, active, address | deny-all | **no app code** |
| `site_settings` | 20261010000000 | temple_name, contact_email, contact_phone, address, footer_text, welcome_message | **public SELECT**, writes denied | R: `services/settings.service.ts:43` (anon); W: `:75,107` (service role) |
| `social_links` | 20261010000000 | facebook, instagram, youtube, whatsapp, twitter, linkedin, map_url + 7 `show_*` booleans | **public SELECT** (`:63`), write/update/delete denied (`:88,:94,:100`) | R: `services/settings.service.ts:121` (anon). **W: no app code at all** - only `scripts/migrate-settings.ts:102`. The admin UI writes Firestore `settings/socialLinks` instead (M11-F30). |
| `temple_areas` | 20240523000000 **or** 20240915 | name, name_kannada, description, significance, icon, image_url, category, features jsonb, best_time_to_visit, tips jsonb, has360_view, "order", firestore_id | **public SELECT** | R: `services/temple-areas.supabase.service.ts:15,38,62` |

### Other stores touched

- **Firebase Storage** - governed by `storage.rules`; `testimonials/**` is open read+write.
- **Local filesystem** - `data/panchanga/<year>/*.json` (730 files), `data/exports/*.json`,
  `seed/ai/*.json`, `public/data/panchanga/current.json` (`lib/ai/retrieval/panchanga.ts:42`).
- **Firestore dump artefacts** - `data/firestore-export/*.ndjson`, `data/firestore-dump/*.json`
  (git-ignored, `.gitignore:36-38`).

## Migration state per domain

| domain | Firestore | Supabase table | state | evidence |
|---|---|---|---|---|
| Sevas | source of truth for writes | `sevas` (source of truth for reads) | **split-brain** | `services/seva.service.ts:11` vs `:76` |
| Daily poojas | Firestore only | `daily_poojas` exists, empty of readers | **migrated schema, unused** | `services/pooja.service.ts:43`; no `.from('daily_poojas')` in `app/ services/ lib/` |
| Events | still written by admin content/featured pages and the aaradhane generator | `events` read+written by `event.service` | **dual, diverging** | `services/event.service.ts:46` vs `app/admin/content/page.tsx:89`, `lib/aaradhane/firestore.ts:41` |
| Seva bookings | Firestore only | `seva_bookings` exists | **Firestore only** | `services/sevaBooking.service.ts:36`; no `.from('seva_bookings')` anywhere |
| AI settings | `ai_settings/main` in Firestore | none | **Firestore only** | `lib/ai/ai-settings/repository.ts:62` |
| Unknown questions | `unknown_questions` + `ai_unknown_questions` in Firestore | `unknown_questions` | **both, by different callers** | `lib/ai/unknown-logger.ts:13` and `services/ai-analytics.service.ts:47` (Firestore) vs `lib/ai/ai-settings/repository.ts:391` (Supabase) |
| AI analytics (latency, intent) | Firestore writes | `ai_latency_records`, `ai_intent_distribution` | **Firestore write / Supabase read** | `app/admin/ai/analytics/page.tsx:245,247` vs `services/ai-analytics.service.ts:134,170` |
| Chat sessions / messages | Firestore only | tables exist | **Firestore only** | `services/chat.service.ts:39,101` |
| Content (users, profiles, donations, gallery, testimonials, aaradhane, volunteers) | Firestore only | 9 tables exist | **schema-only migration** | no `.from(...)` for any of them |
| Site settings | `settings/*` legacy docs remain | `site_settings` | **Supabase only** (read `:43` anon, write `:75,107` service role) | `services/settings.service.ts:43,75,107` |
| Social links | `settings/socialLinks` is what the admin UI edits | `social_links` is what the public site reads | **split-brain, same shape as sevas** | `app/admin/settings/social-links/page.tsx:32-33,89` (Firestore write) vs `services/settings.service.ts:121` (Supabase read); no app code writes `social_links` |
| Other `settings/*` docs (aboutUs, trustCommittee, facilities, futurePlans, footer, ai, device, config, financeSettings) | Firestore only | none | **Firestore only** | `app/(public)/about/page.tsx:112` etc. |
| Temple areas | rule exists but no code | `temple_areas` | **Supabase only** | `services/temple-areas.supabase.service.ts:6` |
| Panchanga | never in a DB | none | **static files** | `lib/aaradhane/panchanga.ts:65` |
| Quotes, knowledge, receipts, bills, announcements, homepage, members | Firestore only | no table exists | **Firestore only** | `services/quote.service.ts:288` etc. |

**Migration files dated after today (2026-09-19):** `20260920000000_create_seva_bookings.sql`,
`20260930000000_create_ai_tables.sql`, `20261001000000_create_content_tables.sql`,
`20261010000000_create_settings.sql`. Supabase applies migrations in filename order, so future
stamps are cosmetically wrong rather than fatal - but they make "what is deployed?" unanswerable
from the tree, and any migration you add today with a real date will sort *before* four already
applied ones.

## Indexes vs the queries the code runs

Declared in `firestore.indexes.json` (22 entries). Firestore needs a composite index for any query
combining `where` on one field with `orderBy` on another.

**Declared and actually used**

| index | used by |
|---|---|
| `sevas` active + displayOrder | `lib/ai/retrieval/sevas.ts:124` |
| `events` published + startDate | `lib/ai/retrieval/events.ts:65`, `lib/ai/firebaseChat.ts:75` |
| `testimonials` approved + createdAt | `services/testimonial.service.ts:145`, `services/chat.service.ts:158,176` |
| `chat_sessions` userId + updatedAt | `services/chat.service.ts:72` |
| `knowledge` approved + category + title | `lib/ai/knowledge/repository.ts:92` |
| `quotes` active + priority, active + category + priority | `services/quote.service.ts` |

**Missing - queries that will throw `FAILED_PRECONDITION: The query requires an index`**

| collection | query | site |
|---|---|---|
| `sevaBookings` | `where userId ==` + `orderBy createdAt desc` | `services/sevaBooking.service.ts:55` (declared index is userId + **preferredDate**) |
| `announcements` | `where isActive ==` + `orderBy createdAt desc` | `services/announcement.service.ts:48`, `lib/ai/retrieval/announcements.ts:57`, `services/daily-spiritual.service.ts:387` (declared index is **`active`** + priority - wrong field name, `types/announcement.ts:6` says `isActive`) |
| `messages` | `where sessionId ==` + `orderBy timestamp asc` | `services/chat.service.ts:118` (the declared index is on collection group **`chat_messages`**, which no code queries) |
| `testimonials` | `where submittedBy ==` + `where approved ==` + `orderBy createdAt desc` | `services/testimonial.service.ts:77` |
| `galleryMedia` | `where albumId ==` + `orderBy displayOrder`; `where isFeatured ==` + `orderBy displayOrder` | `services/gallery.service.ts:182,194`, `hooks/useGallery.ts:35` |
| `bills` | `where status ==` + `orderBy createdAt desc`; `where customerName ==` + `orderBy createdAt desc`; `where status in` + `where dueDate <` + `orderBy dueDate` | `services/billing.service.ts:108,119,131` |
| `chatTraining` | `where active ==` + `orderBy priority` | `lib/ai/firebaseChat.ts:152` |
| `knowledge_versions` | `where articleId ==` + `orderBy version desc` | `services/knowledge-workflow.service.ts:87,122` |
| `knowledge_workflow_actions` | `where articleId ==` + `orderBy performedAt desc` | `services/knowledge-workflow.service.ts:317` |
| `knowledge_review_comments` | `where articleId ==` + `orderBy createdAt` | `services/knowledge-workflow.service.ts:378,547` |
| `knowledge_audit_log` | `where entityType ==` + `where entityId ==` + `orderBy performedAt desc` | `services/knowledge-workflow.service.ts:608` |
| `knowledge_workflow` | `where createdBy ==` + `orderBy updatedAt desc` | `services/knowledge-workflow.service.ts:1038` |

**Declared but unused / no-ops**: `users` role+createdAt and templeId+createdAt, `sevas`
category+displayOrder, `events` featured+startDate, `gallery` category+featured, `donations`
userId+collectedAt and status+collectedAt (`services/donation.service.ts:46` orders by `createdAt`
with no `where`), `chat_messages` sessionId+timestamp, and the three single-field
`ai_*` timestamp indexes (`firestore.indexes.json:130-150`) - Firestore indexes single fields
automatically, so these three entries do nothing.

Supabase indexes are declared inline in each migration; there is **no** index on
`chat_messages.session_id + timestamp` compound, `events.firestore_id` is covered by the UNIQUE
constraint, and `unknown_questions` is indexed only on `timestamp` although
`lib/ai/ai-settings/repository.ts:453` filters on `status`/`assigned_to`.

## Cross-module dependencies

**This module is imported by** (from `.claude/state/inventory/import-graph.json`):

| my file | imported by | chunk |
|---|---|---|
| `lib/supabase/admin.ts` | `app/actions/sevas.ts`, `app/api/supabase-check/route.ts`, `lib/ai/ai-settings/admin-repository.ts`, `services/temple-areas.supabase.service.ts` | M12, M08, M10 |
| `lib/supabase/client.ts` | `lib/ai/ai-settings/repository.ts`, `services/ai-analytics.service.ts`, `services/event.service.ts`, `services/settings.service.ts` | M08, M10 |
| `lib/supabase/server.ts` | `app/api/supabase-check/route.ts`, `services/temple-areas.supabase.service.ts` | M12, M10 |
| `data/calendar.ts` | `app/calendar/page.tsx`, `app/admin/calendar/ekadashi/page.tsx`, `app/admin/calendar/festivals/page.tsx`, `app/admin/settings/ekadashi-calendar/page.tsx`, `app/admin/settings/festival-calendar/page.tsx`, `components/calendar/CalendarCenter.tsx`, `components/calendar/EkadashiTable.tsx`, `components/calendar/FestivalTable.tsx`, `components/calendar/NextEkadashiCard.tsx`, `lib/festival-utils.ts` | M02, M05, M07, M14 |
| `data/shlokas.ts` | `app/(public)/shlokas/page.tsx`, `app/admin/shlokas/page.tsx`, `app/admin/settings/shlokas/page.tsx` | M03, M05 |
| `scripts/lib/firestore-values.ts` | `scripts/dump-firestore-live.ts`, `scripts/convert-firestore-export.ts` | M11 (internal) |

**This module imports from**:

| target | from | chunk |
|---|---|---|
| `lib/admin-firebase.ts` (`getAdminFirestore`) | `scripts/migrate-{core,content,ai}-to-supabase.ts`, `scripts/migrate-{sevas,daily-poojas,settings}.ts`, `scripts/check-firestore-sevas.ts`, `scripts/seed-receipt-sevas.ts` | M10 |
| `lib/firebase.ts` (`db`) | `scripts/seed-future-plans.ts`, `scripts/seed-guru-parampara.ts` | M10 |
| `types/*` | migration mappers, seeds, `data/calendar.ts`, `data/shlokas.ts` | M10 |
| `types/temple-explorer.ts` (`TEMPLE_AREAS`) | `scripts/seed-temple-areas.ts:5`, `scripts/seed-temple-areas-supabase.ts:7` | M10 |
| `types/aaradhane-generator.ts` | `scripts/seed-guru-parampara.ts:21` | M14 |
| `@supabase/ssr`, `@supabase/supabase-js`, `firebase-admin`, `google-auth-library`, `dotenv` | node_modules | - |

The boundary rule that matters: **nothing in `app/` or `components/` should import a `scripts/`
file, and nothing outside `lib/supabase/` should call `createClient` from `@supabase/supabase-js`
directly.** `scripts/migrate-events-to-supabase-from-json.ts:1`,
`scripts/seed-temple-areas.ts:4` and `scripts/seed-temple-areas-supabase.ts:6` break the second
half of that rule (they build their own clients rather than using `lib/supabase/admin.ts`).

## How to change it

### Recipe 1 - Add a field to an existing collection/table (e.g. `sevas.sevaTypeCode`)

1. `types/seva.ts` - add the field to `Seva` and `SevaRequest`.
2. `services/seva.service.ts` - add it to the Supabase->domain mapper (around `:13`) and to the
   Firestore write payloads (`:76`, `:81`).
3. `supabase/migrations/<YYYYMMDDHHMMSS>_add_seva_type_code.sql` - new file, never edit an applied
   one: `ALTER TABLE sevas ADD COLUMN IF NOT EXISTS seva_type_code text;`
4. `scripts/migrate-core-to-supabase.ts` - add `seva_type_code` to `TargetSeva` (`:22`) and to the
   sevas mapper (validation at `:248-252`, the returned record at `:259`); decide whether it is
   required (throw) or optional (`|| null`).
5. `firestore.rules` - only if the field needs write validation (see the `receiptSevas` block at
   `:85` for the pattern).
6. `firestore.indexes.json` - only if a query will filter/sort on it.
7. Re-run `npx tsx scripts/migrate-core-to-supabase.ts --dry-run`, check the reconciliation block,
   then run it for real.

### Recipe 2 - Add a brand-new Firestore collection

1. Define the type in `types/<name>.ts`.
2. Write the service in `services/<name>.service.ts` with a `const COLLECTION = "<name>"` at the top
   (the convention every service follows, e.g. `services/pooja.service.ts:16`).
3. **`firestore.rules` - add a `match /<name>/{id}` block.** Without it every client-SDK read and
   write is denied; this is the single most common omission in this repo (see M11-F05).
4. `firestore.indexes.json` - add a composite index for every `where`+`orderBy` combination.
5. `scripts/dump-firestore-live.ts:11-22` **and** `scripts/convert-firestore-export.ts:14-25` - add
   the name to *both* `EXPECTED` arrays (they are duplicated verbatim).
6. `docs/DATA-MODEL.md` - add a section.

### Recipe 3 - Add a new Supabase table and actually read it

1. New migration file `supabase/migrations/<stamp>_create_<table>.sql`. Copy the shape of
   `20261010000000_create_settings.sql` if the table needs public reads, or
   `20260907112632_create_core_tables.sql` if it is service-role only.
2. Always include `firestore_id text UNIQUE` if the data originates in Firestore - every migration
   script upserts `onConflict: "firestore_id"`.
3. Attach `update_updated_at_column()` as a `BEFORE UPDATE` trigger if you have `updated_at`.
4. Decide the access path **before** writing service code:
   - deny-all RLS -> the caller must use `createAdminClient()` from a server action or route
     handler (pattern: `app/actions/sevas.ts`);
   - public SELECT policy -> `createClient()` from `lib/supabase/client.ts` works in the browser.
5. Write the service in `services/`, with a hand-written snake_case -> camelCase mapper (there are
   no generated types).
6. Add a migration mapper in the matching `scripts/migrate-*-to-supabase.ts`.

### Recipe 4 - Change a Firestore security rule

1. Edit `firestore.rules`. Remember rules are **additive**: if any `match` grants access, access is
   granted. Check for a duplicate `match` on the same path first - `settings` has two (`:136`,
   `:231`) and the looser one wins.
2. Deploy with `firebase deploy --only firestore:rules` (paths come from `firebase.json:2-5`).
3. Cross-check every call site for that collection using the catalogue above - a tightened rule
   silently turns reads into empty arrays in the services, which mostly `catch` and `return []`.

### Recipe 5 - Move a domain from Firestore to Supabase (the unfinished job)

1. Confirm the table exists and matches `docs/SUPABASE_DATABASE_SCHEMA.md`.
2. `npx tsx scripts/migrate-<domain>-to-supabase.ts --dry-run`; fix validation failures in Firestore
   until `Validation failures: 0`.
3. Run it for real; verify counts (pattern: `scripts/verify-supabase-sevas.ts`).
4. Switch **reads and writes together** in the service - the seva split (Recipe 1 step 2) is the
   anti-pattern to avoid.
5. Grep for direct `collection(db, "<name>")` usage in `app/admin/**` - admin pages bypass the
   services (`app/admin/content/page.tsx:89-99` runs eleven `getCountFromServer` calls over eight
   distinct collections: `events`, `announcements`, `gallery`, `sevas`, `poojas`, `knowledge`,
   `testimonials`, `volunteer_requests`) and will keep writing to Firestore unless changed too.
6. Delete or neutralise the Firestore rule block once nothing reads it, and remove the name from the
   two `EXPECTED` arrays.

### Recipe 6 - Add a seed script

1. Put it at `scripts/seed-<thing>.ts`; import credentials from `@/lib/admin-firebase`
   (`getAdminFirestore()`) or `@/lib/supabase/admin` - **never** paste a private key.
2. Make it idempotent: follow `scripts/seed-receipt-sevas.ts:98-101` (per-item existence check) or
   `scripts/seed-testimonials.ts:86-93` (abort if non-empty). Do not follow `scripts/seed-poojas.ts:85-90`
   (deletes everything first) or `scripts/seed-sevas.ts:93` (blind `add()`).
3. Support `--dry-run` the way `scripts/migrate-core-to-supabase.ts:233` does.
4. Register it in `package.json` `scripts` so it is discoverable - most existing seeds are not.

### Recipe 7 - Re-run the Firestore dump after a quota block

1. `data/firestore-dump/README.md:70-73`: free tier is ~50k reads/day and `page_views` alone is
   ~47k docs, so one full dump per day.
2. Run `npm run firestore:dump` once and leave it; `scripts/dump-firestore-live.ts:36` retries
   discovery 48 times with growing backoff and `:56` retries each collection 5 times.
3. Never run two instances in parallel.
4. Read `data/firestore-dump/MANIFEST.json` afterwards; anything with status `failed` or
   `unexpected` needs a look before you trust the dump.

## Faults, smells and risks

| id | severity | what | evidence (path:line) | suggested direction |
|---|---|---|---|---|
| M11-F01 | HIGH | Sevas are **read from Supabase but written to Firestore**. Every admin create/update/delete is invisible to the public site until a migration script is re-run manually. | `services/seva.service.ts:11` (read via `getAllSevasAction`) vs `:76,:81,:86` (`addDoc`/`updateDoc`/`deleteDoc` on Firestore) | Pick one store for the seva domain and move reads+writes together; until then treat `scripts/migrate-sevas.ts` as a required post-edit step. |
| M11-F02 | HIGH | A Firebase **service-account private key is hardcoded in nine source files** (verified by `grep -rln "BEGIN PRIVATE KEY" scripts/`), together with `project_id`, `private_key_id` and `client_email`. Anyone with the repo has full admin access to `sri-raghavendra-mutt`. | `scripts/check-about-us.ts:5-32`, `scripts/check-trust-committee.ts:5-32`, `scripts/seed-poojas.ts:36-63`, `scripts/seed-sevas.ts:36-63`, `scripts/seed-trust-committee.ts:171-198`, `scripts/seed-poojas.js:89`, `scripts/seed-sevas.js:89`, `scripts/update-finance-settings.ts:5`, `scripts/update-finance-settings.js:48` | Revoke the key in the Firebase console **today**, strip it from all nine files (and from history), and switch them to `getAdminFirestore()` like `scripts/check-firestore-sevas.ts:1`. `scripts/import-events.ts:30` is a false positive - it only string-matches the BEGIN marker on a key read from `process.env`. |
| M11-F03 | HIGH | `firestore.rules` declares `match /settings/{docId}` **twice**; the second block allows `write: if true`. Firestore rules are additive, so **anyone on the internet can overwrite every settings document** - About Us, Trust Committee, footer, finance settings, AI config. | `firestore.rules:136-139` (`allow write: if isAdmin()`) and `firestore.rules:231-234` (`allow write: if true`) | Delete the second block. Same issue for `ai_settings` at `:226-229` (`allow write: if true`). |
| M11-F04 | HIGH | Application code reads Supabase tables whose only RLS policy is `FOR ALL TO public USING (false)` using the **anon** browser client. Those reads return zero rows in production; the services swallow the error and return `[]`. | `services/event.service.ts:2,46` + `supabase/migrations/20260907112632_create_core_tables.sql:98-102`; `services/ai-analytics.service.ts:134,170` + `20260930000000_create_ai_tables.sql:95-96`; `lib/ai/ai-settings/repository.ts:391` + `:94` | Either add a public SELECT policy (as `site_settings` does) or route these through server actions using `createAdminClient()`. |
| M11-F05 | HIGH | **25 collections the code uses have no `match` block** in `firestore.rules`, so every client-SDK read/write on them is denied by default: `dailyPoojas`, `poojas`, `profiles`, `bookmarks`, `donation_campaigns`, `volunteer_requests`, `guruParampara`, `articles`, `featuredContent`, `chatTraining`, `chat_metrics`, `intent_metrics`, `intent_feedback`, `daily_page_stats`, `notifications`, `trust`, `test`, `ai_unknown_questions`, and the seven `knowledge_*` workflow collections. | `services/pooja.service.ts:43` vs the 38 `match` blocks in `firestore.rules:34-277`; `services/knowledge-workflow.service.ts:46-54` | Audit every collection in the catalogue table above and add the missing rules, or move those reads to admin-SDK route handlers. |
| M11-F06 | HIGH | `storage.rules` lets **any** signed-in user read and write **any** object in the bucket, and lets anonymous users write freely to `testimonials/`. | `storage.rules:5-8` (`match /testimonials/{allPaths}` - `allow read: if true; allow write: if true`) and `storage.rules:11-14` (`match /{allPaths}` - `allow read/write: if request.auth != null`) | Scope write rules per prefix and per role; require `isAdmin()` for everything except a size/content-type-limited upload path. |
| M11-F07 | HIGH | Two conflicting `temple_areas` migrations create the same table with different primary-key types (`uuid` vs `text`) and different column sets. Both use `IF NOT EXISTS`, so the deployed schema depends on which ran first, and nothing in the repo records the answer. | `supabase/migrations/20240523000000_create_temple_areas.sql:1-16` vs `supabase/migrations/20240915_create_temple_areas.sql:1-18` | Delete one, and add a corrective migration that asserts the final shape. Note `scripts/seed-temple-areas-supabase.ts:48` writes a text `id`, implying the `20240915` shape is live. |
| M11-F08 | MEDIUM | Two parallel "unknown questions" stores with different names are written by different code paths, so the admin AI console and the logger disagree about what was asked. | `lib/ai/unknown-logger.ts:13` (`unknown_questions`, Firestore) vs `services/ai-analytics.service.ts:47` (`ai_unknown_questions`) vs `lib/ai/ai-settings/repository.ts:391` (`unknown_questions`, Supabase) | Consolidate on one name and one store; `firestore.rules` only knows `unknown_questions` (`:219`). |
| M11-F09 | MEDIUM | The knowledge seed writes to collection `articles`; the app reads collection `knowledge`. Running `npm run seed:ai` populates data nothing will ever display (and the write is rule-denied anyway). | `scripts/seed-ai-knowledge.ts:65,143` vs `lib/ai/knowledge/repository.ts:27` and `app/api/ai/knowledge/import/route.ts:73` | Delete `scripts/seed-ai-knowledge.ts` and keep the API route, or repoint it at `knowledge`. |
| M11-F10 | MEDIUM | `scripts/seed-poojas.ts` / `.js` **delete every document in `dailyPoojas`** before seeding, with no `--dry-run`, no confirmation prompt and a hardcoded production credential. One accidental run wipes the live pooja schedule. | `scripts/seed-poojas.ts:85-90`, `scripts/seed-poojas.js:112` | Add a `--force` gate (as `scripts/seed-quotes.ts:793` has) and remove the embedded key. |
| M11-F11 | MEDIUM | `scripts/seed-sevas.ts` calls `.add()` unconditionally, so every re-run duplicates the whole seva catalogue. | `scripts/seed-sevas.ts:86-88` reads the existing count, then `:92-98` loops and `:93` `.add()`s anyway | Adopt the per-name existence check from `scripts/seed-receipt-sevas.ts:97`. |
| M11-F12 | MEDIUM | Nine composite indexes that the code needs are absent, and several declared ones target the wrong field or the wrong collection (`announcements.active` vs the real `isActive`; `chat_messages` vs the real `messages`). These queries fail at runtime with `FAILED_PRECONDITION`. | `firestore.indexes.json:92-105,122-129` vs `services/announcement.service.ts:48`, `services/chat.service.ts:118`, `services/billing.service.ts:108,119,131`, `services/gallery.service.ts:182,194`, `services/sevaBooking.service.ts:55`, `services/testimonial.service.ts:77`, `services/knowledge-workflow.service.ts:87,317,378,608,1038` | Regenerate the index file from the query inventory in this document. |
| M11-F13 | MEDIUM | Four migration files carry timestamps in the **future** relative to today (2026-09-19): `20260920`, `20260930`, `20261001`, `20261010`. A migration authored today sorts before them, so ordering guarantees are broken. | `supabase/migrations/` filenames | Rename with real stamps before anything else is added, or freeze the current set and only append with `2027*` stamps. |
| M11-F14 | MEDIUM | `scripts/setup-admin.ts` guards against an un-edited config by comparing to `'your-firebase-auth-uid'`, but the placeholder actually shipped is `'YOUR_UID_FROM_FIREBASE'`. The guard never fires, so the script happily writes a `super_admin` document with id `YOUR_UID_FROM_FIREBASE`. | `scripts/setup-admin.ts:34` vs `:43` | Compare against the real placeholder, or read the uid from `process.argv`. |
| M11-F15 | MEDIUM | `scripts/seed-temple-areas.ts` spreads camelCase object keys (`nameKannada`, `bestTimeToVisit`, `has360View`, `imageUrl`) straight into the snake_case `temple_areas` table; it will fail on every row. It is a near-duplicate of the working `scripts/seed-temple-areas-supabase.ts`. | `scripts/seed-temple-areas.ts:36-40` vs `scripts/seed-temple-areas-supabase.ts:45-55` | Delete `scripts/seed-temple-areas.ts`. |
| M11-F16 | MEDIUM | `GET /api/supabase-check` is unauthenticated and reports which Supabase env vars are configured, including whether a service-role key is present. Its success message ("No tables queried as schema is not created yet") is also three migrations out of date. `envStatus` is returned in **both** the failure (`:17`) and success (`:44`) branches. | `app/api/supabase-check/route.ts:5` (`export async function GET()`, no auth), `:7-9` (`hasUrl/hasAnonKey/hasServiceRoleKey`), `:43` (stale message) | Gate behind `isAdmin`, or delete - it no longer tells the truth. |
| M11-F17 | MEDIUM | `lib/supabase/client.ts` falls back to `https://placeholder.supabase.co` / `"placeholder"` when env vars are absent, so a misconfigured deployment produces empty pages instead of a startup failure. | `lib/supabase/client.ts:4-5` | Throw, as `lib/supabase/admin.ts:4` does. |
| M11-F18 | MEDIUM | `docs/DATA-MODEL.md` is materially wrong about the shipped schema: it documents a `panchanga` Firestore collection that does not exist (data is in `data/panchanga/`), gives `sevaBookings` `devoteeName`/`devoteeEmail`/`devoteePhone`/`statusHistory`/`bookedBy` fields that `types/seva-booking.ts` does not have, names `donationCampaigns` where the code uses `donation_campaigns`, and describes 14 collections when the code touches 50+. It also claims "Firestore - Primary database for all application data" with no mention of Supabase. | `docs/DATA-MODEL.md:20,130-134,708-742` vs `types/seva-booking.ts:9-31`, `lib/aaradhane/panchanga.ts:65`, `services/donationCampaign.service.ts:68` | Regenerate the collection catalogue from code; add a Supabase section. |
| M11-F19 | MEDIUM | Every data-consuming component in this chunk's trees is a client component, so Firestore/Supabase queries run in the browser. This violates AGENTS.md ("Server Components First", "No Direct Firebase Calls - use services only"). | `components/home/SevaBooking.tsx:1`, `app/(public)/events/[id]/page.tsx:1`, `app/(public)/about/page.tsx:1`, `app/(public)/trust/page.tsx:1`, `app/admin/content/page.tsx:89-99` (direct `collection(db, ...)` in a page) | Move reads into Server Components or route handlers; this is also the precondition for a React Native client (see Portability). |
| M11-F20 | LOW | Eight files in `data/` are **empty** (`announcements.ts`, `bookings.ts`, `donations.ts`, `events.ts`, `gallery.ts`, `poojas.ts`, `sevas.ts`, `timings.ts`), and `data/galleryCategories.ts` is imported by nothing. | inventory line counts (2 lines each); `grep -rn galleryCategories` returns only its own definition | Delete. |
| M11-F21 | LOW | `quotes-seed-data.json` at the repo root (743 lines) duplicates `seed/quotes-seed-data.json` (884 lines) in a different shape and is referenced by no code. | `scripts/seed-quotes.ts:844` writes only the `seed/` copy | Delete the root file. |
| M11-F22 | LOW | The `EXPECTED` collection list is duplicated verbatim in two files; they will drift. | `scripts/dump-firestore-live.ts:11-22` and `scripts/convert-firestore-export.ts:14-25` | Extract into `scripts/lib/collections.ts`. |
| M11-F23 | LOW | `scripts/dump-firestore-configs.sh` is a 25-line file whose only executable statement is `exec npm run --silent firestore:dump`, yet it is still wired to `npm run firestore:dump:cli`. `package.json` also has both `firestore:convert` and `firestore:dump:convert` pointing at the same script. | `scripts/dump-firestore-configs.sh:25`, `package.json` scripts block | Delete the wrapper and one of the duplicate npm scripts. |
| M11-F24 | LOW | `scripts/migrate-events-to-supabase-from-json.ts` has no `--dry-run`, no validation and no reconciliation report, unlike every other migration script. It writes 38 rows straight to production. | `scripts/migrate-events-to-supabase-from-json.ts:26-35` | Fold it into `scripts/migrate-core-to-supabase.ts` as a JSON source, or add the same guards. |
| M11-F25 | LOW | `supabase/migrations/20260908120000_create_sevas_table.sql` re-creates a table the previous migration already created, wrapped in a `pg_tables` check - so in any normal run it is a 53-line no-op. The `20260920000000` file's header comment ("Add gotra, nakshatra, and raashi columns") contradicts its body (creates the table). | `supabase/migrations/20260908120000_create_sevas_table.sql:4`, `supabase/migrations/20260920000000_create_seva_bookings.sql:1` vs `:6` | Remove the dead migration; fix the misleading comment. |
| M11-F26 | LOW | Migration mappers and the diagnostic route use `any` and `catch (error: any)`, against AGENTS.md's "no `any`". | `scripts/migrate-core-to-supabase.ts:6` (`toDate(value: any)`), `:71-75` (`db: any, supabase: any, mapper: (id, data: any) => any`), `:104` (`any[]`), `:111` (`catch (err: any)`); `app/api/supabase-check/route.ts:48`; `services/event.service.ts:21` | Type the mappers against the target-table interfaces that are already declared (`TargetSeva` etc.) and use `unknown` in catches. |
| M11-F27 | LOW | `FIRESTORE_IMPORT.md` tells the operator to import aaradhane events into the `aaradhanes` collection, but every generator and service writes them to `events`. It also instructs saving a service-account key as `firebase-admin.json` in the project root - a filename **not** covered by `.gitignore` (which only ignores `.firebase-adminsdk.json`). | `FIRESTORE_IMPORT.md:31,62` vs `lib/aaradhane/firestore.ts:28`, `.gitignore:41` | Correct the collection name and add `firebase-admin.json`, `service-account.json` to `.gitignore`. |
| M11-F28 | LOW | `data/calendar.ts` hardcodes ekadashi and festival dates that run out on 2027-04-02; ten files depend on it with no fallback. | `data/calendar.ts:26,53` | Generate from `data/panchanga/` or move into Firestore/Supabase. |
| M11-F29 | LOW | `scripts/verify-supabase-sevas.ts` hardcodes the expected source count as `10 (From Image)`. | `scripts/verify-supabase-sevas.ts:16` | Take the expected count as an argument or read it from Firestore. |
| M11-F30 | HIGH | **Social links are a second split-brain domain.** The admin editor saves to the Firestore document `settings/socialLinks`; every public consumer reads the Supabase table `social_links`. No code path writes `social_links`, so an admin's edit to the footer/social icons is never visible on the site. Worse, `settings/socialLinks` is covered by the duplicated `match /settings` rule, so it is world-writable (M11-F03). | `app/admin/settings/social-links/page.tsx:32-33` (`COLLECTION = "settings"`, `DOCUMENT = "socialLinks"`), `:89` (`setDoc`) vs `services/settings.service.ts:121` (`.from("social_links")`); `scripts/migrate-settings.ts:102-103` is the only writer of the table | Point the admin page at `settingsService`, add `updateSocialLinks()` using `createAdminClient()` (mirror `updateSettings` at `services/settings.service.ts:95`), and retire `settings/socialLinks`. |
| M11-F31 | LOW | `services/settings.service.ts` has read-only coverage of `social_links` and a `defaultSocialLinks` constant it silently falls back to on any error, so a missing/denied row is indistinguishable from "the temple has no social accounts". | `services/settings.service.ts:21` (`defaultSocialLinks`), `:131,:134` (return the default on error and on empty) | Surface the error, or at minimum log-and-flag rather than returning a plausible-looking default. |
| M11-F32 | MEDIUM | `scripts/update-finance-settings.js` is a **committed `tsc` ES5 build artefact** of `scripts/update-finance-settings.ts` - same job, same hardcoded key, same UPI id and the same three special sevas, 133 lines of `__awaiter`/`__generator` boilerplate wrapping 90 lines of logic. Neither file is referenced by `package.json`, so the operator picks one by hand and the two will drift the moment the `.ts` is edited without recompiling. The `.js` is also the harder copy to review, which is where the key is easiest to miss. | `scripts/update-finance-settings.js:1-41` (the downlevel helpers) and `:48` (the key) versus `scripts/update-finance-settings.ts:5`; identical payloads at `.js:66-111` and `.ts:55-100`; `grep -n "update-finance-settings" package.json` returns nothing | Delete the `.js`, add `scripts/*.js` build output to `.gitignore`, and run the `.ts` through `tsx` like every other script. Do this in the same change that revokes the key (M11-F02), not after. |
| M11-F33 | LOW | `scripts/import-events.ts` `add()`s every row of `data/exports/aaradhane-events-<year>.json` with no de-duplication and no `eventKey` check, although the generator already puts a stable `eventKey` on each event. Running it twice doubles the public calendar, and nothing in the script or in `FIRESTORE_IMPORT.md` warns of it. | `scripts/import-events.ts:64` (`db.collection("events").add`) versus the `eventKey` written at `scripts/export-events.ts:59`; `lib/aaradhane/firestore.ts` is the upsert path the script bypasses | Look the `eventKey` up and `set()` on the existing doc, or reuse `lib/aaradhane/firestore.ts`. |

## Portability notes (React Native / cross-platform)

| piece | web-only dependency | reuse as-is / adapt / rewrite | why |
|---|---|---|---|
| `lib/supabase/client.ts` | `@supabase/ssr` `createBrowserClient` (document/localStorage) | **rewrite** | RN needs `@supabase/supabase-js` `createClient` with `AsyncStorage` as `auth.storage` and `detectSessionInUrl: false`. |
| `lib/supabase/server.ts` | `next/headers` `cookies()` | **rewrite / drop** | Cookie-bound sessions do not exist in RN. Replace with a token passed from the mobile auth layer. |
| `lib/supabase/admin.ts` | none (plain `supabase-js`) | **do not ship** | Service-role key must never reach a mobile binary; the RN client must call a server endpoint instead. |
| `app/api/supabase-check/route.ts` | Next.js route handler, `NextResponse` | **rewrite** as a plain HTTP handler | Framework-bound. |
| `supabase/migrations/*.sql` | none | **reuse as-is** | SQL is platform-neutral; this is the most portable asset in the chunk. |
| `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firebase.json` | none | **reuse as-is** | Server-side config, identical for a mobile client. |
| `scripts/**` (migrate, seed, dump, check) | Node built-ins `fs`/`path`, `process.argv`, `firebase-admin`, `google-auth-library` | **reuse as-is (Node only)** | These are developer tooling; they never ship in any client bundle. |
| `scripts/lib/firestore-values.ts` | none | **reuse as-is** | Pure functions over plain objects. |
| `data/shlokas.ts`, `data/calendar.ts`, `data/galleryCategories.ts` | none | **reuse as-is** | Plain TypeScript constants - ideal for a shared package. |
| `data/panchanga/**`, `seed/ai/*.json`, `data/exports/*.json` | read via `fs.readFileSync(process.cwd() + ...)` | **adapt** | RN has no `fs` and no `process.cwd()`. Either bundle them as imported JSON modules or serve them from an API. `lib/ai/retrieval/panchanga.ts:42` and `lib/aaradhane/panchanga.ts:65` are the two call sites to change. |
| Snake_case -> camelCase mappers (`services/event.service.ts:21`, `services/settings.service.ts:56`, `services/temple-areas.supabase.service.ts`) | none | **adapt - extract** | Pure mapping logic currently trapped inside web services; move into a shared `packages/data` module. |
| `types/*.ts` | none | **reuse as-is** | The shared contract between web and mobile. |
| Firestore web SDK usage across services | `firebase/firestore` web SDK | **adapt** | The JS SDK runs in RN but needs `initializeFirestore(app, { experimentalForceLongPolling: true })` and `initializeAuth` with `getReactNativePersistence`; `lib/firebase.ts` ([M10]) would need a platform split. |

**What a React Native client would need from this module:**

1. **A real API boundary.** Today the data layer is reachable only by importing a web service that
   builds its own Supabase/Firestore client in the browser (Trees A-E). Mobile needs stable HTTP
   endpoints; `app/actions/sevas.ts` ("use server") is the right shape but is a Next.js server
   action, callable only from the Next app.
2. **A single store per domain.** The split-brain domains (M11-F01, M11-F04) cannot be consumed
   safely by a second client - mobile would read a different truth from web.
3. **Shared types and mappers** extracted into a platform-neutral package: `types/*.ts` plus the
   snake_case mappers, with no `next/*` import anywhere in the chain.
4. **Panchanga and shloka data served over HTTP**, since 730 filesystem JSONs cannot be read from a
   mobile bundle without either inflating the app or shipping them as assets.
5. **Supabase RLS policies that actually permit the anon role**, plus Firebase rules that cover
   every collection - otherwise a mobile client authenticating as a normal user sees empty screens
   for the same reason the web anon client does (M11-F04, M11-F05).
6. **Generated Supabase types** (`supabase gen types typescript`) so the two clients cannot drift.

## Coverage

filesExpected 86, filesMentioned 86 (plus 5 adopted files: `scripts/export-events.ts`,
`scripts/import-events.ts`, `scripts/generate-events-firestore.ts`,
`scripts/update-finance-settings.ts`, `scripts/update-finance-settings.js`).

Omitted from individual treatment, covered as groups:

- `seed/ai/*.json` - 15 files listed as one row; identical schema, differing only in content.
- `data/exports/*.json` - 7 files listed in one table by pair.
- `data/announcements.ts`, `data/bookings.ts`, `data/donations.ts`, `data/events.ts`,
  `data/gallery.ts`, `data/poojas.ts`, `data/sevas.ts`, `data/timings.ts` - one row; all empty.
- `data/panchanga/**` - counted, not opened (RULES.md forbids bulk-reading the 730 files; 3-file
  sample not needed since `lib/aaradhane/panchanga.ts` documents the shape).
- `data/testimonials.xlsx` - binary, not opened.

## UNCLEAR

- **Which `temple_areas` migration is actually applied in the live Supabase project.** The two
  files (`20240523000000`, `20240915`) disagree on the primary-key type and both use
  `IF NOT EXISTS`. `scripts/seed-temple-areas-supabase.ts:48` writes a text `id`, suggesting the
  `20240915` shape, but nothing in the repo confirms it. Settled by `\d public.temple_areas` against
  the project, or by reading `supabase_migrations.schema_migrations`.
- **Whether any migration has been applied at all.** There is no `supabase/config.toml`, no
  `.supabase/` directory and no CI step that runs `supabase db push`, so the entire `migrations/`
  tree may be aspirational. Settled by listing `supabase_migrations.schema_migrations`.
- **Whether `data/firestore-dump/README.md`'s 2026-09-10 inventory is still accurate.** It is
  9 days old as of today and several counts are marked "(pending)" because the probe hit the 429
  quota wall. Settled by one clean `npm run firestore:dump` and reading `MANIFEST.json`.
- **Whether the hardcoded service-account key in M11-F02 is still valid.** I did not and will not
  test it. Settled by checking the key id in Firebase Console > Service accounts; if it is listed,
  revoke it.
- **Whether the `ai_unknown_questions` collection holds live data** or was abandoned in favour of
  `unknown_questions`. `data/firestore-dump/README.md:52` lists it under "code-known collections not
  present live", which suggests it is empty - but that probe was incomplete. Settled by the next dump.
- **Whether `receiptSevas` / `receipts` / `bills` / `quotes` / `knowledge` are intended to stay on
  Firestore permanently.** `docs/SUPABASE_DATABASE_SCHEMA.md:53` calls settings "Legacy / Not
  Required" and never mentions these five at all, yet they carry live business data (money).
  Settled by a product decision, not by code.

## Verification log (2026-09-19)

Independent skeptic pass. 340 cited paths extracted and existence-checked by script; 195 of them
carry line numbers and each was opened and compared against the claim. Every change below is a
correction made against the code, not against a document.

- `storage.rules` cited as `:14-17` and `:20-23`, but the file is 16 lines -> now `storage.rules:5-8`
  (`match /testimonials/{allPaths}`, `allow read/write: if true`) and `storage.rules:11-14`
  (`match /{allPaths}`, `if request.auth != null`) -> `cat -n storage.rules`. Fault M11-F06 itself
  CONFIRMED, only its coordinates were wrong.
- M11-F02 said "seven source files" and listed eight -> now "nine", adding
  `scripts/update-finance-settings.js:48` -> `grep -rln "BEGIN PRIVATE KEY" scripts/` returns
  9 files with a literal key. `scripts/import-events.ts` also matches the grep but is a false
  positive (`:30` only checks the marker on a key read from `process.env`); that is now noted.
- `services/ai-analytics.service.ts:45` was cited for `ai_unknown_questions` -> now `:47`
  (`:45` is `LATENCY_RECORDS`; the `COLLECTIONS` map runs `:43-50`). Fixed in the collection
  catalogue, in M11-F08 and in the migration-state table. `ai_token_usage` `:42` -> `:44`.
- Data flow 2 line numbers were all shifted: `migrateCollection() :68` -> `:70`;
  `count().get() :77` -> `:81`; paging `:89,:182` -> `:94,:183` (and `BATCH_SIZE = 50` is at `:87`);
  `firestore_id` pre-select `:120` -> `:121-122`; reconciliation `:200-226` -> `:201-228`;
  sevas validation `:253-257` -> `:248-252`; events validation `:294-304` -> `:307-315`; the
  daily-poojas mapper (`:276-282`) was missing entirely and is now named.
- M11-F26's `any` sites `:5,69,102` -> `:6` (`toDate(value: any)`), `:71-75` (three `any` params),
  `:104` (`any[]`), `:111` (`catch (err: any)`).
- M11-F16's evidence `:14` showed nothing about the service-role key -> now `:7-9` (the `envStatus`
  object) plus the note that `envStatus` is returned in both the 503 and 200 branches (`:17`, `:44`).
- M11-F05 said "at least 24 collections" but lists 25 -> now "25", cross-checked against the
  38 `match` blocks enumerated by `grep -n "match /" firestore.rules`.
- `scripts/seed-sevas.ts` `.add()` cited at `:92` -> `:93` (`:92` opens the loop); M11-F11 evidence
  `:86-99` -> `:86-88` (count) and `:92-98`/`:93` (blind add).
- `scripts/seed-receipt-sevas.ts:97` (blank line) -> `:98-101`, the actual
  `for (...) { const existing = await collection.where("name","==",...)` check. Same fix in Recipe 6,
  where `seed-testimonials.ts:87` -> `:86-93` and `seed-poojas.ts:86` -> `:85-90`.
- Recipe 5 said `app/admin/content/page.tsx:89-99` "touches nine collections" -> eight distinct
  collections over eleven `getCountFromServer` calls, now enumerated (`events`, `announcements`,
  `gallery`, `sevas`, `poojas`, `knowledge`, `testimonials`, `volunteer_requests`).
- Tree A cited `services/seva.service.ts:10` (a bare `try {`) -> `:9`, the `getAllSevas` signature.
- Tree C cited `services/settings.service.ts:68` for `createSettings` -> `:69`.
- Recipe 1 cited `TargetSeva (:21)` -> `:22`, and the mapper `:252` -> `:248-252` / `:259`.
- **New finding M11-F30 (HIGH):** social links are a second split-brain domain. The builder recorded
  `social_links` as "Supabase only". The admin editor
  `app/admin/settings/social-links/page.tsx:32-33,89` writes Firestore `settings/socialLinks`, while
  `services/settings.service.ts:121` reads the Supabase table; `grep -rn "\.from(" app services lib`
  shows no writer of `social_links` outside `scripts/migrate-settings.ts:102-103`. Tree C, the
  migration-state table and the Supabase table row are corrected accordingly.
- **New finding M11-F31 (LOW):** `services/settings.service.ts:21,131,134` returns
  `defaultSocialLinks` on both error and empty, hiding the failure above.
- Added a paragraph under the collection catalogue explaining where per-collection *field* lists
  actually live (the `types/` file, or the write site for the nine collections that have no type) -
  focus question 1 asked for "the fields the code reads and writes" and the table only had call sites.
- Checked and left unchanged because they proved correct: `firestore.rules:136-139` vs `:231-234`
  (duplicate `match /settings`, second one `allow write: if true`) and `:226-229` (`ai_settings`
  world-writable); the deny-all RLS policies at `20260907112632_create_core_tables.sql:86,92,98`
  (`FOR ALL TO public USING (false)`) and `20260930000000_create_ai_tables.sql:92-96`; the two
  conflicting `temple_areas` migrations (`uuid` PK at `20240523000000...:2` vs `text` PK at
  `20240915...:2`, plus `image_url`/`has360_view` only in the second); `scripts/setup-admin.ts:34`
  (`'YOUR_UID_FROM_FIREBASE'`) vs `:43` (`=== 'your-firebase-auth-uid'`); the 22 entries in
  `firestore.indexes.json` and every row of the missing/unused index tables (spot-checked
  `services/announcement.service.ts:48` `isActive`, `services/chat.service.ts:118` on `messages`,
  `services/testimonial.service.ts:77`, `services/billing.service.ts:108,119,131`,
  `services/gallery.service.ts:194`, `services/sevaBooking.service.ts:55`); the four future-dated
  migration filenames; `docs/DATA-MODEL.md:130-136` (`devoteeName/Email/Phone`), `:147`
  (`statusHistory`), `:155` (`bookedBy`), `:450` (`donationCampaigns`), `:708` (`panchanga`) against
  `types/seva-booking.ts:9-31`; the fourteen `### N.` sections in `docs/DATA-MODEL.md`;
  `FIRESTORE_IMPORT.md:31,62` vs `.gitignore:41`; all eleven `"use client"` claims in M11-F19;
  the eight empty `data/*.ts` files and the zero-reference `data/galleryCategories.ts`; the row
  counts in `data/exports/` (11 / 19 / 19 / 38); and `package.json`'s duplicate
  `firestore:convert` / `firestore:dump:convert`.
- Coverage re-checked against `.claude/state/inventory/M11.json` (86 entries): every entry is
  mentioned, and nothing under the chunk roots is absent from the inventory except the five adopted
  scripts and `data/testimonials.xlsx`, all of which the file already names. No file over 40 lines
  is unmentioned.
- `data/firestore-dump/MANIFEST.json` is cited as an *output* of `scripts/dump-firestore-live.ts:133`
  and is correctly absent from disk (`data/firestore-dump/` holds only `README.md`; the rest is
  git-ignored by `.gitignore:37-38`). Not a broken path.

**Gap-closure pass (2026-09-19).** The five adopted scripts were re-read in full and two findings
added: **M11-F32** (the committed `tsc` twin of `update-finance-settings.ts`) and **M11-F33**
(`import-events.ts` re-adds rather than upserts). The adopted-file table now names the admin page
in M05 that writes the same `settings/financeSettings` document, and M05's *Key files* row for that
page points back here. `filesExpected`/`filesMentioned` are unchanged at 86 + 5 adopted; the fault
count for this file is now 33.
