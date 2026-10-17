# M12 - API routes and server actions - the full HTTP surface
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "what HTTP endpoints does this app actually expose?" - all 95 `route.ts` files, one table row each
- "which endpoints are protected and which are wide open?" - only 5 route files verify a Firebase ID token
- "how do I add a new API route?" - the four house patterns and which one to copy
- "how does the admin UI authenticate to the API?" - `Authorization: Bearer <idToken>` -> `verifyAdminUser`
- "where is rate limiting applied?" - `lib/rate-limit.ts`, used by exactly 2 routes; `/api/chat` has its own copy
- "what validation runs on a POST body?" - hand-rolled `if (!x)` checks; zod appears in zero route files
- "which endpoints write to Firestore without authentication?" - the F-table below (many)
- "why do `/api/quotes` and `/api/admin/quotes` both exist?" - the duplicate-family map
- "what is `/api/seed-ai-settings` and is it safe?" - no, see M12-F03/F04
- "what is `/api/calendar`?" - the admin calendar pages call it; the route does not exist
- "what response shape does endpoint X return?" - the response column; there is no single envelope
- "which routes are `force-dynamic`, which are cached, which set `revalidate`?"
- "edge or node runtime?" - two routes pin `nodejs`, the rest are default node; no edge routes
- "what would a React Native app be able to call?" - the portability section
- "what data does the public web expose that it should not?" - `/api/public/receipts`, `/api/volunteer` GET
- "where are the server actions?" - one file, `app/actions/sevas.ts`
- "what does `vercel.json` configure?" - only `Cache-Control` for `/data/panchanga/*`
- "how do errors come back?" - `{ error: string }` or `{ success: false, error }`, inconsistently
- "which endpoints are dead / stubs / placeholders?" - `receipts/[id]/send`, parts of `admin/content`
- "does docs/API.md describe the API?" - it describes 4 endpoints in 3 of the 95 route files

## Purpose and business role

M12 is the HTTP boundary of the temple portal. Everything a browser or an external client can
reach without rendering a page lives here: `app/api/**/route.ts` (95 Next.js App Router Route
Handlers), one server action file (`app/actions/sevas.ts`), the in-memory rate limiter
(`lib/rate-limit.ts`) and the Vercel edge-header config (`vercel.json`).

Functionally the surface covers six business areas: devotee-facing reads (events, announcements,
quotes, knowledge articles, temple areas, search, recommendations, public stats), devotee-facing
writes (seva bookings, donations, contact form, volunteer sign-up, testimonials), the Raya AI chat
endpoint and its settings/analytics console, the billing/receipt desk (the only part with real
auth), content and knowledge-workflow administration, and operational utilities (revalidate,
seed, storage listings, supabase health check).

Architecturally the layer is thin by design: most handlers parse query params, do a couple of
truthiness checks, call one function from `services/*` or `lib/ai/*`, and `NextResponse.json` the
result. The intent in AGENTS.md ("No Direct Firebase Calls - use services only") holds for roughly
three quarters of the routes; the remainder talk to Firestore directly, and a handful use the
**client** Firebase SDK inside a server handler.

The load-bearing weakness of the whole module is authentication. 88 of 95 route files perform no
identity check of any kind, including routes that create super-admins, delete files, overwrite AI
settings and return devotee PII.

## Code roots

```
app/api/**/route.ts        95 Route Handlers (owned)
app/actions/sevas.ts       the only "use server" server action file
lib/rate-limit.ts          in-memory fixed-window limiter (shared with M01)
vercel.json                header rules for /data/panchanga/*
```

Adopted from the Unassigned list: none. Every M12 file except `lib/rate-limit.ts` and
`app/actions/sevas.ts` is co-claimed by a domain chunk (M04-M11, M14) - see
`.claude/state/inventory/SUMMARY.md`. M12 owns the *HTTP contract*; the co-owner owns the business
logic behind it.

## Entry points

There is no `middleware.ts` in the repository (`ls middleware.ts` -> not found), so **no route is
protected by middleware**. `next.config.ts:55-62` applies security headers (CSP, HSTS,
X-Frame-Options) to `/:path*`, which is the only global request-time policy.

Auth column legend:
- **none** - no identity check at all
- **admin(token)** - `verifyAdminUser(request)` in `lib/auth/admin-auth.ts:28`, Firebase ID token + Firestore role, rejects roles `devotee`/`volunteer`
- **apikey?** - `verifyAdmin()` local helper, only enforced when `NODE_ENV==="production"` **and** `ADMIN_API_KEY` is set (`app/api/admin/prompts/route.ts:11-19`)
- **fake** - a helper that looks like auth but can never return null (`app/api/seed-ai-settings/route.ts:117-140`)

### Admin domain - `/api/admin/*` (24 files)

| Route | Methods | Auth | Validation | Calls | Store | Response | Cache |
|---|---|---|---|---|---|---|---|
| `/api/admin/aaradhane` | GET, POST | none | none (body cast to `Omit<Aaradhane,...>`) | `aaradhaneService.getAaradhanes/createAaradhane` | aaradhane (M14) | `{success,data,count}` / `{success,id}` 201 | default |
| `/api/admin/aaradhane/[id]` | GET, PUT, DELETE | none | none | `aaradhaneService.getAaradhaneById/update/delete` | aaradhane | `{success,data}` / `{success,message}` | default |
| `/api/admin/analytics` | GET, POST | none | POST checks 4 fields (`route.ts:49`) | `getAnalyticsSummary`, `logIntentFeedback` | analytics (M10) | `{success,data,timestamp}` | default |
| `/api/admin/content` | GET, POST | none | per-action field checks | `content.service` autoTag/freshness/related | in-memory only | `{success,...}`; `freshness`/`review` GET return **placeholder text** (`route.ts:46-71`) | default |
| `/api/admin/knowledge` | GET, POST | none | POST requires `title` | `getDocuments`/`addDocument` (`lib/firebase-admin-rest`), `SEED_ARTICLES` | `knowledge` | `{success,articles,count,firestoreCount,seedCount}` | `dynamic="force-dynamic"` |
| `/api/admin/knowledge/[id]` | GET, PUT, DELETE | none | none | `getArticleById`, `updateDocument`, `deleteDocument` | `knowledge` | `{success,article}` / `{success,message}` | `force-dynamic` |
| `/api/admin/prompts` | GET, POST, PUT | apikey? | POST requires `content`; PUT requires `versionId` | `aiSettingsService` prompt CRUD | `ai_settings/prompts` | `{success,versions,currentPrompt,...}` | default |
| `/api/admin/prompts/[id]` | GET, DELETE | none | existence check | `aiSettingsService.getPromptVersions/updatePromptVersion` | `ai_settings/prompts` | `{success,data}`; DELETE **archives**, does not delete (`route.ts:76`) | default |
| `/api/admin/prompts/[id]/publish` | POST | none | existence check | `aiSettingsService.publishPromptVersion` | `ai_settings/prompts` | `{success,message,currentPrompt,versions}` | default |
| `/api/admin/quotes` | GET, POST, PATCH, DELETE | none | POST requires title/category/source; PATCH+DELETE require `ids[]` | `quoteService` CRUD + `clearCache` | quotes (M10) | `{quotes,total}` / `{id,message}` / `{updated,errors}` | default |
| `/api/admin/quotes/[id]` | GET, PUT, DELETE | none | PUT requires title/category/source | `quoteService.getQuoteById/update/delete` | quotes | `{quote}` / `{message}` | default |
| `/api/admin/quotes/bulk` | POST, GET | none | `mode:"validate"` path checks each row (`route.ts:23-39`) | `quoteService.bulkImport/getQuotes` | quotes | `{imported,errors,total}`; GET sets `Content-Disposition: attachment` | default |
| `/api/admin/quotes/cache` | POST | none | none | `quoteService.clearCache()` | in-memory cache | `{message}` | default |
| `/api/admin/quotes/seed` | POST | none | none | `quoteService.seedDefaultQuotes()` | quotes | `{message,seeded}` | default |
| `/api/admin/receipt-sevas` | GET, POST | **admin(token)** | `validateReceiptSevaInput` + `sanitizeReceiptSevaInput` (`lib/receipt/validation`) | Admin Firestore direct | `sevas` | `{success,sevas,count}` / 201 `{success,id}` | `force-dynamic`, `revalidate=0` |
| `/api/admin/receipt-sevas/[id]` | PUT | **admin(token)** | same validator | Admin Firestore direct | `sevas` | `{success,message}` | `force-dynamic` |
| `/api/admin/receipts` | GET, POST | **admin(token)** | POST via `createReceiptWithAdmin` (`lib/receipt/admin`) | Admin Firestore query + receipt builder | `receipts` | `{success,receipts,count,page,pageSize}` or report aggregate | `force-dynamic`, `revalidate=0` |
| `/api/admin/receipts/[id]` | GET | **admin(token)** | none | Admin Firestore doc get | `receipts` | `{success,receipt}` | `force-dynamic` |
| `/api/admin/receipts/[id]/pdf` | GET | **admin(token)** | none | `buildReceiptPdf` (M14) + settings lookup | `receipts`, `settings` | `application/pdf`, `Cache-Control: no-store` | `force-dynamic` |
| `/api/admin/receipts/[id]/send` | POST | none | none | nothing | nothing | `{success:true}` - **1-line stub** | default |
| `/api/admin/temple-areas` | GET, POST | none | name + category required | `templeAreasService.getAreas/addArea` | templeAreas (M10) | `{success,areas}` / 201 | default |
| `/api/admin/temple-areas/[id]` | GET, PUT, DELETE | none | none | `templeAreasService` get/update/delete | templeAreas | `{success,area}` / `{success,message}` | default |
| `/api/admin/users/create-admin` | POST | none (**rate-limited 5/min**) | email regex, password >= 8 | `createUserWithEmailAndPassword` + `setDoc` (**client SDK**) | Firebase Auth, `users` | `{success,message}` | default |
| `/api/admin/users/set-role` | POST | none (**rate-limited 10/min**) | email regex, role in 5-value list | `getDocs` + `setDoc` (**client SDK**) | `users` | `{success,message,userId}` | default |

### Raya AI domain - `/api/ai/*` (22 files) - every one is auth: **none**

| Route | Methods | Validation | Calls | Store | Response | Cache |
|---|---|---|---|---|---|---|
| `/api/ai/analytics` | GET | none | `getAnalyticsDashboard(start,end)` | ai analytics (M08/M10) | dashboard object | default |
| `/api/ai/analytics/health` | GET | none | `checkAIHealth()` | - | `{status,...}` | default |
| `/api/ai/analytics/intent-distribution` | GET | none | `getIntentDistribution` | ai analytics | service object | default |
| `/api/ai/analytics/latency` | GET | none | `getLatencyMetrics` | ai analytics | service object | default |
| `/api/ai/analytics/token-usage` | GET | none | `getTokenUsage` | ai analytics | service object | default |
| `/api/ai/analytics/unknown-questions` | GET, PATCH | PATCH requires `questionId`,`reviewedBy` | `getUnknownQuestions`, `markUnknownQuestionReviewed` | unknown_questions | service object / `{success}` | default |
| `/api/ai/knowledge/coverage` | GET | none | direct `getDocs(collection(db,"knowledge"))` (**client SDK**) | `knowledge` | `{success,data:{coverage,summary}}` | default |
| `/api/ai/knowledge/import` | POST | none | reads `seed/ai/*.json` from disk, `setDoc` (**client SDK**) | `knowledge` | `{success,data:{imported,skipped,errors}}` | default |
| `/api/ai/multi-source/overview` | GET | none | `getTempleOverview()` | multi-source (M08) | service object | default |
| `/api/ai/multi-source/query` | POST | requires `query` | `executeMultiSourceQuery`, `addToQueryHistory` | multi-source + in-memory history | service object | default |
| `/api/ai/multi-source/quick-queries` | GET | none | `QUICK_QUERIES`, `getIntentSuggestions()` | constants | `{quickQueries,intentSuggestions}` | default |
| `/api/ai/multi-source/statistics` | GET | none | `getRetrievalStats/getDataFreshness/getQueryHistory` | in-memory | `{statistics,freshness,recentQueries}` | default |
| `/api/ai/multi-source/today` | GET | none | `getTodayInfo()` | multi-source | service object | default |
| `/api/ai/settings` | GET, POST | POST requires `action` | `aiSettingsService` 6 update actions incl. `resetToDefaults` | `ai_settings/*` | settings object | default |
| `/api/ai/settings/ai-behavior` | GET, PUT | PUT switches on `setting` | confidence/debug/streaming setters | `ai_settings` | behavior object | default |
| `/api/ai/settings/ai-responses` | GET, PUT | none | `updateResponseTemplate` / `updateAIResponses` | `ai_settings` | responses object | default |
| `/api/ai/settings/intents` | GET, POST, PUT, DELETE | POST requires `name`; PUT/DELETE require `intentId` | `aiSettingsService` intent CRUD | `ai_settings/intents` | `{intents}` / `{message}` | default |
| `/api/ai/settings/policies` | GET, PUT | PUT switches on `section` | donation/80G/seva policy setters | `ai_settings` | policies object | default |
| `/api/ai/settings/prompts` | GET, POST, PUT | POST requires `content`; PUT requires `versionId` | prompt version CRUD | `ai_settings/prompts` | `{versions,currentPrompt,...}` | default |
| `/api/ai/settings/temple-information` | GET, PUT | PUT switches on `section` | timings/contact/officeHours setters | `ai_settings`/`settings` | info object | `revalidate=3600`, `s-maxage=3600, SWR=86400` |
| `/api/ai/settings/unknown-questions` | GET, POST, PUT, DELETE | POST requires `question`; PUT/DELETE require `questionId` | log/assign/resolve/update/delete | unknown_questions | `{questions}` / `{message}` | default |
| `/api/ai/settings/visitor-information` | GET, PUT | PUT switches on `section` (8 sections) | visitor info setters | `ai_settings` | info object | default |

### Public / devotee domain (rest of the tree) - every one is auth: **none**

| Route | Methods | Validation | Calls | Store | Response | Cache |
|---|---|---|---|---|---|---|
| `/api/announcements` | GET, POST | POST requires `title` | `announcementService` | announcements | bare array / `{message}` 201 | default |
| `/api/announcements/[id]` | GET, PATCH, DELETE | none | `announcementService` | announcements | object / `{message}` | default |
| `/api/bookings` | GET, POST | `sevaId`, `preferredDate`, no past date (`route.ts:27-32`) | `sevaBookingService` | sevaBookings | bare array / `{id,message}` 201 | default |
| `/api/bookings/[id]` | GET, DELETE, PATCH | none | `sevaBookingService` status/payment | sevaBookings | object / `{message}` | default |
| `/api/chat` | POST, GET | messages must be non-empty array with a user message | `generateResponse`, `getSessionContext`, `updateSession`, `logLowConfidenceQuestion`, `getResponseMetadata` | chat sessions, analytics | `{message,sessionId,_debug?,_ux?}`; GET is a health probe | default; own 20/min IP limiter (`route.ts:29-51`) |
| `/api/contact` | POST | name/email/regex/message + slicing | **nothing** - only `console.log` (`route.ts:46`) | none | `{message,id}` 201 | default |
| `/api/dashboard/daily-spiritual` | GET | none | `dailySpiritualService.getDashboardData()` | panchanga/quotes (M14) | dashboard object | `force-dynamic`, `revalidate=0`, `no-store` |
| `/api/donations` | GET, POST | POST requires `amount>0` | `donationService` | donations | bare array / `{id,message}` 201 | default |
| `/api/donations/[id]` | GET, PATCH, DELETE | none | `donationService` | donations | object / `{message}` | default |
| `/api/events` | GET, POST | POST requires title + date/startDate | `eventService` | events | bare array / `{message}` 201 | default |
| `/api/events/[id]` | GET, PATCH, DELETE | none | `eventService` | events | object / `{message}` | default |
| `/api/gallery/local-assets` | GET, DELETE | DELETE: prefix allow-list `/images/temple/`, `/videos/` | `fs.readdirSync` / `fs.unlinkSync` | **local filesystem** | `{localImages,localVideos}` / `{success}` | default |
| `/api/knowledge` | GET | none | `knowledgeService.getKnowledgeCentreData()` | knowledge | page-data object | `force-dynamic`, `s-maxage=300, SWR=600` |
| `/api/knowledge/article/[slug]` | GET | none | `knowledgeService.getArticlePageData(slug)` | knowledge | page-data object / 404 | `force-dynamic`, `s-maxage=300` |
| `/api/knowledge/categories` | GET | none | `knowledgeService.getKnowledgeCategories()` | knowledge | array | `force-dynamic`, `s-maxage=3600` |
| `/api/knowledge/search` | GET | empty `q` -> `[]` | `knowledgeService.searchKnowledge(q,limit)` | knowledge | array | `force-dynamic`, `no-store` |
| `/api/knowledge/workflow/approvals` | POST | 4 fields + decision enum | `submitCommitteeVote` | workflow (M09) | `{success}` | default |
| `/api/knowledge/workflow/articles` | GET, POST | POST requires title/content/category/createdBy | `getWorkflowArticles`, `createWorkflowArticle` | workflow | `{articles}` / `{articleId}` 201 | default |
| `/api/knowledge/workflow/articles/[id]` | GET, PATCH | none on PATCH | `getWorkflowArticleById`, `performWorkflowAction`, `updateWorkflowArticle` | workflow | `{article,history?,versions?,comments?,committeeApproval?}` | default |
| `/api/knowledge/workflow/audit` | GET | requires `entityType`+`entityId` | `getAuditLog` | workflow audit | `{entries}` | default |
| `/api/knowledge/workflow/comments` | POST, PATCH | required-field checks | `addReviewComment`, `resolveComment` | workflow | `{commentId}` 201 / `{success}` | default |
| `/api/knowledge/workflow/drafts` | GET, POST, DELETE | `userId` / 4 fields / `draftId` | `getUserDrafts`, `saveDraft`, `deleteDraft` | workflow drafts | `{drafts}` / `{draftId}` 201 | default |
| `/api/knowledge/workflow/statistics` | GET | none | `getWorkflowStatistics()` | workflow | `{statistics}` | default |
| `/api/knowledge/workflow/versions/[id]` | GET, POST | none on POST | `getVersionById`, `restoreToVersion` | workflow versions | `{version}` / `{success}` | default |
| `/api/public/receipts` | GET | `search` required | Admin Firestore: reads 1000 newest `sevaBookings`, substring filter | `sevaBookings` | `{success,receipts}` with **phone/email/payment ref** | `force-dynamic` |
| `/api/public/stats` | GET | none | 6x `getCountFromServer` + donor scan (**client SDK**) | users, volunteers, members, donations, sevaBookings, events | `{stats:{...8 counters}}` | default |
| `/api/quotes` | GET | none | `quoteService.getQuotes({active:true})` | quotes | `{quotes,total,filters}` (limit applied via `.slice`) | default |
| `/api/quotes/category/[category]` | GET | category in 6-value list | `quoteService.getQuoteByCategory` | quotes | `{category,quotes,total}` | default |
| `/api/quotes/featured` | GET | none | `quoteService.getFeaturedQuotes()` | quotes | `{quotes,total}` | default |
| `/api/quotes/festival/[festival]` | GET | festival in 15-value list | `quoteService.getFestivalQuote` | quotes | `{festival,quotes,total}` | default |
| `/api/quotes/preview` | GET | `days` clamped to 30 | `quoteService.getRotationPreview` | quotes | `{preview,total}` | default |
| `/api/quotes/random` | GET | none | `quoteService.getRandomQuote()` | quotes | `{quote}` / 404 | default |
| `/api/quotes/search` | GET | `q` >= 2 chars | `quoteService.searchQuotes` | quotes | `{query,quotes,total}` | default |
| `/api/quotes/stats` | GET | none | `quoteService.getQuoteStats()` | quotes | stats object | default |
| `/api/quotes/tags` | GET | none | `quoteService.getAllTags()` | quotes | `{tags,total}` | default |
| `/api/quotes/today` | GET | `date` parseable | `quoteService.getTodaysQuote(date)` | quotes | result object | `force-dynamic`, `revalidate=0`, `no-store` |
| `/api/recommendations` | GET | none | `getHomepageRecommendations` / `getRecommendationsForUser` / dynamic-import `getRecommendationsForPage` | recommendation service | `{recommendations,timestamp}` | `force-dynamic`, `s-maxage=300, SWR=600` |
| `/api/reports/list` | GET | none | `storageService.listReports(prefix)` | Vercel Blob | `{success,reports,count}` | `runtime="nodejs"` |
| `/api/reports/save` | POST | `type` in 5-value list, `content` required | `storageService.saveScreenshot/savePdf/saveReport` | Vercel Blob | `{success,url,pathname}` | `runtime="nodejs"`, `maxDuration=60` |
| `/api/revalidate` | POST | `paths` must be array else defaults to `/` | `revalidatePath` (`next/cache`) | Next.js cache | `{revalidated,paths,timestamp}` | default |
| `/api/search` | GET | `q` >= 2 chars | `searchAll`, `groupResultsByType` | search service (M10) | `{results,totalResults,grouped?}` | `force-dynamic` |
| `/api/search/suggestions` | GET | none | `getSearchSuggestions(q)` | search service | array | `force-dynamic` |
| `/api/seed-ai-settings` | POST, GET | **fake** auth (POST); GET is 404 unless `NODE_ENV==="development"` | `setDocumentRest` -> firebase-admin or raw Firestore REST PATCH | `ai_settings/*`, `settings/temple`, `settings/contact`, `settings/visitor` | `{success,message,summary,collections}` | default |
| `/api/storage/videos` | GET | none | `storageService.listVideos()` | Vercel Blob | `{success,count,videos[]}` | default |
| `/api/supabase-check` | GET | none | instantiates Supabase server + admin clients | none (probe) | `{success,message,envStatus,adminClientCreated}` | default |
| `/api/temple-areas` | GET, POST | POST requires name + category | `templeAreasService.getPublicAreas/addArea` | templeAreas | array / `{message}` 201 | default |
| `/api/temple-areas/[id]` | GET, PUT, DELETE | none | `templeAreasService` public get / update / delete | templeAreas | object / `{message}` | default |
| `/api/testimonials` | POST, GET | name/experience required, rating 1-5 numeric | `submitTestimonial`, `getApprovedTestimonials` | testimonials (chat.service) | `{success,id,message}` / `{testimonials}` | default |
| `/api/volunteer` | POST, GET | name/phone/email/service + email + phone regex | `submitVolunteerRequest`, `getVolunteerRequests` | volunteer requests | `{success,id,message}` / `{requests}` | default |

### Server actions

| Entry | File | Exports | Auth | Store |
|---|---|---|---|---|
| `"use server"` module | `app/actions/sevas.ts` | `getAllSevasAction`, `getSevaByIdAction` | none | Supabase `sevas` table via `createAdminClient()` (service-role key) |

Called only from `services/seva.service.ts:4` (M10). It is the single point where Supabase is read
in the running app.

## Component trees

API routes have no JSX. The equivalent structures are the **request pipelines** (what a handler
composes) and the **consumer trees** (which client components call which endpoint).

### Pipeline A - the unauthenticated service pass-through (about 60 of 95 files)

```
Route Handler (server)  app/api/<domain>/route.ts
└── try
    ├── new URL(request.url).searchParams        (GET)  or  await request.json()  (write)
    ├── ad-hoc guards        if (!body.title) -> 400
    ├── <domainService>.<method>()               services/*.ts        [M10]
    │   └── Firestore client/admin SDK           [M11]
    └── NextResponse.json(result)
    catch -> console.error(...) -> NextResponse.json({error}, {status:500})
```
Examples: `app/api/events/route.ts`, `app/api/announcements/route.ts`, `app/api/quotes/route.ts`,
`app/api/temple-areas/route.ts`, all of `app/api/ai/**`.

### Pipeline B - the authenticated billing pipeline (5 files, the only real one)

```
Route Handler (server)  app/api/admin/receipts/route.ts
├── verifyAdminUser(request)                     lib/auth/admin-auth.ts:28
│   ├── read "authorization: Bearer <idToken>"   :31
│   ├── getAuth(adminApp).verifyIdToken()        :45      firebase-admin  [M04]
│   ├── users/{uid} lookup, isActive, role       :48-64
│   └── null -> 401 unauthorized()
├── validateReceiptSevaInput / createReceiptWithAdmin   lib/receipt/*   [M07/M14]
├── getAdminFirestore()                          lib/admin-firebase.ts   [M10]
└── NextResponse.json({success, ...})
```
Used by: `admin/receipts`, `admin/receipts/[id]`, `admin/receipts/[id]/pdf`,
`admin/receipt-sevas`, `admin/receipt-sevas/[id]`.
Client side the token comes from `services/receipt.service.ts` and `services/receiptSeva.service.ts`
- the only two callers in the app that send an `Authorization` header.

### Pipeline C - the AI settings fan-out (9 files under `/api/ai/settings`)

`find app/api/ai/settings -name route.ts` -> 9. The same `x-user-id` header pattern also appears in
the 3 `/api/admin/prompts` files, so 11 route files read their audit identity this way.

```
Route Handler (server)  app/api/ai/settings/<area>/route.ts
├── userId = request.headers.get("x-user-id") || "admin"     <- spoofable audit identity
├── switch (body.section | body.setting | body.action)
│   └── aiSettingsService.<setter>(data, userId)   lib/ai/ai-settings/index.ts  [M08]
│       └── Firestore ai_settings/* documents      [M11]
└── re-read the whole area and return it
```

### Pipeline D - the chat endpoint (`app/api/chat/route.ts`, 397 lines)

```
POST /api/chat (server)
├── checkRateLimit(ip)                            route.ts:36  (local Map, 20/min)
├── body: ChatRequest  {messages, sessionId, userId, detectedLanguage}
├── language sniff (Kannada unicode range)        route.ts:125
├── if USE_HYBRID_MODE (default true)             route.ts:34
│   ├── getSessionContext(sessionId)              services/conversation.service  [M08]
│   ├── generateResponse(text, sessionId)         lib/ai/index                   [M08]
│   ├── updateSession(...)                        services/conversation.service
│   └── logLowConfidenceQuestion(...) if confidence < 50
├── else -> hard-coded apology string (LLM fallback is commented out, route.ts:232-286)
├── ?debug=true  -> _debug block ;  ?ux=true -> getResponseMetadata()  services/ux.service
└── NextResponse.json({message, sessionId, _debug?, _ux?})
GET /api/chat -> provider health {status,provider,configured,model,hybridMode}
```

### Consumer tree - who calls what (from source greps, not docs)

```
PUBLIC pages and components (no auth in front of them)
app/(public)/ai/analytics/page.tsx:294  (client) -> GET /api/ai/analytics      ** see M12-F43 **
app/(public)/ai/analytics/page.tsx:337  (client) -> GET /api/public/stats
app/(public)/receipts/page.tsx:53       (client) -> GET /api/public/receipts   ** see M12-F09 **
app/(public)/search/page.tsx:77         (client) -> GET /api/search
app/(public)/volunteer/page.tsx:43      (client) -> POST /api/volunteer
components/temple-explorer/TempleExplorer.tsx:44  -> GET /api/temple-areas
components/ai/AIChatProvider.tsx:156,260          -> POST /api/chat            [M09]
components/home/DailyQuoteWidget.tsx:62           -> GET /api/quotes/today
components/search/GlobalSearch.tsx:92,93          -> /api/search, /api/search/suggestions
components/common/Search/GlobalSearch.tsx:121     -> GET /api/search
components/knowledge/KnowledgeCentreClient.tsx:95 -> GET /api/knowledge/search
components/recommendation/RecommendationsSection.tsx:38 -> GET /api/recommendations
components/ai/AIAnalyticsDashboard.tsx:111        -> GET /api/ai/analytics
components/ai/MultiSourceRetrievalDashboard.tsx:68,69,84,101,115 -> /api/ai/multi-source/*
components/ai/KnowledgeWorkflowDashboard.tsx:412,413,455 -> /api/knowledge/workflow/*

ADMIN pages
app/admin/ai/**/page.tsx (client)      -> /api/ai/settings/*, /api/ai/knowledge/*, /api/chat,
                                          /api/seed-ai-settings (settings/page.tsx:75)
app/admin/knowledge/page.tsx:96,166,200,221,254 -> /api/admin/knowledge*
app/admin/quotes/**/page.tsx (client)  -> /api/admin/quotes*, /api/quotes/preview, /api/quotes/stats
app/admin/temple-areas/page.tsx:45,71  -> /api/admin/temple-areas*
app/admin/page.tsx:117                 -> GET /api/ai/analytics
app/admin/billing|receipts/** (client) -> services/receipt*.service.ts -> /api/admin/receipts*
components/admin/gallery/LocalGalleryAssets.tsx:47 -> GET+DELETE /api/gallery/local-assets
components/admin/settings/homepage/useHomepageForm.ts:91 -> POST /api/revalidate
app/admin/calendar/ekadashi/page.tsx:34,62,80   -> /api/calendar  ** route does not exist **
app/admin/calendar/festivals/page.tsx:31,60,79  -> /api/calendar  ** route does not exist **

TESTS ONLY (no product code calls these)
tests/e2e/**                           -> /api/events, /api/announcements, /api/contact,
                                          /api/donations, /api/testimonials, /api/quotes/*,
                                          /api/admin/users/create-admin, /api/reports/list
```
Most *page* data does not come through this layer: public pages render Server Components that
import `services/*` directly, and the routes above are called only from the `"use client"` islands
inside them. Counted with a script (`.claude/state/verify/_M12_callers.js`), **36 of the 95
endpoints have no reference anywhere in the repository** - not in a component, a service, a hook or
a test (M12-F44). `/api/bookings`, `/api/bookings/[id]`, `/api/dashboard/daily-spiritual`,
`/api/supabase-check`, `/api/announcements/[id]`, `/api/donations/[id]` and `/api/temple-areas/[id]`
are in that set: they are not even exercised by a Playwright spec. `/api/events`,
`/api/announcements`, `/api/donations`, `/api/contact` and `/api/testimonials` are the ones that are
referenced *only* by `tests/e2e/**`.

## Data flow

### 1. Devotee books a seva (HTTP path)

1. Client `POST /api/bookings` with `{sevaId, preferredDate, ...}`.
2. `POST` in `app/api/bookings/route.ts:14` parses JSON.
3. Guards: `sevaId` present (`:19`), `preferredDate` present (`:22`), date not in the past (`:27-32`).
4. `sevaBookingService.createBooking(body)` - `services/sevaBooking.service.ts` [M10].
5. Writes the `sevaBookings` collection [M11]. No auth, no ownership stamp from the server; whatever the body says is stored.
6. Returns `201 {id, message}`.
7. Later, the billing desk finds it through `GET /api/public/receipts?search=<phone>` - which is unauthenticated (`app/api/public/receipts/route.ts:6`).

### 2. Admin creates a receipt (the one hardened flow)

1. Admin UI gets a Firebase ID token and calls `POST /api/admin/receipts` with `Authorization: Bearer <token>` (`services/receipt.service.ts`).
2. `verifyAdminUser(request)` (`app/api/admin/receipts/route.ts:149` -> `lib/auth/admin-auth.ts:28`) verifies the token, loads `users/{uid}`, rejects `isActive===false` and roles `devotee`/`volunteer`.
3. Body cast to `ReceiptCreateInput`; `createReceiptWithAdmin(body, admin)` (`lib/receipt/admin.ts`) validates sevas, prices and quantities.
4. Writes `receipts` via `getAdminFirestore()`.
5. Domain validation errors are mapped back to 400 by string matching on the message (`route.ts:167`); everything else becomes 500.
6. `GET /api/admin/receipts/[id]/pdf` re-reads the doc, loads temple contact from `settings` (newest doc by `updatedAt`), and streams `application/pdf` with `Cache-Control: no-store`.

### 3. A chat question

1. `POST /api/chat` (see Pipeline D).
2. `checkRateLimit(ip)` uses a module-level `Map` - per serverless instance, so the 20/min cap is not global.
3. `generateResponse()` in `lib/ai` [M08] does structured retrieval; on throw, the route returns a fixed apology string rather than calling the LLM (the fallback block is commented out at `route.ts:232-286`).
4. Low-confidence questions (<50) are logged to the unknown-questions store, which the admin console then reads through `/api/ai/settings/unknown-questions`.

### 4. Admin edits temple timings (AI settings)

1. `PUT /api/ai/settings/temple-information` with `{section:"timings", data:{...}}`.
2. `userId = request.headers.get("x-user-id") || "admin"` (`route.ts:30`) - the audit identity is a client-supplied header.
3. `aiSettingsService.updateTempleTimings(data, userId)` [M08] writes `ai_settings`/`settings`.
4. The route re-reads and returns the full temple-information object.
5. `export const revalidate = 3600` plus `s-maxage=3600` on the GET means an edit is not visible through the GET for up to an hour.

### 5. Someone seeds the AI settings

1. `POST /api/seed-ai-settings`.
2. `getAdminUser(request)` (`route.ts:117`): if `NODE_ENV==="production"` it returns `{uid:"admin",role:"admin"}` immediately (`:119-121`); otherwise it checks an API key and, failing that, returns `{uid:"dev-admin"}` (`:139`). It can never return null, so the `401` at `:543` is unreachable.
3. `setDocumentRest(path, data)` (`:61`) tries firebase-admin with env credentials, else falls back to a raw `fetch(PATCH https://firestore.googleapis.com/... ?key=<apiKey>)` where `apiKey` defaults to a **hardcoded literal** (`:63`).
4. Overwrites `ai_settings/%20RayaAI`, `ai_settings/prompts`, `ai_settings/intents`, `ai_settings/unknown_questions`, `ai_settings/welcome`, `settings/temple`, `settings/contact`, `settings/visitor`.

### 6. Cache invalidation

1. `POST /api/revalidate {paths:["/", "/events"]}`.
2. `revalidatePath(p)` for each string (`app/api/revalidate/route.ts:26-30`); no allow-list, no auth.
3. With no body array it revalidates `/`.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/api/chat/route.ts` | 397 | Raya AI chat entry | POST, GET | own rate limiter; ~55 lines of commented-out fallback; logs user text + IP |
| `app/api/seed-ai-settings/route.ts` | 723 | one-shot seeder for all AI settings | POST, GET | fake auth; hardcoded API key; GET dev-only |
| `app/api/admin/content/route.ts` | 180 | content auto-tag/freshness helpers | GET, POST | `freshness`/`review` GET branches return prose, not data |
| `app/api/admin/receipts/route.ts` | 173 | receipt list + report aggregation + create | GET, POST, `dynamic`, `revalidate` | admin token; `.offset()` paging; `setHours(23,59,999)` bug at `:49` |
| `app/api/ai/knowledge/import/route.ts` | 157 | import `seed/ai/*.json` into `knowledge` | POST | reads disk at runtime; client SDK writes |
| `app/api/admin/prompts/route.ts` | 151 | prompt version admin | GET, POST, PUT | only route with an API-key gate, and only in production |
| `app/api/admin/quotes/route.ts` | 146 | quote CRUD + bulk ops | GET, POST, PATCH, DELETE | loops per id; no transaction |
| `app/api/ai/knowledge/coverage/route.ts` | 144 | category coverage report | GET | 30-entry category list hardcoded at `:7-43` |
| `app/api/ai/settings/unknown-questions/route.ts` | 138 | unknown-question queue | GET, POST, PUT, DELETE | duplicated by `/api/ai/analytics/unknown-questions` |
| `app/api/ai/settings/intents/route.ts` | 131 | intent registry CRUD | GET, POST, PUT, DELETE | `intent_${Date.now()}` id generation `:49` |
| `lib/rate-limit.ts` | 128 | fixed-window in-memory limiter | `rateLimit`, `getClientIP`, `createRateLimitResponse`, `RateLimitConfig`, `RateLimitResult` | `setInterval` cleanup at `:28`; used by 2 routes |
| `app/api/admin/knowledge/route.ts` | 129 | knowledge admin list/create | GET, POST, `dynamic` | merges Firestore rows with `SEED_ARTICLES` |
| `app/api/admin/knowledge/[id]/route.ts` | 113 | knowledge admin item | GET, PUT, DELETE, `dynamic` | comments say it "bypasses security rules" |
| `app/api/reports/save/route.ts` | 115 | blob upload for reports | POST, `runtime`, `maxDuration` | base64 sniffing at `:62` |
| `app/api/ai/settings/prompts/route.ts` | 107 | prompt versions (non-admin twin) | GET, POST, PUT | duplicate of `/api/admin/prompts` |
| `app/api/knowledge/workflow/articles/[id]/route.ts` | 99 | workflow article + expansions | GET, PATCH | `response: any` at `:37` |
| `app/api/admin/users/set-role/route.ts` | 97 | change any user's role | POST | unauthenticated privilege escalation |
| `app/api/admin/users/create-admin/route.ts` | 95 | create a `super_admin` | POST | unauthenticated; calls `signOut(auth)` at `:81` |
| `app/api/admin/quotes/bulk/route.ts` | 96 | bulk import/export quotes | POST, GET | validate-mode counter is wrong (`valid = quotes.length - errors.length`) |
| `app/api/knowledge/workflow/drafts/route.ts` | 89 | draft CRUD | GET, POST, DELETE | `userId` from query string, unverified |
| `app/api/admin/receipt-sevas/route.ts` | 89 | seva catalogue for billing | GET, POST, `dynamic`, `revalidate` | admin token + real validators |
| `app/api/admin/aaradhane/[id]/route.ts` | 87 | aaradhane item | GET, PUT, DELETE | no auth on a write path |
| `app/api/admin/quotes/[id]/route.ts` | 85 | quote item | GET, PUT, DELETE | - |
| `app/api/public/receipts/route.ts` | 84 | public booking lookup | GET, `dynamic` | PII exposure; 1000-doc scan per call |
| `app/api/public/stats/route.ts` | 82 | site counters | GET | 6 count queries + full donations scan |
| `app/api/recommendations/route.ts` | 80 | recommendation feed | GET, `dynamic` | "personalized" builds an empty `UserBehavior` (`:33-39`) - always homepage output |
| `app/api/ai/settings/route.ts` | 79 | AI settings umbrella | GET, POST | `// TODO: Add proper admin authentication` at `:24` |
| `app/api/admin/receipts/[id]/pdf/route.ts` | 74 | receipt PDF stream | GET, `dynamic` | fallback temple contact hardcoded `:16-22` |
| `app/api/ai/settings/visitor-information/route.ts` | 72 | visitor info setters | GET, PUT | 8-section switch |
| `app/api/knowledge/workflow/articles/route.ts` | 72 | workflow article list/create | GET, POST | imports 3 unused functions (`:8-10`) |
| `app/api/volunteer/route.ts` | 70 | volunteer sign-up + **list** | POST, GET | GET returns all requests with phone/email, unauthenticated |
| `app/api/admin/analytics/route.ts` | 71 | admin analytics + intent feedback | GET, POST | doc comment claims a `/feedback` sub-path that does not exist (`:32`) |
| `app/api/ai/settings/temple-information/route.ts` | 69 | temple info | GET, PUT, `revalidate` | only AI route with cache headers |
| `app/api/admin/receipt-sevas/[id]/route.ts` | 69 | seva catalogue item | PUT, `dynamic` | no GET/DELETE twin |
| `app/api/gallery/local-assets/route.ts` | 63 | local media listing + delete | GET, DELETE | filesystem writes; ephemeral on Vercel |
| `app/api/ai/analytics/unknown-questions/route.ts` | 62 | unknown questions (analytics twin) | GET, PATCH | duplicate domain |
| `app/api/quotes/festival/[festival]/route.ts` | 61 | festival quotes | GET | 15-value enum inline |
| `app/api/testimonials/route.ts` | 60 | testimonial submit/list | POST, GET | imports unused `getPendingTestimonials`, `approveTestimonial` |
| `app/api/knowledge/workflow/comments/route.ts` | 58 | review comments | POST, PATCH | imports unused `getArticleComments` |
| `app/api/ai/settings/ai-behavior/route.ts` | 58 | behavior toggles | GET, PUT | - |
| `app/api/contact/route.ts` | 57 | contact form | POST | **stores nothing**; logs the message (`:46`) |
| `app/api/ai/settings/policies/route.ts` | 57 | policy setters | GET, PUT | - |
| `app/api/supabase-check/route.ts` | 56 | Supabase health probe | GET | reveals which env vars are set |
| `app/api/bookings/[id]/route.ts` | 56 | booking item | GET, DELETE, PATCH | anyone can cancel any booking |
| `app/api/admin/temple-areas/[id]/route.ts` | 55 | temple area item (admin twin) | GET, PUT, DELETE | duplicate of the public twin |
| `app/api/knowledge/workflow/versions/[id]/route.ts` | 55 | version get/restore | GET, POST | no validation on `articleId`/`restoredBy` |
| `app/api/search/route.ts` | 54 | global search | GET, `dynamic` | imports unused `getSearchSuggestions` |
| `app/api/ai/multi-source/query/route.ts` | 54 | multi-source query | POST | - |
| `app/api/admin/aaradhane/route.ts` | 53 | aaradhane list/create | GET, POST | `x-user-email` header used as `createdBy` |
| `app/api/quotes/category/[category]/route.ts` | 52 | category quotes | GET | 6-value enum inline |
| `app/api/temple-areas/[id]/route.ts` | 52 | temple area item (public) | GET, PUT, DELETE | public route with PUT/DELETE |
| `app/api/admin/prompts/[id]/publish/route.ts` | 51 | publish a prompt | POST | no auth despite sibling gate |
| `app/api/announcements/[id]/route.ts` | 50 | announcement item | GET, PATCH, DELETE | - |
| `app/api/donations/[id]/route.ts` | 50 | donation item | GET, PATCH, DELETE | anyone can edit/delete a donation record |
| `app/api/events/[id]/route.ts` | 50 | event item | GET, PATCH, DELETE | - |
| `app/api/quotes/route.ts` | 50 | public quote list | GET | - |
| `app/api/ai/settings/ai-responses/route.ts` | 48 | response templates | GET, PUT | - |
| `app/api/revalidate/route.ts` | 45 | cache purge | POST | unauthenticated |
| `app/api/quotes/today/route.ts` | 45 | quote of the day | GET, `dynamic`, `revalidate` | `no-store` |
| `app/api/bookings/route.ts` | 41 | booking list/create | GET, POST | GET returns **all** bookings unauthenticated |
| `app/api/knowledge/article/[slug]/route.ts` | 42 | article page data | GET, `dynamic` | - |
| `app/api/admin/receipts/[id]/route.ts` | 38 | receipt item | GET, `dynamic` | admin token |
| `app/api/storage/videos/route.ts` | 38 | blob video listing | GET | returns `String(error)` to the client |
| `app/api/quotes/search/route.ts` | 37 | quote search | GET | - |
| `app/api/knowledge/workflow/approvals/route.ts` | 37 | committee vote | POST | `memberId`/`memberName` come from the body |
| `app/api/admin/temple-areas/route.ts` | 35 | temple areas (admin twin) | GET, POST | - |
| `app/api/knowledge/search/route.ts` | 35 | knowledge search | GET, `dynamic` | - |
| `app/api/events/route.ts` | 33 | event list/create | GET, POST | - |
| `app/api/temple-areas/route.ts` | 33 | temple areas (public) | GET, POST | public POST |
| `app/api/ai/analytics/latency/route.ts` | 33 | latency metrics | GET | - |
| `app/api/ai/analytics/token-usage/route.ts` | 33 | token usage | GET | - |
| `app/api/ai/analytics/intent-distribution/route.ts` | 32 | intent distribution | GET | - |
| `app/api/knowledge/workflow/audit/route.ts` | 32 | audit log | GET | - |
| `app/api/reports/list/route.ts` | 31 | blob report listing | GET, `runtime` | - |
| `app/api/announcements/route.ts` | 30 | announcement list/create | GET, POST | - |
| `app/api/donations/route.ts` | 30 | donation list/create | GET, POST | GET returns **all** donations unauthenticated |
| `app/api/quotes/random/route.ts` | 30 | random quote | GET | - |
| `app/api/quotes/preview/route.ts` | 29 | rotation preview | GET | - |
| `app/api/ai/analytics/route.ts` | 28 | analytics dashboard | GET | - |
| `app/api/knowledge/route.ts` | 27 | knowledge centre data | GET, `dynamic` | - |
| `app/api/knowledge/categories/route.ts` | 27 | categories | GET, `dynamic` | - |
| `app/api/admin/quotes/seed/route.ts` | 26 | seed default quotes | POST | unauthenticated data seeding |
| `app/api/quotes/featured/route.ts` | 26 | featured quotes | GET | - |
| `app/api/quotes/tags/route.ts` | 26 | tags | GET | - |
| `app/api/ai/multi-source/statistics/route.ts` | 26 | retrieval stats | GET | in-memory only |
| `app/api/dashboard/daily-spiritual/route.ts` | 25 | daily spiritual panel | GET, `dynamic`, `revalidate` | no in-app caller |
| `app/api/admin/quotes/cache/route.ts` | 25 | clear quote cache | POST | per-instance cache only |
| `app/api/search/suggestions/route.ts` | 23 | search suggestions | GET, `dynamic` | returns `[]` with status 500 on error |
| `app/api/quotes/stats/route.ts` | 23 | quote stats | GET | - |
| `app/api/ai/analytics/health/route.ts` | 22 | AI health | GET | - |
| `app/api/ai/multi-source/overview/route.ts` | 19 | temple overview | GET | - |
| `app/api/ai/multi-source/today/route.ts` | 19 | today info | GET | - |
| `app/api/knowledge/workflow/statistics/route.ts` | 19 | workflow stats | GET | - |
| `app/actions/sevas.ts` | 17 | only server action module | `getAllSevasAction`, `getSevaByIdAction` | Supabase service-role client, no auth |
| `app/api/ai/multi-source/quick-queries/route.ts` | 13 | canned queries | GET | no try/catch |
| `app/api/admin/receipts/[id]/send/route.ts` | 2 | stub | POST | returns `{success:true}` and does nothing |
| `vercel.json` | 23 | platform config | - | only `Cache-Control: no-store` headers for `/data/panchanga/*` |

## Types and stores

**Types imported by route files** (all from M10's `types/`, plus a few from `lib/ai`):
`types/aaradhane.ts` (`Aaradhane`), `types/ai.ts` (`AIMessage`, `ChatRequest`, `ChatResponse`),
`types/ai-settings.ts` (`AIBehaviorSettings`, `AIResponses`, `AIResponseTemplates`,
`IntentMetadata`), `types/knowledge-workflow.ts` (`WorkflowStatus`, `WorkflowActionType`,
`AuditLogEntry`), `types/multi-source-retrieval.ts` (`MultiSourceQuery`), `types/quote.ts`
(`QuoteCategory`, `FestivalName`, `QuoteBulkData`), `types/receipt.ts` (`Receipt`,
`ReceiptCreateInput`), `types/receiptSeva.ts` (`ReceiptSevaInput`), `types/recommendation.ts`
(`UserBehavior`), `types/search.ts` (`SearchFilters`, `SearchResultType`),
`lib/ai/intent/types.ts` (`Intent`), `lib/ai/knowledge/types.ts` (`KnowledgeCategory`,
`KnowledgeLanguage`), `services/analytics.service.ts` (`IntentFeedback`),
`services/content.service.ts` (`AutoTagResult`, `ContentFreshness`, `RelatedQuestion`),
`services/storage.service.ts` (`ReportFileType`).

**Stores touched directly from route files** (not through a service):

| Store | Where | R/W |
|---|---|---|
| Firestore `receipts` | `app/api/admin/receipts/route.ts:38,58`, `[id]/route.ts:27`, `[id]/pdf/route.ts:55` | R/W |
| Firestore `sevas` | `app/api/admin/receipt-sevas/route.ts:27,74`, `[id]/route.ts:41` | R/W |
| Firestore `settings` | `app/api/admin/receipts/[id]/pdf/route.ts:27` | R |
| Firestore `sevaBookings` | `app/api/public/receipts/route.ts:20,28` | R |
| Firestore `knowledge` | `app/api/admin/knowledge/route.ts:10,22,102`, `[id]/route.ts:59,98`, `app/api/ai/knowledge/coverage/route.ts:81`, `app/api/ai/knowledge/import/route.ts:73,114` | R/W |
| Firestore `users` | `app/api/admin/users/create-admin/route.ts:65`, `set-role/route.ts:63,79` | R/W |
| Firebase Auth | `app/api/admin/users/create-admin/route.ts:62,63,81` | W |
| Firestore counters (`users`,`volunteers`,`members`,`donations`,`sevaBookings`,`events`) | `app/api/public/stats/route.ts:33-54` | R |
| Firestore `ai_settings/*`, `settings/temple|contact|visitor` | `app/api/seed-ai-settings/route.ts:547-610, 644-708` | W |
| Local filesystem `public/images/temple`, `public/videos` | `app/api/gallery/local-assets/route.ts:5,6,32,33,57` | R/W (delete) |
| Local filesystem `seed/ai/*.json` | `app/api/ai/knowledge/import/route.ts:61,85,96` | R |
| Vercel Blob | `app/api/reports/list|save/route.ts`, `app/api/storage/videos/route.ts` via `storageService` | R/W |
| Supabase `sevas` table | `app/actions/sevas.ts:6,13` (service-role) | R |
| Next.js data cache | `app/api/revalidate/route.ts:17,28` | W |

Everything else reaches Firestore through `services/*` (M10) - see that chunk for collection
mapping.

## Cross-module dependencies

**M12 imports from** (counts from `.claude/state/inventory/import-graph.json`):

| Target | Chunk | Used by N route files |
|---|---|---:|
| `services/quote.service.ts` | M10 | 15 |
| `lib/ai/ai-settings/index.ts` | M08 | 12 |
| `services/knowledge-workflow.service.ts` | M09/M10 | 8 |
| `lib/admin-firebase.ts` | M10 | 6 |
| `services/ai-analytics.service.ts` | M08/M10 | 6 |
| `lib/auth/admin-auth.ts` | M04 | 5 |
| `lib/firebase.ts` (client SDK) | M10 | 5 |
| `services/multi-source-retrieval.service.ts` | M08 | 5 |
| `services/temple-areas.service.ts`, `services/knowledge.service.ts` | M10 | 4 each |
| `services/storage.service.ts` | M10 | 3 |
| `lib/receipt/validation.ts`, `lib/receipt/admin.ts`, `lib/receipt/pdf.ts` | M07/M14 | 2/1/1 |
| `lib/firebase-admin-rest.ts` | M10 | 2 |
| `services/{announcement,sevaBooking,donation,event,search,chat}.service.ts` | M10 | 2 each |
| `lib/supabase/{admin,server}.ts` | M11 | 2/1 |
| `services/{aaradhane,analytics,content,conversation,ux,daily-spiritual,recommendation}.service.ts` | M10/M14 | 1 each |
| `lib/ai/{index,provider,settings,firebaseChat,knowledge/*,intent/types}` | M08 | 1-2 each |
| `lib/rate-limit.ts` | M12 (own) | 2 |
| `next/cache` `revalidatePath` | framework | 1 |

**Who imports M12:** only `services/seva.service.ts:4` -> `app/actions/sevas.ts`. No other module
imports a route file (route handlers are not importable by design), so the coupling to the rest of
the app is entirely over HTTP from client components and from Playwright specs.

## How to change it

### Recipe 1 - add a new public read endpoint
1. Create `app/api/<resource>/route.ts`.
2. `import { NextResponse } from "next/server"` and the service from `services/<resource>.service.ts` (create it there if it does not exist - do not call Firestore from the route).
3. Export `async function GET(request: Request)`; read `new URL(request.url).searchParams`.
4. Add `export const dynamic = "force-dynamic";` if the data changes per request, or return a `Cache-Control` header (`s-maxage`/`stale-while-revalidate`) like `app/api/knowledge/route.ts:15-17`.
5. Wrap in try/catch; `console.error` and return `{ error: "..." }` with 500. Do not return `error.message`.
6. Add a Playwright contract test under `tests/e2e/api/`.

### Recipe 2 - add an authenticated admin endpoint (the correct pattern)
1. Create `app/api/admin/<resource>/route.ts`.
2. `import { verifyAdminUser } from "@/lib/auth/admin-auth";` and copy the `unauthorized()` helper from `app/api/admin/receipts/route.ts:12-14`.
3. First line of every handler: `const admin = await verifyAdminUser(request); if (!admin) return unauthorized();`.
4. Add `export const dynamic = "force-dynamic"; export const revalidate = 0;` - an admin list must never be cached.
5. Validate the body in `lib/<domain>/validation.ts` and call it before touching the store (pattern: `lib/receipt/validation.ts` used at `app/api/admin/receipt-sevas/route.ts:65`).
6. On the client, call it through a service that attaches the ID token - copy `services/receipt.service.ts`; a `fetch` without the header will 401.

### Recipe 3 - add a field to an existing resource over HTTP
1. `types/<resource>.ts` (M10) - add the field.
2. `services/<resource>.service.ts` - map it in the read and write paths.
3. The route's validation block - add the guard (e.g. `app/api/events/route.ts:18-24`).
4. If a `[id]` route exists, check its PATCH/PUT passes the whole body through (most do) - no change needed.
5. Firestore rules + indexes (M11) if the field is queried.

### Recipe 4 - protect an endpoint that is currently open
1. Add the `verifyAdminUser` guard as in Recipe 2.
2. Find every caller: `grep -rn "'/api/<path>'" app components hooks services`.
3. Move the caller into a service that reads `auth.currentUser.getIdToken()` and sets `Authorization`.
4. Update `tests/e2e/**` specs that assert a 200 on the unauthenticated call.
5. If the endpoint is also called by a Server Component, call the service function directly instead of the HTTP route.

### Recipe 5 - apply rate limiting to a route
1. `import { rateLimit, getClientIP, createRateLimitResponse } from "@/lib/rate-limit";`
2. At the top of the handler: `const r = rateLimit(\`<name>:${getClientIP(request)}\`, { windowMs, maxRequests }); if (!r.success) return createRateLimitResponse(r);` (pattern: `app/api/admin/users/create-admin/route.ts:8-17`).
3. Understand the limit is per serverless instance - for a real limit, replace `lib/rate-limit.ts` with a Redis-backed store; the module's own comment says so (`lib/rate-limit.ts:2-3`).

### Recipe 6 - change the response envelope of a family
1. Pick the target shape. Today three coexist: `{success, data}` (admin/aaradhane, admin/knowledge), bare payload (events, announcements, quotes-by-id), `{<noun>, total}` (quotes, search).
2. Change the route, then the client caller, then the Playwright spec, in that order.
3. Grep for `res.json()` destructuring on the caller side - several components read `data.quotes` vs `data` directly.

### Recipe 7 - add a server action instead of a route
1. Create `app/actions/<domain>.ts` with `"use server"` at the top (see `app/actions/sevas.ts:1`).
2. Export `async function <name>Action(...)`.
3. Import it only from a service or a Server Component. Note the existing action uses `createAdminClient()` (service-role) with no caller check - do not copy that part; add an auth check.
4. A server action is **not** reachable from a React Native client. If mobile needs it, write a route handler too.

## Faults, smells and risks

| id | sev | what | evidence | direction |
|---|---|---|---|---|
| M12-F01 | HIGH | `POST /api/admin/users/create-admin` is unauthenticated and creates a Firebase Auth user with `role: "super_admin"`. Any internet caller can mint an administrator (5/min). | `app/api/admin/users/create-admin/route.ts:7` (no auth), `:62` create, `:70` `role:"super_admin"` | Require `verifyAdminUser` + `super_admin` role, or delete the route and use a CLI script. |
| M12-F02 | HIGH | `POST /api/admin/users/set-role` is unauthenticated and sets any user's role, `super_admin` included. Straight privilege escalation. | `app/api/admin/users/set-role/route.ts:6`, valid roles at `:54`, write at `:79` | Same as F01. |
| M12-F03 | HIGH | `/api/seed-ai-settings` auth helper can never fail: returns an admin immediately in production and `dev-admin` otherwise, so the 401 is dead code. POST overwrites 8 settings documents. | `app/api/seed-ai-settings/route.ts:119-121`, `:139`, unreachable 401 at `:543`, writes `:547-610` | Delete the route or gate it behind `verifyAdminUser` + `super_admin`. |
| M12-F04 | HIGH | Firebase Web API key hardcoded as a fallback literal in source. | `app/api/seed-ai-settings/route.ts:63` | Remove the literal; fail closed when the env var is missing. |
| M12-F05 | HIGH | 88 of 95 route files perform no identity check. Only 5 call `verifyAdminUser`; 1 has a conditional API-key gate; 1 has the fake gate. | `grep -rl verifyAdminUser app/api` -> 5 files; `find app/api -name route.ts \| wc -l` -> 95 | Add a route-group convention (`/api/admin/*` guarded by a shared wrapper) or reintroduce `middleware.ts`. |
| M12-F06 | HIGH | Unauthenticated writes to core business data: `POST/PATCH/DELETE` on events, announcements, donations, bookings, temple-areas (both public and admin twins), aaradhane, quotes. | `app/api/events/[id]/route.ts:21,37`; `app/api/donations/[id]/route.ts:21,37`; `app/api/bookings/[id]/route.ts:21`; `app/api/temple-areas/[id]/route.ts:23,39`; `app/api/admin/aaradhane/[id]/route.ts:40,67` | Guard all non-GET handlers; keep GET public where the data is public. |
| M12-F07 | HIGH | `DELETE /api/gallery/local-assets` deletes files from disk with no auth (path prefix check only), and it is a live feature - the admin gallery component calls it. | `app/api/gallery/local-assets/route.ts:38,47,57`; caller `components/admin/gallery/LocalGalleryAssets.tsx:47`; `docs/API.md:135` publishes the cURL | Add admin auth; on Vercel the write is ephemeral anyway - move media to Blob. |
| M12-F08 | HIGH | Unauthenticated bulk data mutation: `POST /api/admin/quotes/seed`, `POST /api/ai/knowledge/import` (writes every `seed/ai/*.json` into `knowledge`), `POST /api/admin/quotes/bulk`. | `app/api/admin/quotes/seed/route.ts:10`; `app/api/ai/knowledge/import/route.ts:50,116`; `app/api/admin/quotes/bulk/route.ts:11` | Guard; make import idempotent and admin-only. |
| M12-F09 | HIGH | `GET /api/public/receipts` returns devotee PII (phone, email, payment reference, amounts) for any substring, unauthenticated. | `app/api/public/receipts/route.ts:6,28,44-64`; it is shipped as a public page - `app/(public)/receipts/page.tsx:53` | Require the full booking id or an OTP; never return email+phone together. |
| M12-F10 | HIGH | `GET /api/volunteer`, `GET /api/bookings`, `GET /api/donations` return the whole collection unauthenticated, including contact details. | `app/api/volunteer/route.ts:58`; `app/api/bookings/route.ts:4`; `app/api/donations/route.ts:4` | Guard the list handlers; scope by the authenticated user for devotee use. |
| M12-F11 | MEDIUM | `POST /api/revalidate` purges arbitrary paths with no auth or allow-list - trivial cache-thrash DoS. | `app/api/revalidate/route.ts:10,26-30` | Require a shared secret header, or an allow-list of paths. |
| M12-F12 | MEDIUM | Rate limiting exists on 2 of 95 routes, and the store is a per-instance `Map`, so on serverless the limit multiplies by instance count. `/api/chat` reimplements the same thing separately. | `lib/rate-limit.ts:11`, importers = 2 files; `app/api/chat/route.ts:29-51` | Move to a shared store (Redis/Upstash); apply to every write route. |
| M12-F13 | MEDIUM | Documented security controls do not exist: `docs/SECURITY.md` shows an Upstash Redis limiter and a per-endpoint limit table, zod server-side validation, and a `middleware.ts` authorization gate. None are in the repo. | `docs/SECURITY.md:418-453` (Upstash), `:302` ("Using Zod schemas") and `:315-345` (the `safeParse` example), `:110-130` (middleware); `grep -rn zod app/api` -> 0 hits; `ls middleware.ts` -> missing | Either implement them or mark the doc as aspirational. |
| M12-F14 | MEDIUM | `docs/API.md` documents 4 endpoints across 3 of the 95 route files and is otherwise the only API reference; it publishes working cURL for the two unauthenticated user-management endpoints against the production host. | `docs/API.md:12` (create-admin), `:55` (set-role), `:106` (gallery GET), `:135` (gallery DELETE), `:169-181` (cURL) vs 95 route files | Generate the reference from the route table in this file. |
| M12-F15 | MEDIUM | Duplicate/competing route families with different shapes and different (non-)auth: quotes (`/api/quotes` vs `/api/admin/quotes`), temple areas (`/api/temple-areas` vs `/api/admin/temple-areas` - both allow POST), prompts (`/api/admin/prompts` vs `/api/ai/settings/prompts`), knowledge (`/api/knowledge`, `/api/admin/knowledge`, `/api/ai/knowledge`, `/api/knowledge/workflow`), unknown questions (`/api/ai/settings/unknown-questions` vs `/api/ai/analytics/unknown-questions`), analytics (`/api/admin/analytics` vs `/api/ai/analytics`). | `app/api/temple-areas/route.ts:14` and `app/api/admin/temple-areas/route.ts:14`; `app/api/admin/prompts/route.ts:102` and `app/api/ai/settings/prompts/route.ts:64` | Collapse to one family per resource with an auth-scoped variant. |
| M12-F16 | MEDIUM | `/api/admin/prompts` auth is a no-op in every environment except production-with-`ADMIN_API_KEY`; its own comment admits it. | `app/api/admin/prompts/route.ts:11-19` | Replace with `verifyAdminUser`. |
| M12-F17 | MEDIUM | Audit identity is taken from unauthenticated request headers: `x-user-id` in 11 route files (8 of the 9 under `/api/ai/settings` - all but `unknown-questions` - plus the 3 under `/api/admin/prompts`) and `x-user-email` in 2 (aaradhane, quotes). Every "who changed this" record can be forged. | `grep -rl x-user-id app/api` -> 11 files, `grep -rl x-user-email app/api` -> 2; `app/api/ai/settings/route.ts:25`; `app/api/ai/settings/intents/route.ts:38`; `app/api/admin/prompts/route.ts:108`; `app/api/admin/aaradhane/route.ts:33`; `app/api/admin/quotes/route.ts:46` | Derive the identity from the verified token. |
| M12-F18 | MEDIUM | Client Firebase SDK (`lib/firebase`) used inside server handlers, so writes are subject to client security rules and share process-global auth state. `create-admin` even calls `signOut(auth)` on that global. | `app/api/admin/users/create-admin/route.ts:4,81`; `set-role/route.ts:3`; `app/api/public/stats/route.ts:6`; `app/api/ai/knowledge/coverage/route.ts:2`; `app/api/ai/knowledge/import/route.ts:2` | Use `lib/admin-firebase` (admin SDK) in all server handlers. |
| M12-F19 | MEDIUM | `/api/calendar` is called six times from the admin calendar pages but no such route exists - those pages' writes silently 404. | `app/admin/calendar/ekadashi/page.tsx:34,62,80`; `app/admin/calendar/festivals/page.tsx:31,60,79`; `ls app/api/calendar` -> missing | Implement the route or repoint the pages at the aaradhane/panchanga services. |
| M12-F20 | MEDIUM | `POST /api/contact` validates and sanitises, then only `console.log`s - no email, no store. The devotee is told "we will get back to you". | `app/api/contact/route.ts:46-51` | Persist to a `contactRequests` collection and/or send mail. |
| M12-F21 | MEDIUM | Stub and placeholder handlers shipped as real endpoints: `receipts/[id]/send` returns success without sending; `admin/content` GET `freshness`/`review` return explanatory prose instead of data. | `app/api/admin/receipts/[id]/send/route.ts:1`; `app/api/admin/content/route.ts:46-71` | Implement or remove; a stub that returns `success:true` hides failures from the UI. |
| M12-F22 | MEDIUM | `"personalized"` recommendations construct an empty `UserBehavior` on every call, so the branch is identical to `homepage`. | `app/api/recommendations/route.ts:30-40` | Read behaviour from a cookie/session or drop the branch. |
| M12-F23 | MEDIUM | `AGENTS.md` bans `any`; 25 of 95 route files use it (`grep -rlE ":\s*any\b\|<any>\|as any\|\bany\[\]" app/api \| wc -l` -> 25), including `response: any`, `error: any`, `filters: any`, `(v: any)`. | `app/api/knowledge/workflow/articles/[id]/route.ts:37`; `app/api/admin/quotes/route.ts:18,34`; `app/api/admin/prompts/[id]/route.ts:19`; `app/api/admin/receipt-sevas/[id]/route.ts:48` | Type the bodies; `unknown` + a narrowing guard where the shape is open. |
| M12-F24 | MEDIUM | Firestore `.offset()` pagination on receipts bills a read for every skipped document; page 50 of a 10 000-row export reads 500 000 docs. | `app/api/admin/receipts/route.ts:58-61` | Cursor pagination with `startAfter`. |
| M12-F25 | MEDIUM | `/api/public/stats` runs 6 count queries plus a full scan of completed donations on every request, uncached. | `app/api/public/stats/route.ts:33-60` | Cache the counters (ISR or a nightly aggregate doc). |
| M12-F26 | MEDIUM | Date filter bug: `toDate.setHours(23,59,999)` sets **999 seconds**, pushing the upper bound to 00:15:39 the next day; also the `NaN` check runs after the mutation. | `app/api/admin/receipts/route.ts:48-52` | `setHours(23,59,59,999)` and validate before mutating. |
| M12-F27 | MEDIUM | No response-shape contract: `{success,data}`, `{success,<noun>}`, bare arrays, bare objects, `{<noun>,total}` and `{error}` vs `{success:false,error}` all coexist. | `app/api/admin/aaradhane/route.ts:12` vs `app/api/events/route.ts:7` vs `app/api/quotes/route.ts:37` vs `app/api/announcements/route.ts:10` | Define one envelope before any mobile client is written. |
| M12-F28 | MEDIUM | Bulk quote operations loop one Firestore write per id with no transaction and no cap; a large `ids[]` is an unauthenticated write amplifier. | `app/api/admin/quotes/route.ts:88-95,125-132` | Batch writes, cap the array, require auth. |
| M12-F29 | LOW | Internal error text leaked to clients via `details: error.message` / `String(error)` in the quote family, revalidate and storage routes. | `app/api/quotes/route.ts:45`; `app/api/revalidate/route.ts:40`; `app/api/storage/videos/route.ts:26` | Log server-side, return a generic message. |
| M12-F30 | LOW | `/api/chat` logs the caller IP and the first 50 characters of every user message to stdout. | `app/api/chat/route.ts:77,121` | Drop or hash; treat chat text as personal data. |
| M12-F31 | LOW | ~55 lines of commented-out LLM-fallback code and several unused imports (`getAIProvider` only in GET, `generateFirebaseResponse`, `getTempleInfo`, `getSystemPrompt`, `detectIntent`, `getSession`, `createSession`, `clearSession`, `getQuickActions`, `getSuggestedQuestions`). | `app/api/chat/route.ts:232-286`, imports at `:3-26` | Delete; git history is the archive. |
| M12-F32 | LOW | Unused imports elsewhere: `getWorkflowArticleById/updateWorkflowArticle/performWorkflowAction` in the workflow list route, `getSearchSuggestions` in the search route, `getPendingTestimonials/approveTestimonial` in testimonials, `getArticleComments` in comments, `doc/setDoc/serverTimestamp` in the seed route. | `app/api/knowledge/workflow/articles/route.ts:8-10`; `app/api/search/route.ts:2`; `app/api/testimonials/route.ts:2`; `app/api/knowledge/workflow/comments/route.ts:7`; `app/api/seed-ai-settings/route.ts:7` | Clean up; lint rule would catch these. |
| M12-F33 | LOW | `/api/supabase-check` is a debug endpoint that publicly reports which Supabase env vars are configured. | `app/api/supabase-check/route.ts:6-10,41-46` | Remove before launch or gate it. |
| M12-F34 | LOW | Doc comment advertises `POST /api/admin/analytics/feedback`; the handler is `POST /api/admin/analytics`. A client following the comment 404s. | `app/api/admin/analytics/route.ts:32` | Fix the comment or add the sub-route. |
| M12-F35 | LOW | Seed route writes a document literally named `%20RayaAI` (URL-encoded space) into `ai_settings`. | `app/api/seed-ai-settings/route.ts:547` (POST) and `:644` (GET) vs the clean name reported back to the caller at `:621` | Use a clean id and migrate. |
| M12-F36 | LOW | `/api/admin/knowledge` GET merges Firestore rows with `SEED_ARTICLES` and flags them `isSeed:true`; those rows cannot be edited or deleted through the `[id]` routes, so the admin table shows undeletable entries. | `app/api/admin/knowledge/route.ts:46-66` | Import seeds once, or mark them read-only in the UI. |
| M12-F37 | LOW | `admin/quotes/bulk` validate mode reports `valid = quotes.length - errors.length`, but one row can raise three errors, so `valid` can go negative. | `app/api/admin/quotes/bulk/route.ts:34-38` | Count rows, not error strings. |
| M12-F38 | LOW | No `OPTIONS` handler and no CORS headers anywhere (`grep OPTIONS app/api` -> 0), so a browser-based client on another origin cannot use this API. | `find app/api -name route.ts` vs `grep -rn "export async function OPTIONS" app/api` -> 0 | Add a shared CORS helper when a separate frontend lands. |
| M12-F39 | LOW | List endpoints have no pagination except receipts: events, announcements, donations, bookings, testimonials, volunteer, workflow articles all return everything; `/api/quotes` fetches all then `.slice(0, limit)`. | `app/api/events/route.ts:6`; `app/api/quotes/route.ts:38` | Add `limit`/cursor params before the collections grow. |
| M12-F40 | LOW | `/api/search/suggestions` returns HTTP 500 with an empty array body, so a client cannot distinguish "no suggestions" from "broken". | `app/api/search/suggestions/route.ts:20` | Return 200 `[]` or a proper error object. |
| M12-F41 | LOW | `vercel.json` carries only cache headers for `/data/panchanga/*` - no function memory/duration/region config despite `maxDuration` being set inline in one route. | `vercel.json:1-23`; `app/api/reports/save/route.ts:5` | Centralise function config if cold starts or timeouts appear. |
| M12-F42 | LOW | The only server action uses the Supabase **service-role** client with no caller check, and returns raw table rows. | `app/actions/sevas.ts:2,5,12` | Add an auth check and map to the domain type. |
| M12-F43 | MEDIUM | The Raya AI operations console is a **public page**. `app/(public)/ai/analytics/page.tsx` sits in the public route group with no guard in the page or in `app/(public)/layout.tsx`, and fetches the unauthenticated `/api/ai/analytics` - so conversation volumes, intent distribution, latency and token usage are readable by anyone who visits `/ai/analytics`. | `app/(public)/ai/analytics/page.tsx:294` (fetch), `:1` (`"use client"`, no auth hook), `app/(public)/layout.tsx:4-17` (no guard); endpoint `app/api/ai/analytics/route.ts` has no auth | Move the page under `app/admin/` and guard `/api/ai/analytics` with `verifyAdminUser`. |
| M12-F44 | MEDIUM | **36 of the 95 endpoints have no reference anywhere in the repository** - no component, service, hook or test calls them. They are unmaintained, untested attack surface, and several of them are write paths (`/api/admin/aaradhane/[id]`, `/api/admin/prompts/[id]/publish`, `/api/admin/users/set-role`, `/api/donations/[id]`, `/api/temple-areas/[id]`, `/api/knowledge/workflow/comments`). | script `.claude/state/verify/_M12_callers.js` -> 36 unreferenced; e.g. `app/api/bookings/route.ts`, `app/api/dashboard/daily-spiritual/route.ts`, `app/api/supabase-check/route.ts`, `app/api/admin/receipts/[id]/send/route.ts` have zero hits outside `app/api` | Delete the dead ones; guard the rest. Every route kept must have a caller or a contract test. |
| M12-F45 | MEDIUM | The Playwright API-contract suite is written against endpoints that do not exist: `/api/sevas`, `/api/admin/events`, `/api/admin/settings`, `/api/auth/login`, `/api/v1/events`, `/api/health`. `CONTRACT_API_003` asserts `status === 200` on `/api/sevas`, which can only 404 - so the suite cannot be passing and gives no contract assurance. | `tests/e2e/sprint5/api-contract.spec.ts:52-53` (`/api/sevas`, expects 200), `:169`, `:317`, `:319`, `:329`, `:353`; `tests/functional/09_performance_security.spec.ts:377` (`/api/health`); `find app/api -name route.ts` contains none of these paths | Either write the missing routes (`/api/sevas` is also the mobile gap in the portability table) or rewrite the specs against the real surface. Owner: M15. |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| The 95 route handlers as HTTP endpoints | none (plain `Request`/`Response`) | **reuse as-is** | A React Native client can `fetch` them unchanged; this table is the mobile API contract. |
| `NextResponse.json(...)` | `next/server` | adapt (server side only) | Cosmetic; the wire format is plain JSON. Only matters if the backend moves off Next.js. |
| `export const dynamic / revalidate` | Next.js data cache | rewrite | Route segment config has no meaning outside Next; replace with `Cache-Control` headers, which most routes also need for mobile. |
| `POST /api/revalidate` + `revalidatePath` | `next/cache` | drop for mobile | ISR is a web-rendering concern; RN has no equivalent. |
| `app/actions/sevas.ts` (`"use server"`) | React Server Actions / Next RSC transport | **rewrite** | Server actions are not callable from React Native. Needs a `GET /api/sevas` route handler - which does not exist today, so mobile has **no seva catalogue endpoint**. |
| `verifyAdminUser` Bearer flow | none | **reuse as-is** | Firebase ID tokens work identically from `@react-native-firebase/auth`. This is the pattern mobile should use everywhere. |
| `lib/rate-limit.ts` in-memory Map | Node process memory | rewrite | Per-instance state; mobile traffic makes the weakness worse. Needs a shared store. |
| `/api/gallery/local-assets` (fs read/delete) | Node `fs` + Vercel filesystem | **rewrite** | Serverless disk is ephemeral and read-only in practice; mobile cannot rely on it. Move to Blob/Storage and expose URLs. |
| `/api/ai/knowledge/import` (reads `seed/ai/*.json` from `process.cwd()`) | Node `fs` + bundled repo files | rewrite | Bundle path assumptions break in any other deployment target. |
| `/api/admin/receipts/[id]/pdf` (returns a PDF stream) | `Buffer`, `Content-Disposition: inline` | adapt | RN cannot render `inline` PDFs from a fetch; return a signed URL, or let the client download to the filesystem. |
| `/api/reports/save` base64 body, `maxDuration=60` | Vercel function config | adapt | Large base64 bodies over mobile networks need chunked/direct-to-Blob upload. |
| Responses without an envelope (bare arrays, mixed keys) | none | adapt | A typed mobile client needs one predictable shape; see M12-F27. |
| No CORS/`OPTIONS` handlers | browser same-origin policy | adapt | RN is not subject to CORS, but a future web client on another origin is. |
| Cookies/session | not used by any route | n/a | The API is stateless and token-based already - good for mobile. |

**What a React Native client would need from this module.** The good news: the transport is already
plain JSON over HTTP with no cookies, no CSRF tokens and no RSC-only surfaces except one server
action, so roughly 90 of 95 endpoints are reusable verbatim. The work is in three places. First,
**coverage gaps**: sevas (only via a server action), the panchanga calendar (`/api/calendar` is
called but missing), the homepage/gallery/content payloads and the whole public site's data are
fetched inside Server Components straight from `services/*`, so there is no endpoint for them -
mobile needs new route handlers wrapping those same services. Second, **auth**: mobile cannot rely
on "the admin UI only shows this button to admins", so every write endpoint must adopt the
`verifyAdminUser` Bearer pattern that only the receipts family uses today. Third, **contract
hygiene**: one response envelope, real pagination, typed errors and shared types exported from
`types/*` so the RN app can consume the same TypeScript definitions - that shared-type reuse is the
single highest-value portability investment in this chunk.

## Coverage

filesExpected 98 (from `.claude/state/inventory/M12.json` `totals.files`; the chunk entry in
`chunks.json` says `expectedFiles: 96` - the inventory count is authoritative and 95 of them are
`route.ts` files).
filesMentioned 98. Every inventory file has at least one row in **Key files**, and every route file
also has a row in **Entry points**. Omitted: none.

Files read to confirm boundaries but not owned (one import level): `lib/auth/admin-auth.ts`,
`next.config.ts`, `services/seva.service.ts` (caller of the server action).

## UNCLEAR

- Whether `/api/calendar` once existed and was deleted, or was never written. The six call sites in
  `app/admin/calendar/*` send POST/PUT/DELETE bodies that imply a full CRUD route. Settled by
  checking deployment logs or the hosting provider's route list - there is no git history here
  (this working copy is not a git repository).
- Whether `/api/admin/users/create-admin` and `/api/admin/users/set-role` are still deployed in
  production. `docs/API.md:169-181` publishes working cURL examples against
  `https://rayaramathaynk.vercel.app`, which suggests yes. Settled by an authenticated check of the
  Vercel deployment; not done here (no network writes allowed in this run).
- Whether `ADMIN_API_KEY` is actually set in the production environment. If it is not, the
  `/api/admin/prompts` gate is open there too. Settled by reading the Vercel env var list.
- Whether the AI settings live in `ai_settings/RayaAI` or `ai_settings/%20RayaAI`. The seeder writes
  the encoded name (`app/api/seed-ai-settings/route.ts:547`) while `lib/ai/ai-settings` (M08) reads
  by its own constant. Settled by reading M08's document path constant against a Firestore dump.
- Which of the 36 unreferenced endpoints (see M12-F44) are consumed by anything outside this
  repository. Grep only proves nothing in-repo calls them.

## Verification log (2026-09-19)

Method: every `path` and `path:line` citation in this file extracted by script and checked for
existence and line-number range (247 distinct citations, 0 broken, 0 out of range - the only
non-existent paths cited are deliberate globs and `middleware.ts`, which is cited *as absent*);
30 factual claims re-opened against the code; all 42 original findings re-checked at their cited
lines; the 98-file inventory diffed against the file mentions (0 unmentioned).

- Consumer tree listed 8 call sites and said "public pages mostly do not use these routes" ->
  now lists all 30 verified call sites split into public / admin / tests-only, and states the
  measured fact instead -> `grep -rnoE 'fetch\(("|\`)/api/...' app components hooks services`.
- "Endpoints ... have no in-app caller at all - only Playwright specs" was wrong for three of the
  named endpoints -> `/api/bookings`, `/api/dashboard/daily-spiritual` and `/api/supabase-check`
  have **no** reference anywhere, tests included -> `.claude/state/verify/_M12_callers.js` -> 36
  unreferenced endpoints, new finding M12-F44.
- Pipeline C headed "10 files under `/api/ai/settings`" -> now 9, with the note that the same
  `x-user-id` pattern adds 3 `/api/admin/prompts` files -> `find app/api/ai/settings -name route.ts`
  -> 9.
- M12-F17 said `x-user-id` is read by "13 AI routes" -> now 11 route files, 8 under
  `/api/ai/settings` (not `unknown-questions`) plus 3 under `/api/admin/prompts` ->
  `grep -rl x-user-id app/api` -> 11.
- M12-F14 said `docs/API.md` documents 3 endpoints -> now 4 endpoints across 3 route files; the
  gallery DELETE at `docs/API.md:135` was missed -> `grep -n "^\*\*Endpoint" docs/API.md` -> 4.
- M12-F23 said 24 of 95 route files use `any` -> now 25, with the exact grep as evidence ->
  `grep -rlE ":\s*any\b|<any>|as any|\bany\[\]" app/api | wc -l` -> 25.
- M12-F35 cited the clean document name at `:622` -> corrected to `:621`, and the two write sites
  labelled POST/GET -> `sed -n '621p' app/api/seed-ai-settings/route.ts` -> `"ai_settings/RayaAI",`.
- M12-F13 cited zod only at `docs/SECURITY.md:315-345` -> added `:302` where the doc names Zod
  explicitly -> `grep -n Zod docs/SECURITY.md` -> `302:// Using Zod schemas`.
- M12-F07 and M12-F09 had endpoint-only evidence -> added the real callers, so both read as shipped
  features rather than orphan routes -> `components/admin/gallery/LocalGalleryAssets.tsx:47`,
  `app/(public)/receipts/page.tsx:53`.
- Added M12-F43: the AI analytics console is a public page -> `app/(public)/ai/analytics/page.tsx:294`
  fetching the unauthenticated `/api/ai/analytics`, with no guard in the page or
  `app/(public)/layout.tsx` (18 lines, no auth).
- Added M12-F44 (36 endpoints with no reference anywhere) and M12-F45 (the Playwright API-contract
  suite asserts 200 on `/api/sevas`, `/api/admin/events`, `/api/auth/login`, `/api/health`,
  `/api/v1/events` - none of which exist) -> `tests/e2e/sprint5/api-contract.spec.ts:52-53`.
- Confirmed unchanged and correct at their cited lines: the 95/24/22/49 route and table-row counts,
  all five `verifyAdminUser` files, the 88-of-95 arithmetic, the two `runtime = 'nodejs'` routes and
  the absence of any edge route, the single `"use server"` file, all 13 import counts in
  Cross-module dependencies, and findings F01-F06, F08, F10-F12, F15, F16, F18-F22, F24-F34,
  F36-F42 at the exact lines cited.
