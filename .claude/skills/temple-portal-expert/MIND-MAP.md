# MIND-MAP - the router for the temple-portal expert

Built 2026-09-19. This file routes a question to the brain file that answers it. It holds no detail
of its own: the 16 files under [`brain/`](brain/) hold the detail, and the code holds the truth.

---

## What this application is

**Sri Raghavendra Swamy Matha portal** (package name `temple-portal`, deployed as *Rayaramatha*) - a
public temple website plus an admin console for the Matha's staff and trust.

- **Devotees** browse the Matha's history, guru parampara, events, gallery and calendar; book sevas
  and poojas; donate; look up receipts; read shlokas, stotras and knowledge articles; and ask
  **Raya AI**, the in-house chat assistant, temple questions in English or Kannada.
- **Admins and the trust** run ~60 `/admin/*` screens: events, gallery and media, announcements,
  quotes, testimonials, the seva/booking/donation/billing/receipt back office, the Ekadashi and
  festival calendars, site settings, users and roles, and the whole Raya AI management centre.
- **Stack:** Next.js 16 App Router (`package.json:55`), TypeScript strict, Tailwind v4 with CSS
  custom properties, Framer Motion, shadcn/base-ui primitives, Jest + Playwright, deployed to Vercel.
- **Two data stores, mid-migration:** Firebase (Auth, Firestore, Storage) is the live store for
  almost everything; Supabase (Postgres, 21 tables) has been migrated to for `events`,
  `site_settings`, `social_links`, `temple_areas` and seva *reads*. The migration is unfinished and
  split-brained in three places - see [M11 Migration state per domain](brain/M11-data-model-persistence-and-migration.md).
- **Money is manual.** There is no payment gateway anywhere: donations and bookings record a
  self-attested UPI reference that the app trusts ([M03](brain/M03-public-devotional-and-transactions.md),
  [M07](brain/M07-admin-devotional-operations.md)).

---

## Module map

16 modules, M01-M16. "Owns" is the code root; "ask it about" is what to route to it. M01-M15 own
code; **M16 owns no code** - it is the field-level index across all of it.

| id | brain file | owns (code roots) | ask it about |
|---|---|---|---|
| **M01** | [App shell, tokens, UI kit](brain/M01-foundation-and-ui-kit.md) | `app/layout.tsx`, `app/globals.css`, `components/ui`, `components/layout`, `components/common`, `context`, `hooks`, `utils`, `lib/*.ts`, `proxy.ts`, `next.config.ts` | design tokens and colours; dark mode; the shadcn kit and which primitives are broken stubs; navbar/footer and how to add a menu item; `AuthContext` vs `ProfileContext`; which Firebase entry point to import; `proxy.ts` and the two CSPs; toasts; animation vocabularies; dead foundation code |
| **M02** | [Public information pages](brain/M02-public-information-pages.md) | `app/(public)` home + institutional pages, `components/home`, `components/events`, `components/guru`, `components/search`, `components/festival`, `components/recommendation` | home page section order; where hero/stats/announcement-bar content comes from; events list and detail; gallery; global search; recommendations; testimonials; framer-motion density; the visual inventory for a redesign; dead and orphan public pages |
| **M03** | [Devotional pages and transactions](brain/M03-public-devotional-and-transactions.md) | `app/(public)` sevas/pooja/donation/receipts/aaradhane/quotes/shlokas/stotras/qr/favorites/profile/display/temple-explorer/ai, `app/calendar`, `app/knowledge` | seva booking flow end to end; donation flow and validation; receipt lookup; profile, favorites, preferences; quotes/shlokas/stotras data sources; the public calendar; Knowledge Centre; temple explorer; the `/display` kiosk; where the payment gateway isn't |
| **M04** | [Auth, users and security](brain/M04-auth-users-and-security.md) | `app/(auth)`, `components/auth`, `lib/auth`, `context/AuthContext.tsx`, `app/admin/users`, `firestore.rules`, `storage.rules`, `lib/supabase` | login/register/forgot-password; Firebase Auth vs Supabase Auth; how "admin" is decided; where `/admin` is (and is not) protected; every Firestore and Storage rule; ID tokens and the absence of session cookies; the two unauthenticated bootstrap routes; the role model |
| **M05** | [Admin platform and settings](brain/M05-admin-platform-and-settings.md) | `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/settings`, `app/admin/website-settings`, `app/admin/reports`, `components/admin/layout\|common\|crud\|dashboard\|settings`, `hooks/useCrudTable.ts` | the admin shell and where the sidebar is really defined; dashboard widgets and why some read zero; the generic CRUD framework; all 16 settings sub-pages and which `settings/*` doc each writes; orphan settings nobody reads; admin UI patterns for a redesign; `/admin/test` and `/debug` |
| **M06** | [Admin content and media](brain/M06-admin-content-and-media.md) | `app/admin/events\|gallery\|media\|announcements\|content\|library\|quotes\|testimonials\|shlokas\|stotras\|temple-areas`, `services/storage.service.ts`, `app/api/{storage,gallery,events,announcements,testimonials,revalidate}` | creating and editing an event; the six `/admin/gallery/*` routes and which one is live; the upload pipeline (Firebase Storage vs Vercel Blob vs `public/`); tiptap rich text and sanitisation; which admin content pages are mock screens; `/api/revalidate` |
| **M07** | [Admin devotional operations](brain/M07-admin-devotional-operations.md) | `app/admin/sevas\|seva-bookings\|bookings\|pooja\|aaradhane\|donations\|billing\|receipts\|calendar`, `services/{billing,receipt,receiptSeva}.service.ts`, `app/api/{bookings,donations,admin/receipts,admin/receipt-sevas,admin/aaradhane,public/receipts}` | the Receipt Book end to end; receipt numbering; the three seva-ish admin sections and what each really is; booking status transitions; billing and invoice numbers; donation reconciliation; the admin Ekadashi/festival editors; the UPI QR |
| **M08** | [Raya AI engine](brain/M08-raya-ai-engine.md) | `lib/ai`, `services/{chat,conversation,knowledge,multi-source-retrieval,ml,ai-analytics}.service.ts`, `app/api/chat`, `app/api/ai`, `seed/ai` | one chat message end to end; whether an LLM is actually called (it is not); intent detection, Kannada detection and transliteration; retrieval order and sources; where every answer string is written; sessions and follow-ups; unknown-question logging; AI analytics |
| **M09** | [Raya AI console and knowledge workflow](brain/M09-raya-ai-console-and-knowledge-workflow.md) | `components/ai`, `app/admin/ai`, `app/admin/assistant`, `app/admin/knowledge`, `app/api/knowledge`, `app/api/admin/{knowledge,prompts,analytics,content}`, `tests/ai-uat` | the chat widget and provider; chat history and markdown rendering; every `/admin/ai/*` page; knowledge article CRUD; the draft-review-approve-publish workflow and why it is unreachable; prompt versions; unknown-question triage; the AI UAT suite |
| **M10** | [Services and types catalogue](brain/M10-services-and-types-catalogue.md) | `services/**`, `types/**`, `lib/services`, `lib/settings`, `lib/firebase.ts`, `lib/admin-firebase.ts`, `lib/firebase-admin-rest.ts` | which service owns which collection or table; who imports each service; the shape every service copies; direct Firebase calls outside the service layer (41 files); duplicate services and duplicate exported type names; caching, pagination and error conventions; which services are dead |
| **M11** | [Data model, persistence, migration](brain/M11-data-model-persistence-and-migration.md) | `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `supabase/**`, `data/**`, `seed/**`, `scripts/{migrate,dump,seed,check}-*` | every Firestore collection and Supabase table; what the rules allow; which collections have no rule; indexes vs the queries actually run; migration state per domain; seed and dump scripts; static `data/*.ts` still in play; hardcoded credentials |
| **M12** | [API layer](brain/M12-api-layer.md) | `app/api/**` (95 `route.ts`), `app/actions/sevas.ts`, `lib/rate-limit.ts`, `vercel.json` | what every endpoint does, returns and caches; which 5 route files verify a token; validation patterns; rate limiting; duplicate route families; `force-dynamic` vs cached; the endpoint the admin calendar calls that does not exist; how to add a route correctly |
| **M13** | [Device, i18n and PWA](brain/M13-device-capabilities-i18n-and-pwa.md) | `lib/device`, `components/device`, `lib/i18n`, `hooks/a11y`, `hooks/useReducedMotion.ts`, `services/{device-analytics,ux}.service.ts`, `public/**` | `@/lib/device` capabilities; permissions (camera, location, notifications, clipboard); notifications and why there are two preference pages; share, add-to-calendar, QR scan and generate; whether this is a PWA (it is not); English/Kannada/Sanskrit i18n and why translations never show; reduced motion and a11y hooks |
| **M14** | [Domain engines](brain/M14-domain-engines-panchanga-aaradhane-receipts-reports.md) | `scripts/panchanga.py`, `data/panchanga`, `data/calendar.ts`, `lib/{festival-utils,panchanga-cache,date}.ts`, `lib/aaradhane`, `lib/receipt`, `lib/reports`, `services/proof-report`, two GitHub workflows | how the 730 panchanga day files are produced and when they run out; what a day file contains; festivals and Ekadashi; the Aaradhane lunar-to-Gregorian generator; receipt numbering, PDF drawing and the UPI deep link; the Playwright proof-report engine |
| **M15** | [Testing, CI, tooling, repo health](brain/M15-testing-ci-tooling-and-repo-health.md) | `tests/**`, `jest.config.ts`, `.github/**`, `lighthouse-budget*.json`, `postman`, `docs/**`, root reports, `services/{analytics,pageviews}.service.ts` | what tests exist and which actually run; what CI gates (nothing gates the deploy); the five workflows; Lighthouse budgets; a per-file currency verdict for all 27 `docs/` files; analytics collections; agent tooling debris; what to delete before a rearchitecture |
| **M16** | [Collection and table field catalogue](brain/M16-collection-field-catalogue.md) | no code root - an index over all of it, harvested by `.claude/state/inventory/fields.mjs` into `.claude/state/inventory/fields.json` | the **field list** of each of the 64 Firestore collections and 21 Supabase tables; who writes and who reads each field, with `path:line`; which 19 collections have no TypeScript type, so the write site *is* the schema; fields written but never read, and read but never written; the document ids under `settings/` and what is in each; name and case mismatches between a Firestore document and the Supabase column meant to replace it; the empty twins (`chat_messages` vs `messages`, `aaradhane` vs `aaradhanes`, `unknown_questions` vs `ai_unknown_questions`); Supabase columns, defaults and RLS; which queries need an undeclared composite index; where `docs/DATA-MODEL.md` describes a collection the code does not use; how to re-run the harvester |

---

## Question router

Find the shape of the question on the left; open the brain section named on the right **first**, then
confirm in the code that section cites.

| Question shape | Go to | Section to open first |
|---|---|---|
| "How does *&lt;feature&gt;* work end to end?" | the feature's module (see Module map) | **Data flow**, then **Component trees** |
| "Where is *&lt;thing&gt;* defined?" | M01 for UI, tokens and hooks; M10 for services and types; M11 for collections; M12 for endpoints | **Key files**; if still unfound, use *Find-it recipes* below |
| "Which collection or table stores *&lt;data&gt;*?" | **M11** | **Types and stores** (Firestore table, then Supabase table), then **Migration state per domain** |
| "What fields does *&lt;collection&gt;* have?" / "what columns are on *&lt;table&gt;*?" | **M16** | **Index** - find the collection, then its section under **Firestore collections** or **Supabase tables**. M11 answers *which store*; M16 answers *which fields* |
| "Who writes *&lt;field&gt;*?" / "who reads it?" / "is this field dead?" | **M16** | the collection's field table - every row carries its writers and readers as `path:line`; then **Orphans and mismatches** for fields written and never read, or read and never written |
| "Which collections have no TypeScript type?" / "is this field declared or invented at the call site?" | **M16** | **Orphans and mismatches** (19 untyped collections), then the collection's own section - an untyped collection's write site *is* its schema |
| "What does route *&lt;path&gt;* do?" | a page route goes to its owning module; `/api/*` goes to **M12** | **Entry points** (page) or the matching domain table in M12 **Entry points** (API) |
| "How do I add *&lt;x&gt;*?" | the owning module | **How to change it** - recipes are numbered or lettered per module |
| "What breaks if I change *&lt;y&gt;*?" | the owning module, then M10 | **Cross-module dependencies**, plus M10 **Who imports each service** |
| "Is *&lt;module&gt;* tested?" | **M15**, then the module | M15 **Component trees** &rarr; *Test-runner trees* (which runner reaches which files), then M15 **Key files** &rarr; the `Tests - …` tables; finish in the module's **Faults**. **Not** a *Coverage* section - see the note below |
| "Explain this file" / "what is *&lt;path/File.tsx&gt;*?" | the module that owns its directory (Module map, "owns" column) | **Key files** - find the row for the path; then **Component trees** for its parent, and **Faults** for its fault ids |
| "What is wrong with *&lt;module&gt;*?" | the owning module | **Faults, smells and risks** - fault ids read `M0n-Fnn` |
| "Can *&lt;module&gt;* move to React Native?" | the owning module, plus `docs/rearchitecture/` | **Portability notes (React Native / cross-platform)** |
| "Why does an admin edit not show on the public site?" | **M11**, then M05 | M11 **Migration state per domain**, the split-brain rows |
| "Is this endpoint protected?" | **M12**, then M04 | M12 **Entry points**, the auth column; then M04 **Faults** |
| "What does the doc say vs what the code does?" | **M15**, plus the module's own drift table | M15 doc-currency verdicts; the module's **Faults** |
| "What is this Sanskrit or Kannada word?" | *Glossary* below, then the owning module | - |
| "What is dead code here?" | the owning module, then **M10** | the module's **Faults** (the "imported by nothing" rows), plus M10 **Cross-module dependencies** &rarr; *Who imports M10* / *Who imports each service*, which carries the zero-importer list |
| "Which screens would a redesign touch?" | M02 (public), M05 (admin chrome), M01 (tokens and kit) | M02 visual inventory; M05 admin UI patterns; M01 **Design tokens** |

> **What *Coverage* means in a brain file.** Every brain file ends with a **Coverage** section, and it
> is *not* test coverage: it records which files of that module's inventory the brain file accounts
> for, and how deeply each was read. Questions about tests go to M15 as the row above says.

---

## Route index

Every page route group, API prefix and non-HTTP entry, mapped to its owning module. Source: each
brain file's **Entry points** table.

### Page routes

| Route group | Module |
|---|---|
| `/` (home) | M02 |
| `/about`, `/trust`, `/guruparampara`, `/journey`, `/timeline`, `/facilities`, `/future-plans` | M02 |
| `/testimonials`, `/testimonials/submit`, `/volunteer` | M02 |
| `/events`, `/events/[id]`, `/gallery`, `/live`, `/search` | M02 |
| `/notifications`, `/pages/notifications`, `/pages/settings` | M02 + M13 |
| `/sevas`, `/pooja`, `/donation`, `/donation/success`, `/donation/failure` | M03 |
| `/receipts` | M03 (its API is M07) |
| `/aaradhane`, `/quotes`, `/shlokas`, `/stotras` | M03 |
| `/profile`, `/profile/settings`, `/profile/preferences`, `/favorites` | M03 |
| `/qr` | M03 + M13 |
| `/display`, `/temple-explorer`, `/ai/analytics` | M03 (there is **no** `/ai` page - `app/(public)/ai/` holds only `analytics/`) |
| `/calendar`, `/calendar/ekadashi`, `/calendar/festivals` | M03 (its data is M14) |
| `/knowledge`, `/knowledge/[category]`, `/knowledge/article/[slug]` | M03 (its API is M09) |
| `/login`, `/register`, `/forgot-password` (the `(auth)` group) | M04 |
| `/admin` shell and dashboard | M05 |
| `/admin/settings/*` (14 `page.tsx` files: the index plus 13 sub-pages), `/admin/website-settings/temple-information` | M05 |
| `/admin/reports`, `/admin/featured`, `/admin/test`, `/admin/test-firebase`, `/debug` | M05 |
| `/admin/events/*`, `/admin/gallery/*` (6 routes), `/admin/media`, `/admin/content`, `/admin/library` | M06 |
| `/admin/announcements/*`, `/admin/quotes/*`, `/admin/testimonials`, `/admin/shlokas`, `/admin/stotras`, `/admin/temple-areas` | M06 |
| `/admin/sevas/*`, `/admin/seva-bookings`, `/admin/bookings/*` | M07 |
| `/admin/pooja/*`, `/admin/aaradhane/*`, `/admin/calendar/*` | M07 |
| `/admin/donations/*`, `/admin/billing/*`, `/admin/receipts/*` | M07 |
| `/admin/users`, `/admin/users/new`, `/admin/users/[id]/edit` | M04 |
| `/admin/ai/*` (12 `page.tsx` files: the index plus analytics, health, intents, knowledge, playground, prompts, settings, testimonials, training, unknown-questions, volunteers), `/admin/assistant`, `/admin/knowledge` | M09 |

### API prefixes

Every prefix is catalogued row by row in [M12 Entry points](brain/M12-api-layer.md); the second
column is the module that owns the behaviour behind it.

| API prefix | Behaviour owned by |
|---|---|
| `/api/admin/aaradhane` | M07 (engine in M14) |
| `/api/admin/analytics` | M09 |
| `/api/admin/content` | M09 |
| `/api/admin/knowledge` | M09 |
| `/api/admin/prompts` | M09 |
| `/api/admin/quotes` | M06 |
| `/api/admin/receipt-sevas` | M07 |
| `/api/admin/receipts` (incl. `/[id]/pdf`, `/[id]/send`) | M07 (PDF in M14) |
| `/api/admin/temple-areas` | M06 |
| `/api/admin/users` (`create-admin`, `set-role`) | M04 |
| `/api/ai/analytics` | M08 |
| `/api/ai/knowledge` | M08 |
| `/api/ai/multi-source` | M08 |
| `/api/ai/settings` | M08 |
| `/api/announcements` | M06 |
| `/api/bookings` | M07 |
| `/api/chat` | M08 |
| `/api/contact` | M12 (logs only, writes nothing) |
| `/api/dashboard/daily-spiritual` | M14 (consumed by M05) |
| `/api/donations` | M07 |
| `/api/events` | M06 |
| `/api/gallery/local-assets` | M06 |
| `/api/knowledge` and `/api/knowledge/workflow/*` | M09 |
| `/api/public/receipts`, `/api/public/stats` | M07 / M15 |
| `/api/quotes/*` (10 routes) | M03 + M06 |
| `/api/recommendations` | M02 |
| `/api/reports/list`, `/api/reports/save` | M05 (generator in M14) |
| `/api/revalidate` | M06 |
| `/api/search`, `/api/search/suggestions` | M02 |
| `/api/seed-ai-settings` | M08 |
| `/api/storage/videos` | M06 |
| `/api/supabase-check` | M04 / M11 |
| `/api/temple-areas` | M06 |
| `/api/testimonials` | M06 |
| `/api/volunteer` | M02 |

### Non-HTTP entry points

| Entry | Module |
|---|---|
| `proxy.ts` - Next 16's renamed middleware: a page-view write plus a second CSP | M01 |
| `app/actions/sevas.ts` - the only server action in the repository | M12 |
| `/data/panchanga/current.json` - static asset fetched client-side | M14 |
| CLI: `npm run firestore:dump`, `migrate-*`, `seed-*`, `setup-admin` | M11 |
| CLI: `generate:aaradhane`, `generate:proof-report`, `panchanga.py` | M14 |
| GitHub Actions: `deploy`, `ai-uat`, `lighthouse-ci`, `panchanga`, `aaradhane` | M15 (content in M09/M14) |

---

## Store index

The authority for all of this is [M11 Types and stores](brain/M11-data-model-persistence-and-migration.md);
M10 maps service to store. Where a name appears in both the Firestore and the Supabase table below,
the store is split-brained and the row says so.

**Field-level detail is one file further in:** the tables below stop at *who touches this store*.
For the fields or columns themselves - names, types, who writes each one and who reads it back, and
which collections have no TypeScript type at all - go to
[M16 Collection and table field catalogue](brain/M16-collection-field-catalogue.md) and start at its
**Index**.

### Firestore collections (63)

| collection | read or written by |
|---|---|
| `users` | M04 (auth, admin users), M10 |
| `profiles`, `bookmarks` | M03 (profile, favorites), M10 |
| `sevas` | M03 (public reads go to Supabase), M07 (receipt catalogue), M08 (AI retrieval), M11 |
| `receiptSevas` | M07, M11 (seed) |
| `receipts`, `system` (the receipt counter) | M07, M14 (numbering and PDF) |
| `sevaBookings` | M03 (booking), M07 (admin and `/api/public/receipts`) |
| `dailyPoojas`, `poojas` | M07, M06 (`/admin/content` counts) |
| `events` | M06 (admin writes), M14 (the aaradhane generator writes), M08 (AI reads) - Supabase `events` is the other half |
| `aaradhane`, `aaradhanes` | M07 (admin), M03 (public), M14 (generator) |
| `guruParampara` | M14 (`lib/aaradhane/firestore-source.ts`) |
| `announcements` | M02, M06, M08 |
| `gallery`, `galleryAlbums`, `galleryMedia` | M06 (admin), M02 (public), M10 |
| `timings` | M08 (AI retrieval) |
| `donations`, `donation_campaigns` | M03 (public form), M07 (admin) |
| `bills` | M07 (billing) |
| `settings` (aboutUs, trustCommittee, facilities, futurePlans, footer, socialLinks, guruParampara, shlokas, poojaSchedule, ekadashiCalendar, festivalCalendar, financeSettings, temple, contact, visitor, ai, device, config) | M05 writes, M02 reads, M01 (footer), M07 (finance) |
| `homepage` | M05 (the one correctly layered settings module), M02 |
| `futurePlans`, `trustCommittee` (top-level) | nobody - rules exist, no code |
| `trust` | M08 (`lib/ai/firebaseChat.ts`) |
| `testimonials` | M02 (public), M06 and M09 (admin approval) |
| `members`, `volunteers`, `volunteer_requests` | M07 (the `/admin/sevas` register), M02 (volunteer form), M09 |
| `notifications` | M10 (`testimonial.service`) |
| `feedback` | M08/M09 (chat feedback) |
| `chat_sessions`, `messages`, `chatTraining` | M08 (engine), M09 (console) |
| `chat_metrics`, `intent_metrics`, `intent_feedback` | M15 (`analytics.service`), M08 |
| `ai_settings` | M08 reads, M09 writes |
| `ai_token_usage`, `ai_latency_records`, `ai_intent_distribution` | M08, M09 |
| `unknown_questions`, `ai_unknown_questions` (two parallel names) | M08, M09 |
| `page_views`, `daily_page_stats` | M15 (`pageviews.service`), M01 (`proxy.ts` writes) |
| `knowledge` | M08 (retrieval), M09 (admin CRUD), M03 (Knowledge Centre) |
| `knowledge_articles`, `knowledge_categories` | nobody - rules exist, no code |
| `knowledge_workflow`, `knowledge_versions`, `knowledge_workflow_actions`, `knowledge_review_comments`, `knowledge_committee_approvals`, `knowledge_audit_log`, `knowledge_drafts` | M09 (workflow service; no rules, so writes are denied) |
| `articles` | M11 - `scripts/seed-ai-knowledge.ts` seeds this instead of `knowledge` |
| `featuredContent` | M05 (`/admin/featured`) |
| `quotes` | M03 and M06 (`quote.service`, `/api/quotes/*`) |
| `temple_areas` (the Firestore path) | unused - the service reads Supabase (M03/M06) |
| `test` | M05 (`/admin/test`, a debug leftover) |
| `panchanga` | documented but never queried - the data is files (M14) |

### Supabase tables (21)

| table | read or written by |
|---|---|
| `sevas` | M03 reads via `app/actions/sevas.ts`; writes still go to Firestore (split-brain) |
| `events` | M02/M06 via `services/event.service.ts` (anon client) |
| `site_settings` | M05 writes (service role), M02/M01 read (anon) |
| `social_links` | M02/M01 read; **no app code writes it** - the admin writes Firestore instead (split-brain) |
| `temple_areas` | M03 (`temple-areas.supabase.service.ts`), M06 admin API |
| `unknown_questions` | M08/M09 (`lib/ai/ai-settings/repository.ts`) |
| `ai_intent_distribution`, `ai_latency_records` | M08 reads (`ai-analytics.service`); the writes go to Firestore |
| `daily_poojas`, `seva_bookings`, `chat_sessions`, `chat_messages`, `users`, `profiles`, `donation_campaigns`, `donations`, `gallery_albums`, `gallery_media`, `testimonials`, `aaradhanes`, `volunteer_requests` | **schema only** - migrated tables with no application reader or writer (M11) |

### Non-database stores (3)

| store | owned by |
|---|---|
| Firebase Storage (`storage.rules`; `testimonials/**` is open read and write) | M04 (rules), M06 (uploads) |
| Vercel Blob (`BLOB_READ_WRITE_TOKEN`) - media, videos, saved reports | M06, M05, M14 |
| Local filesystem - `data/panchanga/**` (730 files), `public/data/panchanga/current.json`, `data/exports/*.json`, `seed/ai/*.json`, `public/images/temple`, `public/videos` | M14, M11, M06 |

---

## Cross-cutting concerns

| Concern | Where it lives | Module |
|---|---|---|
| Auth state and identity | `context/AuthContext.tsx`, `hooks/useAuth.ts`, `services/auth.service.ts` | M04 (M01 mounts the provider) |
| Admin authorization | `components/admin/layout/AdminAuthGuard.tsx` (client-side only), `lib/auth/admin-auth.ts` (`verifyAdminUser`, used by 5 routes) | M04, M12 |
| Security rules | `firestore.rules`, `storage.rules` | M04, M11 |
| Security headers and CSP | `next.config.ts` **and** `proxy.ts` - two different sets | M01 |
| Design tokens and styling | `app/globals.css` (`@theme inline`, a light set and an unused dark set), `lib/formStyles.ts` (documented, imported by nothing), hand-written temple utility classes | M01 |
| Shared UI kit | `components/ui/**`, several of which are non-functional stubs | M01 |
| Navigation | `components/layout/Navbar.tsx` (public); the inline `allNavigation` array in `components/admin/layout/AdminSidebar.tsx` (admin) | M01, M05 |
| i18n | `lib/i18n/**` (en / kn / sa), `--font-kannada` | M13 |
| Analytics | `proxy.ts` plus `services/pageviews.service.ts` (page views), `services/analytics.service.ts` (chat and intent), `services/ai-analytics.service.ts`, `services/device-analytics.service.ts`, `@vercel/analytics` | M15, M08, M13 |
| Error handling | no shared convention: services swallow errors into `[]` or `null`; routes return `{error}` or `{success:false,error}` | M10, M12 |
| Rate limiting | `lib/rate-limit.ts` (in-process `Map`, 2 routes) plus a private copy inside `app/api/chat/route.ts` | M01, M12 |
| Caching and revalidation | route-level `revalidate` / `force-dynamic`, `POST /api/revalidate`, in-memory service caches, `vercel.json` panchanga headers | M12, M06, M10 |
| Accessibility | `components/common/A11yProvider.tsx`, `hooks/a11y/index.ts`, `hooks/useReducedMotion.ts`, `SkipLink`, `LiveRegion` | M13, M01 |
| Testing | `tests/unit`, `tests/ai-uat`, the Playwright specs, `jest.config.ts` | M15 (AI UAT detail in M09) |
| CI/CD | `.github/workflows/{deploy,ai-uat,lighthouse-ci,panchanga,aaradhane}.yml`, `vercel.json` | M15 |
| Repository rules for changes | [`AGENTS.md`](../../../AGENTS.md) - planning phase, decision validation, definition of done | read before any code change |

---

## Glossary

The domain words a newcomer meets in this codebase. "Owner" is the module to ask for detail.

| Term | One line | Owner |
|---|---|---|
| **Matha** | A Hindu monastic institution; here the Sri Raghavendra Swamy Matha, the organisation the site belongs to | M02 |
| **Mutt** | The same word as Matha, and the spelling the UI copy and several settings pages use (`components/home/SevaBooking.tsx:472`, `app/admin/sevas/page.tsx`); expect both spellings in strings, and `sri-raghavendra-mutt.vercel.app` in the Postman collection (M15) | M02, M03 |
| **Rayaramatha / Rayaru** | Colloquial name for the Matha and its deployment (`rayaramathaynk.vercel.app`); "Rayaru" is the affectionate name for the saint himself | M02 |
| **Sri Raghavendra Swamy** | The 17th-century saint the Matha venerates; his biography, timeline and lineage drive several pages | M02 |
| **Mantralaya** | The town holding Sri Raghavendra Swamy's Brindavana; referenced in the timeline and content data | M02 |
| **Brindavana** | The saint's tomb-shrine; "entered Brindavana" is the phrase the content uses for his samadhi | M02 |
| **Seva** | A paid devotional service a devotee sponsors; the catalogue behind bookings and receipts | M03, M07 |
| **Seva booking** | A devotee's request for a seva on a date, carrying gotra and nakshatra; Firestore `sevaBookings` | M03, M07 |
| **Sevakarta** | The devotee who sponsors a seva - the person the booking and the receipt are in the name of; the booking terms require them to be present (`components/home/SevaBooking.tsx:472`) | M03, M07 |
| **Sankalpa** | The vow or statement of intent spoken before a seva, naming the sevakarta's gotra, nakshatra and raashi - which is why the booking form collects those three fields (`components/home/SevaBooking.tsx:407,472`) | M03, M07 |
| **Annadana** | The offering of free food to devotees; a seva and donation purpose, and a recurring theme in the About, timeline and volunteer copy and in the AI policy settings (`app/(public)/about/page.tsx`, `app/admin/ai/settings/page.tsx`) | M02, M03, M08 |
| **Pooja (Puja)** | A ritual worship; `dailyPoojas` is the temple's daily schedule, edited at `/admin/pooja` | M07 |
| **Aaradhane (Aradhana)** | The annual commemoration of a guru's passing; the Matha has 19, each on a lunar date that moves every Gregorian year | M14, M07 |
| **Guru Parampara** | The unbroken lineage of gurus (17 in this app's data); the `/guruparampara` page and the `guruParampara` collection | M02, M14 |
| **Panchanga** | The Hindu almanac: the five limbs of a day, computed for the temple's coordinates and shipped as JSON | M14 |
| **Tithi** | Lunar day (1-30); the Aaradhane generator matches on it | M14 |
| **Nakshatra** | Lunar mansion or birth star; also a field on a seva booking | M14, M03 |
| **Yoga / Karana** | Two further panchanga limbs, present in every day file | M14 |
| **Masa** | Lunar month; part of the (masa, paksha, tithi) key that defines an Aaradhane | M14 |
| **Paksha** | The waxing (shukla) or waning (krishna) fortnight | M14 |
| **Samvatsara** | The 60-year Hindu year cycle; the shipped festival list is for *Sri Parabhava* | M14 |
| **Ekadashi** | The 11th lunar day, a fasting observance; 19 dates ship in `data/calendar.ts` and have their own calendar page | M14, M03 |
| **Rahu Kalam / Yama Gandam / Gulika Kalam** | Inauspicious windows of the day, computed per date | M14 |
| **Abhijit Muhurat** | The auspicious midday window, computed per date | M14 |
| **Darshan** | Viewing of the deity; `/live` is the (entirely mock) live-darshan page | M02 |
| **Prasada** | Consecrated food offered to devotees; appears in seva descriptions and AI answers | M03, M08 |
| **Shloka** | A short Sanskrit verse; `/shlokas` renders them from `data/shlokas.ts` | M03 |
| **Stotra** | A longer devotional hymn; `/stotras` renders a hardcoded library | M03 |
| **Gotra** | Patrilineal clan name, collected on bookings and receipts for the sankalpa | M03, M07 |
| **Raashi** | Moon sign, collected alongside gotra and nakshatra | M03 |
| **Raya AI** | The site's in-house assistant: keyword and intent retrieval over temple data with bilingual template answers - no live LLM call | M08, M09 |
| **Knowledge Centre** | The public article library that Raya AI and `/knowledge` both read from Firestore `knowledge` | M09, M03 |
| **Receipt Book** | The admin's seva-receipt system: catalogue pricing, atomic numbering, an A4 PDF and a UPI QR | M07, M14 |
| **80G** | The Indian tax-deduction certificate for donations; referenced in AI policy settings and receipt copy | M08, M07 |
| **UPI** | India's instant payment rail; the only payment mechanism here, and it is self-attested - no gateway, no webhook | M03, M07 |
| **Trust / Trust committee** | The Matha's governing body; `/trust` lists members from `settings/trustCommittee` | M02, M05 |
| **Devotee** | The default signed-in role; the others are volunteer, member, admin and super_admin | M04 |

---

## Find-it recipes

Run these from the repository root. They answer "where is it" faster than reading a module.

| I want to find | Command |
|---|---|
| Which page owns a URL | `find app -path "*<segment>*" -name "page.tsx"` |
| Which route handler serves an API path | `find app/api -path "*<segment>*" -name "route.ts"` |
| Every place a Firestore collection is touched | `grep -rn "collection(db, *\"<name>\"\|doc(db, *\"<name>\"\|db.collection(\"<name>\"" app services lib hooks components scripts` |
| Every place a Supabase table is touched | `grep -rn "from(\"<table>\")\|from('<table>')" app services lib` |
| Who imports a file | `grep -rn "from \"@/<path without extension>\"" app components services lib hooks` |
| Where a component is rendered | `grep -rn "<ComponentName" app components` |
| Which files are client components | `grep -rln "^\"use client\"" app components` |
| Where a design token is defined and used | `grep -rn "\-\-<token-name>" app/globals.css components app` |
| Every admin sidebar entry | `grep -n "href:" components/admin/layout/AdminSidebar.tsx` |
| Every public nav entry | `grep -n "href" components/layout/Navbar.tsx` |
| Endpoints with no auth check | `grep -rLn "verifyAdminUser\|getAuth\|Authorization" app/api --include=route.ts` |
| Where an AI answer string is written | `grep -rn "<phrase>" lib/ai/generator.ts lib/ai seed/ai` |
| Which env vars a file needs | `grep -rn "process.env\." <path>` |
| A fault by its id | `grep -rn "M0n-Fnn" .claude/skills/temple-portal-expert/brain/` |

---

## Known problem areas

Every brain file carries a **Faults, smells and risks** table with `path:line` evidence and a
suggested fix. The counts below are the distinct fault ids in each file as of 2026-09-19.

| Module | Faults | The headline problem |
|---|---|---|
| [M01](brain/M01-foundation-and-ui-kit.md) | 48 | Three competing colour vocabularies, a dark palette nothing ever enables, and several `components/ui` primitives that are non-functional stubs (tabs, dropdown-menu, toast) |
| [M02](brain/M02-public-information-pages.md) | 41 | Almost the whole public site is `"use client"`, `/events/[id]` crashes on a Supabase date string, and no page has SEO metadata |
| [M03](brain/M03-public-devotional-and-transactions.md) | 34 | No payment gateway - bookings and donations trust a typed-in UPI reference; profile pages are gated client-side only |
| [M04](brain/M04-auth-users-and-security.md) | 40 | `/admin` is protected only by a client-side guard, and two unauthenticated routes can mint a super admin or rewrite any role |
| [M05](brain/M05-admin-platform-and-settings.md) | 37 | Twelve settings pages write `settings/*` documents no public page reads; Save on `/admin/settings` is broken |
| [M06](brain/M06-admin-content-and-media.md) | 31 | Six `/admin/gallery/*` routes for one job, uploads that silently do nothing, and unauthenticated content APIs |
| [M07](brain/M07-admin-devotional-operations.md) | 44 | Receipt detail pages read the wrong route param, invoice numbers collide, and `/api/public/receipts` returns devotee PII to anyone |
| [M08](brain/M08-raya-ai-engine.md) | 31 | Raya AI never calls an LLM - the only call site is commented out; every answer is a hardcoded bilingual template |
| [M09](brain/M09-raya-ai-console-and-knowledge-workflow.md) | 46 | The whole knowledge draft-review-approve workflow is unreachable from the UI and its writes are denied by the rules |
| [M10](brain/M10-services-and-types-catalogue.md) | 42 | No repository pattern exists; 41 files call Firebase directly; `seva.service.ts` reads Supabase and writes Firestore |
| [M11](brain/M11-data-model-persistence-and-migration.md) | 33 | Split-brain stores (sevas, social links, events), collections with no security rule, and queries with no index |
| [M12](brain/M12-api-layer.md) | 45 | 95 endpoints, 5 of which verify a token; zod appears in zero route files; `/api/calendar` is called and does not exist |
| [M13](brain/M13-device-capabilities-i18n-and-pwa.md) | 38 | Not a PWA at all - no manifest, no service worker; the Kannada translations are wired but never rendered |
| [M14](brain/M14-domain-engines-panchanga-aaradhane-receipts-reports.md) | 43 | Panchanga data runs out at the end of 2027; the receipt PDF drops Kannada text; the proof-report scripts point at a dead sandbox |
| [M15](brain/M15-testing-ci-tooling-and-repo-health.md) | 38 | Nothing gates the production deploy - no lint, typecheck or test step; `docs/DEPLOYMENT.md` is 0 bytes |
| [M16](brain/M16-collection-field-catalogue.md) | - | No `Faults` table of its own - it is an index, and its equivalent is **Orphans and mismatches**: fields written and never read, collections with no TypeScript type, and the empty Firestore/Supabase twins |

The consolidated cross-module analysis, with the React Native assessment, is in
[`docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`](../../../docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md)
(written 2026-09-19). Two companion documents sit beside it:
[`UI-REDESIGN-PLAN.md`](../../../docs/rearchitecture/UI-REDESIGN-PLAN.md) and the rendered
specimens at [`ui-redesign-specimens.html`](../../../docs/rearchitecture/ui-redesign-specimens.html).
Read the consolidated report for a cross-module verdict; each module's **Portability notes** section
remains the per-module detail behind it.

---

## Formerly unowned files - all 11 now documented

The 11 files in the Unassigned list of `.claude/state/inventory/SUMMARY.md` were claimed by no chunk
in the original split. **Every one of them is now described by a brain file** (re-checked
2026-09-19: `grep -rl <path> brain/` returns at least the named file for each). The "documented in"
column is where to read about the file; a second brain file is named where it is also relevant.

| File | Documented in | What it is |
|---|---|---|
| `components/admin/AdminHeader.tsx` (31 lines) | **M05** *Key files*, M05-F15 | **Dead.** An older duplicate of the live `components/admin/layout/AdminHeader.tsx`; zero importers. The two pairs are easy to confuse - the live pair is imported by `components/admin/layout/AdminShell.tsx:4-5` |
| `components/admin/AdminSidebar.tsx` (177) | **M05** *Key files*, M05-F15 | **Dead** duplicate of `components/admin/layout/AdminSidebar.tsx`; zero importers. Its inline `sections` array is *not* the live admin menu |
| `components/admin/DashboardCard.tsx` (34) | **M05** *Key files*, M05-F15 | **Dead** duplicate of `StatCard`; zero importers |
| `components/admin/RichTextEditor.tsx` (235) | **M06** *Key files*, M06-F11, M06-F12 | The repository's only tiptap editor and the only consumer of the five `@tiptap/*` packages - and nothing imports it. No rich-text field exists anywhere |
| `components/analytics/PageViewTracker.tsx` (55) | **M02** *Key files* (adopted), **M15** *Code roots* and *Data flow* | Live. Rendered by `app/(public)/layout.tsx:11` - the public route group only, not the root layout. Feeds `services/pageviews.service.ts`; doubles up with the `proxy.ts` writer (M01-F06) |
| `components/debug/ClientEnvDebug.tsx` (22) | **M05** *Key files* (adopted), M05-F07; also M01 | **Dead**, and would render every `NEXT_PUBLIC_FIREBASE_*` value into the DOM if it were mounted. Delete it with `/debug`, `/admin/test` and `/admin/test-firebase` |
| `scripts/export-events.ts` (97) | **M11** *Code roots* and *Data flow*; pointer from **M06** | Generates aaradhane events from the Panchanga files into `data/exports/aaradhane-events-<year>.json` |
| `scripts/import-events.ts` (93) | **M11** *Code roots*, M11-F33; pointer from **M06** | `add()`s that export into Firestore `events` with no de-duplication - running it twice doubles the calendar |
| `scripts/generate-events-firestore.ts` (345) | **M11** *Code roots* and *Data flow*; pointer from **M06**; engine in **M14** | Does both jobs in one pass against a hardcoded `TARGET_YEAR = 2026` (`:53`) |
| `scripts/update-finance-settings.ts` (114) | **M11** *Code roots*, M11-F02; pointer from **M05** *Key files* | Command-line `set()` of the whole `settings/financeSettings` document, overwriting whatever the admin page saved. Carries a hardcoded service-account key |
| `scripts/update-finance-settings.js` (133) | **M11** *Code roots*, M11-F02, M11-F32 | The committed `tsc` build artefact of the `.ts` - same job, same key, guaranteed to drift |

**Known topic gaps** - no brain section owns these. Answer from the code and add a row here.

- Next.js 16 specifics (whether `proxy.ts` is auto-registered, the new caching defaults).
  `node_modules` is absent, so `node_modules/next/dist/docs/` could not be read. Marked UNCLEAR in M01.

*Closed on 2026-09-19:* `app/(public)/pages/settings` is now described in full in
[M02 **Entry points**](brain/M02-public-information-pages.md), and the ranking logic inside
`services/search.service.ts` is M02 **Data flow** flow 7, *Search ranking*.
