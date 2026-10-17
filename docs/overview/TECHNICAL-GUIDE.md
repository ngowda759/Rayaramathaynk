# Temple Portal — Technical Guide

**Repository:** `temple-portal` (`package.json:2`) · **Date of this document:** 2026-09-19, refreshed 2026-10-18
**Audience:** an engineer who will change this code.
**Companion:** [OVERVIEW.md](./OVERVIEW.md) for the product view.

Every claim below traces to a file, a line, or a count. Where a section is a condensation, it names
the brain file under
[`.claude/skills/temple-portal-expert/brain/`](../../.claude/skills/temple-portal-expert/brain/)
that holds the full detail; the
[MIND-MAP](../../.claude/skills/temple-portal-expert/MIND-MAP.md) routes a question to the right one
of the seventeen.

---

## What changed since 2026-09-19

*Added 2026-10-18 against commit `424fdb8`; sections below were corrected where the refresh made a
sentence wrong. Each brain file's Refresh log names the commits.*

- **Mobile client.** `apps/mobile` (Expo ~57, React Native 0.86.3, expo-router; 2026-09-30): 7 tabs and a
  seva modal reading `sevas`, `events`, `daily_poojas`, `gallery_albums` and a non-existent
  `website_settings` from Supabase with the anon key against deny-all RLS; only the chat tab
  (`POST /api/chat`) works. No `packages/*`, no workspace, no mobile CI (M17-F01 to F03).
- **Prisma, unused.** `prisma/schema.prisma` mirrors nine tables; `lib/prisma.ts` has zero importers,
  yet `postinstall` runs `prisma generate` (M17-F18).
- **Raya AI engine.** `lib/ai/generator.ts` went from 1,191 to 192 lines over `lib/ai/retrieval/registry.ts`
  and `lib/ai/response/composer.ts`; settings, knowledge, chat, unknown questions and analytics moved to
  Supabase; `lib/ai/settings.ts` and `lib/ai/firebaseChat.ts` were deleted. Still no LLM. Admin knowledge
  CRUD and the AI dashboards still use Firestore (M09-F47, M09-F48).
- **Migration and CI.** ETL in `lib/supabase/migration-*.ts` with batched and staged runs; 9 new SQL
  migrations (17 files, 24 tables). `ci.yml` (2026-10-03) runs lint, typecheck, `npm test`,
  `scripts/test-boundary.sh` and build, but `deploy.yml` does not wait for it; 22 workflows; Jest unit
  files 17 to 52; 21 of 97 route files verify a token (M11, M12, M15).

---

## 1. Stack and versions

| Layer | Choice | Pinned at | What it implies here |
|---|---|---|---|
| Framework | Next.js **16.2.9**, App Router | `package.json:81` (`next: ^16.2.9`) | Route groups, Server Components by default, Route Handlers, and `proxy.ts` — Next 16's rename of `middleware.ts` |
| Runtime | React **19.2.4** | `package.json` (`react`, `react-dom`) | Server Components, `use()` semantics, async `params` in dynamic routes |
| Language | TypeScript **5.9.3**, strict | `tsconfig.json` | …but `tests/`, `scripts/` and (since 2026-09-30) `apps/mobile` are excluded from `npm run typecheck` (M15-F04) |
| Styling | Tailwind CSS **4** | `package.json` (`tailwindcss@^4`, `@tailwindcss/postcss`) | Tokens live in `app/globals.css` as `@theme inline` + CSS custom properties, not in a `tailwind.config.js` |
| Components | shadcn-style kit over `@base-ui/react` 1.6 | `components.json`, `components/ui/` | Not Radix; `dialog.tsx` and `select.tsx` wrap Base UI, while `tabs.tsx` and `dropdown-menu.tsx` are non-functional stubs (M01-F03, M01-F04) |
| Animation | Framer Motion **12.42** | `package.json` | Heavy use across `components/home/*` and the admin shell; the single biggest React Native portability cost |
| Auth + primary store | Firebase **12.15** (Auth, Firestore, Storage) | `package.json`; `lib/firebase.ts` | Client SDK is used from the browser *and* from several server routes |
| Secondary store | Supabase **2.116** (`@supabase/supabase-js`, `@supabase/ssr`) | `lib/supabase/{client,server,admin}.ts` | Migration target; three client factories — anon, SSR, service-role |
| Blob storage | `@vercel/blob` **2.6** | `services/storage.service.ts` | Needs the server-only `BLOB_READ_WRITE_TOKEN`; called from client components (M10-F03) |
| PDFs / QR | `pdf-lib` 1.17, `qrcode` 1.5 | `lib/receipt/pdf.ts` | Node-only; receipt rendering is server-side |
| Forms / validation | `react-hook-form` 7.80, `zod` 4.4 | `package.json` | Both installed; `zod` appears nowhere in `services/` (M10-F11) |
| Toasts | `react-hot-toast` **and** `sonner` | `package.json`; `app/layout.tsx:91` | Two systems installed, `react-hot-toast` is the mounted one |
| Deployment | Vercel | `vercel.json`, `.github/workflows/deploy.yml` | Read-only filesystem at runtime, which several handlers ignore |
| ORM (added 2026-10-15, unused) | Prisma **7** with `@prisma/adapter-pg` and `pg` | `prisma/schema.prisma`, `prisma.config.ts`, `lib/prisma.ts` | Mirrors nine Supabase tables; zero importers; `postinstall` runs `prisma generate` (M17) |
| Mobile client (added 2026-09-30) | Expo **~57**, React Native **0.86.3**, expo-router | `apps/mobile/package.json` | Own lockfile, own types, not an npm workspace (M17) |

**Scale (2026-10-18).** 929 source files, 178,106 lines (818 and 158,773 on 2026-09-19). 314 files
carry `"use client"`; **6** carry `server-only` (3 before). 730 JSON files under `data/panchanga/`.
97 `route.ts` files under `app/api/`.

**What "Server Components first" means in practice.** It is the documented rule
(`AGENTS.md`, "Architecture Principles") and it is not what the code does: 16 of the 20 page files
under `app/(public)` in M02 begin with `"use client"`, and the home page's Server Component does
nothing but fetch two values and hand them to a client tree (M02-F01). Treat "server component"
as an exception in this codebase, not the default.

---

## 2. Runtime topology

A browser hits Vercel. Every non-static GET first passes through `proxy.ts`, which writes a
`page_views` document and sets a second, older set of security headers on top of the eight declared
in `next.config.ts:38-63` (M01-F08 — the two CSPs conflict). The request then reaches either a
Server Component page, which renders on the server and usually delegates immediately to a client
subtree, or a Route Handler under `app/api/`.

From there the application talks to five external systems. **Firebase** provides Auth (the only live
authentication system — there is no `supabase.auth.signIn*` call anywhere), Firestore (the system of
record for most domains), and Storage. **Supabase** holds a growing set of tables reached through
three different clients (a fourth, the Prisma client in `lib/prisma.ts`, exists but nothing imports
it). **Vercel Blob** stores uploaded images, videos and generated reports.
An **LLM provider** is fully wired (`lib/ai/provider.ts` supports OpenAI, OpenRouter, Claude and
Gemini) but never called — its only call site sits inside a commented-out block at
`app/api/chat/route.ts:232-286`. **Email and WhatsApp** senders exist at `lib/services/email.ts:5`
and `lib/services/whatsapp.ts:4` with zero importers. Since 2026-09-30 a second client, the Expo app
in `apps/mobile`, reads Supabase directly and reaches the web only through `POST /api/chat` (M17).

Two things cross the boundary in the wrong direction and are worth holding in mind while reading any
call stack: the **client** Firebase SDK is used inside server Route Handlers (so Firestore rules
apply to a request that has no signed-in user, and the read returns nothing — M07-F42), and
**server-only** SDKs reach the browser: `@vercel/blob` is imported from `"use client"` components
(M10-F03), and the Supabase service-role client, now marked `import 'server-only'`, is still reachable
from client modules through `services/chat.service.ts` (M04-F43). The 2026-09-19 Site Settings leak
(M10-F04) was fixed on 2026-10-13 by moving those writes into the server action `app/actions/settings.ts`.

```
                        ┌──────────────────────────────┐
                        │  Browser (devotee / admin)   │
                        │  React 19 client components  │
                        └───────────────┬──────────────┘
                                        │ HTTPS
                        ┌───────────────▼──────────────┐
                        │  Vercel edge → proxy.ts      │  page_views write + headers
                        └───────────────┬──────────────┘
                ┌───────────────────────┴───────────────────────┐
                │                                               │
      ┌─────────▼──────────┐                        ┌───────────▼───────────┐
      │ Server Components  │                        │ Route Handlers        │
      │ app/**/page.tsx    │                        │ app/api/**/route.ts   │
      │ (mostly pass-through│                       │ (97 files, 76 with    │
      │  to client trees)  │                        │  no auth check)       │
      └─────────┬──────────┘                        └───────────┬───────────┘
                │                                               │
                └───────────────────┬───────────────────────────┘
                                    │
                      ┌─────────────▼─────────────┐
                      │ services/*.service.ts (54)│  ← the intended only door
                      │ lib/ai/*, lib/receipt/*   │
                      └─────────────┬─────────────┘
       ┌──────────────┬─────────────┼─────────────┬───────────────┐
       │              │             │             │               │
 ┌─────▼─────┐  ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐  ┌──────▼──────┐
 │ Firebase  │  │ Supabase  │ │  Vercel   │ │ LLM       │  │ Local files │
 │ Auth      │  │ anon /    │ │  Blob     │ │ provider  │  │ data/       │
 │ Firestore │  │ ssr /     │ │           │ │ (wired,   │  │ panchanga/  │
 │ Storage   │  │ service   │ │           │ │  never    │  │ (730 JSON)  │
 │           │  │ role      │ │           │ │  called)  │  │ seed/ai/    │
 └───────────┘  └───────────┘ └───────────┘ └───────────┘  └─────────────┘
                      ▲
                      │  40 files in app/, components/, hooks/ bypass
                      └── services/ entirely and hold the client SDK (M10-F05)
```

---

## 3. Repository layout

| Folder | Purpose | Owning module |
|---|---|---|
| `app/layout.tsx`, `app/globals.css` | Root document, provider stack, fonts, design tokens | M01 |
| `app/(auth)/` | Login, register, forgot-password | M04 |
| `app/(public)/` | The devotee-facing site (two route groups' worth of pages) | M02, M03 |
| `app/admin/` | The admin console, 83 `page.tsx` routes | M05, M06, M07, M09 |
| `app/api/` | 97 Route Handlers | M12 |
| `app/actions/` | Two server-action files: `sevas.ts` (reads) and `settings.ts` (Site Settings writes, 2026-10-13) | M12, M05 |
| `app/calendar/`, `app/knowledge/`, `app/debug/` | Routes deliberately outside `(public)` — no page-view tracker | M03, M05 |
| `components/ui/` | The shared kit: buttons, forms, dialogs, animation wrappers | M01 |
| `components/layout/` | `Navbar`, `Footer` — imported per page, not by a layout | M01 |
| `components/home/`, `events/`, `guru/`, `festival/`, `search/`, `recommendation/` | Public page sections | M02 |
| `components/calendar/`, `knowledge/`, `temple-explorer/` | Devotional surfaces | M03 |
| `components/admin/` | Shell, CRUD framework, per-domain admin forms | M05–M07 |
| `components/ai/` | Chat widget and provider | M09 |
| `components/device/` | Nine capability widgets, **zero consumers** | M13 |
| `context/` | `AuthContext`, `ProfileContext` | M01, M04 |
| `hooks/` | `useAuth`, `useHomepage`, `useGallery`, `useCrudTable`, a11y hooks | M01 |
| `services/` | 41 top-level services + 13 under `proof-report/` | M10 |
| `types/` | 42 declaration files — the shared vocabulary | M10 |
| `lib/firebase.ts`, `admin-firebase.ts`, `firebase-admin-rest.ts` | Three ways to reach Firestore: client SDK, Admin SDK, REST v1 | M10 |
| `lib/supabase/` | `client.ts` (anon), `server.ts` (SSR), `admin.ts` (service role, `server-only`), and the `migration-*.ts` ETL library | M04, M11 |
| `lib/ai/` | Intents, retrieval registry, response composer, generator, prompts, provider, AI settings | M08 |
| `lib/device/`, `lib/i18n/` | Capability wrappers; three dictionaries | M13 |
| `lib/receipt/`, `lib/aaradhane/`, `lib/reports/` | Domain engines | M14 |
| `data/` | `panchanga/` (730 JSON), `calendar.ts`, `sevas.ts`, `shlokas.ts`, `timings.ts` | M11, M14 |
| `seed/ai/` | 15 JSON knowledge seed files | M08, M11 |
| `supabase/` | 17 SQL migrations and `config.toml` | M11 |
| `prisma/`, `prisma.config.ts` | Prisma 7 schema mirroring nine Supabase tables, plus a baseline migration | M17 |
| `apps/mobile/` | The Expo mobile app (added 2026-09-30) | M17 |
| `.ai/` | The bot-driven development loop: config, prompts, schemas, scripts, state | M17 |
| `.github/workflows/` | 22 workflows: CI, deploy, crons, AI loop, data and Prisma operations | M15 |
| `scripts/` | Seeders, dumpers, migrators, generators (TS + Python) | M11, M14 |
| `tests/` | 50 Playwright specs, 55 Jest files (52 unit), the 275-case AI UAT corpus | M15 |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Security and index policy | M04, M11 |
| `proxy.ts`, `next.config.ts`, `vercel.json` | Request interception, headers, edge config | M01, M12 |
| `docs/` | 72 documents of varying freshness (27 on 2026-09-19) | M15 |

---

## 4. Three request lifecycles

### 4.1 Rendering the home page

1. `app/(public)/page.tsx` — Server Component, `revalidate = 60`.
2. `lib/gallery.ts:21` `getTempleGalleryImages()` — `readdirSync(public/images/temple)`, returns
   `{image,title,size}[]` off the deployment filesystem.
3. `services/daily-spiritual.service.ts` `getDashboardData()` — awaited inside a try/catch; on
   failure `dashboardData` stays `null` and the dashboard section shows a loading skeleton that never
   resolves (M02-F49).
4. Both values serialise into `<HomeClient galleryImages dashboardData>`
   (`components/home/HomeClient.tsx`). From here the tree is client-only.
5. In the browser `Hero` mounts; `hooks/useHomepage.ts` sets defaults on a `setTimeout(0)` then opens
   an `onSnapshot` on Firestore `homepage/config`. The hero shows a spinner for one tick
   (`components/home/Hero.tsx:61-67`), then the default config, then the CMS values.
6. Six further independent round-trips fire after hydration: `AnnouncementBar` →
   `services/announcement.service.ts:48`; `Panchanga` → `fetch("/data/panchanga/current.json")`;
   `UpcomingEvents → EventGrid` → `services/event.service.ts:130` → Supabase `events`;
   `RecommendationsSection` → `GET /api/recommendations`; `Testimonials` →
   `services/testimonial.service.ts:134` → Firestore; `SocialBar` → `services/settings.service.ts:83`
   → Supabase `social_links`. Since 2026-10, `UpcomingEvents` also renders a festival countdown fed
   by the static `data/calendar.ts` (no round-trip).

Full trace: [M02 § Data flow](../../.claude/skills/temple-portal-expert/brain/M02-public-information-pages.md).

### 4.2 A seva booking write

1. `components/home/SevaBooking.tsx:127` `handleSubmitClick()` — requires login, a seva and a date.
2. `components/home/SevaBooking.tsx:146` `handleBooking()` — mints a client-side reference
   `SVA-${Date.now().toString(36)}` which is **never persisted**.
3. `services/sevaBooking.service.ts:34` `createBooking()` — `addDoc` into Firestore `sevaBookings`
   with `status: "pending"`, `paymentStatus: "pending"`, using the **client** SDK, from the browser.
4. `components/home/SevaBooking.tsx:114` — the UPI payee comes from `hooks/useFinanceSettings.ts:22`
   (direct `getDoc` on `settings/financeSettings`, no service), falling back to a hardcoded literal
   (M03-F04).
5. `components/home/SevaBooking.tsx:181` `handleSavePaymentReference()` →
   `services/sevaBooking.service.ts:81` `updatePayment()` — sets `paymentStatus: "completed"`,
   `status: "confirmed"`, `paymentDate = now`. No server participates (M03-F01).
6. Read-back: `services/sevaBooking.service.ts:55` queries `where userId ==` + `orderBy createdAt`,
   for which the declared index is `userId + preferredDate` — the query throws
   `FAILED_PRECONDITION` (M11, missing indexes).
7. Public lookup: `app/api/public/receipts/route.ts:19` reads the newest 1000 `sevaBookings` with the
   **Admin** handle and substring-matches phone/email — unauthenticated, returns PII (M03-F02).

Full trace: [M03 § Data flow](../../.claude/skills/temple-portal-expert/brain/M03-public-devotional-and-transactions.md).

### 4.3 One Raya AI chat message

1. `components/ai/AIChatProvider.tsx:165` — `POST /api/chat` with
   `{messages, sessionId, userId, detectedLanguage}`.
2. `app/api/chat/route.ts:80` — `checkRateLimit()` on `x-forwarded-for`; in-memory `Map`, 20 req/60 s
   (`lib/rate-limit.ts`). This is the only gate; the route has no auth.
3. `app/api/chat/route.ts:112,124` — picks the last user message, derives `responseLanguage` by
   testing for the Kannada Unicode block.
4. `app/api/chat/route.ts:143` — `getSessionContext()` loads Firestore `chat_sessions/{id}`; if none,
   `:158` mints a UUID into `effectiveSessionId`.
5. `app/api/chat/route.ts:162` → `lib/ai/generator.ts:48` `generateResponse()` — since the 2026-09
   rewrite a 192-line orchestrator (it was 1,191 lines with 33 hand-written handlers).
6. `lib/ai/generator.ts:53` → `detectIntent()` (`lib/ai/intent/detector.ts:721`), which delegates to
   `IntentDetector.detect()` (`:204`): out-of-scope check (`:216`), keyword match over
   `INTENT_PATTERNS` (`:256`), a "semantic" pass (`:285`), then `combineResults()` (`:521`).
7. `lib/ai/generator.ts:57` reads the whole AI settings row from Supabase `ai_settings` (id `main`),
   uncached; `:127` `retrieve()` (`lib/ai/retrieval/registry.ts:17`) maps the intent to a retriever
   (`lib/ai/retrieval/index.ts:176`). For `TEMPLE_TIMINGS` that is the settings row again
   (`index.ts:196-216`); Firestore `timings` and `settings` are no longer consulted for this answer.
8. `lib/ai/generator.ts:148` → `lib/ai/response/composer.ts` formats a template in English or
   Kannada. **`usesLLM: false`** on every path.
9. `app/api/chat/route.ts:183` — `services/conversation.service.ts:127` `updateSession()` writes both
   messages into Firestore `chat_sessions` with `arrayUnion` and prunes to 20 (`:184`).
10. `app/api/chat/route.ts:192` — if `confidence < 50`, `lib/ai/unknown-logger.ts:63` inserts into
    Supabase `unknown_questions`.
11. `app/api/chat/route.ts:304-339` — returns `{message, sessionId}`, but the `sessionId` returned is
    `resolvedSessionId || crypto.randomUUID()` (`:306`), **not** `effectiveSessionId`. The web widget
    always sends its own id, so it is unaffected; the mobile app sends none and gets a fresh unused id
    every turn (M08-F05, M17-F13).

Full trace: [M08 § Data flow](../../.claude/skills/temple-portal-expert/brain/M08-raya-ai-engine.md).

---

## 5. Component trees

### 5.1 Root layout — wraps every route

```
RootLayout (server)                         app/layout.tsx:73
└─ <html lang="en" suppressHydrationWarning>
   └─ <body class="{inter} {playfair} {notoSansKannada} antialiased bg-stone-50">   :80
      └─ A11yProvider (client)              components/common/A11yProvider.tsx:16
         ├─ SkipLink                        :79
         ├─ LiveRegion                      :168   (nothing ever dispatches "a11y-announce")
         ├─ AuthProvider (client)           context/AuthContext.tsx:54
         │  └─ ProfileProvider (client)     context/ProfileContext.tsx:57
         │     └─ AIChatProvider (client)   components/ai/AIChatProvider.tsx
         │        ├─ {children}             ← the route's own layout + page
         │        ├─ <Toaster/>             app/layout.tsx:91  (react-hot-toast)
         │        └─ ChatWidget (client)    components/ai/ChatWidget.tsx
         └─ <div role="status" aria-live="polite" class="sr-only">   :54  ← second live region
```

The AI widget is hard-wired into the root layout, so it loads on `/admin` too.

### 5.2 Public route group

```
PublicLayout (server)               app/(public)/layout.tsx
├─ PageViewTracker (client)         components/analytics/PageViewTracker.tsx:30
├─ <main id="main-content" tabIndex={-1}>
│  └─ PageComponent (client, mostly)
│     ├─ Navbar (client)            components/layout/Navbar.tsx:46   ← imported by the PAGE
│     ├─ …sections…
│     └─ Footer (client)            components/layout/Footer.tsx:59   ← direct getDoc, no service
└─ GoUpButton (client)              components/ui/GoUpButton.tsx:8
```

The layout supplies **no header and no footer**. 28 page files plus `HomeClient` import `Navbar` and
`Footer` individually, so chrome changes touch 29 files and the header re-mounts on every navigation
(M01-F05). `app/calendar/*` and `app/knowledge/*` sit outside the group and get neither the tracker
nor the go-up button.

### 5.3 Admin shell

```
AdminLayout (server)                    app/admin/layout.tsx
└─ Suspense fallback=AdminLoading
   └─ AdminAuthGuard (client)           components/admin/layout/AdminAuthGuard.tsx
      │  useAuth() → {user, loading, canAccessAdmin}
      │  states: spinner | "Firebase Not Configured" | redirect /login | redirect /
      └─ AdminShell (client)            components/admin/layout/AdminShell.tsx
         ├─ AdminSidebar (client)       components/admin/layout/AdminSidebar.tsx
         │    navigation HARDCODED inline at :37-104
         │    desktop <aside> uses raw <a href> → full page reload
         ├─ AdminHeader (client)        components/admin/layout/AdminHeader.tsx
         │    └─ NotificationDropdown → hooks/useDonationNotifications.ts (60 s poll)
         └─ <main class="flex-1 p-4 …">
            └─ {children}  +  a second <main id="main-content"> from app/admin/layout.tsx:26
```

The nested `<main>` is M05-F14. `requiredPermission` on the guard is decorative — every branch of its
switch assigns `hasPermission = canAccessAdmin` (M07-F06).

### 5.4 Home page (condensed)

```
Home (server)  app/(public)/page.tsx
├─ lib/gallery.getTempleGalleryImages()            [M01]
├─ dailySpiritualService.getDashboardData()        [M03]
└─ HomeClient (client)  components/home/HomeClient.tsx
   ├─ PageTransition · Navbar                       [M01]
   ├─ AnnouncementBar → AnnouncementMarquee        → announcementService → Firestore
   ├─ Hero → useHomepage (onSnapshot homepage/config), FloatingParticles, DeepaFlame ×2 (canvas)
   ├─ SacredDivider ×7  (mandala | lotus | om | diya)
   ├─ DailySpiritualDashboard  (4 widgets defined inline in the same file)
   ├─ Panchanga        → fetch /data/panchanga/current.json   [M14]
   ├─ TempleMap        → <iframe> Google Maps, coordinates hardcoded
   ├─ UpcomingEvents → EventGrid → eventService → Supabase events   [M11]
   ├─ RecommendationsSection → /api/recommendations
   ├─ GallerySection → GalleryPreviewClient (lightbox)
   ├─ Testimonials   → testimonialService → Firestore  (6 s autoplay carousel)
   ├─ SocialBar      → settingsService → Supabase social_links
   └─ Footer                                         [M01]
```

### 5.5 A CRUD admin page

```
<admin list page> (client)
├── AdminPageHeader (server)       components/admin/common/AdminPageHeader.tsx   ← 58 importers
├── SearchBox (client)             components/admin/common/SearchBox.tsx
└── CrudTable<T> (client)          components/admin/crud/CrudTable.tsx
    │  useReactTable({ data, columns: createCrudColumns(columns, actions) })
    ├── createCrudColumns          components/admin/crud/createCrudColumns.tsx
    └── CrudTableCell              components/admin/crud/CrudTableCell.tsx
        │  render > formatter > type switch; formatters from lib/format.ts
        ├── "status"  → StatusBadge      (10 hardcoded English statuses)
        ├── "image"   → raw <img>        (not next/image)  CrudTableCell.tsx:81
        └── "actions" → TableActions     (View / Edit / Delete)
```

Only **four** list pages use `CrudTable` (`announcements`, `bookings`, `donations`, `quotes`) plus
`components/admin/events/EventTable.tsx`. Every other admin list hand-rolls a `<table>`.
`hooks/useCrudTable.ts`, `lib/crud-columns.tsx` and `CrudToolbar.tsx` have zero importers (M05-F37).

More trees: [M01](../../.claude/skills/temple-portal-expert/brain/M01-foundation-and-ui-kit.md),
[M05](../../.claude/skills/temple-portal-expert/brain/M05-admin-platform-and-settings.md),
[M06](../../.claude/skills/temple-portal-expert/brain/M06-admin-content-and-media.md),
[M07](../../.claude/skills/temple-portal-expert/brain/M07-admin-devotional-operations.md),
[M09](../../.claude/skills/temple-portal-expert/brain/M09-raya-ai-console-and-knowledge-workflow.md).

---

## 6. The service layer and the SDK boundary

`services/` is meant to be the only door to data: `docs/ARCHITECTURE.md:100` states "All data access
goes through services. Never call Firestore directly," and `:188-196` declares an `IService<T>`
interface. What exists is 41 top-level service modules plus 13 under `services/proof-report/`, with
no common interface, no shared error type, no validation and no transaction discipline. Some are
object singletons, some are bags of free functions, and they sit on top of four different transports.
Knowing which transport a service uses is the single most useful thing to check before changing it,
because it determines where the code can run and whether security rules apply.

**Four transports.** Most services (`sevaBookingService`, `donationService`, `poojaService`,
`announcementService`, `billingService`, `galleryService`, `homepageService`, `aaradhaneService`,
`quoteService`, `profileService`, `userService`, `volunteerService`) use the **Firebase client SDK**
from `lib/firebase.ts:220`. They run wherever they are imported — browser or server — and they are
constrained only by `firestore.rules`. Three services (`eventService`, `settingsService`,
`templeAreasService`) use **Supabase**, and `templeAreasService` reaches for the service-role admin
client; since October 2026 `chat.service` (browser anon client, against deny-all policies - M10-F44)
and the AI analytics, settings and knowledge repositories do too. Two (`receiptService`, `receiptSevaService`) are **HTTP clients**: they `fetch` the
`/api/admin/receipts*` routes and the caller supplies a Firebase ID token — the only services in the
repository that authenticate. `storageService` wraps **`@vercel/blob`** and needs a server-only
token. A fifth group (`ml.service`, `ux.service`, `content.service`, `search.service`,
`recommendation.service`, `multi-source-retrieval.service`, `knowledge.service`) has no store at all
and composes the others.

**Where the boundary leaks.** Three leaks recur and explain most of the "it silently does nothing"
behaviour in this codebase. First, **server-only SDKs called from the browser**:
`services/storage.service.ts:69` (`@vercel/blob` `put`) is reached from
`components/ui/ImageUploader.tsx:67` and throws in a deployed build, so uploads cannot succeed
(M06-F01). The second example of 2026-09-19 - `services/settings.service.ts` importing the Supabase
service-role client into a `"use client"` admin page - was moved into the server action
`app/actions/settings.ts` on 2026-10-13, but Site Settings saves still fail: the action expects an
`Authorization: Bearer` header that a browser-invoked server action never sends (M05-F02). Second, the **client SDK used
server-side**: `app/api/bookings/route.ts` and `app/api/donations/route.ts` call client-SDK services
from a Route Handler, where there is no signed-in user, so the rules deny the read and the list is
permanently empty (M07-F42). Third, **`window` guards that silently degrade**:
`services/testimonial.service.ts` short-circuits to `null` whenever `window` is undefined, so every
server render and every API route gets four hardcoded default testimonials instead of real data
(M10-F06).

**Dead and duplicated services.** `dashboard.service.ts` and `dashboard.service.client.ts` export the
same name and have zero importers between them; `report.service.ts` has none; `lib/services/email.ts`
and `lib/services/whatsapp.ts` are complete senders nobody calls; `temple-areas.service.ts` and
`temple-areas.supabase.service.ts` overlap; `chat.service` and `testimonial.service` both claim the
`testimonials` collection with different semantics, so the admin console shows two different pending
counts (M10-F12). Full per-service table, including exported functions and importer counts:
[M10](../../.claude/skills/temple-portal-expert/brain/M10-services-and-types-catalogue.md).

---

## 7. The HTTP surface

97 `route.ts` files under `app/api/`, two server-action files (`app/actions/sevas.ts`,
`app/actions/settings.ts`), an in-memory rate limiter (`lib/rate-limit.ts`) and `vercel.json`. Most handlers are thin: parse query params, a
truthiness check or two, call one service function, `NextResponse.json`. This is also the contract a
React Native client would consume, so it is worth reading as an API rather than as plumbing.

Six domains group the routes. Devotee reads (`/api/events`, `/api/announcements`,
`/api/temple-areas`, `/api/knowledge/*`, `/api/search`, `/api/recommendations`). Devotee writes
(`/api/bookings`, `/api/donations`, `/api/volunteer`, `/api/testimonials`). Raya AI
(`/api/chat` plus 24 routes under `/api/ai/*`, including `/api/ai/health` and `/api/ai/public-settings`
added in October 2026). The billing desk (`/api/admin/receipts*`, `/api/admin/receipt-sevas*`) —
authenticated via `verifyAdminUser` and a Bearer ID token, as are now the nine `/api/ai/settings/*`
routes, `/api/ai/health` and `/api/seed-ai-settings` (`requireAdminUser`) and the aaradhane, prompts
and quotes POST routes. Content and knowledge administration (`/api/admin/*`, `/api/knowledge/workflow/*`).
And operational utilities (`/api/revalidate`, `/api/seed-ai-settings`, `/api/storage/videos`,
`/api/gallery/local-assets`, `/api/supabase-check`).

The layer's defining weakness is authentication: **76 of the 97 route files still have no real
identity check** (88 of 95 on 2026-09-19). 21 now call `verifyAdminUser` or `requireAdminUser`
(`lib/auth/admin-auth.ts`, restructured 2026-10-15 to return 401/403/503 with a reason). Among the
unguarded routes are `POST /api/admin/users/create-admin` (writes a `super_admin`) and
`POST /api/admin/users/set-role` (privilege escalation) - both latent today because they use the
client SDK (M04-F04, M04-F05) - `DELETE /api/gallery/local-assets` (unlinks files from disk), and
`GET /api/public/receipts` (returns devotee names, phone numbers and payment references for any
substring). `POST /api/seed-ai-settings` is now admin-only and idempotent. The unverified
`x-user-id` / `x-user-email` actor headers of 2026-09-19 are gone (M12-F17, fixed). Guarding was done
per method, so some families are half-guarded and their callers broke: the quote-create page sends
no token and now gets 401 (M12-F47).

Naming is inconsistent in a way that costs time: knowledge is served by `/api/knowledge`,
`/api/admin/knowledge` and `/api/ai/knowledge`, each backed by a different store path; temple areas
by both `/api/temple-areas` and `/api/admin/temple-areas`, with the *public* twin carrying the
unauthenticated writes. Rate limiting exists (`lib/rate-limit.ts`, an in-process `Map` that resets on
every cold start) and is applied to exactly three routes. Full route-by-route table:
[M12](../../.claude/skills/temple-portal-expert/brain/M12-api-layer.md).

---

## 8. Data

### 8.1 Store catalogue

Firestore is the system of record for most domains. The full collection table — 50+ collections with
rule status, index status and a representative call site — is in
[M11 § Types and stores](../../.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md).
For the **fields inside** those collections and tables — every field with the `path:line` of each
writer and reader, plus the nineteen collections that have no TypeScript type — go one level in to
[M16 Collection and table field catalogue](../../.claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md).
The headline grouping:

| Domain | Firestore collections | Supabase tables | Module |
|---|---|---|---|
| Identity | `users`, `profiles`, `bookmarks` | `users`, `profiles` (data copy, unread) | M04 |
| Sevas and bookings | `sevas`, `receiptSevas`, `sevaBookings`, `dailyPoojas`, `poojas` | `sevas` (read), `seva_bookings` (data copy, unread), `daily_poojas` (read only by the mobile app) | M03, M07 |
| Money | `donations`, `donation_campaigns`, `receipts`, `bills`, `system` (receipt counter) | `donations` (unread) | M07, M14 |
| Content | `events`, `announcements`, `gallery`, `galleryAlbums`, `galleryMedia`, `testimonials`, `quotes`, `homepage`, `settings` | `events` (live), `site_settings` (live), `social_links` (read), `temple_areas` (live), `gallery_albums`/`gallery_media` (read only by the mobile app), `settings_documents` (JSONB copy, unread) | M02, M06 |
| Devotional | `aaradhane`, `aaradhanes`, `guruParampara`, `timings` | `aaradhanes` (unread) | M07, M14 |
| People | `members`, `volunteers`, `volunteer_requests` | `volunteer_requests` (unread) | M07 |
| AI | `chat_sessions` (server session), `messages`, `chatTraining`, `ai_settings`, `unknown_questions`, `ai_unknown_questions`, `ai_token_usage`, `ai_latency_records`, `ai_intent_distribution`, `knowledge` - most now legacy, still read by the admin screens | `ai_settings`, `ai_knowledge`, `unknown_questions`, `ai_latency_records`, `ai_intent_distribution` (live since October 2026), `chat_sessions`/`chat_messages` (written through a deny-all policy, M10-F44) | M08, M09 |
| Knowledge workflow | 7 collections, **no rules, no reachable UI** | — | M09 |
| Analytics | `page_views`, `daily_page_stats`, `chat_metrics`, `intent_metrics`, `intent_feedback` | — | M15 |
| Non-database | `data/panchanga/**` (730 JSON), `data/calendar.ts`, `data/shlokas.ts`, `seed/ai/*.json` | — | M14, M11 |

### 8.2 Migration state per domain

| Domain | State | Evidence |
|---|---|---|
| Sevas | **Split brain** — reads Supabase, writes Firestore | `services/seva.service.ts:11` vs `:76,81,86` |
| Social links | **Split brain** — admin writes Firestore `settings/socialLinks`, public reads Supabase `social_links`; only the ETL writes the table | `app/admin/settings/social-links/page.tsx:33,89` vs `services/settings.service.ts:83` |
| Events | **Dual and diverging** — `event.service` uses Supabase; admin content pages and the Aaradhane generator still write Firestore `events` | `services/event.service.ts:46` vs `app/admin/content/page.tsx:89`, `lib/aaradhane/firestore.ts:41` |
| Site settings | **Supabase only** — read with the anon client, written through the server action | `services/settings.service.ts:43`, `app/actions/settings.ts` |
| Temple areas | **Supabase only** | `services/temple-areas.supabase.service.ts:6` |
| AI settings | **Supabase for the bot** since `fae5d51` (2026-10-06); a legacy Firestore document still gates analytics (M11-F46) | `lib/ai/ai-settings/repository.ts` |
| AI knowledge | **Split brain** — the bot reads Supabase `ai_knowledge`, the admin screens and import API write Firestore `knowledge` (M11-F34) | `lib/ai/knowledge/repository.ts` vs `app/api/ai/knowledge/import/route.ts:114` |
| AI analytics | **Supabase write / admin page reads Firestore** — reversed since 2026-10-13, and the two still never meet (M11-F36) | `services/ai-analytics.service.ts` vs `app/admin/ai/analytics/page.tsx` |
| Unknown questions | **Two live stores** — `lib/ai/unknown-logger.ts` writes Supabase; the generator's low-confidence path still writes Firestore through `services/analytics.service.ts` (M11-F08) | M11 § Migration state |
| Chat sessions and messages | **Supabase through a deny-all policy** for the widget's history; the server session and the admin counters stay on Firestore | `services/chat.service.ts`, `services/conversation.service.ts:127` |
| Users, profiles, donations, gallery, testimonials, aaradhane, volunteers, seva bookings | **Schema plus data copy** — loaded by the migrators, no web reader (the mobile app reads `gallery_albums`) | M11 |
| Quotes, receipts, bills, announcements, homepage, members | **Firestore only** | `services/quote.service.ts:288` etc. |
| Panchanga | **Static files, never in a database** | `lib/aaradhane/panchanga.ts:65` |

On 2026-09-19 four migration files carried stamps after that day. On 2026-10-18 none does, but four of
the nine files added since were stamped between files that already existed, and two are ledger-only
markers for versions applied out of band, so the repository is being reconciled to the remote ledger
(M11-F13).

### 8.3 Security rules, in summary

`firestore.rules` is additive: allow-rules OR together, and a collection with no `match` block is
denied by default. Both properties bite here.

- **World-writable by accident.** `match /settings/{docId}` is declared twice and the second block
  allows `write: if true` (`firestore.rules:136-139` and `:231-234`) — every settings document is
  publicly overwritable. `ai_settings` is world-readable *and* world-writable (`:226-229`), so the AI
  system prompt store is open.
- **Denied by accident.** 23 collections the code actively uses have no `match` block at all (25 on 2026-09-19) —
  including `profiles`, `bookmarks`, `dailyPoojas`, `chatTraining`, `featuredContent` and all seven
  knowledge-workflow collections — so those client-SDK reads and writes are denied and the errors are
  swallowed into empty UI states.
- **Storage.** `storage.rules:5-8` lets anonymous callers write to `testimonials/**` with no size or
  content-type limit, and any signed-in user read or write any object.
- **Correctly tight.** `receipts` is server-write only (`:102`) and `system` (the receipt counter) is
  deny-all (`:108`) — the Receipt Book's discipline shows here.
- **No request-time authorization.** The only request-time interceptor is `proxy.ts`, which writes
  `page_views` and sets headers and authorizes nothing; `app/admin/layout.tsx:22-31` is a client-side
  gate only (M04-F08).

Full rule-by-rule reading: [M04](../../.claude/skills/temple-portal-expert/brain/M04-auth-users-and-security.md).

### 8.4 Indexes

`firestore.indexes.json` declares 22 composite indexes. Six are declared and used
(`sevas` active+displayOrder, `events` published+startDate, `testimonials` approved+createdAt,
`chat_sessions` userId+updatedAt, `knowledge` approved+category+title, two on `quotes`). **Twelve
queries run without the index they need** and throw `FAILED_PRECONDITION` — notably `sevaBookings`
(declared on the wrong second field), `announcements` (declared on `active` while the type and the
code say `isActive`), `messages` (declared on a collection group `chat_messages` that no code
queries), `galleryMedia`, `bills`, and all six knowledge-workflow queries. Three single-field `ai_*`
entries are no-ops because Firestore indexes single fields automatically. Since the October 2026
moves to Supabase, the `chat_sessions` and `knowledge` indexes serve no query and the `messages`
row is moot. Full table in M11.

---

## 9. The Raya AI pipeline

`POST /api/chat` → rate limit → language detection → session load → `generateResponse()` →
`detectIntent()` → settings read → `retrieve()` through the retrieval registry → the response composer's
template → session write → response. (Until the 2026-09 rewrite the middle was one of 33 hand-written
generator handlers.)

**Intent detection** (exported `detectIntent()` at `lib/ai/intent/detector.ts:721`, delegating to
`IntentDetector.detect()` at `:204`) is four passes: an out-of-scope guard, a
keyword match over `INTENT_PATTERNS`, a "semantic" pass that is keyword overlap rather than
embeddings, and `combineResults()`. Domain keywords can override outright — "temple timings" returns
`TEMPLE_TIMINGS` at confidence 100 via `detector.ts:334`.

**Retrieval** is per-intent, now through one map: `lib/ai/retrieval/registry.ts` sends each of 20
mapped intents to a retriever (`lib/ai/retrieval/index.ts:87-171`). Temple timings and contact come
from the Supabase `ai_settings` row (`index.ts:196-216`); events still come from Firestore `events`,
although the admins now write Supabase `events` (M08-F34); `retrieval/panchanga.ts:42` reads
`public/data/panchanga/current.json` off disk; `lib/ai/knowledge/repository.ts` reads Supabase
`ai_knowledge` where `approved` is true and ranks with a hand-rolled score (title +10, content +5,
keyword +15), falling back to in-code `SEED_ARTICLES` when the table is empty.

**Generation** is template filling. `lib/ai/response/composer.ts` formats an English or Kannada
template from the retrieved data and the admin-editable `aiResponses` strings. `usesLLM` is `false` on
every path. The provider layer (`lib/ai/provider.ts`, four providers, `max_tokens 2000`, no timeout,
no retry) is complete and unreachable — its only call site is commented out at
`app/api/chat/route.ts:232-286`. `GET /api/chat` nevertheless reports the configured provider and
model name publicly.

**The consequences worth knowing before you touch it.** Editing the system prompt in the admin
console changes nothing (M09-F01). Every analytics recorder — token usage, latency, intent
distribution — has zero callers, so every AI chart reads an empty collection (M08-F07). Unknown
questions are written to two stores and triaged from both (M08-F08, M11-F08). A settings row that
fails validation on read is overwritten with defaults, so one malformed admin save wipes the AI
settings (M08-F32). The dress-code mix-up of 2026-09-19 (M08-F30) is fixed. The 275-case UAT suite
asserts only that *an* intent was detected, never which one (M09-F07).

Full pipeline: [M08](../../.claude/skills/temple-portal-expert/brain/M08-raya-ai-engine.md).

---

## 10. Build, test, CI/CD and deployment

**Scripts** (`package.json`): `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`),
`test` (jest), plus seeders (`seed:ai`, `seed-receipt-sevas`, `setup-admin`), generators
(`generate:aaradhane`, `generate:proof-report`), the AI UAT runners, the Firestore dump/convert
chain, and since October 2026 the staged and batched migrators and seven `prisma:*` scripts (49
scripts in all, 25 on 2026-09-19). Note that `npm run typecheck` excludes `tests/`, `scripts/` and
`apps/mobile` via `tsconfig.json`, so roughly 20k lines of the web repo are unchecked (M15-F04).

**Tests.** 50 Playwright spec files, 52 Jest unit files (17 on 2026-09-19; jsdom and `.test.tsx`
since October 2026), a 275-case AI UAT corpus (`tests/ai-uat/test-cases.ts`, 15 categories including
`PROMPT_INJECTION`, `KANNADA`, `MIXED`), the `tests/automation-loop/` tests, seven Python report
generators and two shell runners (144 files, ~49,000 lines on 2026-09-19). The Playwright config is
never applied: `tests/playwright.config.ts:9` sets `testDir: './tests/e2e'`, which resolves to
`tests/tests/e2e`, a path that does not exist, and there is no root config (M15-F01). Thirteen test
files point at dead OpenHands sandbox hosts (M15-F03).

**Workflows** (`.github/workflows/`):

| Workflow | Trigger | What it does | State |
|---|---|---|---|
| `ci.yml` (added 2026-10-03) | push and PR to `main` | lint, typecheck, `npm test`, `scripts/test-boundary.sh`, build | Gates pull requests, not the deploy; green partly through 35 blanket `eslint-disable` lines (M15-F40) |
| `deploy.yml` | push to `main`, `workflow_dispatch` | Node 22 → `npm ci` → `vercel pull/build/deploy --prod` | **No lint, typecheck or test step, and does not wait for `ci.yml`** (M15-F02) |
| `panchanga.yml` | cron ×4 daily | Python 3.11 + `pip install panchang` → `scripts/generate_panchanga.py` → commits `public/data/panchanga/current.json` | Works; the comment claiming "every 2 hours" is wrong |
| `aaradhane.yml` | cron `30 3 1 1 *`, `workflow_dispatch` | Regenerates a year of panchanga if needed, then `scripts/generate-aaradhane.ts` writes Firestore `events` | The live-update step is gated on a value computed before the step that sets it (M14-F06) |
| `ai-uat.yml` | — | Jest UAT job (blocking) + Playwright job (`continue-on-error: true`), everything mocked | Runs, asserts little |
| `lighthouse-ci.yml` | — | Lighthouse against budgets | `staticDistDir` misconfigured (M15-F18) |
| `ai-loop-*.yml` (5, added 2026-10) | push, PR closed, `workflow_run` | the `.ai/` loop: Jules implements, an OpenRouter model reviews, a merge gate that never merges (`autoMerge: false`) | A human merges every PR; tasks were marked done from brief-only PRs (M17-F04) |
| 11 dispatch-only jobs (added 2026-09/10) | `workflow_dispatch` | Firestore export, staged and batched migration, diagnostics, Supabase migration push, Prisma drift gate and baseline resolve | Run against production stores (M15-F42; M11, M17) |

**Deployment** is Vercel. `vercel.json:3-21` forces `no-store` on the panchanga JSON. An empty
`.deployment-trigger` file at the root exists to be touched to force a build. There is **no
deployment runbook**: `docs/DEPLOYMENT.md` is 0 bytes, as is `docs/CHANGELOG.md`.

Full inventory: [M15](../../.claude/skills/temple-portal-expert/brain/M15-testing-ci-tooling-and-repo-health.md).

---

## 11. Conventions — documented, and observed

| Rule (`AGENTS.md`, `docs/CODING-STANDARDS.md`) | Observed | Evidence |
|---|---|---|
| "Server Components first" | Broken | 314 of 929 files carry `"use client"` (2026-10-18); 16 of 20 M02 page files are client (M02-F01) |
| "No direct Firebase calls — use services only" | Broken | **40 files** in `app/`, `components/`, `hooks/` hold the client SDK; 84 import lines across 46 files including the legitimate Admin-SDK routes (M10-F05; 41 files on 2026-09-19) |
| "No `any` type" | Not enforced | `eslint.config.mjs:14-33` disables `@typescript-eslint/no-explicit-any` for `app`, `components`, `hooks`, `lib`, `services`, `types`, `scripts` and, since 2026-10-03, `tests` — i.e. everything; 35 files also carry a blanket `/* eslint-disable */` (M15-F05, M15-F40) |
| "Validate all inputs — server-side validation required" | Not done | `zod` is a dependency but appears nowhere in `services/` (M10-F11) |
| "Repository pattern, `IService<T>`" | Aspirational | 54 services share no interface; `docs/ARCHITECTURE.md:188-196` describes an interface no service implements |
| "Never commit secrets" | Broken | Firebase web config hardcoded as `\|\|` fallbacks (`lib/firebase.ts:57-65`, `proxy.ts:8-13`; the copy in `app/api/seed-ai-settings/route.ts` was removed on 2026-10-15); a service-account private key appears in nine files under `scripts/` (M11-F02); the Postman collection carries a real API key (M15-F07) |
| "Use `next/image`" | Partial | `CrudTableCell.tsx:81` and `RecommendationCard.tsx:65` use raw `<img>` |
| "Tests added or updated", "`npm run build/lint/typecheck` passes before push" | Partly gated | `ci.yml` runs all of them on push and PR since 2026-10-03 (M15-F23 fixed); the deploy does not wait for it (M15-F02) |
| Two design systems, three colour vocabularies, three date formatters, two toast libraries, two search components | Drift | M01 § Faults |

---

## 12. Where to look

| Task | File(s) | Brain section |
|---|---|---|
| Change the site header, footer or navigation | `components/layout/Navbar.tsx:16-44`, `Footer.tsx:27-57` — and 29 importing pages | M01 § Component trees |
| Change a colour, radius, shadow or font | `app/globals.css` (`@theme inline` + token sets) | M01 § Design tokens |
| Add a public page | `app/(public)/<slug>/page.tsx`; remember to import `Navbar`/`Footer` yourself | M02 § Entry points |
| Change what the home page shows | `components/home/HomeClient.tsx` and the section component beside it | M02 § Component trees |
| Change the seva booking flow | `components/home/SevaBooking.tsx`, `services/sevaBooking.service.ts` | M03 § Data flow |
| Add or change an admin screen | `app/admin/<slug>/page.tsx`; nav entries are hardcoded at `components/admin/layout/AdminSidebar.tsx:37-104` | M05 § Component trees |
| Build an admin list the intended way | `components/admin/crud/CrudTable.tsx` + `types/crud.ts` | M05 § Component trees |
| Change a settings page | `app/admin/settings/<slug>/page.tsx` — then verify a public page actually reads that document | M05 § Faults (M05-F03, M05-F04) |
| Touch events | `services/event.service.ts` (Supabase) — but check the Firestore writers too | M06, M11 § Migration state |
| Upload media | `services/storage.service.ts` — there is **no upload API route**; this is broken in production | M06 § Faults (M06-F01) |
| Issue or change a receipt | `app/api/admin/receipts/route.ts`, `lib/receipt/pdf.ts`, `lib/receipt/admin.ts` | M07, M14 |
| Add an AI intent or answer | `lib/ai/intent/detector.ts`, `lib/ai/retrieval/registry.ts`, `lib/ai/response/composer.ts` | M08 § Data flow |
| Turn the LLM back on | `app/api/chat/route.ts:232-286` (commented), `lib/ai/provider.ts` | M08 § LLM provider configuration |
| Add a service | `services/<name>.service.ts` + a type in `types/` | M10 § Key files |
| Add or change an API route | `app/api/<path>/route.ts` — add an auth check; almost none have one | M12 § Entry points |
| Add or rename a field on a collection | the `types/` file if one exists, then every writer and reader the catalogue lists | M16 § the collection's field table, then § How to change it |
| Find out who writes a field, or whether it is dead | — | M16 § the collection's field table, then § Orphans and mismatches |
| Change a Firestore rule or index | `firestore.rules`, `firestore.indexes.json` | M04, M11 § Indexes |
| Add a Supabase table | `supabase/migrations/` — mind the interleaved stamps and the ledger markers (M11-F13); mirror it in `prisma/schema.prisma` only after the SQL exists | M11 § Migration state, M17 § How to change it |
| Change the mobile app | `apps/mobile/app/(tabs)/*.tsx`, `apps/mobile/lib/api.ts` — better, add public `GET /api/*` routes first | M17 § How to change it |
| Pause or change the AI development loop | `.ai/loop.config.json` (`automation`, `protectedPaths`) | M17 § How to change it |
| Use a device capability | `lib/device/*` hooks (`useShare`, `useLocation`, `useNotifications`) | M13 § Key files |
| Translate a string | `lib/i18n/dictionaries/` — no `I18nProvider` is mounted anywhere | M13 § Faults (M13-F02) |
| Extend the panchanga or festival data | `scripts/generate_panchanga.py`, `data/calendar.ts`; data ends 2027-12-31 | M14 § Faults (M14-F03) |
| Add a test | `tests/unit/` (Jest) or `tests/e2e/` (Playwright, config currently broken) | M15 § Key files |
| Change the deploy | `.github/workflows/deploy.yml`, `vercel.json` | M15 § Data flow C |

---

## 13. Existing documentation, graded

Link these, but read them against the code.

| Document | State as of 2026-09-19 (rows updated 2026-10-18 where the code moved) |
|---|---|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | **Partially stale** — `:18` says "Next.js 14"; the `IService<T>` interface at `:188-196` does not exist in code |
| [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) | **Stale** — Next.js 14; lists 2 API route groups against 97 route files; no `lib/ai`, `lib/i18n`, `lib/supabase`, `lib/receipt` |
| [DATA-MODEL.md](../DATA-MODEL.md) | **Partially stale** — predates the Supabase work; field names disagree with `types/seva-booking.ts` |
| [RAYA_AI_ARCHITECTURE.md](../RAYA_AI_ARCHITECTURE.md) | **Stale** — cut to 43 lines in October 2026; still contradicts the knowledge repository, and no LLM is called at runtime |
| [API.md](../API.md) | **Stale** — documents 3 endpoints out of 97 |
| [SECURITY.md](../SECURITY.md) | **Partially stale** — predates the receipts-auth episode recorded in `REPORT.md` |
| [CHANGELOG.md](../CHANGELOG.md), [DEPLOYMENT.md](../DEPLOYMENT.md) | **Empty** — 0 bytes |
| [QUALITY_ASSESSMENT_REPORT.md](../QUALITY_ASSESSMENT_REPORT.md) | **Stale** — Next.js 14; its P0 "add sitemap.xml" is still open |
| [ROADMAP.md](../ROADMAP.md) | **Partially stale** — deprecates files that do not exist; lists shipped features as unbuilt |
| `REPORT.md` (repo root) | **Replaced** — on 2026-09-19 it recorded removing auth from the admin receipts API; since `9f3cad6` / `69d7f2d` it holds a migration-blocker note (M15-F08 fixed). The new root reports are graded in M17 and M15 |

Full grading of all 72 `docs/` files and the root reports:
[M15 § Key files](../../.claude/skills/temple-portal-expert/brain/M15-testing-ci-tooling-and-repo-health.md).

Written in the same pass as this guide, and current as of 2026-09-19:
[REACT-NATIVE-MIGRATION-AND-FAULTS.md](../rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md) —
the consolidated cross-module fault report and the React Native portability verdict —
[UI-REDESIGN-PLAN.md](../rearchitecture/UI-REDESIGN-PLAN.md) and the rendered
[ui-redesign-specimens.html](../rearchitecture/ui-redesign-specimens.html). Read those before
proposing a rewrite.
