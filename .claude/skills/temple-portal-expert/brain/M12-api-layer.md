# M12 - API routes and server actions - the full HTTP surface
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against `424fdb8` (see Refresh log). Verify against the code before acting on any claim.

## Answers questions about

- "what HTTP endpoints does this app actually expose?" - all 97 `route.ts` files, one table row each
- "which endpoints are protected and which are wide open?" - 21 route files verify a Firebase ID token (5 on 2026-09-19); 76 check nothing
- "how do I add a new API route?" - the four house patterns and which one to copy
- "how does the admin UI authenticate to the API?" - `Authorization: Bearer <idToken>` (attached by `hooks/useAdminFetch.ts` or the receipt services) -> `verifyAdminUser` / `requireAdminUser`
- "where is rate limiting applied?" - `lib/rate-limit.ts`, used by exactly 2 routes; `/api/chat` has its own copy
- "what validation runs on a POST body?" - hand-rolled `if (!x)` checks; zod appears in zero route files (its only use is the server action `app/actions/settings.ts:8`)
- "which endpoints write to Firestore without authentication?" - the F-table below (many)
- "why do `/api/quotes` and `/api/admin/quotes` both exist?" - the duplicate-family map
- "what is `/api/seed-ai-settings` and is it safe?" - since 2026-10 it is an admin-guarded, idempotent repair of the Supabase `ai_settings` row; F03/F04 are fixed
- "where do the AI settings live now?" - Supabase table `ai_settings`, row `main` (plus `unknown_questions`), not Firestore - Data flow 4 and 5
- "what is `/api/ai/health`?" - admin-only read-only probe used by `app/admin/ai/health/page.tsx:73`
- "what does the chat widget fetch before the first message?" - `GET /api/ai/public-settings` -> `{welcome}` (`components/ai/AIChatProvider.tsx:78`)
- "why does saving site settings always fail?" - M12-F46 (the server action never sees a bearer token)
- "why does creating a quote return 401?" - M12-F47 (half-guarded `/api/admin/quotes`)
- "why can't I edit, delete or roll back a prompt in the AI console?" - M12-F51 (page/route contract mismatch)
- "does the mobile app use this API?" - only `POST /api/chat`; everything else it reads from Supabase directly - Portability notes
- "what is `/api/calendar`?" - the admin calendar pages call it; the route does not exist
- "what response shape does endpoint X return?" - the response column; there is no single envelope
- "which routes are `force-dynamic`, which are cached, which set `revalidate`?"
- "edge or node runtime?" - two routes pin `nodejs`, the rest are default node; no edge routes
- "what would a React Native app be able to call?" - the portability section
- "what data does the public web expose that it should not?" - `/api/public/receipts`, `/api/volunteer` GET
- "where are the server actions?" - two files, `app/actions/sevas.ts` and `app/actions/settings.ts` (added 2026-10)
- "what does `vercel.json` configure?" - only `Cache-Control` for `/data/panchanga/*`
- "how do errors come back?" - `{ error: string }` or `{ success: false, error }`, inconsistently
- "which endpoints are dead / stubs / placeholders?" - `receipts/[id]/send`, parts of `admin/content`
- "does docs/API.md describe the API?" - it describes 4 endpoints in 3 of the 97 route files

## Purpose and business role

M12 is the HTTP boundary of the temple portal. Everything a browser or an external client can
reach without rendering a page lives here: `app/api/**/route.ts` (97 Next.js App Router Route
Handlers), two server action files (`app/actions/sevas.ts`, `app/actions/settings.ts`), the in-memory rate limiter
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

The load-bearing weakness of the whole module is authentication. 76 of 97 route files perform no
identity check of any kind (88 of 95 on 2026-09-19), including routes that create super-admins,
delete files, mutate events/donations/bookings and return devotee PII. The October 2026 Raya AI
hardening closed the AI-settings family and the seeder; nothing outside the AI, quotes, aaradhane
and receipts areas changed.

## Code roots

```
app/api/**/route.ts        97 Route Handlers (owned)
app/actions/sevas.ts       "use server" - seva catalogue reads (Supabase)
app/actions/settings.ts    "use server" - site settings create/update (Supabase, zod) - added 2026-10
lib/rate-limit.ts          in-memory fixed-window limiter (shared with M01)
vercel.json                header rules for /data/panchanga/*
```

Adopted from the Unassigned list: none. Every M12 file except `lib/rate-limit.ts` and the two
`app/actions/*` files is co-claimed by a domain chunk (M04-M11, M14) - see
`.claude/state/inventory/SUMMARY.md`. M12 owns the *HTTP contract*; the co-owner owns the business
logic behind it.

## Entry points

There is no `middleware.ts` in the repository (`ls middleware.ts` -> not found). Its Next.js 16
replacement `proxy.ts` (121 lines, unchanged since 2026-07) does run on every path, `/api/*`
included, but performs no auth: it sets security headers and logs a `page_views` row for non-API
GETs (`proxy.ts:83-120`). So **no route is protected by middleware/proxy**. `next.config.ts:55-62`
also applies security headers to `/:path*`.

Auth column legend:
- **none** - no identity check at all
- **admin(token)** - `verifyAdminUser(request)` (`lib/auth/admin-auth.ts:186`, returns user or null) or `requireAdminUser(request)` (`:198`, returns a ready `NextResponse` `{error, reason}` with 401/403/503); both wrap `verifyAdminUserResult` (`:50`): Firebase ID token + Firestore `users/{uid}`, rejects inactive users and roles `devotee`/`volunteer` (`:39`)
- **partial** - some methods in the file are admin(token), the others are none
- **apikey?** - `verifyAdmin()` local helper, only enforced when `NODE_ENV==="production"` **and** `ADMIN_API_KEY` is set (`app/api/admin/prompts/route.ts:12-21`)
- ~~**fake**~~ - removed 2026-10 - see Refresh log: the seeder's never-failing helper was replaced by `requireAdminUser` (`app/api/seed-ai-settings/route.ts:68`)

### Admin domain - `/api/admin/*` (24 files)

| Route | Methods | Auth | Validation | Calls | Store | Response | Cache |
|---|---|---|---|---|---|---|---|
| `/api/admin/aaradhane` | GET, POST | **admin(token)** (`route.ts:11,37`, since `da7a1fc`) | none (body cast to `Omit<Aaradhane,...>`) | `aaradhaneService.getAaradhanes/createAaradhane` | aaradhane (M14) | `{success,data,count}` / `{success,id}` 201 | default |
| `/api/admin/aaradhane/[id]` | GET, PUT, DELETE | none | none | `aaradhaneService.getAaradhaneById/update/delete` | aaradhane | `{success,data}` / `{success,message}` | default |
| `/api/admin/analytics` | GET, POST | none | POST checks 4 fields (`route.ts:49`) | `getAnalyticsSummary`, `logIntentFeedback` | analytics (M10) | `{success,data,timestamp}` | default |
| `/api/admin/content` | GET, POST | none | per-action field checks | `content.service` autoTag/freshness/related | in-memory only | `{success,...}`; `freshness`/`review` GET return **placeholder text** (`route.ts:46-71`) | default |
| `/api/admin/knowledge` | GET, POST | none | POST requires `title` | `getDocuments`/`addDocument` (`lib/firebase-admin-rest`), `SEED_ARTICLES` | `knowledge` | `{success,articles,count,firestoreCount,seedCount}` | `dynamic="force-dynamic"` |
| `/api/admin/knowledge/[id]` | GET, PUT, DELETE | none | none | `getArticleById`, `updateDocument`, `deleteDocument` | `knowledge` | `{success,article}` / `{success,message}` | `force-dynamic` |
| `/api/admin/prompts` | GET, POST, PUT | apikey? on all; POST/PUT **also** admin(token) (`route.ts:63,113`) - GET is apikey?-only | POST requires `content`; PUT requires `versionId` | `aiSettingsService` prompt CRUD | Supabase `ai_settings` (prompt) | `{success,versions,currentPrompt,...}` | default |
| `/api/admin/prompts/[id]` | GET, DELETE | **partial**: DELETE admin(token) (`route.ts:52`); GET none | existence check | `aiSettingsService.getPromptVersions/updatePromptVersion` | Supabase `ai_settings` (prompt) | `{success,data}`; DELETE **archives**, does not delete (`route.ts:80-81`) | default |
| `/api/admin/prompts/[id]/publish` | POST | **admin(token)** (`route.ts:18`) | existence check | `aiSettingsService.publishPromptVersion` | Supabase `ai_settings` (prompt) | `{success,message,currentPrompt,versions}` | default |
| `/api/admin/quotes` | GET, POST, PATCH, DELETE | **partial**: POST admin(token) (`route.ts:47`); GET, PATCH, DELETE none | POST requires title/category/source; PATCH+DELETE require `ids[]` | `quoteService` CRUD + `clearCache` | quotes (M10) | `{quotes,total}` / `{id,message}` / `{updated,errors}` | default |
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

### Raya AI domain - `/api/ai/*` (24 files)

Auth: **admin(token)** via `requireAdminUser` on the 9 `/api/ai/settings/**` files and `/api/ai/health`
(10 files, since `d235868`/`8d54714`, pinned by `tests/unit/ai-api-auth-wiring.test.ts`); **none** on
the other 14. Store: since `fae5d51` (2026-10-06) every `ai_settings` store below is the **Supabase**
table `ai_settings`, row `main`, and unknown questions are the Supabase table `unknown_questions`
(`lib/ai/ai-settings/repository.ts:31,43,412`); AI analytics read Supabase `ai_latency_records` /
`ai_intent_distribution` / `unknown_questions` (`services/ai-analytics.service.ts:325,372,422`). Firestore is **not** gone from
the analytics half (corrected 2026-10-18 verify): `getTokenUsage` reads the Firestore token-usage collection
(`services/ai-analytics.service.ts:279,289`), `getAnalyticsDashboard` counts Firestore chat sessions and messages (`:623,635`)
and `getAnalyticsSettings` reads Firestore `ai_settings` (`:64`), all through the client SDK (`:17-18`). Only the settings
half (`/api/ai/settings/**`, `/api/ai/health`, `/api/ai/public-settings`, the seeder) is Supabase-only.

| Route | Methods | Validation | Calls | Store | Response | Cache |
|---|---|---|---|---|---|---|
| `/api/ai/analytics` | GET | none | `getAnalyticsDashboard(start,end)` | Supabase latency/intent/unknown + **Firestore** session/message counts and token usage (`services/ai-analytics.service.ts:623,635`) | dashboard object | default |
| `/api/ai/analytics/health` | GET | none | `checkAIHealth()` | - | `{status,...}` | default |
| `/api/ai/analytics/intent-distribution` | GET | none | `getIntentDistribution` | ai analytics | service object | default |
| `/api/ai/analytics/latency` | GET | none; `intent` filter dropped 2026-10 (`route.ts:14`, `64fc607`) | `getLatencyMetrics` | Supabase `ai_latency_records` | service object | default |
| `/api/ai/health` | GET | **admin(token)** (`route.ts:39`); no input | `aiAdminRepository.getSettings()` - read-only, never seeds | Supabase `ai_settings` | `{database:{connected,message},settings:{hasMainRecord,present{7 sections}},timestamp}`; **200 even when the datastore is down** (`route.ts:83`) | `force-dynamic`, `no-store` - added 2026-10-15 `8d54714` |
| `/api/ai/analytics/token-usage` | GET | none | `getTokenUsage` | **Firestore** token usage, client SDK (`services/ai-analytics.service.ts:279`) | service object | default |
| `/api/ai/analytics/unknown-questions` | GET, PATCH | PATCH requires `questionId`,`reviewedBy` | `getUnknownQuestions`, `markUnknownQuestionReviewed` | unknown_questions | service object / `{success}` | default |
| `/api/ai/knowledge/coverage` | GET | none | direct `getDocs(collection(db,"knowledge"))` (**client SDK**) | `knowledge` | `{success,data:{coverage,summary}}` | default |
| `/api/ai/knowledge/import` | POST | none | reads `seed/ai/*.json` from disk, `setDoc` (**client SDK**) | `knowledge` | `{success,data:{imported,skipped,errors}}` | default |
| `/api/ai/multi-source/overview` | GET | none | `getTempleOverview()` | multi-source (M08) | service object | default |
| `/api/ai/multi-source/query` | POST | requires `query` | `executeMultiSourceQuery`, `addToQueryHistory` | multi-source + in-memory history | service object | default |
| `/api/ai/multi-source/quick-queries` | GET | none | `QUICK_QUERIES`, `getIntentSuggestions()` | constants | `{quickQueries,intentSuggestions}` | default |
| `/api/ai/multi-source/statistics` | GET | none | `getRetrievalStats/getDataFreshness/getQueryHistory` | in-memory | `{statistics,freshness,recentQueries}` | default |
| `/api/ai/multi-source/today` | GET | none | `getTodayInfo()` | multi-source | service object | default |
| `/api/ai/public-settings` | GET | none (public by design) | `aiSettingsService.getAIResponses()` | Supabase `ai_settings` | `{welcome}` only (`route.ts:8-10`) | default, no cache header - added 2026-10-14 `3446b0b` |
| `/api/ai/settings` | GET, POST | POST requires `action` | `aiSettingsService` 9 actions (`route.ts:47-79`): `updateGeneralSettings`, `updateSafetySettings`, `updateExtendedBehaviorSettings` (added 2026-10) + 6 older incl. `resetToDefaults` | Supabase `ai_settings` | settings object | default |
| `/api/ai/settings/ai-behavior` | GET, PUT | PUT switches on `setting`; `all` rebuilds a typed `AIBehaviorSettings` with defaults (`route.ts:46-58`) | confidence/debug/streaming setters | Supabase `ai_settings` | behavior object | default |
| `/api/ai/settings/ai-responses` | GET, PUT | none | `updateResponseTemplate` / `updateAIResponses` | `ai_settings` | responses object | default |
| `/api/ai/settings/intents` | GET, POST, PUT, DELETE | POST requires `name`; PUT/DELETE require `intentId` | `aiSettingsService` intent CRUD | `ai_settings/intents` | `{intents}` / `{message}` | default |
| `/api/ai/settings/policies` | GET, PUT | PUT switches on `section` | donation/80G/seva policy setters | `ai_settings` | policies object | default |
| `/api/ai/settings/prompts` | GET, POST, PUT | POST requires `content`; PUT requires `versionId` | prompt version CRUD | `ai_settings/prompts` | `{versions,currentPrompt,...}` | default |
| `/api/ai/settings/temple-information` | GET, PUT | PUT switches on `section` | timings/contact/officeHours setters | Supabase `ai_settings` | info object | `dynamic="force-dynamic"`, `Cache-Control: no-store` (`route.ts:11,21`; was `revalidate=3600` + `s-maxage=3600`) |
| `/api/ai/settings/unknown-questions` | GET, POST, PUT, DELETE | POST requires `question`; PUT/DELETE require `questionId` | log/assign/resolve/update/delete | unknown_questions | `{questions}` / `{message}` | default |
| `/api/ai/settings/visitor-information` | GET, PUT | PUT switches on `section` (8 sections) | visitor info setters | `ai_settings` | info object | default |

### Public / devotee domain (rest of the tree) - every one is auth: **none** except `/api/seed-ai-settings` (admin(token) since 2026-10)

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
| `/api/seed-ai-settings` | POST (GET removed) | **admin(token)** via `requireAdminUser` (`route.ts:68`); no body | `getDefaultSeedPayload` (`lib/ai/ai-settings/seed-data.ts`) + `createAdminClient()` (Supabase service role): inserts row `main` if absent, else fills only empty sections (`route.ts:94-148`) | Supabase `ai_settings` | `{ok,outcome,message,sections}`, each section `initialized`/`already_present`/`repaired`/`skipped`/`failed` | `force-dynamic` - rewritten 2026-10 (`fae5d51`, `8d54714`) |
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
| `"use server"` module (added 2026-10) | `app/actions/settings.ts` | `createSettingsAction`, `updateSettingsAction` | `checkAdminAuth` + `isUserAdmin` from `lib/auth/admin.ts` (Bearer token read from `headers()`, `ADMIN_API_KEY` bypass as `api-admin`, `:26-36`) - see M12-F46 | Supabase `site_settings` via `createAdminClient()`; zod schemas `:10-20` |

`sevas.ts` is called only from `services/seva.service.ts:4` (M10); `settings.ts` only from
`services/settings.service.ts:70,75` (dynamic import), whose caller is the client page
`app/admin/settings/page.tsx:69,71`. Neither is the single Supabase entry point any more: AI
settings, AI analytics and site settings all read Supabase now (M08/M10).

## Component trees

API routes have no JSX. The equivalent structures are the **request pipelines** (what a handler
composes) and the **consumer trees** (which client components call which endpoint).

### Pipeline A - the unauthenticated service pass-through (about 60 of 97 files)

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
`app/api/temple-areas/route.ts`, the analytics/multi-source/knowledge half of `app/api/ai/**`.

### Pipeline B - the authenticated pipeline (5 billing files on 2026-09-19; 21 files now)

```
Route Handler (server)  app/api/admin/receipts/route.ts
├── verifyAdminUser(request)                     lib/auth/admin-auth.ts:186  (or requireAdminUser :198)
│   └── verifyAdminUserResult(request)           :50
│       ├── read "authorization: Bearer <idToken>"   :53
│       ├── getAuth(adminApp).verifyIdToken()        :80      firebase-admin  [M04]
│       ├── users/{uid} lookup, isActive, role       :121-156
│       └── {ok:false, reason, status 401|403|503}  -> null / NextResponse
├── validateReceiptSevaInput / createReceiptWithAdmin   lib/receipt/*   [M07/M14]
├── getAdminFirestore()                          lib/admin-firebase.ts   [M10]
└── NextResponse.json({success, ...})
```
Used by: `admin/receipts`, `admin/receipts/[id]`, `admin/receipts/[id]/pdf`,
`admin/receipt-sevas`, `admin/receipt-sevas/[id]` (with `verifyAdminUser`); since 2026-09-20/10-15
also `admin/aaradhane`, `admin/prompts` (POST/PUT), `admin/prompts/[id]` (DELETE),
`admin/prompts/[id]/publish`, `admin/quotes` (POST only) with `verifyAdminUser`, and the 9
`ai/settings/**` files, `ai/health` and `seed-ai-settings` with `requireAdminUser` -
`grep -rlE "verifyAdminUser|requireAdminUser" app/api` -> 21.
Client side the token comes from `services/receipt.service.ts`, `services/receiptSeva.service.ts`
and, for the AI console, `hooks/useAdminFetch.ts` (`:66,77`, used by 8 `app/admin/ai/**` pages). The
quotes admin pages still call plain `fetch` with no header (M12-F47). The aaradhane admin pages never call
`/api/admin/aaradhane` at all - they use `services/aaradhane.service.ts` directly (`app/admin/aaradhane/page.tsx:14`).

### Pipeline C - the AI settings fan-out (9 files under `/api/ai/settings`)

`find app/api/ai/settings -name route.ts` -> 9. Until 2026-09-20 these and the 3 `/api/admin/prompts`
files took their audit identity from an `x-user-id` header; now it is the verified uid
(`grep -rl x-user-id app/api` -> 0).

```
Route Handler (server)  app/api/ai/settings/<area>/route.ts
├── guard = requireAdminUser(request); if (!guard.ok) return guard.response
├── userId = guard.user.uid                                   <- verified (was x-user-id header)
├── switch (body.section | body.setting | body.action)
│   └── aiSettingsService.<setter>(data, userId)   lib/ai/ai-settings/service.ts  [M08]
│       └── Supabase ai_settings row "main"        lib/ai/ai-settings/repository.ts  [M11]
└── re-read the whole area and return it
```

### Pipeline D - the chat endpoint (`app/api/chat/route.ts`, 396 lines)

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
app/(public)/search/page.tsx:78         (client) -> GET /api/search
app/(public)/volunteer/page.tsx:44      (client) -> POST /api/volunteer
components/temple-explorer/TempleExplorer.tsx:46  -> GET /api/temple-areas
components/ai/AIChatProvider.tsx:165,269          -> POST /api/chat            [M09]
components/ai/AIChatProvider.tsx:78               -> GET /api/ai/public-settings   (added 2026-10)
components/home/DailyQuoteWidget.tsx:62           -> GET /api/quotes/today
components/search/GlobalSearch.tsx:92,93          -> /api/search, /api/search/suggestions
components/common/Search/GlobalSearch.tsx:122     -> GET /api/search
components/knowledge/KnowledgeCentreClient.tsx:96 -> GET /api/knowledge/search
components/recommendation/RecommendationsSection.tsx:39 -> GET /api/recommendations
components/ai/AIAnalyticsDashboard.tsx:112        -> GET /api/ai/analytics
components/ai/MultiSourceRetrievalDashboard.tsx:69,70,85,102,116 -> /api/ai/multi-source/*
components/ai/KnowledgeWorkflowDashboard.tsx:413,414,436,456 -> /api/knowledge/workflow/*

ADMIN pages
app/admin/ai/**/page.tsx (client)      -> hooks/useAdminFetch.ts (Bearer) -> /api/ai/settings/*,
                                          /api/ai/knowledge/*, /api/chat (playground/page.tsx:69),
                                          /api/ai/health (health/page.tsx:73),
                                          /api/seed-ai-settings (settings/page.tsx:279)
app/admin/settings/page.tsx:69,71 (client) -> services/settings.service.ts:70,75
                                          -> server action app/actions/settings.ts  ** see M12-F46 **
app/admin/knowledge/page.tsx:97,167,201,222,255 -> /api/admin/knowledge*
app/admin/ai/unknown-questions/page.tsx:223 -> POST /api/admin/knowledge (adminFetch; route ignores the token)
app/admin/ai/page.tsx:48,61, app/admin/ai/knowledge/page.tsx:52,73 -> /api/ai/knowledge/coverage, /import
app/admin/quotes/**/page.tsx (client)  -> /api/admin/quotes*, /api/quotes/preview, /api/quotes/stats
                                          (plain fetch, no token - new/page.tsx:210 POST now 401s, M12-F47)
app/admin/temple-areas/page.tsx:45,71  -> /api/admin/temple-areas*
app/admin/page.tsx:117                 -> GET /api/ai/analytics
app/admin/billing|receipts/** (client) -> services/receipt*.service.ts -> /api/admin/receipts*
                                          (`${BASE_URL}/${id}` and `/pdf`: services/receipt.service.ts:116,131;
                                          receipt-sevas/[id]: services/receiptSeva.service.ts:84)
lib/reports/report-saver.ts:33, scripts/save-report.ts:26 -> POST /api/reports/save   (report-saver has no importer)
components/admin/gallery/LocalGalleryAssets.tsx:47 -> DELETE /api/gallery/local-assets (no in-repo GET caller)
components/admin/settings/homepage/useHomepageForm.ts:91 -> POST /api/revalidate
app/admin/calendar/ekadashi/page.tsx:34,62,80   -> /api/calendar  ** route does not exist **
app/admin/calendar/festivals/page.tsx:31,60,79  -> /api/calendar  ** route does not exist **

MOBILE (apps/mobile, added 2026-09-30)
apps/mobile/app/(tabs)/ai.tsx:44       -> POST ${EXPO_PUBLIC_API_URL}/api/chat  (no sessionId sent)

TESTS ONLY (no product code calls these)
tests/e2e/**                           -> /api/events, /api/announcements, /api/contact,
                                          /api/donations, /api/testimonials, /api/quotes/*,
                                          /api/admin/users/create-admin, /api/reports/list
```
Unit tests now import route handlers directly: `tests/unit/api-ai-health-route.test.ts:18`,
`tests/unit/api-ai-public-settings.test.ts:1`, `tests/unit/seed-ai-settings-route.test.ts`,
`tests/unit/bot-004-action.test.ts:3` (server actions), plus the source-scanning
`tests/unit/ai-api-auth-wiring.test.ts`.

Most *page* data does not come through this layer: public pages render Server Components that
import `services/*` directly, and the routes above are called only from the `"use client"` islands
inside them. Counted with a script (`.claude/state/verify/_M12_callers.js` on 2026-09-19 - that
script is no longer on disk; re-counted 2026-10-18 with an equivalent regex scan of `app`,
`components`, `hooks`, `services`, `lib`, `tests`, `scripts`, `apps/mobile`; verify 2026-10-18 re-ran it and counted the
`${BASE_URL}/${id}` calls in the receipt services), **35 of the 97
endpoints have no reference anywhere in the repository** (both new routes have callers) - not in a component, a service, a hook or
a test (M12-F44). `/api/bookings`, `/api/bookings/[id]`, `/api/dashboard/daily-spiritual`,
`/api/supabase-check`, `/api/announcements/[id]`, `/api/donations/[id]` and `/api/temple-areas/[id]`
are in that set: they are not even exercised by a Playwright spec. Twelve more are referenced *only* by tests:
`/api/events`, `/api/events/[id]`, `/api/announcements`, `/api/donations`, `/api/contact`, `/api/testimonials`,
`/api/quotes`, `/api/quotes/random`, `/api/quotes/search`, `/api/quotes/category/[category]` (all `tests/e2e/**`),
`/api/admin/users/create-admin` (`tests/functional/09_performance_security.spec.ts`) and `/api/reports/list`
(`tests/reports/save-reports.spec.ts`).

## Data flow

### 1. Devotee books a seva (HTTP path)

1. Client `POST /api/bookings` with `{sevaId, preferredDate, ...}`.
2. `POST` in `app/api/bookings/route.ts:14` parses JSON.
3. Guards: `sevaId` present (`:19`), `preferredDate` present (`:22`), date not in the past (`:27-32`).
4. `sevaBookingService.createBooking(body)` - `services/sevaBooking.service.ts` [M10].
5. Writes the `sevaBookings` collection [M11]. No auth, no ownership stamp from the server; the body is spread into the document as-is (including any `userId`), and only `status`, the four payment fields and the timestamps are forced by the service (`services/sevaBooking.service.ts:36`).
6. Returns `201 {id, message}`.
7. Later, the billing desk finds it through `GET /api/public/receipts?search=<phone>` - which is unauthenticated (`app/api/public/receipts/route.ts:6`).

### 2. Admin creates a receipt (the one hardened flow)

1. Admin UI gets a Firebase ID token and calls `POST /api/admin/receipts` with `Authorization: Bearer <token>` (`services/receipt.service.ts`).
2. `verifyAdminUser(request)` (`app/api/admin/receipts/route.ts:149` -> `lib/auth/admin-auth.ts:186` -> `verifyAdminUserResult` `:50`) verifies the token, loads `users/{uid}`, rejects `isActive===false` and roles `devotee`/`volunteer`.
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

1. `PUT /api/ai/settings/temple-information` with `{section:"timings", data:{...}}` and `Authorization: Bearer <idToken>` (via `hooks/useAdminFetch.ts`).
2. `requireAdminUser(request)` (`route.ts:35`); the audit identity is the verified uid (`:38`). Until `d235868` (2026-09-20) it was the client-supplied `x-user-id` header.
3. `aiSettingsService.updateTempleTimings(data, userId)` (`:45`) [M08] writes the Supabase `ai_settings` row `main` (Firestore until `fae5d51`, 2026-10-06).
4. The route re-reads and returns the full temple-information object.
5. The GET is now `force-dynamic` with `Cache-Control: no-store` (`route.ts:11,21`), so an edit is visible at once (until 2026-10-15 `revalidate=3600` + `s-maxage=3600` hid it for up to an hour).

### 5. Someone seeds the AI settings

Rewritten 2026-10 (`fae5d51`, `698a25c`, `8d54714`); the 2026-09-19 version (fake auth, hardcoded API key, Firestore overwrite of 8 documents) is gone - see Refresh log.

1. `POST /api/seed-ai-settings` from the admin AI settings page (`app/admin/ai/settings/page.tsx:279`, via `adminFetch`).
2. `requireAdminUser(request)` (`route.ts:68`) - 401/403/503 with `{error, reason}` on failure.
3. Reads Supabase `ai_settings` where `id = "main"` (`:77-81`) with the service-role client.
4. No row -> inserts `getDefaultSeedPayload("seed")` + `updated_by` (`:94-112`), every section reported `initialized`.
5. Row exists -> for each of 10 section columns (`:37-48`) fills only the empty ones from defaults (`:119-132`), updates them (`:145-148`); populated sections are reported `already_present` and never overwritten.
6. Returns `{ok, outcome, message, sections}`.

### 6. Cache invalidation

1. `POST /api/revalidate {paths:["/", "/events"]}`.
2. `revalidatePath(p)` for each string (`app/api/revalidate/route.ts:26-30`); no allow-list, no auth.
3. With no body array it revalidates `/`.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/api/chat/route.ts` | 396 | Raya AI chat entry (web widget, admin playground, mobile app) | POST, GET | own rate limiter; ~55 lines of commented-out fallback; logs user text + IP |
| `app/api/seed-ai-settings/route.ts` | 174 | idempotent seed/repair of the Supabase `ai_settings` row | POST, `dynamic` | rewritten 2026-10: `requireAdminUser`, never overwrites populated sections; GET removed |
| `app/api/admin/content/route.ts` | 180 | content auto-tag/freshness helpers | GET, POST | `freshness`/`review` GET branches return prose, not data |
| `app/api/admin/receipts/route.ts` | 173 | receipt list + report aggregation + create | GET, POST, `dynamic`, `revalidate` | admin token; `.offset()` paging; `setHours(23,59,999)` bug at `:49` |
| `app/api/ai/knowledge/import/route.ts` | 157 | import `seed/ai/*.json` into `knowledge` | POST | reads disk at runtime; client SDK writes |
| `app/api/admin/prompts/route.ts` | 159 | prompt version admin | GET, POST, PUT | only route with an API-key gate (production only); POST/PUT also `verifyAdminUser` |
| `app/api/admin/quotes/route.ts` | 150 | quote CRUD + bulk ops | GET, POST, PATCH, DELETE | loops per id; no transaction; only POST is guarded |
| `app/api/ai/knowledge/coverage/route.ts` | 144 | category coverage report | GET | 30-entry category list hardcoded at `:7-43` |
| `app/api/ai/settings/unknown-questions/route.ts` | 153 | unknown-question queue | GET, POST, PUT, DELETE | admin-guarded; duplicated by the open `/api/ai/analytics/unknown-questions` |
| `app/api/ai/settings/intents/route.ts` | 144 | intent registry CRUD | GET, POST, PUT, DELETE | `intent_${Date.now()}` id generation `:57`; admin-guarded |
| `lib/rate-limit.ts` | 128 | fixed-window in-memory limiter | `rateLimit`, `getClientIP`, `createRateLimitResponse`, `RateLimitConfig`, `RateLimitResult` | `setInterval` cleanup at `:28`; used by 2 routes |
| `app/api/admin/knowledge/route.ts` | 129 | knowledge admin list/create | GET, POST, `dynamic` | merges Firestore rows with `SEED_ARTICLES` |
| `app/api/admin/knowledge/[id]/route.ts` | 113 | knowledge admin item | GET, PUT, DELETE, `dynamic` | comments say it "bypasses security rules" |
| `app/api/reports/save/route.ts` | 115 | blob upload for reports | POST, `runtime`, `maxDuration` | base64 sniffing at `:62` |
| `app/api/ai/settings/prompts/route.ts` | 117 | prompt versions (twin of `/api/admin/prompts`) | GET, POST, PUT | duplicate of `/api/admin/prompts`; admin-guarded, and the one the admin UI calls |
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
| `app/api/ai/settings/route.ts` | 99 | AI settings umbrella | GET, POST | TODO removed - `requireAdminUser` at `:10,30`; 9 POST actions |
| `app/api/admin/receipts/[id]/pdf/route.ts` | 74 | receipt PDF stream | GET, `dynamic` | fallback temple contact hardcoded `:16-22` |
| `app/api/ai/settings/visitor-information/route.ts` | 78 | visitor info setters | GET, PUT | 8-section switch; admin-guarded |
| `app/api/knowledge/workflow/articles/route.ts` | 72 | workflow article list/create | GET, POST | imports 3 unused functions (`:8-10`) |
| `app/api/volunteer/route.ts` | 70 | volunteer sign-up + **list** | POST, GET | GET returns all requests with phone/email, unauthenticated |
| `app/api/admin/analytics/route.ts` | 71 | admin analytics + intent feedback | GET, POST | doc comment claims a `/feedback` sub-path that does not exist (`:32`) |
| `app/api/ai/settings/temple-information/route.ts` | 76 | temple info | GET, PUT, `dynamic` | now `no-store` (was the only cached AI route); admin-guarded |
| `app/api/admin/receipt-sevas/[id]/route.ts` | 69 | seva catalogue item | PUT, `dynamic` | no GET/DELETE twin |
| `app/api/gallery/local-assets/route.ts` | 63 | local media listing + delete | GET, DELETE | filesystem writes; ephemeral on Vercel |
| `app/api/ai/analytics/unknown-questions/route.ts` | 62 | unknown questions (analytics twin) | GET, PATCH | duplicate domain |
| `app/api/quotes/festival/[festival]/route.ts` | 61 | festival quotes | GET | 15-value enum inline |
| `app/api/testimonials/route.ts` | 60 | testimonial submit/list | POST, GET | imports unused `getPendingTestimonials`, `approveTestimonial` |
| `app/api/knowledge/workflow/comments/route.ts` | 58 | review comments | POST, PATCH | imports unused `getArticleComments` |
| `app/api/ai/settings/ai-behavior/route.ts` | 77 | behavior toggles | GET, PUT | `all` rebuilds a typed object with defaults (`:46-58`); admin-guarded |
| `app/api/contact/route.ts` | 57 | contact form | POST | **stores nothing**; logs the message (`:46`) |
| `app/api/ai/settings/policies/route.ts` | 64 | policy setters | GET, PUT | admin-guarded |
| `app/api/supabase-check/route.ts` | 56 | Supabase health probe | GET | reveals which env vars are set |
| `app/api/bookings/[id]/route.ts` | 56 | booking item | GET, DELETE, PATCH | anyone can cancel any booking |
| `app/api/admin/temple-areas/[id]/route.ts` | 55 | temple area item (admin twin) | GET, PUT, DELETE | duplicate of the public twin |
| `app/api/knowledge/workflow/versions/[id]/route.ts` | 55 | version get/restore | GET, POST | no validation on `articleId`/`restoredBy` |
| `app/api/search/route.ts` | 54 | global search | GET, `dynamic` | imports unused `getSearchSuggestions` |
| `app/api/ai/multi-source/query/route.ts` | 54 | multi-source query | POST | - |
| `app/api/admin/aaradhane/route.ts` | 60 | aaradhane list/create | GET, POST | admin-guarded since `da7a1fc`; `createdBy` is the verified email (was `x-user-email`) |
| `app/api/quotes/category/[category]/route.ts` | 52 | category quotes | GET | 6-value enum inline |
| `app/api/temple-areas/[id]/route.ts` | 52 | temple area item (public) | GET, PUT, DELETE | public route with PUT/DELETE |
| `app/api/admin/prompts/[id]/publish/route.ts` | 55 | publish a prompt | POST | `verifyAdminUser` since `da7a1fc` (was open) |
| `app/api/admin/prompts/[id]/route.ts` | 94 | prompt version item | GET, DELETE | DELETE guarded and archives (`:80-81`); GET open; `(v: any)` at `:20,60` |
| `app/api/announcements/[id]/route.ts` | 50 | announcement item | GET, PATCH, DELETE | - |
| `app/api/donations/[id]/route.ts` | 50 | donation item | GET, PATCH, DELETE | anyone can edit/delete a donation record |
| `app/api/events/[id]/route.ts` | 50 | event item | GET, PATCH, DELETE | - |
| `app/api/quotes/route.ts` | 50 | public quote list | GET | - |
| `app/api/ai/settings/ai-responses/route.ts` | 55 | response templates | GET, PUT | admin-guarded |
| `app/api/ai/public-settings/route.ts` | 18 | public welcome text for the chat widget | GET | added 2026-10-14; returns only `aiResponses.welcome` |
| `app/api/ai/health/route.ts` | 86 | admin AI health probe | GET, `dynamic` | added 2026-10-15; read-only; 200 with `connected:false` on datastore failure |
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
| `app/api/ai/analytics/latency/route.ts` | 31 | latency metrics | GET | `intent` param removed (`:14`); unused `Intent` import remains |
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
| `app/actions/settings.ts` | 117 | site settings server actions (added 2026-10) | `createSettingsAction`, `updateSettingsAction` | zod-validated; auth via `lib/auth/admin.ts` that in-app callers can never satisfy (M12-F46); `updates: any` at `:100` |
| `app/actions/sevas.ts` | 17 | seva server actions | `getAllSevasAction`, `getSevaByIdAction` | Supabase service-role client, no auth |
| `app/api/ai/multi-source/quick-queries/route.ts` | 13 | canned queries | GET | no try/catch |
| `app/api/admin/receipts/[id]/send/route.ts` | 2 | stub | POST | returns `{success:true}` and does nothing |
| `vercel.json` | 23 | platform config | - | only `Cache-Control: no-store` headers for `/data/panchanga/*` |

## Types and stores

**Types imported by route files** (all from M10's `types/`, plus a few from `lib/ai`):
`types/aaradhane.ts` (`Aaradhane`), `types/settings.ts` (`SiteSettingsPayload`, used by `app/actions/settings.ts:4`), `types/ai.ts` (`AIMessage`, `ChatRequest`, `ChatResponse`),
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
| ~~Firestore `ai_settings/*`, `settings/temple`, `settings/contact`, `settings/visitor`~~ | removed 2026-10 - see Refresh log | - |
| Supabase `ai_settings` row `main` | `app/api/seed-ai-settings/route.ts:77-81,96,145-148` (service role) | R/W |
| Supabase `site_settings` | `app/actions/settings.ts:52-63,108-111` (service role) | W |
| Local filesystem `public/images/temple`, `public/videos` | `app/api/gallery/local-assets/route.ts:5,6,32,33,57` | R/W (delete) |
| Local filesystem `seed/ai/*.json` | `app/api/ai/knowledge/import/route.ts:61,85,96` | R |
| Vercel Blob | `app/api/reports/list/route.ts`, `app/api/reports/save/route.ts`, `app/api/storage/videos/route.ts` via `storageService` | R/W |
| Supabase `sevas` table | `app/actions/sevas.ts:6,13` (service-role) | R |
| Firestore `users` (client SDK, via `lib/auth/admin.ts:58-75`) | `app/actions/settings.ts:35` (`isUserAdmin`) | R |
| Next.js data cache | `app/api/revalidate/route.ts:17,28` | W |

Everything else reaches Firestore through `services/*` (M10) - see that chunk for collection
mapping.

## Cross-module dependencies

**M12 imports from** (counts from `.claude/state/inventory/import-graph.json`):

| Target | Chunk | Used by N route files |
|---|---|---:|
| `services/quote.service.ts` | M10 | 15 |
| `lib/ai/ai-settings/index.ts` | M08 | 13 (12 + `ai/public-settings`); `lib/ai/ai-settings/admin-repository.ts` 1 (`ai/health`), `lib/ai/ai-settings/seed-data.ts` 1 (seeder) |
| `services/knowledge-workflow.service.ts` | M09/M10 | 8 |
| `lib/admin-firebase.ts` | M10 | 6 |
| `services/ai-analytics.service.ts` | M08/M10 | 6 |
| `lib/auth/admin-auth.ts` | M04 | 21 (5 on 2026-09-19); `lib/auth/admin.ts` 1 (`app/actions/settings.ts`) |
| `lib/firebase.ts` (client SDK) | M10 | 5 |
| `services/multi-source-retrieval.service.ts` | M08 | 5 |
| `services/temple-areas.service.ts`, `services/knowledge.service.ts` | M10 | 4 each |
| `services/storage.service.ts` | M10 | 3 |
| `lib/receipt/validation.ts`, `lib/receipt/admin.ts`, `lib/receipt/pdf.ts` | M07/M14 | 2/1/1 |
| `lib/firebase-admin-rest.ts` | M10 | 2 |
| `services/{announcement,sevaBooking,donation,event,search,chat}.service.ts` | M10 | 2 each |
| `lib/supabase/{admin,server}.ts` | M11 | 4/1 (admin: `sevas.ts`, `settings.ts`, `seed-ai-settings`, `supabase-check`) |
| `services/{aaradhane,analytics,content,conversation,ux,daily-spiritual,recommendation}.service.ts` | M10/M14 | 1 each |
| `lib/ai/{index,provider,settings,firebaseChat,knowledge/*,intent/types}` | M08 | 1-2 each |
| `lib/rate-limit.ts` | M12 (own) | 2 |
| `next/cache` `revalidatePath` | framework | 1 |

**Who imports M12:** `services/seva.service.ts:4` -> `app/actions/sevas.ts` and
`services/settings.service.ts:70,75` -> `app/actions/settings.ts`. No application module imports a
route file; since 2026-10 four Jest unit tests import a route or action and a fifth (`tests/unit/ai-api-auth-wiring.test.ts`) reads 11 route sources as text (see the consumer tree), so handler signatures are
now test-pinned. Everything else couples over HTTP from client components, the mobile app
(`/api/chat` only) and Playwright specs.

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
2. `import { requireAdminUser } from "@/lib/auth/admin-auth";` (preferred since 2026-10; it returns the right 401/403/503 with a `reason`) - or `verifyAdminUser` plus the `unauthorized()` helper from `app/api/admin/receipts/route.ts:12-14`.
3. First line of **every** handler, GET included: `const guard = await requireAdminUser(request); if (!guard.ok) return guard.response;` (pattern: `app/api/ai/settings/route.ts:10-11`). Guarding only POST leaves the family half-open (M12-F47).
4. Add `export const dynamic = "force-dynamic"; export const revalidate = 0;` - an admin list must never be cached.
5. Validate the body in `lib/<domain>/validation.ts` and call it before touching the store (pattern: `lib/receipt/validation.ts` used at `app/api/admin/receipt-sevas/route.ts:65`).
6. On the client, call it through `hooks/useAdminFetch.ts` (`adminFetch`) or a service that attaches the ID token like `services/receipt.service.ts`; a plain `fetch` without the header will 401.
7. Add the file to `PROTECTED_ROUTES` in `tests/unit/ai-api-auth-wiring.test.ts` if it is an AI route.

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
3. Import it only from a service or a Server Component. Note `app/actions/sevas.ts` uses `createAdminClient()` (service-role) with no caller check - do not copy that part. Do not copy `app/actions/settings.ts`'s check either: it looks for a Bearer header, which a browser-invoked server action never carries (M12-F46). Verify identity from a session cookie, or pass the ID token as an argument and verify it with `firebase-admin`.
4. A server action is **not** reachable from a React Native client. If mobile needs it, write a route handler too.

## Faults, smells and risks

| id | sev | what | evidence | direction |
|---|---|---|---|---|
| M12-F01 | HIGH | **STILL OPEN (2026-10-18).** `POST /api/admin/users/create-admin` is unauthenticated and creates a Firebase Auth user with `role: "super_admin"`. Any internet caller can mint an administrator (5/min). | `app/api/admin/users/create-admin/route.ts:7` (no auth), `:62` create, `:70` `role:"super_admin"` | Require `verifyAdminUser` + `super_admin` role, or delete the route and use a CLI script. |
| M12-F02 | HIGH | **STILL OPEN (2026-10-18).** `POST /api/admin/users/set-role` is unauthenticated and sets any user's role, `super_admin` included. Straight privilege escalation. | `app/api/admin/users/set-role/route.ts:6`, valid roles at `:54`, write at `:79` | Same as F01. |
| M12-F03 | HIGH | **FIXED (2026-10-18)** by `fae5d51` + `8d54714`: the helper is gone; POST now starts with `requireAdminUser` (`app/api/seed-ai-settings/route.ts:68`) and only fills empty sections. Was: `/api/seed-ai-settings` auth helper can never fail: returns an admin immediately in production and `dev-admin` otherwise, so the 401 is dead code. POST overwrites 8 settings documents. | 2026-09-19 snapshot lines 119-121, 139, 543, 547-610 of the 723-line file; now `app/api/seed-ai-settings/route.ts:68` | Delete the route or gate it behind `verifyAdminUser` + `super_admin`. |
| M12-F04 | HIGH | **FIXED (2026-10-18)** by `fae5d51`: the 174-line rewrite has no Firestore REST fallback and no key literal (`grep -n AIza app/api/seed-ai-settings/route.ts` -> 0). Was: Firebase Web API key hardcoded as a fallback literal in source. | 2026-09-19 snapshot line 63; gone from `app/api/seed-ai-settings/route.ts` | Remove the literal; fail closed when the env var is missing. |
| M12-F05 | HIGH | **STILL OPEN (2026-10-18)**, narrower: 76 of 97 route files now have no identity check; 21 call `verifyAdminUser`/`requireAdminUser` (`grep -rlE "verifyAdminUser\|requireAdminUser" app/api` -> 21), the fake gate is gone, the apikey gate remains. Was: 88 of 95 route files perform no identity check. Only 5 call `verifyAdminUser`; 1 has a conditional API-key gate; 1 has the fake gate. | `grep -rlE "verifyAdminUser\|requireAdminUser" app/api` -> 21 files (5 on 2026-09-19); `find app/api -name route.ts \| wc -l` -> 97 | Add a route-group convention (`/api/admin/*` guarded by a shared wrapper) or reintroduce `middleware.ts`. |
| M12-F06 | HIGH | **STILL OPEN (2026-10-18).** `/api/admin/aaradhane` list/create is now guarded, but `[id]` PUT/DELETE and `/api/admin/quotes` PATCH/DELETE are still open (see M12-F47). Unauthenticated writes to core business data: `POST/PATCH/DELETE` on events, announcements, donations, bookings, temple-areas (both public and admin twins), aaradhane, quotes. | `app/api/events/[id]/route.ts:21,37`; `app/api/donations/[id]/route.ts:21,37`; `app/api/bookings/[id]/route.ts:21`; `app/api/temple-areas/[id]/route.ts:23,39`; `app/api/admin/aaradhane/[id]/route.ts:40,67` | Guard all non-GET handlers; keep GET public where the data is public. |
| M12-F07 | HIGH | **STILL OPEN (2026-10-18).** `DELETE /api/gallery/local-assets` deletes files from disk with no auth (path prefix check only), and it is a live feature - the admin gallery component calls it. | `app/api/gallery/local-assets/route.ts:38,47,57`; caller `components/admin/gallery/LocalGalleryAssets.tsx:47`; `docs/API.md:135` publishes the cURL | Add admin auth; on Vercel the write is ephemeral anyway - move media to Blob. |
| M12-F08 | HIGH | **STILL OPEN (2026-10-18).** Unauthenticated bulk data mutation: `POST /api/admin/quotes/seed`, `POST /api/ai/knowledge/import` (writes every `seed/ai/*.json` into `knowledge`), `POST /api/admin/quotes/bulk`. | `app/api/admin/quotes/seed/route.ts:10`; `app/api/ai/knowledge/import/route.ts:50,116`; `app/api/admin/quotes/bulk/route.ts:11` | Guard; make import idempotent and admin-only. |
| M12-F09 | HIGH | **STILL OPEN (2026-10-18).** `GET /api/public/receipts` returns devotee PII (phone, email, payment reference, amounts) for any substring, unauthenticated. | `app/api/public/receipts/route.ts:6,28,44-64`; it is shipped as a public page - `app/(public)/receipts/page.tsx:53` | Require the full booking id or an OTP; never return email+phone together. |
| M12-F10 | HIGH | **STILL OPEN (2026-10-18).** `GET /api/volunteer`, `GET /api/bookings`, `GET /api/donations` return the whole collection unauthenticated, including contact details. | `app/api/volunteer/route.ts:58`; `app/api/bookings/route.ts:4`; `app/api/donations/route.ts:4` | Guard the list handlers; scope by the authenticated user for devotee use. |
| M12-F11 | MEDIUM | **STILL OPEN (2026-10-18).** `POST /api/revalidate` purges arbitrary paths with no auth or allow-list - trivial cache-thrash DoS. | `app/api/revalidate/route.ts:10,26-30` | Require a shared secret header, or an allow-list of paths. |
| M12-F12 | MEDIUM | **STILL OPEN (2026-10-18).** Still 2 of 97 routes (`grep -rln lib/rate-limit app` -> 2). Rate limiting exists on 2 of 95 routes, and the store is a per-instance `Map`, so on serverless the limit multiplies by instance count. `/api/chat` reimplements the same thing separately. | `lib/rate-limit.ts:11`, importers = 2 files; `app/api/chat/route.ts:29-51` | Move to a shared store (Redis/Upstash); apply to every write route. |
| M12-F13 | MEDIUM | **STILL OPEN (2026-10-18).** zod is now used once, in the server action `app/actions/settings.ts:8`, still 0 times under `app/api`; `proxy.ts` exists but performs no auth. Documented security controls do not exist: `docs/SECURITY.md` shows an Upstash Redis limiter and a per-endpoint limit table, zod server-side validation, and a `middleware.ts` authorization gate. None are in the repo. | `docs/SECURITY.md:418-453` (Upstash), `:302` ("Using Zod schemas") and `:315-345` (the `safeParse` example), `:110-130` (middleware); `grep -rn zod app/api` -> 0 hits; `ls middleware.ts` -> missing | Either implement them or mark the doc as aspirational. |
| M12-F14 | MEDIUM | **STILL OPEN (2026-10-18).** Still 4 endpoints in 3 of 97 route files; `docs/API.md` unchanged since the snapshot. `docs/API.md` documents 4 endpoints across 3 of the 95 route files and is otherwise the only API reference; it publishes working cURL for the two unauthenticated user-management endpoints against the production host. | `docs/API.md:12` (create-admin), `:55` (set-role), `:106` (gallery GET), `:135` (gallery DELETE), `:169-181` (cURL) vs 95 route files | Generate the reference from the route table in this file. |
| M12-F15 | MEDIUM | **STILL OPEN (2026-10-18)**, evidence MOVED to `app/api/admin/prompts/route.ts:107` and `app/api/ai/settings/prompts/route.ts:72`. Both prompt twins are now guarded, but `/api/ai/settings/unknown-questions` is guarded while its twin `/api/ai/analytics/unknown-questions` is open, and the new `/api/ai/public-settings` re-exposes one field of the guarded `ai-responses`. Was: Duplicate/competing route families with different shapes and different (non-)auth: quotes (`/api/quotes` vs `/api/admin/quotes`), temple areas (`/api/temple-areas` vs `/api/admin/temple-areas` - both allow POST), prompts (`/api/admin/prompts` vs `/api/ai/settings/prompts`), knowledge (`/api/knowledge`, `/api/admin/knowledge`, `/api/ai/knowledge`, `/api/knowledge/workflow`), unknown questions (`/api/ai/settings/unknown-questions` vs `/api/ai/analytics/unknown-questions`), analytics (`/api/admin/analytics` vs `/api/ai/analytics`). | `app/api/temple-areas/route.ts:14` and `app/api/admin/temple-areas/route.ts:14`; `app/api/admin/prompts/route.ts:107` and `app/api/ai/settings/prompts/route.ts:72` | Collapse to one family per resource with an auth-scoped variant. |
| M12-F16 | MEDIUM | **STILL OPEN (2026-10-18)**, MOVED to `app/api/admin/prompts/route.ts:12-21`; partly mitigated - POST/PUT now also call `verifyAdminUser` (`:63,113`), so in production with `ADMIN_API_KEY` they need both the key and a token, while GET (`:27`) is still key-only or open. `/api/admin/prompts` auth is a no-op in every environment except production-with-`ADMIN_API_KEY`; its own comment admits it. | `app/api/admin/prompts/route.ts:12-21`, `:27`, `:63`, `:113` | Replace with `verifyAdminUser`. |
| M12-F17 | MEDIUM | **FIXED (2026-10-18)** by `da7a1fc` + `d235868` (2026-09-20): every former reader now takes `uid`/`email` from the verified token; `grep -rl x-user-id app/api` -> 0, `grep -rl x-user-email app/api` -> 0. Was: Audit identity is taken from unauthenticated request headers: `x-user-id` in 11 route files (8 of the 9 under `/api/ai/settings` - all but `unknown-questions` - plus the 3 under `/api/admin/prompts`) and `x-user-email` in 2 (aaradhane, quotes). Every "who changed this" record can be forged. | 2026-09-19: `grep -rl x-user-id app/api` -> 11 files, `x-user-email` -> 2; now both -> 0; e.g. `app/api/ai/settings/route.ts:33`, `app/api/admin/aaradhane/route.ts:41`, `app/api/admin/quotes/route.ts:51` | Derive the identity from the verified token. |
| M12-F18 | MEDIUM | **STILL OPEN (2026-10-18).** Unchanged in the five route files; the new server action repeats it - `app/actions/settings.ts:35` calls `isUserAdmin`, which reads `users` through the client SDK (`lib/auth/admin.ts:7-8,58-75`). Client Firebase SDK (`lib/firebase`) used inside server handlers, so writes are subject to client security rules and share process-global auth state. `create-admin` even calls `signOut(auth)` on that global. | `app/api/admin/users/create-admin/route.ts:4,81`; `set-role/route.ts:3`; `app/api/public/stats/route.ts:6`; `app/api/ai/knowledge/coverage/route.ts:2`; `app/api/ai/knowledge/import/route.ts:2` | Use `lib/admin-firebase` (admin SDK) in all server handlers. |
| M12-F19 | MEDIUM | **STILL OPEN (2026-10-18).** `/api/calendar` is called six times from the admin calendar pages but no such route exists - those pages' writes silently 404. | `app/admin/calendar/ekadashi/page.tsx:34,62,80`; `app/admin/calendar/festivals/page.tsx:31,60,79`; `ls app/api/calendar` -> missing | Implement the route or repoint the pages at the aaradhane/panchanga services. |
| M12-F20 | MEDIUM | **STILL OPEN (2026-10-18).** `POST /api/contact` validates and sanitises, then only `console.log`s - no email, no store. The devotee is told "we will get back to you". | `app/api/contact/route.ts:46-51` | Persist to a `contactRequests` collection and/or send mail. |
| M12-F21 | MEDIUM | **STILL OPEN (2026-10-18).** Stub and placeholder handlers shipped as real endpoints: `receipts/[id]/send` returns success without sending; `admin/content` GET `freshness`/`review` return explanatory prose instead of data. | `app/api/admin/receipts/[id]/send/route.ts:1`; `app/api/admin/content/route.ts:46-71` | Implement or remove; a stub that returns `success:true` hides failures from the UI. |
| M12-F22 | MEDIUM | **STILL OPEN (2026-10-18).** `"personalized"` recommendations construct an empty `UserBehavior` on every call, so the branch is identical to `homepage`. | `app/api/recommendations/route.ts:30-40` | Read behaviour from a cookie/session or drop the branch. |
| M12-F23 | MEDIUM | **STILL OPEN (2026-10-18)**, still 25 of 97 route files; evidence MOVED to `app/api/admin/quotes/route.ts:19,35` and `app/api/admin/prompts/[id]/route.ts:20`; the new `app/actions/settings.ts:100` adds `updates: any`. `AGENTS.md` bans `any`; 25 of 95 route files use it (`grep -rlE ":\s*any\b\|<any>\|as any\|\bany\[\]" app/api \| wc -l` -> 25), including `response: any`, `error: any`, `filters: any`, `(v: any)`. | `app/api/knowledge/workflow/articles/[id]/route.ts:37`; `app/api/admin/quotes/route.ts:19,35`; `app/api/admin/prompts/[id]/route.ts:20`; `app/api/admin/receipt-sevas/[id]/route.ts:48` | Type the bodies; `unknown` + a narrowing guard where the shape is open. |
| M12-F24 | MEDIUM | **STILL OPEN (2026-10-18).** Firestore `.offset()` pagination on receipts bills a read for every skipped document; page 50 of a 10 000-row export reads 500 000 docs. | `app/api/admin/receipts/route.ts:58-61` | Cursor pagination with `startAfter`. |
| M12-F25 | MEDIUM | **STILL OPEN (2026-10-18).** `/api/public/stats` runs 6 count queries plus a full scan of completed donations on every request, uncached. | `app/api/public/stats/route.ts:33-60` | Cache the counters (ISR or a nightly aggregate doc). |
| M12-F26 | MEDIUM | **STILL OPEN (2026-10-18).** Date filter bug: `toDate.setHours(23,59,999)` sets **999 seconds**, pushing the upper bound to 00:15:39 the next day; also the `NaN` check runs after the mutation. | `app/api/admin/receipts/route.ts:48-52` | `setHours(23,59,59,999)` and validate before mutating. |
| M12-F27 | MEDIUM | **STILL OPEN (2026-10-18)**, aaradhane evidence MOVED to `app/api/admin/aaradhane/route.ts:16-20`; two more shapes arrived: `requireAdminUser` failures `{error, reason}` (`lib/auth/admin-auth.ts:210-213`) and the seeder's `{ok, outcome, message, sections}` (`app/api/seed-ai-settings/route.ts:107-112`). No response-shape contract: `{success,data}`, `{success,<noun>}`, bare arrays, bare objects, `{<noun>,total}` and `{error}` vs `{success:false,error}` all coexist. | `app/api/admin/aaradhane/route.ts:16-20` vs `app/api/events/route.ts:7` vs `app/api/quotes/route.ts:37` vs `app/api/announcements/route.ts:10` | Define one envelope before any mobile client is written. |
| M12-F28 | MEDIUM | **STILL OPEN (2026-10-18)**, MOVED to `app/api/admin/quotes/route.ts:93-100,130-137`; PATCH/DELETE remain unauthenticated. Bulk quote operations loop one Firestore write per id with no transaction and no cap; a large `ids[]` is an unauthenticated write amplifier. | `app/api/admin/quotes/route.ts:93-100,130-137` | Batch writes, cap the array, require auth. |
| M12-F29 | LOW | **STILL OPEN (2026-10-18).** The rewritten seeder adds three more: `details: readError.message` / `error.message` / `updateError.message` (`app/api/seed-ai-settings/route.ts:86,100,155`). Internal error text leaked to clients via `details: error.message` / `String(error)` in the quote family, revalidate and storage routes. | `app/api/quotes/route.ts:45`; `app/api/revalidate/route.ts:40`; `app/api/storage/videos/route.ts:26` | Log server-side, return a generic message. |
| M12-F30 | LOW | **STILL OPEN (2026-10-18).** `/api/chat` logs the caller IP and the first 50 characters of every user message to stdout. | `app/api/chat/route.ts:77,121` | Drop or hash; treat chat text as personal data. |
| M12-F31 | LOW | **STILL OPEN (2026-10-18).** Partly cleaned by `2891323`: the `getSystemPrompt`, `generateFirebaseResponse`, `getTempleInfo` imports are gone (lines 3-4 are now blank); the rest remain. ~55 lines of commented-out LLM-fallback code and several unused imports (`getAIProvider` only in GET, `generateFirebaseResponse`, `getTempleInfo`, `getSystemPrompt`, `detectIntent`, `getSession`, `createSession`, `clearSession`, `getQuickActions`, `getSuggestedQuestions`). | `app/api/chat/route.ts:232-286`, imports at `:3-26` | Delete; git history is the archive. |
| M12-F32 | LOW | **STILL OPEN (2026-10-18).** The seed-route part is FIXED (`fae5d51`, Firestore imports gone); the rest remain, and new unused bindings arrived: `const admin = guard.user` in GET handlers (`app/api/ai/settings/route.ts:12`, `app/api/ai/settings/policies/route.ts:12`, `app/api/ai/settings/temple-information/route.ts:16`, `app/api/ai/settings/ai-behavior/route.ts:13`, `app/api/ai/settings/ai-responses/route.ts:13`) and the `Intent` import in `app/api/ai/analytics/latency/route.ts:6`. Unused imports elsewhere: `getWorkflowArticleById/updateWorkflowArticle/performWorkflowAction` in the workflow list route, `getSearchSuggestions` in the search route, `getPendingTestimonials/approveTestimonial` in testimonials, `getArticleComments` in comments, `doc/setDoc/serverTimestamp` in the seed route. | `app/api/knowledge/workflow/articles/route.ts:8-10`; `app/api/search/route.ts:2`; `app/api/testimonials/route.ts:2`; `app/api/knowledge/workflow/comments/route.ts:7`; (seed route citation removed - fixed) | Clean up; lint rule would catch these. |
| M12-F33 | LOW | **STILL OPEN (2026-10-18).** `/api/supabase-check` is a debug endpoint that publicly reports which Supabase env vars are configured. | `app/api/supabase-check/route.ts:6-10,41-46` | Remove before launch or gate it. |
| M12-F34 | LOW | **STILL OPEN (2026-10-18).** Doc comment advertises `POST /api/admin/analytics/feedback`; the handler is `POST /api/admin/analytics`. A client following the comment 404s. | `app/api/admin/analytics/route.ts:32` | Fix the comment or add the sub-route. |
| M12-F35 | LOW | **FIXED (2026-10-18)** by `fae5d51`: the seeder no longer writes Firestore at all; it targets the Supabase `ai_settings` row `main` (`app/api/seed-ai-settings/route.ts:80`). Was: Seed route writes a document literally named `%20RayaAI` (URL-encoded space) into `ai_settings`. | 2026-09-19 snapshot lines 547, 644, 621; now `app/api/seed-ai-settings/route.ts:77-81` (Supabase row `main`) | Use a clean id and migrate. |
| M12-F36 | LOW | **STILL OPEN (2026-10-18).** `/api/admin/knowledge` GET merges Firestore rows with `SEED_ARTICLES` and flags them `isSeed:true`; those rows cannot be edited or deleted through the `[id]` routes, so the admin table shows undeletable entries. | `app/api/admin/knowledge/route.ts:46-66` | Import seeds once, or mark them read-only in the UI. |
| M12-F37 | LOW | **STILL OPEN (2026-10-18).** `admin/quotes/bulk` validate mode reports `valid = quotes.length - errors.length`, but one row can raise three errors, so `valid` can go negative. | `app/api/admin/quotes/bulk/route.ts:34-38` | Count rows, not error strings. |
| M12-F38 | LOW | **STILL OPEN (2026-10-18).** No `OPTIONS` handler and no CORS headers anywhere (`grep OPTIONS app/api` -> 0), so a browser-based client on another origin cannot use this API. | `find app/api -name route.ts` vs `grep -rn "export async function OPTIONS" app/api` -> 0 | Add a shared CORS helper when a separate frontend lands. |
| M12-F39 | LOW | **STILL OPEN (2026-10-18).** List endpoints have no pagination except receipts: events, announcements, donations, bookings, testimonials, volunteer, workflow articles all return everything; `/api/quotes` fetches all then `.slice(0, limit)`. | `app/api/events/route.ts:6`; `app/api/quotes/route.ts:38` | Add `limit`/cursor params before the collections grow. |
| M12-F40 | LOW | **STILL OPEN (2026-10-18).** `/api/search/suggestions` returns HTTP 500 with an empty array body, so a client cannot distinguish "no suggestions" from "broken". | `app/api/search/suggestions/route.ts:20` | Return 200 `[]` or a proper error object. |
| M12-F41 | LOW | **STILL OPEN (2026-10-18).** `vercel.json` carries only cache headers for `/data/panchanga/*` - no function memory/duration/region config despite `maxDuration` being set inline in one route. | `vercel.json:1-23`; `app/api/reports/save/route.ts:5` | Centralise function config if cold starts or timeouts appear. |
| M12-F42 | LOW | **STILL OPEN (2026-10-18).** The second action file `app/actions/settings.ts` does check the caller (see M12-F46). The only server action uses the Supabase **service-role** client with no caller check, and returns raw table rows. | `app/actions/sevas.ts:2,5,12` | Add an auth check and map to the domain type. |
| M12-F43 | MEDIUM | **STILL OPEN (2026-10-18).** The Raya AI operations console is a **public page**. `app/(public)/ai/analytics/page.tsx` sits in the public route group with no guard in the page or in `app/(public)/layout.tsx`, and fetches the unauthenticated `/api/ai/analytics` - so conversation volumes, intent distribution, latency and token usage are readable by anyone who visits `/ai/analytics`. | `app/(public)/ai/analytics/page.tsx:294` (fetch), `:1` (`"use client"`, no auth hook), `app/(public)/layout.tsx:4-17` (no guard); endpoint `app/api/ai/analytics/route.ts` has no auth | Move the page under `app/admin/` and guard `/api/ai/analytics` with `verifyAdminUser`. |
| M12-F44 | MEDIUM | **STILL OPEN (2026-10-18).** Re-counted: 35 of 97 (verify 2026-10-18; the two new routes have callers, and `admin/receipts/[id]`, `admin/receipts/[id]/pdf`, `admin/receipt-sevas/[id]` are called through `${BASE_URL}/${id}` in the receipt services). **36 of the 95 endpoints have no reference anywhere in the repository** - no component, service, hook or test calls them. They are unmaintained, untested attack surface, and several of them are write paths (`/api/admin/aaradhane/[id]`, `/api/admin/prompts/[id]/publish`, `/api/admin/users/set-role`, `/api/donations/[id]`, `/api/temple-areas/[id]`, `/api/knowledge/workflow/comments`). | 2026-09-19 script (no longer on disk) -> 36 of 95; 2026-10-18 re-scan -> 35 of 97; e.g. `app/api/bookings/route.ts`, `app/api/dashboard/daily-spiritual/route.ts`, `app/api/supabase-check/route.ts`, `app/api/admin/receipts/[id]/send/route.ts` have zero hits outside `app/api` | Delete the dead ones; guard the rest. Every route kept must have a caller or a contract test. |
| M12-F45 | MEDIUM | **STILL OPEN (2026-10-18).** The Playwright API-contract suite is written against endpoints that do not exist: `/api/sevas`, `/api/admin/events`, `/api/admin/settings`, `/api/auth/login`, `/api/v1/events`, `/api/health`. `CONTRACT_API_003` asserts `status === 200` on `/api/sevas`, which can only 404 - so the suite cannot be passing and gives no contract assurance. | `tests/e2e/sprint5/api-contract.spec.ts:52-53` (`/api/sevas`, expects 200), `:169`, `:317`, `:319`, `:329`, `:353`; `tests/functional/09_performance_security.spec.ts:377` (`/api/health`); `find app/api -name route.ts` contains none of these paths | Either write the missing routes (`/api/sevas` is also the mobile gap in the portability table) or rewrite the specs against the real surface. Owner: M15. |
| M12-F46 | HIGH | **NEW (2026-10-18).** Saving site settings can never succeed from the admin UI. `app/actions/settings.ts` authorizes by rebuilding a request from `headers()` and demanding `Authorization: Bearer` (`:26-30` -> `lib/auth/admin.ts:25-31`), but its only caller is the `"use client"` page `app/admin/settings/page.tsx:69,71` through `services/settings.service.ts:70,75`; a browser-invoked server action carries cookies, never a bearer header, so every create/update throws `Unauthorized` and the page shows "Unable to save settings". Even with a token, `isUserAdmin` accepts only `role === "admin"` (`lib/auth/admin.ts:71`), so `super_admin` is refused. The unit test mocks `headers()` (`tests/unit/bot-004-action.test.ts:3`) and cannot see this. | `app/actions/settings.ts:26-36,39-42,74-77`; `services/settings.service.ts:70,75`; `app/admin/settings/page.tsx:1,69,71`; `lib/auth/admin.ts:20-31,71` | Pass the ID token as an action argument (or use a session cookie) and verify it with `verifyAdminUserResult`; or replace the action with a guarded route called via `adminFetch`. |
| M12-F47 | MEDIUM | **NEW (2026-10-18).** Auth was added per method, not per family, leaving half-guarded resources and broken callers. `/api/admin/quotes` guards only POST (`route.ts:47`); GET, PATCH (bulk update) and DELETE (bulk delete) stay open, and the admin create page still sends no token, so creating a quote now returns 401. `/api/admin/aaradhane` is guarded while `/api/admin/aaradhane/[id]` PUT/DELETE are open; `/api/admin/prompts/[id]` guards DELETE but not GET. | `app/api/admin/quotes/route.ts:11,47,79,116`; caller `app/admin/quotes/new/page.tsx:210-213` (no `Authorization`); `app/api/admin/aaradhane/[id]/route.ts:40,67`; `app/api/admin/prompts/[id]/route.ts:13,52` | Guard every handler in an `/api/admin/*` file; move `app/admin/quotes/**` onto `adminFetch`. |
| M12-F48 | MEDIUM | **NEW (2026-10-18).** Three incompatible admin checks now coexist. `verifyAdminUserResult` admits any role except `devotee`/`volunteer` (block-list, so an unknown or typo role passes); `lib/auth/admin.ts` `isUserAdmin` admits only exactly `admin` (allow-list, rejects `super_admin`) and treats `ADMIN_API_KEY` as a bearer token for a synthetic `api-admin`; `/api/admin/prompts` uses a third header `x-admin-api-key`. The seeder's header says it is "for a Super Admin" but any non-blocked role can run it. | `lib/auth/admin-auth.ts:39,147-156`; `lib/auth/admin.ts:38-39,71`; `app/api/admin/prompts/route.ts:12-21`; `app/api/seed-ai-settings/route.ts:3,68` | One helper with an explicit role allow-list per capability (owner M04). |
| M12-F49 | LOW | **NEW (2026-10-18).** `/api/ai/health` answers HTTP 200 with `database.connected:false` when the datastore is unreachable, so any monitor keyed on status code reads a failure as healthy; the older open `/api/ai/analytics/health` probe still exists beside it. | `app/api/ai/health/route.ts:73-84`; `app/api/ai/analytics/health/route.ts` | Return 503 on failure, or document that callers must read the body; retire one of the two probes. See also M12-F52. |
| M12-F50 | LOW | **NEW (2026-10-18).** The mobile app's chat sends no `sessionId`, so `/api/chat` starts a fresh session for every message and the conversation context the web widget gets is lost on mobile. | `apps/mobile/app/(tabs)/ai.tsx:44-47`; `app/api/chat/route.ts:100,130,306` | Return and resend `sessionId` from the mobile client (owner: mobile chunk). |
| M12-F51 | MEDIUM | **NEW (2026-10-18)** - found during the refresh; the same call shapes were already in the 2026-09-19 snapshot. The admin prompt editor and `/api/ai/settings/prompts` disagree on the contract: the page sends the version id as `?id=` and never sends `versionId`, but PUT reads `versionId` from the body and 400s without it; the page calls DELETE, which the route does not export (405); and rollback is a POST `{action:"rollback"}`, which lands in the create handler and 400s for missing `content`. Edit, status change, delete and rollback of a prompt therefore cannot succeed from the UI; only create works. | `app/admin/ai/prompts/page.tsx:138-145,178-182,204-206,227-231`; `app/api/ai/settings/prompts/route.ts:10,33,42,72,79-81` | Read `id` from the query in PUT, add a DELETE handler (archive), route rollback through PUT `action`; add a contract test. |
| M12-F52 | MEDIUM | **NEW (verify 2026-10-18).** `/api/ai/health` reports `database.connected:true` when the Supabase query fails or the stored row fails schema validation: `aiAdminRepository.getSettings()` logs the error and returns `null` instead of throwing, so the route's `catch` (its only failure path) never runs and the admin health page shows a reachable datastore with an empty record. Only a thrown client (e.g. missing env) reaches the `connected:false` branch. | `lib/ai/ai-settings/admin-repository.ts:47-50,69-73`; `app/api/ai/health/route.ts:45,59-67,73` | Have the probe query Supabase itself and inspect `error`, or make `getSettings` throw on a query error. |
| M12-F53 | MEDIUM | **NEW (verify 2026-10-18; pre-existing, missed by both earlier runs).** The receipt PDF's temple header depends on whichever Firestore `settings` document an admin saved last. `loadTempleContact` takes the newest doc in the whole `settings` collection by `updatedAt` and reads top-level `templeName`/`address`/`contactPhone`/`contactEmail`; that collection holds unrelated pages (footer, about, financeSettings, ...). Saving the About page makes receipts print its `templeName` (default "Sri Gururaja Seva Samiti (R)"); saving billing settings (fields nested under `billing`) makes them print the hardcoded fallback, which includes a personal Gmail address. The site-settings form writes Supabase `site_settings`, which the PDF never reads. | `app/api/admin/receipts/[id]/pdf/route.ts:10,16-22,24-38`; writers `app/admin/settings/about/page.tsx:70,155`, `app/admin/settings/footer/page.tsx:115-117`, `app/admin/billing/settings/page.tsx:75-83`; `services/settings.service.ts:41-43` | Read one fixed document (or the Supabase `site_settings` row) and drop the personal fallback email. |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| The 97 route handlers as HTTP endpoints | none (plain `Request`/`Response`) | **reuse as-is** | A React Native client can `fetch` them unchanged; this table is the mobile API contract. |
| `NextResponse.json(...)` | `next/server` | adapt (server side only) | Cosmetic; the wire format is plain JSON. Only matters if the backend moves off Next.js. |
| `export const dynamic / revalidate` | Next.js data cache | rewrite | Route segment config has no meaning outside Next; replace with `Cache-Control` headers, which most routes also need for mobile. |
| `POST /api/revalidate` + `revalidatePath` | `next/cache` | drop for mobile | ISR is a web-rendering concern; RN has no equivalent. |
| `app/actions/sevas.ts`, `app/actions/settings.ts` (`"use server"`) | React Server Actions / Next RSC transport | **rewrite** | Server actions are not callable from React Native. There is still no `GET /api/sevas`; the mobile app side-steps the gap by reading the Supabase `sevas` table directly (`apps/mobile/lib/api.ts:3-5`). |
| `verifyAdminUser` / `requireAdminUser` Bearer flow | none | **reuse as-is** | Firebase ID tokens work identically from `@react-native-firebase/auth`. This is the pattern mobile should use everywhere; `requireAdminUser`'s `{error, reason}` + 401/403/503 is the friendlier contract for a typed client. |
| `lib/rate-limit.ts` in-memory Map | Node process memory | rewrite | Per-instance state; mobile traffic makes the weakness worse. Needs a shared store. |
| `/api/gallery/local-assets` (fs read/delete) | Node `fs` + Vercel filesystem | **rewrite** | Serverless disk is ephemeral and read-only in practice; mobile cannot rely on it. Move to Blob/Storage and expose URLs. |
| `/api/ai/knowledge/import` (reads `seed/ai/*.json` from `process.cwd()`) | Node `fs` + bundled repo files | rewrite | Bundle path assumptions break in any other deployment target. |
| `/api/admin/receipts/[id]/pdf` (returns a PDF stream) | `Buffer`, `Content-Disposition: inline` | adapt | RN cannot render `inline` PDFs from a fetch; return a signed URL, or let the client download to the filesystem. |
| `/api/reports/save` base64 body, `maxDuration=60` | Vercel function config | adapt | Large base64 bodies over mobile networks need chunked/direct-to-Blob upload. |
| Responses without an envelope (bare arrays, mixed keys) | none | adapt | A typed mobile client needs one predictable shape; see M12-F27. |
| No CORS/`OPTIONS` handlers | browser same-origin policy | adapt | RN is not subject to CORS, but a future web client on another origin is. |
| Cookies/session | not used by any route | n/a | The API is stateless and token-based already - good for mobile. |

**What `apps/mobile` consumes today (2026-10-18).** Exactly one endpoint: `POST /api/chat`, called
from `apps/mobile/app/(tabs)/ai.tsx:44` against `EXPO_PUBLIC_API_URL` (default
`https://www.srsmathaynk.com`, `:42`), with no auth header and no `sessionId` (M12-F50); it maps
429 and 400 to user messages (`:50-54`), so the `/api/chat` limiter and validation are now a mobile
contract. Everything else the app shows - sevas, events, daily poojas, gallery albums, website
settings - it reads straight from Supabase through `apps/mobile/lib/api.ts:3-49`, bypassing this
module and the web services entirely.

**What a React Native client would need from this module.** The good news: the transport is already
plain JSON over HTTP with no cookies, no CSRF tokens and no RSC-only surfaces except two server
action files, so roughly 90 of 97 endpoints are reusable verbatim. The work is in three places. First,
**coverage gaps**: sevas (only via a server action), the panchanga calendar (`/api/calendar` is
called but missing), the homepage/gallery/content payloads and the whole public site's data are
fetched inside Server Components straight from `services/*`, so there is no endpoint for them -
mobile needs new route handlers wrapping those same services. Second, **auth**: mobile cannot rely
on "the admin UI only shows this button to admins", so every write endpoint must adopt the
`verifyAdminUser`/`requireAdminUser` Bearer pattern that the receipts and AI-settings families use
today (21 of 97 files). Third, **contract
hygiene**: one response envelope, real pagination, typed errors and shared types exported from
`types/*` so the RN app can consume the same TypeScript definitions - that shared-type reuse is the
single highest-value portability investment in this chunk.

## Coverage

filesExpected 101 (from `.claude/state/inventory/M12.json` `totals.files`, regenerated 2026-10-18;
the chunk entry in `chunks.json` still says `expectedFiles: 96` - the inventory count is
authoritative: 97 `route.ts` files + 2 `app/actions` files + `lib/rate-limit.ts` + `vercel.json`).
filesMentioned 101 (checked by script on 2026-10-18). Every route file has a row in **Entry points**;
`app/api/admin/prompts/[id]/route.ts` had no **Key files** row on 2026-09-19 and now has one.
Omitted: none.

Files read to confirm boundaries but not owned (one import level): `lib/auth/admin-auth.ts`,
`lib/auth/admin.ts`, `proxy.ts`, `next.config.ts`, `services/seva.service.ts`,
`services/settings.service.ts` (callers of the server actions), `hooks/useAdminFetch.ts`,
`lib/ai/ai-settings/repository.ts`, `apps/mobile/app/(tabs)/ai.tsx`, `apps/mobile/lib/api.ts`.

## UNCLEAR

- ~~Whether `/api/calendar` once existed~~ - settled 2026-10-18: it never existed in any branch
  (`git log --all -- app/api/calendar` -> empty), while the calling pages date from `bfef59d`
  (2026-07-10). The pages were written against a route nobody wrote.
- Whether `/api/admin/users/create-admin` and `/api/admin/users/set-role` are still deployed in
  production. `docs/API.md:169-181` publishes working cURL examples against
  `https://rayaramathaynk.vercel.app`, which suggests yes. Settled by an authenticated check of the
  Vercel deployment; not done here (no network writes allowed in this run).
- Whether `ADMIN_API_KEY` is actually set in the production environment. If it is not, the
  `/api/admin/prompts` GET gate is open there too; if it is, the same value is also a bearer
  credential for the settings server action (`lib/auth/admin.ts:38-39`). Settled by reading the
  Vercel env var list.
- ~~Whether the AI settings live in `ai_settings/RayaAI` or `ai_settings/%20RayaAI`~~ - moot since
  `fae5d51` (2026-10-06): both the seeder and `lib/ai/ai-settings` use the Supabase `ai_settings`
  row `main` (`lib/ai/ai-settings/repository.ts:31`). Whether the old Firestore documents were
  migrated or simply abandoned is not visible in code.
- Which of the 35 unreferenced endpoints (see M12-F44) are consumed by anything outside this
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

## Refresh log (2026-10-18)

Scope: 20 changed files in `perModule.M12` (3 added, 17 modified, 0 deleted), diffed against the
2026-09-19 snapshot with `diff -u --strip-trailing-cr` (most files also switched CRLF -> LF), plus
`git log --since=2026-09-19` on the M12 roots. Code state = `424fdb8` (HEAD `3d6aa9d` only adds docs).

Changes made (was -> is now -> evidence):

- Route files 95 -> 97 (`/api/ai/health`, `/api/ai/public-settings` added) -> `find app/api -name route.ts | wc -l` -> 97.
- Server action files 1 -> 2 (`app/actions/settings.ts` added) -> `grep -rl '"use server"' app` -> 2.
- Route files with an identity check 5 -> 21; unauthenticated 88 of 95 -> 76 of 97 -> `grep -rlE "verifyAdminUser|requireAdminUser" app/api` -> 21.
- "No middleware" -> `proxy.ts` exists (present since 2026-07, missed on 2026-09-19) and runs on `/api/*` but does no auth -> `proxy.ts:83-120`.
- `verifyAdminUser` cited at `lib/auth/admin-auth.ts:28` -> now `:186`, wrapping `verifyAdminUserResult` `:50`; new `requireAdminUser` `:198` with `{error, reason}` 401/403/503 -> `lib/auth/admin-auth.ts`.
- apikey helper `:11-19` -> `:12-21` -> `app/api/admin/prompts/route.ts`.
- "fake" auth legend -> struck; seeder uses `requireAdminUser` -> `app/api/seed-ai-settings/route.ts:68`.
- `/api/admin/aaradhane` none -> admin(token); `createdBy` from token not `x-user-email` -> `route.ts:11,37,41`.
- `/api/admin/prompts` apikey? -> apikey? + admin(token) on POST/PUT -> `route.ts:63,113`.
- `/api/admin/prompts/[id]` none -> partial (DELETE guarded); archive at `:76` -> `:80-81`.
- `/api/admin/prompts/[id]/publish` none -> admin(token) -> `route.ts:18`.
- `/api/admin/quotes` none -> partial (POST only) -> `route.ts:47`.
- AI domain "22 files, every one auth none" -> 24 files, 10 guarded by `requireAdminUser` -> wiring test `tests/unit/ai-api-auth-wiring.test.ts`.
- AI settings store Firestore `ai_settings/*` -> Supabase `ai_settings` row `main` + `unknown_questions`; analytics on Supabase -> `lib/ai/ai-settings/repository.ts:31,43`, `services/ai-analytics.service.ts:325`.
- `/api/ai/analytics/latency` accepted `intent` -> no longer -> `route.ts:14`.
- `/api/ai/settings` POST 6 actions -> 9 -> `route.ts:47-79`.
- `/api/ai/settings/ai-behavior` `all` passed the raw body -> rebuilds a typed object -> `route.ts:46-58`.
- `/api/ai/settings/temple-information` `revalidate=3600` + `s-maxage` -> `force-dynamic` + `no-store` -> `route.ts:11,21`.
- `/api/seed-ai-settings` row (fake auth, Firestore REST, GET dev-only, 723 lines) -> admin-guarded idempotent Supabase repair, POST only, 174 lines -> file.
- Server-action narrative "single point where Supabase is read" -> false; added `settings.ts` row -> `services/settings.service.ts:70,75`.
- Pipeline B "5 files, only two token-sending callers" -> 21 files; `hooks/useAdminFetch.ts` also sends the token -> `hooks/useAdminFetch.ts:66,77`.
- Pipeline C `x-user-id` audit identity -> verified uid; 11 header readers -> 0 -> `grep -rl x-user-id app/api` -> 0.
- Pipeline D 397 -> 396 lines -> `wc -l app/api/chat/route.ts`.
- Consumer tree: seeder caller `settings/page.tsx:75` -> `:279`; added `/api/ai/health`, `/api/ai/public-settings`, settings action, quotes-without-token and mobile callers.
- "Route handlers are not importable" -> five Jest unit tests import routes/actions -> `tests/unit/api-ai-health-route.test.ts:18`.
- Unreferenced endpoints 36 of 95 -> 36 of 97; the first-run script `.claude/state/verify/_M12_callers.js` is no longer on disk (cited as absent) -> re-run with an equivalent scratch script.
- Data flow 4 (header identity, Firestore, hour-long cache) and Data flow 5 (fake auth, hardcoded key, 8 Firestore overwrites) rewritten -> files above.
- Key files: line counts updated for all 17 modified files; rows added for the 3 added files and for `app/api/admin/prompts/[id]/route.ts` (missing on 2026-09-19).
- Types: `types/settings.ts` added. Stores: Firestore seeder stores struck; Supabase `ai_settings`, `site_settings` and the client-SDK `users` read added.
- Cross-module counts: `lib/ai/ai-settings` 12 -> 13 importers (+`admin-repository`, `seed-data`); `lib/auth/admin-auth.ts` 5 -> 21; `lib/supabase/admin` 2 -> 4; new `lib/auth/admin.ts` 1.
- Recipes 2 and 7: `requireAdminUser` is the preferred guard; warn against the settings-action auth pattern.
- Portability: `apps/mobile` consumes `POST /api/chat` only and reads everything else from Supabase directly -> `apps/mobile/app/(tabs)/ai.tsx:44`, `apps/mobile/lib/api.ts:3-49`.
- Coverage 98 -> 101 files, 101 mentioned (script-checked).
- UNCLEAR: `/api/calendar` settled (never existed, `git log --all -- app/api/calendar` empty); `%20RayaAI` moot; `ADMIN_API_KEY` item extended.
- Faults: every row F01-F45 carries a 2026-10-18 status. FIXED: F03, F04, F35 (`fae5d51`), F17 (`da7a1fc`, `d235868`). Evidence MOVED: F15, F16, F23, F27, F28. New: F46-F51.

Commits behind the biggest changes: `fae5d51` (2026-10-06, AI settings rebuilt on Supabase, seeder
rewrite), `698a25c`, `8d54714` (2026-10-15, `requireAdminUser`, `/api/ai/health`, seeder auth),
`da7a1fc` / `d235868` / `43c6d8f` (2026-09-20, production hardening: token auth on aaradhane, quotes,
prompts, AI settings), `64fc607` (analytics migration), `2891323` (chat import pruning), `3446b0b`
(`/api/ai/public-settings`), `54024a1` / `7d7bd51` (`app/actions/settings.ts`).

UNCLEAR:
- Whether the Firestore `ai_settings` documents were migrated to Supabase or abandoned - the code no
  longer reads them; only a data check settles it.
- Whether any production client still sends `x-admin-api-key` to `/api/admin/prompts`; nothing in the
  repo does, and the admin UI uses the `/api/ai/settings/prompts` twin.
- M12-F46 is inferred from Next.js server-action transport (a browser-invoked action carries no
  `Authorization` header); not run in a browser here (static reading only).

## Verification log (2026-10-18)

Skeptic pass on the refresh, against HEAD `43361a3` (`git diff --stat 424fdb8 HEAD -- app lib services hooks components proxy.ts vercel.json apps tests`
-> empty, so the code state is the one the refresher read). Path script: 335 citations of 188 files, 0 out of range; the
only non-existent paths are `middleware.ts` and `.claude/state/verify/_M12_callers.js` (both cited as absent) and the bare
seed-data shorthand in Cross-module dependencies, now written as the full `lib/ai/ai-settings/` path. Every refresh-touched section and every FIXED/NEW fault row re-opened.

- "AI analytics read Supabase ... Firestore is no longer involved" -> Firestore still serves token usage, chat session/message counts and `getAnalyticsSettings` (client SDK); AI-domain intro and the `/api/ai/analytics` and `token-usage` store cells corrected -> `services/ai-analytics.service.ts:17-18,64,279,289,623,635`.
- "The quotes and aaradhane admin pages still call plain `fetch`" -> aaradhane pages never call `/api/admin/aaradhane`; they use the service directly -> `app/admin/aaradhane/page.tsx:14`, `grep -rn /api/admin/aaradhane app components services hooks lib` (outside app/api) -> 0.
- Data flow 2 cited `lib/auth/admin-auth.ts:28` (a type member) -> `:186` -> `verifyAdminUserResult` `:50` -> `lib/auth/admin-auth.ts:186-191`.
- Data flow 1 "whatever the body says is stored" -> body spread as-is but status/payment fields/timestamps forced -> `services/sevaBooking.service.ts:36`.
- Consumer tree: 11 stale line numbers (AIChatProvider `:156,260` was 9 lines off) -> current lines -> `grep -n /api/ <file>` per file.
- Consumer tree "LocalGalleryAssets -> GET+DELETE" -> DELETE only -> `components/admin/gallery/LocalGalleryAssets.tsx:47-48`.
- Consumer tree missed callers -> added `app/admin/ai/unknown-questions/page.tsx:223`, `app/admin/ai/page.tsx:48,61`, `app/admin/ai/knowledge/page.tsx:52,73`, the receipt services' `${BASE_URL}/${id}` calls (`services/receipt.service.ts:116,131`, `services/receiptSeva.service.ts:84`), `lib/reports/report-saver.ts:33`, `scripts/save-report.ts:26`.
- Unreferenced endpoints 36 of 97 -> 35 of 97 (consumer-tree paragraph, F44, UNCLEAR) -> regex scan of app (minus app/api), components, hooks, services, lib, tests, scripts, apps/mobile: 38 raw hits minus the 3 `BASE_URL` routes.
- "`/api/events`, `/api/announcements`, `/api/donations`, `/api/contact`, `/api/testimonials` are the ones referenced only by tests/e2e" -> 12 test-only endpoints, two of them outside tests/e2e -> same scan.
- "five Jest unit tests [import route files]" -> four import; `ai-api-auth-wiring.test.ts` reads 11 sources as text -> `tests/unit/ai-api-auth-wiring.test.ts:5-6,8-20,25`.
- F32 listed 2 unused `const admin = guard.user` bindings -> 5 -> `temple-information/route.ts:16`, `ai-behavior/route.ts:13`, `ai-responses/route.ts:13`.
- F49 cross-referenced to the new F52.
- Added M12-F52 (health probe reports connected:true on a Supabase error) -> `lib/ai/ai-settings/admin-repository.ts:47-50,69-73`.
- Added M12-F53 (receipt PDF header = newest unrelated `settings` doc) -> `app/api/admin/receipts/[id]/pdf/route.ts:24-38`, `app/admin/settings/about/page.tsx:70,155`.
- Confirmed unchanged: 97 route files and 97 table rows (1:1), 21 guarded files with per-handler guard placement exactly as the Auth column says, 0 `x-user-id`/`x-user-email`, 2 `"use server"` files, 0 zod in app/api, 2 rate-limited routes, 2 `runtime="nodejs"`, `proxy.ts` no auth, F03/F04/F17/F35 FIXED, F46/F47/F48/F50/F51 real at the cited lines, all Key-files line counts within 1.
