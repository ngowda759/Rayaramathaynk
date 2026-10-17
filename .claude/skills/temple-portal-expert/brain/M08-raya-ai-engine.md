# M08 - Raya AI - retrieval engine, intents, prompts, provider and chat API
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- how one chat message travels from `POST /api/chat` to a rendered answer, step by step
- whether Raya AI actually calls an LLM (it does not - the only call site is commented out)
- which LLM providers are wired, which models, where API keys come from, and why `isConfigured()` is broken
- how intent detection works: keyword patterns, "semantic" Jaccard matching, ML typo correction, learned corrections
- how Kannada / English / mixed language is detected, and how Romanized Kannada is transliterated
- which Firestore collections, Supabase tables and static JSON files the AI reads, and in what order
- what "hybrid retrieval" means in this codebase versus what `docs/AI-GUIDELINES.md` claims it means
- where the response text for every intent is written (it is hardcoded bilingual templates in `lib/ai/generator.ts`)
- how conversation sessions and follow-up detection work, and why the returned `sessionId` does not match the stored one
- where unknown / low-confidence questions are logged (three different stores, two different schemas)
- how AI analytics (token usage, latency, intent distribution) are supposed to work and why every dashboard reads empty
- what is configurable at runtime through the AI Management Center, and which of those settings the chat engine actually reads (almost none)
- which AI API routes have authentication (none) and which mutate data
- how the knowledge base is seeded (`seed/ai/*.json`, two seeders writing to two different collections)
- what the daily-quote flow does and where quote selection lives
- how the multi-source retrieval dashboard endpoints work
- what is dead code in this module (roughly 2,400 lines) and what is safe to delete
- what a React Native client would need from this module and what would have to be rewritten

## Purpose and business role

Raya AI is the temple's devotee-facing chat assistant. A devotee opens the floating chat widget (UI lives in
chunk M09) and asks in English, Kannada or a mix - "what are the temple timings", "when is the next
Aaradhane", "how do I get an 80G receipt", "ಇಂದಿನ ಪಂಚಾಂಗ ಏನು". This module is the server half: it classifies
the question into one of 42 intents, pulls the matching facts out of Firestore / static panchanga JSON /
the knowledge-article store, and formats a bilingual Markdown answer.

The stated design goal (`docs/AI-GUIDELINES.md:16-40`) is "retrieval-first, never let an LLM invent temple
facts". The code has taken that to its limit: **no LLM is invoked at all at runtime**. Every answer is a
hardcoded template in `lib/ai/generator.ts` filled with retrieved values. The provider abstraction
(`lib/ai/provider.ts`, OpenAI / OpenRouter / Gemini / Claude) is fully implemented but its only caller is
inside a commented-out block (`app/api/chat/route.ts:232-286`). Raya AI is therefore an intent-routed FAQ
engine, not a RAG chatbot.

The module also owns the admin-facing AI surface: the AI Management Center settings store (prompts, intents,
temple information, unknown questions), the analytics read endpoints, and the multi-source retrieval
dashboard endpoints. The admin UI that consumes them is chunk M09.

## Code roots

From `.claude/state/chunks.json` (id M08), 90 files / 19,651 lines. No files adopted from the Unassigned list -
none of the 11 unassigned files belong here.

```
lib/ai/                               engine: intents, retrieval, knowledge, composer, provider, prompts
services/chat.service.ts              Firestore CRUD for chat sessions, messages, testimonials, volunteers, feedback
services/conversation.service.ts      conversation sessions + follow-up detection
services/knowledge.service.ts         public Knowledge Centre read service
services/multi-source-retrieval.service.ts   dashboard-only fan-out over the retrieval modules
services/ml.service.ts                Jaccard similarity, Levenshtein typo correction, learned corrections
services/ai-analytics.service.ts      analytics reads (Firestore + Supabase); its writers are never called
app/api/chat/                         the chat endpoint
app/api/ai/                           analytics, knowledge, multi-source and settings endpoints (22 routes, all listed under Entry points)
app/api/seed-ai-settings/             one-shot seeder for the AI settings documents
types/ai.ts types/ai-settings.ts types/ai-analytics.ts types/multi-source-retrieval.ts types/knowledge.ts
seed/ai/*.json                        15 seed knowledge articles
scripts/seed-ai-knowledge.ts scripts/seed-ai-settings.ts scripts/migrate-ai-to-supabase.ts
```

## Entry points

| Route / entry | File | server/client | auth required | What it does |
|---|---|---|---|---|
| `POST /api/chat` | `app/api/chat/route.ts:67` | server (Route Handler) | **none** - IP rate limit only (20/min, `:29-51`) | full chat turn: session -> intent -> retrieval -> template -> session write |
| `GET /api/chat` | `app/api/chat/route.ts:385` | server | **none** | health probe; leaks provider name, model name and `configured` flag |
| `GET /api/ai/analytics` | `app/api/ai/analytics/route.ts:7` | server | **none** | dashboard aggregate (`getAnalyticsDashboard`) |
| `GET /api/ai/analytics/health` | `app/api/ai/analytics/health/route.ts:7` | server | **none** | `checkAIHealth()` |
| `GET /api/ai/analytics/latency` | `app/api/ai/analytics/latency/route.ts:8` | server | **none** | reads Firestore `ai_latency_records` |
| `GET /api/ai/analytics/token-usage` | `app/api/ai/analytics/token-usage/route.ts:8` | server | **none** | reads Firestore `ai_token_usage` |
| `GET /api/ai/analytics/intent-distribution` | `app/api/ai/analytics/intent-distribution/route.ts:7` | server | **none** | reads Firestore `ai_intent_distribution` |
| `GET/PATCH /api/ai/analytics/unknown-questions` | `app/api/ai/analytics/unknown-questions/route.ts:8,34` | server | **none** | list / mark reviewed in `ai_unknown_questions` |
| `GET /api/ai/knowledge/coverage` | `app/api/ai/knowledge/coverage/route.ts:55` | server | **none** | compares 30 expected categories against Firestore `knowledge` |
| `POST /api/ai/knowledge/import` | `app/api/ai/knowledge/import/route.ts:50` | server | **none** | reads `seed/ai/*.json` off disk and writes Firestore `knowledge` |
| `GET /api/ai/multi-source/overview` | `app/api/ai/multi-source/overview/route.ts:7` | server | **none** | all sources at once |
| `GET /api/ai/multi-source/today` | `app/api/ai/multi-source/today/route.ts:7` | server | **none** | panchanga + events + announcements |
| `POST /api/ai/multi-source/query` | `app/api/ai/multi-source/query/route.ts:9` | server | **none** | arbitrary multi-source fan-out |
| `GET /api/ai/multi-source/quick-queries` | `app/api/ai/multi-source/quick-queries/route.ts:7` | server | **none** | static `QUICK_QUERIES` list |
| `GET /api/ai/multi-source/statistics` | `app/api/ai/multi-source/statistics/route.ts:7` | server | **none** | in-process stats (always zero, see M08-F09) |
| `GET/POST /api/ai/settings` | `app/api/ai/settings/route.ts:8,21` | server | **none** - `x-user-id` header trusted (`:25`) | read / mutate the whole AI settings doc |
| `GET/PUT /api/ai/settings/temple-information` | `app/api/ai/settings/temple-information/route.ts:10,27` | server | **none** | `revalidate = 3600` on the GET |
| `GET/PUT /api/ai/settings/visitor-information` | `app/api/ai/settings/visitor-information/route.ts:8,21` | server | **none** | |
| `GET/PUT /api/ai/settings/policies` | `app/api/ai/settings/policies/route.ts:8,21` | server | **none** | |
| `GET/PUT /api/ai/settings/ai-responses` | `app/api/ai/settings/ai-responses/route.ts:9,22` | server | **none** | |
| `GET/PUT /api/ai/settings/ai-behavior` | `app/api/ai/settings/ai-behavior/route.ts:9,22` | server | **none** | confidence threshold, debug mode, streaming flag |
| `GET/POST/PUT /api/ai/settings/prompts` | `app/api/ai/settings/prompts/route.ts:9,28,64` | server | **none** | prompt version CRUD + publish |
| `GET/POST/PUT/DELETE /api/ai/settings/intents` | `app/api/ai/settings/intents/route.ts:11,36,78,105` | server | **none** | intent metadata CRUD |
| `GET/POST/PUT/DELETE /api/ai/settings/unknown-questions` | `app/api/ai/settings/unknown-questions/route.ts:10,35,67,113` | server | **none** | Supabase `unknown_questions` triage |
| `POST /api/seed-ai-settings` | `app/api/seed-ai-settings/route.ts:539` | server | **bypassed in production** (`:117-140`) | overwrites 8 settings documents |
| `GET /api/seed-ai-settings` | `app/api/seed-ai-settings/route.ts:637` | server | dev only (404 otherwise) | same writes - a GET that mutates |
| `npm run` seeders | `scripts/seed-ai-knowledge.ts:180`, `scripts/seed-ai-settings.ts:417`, `scripts/migrate-ai-to-supabase.ts` | node CLI | service-account / web config from env | seed knowledge, seed settings, Firestore->Supabase copy |

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
├── generateSessionId()                                   services/conversation.service.ts:49   (uuid v4)
├── generateResponse(message, sessionId)  (server)        lib/ai/generator.ts:1056
│   ├── detectLanguage(message)                           lib/ai/generator.ts:75    -> containsKannada() lib/ai/intent/patterns.ts:682
│   ├── detectIntent(message)                             lib/ai/intent/detector.ts:677
│   │   └── IntentDetector.detect()                       lib/ai/intent/detector.ts:204
│   │       ├── enhanceWithTransliteration()              lib/ai/intent/transliteration.ts:323
│   │       ├── isOutOfScope()                            lib/ai/intent/detector.ts:622  -> OUT_OF_SCOPE_PATTERNS patterns.ts:645
│   │       ├── detectByKeywords()                        lib/ai/intent/detector.ts:256  -> INTENT_PATTERNS patterns.ts:7 (37 patterns)
│   │       ├── detectBySemantic()                        lib/ai/intent/detector.ts:285
│   │       │   ├── getCorrectedIntent()                  services/ml.service.ts:405   (in-memory Map)
│   │       │   ├── autoCorrectMessage()                  services/ml.service.ts:300   (Levenshtein + typo table)
│   │       │   ├── domainKeywords table                  lib/ai/intent/detector.ts:319 (hard override, confidence 100)
│   │       │   ├── INTENT_EXAMPLES Jaccard               lib/ai/intent/detector.ts:33
│   │       │   └── calculateIntentSimilarity()           services/ml.service.ts:126   (INTENT_WEIGHTS ml.service.ts:95)
│   │       └── combineResults()                          lib/ai/intent/detector.ts:476
│   ├── [confidence < 60] logUnknownQuestion()            services/analytics.service.ts:17 -> Firestore unknown_questions
│   │                     handleFAQIntent()               lib/ai/generator.ts:526
│   └── switch (intent)                                   lib/ai/generator.ts:1086
│       ├── handleTempleTimings()   -> getTempleTimings() lib/ai/retrieval/settings.ts:164  -> Firestore settings, timings
│       ├── handleContactInformation() -> getContactInfo()lib/ai/retrieval/settings.ts:179
│       ├── handleLocation()        -> getTempleSettings()lib/ai/retrieval/settings.ts:113
│       ├── handleEvents()          -> getUpcomingEvents()lib/ai/retrieval/events.ts:92     -> Firestore events
│       ├── handleSevas()           -> getActiveSevas()   lib/ai/retrieval/sevas.ts:152     -> Firestore sevas
│       ├── handleAnnouncements()   -> getActiveAnnouncements() lib/ai/retrieval/announcements.ts:83 -> Firestore announcements
│       ├── handlePanchanga()       -> getTodayPanchanga()lib/ai/retrieval/panchanga.ts:81  -> public/data/panchanga/current.json + lib/panchanga-cache
│       ├── handleDonation()        -> getDonationInfo()  lib/ai/retrieval/donations.ts:31  (derived from settings)
│       ├── handleAaradhane()       -> getNextAaradhane() lib/ai/retrieval/aaradhane.ts:147 -> Firestore aaradhane
│       ├── handleDailyQuote()                            lib/ai/generator.ts:702
│       │   ├── quoteService.getTodaysQuote()             services/quote.service.ts   [chunk M03/M10]
│       │   └── aiSettingsService.getAIBehavior()         lib/ai/ai-settings/service.ts:319 (debugMode only)
│       ├── handleKnowledgeIntent() -> getKnowledgeContext() lib/ai/knowledge/index.ts:32
│       │   └── searchArticles()                          lib/ai/knowledge/repository.ts:168 -> Firestore knowledge (fallback SEED_ARTICLES)
│       ├── handleGreeting/handleThanks/handleOutOfScope  lib/ai/generator.ts:484,498,512 -> lib/ai/knowledge/index.ts:260,286,345
│       ├── handleVolunteer/handleShareExperience         lib/ai/generator.ts:584,647 (static text)
│       └── default -> logUnknownQuestion + handleKnowledgeIntent(UNKNOWN)  lib/ai/generator.ts:1166
├── updateSession()                                       services/conversation.service.ts:127 -> Firestore chat_sessions
├── [confidence < 50] logLowConfidenceQuestion()          lib/ai/unknown-logger.ts:68  -> Firestore unknown_questions (different schema)
└── getResponseMetadata() (only when ?ux=true)            services/ux.service.ts       [chunk M10]
```

Caller side (chunk M09, listed for the API contract only): `components/ai/AIChatProvider.tsx:156` posts
`{messages, sessionId, userId, detectedLanguage}` and reads `{message, sessionId}`; it stores the session id
in `localStorage` under `raya_session_id` (`AIChatProvider.tsx:183`).

### 2. AI settings routes (the AI Management Center backend) - one framework, twelve routes

```
GET|PUT /api/ai/settings/<section> (server)
└── aiSettingsService                                     lib/ai/ai-settings/service.ts:25
    ├── aiAdminRepository (tried first)                   lib/ai/ai-settings/admin-repository.ts:47
    │   ├── firebase-admin Firestore ai_settings/main     lib/admin-firebase.ts        [chunk M11]
    │   └── Supabase unknown_questions                    lib/supabase/admin.ts        [chunk M11]
    └── aiSettingsRepository (fallback)                   lib/ai/ai-settings/repository.ts:47
        ├── client firebase/firestore ai_settings/main
        └── Supabase unknown_questions                    lib/supabase/client.ts       [chunk M11]
```
Routes using this framework: `settings/route.ts`, `temple-information`, `visitor-information`, `policies`,
`ai-responses`, `ai-behavior`, `prompts`, `intents`, `unknown-questions`, plus `app/api/admin/prompts/*`
(chunk M12). Every one of them resolves the actor as `request.headers.get("x-user-id") || "admin"`.

### 3. Analytics routes

```
GET /api/ai/analytics[/health|/latency|/token-usage|/intent-distribution|/unknown-questions] (server)
└── services/ai-analytics.service.ts
    ├── getAnalyticsDashboard()      :533   -> Firestore ai_* collections + chat_sessions + chat_messages
    ├── checkAIHealth()              :444   -> getLatencyMetrics + getTokenUsage + thresholds
    ├── getLatencyMetrics()          :299   -> Firestore ai_latency_records
    ├── getTokenUsage()              :248   -> Firestore ai_token_usage
    ├── getIntentDistribution()      :347   -> Firestore ai_intent_distribution
    └── getUnknownQuestions()        :395   -> Firestore ai_unknown_questions
    (record* writers at :97 :123 :159 :193 exist but are called from nowhere - see M08-F02)
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
lib/ai/composer/composer.ts:42      ResponseComposer  - confidence gating + related articles + nav buttons
lib/ai/conversation-memory.ts:32    in-memory session store, duplicate of services/conversation.service.ts
lib/ai/actions/actionRegistry.ts:46 14 registered browser actions (window.location, navigator.share)
lib/ai/actions/useAIActions.ts:1    'use client' hook (the only client file in this chunk)
lib/ai/firebaseChat.ts:201          keyword-matching responder, imported by route.ts:4 but never called
lib/ai/retrieval/index.ts:159       getContextForIntent + INTENT_RETRIEVAL_MAP - the "documented" retrieval map
```

## Data flow

### Flow 1 - a devotee asks "what are the temple timings?"

1. `components/ai/AIChatProvider.tsx:156` (M09) `POST /api/chat` with `{messages, sessionId, userId, detectedLanguage}`.
2. `app/api/chat/route.ts:80` `checkRateLimit()` on `x-forwarded-for` - in-memory `Map`, 20 requests / 60 s.
3. `app/api/chat/route.ts:112` picks the last `role === "user"` message; `:124` derives `responseLanguage`
   by testing for the Kannada Unicode block.
4. `app/api/chat/route.ts:143` `getSessionContext()` loads `chat_sessions/{id}`; if none, `:158`
   `generateSessionId()` mints a uuid into `effectiveSessionId`.
5. `app/api/chat/route.ts:162` `generateResponse(content, effectiveSessionId)` -> `lib/ai/generator.ts:1056`.
6. `lib/ai/generator.ts:1061` `detectIntent()` -> `lib/ai/intent/detector.ts:204`. Out-of-scope check first
   (`:216`), then keyword match over `INTENT_PATTERNS` (`:256`), then the "semantic" pass (`:285`), then
   `combineResults()` (`:476`). "temple timings" hits the `domainKeywords` override at `detector.ts:321`
   and returns `TEMPLE_TIMINGS` at confidence 100.
7. `lib/ai/generator.ts:1090` `handleTempleTimings()` (`:95`) calls `getTempleTimings()`
   (`lib/ai/retrieval/settings.ts:164`), which calls `getTempleSettings()` (`:113`): 5-minute module-level
   cache, else `fetchTimingsFromFirebase()` (`:81`, Firestore `timings`) then `fetchFromFirebase()` (`:37`,
   Firestore `settings` ordered by `updatedAt` desc, first doc wins), else `DEFAULT_SETTINGS` (`:17`).
8. `lib/ai/generator.ts:119-138` formats one of three hardcoded bilingual templates. `usesLLM: false`.
9. `app/api/chat/route.ts:183` `updateSession()` (`services/conversation.service.ts:127`) writes both messages
   into `chat_sessions/{effectiveSessionId}` with `arrayUnion`, then `pruneMessages()` (`:184`) trims to 20.
10. `app/api/chat/route.ts:192` if `confidence < 50`, `logLowConfidenceQuestion()`
    (`lib/ai/unknown-logger.ts:68`) writes Firestore `unknown_questions`.
11. `app/api/chat/route.ts:304-339` returns `{message, sessionId}` - **but `sessionId` is
    `resolvedSessionId || crypto.randomUUID()` (`:306`), not `effectiveSessionId`**, so a first-turn client
    is handed an id that no document uses (see M08-F05).

### Flow 2 - a question nobody anticipated ("is the guest house wheelchair accessible?")

1. Steps 1-6 as above; `detectIntent` returns something below 60 confidence.
2. `lib/ai/generator.ts:1066` low-confidence branch fires (unless the intent is OUT_OF_SCOPE / greeting /
   thanks / goodbye).
3. `lib/ai/generator.ts:1074` `logUnknownQuestion({question, detectedIntent, confidence, language, sessionId})`
   from `services/analytics.service.ts:17` -> Firestore `unknown_questions` with `{...data, timestamp, processed:false}`.
4. `lib/ai/generator.ts:1082` `handleFAQIntent()` (`:526`) returns the static "I specialize in..." menu at
   confidence 80.
5. Because that returned confidence is 80, step 10 of Flow 1 never fires - the *second* logger only sees
   answers that already scored under 50, which the switch almost never produces.
6. Admin triage reads Supabase `unknown_questions` (`app/api/ai/settings/unknown-questions/route.ts:10` ->
   `lib/ai/ai-settings/repository.ts:444`) or Firestore `ai_unknown_questions`
   (`app/api/ai/analytics/unknown-questions/route.ts:8`) - **neither of which is where step 3 wrote**.

### Flow 3 - "tell me about Guru Raghavendra Swamy" (knowledge path)

1. `detectIntent` -> `SRI_RAGHAVENDRA` (domain keyword `raghavendra`, `lib/ai/intent/detector.ts:352`).
2. `lib/ai/generator.ts:1155` `handleKnowledgeIntent()` (`:999`) -> `getKnowledgeContext(query, 3)`
   (`lib/ai/knowledge/index.ts:32`) -> `searchArticles()` (`lib/ai/knowledge/repository.ts:168`).
3. `getKnowledgeArticles()` (`repository.ts:81`) queries Firestore `knowledge` where `approved == true`
   ordered by `category, title` (needs a composite index), caches 5 minutes, and falls back to the in-code
   `SEED_ARTICLES` (`lib/ai/knowledge/seed.ts:49`) when Firebase is unconfigured or the collection is empty.
4. Ranking is a hand-rolled score in `repository.ts:181-223`: title hit +10, content hit +5, keyword hit +15,
   minimum 10, top N. No embeddings, no vectors, despite `docs/AI_ENHANCEMENTS.md` marking "Semantic
   Embeddings" as done.
5. `formatArticlesWithSources()` (`knowledge/index.ts:85`) adds a "📖 Source: Knowledge Centre" line;
   `getSuggestedFollowUps()` (`:128`) appends two canned follow-ups. Confidence is hardcoded 80 (`generator.ts:1045`).

### Flow 4 - "today's quote"

1. `detectIntent` -> `DAILY_QUOTE` (`INTENT_EXAMPLES` at `detector.ts:63`, priority 69).
2. `lib/ai/generator.ts:1104` `handleDailyQuote()` (`:702`) -> `quoteService.getTodaysQuote()`
   (`services/quote.service.ts`, chunk M03/M10) which returns `{quote, context, metadata}`.
3. `formatQuoteResponse()` (`generator.ts:834`) prefers `quote.content.kannada`, then `sanskrit`, then
   `transliteration`; `getQuoteAwarenessMessages()` (`:898`) adds festival/aaradhane framing.
4. `generator.ts:782` dynamically imports `aiSettingsService` and reads `aiBehavior.debugMode`; if on, the
   quote id / rule / cache-hit are appended to the devotee-visible message. **This is the only AI
   Management Center setting the chat engine ever reads.**
5. The chosen category is remembered in a module-level `Map` with a 30-minute `setTimeout`
   (`generator.ts:978-994`) - process-local, lost on redeploy, and a timer leak per session.

### Flow 5 - admin edits the AI prompt

1. Admin UI (M09) `PUT /api/ai/settings/prompts` -> `app/api/ai/settings/prompts/route.ts:64`.
2. Actor = `x-user-id` header or the literal `"admin"` (`:66`).
3. `aiSettingsService.updatePromptVersion()` (`lib/ai/ai-settings/service.ts:402`) ->
   `aiAdminRepository` (firebase-admin, `ai_settings/main`) with `aiSettingsRepository` as fallback.
4. `publishPromptVersion()` (`service.ts:417`) marks one version published.
5. **Nothing consumes it.** The chat path uses `lib/ai/settings.ts:96 getSystemPrompt()` -> Firestore
   `settings/ai` -> `SYSTEM_PROMPT_V2`, and even that is only referenced from the commented-out block at
   `app/api/chat/route.ts:250`. Editing the prompt changes no devotee-visible behaviour.

### LLM provider configuration - what would run if the fallback were re-enabled

`lib/ai/provider.ts:33-67` picks one provider from `process.env.AI_PROVIDER` (default `openai`) and throws on
an unknown value. Nothing in the live path reaches any of this today (M08-F04); it is listed because Recipe E
turns it on and because `GET /api/chat:385` already reports the provider, model and `configured` flag publicly.

| `AI_PROVIDER` | Key env var | Model env var / default | Base URL | Call site |
|---|---|---|---|---|
| `openai` (default) | `OPENAI_API_KEY` | `OPENAI_MODEL` / `gpt-4o-mini` | `https://api.openai.com/v1` | `provider.ts:96` |
| `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` / `openai/gpt-4o-mini` | `https://openrouter.ai/api/v1` | `provider.ts:132` |
| `claude` | `ANTHROPIC_API_KEY` | `CLAUDE_MODEL` / `claude-3-haiku-20240307` | `https://api.anthropic.com/v1` | `provider.ts:191` |
| `gemini` | `GOOGLE_GENERATIVE_API_KEY` | `GEMINI_MODEL` / `gemini-1.5-flash` | `https://generativelanguage.googleapis.com/v1beta` | `provider.ts:228` |

Cost controls: `temperature 0.7` and `max_tokens 2000` are hardcoded at every call site
(`provider.ts:105-106,141-142,203,241-242`) - no env override, no per-user budget, no token accounting
(the recorders are dead, M08-F07). Timeouts: none - no `AbortController`, no retry, no circuit breaker
(M08-F29). Fallback between providers: none - `AIChatProvider.generateResponse` (`provider.ts:266-290`) switches on the
one configured provider and rethrows on failure (`:287-289`); there is no second provider and no retry.
It does measure its own latency and `console.log`s it (`:284-285`) without ever recording it (M08-F07). Key validation:
`isConfigured()` (`:316`) is broken for real OpenAI keys (M08-F11). `.env.example:26-39` declares
`AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` and comments out the Anthropic and OpenRouter keys; it does
**not** declare `AI_HYBRID_MODE`, `GEMINI_MODEL`, `CLAUDE_MODEL` or `GOOGLE_GENERATIVE_API_KEY`.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `app/api/chat/route.ts` | 397 | the chat endpoint | `POST`, `GET` | lines 232-286 are a commented-out LLM fallback; `sessionId` return bug at :306 |
| `lib/ai/generator.ts` | 1191 | intent -> handler switch, all response templates | `generateResponse`, `detectIntent`, `getResponseMetadata`, `AIResponseResult`, `LOW_CONFIDENCE_THRESHOLD` | the real heart of the module; every answer string lives here |
| `lib/ai/intent/detector.ts` | 681 | 3-stage intent classifier | `IntentDetector`, `getIntentDetector`, `detectIntent` | `INTENT_EXAMPLES` map :33; duplicate switch cases :571/:599; unused import `getBestSemanticMatch` :28 |
| `lib/ai/intent/patterns.ts` | 692 | 37 keyword patterns + out-of-scope filters | `INTENT_PATTERNS`, `OUT_OF_SCOPE_PATTERNS`, `OUT_OF_SCOPE_KEYWORDS`, `containsKannada`, `normalizeText` | out-of-scope uses substring `includes`, so `"pm"` and `"food"` misfire |
| `lib/ai/intent/types.ts` | 324 | Intent / IntentCategory / IntentPriority / RetrievalType enums | `Intent` (42 members), `IntentCategory`, `IntentPriority`, `RetrievalType`, `IntentDetectionResult`, `IntentPattern` | 42 intents, 37 patterns, 5 intents unreachable by keyword |
| `lib/ai/intent/transliteration.ts` | 387 | Romanized Kannada -> Kannada script | `transliterateToKannada`, `enhanceWithTransliteration`, `ROMANIZED_KANNADA_PHRASES` | rule-based syllable tables |
| `lib/ai/intent/index.ts` | 20 | barrel | re-exports of the four above | |
| `lib/ai/retrieval/settings.ts` | 206 | temple settings / timings / contact | `getTempleSettings`, `getTempleTimings`, `getContactInfo`, `clearSettingsCache` | reads Firestore `settings` + `timings`; 5-min cache; hardcoded defaults :17 |
| `lib/ai/retrieval/events.ts` | 233 | upcoming events | `getUpcomingEvents`, `getFeaturedEvent`, `getEventsByCategory`, `formatEventsListForDisplay`, `formatEventForDisplay`, `clearEventsCache` | Firestore `events` |
| `lib/ai/retrieval/sevas.ts` | 308 | active sevas | `getActiveSevas`, `getSevasByCategory`, `getDailySevas`, `getSpecialSevas`, `getSevaCategories`, `formatSevasListForDisplay`, `formatSevaForDisplay`, `clearSevasCache` | Firestore `sevas` |
| `lib/ai/retrieval/announcements.ts` | 169 | active announcements | `getActiveAnnouncements`, `getLatestAnnouncements`, `formatAnnouncementsForDisplay`, `clearAnnouncementsCache` | Firestore `announcements`; 2-min cache |
| `lib/ai/retrieval/panchanga.ts` | 230 | today's panchanga | `getTodayPanchanga`, `getPanchangaForDate`, `formatPanchangaForDisplay`, `formatPanchangaSimple`, `clearPanchangaCache` | **filesystem read** `public/data/panchanga/current.json` via `fs` :42-45 |
| `lib/ai/retrieval/donations.ts` | 142 | donation info + 80G | `getDonationInfo`, `formatDonationInfoForDisplay`, `formatDonationPurposeForDisplay`, `format80GInfo`, `clearDonationInfoCache` | derived from settings, purposes hardcoded |
| `lib/ai/retrieval/aaradhane.ts` | 239 | aaradhane calendar | `getAaradhanes`, `getUpcomingAaradhanes`, `getNextAaradhane`, `formatAaradhaneForDisplay`, `formatUpcomingAaradhanes`, `clearAaradhaneCache` | Firestore `aaradhane` |
| `lib/ai/retrieval/types.ts` | 178 | retrieval DTOs | `RetrievedData`, `TempleSettings`, `TempleEvent`, `TempleSeva`, `TempleAnnouncement`, `PanchangaData`, `AaradhaneEvent`, `DonationInfo`, `AIResponseContext`, `IntentRetrievalMapping`, `UnknownQuestionLog` | duplicates `types/multi-source-retrieval.ts` shapes |
| `lib/ai/retrieval/index.ts` | 264 | barrel + intent->retriever map | `INTENT_RETRIEVAL_MAP`, `getContextForIntent`, `clearAllCaches` | **dead**: nothing imports these three |
| `lib/ai/knowledge/index.ts` | 354 | knowledge formatting + canned replies | `getKnowledgeContext`, `formatArticleForContext`, `formatArticlesForContext`, `formatArticlesWithSources`, `getSuggestedFollowUps`, `getGreetingResponse`, `getClosingResponse`, `getOutOfScopeResponse`, `getThankYouResponse` | `formatArticleForContext` unused |
| `lib/ai/knowledge/repository.ts` | 363 | Firestore `knowledge` CRUD + search | `getKnowledgeArticles`, `getArticleById`, `getArticleBySlug`, `getArticlesByCategory`, `searchArticles`, `createArticle`, `updateArticle`, `deleteArticle`, `approveArticle`, `markAsReviewed`, `getPendingArticles`, `getCategoriesWithCounts`, `clearKnowledgeCache` | client Firebase SDK on the server |
| `lib/ai/knowledge/seed.ts` | 835 | in-code seed articles | `SEED_ARTICLES`, `getSeedArticlesForFirebase` | fallback when Firestore is empty |
| `lib/ai/knowledge/types.ts` | 178 | knowledge model | `KnowledgeArticle`, `KnowledgeArticleRequest`, `KnowledgeArticleUpdate`, `KnowledgeSearchResult`, `KnowledgeCategory`, `KnowledgeLanguage`, `CATEGORY_DISPLAY_NAMES`, `CATEGORY_ICONS` | imported by 8 files outside M08 |
| `lib/ai/ai-settings/service.ts` | 604 | AI Management Center facade (60+ methods) | `AISettingsService`, `aiSettingsService` | admin repo first, client repo fallback, hardcoded defaults on error |
| `lib/ai/ai-settings/repository.ts` | 564 | client-SDK Firestore `ai_settings/main` + Supabase | `AISettingsRepository`, `aiSettingsRepository` | mixes `firebase/firestore` and `@/lib/supabase/client` in one class |
| `lib/ai/ai-settings/admin-repository.ts` | 347 | firebase-admin variant | `AIAdminRepository`, `aiAdminRepository` | uses `lib/admin-firebase` + `lib/supabase/admin` |
| `lib/ai/ai-settings/index.ts` | 43 | barrel + type/default re-exports | — | consumed by 12 routes |
| `lib/ai/provider.ts` | 338 | LLM provider abstraction | `AIChatProvider`, `getAIProvider` | OpenAI / OpenRouter / Gemini / Claude; `isPlaceholderKey` :27 rejects any key containing `sk-` |
| `lib/ai/settings.ts` | 112 | Firestore `settings/ai` prompt doc | `AISettings`, `DEFAULT_AI_SETTINGS`, `getAISettings`, `saveAISettings`, `clearSettingsCache`, `getSystemPrompt`, `getWelcomeMessage`, `isAIChatEnabled` | second, parallel settings store to `ai_settings/main` |
| `lib/ai/prompt-refactored.ts` | 121 | V2 prompt with no hardcoded facts | `SYSTEM_PROMPT_V2`, `WELCOME_MESSAGE_V2`, `SUGGESTED_QUESTIONS_V2` | reachable only through the commented-out LLM path |
| `lib/ai/systemPrompt.ts` | 283 | legacy V1 prompt with hardcoded facts | `SYSTEM_PROMPT`, `WELCOME_MESSAGE`, `WELCOME_MESSAGE_KANNADA`, `WELCOME_MESSAGE_MIXED`, `SUGGESTED_QUESTIONS`, `SUGGESTED_QUESTIONS_KANNADA`, `ERROR_MESSAGES`, `ERROR_MESSAGES_KANNADA` | at runtime only `SUGGESTED_QUESTIONS` is used, by `components/ai/SuggestedQuestions.tsx` (M09); all eight exports are also imported by `tests/unit/system-prompt.test.ts:5-13`, which asserts the prompt holds no hardcoded facts |
| `lib/ai/languageDetector.ts` | 181 | standalone language detector | `detectLanguage`, `DetectedLanguage` | used by the client provider (M09), **not** by the server path, which has its own copy at `generator.ts:75` |
| `lib/ai/unknown-logger.ts` | 235 | Firestore `unknown_questions` writer/reader | `logUnknownQuestion`, `logLowConfidenceQuestion`, `logFailedKnowledgeLookup`, `getRecentUnknownQuestions`, `getUnknownQuestionStats` | positional-arg `logUnknownQuestion` collides by name with the object-arg one in `services/analytics.service.ts` |
| `lib/ai/index.ts` | 48 | public barrel for the engine | `generateResponse`, `detectIntent`, `logLowConfidenceQuestion`, knowledge helpers, `SYSTEM_PROMPT_V2` | re-exports both `detectIntent` (generator) and the whole `./intent` barrel |
| `lib/ai/composer/composer.ts` | 520 | confidence gating + related articles + nav buttons | `ResponseComposer`, `responseComposer`, `ComposerResponse`, `ComposerConfig` | **dead** - no importer outside `composer/index.ts` |
| `lib/ai/composer/index.ts` | 4 | barrel | — | dead |
| `lib/ai/conversation-memory.ts` | 244 | in-memory session/follow-up store | `getSession`, `addMessage`, `SessionContext`, `ConversationMessage` | **dead** - zero importers; duplicates `services/conversation.service.ts` |
| `lib/ai/firebaseChat.ts` | 723 | legacy keyword responder + `chatTraining` lookup | `getTempleInfo`, `getTrainingData`, `clearTrainingDataCache`, `generateFirebaseResponse` | imported at `app/api/chat/route.ts:4` but never invoked; hardcodes a personal gmail at :232 |
| `lib/ai/actions/actionRegistry.ts` | 427 | 14 browser-side actions | `registerAction`, `executeAction`, `getActionsForIntent`, `parseActionsFromResponse`, `AIAction`, `ActionType`, `ActionResult` | **dead**; pure DOM (`window.location`, `navigator.share`) |
| `lib/ai/actions/useAIActions.ts` | 57 | `'use client'` hook over the registry | `useAIActions`, `executeActionsFromAIResponse` | dead; the only client file in M08 |
| `lib/ai/actions/index.ts` | 12 | barrel | — | dead |
| `services/chat.service.ts` | 288 | Firestore CRUD: sessions, messages, testimonials, volunteers, feedback | `createChatSession`, `updateChatSession`, `getChatSession`, `getUserChatSessions`, `saveMessage`, `getSessionMessages`, `submitTestimonial`, `getApprovedTestimonials`, `getPendingTestimonials`, `approveTestimonial`, `deleteTestimonial`, `submitVolunteerRequest`, `getVolunteerRequests`, `updateVolunteerRequestStatus`, `submitFeedback`, `getFeedbackStats` | called from the browser (M09) and from routes in M12 |
| `services/conversation.service.ts` | 373 | conversation sessions + follow-up heuristics | `generateSessionId`, `getSession`, `createSession`, `updateSession`, `detectFollowUp`, `getSessionContext`, `clearSession`, `deleteSession` | `createSession` and `clearSession` are imported by the route but never called |
| `services/knowledge.service.ts` | 286 | public Knowledge Centre reads | `getKnowledgeCategories`, `getPopularArticles`, `getRecentArticles`, `getFeaturedArticle`, `getKnowledgeCentreData`, `getPublicArticleBySlug`, `getPublicArticlesByCategory`, `searchKnowledge`, `getRelatedArticles`, `getArticlePageData`, `getAllArticleSlugs`, `getAllCategorySlugs`, `knowledgeService` | view counts held in a module `Map` (`:28`) |
| `services/multi-source-retrieval.service.ts` | 586 | dashboard fan-out | `executeMultiSourceQuery`, `getTempleOverview`, `getTodayInfo`, `QUICK_QUERIES`, `getIntentSuggestions`, `getRetrievalStats`, `resetRetrievalStats`, `updateFreshness`, `getDataFreshness`, `addToQueryHistory`, `getQueryHistory`, `clearQueryHistory` | 5 `any` uses; `updateStats`/`updateFreshness` never called |
| `services/ml.service.ts` | 453 | similarity, typo correction, learned corrections | `calculateIntentSimilarity`, `getBestSemanticMatch`, `levenshteinDistance`, `fuzzyMatch`, `autoCorrectMessage`, `learnFromCorrection`, `getCorrectedIntent`, `getLearnedCorrections`, `clearLearnedCorrections`, `getCorrectionCount`, `exportCorrections`, `SemanticMatch`, `FuzzyMatch`, `CorrectionEntry` | "ML" = weighted keyword sets + Levenshtein; `learnFromCorrection` has no callers so `getCorrectedIntent` always returns null |
| `services/ai-analytics.service.ts` | 873 | analytics reads and (unused) writes | `getAnalyticsSettings`, `recordTokenUsage`, `recordLatency`, `recordIntentDistribution`, `recordUnknownQuestion`, `markUnknownQuestionReviewed`, `getTokenUsage`, `getLatencyMetrics`, `getIntentDistribution`, `getUnknownQuestions`, `checkAIHealth`, `getAnalyticsDashboard` | writes split Firestore/Supabase; `as any` at :142 and :449 |
| `app/api/ai/analytics/route.ts` | 28 | dashboard aggregate | `GET` | |
| `app/api/ai/analytics/health/route.ts` | 22 | health | `GET` | |
| `app/api/ai/analytics/latency/route.ts` | 33 | latency | `GET` | |
| `app/api/ai/analytics/token-usage/route.ts` | 33 | token usage | `GET` | |
| `app/api/ai/analytics/intent-distribution/route.ts` | 32 | intent mix | `GET` | |
| `app/api/ai/analytics/unknown-questions/route.ts` | 62 | unknown Qs (Firestore `ai_unknown_questions`) | `GET`, `PATCH` | |
| `app/api/ai/knowledge/coverage/route.ts` | 144 | category coverage report | `GET` | 30 expected categories hardcoded :7-43 |
| `app/api/ai/knowledge/import/route.ts` | 157 | seed importer over HTTP | `POST` | reads `seed/ai/*.json` with `fs`; writes Firestore `knowledge` |
| `app/api/ai/multi-source/overview/route.ts` | 19 | all sources | `GET` | |
| `app/api/ai/multi-source/today/route.ts` | 19 | today's info | `GET` | |
| `app/api/ai/multi-source/query/route.ts` | 54 | ad-hoc query | `POST` | |
| `app/api/ai/multi-source/quick-queries/route.ts` | 13 | static presets | `GET` | |
| `app/api/ai/multi-source/statistics/route.ts` | 26 | stats + freshness + history | `GET` | always zeroed |
| `app/api/ai/settings/route.ts` | 79 | whole-settings read/mutate | `GET`, `POST` | `TODO: Add proper admin authentication` at :24 |
| `app/api/ai/settings/temple-information/route.ts` | 69 | timings/contact/office hours | `GET`, `PUT` | `revalidate = 3600` |
| `app/api/ai/settings/visitor-information/route.ts` | 72 | guidelines, dress code, parking… | `GET`, `PUT` | |
| `app/api/ai/settings/policies/route.ts` | 57 | donation / 80G / seva policies | `GET`, `PUT` | |
| `app/api/ai/settings/ai-responses/route.ts` | 48 | response templates | `GET`, `PUT` | |
| `app/api/ai/settings/ai-behavior/route.ts` | 58 | confidence threshold, debug, streaming | `GET`, `PUT` | only `debugMode` is ever read by the engine |
| `app/api/ai/settings/prompts/route.ts` | 107 | prompt versions | `GET`, `POST`, `PUT` | published prompt is never used at runtime |
| `app/api/ai/settings/intents/route.ts` | 131 | intent metadata CRUD | `GET`, `POST`, `PUT`, `DELETE` | detector reads code constants, not this store |
| `app/api/ai/settings/unknown-questions/route.ts` | 138 | triage (Supabase) | `GET`, `POST`, `PUT`, `DELETE` | |
| `app/api/seed-ai-settings/route.ts` | 723 | one-shot settings seeder | `POST`, `GET` | auth bypass :117-140; hardcoded Firebase web key :63; writes `ai_settings/%20RayaAI` :547 |
| `types/ai.ts` | 120 | chat contracts | `AIMessage`, `ChatSession`, `AIProvider`, `ChatRequest`, `ChatResponse`, `ChatFeedback`, `Testimonial`, `VolunteerRequest`, `SuggestedQuestion`, `AIAnalytics`, `AIAction`, `KnowledgeItem`, `DetectedLanguage` | the React Native contract lives here |
| `types/ai-settings.ts` | 297 | AI Management Center model + defaults | `AISettings`, `TempleInformation`, `VisitorInformation`, `TemplePolicies`, `AIResponses`, `AIBehaviorSettings`, `PromptSettings`, `PromptVersion`, `IntentSettings`, `IntentMetadata`, `UnknownQuestion`, `DEFAULT_*` | |
| `types/ai-analytics.ts` | 261 | analytics records and summaries | `TokenUsageRecord`, `LatencyRecord`, `IntentDistributionRecord`, `UnknownQuestionRecord`, `AIHealthStatus`, `*Summary`, `*Response`, `AIAnalyticsDashboard`, `AIAnalyticsSettings` | records that are never written |
| `types/multi-source-retrieval.ts` | 238 | dashboard model | `DataSource`, `MultiSourceQuery`, `SourceResult`, `MultiSourceResponse`, `TempleSettingsData`, `TempleEvent`, `TempleSeva`, `TempleAnnouncement`, `PanchangaData`, `QuickQuery`, `RetrievalStats`, `DataFreshness`, `QueryHistoryEntry` | duplicates `lib/ai/retrieval/types.ts` |
| `types/knowledge.ts` | 232 | public Knowledge Centre view model | `KnowledgeArticlePublic`, `KnowledgeCategoryInfo`, `KnowledgeCentreData`, `KnowledgeBookmark`, `RecentlyViewed`, `SearchSuggestion`, `ArticlePageData`, `BreadcrumbItem`, `KNOWLEDGE_CATEGORY_CONFIG` | re-exports from `lib/ai/knowledge/types` |
| `seed/ai/*.json` (15 files, 15 lines each except `seed/ai/faq.json` 48) | 258 | seed knowledge articles: `seed/ai/about-trust.json`, `seed/ai/accommodation.json`, `seed/ai/brindavana.json`, `seed/ai/contact.json`, `seed/ai/donation.json`, `seed/ai/dress-code.json`, `seed/ai/facilities.json`, `seed/ai/faq.json`, `seed/ai/history.json`, `seed/ai/parking.json`, `seed/ai/photography.json`, `seed/ai/raghavendra-swamy.json`, `seed/ai/temple-timings.json`, `seed/ai/visitor-guidelines.json`, `seed/ai/volunteer.json` | JSON | every file has `slug,title,category,language,keywords,summary,content,approved,version,lastReviewed,reviewedBy,tags` **except `seed/ai/faq.json`, which has `questions` instead of `content`** |
| `scripts/seed-ai-knowledge.ts` | 181 | CLI seeder | `seedKnowledge` (default run) | writes Firestore **`articles`** (`:65`, `:143`) - not `knowledge` |
| `scripts/seed-ai-settings.ts` | 535 | CLI settings seeder | `seedAISettings` | writes `ai_settings/main` (`:504`) via firebase-admin |
| `scripts/migrate-ai-to-supabase.ts` | 292 | Firestore -> Supabase copy | migration entry | uses `lib/admin-firebase` + `lib/supabase/admin` |

## Types and stores

**Type modules owned here:** `types/ai.ts`, `types/ai-settings.ts`, `types/ai-analytics.ts`,
`types/multi-source-retrieval.ts`, `types/knowledge.ts`, plus the module-local `lib/ai/intent/types.ts`,
`lib/ai/retrieval/types.ts`, `lib/ai/knowledge/types.ts`. Types imported from elsewhere:
`types/quote.ts` (`Quote`, `QuoteCategory`) in `lib/ai/generator.ts:44`.

**Firestore collections**

| Collection | Read by | Written by |
|---|---|---|
| `settings` | `lib/ai/retrieval/settings.ts:44` | — (M05 admin) |
| `timings` | `lib/ai/retrieval/settings.ts:87` | — |
| `events` | `lib/ai/retrieval/events.ts:66`, `lib/ai/firebaseChat.ts:76` | — |
| `sevas` | `lib/ai/retrieval/sevas.ts:125`, `lib/ai/firebaseChat.ts:105` | — |
| `announcements` | `lib/ai/retrieval/announcements.ts:58` | — |
| `aaradhane` | `lib/ai/retrieval/aaradhane.ts:65` | — |
| `trust` | `lib/ai/firebaseChat.ts:120` (dead path) | — |
| `chatTraining` | `lib/ai/firebaseChat.ts:153` (dead path) | — |
| `knowledge` | `lib/ai/knowledge/repository.ts:93`, `app/api/ai/knowledge/coverage/route.ts:81` | `lib/ai/knowledge/repository.ts:239,265,283`; `app/api/ai/knowledge/import/route.ts:114` |
| `articles` | `scripts/seed-ai-knowledge.ts:65` | `scripts/seed-ai-knowledge.ts:143` - **orphan collection, nothing reads it at runtime** |
| `settings/ai` (doc) | `lib/ai/settings.ts:39` | `lib/ai/settings.ts:68` |
| `ai_settings/main` (doc) | `lib/ai/ai-settings/repository.ts:62`, `admin-repository.ts:39` | same + `scripts/seed-ai-settings.ts:504` |
| `ai_settings/%20RayaAI`, `ai_settings/prompts`, `ai_settings/intents`, `ai_settings/unknown_questions`, `ai_settings/welcome` | — | `app/api/seed-ai-settings/route.ts:547,558,577,582,587` - **written, never read** |
| `settings/temple`, `settings/contact`, `settings/visitor` | indirectly by `retrieval/settings.ts` | `app/api/seed-ai-settings/route.ts:594,599,607` |
| `chat_sessions` | `services/conversation.service.ts:61`, `services/chat.service.ts:58`, `ai-analytics.service.ts:598` | `services/conversation.service.ts:112,161,199,348`; `services/chat.service.ts:39,49` |
| `messages` | `services/chat.service.ts:119` | `services/chat.service.ts:101` |
| `chat_messages` | `services/ai-analytics.service.ts:610` | — (nothing writes it; `messages` is the real collection) |
| `testimonials`, `volunteer_requests`, `feedback` | `services/chat.service.ts:158,224,271` | `services/chat.service.ts:151,217,260,193,201,243` |
| `unknown_questions` | `lib/ai/unknown-logger.ts:137,197`; `services/analytics.service.ts:75,111` | `lib/ai/unknown-logger.ts:55`; `services/analytics.service.ts:31` (**two schemas: `reviewed:false` vs `processed:false`**) |
| `ai_token_usage`, `ai_latency_records`, `ai_intent_distribution`, `ai_unknown_questions` | `services/ai-analytics.service.ts:260,308,356,404` | writers exist (`:107,203`) but have no callers |
| `ai_settings` (as a collection) | `services/ai-analytics.service.ts:63` for analytics thresholds | — |

**Supabase tables**

| Table | Read by | Written by |
|---|---|---|
| `unknown_questions` | `lib/ai/ai-settings/repository.ts:453`, `admin-repository.ts:272` | `repository.ts:391,427,513`, `:523` delete |
| `ai_latency_records` | — (reads go to Firestore) | `services/ai-analytics.service.ts:134` (dead) |
| `ai_intent_distribution` | — (reads go to Firestore) | `services/ai-analytics.service.ts:170` (dead) |
| `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records` | — (only `unknown_questions` is read back, by `lib/ai/ai-settings/repository.ts:453`) | `scripts/migrate-ai-to-supabase.ts:183,199,220,247,265` - a hand-run one-shot Firestore->Supabase copy; Firestore `messages` lands in Supabase `chat_messages` |

**Static files**

| File | Read by |
|---|---|
| `public/data/panchanga/current.json` | `lib/ai/retrieval/panchanga.ts:42` via `fs.readFileSync` |
| `seed/ai/*.json` | `app/api/ai/knowledge/import/route.ts:96`, `scripts/seed-ai-knowledge.ts:125` |

## Cross-module dependencies

**M08 imports from other chunks** (from `.claude/state/inventory/M08.json` `localImports`):

| Imported | Chunk | Used by |
|---|---|---|
| `lib/firebase.ts` | M11 | 15 files (all retrieval modules, knowledge repo, chat/conversation/analytics services) |
| `lib/admin-firebase.ts` | M11 | `lib/ai/ai-settings/admin-repository.ts`, `scripts/migrate-ai-to-supabase.ts` |
| `lib/supabase/client.ts` | M11 | `lib/ai/ai-settings/repository.ts`, `services/ai-analytics.service.ts` |
| `lib/supabase/admin.ts` | M11 | `lib/ai/ai-settings/admin-repository.ts`, `scripts/migrate-ai-to-supabase.ts` |
| `lib/panchanga-cache.ts` | M14 | `lib/ai/retrieval/panchanga.ts` |
| `services/analytics.service.ts` | M10 | `lib/ai/generator.ts` (unknown-question logging), `services/ml.service.ts` (`logIntentFeedback`) |
| `services/quote.service.ts`, `types/quote.ts` | M03/M10 | `lib/ai/generator.ts` (DAILY_QUOTE) |
| `services/ux.service.ts` | M10 | `app/api/chat/route.ts` (quick actions, suggested questions) |

**Who imports M08** (from `import-graph.json`):

| M08 file | Imported by | Chunk |
|---|---|---|
| `lib/ai/knowledge/types.ts` | `app/admin/ai/unknown-questions/page.tsx`, `app/admin/knowledge/page.tsx`, `app/api/knowledge/workflow/{articles,drafts}/route.ts`, `components/ai/KnowledgeWorkflowDashboard.tsx`, `services/content.service.ts` (8 files) | M09, M12, M10 |
| `lib/ai/knowledge/repository.ts`, `lib/ai/knowledge/seed.ts` | `app/api/admin/knowledge/route.ts`, `app/api/admin/knowledge/[id]/route.ts` | M12 |
| `lib/ai/ai-settings/index.ts` | `app/api/admin/prompts/route.ts` and its `[id]` routes | M12 |
| `lib/ai/intent/types.ts` | `components/ai/AIAnalyticsDashboard.tsx`, `services/ux.service.ts` | M09, M10 |
| `lib/ai/languageDetector.ts`, `lib/ai/settings.ts` | `components/ai/AIChatProvider.tsx` | M09 |
| `lib/ai/systemPrompt.ts` | `components/ai/SuggestedQuestions.tsx` | M09 |
| `services/chat.service.ts` | `components/ai/AIChatProvider.tsx`, `app/admin/ai/*`, `app/api/{testimonials,volunteer}/route.ts` (6) | M09, M12 |
| `services/knowledge.service.ts` | `app/knowledge/*`, `app/api/knowledge/*`, `app/(public)/favorites/page.tsx` (11) | M02, M12 |
| `types/ai.ts`, `types/ai-settings.ts`, `types/ai-analytics.ts`, `types/multi-source-retrieval.ts`, `types/knowledge.ts` | admin pages and chat components | M09, M02 |

Boundary note: `lib/ai/settings.ts` is imported by a **client** component (`AIChatProvider.tsx`) and it imports
`firebase/firestore` directly - the settings read for the welcome message therefore happens in the browser.

## How to change it

### Recipe A - add a new intent end to end (e.g. `LOST_AND_FOUND`)
1. `lib/ai/intent/types.ts` - add the enum member to `Intent` and a number to `IntentPriority`; map it in
   `IntentCategory` if a new grouping is needed.
2. `lib/ai/intent/patterns.ts` - append an `IntentPattern` to `INTENT_PATTERNS` with `keywords.en` and
   `keywords.kn` and the right `requiresStructuredData` flag.
3. `lib/ai/intent/detector.ts:33` - add paraphrases to `INTENT_EXAMPLES` (the record is typed
   `Record<Intent, string[]>`, so the compiler will demand an entry); add a `domainKeywords` row at `:319`
   only if one exact phrase must win outright; extend `getCategoryForIntent()` at `:566`.
4. `services/ml.service.ts:95` - optionally add an `INTENT_WEIGHTS` entry.
5. `lib/ai/generator.ts` - write `handleLostAndFound(language)` next to the other handlers and add the
   `case` to the switch at `:1086`. Return `{content, intent, confidence, source, usesLLM:false, language}`.
6. `services/conversation.service.ts:210` - add the intent to `mapIntentToTopic` so follow-ups work.
7. If it needs new data, add a retriever under `lib/ai/retrieval/` following `settings.ts` (cache +
   `RetrievedData<T>` + `clearXCache`) and export it from `lib/ai/retrieval/index.ts`.
8. Optional: register it in the AI Management Center via `POST /api/ai/settings/intents` - understand that
   this is metadata only and does not affect detection.

### Recipe B - change what an existing answer says
1. Find the handler in `lib/ai/generator.ts` (`handleTempleTimings` `:95`, `handleDonation` `:414`, …).
2. Edit the `en` / `kn` / `mixed` template literal in place. There are three per handler; keep them in sync.
3. Do **not** look in `lib/ai/prompt-refactored.ts`, `lib/ai/systemPrompt.ts` or the prompt versions in the
   AI Management Center - none of them reach the devotee.

### Recipe C - add a field to the temple settings the AI quotes
1. `lib/ai/retrieval/types.ts` - add the field to `TempleSettings`.
2. `lib/ai/retrieval/settings.ts:37` `fetchFromFirebase()` - map the Firestore field, and add a default at `:17`.
3. `lib/ai/generator.ts` - surface it in the relevant handler template.
4. `types/ai-settings.ts` + `lib/ai/ai-settings/{repository,admin-repository}.ts` - only if admins must edit
   it through the Management Center; then extend the matching `app/api/ai/settings/*` route.
5. `app/api/seed-ai-settings/route.ts:143` and `scripts/seed-ai-settings.ts:26` - add it to both seed payloads.

### Recipe D - add a knowledge article
1. Create `seed/ai/<slug>.json` copying the field set of `seed/ai/parking.json` (must include `content` and
   `approved: true` - see M08-F12 about `faq.json`).
2. Add the category id to `app/api/ai/knowledge/coverage/route.ts:7` and to
   `app/api/ai/knowledge/import/route.ts:8` so coverage reporting sees it.
3. Import it with `POST /api/ai/knowledge/import` (writes `knowledge`). Do **not** use
   `scripts/seed-ai-knowledge.ts` - it writes the orphan `articles` collection.
4. Map the article's category to an intent in `lib/ai/generator.ts:1145-1155` if a dedicated intent should
   route to it.

### Recipe E - turn the LLM fallback back on
1. `app/api/chat/route.ts` - delete the safe-error block `:215-231` and uncomment `:232-286`.
2. `lib/ai/provider.ts:11-31` - fix `PLACEHOLDER_KEY_PATTERNS`; `"sk-"` and `"test"` currently make every
   real OpenAI key look fake, so `isConfigured()` returns false.
3. Add a timeout/`AbortController` around the four `fetch` calls (`:96,132,191,228`) - there is none today.
4. Wire `recordTokenUsage` / `recordLatency` (`services/ai-analytics.service.ts:97,123`) at the call site,
   otherwise cost is invisible.
5. Decide which prompt wins: `lib/ai/settings.ts:96` (`settings/ai`) or the published prompt version in
   `ai_settings/main`; today they are two unrelated stores.

### Recipe F - add authentication to an AI route
1. There is **no `middleware.ts`** in the repo - nothing protects `/api/ai/*` today.
2. Follow the pattern used elsewhere in M04/M12 (Firebase ID-token verification through
   `lib/admin-firebase.ts`) and replace `request.headers.get("x-user-id") || "admin"` in each
   `app/api/ai/settings/*` route with the verified uid.
3. Apply the same to `app/api/ai/knowledge/import/route.ts`, `app/api/ai/analytics/unknown-questions`
   (PATCH) and `app/api/seed-ai-settings/route.ts` (whose `getAdminUser` at `:117` returns an admin
   unconditionally in production).

### Recipe G - make session continuity work
1. `app/api/chat/route.ts` - hoist `effectiveSessionId` out of the `try` block at `:138` so it is in scope at
   `:306`, and return it instead of `resolvedSessionId || crypto.randomUUID()`.
2. `services/conversation.service.ts:311` `getSessionContext` - pass the *incoming user message* to
   `detectFollowUp`, not `lastMessage.content` (the assistant's own reply).
3. Use the returned `enrichedMessage` at `app/api/chat/route.ts:143` - it is destructured and dropped today.

## Faults, smells and risks

| id | sev | What | Evidence | Direction |
|---|---|---|---|---|
| M08-F01 | HIGH | Every `/api/ai/*` route and `/api/chat` is unauthenticated. Admin settings, prompt versions, intent metadata and unknown-question triage can be read and mutated by anyone; the actor is whatever `x-user-id` header the caller sends. There is no `middleware.ts` in the repo. | `app/api/ai/settings/route.ts:23-25` (`TODO: Add proper admin authentication`), same pattern in `prompts/route.ts:30,66`, `intents/route.ts:38,80,107`, `policies/route.ts:23`, `temple-information/route.ts:30`, `visitor-information/route.ts:23`, `ai-behavior/route.ts:24`, `ai-responses/route.ts:24`; no `middleware.ts` at repo root | Verify a Firebase ID token in each handler (Recipe F); add `middleware.ts` matching `/api/ai/:path*`. |
| M08-F02 | HIGH | `POST /api/seed-ai-settings` returns an admin identity unconditionally when `NODE_ENV === "production"`, and falls through to `{uid:"dev-admin"}` otherwise - so the 401 at `:543` is unreachable. The endpoint overwrites eight settings documents. | `app/api/seed-ai-settings/route.ts:117-140`, `:539-543` | Require the admin API key in all environments, or delete the route and keep only the CLI seeder. |
| M08-F03 | HIGH | A live Firebase Web API key and project id are hardcoded as literal fallbacks in source. | `app/api/seed-ai-settings/route.ts:63` (`"AIzaSy…"`), `:74` (`"sri-raghavendra-mutt"`) | Remove the literals; fail loudly when the env var is absent. Rotate the key. |
| M08-F04 | HIGH | The documented "hybrid retrieval (Firebase + LLM fallback)" does not exist: no code path calls an LLM. The sole `provider.generateResponse` call site is inside a comment block, and every generator result is `usesLLM: false` (0 occurrences of `usesLLM: true` in the repo). | `app/api/chat/route.ts:232-286` (commented), `:215-231` (safe-error replacement), `lib/ai/generator.ts` all handlers; `AGENTS.md` "AI: Hybrid retrieval (Firebase + LLM fallback)"; `docs/AI-GUIDELINES.md:41-52` fallback chain step 3 | Either re-enable it deliberately (Recipe E) or update AGENTS.md and the four AI docs to describe a deterministic template engine. |
| M08-F05 | MEDIUM | The chat response returns a session id that is not the one written to Firestore. On a first turn the route mints `effectiveSessionId` (`:158`), stores both messages under it (`:183`), then returns `crypto.randomUUID()` (`:306`) because `effectiveSessionId` is scoped inside the `try` at `:138`. The client persists the returned id, so the first exchange is orphaned in a `chat_sessions` document nothing will ever read again, and one such orphan is created per new chat. It self-heals from turn 2: the client now sends a non-empty id, the route keeps it, and `updateSession` uses `setDoc(..., {merge:true})` (`services/conversation.service.ts:157-171`) so the document is created under it. So memory is not permanently broken - it loses turn 1 and leaks a document. | `app/api/chat/route.ts:130,138,158,183,306`; `services/conversation.service.ts:157-171`; `components/ai/AIChatProvider.tsx:180-183` | Recipe G step 1. |
| M08-F06 | HIGH | Follow-up detection is fed the wrong text: `getSessionContext` matches the *assistant's* previous reply against the follow-up patterns, and the computed `enrichedMessage` is destructured at the route and then never used. | `services/conversation.service.ts:327-329`; `app/api/chat/route.ts:143` | Recipe G steps 2-3. |
| M08-F07 | HIGH | No analytics are ever recorded. `recordTokenUsage`, `recordLatency`, `recordIntentDistribution` and `recordUnknownQuestion` have zero callers, so `/api/ai/analytics*`, the health check and every admin chart read permanently empty collections and report "healthy". | `services/ai-analytics.service.ts:97,123,159,193` - repo-wide grep finds only the definitions; consumed by `app/api/ai/analytics/*` and `components/ai/AIAnalyticsDashboard.tsx` | Call the recorders from `app/api/chat/route.ts` around `generateResponse`, or remove the dashboards. |
| M08-F08 | HIGH | Unknown questions are scattered across three stores with two schemas: Firestore `unknown_questions` written by two different functions with different field sets, Firestore `ai_unknown_questions` read by the analytics route, and Supabase `unknown_questions` read by the settings route. Nothing the chat writes is visible in either admin screen until somebody re-runs `scripts/migrate-ai-to-supabase.ts:220` by hand, which copies Firestore `unknown_questions` into the Supabase table the settings route reads - so the admin triage list is a manual snapshot, not live, and the `processed` / `reviewed` field split survives the copy. | writers: `services/analytics.service.ts:31` (`processed:false`) and `lib/ai/unknown-logger.ts:55` (`reviewed:false`, `questionLower`, `expectedIntent`…); readers: `app/api/ai/analytics/unknown-questions/route.ts:17` -> `ai-analytics.service.ts:404`; `app/api/ai/settings/unknown-questions/route.ts:19` -> `lib/ai/ai-settings/repository.ts:453` | Pick one store and one schema; make the chat route the single writer. |
| M08-F09 | MEDIUM | Roughly 2,400 lines of dead code: `lib/ai/composer/` (524), `lib/ai/conversation-memory.ts` (244), `lib/ai/actions/` (496), `lib/ai/firebaseChat.ts` (723, imported but never invoked), `lib/ai/retrieval/index.ts:86-251` (`INTENT_RETRIEVAL_MAP`, `getContextForIntent`, `clearAllCaches`), `services/multi-source-retrieval.service.ts:464` (`updateStats`) and `:519` (`updateFreshness`), `services/ml.service.ts:352` (`learnFromCorrection`). | grep for each symbol returns only its definition and barrel re-export; `app/api/chat/route.ts:4` imports `generateFirebaseResponse`/`getTempleInfo` and never calls them | Delete, or move behind a clearly-labelled `legacy/` folder. Keeping `firebaseChat.ts` imported drags `chatTraining`/`trust` reads into the bundle. |
| M08-F10 | MEDIUM | Out-of-scope detection uses plain substring `includes`, so `"pm"` in `OUT_OF_SCOPE_KEYWORDS.en` rejects any message containing that pair of letters (e.g. "does the temple close at 8:30pm?"), and the regex list rejects `food`, `app`, `website` and `hotel booking` - which collide with the ANNADANA ("free food", "lunch") and SEVA_BOOKING intents. The out-of-scope check runs *first*, before any intent matching. | `lib/ai/intent/patterns.ts:671` (`"pm"`), `:659` (`food|restaurant|hotel booking`), `:647` (`app|website`); `lib/ai/intent/detector.ts:216,622-637`; conflicting examples at `detector.ts:157-160` | Use word-boundary regexes, drop `"pm"`, and run out-of-scope only when no intent scores above threshold. |
| M08-F11 | MEDIUM | `isPlaceholderKey` treats any key containing `"sk-"`, `"test"`, `"example"` or `"null"` as a placeholder. Every genuine OpenAI key starts with `sk-`, so `isConfigured()` is always false for OpenAI and `GET /api/chat` always reports `configured:false`. | `lib/ai/provider.ts:11-31`, `:316-319` (the file is 337 lines, so the `configured` flag is read at `app/api/chat/route.ts:385-392`) | Check a prefix/length/shape per provider instead of substring matching. |
| M08-F12 | MEDIUM | `seed/ai/faq.json` carries a `questions` array instead of `content`, so after import its article has `content: ""` (`lib/ai/knowledge/repository.ts:66`) and can never be matched by `searchArticles`, which scores title/content/keywords only. | `seed/ai/faq.json` keys vs the other 14 seed files; `lib/ai/knowledge/repository.ts:66,194-200` | Flatten the Q&A pairs into `content` at import time, or teach the importer about `questions`. |
| M08-F13 | MEDIUM | Two seeders write two different collections for the same data: the CLI writes Firestore `articles`, the HTTP importer writes `knowledge`, and only `knowledge` is ever read. `npm run seed:ai` therefore appears to succeed and changes nothing. | `scripts/seed-ai-knowledge.ts:65,143` vs `app/api/ai/knowledge/import/route.ts:73,114`; reader `lib/ai/knowledge/repository.ts:27,93` | Point the CLI at `knowledge` and delete the `articles` path. |
| M08-F14 | MEDIUM | Two parallel AI settings stores that never reconcile: `settings/ai` (`lib/ai/settings.ts`) holds the system prompt read by the chat path, while `ai_settings/main` holds the AI Management Center model. A third set of documents (`ai_settings/%20RayaAI` - note the URL-encoded leading space - `ai_settings/prompts`, `ai_settings/intents`, `ai_settings/unknown_questions`, `ai_settings/welcome`) is written by the seeder and read by nothing. | `lib/ai/settings.ts:39,68`; `lib/ai/ai-settings/repository.ts:42-44,62`; `app/api/seed-ai-settings/route.ts:547,558,577,582,587`; `scripts/seed-ai-settings.ts:504` | Collapse to one document; delete the `%20RayaAI` writes. |
| M08-F15 | MEDIUM | Almost nothing in the AI Management Center affects the runtime. Prompt versions, intent metadata, confidence threshold, response templates, temple/visitor information and policies are all stored and never read by `generateResponse`; the only setting consumed is `aiBehavior.debugMode`, and it leaks internal debug text into the devotee-visible message. | `lib/ai/generator.ts:782-798` is the sole `aiSettingsService` call in the engine; `LOW_CONFIDENCE_THRESHOLD` is the constant `60` at `generator.ts:49` rather than `getConfidenceThreshold()` (`lib/ai/ai-settings/service.ts:328`) | Read the settings at request time (with a short cache), and gate debug text on an admin-only flag, not a stored boolean. |
| M08-F16 | MEDIUM | Direct Firebase calls throughout `lib/ai/**`, against `AGENTS.md` ("No Direct Firebase Calls - use services only" / "Repository Pattern"). 15 files import `@/lib/firebase` and call `collection()/doc()` inline, and they use the **client** SDK inside server route handlers, so every read is subject to Firestore security rules and the client quota rather than admin credentials. | `lib/ai/retrieval/{settings,events,sevas,announcements,aaradhane}.ts:4-5`, `lib/ai/knowledge/repository.ts:16-17`, `lib/ai/unknown-logger.ts:8-9`, `services/{chat,conversation,ai-analytics}.service.ts` | Introduce real repositories on `firebase-admin` for server paths (`lib/admin-firebase.ts` already exists). |
| M08-F17 | MEDIUM | Rate limiting and every cache are per-process in-memory `Map`s. On Vercel's serverless/edge fan-out each instance keeps its own counter and its own 5-minute cache, so the 20/min limit is effectively `20 × instances` and cache invalidation via `clearXCache()` only clears one instance. | `app/api/chat/route.ts:29-51`; `lib/ai/retrieval/*.ts` module-level `cached*` + `CACHE_DURATION`; `services/ml.service.ts:40`; `services/multi-source-retrieval.service.ts:508,552`; `services/knowledge.service.ts:28`; `lib/ai/generator.ts:978` | Move rate limiting to a shared store (Upstash/Redis) and caching to `unstable_cache`/ISR. |
| M08-F18 | MEDIUM | `generator.ts:990-994` schedules a 30-minute `setTimeout` per session to evict a quote-category entry. In a long-lived server this pins timers and memory per session; in serverless it never fires. | `lib/ai/generator.ts:978-994` | Use a timestamped map with lazy eviction. |
| M08-F19 | MEDIUM | `any` used in violation of AGENTS.md ("no `any`, use `unknown`"). | `services/ai-analytics.service.ts:142` (`(data as any).model`), `:449` (`as any`); `services/multi-source-retrieval.service.ts:92,132,169,265,508,519` | Type the records properly; `LatencyRecord` already has no `model` field, which is why the cast exists. |
| M08-F20 | MEDIUM | `POST /api/ai/knowledge/import` is unauthenticated, reads the filesystem and bulk-writes Firestore; `GET /api/seed-ai-settings` performs writes (a non-idempotent GET) though it is dev-gated. | `app/api/ai/knowledge/import/route.ts:50,96,114`; `app/api/seed-ai-settings/route.ts:637-644` | Gate both behind admin auth; make the seeder POST-only. |
| M08-F21 | MEDIUM | Devotee-visible prompt-injection / echo surface: the chat endpoint accepts an unbounded `messages` array and an arbitrary `detectedLanguage`, with no length cap on `content`. There is no LLM today, so injection cannot steer a model - but the whole array is accepted, `content` is echoed into logs at `route.ts:121` and the message body is written verbatim into Firestore session history and unknown-question logs. Re-enabling the LLM (Recipe E) would pass the untrusted array straight into the provider (`route.ts:242-253`). | `app/api/chat/route.ts:100-121`, `:242-253` (commented), `services/conversation.service.ts:137-151`; only `unknown-logger.ts:38-41` truncates | Validate the body with a schema (max messages, max chars, enum language) before anything else. |
| M08-F22 | LOW | PII and raw devotee text in logs and stores: the full question is `console.log`'d, sessions store message bodies for 30 minutes of TTL that nothing enforces (`SESSION_TTL` is declared and never used), and the unknown-question logger accepts and stores `ip` and `userAgent`. | `app/api/chat/route.ts:77,121` (truncated to 50 chars); **`lib/ai/intent/detector.ts:213` logs the whole untruncated message**, followed by five more per-request `console.log`s at `:217,230,234,238,242` and one at `lib/ai/generator.ts:1063`; `services/conversation.service.ts:41` (`SESSION_TTL` unused); `lib/ai/unknown-logger.ts:24-28,45-46` | Hash or drop IP, add a real TTL/cleanup job, and stop logging message content in production. |
| M08-F23 | LOW | Dead code hazards in `lib/ai/firebaseChat.ts`: a personal Gmail address and a phone number different from every other default are baked in as the fallback temple contact. | `lib/ai/firebaseChat.ts:228-243` (`ngowda759@gmail.com`, `+91 80 2332 3456`) vs `lib/ai/retrieval/settings.ts:20-21` (`+91 80 2847 1234`, `info@sriraghavendra.org`) vs `app/api/seed-ai-settings/route.ts:152-153` (`+91-80-28446400`, `info@raghavendramatha.org`) | Delete the file; settle on one authoritative contact record. |
| M08-F24 | LOW | Unreachable / duplicated switch branches in the intent category mapper: `VISITOR_GUIDELINES` and `DRESS_CODE` appear twice, so `IntentCategory.VISITOR` can only ever be produced by `PHOTOGRAPHY`/`PARKING`. | `lib/ai/intent/detector.ts:571-572` vs `:599-600` | Remove the earlier pair or the later one deliberately. |
| M08-F25 | LOW | The `Intent` enum, the pattern table and the generator switch are three lists that do not line up: 42 enum members, 37 `INTENT_PATTERNS` rows, 33 `case Intent.*` labels. Five members have no pattern - `BOOKING`, `BRINDAVANA`, `MANTRALAYA`, `OUT_OF_SCOPE`, `UNKNOWN` (the last two are sentinels: `OUT_OF_SCOPE` is returned directly at `detector.ts:218-225` and `UNKNOWN` only ever reaches `handleKnowledgeIntent` from the generator's `default` branch; `BRINDAVANA`/`MANTRALAYA` are still reachable through `INTENT_EXAMPLES` at `detector.ts:121,124`). Nine have no generator case and fall through the `default` branch to `handleKnowledgeIntent(UNKNOWN)` - `OFFICE_HOURS`, `SEVA_BOOKING`, `ANNADANA`, `PRASADA`, `BOOKING`, `COMMITTEE`, `CONTACT_REQUEST`, `GOODBYE`, `UNKNOWN` - so a devotee who asks to book a seva gets a knowledge-base lookup. Only `BOOKING` and `UNKNOWN` are in neither list. | `lib/ai/intent/types.ts:4-78` (42 members) vs `lib/ai/intent/patterns.ts` (37 `intent:` rows) vs `lib/ai/generator.ts:1086-1176` (33 `case` labels, `default:` at `:1166`) | Give `SEVA_BOOKING` / `ANNADANA` / `PRASADA` / `OFFICE_HOURS` real handlers; delete `BOOKING`. |
| M08-F26 | LOW | Unused import and unused parameters: `getBestSemanticMatch` is imported and never used; `handleKnowledgeIntent` ignores its `intent` beyond echoing it; `createSession`/`clearSession`/`getSession` are imported by the chat route and never called; `startTime` is assigned and unused in two multi-source getters. | `lib/ai/intent/detector.ts:28`; `app/api/chat/route.ts:16-23`; `services/multi-source-retrieval.service.ts:27,58` | Clean up; these will fail a stricter lint config. |
| M08-F27 | LOW | Doc drift beyond F04: `docs/AI_ENHANCEMENTS.md:53` (row 12) marks "Semantic Embeddings - use OpenAI/sentence-transformers" as ✅ Done, but the implementation is Jaccard set overlap plus a weighted keyword table. `docs/AI-GUIDELINES.md:38` maps "Donations → `donations` collection", but donation answers are derived from `settings`, never from a `donations` collection. `docs/AI_ARCHITECTURE_AUDIT.md` describes "Response Source: AI Provider or Firebase Fallback", which is neither. | `services/ml.service.ts:126-160`, `lib/ai/intent/detector.ts:387-424`; `lib/ai/retrieval/donations.ts:31-78` | Rewrite the four AI docs from the code; they currently mislead every new contributor. |
| M08-F28 | LOW | The knowledge query's composite index **is** declared (`approved` + `category` + `title`, `firestore.indexes.json:168-176`), so the original worry is unfounded. What remains is the swallowing: the `try/catch` at `lib/ai/knowledge/repository.ts:91-121` turns *any* failure - missing index in an unmigrated project, rules denial, offline - into a silent fall-back to the in-code `SEED_ARTICLES`, so a broken knowledge base is indistinguishable from a working one. | index present at `firestore.indexes.json:168-176`; silent fallback at `lib/ai/knowledge/repository.ts:92-121` | Log and surface the failure instead of silently serving seed data; keep the index deployment in CI. |
| M08-F29 | LOW | No timeouts, retries or circuit breaking on any outbound call; the four provider `fetch` calls and every Firestore read can hang the request until the platform kills it. The chat route converts anything containing the word "timeout" into a 504 after the fact. | `lib/ai/provider.ts:96,132,191,228`; `app/api/chat/route.ts:359-365` | Wrap in `AbortController` with a budget; return the safe message on abort. |
| M08-F30 | HIGH | `Intent.DRESS_CODE` and `Intent.VISITOR_GUIDELINES` share the `case` label of `Intent.TEMPLE_TIMINGS` and are answered by `handleTempleTimings(language)`, which takes only a language and returns opening hours. A devotee who asks "what should I wear to the temple?" or "what are the visitor rules?" is told when the temple opens. Both intents have their own `INTENT_PATTERNS` rows (`patterns.ts:409,425`) and their own `INTENT_EXAMPLES` paraphrases (`detector.ts:127,130`), so they are produced regularly. | `lib/ai/generator.ts:1087-1090` (`case Intent.DRESS_CODE:` / `case Intent.VISITOR_GUIDELINES:` -> `return handleTempleTimings(language)`); handler signature takes only `language` at `lib/ai/generator.ts:95-97` | Split into `handleDressCode` / `handleVisitorGuidelines`, or route both to `handleKnowledgeIntent` so the `dress-code` and `visitor-guidelines` seed articles are used. |
| M08-F31 | LOW | There are two undocumented confidence thresholds in series and neither comes from settings. `IntentDetector` rewrites any result below `minConfidence` (default `20`, `detector.ts:196`) to `Intent.FAQ` before returning (`detector.ts:241-248`), and only then does the generator apply its own `LOW_CONFIDENCE_THRESHOLD = 60` (`generator.ts:49,1066`). The consequence is that for the weakest questions the unknown-question log records `detectedIntent: "FAQ"` rather than the detector's actual best guess, which is exactly the field an admin triaging unknown questions needs. | `lib/ai/intent/detector.ts:196,241-248`; `lib/ai/generator.ts:49,1066,1074-1080` | Carry the pre-rewrite intent on the result (`fallbackIntent` already exists) and log that; source both thresholds from `getConfidenceThreshold()`. |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `lib/ai/generator.ts`, `lib/ai/intent/**`, `services/ml.service.ts` | none - pure TypeScript, no DOM, no Next APIs | **reuse as-is** | This is the valuable, portable core: 2,600 lines of classification and formatting that would run unchanged in a shared package. |
| `lib/ai/retrieval/{settings,events,sevas,announcements,aaradhane}.ts` | `firebase/firestore` web SDK (works in RN with `@react-native-firebase` or the JS SDK) | **adapt** | Logic is portable; the SDK import and the module-level cache need swapping for a platform-agnostic data client. |
| `lib/ai/retrieval/panchanga.ts` | Node `fs`/`path` reading `public/data/panchanga/current.json` (`:7-8,42-45`) | **rewrite** | No filesystem in RN. Must become an HTTP fetch of the same JSON or a bundled asset. |
| `app/api/chat/route.ts` and all 20 `app/api/ai/*` routes | `next/server` (`NextRequest`, `NextResponse`), Route Handlers | **reuse as a server** | RN does not run these; it calls them over HTTP. The contract stays, the handler stays on the server. |
| `lib/ai/provider.ts` | `fetch` only (available in RN) but holds server secrets | **keep server-side** | API keys must never ship in an RN bundle; the route stays the only caller. |
| `lib/ai/actions/actionRegistry.ts` | `window.location`, `window.open`, `navigator.share`, `navigator.clipboard`, `navigator.serviceWorker` (`:82,116,133,155,176,203…`) | **rewrite** (or delete - it is dead) | Maps 1:1 onto RN `Linking`, `Share`, `Clipboard`, `expo-notifications`, and React Navigation routes. |
| `lib/ai/actions/useAIActions.ts` | `'use client'` directive | **adapt** | The directive is meaningless in RN; the hook body is portable once the registry is. |
| `lib/ai/settings.ts` | imported by a client component and reads Firestore from the browser | **adapt** | Move behind an endpoint so the welcome message and `enabled` flag come from the API, not a direct DB read. |
| `services/conversation.service.ts`, `services/chat.service.ts` | `firebase/firestore` web SDK called from the browser (`AIChatProvider.tsx` writes messages directly) | **adapt** | An RN client should not write Firestore directly; move the writes server-side behind `/api/chat`. |
| `services/knowledge.service.ts`, `lib/ai/knowledge/**` | web SDK + in-memory view counts | **adapt** | Already exposed through `/api/knowledge/*`; RN can consume those. |
| Session persistence | `localStorage.setItem("raya_session_id", …)` in `components/ai/AIChatProvider.tsx:183` (M09) | **rewrite** | RN needs `AsyncStorage` / `expo-secure-store`. |
| Markdown answers | every handler emits Markdown with `**bold**`, bullets and emoji | **adapt** | The web renders it with a Markdown component; RN needs `react-native-markdown-display` or the engine must emit structured blocks. |
| `types/ai.ts`, `types/knowledge.ts`, `lib/ai/intent/types.ts` | none | **reuse as-is** | These are the shared contract for both clients. |

What a React Native client needs from this module:

1. `POST /api/chat` unchanged, with body `{messages: AIMessage[], sessionId?: string, userId?: string,
   detectedLanguage?: "en"|"kn"|"mixed"}` and response `{message: AIMessage, sessionId: string}` plus the
   optional `_debug` / `_ux` envelopes behind `?debug=true` / `?ux=true` (`types/ai.ts:34-47`,
   `app/api/chat/route.ts:304-337`). Fix M08-F05 first or the mobile client will lose its session exactly as
   the web one does.
2. The shared types package: `AIMessage`, `ChatRequest`, `ChatResponse`, `Intent`, `DetectedLanguage`,
   `KnowledgeArticle`. These already have no platform dependency.
3. A read API for the welcome message, suggested questions and `enabled` flag, so the mobile app does not
   import `lib/ai/settings.ts` and talk to Firestore itself.
4. Answers should stop being pre-rendered Markdown strings and start being `{blocks, actions,
   suggestedFollowUps}` - the action registry already proves the intent, and RN cannot render the current
   strings without a Markdown library.
5. Nothing else needs to move: intent detection, retrieval and formatting are server-side, and keeping them
   there is what makes one engine serve both clients.

## Coverage

filesExpected 90, filesMentioned 90, omitted: none. (Re-checked by script on 2026-09-19: 0 of the 90
inventory paths are absent from this file.)
All 90 inventory files appear in **Key files**; the 15 `seed/ai/*.json` files share one row that names each
file individually. Files read only to confirm a boundary (not owned by M08, not counted):
`services/analytics.service.ts`, `services/quote.service.ts`, `components/ai/AIChatProvider.tsx`,
`.env.example`, and the five docs listed in the chunk entry.

## UNCLEAR

- Whether the LLM fallback was disabled permanently or during an incident. The comment at
  `app/api/chat/route.ts:233-234` says "keeping commented for reference during transition period" with no
  date or ticket. Settled by: the git history of that file (this working copy is not a git repository) or a
  decision record.
- ~~Whether the Firestore composite index for `lib/ai/knowledge/repository.ts:92-97` is deployed.~~
  **Settled 2026-09-19:** it is declared at `firestore.indexes.json:168-176` (`approved` + `category` + `title`).
  Whether that file has actually been deployed to the project is still only answerable from the Firebase console.
- Whether Supabase `ai_latency_records` / `ai_intent_distribution` tables exist. The writers target Supabase
  while the readers target Firestore collections of the same name; both paths are currently dead, so neither
  can be confirmed from code. `scripts/migrate-ai-to-supabase.ts:247,265` also targets both names, which is
  evidence they were intended to exist. Settled by: the Supabase schema in chunk M11.
- Whether `AI_HYBRID_MODE` is ever set. It gates the only live path (`app/api/chat/route.ts:34`) and is not
  in `.env.example`. Settled by: the Vercel project environment variables.
- Whether the orphan `articles` collection holds production data written by an earlier run of
  `scripts/seed-ai-knowledge.ts`. Settled by: a read-only Firestore listing (not permitted in this run).
- ~~Whether `getUnknownQuestions` in the admin UI is expected to show chat-logged questions at all.~~
  **Settled 2026-09-19:** `scripts/migrate-ai-to-supabase.ts:220` copies Firestore `unknown_questions` into
  Supabase `unknown_questions`, so the admin triage screen is a hand-refreshed snapshot of what the chat
  writes. What remains unclear is whether anyone runs it on a schedule - there is no cron, no Vercel job and
  no `npm` script wired to it that this run could find. Settled by: the deployment configuration.

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
