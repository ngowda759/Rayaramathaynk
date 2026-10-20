# M10 - Service layer and type catalogue - the repository pattern as built

> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against HEAD 424fdb8 (see **Refresh log (2026-10-18)** at the end). Verify against the code before acting on any claim.

## Answers questions about

- "where does data actually come from for X" - which service owns which Firestore collection or Supabase table
- "how do I add a new entity (CRUD service) to this codebase" - the copy-paste shape every service follows
- "is this project on Firestore or Supabase" - both, per-entity, with no adapter; see **Types and stores**
- "why does saving a seva not show up in the list" - `seva.service.ts` reads Supabase and writes Firestore
- "does the repository pattern in docs/ARCHITECTURE.md exist" - no; no service implements `IService<T>`
- "where are the direct Firebase calls that AGENTS.md forbids" - 40 files (re-grepped 2026-10-18), listed with `file:line`
- "which services are safe to call from a client component and which are not"
- "which services are dead code / have zero importers"
- "which services are duplicates of each other" (dashboard, testimonials, temple-areas, seva/sevaBooking/billing/receipt)
- "how is auth/login persisted" - `auth.service.ts` writes `users/{uid}` from the browser
- "how are receipts emailed / WhatsApped" - they are not; the route is a stub
- "how are file uploads done" - Vercel Blob via `storage.service.ts`, called from client components
- "what caching, pagination and error handling conventions exist" - in-memory module caches, almost no pagination, errors swallowed into `[]`/`null`
- "where is the type for a Seva / Booking / Donation / Receipt / Bill / Quote"
- "which types are duplicated under different files" - 17 duplicated exported names
- "what breaks if we move to React Native" - see **Portability notes**
- "which services could a React Native app reuse unchanged"
- "how do admin pages read Firestore" - mostly not through services at all
- "who calls this service" - see **Who imports each service**, named importers per file
- "can anyone write to the database without logging in" - yes, `POST/PUT/DELETE /api/temple-areas*` (M10-F42)
- "where do the analytics numbers on the admin dashboard come from" - `pageviews.service.ts`, estimated, not measured
- "what does `lib/firebase.ts` export and why is `db` sometimes null"
- "how does the Firebase Admin SDK get credentials on Vercel"
- "which services the AI (Raya) calls" - the boundary with M08/M09
- "how are site settings saved now" - through the `"use server"` actions in `app/actions/settings.ts`, which currently reject every browser call as `Unauthorized` (M10-F43)
- "where do Raya chat sessions and messages live" - Supabase `chat_sessions` / `chat_messages` since 2026-10-06, written by `chat.service.ts` with the anon client that RLS denies (M10-F44); `conversation.service.ts` still uses Firestore `chat_sessions`
- "where does AI analytics (latency, intent, unknown questions) come from" - Supabase since BOT-004 (2026-10-13); token usage and `ai_settings` still Firestore (M10-F45, F46)
- "how does the Admin SDK accept a whole service-account JSON" - `FIREBASE_SERVICE_ACCOUNT_JSON`, checked first by `lib/admin-firebase.ts:57`
- "which temple areas are wheelchair accessible" - `AccessibilityInfo` on `TempleArea` in `types/temple-explorer.ts:6,:28`

---

## Purpose and business role

M10 is the data-access and vocabulary layer of the temple portal. Everything the site knows about
sevas, bookings, donations, receipts, bills, events, poojas, aaradhanes, the gallery, the homepage,
announcements, quotes, testimonials, members/volunteers, users, profiles and AI analytics is read and
written through the 54 modules under `services/` (41 top-level + 13 under `proof-report/`), using the 42 TypeScript declaration files under
`types/` as the shared vocabulary, on top of three connection modules in `lib/`.

For devotees, this layer is what turns a booking form into a `sevaBookings` document and a donation
form into a `donations` document. For the temple office, it is what backs every admin list, every
receipt and every bill. For Raya AI (M08/M09) it is the "structured retrieval" source that AGENTS.md
requires facts to come from.

In intent it is a repository layer: `docs/ARCHITECTURE.md:100` states "All data access goes through
services. Never call Firestore directly," and `docs/ARCHITECTURE.md:188-196` declares an `IService<T>`
interface. In practice it is a loose bag of singletons with no common interface, no validation, no
transaction discipline, and two different databases behind it - the codebase is mid-migration from
Firestore to Supabase and both halves are live at once. 40 files in `app/`, `components/` and
`hooks/` bypass the layer entirely and hold the client Firebase SDK themselves (84 such import lines
across 46 files once the 6 legitimate Admin-SDK API routes are included - see **Direct Firebase
access outside the service layer**; counts re-grepped 2026-10-18).

---

## Code roots

From `.claude/state/chunks.json` (id M10), unchanged - no files adopted from the Unassigned list:

```
services/                      41 top-level *.service.ts  (incl. 1 re-export shim)
services/proof-report/         13 *.service.ts  (site-audit engine; domain logic owned by M14)
types/                         42 *.ts
lib/services/                  email.ts, whatsapp.ts
lib/settings/                  temple.ts
lib/firebase.ts                client Firebase SDK singleton
lib/admin-firebase.ts          Firebase Admin SDK singleton
lib/firebase-admin-rest.ts     Firestore REST fallback (server-only)
```

102 files, 21,155 lines (`.claude/state/inventory/M10.json` `totals`, regenerated 2026-10-18; 20,960 on 2026-09-19).
No file was added to or deleted from M10 between the two dates; 11 were modified (see Refresh log).

Deliberately **not** owned here although closely related: `lib/supabase/{client,server,admin}.ts`
(M11), `lib/ai/knowledge/repository.ts` (M08 - the only file in the repo that is actually named a
repository), `app/actions/sevas.ts` (M12, the sole server action in the repo).

---

## Entry points

M10 has no routes and no pages. Its entry points are the module exports other chunks import.

| Entry | File | SDK / runtime | Auth required | What it does |
|---|---|---|---|---|
| `db`, `auth`, `storage`, `app`, `validateFirebaseConfig` | `lib/firebase.ts:220` | Firebase **client** SDK (v9 modular) | no | Lazily-initialised singletons. `auth`/`storage` are `null` on the server (`lib/firebase.ts:87-92`); `db` is initialised on both. |
| `isFirebaseConfigured()`, `getFirebaseConfigStatus()` | `lib/firebase.ts:46,52` | pure | no | Config validation; **`isFirebaseConfigured` is a function**, and two call sites forget the parens. |
| `getNextUpcomingEvent()` | `lib/firebase.ts:145` | client SDK | no | Reads the whole `events` collection and filters in JS. |
| `getAdminFirestore()`, `initializeAdminApp()` | `lib/admin-firebase.ts:157,39` | **Admin** SDK, Node only | n/a (bypasses rules) | Four-way credential resolution (since 2026-09-28): `FIREBASE_SERVICE_ACCOUNT_JSON` `:57` → `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` env vars `:90-116` → `firebase-admin.json` `:119` → ADC `:133`. |
| `addDocument/updateDocument/deleteDocument/getDocuments` | `lib/firebase-admin-rest.ts:27,51,73,90` | Firestore **REST v1** + `google-auth-library` | service account | `import "server-only"` guarded (line 5). Hand-rolled value serializer. |
| `sevaService`, `sevaBookingService`, `donationService`, `poojaService`, `announcementService`, `userService`, `volunteerService`/`memberService`, `donationCampaignService`, `billingService`, `galleryService`, `homepageService`, `aaradhaneService`, `quoteService`, `profileService` | `services/*.service.ts` | Firebase **client** SDK | none in-service | Object/class singletons. Run wherever imported - browser or server. `sevaService` is the exception: its **reads** go to Supabase, only its writes are Firestore (M10-F02). |
| `eventService`, `settingsService`, `templeAreasService` | `services/event.service.ts:153`, `settings.service.ts:117`, `temple-areas.service.ts:4` | **Supabase** | none in-service (settings writes: admin check inside the M12 server action) | Migrated entities. `temple-areas` uses the service-role admin client; `settingsService` writes delegate to `app/actions/settings.ts`. |
| `receiptService`, `receiptSevaService` | `services/receipt.service.ts:169`, `receiptSeva.service.ts:98` | `fetch` to `/api/admin/receipts*` | **yes** - caller passes a Firebase ID token | The only services that are HTTP clients rather than DB clients. |
| `storageService` | `services/storage.service.ts:339` | `@vercel/blob` | server token | Needs `BLOB_READ_WRITE_TOKEN` (`.env.example:20`, not `NEXT_PUBLIC_`). |
| `authService` | `services/auth.service.ts:147` | Firebase Auth + Firestore, browser only | n/a | register / login / logout / forgotPassword; writes `users/{uid}`. |
| `dashboardService` ×2 | `services/dashboard.service.ts:43`, `dashboard.service.client.ts:47` | client SDK | no | **Both dead** - zero importers, identical export name. |
| `reportService` | `services/report.service.ts:66` | composes donation+booking services | no | **Dead** - zero importers. |
| Testimonial free functions | `services/testimonial.service.ts` | client SDK via dynamic import | no | Browser-only by construction (`:12`). |
| Chat/AI free functions | `services/chat.service.ts`, `analytics.service.ts`, `conversation.service.ts`, `ai-analytics.service.ts`, `knowledge-workflow.service.ts` | client SDK + Supabase (`chat.service` sessions/messages and the `ai-analytics` latency/intent/unknown-question halves are Supabase since 2026-10) | no | Called from `app/api/**` route handlers (M12), admin AI pages (M09) and `components/ai/AIChatProvider.tsx`. |
| Pure-logic services | `ml.service.ts`, `ux.service.ts`, `content.service.ts`, `search.service.ts`, `recommendation.service.ts`, `multi-source-retrieval.service.ts`, `knowledge.service.ts` | no DB of their own | no | Compose other services / `lib/ai/*`. |
| `ProofReportService` | `services/proof-report/proof-report.service.ts:26` | Playwright + `fs` + `child_process` | n/a | Node-only site audit; driven by `npm run generate:proof-report` (`package.json:31`). |
| `sendEmail`, `sendWhatsApp` | `lib/services/email.ts:5`, `whatsapp.ts:4` | nodemailer / Meta Graph API | provider creds | **Zero importers.** |
| `getTempleSettings`, `updateTempleSettings` | `lib/settings/temple.ts:3,7` | static JSON | no | `updateTempleSettings` is a `console.log` stub. |

---

## Component trees

M10 owns no React components. The equivalent structure is the **call tree from consumers down to the
store**. Five trees cover the whole layer.

### Tree A - the standard Firestore CRUD service (the shape ~20 services share)

```
Admin list page (client)              app/admin/<entity>/page.tsx            [M05/M06/M07]
 +- <Entity>Table / <Entity>Form      components/admin/<entity>/*.tsx        [M06/M07]
     +- <entity>Service singleton     services/<entity>.service.ts           [M10]
         +- db                        lib/firebase.ts:220 (client SDK)       [M10]
         |   +- collection(db,"<c>") / doc(db,"<c>",id)
         |       +- Firestore collection "<c>"
         +- docTo<Entity>(docSnap:any)   in-file mapper, Timestamp -> ISO string
         +- types/<entity>.ts             <Entity>, <Entity>Request           [M10]
```

Instances: `seva`(sevas) `sevaBooking`(sevaBookings) `donation`(donations) `donationCampaign`
(donation_campaigns) `pooja`(dailyPoojas) `announcement`(announcements) `user`(users) `volunteer`
(members, volunteers) `gallery`(galleryAlbums, galleryMedia) `aaradhane`(aaradhane, aaradhanes)
`billing`(bills) `quote`(quotes) `profile`(profiles, bookmarks) `homepage`(homepage/config).

There is **no shared base class, no generic, no interface** - each file re-declares `if (!db) throw`,
its own `docToX` mapper and its own error policy.

### Tree B - the Supabase services (post-migration entities)

```
Public page (server or client)        app/(public)/events/[id]/page.tsx      [M02/M03]
Admin page (client)                   app/admin/events/page.tsx              [M06]
API route (server)                    app/api/events/route.ts                [M12]
 +- eventService                      services/event.service.ts:153          [M10]
     +- supabase = createClient()     services/event.service.ts:4  <-- module scope, BROWSER client
     |   +- lib/supabase/client.ts:3  createBrowserClient(anon key)          [M11]
     |       +- Supabase table "events"
     +- mapSupabaseEventToTempleEvent(event:any)   snake_case -> camelCase   services/event.service.ts:21
     +- types/event.ts  TempleEvent

 +- settingsService                   services/settings.service.ts:117       [M10]
 |   +- reads : createClient()        (browser anon)      -> site_settings, social_links   :41, :81
 |   +- writes: await import("@/app/actions/settings")    :70, :75   ("use server", M12, since 2026-10-13)
 |       +- verifyAdminForAction -> checkAdminAuth (needs Authorization: Bearer)  app/actions/settings.ts:26
 |       +- zod settingsSchema    app/actions/settings.ts:10
 |       +- createAdminClient()   -> SERVICE ROLE key -> site_settings
 +- chat.service (sessions, messages) services/chat.service.ts:7-171         [M10]
 |   +- createClient() browser anon, per call  :8,:29,:48,:77,:107,:145
 |       +- Supabase chat_sessions, chat_messages   (RLS "Deny all public access")
 +- ai-analytics (latency, intent, unknown questions)  services/ai-analytics.service.ts
 |   +- typeof window === 'undefined' ? createAdminClient() : createClient()   :133,:169,:203,:242,:322,:369,:419
 |       +- Supabase ai_latency_records, ai_intent_distribution, unknown_questions
 +- templeAreasService                services/temple-areas.service.ts:4 -> temple-areas.supabase.service.ts:192
     +- getAreas/getArea/add/update/delete : createAdminClient()  (SERVICE ROLE)  :14,:61,:98,:129,:159
     +- getPublicAreas/getPublicArea       : await createClient() from lib/supabase/server (RLS)  :37,:79
```

### Tree C - the HTTP-client services (receipts)

```
Admin receipts page (client)          app/admin/receipts/**                  [M07]
 +- receiptService                    services/receipt.service.ts:169        [M10]
     +- fetch("/api/admin/receipts", {Authorization: Bearer <idToken>})      :73,:97,:116,:131,:150
         +- app/api/admin/receipts/route.ts                                  [M12]
             +- Firebase Admin SDK / lib/firebase-admin-rest.ts              [M10]
                 +- Firestore "receipts"
 +- receiptSevaService                services/receiptSeva.service.ts:98
     +- fetch("/api/admin/receipt-sevas", Bearer idToken)                    :38,:64,:84
 +- delivery: app/api/admin/receipts/[id]/send/route.ts  ==  `POST(){return Response.json({success:true})}`
     (lib/services/email.ts and lib/services/whatsapp.ts are never imported)
```

This is the **only** tree in the codebase that puts auth between the browser and the database. It is
what the rest of the layer should look like.

### Tree D - upload path

```
ImageUploader / VideoUploader (client) components/ui/ImageUploader.tsx:67, VideoUploader.tsx:61   [M01]
GalleryDashboard / VideosManager (client) components/admin/gallery/*.tsx:53,:38                   [M06]
 +- storageService                     services/storage.service.ts:339        [M10]
     +- put/del/list from "@vercel/blob"     :69,:93,:140,:158,:173,:181,:258,:328
         +- needs process.env.BLOB_READ_WRITE_TOKEN  (server-only)  .env.example:20
 +- alternative path, Firebase Storage: profileService.uploadProfileImage     services/profile.service.ts:196
     +- ref/uploadBytes/getDownloadURL from "firebase/storage"                 :207,:217,:226,:227
```

Two unrelated blob stores are in use at once: Vercel Blob for gallery/testimonials/reports, Firebase
Storage for profile images.

### Tree E - composed / read-only services

```
searchAll()                            services/search.service.ts:22          [M10]
 +- searchKnowledge  -> knowledge.service.ts  -> lib/ai/knowledge/repository.ts   [M08]
 +- searchEvents     -> event.service.ts      -> Supabase "events"
 +- searchFestivals  -> types/festival.ts     (static FESTIVALS data)
 +- searchGallery    -> gallery.service.ts    -> Firestore galleryMedia
 +- searchFAQs       -> in-file static list

dailySpiritualService.getDashboardData()  services/daily-spiritual.service.ts:419
 +- getTempleStatus   -> homepage.service.ts -> Firestore homepage/config
 +- getDailyQuote     -> quote.service.ts    -> Firestore quotes (+ module cache)
 +- getFeaturedEvent  -> Firestore "events"  (direct getDocs, not eventService)
 |      :224 getFeaturedEvent -> :281 getFeaturedEventFromFirestore -> collection(db,"events") :293, :331
 +- getActiveAnnouncements :382 -> collection(db,"announcements") :388 (direct, not announcementService)

ProofReportService.generate()          services/proof-report/proof-report.service.ts:64
 +- CrawlerService / ScreenshotService / AccessibilityService / SEOService   (Playwright)
 +- LinkValidatorService / ImageValidatorService / ContentQualityService / TempleValidatorService
 +- DatabaseExportService  -> its own Firebase app from NEXT_PUBLIC_* env    :24-30
 +- SeedReaderService      -> fs, seed/*.json
 +- HtmlGeneratorService -> PdfGeneratorService (Playwright print-to-PDF)
```

Note that `daily-spiritual.service.ts` reads `events` (`:293`, `:331`) and `announcements` (`:388`) directly rather than through
`eventService` / `announcementService` - the "no direct Firestore" rule is broken *inside* the service
layer too, and `eventService` now points at Supabase while `daily-spiritual` still points at Firestore.

---

## Data flow

### 1. Devotee books a seva (Firestore, no validation, no auth)

1. `components/home/SevaBooking.tsx` (client, M03) collects the form.
2. It calls `sevaService.getAllSevas()` to populate the seva dropdown -
   `services/seva.service.ts:9` → `getAllSevasAction()` (`app/actions/sevas.ts:4`, `"use server"`) →
   `createAdminClient()` → **Supabase** `sevas`.
3. On submit it calls `sevaBookingService.createBooking(data)` - `services/sevaBooking.service.ts:34`.
4. That does `addDoc(collection(db,"sevaBookings"), {...data, status:"pending", paymentStatus:"pending", createdAt: serverTimestamp()})`
   from the **browser**, with the Firebase client SDK. Nothing validates `data`; nothing checks who the user is.
5. Admin reads it back: `app/admin/bookings/page.tsx` → `sevaBookingService.getAllBookings()`
   (`:40`, `orderBy("createdAt","desc")`, no `limit`) → `docToBooking` (`:7`) normalises Timestamps to ISO.
6. Admin confirms payment: `updatePayment()` (`:81`) sets `status:"confirmed"` when
   `paymentStatus === "completed"`.

Consequence: the seva **catalogue** lives in Supabase while the **bookings** live in Firestore, and
`sevaService.createSeva/updateSeva/deleteSeva` (`:74-87`) still write to the Firestore `sevas`
collection that nothing reads.

### 2. Admin issues a receipt (the one properly layered flow)

1. Admin receipt form (M07) calls `receiptService.createReceipt(input, idToken)` - `services/receipt.service.ts:146`.
2. `fetch(POST /api/admin/receipts, Authorization: Bearer <Firebase ID token>)` - `:150-154`.
3. `app/api/admin/receipts/route.ts` (M12) verifies the token server-side and writes Firestore with
   the Admin SDK (`lib/admin-firebase.ts:157` `getAdminFirestore`) or REST (`lib/firebase-admin-rest.ts:27`).
4. PDF: `receiptService.getReceiptPdf(id, idToken)` (`:130`) → `GET /api/admin/receipts/[id]/pdf` →
   `lib/receipt/pdf.ts` → `Blob`.
5. Delivery: the UI calls `POST /api/admin/receipts/[id]/send`, which is literally
   `export async function POST() { return Response.json({ success: true }); }`. `lib/services/email.ts`
   (nodemailer + PDF attachment) and `lib/services/whatsapp.ts` (Meta Graph) are complete but **never imported**.
6. Read-back maps every receipt through `docToReceipt` (`:12`), whose `paymentMode` line is
   `data.paymentMode === "upi" ? "upi" : "upi"` (`:23`) - every receipt reports UPI.

### 3. Admin saves site settings (client component → server action → service-role key)

Rewritten 2026-10-13 (54024a1). Until then the service imported the service-role client into the
browser (old M10-F04).

1. `app/admin/settings/page.tsx` is `"use client"`.
2. It calls `settingsService.updateSettings(id, payload)` - `services/settings.service.ts:74` - or
   `createSettings(payload)` `:69` when no row exists (`app/admin/settings/page.tsx:69-71`).
3. That does `await import("@/app/actions/settings")` (`:75`, `:70`) and calls `updateSettingsAction` /
   `createSettingsAction`. The module is `"use server"`, so the browser sends a server-action POST and
   never holds `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/admin.ts:5,11`, which now also starts with
   `import 'server-only'` `:1`).
4. The action calls `verifyAdminForAction()` (`app/actions/settings.ts:26-36`), which rebuilds a
   `NextRequest` from the action's request headers and runs `checkAdminAuth` - and that accepts only an
   `Authorization: Bearer <token>` header (`lib/auth/admin.ts:25-29`). A server-action request from
   the browser carries cookies but no `Authorization` header, and the page adds none, so the action
   throws `Unauthorized` and the page shows "Unable to save settings" (M10-F43).
5. Past auth, the action would zod-validate (`app/actions/settings.ts:10-20`, uuid id `:20`) and write
   `site_settings` with `createAdminClient()`.
6. Reads (`getSettings` `:39`, `getSocialLinks` `:79`) still use the browser anon client (`:41,:81`)
   and do work.

### 4. Page-view tracking and the admin analytics tiles

1. `components/analytics/PageViewTracker.tsx` (client) calls `trackPageView(data)` -
   `services/pageviews.service.ts:35`.
2. Guard `if (!db || !isFirebaseConfigured)` (`:36`) - `isFirebaseConfigured` is a **function
   reference** (`lib/firebase.ts:220`), so that half of the condition is always falsy and never guards.
3. `addDoc(collection(db,"page_views"), {...})` (`:46`) - one document per page view, written from the
   browser, keyed by a `localStorage` visitor id (`:205-214`).
4. `setDoc(daily_page_stats/<YYYY-MM-DD>, {pageViews: increment(1)}, {merge:true})` (`:62`) and
   `daily_page_stats/<date>_pages` (`:69`). `sourceField`/`deviceField` are computed at `:59-60` and
   never used, so traffic-source and device breakdowns are never aggregated.
5. `app/admin/page.tsx` calls `getAnalyticsSummary(days)` (`:82`), which computes `weekAgo` (`:110`),
   **ignores it**, and issues `query(collection(db,"page_views"), orderBy("timestamp","desc"), limit(10000))`
   (`:113-117`) - up to 10,000 document reads per dashboard load, then aggregates in JS.
6. `avgSessionDuration` and `bounceRate` are arithmetic guesses from views-per-visitor (`:166-168`),
   not measurements; `newSignupsThisWeek` is hardcoded `0` (`:184`).

### 5. Login and the user record

1. `components/auth/LoginForm.tsx` (M04) → `authService.login(email, password)` - `services/auth.service.ts:76`.
2. `signInWithEmailAndPassword(auth, ...)` (`:82`).
3. `setDoc(doc(db,"users",uid), {..., role: existingProfile?.role ?? "devotee", isApproved: ..., lastLogin: serverTimestamp()}, {merge:true})` (`:94-116`)
   - a **client-side write that includes the `role` field**. Whether a devotee can escalate their own
   role is decided entirely by `firestore.rules` (M04/M11), not by this layer.
4. `userService` (`services/user.service.ts`) reads/writes the same `users` collection with a *different*
   default role (`"Volunteer"`, `:31`) and a *different* shape (`active`/`isActive` both set, `:32-33`).

### 6. Raya AI asks for facts (M08 boundary)

1. `app/api/chat/route.ts` (M12) → `lib/ai/*` (M08).
2. M08 calls `executeMultiSourceQuery()` - `services/multi-source-retrieval.service.ts:261`, which fans
   out to `getSettingsData/getPanchangaData/getEventsData/getSevasData/getAnnouncementsData` (`:26-201`).
3. Telemetry goes back through `services/analytics.service.ts` (Firestore `unknown_questions`,
   `chat_metrics`, `intent_metrics`, `intent_feedback`; `logUnknownQuestion` is called by
   `lib/ai/generator.ts:73`) **and** `services/ai-analytics.service.ts`, which since BOT-004
   (2026-10-13) reads and writes **Supabase** `ai_latency_records` / `ai_intent_distribution` /
   `unknown_questions` with `createAdminClient()` on the server (`:133`, `:169`, `:203`, `:322`,
   `:369`, `:419`) and no longer checks Firebase config on those paths. Token usage and `ai_settings`
   stay on Firestore (`:102-108`, `:58-64`). Its `record*` writers have no callers (M10-F49). The live chat route logs a low-confidence
   question **twice, to two stores**: `generateResponse` (`app/api/chat/route.ts:162` →
   `lib/ai/generator.ts:73`) writes Firestore `unknown_questions` through `analytics.service`, and
   `logLowConfidenceQuestion` (`app/api/chat/route.ts:193` → `lib/ai/unknown-logger.ts:30`) writes the
   Supabase table. `lib/ai/ai-settings/repository.ts:412` is reached only from
   `lib/ai/composer/composer.ts:304`, which nothing outside `lib/ai/composer/index.ts` imports (M08).
4. Conversation state: `services/conversation.service.ts` → Firestore `chat_sessions`, 30-minute
   `SESSION_TTL` (`:41`) and `MAX_MESSAGES = 20` (`:44`) enforced by `pruneMessages` (`:184`).
5. `services/chat.service.ts` keeps a *second* session model. Until 2026-10-06 it shared the Firestore
   `chat_sessions` collection; since 224875d it writes the **Supabase** `chat_sessions` table and
   messages to `chat_messages` (`:11`, `:109`) with the browser anon client, which the
   `Deny all public access` RLS policies reject
   (`supabase/migrations/20260930000000_create_ai_tables.sql:92-93`) - so `AIChatProvider`'s
   history save fails silently (M10-F44). The two session models now live in two different stores.

---

## Key files

`use client` column omitted - **no file in M10 carries a `"use client"` directive**; every service is
"universal" by accident, which is the root of most of the faults below. "Imp" = number of importers
from `.claude/state/inventory/import-graph.json`.

### Connection modules (`lib/`)

| File | Lines | Imp | Role | Key exports | Notes |
|---|---|---|---|---|---|
| `lib/firebase.ts` | 222 | 73 | Client Firebase SDK singleton | `db`, `auth`, `storage`, `app`, `isFirebaseConfigured`, `getFirebaseConfigStatus`, `initializeAuthPersistence`, `getNextUpcomingEvent` | Most-imported file in the repo. Hardcoded prod credentials `:58-64`. `auth`/`storage` null on server `:87-92`. |
| `lib/admin-firebase.ts` | 200 | 8 (+2 dynamic: `lib/auth/admin.ts:43`, `lib/auth/admin-auth.ts:77,:122`, which `import-graph.json` does not count) | Admin SDK singleton | `initializeAdminApp`, `getAdminFirestore`, `isAdminAvailable`, `getInitError`, `getAdminApp`, `getAdmin` | `FIREBASE_SERVICE_ACCOUNT_JSON` (validates 4 fields and the project id, `:57-87`) → env vars → `firebase-admin.json` → ADC. `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` fallback `:91`; key normalised by `parseFirebasePrivateKey` (`lib/utils/firebase-key-parser.ts`, unowned) `:95`. `isAdminAvailable()` returns false until `getAdminFirestore()` has run. |
| `lib/firebase-admin-rest.ts` | 144 | 2 | Firestore REST v1 CRUD | `addDocument`, `updateDocument`, `deleteDocument`, `getDocuments` | `import "server-only"` `:5`. `require('google-auth-library')` inside ESM `:10`. `serializeDocument` `:110` maps every number to `integerValue`. `pageSize=100`, no cursor `:93`. |
| `lib/services/email.ts` | 66 | **0** | Receipt email + PDF attachment (nodemailer) | `sendEmail` | Complete and unused. |
| `lib/services/whatsapp.ts` | 70 | **0** | Receipt WhatsApp (Meta Graph v17) | `sendWhatsApp` | Unused; comments `:16-18,:47-48` admit the PDF is not attached - it sends text only. |
| `lib/settings/temple.ts` | 11 | 1 | Temple settings from `website-settings/temple.json` | `getTempleSettings`, `updateTempleSettings` | `updateTempleSettings` `:7` is `console.log("Saving temple settings", data)` - writes are dropped. |

### Firestore CRUD services

| File | Lines | Imp | Collection(s) | Key exports | Notes |
|---|---|---|---|---|---|
| `services/sevaBooking.service.ts` | 93 | 11 | `sevaBookings` | `sevaBookingService` | Cleanest example of Tree A. `docToBooking(docSnap:any)` `:7`. No pagination. |
| `services/donation.service.ts` | 83 | 8 | `donations` | `donationService` | `docToDonation` tolerates two legacy field names (`donorName`/`name`, `paymentMode`/`paymentMethod`) `:17,:25`. |
| `services/pooja.service.ts` | 101 | 6 | `dailyPoojas` | `poojaService` | Object literal, not a class. `getStats()` `:86` re-reads everything. |
| `services/announcement.service.ts` | 85 | 6 | `announcements` | `announcementService` | `getActiveAnnouncements` `:45` needs a composite index (`isActive` + `createdAt`); failure is swallowed into `[]`. |
| `services/user.service.ts` | 89 | 4 | `users` | `userService` | Default role `"Volunteer"`; sets both `active` and `isActive` `:32-33`. Overlaps `auth.service.ts` and `types/user.ts`. |
| `services/volunteer.service.ts` | 127 | 3 | `members`, `volunteers` | `memberService`, `volunteerService` | Two identical object literals differing only in collection and id field. |
| `services/donationCampaign.service.ts` | 142 | **0** | `donation_campaigns` | `donationCampaignService` | Dead. Snake-case collection name, unlike its neighbours. |
| `services/gallery.service.ts` | 259 | 13 | `galleryAlbums`, `galleryMedia` | `galleryService`, `DEFAULT_GALLERY_IMAGES` | Falls back to 7 hardcoded images when Firestore is empty or errors `:155,:164,:171`. Five alias methods (`getImages`/`getMedia` etc.) `:175,:215,:225,:234,:243`. |
| `services/homepage.service.ts` | 171 | 3 | `homepage/config` (single doc) | `homepageService` | 80 lines of default copy `:84-167`. `removeUndefined` recursion `:65`. Logs the whole payload `:41`. |
| `services/aaradhane.service.ts` | 284 | 9 | `aaradhane`, `aaradhanes` (+ dead `events`) | `aaradhaneService` | Reads and merges **two** collections `:158-192`. `deleteAaradhane` `:244` second branch unreachable. `eventDocToAaradhane` `:77` and `EVENTS_COLLECTION` `:18` are dead. |
| `services/billing.service.ts` | 286 | 2 | `bills` | `billingService` | Money path. `createBill(input, prefix, invoiceNumber=1)` `:141`; `addPayment` `:232` is a non-transactional read-modify-write. |
| `services/quote.service.ts` | 1040 | 18 | `quotes` | `quoteService` | Second-largest service after `knowledge-workflow.service.ts` (1069). Module-level `quoteCache` `:42`, 24 h TTL `:39`, 7 a.m. IST cutoff `:227`. 4-quote `FALLBACK_QUOTES` array `:52-155`. Imports `event.service` for festival quotes. |
| `services/profile.service.ts` | 413 | 1 | `profiles`, `bookmarks` + Firebase Storage | `profileService` | `removeBookmark(uid, bookmarkId)` queries `where("itemId","==",bookmarkId)` `:364`. `addFavorite` `:264` read-modify-write instead of `arrayUnion`. Unused `FirestoreError` import `:16`. |
| `services/auth.service.ts` | 148 | 1 | `users` | `authService`, `RegisterData` | Browser-only. Writes `role` from the client `:105`. |
| `services/dashboard.service.ts` | 44 | **0** | 8 collections, `getCountFromServer` | `dashboardService` | Dead. The efficient version. |
| `services/dashboard.service.client.ts` | 48 | **0** | same 8 collections, full `getDocs` | `dashboardService` | Dead. Same class name and export name as the file above; downloads every document to count it `:24-26`. |
| `services/report.service.ts` | 67 | **0** | via donation + booking services | `reportService` | Dead. Loads every donation and booking to compute five totals. |
| `services/chat.service.ts` | 342 | 6 | **Supabase** `chat_sessions`, `chat_messages`; Firestore `testimonials`, `volunteer_requests`, `feedback` | 16 free functions | Sessions/messages moved to Supabase 2026-10-06 (224875d) on the browser anon client, which RLS denies (M10-F44). Still a second session model beside `conversation.service.ts` (now a different store) and overlaps `testimonial.service.ts` (same collection, different filters). `saveMessage` `:103` increments `message_count` by read-then-write `:125-130`. Unused `createAdminClient` import `:3`; the Firestore imports sit mid-file `:172-186`. |
| `services/testimonial.service.ts` | 467 | 4 | `testimonials`, `notifications` | 11 free functions, `DEFAULT_TESTIMONIALS` | `getFirebaseDb()` `:11` returns `null` when `typeof window === "undefined"` - **every server render gets the 4 hardcoded defaults**. All Firestore imports are dynamic. |
| `services/pageviews.service.ts` | 255 | 2 | `page_views`, `daily_page_stats`, (`sessions` declared, unused) | `trackPageView`, `getAnalyticsSummary`, `PageViewData`, `DailyStats` | See flow 4. `limit(10000)` `:116`. `localStorage` visitor id `:208`. |
| `services/analytics.service.ts` | 383 | 3 | `unknown_questions`, `chat_metrics`, `intent_metrics`, `intent_feedback` | 10 free functions incl. `IntentFeedback` | AI telemetry, Firestore. Overlaps `ai-analytics.service.ts`. |
| `services/conversation.service.ts` | 373 | 1 | `chat_sessions` | 10 free functions | `SESSION_TTL` `:41` and `MAX_MESSAGES` `:44`; `pruneMessages` `:184`; `detectFollowUp` `:233` is pure logic. Uses `uuid`. |
| `services/ai-analytics.service.ts` | 898 | 6 | Firestore `ai_token_usage`, `ai_settings` (+ count-only `chat_sessions`/`chat_messages` `:623,:635`) **+ Supabase** `ai_latency_records`, `ai_intent_distribution`, `unknown_questions` | 12 free functions | Split store. Supabase calls pick `createAdminClient()` when `typeof window === 'undefined'` `:133`; the Firebase gate left the Supabase paths in BOT-004 (2cd44c7..556a704) but still fronts `getAnalyticsDashboard` `:565` and `checkAIHealth` `:470` (M10-F45). `(data as any).model` `:143`. |
| `services/knowledge-workflow.service.ts` | 1069 | 8 | `COLLECTIONS` map `:46` (versions, actions, comments, approvals, audit, drafts) | 22 free functions | Editorial workflow state machine; `getNextStatus` `:290`. Consumed only by `app/api/admin/knowledge*` (M09/M12). |
| `services/daily-spiritual.service.ts` | 446 | 3 | `events`, `announcements` **directly** + homepage + quote services | `dailySpiritualService` | Bypasses `eventService`/`announcementService` `:224,:382`. IST time maths `:27-73`. |

### Supabase services

| File | Lines | Imp | Table(s) | Key exports | Notes |
|---|---|---|---|---|---|
| `services/event.service.ts` | 154 | 14 | `events` | `eventService` | `createClient()` at module scope `:4` - a **browser** client, used by `app/api/events/route.ts`. Rows keyed by `firestore_id` `:23`. `getPublishedEvents/getUpcomingEvents/getPastEvents` filter and sort in JS `:130-145`. |
| `services/settings.service.ts` | 118 | 4 | `site_settings`, `social_links` | `settingsService`, `SocialLinksData` | Reads anon `:41,:81`; writes delegate to the `"use server"` actions in `app/actions/settings.ts` via dynamic import `:70,:75` (54024a1) - which reject browser calls (M10-F43). 15 hardcoded default social URLs `:21-36`. |
| `services/temple-areas.supabase.service.ts` | 193 | 1 | `temple_areas` | `TempleAreasSupabaseService`, `templeAreasSupabaseService` | Admin client for the non-`Public` methods `:14,:61,:98,:129,:159`. Slug id derived from the name `:100`. Unused `DEFAULT_TEMPLE_AREAS` import `:4`. `rows.map(this.mapToTempleArea)` `:188` passes an unbound method. |
| `services/temple-areas.service.ts` | 5 | 4 | - | `templeAreasService` | Re-export alias for the file above. |
| `services/seva.service.ts` | 91 | 2 | Supabase `sevas` (read) / Firestore `sevas` (write) | `sevaService` | The split-brain service. Reads via `getAllSevasAction` `:11`; `catch` falls through to a Firestore read `:31-39`. |

### HTTP-client and infrastructure services

| File | Lines | Imp | Backing | Key exports | Notes |
|---|---|---|---|---|---|
| `services/receipt.service.ts` | 169 | 5 | `/api/admin/receipts` | `receiptService`, `ReceiptListParams`, `ReceiptReport` | Only service with real pagination params `:42-50` and bearer auth `:5`. `paymentMode` bug `:23`. |
| `services/receiptSeva.service.ts` | 98 | 3 | `/api/admin/receipt-sevas` | `receiptSevaService` | Same pattern; no delete method. |
| `services/storage.service.ts` | 340 | 7 | Vercel Blob | `storageService`, `UploadFolder`, `ReportFileType`, `SaveReportOptions` | `addRandomSuffix:false` on every `put` `:72,:96,:143,:261` - same filename overwrites. `atob` `:54,:287`. Called from client components. |
| `services/device-analytics.service.ts` | 232 | **0** | nothing | `deviceAnalytics`, `trackDeviceEvent`, `DeviceEventType`, `DeviceAnalyticsEvent` | Dead. `processQueue` `:180` discards the batch (comment `:191`). `flush()` `:207` spins forever if `isProcessing`. `setInterval` in the constructor `:35`. |

### Pure-logic services (no store of their own)

| File | Lines | Imp | Composes | Key exports | Notes |
|---|---|---|---|---|---|
| `services/knowledge.service.ts` | 286 | 11 | `lib/ai/knowledge/repository` (M08) | 12 free functions + `knowledgeService` | Module-level `viewCounts = new Map()` `:28` with the comment "would be Firestore in production". |
| `services/content.service.ts` | 371 | 1 | `lib/ai/knowledge/types` | `autoTagArticle`, `getContentFreshness`, `getRelatedQuestions`, … | Keyword tables `:41`, `:265`. Pure functions; fully portable. |
| `services/ml.service.ts` | 461 | 1 | `lib/ai/intent/types`, `analytics.service` | 12 free functions | Levenshtein `:171`, Jaccard `:59`, typo table `:208` (8 entries added `:235-242`, 3446b0b). Fuzzy match now capped at distance 2 with a hardcoded `address`/`dress` exclusion `:280` (M10-F48). `correctionCache` Map `:40`, cap 1000 `:41` - lost on every cold start. |
| `services/ux.service.ts` | 366 | 1 | `lib/ai/intent/types` | `getQuickActions`, `getSuggestedQuestions`, `getGreetingWithActions`, `getResponseMetadata` | Static EN/KN copy tables. Pure. |
| `services/search.service.ts` | 410 | 3 | knowledge + event + gallery services, `types/festival` | `searchAll`, `getSearchSuggestions`, `groupResultsByType`, `highlightKeywords`, `getEmptyStateSuggestions` | Fan-out search; no index, scores in JS. `highlightKeywords` `:380` returns HTML. |
| `services/recommendation.service.ts` | 497 | 1 | `knowledge.service`, `lib/festival-utils` | `getRecommendationsForUser`, `getRecommendationsForPage`, `getHomepageRecommendations` | Five strategies `:231-425` then dedupe `:426`. Pure ranking. |
| `services/multi-source-retrieval.service.ts` | 586 | 5 | settings/panchanga/events/sevas/announcements sources | 12 exports incl. `QUICK_QUERIES` | Module-level `freshnessCache` `:508`, `queryHistory` `:552` (cap 100 `:553`) - per-instance only. |

### Proof-report engine (`services/proof-report/`, 13 files, 2,804 lines)

Node-only site-audit pipeline; domain semantics belong to M14, the file inventory belongs here.

| File | Lines | Role | Key export |
|---|---|---|---|
| `proof-report.service.ts` | 271 | Orchestrator; `generate()` `:64` runs all 12 sub-services | `ProofReportService` |
| `crawler.service.ts` | 350 | Playwright crawl + route discovery | `CrawlerService` |
| `screenshot.service.ts` | 84 | Playwright screenshots to `fs` | `ScreenshotService` |
| `accessibility.service.ts` | 169 | Per-page a11y checks | `AccessibilityService` |
| `seo.service.ts` | 177 | Per-page SEO checks | `SEOService` |
| `link-validator.service.ts` | 134 | HTTP link probing | `LinkValidatorService` |
| `image-validator.service.ts` | 123 | Image reachability/size/alt | `ImageValidatorService` |
| `content-quality.service.ts` | 118 | Duplicate/thin content, `calculateSimilarity` `:101` | `ContentQualityService` |
| `temple-validator.service.ts` | 160 | Domain rules (timings, darshan text present) | `TempleValidatorService` |
| `database-export.service.ts` | 160 | Snapshots 9 Firestore collections; builds **its own** Firebase app from `NEXT_PUBLIC_*` `:24-30` | `DatabaseExportService` |
| `seed-reader.service.ts` | 136 | Reads `seed/*.json` from disk | `SeedReaderService` |
| `html-generator.service.ts` | 856 | String-concatenated HTML report | `HtmlGeneratorService` |
| `pdf-generator.service.ts` | 66 | Playwright print-to-PDF | `PdfGeneratorService` |

### Types (`types/`, 42 files, 5,548 lines)

| File | Lines | Imp | Main types | Used by |
|---|---|---|---|---|
| `types/user.ts` | 96 | 8 | `UserRole` (13-member union incl. display-cased duplicates), `NormalizedRole`, `normalizeRole()`, `UserProfile`, `TempleUser`, `TempleUserCreate/Update` | `user.service`, admin users pages, `lib/auth` |
| `types/seva.ts` | 35 | 4 | `Seva`, `SevaRequest` | `seva.service`, `search.service`, seva components |
| `types/seva-booking.ts` | 37 | 9 | `SevaBooking`, `SevaBookingRequest`, `SevaBookingStatus`, `PaymentStatus` | `sevaBooking.service`, admin bookings |
| `types/donation.ts` | 119 | 9 | `DonationRecord`, `DonationRequest`, `DonationStatus`, `PaymentMode`, `paymentModeOptions`, `defaultDonationPurposes` | `donation.service`, admin donations |
| `types/donationCampaign.ts` | 25 | 1 | `DonationCampaign`, `DonationCampaignRequest` | `donationCampaign.service` (dead) |
| `types/event.ts` | 41 | 11 | `TempleEvent`, `EventStatus` | `event.service`, quote/search services, events UI |
| `types/pooja.ts` | 48 | 7 | `DailyPooja`, `PoojaCategory`, `POOJA_CATEGORIES`, `WEEKDAYS`, `PoojaStats` | `pooja.service`, admin poojas |
| `types/aaradhane.ts` | 30 | 8 | `Aaradhane`, `AaradhaneSeva`, `AaradhaneStats` | `aaradhane.service`, aaradhane UI |
| `types/aaradhane-generator.ts` | 286 | 5 | `GuruParamparaRecord`, `GeneratedAaradhaneEvent`, `GeneratorConfig`, `LunarMonth`, `Paksha`, `Tithi` | `lib/aaradhane/*` (M14) only |
| `types/gallery.ts` | 94 | 20 | `GalleryAlbum`, `GalleryMedia`, `GalleryMediaRequest`, `GalleryCategory`, `GALLERY_CATEGORIES`, `GalleryStats` | `gallery.service`, 12 admin gallery components |
| `types/homepage.ts` | 156 | 10 | `HomepageConfig`, `Testimonial`, `TestimonialSubmission`, `DonationItem` | `homepage.service`, `testimonial.service`, home components |
| `types/announcement.ts` | 17 | 11 | `Announcement`, `AnnouncementRequest` | `announcement.service`, `daily-spiritual.service` |
| `types/billing.ts` | 92 | 3 | `Bill`, `BillItem`, `BillPayment`, `BillStatus`, `PaymentStatus`, `BillCreateInput/UpdateInput` | `billing.service`, admin billing. Imports `Timestamp`. |
| `types/receipt.ts` | 44 | 13 | `Receipt`, `ReceiptItem`, `ReceiptCreateInput`, `PaymentMode` | `receipt.service`, `lib/receipt/*`, receipt API routes |
| `types/receiptSeva.ts` | 15 | 7 | `ReceiptSeva`, `ReceiptSevaInput` | `receiptSeva.service`, receipt-seva routes |
| `types/receipt-extensions.ts` | 13 | **0** | `DeliveryStatus`, `DeliveryInfo`, `ReceiptDelivery` | nothing - the delivery feature was never built |
| `types/report.ts` | 28 | 1 | `RevenueReport`, `BookingReport`, `DonationReport`, `ReportSummary` | `report.service` (dead) |
| `types/finance.ts` | 105 | 4 | `FinanceSettings`, `BillingSettings`, `SpecialSeva`, `defaultFinanceSettings` | admin finance pages, `hooks/useFinanceSettings` |
| `types/settings.ts` | 13 | 4 | `SiteSettings`, `SiteSettingsPayload` | `settings.service`, proof-report, `app/actions/settings.ts` |
| `types/temple.ts` | 27 | 2 | `TempleSettings` | admin temple settings components |
| `types/temple-explorer.ts` | 372 | 3 | `TempleArea`, `AccessibilityInfo` (`:6`, added 11a532f), `TempleFacility`, `Temple360View`, `TEMPLE_AREAS`, `TEMPLE_COORDINATES`, `TEMPLE_TIMINGS`, `CATEGORY_LABELS/COLORS` | `temple-areas.supabase.service`, explorer UI (`components/temple-explorer/TempleExplorer.tsx:461` renders `area.accessibility`). Static seed data lives here; 4 seed areas now carry accessibility data. |
| `types/profile.ts` | 144 | 3 | `DevoteeProfile`, `UserPreferences`, `Bookmark`, `DEFAULT_USER_PREFERENCES`, `THEMES`, `TIMEZONES` | `profile.service`, profile pages |
| `types/volunteer.ts` | 42 | 5 | `Member`, `MemberRequest`, `Volunteer`, `VolunteerRequest` | `volunteer.service`, admin members/volunteers |
| `types/dashboard.ts` | 11 | 3 | `DashboardStats` | both dead dashboard services + a card component |
| `types/crud.ts` | 104 | 11 | `CrudColumn`, `CrudColumnType`, `CrudTableActions`, `CrudAction` | the admin CRUD framework (M05) and `lib/crud-columns.tsx` |
| `types/calendar.ts` | 17 | 2 | `Ekadashi`, `Festival`, `CalendarData` | admin calendar settings |
| `types/festival.ts` | 212 | 7 | `Festival`, `FestivalCountdown`, `getUpcomingFestivals()`, `calculateCountdown()`, `MONTH_NAMES` | festival components (incl. the AI-005 countdown), `lib/festival-utils`. Contains logic, not just types; `calculateCountdown` `:100` now returns `isToday:true` for the whole festival day `:106-133` (ee8390c). |
| `types/guru.ts` | 371 | 2 | `GuruBiography`, `GURU_BIOGRAPHIES`, `getGuruById()`, `searchGurus()` | guru UI, `recommendation.service`. Content file masquerading as a type file. |
| `types/quote.ts` | 494 | 10 | `Quote`, `QuoteContent`, `QuoteSelectionContext`, `QUOTE_CATEGORIES`, `FESTIVAL_QUOTE_MAP`, `WEEKDAY_QUOTE_MAP`, `DEFAULT_QUOTES_DATA` | `quote.service`, 4 quote API routes |
| `types/knowledge.ts` | 232 | 6 | `KnowledgeArticlePublic`, `KnowledgeCentreData`, `ArticlePageData`, `KNOWLEDGE_CATEGORY_CONFIG` | `knowledge.service`, knowledge pages |
| `types/knowledge-workflow.ts` | 224 | 5 | `WorkflowStatus`, `WorkflowArticle`, `ArticleVersion`, `CommitteeApproval`, `AuditLogEntry`, `DraftArticle` | `knowledge-workflow.service`, admin knowledge API |
| `types/search.ts` | 109 | 3 | `SearchResult`, `SearchResultType`, `SearchFilters`, `DEFAULT_SEARCH_CONFIG`, `SEARCH_TYPE_CONFIG` | `search.service`, global search UI |
| `types/recommendation.ts` | 93 | 4 | `RecommendationItem`, `UserBehavior`, `DEFAULT_RECOMMENDATION_CONFIG`, `REASON_LABELS`, `TYPE_ICONS` | `recommendation.service`, recommendation UI |
| `types/ai.ts` | 120 | 10 | `AIMessage`, `ChatSession`, `ChatRequest/Response`, `AIProvider`, `Testimonial`, `VolunteerRequest`, `KnowledgeItem` | `chat.service`, chat UI, `lib/ai/*` |
| `types/ai-settings.ts` | 358 | 11 | `AISettings` (now also `general`, `safety`, `extendedBehavior`), `AIGeneralSettings` `:282`, `AISafetySettings`, `AIExtendedBehaviorSettings`, `PromptSettings`, `IntentSettings`, `TempleInformation`, 11 `DEFAULT_*` constants | admin AI console (M09), AI settings routes, `lib/ai/ai-settings/admin-repository.ts` (M08) |
| `types/ai-analytics.ts` | 261 | 2 | `TokenUsageRecord`, `LatencyRecord`, `AIHealthStatus`, `AIAnalyticsDashboard`, `AIAnalyticsSettings` | `ai-analytics.service`, AI analytics UI. `LatencyRecord.messageId`/`intent` optional since edecabc (`:30,:36`) - the Supabase table has no such columns. |
| `types/analytics.ts` | 37 | 1 | `UnknownQuestion`, `ConversationMetric`, `IntentMetric` | `analytics.service` |
| `types/multi-source-retrieval.ts` | 238 | 3 | `DataSource`, `MultiSourceQuery/Response`, `SourceResult`, `TempleEvent`, `TempleSeva`, `PanchangaData` | `multi-source-retrieval.service`, AI console |
| `types/daily-spiritual.ts` | 156 | 3 | `TempleStatus`, `PanchangaSummary`, `DailyQuote`, `DailySpiritualDashboard`, `DEFAULT_QUOTES`, `DEFAULT_PRASADA` | `daily-spiritual.service`, dashboard widgets |
| `types/device.ts` | 297 | 19 | `DeviceInfo`, `Capabilities`, `PermissionType`, `LocationPosition`, `ShareOptions`, `QRScannerOptions`, `DEFAULT_DEVICE_SETTINGS` | 17 files under `lib/device/` (M13) |
| `types/proof-report.ts` | 324 | 13 | `PageInfo`, `ProofReportData`, `AccessibilityIssue`, `SEOIssue`, `DatabaseContent` + re-declared domain types | all 13 proof-report services |
| `types/shlokas.ts` | 11 | 1 | `Shloka` | admin shlokas settings |

---

## Types and stores

### Firestore collections written or read from M10

| Collection | Owning service | R | W |
|---|---|---|---|
| `sevas` | `seva.service.ts` (writes only; reads go to Supabase) | via fallback `:34` | yes `:76,:81,:86` |
| `sevaBookings` | `sevaBooking.service.ts` | yes | yes |
| `donations` | `donation.service.ts` | yes | yes |
| `donation_campaigns` | `donationCampaign.service.ts` (dead) | yes | yes |
| `dailyPoojas` | `pooja.service.ts` | yes | yes |
| `announcements` | `announcement.service.ts`, `daily-spiritual.service.ts:382` | yes | yes |
| `events` | `daily-spiritual.service.ts:293,:331`, `lib/firebase.ts:156`, `proof-report/database-export` | yes | no (writes moved to Supabase) |
| `unknown_questions` | `analytics.service.ts:10` (written via `lib/ai/generator.ts:73`) - same name as the Supabase table `ai-analytics` now reads | yes | yes |
| `users` | `auth.service.ts`, `user.service.ts` | yes | yes (from the browser) |
| `profiles` | `profile.service.ts` | yes | yes |
| `bookmarks` | `profile.service.ts` | yes | yes |
| `galleryAlbums`, `galleryMedia` | `gallery.service.ts` | yes | yes |
| `homepage/config` | `homepage.service.ts` | yes | yes |
| `bills` | `billing.service.ts` | yes | yes |
| `quotes` | `quote.service.ts` | yes | yes |
| `aaradhane`, `aaradhanes` | `aaradhane.service.ts` | yes | yes (writes only to `aaradhane`) |
| `testimonials` | `testimonial.service.ts` **and** `chat.service.ts` | yes | yes |
| `notifications` | `testimonial.service.ts:361,:428` | yes | yes |
| `chat_sessions` | `conversation.service.ts` (`chat.service.ts` moved to the Supabase table 2026-10-06); counted by `ai-analytics.service.ts:623` | yes | yes |
| `messages` | ~~`chat.service.ts`~~ - no longer used since 224875d (messages now Supabase `chat_messages`) | no | no |
| `volunteer_requests`, `feedback` | `chat.service.ts` | yes | yes |
| `members`, `volunteers` | `volunteer.service.ts` | yes | yes |
| `unknown_questions`, `chat_metrics`, `intent_metrics`, `intent_feedback` | `analytics.service.ts` | yes | yes |
| `page_views`, `daily_page_stats` | `pageviews.service.ts` | yes | yes |
| `sessions` | declared `pageviews.service.ts:11` | **never used** | no |
| `ai_token_usage`, `ai_settings` | `ai-analytics.service.ts` | yes | yes |
| `ai_unknown_questions` | declared `ai-analytics.service.ts:48`; no longer read or written since BOT-004 (moved to Supabase `unknown_questions`) | no | no |
| `ai_latency_records`, `ai_intent_distribution` | declared `ai-analytics.service.ts:46-47` as Firestore but read and written in **Supabase**; `app/admin/ai/analytics/page.tsx:315` (M09) still reads the Firestore copy directly | page only | no |
| `chat_messages` | declared `ai-analytics.service.ts:51`; counted by `getAnalyticsDashboard` `:635` (real messages are in Supabase) | count only | no |
| `gallery`, `timings` | counted by both dead dashboard services | count only | no |
| `settings/config` | `proof-report/database-export.service.ts:85` | yes | no |
| knowledge workflow collections | `knowledge-workflow.service.ts:46` (`COLLECTIONS` map) | yes | yes |

### Supabase tables

| Table | Service | Client used |
|---|---|---|
| `events` | `event.service.ts` | browser anon client at module scope `:4` |
| `sevas` | `app/actions/sevas.ts` (called by `seva.service.ts`) | **service role** |
| `site_settings`, `social_links` | `settings.service.ts` | anon for reads `:41,:81`; **service role** for writes inside `app/actions/settings.ts` (M12; admin check + zod) |
| `temple_areas` | `temple-areas.supabase.service.ts` | **service role** `:14,:61,:98,:129,:159`; SSR/RLS client for the `*Public*` methods `:37,:79` |
| `ai_latency_records`, `ai_intent_distribution`, `unknown_questions` | `ai-analytics.service.ts` (+ `lib/ai/unknown-logger.ts:30` on the live chat route, and the unreached `lib/ai/ai-settings/repository.ts:412`, for `unknown_questions`, M08) | **service role** on the server, anon in the browser `:133,:169,:203,:242,:322,:369,:419` |
| `chat_sessions`, `chat_messages` | `chat.service.ts` | browser anon `:8,:107,:145` - denied by RLS (`supabase/migrations/20260930000000_create_ai_tables.sql:92-93`) |

### Other stores

- **Vercel Blob** - `storage.service.ts` (gallery, videos, testimonials, reports).
- **Firebase Storage** - `profile.service.ts:196-259` only (profile images).
- **Static JSON** - `lib/settings/temple.ts` → `website-settings/temple.json`; `proof-report/seed-reader.service.ts` → `seed/*.json`.
- **Static TS data** - `types/temple-explorer.ts` (`TEMPLE_AREAS`), `types/guru.ts` (`GURU_BIOGRAPHIES`), `types/festival.ts`, `types/quote.ts` (`DEFAULT_QUOTES_DATA`), `services/gallery.service.ts` (`DEFAULT_GALLERY_IMAGES`), `services/testimonial.service.ts` (`DEFAULT_TESTIMONIALS`).
- **Browser storage** - `localStorage["visitor_id"]` (`pageviews.service.ts:208,:211`).
- **Process memory** - `quote.service.ts:42`, `ml.service.ts:40`, `knowledge.service.ts:28`, `multi-source-retrieval.service.ts:508,:552`, `device-analytics.service.ts:27`.

---

## Cross-module dependencies

### What M10 imports from other chunks

| Import | From chunk | Used by |
|---|---|---|
| `@/lib/supabase/client`, `/server`, `/admin` | M11 | `event.service`, `settings.service` (client only), `temple-areas.supabase.service`, `ai-analytics.service`, `chat.service` (client; `/admin` imported but unused `:3`) |
| `@/app/actions/sevas` | M12 | `seva.service.ts:4` (a service importing a server action) |
| `@/app/actions/settings` | M12 | `settings.service.ts:70,:75` (dynamic import, since 2026-10-13 - the second service-to-server-action edge) |
| `./utils/firebase-key-parser` | unowned (`lib/utils/firebase-key-parser.ts`, added 2026-09-28) | `lib/admin-firebase.ts:13` |
| `@/lib/ai/knowledge/repository`, `/types` | M08 | `knowledge.service`, `content.service`, `knowledge-workflow.service` |
| `@/lib/ai/intent/types` | M08 | `ml.service`, `ux.service`, `multi-source-retrieval.service`, `ai-analytics.service` |
| `@/lib/festival-utils` | M14 | `recommendation.service` |
| `@/lib/receipt/pdf` | M14 | `lib/services/email.ts`, `lib/services/whatsapp.ts` |
| `@/lib/i18n` | M13 | `profile.service` |
| `playwright`, `fs`, `path`, `child_process` | Node | `services/proof-report/*` |
| `@vercel/blob`, `nodemailer`, `uuid`, `firebase`, `firebase-admin`, `google-auth-library` | npm | see Key files |

### Who imports M10 (importer counts from `import-graph.json`)

- `lib/firebase.ts` - **73 importers** (78 on 2026-09-19): 24 admin pages, 24 services, 9 lib modules, 5 API routes, 4 public pages, 3 hooks, 3 components, 1 context. This is the single biggest coupling point in the repo.
- Most-imported services: `quote.service` 18 (15 of them API routes), `event.service` 14, `gallery.service` 13, `knowledge.service` 11, `sevaBooking.service` 11, `aaradhane.service` 9, `donation.service` 8, `knowledge-workflow.service` 8 (all API routes).
- Most-imported types: `types/gallery.ts` 20, `types/device.ts` 19 (17 of them in `lib/device/`, i.e. M13), `types/receipt.ts` 13, `types/proof-report.ts` 13, `types/announcement.ts` 11, `types/crud.ts` 11, `types/event.ts` 11, `types/ai-settings.ts` 11, `types/quote.ts` 10.
- Zero importers: `services/dashboard.service.ts`, `services/dashboard.service.client.ts`, `services/report.service.ts`, `services/donationCampaign.service.ts`, `services/device-analytics.service.ts`, `services/proof-report/proof-report.service.ts` (driven by `scripts/generate-proof-report.ts`, M14/M15), `lib/services/email.ts`, `lib/services/whatsapp.ts`, `types/receipt-extensions.ts`.
- `components/analytics/PageViewTracker.tsx` is the only caller of `trackPageView` and is listed as Unassigned in `.claude/state/inventory/SUMMARY.md:34`; it is not adopted here.


---

## Direct Firebase access outside the service layer

AGENTS.md: "**No Direct Firebase Calls** - Use services only." Grepped 2026-09-19 over `app/`,
`components/` and `hooks/` for `from "firebase/*"` and `from "@/lib/firebase"` /
`"@/lib/admin-firebase"`: **47 files, 85 import lines**. Re-grepped 2026-10-18 with the same pattern:
**46 files, 84 import lines** (one API route dropped out; three pages shifted lines). This is the
complete list behind M10-F05; the numbers after each path are the import statement lines.

### A. Pages, components and hooks holding the client SDK (35 files) - the real violations

- `app/(public)/about/page.tsx:10,11`
- `app/(public)/facilities/page.tsx:9,10`
- `app/(public)/future-plans/page.tsx:4,5`
- `app/(public)/trust/page.tsx:5,6`
- `app/admin/ai/analytics/page.tsx:17,25`
- `app/admin/ai/page.tsx:23,24`
- `app/admin/ai/training/page.tsx:16,25`
- `app/admin/billing/create/page.tsx:8,9`
- `app/admin/billing/page.tsx:13,14`
- `app/admin/billing/settings/page.tsx:7,8`
- `app/admin/content/page.tsx:13,14`
- `app/admin/featured/page.tsx:29,40`
- `app/admin/media/page.tsx:25,35,36`
- `app/admin/page.tsx:12,13`
- `app/admin/settings/about/page.tsx:7,8`
- `app/admin/settings/ekadashi-calendar/page.tsx:7,8`
- `app/admin/settings/facilities/page.tsx:7,8`
- `app/admin/settings/festival-calendar/page.tsx:7,8`
- `app/admin/settings/finance/page.tsx:6,7`
- `app/admin/settings/footer/page.tsx:7,8`
- `app/admin/settings/future-plans/page.tsx:7,8`
- `app/admin/settings/guru-parampara/page.tsx:7,8`
- `app/admin/settings/puja-schedule/page.tsx:7,8`
- `app/admin/settings/shlokas/page.tsx:7,8`
- `app/admin/settings/social-links/page.tsx:7,8`
- `app/admin/settings/trust-committee/page.tsx:7,8`
- `app/admin/test/page.tsx:3,4`
- `app/admin/test-firebase/page.tsx:3,4`
- `components/admin/events/EventForm.tsx:4`
- `components/admin/layout/AdminAuthGuard.tsx:6`
- `components/auth/ProtectedRoute.tsx:7`
- `components/layout/Footer.tsx:8,9`
- `hooks/useDonationNotifications.ts:4`
- `hooks/useFinanceSettings.ts:4,5`
- `hooks/useGallery.ts:10,12`

### B. API routes using the **client** SDK server-side (5 files, 6 on 2026-09-19) - wrong SDK for the tier

- `app/api/admin/users/create-admin/route.ts:2,3,4`
- `app/api/admin/users/set-role/route.ts:2,3`
- `app/api/ai/knowledge/coverage/route.ts:2,3`
- `app/api/ai/knowledge/import/route.ts:2,3`
- `app/api/public/stats/route.ts:5,6`
- ~~`app/api/seed-ai-settings/route.ts:7`~~ - no longer imports Firebase directly (rewritten 698a25c / 8d54714; removed 2026-10 - see Refresh log)

### C. API routes using the **Admin** SDK (6 files) - right SDK, still outside `services/`

- `app/api/admin/receipt-sevas/route.ts:3`
- `app/api/admin/receipt-sevas/[id]/route.ts:3`
- `app/api/admin/receipts/route.ts:4`
- `app/api/admin/receipts/[id]/pdf/route.ts:3`
- `app/api/admin/receipts/[id]/route.ts:3`
- `app/api/public/receipts/route.ts:2`

### D. Outside the grep pattern (added by the verifier 2026-10-18; pre-existing on 2026-09-19)

The counts above come from a static-import grep over `app/`, `components/` and `hooks/` only, so they
miss the following, all of which also bypass `services/`:

- `hooks/useHomepage.ts:27-28` - **dynamic** `await import("firebase/firestore")` and `await import("@/lib/firebase")` (an `onSnapshot` on `homepage/config`), beside its `homepage.service` import. Another client-SDK violator; with it and the next item, 42 files hold the client SDK outside `services/`.
- `context/AuthContext.tsx:11,13` - `firebase/auth` and `@/lib/firebase` (`context/` is outside the grep scope).
- `app/api/admin/knowledge/route.ts:7`, `app/api/admin/knowledge/[id]/route.ts:6` - the Firestore REST helper `@/lib/firebase-admin-rest` (Admin credentials, right tier, outside `services/`).
- Supabase clients imported directly (focus question 3 asks for these too): `app/actions/settings.ts:3` and `app/actions/sevas.ts:2` (`@/lib/supabase/admin`, the two server actions), `app/api/seed-ai-settings/route.ts:17` (`@/lib/supabase/admin`), `app/api/supabase-check/route.ts:2,3` (`/server`, `/admin`). No page, component or hook imports a Supabase client directly - grep `from "@/lib/supabase/*"` / `"@supabase/*"` over `app components hooks context`.

Group A is the actionable set: 12 of them are the `app/admin/settings/*` singleton-doc editors that
one settings service would absorb, and `components/admin/layout/AdminAuthGuard.tsx` /
`components/auth/ProtectedRoute.tsx` reach for `firebase/auth` directly rather than `authService`.

---

## Who imports each service (named, from `import-graph.json`)

Answers "which app code calls this service". `services/proof-report/*` is omitted: those 13 files are
imported only by each other and by `scripts/generate-proof-report.ts`.

| Service (`services/`) | Importers |
|---|---|
| `aaradhane.service.ts` | `app/(public)/aaradhane/page.tsx`, `app/admin/aaradhane/page.tsx`, `app/admin/assistant/page.tsx`, `app/api/admin/aaradhane/[id]/route.ts`, `app/api/admin/aaradhane/route.ts`, `components/admin/aaradhane/AaradhaneStats.tsx`, `components/admin/aaradhane/AaradhaneTable.tsx`, `components/admin/aaradhane/CreateAaradhane.tsx`, `components/admin/aaradhane/EditAaradhane.tsx` |
| `ai-analytics.service.ts` | `app/api/ai/analytics/health/route.ts`, `app/api/ai/analytics/intent-distribution/route.ts`, `app/api/ai/analytics/latency/route.ts`, `app/api/ai/analytics/route.ts`, `app/api/ai/analytics/token-usage/route.ts`, `app/api/ai/analytics/unknown-questions/route.ts` |
| `analytics.service.ts` | `app/api/admin/analytics/route.ts`, `lib/ai/generator.ts`, `services/ml.service.ts` |
| `announcement.service.ts` | `app/admin/announcements/[id]/edit/page.tsx`, `app/admin/announcements/new/page.tsx`, `app/admin/announcements/page.tsx`, `app/api/announcements/[id]/route.ts`, `app/api/announcements/route.ts`, `components/home/AnnouncementBar.tsx` |
| `auth.service.ts` | `context/AuthContext.tsx` |
| `billing.service.ts` | `app/admin/billing/create/page.tsx`, `app/admin/billing/page.tsx` |
| `chat.service.ts` | `app/admin/ai/page.tsx`, `app/admin/ai/testimonials/page.tsx`, `app/admin/ai/volunteers/page.tsx`, `app/api/testimonials/route.ts`, `app/api/volunteer/route.ts`, `components/ai/AIChatProvider.tsx` |
| `content.service.ts` | `app/api/admin/content/route.ts` |
| `conversation.service.ts` | `app/api/chat/route.ts` |
| `daily-spiritual.service.ts` | `app/(public)/display/page.tsx`, `app/(public)/page.tsx`, `app/api/dashboard/daily-spiritual/route.ts` |
| `dashboard.service.client.ts` | **none** |
| `dashboard.service.ts` | **none** |
| `device-analytics.service.ts` | **none** |
| `donation.service.ts` | `app/admin/donations/[id]/page.tsx`, `app/admin/donations/page.tsx`, `app/admin/reports/page.tsx`, `app/api/donations/[id]/route.ts`, `app/api/donations/route.ts`, `components/admin/donations/DonationDetails.tsx`, `components/home/DonationForm.tsx`, `services/report.service.ts` |
| `donationCampaign.service.ts` | **none** |
| `event.service.ts` | `app/(public)/events/[id]/page.tsx`, `app/(public)/favorites/page.tsx`, `app/admin/assistant/page.tsx`, `app/admin/events/[id]/edit/page.tsx`, `app/admin/events/page.tsx`, `app/api/events/[id]/route.ts`, `app/api/events/route.ts`, `components/admin/events/DeleteEventDialog.tsx`, `components/admin/events/EventForm.tsx`, `components/admin/events/EventTable.tsx`, `components/common/PersonalizedHomepage.tsx`, `components/events/EventGrid.tsx`, `services/quote.service.ts`, `services/search.service.ts` |
| `gallery.service.ts` | `app/(public)/display/page.tsx`, `app/(public)/favorites/page.tsx`, `app/(public)/gallery/page.tsx`, `app/admin/assistant/page.tsx`, `app/admin/gallery/[id]/edit/page.tsx`, `app/admin/gallery/new/page.tsx`, `components/admin/gallery/CreateImage.tsx`, `components/admin/gallery/EditImage.tsx`, `components/admin/gallery/GalleryDashboard.tsx`, `components/admin/gallery/GalleryTable.tsx`, `components/admin/gallery/LocalGalleryAssets.tsx`, `components/admin/gallery/MediaGrid.tsx`, `services/search.service.ts` |
| `homepage.service.ts` | `components/admin/settings/homepage/useHomepageForm.ts`, `hooks/useHomepage.ts`, `services/daily-spiritual.service.ts` |
| `knowledge-workflow.service.ts` | `app/api/knowledge/workflow/approvals/route.ts`, `app/api/knowledge/workflow/articles/[id]/route.ts`, `app/api/knowledge/workflow/articles/route.ts`, `app/api/knowledge/workflow/audit/route.ts`, `app/api/knowledge/workflow/comments/route.ts`, `app/api/knowledge/workflow/drafts/route.ts`, `app/api/knowledge/workflow/statistics/route.ts`, `app/api/knowledge/workflow/versions/[id]/route.ts` |
| `knowledge.service.ts` | `app/(public)/favorites/page.tsx`, `app/api/knowledge/article/[slug]/route.ts`, `app/api/knowledge/categories/route.ts`, `app/api/knowledge/route.ts`, `app/api/knowledge/search/route.ts`, `app/knowledge/[category]/page.tsx`, `app/knowledge/article/[slug]/page.tsx`, `app/knowledge/page.tsx`, `components/common/PersonalizedHomepage.tsx`, `services/recommendation.service.ts`, `services/search.service.ts` |
| `ml.service.ts` | `lib/ai/intent/detector.ts` |
| `multi-source-retrieval.service.ts` | `app/api/ai/multi-source/overview/route.ts`, `app/api/ai/multi-source/query/route.ts`, `app/api/ai/multi-source/quick-queries/route.ts`, `app/api/ai/multi-source/statistics/route.ts`, `app/api/ai/multi-source/today/route.ts` |
| `pageviews.service.ts` | `app/admin/page.tsx`, `components/analytics/PageViewTracker.tsx` |
| `pooja.service.ts` | `app/admin/assistant/page.tsx`, `app/admin/pooja/page.tsx`, `components/admin/pooja/CreatePooja.tsx`, `components/admin/pooja/EditPooja.tsx`, `components/admin/pooja/PoojaStats.tsx`, `components/admin/pooja/PoojaTable.tsx` |
| `profile.service.ts` | `context/ProfileContext.tsx` |
| `quote.service.ts` | `app/(public)/favorites/page.tsx`, `app/api/admin/quotes/[id]/route.ts`, `app/api/admin/quotes/bulk/route.ts`, `app/api/admin/quotes/cache/route.ts`, `app/api/admin/quotes/route.ts`, `app/api/admin/quotes/seed/route.ts`, `app/api/quotes/category/[category]/route.ts`, `app/api/quotes/featured/route.ts`, `app/api/quotes/festival/[festival]/route.ts`, `app/api/quotes/preview/route.ts`, `app/api/quotes/random/route.ts`, `app/api/quotes/route.ts`, `app/api/quotes/search/route.ts`, `app/api/quotes/stats/route.ts`, `app/api/quotes/tags/route.ts`, `app/api/quotes/today/route.ts`, `components/common/PersonalizedHomepage.tsx`, `services/daily-spiritual.service.ts` (`lib/ai/generator.ts` dropped its import by 2026-10-18) |
| `receipt.service.ts` | `app/admin/receipts/[receiptId]/page.tsx`, `app/admin/receipts/[receiptId]/print/page.tsx`, `app/admin/receipts/create/page.tsx`, `app/admin/receipts/page.tsx`, `app/admin/reports/page.tsx` |
| `receiptSeva.service.ts` | `app/admin/receipts/create/page.tsx`, `app/admin/receipts/page.tsx`, `app/admin/receipts/seva-settings/page.tsx` |
| `recommendation.service.ts` | `app/api/recommendations/route.ts` |
| `report.service.ts` | **none** |
| `search.service.ts` | `app/api/search/route.ts`, `app/api/search/suggestions/route.ts`, `components/search/GlobalSearch.tsx` |
| `settings.service.ts` | `app/(public)/display/page.tsx`, `app/admin/settings/page.tsx`, `components/home/SocialBar.tsx`, `components/layout/Navbar.tsx` |
| `seva.service.ts` | `app/admin/assistant/page.tsx`, `components/home/SevaBooking.tsx` |
| `sevaBooking.service.ts` | `app/admin/assistant/page.tsx`, `app/admin/bookings/[id]/page.tsx`, `app/admin/bookings/page.tsx`, `app/admin/reports/page.tsx`, `app/admin/seva-bookings/page.tsx`, `app/api/bookings/[id]/route.ts`, `app/api/bookings/route.ts`, `components/admin/bookings/BookingDetails.tsx`, `components/admin/bookings/[id]/page.tsx`, `components/home/SevaBooking.tsx`, `services/report.service.ts` |
| `storage.service.ts` | `app/api/reports/list/route.ts`, `app/api/reports/save/route.ts`, `app/api/storage/videos/route.ts`, `components/admin/gallery/GalleryDashboard.tsx`, `components/admin/gallery/VideosManager.tsx`, `components/ui/ImageUploader.tsx`, `components/ui/VideoUploader.tsx` |
| `temple-areas.service.ts` | `app/api/admin/temple-areas/[id]/route.ts`, `app/api/admin/temple-areas/route.ts`, `app/api/temple-areas/[id]/route.ts`, `app/api/temple-areas/route.ts` |
| `temple-areas.supabase.service.ts` | `services/temple-areas.service.ts` |
| `testimonial.service.ts` | `app/(public)/testimonials/page.tsx`, `app/admin/testimonials/page.tsx`, `components/home/TestimonialSubmissionForm.tsx`, `components/home/Testimonials.tsx` |
| `user.service.ts` | `app/admin/users/[id]/edit/page.tsx`, `app/admin/users/page.tsx`, `components/admin/users/DeleteUserDialog.tsx`, `components/admin/users/UserForm.tsx` |
| `ux.service.ts` | `app/api/chat/route.ts` |
| `volunteer.service.ts` | `app/admin/sevas/[id]/edit/page.tsx`, `app/admin/sevas/new/page.tsx`, `app/admin/sevas/page.tsx` |

---

## How to change it

### Recipe 1 - add a field to an existing Firestore entity (e.g. `SevaBooking.gotra`)

1. `types/seva-booking.ts` - add the field to `SevaBooking` and to `SevaBookingRequest`.
2. `services/sevaBooking.service.ts:7` - add it to `docToBooking` with a default (`data.x || ""`); the
   mapper is exhaustive, a missing line silently drops the field.
3. `createBooking` `:34` spreads `...data`, so writes need no change; `updateBookingStatus`/`updatePayment`
   list fields explicitly and do need editing if the field is updatable there.
4. The form component (M03/M07) and the admin table column (M07).
5. If the field is queried or sorted, add the composite index in `firestore.indexes.json` (M11) - this
   layer swallows `failed-precondition` into `[]`, so a missing index looks like "no data".

### Recipe 2 - add a whole new Firestore-backed entity

1. `types/<entity>.ts` - `<Entity>` and `<Entity>Request`. Keep `createdAt`/`updatedAt` as `string`
   (ISO) in the type, not `Timestamp`, so nothing outside the service touches the Firebase SDK.
2. `services/<entity>.service.ts` - copy `services/sevaBooking.service.ts` verbatim (93 lines): the
   `COLLECTION_NAME` constant, the `docTo<Entity>` mapper, the class, the exported singleton.
3. Firestore rules + indexes (M11).
4. Admin page using the CRUD framework (M05) + `types/crud.ts` columns.
5. Do **not** add a `dashboard`-style counter file; use `getCountFromServer`.

### Recipe 3 - add an entity on Supabase instead (the migration direction)

1. Migration SQL + RLS policy (M11). Keep the `firestore_id` text column as the public id, matching
   `events`/`sevas`.
2. `services/<entity>.service.ts` modelled on `temple-areas.supabase.service.ts`, **not** on
   `event.service.ts`: create the client inside each method, use `createAdminClient()` only in methods
   named `*` (admin) and `createClient()` from `lib/supabase/server` in methods named `*Public*`.
3. Write a `mapToX(row)` snake_case→camelCase mapper and a matching `updateData` builder.
4. Expose it through an API route (M12) if any caller is a client component - never let a client
   component reach a method that touches `createAdminClient`.

### Recipe 4 - move an entity from Firestore to Supabase without the seva split-brain

1. Write the Supabase table and backfill (M11 scripts).
2. Change **reads and writes together** in one service file. `seva.service.ts` is the counter-example:
   `getAllSevas` `:9` reads Supabase while `createSeva` `:74` writes Firestore.
3. Grep for direct Firestore access to that collection outside the service before switching -
   `daily-spiritual.service.ts:293,:331` still reads Firestore `events` although `eventService` is on Supabase.
4. Delete the Firestore branch rather than leaving it as a `catch` fallback; a fallback that reads a
   stale store is worse than an error.

### Recipe 5 - make a service callable from a client component safely

1. Decide the boundary: if the operation needs a secret (`SUPABASE_SERVICE_ROLE_KEY`,
   `BLOB_READ_WRITE_TOKEN`, Admin SDK) it must not be in a module a client component imports.
2. Add `import "server-only"` at the top of the server half (see `lib/firebase-admin-rest.ts:5`) -
   this turns a silent runtime failure into a build error.
3. Put an API route in front of it (M12) and give the browser-side service the
   `receipt.service.ts` shape: `fetch` + `Authorization: Bearer <idToken>` + typed response mapper.
4. Split the file if needed. `settings.service.ts` did this on 2026-10-13 by moving writes into
   `app/actions/settings.ts` - but a server action never receives the browser's Firebase ID token as
   an `Authorization` header, so a `checkAdminAuth`-style guard rejects every call (M10-F43). Either
   pass the ID token as an action argument and verify it, or use a route handler with the
   `receipt.service.ts` bearer pattern.

### Recipe 6 - add a receipt delivery channel (finish the half-built feature)

1. `lib/services/email.ts` / `lib/services/whatsapp.ts` already build the PDF and the message.
2. Replace `app/api/admin/receipts/[id]/send/route.ts` (currently a one-line `{success:true}` stub)
   with: verify the ID token, load the receipt via the Admin SDK, call `sendEmail`/`sendWhatsApp`,
   record the outcome.
3. `types/receipt-extensions.ts` already declares `DeliveryStatus`, `DeliveryInfo`, `ReceiptDelivery`
   and has zero importers - use it for the persisted result.
4. Add `services/receipt.service.ts` → `sendReceipt(id, channel, idToken)` following the existing
   `fetch` + bearer pattern.

### Recipe 7 - retire a dead service

Confirm with `grep -rn "<exportName>" app components hooks lib services --include=*.ts --include=*.tsx`
(the import graph agrees). Currently safe to delete: `services/dashboard.service.ts`,
`services/dashboard.service.client.ts`, `services/report.service.ts`,
`services/device-analytics.service.ts`, and - only after Recipe 6 is rejected -
`types/receipt-extensions.ts`. `services/donationCampaign.service.ts` has a UI-less collection; keep or
delete deliberately.

### Recipe 8 - change a business rule that lives in a service

Rules are scattered, not centralised. Known locations: booking auto-confirm on payment
(`sevaBooking.service.ts:83`), bill totals and tax (`billing.service.ts:66-89`), invoice numbering
(`billing.service.ts:62,:141`), quote-of-the-day selection and the 7 a.m. IST cutoff
(`quote.service.ts:227,:494`), temple open/closed (`daily-spiritual.service.ts:89`), role
normalisation (`types/user.ts:22`), recommendation ranking (`recommendation.service.ts:231-425`).

---

## Faults, smells and risks

| id | sev | what | evidence | direction | status 2026-10-18 |
|---|---|---|---|---|---|
| M10-F01 | HIGH | Production Firebase credentials hardcoded as `||` fallbacks - apiKey, projectId, appId, measurementId are in source and ship to the browser regardless of env config. | `lib/firebase.ts:57-65` | Remove the fallbacks; fail loudly when env is missing. Rotate the key. | STILL OPEN - `lib/firebase.ts` unchanged |
| M10-F02 | HIGH | `sevaService` reads Supabase but writes Firestore, so admin edits to sevas are invisible to every reader. | `services/seva.service.ts:11` (`getAllSevasAction`) vs `:76,:81,:86` (`addDoc/updateDoc/deleteDoc` on Firestore `sevas`) | Move writes to Supabase (`app/actions/sevas.ts` pattern) and delete the Firestore branch. | STILL OPEN - `services/seva.service.ts` unchanged |
| M10-F03 | HIGH | `storageService` calls `@vercel/blob` `put/del/list`, which need the server-only `BLOB_READ_WRITE_TOKEN`, from four `"use client"` components. | `services/storage.service.ts:69,:173,:181`; callers `components/ui/ImageUploader.tsx:67`, `components/ui/VideoUploader.tsx:61`, `components/admin/gallery/GalleryDashboard.tsx:53`, `components/admin/gallery/VideosManager.tsx:38`; `.env.example:20` | Move uploads behind an API route; keep a thin `fetch` client service. | STILL OPEN - `storage.service.ts` changed only in whitespace (f5582d2); still `@vercel/blob`; caller lines moved +1 |
| M10-F04 | HIGH | `settingsService` write methods dynamically import the service-role Supabase admin client and are reachable from a `"use client"` admin page. | 2026-09-19: `services/settings.service.ts:72,:96`; `lib/supabase/admin.ts:4,:10`; `app/admin/settings/page.tsx` is `"use client"`. Today: `services/settings.service.ts:70,:75` import `app/actions/settings.ts`; `lib/supabase/admin.ts:1` is `server-only` | Split reads/writes; put writes behind an authenticated route. | FIXED (2026-10-18) - 54024a1: writes moved to the `"use server"` actions in `app/actions/settings.ts` (admin check + zod) and `lib/supabase/admin.ts:1` is now `server-only`; the replacement rejects every browser call, see M10-F43 |
| M10-F05 | HIGH | AGENTS.md "No Direct Firebase Calls - use services only" is violated by **40 files** (41 on 2026-09-19) that hold the client Firebase SDK themselves: 35 pages/components/hooks plus 5 API routes. Including the 6 API routes that legitimately use the Admin SDK, 46 files carry 84 direct `firebase/*` or `@/lib/firebase` import lines. 12 of the 40 are admin settings pages doing `doc/getDoc/setDoc` inline against `settings/*` singleton docs. Full list: **Direct Firebase access outside the service layer** (group D adds 2 more client-SDK files the grep pattern misses: `hooks/useHomepage.ts:27-28` dynamic imports, `context/AuthContext.tsx:11,13`). | `app/admin/settings/{about,ekadashi-calendar,facilities,festival-calendar,footer,future-plans,guru-parampara,puja-schedule,shlokas,social-links,trust-committee}/page.tsx:7-8` and `app/admin/settings/finance/page.tsx:6-7`; `app/admin/page.tsx:12-13`; `app/admin/media/page.tsx:25,:35-36`; `app/(public)/{about,facilities,future-plans,trust}/page.tsx`; `components/admin/events/EventForm.tsx:4`; `components/layout/Footer.tsx:8-9`; `hooks/useFinanceSettings.ts:4-5`; `hooks/useGallery.ts:10,:12` | One `settings.service` covering the `settings/*` singleton docs would absorb 12 of the 40. | STILL OPEN - 40 files (was 41): `app/api/seed-ai-settings/route.ts` no longer imports Firebase |
| M10-F06 | HIGH | `testimonial.service.ts` short-circuits to `null` whenever `window` is undefined, so every server render and every API route gets the 4 hardcoded `DEFAULT_TESTIMONIALS` instead of real data. (The one exception is `getPendingTestimonials` `:68-73`, which returns `[]` on the server - the admin moderation queue silently looks empty rather than stale.) | `services/testimonial.service.ts:12`, defaults `:32-65`, returned at `:140,:166,:169,:178,:192,:210,:219` | Delete the `window` guard; import `db` statically. | STILL OPEN - whitespace-only change (f5582d2), line numbers unchanged |
| M10-F07 | HIGH | Invoice numbers are passed in as a parameter defaulting to `1` and payments are applied with a non-transactional read-modify-write - duplicate invoice numbers and lost payments under concurrency. | `services/billing.service.ts:141-144` (`invoiceNumber: number = 1`), `:237-265` (`getBill` then `updateDoc` with `[...bill.payments, newPayment]`) | Allocate numbers from a counter doc inside `runTransaction`; apply payments with a transaction + `arrayUnion`. | STILL OPEN - `billing.service.ts` unchanged |
| M10-F08 | HIGH | Every receipt is reported as UPI - the payment-mode ternary has the same value on both branches. | `services/receipt.service.ts:23` `paymentMode: data.paymentMode === "upi" ? "upi" : "upi"` | Map the real value and widen `Receipt["paymentMode"]`. | STILL OPEN - `receipt.service.ts:23` unchanged |
| M10-F09 | HIGH | Receipt delivery is a stub that always reports success while the working email/WhatsApp senders are never imported. | `app/api/admin/receipts/[id]/send/route.ts` (entire file: `export async function POST() { return Response.json({ success: true }); }`); `lib/services/email.ts:5` and `lib/services/whatsapp.ts:4` have 0 importers | See Recipe 6. | STILL OPEN - send route and `lib/services/*` unchanged, 0 importers |
| M10-F10 | HIGH | The admin dashboard pulls up to 10,000 `page_views` documents per load and ignores the `days` window it computes. | `services/pageviews.service.ts:110` (`weekAgo` unused), `:113-117` (`limit(10000)`, no `where`) | Read the pre-aggregated `daily_page_stats` docs instead. | STILL OPEN - `pageviews.service.ts` unchanged |
| M10-F11 | HIGH | No service validates input and no service checks authorisation; browser-issued `addDoc`/`updateDoc` are constrained only by Firestore rules. `zod` appears nowhere in the layer. | e.g. `services/sevaBooking.service.ts:34`, `services/donation.service.ts:37`, `services/auth.service.ts:94-116` (client write of `role`) | Add a schema per `*Request` type and validate at the service boundary; move money/role writes server-side. | STILL OPEN - only site-settings writes gained zod, and that is in M12 (`app/actions/settings.ts:10-20`), not in the service layer |
| M10-F12 | HIGH | Two services claim the same `testimonials` collection with different semantics - `chat.service.getPendingTestimonials` filters only `approved == false`, `testimonial.service.getPendingTestimonials` also requires `submittedBy == "public"`. Admin-created testimonials appear in one list and not the other. | `services/chat.service.ts:227-242` (was `:173-188`) vs `services/testimonial.service.ts:68-107` | Keep one; delete the testimonial block from `chat.service.ts`. | MOVED - `services/chat.service.ts:227-242`; filters unchanged |
| M10-F42 | HIGH | The **public** temple-areas API routes expose unauthenticated writes that run on the Supabase **service-role** client. `POST /api/temple-areas` calls `addArea`, `PUT`/`DELETE /api/temple-areas/[id]` call `updateArea`/`deleteArea`; none of the three checks a session, a bearer token or a role, and the repo has no root `middleware.ts` to do it for them. Anyone who can reach the site can create, rewrite or delete every row of `temple_areas`. The only validation is a non-empty `name` and a present `category`. | `app/api/temple-areas/route.ts:14-31` (POST, no auth, `addArea` `:26`); `app/api/temple-areas/[id]/route.ts:23-37` (PUT `:31`), `:39-50` (DELETE `:45`); `services/temple-areas.supabase.service.ts:98,:129,:159` (`createAdminClient()`); no `middleware.ts` at the repo root, and the root `proxy.ts` (Next's renamed middleware) only adds security headers and logs page views - `/api/*` passes straight through (`proxy.ts:84-120`) | Verify an admin ID token in the route before any write, or delete the write handlers from the public route and keep them only under `/api/admin/*` behind auth. | STILL OPEN - both route files unchanged; `proxy.ts` does not gate `/api/*` |
| M10-F13 | MEDIUM | Two competing session models write the same `chat_sessions` collection with different field sets. (Since 2026-10-06 they live in different stores: Firestore `chat_sessions` for `conversation.service`, Supabase `chat_sessions` for `chat.service`.) | `services/conversation.service.ts:60` vs `services/chat.service.ts:11-16` (was `:20,:31-40`) | Pick one owner for `chat_sessions`. | STILL OPEN (reshaped) - two session models, now in two stores (224875d) |
| M10-F14 | MEDIUM | Two dead dashboard services export the same symbol `dashboardService` from the same class name `DashboardService`; the `.client` variant downloads every document to count it. | `services/dashboard.service.ts:6,:43`; `services/dashboard.service.client.ts:5,:24-26,:47`; 0 importers each | Delete both, or keep `dashboard.service.ts` and wire it to `app/admin/page.tsx`. | STILL OPEN - both files unchanged, 0 importers |
| M10-F15 | MEDIUM | Dead code with zero importers: `report.service.ts` (67), `donationCampaign.service.ts` (142), `device-analytics.service.ts` (232), `lib/services/email.ts` (66), `lib/services/whatsapp.ts` (70), `types/receipt-extensions.ts` (13). | `.claude/state/inventory/import-graph.json`; confirmed by grep over `app components hooks lib services` | Delete or wire up - see Recipes 6 and 7. | STILL OPEN - all six files still have 0 importers (`import-graph.json` 2026-10-18) |
| M10-F16 | MEDIUM | `aaradhaneService` merges two collections (`aaradhane`, `aaradhanes`) but writes only to the first; `deleteAaradhane`'s second branch is unreachable because Firestore `deleteDoc` resolves for a missing document; `EVENTS_COLLECTION` and `eventDocToAaradhane` (67 lines) are dead. | `services/aaradhane.service.ts:16-18,:158-192,:227,:244-273,:77-144` | Consolidate onto one collection and delete the dead mapper. | STILL OPEN - `aaradhane.service.ts` unchanged |
| M10-F17 | MEDIUM | `isFirebaseConfigured` is used without calling it, so half of the guard is always false. | `services/pageviews.service.ts:36,:93` vs the function declaration `lib/firebase.ts:46,:220` (`ai-analytics.service.ts:58,:102,:270,:470,:565` calls it correctly) | Add the parentheses; a lint rule for unused-expression/truthy-function would catch it. | STILL OPEN - `pageviews.service.ts:36,:93` unchanged |
| M10-F18 | MEDIUM | `ai-analytics` gates Supabase writes on Firebase being configured, so removing Firebase config silently kills AI latency and intent telemetry; the `COLLECTIONS` map still advertises those two as Firestore collections. | 2026-09-19: `services/ai-analytics.service.ts:45-46,:129-145,:165-180`. Today: `:128`, `:164`, `:198` gate only on analytics settings; the stale map entries are `:46-48` | Gate on the store actually used. | FIXED (2026-10-18) - BOT-004 series 2cd44c7..556a704 removed the Firebase gate from every Supabase path; residual Firebase gate on the dashboard is M10-F45 |
| M10-F19 | MEDIUM | Module-level in-memory caches and queues in a serverless runtime - per-lambda, unbounded in behaviour, invisible to other instances. Two carry "would be Firestore in production" comments. | `services/quote.service.ts:39-46`, `services/knowledge.service.ts:27-28`, `services/ml.service.ts:39-41`, `services/multi-source-retrieval.service.ts:508,:552-553` | Move to the store or to Next's `unstable_cache`/`revalidate`. | STILL OPEN - cache lines unchanged (`ml.service.ts` edits are below `:41`) |
| M10-F20 | MEDIUM | `profileService.removeBookmark(uid, bookmarkId)` matches on the `itemId` field while `addBookmark` returns the Firestore document id - callers holding the returned id cannot delete. | `services/profile.service.ts:327-352` vs `:357-375` (`where("itemId","==",bookmarkId)`) | Delete by `doc(db,"bookmarks",id)`. | STILL OPEN - `profile.service.ts` unchanged |
| M10-F21 | MEDIUM | Counter fields incremented by read-then-write instead of `increment()`/`arrayUnion` - lost updates. | `services/chat.service.ts:125-130` (`message_count`, was `:104-110`), `services/profile.service.ts:264-277` (`favorites`), `:303-322` (`recentlyViewed`) | Use `increment(1)` / `arrayUnion` / `arrayRemove`. | STILL OPEN - chat counter MOVED to `chat.service.ts:125-130` (Supabase now, same read-then-write) |
| M10-F22 | MEDIUM | `getNextUpcomingEvent` reads the entire `events` collection and filters in JS, with a comment admitting it is avoiding an index; it is imported by 73-importer `lib/firebase.ts`, so it is in every bundle. | `lib/firebase.ts:155-199` | Query with `where`+`orderBy`+`limit(1)` and add the index. | STILL OPEN - `lib/firebase.ts` unchanged |
| M10-F23 | MEDIUM | `event.service.ts` creates a Supabase **browser** client at module scope and is imported by server API routes; all writes therefore carry the anon key. | `services/event.service.ts:2,:4`; importers `app/api/events/route.ts`, `app/api/events/[id]/route.ts` | Create the client per call, picking `lib/supabase/server` or `/admin` by context. | STILL OPEN - `event.service.ts` unchanged |
| M10-F24 | MEDIUM | Errors are swallowed into `[]`/`null` with a `console.error`, so callers cannot distinguish "no rows" from "permission denied" or "missing index". 246 `console.*` calls in 33 of the 102 files (242 on 2026-09-19). | `services/sevaBooking.service.ts:46-49`, `services/gallery.service.ts:117-120`, `services/announcement.service.ts:39-42`, `services/temple-areas.supabase.service.ts:20-29`, and ~20 more | Return a discriminated result or rethrow; the inconsistency is worse than either choice. | STILL OPEN - recounted 246 calls / 33 files; the new Supabase paths in `chat.service`/`ai-analytics` rethrow instead |
| M10-F25 | MEDIUM | No pagination anywhere except the receipts HTTP client - `getAllBookings`, `getDonations`, `getBills`, `getQuotes`, `getAllTestimonials`, `getUsers`, `getMedia` all fetch whole collections. | `services/sevaBooking.service.ts:43`, `services/donation.service.ts:46`, `services/billing.service.ts:94`, `services/user.service.ts:20`, `services/gallery.service.ts:157` vs `services/receipt.service.ts:42-50` | Add cursor params to the list methods before any collection grows. | STILL OPEN - list methods unchanged |
| M10-F26 | MEDIUM | `docs/ARCHITECTURE.md:188-196` declares an `IService<T>` contract (`getAll/getById/create/update/delete`) and `:203` shows `eventService.getAll()`. No service implements it and that method does not exist. | `docs/ARCHITECTURE.md:188-203` vs `services/event.service.ts:42` (`getEvents`), `services/seva.service.ts:9` (`getAllSevas`), `services/pooja.service.ts:40` (`getPoojas`), `services/billing.service.ts:92` (`getBills`) | Either introduce the base type or correct the doc. | STILL OPEN - `docs/ARCHITECTURE.md` unchanged |
| M10-F27 | MEDIUM | `services/` is split between classes-with-singletons, plain object literals and bare exported functions, with three different "Firebase missing" policies (`throw`, `return []`, `return defaults`). | classes: `sevaBooking`, `billing`, `event`; objects: `pooja.service.ts:39`, `gallery.service.ts:110`, `volunteer.service.ts:38`, `aaradhane.service.ts:157`; functions: `chat`, `analytics`, `testimonial`, `knowledge-workflow` | Pick one shape for new code and state it in CODING-STANDARDS.md. | STILL OPEN - no shape convention adopted |
| M10-F28 | MEDIUM | `lib/settings/temple.ts:7` `updateTempleSettings` logs and discards the payload, so temple-settings saves are silently lost. | `lib/settings/temple.ts:7-10` (`// We'll replace this with Firestore later`) | Implement or remove the export. | STILL OPEN - `lib/settings/temple.ts` unchanged |
| M10-F29 | MEDIUM | 17 exported type names are declared in more than one file - `TempleEvent` in three, plus `Testimonial`, `PaymentStatus`, `PaymentMode`, `Festival`, `SearchSuggestion`, `UnknownQuestion`, `Announcement`, `Seva`, `DailyPooja`, `GalleryAlbum`, `GalleryMedia`, `HomepageConfig`, `SiteSettings`, `TempleTimings`, `VolunteerRequest`, `Tithi`. Autocomplete picks the wrong one. | `types/event.ts` / `types/multi-source-retrieval.ts` / `types/proof-report.ts`; `types/ai.ts` / `types/homepage.ts`; `types/billing.ts` / `types/seva-booking.ts`; `types/donation.ts` / `types/receipt.ts`; `types/calendar.ts` / `types/festival.ts` | Make `types/proof-report.ts` and `types/multi-source-retrieval.ts` import the canonical types instead of redeclaring. | STILL OPEN - recounted: the same 17 names |
| M10-F30 | MEDIUM | Admin SDK credential handling: `FIREBASE_PRIVATE_KEY` falls back to `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` (a private key under a client-exposed prefix) and then to the literal `"invalid-key"`. That makes the `privateKey` half of `if (clientEmail && privateKey)` `:58` permanently truthy, so with a client email but no key the SDK is initialised with a bogus credential and fails later with an opaque error instead of "key missing". `projectId` likewise falls back to `"demo-project"` `:64`. | 2026-09-19: `lib/admin-firebase.ts:56,:58,:64`. Today: `:91` (`NEXT_PUBLIC_` + `"invalid-key"`), `:93`, and the ADC branch's `projectId: "demo-project"` `:136`; the env branch now throws without a project id `:98-102` | Remove all three fallbacks; fail fast when a credential is absent. | STILL OPEN (partly fixed, f43cba1) - env branch no longer defaults to `"demo-project"`; key fallbacks and ADC `"demo-project"` remain - MOVED to `:91,:93,:136` |
| M10-F31 | MEDIUM | `temple-areas` splits read methods by privilege - `getAreas`/`getArea` use the **service-role** client, `getPublicAreas`/`getPublicArea` use the RLS client - but **every write method is service-role only**: `addArea`, `updateArea`, `deleteArea` have no RLS-respecting twin, so any route that exposes a write necessarily bypasses RLS. (The GET halves are wired correctly: the public routes do call the `*Public*` methods.) | `services/temple-areas.supabase.service.ts:14,:61` (admin reads) vs `:37,:79` (RLS reads); writes `:98,:129,:159` all `createAdminClient()`; callers `app/api/temple-areas/route.ts:6,:26`, `app/api/temple-areas/[id]/route.ts:10,:31,:45`, `app/api/admin/temple-areas/route.ts:6,:25`, `app/api/admin/temple-areas/[id]/route.ts:10,:31,:47` | Add RLS-backed write methods, or gate the writes behind verified admin auth (see M10-F42). | STILL OPEN - `temple-areas.supabase.service.ts` unchanged |
| M10-F32 | MEDIUM | ~120 typed-`any` occurrences across 26-28 of the 102 M10 files (117 in 26 files by the literal pattern `: any` / `as any` / `any[]` / `<any>`; 122 in 28 when `:s*any`, `ass+any` and `, any>` are also counted - re-measured 2026-10-18, identical at the snapshot), against AGENTS.md "No `any` type" and CODING-STANDARDS.md "No `any`". Worst: `proof-report/proof-report.service.ts` 20, `types/proof-report.ts` 20, `ai-analytics.service.ts` 10, `knowledge-workflow.service.ts` 8. Concentrated in `docToX(docSnap: any)` mappers and `proof-report.service.ts:203-245`. | count by script over `.claude/state/inventory/M10.json`; e.g. `services/sevaBooking.service.ts:7`, `services/donation.service.ts:7,:13`, `services/aaradhane.service.ts:32,:50,:77`, `services/ai-analytics.service.ts:142` | Type mappers as `QueryDocumentSnapshot<DocumentData>`. | STILL OPEN - same count as the snapshot (117 / 26 strict, 122 / 28 loose; the earlier "119 / 28" is not reproducible by either pattern); `ai-analytics.service.ts` still 10 (new `(doc: any)` mappers `:343,:394,:444`) |
| M10-F33 | MEDIUM | `lib/firebase-admin-rest.ts` serialises every JavaScript number as `integerValue`, so decimal amounts are corrupted or rejected; documents are also fetched at a fixed `pageSize=100` with no cursor. | `lib/firebase-admin-rest.ts:121-122,:130,:93` | Branch on `Number.isInteger`; add `nextPageToken` handling. | STILL OPEN - `lib/firebase-admin-rest.ts` unchanged |
| M10-F34 | LOW | `deviceAnalytics.flush()` loops forever when a batch is already in flight, because `processQueue` returns immediately without draining. Events are discarded anyway. | `services/device-analytics.service.ts:180-211` | Dead file; delete (M10-F15). | STILL OPEN - dead file unchanged |
| M10-F35 | LOW | `normalizeRole` has unreachable `case` branches - the input is lower-cased and space-to-underscore replaced before the switch, so the `case "super admin"` `:26`, `case "temple admin"` `:31` and `case "office staff"` `:36` branches can never match. The `UserRole` union `:3-16` carries 6 display-cased duplicates (`Billing`, `Super Admin`, `Temple Admin`, `Priest`, `Office Staff`, `Volunteer`). | `types/user.ts:3-16,:22,:26,:31,:36` | Normalise the union; drop the dead cases. | STILL OPEN - `types/user.ts` unchanged |
| M10-F36 | LOW | Five `types/*.ts` files import from `firebase/firestore` (`Timestamp`), coupling the shared vocabulary to the web SDK. | `types/user.ts:1`, `types/billing.ts`, `types/event.ts`, `types/profile.ts`, `types/aaradhane-generator.ts` | Use ISO strings or a local `Timestampish` alias. | STILL OPEN - same 5 files import `Timestamp` |
| M10-F37 | LOW | Unused imports and dead constants: `DEFAULT_TEMPLE_AREAS`, `FirestoreError`, `updateDoc`/`where`/`Timestamp`, `SESSIONS_COLLECTION`, `sourceField`/`deviceField`, `EVENTS_COLLECTION`. | `services/temple-areas.supabase.service.ts:4`, `services/profile.service.ts:16`, `services/pageviews.service.ts:7,:11,:59-60`, `services/aaradhane.service.ts:18` | Enable `noUnusedLocals`. | STILL OPEN - all cited lines unchanged; add `chat.service.ts:3` (see M10-F47) |
| M10-F38 | LOW | `galleryService` exposes five alias methods that only forward (`getImages`→`getMedia`, `getImageById`→`getMediaById`, `createImage`, `updateImage`, `deleteImage`), doubling the surface for no gain. | `services/gallery.service.ts:175,:215,:225,:234,:243` | Keep one name per operation. | STILL OPEN - `gallery.service.ts` unchanged |
| M10-F39 | LOW | Every Vercel Blob upload uses `addRandomSuffix:false`, so two files with the same generated name overwrite each other; testimonial images are keyed by name+phone. | `services/storage.service.ts:72,:96,:143,:261`; caller `services/testimonial.service.ts:307-309` | Enable the random suffix or include a uuid. | STILL OPEN - `storage.service.ts:72,:96,:143,:261` and `testimonial.service.ts:307-309` unchanged |
| M10-F40 | LOW | `temple-areas` passes an unbound method to `map`, which works only because the mapper happens not to use `this`. | `services/temple-areas.supabase.service.ts:188` | `rows.map(r => this.mapToTempleArea(r))`. | STILL OPEN - `temple-areas.supabase.service.ts:188` unchanged |
| M10-F41 | LOW | Content and static data live in `types/` - `types/guru.ts` (371 lines of biographies), `types/temple-explorer.ts` (347, area seed data), `types/festival.ts` (194, with functions), `types/quote.ts` (`DEFAULT_QUOTES_DATA`). Editing content requires a deploy. | `types/guru.ts:GURU_BIOGRAPHIES`, `types/temple-explorer.ts:TEMPLE_AREAS`, `types/festival.ts:getUpcomingFestivals` | Move data to the store or to `data/`, keep `types/` declarations-only. | STILL OPEN - `types/temple-explorer.ts` grew (accessibility seed data), the rest unchanged |
| M10-F43 | HIGH | Site-settings saves always fail. `settingsService.createSettings/updateSettings` now call the `"use server"` actions in `app/actions/settings.ts`, whose guard rebuilds a `NextRequest` from the action's request headers and runs `checkAdminAuth`, which accepts only an `Authorization: Bearer` header. A browser server-action POST carries no such header and the admin page adds none, so every save throws `Unauthorized` and the page shows "Unable to save settings". Introduced while fixing M10-F04. | `services/settings.service.ts:69-77`; `app/actions/settings.ts:26-36,:39-42,:74-77`; `lib/auth/admin.ts:25-29`; caller `app/admin/settings/page.tsx:69-71`; no root `middleware.ts`, and `proxy.ts` adds no auth header | Pass the Firebase ID token as an action argument and verify it with the Admin SDK inside the action, or move the write to a route handler that the service calls with the `receipt.service.ts` bearer pattern. | NEW (2026-10-18) - 54024a1 |
| M10-F44 | HIGH | Raya chat history is never persisted. `chat.service.ts` moved sessions and messages to Supabase but uses the browser **anon** client for every call, and the migration that created `chat_sessions`/`chat_messages` enables RLS with `FOR ALL TO public USING (false)` and no other policy. Every insert fails with an RLS error, which `AIChatProvider` swallows without logging; selects and updates are not errors under `USING (false)` - they simply match zero rows - so the session list and history load as silently empty (the "Failed to load chat history" branch `:128-130` is not reached). (Corrected 2026-10-18 by the verifier.) | `services/chat.service.ts:8,:29,:48,:77,:107,:145` (`createClient()` from `lib/supabase/client`); `supabase/migrations/20260930000000_create_ai_tables.sql:92-93`; caller `components/ai/AIChatProvider.tsx:99,:110-118,:124` | Move session/message persistence behind an API route that uses `createAdminClient()` (as `ai-analytics.service.ts:133` does) or add narrowly scoped RLS policies. | NEW (2026-10-18) - 224875d |
| M10-F45 | MEDIUM | The AI analytics dashboard reads a store the chat no longer writes. `getAnalyticsDashboard` is still gated on Firebase config and counts conversations and messages from **Firestore** `chat_sessions`/`chat_messages`, while `chat.service` now writes Supabase; the `COLLECTIONS` map still lists `ai_latency_records`, `ai_intent_distribution` and `ai_unknown_questions` as Firestore collections, and the M09 page `app/admin/ai/analytics/page.tsx:315` still reads Firestore `ai_latency_records` directly. Overview totals are stale or zero. | `services/ai-analytics.service.ts:46-48,:565,:621-641`, `:470` (`checkAIHealth` gate); `services/chat.service.ts:11,:109` | Count from the Supabase tables with the admin client; delete the dead `COLLECTIONS` entries. | NEW (2026-10-18) - 2cd44c7..556a704 |
| M10-F46 | MEDIUM | Unknown-question telemetry is split across two stores under one name, and the live chat route writes both. `POST /api/chat` calls `generateResponse` (`lib/ai/generator.ts`), which logs questions under confidence 60 to **Firestore** `unknown_questions` through `analytics.service.logUnknownQuestion`; the same route then logs questions under confidence 50 to **Supabase** `unknown_questions` through `logLowConfidenceQuestion` (`lib/ai/unknown-logger.ts`). A question under 50 is recorded twice, once per store. `ai-analytics.getUnknownQuestions` and the review endpoint read and update only the Supabase table, so the Firestore copies (and every 50-59 question) are never reviewed. (Verifier 2026-10-18: the refresher called the generator "legacy" and named `lib/ai/ai-settings/repository.ts` the live writer - the reverse; that repository method is reached only from the unimported `lib/ai/composer/composer.ts:304`.) | `services/analytics.service.ts:10,:31`; `app/api/chat/route.ts:162,:192-193`; `lib/ai/generator.ts:14,:73`; `lib/ai/unknown-logger.ts:30`; unreached `lib/ai/ai-settings/repository.ts:412`; `services/ai-analytics.service.ts:203-218,:242-255,:419-458` | Retire the Firestore writer in `analytics.service.ts` or point it at the Supabase table. | NEW (2026-10-18) - 2cd44c7..556a704 |
| M10-F47 | LOW | `chat.service.ts` imports `createAdminClient` from `lib/supabase/admin.ts` - now a `server-only` module - and never uses it, in a file imported by four `"use client"` modules. It is harmless only while the compiler drops the unused import; the first real use breaks the client build. The file also re-opens its Firestore imports mid-file under a TODO. | `services/chat.service.ts:3,:172-186`; `lib/supabase/admin.ts:1`; importers `components/ai/AIChatProvider.tsx`, `app/admin/ai/page.tsx`, `app/admin/ai/testimonials/page.tsx`, `app/admin/ai/volunteers/page.tsx` (all `"use client"` at `:1`) | Delete the import; split `chat.service.ts` into a Supabase chat-history module and a Firestore testimonials/volunteers module. | NEW (2026-10-18) - 224875d |
| M10-F48 | LOW | The typo corrector carries a hardcoded special case added to make an intent test pass, plus identity entries (`'dress': 'dress'`, `'located': 'located'`) whose only purpose is to stop other corrections. | `services/ml.service.ts:235-242,:280` (`!(lowerWord === 'address' && typo === 'dress')`). The `:280` exclusion is dead code: `'address'` is itself a key of the typo table (`:241`), so `fuzzyMatch` returns at `:261` before the distance loop (verifier 2026-10-18) | Replace the pair exclusion with a stop-word list or a minimum-length rule. | NEW (2026-10-18) - 3446b0b |
| M10-F49 | LOW | The four `ai-analytics` writers - `recordTokenUsage`, `recordLatency`, `recordIntentDistribution`, `recordUnknownQuestion` - have no callers anywhere in `app/`, `lib/`, `components/` or `services/`. The Supabase latency and intent tables they target are filled only by the one-off migration scripts, so the analytics pages show migrated history and nothing new. (Already true on 2026-09-19 for the first three; first recorded here.) | `services/ai-analytics.service.ts:98,:124,:160,:194`; grep for the four names outside the file returns nothing; `scripts/migrate-ai-analytics.ts` | Call them from the chat route (M12) or delete them. | NEW (2026-10-18) - observed, pre-existing |

---

## Portability notes (React Native / cross-platform)

**`apps/mobile` (added 2026-09-30, 0cb71b6 / 5813fc9) consumes nothing from M10.** It imports no
file under `services/`, `types/` or `lib/`; it re-declares its own `WebsiteSettings`, `Seva`, `Pooja`,
`Event` and `Album` in `apps/mobile/lib/types.ts` and reads Supabase directly from
`apps/mobile/lib/api.ts` (`sevas`, `events`, `daily_poojas`, `gallery_albums`, `website_settings`),
and the web `tsconfig.json` excludes `apps/mobile/**`. So the shared `packages/types` contract
proposed below does not exist yet, and the mobile types are a further set of duplicates beside the
17 in M10-F29. Two web-side changes matter for it: the settings writes are now Next server actions
(not callable from RN), and the chat-history service is now Supabase-backed but RLS-blocked
(M10-F44).

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `types/*.ts` (37 of 42) | none | **reuse as-is** | Plain declarations plus static data; the single most reusable asset in the repo. |
| `types/{user,billing,event,profile,aaradhane-generator}.ts` | `firebase/firestore` `Timestamp` | **adapt** | Swap `Timestamp` for ISO strings, or import from `@react-native-firebase/firestore`. |
| `lib/firebase.ts` | `firebase/app|auth|firestore|storage` web SDK, `typeof window` branch, `browserLocalPersistence` | **rewrite** | RN needs `@react-native-firebase/*` or `initializeAuth` with `getReactNativePersistence(AsyncStorage)`. Lines `:76,:87-92,:105-116`. |
| Firestore CRUD services (~20 files: seva, sevaBooking, donation, pooja, announcement, user, volunteer, gallery, homepage, aaradhane, billing, quote, profile, chat (testimonial/volunteer/feedback half only since 2026-10), analytics, conversation, knowledge-workflow, ai-analytics (token usage and settings only since 2026-10), daily-spiritual) | web modular Firestore API imported directly | **adapt** | The query/mapping logic is platform-neutral; only the `db` handle and the `firebase/firestore` import path change. If `lib/firebase.ts` exported an interface instead of a concrete `db`, these would compile unchanged. |
| `services/auth.service.ts` | `firebase/auth` web SDK | **adapt** | Same API surface in `@react-native-firebase/auth`; `sendEmailVerification`/`sendPasswordResetEmail` map 1:1. |
| `services/profile.service.ts` (image upload half) | `firebase/storage` web `ref/uploadBytes`, browser `File` | **adapt** | RN has no `File`; upload from a local uri/blob. |
| Supabase services (`event`, `settings`, `temple-areas.supabase`, and since 2026-10 the `chat.service` session/message half) | `@supabase/ssr` `createBrowserClient`, Next cookie-based `lib/supabase/server` | **adapt** | `supabase-js` works in RN with an AsyncStorage auth adapter; `@supabase/ssr` does not. `temple-areas`' `createClient` from `lib/supabase/server` is Next-only. `settings` writes now go through Next server actions (`app/actions/settings.ts`) - Next-only. |
| `services/receipt.service.ts`, `services/receiptSeva.service.ts` | none (`fetch` + relative URL) | **reuse as-is** (one change) | Only the relative `BASE_URL` `:3` needs an absolute API host. This is the template every other service should follow for RN. |
| `services/storage.service.ts` | `@vercel/blob` (Node/server), `atob`, `Blob`, `File`, `Buffer` | **rewrite** | `:54,:59,:248,:287`. Replace with an upload API route the app posts multipart to. |
| `services/pageviews.service.ts` | `localStorage` `:208,:211`, `navigator.userAgent` `:222`, `typeof window` `:206,:220` | **adapt** | AsyncStorage + `react-native-device-info`. |
| `services/testimonial.service.ts` | `typeof window === "undefined"` gate `:12` | **rewrite** | The gate makes it a browser-only module by construction; it must go either way (M10-F06). |
| `services/device-analytics.service.ts` | `typeof window` `:34`, `setInterval` in constructor | **rewrite** | Dead anyway. |
| `services/{ml,ux,content,recommendation,search,multi-source-retrieval,knowledge}.service.ts` | none | **reuse as-is** | Pure TypeScript. `search.service.highlightKeywords` `:380` returns HTML strings that an RN client must render differently. |
| `services/proof-report/*` (13 files) | `playwright`, `fs`, `path`, `child_process` | **not applicable** | Build-time Node tooling; never ships to any client. |
| `lib/admin-firebase.ts`, `lib/firebase-admin-rest.ts`, `lib/services/{email,whatsapp}.ts` | `fs`, `firebase-admin`, `google-auth-library`, `nodemailer`, `server-only`, `Buffer` | **server-only, keep server-side** | Correct as-is; they belong behind the API, and an RN client must never import them. |
| `lib/settings/temple.ts` | static JSON import | **reuse as-is** | Metro bundles JSON the same way. |

**What a React Native client would need from this module.** The good news: `types/` is already a
usable shared contract and the pure-logic services are already portable - roughly 5,400 lines of types
and ~2,980 lines of ranking/search/NLP logic (ml 461, ux 366, content 371, recommendation 497, search
410, multi-source-retrieval 586, knowledge 286) move across untouched. The bad news is the shape of the
data access. Today ~20 services hold a live web-SDK `db` handle and issue queries from whatever process
imports them; an RN app cannot import those files, and reproducing them would duplicate every business
rule.

The migration that makes RN possible is the one that also fixes M10-F03, F04, F05 and F11: put an HTTP
API in front of every write and every privileged read, and reshape the browser-side services into the
`receipt.service.ts` form - a typed `fetch` client with a bearer token and an explicit response mapper.
That single refactor yields (1) a shared `packages/types` both clients import, (2) a shared
`packages/api-client` of `fetch`-based services that runs identically in Next.js and RN once `BASE_URL`
is configurable, (3) `packages/logic` for ml/ux/content/recommendation/search, and (4) a server-only
data layer holding the Firebase/Supabase handles. Auth is the remaining platform seam: the ID token has
to come from `@react-native-firebase/auth` (or Supabase auth with an AsyncStorage adapter) instead of
`lib/firebase.ts`, so `authService` and the token-fetch helper need a per-platform implementation
behind one interface.

---

## Coverage

filesExpected 102, filesMentioned 102, omitted: none. (Re-measured 2026-10-18 against the regenerated `.claude/state/inventory/M10.json`: still 102 files, 21,155 lines; every inventory path appears in this file.)

Every file in `.claude/state/inventory/M10.json` appears in at least one table row under **Key files**.
Depth of reading varies by the brief's rule: all files under 300 lines in `services/` and `lib/` were
read in full; the seven files over 300 lines (`quote` 1040, `knowledge-workflow` 1069, `ai-analytics`
873, `html-generator` 856, `multi-source-retrieval` 586, `recommendation` 497, `ml` 453, plus
`daily-spiritual` 446, `testimonial` 467 and `profile` 413 which were read in full) were read by
structure - exports, collection constants, cache declarations and service calls. `types/*.ts` were
catalogued from their export lists plus targeted reads of `types/user.ts` and the duplicate-name scan;
their bodies are declarations and static data, verified by line count and export inventory rather than
line-by-line.

Re-checked by script on 2026-09-19 (verification pass): 296 distinct concrete file paths and 15
directories are cited, all of which exist on disk (the remaining tokens are extension-less import
specifiers such as `@/lib/supabase/admin`, each of which resolves to a real `.ts` file, and glob
patterns), and every `path:line` citation was opened and matched against the claim. No path
is broken. The one non-path that read like a path - `services/admin` in M10-F30 - was prose, and has
been replaced with the real evidence `lib/admin-firebase.ts:56,:58,:64`.

---

## UNCLEAR

- **Whether Firestore security rules actually block the client-side writes this layer makes.** `authService.login` writes `role` from the browser (`services/auth.service.ts:105`) and `sevaBookingService.createBooking` writes an unvalidated document (`:34`). Settled by reading `firestore.rules` (M04/M11) - if the `users` rule permits self-writes of `role`, F11 is a privilege-escalation bug rather than a code smell.
- **Which Firestore composite indexes exist.** Several queries combine `where` + `orderBy` (`announcement.service.ts:48`, `billing.service.ts:131-136`, `testimonial.service.ts:77-82`, `chat.service.ts:213-215,:231-233`) and all swallow failures into `[]`. Settled by `firestore.indexes.json` (M11).
- **Whether `services/donationCampaign.service.ts` is pre-launch or abandoned.** It is complete and has zero importers; there is no `donation_campaigns` UI. Settled by the product owner or by M07's admin inventory.
- **Whether the `sevas` Firestore collection still holds live data.** `seva.service.ts` writes to it and Supabase reads never see it. Settled by a row count on both stores (out of scope for this static run; the repo's own notes in CLAUDE.md say a full dump is quota-limited to one per day).
- **Whether `storage.service.ts` uploads currently work at all in production**, or whether `BLOB_READ_WRITE_TOKEN` was at some point exposed as `NEXT_PUBLIC_`. `.env.example:20` shows the server-only name. Settled by the Vercel project's env configuration.
- **Which of `conversation.service.ts` and `chat.service.ts` is the live owner of `chat_sessions`.** Partly overtaken (2026-10-18): they now write different stores (Firestore vs Supabase), and the Supabase half is RLS-blocked (M10-F44). Which one the chat route relies on is still settled by M08's read of `app/api/chat/route.ts`.
- **Whether the unused `createAdminClient` import in `chat.service.ts:3` is elided before Next's `server-only` check runs** (2026-10-18). `tsconfig.json` sets `isolatedModules` but not `verbatimModuleSyntax`, so SWC should drop it; only `npm run build` (not allowed in this run) settles it. If it is not elided, every page that renders the chat widget fails to build.
- **Whether any production caller passes an `Authorization` header into the settings server actions** (2026-10-18) - none in the repo; `ADMIN_API_KEY` works only for header-carrying callers, which server actions are not (M10-F43).

---

## Verification log (2026-09-19)

Skeptic pass over this file: every cited path scripted against disk, every `path:line` opened, 41
findings re-opened at their evidence, the 102-file inventory diffed against what the file mentions,
and each of the 7 focus questions in `chunks.json` checked for a real answer. Changes, one per line:

- `services/admin` cited as a path in M10-F30 -> no such directory; evidence is now `lib/admin-firebase.ts:56,:58,:64` -> `ls services/` has no `admin`.
- M10-F30 claimed the `"invalid-key"` fallback "makes the credential check always truthy" -> corrected: it makes only the `privateKey` half of `if (clientEmail && privateKey)` truthy; `clientEmail` can still be undefined -> `lib/admin-firebase.ts:56,:58`.
- M10-F30 missed a third fallback -> added `projectId` falling back to the literal `"demo-project"` -> `lib/admin-firebase.ts:64`.
- M10-F31 said "public routes must call `getPublicAreas`/`getPublicArea`" -> refuted, they already do; rewritten around the real asymmetry - all three **write** methods are service-role only with no RLS twin -> `app/api/temple-areas/route.ts:6`, `app/api/temple-areas/[id]/route.ts:10` call the `*Public*` reads; `services/temple-areas.supabase.service.ts:98,:129,:159` all `createAdminClient()`.
- Nothing recorded the unauthenticated writes those routes expose -> new **M10-F42 (HIGH)** -> `app/api/temple-areas/route.ts:14-31`, `app/api/temple-areas/[id]/route.ts:23-50`, no `middleware.ts` at the repo root.
- M10-F05 "violated 40 times" was not reproducible -> restated as 41 files holding the client SDK (35 pages/components/hooks + 6 API routes), 47 files and 85 import lines in total -> script over `app/ components/ hooks/` for `from "firebase/*"` and `@/lib/firebase`.
- M10-F05 cited the 12 admin settings pages at `:6-7` -> corrected to `:7-8` (only `finance` is `:6-7`) -> `grep -n firebase/firestore app/admin/settings/*/page.tsx`.
- M10-F05 omitted `components/admin/events/EventForm.tsx`, `components/admin/layout/AdminAuthGuard.tsx`, `components/auth/ProtectedRoute.tsx`, `hooks/useDonationNotifications.ts`, 8 further admin pages and 12 API routes -> complete list added as **Direct Firebase access outside the service layer**.
- M10-F32 "122 `any` occurrences across 28 files" -> 119 by the stated pattern (`: any` / `as any` / `any[]` / `<any>`), 28 files confirmed; worst offenders named -> script over `.claude/state/inventory/M10.json`.
- M10-F24 "242 `console.*` calls across the 102 files" -> count correct, scope wrong: 33 of the 102 files -> same script.
- M10-F35 evidence `types/user.ts:3-17,:22-24,:27,:33-38` pointed at returns, not the dead cases -> now `:3-16,:22,:26,:31,:36` -> `types/user.ts:26` `case "super admin"`, `:31` `case "temple admin"`, `:36` `case "office staff"`.
- M10-F38 and the `gallery.service` row said "six alias methods" -> five (`getImages`, `getImageById`, `createImage`, `updateImage`, `deleteImage`) -> `services/gallery.service.ts:175,:215,:225,:234,:243`.
- M10-F06 implied every server caller gets the defaults -> `getPendingTestimonials` returns `[]` instead; noted, and the missing return site `:169` added -> `services/testimonial.service.ts:68-73` vs `:140,:166,:169,:178,:192,:210,:219`.
- `quote.service` row said "20-quote fallback array" -> 4 quotes -> `services/quote.service.ts:52-155`, ids `fallback-guru-vandana|raghavendra-stotra|mangalashtakam|devotional`.
- Purpose said "60 modules under `services/`" -> 54 (41 top-level + 13 `proof-report/`) -> `ls services/*.ts | wc -l` = 41, `ls services/proof-report/*.ts | wc -l` = 13.
- Types heading said "42 files, 5,404 lines" -> 5,444 -> sum of `lines` for `types/*` in `.claude/state/inventory/M10.json`.
- Tree E, the Firestore collections table and Recipe 4 cited `daily-spiritual.service.ts:224` for the direct `events` read -> `:224` is `getFeaturedEvent`; the `collection(db,"events")` calls are at `:293` and `:331` inside `getFeaturedEventFromFirestore` `:281`; announcements `:382` -> `:388`.
- `chat_messages` row cited `ai-analytics.service.ts:49` -> `:50` -> `COLLECTIONS.CHAT_MESSAGES` is line 50.
- `lib/firebase.ts` key exports omitted `validateFirebaseConfig` -> added -> `lib/firebase.ts:220`.
- Entry points listed `sevaService` plainly under "Firebase client SDK" -> qualified: its reads are Supabase, only its writes are Firestore -> `services/seva.service.ts:11` vs `:76,:81,:86`.
- Portability said "2,700 lines of ranking/search/NLP logic" -> ~2,970, with the per-file breakdown -> inventory line counts.
- Focus question 1 ("which app code imports it (grep)") was answered only as a count -> new **Who imports each service** section names every importer of all 41 top-level services -> `.claude/state/inventory/import-graph.json`.
- `quote.service.ts` was called the "Largest service" -> `knowledge-workflow.service.ts` is 1069 lines to its 1040 -> `.claude/state/inventory/M10.json`.
- Coverage claimed "118 distinct paths ... all exist" -> re-measured: 296 distinct concrete file paths plus 15 directories, all present, every `path:line` matched.

Confirmed unchanged (spot-checked at their evidence and correct as written): M10-F01, F02, F03, F04,
F07, F08, F09, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22, F23, F25, F26, F27,
F28, F29, F33, F34, F36, F37, F39, F40, F41; the importer counts in **Key files** (all 17 sampled
match `import-graph.json`); the 17 duplicated type names; the 5 `types/*` files importing `Timestamp`;
"no file in M10 carries `use client`"; `lib/firebase-admin-rest.ts` as the only `server-only` module.

---

## Refresh log (2026-10-18)

Refresh of this file against HEAD 424fdb8 (branch `feature/temple-portal-knowledge-base`), diffing
the 2026-09-19 snapshot (`D:\Onboarding\Repos\POCs\General Purpose POCs`) with CRLF ignored. Delta
for M10: 0 added, 0 deleted, 11 modified (`lib/admin-firebase.ts`, `services/ai-analytics.service.ts`,
`services/chat.service.ts`, `services/ml.service.ts`, `services/settings.service.ts`,
`services/storage.service.ts`, `services/testimonial.service.ts`, `types/ai-analytics.ts`,
`types/ai-settings.ts`, `types/festival.ts`, `types/temple-explorer.ts`). A script confirmed no other
inventory file changed, so line citations into the other 91 files stand. One line per change
(what was true -> what is true now -> evidence):

- Header -> now carries the refresh date and HEAD -> this section.
- Totals 20,960 lines -> 21,155 lines, still 102 files -> `.claude/state/inventory/M10.json` `totals`.
- Admin SDK: three-way credential resolution -> four-way, `FIREBASE_SERVICE_ACCOUNT_JSON` first; key run through `parseFirebasePrivateKey`; entry lines `:115,:37` -> `:157,:39` -> `lib/admin-firebase.ts:57-87,:95,:157,:39` (f43cba1, eaeceab).
- `lib/admin-firebase.ts` row 158 lines / 9 importers -> 200 / 8 -> inventory, `import-graph.json`.
- Settings writes: service imported the service-role client into a client page -> service dynamically imports the `"use server"` actions in `app/actions/settings.ts` -> `services/settings.service.ts:70,:75` (54024a1). Data flow 3 rewritten; Tree B updated; `settingsService` at `:155` -> `:117`; anon reads `:41,:119` -> `:41,:81`; row 156 -> 118 lines.
- `lib/supabase/admin.ts:4,:10` -> `:5,:11`, and the file now starts with `import 'server-only'` `:1` -> `lib/supabase/admin.ts:1-11`.
- Chat sessions/messages: Firestore `chat_sessions` + `messages` -> Supabase `chat_sessions` + `chat_messages` via the anon client -> `services/chat.service.ts:7-171` (224875d). Flow 6 step 5, Key files row (288 -> 342 lines), both store tables, Tree B updated.
- AI analytics: Firebase-gated Supabase writes for latency/intent, Firestore for unknown questions -> Supabase reads and writes for latency, intent and `unknown_questions`, admin client on the server, no Firebase gate on those paths -> `services/ai-analytics.service.ts:128-255,:318-465` (2cd44c7..556a704). Row 873 -> 898 lines; store tables updated; `ai_unknown_questions` now unused.
- `ml.service.ts` 453 -> 461 lines: 8 typo-table entries and a distance cap with a hardcoded pair exclusion -> `services/ml.service.ts:235-242,:280` (3446b0b).
- `storage.service.ts` and `testimonial.service.ts` -> whitespace-only changes; no line moved -> diff output.
- `types/ai-settings.ts` 297 -> 358 lines, importers 10 -> 11: `AIGeneralSettings`, `AISafetySettings`, `AIExtendedBehaviorSettings` + 3 defaults, `AISettings.general/safety/extendedBehavior` -> `types/ai-settings.ts:282-354` (698a25c, 356de70).
- `types/temple-explorer.ts` 347 -> 372 lines: `AccessibilityInfo` and `TempleArea.accessibility` -> `types/temple-explorer.ts:6,:28` (11a532f).
- `types/festival.ts` 194 -> 212 lines, importers 5 -> 7: `calculateCountdown` same-day `isToday` -> `types/festival.ts:100-148` (ee8390c).
- `types/ai-analytics.ts`: `LatencyRecord.messageId`/`intent` required -> optional -> `types/ai-analytics.ts:30,:36` (edecabc).
- Types total 5,444 -> 5,548 lines -> inventory sum over `types/*`.
- `lib/firebase.ts` importers 78 -> 73 (lib modules 14 -> 9, plus `context/AuthContext.tsx`); `quote.service` 19 -> 18 (`lib/ai/generator.ts` dropped it); `types/quote.ts` 11 -> 10; `types/settings.ts` 3 -> 4 -> `import-graph.json` 2026-10-18.
- Direct Firebase grep 47 files / 85 lines -> 46 / 84; violators 41 -> 40; `app/api/seed-ai-settings/route.ts` struck; three pages' import lines shifted -> script over `app/ components/ hooks/`.
- Storage callers `GalleryDashboard.tsx:52`, `VideosManager.tsx:37` -> `:53`, `:38` (an `/* eslint-disable */` line was added) -> grep.
- M10-F42 evidence said only "no `middleware.ts`" -> adds that root `proxy.ts` exists and passes `/api/*` through without auth -> `proxy.ts:84-120` (unchanged since the snapshot; the original wording was incomplete).
- Cross-module table -> adds `@/app/actions/settings` (M12), `./utils/firebase-key-parser` (unowned) and `chat.service` as a Supabase consumer.
- Faults: every row now carries a `status 2026-10-18` cell. FIXED: F04 (54024a1), F18 (2cd44c7..556a704). MOVED: F12. STILL OPEN with refreshed evidence: F03, F05, F13, F17, F21, F24, F30, F32. STILL OPEN unchanged: the other 30. NEW: F43-F49.
- Portability -> records that `apps/mobile` consumes nothing from M10 and keeps its own types and Supabase queries -> `apps/mobile/lib/types.ts`, `apps/mobile/lib/api.ts`, `tsconfig.json` `exclude`.
- Answers questions about -> five new topics (settings save path, chat history store, AI analytics store, `FIREBASE_SERVICE_ACCOUNT_JSON`, temple-area accessibility).
- Recipe 5 step 4 -> notes the settings split happened and why a server-action guard on `Authorization` cannot work.
- Coverage -> re-measured, still 102 / 102.

Commits that drove the biggest changes: 224875d (chat sessions/messages to Supabase), 2cd44c7 /
3d0d3b2 / edecabc / 6a5a296 / 64fc607 / 556a704 (BOT-004 analytics migration), 54024a1 (settings
writes to server actions), f43cba1 and eaeceab (Admin SDK credentials), 698a25c and 356de70
(AI settings types), 11a532f (temple-area accessibility), ee8390c (festival countdown),
3446b0b (intent-test typo fixes).

UNCLEAR:
- Whether Supabase has a later policy or grant that lets the anon role use `chat_sessions` /
  `chat_messages`; only `supabase/migrations/20260930000000_create_ai_tables.sql` mentions them in
  the repo, so M10-F44 assumes the dashboard state matches the migrations.
- Whether the unused `server-only` import in `services/chat.service.ts:3` is elided before Next's
  check (see UNCLEAR above); decides whether M10-F47 is LOW or a build break.
- `lib/utils/firebase-key-parser.ts` is new, unowned, and imported only by `lib/admin-firebase.ts:13`
  (and its test); it is described here but not adopted into the M10 inventory.

---

## Verification log (2026-10-18)

Skeptic pass over the 2026-10-18 refresh. HEAD on disk is 43361a3, two docs-only commits after the
dispatched 424fdb8 (`git diff --stat 424fdb8 HEAD` outside `.claude/` and `docs/` touches only
`CLAUDE.md`), so every code citation is unaffected. Path script: 330 distinct cited paths, 1
non-existent (`services/admin`, quoted as prose inside the 2026-09-19 log), 0 broken. Changes, one per line:

- Flow 2 step 3 cited `lib/admin-firebase.ts:115` for the Admin SDK -> `:157` (`getAdminFirestore`); `:115` is now the env branch's `return adminApp` -> `lib/admin-firebase.ts:157`.
- Entry points cited `package.json:25` for `generate:proof-report` -> `:31` (package.json gained Prisma scripts, 2e8f0b1 / 623f015) -> `grep -n proof package.json`.
- Cross-module cited `.claude/state/inventory/SUMMARY.md:33` for `PageViewTracker` -> `:34` (SUMMARY.md regenerated 2026-10-18) -> `grep -n PageViewTracker .claude/state/inventory/SUMMARY.md`.
- UNCLEAR (composite indexes) cited `chat.service.ts:72-77` as a Firestore where+orderBy -> those lines are now the Supabase `getUserChatSessions`; the Firestore queries are `:213-215,:231-233` -> `services/chat.service.ts:209-233`.
- M10-F44 said every select is refused and history loading shows "Failed to load chat history" -> under `USING (false)` selects and updates match zero rows without an error, so history and the session list load silently empty; only inserts error (swallowed) -> `supabase/migrations/20260930000000_create_ai_tables.sql:92-93`, `components/ai/AIChatProvider.tsx:110-130`, column names in the migration match the service's selects.
- M10-F46, flow 6 step 3 and the Supabase tables row called `lib/ai/generator.ts` "legacy" and `lib/ai/ai-settings/repository.ts:412` the live writer -> reversed: `/api/chat` calls `generateResponse` (Firestore log, threshold 60) **and** `logLowConfidenceQuestion` (Supabase, threshold 50), so low-confidence questions are logged twice; `repository.ts:412` is reached only from the unimported `lib/ai/composer/composer.ts:304` -> `app/api/chat/route.ts:9,:162,:192-193`, `lib/ai/index.ts:20-26`, `lib/ai/generator.ts:14,:73`, `lib/ai/unknown-logger.ts:30`, grep for `ai/composer` importers.
- M10-F48 -> adds that the `address`/`dress` exclusion at `:280` is unreachable, because `'address'` is a key of the typo table and `fuzzyMatch` returns at `:261` -> `services/ml.service.ts:241,:261,:280`.
- M10-F32 "recounted 119 / 28" -> not reproducible: 117 / 26 by the literal pattern, 122 / 28 by a whitespace-tolerant one, identical at the snapshot -> node count over `.claude/state/inventory/M10.json` in both trees.
- M10-F05 "12 of the 41" -> "12 of the 40"; and the grep pattern misses `hooks/useHomepage.ts:27-28` (dynamic imports) and `context/AuthContext.tsx:11,13` -> new group D in **Direct Firebase access**, which also lists the two `firebase-admin-rest` knowledge routes and the four files importing Supabase clients directly (focus question 3 asks for Supabase too, previously unanswered).
- M10-F22 "78-importer `lib/firebase.ts`" -> 73 -> `import-graph.json`.
- `lib/admin-firebase.ts` "8 importers" -> qualified: 8 static plus 2 dynamic (`lib/auth/admin.ts:43`, `lib/auth/admin-auth.ts:77,:122`) that the import graph does not see; the F43 guard reaches the Admin SDK through one of them.

Confirmed at their evidence (no change): M10-F04 FIXED (no service-role import left in `services/settings.service.ts`; `lib/supabase/admin.ts:1` is `server-only`), M10-F18 FIXED (`services/ai-analytics.service.ts:124-133,:194-203,:318-322` gate only on settings, and the settings default to enabled `:79-86`), M10-F12 MOVED (`chat.service.ts:227-242`), M10-F43 (`app/actions/settings.ts:26-42`, `lib/auth/admin.ts:25-29`, no header added by `app/admin/settings/page.tsx:68-71` or `proxy.ts:83-120`), M10-F45 (`ai-analytics.service.ts:44-51,:565,:621-641`, `app/admin/ai/analytics/page.tsx:315`), M10-F47 (four `"use client"` importers at `:1`, plus two server API routes), M10-F49 (no callers of the four `record*` names anywhere in `app lib components services hooks context scripts`), M10-F30 at `:91,:93,:136`, M10-F42 (`proxy.ts:84-120` passes `/api/*`), the 11-file delta, 246 `console.*` in 33 files, the 40-file client-SDK count, all importer counts sampled, and the `apps/mobile` portability note.
