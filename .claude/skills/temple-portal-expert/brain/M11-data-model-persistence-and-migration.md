# M11 - Data model, Firestore/Supabase persistence, rules, indexes, seeds and the Supabase migration
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against branch `feature/temple-portal-knowledge-base` (see "Refresh log (2026-10-18)" at the end). Verify against the code before acting on any claim.

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
- "How does the shared migration runner work (reconciliation, field coverage, `ExcludeDocumentError`)?" (`lib/supabase/migration-runner.ts`, added 2026-10)
- "Which Firestore collections are classified MIGRATE / REVIEW / EXCLUDE?" (`lib/supabase/migration-inventory.ts`)
- "How do I run the resumable batched migration or the staged Phase 1 (settings + events) migration?"
- "Where did the non-normalised `settings/*` documents go in Supabase?" (`settings_documents` JSONB table)
- "Where do AI settings and the knowledge base live now?" (Supabase `ai_settings`, `ai_knowledge` since 2026-10-06)
- "Why do migration scripts crash with 'This module cannot be imported from a Client Component module'?" (M11-F40)
- "What does the mobile app read from the database?" (Supabase tables directly, anon key - M11-F38)
- "Why is there a Prisma baseline marker in `supabase/migrations/`?"
- "How do I check for `aaradhane` / `aaradhanes` id collisions before migrating?"

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
`unknown_questions`, and since 2026-10-06 `ai_settings`, `ai_knowledge`, `chat_sessions`,
`chat_messages`, `ai_latency_records`, `ai_intent_distribution`), and several domains are
written to one store and read from the other (sevas M11-F01, social links M11-F30, knowledge
M11-F34, AI analytics dashboards M11-F36). Anyone changing data behaviour must first establish
which store the domain currently lives in - Section "Migration state per domain" is the map.

**2026-10 update.** Between 2026-09-21 and 2026-10-16 the ETL tooling was rebuilt: the mapping
logic moved out of the scripts into `lib/supabase/migration-{helpers,mappers,runner,inventory,coverage}.ts`
(pure, unit-tested), a resumable batched migrator (`scripts/migrate-all-batched.ts`) and a
checksum-verified staged Phase 1 (`scripts/dump-firestore-staged.ts` + `scripts/migrate-staged-phase1.ts`)
were added and wired to GitHub Actions, nine Supabase migrations were added (17 files, was 8), the Supabase CLI was
configured (`supabase/config.toml`), and the Raya AI domain (settings, knowledge, chat, analytics)
was cut over to Supabase. Business data (sevas writes, bookings, donations, gallery, receipts,
quotes) is still on Firestore.

## Code roots

From `.claude/state/chunks.json` (id M11):

```
firestore.rules
firestore.indexes.json
firebase.json
storage.rules
supabase/migrations/*.sql   supabase/config.toml   supabase/.gitignore
lib/supabase/{client,server,admin}.ts
lib/supabase/migration-{helpers,mappers,runner,inventory,coverage}.ts   (added 2026-09-21..10-06)
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
| `createAdminClient()` | `lib/supabase/admin.ts:4` | server only (`import 'server-only'` at `:1` since 2026-10-14, 7d7bd51) | n/a | Service-role client, RLS bypassed. Throws if env missing. The `server-only` marker also breaks every Node script that imports it - M11-F40. |
| `npm run firestore:dump` | `scripts/dump-firestore-live.ts` | CLI (node/tsx) | service account (env `FIREBASE_PROJECT_ID`/`_CLIENT_EMAIL`/`_PRIVATE_KEY` first, then the key file) | Full REST v1 dump of every collection -> `data/firestore-export/*.ndjson` + `data/firestore-dump/*.json` + `MANIFEST.json`. Also run by `.github/workflows/firestore-production-export.yml`. |
| `npm run dump:staged -- settings events` | `scripts/dump-firestore-staged.ts:11` | CLI | Firebase admin SDK | Phase 1 only: refuses any collection other than `settings`/`events` (`:21-28`); writes `data/firestore-dump/<c>.json` + `manifest.json` with SHA-256 per file. |
| `npm run migrate:phase1 -- --dry-run \| --confirm-production` | `scripts/migrate-staged-phase1.ts:24` | CLI | Supabase service role | Reads the staged dump, re-verifies hash + doc count against `manifest.json` (`:106-122`, `:241-258`), then upserts `site_settings`, `social_links`, `settings_documents`, `events`. Refuses to run with neither or both flags (`:28-40`). |
| `npx tsx scripts/migrate-all-batched.ts [--batch N] [--batch-size N] [--collections a,b] [--retry-failed] [--dry-run]` | `scripts/migrate-all-batched.ts:136,448` | CLI / `.github/workflows/firestore-batched-migration.yml` | both | Runs every `MIGRATE` item of `lib/supabase/migration-inventory.ts` through the shared runner in deterministic batches; checkpoint manifest `data/migration-manifest.json` (`:240`), report `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` (`:391`). |
| `npm run migrate:seva-bookings [-- --dry-run]` | `scripts/migrate-seva-bookings-to-supabase.ts:46` | CLI | both | `sevaBookings` -> `seva_bookings` with its own inline mapper (M11-F37) and a per-field source/target comparison. |
| `npx tsx scripts/migrate-ai-analytics.ts [--dry-run]` | `scripts/migrate-ai-analytics.ts:13` | CLI | both | `ai_latency_records`, `ai_intent_distribution`, and **both** `unknown_questions` and `ai_unknown_questions` into one `unknown_questions` table (M11-F41). |
| `npx tsx scripts/migrate-ai-knowledge.ts [--dry-run]` | `scripts/migrate-ai-knowledge.ts:25` | CLI | both | Firestore `knowledge` -> Supabase `ai_knowledge` via `mapAiKnowledge`. |
| `npx tsx scripts/check-collisions.ts` | `scripts/check-collisions.ts:4` | CLI / `.github/workflows/check-collisions.yml` | Firebase admin | Lists doc ids present in both `aaradhane` and `aaradhanes` (both map to Supabase `aaradhanes`); writes `collision-report.txt`; exit 1 on any collision. |
| `npm run supabase:migrations:push` / `:dry-run` | `package.json` -> `supabase db push` | CLI / `.github/workflows/supabase-migrations.yml` | Supabase access token | Applies `supabase/migrations/*.sql` using `supabase/config.toml` (project id `rayaramathaynk`). |
| `npm run verify:supabase-migrations[:static\|:json]` | `scripts/verify-supabase-migrations.ts` (unowned) | CLI | Supabase service role (not for `--static`) | Uses `lib/supabase/migration-coverage.ts` to compare the tables/columns/RLS the SQL declares with the live database and the migration ledger. |
| `node scripts/lib/probe-pg-url.mjs`, `node scripts/lib/dump-ai-catalog.mjs` | `scripts/lib/*.mjs` | CLI / `.github/workflows/prisma-baseline-drift-gate.yml` | Postgres URL | Read-only connectivity probe and catalog dump for the Prisma baseline drift gate; `check-baseline-drift-scope.mjs` scopes `prisma migrate diff` to the tables `prisma/schema.prisma` maps. |
| `npm run firestore:convert` | `scripts/convert-firestore-export.ts` | CLI | none | Converts an existing NDJSON export dir into decoded JSON + MANIFEST. |
| `npm run firestore:dump:cli` | `scripts/dump-firestore-configs.sh:25` | CLI (bash) | service account | Legacy wrapper: `exec npm run --silent firestore:dump`. Does nothing else. |
| `npm run migrate:core [-- --dry-run]` | `scripts/migrate-core-to-supabase.ts:30` | CLI | both | sevas / dailyPoojas / events -> Supabase. Since d71898d (2026-09-21) a 69-line wrapper: mappers from `lib/supabase/migration-mappers.ts`, runner from `lib/supabase/migration-runner.ts`. |
| `npm run migrate:content [-- --dry-run]` | `scripts/migrate-content-to-supabase.ts:37` | CLI | both | users, profiles, donation_campaigns, donations, galleryAlbums, galleryMedia, testimonials, aaradhane, volunteer_requests (same wrapper shape). |
| `npm run migrate:ai [-- --dry-run]` | `scripts/migrate-ai-to-supabase.ts:33` | CLI | both | chat_sessions, messages->chat_messages, unknown_questions, ai_intent_distribution, ai_latency_records (same wrapper shape). |
| `npm run migrate:settings [-- --dry-run]` | `scripts/migrate-settings.ts:37` | CLI | both | `settings/*` -> `site_settings` (doc carrying `templeName`+`contactEmail`), `social_links` (`settings/socialLinks`), and **every other settings doc losslessly into `settings_documents.data` (JSONB)** (`:128-129`). |
| `npm run migrate:sevas` / `migrate:daily-poojas` | `scripts/migrate-sevas.ts:30`, `scripts/migrate-daily-poojas.ts:32` | CLI | both | Single-collection variants of the core migration (still self-contained, not on the shared runner). Since 2026-09-21 a failed **dry run** also exits 1 (`scripts/migrate-sevas.ts:240-242`). |
| `npx tsx scripts/migrate-events-to-supabase-from-json.ts` | `scripts/migrate-events-to-supabase-from-json.ts:18` | CLI | Supabase only | Upserts `data/exports/supabase-events-all.json` into `events`. No dry run. |
| `npm run setup-admin` | `scripts/setup-admin.ts:39` | CLI | Firebase admin | Writes one `users/<uid>` doc with `role: "super_admin"`. |
| `npm run seed:ai` | `scripts/seed-ai-knowledge.ts:46` | CLI (`ts-node`) | Supabase service role | Since c586d6c (2026-10-06): upserts `seed/ai/*.json` into Supabase **`ai_knowledge`** on `slug` (`:94-106`). Was Firestore `articles`. Every row lands `approved = false` - M11-F35. |
| `npx tsx scripts/seed-ai-settings-supabase.ts` | `scripts/seed-ai-settings-supabase.ts:10` | CLI | Supabase service role (own client, `:19`) | Inserts `getDefaultSeedPayload("system")` into `ai_settings` with `ignoreDuplicates` - never overwrites. The SQL twin is `supabase/migrations/20261012000001_seed_ai_settings.sql`. |
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
      └─ createAdminClient()               lib/supabase/admin.ts:4
         └─ supabase.from('sevas').select('*')      -> SUPABASE  sevas
   └─ on any Supabase error: getDocs(collection(db,"sevas"))  services/seva.service.ts:31-39
                                                    -> FIRESTORE sevas (silent fallback)

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
└─ eventService.addEvent/updateEvent/deleteEvent  services/event.service.ts:70,98,122 (queries :90,114,123)
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
└─ settingsService.getSettings / getSocialLinks   services/settings.service.ts:41-43,81-83
   └─ createClient() (browser anon)               lib/supabase/client.ts:3
      └─ .from("site_settings" | "social_links")  -> SUPABASE  (RLS allows public SELECT)

Admin settings page (client)  app/admin/settings/page.tsx:69,71             [M05]
└─ settingsService.createSettings / updateSettings  services/settings.service.ts:70-71,75-76
   └─ await import("@/app/actions/settings")  "use server", admin-checked (verifyAdminForAction :26)
      └─ createAdminClient()  (service role)   app/actions/settings.ts:3   -> SUPABASE site_settings

Admin SOCIAL LINKS page (client)  app/admin/settings/social-links/page.tsx   [M05]
└─ setDoc(doc(db,"settings","socialLinks"))  :32-33 (names), :65 (read), :89 (write)
                                             -> FIRESTORE  settings/socialLinks
```

**Second split-brain, missed on the first pass:** the public site reads `social_links` from
**Supabase** (`services/settings.service.ts:83`) but the only admin editor writes the Firestore
document `settings/socialLinks` (`app/admin/settings/social-links/page.tsx:32-33,89`). No code
anywhere writes the Supabase `social_links` table - `grep -rn "\.from(" app services lib` returns
exactly one `social_links` hit, the read at `services/settings.service.ts:83`. The table is only
ever populated by `scripts/migrate-settings.ts:68-91,176` and `scripts/migrate-staged-phase1.ts:327`.
See M11-F30.

Note the separate, Firestore-backed settings documents that this does **not** cover:
`settings/aboutUs` (`app/(public)/about/page.tsx:112`), `settings/trustCommittee`
(`app/(public)/trust/page.tsx:61`), `settings/facilities` (`app/(public)/facilities/page.tsx:126`),
`settings/futurePlans` (`app/(public)/future-plans/page.tsx:108`), `settings/footer`
(`components/layout/Footer.tsx:70`), `settings/ai` (reader `lib/ai/settings.ts` removed 2026-10-14
in 2891323 - see Refresh log), `settings/device`
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

### Tree E - AI settings + unknown questions (Supabase since 2026-10-06, fae5d51)

```
Admin AI console (client)                 app/admin/ai/**                     [M09]
└─ aiSettingsRepository                   lib/ai/ai-settings/repository.ts    [M08]
   │  getSupabase() = window ? createClient() : createAdminClient()          (:35-37)
   ├─ .from("ai_settings")                            -> SUPABASE ai_settings  (:43,:106,:146)
   └─ .from('unknown_questions')                      -> SUPABASE unknown_questions   (:412-540)
└─ aiSettingsAdminRepository              lib/ai/ai-settings/admin-repository.ts
   ├─ createAdminClient().from("ai_settings")         -> SUPABASE (service role)      (:31,:42,:108)
   └─ createAdminClient().from('unknown_questions')   -> SUPABASE                     (:309,:364)
Unknown-question logger (server/client)   lib/ai/unknown-logger.ts:28-31  -> SUPABASE unknown_questions
BUT  lib/ai/generator.ts:73 -> logUnknownQuestion()  services/analytics.service.ts:31
                                                       -> FIRESTORE unknown_questions  (M11-F08)
```

### Tree F - Raya AI knowledge, chat and analytics (cut over to Supabase 2026-10-06..13; admin dashboards were not)

```
Knowledge retrieval (server)              lib/ai/knowledge/repository.ts:16 TABLE_NAME="ai_knowledge"
└─ window ? createClient() : createAdminClient()  (:62)  -> SUPABASE ai_knowledge (public SELECT where approved)
Knowledge import API                      app/api/ai/knowledge/import/route.ts:73,114 -> FIRESTORE knowledge
Knowledge coverage API                    app/api/ai/knowledge/coverage/route.ts:81  -> FIRESTORE knowledge
Admin content/featured dashboards         app/admin/content/page.tsx:96,121; app/admin/featured/page.tsx:147 -> FIRESTORE knowledge
                                                                                            (M11-F34)
Chat widget + admin AI pages (client)     services/chat.service.ts:8,29,48,77,107,145
└─ createClient() (browser anon)          -> SUPABASE chat_sessions / chat_messages (RLS deny-all - M11-F04)
Analytics writers                         services/ai-analytics.service.ts:134,170 -> SUPABASE ai_latency_records / ai_intent_distribution
                                          services/ai-analytics.service.ts:204-205 -> SUPABASE unknown_questions
Admin AI analytics page (client)          app/admin/ai/analytics/page.tsx:307,315,323,333,430
                                          -> FIRESTORE ai_intent_distribution / ai_latency_records / unknown_questions / chat_sessions (M11-F36)
GET /api/ai/analytics (server)            services/ai-analytics.service.ts:621-640 getAnalyticsDashboard
                                          -> FIRESTORE chat_sessions / chat_messages counts (M11-F36)
Every analytics recorder (server)         services/ai-analytics.service.ts:57-77 getAnalyticsSettings, called at :101,127,163,197,483
                                          -> FIRESTORE ai_settings (first doc of the collection) as the on/off gate (M11-F46)
```

## Data flow

### 1. Full Firestore dump (`npm run firestore:dump`)

(Rewritten 2026-09-22..24 - 143 -> 405 lines; commits 36f7694, 7680961, b7a40e1, eb5c780, d2c9113.)

1. `resolveCredentials()` (`scripts/dump-firestore-live.ts:227`) prefers the env triple
   `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (normalising `\n` and the
   PEM armour, `:233-243`), else the JSON at `process.env.FIREBASE_SERVICE_ACCOUNT` or
   `<root>/.firebase-adminsdk.json` (`:201`, `:244-245`).
2. A `google-auth-library` JWT with the `datastore` scope is handed to the global
   `FirestorePacer` (`:11-86`), which caches the token for an hour, re-mints on 401 (`:76-81`),
   spaces every request by at least `FIRESTORE_MIN_REQUEST_INTERVAL_MS = 500` (`:7`) and widens
   that gap by 500 ms (to 5 s max) after each 429 (`:64-68`).
3. `collectionIds()` POSTs `:listCollectionIds`, retrying up to `FIRESTORE_MAX_RETRIES = 10`
   times (`:8`, `:280`) with exponential backoff capped at `FIRESTORE_MAX_BACKOFF_MS = 120000`
   (`:9`). **Not 48 any more** - AGENTS.md still says 48 (M11-F44).
4. For each discovered collection not in `EXCLUDED` (`:217` - `users, profiles, bookmarks, sessions`),
   `fetchCollectionListAll()` (`:93`) pages at `FIRESTORE_PAGE_SIZE = 100` (`:6`), 10 attempts per
   page, 90 s abort timeout.
5. Raw wire docs go to `data/firestore-export/<c>.ndjson` (`:361`); decoded docs, via
   `convertDoc` in `scripts/lib/firestore-values.ts:62`, go to `data/firestore-dump/<c>.json` (`:363`).
6. `:390` writes `data/firestore-dump/MANIFEST.json` classifying every collection as
   `present` / `expected-known-missing` / `intentionallyExcluded` / `unexpected` / `failed`
   against the `EXPECTED` list at `:205-216`; a fatal error still writes a one-row `failed`
   manifest (`:271`, `:402`).
7. Both output dirs are git-ignored (`.gitignore:36-38`). The kept `data/firestore-dump/README.md`
   was **removed 2026-09-29 (051c530) - see Refresh log**; `.gitignore:38` still whitelists it.

### 2. Firestore -> Supabase core migration (`scripts/migrate-core-to-supabase.ts`)

Since d71898d (2026-09-21) the script is a 69-line wrapper; the work lives in `lib/supabase/`.

1. `run()` (`scripts/migrate-core-to-supabase.ts:30`) parses `--dry-run`, then `getAdminFirestore()`
   (`lib/admin-firebase.ts`, [M10]) and `createAdminClient()` (`lib/supabase/admin.ts:4`).
2. For each `[collection, table, mapper]` (`:37-41`) it calls `migrateSupabaseCollection()`
   (`lib/supabase/migration-runner.ts:52`), passing `CORE_FIELD_SPECS[collection]`.
3. The runner counts the source with `colRef.count().get()` (`:67`) and pages with
   `orderBy("__name__").limit(BATCH_SIZE)` where `BATCH_SIZE = 200` (`:44`, `:84`, `:175`).
4. Each doc goes through a pure mapper in `lib/supabase/migration-mappers.ts` that throws
   `ValidationError` on a missing NOT NULL value and never invents one: `mapSeva` (`:685`) requires
   `name/category/amount/duration` (description now defaults to `""`, 91f6df7); `mapDailyPooja`
   (`:736`) requires `title/description/startTime/duration/category/sevaAmount/days`; `mapEvent`
   (`:760`) requires `title` and parseable `startDate`/`endDate` - description/location/status became
   nullable (matching `supabase/migrations/20261011000000_alter_events_nullable.sql`) and
   `featured`/`published` default to `false` (1380104). A mapper may throw `ExcludeDocumentError`
   to record a deliberate exclusion (`lib/supabase/migration-helpers.ts:118`).
5. Every source field name is collected and checked against the declared `FieldCoverageSpec`
   (`migration-runner.ts:95-97`, `:190-193`); an unmapped field fails the run.
6. `:116-119` pre-selects existing `firestore_id`s; dry run counts inserts/updates without writing
   (`:134-138`); live mode upserts `onConflict: "firestore_id"` (`:140-142`) and falls back to
   row-by-row upserts to isolate the bad row (`:149-168`).
7. `reconcileCounts()` (`migration-helpers.ts:101`) enforces
   `source = inserts + updates + excludedMalformed + validationFailures + writeFailures`; the runner
   also reports destination row count (`:196-204`). `reportMigrationOutcome()` (`:270`) exits 1 on
   any reconciliation gap, validation/write failure or unmapped field.
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

### 5. AI knowledge seeding (two incompatible paths - changed 2026-10-06)

1. `scripts/seed-ai-knowledge.ts:15` reads `seed/ai/*.json` (15 files) and, since c586d6c, upserts
   each into Supabase **`ai_knowledge`** on `slug` (`:94-106`), with `slug = category.replace(/-/g,"_")`
   (`:92`), `keywords` taken from the file's `tags` (not its `keywords`), and
   `approved: article.published ?? false` (`:103`) - the seed files carry `approved`, never
   `published`, so every seeded row is unapproved and invisible to the public-read policy (M11-F35).
   The old `articles` collection is no longer written by anything.
2. `app/api/ai/knowledge/import/route.ts:61,73,114` reads the *same* `seed/ai` directory but still
   writes into **Firestore `knowledge`** - which the runtime no longer reads:
   `lib/ai/knowledge/repository.ts:16` reads Supabase `ai_knowledge` (M11-F34).
3. `scripts/migrate-ai-knowledge.ts` moves Firestore `knowledge` -> `ai_knowledge` via
   `mapAiKnowledge` (`lib/supabase/migration-mappers.ts:853`), so the import route's output only
   reaches the bot after a manual migration re-run.

### 6. Resumable batched migration (`scripts/migrate-all-batched.ts`, 21c9418 + checkpoint hardening e16615b..8e33f8b)

1. `getBatchedMigratableCollections()` (`lib/supabase/migration-inventory.ts:89`) takes every
   `MIGRATE` item, sorts by name, and slices into batches of 10.
2. `parseArgs()` (`scripts/migrate-all-batched.ts:136`) reads `--batch`, `--batch-size`,
   `--collections`, `--retry-failed`, `--dry-run`; `buildExecutionPlan()` (`:163`) skips collections
   already `SUCCESS` in the checkpoint unless retrying.
3. A checkpoint from a previous run (fetched by `scripts/fetch-checkpoint.ts` in
   `.github/workflows/firestore-batched-migration.yml:80`) is accepted only if
   `validateMigrationCheckpoint()` (`:51`) matches run type, inventory version, batch size and
   `checkpointVersion "1.0"`.
4. Each collection is resolved to a mapper by `getMapperFn()` (`:104-134`) and run through the shared
   runner; a collection with no mapper is recorded `FAILED` (`:303-324`). `knowledge` is `MIGRATE`
   but has no `destinationTable`, so it is skipped here (`:298-301`) and handled by
   `scripts/migrate-ai-knowledge.ts`.
5. The manifest is rewritten after every collection to `data/migration-manifest.json` (`:240`), and a
   Markdown status report to `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` (`:391`).

### 7. Staged Phase 1 (settings + events) - checksum-verified

1. `.github/workflows/firestore-staged-migration.yml:59` runs `scripts/dump-firestore-staged.ts settings events`;
   any other collection is refused (`scripts/dump-firestore-staged.ts:21-28`). Each file's SHA-256
   and doc count go into `data/firestore-dump/manifest.json` (`:74-87`).
2. `:76` of the workflow runs `scripts/migrate-staged-phase1.ts` with `--dry-run` or
   `--confirm-production`; the script re-hashes each file and aborts on any hash or count mismatch
   before it creates a Supabase client (`scripts/migrate-staged-phase1.ts:106-122`, `:241-258`, `:266`).
3. Settings docs split three ways (`site_settings` / `social_links` / `settings_documents`) as in
   `scripts/migrate-settings.ts`; events go through `mapEvent`. Upserts on `firestore_id` (`:375-377`).

## Key files

### Rules, indexes and platform config

| file | lines | role | key exports | notes |
|---|---|---|---|---|
| `firestore.rules` | 280 | All Firestore access control | - | 38 `match` blocks; `settings` matched **twice** (`:136` and `:231`), the second with `allow write: if true`. |
| `firestore.indexes.json` | 309 (was 180; reformatted when 2ec7d3a added `__name__`) | Composite index manifest | - | 22 indexes, no `fieldOverrides`; four are single-field (no-ops) and several needed ones are absent. |
| `firebase.json` | 10 | Points the CLI at the two rule files | - | No hosting/emulator/function config. |
| `storage.rules` | 17 | Storage bucket rules | - | `testimonials/{allPaths}` is world-readable **and world-writable** (`storage.rules:5-8`); everything else needs only "signed in" (`storage.rules:11-14`). |

### Supabase schema

| file | lines | role | tables created | notes |
|---|---|---|---|---|
| `supabase/migrations/20240523000000_create_temple_areas.sql` | 37 | temple_areas v1 | `temple_areas` (PK `uuid`) | public SELECT policy. |
| `supabase/migrations/20240915_create_temple_areas.sql` | 35 | temple_areas v2 | `temple_areas` (PK **`text`**) | `IF NOT EXISTS` - whichever runs first wins; adds `image_url`, `has360_view`. Conflicts with the above. |
| `supabase/migrations/20260907112632_create_core_tables.sql` | 114 | Core | `sevas`, `daily_poojas`, `events` + `update_updated_at_column()` | deny-all RLS; indexes `idx_sevas_display_order_active`, `idx_events_featured_published`. |
| `supabase/migrations/20260908120000_create_sevas_table.sql` | 53 | Idempotent re-create of `sevas` | - | Whole body wrapped in `IF NOT EXISTS (... pg_tables ...)`; dead if the core migration ran. |
| `supabase/migrations/20260920000000_create_seva_bookings.sql` | 52 | Bookings | `seva_bookings` | Header comment says "Add gotra/nakshatra/raashi columns" but the file creates the table. `seva_id uuid` here is widened to text by `20260921000000`. |
| `supabase/migrations/20260930000000_create_ai_tables.sql` | 105 | AI/chat | `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records` | deny-all RLS. |
| `supabase/migrations/20261001000000_create_content_tables.sql` | 218 | Content | `users`, `profiles`, `donation_campaigns`, `donations`, `gallery_albums`, `gallery_media`, `testimonials`, `aaradhanes`, `volunteer_requests` | deny-all RLS. `gallery_media.album_id` has no FK (`:133`). |
| `supabase/migrations/20261010000000_create_settings.sql` | 105 | Settings | `site_settings`, `social_links` | Public SELECT policy plus explicit write denials. |
| `supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql` | 55 | Fix-up (2026-09-21) | - | Widens `seva_bookings.seva_id` uuid -> text when still uuid (`:13-26`), adds gotra/nakshatra/raashi if missing, re-asserts the deny-all policy and a unique index on `firestore_id`. Idempotent. |
| `supabase/migrations/20260922000000_create_settings_documents.sql` | 52 | Lossless settings | `settings_documents` (`document_key` UNIQUE, `data jsonb`, `source_field_count`) | Deny-all RLS. Holds every `settings/*` doc that is not site settings or social links (financeSettings, aboutUs, trustCommittee, ...). **No app code reads it.** |
| `supabase/migrations/20261002000000_align_content_firestore_ids.sql` | 46 | Fix-up | - | Widens `donations.campaign_id` and `gallery_media.album_id` uuid -> text; adds indexes on both. |
| `supabase/migrations/20261006101759_seed_ai_settings.sql` | 17 | **Ledger marker only** | - | No DDL/DML; exists because the remote `schema_migrations` already holds this version (seed applied out of band). |
| `supabase/migrations/20261011000000_alter_events_nullable.sql` | 7 | Fix-up | - | `events.description/location/status` DROP NOT NULL. Plain `ALTER`, harmless on re-run. |
| `supabase/migrations/20261012000000_create_ai_settings_table.sql` | 32 | AI settings | `ai_settings` (PK text `'main'`, ten jsonb sections, `version`) | Deny-all RLS. Plain `CREATE TABLE` (no `IF NOT EXISTS`). |
| `supabase/migrations/20261012000001_seed_ai_settings.sql` | 28 | Seed | - | Inserts the `main` row `ON CONFLICT (id) DO NOTHING`. |
| `supabase/migrations/20261013000000_create_ai_knowledge.sql` | 60 | Knowledge | `ai_knowledge` (slug UNIQUE, firestore_id UNIQUE, keywords text[], approved) | **Public SELECT where `approved = true`** (`:30-34`), insert/update/delete denied. |
| `supabase/migrations/20261015000000_baseline_raya_ai.sql` | 14 | **Ledger marker only** | - | Mirrors the Prisma baseline `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql`, recorded remotely with `prisma migrate resolve --applied`. |
| `supabase/config.toml` | 15 | Supabase CLI config | - | `project_id = "rayaramathaynk"`, local ports, PG 15 (added 2026-09-21, 3212100/2ea5a34). |
| `supabase/.gitignore` | 4 | CLI scratch | - | Ignores `.branches`, `.temp`, `.env`. |

No `ai_token_usage`, `announcements`, `knowledge` (the Firestore name - its Supabase table is
`ai_knowledge`), `quotes`, `receipts`, `receiptSevas`, `bills`, `homepage`, `members` or
`website_settings` table exists in any migration. `prisma/schema.prisma` (owned by M16/M01) models
nine of the tables above (`ai_settings`, `ai_knowledge`, `chat_sessions`, `chat_messages`,
`unknown_questions`, `ai_intent_distribution`, `ai_latency_records`, `users`, `profiles`) but no
file in `app/ lib/ services/` imports `@prisma/client` or `lib/prisma.ts` - it is schema-only.

### Supabase clients

| file | lines | role | key exports | notes |
|---|---|---|---|---|
| `lib/supabase/client.ts` | 12 | Browser anon client | `createClient` | Silently falls back to `placeholder.supabase.co` - failures surface as empty arrays, not errors. |
| `lib/supabase/server.ts` | 30 | Cookie-bound server anon client | `createClient` | `await cookies()` from `next/headers`; swallows `setAll` errors in RSC. |
| `lib/supabase/admin.ts` | 19 | Service-role client | `createAdminClient` | Throws when env is missing. Must never be imported into a client bundle. Guard history 2026-10-13/14: `typeof window` throw (54024a1) -> `import 'server-only'` (d87bfd1) -> removed (0ba7b0e) -> module-level window throw (498b672) -> `import 'server-only'` again (7d7bd51, current `:1`). See M11-F40. |
| `lib/supabase/migration-helpers.ts` | 184 | ETL invariants | `toIsoString`, `requireTimestamp`, `reconcileCounts`, `auditFieldCoverage`, `ValidationError`, `ExcludeDocumentError`, `FieldCoverageSpec` | Pure; "never invent a value" contract. Unit-tested in `tests/unit/migration-helpers.test.ts`. |
| `lib/supabase/migration-mappers.ts` | 891 | Firestore -> Supabase row mappers | `map{User,Profile,DonationCampaign,Donation,GalleryAlbum,GalleryMedia,Testimonial,Aaradhane,VolunteerRequest,ChatSession,ChatMessage,UnknownQuestion,IntentDistribution,LatencyRecord,Seva,SevaBooking,DailyPooja,Event,SettingsDocument,AiKnowledge}`, `CONTENT_/AI_/CORE_FIELD_SPECS`, `toJsonSafe`, `isSiteSettingsDoc`, `AI_MAPPERS` | Pure. `mapSevaBooking` hardcodes the exclusion of doc `Ce6SDXl3HL9ReOgHZZis` (`:707-708`). Mappers take `data: any` (M11-F26). |
| `lib/supabase/migration-runner.ts` | 318 | Shared collection migrator | `migrateSupabaseCollection`, `reportMigrationOutcome`, `MigrationStats` | Batch 200, dry-run safe, field-coverage audit, destination count. Tested by `scripts/tests/migration-runner.test.ts`. |
| `lib/supabase/migration-inventory.ts` | 99 | Collection classification | `MIGRATION_INVENTORY`, `EXCLUDED_AUTH_COLLECTIONS`, `getBatchedMigratableCollections` | `MIGRATE`, `EXCLUDE_AUTH` (`users`, `sessions`), `EXCLUDE_SYSTEM` (`system`, `chatTraining`), the rest `REVIEW`. `messages` is `REVIEW` although `migrate:ai` migrates it. |
| `lib/supabase/migration-coverage.ts` | 279 | Schema-coverage analysis | `extractDeclaredTables`, `extractDeclaredColumns`, `extractRlsEnabledTables`, `buildStaticSchemaReport`, `diffTableCoverage`, `diffMigrationLedger` | Pure SQL-text parsing; consumed by `scripts/verify-supabase-migrations.ts` and `tests/unit/supabase-migration-coverage.test.ts`. |
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
| ~~`data/firestore-dump/README.md`~~ | - | **removed 2026-10 - see Refresh log** (deleted in 051c530, 2026-09-29) | Was the 2026-09-10 live inventory (27 collections, ~47k `page_views`, the 429 quota wall). The successor reports are repo-root markdown files (`FIRESTORE_PRODUCTION_EXPORT_REPORT.md`, `PRODUCTION_REVIEW_COLLECTIONS_INVENTORY.md`, unowned). |
| `data/firestore-dump/manifest.json` (lower-case) | - | Output of `scripts/dump-firestore-staged.ts:87`, input of `scripts/migrate-staged-phase1.ts` | git-ignored; distinct from the upper-case `MANIFEST.json` the live dumper writes. |
| `data/migration-manifest.json` | - | Checkpoint written by `scripts/migrate-all-batched.ts:240` | Not git-ignored; the workflow passes it between runs as an artifact. |
| `FIRESTORE_IMPORT.md` | 107 | Manual import runbook + the 2026/2027 aaradhane date tables | Says import to `aaradhanes`; the generator writes to `events`. |

### Seed data

| file | lines | role | notes |
|---|---|---|---|
| `seed/ai/*.json` (15 files: about-trust, accommodation, brindavana, contact, donation, dress-code, facilities, faq, history, parking, photography, raghavendra-swamy, temple-timings, visitor-guidelines, volunteer) | 15 each, `faq.json` 48 | Knowledge-base seed articles: `slug, title, category, language, keywords, summary, content, approved, version, lastReviewed, reviewedBy, tags` | Read by `scripts/seed-ai-knowledge.ts:15` (-> Supabase `ai_knowledge` since c586d6c; was `articles`) and `app/api/ai/knowledge/import/route.ts:61` (-> Firestore `knowledge`). |
| `seed/quotes-seed-data.json` | 884 | 33-entry **array**, written by `scripts/seed-quotes.ts:844` as a side effect of seeding | generated artefact checked in |
| `quotes-seed-data.json` (repo root) | 743 | Same quotes as an **object keyed by slug** (`raghavendra-stotra-1` ...) | Referenced by no code. Firestore-console import shape. Dead duplicate. |

### Migration scripts

| file | lines | role | dry run | idempotent |
|---|---|---|---|---|
| `scripts/migrate-core-to-supabase.ts` | 69 (was 348) | sevas, dailyPoojas, events - wrapper over `lib/supabase/migration-runner.ts` | yes | yes (`onConflict: firestore_id`) |
| `scripts/migrate-content-to-supabase.ts` | 82 (was 382) | users, profiles, donation_campaigns, donations, galleryAlbums, galleryMedia, testimonials, aaradhane, volunteer_requests - wrapper | yes | yes |
| `scripts/migrate-ai-to-supabase.ts` | 74 (was 292) | chat_sessions, messages->chat_messages, unknown_questions, ai_intent_distribution, ai_latency_records - wrapper | yes | yes |
| `scripts/migrate-ai-analytics.ts` | 78 | ai_latency_records, ai_intent_distribution, unknown_questions **+ ai_unknown_questions -> unknown_questions** | yes | yes, but see M11-F41 |
| `scripts/migrate-ai-knowledge.ts` | 83 | knowledge -> ai_knowledge | yes (only a live run exits 1 on a reconciliation gap, `:73`) | yes |
| `scripts/migrate-settings.ts` | 232 (was 117) | `settings/*` -> site_settings, social_links, **settings_documents** (lossless JSONB) | yes | yes; reconciliation miscounts write failures (M11-F42) |
| `scripts/migrate-seva-bookings-to-supabase.ts` | 275 | sevaBookings -> seva_bookings (own inline mapper, M11-F37) | yes | yes |
| `scripts/migrate-all-batched.ts` | 481 | every `MIGRATE` collection in inventory batches, checkpointed | yes | yes (checkpoint-resumable) |
| `scripts/migrate-staged-phase1.ts` | 472 | staged dump of settings + events -> 4 tables, hash-verified | yes (`--dry-run` / `--confirm-production` mandatory) | yes |
| `scripts/migrate-sevas.ts` | 252 | sevas only (+ post-migration count check at `:104`) | yes (failed dry run now exits 1) | yes |
| `scripts/migrate-daily-poojas.ts` | 251 | dailyPoojas only | yes (failed dry run now exits 1) | yes |
| `scripts/migrate-events-to-supabase-from-json.ts` | 41 | JSON file -> events | **no** | yes |

### Dump / convert / inspect scripts

| file | lines | role | notes |
|---|---|---|---|
| `scripts/dump-firestore-live.ts` | 406 (was 144) | REST v1 live dumper | 10x discovery retry and 10x per page (`:8`), global pacer (500 ms min gap, +500 ms per 429), token refresh on 401, 90 s timeout. Env-var credentials first, then `.firebase-adminsdk.json`. Exports `resolveCredentials`, `fetchCollectionListAll`, `globalPacer` for tests (`tests/unit/dump-firestore-live*.test.ts`). |
| `scripts/dump-firestore-staged.ts` | 102 | Admin-SDK dump of `settings`/`events` only | SHA-256 + doc count per file into `data/firestore-dump/manifest.json`. Raw `doc.data()` is JSON-stringified, so Timestamps serialise as `{_seconds,_nanoseconds}` (which `toIsoString` handles). |
| `scripts/check-collisions.ts` | 57 | `aaradhane` vs `aaradhanes` id overlap | Writes `collision-report.txt` into the cwd; exit 1 on collision, 2 on error. |
| `scripts/lib/target-connection.mjs` | 100 | Resolve a reachable Supavisor session-pooler URL by region | Used by `scripts/apply-ai-knowledge-migration.mjs` and `scripts/resolve-baseline-raya-ai.mjs` (unowned). TLS without certificate verification (M11-F43). |
| `scripts/lib/probe-pg-url.mjs` | 46 | `select 1` connectivity probe | `.github/workflows/prisma-baseline-drift-gate.yml:112`. |
| `scripts/lib/dump-ai-catalog.mjs` | 128 | Read-only catalog dump (columns, constraints, policies, migration history) | `.github/workflows/prisma-baseline-drift-gate.yml:131`; default table `ai_knowledge`. |
| `scripts/lib/check-baseline-drift-scope.mjs` | 175 | Scopes `prisma migrate diff` to the tables `prisma/schema.prisma` `@@map`s | Tested by `tests/unit/check-baseline-drift-scope.test.ts`. |
| `scripts/convert-firestore-export.ts` | 72 | NDJSON -> decoded JSON + MANIFEST | `--project/--export-dir/--dump-dir` flags. Fails the run if an `EXPECTED` collection is absent (`:65-67`). |
| `scripts/dump-firestore-configs.sh` | 25 | Legacy bash wrapper | Body is one `exec npm run --silent firestore:dump`. |
| `scripts/check-collections.ts` | 66 | Counts `aaradhane` vs `aaradhanes` vs `events` | Env-var credentials. |
| `scripts/check-firestore-sevas.ts` | 34 | Counts `sevas`, detects `RESOURCE_EXHAUSTED` | Uses `getAdminFirestore()`. |
| `scripts/check-about-us.ts` | 69 | Prints `settings/aboutUs` | **Hardcoded private key at `:5-32`.** |
| `scripts/check-trust-committee.ts` | 74 | Prints `settings/trustCommittee` | **Hardcoded private key at `:5-32`.** |
| `scripts/verify-supabase-sevas.ts` | 33 | Counts Supabase `sevas` | Expected count `10` is hardcoded ("From Image", `:16`). |

### Seed scripts

| file | lines | target | destructive? | idempotent? |
|---|---|---|---|---|
| `scripts/seed-ai-knowledge.ts` | 139 (was 181) | Supabase `ai_knowledge` (was Firestore `articles`) | overwrites on `slug`; `--overwrite` flag parsed but ignored (`:136-138`) | yes, but resets `created_at` and `approved=false` every run (M11-F35) |
| `scripts/seed-ai-settings.ts` | 535 | Firestore `ai_settings/main` (`:504`) | only with `--force`: exits 0 if the doc exists (`:507-511`), else `.set()` (`:518`) | yes. **Stale since 2026-10-06** for the bot (AI settings live in Supabase), but Firestore `ai_settings` is still read as the analytics on/off gate by `services/ai-analytics.service.ts:64`, and this doc's shape switches that gate off (M11-F45, M11-F46). |
| `scripts/seed-ai-settings-supabase.ts` | 40 | Supabase `ai_settings` row `main` | no (`ignoreDuplicates: true`, `:26`) | yes |
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
service named in the "representative call site" column. Where a collection has no type - `trust` (now unused),
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
| `trust` | - | **no** | no | *no code uses it since `lib/ai/firebaseChat.ts` was removed 2026-10-14 (2891323) - see Refresh log* | not documented |
| `testimonials` | R/W | yes `:167` (public create) | yes | `services/testimonial.service.ts:77` | not documented |
| `members` | R/W | yes `:174` | no | `services/volunteer.service.ts:42` | not documented |
| `volunteers` | R/W | yes `:180` | no | `services/volunteer.service.ts:87` | not documented |
| `volunteer_requests` | R/W | **no** | no | `services/chat.service.ts:217` | not documented |
| `notifications` | W | **no** | no | `services/testimonial.service.ts:361` | not documented |
| `feedback` | R/W | yes `:245` | no | `services/chat.service.ts:260` | not documented |
| `chat_sessions` | R (admin counters + analytics dashboard) | yes `:186` (public write) | yes (now unused) | `app/admin/page.tsx:107`, `app/admin/ai/page.tsx:96`, `app/admin/ai/analytics/page.tsx:333`, `services/ai-analytics.service.ts:623` (`COLLECTIONS.CHAT_SESSIONS`, behind `GET /api/ai/analytics`) - the chat itself moved to Supabase 2026-10-06 (224875d) | documented §11 |
| `chat_messages` (Firestore) | R (analytics dashboard count only) | **no** | yes (`sessionId`+`timestamp`, unused) | `services/ai-analytics.service.ts:635` (`COLLECTIONS.CHAT_MESSAGES`); no code in this tree or the 2026-09-19 snapshot writes a Firestore `chat_messages` collection (the old chat used `messages`), and with no rule the client-SDK count is denied - the dashboard's `totalMessages` is 0 | not documented |
| `messages` | - (migration source only) | yes `:237` | index declared on `chat_messages` instead | no app code since 224875d; read only by `scripts/migrate-ai-to-supabase.ts:42` | not documented |
| `chatTraining` | R/W | **no** | no | `app/admin/ai/training/page.tsx:125,149,221` (the reader in `lib/ai/firebaseChat.ts` was removed 2026-10-14) | not documented |
| `chat_metrics` | W | **no** | no | `services/analytics.service.ts:54` | not documented |
| `intent_metrics` | R/W | **no** | no | `services/analytics.service.ts:166` | not documented |
| `intent_feedback` | W | **no** | no | `services/analytics.service.ts:204` | not documented |
| `ai_settings` | R (analytics gate) | yes `:226` (**public write**) | no | The bot's AI settings live in Supabase `ai_settings` since fae5d51, **but** `services/ai-analytics.service.ts:64` (`getAnalyticsSettings`, `COLLECTIONS.AI_SETTINGS`) still reads the first Firestore `ai_settings` doc on every analytics write - M11-F46. Writer: `scripts/seed-ai-settings.ts:504` | not documented |
| `ai_token_usage` | R/W | yes `:201` | yes (timestamp) | `services/ai-analytics.service.ts:45,108,279` (`COLLECTIONS.TOKEN_USAGE`) - the only AI analytics stream still on Firestore | not documented |
| `ai_latency_records` | R (admin page only) | yes `:207` | yes | `app/admin/ai/analytics/page.tsx:315`; writes moved to Supabase (`services/ai-analytics.service.ts:134`) - M11-F36 | not documented |
| `ai_intent_distribution` | R (admin page only) | yes `:213` | yes | `app/admin/ai/analytics/page.tsx:307`; writes moved to Supabase (`services/ai-analytics.service.ts:170`) - M11-F36 | not documented |
| `unknown_questions` | R/W | yes `:219` | no | W: `services/analytics.service.ts:31` (called from `lib/ai/generator.ts:73`); R: `app/admin/ai/analytics/page.tsx:323,430`. `lib/ai/unknown-logger.ts` moved to Supabase 2026-10-13 | documented §14 |
| `ai_unknown_questions` | - | **no** | no | dead constant `services/ai-analytics.service.ts:48` (`COLLECTIONS.UNKNOWN_QUESTIONS`, unused since 2026-10-13); still a migration source in `scripts/migrate-ai-analytics.ts:59` | not documented |
| `page_views` | R/W | yes `:193` (public create) | no | `services/pageviews.service.ts:46` | not documented |
| `daily_page_stats` | R/W | **no** | no | `services/pageviews.service.ts:58` | not documented |
| `knowledge` | R/W | yes `:258` | yes (approved+category+title+`__name__`) | W: `app/api/ai/knowledge/import/route.ts:114`; R: `app/api/ai/knowledge/coverage/route.ts:81`, `app/admin/content/page.tsx:96,121`, `app/admin/featured/page.tsx:147`. The bot reads Supabase `ai_knowledge` (`lib/ai/knowledge/repository.ts:16`) - M11-F34 | documented §10 |
| `knowledge_articles`, `knowledge_categories` | - | yes `:263,:268` | no | *no code uses them* | not documented |
| `knowledge_workflow`, `knowledge_versions`, `knowledge_workflow_actions`, `knowledge_review_comments`, `knowledge_committee_approvals`, `knowledge_audit_log`, `knowledge_drafts` | R/W | **no** | **no** | `services/knowledge-workflow.service.ts:46-54` | not documented |
| ~~`articles`~~ | - | **no** | no | **no code since c586d6c (2026-10-06)** - `scripts/seed-ai-knowledge.ts` now writes Supabase `ai_knowledge` | not documented |
| `featuredContent` | R/W | **no** | no | `app/admin/featured/page.tsx:108` | not documented |
| `quotes` | R/W | yes `:274` | yes (2) | `services/quote.service.ts:288` | not documented |
| `temple_areas` | - | yes `:252` | no | Firestore path unused - the service reads Supabase | not documented |
| `test` | R | **no** | no | `app/admin/test/page.tsx:15` | debug leftover |
| `panchanga` | - | **no** | no | *documented at `docs/DATA-MODEL.md:708` but never queried* - data is in `data/panchanga/` | documented §13 |

### Supabase tables

| table | migration | columns (abridged) | RLS | app code that reads/writes it |
|---|---|---|---|---|
| `sevas` | 20260907112632 (+20260908120000) | id uuid PK, firestore_id uniq, name, description, category, amount numeric(10,2), duration int, image_url, active, display_order, created_at, updated_at | deny-all to `public` | R: `app/actions/sevas.ts:6,13` (service role); **mobile** `apps/mobile/lib/api.ts:5`, `apps/mobile/app/sevas/[id].tsx:23` (anon - denied, M11-F38). W: none - writes go to Firestore. |
| `daily_poojas` | 20260907112632 | + start_time, duration text, seva_amount, is_active, display_order, days text[], notes, created_by | deny-all | no web app code - only `scripts/migrate-daily-poojas.ts` / `migrate-core-to-supabase.ts`; **mobile** `apps/mobile/lib/api.ts:28` (anon - denied) |
| `events` | 20260907112632 (+20261011000000: description/location/status nullable) | + location, start_date/end_date timestamptz, start_time/end_time, featured, published, category, image_url, status | deny-all | R/W: `services/event.service.ts:46,58,90,114,123` via **anon** client; **mobile** `apps/mobile/lib/api.ts:17` (anon); W also `scripts/migrate-staged-phase1.ts:329` |
| `seva_bookings` | 20260920000000 (+20260921000000: `seva_id` -> text) | seva_id **text**, seva_title, seva_amount, user_id/name/email/phone, gotra, nakshatra, raashi, preferred_date, notes, status, payment_* | deny-all | **no app code**; populated by `scripts/migrate-seva-bookings-to-supabase.ts` and the batched migrator |
| `chat_sessions` | 20260930000000 | user_id, message_count, last_message, detected_language | deny-all | R/W: `services/chat.service.ts:8,29,48,77,107,145` via the **anon** browser client (since 224875d) - denied by RLS (M11-F04) |
| `chat_messages` | 20260930000000 | session_id text, role, content, timestamp, model, latency, detected_language | deny-all | R/W: `services/chat.service.ts` (anon, same as above) |
| `unknown_questions` | 20260930000000 | question, question_lower, detected_intent, confidence, language, timestamp, session_id, times_asked, status, assigned_to, reviewed_by/at, response, added_to_knowledge_article_id, notes | deny-all | R/W: `lib/ai/ai-settings/repository.ts:412-540`, `lib/ai/unknown-logger.ts:30,129,182`, `services/ai-analytics.service.ts:204-205,244-245` (service role on the server, anon in the browser) and `lib/ai/ai-settings/admin-repository.ts:309,364,374` (service role) |
| `ai_intent_distribution` | 20260930000000 | intent, category, language, confidence, timestamp, session_id, message_id | deny-all | W: `services/ai-analytics.service.ts:170`; R: `:372` (service role on the server) |
| `ai_latency_records` | 20260930000000 | total_latency, intent_detection_time, retrieval_time, generation_time, timestamp, success, error_type, model, session_id | deny-all | W: `services/ai-analytics.service.ts:134`; R: `:325` (service role on the server) |
| `users` | 20261001000000 | email, display_name, phone_number, photo_url, role, active | deny-all | **no app code** |
| `profiles` | 20261001000000 | uid, name, email, phone, profile_image, bio, gotra, nakshatra, preferences jsonb, favorites text[], recently_viewed text[], bookmarks jsonb | deny-all | **no app code** |
| `donation_campaigns` | 20261001000000 | title, description, image_url, suggested_amount, active, display_order | deny-all | **no app code** |
| `donations` | 20261001000000 (+20261002000000: `campaign_id` -> text) | donor_name, email, phone, address, amount, purpose, campaign_id **text**, message, payment_mode, status, receipt_number, admin_remarks, collected_by, collected_at | deny-all | **no app code** |
| `gallery_albums` | 20261001000000 | title, slug, description, cover_image, active, display_order | deny-all | no web app code; **mobile** `apps/mobile/lib/api.ts:39-40` (anon, embeds `gallery_media(*)`) |
| `gallery_media` | 20261001000000 (+20261002000000: `album_id` -> text) | album_id **text** (no FK), title, description, category, type, image_path, video_url, alt_text, is_featured, display_order, tags text[], uploaded_by/at | deny-all | no web app code |
| `testimonials` | 20261001000000 | name, location, quote, years, image, phone, approved, rejected, rejection_reason, submitted_by | deny-all | **no app code** |
| `aaradhanes` | 20261001000000 | title, guru_name, dates text[], description, significance, rituals text[], offerings text[], image_url, seva_details jsonb, is_upcoming, display_order, created_by | deny-all | **no app code** |
| `volunteer_requests` | 20261001000000 | volunteer_id, name, phone, sex, active, address | deny-all | **no app code** |
| `site_settings` | 20261010000000 | temple_name, contact_email, contact_phone, address, footer_text, welcome_message | **public SELECT**, writes denied | R: `services/settings.service.ts:43` (anon); W: `app/actions/settings.ts` server actions (service role, admin-checked) |
| `social_links` | 20261010000000 | facebook, instagram, youtube, whatsapp, twitter, linkedin, map_url + 7 `show_*` booleans | **public SELECT** (`:63`), write/update/delete denied (`:88,:94,:100`) | R: `services/settings.service.ts:83` (anon). **W: no app code at all** - only `scripts/migrate-settings.ts:176` and `scripts/migrate-staged-phase1.ts:327`. The admin UI writes Firestore `settings/socialLinks` instead (M11-F30). |
| `temple_areas` | 20240523000000 **or** 20240915 | name, name_kannada, description, significance, icon, image_url, category, features jsonb, best_time_to_visit, tips jsonb, has360_view, "order", firestore_id | **public SELECT** | R: `services/temple-areas.supabase.service.ts:15,38,62` |
| `settings_documents` | 20260922000000 | firestore_id uniq, document_key uniq, data jsonb, source_field_count, created_at, updated_at | deny-all | **no app code**; W: `scripts/migrate-settings.ts:140`, `scripts/migrate-staged-phase1.ts:328` |
| `ai_settings` | 20261012000000 (+ seed 20261012000001) | id text PK `main`, general, safety, extended_behavior, temple_information, visitor_information, temple_policies, ai_responses, ai_behavior, prompt, intents (all jsonb), created_at, updated_at, updated_by, version | deny-all | R/W: `lib/ai/ai-settings/repository.ts:43,106,146`, `lib/ai/ai-settings/admin-repository.ts:42,108,134`, `app/api/seed-ai-settings/route.ts` (service role) |
| `ai_knowledge` | 20261013000000 | id uuid, firestore_id uniq, slug uniq, title, kannada_title, category, keywords text[], content, kannada_content, language, last_reviewed, approved, created_at, updated_at | **public SELECT where approved** | R/W: `lib/ai/knowledge/repository.ts:16,70,124,236,277,300,336`; W: `scripts/seed-ai-knowledge.ts:95`, `scripts/migrate-ai-knowledge.ts` |
| `website_settings` | **none** | - | - | Read by **mobile** `apps/mobile/lib/api.ts:49` but created by no migration (M11-F38) |

### Other stores touched

- **Firebase Storage** - governed by `storage.rules`; `testimonials/**` is open read+write.
- **Local filesystem** - `data/panchanga/<year>/*.json` (730 files), `data/exports/*.json`,
  `seed/ai/*.json`, `public/data/panchanga/current.json` (`lib/ai/retrieval/panchanga.ts:42`).
- **Firestore dump artefacts** - `data/firestore-export/*.ndjson`, `data/firestore-dump/*.json`
  (git-ignored, `.gitignore:36-38`).

## Migration state per domain

(Re-derived 2026-10-18 from `grep -rn "\.from(" app services lib` and the Firestore collection scan.)

| domain | Firestore | Supabase table | state | evidence |
|---|---|---|---|---|
| Sevas | source of truth for writes | `sevas` (source of truth for reads; also read by mobile) | **split-brain** (unchanged) | `services/seva.service.ts:11` vs `:76` |
| Daily poojas | Firestore only for the web app | `daily_poojas` populated by migration; read only by mobile | **web: Firestore only; mobile: Supabase (RLS-denied)** | `services/pooja.service.ts:43`; `apps/mobile/lib/api.ts:28` |
| Events | still written by admin content/featured pages and the aaradhane generator | `events` read+written by `event.service`; Phase 1 staged migration loads it | **dual, diverging** | `services/event.service.ts:46` vs `app/admin/content/page.tsx:89`, `lib/aaradhane/firestore.ts:41` |
| Seva bookings | Firestore only for the app | `seva_bookings` exists and is loaded by `migrate:seva-bookings` | **Firestore live, Supabase copy** | `services/sevaBooking.service.ts:36`; no `.from('seva_bookings')` in `app/ services/ lib/` |
| AI settings | the bot no longer reads it, but `services/ai-analytics.service.ts:64` reads the first Firestore `ai_settings` doc as the analytics on/off gate (M11-F46) | `ai_settings` | **Supabase for the bot** since fae5d51 (2026-10-06); **Firestore still gates analytics** | `lib/ai/ai-settings/repository.ts:43`, `lib/ai/ai-settings/admin-repository.ts:42` vs `services/ai-analytics.service.ts:57-77` |
| AI knowledge | `knowledge` written by the import API, read by admin dashboards + coverage API | `ai_knowledge` read by the bot | **split-brain** (M11-F34) | `lib/ai/knowledge/repository.ts:16` vs `app/api/ai/knowledge/import/route.ts:114` |
| Unknown questions | `unknown_questions` still written by `services/analytics.service.ts:31` (via `lib/ai/generator.ts:73`) and read by the admin analytics page | `unknown_questions` written by `lib/ai/unknown-logger.ts`, read by the AI admin repositories | **both, by different callers** (M11-F08) | `lib/ai/unknown-logger.ts:30` vs `services/analytics.service.ts:31`; `app/admin/ai/analytics/page.tsx:323` |
| AI analytics (latency, intent) | read by the admin analytics page only | `ai_latency_records`, `ai_intent_distribution` written and read by `ai-analytics.service` | **Supabase write / admin page reads Firestore** - reversed from 2026-09 (M11-F36) | `services/ai-analytics.service.ts:134,170` vs `app/admin/ai/analytics/page.tsx:307,315` |
| AI token usage | Firestore | none | **Firestore only** | `services/ai-analytics.service.ts:108` |
| Chat sessions / messages | admin counters still count Firestore `chat_sessions` | `chat_sessions`, `chat_messages` | **Supabase (anon, RLS-denied) for the chat; Firestore for admin counts** | `services/chat.service.ts:8,29` vs `app/admin/page.tsx:107`, `app/admin/ai/page.tsx:96` |
| Content (users, profiles, donations, gallery, testimonials, aaradhane, volunteers) | Firestore only for the web app | 9 tables, loaded by `migrate:content` / batched migrator; `gallery_albums` read by mobile | **schema + data copy, no web readers** | no `.from(...)` for any of them in `app/ services/ lib/` |
| Site settings | `settings/*` legacy docs remain | `site_settings` | **Supabase only** (read `:43` anon, write via `app/actions/settings.ts` service role) | `services/settings.service.ts:43,70-76` |
| Social links | `settings/socialLinks` is what the admin UI edits | `social_links` is what the public site reads | **split-brain, same shape as sevas** (unchanged) | `app/admin/settings/social-links/page.tsx:32-33,89` vs `services/settings.service.ts:83` |
| Other `settings/*` docs (aboutUs, trustCommittee, facilities, futurePlans, footer, device, config, financeSettings) | Firestore - the app reads them here | `settings_documents` (JSONB copy, no reader) | **Firestore live, Supabase copy** | `app/(public)/about/page.tsx:112` etc.; `scripts/migrate-settings.ts:128-129` |
| Temple areas | rule exists but no code | `temple_areas` | **Supabase only** | `services/temple-areas.supabase.service.ts:6` |
| Panchanga | never in a DB | none | **static files** | `lib/aaradhane/panchanga.ts:65` |
| Quotes, receipts, bills, announcements, homepage, members | Firestore only | no table exists | **Firestore only** (`REVIEW` in `lib/supabase/migration-inventory.ts`) | `services/quote.service.ts:288` etc. |

**Migration timestamps.** On 2026-09-19 four files were dated in the future. Today (2026-10-18) no
file is future-dated, but four of the nine migration files added since were stamped *between* files that
already existed (`20260921000000`, `20260922000000` sort before `20260930000000`; `20261002000000`,
`20261006101759` sort before `20261010000000`); the other five (`20261011000000`..`20261015000000`)
were appended after it. Every stamp after 2026-09-19: `20260920000000`, `20260921000000`,
`20260922000000`, `20260930000000`, `20261001000000`, `20261002000000`, `20261006101759`,
`20261010000000`, `20261011000000`, `20261012000000`, `20261012000001`, `20261013000000`,
`20261015000000`. The two
"ledger marker" files (`20261006101759_seed_ai_settings.sql`, `20261015000000_baseline_raya_ai.sql`)
state that the remote `supabase_migrations.schema_migrations` already holds versions applied out of
band, so the repo tree is now being reconciled *to* the remote ledger rather than the other way
round. See M11-F13.

## Indexes vs the queries the code runs

Declared in `firestore.indexes.json` (22 entries). Firestore needs a composite index for any query
combining `where` on one field with `orderBy` on another.

**Declared and actually used**

| index | used by |
|---|---|
| `sevas` active + displayOrder | `lib/ai/retrieval/sevas.ts:124` |
| `events` published + startDate | `lib/ai/retrieval/events.ts:65` (the second user, `lib/ai/firebaseChat.ts`, was removed 2026-10-14) |
| `testimonials` approved + createdAt | `services/testimonial.service.ts:145`, `services/chat.service.ts:214-215,232-233` |
| ~~`chat_sessions` userId + updatedAt~~ | was `services/chat.service.ts:72`; **unused since the chat moved to Supabase (224875d, 2026-10-06)** |
| ~~`knowledge` approved + category + title (+ `__name__`, 2ec7d3a)~~ | was `lib/ai/knowledge/repository.ts:92`; **unused since the repository reads Supabase `ai_knowledge` (fdaff98)**. The remaining Firestore `knowledge` queries filter on `approved` only (`app/api/ai/knowledge/coverage/route.ts:82`, `app/api/ai/knowledge/import/route.ts:74`). |
| `quotes` active + priority, active + category + priority | `services/quote.service.ts` |

**Missing - queries that will throw `FAILED_PRECONDITION: The query requires an index`**

| collection | query | site |
|---|---|---|
| `sevaBookings` | `where userId ==` + `orderBy createdAt desc` | `services/sevaBooking.service.ts:55` (declared index is userId + **preferredDate**) |
| `announcements` | `where isActive ==` + `orderBy createdAt desc` | `services/announcement.service.ts:48`, `lib/ai/retrieval/announcements.ts:57`, `services/daily-spiritual.service.ts:387` (declared index is **`active`** + priority - wrong field name, `types/announcement.ts:6` says `isActive`) |
| ~~`messages`~~ | ~~`where sessionId ==` + `orderBy timestamp asc`~~ | **obsolete 2026-10-06** - `services/chat.service.ts` no longer queries Firestore `messages` |
| `testimonials` | `where submittedBy ==` + `where approved ==` + `orderBy createdAt desc` | `services/testimonial.service.ts:77` |
| `galleryMedia` | `where albumId ==` + `orderBy displayOrder`; `where isFeatured ==` + `orderBy displayOrder` | `services/gallery.service.ts:182,194`, `hooks/useGallery.ts:35` |
| `bills` | `where status ==` + `orderBy createdAt desc`; `where customerName ==` + `orderBy createdAt desc`; `where status in` + `where dueDate <` + `orderBy dueDate` | `services/billing.service.ts:108,119,131` |
| ~~`chatTraining`~~ | ~~`where active ==` + `orderBy priority`~~ | **obsolete 2026-10-14** - the query lived in the removed `lib/ai/firebaseChat.ts`; `app/admin/ai/training/page.tsx:125` reads the whole collection with no filter |
| `knowledge_versions` | `where articleId ==` + `orderBy version desc` | `services/knowledge-workflow.service.ts:87,122` |
| `knowledge_workflow_actions` | `where articleId ==` + `orderBy performedAt desc` | `services/knowledge-workflow.service.ts:317` |
| `knowledge_review_comments` | `where articleId ==` + `orderBy createdAt` | `services/knowledge-workflow.service.ts:378,547` |
| `knowledge_audit_log` | `where entityType ==` + `where entityId ==` + `orderBy performedAt desc` | `services/knowledge-workflow.service.ts:608` |
| `knowledge_workflow` | `where createdBy ==` + `orderBy updatedAt desc` | `services/knowledge-workflow.service.ts:1038` |

**Declared but unused / no-ops**: `users` role+createdAt and templeId+createdAt, `sevas`
category+displayOrder, `events` featured+startDate, `gallery` category+featured, `donations`
userId+collectedAt and status+collectedAt (`services/donation.service.ts:46` orders by `createdAt`
with no `where`), `chat_messages` sessionId+timestamp, since 2026-10 also `chat_sessions` userId+updatedAt and `knowledge` approved+category+title, and the four single-field
entries - the three `ai_*` timestamp indexes (`firestore.indexes.json:223-251`) and `announcements`
publishedAt (`firestore.indexes.json:172-180`) - Firestore indexes single fields
automatically, so these four entries do nothing.

Supabase indexes are declared inline in each migration; there is **no** index on
`chat_messages.session_id + timestamp` compound, `events.firestore_id` is covered by the UNIQUE
constraint, and `unknown_questions` is indexed only on `timestamp` although
`lib/ai/ai-settings/repository.ts:472-480` filters on `status`/`assigned_to`. `ai_knowledge` has single-column indexes on `category`, `approved`, `slug` (`20261013000000_create_ai_knowledge.sql:57-59`); `settings_documents` on `updated_at`; `donations.campaign_id` and `gallery_media.album_id` gained indexes in `20261002000000`.

## Cross-module dependencies

**This module is imported by** (from `.claude/state/inventory/import-graph.json`):

| my file | imported by | chunk |
|---|---|---|
| `lib/supabase/admin.ts` | `app/actions/sevas.ts`, `app/actions/settings.ts`, `app/api/seed-ai-settings/route.ts`, `app/api/supabase-check/route.ts`, `lib/ai/ai-settings/admin-repository.ts`, `lib/ai/ai-settings/repository.ts`, `lib/ai/knowledge/repository.ts`, `lib/ai/unknown-logger.ts`, `services/ai-analytics.service.ts`, `services/chat.service.ts` (imported, never called - M11-F40), `services/temple-areas.supabase.service.ts`; plus 15 scripts | M12, M08, M10, M05 |
| `lib/supabase/client.ts` | `lib/ai/ai-settings/repository.ts`, `lib/ai/knowledge/repository.ts`, `lib/ai/unknown-logger.ts`, `services/ai-analytics.service.ts`, `services/chat.service.ts`, `services/event.service.ts`, `services/settings.service.ts` | M08, M10 |
| `lib/supabase/server.ts` | `app/api/supabase-check/route.ts`, `services/temple-areas.supabase.service.ts` | M12, M10 |
| `data/calendar.ts` | `app/calendar/page.tsx`, `app/admin/calendar/ekadashi/page.tsx`, `app/admin/calendar/festivals/page.tsx`, `app/admin/settings/ekadashi-calendar/page.tsx`, `app/admin/settings/festival-calendar/page.tsx`, `components/calendar/CalendarCenter.tsx`, `components/calendar/EkadashiTable.tsx`, `components/calendar/FestivalTable.tsx`, `components/calendar/NextEkadashiCard.tsx`, `lib/festival-utils.ts` | M02, M05, M07, M14 |
| `data/shlokas.ts` | `app/(public)/shlokas/page.tsx`, `app/admin/shlokas/page.tsx`, `app/admin/settings/shlokas/page.tsx` | M03, M05 |
| `scripts/lib/firestore-values.ts` | `scripts/dump-firestore-live.ts`, `scripts/convert-firestore-export.ts` | M11 (internal) |
| `lib/supabase/migration-{helpers,mappers,runner,inventory}.ts` | the `scripts/migrate-*.ts` wrappers, `scripts/migrate-all-batched.ts`, `scripts/migrate-staged-phase1.ts`; tests `tests/unit/migration-*.test.ts`, `tests/unit/migrate-all-batched.test.ts` | M11 (internal), M15 (tests) |
| `lib/supabase/migration-coverage.ts` | `scripts/verify-supabase-migrations.ts` (unowned), `tests/unit/supabase-migration-coverage.test.ts` | unowned, M15 |
| `scripts/dump-firestore-live.ts` (`resolveCredentials`) | `scripts/dump-firestore-staged.ts:5` | M11 (internal) |
| `scripts/lib/target-connection.mjs` | `scripts/apply-ai-knowledge-migration.mjs`, `scripts/resolve-baseline-raya-ai.mjs` (both unowned) | unowned |
| Supabase schema (`supabase/migrations/*.sql`) | `apps/mobile/lib/api.ts`, `apps/mobile/app/sevas/[id].tsx` - direct table reads with the anon key | apps/mobile (unowned) |

**This module imports from**:

| target | from | chunk |
|---|---|---|
| `lib/admin-firebase.ts` (`getAdminFirestore`, `getAdminApp`) | `scripts/migrate-{core,content,ai}-to-supabase.ts`, `scripts/migrate-{sevas,daily-poojas,settings,ai-analytics,ai-knowledge,all-batched}.ts`, `scripts/migrate-seva-bookings-to-supabase.ts`, `scripts/dump-firestore-staged.ts`, `scripts/check-collisions.ts`, `scripts/check-firestore-sevas.ts`, `scripts/seed-receipt-sevas.ts` | M10 |
| `lib/firebase.ts` (`db`) | `scripts/seed-future-plans.ts`, `scripts/seed-guru-parampara.ts` | M10 |
| `types/*` | seeds, `data/calendar.ts`, `data/shlokas.ts` (the migration mappers no longer import `types/` - they emit untyped `Record<string, any>`) | M10 |
| `lib/ai/ai-settings/seed-data.ts` (`getDefaultSeedPayload`) | `scripts/seed-ai-settings-supabase.ts:4` | M08 |
| `lib/ai/knowledge/validation.ts` (`knowledgeArticleSchema`) | `scripts/seed-ai-knowledge.ts:16` (imported, unused) | M08 |
| `types/temple-explorer.ts` (`TEMPLE_AREAS`) | `scripts/seed-temple-areas.ts:5`, `scripts/seed-temple-areas-supabase.ts:7` | M10 |
| `types/aaradhane-generator.ts` | `scripts/seed-guru-parampara.ts:21` | M14 |
| `@supabase/ssr`, `@supabase/supabase-js`, `firebase-admin`, `google-auth-library`, `dotenv`, `pg`, `server-only` | node_modules | - |

The boundary rule that matters: **nothing in `app/` or `components/` should import a `scripts/`
file, and nothing outside `lib/supabase/` should call `createClient` from `@supabase/supabase-js`
directly.** `scripts/migrate-events-to-supabase-from-json.ts:1`,
`scripts/seed-temple-areas.ts:4`, `scripts/seed-temple-areas-supabase.ts:6` and (new 2026-10) `scripts/seed-ai-settings-supabase.ts:1,19` break the second
half of that rule (they build their own clients rather than using `lib/supabase/admin.ts`). Since 2026-10-14 that is
arguably the safer choice for a Node script, because `lib/supabase/admin.ts:1` imports `server-only` (M11-F40).

## How to change it

### Recipe 1 - Add a field to an existing collection/table (e.g. `sevas.sevaTypeCode`)

1. `types/seva.ts` - add the field to `Seva` and `SevaRequest`.
2. `services/seva.service.ts` - add it to the Supabase->domain mapper (around `:13`) and to the
   Firestore write payloads (`:76`, `:81`).
3. `supabase/migrations/<YYYYMMDDHHMMSS>_add_seva_type_code.sql` - new file, never edit an applied
   one: `ALTER TABLE sevas ADD COLUMN IF NOT EXISTS seva_type_code text;`
4. `lib/supabase/migration-mappers.ts` - add `seva_type_code` to `mapSeva` (`:685`) and the source
   field name to `CORE_FIELD_SPECS.sevas` (`:638`); decide whether it is required (`requireString`,
   which throws `ValidationError`) or optional (`optionalString`). Without the field-spec entry the
   runner reports it as an unmapped source field and the run fails. Add a fixture case to
   `tests/unit/migration-mappers.test.ts`. (`scripts/migrate-sevas.ts` still has its own inline
   `TargetSeva` at `:4` - update it too, or stop using it.)
5. `firestore.rules` - only if the field needs write validation (see the `receiptSevas` block at
   `:85` for the pattern).
6. `firestore.indexes.json` - only if a query will filter/sort on it.
7. Re-run `npx tsx scripts/migrate-core-to-supabase.ts --dry-run`, check the reconciliation block,
   then run it for real. If it dies at import with "This module cannot be imported from a Client
   Component module", that is M11-F40 (`lib/supabase/admin.ts:1`), not your change.

### Recipe 2 - Add a brand-new Firestore collection

1. Define the type in `types/<name>.ts`.
2. Write the service in `services/<name>.service.ts` with a `const COLLECTION = "<name>"` at the top
   (the convention every service follows, e.g. `services/pooja.service.ts:16`).
3. **`firestore.rules` - add a `match /<name>/{id}` block.** Without it every client-SDK read and
   write is denied; this is the single most common omission in this repo (see M11-F05).
4. `firestore.indexes.json` - add a composite index for every `where`+`orderBy` combination.
5. `scripts/dump-firestore-live.ts:205-216` **and** `scripts/convert-firestore-export.ts:14-25` - add
   the name to *both* `EXPECTED` arrays (they are duplicated verbatim), and classify it in
   `lib/supabase/migration-inventory.ts` (`MIGRATE` with a `destinationTable`, or `REVIEW`).
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
6. Add a pure mapper and a `FieldCoverageSpec` in `lib/supabase/migration-mappers.ts`, register it
   in the matching `scripts/migrate-*-to-supabase.ts` wrapper and in `getMapperFn()`
   (`scripts/migrate-all-batched.ts:104-134`), and mark the collection `MIGRATE` with its
   `destinationTable` in `lib/supabase/migration-inventory.ts`.
7. Add the table to `prisma/schema.prisma` only if it belongs to the Raya AI baseline; the drift gate
   (`.github/workflows/prisma-baseline-drift-gate.yml`) scopes itself to `@@map`ped tables.

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
3. Support `--dry-run` the way `scripts/migrate-core-to-supabase.ts:31` does (and require an explicit
   `--confirm-production` for live writes, as `scripts/migrate-staged-phase1.ts:28-40` does).
4. Register it in `package.json` `scripts` so it is discoverable - most existing seeds are not.

### Recipe 7 - Re-run the Firestore dump after a quota block

1. Free tier is ~50k reads/day and `page_views` alone is ~47k docs, so one full dump per day
   (AGENTS.md "Firestore dump" quirk; the `data/firestore-dump/README.md` that documented it was
   removed 2026-09-29).
2. Run `npm run firestore:dump` once and leave it; `scripts/dump-firestore-live.ts:280` retries
   discovery 10 times and `:102` each page 10 times, with exponential backoff up to 120 s, while the
   global pacer (`:64-68`) slows every later request after a 429. For a narrow, cheap dump use
   `npm run dump:staged -- settings events` instead.
3. Never run two instances in parallel.
4. Read `data/firestore-dump/MANIFEST.json` afterwards; anything with status `failed` or
   `unexpected` needs a look before you trust the dump.

## Faults, smells and risks

| id | severity | what | evidence (path:line) | suggested direction |
|---|---|---|---|---|
| M11-F01 | HIGH | **STILL OPEN (2026-10-18).** Sevas are **read from Supabase but written to Firestore**. Every admin create/update/delete is invisible to the public site until a migration script is re-run manually. | `services/seva.service.ts:11` (read via `getAllSevasAction`) vs `:76,:81,:86` (`addDoc`/`updateDoc`/`deleteDoc` on Firestore) | Pick one store for the seva domain and move reads+writes together; until then treat `scripts/migrate-sevas.ts` as a required post-edit step. |
| M11-F02 | HIGH | **STILL OPEN (2026-10-18).** A Firebase **service-account private key is hardcoded in nine source files** (verified by `grep -rln "BEGIN PRIVATE KEY" scripts/`), together with `project_id`, `private_key_id` and `client_email`. Anyone with the repo has full admin access to `sri-raghavendra-mutt`. `scripts/dump-firestore-live.ts` now also matches the grep, as a false positive (it normalises the PEM armour of an env-supplied key, `:241-242`). | `scripts/check-about-us.ts:5-32`, `scripts/check-trust-committee.ts:5-32`, `scripts/seed-poojas.ts:36-63`, `scripts/seed-sevas.ts:36-63`, `scripts/seed-trust-committee.ts:171-198`, `scripts/seed-poojas.js:89`, `scripts/seed-sevas.js:89`, `scripts/update-finance-settings.ts:5`, `scripts/update-finance-settings.js:48` | Revoke the key in the Firebase console **today**, strip it from all nine files (and from history), and switch them to `getAdminFirestore()` like `scripts/check-firestore-sevas.ts:1`. `scripts/import-events.ts:30` is a false positive - it only string-matches the BEGIN marker on a key read from `process.env`. |
| M11-F03 | HIGH | **STILL OPEN (2026-10-18).** `firestore.rules` declares `match /settings/{docId}` **twice**; the second block allows `write: if true`. Firestore rules are additive, so **anyone on the internet can overwrite every settings document** - About Us, Trust Committee, footer, finance settings, AI config. Since 2026-10-06 the bot no longer reads Firestore `ai_settings`, but `services/ai-analytics.service.ts:64` still does (as the analytics on/off gate), so anyone can switch AI analytics off by writing that collection (M11-F46). | `firestore.rules:136-139` (`allow write: if isAdmin()`) and `firestore.rules:231-234` (`allow write: if true`) | Delete the second block. Same issue for `ai_settings` at `:226-229` (`allow write: if true`). |
| M11-F04 | HIGH | **STILL OPEN (2026-10-18), scope changed.** Application code reads/writes Supabase tables whose only RLS policy is `FOR ALL TO public USING (false)` using the **anon** client. Those calls return zero rows / fail in production; the services swallow the error and return `[]`. Since 2026-10-06 the chat service joined the list (every `createChatSession`/message write from the widget is denied); the AI analytics and AI settings reads were moved to the service role on the server (`typeof window === "undefined" ? createAdminClient() : createClient()`), so they now fail only when called from the browser. | `services/event.service.ts:2,46` + `supabase/migrations/20260907112632_create_core_tables.sql:98-102`; `services/chat.service.ts:8,29,48,77,107,145` + `supabase/migrations/20260930000000_create_ai_tables.sql:92-96`; browser path of `services/ai-analytics.service.ts:133` and `lib/ai/ai-settings/repository.ts:35-37` | Either add a public SELECT (and, for chat, a scoped INSERT) policy, or route these through server actions / route handlers using `createAdminClient()`. Mobile hits the same wall - M11-F38. |
| M11-F05 | HIGH | **STILL OPEN (2026-10-18).** **23 collections the code uses have no `match` block** in `firestore.rules` (was 25: `articles`, `trust` and `ai_unknown_questions` dropped out of the code in 2026-10; `chat_messages` added by the 2026-10-18 verification), so every client-SDK read/write on them is denied by default: `dailyPoojas`, `poojas`, `profiles`, `bookmarks`, `donation_campaigns`, `volunteer_requests`, `guruParampara`, `featuredContent`, `chatTraining`, `chat_metrics`, `intent_metrics`, `intent_feedback`, `daily_page_stats`, `notifications`, `test`, `chat_messages` (`services/ai-analytics.service.ts:635`), and the seven `knowledge_*` workflow collections. | `services/pooja.service.ts:43` vs the 38 `match` blocks in `firestore.rules:34-277` (file unchanged since 2026-09-19); `services/knowledge-workflow.service.ts:46-54`; `app/admin/ai/training/page.tsx:125` | Audit every collection in the catalogue table above and add the missing rules, or move those reads to admin-SDK route handlers. |
| M11-F06 | HIGH | **STILL OPEN (2026-10-18).** `storage.rules` lets **any** signed-in user read and write **any** object in the bucket, and lets anonymous users write freely to `testimonials/`. | `storage.rules:5-8` (`match /testimonials/{allPaths}` - `allow read: if true; allow write: if true`) and `storage.rules:11-14` (`match /{allPaths}` - `allow read/write: if request.auth != null`) | Scope write rules per prefix and per role; require `isAdmin()` for everything except a size/content-type-limited upload path. |
| M11-F07 | HIGH | **STILL OPEN (2026-10-18).** Two conflicting `temple_areas` migrations create the same table with different primary-key types (`uuid` vs `text`) and different column sets. Both use `IF NOT EXISTS`, so the deployed schema depends on which ran first, and nothing in the repo records the answer. | `supabase/migrations/20240523000000_create_temple_areas.sql:1-16` vs `supabase/migrations/20240915_create_temple_areas.sql:1-18` | Delete one, and add a corrective migration that asserts the final shape. Note `scripts/seed-temple-areas-supabase.ts:48` writes a text `id`, implying the `20240915` shape is live. |
| M11-F08 | MEDIUM | **STILL OPEN (2026-10-18), reshaped.** The `ai_unknown_questions` name is dead (constant only), and `lib/ai/unknown-logger.ts` moved to Supabase (3d0d3b2/6a5a296) - but the generator still logs unknown questions to **Firestore** `unknown_questions` through `services/analytics.service.ts`, and the admin analytics page reads the Firestore copy, while the AI admin repositories read the Supabase copy. Two live stores under one name. | `lib/ai/generator.ts:73` -> `services/analytics.service.ts:31` (Firestore) vs `lib/ai/unknown-logger.ts:30` and `lib/ai/ai-settings/repository.ts:472` (Supabase); `app/admin/ai/analytics/page.tsx:323,430` (Firestore read) | Point `services/analytics.service.ts` `logUnknownQuestion` at `lib/ai/unknown-logger.ts`, and the admin page at `aiSettingsRepository`. |
| M11-F09 | MEDIUM | **FIXED (2026-10-18) by c586d6c** (2026-10-06): `scripts/seed-ai-knowledge.ts` now upserts into Supabase `ai_knowledge`, the table `lib/ai/knowledge/repository.ts:16` reads; nothing writes `articles` any more. *Was:* the knowledge seed wrote collection `articles` while the app read `knowledge`. Successor problems: M11-F34 (import route still writes Firestore `knowledge`) and M11-F35 (seed marks every row unapproved). | `scripts/seed-ai-knowledge.ts:94-106` vs `lib/ai/knowledge/repository.ts:16` | - |
| M11-F10 | MEDIUM | **STILL OPEN (2026-10-18).** `scripts/seed-poojas.ts` / `.js` **delete every document in `dailyPoojas`** before seeding, with no `--dry-run`, no confirmation prompt and a hardcoded production credential. One accidental run wipes the live pooja schedule. | `scripts/seed-poojas.ts:85-90`, `scripts/seed-poojas.js:112` | Add a `--force` gate (as `scripts/seed-quotes.ts:793` has) and remove the embedded key. |
| M11-F11 | MEDIUM | **STILL OPEN (2026-10-18).** `scripts/seed-sevas.ts` calls `.add()` unconditionally, so every re-run duplicates the whole seva catalogue. | `scripts/seed-sevas.ts:86-88` reads the existing count, then `:92-98` loops and `:93` `.add()`s anyway | Adopt the per-name existence check from `scripts/seed-receipt-sevas.ts:97`. |
| M11-F12 | MEDIUM | **STILL OPEN (2026-10-18), MOVED.** Composite indexes the code needs are absent, and declared ones target the wrong field or a collection nothing queries (`announcements.active` vs the real `isActive`; `chat_messages`). The only index change since 2026-09-19 is `__name__` appended to the `knowledge` index (2ec7d3a), which became unused when knowledge moved to Supabase. The `messages` gap is moot (chat left Firestore). These queries fail at runtime with `FAILED_PRECONDITION`. | `firestore.indexes.json:158-181,210-221` vs `services/announcement.service.ts:48`, `services/billing.service.ts:108,119,131`, `services/gallery.service.ts:182,194`, `services/sevaBooking.service.ts:55`, `services/testimonial.service.ts:77`, `services/knowledge-workflow.service.ts:87,317,378,608,1038` | Regenerate the index file from the query inventory in this document; drop the `chat_sessions`, `chat_messages` and `knowledge` entries. |
| M11-F13 | MEDIUM | **STILL OPEN (2026-10-18), reframed.** No migration file is future-dated any more, but the ordering hazard this row predicted happened: four of the nine migration files added since 2026-09-19 sort *between* already-existing ones (`20260921000000`, `20260922000000`, `20261002000000`, `20261006101759`), and two added files (`20261006101759`, interleaved, and `20261015000000`, appended) are empty "ledger markers" added only because the remote `schema_migrations` already held versions applied out of band (c156d6c). `supabase db push` (the `supabase:migrations:push` script) is not passed `--include-all`, so on a database that has already applied a later version the inserted files need manual handling. | `supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql`, `supabase/migrations/20260922000000_create_settings_documents.sql`, `supabase/migrations/20261002000000_align_content_firestore_ids.sql`, `supabase/migrations/20261006101759_seed_ai_settings.sql:3-7`, `supabase/migrations/20261015000000_baseline_raya_ai.sql:3-9`; `package.json` `supabase:migrations:push` | Only append with stamps later than the newest applied version, and record each out-of-band apply in the repo the same day. |
| M11-F14 | MEDIUM | **STILL OPEN (2026-10-18).** `scripts/setup-admin.ts` guards against an un-edited config by comparing to `'your-firebase-auth-uid'`, but the placeholder actually shipped is `'YOUR_UID_FROM_FIREBASE'`. The guard never fires, so the script happily writes a `super_admin` document with id `YOUR_UID_FROM_FIREBASE`. | `scripts/setup-admin.ts:34` vs `:43` | Compare against the real placeholder, or read the uid from `process.argv`. |
| M11-F15 | MEDIUM | **STILL OPEN (2026-10-18).** `scripts/seed-temple-areas.ts` spreads camelCase object keys (`nameKannada`, `bestTimeToVisit`, `has360View`, `imageUrl`) straight into the snake_case `temple_areas` table; it will fail on every row. It is a near-duplicate of the working `scripts/seed-temple-areas-supabase.ts`. | `scripts/seed-temple-areas.ts:36-40` vs `scripts/seed-temple-areas-supabase.ts:45-55` | Delete `scripts/seed-temple-areas.ts`. |
| M11-F16 | MEDIUM | **STILL OPEN (2026-10-18).** `GET /api/supabase-check` is unauthenticated and reports which Supabase env vars are configured, including whether a service-role key is present. Its success message ("No tables queried as schema is not created yet") is also three migrations out of date. `envStatus` is returned in **both** the failure (`:17`) and success (`:44`) branches. | `app/api/supabase-check/route.ts:5` (`export async function GET()`, no auth), `:7-9` (`hasUrl/hasAnonKey/hasServiceRoleKey`), `:43` (stale message) | Gate behind `isAdmin`, or delete - it no longer tells the truth. |
| M11-F17 | MEDIUM | **STILL OPEN (2026-10-18).** `lib/supabase/client.ts` falls back to `https://placeholder.supabase.co` / `"placeholder"` when env vars are absent, so a misconfigured deployment produces empty pages instead of a startup failure. The new mobile client repeats the pattern (`apps/mobile/lib/supabase.ts:5-6` fall back to `''`). | `lib/supabase/client.ts:4-5` | Throw, as `lib/supabase/admin.ts:4` does. |
| M11-F18 | MEDIUM | **STILL OPEN (2026-10-18).** `docs/DATA-MODEL.md` is materially wrong about the shipped schema: it documents a `panchanga` Firestore collection that does not exist (data is in `data/panchanga/`), gives `sevaBookings` `devoteeName`/`devoteeEmail`/`devoteePhone`/`statusHistory`/`bookedBy` fields that `types/seva-booking.ts` does not have, names `donationCampaigns` where the code uses `donation_campaigns`, and describes 14 collections when the code touches 50+. It also claims "Firestore - Primary database for all application data" with no mention of Supabase. | `docs/DATA-MODEL.md:20,130-134,708-742` vs `types/seva-booking.ts:9-31`, `lib/aaradhane/panchanga.ts:65`, `services/donationCampaign.service.ts:68` | Regenerate the collection catalogue from code; add a Supabase section. |
| M11-F19 | MEDIUM | **STILL OPEN (2026-10-18).** Every data-consuming component in this chunk's trees is a client component, so Firestore/Supabase queries run in the browser. This violates AGENTS.md ("Server Components First", "No Direct Firebase Calls - use services only"). | `components/home/SevaBooking.tsx:1`, `app/(public)/events/[id]/page.tsx:1`, `app/(public)/about/page.tsx:1`, `app/(public)/trust/page.tsx:1`, `app/admin/content/page.tsx:89-99` (direct `collection(db, ...)` in a page) | Move reads into Server Components or route handlers; this is also the precondition for a React Native client (see Portability). |
| M11-F20 | LOW | **STILL OPEN (2026-10-18).** Eight files in `data/` are **empty** (`announcements.ts`, `bookings.ts`, `donations.ts`, `events.ts`, `gallery.ts`, `poojas.ts`, `sevas.ts`, `timings.ts`), and `data/galleryCategories.ts` is imported by nothing. | inventory line counts (2 lines each); `grep -rn galleryCategories` returns only its own definition | Delete. |
| M11-F21 | LOW | **STILL OPEN (2026-10-18).** `quotes-seed-data.json` at the repo root (743 lines) duplicates `seed/quotes-seed-data.json` (884 lines) in a different shape and is referenced by no code. | `scripts/seed-quotes.ts:844` writes only the `seed/` copy | Delete the root file. |
| M11-F22 | LOW | **STILL OPEN (2026-10-18), MOVED.** The `EXPECTED` collection list is duplicated verbatim in two files; they will drift. `lib/supabase/migration-inventory.ts` is now a third, differently-shaped list of the same names. | `scripts/dump-firestore-live.ts:205-216` and `scripts/convert-firestore-export.ts:14-25`; `lib/supabase/migration-inventory.ts:13-87` | Derive both `EXPECTED` arrays from `MIGRATION_INVENTORY`. |
| M11-F23 | LOW | **STILL OPEN (2026-10-18).** `scripts/dump-firestore-configs.sh` is a 25-line file whose only executable statement is `exec npm run --silent firestore:dump`, yet it is still wired to `npm run firestore:dump:cli`. `package.json` also has both `firestore:convert` and `firestore:dump:convert` pointing at the same script. | `scripts/dump-firestore-configs.sh:25`, `package.json` scripts block | Delete the wrapper and one of the duplicate npm scripts. |
| M11-F24 | LOW | **STILL OPEN (2026-10-18).** `scripts/migrate-events-to-supabase-from-json.ts` has no `--dry-run`, no validation and no reconciliation report, unlike every other migration script. It writes 38 rows straight to production. | `scripts/migrate-events-to-supabase-from-json.ts:26-35` | Fold it into `scripts/migrate-core-to-supabase.ts` as a JSON source, or add the same guards. |
| M11-F25 | LOW | **STILL OPEN (2026-10-18).** `supabase/migrations/20260908120000_create_sevas_table.sql` re-creates a table the previous migration already created, wrapped in a `pg_tables` check - so in any normal run it is a 53-line no-op. The `20260920000000` file's header comment ("Add gotra, nakshatra, and raashi columns") contradicts its body (creates the table). | `supabase/migrations/20260908120000_create_sevas_table.sql:4`, `supabase/migrations/20260920000000_create_seva_bookings.sql:1` vs `:6` | Remove the dead migration; fix the misleading comment. |
| M11-F26 | LOW | **STILL OPEN (2026-10-18), MOVED.** Migration code and the diagnostic route use `any` and `catch (error: any)`, against AGENTS.md's "no `any`". The `any`s left the wrapper scripts and now live in the shared library. | `lib/supabase/migration-runner.ts:53-57` (`db: any, supabase: any, mapFn: (id, data: any) => T`), `:100` (`catch (err: any)`), `:131`; `lib/supabase/migration-mappers.ts:219` (and every other `map*(id, data: any): Record<string, any>`); `scripts/migrate-core-to-supabase.ts:37,62`; `app/api/supabase-check/route.ts:48`; `services/event.service.ts:21` | Type mappers against per-table row interfaces and use `unknown` in catches. Scripts are excluded from `tsconfig.json`, so `npm run type-check` never sees these. |
| M11-F27 | LOW | **STILL OPEN (2026-10-18).** `FIRESTORE_IMPORT.md` tells the operator to import aaradhane events into the `aaradhanes` collection, but every generator and service writes them to `events`. It also instructs saving a service-account key as `firebase-admin.json` in the project root - a filename **not** covered by `.gitignore` (which only ignores `.firebase-adminsdk.json`). | `FIRESTORE_IMPORT.md:31,62` vs `lib/aaradhane/firestore.ts:28`, `.gitignore:41` | Correct the collection name and add `firebase-admin.json`, `service-account.json` to `.gitignore`. |
| M11-F28 | LOW | **STILL OPEN (2026-10-18).** `data/calendar.ts` hardcodes ekadashi and festival dates that run out on 2027-04-02; ten files depend on it with no fallback. | `data/calendar.ts:26,53` | Generate from `data/panchanga/` or move into Firestore/Supabase. |
| M11-F29 | LOW | **STILL OPEN (2026-10-18).** `scripts/verify-supabase-sevas.ts` hardcodes the expected source count as `10 (From Image)`. | `scripts/verify-supabase-sevas.ts:16` | Take the expected count as an argument or read it from Firestore. |
| M11-F30 | HIGH | **STILL OPEN (2026-10-18), MOVED.** **Social links are a second split-brain domain.** The admin editor saves to the Firestore document `settings/socialLinks`; every public consumer reads the Supabase table `social_links`. No app code path writes `social_links`, so an admin's edit to the footer/social icons is never visible on the site. Worse, `settings/socialLinks` is covered by the duplicated `match /settings` rule, so it is world-writable (M11-F03). | `app/admin/settings/social-links/page.tsx:32-33` (`COLLECTION = "settings"`, `DOCUMENT = "socialLinks"`), `:89` (`setDoc`) vs `services/settings.service.ts:83` (`.from("social_links")`); the only writers of the table are `scripts/migrate-settings.ts:68-91,176` and `scripts/migrate-staged-phase1.ts:327` | Point the admin page at `settingsService`, add an `updateSocialLinksAction()` in `app/actions/settings.ts` (mirror `updateSettingsAction`, admin-checked, service role), and retire `settings/socialLinks`. |
| M11-F31 | LOW | **STILL OPEN (2026-10-18), MOVED.** `services/settings.service.ts` has read-only coverage of `social_links` and a `defaultSocialLinks` constant it silently falls back to on any error, so a missing/denied row is indistinguishable from "the temple has no social accounts". | `services/settings.service.ts:21` (`defaultSocialLinks`), `:93,:96` (return the default on error and on empty) | Surface the error, or at minimum log-and-flag rather than returning a plausible-looking default. |
| M11-F32 | MEDIUM | **STILL OPEN (2026-10-18).** `scripts/update-finance-settings.js` is a **committed `tsc` ES5 build artefact** of `scripts/update-finance-settings.ts` - same job, same hardcoded key, same UPI id and the same three special sevas, 133 lines of `__awaiter`/`__generator` boilerplate wrapping 90 lines of logic. Neither file is referenced by `package.json`, so the operator picks one by hand and the two will drift the moment the `.ts` is edited without recompiling. The `.js` is also the harder copy to review, which is where the key is easiest to miss. | `scripts/update-finance-settings.js:1-41` (the downlevel helpers) and `:48` (the key) versus `scripts/update-finance-settings.ts:5`; identical payloads at `.js:66-111` and `.ts:55-100`; `grep -n "update-finance-settings" package.json` returns nothing | Delete the `.js`, add `scripts/*.js` build output to `.gitignore`, and run the `.ts` through `tsx` like every other script. Do this in the same change that revokes the key (M11-F02), not after. |
| M11-F33 | LOW | **STILL OPEN (2026-10-18).** `scripts/import-events.ts` `add()`s every row of `data/exports/aaradhane-events-<year>.json` with no de-duplication and no `eventKey` check, although the generator already puts a stable `eventKey` on each event. Running it twice doubles the public calendar, and nothing in the script or in `FIRESTORE_IMPORT.md` warns of it. | `scripts/import-events.ts:64` (`db.collection("events").add`) versus the `eventKey` written at `scripts/export-events.ts:59`; `lib/aaradhane/firestore.ts` is the upsert path the script bypasses | Look the `eventKey` up and `set()` on the existing doc, or reuse `lib/aaradhane/firestore.ts`. |
| M11-F34 | MEDIUM | **NEW (2026-10-18).** **Knowledge is a third split-brain domain.** Since fdaff98 (2026-10-06) the bot reads Supabase `ai_knowledge`, but the admin "import seed knowledge" API still writes Firestore `knowledge`, the coverage API and the admin content/featured dashboards still read Firestore `knowledge`. An article imported through the admin path never reaches Raya AI until someone re-runs `scripts/migrate-ai-knowledge.ts`; the dashboards count articles the bot cannot see. | `lib/ai/knowledge/repository.ts:16,70` (Supabase) vs `app/api/ai/knowledge/import/route.ts:73,114`, `app/api/ai/knowledge/coverage/route.ts:81`, `app/admin/content/page.tsx:96,121`, `app/admin/featured/page.tsx:147` (Firestore) | Move the import and coverage routes onto `lib/ai/knowledge/repository.ts`, then retire the Firestore `knowledge` collection, rule and index. |
| M11-F35 | MEDIUM | **NEW (2026-10-18).** `npm run seed:ai` writes every article as **unapproved**: it sets `approved: article.published ?? false`, but the seed files carry `approved: true` and no `published` key, and `ai_knowledge`'s only public policy is `SELECT ... USING (approved = true)`. It also takes `keywords` from the file's `tags` (dropping the curated `keywords`), derives `slug` from `category` (ignoring the file's `slug`), resets `created_at` on every run, ignores its own `--overwrite` flag, and imports `knowledgeArticleSchema` without using it. | `scripts/seed-ai-knowledge.ts:92` (slug), `:100` (keywords), `:103` (approved), `:104` (created_at), `:136-138` (`overwrite` parsed, never read), `:16` (unused import); `seed/ai/parking.json` (`"approved": true`, `"slug": "parking-information"`); `supabase/migrations/20261013000000_create_ai_knowledge.sql:30-34` | Map `approved`, `keywords` and `slug` from the file, validate with `knowledgeArticleSchema`, and only set `created_at` on insert. |
| M11-F36 | MEDIUM | **NEW (2026-10-18).** The admin AI analytics dashboard and the admin home counters still read **Firestore** `ai_intent_distribution`, `ai_latency_records`, `unknown_questions` and `chat_sessions`, but the writers moved to Supabase in 2026-10 (224875d, 3d0d3b2..556a704). The dashboard now shows frozen pre-migration numbers. This reverses the 2026-09 split ("Firestore write / Supabase read") rather than closing it. | `app/admin/ai/analytics/page.tsx:307,315,323,333,430`, `app/admin/ai/page.tsx:96`, `app/admin/page.tsx:107`, and the service's own dashboard `services/ai-analytics.service.ts:621-640` (`GET /api/ai/analytics` counts Firestore `chat_sessions` / `chat_messages`) vs `services/ai-analytics.service.ts:134,170,204`, `services/chat.service.ts:8` | Read through `services/ai-analytics.service.ts` (`:325`, `:372`) and the AI repositories from a server route, as the rest of BOT-004 does. |
| M11-F37 | MEDIUM | **NEW (2026-10-18).** Two different seva-booking mappers disagree. `scripts/migrate-seva-bookings-to-supabase.ts` requires `notes` and defaults missing payment fields to `""` / `"pending"`; `mapSevaBooking` (used by the batched migrator) defaults `notes` to `""` and **throws** on missing *or blank* `paymentReference`/`paymentStatus`/`paymentDate`/`paymentMethod` (`requireString` rejects `""`, `lib/supabase/migration-mappers.ts:22-27`). The booking service writes exactly those blanks on every new booking (`services/sevaBooking.service.ts:36`), so every unpaid booking fails validation in the batched path while the standalone script migrates it. `mapSevaBooking` also hardcodes the exclusion of one production document id. | `scripts/migrate-seva-bookings-to-supabase.ts:89,109-112` vs `lib/supabase/migration-mappers.ts:705-734` (`:707-708` hardcoded id `Ce6SDXl3HL9ReOgHZZis`, `:726-729` required payment fields) | Make the script call `mapSevaBooking`; replace the hardcoded id with a data-driven exclusion list. |
| M11-F38 | HIGH | **NEW (2026-10-18).** `apps/mobile` reads the Supabase schema **directly with the anon key**, against tables that deny all public access (`sevas`, `events`, `daily_poojas`, `gallery_albums`), embeds `gallery_media(*)` although `gallery_media.album_id` has no foreign key (PostgREST cannot resolve the embed), and reads a `website_settings` table that no migration creates. Every mobile list screen gets an error or zero rows; the mobile seva list also reads Supabase while admin seva edits go to Firestore (M11-F01). | `apps/mobile/lib/api.ts:5,17,28,39-40,49`, `apps/mobile/app/sevas/[id].tsx:23`, `apps/mobile/lib/supabase.ts:8` vs `supabase/migrations/20260907112632_create_core_tables.sql:86-102`, `supabase/migrations/20261001000000_create_content_tables.sql:133` | Give mobile an HTTP API (or public SELECT policies scoped to published rows), add the FK or drop the embed, and create or stop reading `website_settings`. |
| M11-F39 | LOW | **NEW (2026-10-18).** The migration inventory is inconsistent with the scripts that use it: `knowledge` is `MIGRATE` without a `destinationTable`, so `migrate-all-batched` skips it with only a console warning and never records it in the manifest (a batched run can report SUCCESS with knowledge unmigrated); `messages` is `REVIEW` although `migrate:ai` migrates it to `chat_messages`; likewise `users` is `EXCLUDE_AUTH` and `profiles`, `donations`, `donation_campaigns` are `REVIEW`, yet `migrate:content` migrates all four (and the live dumper excludes `users`/`profiles`). | `lib/supabase/migration-inventory.ts:77` (`knowledge`), `:36` (`messages`), `:11,:41,:43,:45`; `scripts/migrate-all-batched.ts:298-301`; `scripts/migrate-ai-to-supabase.ts:42`; `scripts/migrate-content-to-supabase.ts:45-48` | Give `knowledge` `destinationTable: "ai_knowledge"` and a `getMapperFn` entry; reclassify `messages`. |
| M11-F40 | HIGH | **NEW (2026-10-18), PLAUSIBLE - not executed (RULES forbid `npm`).** `lib/supabase/admin.ts:1` imports `server-only` (7d7bd51, 2026-10-14). That package's default export throws unless the bundler resolves the `react-server` condition, so (a) the **15 Node scripts** that import `createAdminClient` - every `migrate:*`, `seed:ai`, `seed:supabase-sevas`, `verify:supabase-migrations` - should fail at import under plain `tsx`/`ts-node`, and no workflow sets `--conditions=react-server`; (b) `lib/supabase/admin.ts` reaches **14 `"use client"` modules** through two static import paths (import-graph scan, 2026-10-18 verification): `services/chat.service.ts:3` (imported, never called) from `app/admin/ai/page.tsx`, `app/admin/ai/{testimonials,volunteers}/page.tsx` and `components/ai/AIChatProvider.tsx` (hence the public chat widget); and `services/knowledge.service.ts:6-12` -> `lib/ai/knowledge/repository.ts:5` (used, behind `typeof window`) from the public `app/(public)/favorites/page.tsx`, `components/common/PersonalizedHomepage.tsx` and `components/search/GlobalSearch.tsx` (via `services/search.service.ts:13`). Either path pulls `server-only` into a client bundle and should fail `next build`. The guard was added and removed twice on 2026-10-14 (d87bfd1, 0ba7b0e), which suggests exactly this breakage. Unit tests mock `server-only`, so CI tests stay green; `scripts/test-boundary.sh` (run by `.github/workflows/ci.yml:44`) *expects* `next build` to fail with a server-only error, so it passes whether or not the real app is already broken, and only the following `npm run build` step (`ci.yml:47`) would show it. | `lib/supabase/admin.ts:1`; `scripts/migrate-core-to-supabase.ts:17` (and 14 more, see Cross-module dependencies); `services/chat.service.ts:3`; `app/admin/ai/page.tsx:1,21`; `lib/ai/knowledge/repository.ts:5,62`; `services/knowledge.service.ts:6-12`; `scripts/test-boundary.sh:12-35`; `tests/unit/migrate-all-batched.test.ts` (mocks it) | Split a script-safe `lib/supabase/admin-node.ts` (proposed, does not exist; no `server-only`) for `scripts/`, keep `server-only` for the app, delete the unused import in `services/chat.service.ts`, **and** stop `lib/ai/knowledge/repository.ts` being imported by client code (serve the Knowledge Centre through a route handler or server action) - deleting the chat import alone does not fix the build. Verify with `npx tsx scripts/migrate-core-to-supabase.ts --dry-run` and `npm run build`. |
| M11-F41 | LOW | **NEW (2026-10-18).** `scripts/migrate-ai-analytics.ts` migrates both `unknown_questions` and `ai_unknown_questions` into the one `unknown_questions` table keyed on `firestore_id`. A document id present in both collections silently overwrites (second run wins) and is counted as an update, so reconciliation passes while a row is lost. It also prints a literal `\n` (`"\\n"`). | `scripts/migrate-ai-analytics.ts:46-64`, `:68` | Prefix the id by source collection, or run a collision check first (pattern: `scripts/check-collisions.ts`). |
| M11-F42 | LOW | **NEW (2026-10-18).** `scripts/migrate-settings.ts` reports `inserts` as *all* mapped rows and then adds `writeFailures` on top, so any write failure makes reconciliation FAIL with a negative "unaccounted" count instead of naming the failure; it also omits the required `excludedMalformed` field, which only compiles because `scripts/**` is excluded from `tsconfig.json`. | `scripts/migrate-settings.ts:192-198` vs `lib/supabase/migration-helpers.ts:81,101-103`; `tsconfig.json` `exclude` | Count successful upserts only, and pass `excludedMalformed: 0`. |
| M11-F43 | LOW | **NEW (2026-10-18).** The Postgres CI tooling connects to the production database with TLS **certificate verification disabled** and the database password in the URL; a man-in-the-middle on the runner's path would receive the credential. | `scripts/lib/target-connection.mjs:30`, `scripts/lib/probe-pg-url.mjs:24`, `scripts/lib/dump-ai-catalog.mjs:22` (`ssl: { rejectUnauthorized: false }`) | Pin the Supabase CA (`ssl: { ca }`) instead of disabling verification. |
| M11-F44 | LOW | **NEW (2026-10-18).** Documentation drift around the dumper: AGENTS.md still says the live dumper "retries 48x discovery + 5x/collection", but the code retries 10x for both; `.gitignore` still whitelists the deleted `data/firestore-dump/README.md`; `data/migration-manifest.json` and `collision-report.txt` are written into the working tree and are not ignored. | `AGENTS.md:450` vs `scripts/dump-firestore-live.ts:8,280`; `.gitignore:38`; `scripts/migrate-all-batched.ts:240`, `scripts/check-collisions.ts:43` | Update AGENTS.md, drop the stale `.gitignore` line, ignore the two generated files. |
| M11-F45 | LOW | **NEW (2026-10-18), corrected by verification.** `scripts/seed-ai-settings.ts` still writes Firestore `ai_settings/main` (only when absent, or with `--force`), which the bot has not read since the AI settings moved to Supabase (fae5d51); running it looks like a successful seed and changes nothing the bot uses. It is *not* inert, though: Firestore `ai_settings` is still read by the analytics gate, and this document's shape switches analytics off (M11-F46). The live seeds are `scripts/seed-ai-settings-supabase.ts` and `supabase/migrations/20261012000001_seed_ai_settings.sql`. | `scripts/seed-ai-settings.ts:504,507-511,518` vs `lib/ai/ai-settings/repository.ts:43`; `services/ai-analytics.service.ts:64` | Delete it (and the world-writable `ai_settings` rule, M11-F03) after fixing M11-F46. |
| M11-F46 | MEDIUM | **NEW (2026-10-18 verification), PLAUSIBLE at runtime - depends on what the live Firestore `ai_settings` collection holds.** Every AI analytics recorder first calls `getAnalyticsSettings()`, which reads the **first document of the Firestore `ai_settings` collection** and casts it to `AIAnalyticsSettings` (`enabled`, `trackLatency`, ..., `alertThresholds`). The only document anything writes there is `ai_settings/main` from `scripts/seed-ai-settings.ts`, which has a different shape (`general`, `safety`, `intents`, ... - no top-level `enabled`). If that doc exists, `!settings.enabled` is true and every latency / intent / unknown-question / token record is silently skipped, and `checkAIHealth` dereferences `settings.alertThresholds.maxLatency` of `undefined` (caught). The collection is world-writable (`firestore.rules:226-229`), so anyone can also switch analytics off deliberately. This is a Firestore read the 2026-10-18 refresh recorded as gone. | `services/ai-analytics.service.ts:49,57-77` (read), `:101,127,163,197` (gates in `recordTokenUsage`/`recordLatency`/`recordIntentDistribution`/`recordUnknownQuestion`), `:483-488` (`checkAIHealth`); `scripts/seed-ai-settings.ts:504`; `firestore.rules:226-229` | Read the analytics switches from Supabase `ai_settings` (via `aiSettingsRepository`) or from config, with explicit defaults; then retire the Firestore collection and its rule. |

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
| `lib/supabase/migration-{helpers,mappers,coverage,inventory}.ts` | none | **reuse as-is (Node only)** | Pure, unit-tested; the mappers are the best-specified description of every Firestore -> Supabase field mapping in the repo. `migration-runner.ts` is Node tooling. |
| `data/shlokas.ts`, `data/calendar.ts`, `data/galleryCategories.ts` | none | **reuse as-is** | Plain TypeScript constants - ideal for a shared package. |
| `data/panchanga/**`, `seed/ai/*.json`, `data/exports/*.json` | read via `fs.readFileSync(process.cwd() + ...)` | **adapt** | RN has no `fs` and no `process.cwd()`. Either bundle them as imported JSON modules or serve them from an API. `lib/ai/retrieval/panchanga.ts:42` and `lib/aaradhane/panchanga.ts:65` are the two call sites to change. |
| Snake_case -> camelCase mappers (`services/event.service.ts:21`, `services/settings.service.ts:57`, `services/temple-areas.supabase.service.ts`) | none | **adapt - extract** | Pure mapping logic currently trapped inside web services; move into a shared `packages/data` module. |
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

**What `apps/mobile` actually consumes today (api module added 2026-09-30, 0cb71b6; unowned in the chunk map).**
It consumes **no TypeScript** from this module - it imports nothing from `lib/`, `types/` or `data/` -
but it consumes the **Supabase schema** this module defines, directly:

- `apps/mobile/lib/supabase.ts:8` builds its own `@supabase/supabase-js` client with `AsyncStorage`,
  `detectSessionInUrl: false` and the `EXPO_PUBLIC_SUPABASE_*` anon key - exactly the RN rewrite the
  `lib/supabase/client.ts` row above prescribes.
- `apps/mobile/lib/api.ts` reads `sevas` (`:5`, active + amount > 0, by `display_order`), `events`
  (`:17`, published, by `start_date`), `daily_poojas` (`:28`), `gallery_albums` with an embedded
  `gallery_media(*)` (`:39-40`) and `website_settings` (`:49`); `apps/mobile/app/sevas/[id].tsx:23`
  reads one seva by id.
- None of this can work as written (M11-F38): the four real tables are deny-all to the anon role,
  the embed has no foreign key to follow, and `website_settings` does not exist. Items 1, 2 and 5
  above are therefore no longer hypothetical - they are the blocking defects of the shipped mobile app.

## Coverage

filesExpected 111, filesMentioned 111 as of 2026-10-18 (today's `.claude/state/inventory/M11.json`;
was 86/86 on 2026-09-19) plus 5 adopted files: `scripts/export-events.ts`,
`scripts/import-events.ts`, `scripts/generate-events-firestore.ts`,
`scripts/update-finance-settings.ts`, `scripts/update-finance-settings.js`. One inventory file
from 2026-09-19 is gone (`data/firestore-dump/README.md`, struck above). Referenced but owned
elsewhere / unowned: `scripts/verify-supabase-migrations.ts`, `scripts/apply-ai-knowledge-migration.mjs`,
`scripts/resolve-baseline-raya-ai.mjs`, `scripts/fetch-checkpoint.ts`, `prisma/schema.prisma`,
`apps/mobile/lib/api.ts`, the migration workflows under `.github/workflows/` (M15).

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
- ~~**Whether any migration has been applied at all.**~~ **Largely settled 2026-10-18:** a
  `supabase/config.toml` now exists, `.github/workflows/supabase-migrations.yml` runs `supabase db push`
  and `npm run verify:supabase-migrations`, and the two ledger-marker files
  (`20261006101759_seed_ai_settings.sql:3-7`, `20261015000000_baseline_raya_ai.sql:3-9`) state what the
  remote `schema_migrations` contains. Which exact versions are applied is still only knowable from
  the database.
- ~~**Whether `data/firestore-dump/README.md`'s 2026-09-10 inventory is still accurate.**~~ The file
  was deleted (051c530); the live inventory now lives in unowned repo-root reports
  (`PRODUCTION_REVIEW_COLLECTIONS_INVENTORY.md`, `FIRESTORE_PRODUCTION_EXPORT_REPORT.md`) that this
  refresh did not audit.
- **Whether the hardcoded service-account key in M11-F02 is still valid.** I did not and will not
  test it. Settled by checking the key id in Firebase Console > Service accounts; if it is listed,
  revoke it.
- **Whether the `ai_unknown_questions` collection holds live data** or was abandoned in favour of
  `unknown_questions`. The deleted `data/firestore-dump/README.md` listed it as "not present live";
  `scripts/migrate-ai-analytics.ts:56-64` still migrates it "based on audit", which suggests some
  history exists. Settled by the next dump.
- **Whether `receiptSevas` / `receipts` / `bills` / `quotes` / `knowledge` are intended to stay on
  Firestore permanently.** `lib/supabase/migration-inventory.ts` classifies `receiptSevas`, `receipts`,
  `bills` and `quotes` as `REVIEW` ("No destination model explicitly defined"); `knowledge` has since
  moved (`ai_knowledge`). They carry live business data (money). Settled by a product decision, not by code.
- **Whether M11-F40 really breaks the scripts and the build.** Static reading only: `server-only`'s
  throwing default export is the package's documented behaviour, but `node_modules` is absent and
  RULES.md forbids running `tsx`/`next build`. Settled by `npx tsx scripts/migrate-core-to-supabase.ts --dry-run`
  and `npm run build` on a machine with dependencies installed.
- **Whether the live Firestore `ai_settings` collection holds a document** (M11-F46). If it holds
  only `main` from `scripts/seed-ai-settings.ts`, AI analytics recording is off; if it is empty, the
  defaults apply and recording is on. Settled by the next dump's `MANIFEST.json` / `ai_settings.json`.
- **Whether the mobile build points at a project where the anon role has extra grants.** M11-F38 is
  derived from the migrations in this repo; a policy created out of band (the ledger markers prove
  that happens) would change the answer. Settled by `select * from pg_policies` on the project.

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
  `services/settings.service.ts:121` (2026-09-19 numbering; `:83` today) reads the Supabase table; `grep -rn "\.from(" app services lib`
  shows no writer of `social_links` outside `scripts/migrate-settings.ts:102-103`. Tree C, the
  migration-state table and the Supabase table row are corrected accordingly.
- **New finding M11-F31 (LOW):** `services/settings.service.ts:21,131,134` (2026-09-19 numbering; `:21,93,96` today) returns
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

## Refresh log (2026-10-18)

Refresh of the 2026-09-19 brain against branch `feature/temple-portal-knowledge-base` (dispatch HEAD
424fdb8; tree read at 43361a3 - the two commits since are docs-only, `git diff --stat 424fdb8 HEAD -- app lib services scripts supabase apps` is empty). Inputs: delta
`perModule.M11` = 29 added, 1 deleted, 10 modified; each modified file diffed against the read-only
snapshot with `diff --strip-trailing-cr`; every added file read. Format: what was true -> what is
true now -> evidence.

**Header, purpose, roots, questions**
- Header said "Written 2026-09-19" only -> adds refresh date and branch -> this log.
- Purpose listed Supabase-owned domains as sevas reads, events, site_settings, social_links reads, temple_areas, unknown_questions -> adds ai_settings, ai_knowledge, chat_sessions, chat_messages, ai_latency_records, ai_intent_distribution, plus a "2026-10 update" paragraph -> `lib/ai/ai-settings/repository.ts:43`, `lib/ai/knowledge/repository.ts:16`, `services/chat.service.ts:8`, `services/ai-analytics.service.ts:134,170`.
- Code roots lacked the migration library and CLI config -> adds `lib/supabase/migration-*.ts`, `supabase/config.toml`, `supabase/.gitignore` -> delta `added`.
- "Answers questions about" -> 10 new topics (runner, inventory, batched/staged runs, settings_documents, AI tables, server-only crash, mobile, Prisma marker, collisions).

**Entry points**
- `createAdminClient()` at `lib/supabase/admin.ts:3`, no guard -> `:4`, `import 'server-only'` at `:1` -> 7d7bd51.
- `firestore:dump` read the key file only -> env triple first, then file -> `scripts/dump-firestore-live.ts:227-245`.
- `scripts/migrate-core-to-supabase.ts`, `scripts/migrate-content-to-supabase.ts`, `scripts/migrate-ai-to-supabase.ts` were 290-380-line self-contained scripts entered at `:231/:156/:168` -> 69-82-line wrappers entered at `:30/:37/:33` over `lib/supabase/migration-runner.ts` -> d71898d.
- `migrate-settings.ts` wrote site_settings + social_links, entry `:4` -> also writes `settings_documents`, entry `:37` -> `scripts/migrate-settings.ts:128-129`.
- `seed:ai` wrote Firestore `articles` -> writes Supabase `ai_knowledge` -> c586d6c, `scripts/seed-ai-knowledge.ts:94-106`.
- Added rows: `dump:staged`, `migrate:phase1`, `migrate-all-batched`, `migrate:seva-bookings`, `migrate-ai-analytics`, `migrate-ai-knowledge`, `check-collisions`, `supabase:migrations:push`, `verify:supabase-migrations`, `scripts/lib/*.mjs`, `seed-ai-settings-supabase` -> delta `added`, `package.json` scripts.
- `migrate:sevas` / `migrate:daily-poojas`: a failed dry run exited 0 -> exits 1 -> `scripts/migrate-sevas.ts:240-242`, `scripts/migrate-daily-poojas.ts:238-240`.

**Component trees**
- Tree C: admin settings writes via `await import("@/lib/supabase/admin")` -> via `app/actions/settings.ts` server actions (admin-checked); social_links read `:121` -> `:83` -> `services/settings.service.ts:70-83`, `app/actions/settings.ts:26`.
- Tree C note: `settings/ai` read by `lib/ai/settings.ts:39` -> file removed -> 2891323.
- Tree E: AI settings on Firestore `ai_settings/main` -> Supabase `ai_settings` (both repositories) -> fae5d51, `lib/ai/ai-settings/repository.ts:35-37,43`, `admin-repository.ts:31,42`.
- New Tree F (knowledge, chat, analytics stores; admin dashboards still on Firestore) -> `app/admin/ai/analytics/page.tsx:307-333`.

**Data flow**
- Flow 1 (dump): 48x discovery retry, 5x per collection, pageSize 300 -> 10x each with exponential backoff to 120 s, pageSize 100, global 500 ms pacer, token refresh -> `scripts/dump-firestore-live.ts:6-9,11-86,280`; line refs `:104/:106/:133/:11-22` -> `:361/:363/:390/:205-216`.
- Flow 2 (core migration): own `migrateCollection()` with batch 50 and inline validators -> shared `migrateSupabaseCollection()` with batch 200, pure mappers, field-coverage audit, `excludedMalformed` in reconciliation; events description/location/status optional and featured/published default false -> `lib/supabase/migration-runner.ts:44,52-263`, `lib/supabase/migration-mappers.ts:685,736,760`, 1380104, 91f6df7, 2e1ef6d.
- Flow 5 (knowledge seeding) rewritten for `ai_knowledge` -> `scripts/seed-ai-knowledge.ts:92-106`.
- New flows 6 (batched, checkpointed) and 7 (staged Phase 1, checksum-verified) -> 21c9418, e16615b..8e33f8b, c46c706..f2f1813.

**Key files**
- Supabase schema table: 8 files -> 17 files + `config.toml` + `.gitignore`; "Dated after today" notes removed (nothing is future-dated on 2026-10-18) -> `ls supabase/migrations`.
- "No `knowledge` table" -> clarified (`ai_knowledge` exists); `website_settings` added to the non-existent list; Prisma models nine tables but no app import -> `grep -rln "@prisma/client\|lib/prisma" app lib services` returns nothing.
- Supabase clients table: 4 rows -> adds the five `lib/supabase/migration-*.ts` files and the admin guard history.
- `data/firestore-dump/README.md` row -> struck, "removed 2026-10" -> 051c530; adds `manifest.json` and `data/migration-manifest.json` rows.
- Migration scripts table: 7 rows with old line counts -> 12 rows with current counts.
- Dump scripts table: dumper 144 lines / 48x -> 406 lines / 10x; adds `dump-firestore-staged.ts`, `check-collisions.ts`, four `scripts/lib/*.mjs`.
- Seed table: `seed-ai-knowledge.ts` target `articles` -> `ai_knowledge`; `seed-ai-settings.ts` marked stale; adds `seed-ai-settings-supabase.ts`.

**Types and stores**
- Firestore catalogue: `trust` (R via `lib/ai/firebaseChat.ts:120`) -> unused; `messages` (R/W) -> migration source only; `chatTraining` (`firebaseChat.ts:153`) -> `app/admin/ai/training/page.tsx:125`; `ai_settings` (R/W) -> unread; `ai_latency_records`/`ai_intent_distribution` (R/W) -> admin-page reads only; `unknown_questions` writers changed; `ai_unknown_questions` -> dead constant `:48`; `knowledge` reader moved to Supabase; `articles` -> struck; `chat_sessions` -> admin counters only; `ai_token_usage` line `:44` -> `:45`.
- Supabase tables: adds `settings_documents`, `ai_settings`, `ai_knowledge`, `website_settings` (absent); `seva_bookings.seva_id`, `donations.campaign_id`, `gallery_media.album_id` uuid -> text; events columns nullable; app-code column refreshed for chat/AI/settings tables; mobile readers added.

**Migration state, indexes, dependencies, recipes**
- Migration-state table re-derived: AI settings Firestore-only -> Supabase-only; AI analytics "Firestore write / Supabase read" -> "Supabase write / admin page reads Firestore"; chat Firestore-only -> Supabase (RLS-denied) + Firestore admin counters; knowledge row added (split); token usage row added; content/bookings/settings docs "schema only" -> "Supabase copy, no web readers".
- Future-dated-migrations paragraph -> rewritten as an interleaving/ledger paragraph (M11-F13).
- Index tables: `chat_sessions` and `knowledge` composite indexes moved from "used" to "unused"; `messages` and `chatTraining` missing-index rows struck as obsolete; `firebaseChat.ts:75` user removed; testimonials users `chat.service.ts:158,176` -> `:214-215,232-233`; `firestore.indexes.json:130-150` -> `:223-251`; `repository.ts:453` -> `:472-480`.
- Cross-module tables: importers of `lib/supabase/admin.ts` 4 -> 11 app files + 15 scripts; `client.ts` 4 -> 7; adds migration-library, target-connection, mobile rows; boundary paragraph names `seed-ai-settings-supabase.ts`.
- Recipes 1, 2, 3, 6, 7 rewritten for the mapper/runner/inventory structure and the new dumper retry policy.

**Faults** (33 existing rows, every one now carries a 2026-10-18 status)
- FIXED: M11-F09 (c586d6c).
- STILL OPEN, evidence unchanged: F01, F02 (+ false-positive note), F03 (+ dead `ai_settings` note), F06, F07, F10, F11, F14, F15, F16, F17 (+ mobile note), F18, F19, F20, F21, F23, F24, F25, F27, F28, F29, F32, F33.
- STILL OPEN with changed scope or moved evidence: F04 (chat service added; AI reads now server-side), F05 (25 -> 22 collections), F08 (reshaped: Firestore vs Supabase under one name), F12 (lines moved, messages row moot), F13 (reframed), F22 (`:11-22` -> `:205-216`, plus inventory as a third list), F26 (`any`s moved into `lib/supabase/migration-runner.ts`), F30 (`:121` -> `:83`, writers named), F31 (`:131,:134` -> `:93,:96`).
- NEW: F34 knowledge split-brain; F35 seed:ai writes unapproved rows; F36 admin AI dashboards read Firestore after writers moved; F37 divergent seva-booking mappers + hardcoded doc id; F38 mobile reads deny-all/absent tables with the anon key; F39 inventory inconsistencies (`knowledge` skipped silently); F40 `server-only` in `lib/supabase/admin.ts` vs Node scripts and a client bundle (PLAUSIBLE); F41 two unknown-question collections into one table; F42 settings reconciliation miscount; F43 TLS verification disabled in pg tooling; F44 AGENTS.md / .gitignore drift; F45 stale Firestore AI-settings seed.

**Portability, coverage, UNCLEAR**
- Portability: "what a RN client would need" was hypothetical -> adds what `apps/mobile` consumes today (schema only, via its own anon client) -> `apps/mobile/lib/api.ts`, `apps/mobile/lib/supabase.ts`.
- Coverage 86/86 -> 111/111 from today's `.claude/state/inventory/M11.json`.
- UNCLEAR: "any migration applied?" largely settled (config.toml, push workflow, ledger markers); README-accuracy item closed (file deleted); two new items (F40 runtime confirmation, out-of-band RLS grants for mobile).

**Path check (script, 2026-10-18).** All backticked paths extracted and tested with `fs.existsSync`:
232 exist. Nine are deliberately absent and say so in the text: `MANIFEST.json` / `manifest.json` /
`data/firestore-dump/MANIFEST.json` / `data/firestore-dump/manifest.json` / `data/migration-manifest.json`
(generated, git-ignored or CI artifacts), `data/firestore-dump/README.md`, `lib/ai/firebaseChat.ts`,
`lib/ai/settings.ts` (removed, labelled), `lib/supabase/admin-node.ts` (a proposal, labelled). Two
line numbers exceed the current file only inside the dated 2026-09-19 Verification log, now
annotated with today's numbers.

**Commits behind the biggest changes:** d71898d (ETL moved into `lib/supabase/`), 21c9418 + e16615b..8e33f8b
(batched, checkpointed migrator), c46c706..f2f1813 (staged Phase 1), 7680961..d2c9113 (dumper rewrite),
fae5d51 (AI settings on Supabase), fdaff98 / c586d6c (AI knowledge on Supabase), 224875d (chat on
Supabase), 3d0d3b2..556a704 (BOT-004 analytics), 7d7bd51 (`server-only` on the admin client),
2891323 (`lib/ai/firebaseChat.ts`, `lib/ai/settings.ts` removed), 051c530 (dump README deleted),
0cb71b6 (mobile API).

**UNCLEAR (this refresh)**
- UNCLEAR: whether `next build` currently passes with `services/chat.service.ts` importing a `server-only` module into client pages - c156d6c ("clear the two pre-existing red checks on main", 2026-10-16) may or may not cover it; not executable here (M11-F40).
- UNCLEAR: whether `scripts/migrate-seva-bookings-to-supabase.ts` or the batched `mapSevaBooking` was the one actually used for the production load (M11-F37); the repo-root reports that might say so are unowned and were not audited.

## Verification log (2026-10-18)

Skeptic pass over the 2026-10-18 refresh (tree at 43361a3; dispatch HEAD 424fdb8, code-identical).
Report: `.claude/state/verify/M11-2026-10-18.md`. Format: what was wrong -> what it says now -> evidence.

- Purpose, timestamps paragraph, M11-F13: "eleven Supabase migrations added", "six of the eleven interleave", "two of them are ledger markers" -> nine migrations added (8 -> 17 files; the other two new files are `config.toml` and `.gitignore`), four interleave (`20260921000000`, `20260922000000`, `20261002000000`, `20261006101759`), one interleaved and one appended marker; every post-2026-09-19 stamp now listed (focus question) -> `ls supabase/migrations` vs the read-only snapshot (8 files).
- Tree A: `lib/supabase/admin.ts:3` -> `:4`; adds the silent Firestore fallback in `getAllSevas` -> `services/seva.service.ts:31-39`.
- Tree B: `eventService.createEvent` -> `addEvent` (`:70`); method lines `:70,98,122` -> `services/event.service.ts:70`.
- Tree F: adds `GET /api/ai/analytics` reading Firestore `chat_sessions`/`chat_messages`, and the Firestore `ai_settings` analytics gate -> `services/ai-analytics.service.ts:57-77,621-640`.
- Key files: `firestore.indexes.json` 180 lines, "several single-field" -> 309 lines, four single-field -> `wc -l`, `node -e` index dump (22 indexes, 0 fieldOverrides).
- Seed data row: `seed/ai` -> `articles` -> Supabase `ai_knowledge` -> `scripts/seed-ai-knowledge.ts:94-106`.
- Seed table: `seed-ai-settings.ts` "overwrites via `.set()`", "nothing reads Firestore `ai_settings`" -> exits unless `--force`; Firestore `ai_settings` still read as the analytics gate -> `scripts/seed-ai-settings.ts:507-511`, `services/ai-analytics.service.ts:64`.
- Dump/convert table carried six rows of a 3-column "imported by" table (malformed) -> five moved to "This module is imported by", the duplicate `firestore-values` row dropped -> section structure.
- Firestore catalogue: `ai_settings` "no app code" -> R (analytics gate); `chat_sessions` "admin counters only" -> also `services/ai-analytics.service.ts:623`; new row Firestore `chat_messages` (no rule) -> `services/ai-analytics.service.ts:49-50,635`.
- Supabase tables: `daily_poojas` columns lacked `display_order` -> added -> `supabase/migrations/20260907112632_create_core_tables.sql:45`.
- Migration state: AI settings "Supabase only" -> Supabase for the bot, Firestore still gates analytics -> M11-F46.
- Index no-ops: "three single-field" -> four (adds `announcements` publishedAt) -> `firestore.indexes.json:172-180`.
- Recipe 1 step 7: adds the M11-F40 import-crash caveat.
- M11-F03 note "Firestore `ai_settings` only exposes a dead document" -> it gates analytics -> `services/ai-analytics.service.ts:64`.
- M11-F05: 22 -> 23 rule-less collections (adds `chat_messages`) -> `firestore.rules` match list (38 collection blocks).
- M11-F36: evidence adds the service's own dashboard counts -> `services/ai-analytics.service.ts:621-640`.
- M11-F37: "throws on missing" -> throws on the blank strings every new booking carries -> `lib/supabase/migration-mappers.ts:22-27`, `services/sevaBooking.service.ts:36`.
- M11-F39: adds `users` (EXCLUDE_AUTH) and `profiles`/`donations`/`donation_campaigns` (REVIEW) migrated by `migrate:content` -> `lib/supabase/migration-inventory.ts:11,41,43,45`, `scripts/migrate-content-to-supabase.ts:45-48`.
- M11-F40: client-bundle path named only `services/chat.service.ts` -> 14 client modules via two paths, incl. the public Knowledge Centre (`services/knowledge.service.ts` -> `lib/ai/knowledge/repository.ts:5`); notes `scripts/test-boundary.sh` cannot detect a pre-existing violation; fix now requires both paths -> import-graph scan from every `"use client"` file.
- M11-F45: "nothing reads Firestore `ai_settings`", "overwrites" -> read by the analytics gate; writes only when absent or `--force` -> `services/ai-analytics.service.ts:64`, `scripts/seed-ai-settings.ts:507-511`.
- NEW M11-F46 (MEDIUM, plausible at runtime): Firestore `ai_settings` first-doc read gates every AI analytics write; the seeded `main` doc's shape disables it; world-writable -> `services/ai-analytics.service.ts:57-77,101,127,163,197,483-488`, `firestore.rules:226-229`.
- UNCLEAR: adds the live `ai_settings` contents question (M11-F46).

Fault count for this file is now 46 (1 FIXED, 45 open). Path re-check after edits: see the report.
