# M08 - Raya AI - retrieval engine, intents, prompts, provider and chat API
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against HEAD 424fdb8 (see Refresh log). Verify against the code before acting on any claim.

## Answers questions about

- how one chat message travels from `POST /api/chat` to a rendered answer, step by step (detector -> retrieval registry -> response composer since the 2026-09-19 rewrite)
- whether Raya AI actually calls an LLM (it does not - the only call site is commented out and `usesLLM` is always false)
- which LLM providers are wired, which models, where API keys come from, and why `isConfigured()` is broken
- how intent detection works: keyword patterns, "semantic" Jaccard matching, the ordered `domainKeywords` override list, ML typo correction, learned corrections
- how Kannada / English / mixed language is detected, and how Romanized Kannada is transliterated
- which Firestore collections, Supabase tables and static JSON files the AI reads, and in what order (temple information now comes from the Supabase `ai_settings` row; events, sevas, announcements and aaradhane still come from Firestore)
- what "hybrid retrieval" means in this codebase versus what `docs/AI-GUIDELINES.md` claims it means
- where the response text for every intent is written (bilingual templates in `lib/ai/response/composer.ts`; the fallback, welcome, goodbye and out-of-scope strings are admin-editable `aiResponses` settings)
- how conversation sessions and follow-up detection work, why the returned `sessionId` does not match the stored one, and why the browser and the server write the same conversation to different stores, and why the repo's RLS policies refuse the browser's writes (M08-F38)
- where unknown / low-confidence questions are logged (Firestore and Supabase `unknown_questions`, two schemas) and which one the admin triage screens read
- how AI analytics (token usage, latency, intent distribution) are supposed to work and why every dashboard reads empty
- what is configurable at runtime through the AI Management Center, and which of those settings the chat engine actually reads
- which AI API routes have authentication (the nine settings routes, `/api/ai/health`, `/api/seed-ai-settings`) and which do not (analytics, knowledge, multi-source, chat)
- how the Supabase AI settings row is seeded and repaired (`POST /api/seed-ai-settings`, idempotent) and why a bad admin save can be wiped by the next chat message
- how the knowledge base is seeded (`seed/ai/*.json`; the CLI writes Supabase `ai_knowledge`, the HTTP importer still writes Firestore `knowledge`)
- what happened to the daily-quote flow (removed from the engine 2026-09-19; `DAILY_QUOTE` now falls through to a knowledge search)
- how the AI Health dashboard probe works (`GET /api/ai/health`, `lib/ai/health-classify.ts`)
- what the public welcome-message endpoint returns (`GET /api/ai/public-settings`)
- how the multi-source retrieval dashboard endpoints work
- what is dead code in this module (roughly 1,650 lines) and what is safe to delete
- what a React Native client would need from this module, and what `apps/mobile` already sends to `/api/chat`

## Purpose and business role

Raya AI is the temple's devotee-facing chat assistant. A devotee opens the floating chat widget (UI lives in
chunk M09) and asks in English, Kannada or a mix - "what are the temple timings", "when is the next
Aaradhane", "how do I get an 80G receipt", "ಇಂದಿನ ಪಂಚಾಂಗ ಏನು". This module is the server half: it classifies
the question into one of 42 intents, pulls the matching facts out of the Supabase AI settings row / Firestore /
static panchanga JSON / the Supabase knowledge-article store, and formats a bilingual Markdown answer.

The stated design goal (`docs/AI-GUIDELINES.md:16-40`) is "retrieval-first, never let an LLM invent temple
facts". The code has taken that to its limit: **no LLM is invoked at all at runtime**. Every answer is a
hardcoded template in `lib/ai/response/composer.ts` filled with retrieved values, or an admin-edited fallback
string from the `aiResponses` settings. The provider abstraction
(`lib/ai/provider.ts`, OpenAI / OpenRouter / Gemini / Claude) is fully implemented but its only caller is
inside a commented-out block (`app/api/chat/route.ts:232-286`). Raya AI is therefore an intent-routed FAQ
engine, not a RAG chatbot.

The module also owns the admin-facing AI surface: the AI Management Center settings store (since 2026-10-06 the Supabase `ai_settings` row `main`: prompts,
intents, temple and visitor information, responses, safety switches; plus Supabase `unknown_questions`), the analytics read endpoints, and the multi-source retrieval
dashboard endpoints. The admin UI that consumes them is chunk M09.

## Code roots

From `.claude/state/chunks.json` (id M08): 96 files / 18,325 lines on 2026-10-18 (90 files / 19,651 lines on
2026-09-19; +8 added, -2 deleted, the generator shrank by ~1,000 lines). No files adopted from the Unassigned
list.

```
lib/ai/                               engine: intents, retrieval registry, response composer, knowledge, AI settings, health classification, provider, prompts
services/chat.service.ts              Supabase chat_sessions/chat_messages (browser) + Firestore testimonials, volunteers, feedback
services/conversation.service.ts      conversation sessions + follow-up detection (Firestore chat_sessions, written by the chat route)
services/knowledge.service.ts         public Knowledge Centre read service
services/multi-source-retrieval.service.ts   dashboard-only fan-out over the retrieval modules
services/ml.service.ts                Jaccard similarity, Levenshtein typo correction, learned corrections
services/ai-analytics.service.ts      analytics reads (Supabase + Firestore); its writers are never called
app/api/chat/                         the chat endpoint
app/api/ai/                           analytics, health, knowledge, multi-source, public-settings and settings endpoints (24 routes, all listed under Entry points)
app/api/seed-ai-settings/             idempotent, admin-only seeder for the Supabase AI settings row
types/ai.ts types/ai-settings.ts types/ai-analytics.ts types/multi-source-retrieval.ts types/knowledge.ts
seed/ai/*.json                        15 seed knowledge articles
scripts/seed-ai-knowledge.ts scripts/seed-ai-settings.ts scripts/migrate-ai-to-supabase.ts
```

## Entry points

| Route / entry | File | server/client | auth required | What it does |
|---|---|---|---|---|
| `POST /api/chat` | `app/api/chat/route.ts:67` | server (Route Handler) | **none** - IP rate limit only (20/min, `:29-51`) | full chat turn: session -> generator (intent -> retrieval registry -> composer) -> Firestore session write |
| `GET /api/chat` | `app/api/chat/route.ts:385` | server | **none** | health probe; leaks provider name, model name and `configured` flag |
| `GET /api/ai/analytics` | `app/api/ai/analytics/route.ts:7` | server | **none** | dashboard aggregate (`getAnalyticsDashboard`) |
| `GET /api/ai/analytics/health` | `app/api/ai/analytics/health/route.ts:7` | server | **none** | `checkAIHealth()` |
| `GET /api/ai/analytics/latency` | `app/api/ai/analytics/latency/route.ts:8` | server | **none** | reads Supabase `ai_latency_records` (the `intent` filter was dropped) |
| `GET /api/ai/analytics/token-usage` | `app/api/ai/analytics/token-usage/route.ts:8` | server | **none** | reads Firestore `ai_token_usage` |
| `GET /api/ai/analytics/intent-distribution` | `app/api/ai/analytics/intent-distribution/route.ts:7` | server | **none** | reads Supabase `ai_intent_distribution` |
| `GET/PATCH /api/ai/analytics/unknown-questions` | `app/api/ai/analytics/unknown-questions/route.ts:8,34` | server | **none** | list / mark reviewed in Supabase `unknown_questions` (service-role client) |
| `GET /api/ai/health` | `app/api/ai/health/route.ts:38` | server | **admin** - `requireAdminUser` (`:39`) | read-only datastore probe + per-section presence report for the AI Health dashboard; never writes |
| `GET /api/ai/public-settings` | `app/api/ai/public-settings/route.ts:5` | server | **none (intentional)** | returns `{welcome}` from `aiResponses`; called by `components/ai/AIChatProvider.tsx:78` |
| `GET /api/ai/knowledge/coverage` | `app/api/ai/knowledge/coverage/route.ts:55` | server | **none** | compares 30 expected categories against Firestore `knowledge` - no longer the store the engine reads (M08-F13) |
| `POST /api/ai/knowledge/import` | `app/api/ai/knowledge/import/route.ts:50` | server | **none** | reads `seed/ai/*.json` off disk and writes Firestore `knowledge` (orphaned since 2026-10-06) |
| `GET /api/ai/multi-source/overview` | `app/api/ai/multi-source/overview/route.ts:7` | server | **none** | all sources at once |
| `GET /api/ai/multi-source/today` | `app/api/ai/multi-source/today/route.ts:7` | server | **none** | panchanga + events + announcements |
| `POST /api/ai/multi-source/query` | `app/api/ai/multi-source/query/route.ts:9` | server | **none** | arbitrary multi-source fan-out |
| `GET /api/ai/multi-source/quick-queries` | `app/api/ai/multi-source/quick-queries/route.ts:7` | server | **none** | static `QUICK_QUERIES` list |
| `GET /api/ai/multi-source/statistics` | `app/api/ai/multi-source/statistics/route.ts:7` | server | **none** | in-process stats (always zero, see M08-F09) |
| `GET/POST /api/ai/settings` | `app/api/ai/settings/route.ts:9,26` | server | **admin** - `requireAdminUser` (`:10,29`); actor = verified uid | read / mutate the AI settings row; POST actions now include `updateGeneralSettings`, `updateSafetySettings`, `updateExtendedBehaviorSettings` (`:46-56`) |
| `GET/PUT /api/ai/settings/temple-information` | `app/api/ai/settings/temple-information/route.ts:13,32` | server | **admin** | `dynamic = "force-dynamic"`, `Cache-Control: no-store` (the public `revalidate = 3600` cache was removed) |
| `GET/PUT /api/ai/settings/visitor-information` | `app/api/ai/settings/visitor-information/route.ts:9,25` | server | **admin** | |
| `GET/PUT /api/ai/settings/policies` | `app/api/ai/settings/policies/route.ts:9,26` | server | **admin** | |
| `GET/PUT /api/ai/settings/ai-responses` | `app/api/ai/settings/ai-responses/route.ts:10,27` | server | **admin** | the `unknownQuestion` / `welcome` / `goodbye` / `outOfScope` strings here are now devotee-visible |
| `GET/PUT /api/ai/settings/ai-behavior` | `app/api/ai/settings/ai-behavior/route.ts:10,27` | server | **admin** | writes the legacy `ai_behavior` column, which the engine does not read (M08-F15) |
| `GET/POST/PUT /api/ai/settings/prompts` | `app/api/ai/settings/prompts/route.ts:10,33,72` | server | **admin** | prompt version CRUD + publish |
| `GET/POST/PUT/DELETE /api/ai/settings/intents` | `app/api/ai/settings/intents/route.ts:12,41,86,116` | server | **admin** | intent metadata CRUD |
| `GET/POST/PUT/DELETE /api/ai/settings/unknown-questions` | `app/api/ai/settings/unknown-questions/route.ts:11,40,76,126` | server | **admin** | Supabase `unknown_questions` triage |
| `POST /api/seed-ai-settings` | `app/api/seed-ai-settings/route.ts:67` | server | **admin** - `requireAdminUser` (`:68`) | idempotent: inserts the Supabase `ai_settings` row `main` if absent, else fills only empty sections; per-section report |
| ~~`GET /api/seed-ai-settings`~~ | removed 2026-10 - see Refresh log | | | the route is POST-only now |
| `npm run` seeders | `scripts/seed-ai-knowledge.ts:46`, `scripts/seed-ai-settings.ts:417`, `scripts/migrate-ai-to-supabase.ts:33` | node CLI | service-account / Supabase service-role from env | seed Supabase `ai_knowledge`; seed Firestore `ai_settings/main` (orphaned); Firestore->Supabase copy |

## Component trees

This module has no React components of its own except one unused hook. The trees below are module trees
rooted at each entry point. `(server)` = runs in the Node route handler, `(client)` = has `'use client'`.

### 1. `POST /api/chat` - the only devotee-facing path

```
POST /api/chat (server)                                   app/api/chat/route.ts:67
├── checkRateLimit(ip)                                    app/api/chat/route.ts:36   (in-memory Map, per instance)
├── getSessionContext(sessionId)          (server)        services/conversation.service.ts:311
│   ├── getSession()                                      services/conversation.service.ts:56   -> Firestore chat_sessions/{id}
│   └── detectFollowUp()                                  services/conversation.service.ts:233  (result discarded, see M08-F06)
├── generateSessionId()                                   services/conversation.service.ts:49   (uuid v4, only when no id was sent)
├── generateResponse(message, sessionId)  (server)        lib/ai/generator.ts:48
│   ├── detectLanguage(message)                           lib/ai/generator.ts:30    -> containsKannada() lib/ai/intent/patterns.ts:682
│   ├── detectIntent(message)                             lib/ai/intent/detector.ts:721
│   │   └── IntentDetector.detect()                       lib/ai/intent/detector.ts:204
│   │       ├── enhanceWithTransliteration()              lib/ai/intent/transliteration.ts:323
│   │       ├── isOutOfScope()                            lib/ai/intent/detector.ts:666  -> OUT_OF_SCOPE_PATTERNS patterns.ts:645
│   │       ├── detectByKeywords()                        lib/ai/intent/detector.ts:256  -> INTENT_PATTERNS patterns.ts:7 (37 patterns)
│   │       ├── detectBySemantic()                        lib/ai/intent/detector.ts:285
│   │       │   ├── getCorrectedIntent()                  services/ml.service.ts:413   (in-memory Map)
│   │       │   ├── autoCorrectMessage()                  services/ml.service.ts:308   (Levenshtein + typo table)
│   │       │   ├── domainKeywords table                  lib/ai/intent/detector.ts:319 (ordered substring override, confidence 100)
│   │       │   ├── INTENT_EXAMPLES Jaccard               lib/ai/intent/detector.ts:33
│   │       │   └── calculateIntentSimilarity()           services/ml.service.ts:126   (INTENT_WEIGHTS ml.service.ts:95)
│   │       └── combineResults()                          lib/ai/intent/detector.ts:521
│   ├── aiSettingsService.getAISettings()                 lib/ai/ai-settings/service.ts:34 -> Supabase ai_settings row "main" (uncached, M08-F33)
│   ├── [confidence < 60] logUnknownQuestion()            services/analytics.service.ts:17 -> Firestore unknown_questions (if extendedBehavior.enableUnknownQuestionLogging)
│   │                     -> aiResponses.unknownQuestion  lib/ai/generator.ts:85-92
│   ├── [GREETING / THANKS|GOODBYE / OUT_OF_SCOPE]        lib/ai/generator.ts:96-123 -> aiResponses.welcome / goodbye / outOfScope
│   ├── retrieve(intent, message)                         lib/ai/retrieval/registry.ts:17
│   │   ├── getContextForIntent(intent)                   lib/ai/retrieval/index.ts:176 -> INTENT_RETRIEVAL_MAP :87 (20 intents)
│   │   │   ├── "settings"      -> aiSettingsService.getAISettings() templeInformation + visitorInformation   index.ts:196-216
│   │   │   ├── "events"        -> getUpcomingEvents()      lib/ai/retrieval/events.ts:92    -> Firestore events
│   │   │   ├── "sevas"         -> getActiveSevas()         lib/ai/retrieval/sevas.ts:152    -> Firestore sevas
│   │   │   ├── "announcements" -> getActiveAnnouncements() lib/ai/retrieval/announcements.ts:83 -> Firestore announcements
│   │   │   ├── "panchanga"     -> getTodayPanchanga()      lib/ai/retrieval/panchanga.ts:81 -> public/data/panchanga/current.json + lib/panchanga-cache
│   │   │   ├── "donations"     -> getDonationInfo()        lib/ai/retrieval/donations.ts:31 -> getTempleSettings() lib/ai/retrieval/settings.ts:129 (Firestore settings, timings)
│   │   │   └── "aaradhane"     -> getNextAaradhane()       lib/ai/retrieval/aaradhane.ts:147 -> Firestore aaradhane
│   │   └── [knowledge intent, or no structured data]     lib/ai/retrieval/registry.ts:33-51
│   │       └── searchArticles(query, maxKnowledgeResults) lib/ai/knowledge/repository.ts:152 -> Supabase ai_knowledge (fallback SEED_ARTICLES)
│   ├── [safety.requireSourceForFacts && no source]       lib/ai/generator.ts:130-145 -> aiResponses.unknownQuestion
│   └── responseComposer.compose()                        lib/ai/response/composer.ts:29
│       ├── [confidence < extendedBehavior.confidenceThreshold * 100]  composer.ts:34,40-43 -> aiResponses.unknownQuestion
│       └── formatTempleSettings / Events / Sevas / Announcements / Panchanga / Donations / Aaradhane / Knowledge   composer.ts:78-142
├── updateSession()                                       services/conversation.service.ts:127 -> Firestore chat_sessions
├── [confidence < 50] logLowConfidenceQuestion()          lib/ai/unknown-logger.ts:63  -> Supabase unknown_questions
└── getResponseMetadata() (only when ?ux=true)            services/ux.service.ts       [chunk M10]
```

Caller side (chunk M09 and `apps/mobile`, listed for the API contract only): `components/ai/AIChatProvider.tsx:165`
posts `{messages, sessionId, userId, detectedLanguage}` and reads `{message, sessionId}`; it now mints the session id
itself on first load and keeps it in `localStorage` under `raya_session_id` (`AIChatProvider.tsx:61-69,192`), and it
writes each message to Supabase `chat_messages` through `services/chat.service.ts` (`AIChatProvider.tsx:113`).
`apps/mobile/app/(tabs)/ai.tsx:44` posts `{messages}` only - no `sessionId`.

### 2. AI settings routes (the AI Management Center backend) - one framework, nine settings routes plus three other callers

```
GET|PUT /api/ai/settings/<section> (server)
├── requireAdminUser(request)                             lib/auth/admin-auth.ts:198      [chunk M04]  (401 / 403 / 503 with a reason)
└── aiSettingsService                                     lib/ai/ai-settings/service.ts:31
    ├── aiAdminRepository (reads tried first)             lib/ai/ai-settings/admin-repository.ts:34
    │   └── Supabase ai_settings row id="main", unknown_questions      lib/supabase/admin.ts  [chunk M11]
    ├── aiSettingsRepository (read fallback, all writes)  lib/ai/ai-settings/repository.ts:34
    │   └── same tables; service-role client on the server, anon client in a browser (:35-37)
    └── AISettingsSchema.safeParse on every read          lib/ai/ai-settings/validation.ts:147  (writes are not validated - M08-F32)
```
Routes using this framework: `settings/route.ts`, `temple-information`, `visitor-information`, `policies`,
`ai-responses`, `ai-behavior`, `prompts`, `intents`, `unknown-questions`, plus `app/api/admin/prompts/*`
(chunk M12), `/api/ai/health` (admin repository read only) and `/api/ai/public-settings` (unauthenticated). The
nine settings routes take the actor from the verified `admin.uid`; the `x-user-id` header is no longer read.
`/api/seed-ai-settings` writes the same row directly with `createAdminClient()` and `getDefaultSeedPayload()`
(`lib/ai/ai-settings/seed-data.ts:89`).

### 3. Analytics routes

```
GET /api/ai/analytics[/health|/latency|/token-usage|/intent-distribution|/unknown-questions] (server)
└── services/ai-analytics.service.ts
    ├── getAnalyticsDashboard()      :558   -> the getters below + Firestore chat_sessions (:623) + chat_messages (:635)
    ├── checkAIHealth()              :469   -> getLatencyMetrics + getTokenUsage + thresholds
    ├── getLatencyMetrics()          :318   -> Supabase ai_latency_records
    ├── getTokenUsage()              :267   -> Firestore ai_token_usage
    ├── getIntentDistribution()      :365   -> Supabase ai_intent_distribution
    └── getUnknownQuestions()        :415   -> Supabase unknown_questions
    (record* writers at :98 :124 :160 :194 exist but are called from nowhere - see M08-F07)
```

### 4. Multi-source dashboard routes

```
GET /api/ai/multi-source/* (server)
└── services/multi-source-retrieval.service.ts
    ├── executeMultiSourceQuery()    :261   Promise.all over the five source getters
    │   └── dynamic import() of lib/ai/retrieval/{settings,panchanga,events,sevas,announcements}
    ├── generateCombinedResponse()          formats a plain-text digest
    ├── getRetrievalStats()          :457   (never populated - updateStats :464 has no callers)
    └── addToQueryHistory()          :558   in-process array, max 50
```

### 5. Unused sub-trees (present, wired to nothing)

```
lib/ai/composer/composer.ts:42       old ResponseComposer - confidence gating + related articles + nav buttons; same class name as the live lib/ai/response/composer.ts:25
lib/ai/conversation-memory.ts:32     in-memory session store, duplicate of services/conversation.service.ts
lib/ai/actions/actionRegistry.ts:46  14 registered browser actions (window.location, navigator.share)
lib/ai/actions/useAIActions.ts:1     'use client' hook (the only client file in this chunk)
lib/ai/knowledge/index.ts:32         getKnowledgeContext, formatArticlesWithSources, getSuggestedFollowUps, canned greeting/closing texts - the rewritten generator calls none of them
lib/ai/retrieval/settings.ts:180,195 getTempleTimings / getContactInfo (getTempleSettings :129 is still used by donations.ts:47 and the multi-source service)
```
`lib/ai/firebaseChat.ts` - removed 2026-10 - see Refresh log. `lib/ai/retrieval/index.ts` `INTENT_RETRIEVAL_MAP` /
`getContextForIntent` are live again since 2026-09-19 (called from `registry.ts:26`).

## Data flow

### Flow 1 - a devotee asks "what are the temple timings?"

1. `components/ai/AIChatProvider.tsx:165` (M09) `POST /api/chat` with `{messages, sessionId, userId, detectedLanguage}`.
   The web client mints `sessionId` itself on first load (`AIChatProvider.tsx:61-69`), so it always sends one.
2. `app/api/chat/route.ts:80` `checkRateLimit()` on `x-forwarded-for` - in-memory `Map`, 20 requests / 60 s.
3. `app/api/chat/route.ts:112` picks the last `role === "user"` message; `:124` derives `responseLanguage`
   by testing for the Kannada Unicode block.
4. `app/api/chat/route.ts:143` `getSessionContext()` loads `chat_sessions/{id}`; only if no id was sent does `:158`
   `generateSessionId()` mint a uuid into `effectiveSessionId`.
5. `app/api/chat/route.ts:162` `generateResponse(content, effectiveSessionId)` -> `lib/ai/generator.ts:48`.
6. `lib/ai/generator.ts:53` `detectIntent()` -> `lib/ai/intent/detector.ts:204`. Out-of-scope check first
   (`:216`), then keyword match over `INTENT_PATTERNS` (`:256`), then the "semantic" pass (`:285`), then
   `combineResults()` (`:521`). "temple timings" hits the `domainKeywords` override at `detector.ts:334`
   and returns `TEMPLE_TIMINGS` at confidence 100.
7. `lib/ai/generator.ts:57` reads the whole AI settings row (`aiSettingsService.getAISettings()`,
   `lib/ai/ai-settings/service.ts:34` -> Supabase `ai_settings` id `main`); not cached.
8. `lib/ai/generator.ts:127` `retrieve()` (`lib/ai/retrieval/registry.ts:17`) -> `getContextForIntent()`
   (`lib/ai/retrieval/index.ts:176`). `TEMPLE_TIMINGS` maps to the `"settings"` retriever, which reads the settings
   row **again** and copies `templeInformation.timings/contact/officeHours` and `visitorInformation` into a
   `TempleSettings` object (`index.ts:196-216`, source `REPOSITORY`). Firestore `settings`/`timings` are no longer
   consulted for this answer.
9. `lib/ai/generator.ts:130-145` safety gate (`safety.requireSourceForFacts`) passes; `:148`
   `responseComposer.compose()` reads the settings row a third time (`lib/ai/response/composer.ts:31`), checks
   `confidence >= extendedBehavior.confidenceThreshold * 100` (default 0.85 -> 85, `:34`) and formats the timings
   template (`composer.ts:79-80`): English for `en`, Kannada for both `kn` and `mixed`. `usesLLM: false`.
10. `app/api/chat/route.ts:183` `updateSession()` (`services/conversation.service.ts:127`) writes both messages
    into Firestore `chat_sessions/{effectiveSessionId}` with `arrayUnion`, then `pruneMessages()` (`:184`) trims to 20.
11. `app/api/chat/route.ts:192` if `confidence < 50`, `logLowConfidenceQuestion()`
    (`lib/ai/unknown-logger.ts:63`) inserts into Supabase `unknown_questions`.
12. `app/api/chat/route.ts:304-339` returns `{message, sessionId}` - **`sessionId` is still
    `resolvedSessionId || crypto.randomUUID()` (`:306`), not `effectiveSessionId`**. The web client is no longer
    affected because it always sends an id; the mobile client never does, so it gets a fresh unused id on every
    turn (see M08-F05).

### Flow 2 - a question nobody anticipated ("is the guest house wheelchair accessible?")

1. Steps 1-7 as above; `detectIntent` returns something below 60 confidence.
2. `lib/ai/generator.ts:62` low-confidence branch fires (unless the intent is OUT_OF_SCOPE / greeting /
   thanks / goodbye).
3. `lib/ai/generator.ts:71-83` if `extendedBehavior.enableUnknownQuestionLogging`, `logUnknownQuestion({question,
   detectedIntent, confidence, sessionId, language})` from `services/analytics.service.ts:17` -> Firestore
   `unknown_questions` with `{...data, timestamp, processed:false}`.
4. `lib/ai/generator.ts:85-92` returns the admin-editable `aiResponses.unknownQuestion` string with the
   **detector's real confidence** (the old static FAQ menu at confidence 80 is gone).
5. Because the real confidence is returned, step 11 of Flow 1 now fires for anything under 50: the same question
   is logged a second time, to Supabase `unknown_questions` with `status:'pending'`.
6. Admin triage reads Supabase `unknown_questions` on both screens (`app/api/ai/settings/unknown-questions/route.ts:11`
   -> `lib/ai/ai-settings/repository.ts:464`; `app/api/ai/analytics/unknown-questions/route.ts:8` ->
   `services/ai-analytics.service.ts:415`). Questions scoring 50-59 are therefore only in Firestore and never
   reach an admin; questions under 50 reach it once (M08-F08).
7. A question scoring 60-84 passes step 2 (so it is never logged) but fails the composer's 85 gate
   (`composer.ts:34,40-43`) and is answered with the same "couldn't find verified information" text (M08-F31).

### Flow 3 - "tell me about Guru Raghavendra Swamy" (knowledge path)

1. `detectIntent` -> `SRI_RAGHAVENDRA` (domain keyword `raghavendra`, `lib/ai/intent/detector.ts:407`).
2. `lib/ai/generator.ts:127` `retrieve()`: `SRI_RAGHAVENDRA` has no `INTENT_RETRIEVAL_MAP` row, and it is one of
   the seven knowledge intents (`lib/ai/retrieval/registry.ts:33-41`), so `searchArticles(query,
   extendedBehavior.maxKnowledgeResults)` (default 3) runs (`registry.ts:44`).
3. `getKnowledgeArticles()` (`lib/ai/knowledge/repository.ts:55`) reads Supabase `ai_knowledge` where
   `approved = true` ordered by `category, title` (`:69-74`), validates each row with `knowledgeArticleSchema`
   (`:45`, rows with empty `content` are dropped), caches 5 minutes, and falls back to the in-code `SEED_ARTICLES`
   (`lib/ai/knowledge/seed.ts:49`) when the table is empty (`:90-93`) or on any error (`:99-101`).
4. Ranking is unchanged (`repository.ts:152-210`): title hit +10, content hit +5, keyword hit +15 per query word,
   minimum 10, top N. Query words are raw substrings, stop-words included, so almost any question clears the bar
   (M08-F35). No embeddings, no vectors, despite `docs/AI_ENHANCEMENTS.md` marking "Semantic Embeddings" as done.
5. `lib/ai/response/composer.ts:60-61` -> `formatKnowledge()` (`:139-142`) returns the top article's `content`
   verbatim: no source line, no follow-ups, and no Kannada text even when `kannadaContent` exists. Confidence is
   the detector's, not a hardcoded 80.

### Flow 4 - "today's quote" (removed from the engine 2026-09-19)

1. `detectIntent` -> `DAILY_QUOTE` via `domainKeywords` (`lib/ai/intent/detector.ts:321-329`), the last entry of
   which is the bare substring `"quote"` - any message containing it is a `DAILY_QUOTE` at confidence 100.
2. `INTENT_RETRIEVAL_MAP` has no `DAILY_QUOTE` row, so `registry.ts:43` runs a knowledge search for the literal
   message. Neither `seed/ai/*.json` nor `SEED_ARTICLES` contains a quote, so the devotee gets either whichever
   article clears the 10-point bar or `aiResponses.unknownQuestion` (M08-F35).
3. The Quote Engine (`services/quote.service.ts`, chunk M03/M10) is no longer called from `lib/ai/**`; the
   debug-text leak and the 30-minute `setTimeout` map that lived in the old handler went with it (356de70).

### Flow 5 - admin edits the AI prompt

1. Admin UI (M09) `PUT /api/ai/settings/prompts` -> `app/api/ai/settings/prompts/route.ts:72`.
2. `requireAdminUser(request)` (`:74-77`); actor = the verified `admin.uid`.
3. `aiSettingsService.updatePromptVersion()` (`lib/ai/ai-settings/service.ts:426`) -> Supabase
   `ai_settings.prompt`.
4. `publishPromptVersion()` (`service.ts:441`) marks one version published and sets `currentPromptId`.
5. **Nothing in the chat path consumes it.** `getCurrentPrompt()` (`service.ts:402`) is called only by the admin
   routes (`app/api/ai/settings/prompts/route.ts:17`, `app/api/admin/prompts/route.ts:33`,
   `app/api/admin/prompts/[id]/publish/route.ts:40`). `lib/ai/settings.ts`
   (the old `settings/ai` prompt) was deleted 2026-10-14 (2891323), yet the commented-out LLM block still calls its
   `getSystemPrompt()` at `app/api/chat/route.ts:250`. Editing the prompt changes no devotee-visible behaviour.

### LLM provider configuration - what would run if the fallback were re-enabled

`lib/ai/provider.ts:33-67` picks one provider from `process.env.AI_PROVIDER` (default `openai`) and throws on
an unknown value. Nothing in the live path reaches any of this today (M08-F04; `lib/ai/provider.ts` is unchanged since 2026-09-19); it is listed because Recipe E
turns it on and because `GET /api/chat:385` already reports the provider, model and `configured` flag publicly.

| `AI_PROVIDER` | Key env var | Model env var / default | Base URL | Call site |
|---|---|---|---|---|
| `openai` (default) | `OPENAI_API_KEY` | `OPENAI_MODEL` / `gpt-4o-mini` | `https://api.openai.com/v1` | `provider.ts:96` |
| `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` / `openai/gpt-4o-mini` | `https://openrouter.ai/api/v1` | `provider.ts:96` (same OpenAI-compatible function; `:132` is the unused streaming twin `generateOpenAIStreamResponse` `:119`) |
| `claude` | `ANTHROPIC_API_KEY` | `CLAUDE_MODEL` / `claude-3-haiku-20240307` | `https://api.anthropic.com/v1` | `provider.ts:191` |
| `gemini` | `GOOGLE_GENERATIVE_API_KEY` | `GEMINI_MODEL` / `gemini-1.5-flash` | `https://generativelanguage.googleapis.com/v1beta` | `provider.ts:228` |

Cost controls: `max_tokens 2000` (Gemini: `maxOutputTokens`) is hardcoded at every call site and `temperature 0.7` at every
one except Claude, which sends no temperature (`provider.ts:105-106,141-142,203,241-242`; Claude body `:199-204`) - no env override, no per-user budget, no token accounting
(the recorders are dead, M08-F07). Timeouts: none - no `AbortController`, no retry, no circuit breaker
(M08-F29). Fallback between providers: none - `AIChatProvider.generateResponse` (`provider.ts:266-290`) switches on the
one configured provider and rethrows on failure (`:287-289`); there is no second provider and no retry.
It does measure its own latency and `console.log`s it (`:284-285`) without ever recording it (M08-F07). Key validation:
`isConfigured()` (`:316`) is broken for real OpenAI keys (M08-F11). `.env.example:26-39` declares
`AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` and comments out the Gemini (`GOOGLE_GENERATIVE_API_KEY`, `:33`), Anthropic and
OpenRouter keys; it does **not** declare `AI_HYBRID_MODE`, `GEMINI_MODEL` or `CLAUDE_MODEL`.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/api/chat/route.ts` | 397 | the chat endpoint | `POST`, `GET` | lines 232-286 are a commented-out LLM fallback (it still calls `getSystemPrompt`, whose module `lib/ai/settings.ts` was deleted); `sessionId` return bug at :306; lines 3-4 are blank where the `lib/ai/settings` / `lib/ai/firebaseChat` imports were removed (2891323) |
| `lib/ai/generator.ts` | 192 | orchestrator: language -> intent -> settings-driven gates -> retrieval -> composition | `generateResponse`, `detectIntent`, `getResponseMetadata`, `AIResponseResult`, `LOW_CONFIDENCE_THRESHOLD` | rewritten 2026-09-19 (356de70) from 1,191 lines; holds no answer text of its own any more; reads `ai_settings` at :57; `getResponseMetadata(result: any)` :183; unused import `IntentDetectionResult` :4 |
| `lib/ai/response/composer.ts` | 146 | bilingual Markdown templates per retrieved data type | `ResponseComposer`, `responseComposer`, `ComposerInput`, `ComposerOutput` | added 2026-09-19; file-wide `/* eslint-disable */` :1; gate `extendedBehavior.confidenceThreshold * 100` :34; `mixed` gets the Kannada template; imports `getResponseMetadata` from the generator (circular, unused) :5 |
| `lib/ai/retrieval/registry.ts` | 61 | intent -> structured retrieval -> knowledge fallback | `retrieve`, `RetrievalResult` | added 2026-09-19; knowledge search runs for the 7 knowledge intents or whenever structured data is empty (:33-51); `data: any` :8 |
| `lib/ai/intent/detector.ts` | 725 | 3-stage intent classifier | `IntentDetector`, `getIntentDetector`, `detectIntent` | `INTENT_EXAMPLES` map :33; ordered `domainKeywords` :319 (now leads with a bare `"quote"` and adds `"contact"`, `"address"`, `"seva"`); `VISITOR_GUIDELINES` still duplicated :616/:643 (the `DRESS_CODE` duplicate was removed); unused import `getBestSemanticMatch` :28 |
| `lib/ai/intent/patterns.ts` | 692 | 37 keyword patterns + out-of-scope filters | `INTENT_PATTERNS`, `OUT_OF_SCOPE_PATTERNS`, `OUT_OF_SCOPE_KEYWORDS`, `containsKannada`, `normalizeText` | out-of-scope uses substring `includes`, so `"pm"` and `"food"` misfire |
| `lib/ai/intent/types.ts` | 324 | Intent / IntentCategory / IntentPriority / RetrievalType enums | `Intent` (42 members), `IntentCategory`, `IntentPriority`, `RetrievalType`, `IntentDetectionResult`, `IntentPattern` | 42 intents, 37 patterns; `IntentPriority` values re-spread 2026-10-14 (342e5e9) to remove duplicate numbers |
| `lib/ai/intent/transliteration.ts` | 387 | Romanized Kannada -> Kannada script | `transliterateToKannada`, `enhanceWithTransliteration`, `ROMANIZED_KANNADA_PHRASES` | rule-based syllable tables |
| `lib/ai/intent/index.ts` | 20 | barrel | re-exports of the four above | |
| `lib/ai/retrieval/settings.ts` | 222 | temple settings / timings / contact from Firestore | `getTempleSettings`, `getTempleTimings`, `getContactInfo`, `clearSettingsCache` | reads Firestore `settings` (:65) + `timings` (:107); 5-min cache; flat `morningOpen…` defaults plus contact / officeHours / visitorInfo at :17; **no longer feeds the chat timings/contact answers** (those read Supabase `ai_settings`); still used by `donations.ts:47` and the multi-source service; `getTempleTimings` / `getContactInfo` are dead |
| `lib/ai/retrieval/events.ts` | 233 | upcoming events | `getUpcomingEvents`, `getFeaturedEvent`, `getEventsByCategory`, `formatEventsListForDisplay`, `formatEventForDisplay`, `clearEventsCache` | Firestore `events` |
| `lib/ai/retrieval/sevas.ts` | 308 | active sevas | `getActiveSevas`, `getSevasByCategory`, `getDailySevas`, `getSpecialSevas`, `getSevaCategories`, `formatSevasListForDisplay`, `formatSevaForDisplay`, `clearSevasCache` | Firestore `sevas` |
| `lib/ai/retrieval/announcements.ts` | 169 | active announcements | `getActiveAnnouncements`, `getLatestAnnouncements`, `formatAnnouncementsForDisplay`, `clearAnnouncementsCache` | Firestore `announcements`; 2-min cache |
| `lib/ai/retrieval/panchanga.ts` | 230 | today's panchanga | `getTodayPanchanga`, `getPanchangaForDate`, `formatPanchangaForDisplay`, `formatPanchangaSimple`, `clearPanchangaCache` | **filesystem read** `public/data/panchanga/current.json` via `fs` :42-45 |
| `lib/ai/retrieval/donations.ts` | 142 | donation info + 80G | `getDonationInfo`, `formatDonationInfoForDisplay`, `formatDonationPurposeForDisplay`, `format80GInfo`, `clearDonationInfoCache` | derived from settings, purposes hardcoded |
| `lib/ai/retrieval/aaradhane.ts` | 239 | aaradhane calendar | `getAaradhanes`, `getUpcomingAaradhanes`, `getNextAaradhane`, `formatAaradhaneForDisplay`, `formatUpcomingAaradhanes`, `clearAaradhaneCache` | Firestore `aaradhane` |
| `lib/ai/retrieval/types.ts` | 183 | retrieval DTOs | `RetrievedData`, `TempleSettings`, `TempleEvent`, `TempleSeva`, `TempleAnnouncement`, `PanchangaData`, `AaradhaneEvent`, `DonationInfo`, `KnowledgeArticle`, `AIResponseContext`, `IntentRetrievalMapping`, `UnknownQuestionLog` | `TempleSettings` gained `contact`, `officeHours`, `visitorInfo` (typed from `../ai-settings`) and flat timings; `DonationInfo` gained `bankDetails`; still duplicates `types/multi-source-retrieval.ts` shapes |
| `lib/ai/retrieval/index.ts` | 283 | barrel + intent->retriever map | `INTENT_RETRIEVAL_MAP`, `getContextForIntent`, `clearAllCaches` | **live again** via `registry.ts:26`; 20 mapped intents (:87-171, gained OFFICE_HOURS, PHOTOGRAPHY, PARKING, SEVA_BOOKING); the `"settings"` retriever reads Supabase `ai_settings` (:196-216); `clearAllCaches` (:274) still unused; the type re-exports were removed |
| `lib/ai/knowledge/index.ts` | 354 | knowledge formatting + canned replies | `getKnowledgeContext`, `formatArticleForContext`, `formatArticlesForContext`, `formatArticlesWithSources`, `getSuggestedFollowUps`, `getGreetingResponse`, `getClosingResponse`, `getOutOfScopeResponse`, `getThankYouResponse` | **dead since 2026-09-19**: the rewritten generator calls none of these; only `tests/ai-uat/ai-uat.test.ts` and `tests/unit/response-generator.test.ts` mock them |
| `lib/ai/knowledge/repository.ts` | 386 | Supabase `ai_knowledge` CRUD + search | `getKnowledgeArticles`, `getArticleById`, `getArticleBySlug`, `getArticlesByCategory`, `searchArticles`, `createArticle`, `updateArticle`, `deleteArticle`, `approveArticle`, `markAsReviewed`, `getPendingArticles`, `getCategoriesWithCounts`, `clearKnowledgeCache` | moved from Firestore `knowledge` 2026-10-06 (fdaff98); service-role client on the server, anon in a browser (:62); rows validated with `knowledgeArticleSchema` (:45); `approved ?? false` (:39); silent seed fallback :90-101 |
| `lib/ai/knowledge/validation.ts` | 56 | zod schemas for knowledge articles | `knowledgeArticleSchema`, `knowledgeArticleRequestSchema`, `knowledgeArticleUpdateSchema`, `knowledgeLanguageSchema`, `knowledgeCategorySchema` | added 2026-10-06; `content` must be non-empty (:18); imported but unused by `scripts/seed-ai-knowledge.ts:16` |
| `lib/ai/knowledge/seed.ts` | 835 | in-code seed articles | `SEED_ARTICLES`, `getSeedArticlesForFirebase` | fallback when Supabase `ai_knowledge` yields no approved valid rows or errors (`repository.ts:90-101`); `getSeedArticlesForFirebase` (:828) has no caller |
| `lib/ai/knowledge/types.ts` | 178 | knowledge model | `KnowledgeArticle`, `KnowledgeArticleRequest`, `KnowledgeArticleUpdate`, `KnowledgeSearchResult`, `KnowledgeCategory`, `KnowledgeLanguage`, `CATEGORY_DISPLAY_NAMES`, `CATEGORY_ICONS` | imported by 7 files outside M08 (plus `services/knowledge.service.ts` inside it) |
| `lib/ai/ai-settings/service.ts` | 628 | AI Management Center facade (60+ methods) | `AISettingsService`, `aiSettingsService` | `getAISettings` :34 - admin repo, then client repo, then **upsert of defaults** (:45), then in-memory defaults on throw; no cache; adds `updateGeneralSettings` / `updateSafetySettings` / `updateExtendedBehaviorSettings` (:89-99) |
| `lib/ai/ai-settings/repository.ts` | 581 | Supabase `ai_settings` row `main` + `unknown_questions` (every write) | `AISettingsRepository`, `aiSettingsRepository` | rebuilt on Supabase 2026-10-06 (fae5d51); service-role client on the server, anon in a browser (:35-37); `AISettingsSchema.safeParse` on read (:70); no validation on write (`updateSettings` :129) |
| `lib/ai/ai-settings/admin-repository.ts` | 384 | service-role reads, default creation, prompt-version writes, unknown-question triage | `AIAdminRepository`, `aiAdminRepository` | Supabase only (`lib/supabase/admin`); `createDefaultSettings` upserts the whole row (:108); `updatePromptSettings` ignores the Supabase error (:131-140) |
| `lib/ai/ai-settings/index.ts` | 49 | barrel + type/default re-exports | — | now also re-exports `AIGeneralSettings`, `AISafetySettings`, `AIExtendedBehaviorSettings` and their defaults |
| `lib/ai/ai-settings/seed-data.ts` | 118 | default seed payload in column (snake_case) shape | `seedPromptContent`, `SEED_DEFAULT_INTENTS`, `getDefaultSeedPayload` | added 2026-10-06; used by `app/api/seed-ai-settings/route.ts:18` and `scripts/seed-ai-settings-supabase.ts:4` (unowned) |
| `lib/ai/ai-settings/validation.ts` | 162 | zod schemas for the settings row | `AISettingsSchema`, `AIGeneralSettingsSchema`, `AISafetySettingsSchema`, `AIExtendedBehaviorSettingsSchema`, `TempleInformationSchema`, `VisitorInformationSchema`, `TemplePoliciesSchema`, `AIResponsesSchema`, `PromptSettingsSchema`, `IntentSettingsSchema` | added 2026-10-06; `confidenceThreshold` 0-1 (:22); legacy `aiBehavior: z.any()` (:156); used on read only |
| `lib/ai/provider.ts` | 338 | LLM provider abstraction | `AIChatProvider`, `getAIProvider` | OpenAI / OpenRouter / Gemini / Claude; `isPlaceholderKey` :27 rejects any key containing `sk-` |
| ~~`lib/ai/settings.ts`~~ | ~~112~~ | removed 2026-10 - see Refresh log (2891323) | — | the browser now gets the welcome text from `GET /api/ai/public-settings`; the commented-out LLM block still references its `getSystemPrompt` |
| `lib/ai/prompt-refactored.ts` | 121 | V2 prompt with no hardcoded facts | `SYSTEM_PROMPT_V2`, `WELCOME_MESSAGE_V2`, `SUGGESTED_QUESTIONS_V2` | reachable only through the `lib/ai/index.ts` barrel since `lib/ai/settings.ts` was deleted - no runtime consumer |
| `lib/ai/systemPrompt.ts` | 283 | legacy V1 prompt with hardcoded facts | `SYSTEM_PROMPT`, `WELCOME_MESSAGE`, `WELCOME_MESSAGE_KANNADA`, `WELCOME_MESSAGE_MIXED`, `SUGGESTED_QUESTIONS`, `SUGGESTED_QUESTIONS_KANNADA`, `ERROR_MESSAGES`, `ERROR_MESSAGES_KANNADA` | at runtime only `SUGGESTED_QUESTIONS` is used, by `components/ai/SuggestedQuestions.tsx` (M09); all eight exports are also imported by `tests/unit/system-prompt.test.ts:5-13`, which asserts the prompt holds no hardcoded facts |
| `lib/ai/languageDetector.ts` | 181 | standalone language detector | `detectLanguage`, `DetectedLanguage` | used by the client provider (M09), **not** by the server path, which has its own copy at `generator.ts:30` |
| `lib/ai/unknown-logger.ts` | 225 | Supabase `unknown_questions` writer/reader | `logUnknownQuestion`, `logLowConfidenceQuestion`, `logFailedKnowledgeLookup`, `getRecentUnknownQuestions`, `getUnknownQuestionStats` | moved to Supabase 2026-10-13 (3d0d3b2, 6a5a296); `ip` / `userAgent` options still accepted (:20-25) but no longer stored; positional-arg `logUnknownQuestion` still collides by name with the object-arg Firestore writer in `services/analytics.service.ts` |
| `lib/ai/index.ts` | 48 | public barrel for the engine | `generateResponse`, `detectIntent`, `logLowConfidenceQuestion`, knowledge helpers, `SYSTEM_PROMPT_V2` | re-exports both `detectIntent` (generator) and the whole `./intent` barrel, plus `export *` of `./retrieval` and `detectLanguage` from `./languageDetector`; unchanged since 2026-09-19 |
| `lib/ai/health-classify.ts` | 225 | AI Health dashboard classification (auth vs forbidden vs connectivity vs missing data) | `classifyHttpResult`, `classifyFetchError`, `classifyDataIntegrity`, `isEmptyPayload`, `HealthStatus`, `HealthCategory`, `HealthClassification`, `SettingsPresenceInput`, `DataIntegrityResult` | added 2026-10-15 (8d54714); pure; used by `app/admin/ai/health/page.tsx:24` (M09) and `tests/unit/ai-health-classify.test.ts` |
| `lib/ai/composer/composer.ts` | 520 | old confidence gating + related articles + nav buttons | `ResponseComposer`, `responseComposer`, `ComposerResponse`, `ComposerConfig` | **dead** - no importer outside `composer/index.ts`; exports the same class / singleton names as the live `lib/ai/response/composer.ts` |
| `lib/ai/composer/index.ts` | 4 | barrel | — | dead |
| `lib/ai/conversation-memory.ts` | 244 | in-memory session/follow-up store | `getSession`, `addMessage`, `SessionContext`, `ConversationMessage` | **dead** - zero importers; duplicates `services/conversation.service.ts` |
| ~~`lib/ai/firebaseChat.ts`~~ | ~~723~~ | removed 2026-10 - see Refresh log (2891323) | — | took the `chatTraining` / `trust` reads and the personal Gmail fallback with it |
| `lib/ai/actions/actionRegistry.ts` | 427 | 14 browser-side actions | `registerAction`, `executeAction`, `getActionsForIntent`, `parseActionsFromResponse`, `AIAction`, `ActionType`, `ActionResult` | **dead**; pure DOM (`window.location`, `navigator.share`) |
| `lib/ai/actions/useAIActions.ts` | 57 | `'use client'` hook over the registry | `useAIActions`, `executeActionsFromAIResponse` | dead; the only client file in M08 |
| `lib/ai/actions/index.ts` | 12 | barrel | — | dead |
| `services/chat.service.ts` | 342 | Supabase sessions/messages; Firestore testimonials, volunteers, feedback | `createChatSession`, `updateChatSession`, `getChatSession`, `getUserChatSessions`, `saveMessage`, `getSessionMessages`, `submitTestimonial`, `getApprovedTestimonials`, `getPendingTestimonials`, `approveTestimonial`, `deleteTestimonial`, `submitVolunteerRequest`, `getVolunteerRequests`, `updateVolunteerRequestStatus`, `submitFeedback`, `getFeedbackStats` | sessions/messages moved to Supabase 2026-10-06 (224875d) and are written from the browser with the anon client; a second import block sits mid-file at :172-186; `createAdminClient` imported at :3 and never used |
| `services/conversation.service.ts` | 373 | conversation sessions + follow-up heuristics | `generateSessionId`, `getSession`, `createSession`, `updateSession`, `detectFollowUp`, `getSessionContext`, `clearSession`, `deleteSession` | `createSession` and `clearSession` are imported by the route but never called |
| `services/knowledge.service.ts` | 286 | public Knowledge Centre reads | `getKnowledgeCategories`, `getPopularArticles`, `getRecentArticles`, `getFeaturedArticle`, `getKnowledgeCentreData`, `getPublicArticleBySlug`, `getPublicArticlesByCategory`, `searchKnowledge`, `getRelatedArticles`, `getArticlePageData`, `getAllArticleSlugs`, `getAllCategorySlugs`, `knowledgeService` | view counts held in a module `Map` (`:28`) |
| `services/multi-source-retrieval.service.ts` | 586 | dashboard fan-out | `executeMultiSourceQuery`, `getTempleOverview`, `getTodayInfo`, `QUICK_QUERIES`, `getIntentSuggestions`, `getRetrievalStats`, `resetRetrievalStats`, `updateFreshness`, `getDataFreshness`, `addToQueryHistory`, `getQueryHistory`, `clearQueryHistory` | 5 `any` uses; `updateStats`/`updateFreshness` never called |
| `services/ml.service.ts` | 461 | similarity, typo correction, learned corrections | `calculateIntentSimilarity`, `getBestSemanticMatch`, `levenshteinDistance`, `fuzzyMatch`, `autoCorrectMessage`, `learnFromCorrection`, `getCorrectedIntent`, `getLearnedCorrections`, `clearLearnedCorrections`, `getCorrectionCount`, `exportCorrections`, `SemanticMatch`, `FuzzyMatch`, `CorrectionEntry` | "ML" = weighted keyword sets + Levenshtein; typo table gained 8 identity entries and a `distance <= 2` cap with an `address`/`dress` exception (:280); `learnFromCorrection` (:360) has no callers so `getCorrectedIntent` always returns null |
| `services/ai-analytics.service.ts` | 898 | analytics reads and (unused) writes | `getAnalyticsSettings`, `recordTokenUsage`, `recordLatency`, `recordIntentDistribution`, `recordUnknownQuestion`, `markUnknownQuestionReviewed`, `getTokenUsage`, `getLatencyMetrics`, `getIntentDistribution`, `getUnknownQuestions`, `checkAIHealth`, `getAnalyticsDashboard` | latency, intent-distribution and unknown-question reads/writes moved to Supabase 2026-10-13 (BOT-004); token usage, analytics settings and the dashboard's session counts still Firestore; `as any` at :143, :474 and five more |
| `app/api/ai/analytics/route.ts` | 28 | dashboard aggregate | `GET` | |
| `app/api/ai/analytics/health/route.ts` | 22 | health | `GET` | |
| `app/api/ai/analytics/latency/route.ts` | 32 | latency | `GET` | Supabase; the `intent` query parameter is ignored since 2026-10-13 |
| `app/api/ai/analytics/token-usage/route.ts` | 33 | token usage | `GET` | |
| `app/api/ai/analytics/intent-distribution/route.ts` | 32 | intent mix | `GET` | |
| `app/api/ai/analytics/unknown-questions/route.ts` | 62 | unknown Qs (Supabase `unknown_questions` since 2026-10-13; was Firestore `ai_unknown_questions`) | `GET`, `PATCH` | unauthenticated PATCH writes with the service-role key (M08-F01) |
| `app/api/ai/knowledge/coverage/route.ts` | 144 | category coverage report | `GET` | 30 expected categories hardcoded :7-43; still reads Firestore `knowledge` (:81), not `ai_knowledge` |
| `app/api/ai/knowledge/import/route.ts` | 157 | seed importer over HTTP | `POST` | reads `seed/ai/*.json` with `fs`; writes Firestore `knowledge` (:114), which the engine no longer reads |
| `app/api/ai/multi-source/overview/route.ts` | 19 | all sources | `GET` | |
| `app/api/ai/multi-source/today/route.ts` | 19 | today's info | `GET` | |
| `app/api/ai/multi-source/query/route.ts` | 54 | ad-hoc query | `POST` | |
| `app/api/ai/multi-source/quick-queries/route.ts` | 13 | static presets | `GET` | |
| `app/api/ai/multi-source/statistics/route.ts` | 26 | stats + freshness + history | `GET` | always zeroed |
| `app/api/ai/settings/route.ts` | 100 | whole-settings read/mutate | `GET`, `POST` | `requireAdminUser` at :10,29; three new POST actions :46-56; `data` is written unvalidated |
| `app/api/ai/settings/temple-information/route.ts` | 77 | timings/contact/office hours | `GET`, `PUT` | admin-guarded; `force-dynamic` + `no-store` (:11, :21) |
| `app/api/ai/settings/visitor-information/route.ts` | 79 | guidelines, dress code, parking… | `GET`, `PUT` | admin-guarded; now devotee-visible through the composer |
| `app/api/ai/settings/policies/route.ts` | 65 | donation / 80G / seva policies | `GET`, `PUT` | admin-guarded; never read by the engine |
| `app/api/ai/settings/ai-responses/route.ts` | 56 | response templates | `GET`, `PUT` | admin-guarded; `unknownQuestion`, `welcome`, `goodbye`, `outOfScope` are now devotee-visible |
| `app/api/ai/settings/ai-behavior/route.ts` | 78 | confidence threshold, debug, streaming | `GET`, `PUT` | admin-guarded; PUT `all` rebuilds the object with defaults (`confidenceThreshold ?? 85`, :46-58) into the legacy `ai_behavior` column, which the engine never reads |
| `app/api/ai/settings/prompts/route.ts` | 118 | prompt versions | `GET`, `POST`, `PUT` | admin-guarded; published prompt is never used at runtime |
| `app/api/ai/settings/intents/route.ts` | 145 | intent metadata CRUD | `GET`, `POST`, `PUT`, `DELETE` | admin-guarded; detector reads code constants, not this store |
| `app/api/ai/settings/unknown-questions/route.ts` | 154 | triage (Supabase) | `GET`, `POST`, `PUT`, `DELETE` | admin-guarded |
| `app/api/ai/health/route.ts` | 87 | AI Health datastore probe | `GET` | added 2026-10-15 (8d54714); admin-guarded; read-only by design (asserted in `tests/unit/ai-api-auth-wiring.test.ts`) |
| `app/api/ai/public-settings/route.ts` | 19 | public welcome text | `GET` | added 2026-10-14 (3446b0b); unauthenticated; calls `getAISettings`, which can upsert defaults (M08-F32) |
| `app/api/seed-ai-settings/route.ts` | 175 | idempotent Supabase settings seeder | `POST` | rewritten 2026-10-06/15 (fae5d51, 8d54714): admin-guarded, no Firebase literals, no Firestore writes, repairs only empty sections |
| `types/ai.ts` | 120 | chat contracts | `AIMessage`, `ChatSession`, `AIProvider`, `ChatRequest`, `ChatResponse`, `ChatFeedback`, `Testimonial`, `VolunteerRequest`, `SuggestedQuestion`, `AIAnalytics`, `AIAction`, `KnowledgeItem`, `DetectedLanguage` | the React Native contract lives here |
| `types/ai-settings.ts` | 358 | AI Management Center model + defaults | `AISettings`, `AIGeneralSettings`, `AISafetySettings`, `AIExtendedBehaviorSettings`, `TempleInformation`, `VisitorInformation`, `TemplePolicies`, `AIResponses`, `AIBehaviorSettings`, `PromptSettings`, `PromptVersion`, `IntentSettings`, `IntentMetadata`, `UnknownQuestion`, `DEFAULT_*` | `AISettings` gained `general`, `safety`, `extendedBehavior` (:342-344); `aiBehavior` marked legacy |
| `types/ai-analytics.ts` | 261 | analytics records and summaries | `TokenUsageRecord`, `LatencyRecord`, `IntentDistributionRecord`, `UnknownQuestionRecord`, `AIHealthStatus`, `*Summary`, `*Response`, `AIAnalyticsDashboard`, `AIAnalyticsSettings` | records that are never written; `LatencyRecord.messageId` / `.intent` made optional (:30,36) to match the Supabase table |
| `types/multi-source-retrieval.ts` | 238 | dashboard model | `DataSource`, `MultiSourceQuery`, `SourceResult`, `MultiSourceResponse`, `TempleSettingsData`, `TempleEvent`, `TempleSeva`, `TempleAnnouncement`, `PanchangaData`, `QuickQuery`, `RetrievalStats`, `DataFreshness`, `QueryHistoryEntry` | duplicates `lib/ai/retrieval/types.ts` |
| `types/knowledge.ts` | 232 | public Knowledge Centre view model | `KnowledgeArticlePublic`, `KnowledgeCategoryInfo`, `KnowledgeCentreData`, `KnowledgeBookmark`, `RecentlyViewed`, `SearchSuggestion`, `ArticlePageData`, `BreadcrumbItem`, `KNOWLEDGE_CATEGORY_CONFIG` | re-exports from `lib/ai/knowledge/types` |
| `seed/ai/*.json` (15 files, 15 lines each except `seed/ai/faq.json` 48) | 258 | seed knowledge articles: `seed/ai/about-trust.json`, `seed/ai/accommodation.json`, `seed/ai/brindavana.json`, `seed/ai/contact.json`, `seed/ai/donation.json`, `seed/ai/dress-code.json`, `seed/ai/facilities.json`, `seed/ai/faq.json`, `seed/ai/history.json`, `seed/ai/parking.json`, `seed/ai/photography.json`, `seed/ai/raghavendra-swamy.json`, `seed/ai/temple-timings.json`, `seed/ai/visitor-guidelines.json`, `seed/ai/volunteer.json` | JSON | every file has `slug,title,category,language,keywords,summary,content,approved,version,lastReviewed,reviewedBy,tags` **except `seed/ai/faq.json`, which has `questions` instead of `content`** |
| `scripts/seed-ai-knowledge.ts` | 139 | CLI seeder | `seedKnowledge` (default run) | writes Supabase **`ai_knowledge`** (`:95`) since 2026-10-06 - but `approved: article.published ?? false` (:103) and `keywords` from `tags` (:100), see M08-F36 |
| `scripts/seed-ai-settings.ts` | 535 | CLI settings seeder | `seedAISettings` | still writes Firestore `ai_settings/main` (`:504`) via firebase-admin - orphaned since the Management Center moved to Supabase; the Supabase twin is `scripts/seed-ai-settings-supabase.ts` (unowned) |
| `scripts/migrate-ai-to-supabase.ts` | 75 | Firestore -> Supabase copy | migration entry | rewritten 2026-09-21 (d71898d): delegates to `lib/supabase/migration-mappers.ts` / `migration-runner.ts`; `--dry-run`; collections listed at :40-46 |

## Types and stores

**Type modules owned here:** `types/ai.ts`, `types/ai-settings.ts`, `types/ai-analytics.ts`,
`types/multi-source-retrieval.ts`, `types/knowledge.ts`, plus the module-local `lib/ai/intent/types.ts`,
`lib/ai/retrieval/types.ts`, `lib/ai/knowledge/types.ts`, and the zod schemas in `lib/ai/ai-settings/validation.ts`
and `lib/ai/knowledge/validation.ts`. `types/quote.ts` is no longer imported by the engine (the quote handler was
removed 2026-09-19).

**Firestore collections**

| Collection | Read by | Written by |
|---|---|---|
| `settings` | `lib/ai/retrieval/settings.ts:65` (donations answer + multi-source dashboard only) | — (M05 admin) |
| `timings` | `lib/ai/retrieval/settings.ts:107` | — |
| `events` | `lib/ai/retrieval/events.ts:66` | — (the admin events service now writes Supabase `events`, `services/event.service.ts:90` - M08-F34) |
| `sevas` | `lib/ai/retrieval/sevas.ts:125` | — |
| `announcements` | `lib/ai/retrieval/announcements.ts:58` | — |
| `aaradhane` | `lib/ai/retrieval/aaradhane.ts:65` | — |
| ~~`trust`~~, ~~`chatTraining`~~ | removed 2026-10 with `lib/ai/firebaseChat.ts` - see Refresh log | |
| `knowledge` | `app/api/ai/knowledge/coverage/route.ts:81`, `app/api/ai/knowledge/import/route.ts:73` | `app/api/ai/knowledge/import/route.ts:114` - **orphaned: the engine reads Supabase `ai_knowledge` since 2026-10-06** |
| `articles` | — | — (the CLI seeder moved to Supabase; any data here is a leftover) |
| ~~`settings/ai` (doc)~~ | removed 2026-10 with `lib/ai/settings.ts` - see Refresh log | |
| `ai_settings` (collection / `main` doc) | `services/ai-analytics.service.ts:64` (analytics thresholds) | `scripts/seed-ai-settings.ts:504` - orphaned for the Management Center, which moved to Supabase |
| ~~`ai_settings/%20RayaAI`, `ai_settings/prompts`, `ai_settings/intents`, `ai_settings/unknown_questions`, `ai_settings/welcome`, `settings/temple`, `settings/contact`, `settings/visitor` seeder writes~~ | removed 2026-10 (seed route rewritten, fae5d51) - see Refresh log | |
| `chat_sessions` | `services/conversation.service.ts:61`, `services/ai-analytics.service.ts:623` | `services/conversation.service.ts:112,161,199,348` (the chat route) |
| ~~`messages`~~ | `services/chat.service.ts` moved to Supabase `chat_messages` 2026-10-06 | |
| `chat_messages` | `services/ai-analytics.service.ts:635` | — (nothing writes Firestore `chat_messages`) |
| `testimonials`, `volunteer_requests`, `feedback` | `services/chat.service.ts:213,231,279,325` | `services/chat.service.ts:205,247,255,271,297,314` |
| `unknown_questions` | `services/analytics.service.ts:75,111` (M10) | `services/analytics.service.ts:31` (`processed:false`) - the generator's confidence < 60 path |
| `ai_token_usage` | `services/ai-analytics.service.ts:279` | writer `:108` has no callers |
| ~~`ai_latency_records`, `ai_intent_distribution`, `ai_unknown_questions` (Firestore)~~ | reads moved to Supabase 2026-10-13 - see Refresh log | |

**Supabase tables** (DDL: `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql:5-129`)

| Table | Read by | Written by |
|---|---|---|
| `ai_settings` (row `main`) | `lib/ai/ai-settings/admin-repository.ts:42`, `lib/ai/ai-settings/repository.ts:42`, `app/api/seed-ai-settings/route.ts:77` - read 3-4 times per chat turn | `lib/ai/ai-settings/repository.ts:106,146` (every update method), `admin-repository.ts:108,133`, `app/api/seed-ai-settings/route.ts:96,145` |
| `ai_knowledge` | `lib/ai/knowledge/repository.ts:70,124,336` | `lib/ai/knowledge/repository.ts:236,277,300`; `scripts/seed-ai-knowledge.ts:95`; `scripts/migrate-ai-knowledge.ts:47-52` (unowned: copies Firestore `knowledge` via `mapAiKnowledge`) |
| `unknown_questions` | `lib/ai/ai-settings/repository.ts:472`, `admin-repository.ts:309`, `lib/ai/unknown-logger.ts:129,182`, `services/ai-analytics.service.ts:422` | `lib/ai/unknown-logger.ts:30` (chat route, confidence < 50), `lib/ai/ai-settings/repository.ts:412,436,447,531,540`, `admin-repository.ts:364,374`, `services/ai-analytics.service.ts:205,244` |
| `ai_latency_records` | `services/ai-analytics.service.ts:325` | `:135` (dead) |
| `ai_intent_distribution` | `services/ai-analytics.service.ts:372` | `:171` (dead) |
| `chat_sessions`, `chat_messages` | `services/chat.service.ts:51,80,148` (browser history) | `services/chat.service.ts:11,38,109,133` (browser, anon client) - refused by the deny-all RLS policies in `supabase/migrations/20260930000000_create_ai_tables.sql:85-86,92-93` (M08-F38) |
| `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records` | — | `scripts/migrate-ai-to-supabase.ts:40-46` - hand-run one-shot Firestore->Supabase copy; Firestore `messages` lands in Supabase `chat_messages` |

**Static files**

| File | Read by |
|---|---|
| `public/data/panchanga/current.json` | `lib/ai/retrieval/panchanga.ts:42` via `fs.readFileSync` |
| `seed/ai/*.json` | `app/api/ai/knowledge/import/route.ts:96`, `scripts/seed-ai-knowledge.ts:79` |

## Cross-module dependencies

**M08 imports from other chunks** (re-derived by grep on 2026-10-18):

| Imported | Chunk | Used by |
|---|---|---|
| `lib/firebase.ts` | M11 | 10 files: the five Firestore retrieval modules (`settings`, `events`, `sevas`, `announcements`, `aaradhane`), `services/{chat,conversation,ai-analytics}.service.ts`, `app/api/ai/knowledge/{coverage,import}/route.ts` |
| `lib/admin-firebase.ts` | M11 | `scripts/migrate-ai-to-supabase.ts` only (the admin repository moved to Supabase) |
| `lib/supabase/client.ts` | M11 | `lib/ai/ai-settings/repository.ts`, `lib/ai/knowledge/repository.ts`, `lib/ai/unknown-logger.ts`, `services/chat.service.ts`, `services/ai-analytics.service.ts` |
| `lib/supabase/admin.ts` (`import 'server-only'`) | M11 | `lib/ai/ai-settings/{admin-repository,repository}.ts`, `lib/ai/knowledge/repository.ts`, `lib/ai/unknown-logger.ts`, `services/{chat,ai-analytics}.service.ts`, `app/api/seed-ai-settings/route.ts`, `scripts/seed-ai-knowledge.ts`, `scripts/migrate-ai-to-supabase.ts` |
| `lib/supabase/migration-mappers.ts`, `lib/supabase/migration-runner.ts` | M11 | `scripts/migrate-ai-to-supabase.ts` |
| `lib/auth/admin-auth.ts` (`requireAdminUser`) | M04 | the nine `app/api/ai/settings/**` routes, `app/api/ai/health/route.ts`, `app/api/seed-ai-settings/route.ts` |
| `lib/panchanga-cache.ts` | M14 | `lib/ai/retrieval/panchanga.ts` |
| `services/analytics.service.ts` | M10 | `lib/ai/generator.ts` (unknown-question logging), `services/ml.service.ts` (`logIntentFeedback`) |
| ~~`services/quote.service.ts`, `types/quote.ts`~~ | M03/M10 | no longer imported - quote handler removed 2026-09-19 (356de70) |
| `services/ux.service.ts` | M10 | `app/api/chat/route.ts` (quick actions, suggested questions) |

**Who imports M08** (from `import-graph.json`, re-checked by grep):

| M08 file | Imported by | Chunk |
|---|---|---|
| `lib/ai/knowledge/types.ts` | `app/admin/ai/unknown-questions/page.tsx`, `app/admin/knowledge/page.tsx`, `app/api/knowledge/workflow/{articles,drafts}/route.ts`, `components/ai/KnowledgeWorkflowDashboard.tsx`, `services/content.service.ts`, `services/knowledge-workflow.service.ts` (7 files) | M09, M12, M10 |
| `lib/ai/knowledge/repository.ts`, `lib/ai/knowledge/seed.ts` | `app/api/admin/knowledge/route.ts`, `app/api/admin/knowledge/[id]/route.ts` | M12 |
| `lib/ai/ai-settings/index.ts` | `app/api/admin/prompts/route.ts` and its `[id]` routes | M12 |
| `lib/ai/ai-settings/seed-data.ts` | `scripts/seed-ai-settings-supabase.ts` | unowned |
| `lib/ai/health-classify.ts` | `app/admin/ai/health/page.tsx` | M09 |
| `lib/ai/intent/types.ts` | `components/ai/AIAnalyticsDashboard.tsx`, `services/ux.service.ts` | M09, M10 |
| `lib/ai/languageDetector.ts` | `components/ai/AIChatProvider.tsx` | M09 |
| `lib/ai/systemPrompt.ts` | `components/ai/SuggestedQuestions.tsx` | M09 |
| `services/chat.service.ts` | `components/ai/AIChatProvider.tsx`, `app/admin/ai/{page,testimonials/page,volunteers/page}.tsx`, `app/api/{testimonials,volunteer}/route.ts` (6) | M09, M12 |
| `services/knowledge.service.ts` | `app/knowledge/*`, `app/api/knowledge/*`, `app/(public)/favorites/page.tsx`, `components/common/PersonalizedHomepage.tsx` (9) | M02, M12, `components/common` |
| `types/ai.ts`, `types/ai-settings.ts`, `types/ai-analytics.ts`, `types/multi-source-retrieval.ts`, `types/knowledge.ts` | admin pages and chat components | M09, M02 |
| `POST /api/chat` (over HTTP, no import) | `apps/mobile/app/(tabs)/ai.tsx:44` | mobile |
| `GET /api/ai/public-settings` (over HTTP) | `components/ai/AIChatProvider.tsx:78` | M09 |

Boundary note: `lib/ai/settings.ts` was deleted 2026-10-14, so the browser no longer reads AI settings from
Firestore - it fetches `/api/ai/public-settings`. The browser still writes chat history straight to Supabase
(`services/chat.service.ts` with the anon client, called from `AIChatProvider.tsx:113`), while the server writes
the same conversation to Firestore (M08-F37).

## How to change it

### Recipe A - add a new intent end to end (e.g. `LOST_AND_FOUND`)
1. `lib/ai/intent/types.ts` - add the enum member to `Intent` and a **unique** number to `IntentPriority`
   (duplicates were cleaned out 2026-10-14); map it in `IntentCategory` if a new grouping is needed.
2. `lib/ai/intent/patterns.ts` - append an `IntentPattern` to `INTENT_PATTERNS` with `keywords.en` and
   `keywords.kn` and the right `requiresStructuredData` flag.
3. `lib/ai/intent/detector.ts:33` - add paraphrases to `INTENT_EXAMPLES` (the record is typed
   `Record<Intent, string[]>`, so the compiler will demand an entry); add a `domainKeywords` row at `:319`
   only if one exact phrase must win outright (order matters - the list is scanned top to bottom and the bare
   `"quote"` / `"contact"` / `"seva"` entries swallow longer phrases); extend `getCategoryForIntent()` at `:611`.
4. `services/ml.service.ts:95` - optionally add an `INTENT_WEIGHTS` entry.
5. Route it to data: add a row to `INTENT_RETRIEVAL_MAP` (`lib/ai/retrieval/index.ts:87`) naming an existing
   retriever, **or** add it to the knowledge-intent list (`lib/ai/retrieval/registry.ts:33-41`). An intent in
   neither falls through to a knowledge search on the raw message.
6. `lib/ai/response/composer.ts:46-66` - add a branch that recognises the data and a `formatX(data, language)`
   method returning the `en` and `kn` strings (`mixed` gets the Kannada one).
7. `services/conversation.service.ts:210` - add the intent to `mapIntentToTopic` so follow-ups work.
8. If it needs new data, add a retriever under `lib/ai/retrieval/` following `events.ts` (cache +
   `RetrievedData<T>` + `clearXCache`) and a `case` in `getContextForIntent` (`index.ts:195`).
9. Optional: register it in the AI Management Center via `POST /api/ai/settings/intents` - understand that
   this is metadata only and does not affect detection.

### Recipe B - change what an existing answer says
1. Find the formatter in `lib/ai/response/composer.ts` (`formatTempleSettings` `:78`, `formatEvents` `:103`,
   `formatSevas` `:110`, `formatDonations` `:129`, …).
2. Edit the `en` / `kn` template literal in place - there are two per branch; `mixed` reuses the Kannada one.
3. The generic strings (unknown question, welcome/greeting, goodbye/thanks, out of scope) are not in code: an
   admin edits them through `PUT /api/ai/settings/ai-responses` (`ai_settings.ai_responses`).
4. Do **not** look in `lib/ai/prompt-refactored.ts`, `lib/ai/systemPrompt.ts`, `lib/ai/knowledge/index.ts` or the
   prompt versions in the AI Management Center - none of them reach the devotee.

### Recipe C - add a field to the temple information the AI quotes
1. `types/ai-settings.ts` - add it to `TempleInformation` / `VisitorInformation` and its `DEFAULT_*`.
2. `lib/ai/ai-settings/validation.ts` - add it to the matching zod schema. **Do this in the same change**: if the
   stored row stops matching `AISettingsSchema`, the next chat request overwrites the row with defaults (M08-F32).
3. `lib/ai/ai-settings/seed-data.ts` - add it to the seed payload so `POST /api/seed-ai-settings` repairs it.
4. `lib/ai/retrieval/index.ts:197-215` - copy it into the `TempleSettings` object, and add it to
   `TempleSettings` in `lib/ai/retrieval/types.ts`.
5. `lib/ai/response/composer.ts:78` `formatTempleSettings` - surface it for the right intent.
6. The routes (`app/api/ai/settings/temple-information` or `visitor-information`) pass arbitrary fields through, but the
   admin form does not: `app/admin/ai/settings/page.tsx` has one hand-written input per field (e.g. `:786-787`
   `photographyPolicy`), so add an input there (chunk M09).

### Recipe D - add a knowledge article
1. Create `seed/ai/<slug>.json` copying the field set of `seed/ai/parking.json` (must include non-empty
   `content`; see M08-F12 about `faq.json`).
2. Fix M08-F36 first (`scripts/seed-ai-knowledge.ts:100,103` read `tags` and `published`), then run
   `npm run seed:ai`, which upserts Supabase `ai_knowledge` - the store the engine reads.
3. Do **not** use `POST /api/ai/knowledge/import`; it writes the orphaned Firestore `knowledge` collection. The
   coverage report (`app/api/ai/knowledge/coverage/route.ts:7`) also still looks at Firestore.
4. Approve it (`approved = true`) - unapproved rows are invisible (`lib/ai/knowledge/repository.ts:72`).
5. To give it a dedicated intent, add that intent to the knowledge list at `lib/ai/retrieval/registry.ts:33-41`.

### Recipe E - turn the LLM fallback back on
1. `app/api/chat/route.ts` - delete the safe-error block `:215-231` and uncomment `:232-286`.
2. Replace `getSystemPrompt()` at `:250` - its module `lib/ai/settings.ts` was deleted - with
   `aiSettingsService.getCurrentPrompt()` (`lib/ai/ai-settings/service.ts:402`), which finally makes the published
   prompt version live.
3. `lib/ai/provider.ts:11-31` - fix `PLACEHOLDER_KEY_PATTERNS`; `"sk-"` and `"test"` currently make every
   real OpenAI key look fake, so `isConfigured()` returns false.
4. Add a timeout/`AbortController` around the four `fetch` calls (`:96,132,191,228`) - there is none today.
5. Wire `recordTokenUsage` / `recordLatency` (`services/ai-analytics.service.ts:98,124`) at the call site,
   otherwise cost is invisible.
6. Keep `safety.allowLLMOnlyResponse` (`lib/ai/generator.ts:156`) and `usesLLM` (`composer.ts:37`) honest - today
   `usesLLM` is a constant `false`, so that gate can never fire.

### Recipe F - add authentication to an AI route
1. There is no `middleware.ts`; `proxy.ts` (the Next 16 name) only adds security headers and page-view tracking
   (`proxy.ts:83-120`) - nothing protects `/api/ai/*` centrally.
2. Copy the two-line guard the settings routes use: `const guard = await requireAdminUser(request); if
   (!guard.ok) return guard.response;` (`lib/auth/admin-auth.ts:198`, e.g. `app/api/ai/settings/route.ts:10-11`),
   and take the actor from `guard.user.uid`.
3. Apply it to the six `app/api/ai/analytics/**` routes (the `PATCH` on `unknown-questions` writes with the
   service-role key), `app/api/ai/knowledge/{coverage,import}`, and the five `app/api/ai/multi-source/**` routes.
4. Add each route to `PROTECTED_ROUTES` in `tests/unit/ai-api-auth-wiring.test.ts:8-20` so the guard cannot regress.

### Recipe G - make session continuity work
1. `app/api/chat/route.ts` - hoist `effectiveSessionId` out of the `try` block at `:138` so it is in scope at
   `:306`, and return it instead of `resolvedSessionId || crypto.randomUUID()`. The web client already sends its
   own id; the mobile client (`apps/mobile/app/(tabs)/ai.tsx:44-47`) must start sending the returned one.
2. `services/conversation.service.ts:311` `getSessionContext` - pass the *incoming user message* to
   `detectFollowUp`, not `lastMessage.content` (the assistant's own reply).
3. Use the returned `enrichedMessage` at `app/api/chat/route.ts:143` - it is destructured and dropped today - and
   gate it on `extendedBehavior.enableFollowUpContext`.
4. Pick one session store (M08-F37): either the route writes Supabase `chat_sessions` / `chat_messages` and the
   browser stops writing, or the reverse.

## Faults, smells and risks

Status column re-derived on 2026-10-18 against HEAD 424fdb8. Original wording is kept where the fault still holds;
evidence lines are the current ones.

| id | sev | Status 2026-10-18 | What | Evidence | Direction |
|---|---|---|---|---|---|
| M08-F01 | HIGH | **STILL OPEN (narrowed)** - settings routes fixed by d235868 + 8d54714 | 13 `/api/ai/*` routes and `/api/chat` are still unauthenticated: the six analytics routes (including `PATCH /api/ai/analytics/unknown-questions`, which now writes Supabase `unknown_questions` with the service-role key), `knowledge/coverage`, `knowledge/import` (POST, writes) and the five multi-source routes (including `POST query`). The nine settings routes, `/api/ai/health` and `/api/seed-ai-settings` now call `requireAdminUser` and take the actor from the verified uid; the `x-user-id` header is no longer read. There is still no `middleware.ts`. The unauthenticated `GET /api/ai/analytics/unknown-questions` also returns raw devotee questions and session ids, read with the service-role key (which bypasses the deny-all RLS on `unknown_questions`), with a caller-chosen `limit` (verify pass 2026-10-18). | guarded: `app/api/ai/settings/route.ts:10,29`, `prompts/route.ts:35,74`, `intents/route.ts:12,41,86,116`; unguarded: 0 hits for `requireAdmin` under `app/api/ai/analytics/`, `app/api/ai/knowledge/`, `app/api/ai/multi-source/`; `proxy.ts:83-120` sets headers only; `tests/unit/ai-api-auth-wiring.test.ts:8-20` lists only the 11 guarded routes; `app/api/ai/analytics/unknown-questions/route.ts:8-22`, `services/ai-analytics.service.ts:419-422` | Recipe F. |
| M08-F02 | HIGH | **FIXED (2026-10-18)** - fae5d51 removed the production bypass, 8d54714 moved to `requireAdminUser` | ~~`POST /api/seed-ai-settings` returns an admin identity unconditionally in production.~~ The route now rejects unauthenticated callers before any read or write. | `app/api/seed-ai-settings/route.ts:67-70` | — |
| M08-F03 | HIGH | **FIXED (2026-10-18)** in M08 - fae5d51 rewrote the seed route without Firebase literals | ~~A live Firebase Web API key and project id are hardcoded in the seed route.~~ The same key literal still lives in `lib/firebase.ts:58` (chunk M11), so rotation is still needed. | `app/api/seed-ai-settings/route.ts` (175 lines, no `AIzaSy`); `lib/firebase.ts:58` | Rotate the key; remove the M11 literal. |
| M08-F04 | HIGH | **STILL OPEN** | The documented "hybrid retrieval (Firebase + LLM fallback)" does not exist: no code path calls an LLM. The sole `provider.generateResponse` call site is inside a comment block (disabled deliberately on 2026-07-15 by ba805d5 "fix(security): Disable LLM fallback to prevent hallucinated temple facts"), and the composer's `usesLLM` is a constant `false`. | `app/api/chat/route.ts:232-286` (commented, and now calling the deleted `getSystemPrompt` at :250), `:215-231`; `lib/ai/response/composer.ts:37`; `AGENTS.md:220`; `docs/AI-GUIDELINES.md:41-52` | Update AGENTS.md and the AI docs to describe a deterministic template engine, or re-enable deliberately (Recipe E). |
| M08-F05 | MEDIUM | **STILL OPEN (impact moved)** | The chat response returns a session id that is not the one written to Firestore whenever the caller sends none: the route mints `effectiveSessionId` (`:158`), stores both messages under it (`:183`), then returns `crypto.randomUUID()` (`:306`) because `effectiveSessionId` is scoped inside the `try` at `:138`. The web client now pre-mints its own id (`components/ai/AIChatProvider.tsx:61-69`) and is no longer hit. The mobile client never sends `sessionId` and ignores the returned one, so every mobile message creates a new orphan `chat_sessions` document and mobile has no server-side memory at all. | `app/api/chat/route.ts:130,138,158,183,306`; `apps/mobile/app/(tabs)/ai.tsx:44-47` | Recipe G step 1. |
| M08-F06 | HIGH | **STILL OPEN** | Follow-up detection is fed the wrong text: `getSessionContext` matches the *assistant's* previous reply against the follow-up patterns, and the computed `enrichedMessage` is destructured at the route and then never used. The new `extendedBehavior.enableFollowUpContext` setting is read by nothing. | `services/conversation.service.ts:327-329`; `app/api/chat/route.ts:143`; `types/ai-settings.ts` `AIExtendedBehaviorSettings` | Recipe G steps 2-3. |
| M08-F07 | HIGH | **STILL OPEN** | No analytics are ever recorded. `recordTokenUsage`, `recordLatency`, `recordIntentDistribution` and `recordUnknownQuestion` still have zero callers, so `/api/ai/analytics*`, the health check and every admin chart read permanently empty tables (now mostly Supabase) and report "healthy". | `services/ai-analytics.service.ts:98,124,160,194` - repo-wide grep finds only the definitions | Call the recorders from `app/api/chat/route.ts` around `generateResponse`, or remove the dashboards. |
| M08-F08 | HIGH | **STILL OPEN (reshaped)** by 3d0d3b2 / 6a5a296 | Unknown questions have two writers, two stores and two schemas. The generator's low-confidence path (confidence < 60) writes Firestore `unknown_questions` `{processed:false}`; the route's second check (confidence < 50) writes Supabase `unknown_questions` `{status:'pending'}`. Both admin screens now read Supabase, so questions scoring 50-59 never reach an admin and questions under 50 are logged twice. Firestore `ai_unknown_questions` is no longer read. | writers: `services/analytics.service.ts:31` (via `lib/ai/generator.ts:73`), `lib/ai/unknown-logger.ts:28-50` (via `app/api/chat/route.ts:192`); readers: `lib/ai/ai-settings/repository.ts:472`, `services/ai-analytics.service.ts:422` | Make the generator call `lib/ai/unknown-logger.ts` and drop the route-level second log. |
| M08-F09 | MEDIUM | **STILL OPEN (set changed)** | Roughly 1,650 lines of dead code: `lib/ai/composer/` (524, and it exports the same `ResponseComposer` / `responseComposer` names as the live `lib/ai/response/composer.ts`), `lib/ai/conversation-memory.ts` (244), `lib/ai/actions/` (496), `lib/ai/knowledge/index.ts` (354, dead since the generator rewrite), `lib/ai/retrieval/settings.ts:180-216` (`getTempleTimings`, `getContactInfo`), `clearAllCaches` (`lib/ai/retrieval/index.ts:274`), `services/multi-source-retrieval.service.ts:464` (`updateStats`) and `:519` (`updateFreshness`), `services/ml.service.ts:360` (`learnFromCorrection`). Fixed parts: `lib/ai/firebaseChat.ts` deleted (2891323); `INTENT_RETRIEVAL_MAP` / `getContextForIntent` live again via `registry.ts:26`. | grep for each symbol returns only its definition, barrel re-export or test mocks | Delete, or move behind a clearly-labelled `legacy/` folder. |
| M08-F10 | MEDIUM | **STILL OPEN** | Out-of-scope detection uses plain substring `includes`, so `"pm"` in `OUT_OF_SCOPE_KEYWORDS.en` rejects any message containing that pair of letters (e.g. "does the temple close at 8:30pm?"), and the regex list rejects `food`, `app`, `website` and `hotel booking` - which collide with the ANNADANA ("free food", "lunch") and SEVA_BOOKING intents. The same regex rejects `price` and `buy` (`patterns.ts:659`), so "what is the price of archana?" or "where can I buy prasada?" is OUT_OF_SCOPE; only the plural paraphrase "seva prices" (`detector.ts:77`) slips past the `` boundary (verify pass 2026-10-18). The out-of-scope check runs *first*, before any intent matching. | `lib/ai/intent/patterns.ts:671` (`"pm"`), `:659`, `:647`; `lib/ai/intent/detector.ts:216,666-681` (`includes` at `:672`); conflicting examples at `detector.ts:157-160` | Use word-boundary regexes, drop `"pm"`, and run out-of-scope only when no intent scores above threshold. |
| M08-F11 | MEDIUM | **STILL OPEN** | `isPlaceholderKey` treats any key containing `"sk-"`, `"test"`, `"example"` or `"null"` as a placeholder. Every genuine OpenAI key starts with `sk-`, so `isConfigured()` is always false for OpenAI and `GET /api/chat` always reports `configured:false`. | `lib/ai/provider.ts:11-31`, `:316-319`; `app/api/chat/route.ts:385-392` | Check a prefix/length/shape per provider instead of substring matching. |
| M08-F12 | MEDIUM | **STILL OPEN** | `seed/ai/faq.json` carries a `questions` array instead of `content`. The CLI now writes it with `content: ''` (`scripts/seed-ai-knowledge.ts:101`), and `knowledgeArticleSchema` requires non-empty `content`, so the row is dropped on every read. | `seed/ai/faq.json`; `lib/ai/knowledge/validation.ts:18`; `lib/ai/knowledge/repository.ts:43-48` | Flatten the Q&A pairs into `content` at seed time. |
| M08-F13 | MEDIUM | **STILL OPEN (inverted)** by fdaff98 / c586d6c | Two knowledge writers, two stores: the CLI now writes Supabase `ai_knowledge` (the store the engine reads), while the HTTP importer and the coverage report still use Firestore `knowledge`, which nothing in the engine reads any more. `articles` has no writer left. An unowned third writer, `scripts/migrate-ai-knowledge.ts:47-52`, copies Firestore `knowledge` into `ai_knowledge` (verify pass 2026-10-18). | `scripts/seed-ai-knowledge.ts:95`; `app/api/ai/knowledge/import/route.ts:73,114`; `app/api/ai/knowledge/coverage/route.ts:81`; reader `lib/ai/knowledge/repository.ts:16,70` | Port the import and coverage routes to `ai_knowledge` or delete them. |
| M08-F14 | MEDIUM | **STILL OPEN (narrowed)** - 2891323 deleted `lib/ai/settings.ts`, fae5d51 dropped the `%20RayaAI` writes | The Management Center now has one live store (Supabase `ai_settings` row `main`), but Firestore `ai_settings` survives: the CLI seeder still writes `ai_settings/main` and the analytics service still reads the `ai_settings` collection for its thresholds. | `scripts/seed-ai-settings.ts:504`; `services/ai-analytics.service.ts:49,64` | Retire `scripts/seed-ai-settings.ts` in favour of `scripts/seed-ai-settings-supabase.ts`; read analytics thresholds from Supabase. |
| M08-F15 | MEDIUM | **STILL OPEN (narrowed)** by 356de70 | The engine now reads `aiResponses.{unknownQuestion,welcome,goodbye,outOfScope}`, `safety.{requireSourceForFacts,allowLLMOnlyResponse}`, `extendedBehavior.{enableUnknownQuestionLogging,maxKnowledgeResults,confidenceThreshold}`, `templeInformation` and `visitorInformation`. Still never read: prompt versions, intent metadata, `templePolicies`, all of `general` (including `enabled`), `safety.{retrievalRequired,unknownQuestionBehaviour,outOfScopeBehaviour}`, `aiResponses.{greeting,fallback}`, `extendedBehavior.{enableFollowUpContext,enableSuggestedQuestions,enableAnalytics,debugMode,enableDebugMode,semanticThreshold,maxRelatedArticles,conversationTimeout,streaming,unknownLogging}`, and the whole legacy `aiBehavior` column - which is what `PUT /api/ai/settings/ai-behavior` edits, with a `confidenceThreshold` default of 85 on a scale the other schema keeps at 0-1. The devotee-visible debug-text leak is gone with the quote handler. | `lib/ai/generator.ts:57-160`, `lib/ai/retrieval/registry.ts:22-23`, `lib/ai/response/composer.ts:31-34`, `lib/ai/retrieval/index.ts:197-211`; `app/api/ai/settings/ai-behavior/route.ts:46-58`; `lib/ai/ai-settings/validation.ts:22` | Read the remaining switches or remove them from the UI; retire the legacy `ai_behavior` column and point the ai-behavior screen at `extended_behavior`. |
| M08-F16 | MEDIUM | **STILL OPEN (narrowed)** | Direct data-store calls throughout `lib/ai/**`, against `AGENTS.md` ("No Direct Firebase Calls - use services only" / "Repository Pattern"). 10 M08 files still import the client Firebase SDK (the five Firestore retrieval modules, the chat / conversation / ai-analytics services and the two knowledge routes); settings, knowledge and unknown-question code moved to Supabase but call `createAdminClient()` inline. | `lib/ai/retrieval/{settings,events,sevas,announcements,aaradhane}.ts`, `services/{chat,conversation,ai-analytics}.service.ts`, `app/api/ai/knowledge/{coverage,import}/route.ts`; `lib/ai/knowledge/repository.ts:62`, `lib/ai/unknown-logger.ts:28` | Route retrieval through the domain services (M10). |
| M08-F17 | MEDIUM | **STILL OPEN** | Rate limiting and every cache are per-process in-memory `Map`s, so the 20/min limit is effectively `20 × instances` and `clearXCache()` only clears one instance. (Conversely the settings row has no cache at all - M08-F33.) | `app/api/chat/route.ts:29-51`; `lib/ai/retrieval/*.ts` module-level `cached*`; `lib/ai/knowledge/repository.ts` `cachedArticles`; `services/ml.service.ts:40`; `services/multi-source-retrieval.service.ts:508,552`; `services/knowledge.service.ts:28` | Move rate limiting to a shared store and caching to `unstable_cache`/ISR. |
| M08-F18 | MEDIUM | **FIXED (2026-10-18)** - 356de70 | ~~`generator.ts` schedules a 30-minute `setTimeout` per session.~~ The quote-category map and its timers were removed with the generator rewrite. | `lib/ai/generator.ts` (192 lines, no `setTimeout`) | — |
| M08-F19 | MEDIUM | **STILL OPEN (grew)** | `any` used in violation of AGENTS.md ("no `any`, use `unknown`"), now also in the new engine files, and the live composer disables ESLint for the whole file. | `services/ai-analytics.service.ts:143,474` (+ `:272,569,582,597,829`); `services/multi-source-retrieval.service.ts:92,132,169,265,508,519`; `lib/ai/retrieval/registry.ts:8,9,20,29`; `lib/ai/generator.ts:183`; `lib/ai/ai-settings/repository.ts:130`; `lib/ai/knowledge/repository.ts:26`; `lib/ai/response/composer.ts:1` (`/* eslint-disable */`) | Type `RetrievalResult.data` as `AIResponseContext`; remove the blanket disable. |
| M08-F20 | MEDIUM | **STILL OPEN (narrowed)** - fae5d51 made the seeder POST-only and admin-only | `POST /api/ai/knowledge/import` is still unauthenticated, reads the filesystem and bulk-writes Firestore `knowledge` (now an orphan store). | `app/api/ai/knowledge/import/route.ts:50,96,114` | Gate behind admin auth, or delete with M08-F13. |
| M08-F21 | MEDIUM | **STILL OPEN** | Devotee-visible injection / echo surface: the chat endpoint accepts an unbounded `messages` array and an arbitrary `detectedLanguage`, with no length cap on `content`; the message body is written verbatim into Firestore session history and both unknown-question stores. The mobile client posts its entire history on every turn. Re-enabling the LLM (Recipe E) would pass the untrusted array straight into the provider. | `app/api/chat/route.ts:100-121`, `:242-253` (commented); `services/conversation.service.ts:137-151`; `apps/mobile/app/(tabs)/ai.tsx:35-38`; only `lib/ai/unknown-logger.ts:28-50` truncates | Validate the body with a schema (max messages, max chars, enum language) before anything else. |
| M08-F22 | LOW | **STILL OPEN (narrowed)** | Raw devotee text in logs: the full question is `console.log`'d by the detector on every request, sessions keep message bodies with a TTL nothing enforces (`SESSION_TTL` declared and unused). The unknown-question logger no longer persists `ip` / `userAgent`, though it still accepts them. | `app/api/chat/route.ts:77,121`; `lib/ai/intent/detector.ts:213` (+ `:217,230,234,238,242`); `lib/ai/generator.ts:55,68`; `services/conversation.service.ts:41`; `lib/ai/unknown-logger.ts:20-25,28-50` | Stop logging message content in production; add a real TTL/cleanup job. |
| M08-F23 | LOW | **FIXED (2026-10-18)** - 2891323 deleted `lib/ai/firebaseChat.ts` | ~~Personal Gmail and a stray phone number baked into the dead responder.~~ Three different default contacts still disagree inside M08: `lib/ai/retrieval/settings.ts:29-30` (`+91 80 2847 1234`, `info@sriraghavendra.org`), `types/ai-settings.ts:194-195` (`+91-80-28446400`, `info@raghavendramatha.org`); the Gmail address survives in `lib/receipt/pdf.ts:23` (M14). | as listed | Settle on one authoritative contact record. |
| M08-F24 | LOW | **STILL OPEN (half fixed)** by 3446b0b | The intent category mapper still lists `VISITOR_GUIDELINES` twice, so it can never map to `IntentCategory.VISITOR`; the `DRESS_CODE` duplicate was removed. | `lib/ai/intent/detector.ts:616` vs `:643` | Remove one of the two labels deliberately. |
| M08-F25 | LOW | **STILL OPEN (reshaped)** by 356de70 | The generator switch is gone; routing is now `INTENT_RETRIEVAL_MAP` (20 intents) + 7 knowledge intents + 4 conversational intents handled in the generator. Eleven of the 42 intents are in none of these and fall through to a knowledge search on the raw message: `DAILY_QUOTE`, `ANNADANA`, `PRASADA`, `BOOKING`, `GALLERY`, `SHARE_EXPERIENCE`, `COMMITTEE`, `TESTIMONIAL`, `VOLUNTEER`, `CONTACT_REQUEST`, `UNKNOWN`. `FESTIVAL_INFO` retrieves events too, but the composer only formats events for `UPCOMING_EVENTS`. | `lib/ai/retrieval/index.ts:87-171`; `lib/ai/retrieval/registry.ts:33-43`; `lib/ai/generator.ts:96-123`; `lib/ai/response/composer.ts:48,58` | Give `ANNADANA` / `PRASADA` / `DAILY_QUOTE` / `VOLUNTEER` real sources; delete `BOOKING`. |
| M08-F26 | LOW | **STILL OPEN** | Unused imports: `getBestSemanticMatch` in the detector; `detectIntent`, `getSession`, `createSession`, `clearSession`, `getQuickActions`, `getSuggestedQuestions` in the chat route; `IntentDetectionResult` in the generator; `getResponseMetadata` in the composer (a circular import); `createAdminClient` in `services/chat.service.ts`; `knowledgeArticleSchema` in the knowledge seeder; `startTime` unused in two multi-source getters; `resolvedLanguage` in the chat route is assigned (`:139,148`) and never read, so neither the session's `preferredLanguage` nor the client's `detectedLanguage` changes the answer language - the generator re-detects it (`lib/ai/generator.ts:52`). | `lib/ai/intent/detector.ts:28`; `app/api/chat/route.ts:10,16-26`; `lib/ai/generator.ts:4`; `lib/ai/response/composer.ts:5`; `services/chat.service.ts:3`; `scripts/seed-ai-knowledge.ts:16`; `services/multi-source-retrieval.service.ts:27,58`; `app/api/chat/route.ts:139,148` | Clean up; these will fail a stricter lint config. |
| M08-F27 | LOW | **STILL OPEN** (the five AI docs are unchanged since 2026-09-20) | Doc drift beyond F04: `docs/AI_ENHANCEMENTS.md:53` marks "Semantic Embeddings" as ✅ Done; `docs/AI-GUIDELINES.md:38` maps "Donations → `donations` collection"; `docs/AI-GUIDELINES.md:46` still says "Repository (Firebase collections)" although settings, knowledge and unknown questions are now Supabase. | `services/ml.service.ts:126-160`; `lib/ai/retrieval/donations.ts:31-78`; `lib/ai/ai-settings/repository.ts:42`; `lib/ai/knowledge/repository.ts:16` | Rewrite the AI docs from the code. |
| M08-F28 | LOW | **MOVED** to `lib/ai/knowledge/repository.ts:90-101` (Supabase `ai_knowledge`; the Firestore index question no longer applies) | The knowledge read still silently falls back to the in-code `SEED_ARTICLES` when the table is empty or on *any* error, so a broken or empty knowledge base is indistinguishable from a working one. With M08-F36 every CLI-seeded row is unapproved, so this fallback is very likely what devotees are being served. | `lib/ai/knowledge/repository.ts:64-67,90-93,99-101` | Log and surface the failure; seed approved rows. |
| M08-F29 | LOW | **STILL OPEN** | No timeouts, retries or circuit breaking on any outbound call: the four provider `fetch` calls, every Firestore read and the three-to-four Supabase settings reads per turn can hang the request until the platform kills it. | `lib/ai/provider.ts:96,132,191,228`; `app/api/chat/route.ts:359-365` | Wrap in `AbortController` with a budget; return the safe message on abort. |
| M08-F30 | HIGH | **FIXED (2026-10-18)** - 356de70 | ~~`DRESS_CODE` / `VISITOR_GUIDELINES` were answered with opening hours.~~ Both now map to the settings retriever and are formatted from `visitorInfo.dressCode` / `.guidelines`. | `lib/ai/retrieval/index.ts:108-115`; `lib/ai/response/composer.ts:88-93` | — |
| M08-F31 | LOW | **STILL OPEN (now three thresholds)** | Three undocumented confidence thresholds in series: the detector rewrites anything under 20 to `Intent.FAQ` (`detector.ts:196,241-248`), the generator diverts anything under 60 (`generator.ts:14,62`), and the composer diverts anything under `extendedBehavior.confidenceThreshold * 100` = 85 by default (`composer.ts:34`). A question scoring 60-84 is therefore never logged as unknown yet is answered "I couldn't find verified information"; and the unknown-question log still records `detectedIntent: "FAQ"` for the weakest questions. | as listed | One threshold, from settings, applied once; log the pre-rewrite intent. |
| M08-F32 | HIGH | **NEW (2026-10-18)** - fae5d51 / 698a25c | A malformed admin save can wipe all AI settings. Every read validates the row with `AISettingsSchema` and returns `null` on failure - and also on any Supabase read error (`admin-repository.ts:47-50`, `repository.ts:48-51`); `getAISettings` then calls `createDefaultSettings("system")`, which **upserts the whole `main` row with defaults**. Writes are not validated (`updateSettings` and the settings route pass `data` straight through), so e.g. `confidenceThreshold: 85` in `extendedBehavior` (schema max 1) or an `aiResponses` payload missing a key makes the next unauthenticated chat message or `/api/ai/public-settings` call overwrite every customisation. The admin's own save triggers it first: `POST /api/ai/settings` calls `getAISettings()` right after the write (`app/api/ai/settings/route.ts:90`) (verify pass 2026-10-18). | `lib/ai/ai-settings/service.ts:34-46`; `lib/ai/ai-settings/admin-repository.ts:69-73,108-121`; `lib/ai/ai-settings/repository.ts:70-74,129-156`; `app/api/ai/settings/route.ts:44-80`; `lib/ai/ai-settings/validation.ts:22` | Validate on write with the same schemas; never create on a read path; on a parse failure log and serve in-memory defaults. |
| M08-F33 | MEDIUM | **NEW (2026-10-18)** - 356de70 | The whole AI settings row is fetched three or four times per chat turn, uncached, each fetch up to two Supabase round trips (admin repository, then client repository). | `lib/ai/generator.ts:57`; `lib/ai/retrieval/registry.ts:22`; `lib/ai/retrieval/index.ts:197`; `lib/ai/response/composer.ts:31`; `lib/ai/ai-settings/service.ts:37-41` | Read once in `generateResponse` and pass it down; add a short TTL cache. |
| M08-F34 | HIGH | **NEW (2026-10-18)** - surfaced by the M10/M11 Supabase migration | Raya AI reads events from Firestore while the admin events service now writes Supabase `events`, so "what are the upcoming events" answers from data admins no longer edit. Within the engine, contact details are also split: the timings/contact answers read Supabase `ai_settings`, while the donations answer and the multi-source dashboard derive them from Firestore `settings`. | `lib/ai/retrieval/events.ts:66` vs `services/event.service.ts:46,90,114`; `lib/ai/retrieval/index.ts:196-216` vs `lib/ai/retrieval/donations.ts:47` -> `lib/ai/retrieval/settings.ts:65`; `services/settings.service.ts:43` (`site_settings`) | Retrieve through the domain services so the AI follows the data migration. |
| M08-F35 | MEDIUM | **NEW (2026-10-18)** - 356de70 | Unrouted intents are answered with an unrelated article. The registry runs a knowledge search on the raw message whenever structured data is empty; `searchArticles` scores raw substrings including stop-words ("is", "the", "a" each +5 against content) with a 10-point floor, so nearly every query returns something; the composer prints `articles[0].content` verbatim. Every message containing "quote" is a `DAILY_QUOTE` at confidence 100 and no quote article exists. | `lib/ai/retrieval/registry.ts:43-51`; `lib/ai/knowledge/repository.ts:163-205`; `lib/ai/response/composer.ts:60-61,139-142`; `lib/ai/intent/detector.ts:329` | Strip stop-words, raise the floor, and return `unknownQuestion` when the best score is weak; restore a quote source. |
| M08-F36 | MEDIUM | **NEW (2026-10-18)** - fdaff98 / c586d6c | The CLI knowledge seeder writes every article `approved: false` and drops the files' keywords: it reads `article.published` (none of the 15 seed files has it; all 15 have `approved: true`) and builds `keywords` from `tags`. It also derives `slug` from `category` and resets `created_at` on every re-run. Because the engine reads only approved rows, `npm run seed:ai` leaves the engine on `SEED_ARTICLES`. | `scripts/seed-ai-knowledge.ts:92,100,103-104`; `grep -l '"published"' seed/ai/*.json` = 0, `grep -l '"approved": true'` = 15; `lib/ai/knowledge/repository.ts:72` | Map `approved`, `keywords`, `slug` from the file. |
| M08-F37 | MEDIUM | **NEW (2026-10-18)** - 224875d | One conversation, two stores: the chat route writes the server session to Firestore `chat_sessions` (`conversation.service.ts`), while the browser writes the same messages to Supabase `chat_sessions` / `chat_messages` with the anon client (`chat.service.ts`, keyed on `firestore_id`). The analytics dashboard counts Firestore, where `chat_messages` has no writer. Per the repo's own RLS migration the browser half is refused anyway (M08-F38), so in practice the Supabase tables get no web writes. | `services/conversation.service.ts:112,161`; `services/chat.service.ts:11,109,133`; `components/ai/AIChatProvider.tsx:113`; `services/ai-analytics.service.ts:623,635` | Recipe G step 4. |
| M08-F38 | MEDIUM | **NEW (2026-10-18, verify pass)** | Web chat history is never saved and never reloads (as the repo declares it; production unverified, see UNCLEAR). `services/chat.service.ts` writes `chat_sessions` / `chat_messages` from the browser with the anon client, but the migration enables RLS on both tables with only `FOR ALL TO public USING (false)` policies, so every insert is refused; `saveToFirebase` swallows the error without logging, and `getUserChatSessions` / `getSessionMessages` read zero rows, so `loadSessionHistory` replaces the conversation with an empty list. | `supabase/migrations/20260930000000_create_ai_tables.sql:85-86,92-93`; `services/chat.service.ts:7-23,103-122,144-151`; `components/ai/AIChatProvider.tsx:99,110-118,121-127` | Move history writes server-side into `/api/chat` with the service-role client (Recipe G step 4), or add explicit, reviewed anon / authenticated policies. |
| M08-F39 | LOW | **NEW (2026-10-18, verify pass)** | Kannada speakers get English for every generic answer. The unknown-question, welcome, goodbye and out-of-scope replies are single admin-editable strings returned whatever `language` was detected; the schema has no Kannada variant and the defaults are English. Knowledge answers are English-only too (`formatKnowledge` ignores `kannadaContent`), and the `greeting` / `fallback` strings are never read. | `lib/ai/generator.ts:85-123,138,159`; `lib/ai/ai-settings/validation.ts:83-90`; `types/ai-settings.ts:237-244`; `lib/ai/response/composer.ts:139-142` | Make `aiResponses` per-language (`{en, kn}`) and pick by `language`; return `kannadaContent` when present. |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `lib/ai/intent/**`, `services/ml.service.ts` | none - pure TypeScript, no DOM, no Next APIs | **reuse as-is** | The portable core: classification that would run unchanged in a shared package. |
| `lib/ai/generator.ts`, `lib/ai/response/composer.ts`, `lib/ai/retrieval/registry.ts` | `aiSettingsService` -> `lib/supabase/admin` (`server-only`) | **keep server-side** | The logic is portable, but since the rewrite every step reads the service-role settings row, so it cannot ship in a client bundle. |
| `lib/ai/retrieval/{events,sevas,announcements,aaradhane,settings}.ts` | `firebase/firestore` web SDK | **adapt** | Logic is portable; the SDK import and the module-level cache need swapping for a platform-agnostic data client (and M08-F34 says they should follow the Supabase migration anyway). |
| `lib/ai/retrieval/panchanga.ts` | Node `fs`/`path` reading `public/data/panchanga/current.json` (`:7-8,42-45`) | **rewrite** | No filesystem in RN. Must become an HTTP fetch of the same JSON or a bundled asset. |
| `app/api/chat/route.ts` and all 24 `app/api/ai/*` routes | `next/server` (`NextRequest`, `NextResponse`), Route Handlers | **reuse as a server** | RN does not run these; it calls them over HTTP. The contract stays, the handler stays on the server. |
| `lib/ai/provider.ts` | `fetch` only (available in RN) but holds server secrets | **keep server-side** | API keys must never ship in an RN bundle; the route stays the only caller. |
| `lib/ai/actions/actionRegistry.ts` | `window.location`, `window.open`, `navigator.share`, `navigator.clipboard`, `navigator.serviceWorker` (`:82,116,133,155,176,203…`) | **rewrite** (or delete - it is dead) | Maps 1:1 onto RN `Linking`, `Share`, `Clipboard`, `expo-notifications`, and React Navigation routes. |
| `lib/ai/actions/useAIActions.ts` | `'use client'` directive | **adapt** | The directive is meaningless in RN; the hook body is portable once the registry is. |
| `GET /api/ai/public-settings` | none | **reuse as a server** | Replaces the deleted `lib/ai/settings.ts` browser read; already the HTTP shape a mobile client needs, but `apps/mobile` does not call it (its welcome text is hardcoded at `apps/mobile/app/(tabs)/ai.tsx:21`). |
| `services/conversation.service.ts`, `services/chat.service.ts` | Firestore web SDK (server) and Supabase anon client called from the browser (`AIChatProvider.tsx:113`) | **adapt** | An RN client should not write either store directly; move the writes server-side behind `/api/chat` (M08-F37). |
| `services/knowledge.service.ts`, `lib/ai/knowledge/**` | Supabase / web SDK + in-memory view counts | **adapt** | Already exposed through `/api/knowledge/*`; RN can consume those. |
| Session persistence | `localStorage.setItem("raya_session_id", …)` in `components/ai/AIChatProvider.tsx:66,192` (M09) | **rewrite** | RN needs `AsyncStorage` / `expo-secure-store`; `apps/mobile` keeps no session id at all today. |
| Markdown answers | every composer template emits Markdown with `**bold**` and emoji | **adapt** | The web renders it with a Markdown component; `apps/mobile` renders `content` in a plain `<Text>` (`ai.tsx:105`), so the `**` markers show raw. |
| `types/ai.ts`, `types/knowledge.ts`, `lib/ai/intent/types.ts` | none | **reuse as-is** | These are the shared contract for both clients - but `apps/mobile` declares its own narrower `ChatResponse` (`ai.tsx:11-17`) instead of importing it. |

**What `apps/mobile` consumes today (2026-10-18):** one call, `POST ${EXPO_PUBLIC_API_URL || 'https://www.srsmathaynk.com'}/api/chat`
(`apps/mobile/app/(tabs)/ai.tsx:41-47`) with body `{messages: [{role, content}]}` - the whole local history, no
`sessionId`, no `userId`, no `detectedLanguage`. It reads `data.message.content` and maps 429 / 400 / other to
fixed error texts (`:49-57`). Consequences: no server-side memory, one orphan `chat_sessions` document per message
(M08-F05), unbounded request bodies (M08-F21), and raw Markdown on screen.

What a React Native client needs from this module:

1. `POST /api/chat` unchanged, with body `{messages: AIMessage[], sessionId?: string, userId?: string,
   detectedLanguage?: "en"|"kn"|"mixed"}` and response `{message: AIMessage, sessionId: string}` plus the
   optional `_debug` / `_ux` envelopes behind `?debug=true` / `?ux=true` (`app/api/chat/route.ts:304-337`; the
   envelopes are spread in at `:307-336` and are **not** declared on `ChatResponse`, `types/ai.ts:41-45`, which has only
   `message`, `sessionId`, `error`; `?debug=true` is open to any caller). Fix M08-F05 and make the mobile client send and keep the returned id.
2. The shared types package: `AIMessage`, `ChatRequest`, `ChatResponse`, `Intent`, `DetectedLanguage`,
   `KnowledgeArticle`. These already have no platform dependency.
3. `GET /api/ai/public-settings` exists and returns `{welcome}`; extend it with `general.enabled`, `botName` and
   suggested questions so the mobile app stops hardcoding them.
4. Answers should stop being pre-rendered Markdown strings and start being `{blocks, actions,
   suggestedFollowUps}` - the composer already branches per data type, so emitting structure is a small change.
5. Nothing else needs to move: intent detection, retrieval and formatting are server-side, and keeping them
   there is what makes one engine serve both clients.

## Coverage

filesExpected 96, filesMentioned 96, omitted: none. (Re-checked by script on 2026-10-18 against
`.claude/state/inventory/M08.json`: 0 of the 96 inventory paths are absent from this file. On 2026-09-19 it was
90 / 90.) All 96 inventory files appear in **Key files**; the 15 `seed/ai/*.json` files share one row that names
each file individually. The two deleted files (`lib/ai/firebaseChat.ts`, `lib/ai/settings.ts`) are kept as struck
rows. Files read only to confirm a boundary (not owned by M08, not counted): `services/analytics.service.ts`,
`services/event.service.ts`, `services/settings.service.ts`, `components/ai/AIChatProvider.tsx`,
`apps/mobile/app/(tabs)/ai.tsx`, `lib/auth/admin-auth.ts`, `lib/supabase/admin.ts`, `proxy.ts`,
`prisma/migrations/20261015000000_baseline_raya_ai/migration.sql`, `tests/unit/ai-api-auth-wiring.test.ts`,
`.env.example`, and the five docs listed in the chunk entry. Verify pass 2026-10-18 also read, as boundary only:
`supabase/migrations/20260930000000_create_ai_tables.sql`, `supabase/migrations/20261013000000_create_ai_knowledge.sql`,
`scripts/migrate-ai-knowledge.ts`, `scripts/apply-ai-knowledge-migration.mjs`, `app/admin/ai/settings/page.tsx`.

## UNCLEAR

- ~~Whether the LLM fallback was disabled permanently or during an incident.~~ **Settled 2026-10-18:** it was a
  deliberate security change - ba805d5 (2026-07-15) "fix(security): Disable LLM fallback to prevent hallucinated
  temple facts".
- ~~Whether the Firestore composite index for the knowledge query is deployed.~~ **Moot 2026-10-18:** the
  knowledge read moved to Supabase `ai_knowledge`.
- ~~Whether Supabase `ai_latency_records` / `ai_intent_distribution` tables exist.~~ **Settled 2026-10-18:** both are
  created by `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql:99,114`, and the readers now target
  them. Whether that migration has been applied to production is only answerable from the database.
- Whether `AI_HYBRID_MODE` is ever set. It gates the only live path (`app/api/chat/route.ts:34`) and is not
  in `.env.example`. Settled by: the Vercel project environment variables.
- Whether the orphan Firestore `articles` / `knowledge` collections hold production data. Settled by: a read-only
  Firestore listing (not permitted in this run).
- UNCLEAR: whether the production `ai_settings` row currently passes `AISettingsSchema`. If it does not, every chat
  message re-upserts defaults (M08-F32). Settled by: a read-only Supabase query of row `main`.
- ~~Whether Supabase row-level security lets the browser's anon client insert into `chat_sessions` / `chat_messages`.~~
  **Settled from the repo 2026-10-18 (verify pass):** `supabase/migrations/20260930000000_create_ai_tables.sql:85-86,92-93`
  enables RLS and adds only `FOR ALL TO public USING (false)` policies, and no later migration relaxes them, so the
  browser's inserts are refused and `AIChatProvider.tsx:114-117` swallows the error (M08-F38). Still open: whether
  production matches the migration. Settled by: a read-only listing of the production policies.
- UNCLEAR: whether `ai_knowledge` in production holds approved rows written by some other path despite M08-F36: `scripts/migrate-ai-knowledge.ts`
  (unowned, Firestore `knowledge` -> `ai_knowledge`) or the admin knowledge routes (M12).
  `scripts/apply-ai-knowledge-migration.mjs` only applies the table DDL (`:4,15`) and writes no rows. Settled by: a read-only Supabase count of
  `approved = true`.

## Verification log (2026-09-19)

Skeptic pass over the builder's file: 344 path citations scripted, 30 claims opened in the code, all 29
findings re-derived from their evidence lines, 90/90 inventory files re-diffed. Every change below.

- **Paths.** 8 citations failed the existence script; all 8 are brace/glob shorthands
  (`lib/ai/retrieval/{settings,events,...}.ts`, `services/{chat,conversation,ai-analytics}.service.ts`,
  `seed/ai/*.json`, `app/api/{testimonials,volunteer}/route.ts`, …). Each was expanded by hand and every
  member file exists -> left as written, 0 real broken paths. The Key-files line-count column was checked
  by script against `wc -l`: no row off by more than 1.
- `lib/ai/provider.ts:388-392` (M08-F11 evidence) -> the file is 337 lines, so that line does not exist ->
  now cites `app/api/chat/route.ts:385-392`, which is where the `configured` flag is actually returned ->
  `wc -l lib/ai/provider.ts` = 337; `app/api/chat/route.ts:389`.
- `docs/AI_ENHANCEMENTS.md:62` (M08-F27) was a table separator -> now `:53`, the actual "Semantic
  Embeddings … ✅ Done" row -> `grep -n Embedding docs/AI_ENHANCEMENTS.md` = 53.
- `docs/AI-GUIDELINES.md:34` (M08-F27) was a table separator -> now `:38` -> `sed -n 38p` = `| Donations | \`donations\` collection |`.
- "app/api/ai/ … (20 routes)" -> "22 routes" -> `find app/api/ai -name route.ts | wc -l` = 22. The Entry
  points table already listed all 22; only the prose count was wrong.
- `lib/ai/systemPrompt.ts` note "only `SUGGESTED_QUESTIONS` is used" -> now also names
  `tests/unit/system-prompt.test.ts:5-13`, which imports all eight exports -> that file's import block.
- **M08-F05 REFUTED in part, HIGH -> MEDIUM.** "every subsequent turn opens a fresh empty session -
  conversation memory never works" is wrong: `updateSession` writes with `setDoc(..., {merge:true})`
  (`services/conversation.service.ts:157-171`), so from turn 2 the client-held random id becomes a real
  document and memory works from turn 3. The real damage is the orphaned first exchange plus one dead
  `chat_sessions` document per new chat. Row rewritten to say exactly that.
- **M08-F25 REFUTED, rewritten.** "Five members have no pattern *and* no generator case" is wrong on both
  the count and the examples. Scripted set difference: 5 have no `INTENT_PATTERNS` row (`BOOKING`,
  `BRINDAVANA`, `MANTRALAYA`, `OUT_OF_SCOPE`, `UNKNOWN`), 9 have no `case` label (`OFFICE_HOURS`,
  `SEVA_BOOKING`, `ANNADANA`, `PRASADA`, `BOOKING`, `COMMITTEE`, `CONTACT_REQUEST`, `GOODBYE`, `UNKNOWN`),
  and only `BOOKING` + `UNKNOWN` are in neither. The named examples (`SEVA_BOOKING`, `ANNADANA`, `PRASADA`)
  all *do* have patterns - `ANNADANA` and `PRASADA` are even `domainKeywords` overrides at
  `detector.ts:357-359` - so they are produced at confidence 100 and then fall through `default:`.
- **M08-F28 REFUTED on its premise.** The composite index is declared at `firestore.indexes.json:168-176`
  (`approved` ASC + `category` ASC + `title` ASC), exactly matching the query. Row rewritten to keep only
  what survives: the `try/catch` at `lib/ai/knowledge/repository.ts:91-121` silently serves `SEED_ARTICLES`
  on *any* failure. The matching UNCLEAR bullet is marked settled.
- **M08-F08 narrowed.** "Nothing the chat writes is visible in either admin screen" is too absolute:
  `scripts/migrate-ai-to-supabase.ts:220` copies Firestore `unknown_questions` into the Supabase table the
  settings route reads. Row now says the admin list is a hand-refreshed snapshot, and the corresponding
  UNCLEAR bullet is marked settled.
- **M08-F22 evidence strengthened.** The builder cited only the two truncated logs in the route.
  `lib/ai/intent/detector.ts:213` logs the **whole untruncated** devotee message on every request, with five
  more per-request logs at `:217,230,234,238,242` and one at `lib/ai/generator.ts:1063`. Added.
- **New M08-F30 (HIGH).** `case Intent.DRESS_CODE:` and `case Intent.VISITOR_GUIDELINES:` share the
  `TEMPLE_TIMINGS` label and return `handleTempleTimings(language)` (`lib/ai/generator.ts:1087-1090`), whose
  signature takes only a language (`:95-97`). A dress-code question is answered with opening hours. Both
  intents have real patterns (`patterns.ts:409,425`) and paraphrases (`detector.ts:127,130`), so it fires.
- **New M08-F31 (LOW).** Two confidence thresholds in series: `IntentDetector` rewrites anything under
  `minConfidence` (default 20, `detector.ts:196`) to `Intent.FAQ` at `:241-248`, before the generator's
  `LOW_CONFIDENCE_THRESHOLD = 60` (`generator.ts:49,1066`) is applied - so the unknown-question log records
  `detectedIntent: "FAQ"` instead of the detector's real best guess, which is the field admin triage needs.
- **New section "LLM provider configuration"** added before Key files. Focus question 2 (providers, models,
  keys, fallbacks, timeouts, cost controls) was only half answered - the file named the four providers but
  no model, env var, token cap or fallback behaviour. Now a table plus the hardcoded `temperature 0.7` /
  `max_tokens 2000` at `provider.ts:105-106,141-142,203,241-242`, the absence of any provider-to-provider
  fallback (`generateResponse` rethrows at `:287-289`), and what `.env.example:26-39` does and does not
  declare.
- **Supabase table added.** `scripts/migrate-ai-to-supabase.ts:183,199,220,247,265` writes five Supabase
  tables (`chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`,
  `ai_latency_records`); the builder's Supabase table listed only two. Row added.
- **Confirmed unchanged** (opened and re-derived, no edit needed): F01 (no auth helper appears anywhere in
  `app/api/ai` or `app/api/chat`; no `middleware.ts`), F02 (`getAdminUser` returns `{uid:"admin"}` on
  `NODE_ENV === "production"` at `:118-120`), F03, F04 (0 hits for `usesLLM: true`; the only
  `provider.generateResponse` call is inside the `/* */` at `:232-286`), F06 (`detectFollowUp(lastMessage.content, …)`
  where `lastMessage.role === "assistant"`, `conversation.service.ts:326-333`), F07 (the four `record*`
  exports have zero call sites repo-wide), F09 (composer / conversation-memory / actions have zero external
  importers; `firebaseChat` is imported at `route.ts:4` and never invoked), F10 (`isOutOfScope` runs first at
  `:216`; `OUT_OF_SCOPE_KEYWORDS.en` is matched with `String.includes` at `:628`, and `"pm"` is in that list),
  F11, F12 (`faq.json` has `questions`, the other 14 have `content`), F13, F14, F15 (`getConfidenceThreshold`
  has zero callers; the only `aiSettingsService` use in the engine is `generator.ts:782-783`), F16 (exactly
  15 M08 files import `@/lib/firebase`), F17, F18, F19, F20, F21, F23, F24 (`VISITOR_GUIDELINES`/`DRESS_CODE`
  really do appear at both `:571-572` and `:599-600`), F26, F27 (apart from the two line numbers), F29.
- **Coverage re-run.** 90/90 inventory files still mentioned after the edits; no new file needed adopting.

## Refresh log (2026-10-18)

Delta for M08: 8 added, 2 deleted, 31 modified (`.claude/state/delta/2026-10-18/delta.json` `perModule.M08`). Every
modified file was diffed against the 2026-09-19 snapshot with `diff --strip-trailing-cr` (most files also changed
line endings, which plain `diff` reports as whole-file changes). One line per change: what was true -> what is
true now -> evidence.

- Response generation: 1,191-line `lib/ai/generator.ts` with ~25 hardcoded handlers and a 33-case switch -> 192-line
  orchestrator; answers come from `lib/ai/response/composer.ts` (new) via `lib/ai/retrieval/registry.ts` (new) ->
  `diff` generator 1190 -> 191 lines; 356de70, d235868, 43c6d8f.
- `INTENT_RETRIEVAL_MAP` / `getContextForIntent` dead -> live, 20 mapped intents -> `lib/ai/retrieval/registry.ts:26`,
  `lib/ai/retrieval/index.ts:87-171`.
- Temple timings/contact answers read Firestore `settings`/`timings` -> read Supabase `ai_settings.temple_information`
  / `visitor_information` -> `lib/ai/retrieval/index.ts:196-216`.
- Chat engine read only `aiBehavior.debugMode` -> reads `aiResponses`, `safety`, `extendedBehavior`, temple and
  visitor information -> `lib/ai/generator.ts:57-160`, `composer.ts:31-34`, `registry.ts:22-23` (M08-F15 narrowed).
- Daily-quote handler with Quote Engine + debug leak + `setTimeout` map -> removed; `DAILY_QUOTE` falls to a knowledge
  search -> generator rewrite; Flow 4 rewritten; M08-F18 FIXED; new M08-F35.
- Low-confidence path returned the FAQ menu at confidence 80 -> returns `aiResponses.unknownQuestion` with the real
  confidence, so the route's <50 logger now fires -> `lib/ai/generator.ts:85-92`; Flow 2 rewritten; M08-F08 reshaped.
- AI settings store Firestore `ai_settings/main` (admin SDK + client SDK) -> Supabase table `ai_settings` row `main`,
  zod-validated on read, with new `general` / `safety` / `extendedBehavior` sections -> `lib/ai/ai-settings/*`,
  `types/ai-settings.ts:280-344`; fae5d51, 698a25c, 54024a1.
- New files `lib/ai/ai-settings/validation.ts`, `seed-data.ts` -> Key files rows added.
- Settings routes trusted `x-user-id` (or "admin") -> `requireAdminUser` on all nine, actor = verified uid ->
  d235868, 8d54714; Entry points table, tree 2, M08-F01 narrowed.
- `temple-information` GET was publicly cached (`revalidate = 3600`, `public, s-maxage`) -> `force-dynamic`, `no-store`
  -> `app/api/ai/settings/temple-information/route.ts:11,21`.
- `POST /api/seed-ai-settings` 722 lines, production auth bypass, hardcoded Firebase key, eight Firestore writes incl.
  `ai_settings/%20RayaAI`; dev-only mutating GET -> 174-line admin-only idempotent Supabase seeder, POST only ->
  fae5d51, 8d54714; M08-F02, F03 FIXED; M08-F14, F20 narrowed; GET row struck.
- New `GET /api/ai/health` + `lib/ai/health-classify.ts` (AI Health dashboard probe) -> 8d54714; rows, entry point,
  "Answers" topic added.
- New `GET /api/ai/public-settings` (welcome text for the widget, unauthenticated) -> 3446b0b; replaces the browser's
  Firestore read through `lib/ai/settings.ts`.
- `lib/ai/settings.ts` (Firestore `settings/ai`, system prompt) existed -> deleted -> 2891323; row struck; Flow 5,
  Recipe E, Types and stores updated.
- `lib/ai/firebaseChat.ts` imported-but-unused legacy responder -> deleted -> 2891323; row struck; M08-F23 FIXED;
  `trust` / `chatTraining` struck from stores.
- Knowledge store Firestore `knowledge` -> Supabase `ai_knowledge`, rows validated by new
  `lib/ai/knowledge/validation.ts` -> fdaff98, 54024a1; Flow 3 rewritten; M08-F28 MOVED.
- CLI knowledge seeder wrote Firestore `articles` -> writes Supabase `ai_knowledge` but with `approved: false` ->
  `scripts/seed-ai-knowledge.ts:95,103`; c586d6c; M08-F13 inverted; new M08-F36.
- Unknown-question logger wrote Firestore `unknown_questions` `{reviewed:false, ip, userAgent}` -> Supabase
  `unknown_questions` `{status:'pending'}`, no IP / UA -> `lib/ai/unknown-logger.ts:28-50`; 3d0d3b2, 6a5a296.
- Analytics latency / intent / unknown-question reads Firestore -> Supabase; token usage still Firestore ->
  `services/ai-analytics.service.ts:325,372,422,279`; BOT-004 commits 2cd44c7..556a704; tree 3 updated.
- `services/chat.service.ts` sessions/messages Firestore -> Supabase (browser, anon client) -> 224875d; new M08-F37.
- `scripts/migrate-ai-to-supabase.ts` 292-line inline copier -> 75-line driver over `lib/supabase/migration-*` ->
  d71898d.
- Detector: `domainKeywords` reordered and extended (quote / office hours / contact / dress code / seva entries);
  `DRESS_CODE` duplicate case removed -> `lib/ai/intent/detector.ts:319-412,611-650`; 3446b0b, ea4f7bd; M08-F24 half
  fixed; M08-F30 FIXED.
- `IntentPriority` duplicate values -> unique -> `lib/ai/intent/types.ts:111-142`; 342e5e9.
- `services/ml.service.ts` typo table +8 entries and a `distance <= 2` cap -> `:235-242,280`.
- Line anchors moved in `detector.ts` (combineResults 476 -> 521, isOutOfScope 622 -> 666, getCategoryForIntent
  566 -> 611), `ml.service.ts` (300 -> 308, 352 -> 360, 405 -> 413), `ai-analytics.service.ts` (all exports +1..+25),
  `retrieval/settings.ts` (37 -> 58, 81 -> 101, 113 -> 129, 164 -> 180, 179 -> 195) -> updated throughout.
- Code roots 90 files / 19,651 lines -> 96 / 18,325; `app/api/ai` 22 -> 24 routes -> inventory `totals`.
- Cross-module: `services/quote.service.ts` / `types/quote.ts` no longer imported; `lib/auth/admin-auth.ts` (M04) and
  `lib/supabase/migration-*` (M11) newly imported; `lib/admin-firebase.ts` now only used by the migration script.
- Portability: `apps/mobile` did not exist as a consumer -> `apps/mobile/app/(tabs)/ai.tsx:44` posts `{messages}` to
  `/api/chat` (no session, plain-text rendering) -> section rewritten.
- New faults M08-F32 (settings auto-overwrite), F33 (uncached settings read 3-4x per turn), F34 (AI reads Firestore
  events while admins write Supabase), F35 (unrelated-article fallback), F36 (seeder writes unapproved rows), F37
  (chat history split across two stores).
- Faults: FIXED F02, F03, F18, F23, F30; MOVED F28; every other row STILL OPEN with current evidence (F01, F05, F08,
  F09, F13, F14, F15, F16, F19, F20, F22, F24, F25, F31 reshaped or narrowed).
- UNCLEAR: LLM-disable intent settled (ba805d5, 2026-07-15); Supabase analytics tables settled (baseline migration
  `:99,114`); knowledge-index question moot; three new UNCLEAR items added.
- Path check (script, 2026-10-18): 458 citations checked; the only non-resolving ones are the two deleted files
  (struck deliberately), extensionless import specifiers whose `.ts` file exists (`lib/supabase/admin`,
  `lib/panchanga-cache`, `lib/ai/retrieval/{settings,events,...}`), and the placeholder `seed/ai/<slug>.json`.
  0 broken paths.

Commits behind the biggest changes: 356de70 / d235868 / 43c6d8f (engine rewrite, 2026-09-19..20), fae5d51 / 698a25c
(AI settings on Supabase, 2026-10-06), fdaff98 / c586d6c (knowledge on Supabase), 224875d (chat sessions on
Supabase), 2cd44c7..556a704 + 54024a1 (BOT-004 analytics migration, 2026-10-13), 2891323 (prune Firebase modules,
2026-10-14), 3446b0b / 342e5e9 (intent fixes, public-settings), 8d54714 (admin auth diagnostics, AI Health, seeder,
2026-10-15).

UNCLEAR from this refresh: see the three new bullets under UNCLEAR (settings row validity in production, browser
RLS on chat tables, approved rows in `ai_knowledge`). `scripts/seed-ai-settings-supabase.ts`,
`scripts/apply-ai-knowledge-migration.mjs` and `apps/mobile/app/(tabs)/ai.tsx` are unowned in the delta but act on
this module's stores and API; they are cited here and not documented further.

## Verification log (2026-10-18)

Skeptic pass over the 2026-10-18 refresh, against HEAD 43361a3 (two docs-only commits on top of 424fdb8; code equals
424fdb8). Path script: 150 unique repo paths / 691 citations; every cited path exists except the two deleted files
(struck on purpose); every `path:line` lands inside its file except the line numbers quoted inside the 2026-09-19
log below, which point at the 2026-09-19 snapshot (`generator.ts:1063,1087-1090`, `provider.ts:388-392`,
`migrate-ai-to-supabase.ts:183-265`) and are left as history. Key-files line counts all within 1 of the file. 36 claims
opened, 37 fault rows re-derived, inventory 96/96 re-diffed. One line per change: what was wrong -> what it says now -> evidence.

- LLM table: OpenRouter call site `provider.ts:132` -> `provider.ts:96` (shared OpenAI-compatible function; `:132` is the
  unused streaming twin) -> `lib/ai/provider.ts:83,119,271-273`.
- "`temperature 0.7` ... at every call site" -> Claude sends no temperature -> `lib/ai/provider.ts:199-204`.
- `.env.example` "does not declare `GOOGLE_GENERATIVE_API_KEY`" -> it is declared, commented out, like the Anthropic and
  OpenRouter keys -> `.env.example:33`.
- Knowledge repository line anchors `approved ?? false` `:37` / schema `:43` -> `:39` / `:45` (Key files and Flow 3) ->
  `lib/ai/knowledge/repository.ts:39,45`.
- `lib/ai/knowledge/seed.ts` "fallback when Firestore is empty" -> fallback for Supabase `ai_knowledge`; `getSeedArticlesForFirebase`
  has no caller -> `lib/ai/knowledge/repository.ts:90-101`; repo grep.
- `lib/ai/knowledge/types.ts` "imported by 8 files outside M08" -> 7 outside (the eighth is `services/knowledge.service.ts`,
  inside M08); `services/knowledge-workflow.service.ts` was missing from the list -> grep.
- `services/knowledge.service.ts` "(11)" importers -> 9, adding `components/common/PersonalizedHomepage.tsx` -> grep.
- Flow 5 "getCurrentPrompt is called only by" two routes -> three, adding `app/api/admin/prompts/[id]/publish/route.ts:40`.
- `lib/ai/index.ts` row -> also `export * from "./retrieval"` and `detectLanguage` -> `lib/ai/index.ts:8,46`.
- Recipe C step 6 "the admin form ... passes arbitrary fields through" -> the form has hand-written inputs per field; a new
  field needs an input -> `app/admin/ai/settings/page.tsx:786-787`.
- Portability: `_debug` / `_ux` cited as declared in `types/ai.ts:34-47` -> not on `ChatResponse` (`types/ai.ts:41-45`);
  spread in at `app/api/chat/route.ts:307-336`; `?debug=true` open to anyone.
- Supabase `ai_knowledge` writers -> added `scripts/migrate-ai-knowledge.ts:47-52` (unowned). UNCLEAR bullet named
  `scripts/apply-ai-knowledge-migration.mjs` as a possible row writer -> it only applies DDL (`:4,15`); now names
  `migrate-ai-knowledge.ts` and the M12 admin knowledge routes.
- UNCLEAR "does RLS let the browser write `chat_sessions` / `chat_messages`" -> settled from the repo: RLS on, deny-all
  policies only -> `supabase/migrations/20260930000000_create_ai_tables.sql:85-86,92-93`; Supabase tables row annotated;
  "Answers" bullet updated; new **M08-F38 (MEDIUM)**: web chat history silently never saved or reloaded.
- New **M08-F39 (LOW)**: generic replies and knowledge answers are English whatever the detected language; `greeting` /
  `fallback` never read -> `lib/ai/generator.ts:85-123`; `lib/ai/ai-settings/validation.ts:83-90`; `composer.ts:139-142`.
- M08-F32 CONFIRMED and widened: `getSettings()` also returns `null` on any Supabase read error, so a transient read failure
  can trigger the default upsert too; and the admin's own `POST /api/ai/settings` re-reads at `:90`, so the wipe happens on
  the save itself -> `admin-repository.ts:47-50`, `repository.ts:48-51`, `app/api/ai/settings/route.ts:90`.
- M08-F01 CONFIRMED and widened: unauthenticated `GET /api/ai/analytics/unknown-questions` returns raw devotee questions and
  session ids via the service-role key -> `route.ts:8-22`, `services/ai-analytics.service.ts:419-422`.
- M08-F10 CONFIRMED and widened: `price` / `buy` in the off-topic regex reject seva-price and prasada questions ->
  `lib/ai/intent/patterns.ts:659`, `lib/ai/intent/detector.ts:77`.
- M08-F13 widened: third `ai_knowledge` writer `scripts/migrate-ai-knowledge.ts`.
- M08-F15 widened: never-read list gains `aiResponses.{greeting,fallback}` and six more `extendedBehavior` keys -> grep of the
  chat path finds no reader.
- M08-F26 widened: `resolvedLanguage` assigned and never read -> `app/api/chat/route.ts:139,148`.
- M08-F37 annotated with the RLS result (cross-reference to F38).
- **Confirmed unchanged** (evidence opened): F02, F03, F18, F23, F30 FIXED (seed route has no `AIzaSy`/`NODE_ENV`; generator
  has no `setTimeout`; `firebaseChat.ts` gone; DRESS_CODE/VISITOR_GUIDELINES mapped at `index.ts:108-115` and formatted at
  `composer.ts:88-93`); F28 MOVED; F04, F05, F06, F07 (four `record*` writers: zero non-test callers), F08, F09, F11, F12,
  F14, F16 (10 Firebase importers by script), F17, F19, F20, F21, F22, F24, F25 (11 unrouted intents by set difference over
  the 42-member enum), F27, F29, F31, F33, F34, F35, F36 (0 of 15 seed files have `published`, 15 have `approved: true`).
- Coverage: 96/96 inventory files still named; 0 files under the module roots missing from the inventory. Unowned AI
  scripts not in the inventory and now cited: `scripts/migrate-ai-knowledge.ts`; `scripts/migrate-ai-analytics.ts` and
  `scripts/resolve-baseline-raya-ai.mjs` exist but are not documented here (owner: M11).
