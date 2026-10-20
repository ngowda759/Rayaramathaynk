# M09 - Raya AI: chat UI, admin AI console, knowledge workflow and AI UAT
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs; refreshed 2026-10-18 against HEAD 424fdb8 (see Refresh log). Verify against the code before acting on any claim.

## Answers questions about

- How the public Raya AI chat widget mounts, sends a message and renders the reply.
- Where the chat session id lives and how conversation history is stored and reloaded.
- Why the chat shows "Raya is typing" but never streams tokens.
- How markdown is rendered in chat bubbles, and why there are two different markdown renderers.
- Which admin pages exist under `/admin/ai`, what each one does and which API or collection it reads.
- Where the admin AI menu is defined and which AI pages are reachable from it.
- How the knowledge base is edited by an admin end to end (`/admin/knowledge` → `/api/admin/knowledge` → Firestore `knowledge`).
- What the draft → review → committee approval → publish knowledge workflow does, and why none of it is reachable from the UI.
- Which Firestore collection each workflow step writes, and why those writes are denied by `firestore.rules`.
- How prompt versions are created, published and rolled back - and why no stored prompt reaches the live chat at all (the only `getSystemPrompt()` call is inside a disabled comment block, and since 2026-10-14 its module `lib/ai/settings.ts` no longer exists).
- How the chat widget behaves on a phone, and where the quick-question rail collides with the panel.
- Why the same `knowledge` collection is served by three unrelated route families.
- Which admin AI pages are reachable from the sidebar, which from the hub cards, and which only by URL.
- How unknown questions are triaged and promoted into knowledge articles.
- What "chat training" data is, where it is stored and who reads it.
- What the AI UAT suite actually asserts versus what `AI_UAT.md` claims, and how it runs in CI.
- Why `/api/admin/prompts/*`, `/api/admin/analytics` and `/api/admin/content` have no callers.
- Which auth checks are missing on the knowledge and workflow API routes.
- What breaks if this module is ported to React Native, and what a native client would need instead.
- Why knowledge added in `/admin/knowledge` or promoted from an unknown question no longer reaches Raya or the Knowledge Centre (Firestore `knowledge` vs Supabase `ai_knowledge`, M09-F47).
- Which admin AI analytics panels stopped moving after the 2026-10-13 analytics migration and which still move (M09-F48).
- How the admin AI pages authenticate to the `/api/ai/*` APIs (`useAdminFetch` bearer token), and how the Settings and Health pages tell an auth failure from a datastore failure.
- Where the chat welcome message comes from (`/api/ai/public-settings`).
- Whether the mobile app reuses the chat widget (it does not - `apps/mobile/app/(tabs)/ai.tsx` is a separate minimal client of `/api/chat`).

## Purpose and business role

M09 is the *face and the back office* of Raya AI. It contains two very different halves that share a name.

The public half is a floating chat widget on every page of the site (`app/layout.tsx:119`). A devotee clicks it, asks a question in English, Kannada or a mix, and gets an answer from `/api/chat` (the engine itself is M08). The widget keeps a session id in `localStorage`, persists messages (Supabase `chat_sessions` / `chat_messages` since 2026-10-06, Firestore before that; the chat API separately keeps its own Firestore `chat_sessions` context document per session - M09-F55) so a signed-in devotee can reload an old conversation, offers thumbs-up/down feedback and a small set of canned quick questions.

The admin half is a console under `/admin/ai` (eleven sub-pages) plus `/admin/knowledge` and `/admin/assistant`. It is where staff edit temple facts the AI quotes, manage intent keywords, edit and publish system-prompt versions, triage questions the AI could not answer, approve devotee testimonials and volunteer requests, and watch analytics and health.

A third, largely aspirational half also lives here: a full editorial workflow for knowledge articles (draft → review → committee vote → publish → archive) with versioning, review comments and an audit log - about 2,000 lines of service, types, routes and UI. **It is completely unreachable**: its only UI component is never imported, and its Firestore collections have no security rules. Treat it as a designed-but-unwired subsystem, not as working behaviour.

Finally the module owns the AI UAT suite: 275 scripted devotee questions, a Jest runner, a Playwright runner, a report generator and a GitHub Actions workflow.

## Code roots

From `chunks.json`:

```
components/ai/                       public chat widget + 3 unused admin dashboards
app/admin/ai/                        11 admin AI pages + hub page
app/admin/assistant/                 rules-based admin recommendations page (not AI)
app/admin/knowledge/                 knowledge article CRUD screen
app/api/knowledge/                   public knowledge read API + workflow API
app/api/admin/knowledge/             admin knowledge CRUD API (REST Admin SDK)
app/api/admin/prompts/               orphaned prompt admin API
app/api/admin/analytics/             orphaned analytics/feedback API
app/api/admin/content/               orphaned content auto-tag/freshness API
services/knowledge-workflow.service.ts
types/knowledge-workflow.ts
lib/knowledge/                       dead static knowledge array
tests/ai-uat/                        UAT suite
AI_UAT.md
.github/workflows/ai-uat.yml
```

No files adopted from the Unassigned list. `components/admin/AdminSidebar.tsx` (unassigned) is referenced below only to prove it is *not* the live sidebar.

## Entry points

| Route or entry | File | server/client | auth required | What it renders or does |
|---|---|---|---|---|
| (global widget) | `components/ai/ChatWidget.tsx` | client | no | Floating button + quick-question rail + lazily-loaded chat window; mounted in `app/layout.tsx:119` |
| (global provider) | `components/ai/AIChatProvider.tsx` | client | no | React context: messages, session id, send/regenerate/feedback; fetches the welcome text from `/api/ai/public-settings` on mount (`:78`) |
| `/admin/ai` | `app/admin/ai/page.tsx` | client | admin (client guard) | AI hub: 4 stat cards, knowledge-coverage banner, 7 menu cards |
| `/admin/ai/analytics` | `app/admin/ai/analytics/page.tsx` | client | admin (client guard) | Conversations, intent pie, 7-day line chart, latency, unknown-question table - reads Firestore directly; two of its four collections (intent distribution, latency) stopped being written on 2026-10-13 (M09-F48) |
| `/admin/ai/health` | `app/admin/ai/health/page.tsx` | client | admin (client guard) | Probes `/api/ai/health` (shown as "Supabase Connection") and 8 `/api/ai/settings/*` endpoints with a bearer token, classifies each result with `lib/ai/health-classify.ts` (auth vs server vs network), plus a 5-section data-integrity check |
| `/admin/ai/intents` | `app/admin/ai/intents/page.tsx` | client | admin (client guard) | Intent list, enable/disable, edit keywords and examples via `/api/ai/settings/intents` |
| `/admin/ai/knowledge` | `app/admin/ai/knowledge/page.tsx` | client | admin (client guard) | Knowledge *coverage* by category; "Import default knowledge" via `/api/ai/knowledge/import` |
| `/admin/ai/playground` | `app/admin/ai/playground/page.tsx` | client | admin (client guard) | Fires a question at `/api/chat` (through `adminFetch`) and shows intent/confidence/latency (see M09-F02: broken) |
| `/admin/ai/prompts` | `app/admin/ai/prompts/page.tsx` | client | admin (client guard) | Prompt version list, create/edit/publish/archive/rollback via `/api/ai/settings/prompts` |
| `/admin/ai/settings` | `app/admin/ai/settings/page.tsx` | client | admin (client guard) | 5-tab form (temple, visitor, policies, responses, behavior) over `/api/ai/settings/*`; per-endpoint load diagnostics with Retry; "Initialize Data" posts `/api/seed-ai-settings` |
| `/admin/ai/testimonials` | `app/admin/ai/testimonials/page.tsx` | client | admin (client guard) | Approve/delete devotee testimonials via `services/chat.service.ts` |
| `/admin/ai/training` | `app/admin/ai/training/page.tsx` | client | admin (client guard) | CRUD over Firestore `chatTraining` keyword→response pairs |
| `/admin/ai/unknown-questions` | `app/admin/ai/unknown-questions/page.tsx` | client | admin (client guard) | Triage list; "Add to knowledge" posts to `/api/admin/knowledge` (Firestore `knowledge`, which the AI no longer reads - M09-F47) |
| `/admin/ai/volunteers` | `app/admin/ai/volunteers/page.tsx` | client | admin (client guard) | Volunteer request list, status transitions |
| `/admin/assistant` | `app/admin/assistant/page.tsx` | client | admin (client guard) | Rule-based "what should I do next" panel over 6 services; no AI |
| `/admin/knowledge` | `app/admin/knowledge/page.tsx` | client | admin (client guard) | Knowledge article CRUD over `/api/admin/knowledge` with plain `fetch` (no token); edits land in Firestore `knowledge`, not in the Supabase table the AI reads (M09-F47) |
| `GET /api/knowledge` | `app/api/knowledge/route.ts` | server | **none** | Knowledge Centre homepage payload, cached 300s; reads Supabase `ai_knowledge` through `services/knowledge.service.ts` → `lib/ai/knowledge/repository.ts` |
| `GET /api/knowledge/categories` | `app/api/knowledge/categories/route.ts` | server | **none** | Category list, cached 3600s |
| `GET /api/knowledge/search?q=` | `app/api/knowledge/search/route.ts` | server | **none** | Article search, no-store |
| `GET /api/knowledge/article/[slug]` | `app/api/knowledge/article/[slug]/route.ts` | server | **none** | Article page data or 404 |
| `GET/POST /api/knowledge/workflow/articles` | `app/api/knowledge/workflow/articles/route.ts` | server | **none** | List / create workflow articles |
| `GET/PATCH /api/knowledge/workflow/articles/[id]` | `app/api/knowledge/workflow/articles/[id]/route.ts` | server | **none** | Read one (optionally with history/versions/comments/approvals); PATCH performs a workflow action or an update |
| `GET/POST /api/knowledge/workflow/drafts` | `app/api/knowledge/workflow/drafts/route.ts` | server | **none** | User drafts; DELETE by `draftId` |
| `GET/POST /api/knowledge/workflow/versions/[id]` | `app/api/knowledge/workflow/versions/[id]/route.ts` | server | **none** | Fetch a version; POST restores an article to it |
| `POST/PATCH /api/knowledge/workflow/comments` | `app/api/knowledge/workflow/comments/route.ts` | server | **none** | Add / resolve a review comment |
| `POST /api/knowledge/workflow/approvals` | `app/api/knowledge/workflow/approvals/route.ts` | server | **none** | Submit a committee vote |
| `GET /api/knowledge/workflow/audit` | `app/api/knowledge/workflow/audit/route.ts` | server | **none** | Audit entries for one entity |
| `GET /api/knowledge/workflow/statistics` | `app/api/knowledge/workflow/statistics/route.ts` | server | **none** | Workflow counters |
| `GET/POST /api/admin/knowledge` | `app/api/admin/knowledge/route.ts` | server | **none** | List Firestore + seed articles; create (auto-approved) via REST Admin SDK |
| `GET/PUT/DELETE /api/admin/knowledge/[id]` | `app/api/admin/knowledge/[id]/route.ts` | server | **none** | GET reads Supabase `ai_knowledge` through `getArticleById` (`:22`); PUT / DELETE write Firestore `knowledge` via REST Admin SDK (`:59`, `:98`) - see M09-F54 |
| `GET/POST/PUT /api/admin/prompts` | `app/api/admin/prompts/route.ts` | server | GET weak (`verifyAdmin`, prod+key only); POST/PUT Firebase ID token via `verifyAdminUser` (since 2026-09-20) | Prompt versions; create; update/publish/rollback. **No callers** |
| `GET/DELETE /api/admin/prompts/[id]` | `app/api/admin/prompts/[id]/route.ts` | server | GET **none**; DELETE `verifyAdminUser` | Read / archive a prompt version. **No callers** |
| `POST /api/admin/prompts/[id]/publish` | `app/api/admin/prompts/[id]/publish/route.ts` | server | `verifyAdminUser` (since 2026-09-20) | Publish a prompt version. **No callers** |
| `GET/POST /api/admin/analytics` | `app/api/admin/analytics/route.ts` | server | **none** | Analytics summary; log intent-correction feedback. **No callers** |
| `GET/POST /api/admin/content` | `app/api/admin/content/route.ts` | server | **none** | Auto-tag / freshness helpers; two GET actions are stubs. **No callers** |
| CI | `.github/workflows/ai-uat.yml` | - | - | Jest UAT job (blocking) + Playwright job (`continue-on-error: true`) |

"admin (client guard)" means `app/admin/layout.tsx:24` wraps everything in `AdminAuthGuard` - a **client-side** gate that renders the page only once auth has loaded and the user may access admin. Since 2026-10-14 (0202801, d172ac1) eight of the pages - hub, health, intents, ai/knowledge, playground, prompts, settings, unknown-questions - call the server through `useAdminFetch()` (`hooks/useAdminFetch.ts:43`, M01), which attaches `Authorization: Bearer <Firebase ID token>` and a 15 s timeout; the M08 routes they call (`/api/ai/settings/*`, `/api/ai/health`, `/api/seed-ai-settings`) verify that token with `requireAdminUser` / `verifyAdminUser` (`lib/auth/admin-auth.ts:186`, M04). The exceptions are `/api/ai/knowledge/coverage` and `/api/ai/knowledge/import` (M08), called by the hub and `/admin/ai/knowledge`: neither file contains `requireAdminUser` or `verifyAdminUser`, so they ignore the token. Analytics and training still talk to Firestore from the browser, testimonials and volunteers go through `services/chat.service.ts`, and `/admin/knowledge` uses plain `fetch`. Inside this module's own route files only the writes of `/api/admin/prompts*` verify a token; `/api/admin/knowledge*`, `/api/knowledge/workflow/**`, `/api/admin/analytics` and `/api/admin/content` verify nothing.

**How each admin page is reached.** Two disjoint menus, no overlap:

- Live sidebar, "AI Management" section (`components/admin/layout/AdminSidebar.tsx:91-103`, 8 links): `/admin/ai`, `/admin/ai/settings`, `/admin/ai/prompts`, `/admin/knowledge`, `/admin/ai/intents`, `/admin/ai/unknown-questions`, `/admin/ai/analytics`, `/admin/ai/health`.
- Hub cards on `/admin/ai` (`app/admin/ai/page.tsx:137-194`, 7 cards): `/admin/ai/playground`, `/admin/ai/training`, `/admin/ai/testimonials`, `/admin/ai/volunteers`, `/admin/ai/knowledge`, `/admin/ai/analytics`, `/admin/ai/settings`.
- **URL only:** `/admin/assistant` - see M09-F44.

## Component trees

### Public chat widget (mounted on every page)

```
RootLayout (server) app/layout.tsx
└── AIChatProvider (client) components/ai/AIChatProvider.tsx           context: messages/isOpen/sessionId/...
    ├── {children}                                                      the whole site
    └── ChatWidget (client) components/ai/ChatWidget.tsx:20
        ├── FloatingButton (client) components/ai/FloatingButton.tsx    useAIChat().toggleChat
        ├── QuickQuestionIcons (client) components/ai/QuickQuestionIcons.tsx
        │     └── 4 hardcoded questions -> useAIChat().sendMessage
        └── ChatWindow (client, next/dynamic ssr:false) components/ai/ChatWindow.tsx:12
            ├── header: expand / history / clear buttons
            ├── session-history strip (only when userSessions.length > 0)
            ├── messages area
            │   ├── WelcomeScreen (client) ChatWindow.tsx:170 -> ReactMarkdown
            │   ├── MessageBubble (client) components/ai/MessageBubble.tsx  (per message)
            │   │   ├── MarkdownRenderer (client) components/ai/MarkdownRenderer.tsx  (regex -> dangerouslySetInnerHTML)
            │   │   ├── copy button -> navigator.clipboard
            │   │   ├── regenerate -> useAIChat().regenerateResponse
            │   │   └── feedback -> useAIChat().submitMessageFeedback
            │   └── TypingIndicator (client) components/ai/TypingIndicator.tsx
            ├── SuggestedQuestions (client) components/ai/SuggestedQuestions.tsx
            │     └── SUGGESTED_QUESTIONS from lib/ai/systemPrompt (M08)
            └── ChatInput (client) components/ai/ChatInput.tsx   auto-growing textarea, Enter = send
```

**Mobile behaviour of the widget.** There is no separate mobile layout - one Tailwind breakpoint set does all of it. The panel is `fixed z-50 left-6 bottom-20`, `w-[calc(100vw-3rem)] sm:w-[420px] lg:w-[480px]`, height `h-[600px] max-h-[70vh]` collapsed or `h-[75vh]` expanded (`components/ai/ChatWindow.tsx:48-51`); so on a phone it is a near-full-width sheet pinned above the `fixed bottom-6 left-6` floating button (`components/ai/FloatingButton.tsx:12-13`). The quick-question rail sits at `fixed left-6 bottom-[calc(20rem+4rem)]` and opens on hover only (`components/ai/QuickQuestionIcons.tsx:55-57`), which on touch means it is both unusable and overlapping - see M09-F33 and M09-F45. The input is a `<textarea>` that auto-grows off `scrollHeight` (`components/ai/ChatInput.tsx`), with no `enterKeyHint`/`inputMode` and no handling for the on-screen keyboard shrinking the viewport.

Hooks/services the provider touches: `useAuthContext` (`context/AuthContext.tsx`, M04); `saveMessage`, `getSessionMessages`, `getUserChatSessions`, `submitFeedback` (`services/chat.service.ts`, M08/M10); `GET /api/ai/public-settings` for the welcome text (`AIChatProvider.tsx:78` → `app/api/ai/public-settings/route.ts:7` → `aiSettingsService.getAIResponses()`, M08; it replaced `getWelcomeMessage` from the deleted `lib/ai/settings.ts`); `detectLanguage` (`lib/ai/languageDetector.ts`, M08). Store: Supabase `chat_sessions` / `chat_messages` through the browser Supabase client (`services/chat.service.ts:7-150`, migrated in 224875d on 2026-10-06), Firestore `feedback`, plus `localStorage["raya_session_id"]`.

### Admin AI pages - the shared shape

Every page under `app/admin/ai/**` and `app/admin/knowledge` is `"use client"` and follows one template; there is no shared CRUD framework here (unlike M05's admin CRUD).

```
AdminLayout (server) app/admin/layout.tsx
└── AdminAuthGuard (client) components/admin/layout/AdminAuthGuard.tsx
    └── AdminShell (client) components/admin/layout/AdminShell.tsx
        └── AdminSidebar (client) components/admin/layout/AdminSidebar.tsx:91-103   "AI Management" section
            └── <Page> (client) app/admin/ai/<x>/page.tsx
                ├── AdminPageHeader (client) components/admin/common/AdminPageHeader.tsx
                ├── local useState for list + form + message banner
                ├── useEffect -> useCallback loader -> adminFetch("/api/...") (8 pages), plain fetch, a service, or Firestore
                └── inline cards / tables / modals (no shared table component)
```

Pages that deviate:

- `app/admin/ai/analytics/page.tsx` - no `AdminPageHeader`; defines its own `StatCard` (`:37`), `PieChart` (`:66`), `LineChart` (`:136`), `HealthIndicator` (`:214`) as inline SVG/CSS, and calls Firestore directly (`:303-333`, now through `Promise.allSettled` so one failing collection no longer blanks the page) - two of the four (`ai_intent_distribution`, `ai_latency_records`) are no longer written; `chat_sessions` and `unknown_questions` still are, by the server chat path (M09-F48).
- `app/admin/ai/training/page.tsx` - calls Firestore directly (`:125`, `:149`, `:221`, `:232`, `:256`, `:267`).
- `app/admin/ai/testimonials/page.tsx` and `.../volunteers/page.tsx` - go through `services/chat.service.ts` (the only two pages here that respect the repository pattern).
- `app/admin/assistant/page.tsx` - renders `components/admin/common/AdminAssistant.tsx` with 14 numeric props.
- `app/admin/ai/health/page.tsx` and `app/admin/ai/settings/page.tsx` - guard against overlapping runs with `mountedRef` / `runIdRef` (health) or an `AbortController` (settings), and render per-endpoint failure diagnostics instead of an endless spinner (8d54714, 2026-10-15).
- Seven module files now open with a file-wide `/* eslint-disable */` (6408c1d) - see M09-F53.

### Knowledge workflow UI (dead)

```
KnowledgeWorkflowDashboard (client) components/ai/KnowledgeWorkflowDashboard.tsx:385   default export, NEVER IMPORTED
├── StatusBadge (:42)
├── statistics row      <- GET /api/knowledge/workflow/statistics
├── article list        <- GET /api/knowledge/workflow/articles
├── detail pane         <- GET /api/knowledge/workflow/articles/[id]?includeHistory&includeVersions&includeComments&includeApprovals
└── action buttons      -> PATCH /api/knowledge/workflow/articles/[id] { action }
```

Two more orphan dashboards sit beside it, also never imported: `components/ai/AIAnalyticsDashboard.tsx:90` (calls `/api/ai/analytics`) and `components/ai/MultiSourceRetrievalDashboard.tsx:49` (calls `/api/ai/multi-source/*`). None of the three is re-exported from `components/ai/index.ts`, and `components/ai/index.ts` itself is imported nowhere.

## Data flow

### 1. Devotee sends a chat message

0. On mount the provider fetches `/api/ai/public-settings` for the welcome text and falls back to a hardcoded string (`components/ai/AIChatProvider.tsx:73-92`).
1. `ChatInput.handleSubmit` (`components/ai/ChatInput.tsx:24`) → `onSend(trimmed)`.
2. `ChatWindow` passes `sendMessage` from `useAIChat()` (`components/ai/ChatWindow.tsx:164`).
3. `AIChatProvider.sendMessage` (`components/ai/AIChatProvider.tsx:140`) calls `detectLanguage(content)` (`lib/ai/languageDetector.ts`), appends a local user message, sets `isLoading`.
4. `fetch("/api/chat", …)` with `{ messages, sessionId, userId, detectedLanguage }` (`AIChatProvider.tsx:165`). **Single request/response - no streaming, no polling.** The "typing" dots are purely `isLoading`.
5. `app/api/chat/route.ts` (M08) answers `{ message: AIMessage, sessionId, _debug?, _ux? }` (`app/api/chat/route.ts:303-339`). On the way it also reads and writes a **Firestore** `chat_sessions/{sessionId}` document for conversation context (`getSessionContext` at `:143`, `updateSession` at `:183` → `services/conversation.service.ts:161`, `setDoc` + `arrayUnion` of both messages) - a second session store beside the widget's Supabase one (M09-F55).
6. Provider appends `data.message`, stores `data.sessionId` in state and `localStorage["raya_session_id"]` (`:189-193`).
7. `saveToFirebase` (name kept, backend changed) → `saveMessage(sessionId, message)` (`services/chat.service.ts:103`) for both the user and assistant message; it inserts into Supabase `chat_messages` and bumps or creates the `chat_sessions` row (`:109-140`). Errors are swallowed on purpose (`AIChatProvider.tsx:114-117`).
8. On failure the provider maps the error text to one of six devotee-facing strings (`:205-220`) and appends it as an assistant message.

### 2. Admin edits a knowledge article

1. `/admin/knowledge` mounts, `loadArticles` → `GET /api/admin/knowledge` (`app/admin/knowledge/page.tsx:97`).
2. Route reads Firestore `knowledge` via `getDocuments` (`app/api/admin/knowledge/route.ts:22`, `lib/firebase-admin-rest.ts`) and concatenates `SEED_ARTICLES` from `lib/ai/knowledge/seed` tagged `isSeed: true` (`:46-66`).
3. Admin edits inline → `saveArticle` → `PUT /api/admin/knowledge/[id]` (`app/admin/knowledge/page.tsx:167`).
4. Route calls `updateDocument("knowledge", id, {... approved: true })` through the **REST Admin SDK, bypassing security rules** (`app/api/admin/knowledge/[id]/route.ts:59`), then `clearKnowledgeCache()` (`:70`).
5. **Since 2026-10-06 (fdaff98) the change reaches nobody.** The retrieval engine and the public Knowledge Centre both read the Supabase table `ai_knowledge` (`lib/ai/knowledge/repository.ts:16`), so the Firestore write is invisible to Raya; `clearKnowledgeCache()` only empties the cache of that Supabase read. See M09-F47. (There was never any revalidation of the public Knowledge Centre pages either.)

### 3. Unknown question → knowledge article

1. `/admin/ai/unknown-questions` loads `GET /api/ai/settings/unknown-questions` (M08) (`app/admin/ai/unknown-questions/page.tsx:129`).
2. Admin clicks "Add to knowledge", fills title/content/keywords/category.
3. `handleAddToKnowledge` → `POST /api/admin/knowledge` with `slug: "uq-<timestamp>"` (`:223-234`).
4. On success it marks the question: `PUT /api/ai/settings/unknown-questions { action:"update", status:"added_to_knowledge" }` (`:240-248`).
5. `loadQuestions()` refreshes. The article lands in Firestore `knowledge`, already `approved: true` - it never passes through the workflow subsystem, and since the Supabase migration it never reaches the AI either, although the toast says "AI can now answer this question" (`:252`) - M09-F47.

### 4. Prompt version published (and why it has no effect)

1. `/admin/ai/prompts` lists versions from `GET /api/ai/settings/prompts` (M08) (`app/admin/ai/prompts/page.tsx:71`).
2. Publish → `PUT /api/ai/settings/prompts?id=<id>` with `{ status: "published" }` (`:177-184`).
3. M08's admin repository sets `prompt.currentPromptId = versionId` on the `ai_settings` row `id = "main"` - a **Supabase** table since the 2026-10 migration, no longer a Firestore document (`lib/ai/ai-settings/admin-repository.ts:30-31`, `:225`; the client-SDK twin is `lib/ai/ai-settings/repository.ts:292`).
4. `aiSettingsService.getCurrentPrompt()` resolves that id (`lib/ai/ai-settings/service.ts:402`).
5. **But the chat request path never reads any stored prompt at all.** The live path calls `generateResponse(...)` (the hybrid retrieval engine, M08) at `app/api/chat/route.ts:162`; when that fails it returns a hardcoded apology (`:222-228`). The one `getSystemPrompt()` call sits at `app/api/chat/route.ts:250`, **inside a disabled block comment** that opens at `:232` and closes at `:286` ("OLD FALLBACK CODE - DISABLED FOR SAFETY"). And since 2891323 (2026-10-14) `getSystemPrompt()` is not even imported: its module `lib/ai/settings.ts` (removed 2026-10 - see Refresh log), which read `settings/ai`.`systemPrompt`, was deleted, so the commented block would no longer compile if uncommented and nothing reads `settings/ai` at all. `getCurrentPrompt()` has three callers - `app/api/admin/prompts/route.ts:33`, `app/api/admin/prompts/[id]/publish/route.ts:40` and `app/api/ai/settings/prompts/route.ts:17` - and none of them is on the chat path; the last only feeds the Prompt Manager's own display. See M09-F01.

### 5. Knowledge workflow (designed path, currently unreachable)

1. Create: `POST /api/knowledge/workflow/articles` → `createWorkflowArticle` (`services/knowledge-workflow.service.ts:634`) writes `knowledge_workflow` with `status:"draft"`, then `createVersion` (`:69`) writes `knowledge_versions` v1, then `createAuditEntry` writes `knowledge_audit_log`.
2. Edit: `PATCH .../articles/[id]` without `action` → `updateWorkflowArticle` (`:687`); if title or content changed it cuts a new version and bumps `currentVersion`.
3. Transition: `PATCH .../articles/[id]` with `{ action }` → `performWorkflowAction` (`:202`) writes a row in `knowledge_workflow_actions`, computes the next status from the transition table (`getNextStatus`, `:290`) and stamps `submittedAt` / `reviewedAt` / `publishedAt` / `archivedAt` on the article.
4. Committee: `approve_for_committee` also calls `createCommitteeApproval` (`:422`) → `knowledge_committee_approvals` with `requiredApprovals: 2`. Votes arrive at `POST /api/knowledge/workflow/approvals` → `submitCommitteeVote` (`:452`), which recounts and, on approval, flips the article to `approved` (`:510-522`).
5. Comments: `POST /api/knowledge/workflow/comments` → `addReviewComment` (`:341`) → `knowledge_review_comments`; `PATCH` resolves one (`:401`).
6. Drafts: `POST /api/knowledge/workflow/drafts` → `saveDraft` (`:1001`) → `knowledge_drafts`.
7. Audit: every step calls `createAuditEntry` (`:576`), which writes `knowledge_audit_log` - **always without `performedBy`**, because no call site passes it.
8. Publish writes `status:"published"` onto a `knowledge_workflow` document. **Nothing reads `knowledge_workflow`** - the AI and the public Knowledge Centre read the `knowledge` collection. A "published" workflow article never reaches a devotee.

### 6. AI UAT run

1. CI triggers on pushes touching `lib/ai/**`, `components/ai/**`, `tests/ai-uat/**`, `AI_UAT.md` (`.github/workflows/ai-uat.yml:6-17`).
2. Job `unit-tests` runs `npm run test:ai-uat:jest` → `jest tests/ai-uat/ai-uat.test.ts` (`package.json:26`).
3. That spec mocks `@/lib/firebase` (twice - `tests/ai-uat/ai-uat.test.ts:21-24` and `:73-76`), `@/lib/ai/ai-settings` (`:27-36`), `@/lib/ai/retrieval/registry` (`:38-42`, both added by f5582d2), `@/lib/ai/retrieval` (`:79`) and `@/lib/ai/knowledge` (`:184`), then loops all 275 cases from `tests/ai-uat/test-cases.ts` asserting only `expect(result.intent).toBeDefined()` and `confidence > 0`.
4. Job `playwright-tests` runs `playwright test tests/ai-uat/ai-uat.spec.ts` against `E2E_BASE_URL` (`.github/workflows/ai-uat.yml:26`) with `continue-on-error: true` (`:85`).
5. `npm run test:ai-uat` (the ts-node runner, `tests/ai-uat/run-uat-tests.ts`) is **not** wired into CI; it writes `reports/ai-uat/uat-report-<ts>.json` and exits non-zero on failures (`:255-277`).
6. `npm run report:ai-uat` → `tests/ai-uat/generate-report.ts:368` turns the newest JSON into `uat-report.md`, `uat-report.html` and `coverage-report.md`.

## Key files

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `components/ai/AIChatProvider.tsx` | 337 | Chat state machine + `/api/chat` client | `AIChatProvider`, `useAIChat` | `localStorage` session id; welcome text from `/api/ai/public-settings` (`:78`); swallows persistence errors (Supabase since 2026-10-06); `regenerateResponse` duplicates `sendMessage` |
| `components/ai/ChatWidget.tsx` | 47 | Mount gate | `ChatWidget` | `NEXT_PUBLIC_AI_CHAT_ENABLED === "false"` kill switch; `requestAnimationFrame` mount guard |
| `components/ai/ChatWindow.tsx` | 198 | Panel shell + message list | `ChatWindow` | `next/dynamic` `ssr:false`; contains inline `WelcomeScreen` using `react-markdown` |
| `components/ai/MessageBubble.tsx` | 140 | One message + copy/regenerate/feedback | `MessageBubble` | `navigator.clipboard`; feedback only on the last assistant message |
| `components/ai/MarkdownRenderer.tsx` | 58 | Regex markdown → HTML | `MarkdownRenderer` | `dangerouslySetInnerHTML`; escapes `<`/`>` first; second renderer in the same tree |
| `components/ai/ChatInput.tsx` | 93 | Auto-growing textarea | `ChatInput` | Enter sends, Shift+Enter newlines; `disabled` prop never passed |
| `components/ai/SuggestedQuestions.tsx` | 54 | Collapsible chips | `SuggestedQuestions` | Source is the static `SUGGESTED_QUESTIONS`, not the API's `_ux.suggestedQuestions` |
| `components/ai/QuickQuestionIcons.tsx` | 109 | Hover rail of 4 canned questions | `QuickQuestionIcons` | Hover-only; unreachable by keyboard/touch |
| `components/ai/FloatingButton.tsx` | 34 | Toggle button | `FloatingButton` | `fixed bottom-6 left-6` |
| `components/ai/TypingIndicator.tsx` | 15 | Three bouncing dots | `TypingIndicator` | `role="status"` |
| `components/ai/index.ts` | 12 | Barrel | 10 re-exports | Imported nowhere; omits the 3 dashboards |
| `components/ai/KnowledgeWorkflowDashboard.tsx` | 613 | Workflow UI | default export | **Dead** - never imported; file-wide `/* eslint-disable */` |
| `components/ai/AIAnalyticsDashboard.tsx` | 467 | AI analytics UI | default export | **Dead**; would call `/api/ai/analytics`; file-wide `/* eslint-disable */` |
| `components/ai/MultiSourceRetrievalDashboard.tsx` | 451 | Multi-source retrieval UI | default export | **Dead**; would call `/api/ai/multi-source/*` |
| `app/admin/ai/page.tsx` | 408 | AI hub | `AdminAIPage` | Direct `getDocs(collection(db,"chat_sessions"))` (`:96`) - the Firestore collection the server chat path still writes (M09-F48, F55); coverage/import via `adminFetch`; 7 menu cards |
| `app/admin/ai/analytics/page.tsx` | 783 | Analytics dashboard | `AnalyticsPage` | Hand-rolled Pie/Line charts; unbounded `chat_sessions` scan (`:333`); two of its four Firestore sources (`ai_intent_distribution`, `ai_latency_records`) were abandoned by the 2026-10-13 analytics migration (M09-F48) |
| `app/admin/ai/health/page.tsx` | 357 | Endpoint health | `AIHealthPage` | Probes `/api/ai/health` + 8 settings endpoints via `adminFetch`; results classified by `lib/ai/health-classify.ts` (M08); run-id guard against overlapping runs |
| `app/admin/ai/intents/page.tsx` | 667 | Intent manager | `IntentManagerPage` | Forces `language:"en"` on every keyword/example (`:150`,`:155`); leftover `console.log` (`:131`,`:161`) |
| `app/admin/ai/knowledge/page.tsx` | 346 | Coverage + import | `KnowledgeCoveragePage` | `/api/ai/knowledge/coverage`, `/api/ai/knowledge/import` via `adminFetch`; both still count/write Firestore `knowledge`, not the Supabase table the AI reads (M09-F47) |
| `app/admin/ai/playground/page.tsx` | 365 | Response tester | `AIPlaygroundPage` | Reads fields `/api/chat` does not return - see M09-F02 |
| `app/admin/ai/prompts/page.tsx` | 570 | Prompt versions | `PromptManagerPage` | Uses the global `prompt()` for the name (`:99`) |
| `app/admin/ai/settings/page.tsx` | 1192 | 5-tab settings form | `AISettingsPage` | Saves 5 endpoints in parallel with no rollback (`:306-343`); per-endpoint load diagnostics (`:151-257`); "Initialize Data" → `/api/seed-ai-settings` (`:279`); Reset button is a no-op (M09-F52) |
| `app/admin/ai/testimonials/page.tsx` | 291 | Testimonial moderation | `TestimonialsPage` | Uses `services/chat.service.ts` |
| `app/admin/ai/training/page.tsx` | 608 | `chatTraining` CRUD | `ChatTrainingPage` | `DEFAULT_RESPONSES` hardcodes temple timings (`:51-95`); nothing reads `chatTraining` any more (M09-F49) |
| `app/admin/ai/unknown-questions/page.tsx` | 761 | Triage + promote | `UnknownQuestionsPage` | The only caller of `POST /api/admin/knowledge` besides `/admin/knowledge` |
| `app/admin/ai/volunteers/page.tsx` | 320 | Volunteer requests | `VolunteersPage` | Uses `services/chat.service.ts` |
| `app/admin/assistant/page.tsx` | 186 | Heuristic recommendations | `AdminAssistantPage` | Six services in `Promise.all`; nine `any` annotations |
| `app/admin/knowledge/page.tsx` | 681 | Knowledge CRUD screen | `KnowledgeBasePage` | Seed articles are listed as editable; custom categories are not persisted (`:292`) |
| `app/api/knowledge/route.ts` | 27 | Knowledge Centre payload | `GET`, `dynamic` | `knowledgeService.getKnowledgeCentreData()` |
| `app/api/knowledge/categories/route.ts` | 27 | Categories | `GET`, `dynamic` | 1h s-maxage |
| `app/api/knowledge/search/route.ts` | 35 | Search | `GET`, `dynamic` | Accepts `q` or `query`; `limit` unvalidated |
| `app/api/knowledge/article/[slug]/route.ts` | 42 | Article by slug | `GET`, `dynamic` | 404 when missing |
| `app/api/knowledge/workflow/articles/route.ts` | 72 | List/create | `GET`, `POST` | 3 unused imports (`:8-10`); slug derived from title |
| `app/api/knowledge/workflow/articles/[id]/route.ts` | 99 | Read/patch | `GET`, `PATCH` | `const response: any` (`:37`) |
| `app/api/knowledge/workflow/drafts/route.ts` | 89 | Draft CRUD | `GET`, `POST`, `DELETE` | `userId` taken from the query string |
| `app/api/knowledge/workflow/versions/[id]/route.ts` | 55 | Version read/restore | `GET`, `POST` | POST does not validate `articleId`/`restoredBy` |
| `app/api/knowledge/workflow/comments/route.ts` | 58 | Comment add/resolve | `POST`, `PATCH` | `getArticleComments` imported, unused |
| `app/api/knowledge/workflow/approvals/route.ts` | 37 | Committee vote | `POST` | Validates decision enum only; `getArticleCommitteeApproval` imported, unused |
| `app/api/knowledge/workflow/audit/route.ts` | 32 | Audit read | `GET` | Requires `entityType` + `entityId` |
| `app/api/knowledge/workflow/statistics/route.ts` | 19 | Counters | `GET` | Thin wrapper |
| `app/api/admin/knowledge/route.ts` | 129 | Admin list/create | `GET`, `POST`, `dynamic` | REST Admin SDK; `(doc: any)` (`:25`); 2 unused imports |
| `app/api/admin/knowledge/[id]/route.ts` | 113 | Admin read/update/delete | `GET`, `PUT`, `DELETE`, `dynamic` | GET reads Supabase (`getArticleById`), PUT/DELETE write Firestore via REST Admin SDK; no auth (F54) |
| `app/api/admin/prompts/route.ts` | 160 | Prompt admin API | `GET`, `POST`, `PUT` | `verifyAdmin` returns `true` outside production (`:12-20`) and is all that guards GET; POST/PUT also call `verifyAdminUser` (`:63`, `:113`); no callers |
| `app/api/admin/prompts/[id]/route.ts` | 95 | Prompt read/archive | `GET`, `DELETE` | GET unauthenticated; DELETE calls `verifyAdminUser` (`:52`); `(v: any)`; no callers |
| `app/api/admin/prompts/[id]/publish/route.ts` | 56 | Publish a version | `POST` | `verifyAdminUser` (`:18`); no callers |
| `app/api/admin/analytics/route.ts` | 71 | Summary + intent feedback | `GET`, `POST` | Docstring says `/api/admin/analytics/feedback`, path is `/api/admin/analytics`; no callers |
| `app/api/admin/content/route.ts` | 180 | Auto-tag / freshness | `GET`, `POST` | GET `freshness` and `review` return canned placeholder text (`:46-71`); no callers |
| `services/knowledge-workflow.service.ts` | 1069 | Workflow engine | 22 functions (see Data flow 5) | Client Firestore SDK used from route handlers; `any` in 8 places; `data as any;` no-op (`:728`) |
| `types/knowledge-workflow.ts` | 224 | Workflow types | 15 types | `WorkflowRole` is exported and imported but never used |
| `lib/knowledge/index.ts` | 167 | Static Q&A array | `KNOWLEDGE_BASE`, `searchKnowledge`, `getKnowledgeByCategory`, `getCategories` | **Dead** - imported nowhere; a third knowledge source |
| `tests/ai-uat/test-cases.ts` | 3118 | 275 UAT cases | 24 exports incl. `ALL_UAT_TESTS`, `TEST_STATS` | Each case has `expectedIntent` + `validationCriteria` that the runners largely ignore |
| `tests/ai-uat/ai-uat.test.ts` | 654 | Jest suite | - | 275 weak assertions + ~25 real ones; out-of-scope asserts widened (M09-F50) |
| `tests/ai-uat/ai-uat.spec.ts` | 908 | Playwright suite | - | `describe.describe(...)` with `describe` undefined (`:161`+) |
| `tests/ai-uat/run-uat-tests.ts` | 285 | ts-node runner | `runAllTests`, `runTest`, types | Intent detection only; tautological language check (`:144`) |
| `tests/ai-uat/generate-report.ts` | 414 | MD/HTML/coverage reports | - | Reads newest `reports/ai-uat/*.json` |
| `tests/ai-uat/index.ts` | 12 | Barrel | re-exports `test-cases` + `Intent` | Imported nowhere |
| `AI_UAT.md` | 574 | UAT specification | - | Documents CLI flags the runner does not implement |
| `.github/workflows/ai-uat.yml` | 124 | CI | - | Hardcoded external `E2E_BASE_URL` fallback (`:26`) |

## Types and stores

### Types consumed

| Type / module | Where from | Used by |
|---|---|---|
| `AIMessage`, `SuggestedQuestion`, `Testimonial`, `VolunteerRequest`, `DetectedLanguage` | `types/ai.ts` (M08) | chat components, testimonials/volunteers pages |
| `IntentMetadata`, `IntentStatus`, `IntentKeyword`, `IntentExample`, `PromptVersion`, `PromptVersionStatus`, `UnknownQuestion`, `TempleInformation`, `VisitorInformation`, `TemplePolicies`, `AIResponses`, `AIBehaviorSettings` | `types/ai-settings.ts` (M08) | intents, prompts, unknown-questions, settings pages |
| `AIAnalyticsDashboard`, `TokenUsageSummary`, `LatencySummary`, `IntentDistributionSummary`, `UnknownQuestionSummary`, `AIHealthStatus` | `types/ai-analytics.ts` (M08) | dead `AIAnalyticsDashboard.tsx` |
| `MultiSourceResponse`, `QuickQuery`, `DataFreshness`, `RetrievalStats` | `types/multi-source-retrieval.ts` (M08) | dead `MultiSourceRetrievalDashboard.tsx` |
| `KnowledgeCategory`, `KnowledgeLanguage`, `KnowledgeArticleRequest`, `KnowledgeArticleUpdate`, `CATEGORY_DISPLAY_NAMES` | `lib/ai/knowledge/types.ts` (M08) | workflow service/routes, `/admin/knowledge` |
| `Intent`, `IntentCategory` | `lib/ai/intent/types.ts` (M08) | UAT suite, dead analytics dashboard |
| all 15 workflow types | `types/knowledge-workflow.ts` (owned) | workflow service, routes, dead dashboard |

### Stores touched

| Store | Kind | Read by | Written by |
|---|---|---|---|
| `chat_sessions` | Supabase table (Firestore until 224875d, 2026-10-06) | `services/chat.service.ts:47`, `:73` | `services/chat.service.ts:7`, `:25`, `:133` (M08) |
| `chat_sessions` (server context store) | Firestore | `services/conversation.service.ts:60` (chat route, M08), `app/admin/ai/page.tsx:96`, `app/admin/ai/analytics/page.tsx:333` (unbounded) | `/api/chat` on every turn via `services/conversation.service.ts:161` (M08) - still live; `firestore.rules:186-190` allows public read - M09-F55 |
| `chat_messages` | Supabase table (was Firestore `messages` until 2026-10-06) | `getSessionMessages` (`services/chat.service.ts:144`) via provider | `saveMessage` (`services/chat.service.ts:103`) via provider |
| `feedback` | Firestore | - | `submitFeedback` via `MessageBubble` |
| `testimonials` | Firestore | `/admin/ai/testimonials` (service) | same |
| `volunteer_requests` | Firestore | `/admin/ai/volunteers` (service) | same |
| `chatTraining` | Firestore | `app/admin/ai/training/page.tsx:125` only (`lib/ai/firebaseChat.ts`, deleted in 2891323, had a reader that nothing called even on 2026-09-19) | `/admin/ai/training` directly (`:149`,`:221`,`:232`,`:256`,`:267`) - **no rule in `firestore.rules`** |
| `knowledge` | Firestore | `/api/admin/knowledge` GET, `app/api/ai/knowledge/coverage/route.ts:81` - **no longer the engine's source** | `/api/admin/knowledge` via REST Admin SDK, `app/api/ai/knowledge/import/route.ts:116` |
| `ai_knowledge` | Supabase table (since fdaff98, 2026-10-06) | `lib/ai/knowledge/repository.ts:16` (M08) - retrieval engine and `/api/knowledge/*` | nothing in this module - M09-F47 |
| `ai_intent_distribution`, `ai_latency_records` (legacy) | Firestore | `app/admin/ai/analytics/page.tsx:305-317` | nothing since 2026-10-13 - the M08 writers are Supabase now (`services/ai-analytics.service.ts:135`, `:171`) - M09-F48 |
| `unknown_questions` | Firestore (a separate Supabase table of the same name also exists) | `app/admin/ai/analytics/page.tsx:321-325`, `:430` | still written by the chat path for confidence < 60 (`lib/ai/generator.ts:73` → `services/analytics.service.ts:31`); the Supabase table is filled for confidence < 50 by `lib/ai/unknown-logger.ts:30` (from `app/api/chat/route.ts:191`) - M09-F48 |
| `ai_settings` row `main` | Supabase table (`lib/ai/ai-settings/admin-repository.ts:30-31`; Firestore `ai_settings/main` before 2026-10) | prompt/intent/settings/health pages via M08 APIs; welcome text via `/api/ai/public-settings` | same |
| `settings/ai` | Firestore | nothing - its reader `lib/ai/settings.ts` was deleted (2891323) | nothing |
| `knowledge_workflow` | Firestore | workflow service only | workflow service only - **no rule** |
| `knowledge_versions` | Firestore | workflow service | workflow service - **no rule** |
| `knowledge_workflow_actions` | Firestore | workflow service | workflow service - **no rule** |
| `knowledge_review_comments` | Firestore | workflow service | workflow service - **no rule** |
| `knowledge_committee_approvals` | Firestore | workflow service | workflow service - **no rule** |
| `knowledge_audit_log` | Firestore | `getAuditLog` | `createAuditEntry` - **no rule** |
| `knowledge_drafts` | Firestore | `getUserDrafts` | `saveDraft` / `deleteDraft` - **no rule** |
| `localStorage["raya_session_id"]` | browser | `AIChatProvider.tsx:63` | same file, `:66`, `:127`, `:192`, `:244` |
| `reports/ai-uat/*.json|md|html` | filesystem | `generate-report.ts` | `run-uat-tests.ts`, `generate-report.ts` |

Collection names for the workflow live in one place: `services/knowledge-workflow.service.ts:46-54`.

## Cross-module dependencies

Imported **from** other chunks (via `import-graph.json`):

| Target | Chunk | Used for |
|---|---|---|
| `lib/ai/systemPrompt.ts`, `lib/ai/languageDetector.ts` (`lib/ai/settings.ts` removed 2026-10 - see Refresh log) | M08 | suggested questions, language detection |
| `app/api/ai/public-settings/route.ts`, `app/api/ai/health/route.ts`, `app/api/ai/settings/*`, `lib/ai/health-classify.ts` | M08 | chat welcome text; health probe and its classifier; every admin settings read/write |
| `lib/ai/ai-settings/index.ts` | M08 | prompt version CRUD in the orphaned `/api/admin/prompts` |
| `lib/ai/knowledge/repository.ts`, `lib/ai/knowledge/seed.ts`, `lib/ai/knowledge/types.ts` | M08 | admin knowledge API, categories |
| `lib/ai/intent/types.ts` | M08 | UAT suite, dead analytics dashboard |
| `services/chat.service.ts` | M08/M10 | sessions and messages (Supabase), feedback, testimonials, volunteer requests (Firestore) |
| `services/knowledge.service.ts` | M08/M10 | public knowledge API |
| `services/analytics.service.ts`, `services/content.service.ts` | M10/M15 | orphaned admin analytics/content APIs |
| `services/event|gallery|pooja|seva|sevaBooking|aaradhane.service.ts` | M06/M07/M10/M14 | `/admin/assistant` counters |
| `lib/firebase.ts`, `lib/firebase-admin-rest.ts`, `lib/utils.ts` | M01/M10 | Firestore client, REST Admin SDK, `cn()` |
| `context/AuthContext.tsx` | M01/M04 | `user.uid` on chat messages |
| `hooks/useAdminFetch.ts` | M01 | bearer-token fetch for 8 admin AI pages |
| `lib/auth/admin-auth.ts` | M04 | `verifyAdminUser` in the `/api/admin/prompts*` writes |
| `components/admin/common/AdminPageHeader.tsx`, `AdminAssistant.tsx`, `EmptyState.tsx` | M05 | admin page chrome |
| `types/ai.ts`, `types/ai-settings.ts`, `types/ai-analytics.ts`, `types/multi-source-retrieval.ts` | M08/M10 | see Types table |

Imported **by** other chunks: only `app/layout.tsx` (M01) imports `components/ai/AIChatProvider.tsx` and `components/ai/ChatWidget.tsx`. `apps/mobile` (M17) imports nothing from M09. Nothing else in the repository imports anything from M09 - the admin pages and API routes are leaves. `app/api/*` in this module is also claimed by M12 (HTTP surface) and `services/knowledge-workflow.service.ts` by M10; `.github/workflows/ai-uat.yml` is shared with M15.

## How to change it

### Add a field to a knowledge article (e.g. `summary`)

1. `lib/ai/knowledge/types.ts` (M08) - add to `KnowledgeArticle` / `KnowledgeArticleRequest`.
2. `app/api/admin/knowledge/route.ts:92` - destructure it in `POST`, add to the `addDocument` payload (`:102`).
3. `app/api/admin/knowledge/route.ts:25-42` - map it out of the Firestore wire format in `GET`.
4. `app/api/admin/knowledge/[id]/route.ts:56` + `:59` - accept and conditionally write it in `PUT`.
5. `app/admin/knowledge/page.tsx:79` (`editForm` initial state), `:137` (`startEditing`), `:167` (`saveArticle` body) and the form JSX.
6. If the AI should quote it, add a column to the Supabase `ai_knowledge` table (`supabase/migrations/20261013000000_create_ai_knowledge.sql`) and the retrieval formatting in `lib/ai/knowledge/repository.ts` (M08) - and fix M09-F47 first, because steps 2-5 write Firestore `knowledge`, which the engine no longer reads.
7. If the workflow subsystem is ever revived: `types/knowledge-workflow.ts` (`WorkflowArticle`, `ArticleVersion`) and `services/knowledge-workflow.service.ts` (`createWorkflowArticle:634`, `updateWorkflowArticle:687`, `createVersion:69`, `getWorkflowArticles:783-800`).

### Add a new admin AI page (e.g. `/admin/ai/glossary`)

1. Create a new `page.tsx` under `app/admin/ai/<slug>/` (this file does not exist yet) starting `"use client"`; copy the shape of `app/admin/ai/intents/page.tsx` (header, `useCallback` loader, `useEffect`, message banner), including `const adminFetch = useAdminFetch()` - every `/api/ai/*` admin route rejects a request without a bearer token.
2. Import `AdminPageHeader` from `@/components/admin/common/AdminPageHeader`.
3. Add the nav entry in `components/admin/layout/AdminSidebar.tsx` inside the `"AI Management"` section (`:91-103`). **Do not** edit `components/admin/AdminSidebar.tsx` - it is a dead duplicate with no AI section.
4. Optionally add a card to `menuItems` in `app/admin/ai/page.tsx:137-194`.
5. Add the backing route under `app/api/ai/...` (M08) or reuse a service; do not query Firestore from the page.

### Add a quick question to the chat widget

1. Rail (hover panel): `components/ai/QuickQuestionIcons.tsx:15-40` - add `{ id, icon, label, query }`.
2. Chips under the message list: `SUGGESTED_QUESTIONS` in `lib/ai/systemPrompt.ts` (M08); `components/ai/SuggestedQuestions.tsx:16` shows only the first 4 until expanded.
3. If the answer needs an intent, add it in M08 (`lib/ai/intent/patterns.ts`), then add a UAT case in `tests/ai-uat/test-cases.ts`.

### Change how the live system prompt is chosen

1. Decide the single source of truth, and note that **today there is none in the live path**: the only `getSystemPrompt()` call is commented out (`app/api/chat/route.ts:232-286`) and the live answer comes from `generateResponse(...)` at `:162`, while the Prompt Manager writes `prompt.currentPromptId` on the Supabase `ai_settings` row `main`; `settings/ai`.`systemPrompt` has had no reader or writer since `lib/ai/settings.ts` was deleted.
2. If the LLM path is to be re-enabled, rewrite `app/api/chat/route.ts:232-286` (uncommenting it no longer compiles: `getSystemPrompt` is not imported and `lib/ai/settings.ts` is gone) to call `aiSettingsService.getCurrentPrompt()` (`lib/ai/ai-settings/service.ts:402`) behind a short cache cleared on publish. If the hybrid engine is to stay prompt-free, delete the Prompt Manager rather than leaving admins a control that does nothing.
3. Add a cache-bust call in the publish path (`lib/ai/ai-settings/admin-repository.ts:225`, reached from `lib/ai/ai-settings/service.ts:438-443`) or drop the cache to 0 for prompts.
4. Re-check `app/admin/ai/health/page.tsx` which probes `/api/ai/settings/prompts`.

### Put an auth check on the knowledge APIs

1. Reuse the shared verifier that now exists: `requireAdminUser` / `verifyAdminUser` in `lib/auth/admin-auth.ts:186` (M04), already used by `/api/ai/settings/*` and the `/api/admin/prompts*` writes. Delete the placeholder `verifyAdmin` in `app/api/admin/prompts/route.ts:12` and guard the two prompt GETs too. Switch `app/admin/knowledge/page.tsx` (`:97`, `:167`, `:201`, `:222`, `:255`) from `fetch` to `useAdminFetch()` first, or that page breaks the moment its API checks a token.
2. Apply it at the top of `app/api/admin/knowledge/route.ts` (`GET`/`POST`), `app/api/admin/knowledge/[id]/route.ts` (`GET`/`PUT`/`DELETE`) and all **fourteen** `app/api/knowledge/workflow/**` handlers (8 route files: `approvals` POST; `articles` GET/POST; `articles/[id]` GET/PATCH; `audit` GET; `comments` POST/PATCH; `drafts` GET/POST/DELETE; `statistics` GET; `versions/[id]` GET/POST).
3. Replace body-supplied `createdBy` / `updatedBy` / `restoredBy` / `performedBy` / `memberId` with the verified uid.
4. Pass that uid into `createAuditEntry` (`services/knowledge-workflow.service.ts:576`) at every call site so the audit log has an actor.
5. Add `firestore.rules` blocks for the seven `knowledge_*` workflow collections and for `chatTraining`.

### Change a workflow status transition

1. Edit the transition table `getNextStatus` in `services/knowledge-workflow.service.ts:290-302`.
2. Add the action to `WorkflowActionType` in `types/knowledge-workflow.ts:61-72`, and the status to `WorkflowStatus` (`:9-17`) if new.
3. Add the side effects (timestamp fields) in the `switch` at `services/knowledge-workflow.service.ts:241-260`.
4. Add the badge in `components/ai/KnowledgeWorkflowDashboard.tsx:43-52` (the `Record<WorkflowStatus, …>` is exhaustive, so a new status is a compile error there).
5. Extend `getWorkflowStatistics`'s `byStatus` seed (`services/knowledge-workflow.service.ts:879-888`).

### Add a UAT test case

1. Append to the right array in `tests/ai-uat/test-cases.ts` (e.g. `SEVAS_TESTS`) with `id`, `category`, `question`, `expectedIntent`, `expectedLanguage`, `expectedRepository`, `validationCriteria`, `userPersona`.
2. `ALL_UAT_TESTS` and `TEST_STATS` pick it up automatically (`:3060-3096`).
3. Document it in the matching table in `AI_UAT.md`.
4. Note the per-category `describe` blocks in `tests/ai-uat/ai-uat.test.ts:210-358` assert only that an intent came back - if you want the new case to actually verify `expectedIntent`, change the assertion to `expect(result.intent).toBe(testCase.expectedIntent)` (expect many existing cases to start failing).

## Faults, smells and risks

| id | sev | What | Evidence | Direction | Status 2026-10-18 |
|---|---|---|---|---|---|
| M09-F01 | HIGH | Publishing a prompt version has no effect on the live chat - and no stored system prompt is read at runtime at all. The Prompt Manager writes `prompt.currentPromptId` on the `ai_settings` row `main` (a Supabase table since 2026-10); the only `getSystemPrompt()` call site is inside the disabled `/* ... */` block (`app/api/chat/route.ts:232-286`), and since 2891323 `getSystemPrompt` is no longer imported - its module `lib/ai/settings.ts` was deleted, so the block would not even compile if uncommented. The live answer comes from `generateResponse(...)` at `:162`. `getCurrentPrompt()` is called only by `/api/admin/prompts` (orphaned) and by `/api/ai/settings/prompts` for display. | `app/api/chat/route.ts:162`, `:232`, `:250`, `:286`; `lib/ai/settings.ts` (deliberately cited as absent - deleted in 2891323); vs `lib/ai/ai-settings/service.ts:402`, `lib/ai/ai-settings/admin-repository.ts:225`, `app/api/ai/settings/prompts/route.ts:17` | Pick one prompt store and make the live path read it; today the editor is decoration | STILL OPEN; MOVED (evidence re-pointed; the `settings/ai` reader is gone) |
| M09-F02 | HIGH | The admin playground reads response fields the chat API never returns: `data.intent`, `data.confidence`, `data.knowledgeSource`, `data.repository`, `data.knowledgeTitle`, `data.response`. `result.response` therefore holds the `AIMessage` **object** and is rendered as a React child. It also POSTs without `?debug=true`, so even `_debug.intent`/`_debug.confidence` are never in the payload. The 2026-10-14 rewrite only swapped `fetch` for `adminFetch`. | `app/admin/ai/playground/page.tsx:69-76`, `:90-95`, `:339`; API shape at `app/api/chat/route.ts:304-339` (`_debug` gated at `:294`, `:307`) | Read `data.message.content`, and call `/api/chat?debug=true` for intent/confidence | STILL OPEN; MOVED |
| M09-F03 | HIGH | Every `/api/admin/knowledge*` handler is unauthenticated and writes through the REST Admin SDK, explicitly bypassing Firestore rules. Anyone on the internet can create, overwrite or delete these articles. (Since 2026-10-06 the AI no longer reads them - see F47 - but the route still serves `/admin/knowledge` and accepts writes.) | `app/api/admin/knowledge/route.ts:89-112` ("bypasses security rules"), `app/api/admin/knowledge/[id]/route.ts:49-99` | Verify a Firebase ID token + admin claim before any write (`requireAdminUser` now exists) | STILL OPEN (files unchanged since 2026-09-19) |
| M09-F04 | HIGH | All fourteen `/api/knowledge/workflow/**` handlers (across 8 route files) are unauthenticated and take the actor from the request body (`createdBy`, `updatedBy`, `restoredBy`, `memberId`). Publish, archive, restore and committee votes are all forgeable. | `app/api/knowledge/workflow/articles/[id]/route.ts:69-79`, `.../approvals/route.ts:10-26`, `.../versions/[id]/route.ts:42-44` | Same verifier; derive the actor server-side | STILL OPEN (files unchanged) |
| M09-F05 | HIGH | The whole knowledge-workflow subsystem is unreachable: its only UI (`KnowledgeWorkflowDashboard`) is never imported, and none of its seven collections has a `firestore.rules` entry, so the client-SDK writes are denied by default. ~2,000 lines. | `components/ai/KnowledgeWorkflowDashboard.tsx:385` (no importers); `services/knowledge-workflow.service.ts:46-54` vs `firestore.rules` (no `knowledge_workflow*` match) | Wire it up behind an admin route **or** delete it; do not leave it half-live | STILL OPEN; MOVED (`:384` -> `:385`) |
| M09-F06 | HIGH | The Playwright E2E spec cannot even load: `describe` is used 15 times but never imported (only `test`, `expect`, `Page` are). | `tests/ai-uat/ai-uat.spec.ts:6` vs `:161`, `:224`, … `:813` | `import { test as describe }` is wrong - use `test.describe` | STILL OPEN (file unchanged) |
| M09-F07 | HIGH | The 275-case UAT suite never checks the expected intent. Each generated test asserts only `intent` is defined and `confidence > 0`, so no intent regression can fail CI - while `AI_UAT.md` claims a >95% intent-accuracy pass criterion. f5582d2 added mocks and widened both out-of-scope lists, and 3446b0b widened one of them further (F50); neither touched the per-case asserts. | `tests/ai-uat/ai-uat.test.ts:210-358`; claim at `AI_UAT.md:488-493` | Assert `toBe(testCase.expectedIntent)` and triage the fallout | STILL OPEN; MOVED |
| M09-F08 | HIGH | `/admin/ai/training` writes `chatTraining` straight from the browser, but `firestore.rules` has no `chatTraining` block, so every read/write is denied in a rules-enforced project. | `app/admin/ai/training/page.tsx:125`,`:149`,`:221`,`:232`,`:256`,`:267`; no match in `firestore.rules` | Add a rule or move the CRUD behind an API route - or delete the page (F49) | STILL OPEN; MOVED |
| M09-F09 | MEDIUM | `createAuditEntry` is never passed `performedBy`, so every audit row has an undefined actor - the audit trail records what happened but not who. | `services/knowledge-workflow.service.ts:576-598` (`performedBy?` is declared at `:580` but optional); all seven call sites omit it: `:104`, `:266`, `:360`, `:439`, `:529`, `:674`, `:744` | Thread the verified uid into every call | STILL OPEN (file unchanged) |
| M09-F10 | MEDIUM | Three dashboard components (1,531 lines) are dead: default-exported, absent from `components/ai/index.ts`, imported nowhere. `components/ai/index.ts` itself is imported nowhere. | `components/ai/AIAnalyticsDashboard.tsx:90`, `MultiSourceRetrievalDashboard.tsx:49`, `KnowledgeWorkflowDashboard.tsx:385`, `index.ts:1-11` | Mount them under `/admin/ai` or delete them | STILL OPEN; MOVED (+1 line each from the 6408c1d eslint header) |
| M09-F11 | MEDIUM | Three unused API surfaces: `/api/admin/prompts` (3 files, 311 lines), `/api/admin/analytics`, `/api/admin/content`. No page or component fetches any of them; the Prompt Manager uses `/api/ai/settings/prompts` instead. Hardening the prompt routes (F13) did not give them a caller. | grep of `api/admin/prompts`, `api/admin/analytics`, `api/admin/content` returns nothing outside `app/api/admin/`; `app/admin/ai/prompts/page.tsx:71` | Delete, or repoint the UI and delete the duplicate in M08 | STILL OPEN |
| M09-F12 | MEDIUM | `lib/knowledge/index.ts` is a stale knowledge source (167 lines of hardcoded Q&A including timings and address) that nothing imports - alongside `lib/ai/knowledge/seed`, Supabase `ai_knowledge`, Firestore `knowledge` and `knowledge_workflow`. | `lib/knowledge/index.ts:6-143`; no `from "@/lib/knowledge"` anywhere | Delete it; one source of truth per fact | STILL OPEN |
| M09-F13 | MEDIUM | `verifyAdmin` is a no-op outside production and is now the only guard on `GET /api/admin/prompts`; `GET /api/admin/prompts/[id]` has no guard at all. The writes are fixed: POST, PUT, DELETE and publish call `verifyAdminUser` and take the actor from the verified uid instead of `x-user-id`. | still open: `app/api/admin/prompts/route.ts:12-20`, `:27`; `app/api/admin/prompts/[id]/route.ts:13`; fixed: `app/api/admin/prompts/route.ts:63`, `:113`, `app/api/admin/prompts/[id]/route.ts:52`, `app/api/admin/prompts/[id]/publish/route.ts:18` | Guard the two GETs with `requireAdminUser` and delete `verifyAdmin` | PARTLY FIXED (2026-10-18) - writes fixed by da7a1fc / d235868 / 43c6d8f (2026-09-20); STILL OPEN for the two GETs |
| M09-F14 | MEDIUM | Admin pages query Firestore directly from the client, against AGENTS.md "No Direct Firebase Calls - use services only". | `app/admin/ai/analytics/page.tsx:303-333`, `:430`; `app/admin/ai/page.tsx:96`; `app/admin/ai/training/page.tsx:125` | Move behind `services/` or API routes | STILL OPEN; MOVED |
| M09-F15 | MEDIUM | Unbounded collection scan: `getDocs(collection(db,"chat_sessions"))` with no `limit`, run twice (hub + analytics) on every page view, then filtered in the browser for today's and the last 7 days' counts - and since 2026-10-06 the collection is no longer written (F48). | `app/admin/ai/analytics/page.tsx:333` and `app/admin/ai/page.tsx:96` (the only two unbounded `getDocs`; the sibling reads at `analytics/page.tsx:305-325` carry `limit()`) | Aggregate server-side (Supabase `count`) | STILL OPEN; MOVED |
| M09-F16 | MEDIUM | `MarkdownRenderer` builds HTML with regex and injects it via `dangerouslySetInnerHTML`. It escapes `<`/`>` first, but the link rule then interpolates an unvalidated URL into `href`, so a `javascript:` URL in model output becomes a live link. | `components/ai/MarkdownRenderer.tsx:15`, `:46`, `:54` | Use `react-markdown` (already a dependency, used at `ChatWindow.tsx:193`) and drop this file | STILL OPEN (file unchanged) |
| M09-F17 | MEDIUM | Two markdown renderers in one tree: `react-markdown` for the welcome screen, the regex renderer for every message. Different output for the same syntax. | `components/ai/ChatWindow.tsx:10`,`:193` vs `components/ai/MessageBubble.tsx:65` | Standardise on `react-markdown` | STILL OPEN |
| M09-F18 | MEDIUM | The chat API can compute `_ux.quickActions` and `_ux.suggestedQuestions` per intent, but only when the request carries `?ux=true`. The widget POSTs to a bare `/api/chat`, so `_ux` is never even returned, and `SuggestedQuestions` shows a static list regardless. Dead feature on both sides. | `app/api/chat/route.ts:295`,`:302`,`:329-336`; `components/ai/AIChatProvider.tsx:165`; `components/ai/SuggestedQuestions.tsx:16` | Request `?ux=true` and consume `_ux` in the provider, falling back to the static list | STILL OPEN; MOVED (`:156` -> `:165`) |
| M09-F19 | MEDIUM | `getNextStatus` returns the current status for an illegal transition, but `performWorkflowAction` still writes an action row and still stamps `publishedAt`/`archivedAt`. A `publish` on a draft records a publication that did not happen. | `services/knowledge-workflow.service.ts:290-302` and `:241-260` | Throw on an unmapped transition before writing anything | STILL OPEN |
| M09-F20 | MEDIUM | No role check anywhere in the workflow. `WorkflowRole` is declared and imported but never used; any caller can review, vote and publish. | `types/knowledge-workflow.ts:22-26`; imported unused at `services/knowledge-workflow.service.ts:37` | Enforce roles in `performWorkflowAction` and `submitCommitteeVote` | STILL OPEN |
| M09-F21 | MEDIUM | The intents editor forces `language: "en"` on every keyword and example it saves, so editing an intent silently destroys its Kannada keywords. | `app/admin/ai/intents/page.tsx:150`, `:155` (and the same coercion in the debug log at `:136`) | Preserve each keyword's original language; add a language selector | STILL OPEN; MOVED |
| M09-F22 | MEDIUM | `/admin/knowledge` lists seed articles as ordinary rows with edit/delete buttons, but their ids (`seed-<slug>`) have no Firestore document. The actions do not fail, they misbehave: `PUT` goes through a REST `PATCH` with an `updateMask` and no existence precondition, which upserts a new partial `knowledge/seed-<slug>` document, so the list then shows the seed row plus a Firestore copy; `DELETE` reports success because a 404 is tolerated, and the seed row reappears on reload. | `app/api/admin/knowledge/route.ts:46-60` (`isSeed: true`, id from slug); `lib/ai/knowledge/seed.ts:31`; `lib/firebase-admin-rest.ts:51-63` (PATCH upsert), `:84` (404 tolerated); `app/admin/knowledge/page.tsx:167`,`:201` | Disable the actions when `isSeed`, or import the seed into the store first | STILL OPEN; MOVED (mechanism corrected by verify 2026-10-18) |
| M09-F23 | MEDIUM | The Playwright suite's message locator (`[data-testid="message"], .message.assistant, .chat-message.assistant`) matches nothing the widget renders, so `sendMessage` always returns `""` and every E2E assertion fails on `response.length > 0`. | `tests/ai-uat/ai-uat.spec.ts:150`; no `data-testid` in `components/ai/`; `MessageBubble.tsx:55` uses `role="listitem"` | Add `data-testid` to the bubble and the input, or rewrite the locators | STILL OPEN |
| M09-F24 | MEDIUM | The Playwright job is `continue-on-error: true` and its base URL defaults to a third-party sandbox host, so E2E never blocks and by default points at somebody else's ephemeral environment. | `.github/workflows/ai-uat.yml:26`, `:85`; same default at `tests/ai-uat/ai-uat.spec.ts:17` | Require `E2E_BASE_URL`; drop `continue-on-error` once F06/F23 are fixed | STILL OPEN |
| M09-F25 | MEDIUM | `/api/admin/content` GET actions `freshness` and `review` return hardcoded placeholder JSON describing what they would do; `getArticlesNeedingReview` is imported and unused. | `app/api/admin/content/route.ts:46-71`, import at `:12` | Implement or remove the actions | STILL OPEN |
| M09-F26 | LOW | `any` is used across the module against AGENTS.md's strict-mode rule. | `app/api/knowledge/workflow/articles/[id]/route.ts:37`; `app/api/admin/knowledge/route.ts:25`; `app/api/admin/prompts/[id]/route.ts:20`,`:60`; `services/knowledge-workflow.service.ts:57`,`:471`,`:476`,`:495-497`,`:764`; `app/admin/assistant/page.tsx:54`-`:114`; `app/admin/ai/training/page.tsx:34-35` | Replace with `unknown` + narrowing, or real types | STILL OPEN; MOVED (and now partly hidden by F53) |
| M09-F27 | LOW | `data as any;` on its own line - an expression statement with no effect, left over from a refactor. | `services/knowledge-workflow.service.ts:728` | Delete | STILL OPEN |
| M09-F28 | LOW | Dead imports in route files: three workflow functions in `articles/route.ts`, `getArticleComments` in `comments/route.ts`, `getArticleCommitteeApproval` in `approvals/route.ts`, `getKnowledgeArticles`/`getPendingArticles` in `admin/knowledge/route.ts`, `generateResponse` and three `getTestsBy*` helpers in `run-uat-tests.ts`. | `app/api/knowledge/workflow/articles/route.ts:8-10`; `.../comments/route.ts:7`; `.../approvals/route.ts:5`; `app/api/admin/knowledge/route.ts:3-4`; `tests/ai-uat/run-uat-tests.ts:16-21` | Remove | STILL OPEN |
| M09-F29 | LOW | `run-uat-tests.ts` has a tautological language check (`expectedLanguage === expectedLanguage`) that is computed and then not used in the pass decision, and hardcodes `coverage: 100`. The third part - incrementing an undeclared `cat.skipped` - is fixed: `skipped` is now declared and initialised. | `tests/ai-uat/run-uat-tests.ts:144-146` (tautology; `passed` at `:148` uses only `intentMatch` + confidence), `:225` (`coverage: 100`); fixed at `:37` (`skipped: number`), `:67` (init), `:203` (`cat.skipped++`) | Fix the check, compute coverage | PARTLY FIXED (2026-10-18) - `skipped` declared by d235868 (2026-09-20); STILL OPEN for the tautology and `coverage: 100` |
| M09-F30 | LOW | `AI_UAT.md` documents CLI flags the runner does not parse (`--category=1`, `--coverage`, `--report`); `run-uat-tests.ts` reads no `process.argv`. | `AI_UAT.md:465-478` vs `tests/ai-uat/run-uat-tests.ts` (no argv handling) | Implement the flags or correct the doc | STILL OPEN |
| M09-F31 | LOW | Leftover debug `console.log` in the intents editor and the training page, against AGENTS.md "Leave no console.log". | `app/admin/ai/intents/page.tsx:131-139`, `:161`; `app/admin/ai/training/page.tsx:120` | Remove | STILL OPEN; MOVED (training call newly recorded; it was at `:109` in the snapshot) |
| M09-F32 | LOW | The training seed hardcodes temple facts ("Morning: 06:00 AM - 12:00 PM") that duplicate the `settings` collection the AI is supposed to quote - exactly the hallucination risk `docs/AI-GUIDELINES.md` forbids. Nothing reads these rows (F49) - already true on 2026-09-19 - so the risk is latent rather than live. | `app/admin/ai/training/page.tsx:51-95`; rule at `docs/AI-GUIDELINES.md:19-30` | Seed from `settingsService`, or drop the defaults | STILL OPEN; MOVED |
| M09-F33 | LOW | `QuickQuestionIcons` opens only on `onMouseEnter`/`onMouseLeave` with `pointerEvents` gated on hover - no keyboard focus, no tap target on touch devices, and the welcome screen tells devotees to "hover over the left panel". | `components/ai/QuickQuestionIcons.tsx:56-66`; copy at `components/ai/ChatWindow.tsx:180` | Add focus/click handling and a touch affordance | STILL OPEN (files unchanged) |
| M09-F34 | LOW | The chat dialog sets `aria-modal="true"` and `role="dialog"` but never traps focus, never moves focus on open and has no Escape handler. | `components/ai/ChatWindow.tsx:54-56` (no `onKeyDown`, no focus ref) | Add focus trap + Escape close, or drop `aria-modal` | STILL OPEN |
| M09-F35 | LOW | The 5-tab settings form saves five endpoints with `Promise.all` and no rollback - a partial failure leaves the AI's facts half-updated (it now at least reports the first failing status). | `app/admin/ai/settings/page.tsx:306-343` | One transactional endpoint, or per-tab save with per-tab status | STILL OPEN; MOVED |
| M09-F36 | LOW | Custom knowledge categories created in the UI live only in component state; they are re-derived from existing articles on reload, so an empty new category disappears. | `app/admin/knowledge/page.tsx:101-113` (re-derived in `loadArticles`), `:293` (`handleAddCategory`, state only) | Persist them (e.g. a `knowledge_categories` record) | STILL OPEN; MOVED |
| M09-F37 | LOW | `submitCommitteeVote` never checks that the voter is a committee member, and its rejection threshold is an opaque formula (`rejectionCount >= requiredApprovals - rejectionCount + 1`); `totalVotes` is computed and unused. | `services/knowledge-workflow.service.ts:452-500` | Validate membership; express the threshold plainly | STILL OPEN |
| M09-F38 | LOW | `getWorkflowStatistics` is capped by `getWorkflowArticles`'s hardcoded `limit(100)`, so all counters silently plateau at 100, and `averageReviewTime`/`averageApprovalTime` are hardcoded `0`. | `services/knowledge-workflow.service.ts:780` (`limit(100)`), `:870` and `:912` (hardcoded `0`) | Use aggregation queries | STILL OPEN |
| M09-F39 | LOW | `WorkflowQueryParams.language`, `.reviewedBy`, `.startDate`, `.endDate` are accepted by the type and parsed by the route but never applied as filters; `search` filters only the first 100 rows client-side. | `types/knowledge-workflow.ts:168-177`; `app/api/knowledge/workflow/articles/route.ts:21-27`; `services/knowledge-workflow.service.ts:764-812` | Implement or remove the params | STILL OPEN |
| M09-F40 | LOW | `regenerateResponse` is a near-copy of `sendMessage` that drops `detectedLanguage` from the request body and does not persist the user message, so a regenerated answer can come back in a different language. | `components/ai/AIChatProvider.tsx:247-295` vs `:140-236` | Extract one request helper | STILL OPEN; MOVED |
| M09-F41 | LOW | Chat history persistence failures are swallowed with an empty catch and a comment saying not to log, so a broken `chat_messages` write is invisible in production. | `components/ai/AIChatProvider.tsx:110-118` | Log at debug level or surface a one-time warning | STILL OPEN; MOVED |
| M09-F42 | LOW | `docs/AI-GUIDELINES.md` describes a bilingual `KnowledgeArticle` with `title.en/.kn` and `content.en/.kn`; the code uses flat `title`/`content` plus optional `kannadaTitle`/`kannadaContent` and a single `language` field. | `docs/AI-GUIDELINES.md:229-244` vs `app/api/admin/knowledge/route.ts:29-40` and `:46-60` | Update the doc to match the code | STILL OPEN |
| M09-F43 | MEDIUM | Knowledge is reachable over HTTP through three unrelated route families with three different access paths, no shared validation - and since 2026-10-06 not even a shared store: `/api/knowledge/*` (read-only, `services/knowledge.service.ts` → Supabase `ai_knowledge`), `/api/admin/knowledge/*` (read+write, Firestore `knowledge` via the REST **Admin** SDK, no auth), `/api/ai/knowledge/{coverage,import}` (Firestore `knowledge` via the client SDK straight from the route). A fourth family, `/api/knowledge/workflow/**`, writes a parallel `knowledge_workflow` collection nothing reads. | `app/api/knowledge/route.ts:16`; `lib/ai/knowledge/repository.ts:16`; `app/api/admin/knowledge/route.ts:22`,`:102`; `app/api/ai/knowledge/coverage/route.ts:2-3`, `:81`; `services/knowledge-workflow.service.ts:47` | Collapse to one service + one authenticated admin route family over Supabase; decide whether the workflow collection lives or dies (F05) | STILL OPEN - worse (split store, see F47) |
| M09-F44 | MEDIUM | `/admin/assistant` is unreachable from the running UI. The live sidebar is the hardcoded `allNavigation` in `components/admin/layout/AdminSidebar.tsx:36-104`, whose "AI Management" section (`:91-103`) does not list it; the only two links to `/admin/assistant` live in files nothing imports - `components/admin/AdminSidebar.tsx:106` and `components/admin/layout/navigation.ts:138`. The page is URL-only. | `components/admin/layout/AdminSidebar.tsx:91-103`; `components/admin/layout/AdminShell.tsx:5` (imports `./AdminSidebar`); no importer of `components/admin/layout/navigation.ts` or `components/admin/AdminSidebar.tsx` | Add it to the live sidebar or delete the page; delete the two dead nav sources (owner: M05) | STILL OPEN (sidebar unchanged) |
| M09-F45 | LOW | On a phone the quick-question rail collides with the open chat panel and cannot be dismissed. The rail is `fixed left-6 bottom-[calc(20rem+4rem)]` (≈448px up) and the panel is `fixed left-6 bottom-20` at `h-[600px] max-h-[70vh]`, `w-[calc(100vw-3rem)]` - the two overlap on any viewport under ~800px tall, and the rail only opens/closes on `onMouseEnter`/`onMouseLeave`. | `components/ai/QuickQuestionIcons.tsx:55`,`:56-57`; `components/ai/ChatWindow.tsx:48-51` | Hide the rail below `sm:`, or fold it into the panel (see F33) | STILL OPEN |
| M09-F46 | LOW | `app/api/knowledge/search` `parseInt`s `limit` but neither clamps it nor rejects `NaN`, and the route is unauthenticated with `Cache-Control: no-store`, so any caller sizes an uncached read (`?limit=100000`, or `?limit=abc` → `NaN` straight into the service). | `app/api/knowledge/search/route.ts:14`, `:20`, `:24` | Clamp to a sane max, default on `NaN`, and allow a short `s-maxage` | STILL OPEN |
| M09-F47 | HIGH | Knowledge edits made in the admin console never reach Raya or the public Knowledge Centre. Since fdaff98 (2026-10-06) `lib/ai/knowledge/repository.ts` reads the Supabase table `ai_knowledge`, but every admin write path still targets Firestore `knowledge`: `/api/admin/knowledge` POST/PUT/DELETE (used by `/admin/knowledge` and by the unknown-questions "Add to knowledge" button) and `/api/ai/knowledge/import`. Coverage on `/admin/ai` and `/admin/ai/knowledge` also counts Firestore, so it can report full coverage while the AI table is empty, and the toast "AI can now answer this question" is false. | `lib/ai/knowledge/repository.ts:16`; `app/api/admin/knowledge/route.ts:10`, `:102`; `app/api/admin/knowledge/[id]/route.ts:59`, `:98`; `app/api/ai/knowledge/import/route.ts:73`, `:116`; `app/api/ai/knowledge/coverage/route.ts:81`; `app/admin/ai/unknown-questions/page.tsx:223`, `:252` | Point the admin routes at the Supabase repository (one write path), backfill anything written to Firestore after the migration, then retire Firestore `knowledge` | NEW (2026-10-18) - introduced by fdaff98 |
| M09-F48 | MEDIUM | The analytics dashboard reads four Firestore collections, and two of them are no longer written: the intent pie and the latency panel read `ai_intent_distribution` and `ai_latency_records`, whose writers moved to Supabase in the 2026-10-13 analytics migration, so those panels freeze at that date (or read zero on a fresh project). The other two are still live: Firestore `chat_sessions` is written on every chat turn by the server (`services/conversation.service.ts:161` via `app/api/chat/route.ts:183`), so the hub and analytics conversation counts still move; Firestore `unknown_questions` is still written for confidence < 60 by `lib/ai/generator.ts:73` → `services/analytics.service.ts:31`, while `/admin/ai/unknown-questions` reads the Supabase table filled for confidence < 50 by `lib/ai/unknown-logger.ts:30`, so the two unknown-question counts disagree by construction. | `app/admin/ai/analytics/page.tsx:305-317` (frozen sources), `:321-333`, `:430` (live sources); `app/admin/ai/page.tsx:96`; Supabase writers `services/ai-analytics.service.ts:135`, `:171`; live Firestore writers `services/conversation.service.ts:161`, `services/analytics.service.ts:31` | Serve the dashboard from the authenticated `/api/ai/analytics` family (M08, already backed by `services/ai-analytics.service.ts`) and drop the browser Firestore reads - also closes F14/F15 | NEW (2026-10-18) - introduced by 2cd44c7 / 3d0d3b2 (2026-10-13; 54024a1 is the post-merge check); verify 2026-10-18 cut HIGH to MEDIUM and corrected the `chat_sessions` / `unknown_questions` claims |
| M09-F49 | MEDIUM | `/admin/ai/training` edits have no effect on the chat: the only module that read `chatTraining`, `lib/ai/firebaseChat.ts`, was never called on the live path (on 2026-09-19 `app/api/chat/route.ts:4` imported `generateFirebaseResponse` and `getTempleInfo` and used neither) and was deleted in 2891323 (2026-10-14). The page is CRUD over write-only data (on top of F08's missing rule), still advertised by a hub card. | `app/admin/ai/training/page.tsx:125-267` hold the only `chatTraining` references in `app/`, `lib/`, `services/`, `components/` apart from the migration exclusion list `lib/supabase/migration-inventory.ts:23` (`EXCLUDE_SYSTEM`); `lib/ai/firebaseChat.ts` (deliberately cited as absent); hub card list `app/admin/ai/page.tsx:137-194` | Delete the page and its hub card, or fold the pairs into `ai_knowledge` | NEW (2026-10-18) - pre-existing in the 2026-09-19 snapshot (dead import), made explicit by 2891323; attribution corrected by verify 2026-10-18 |
| M09-F50 | LOW | UAT out-of-scope tests were widened rather than fixed: "Write me a Python function" now passes when routed to `TEMPLE_TIMINGS` or `GENERAL_GREETING`, "Is it raining today?" when routed to `TEMPLE_TIMINGS` or `DAILY_QUOTE` - the suite now accepts exactly the misrouting it should catch. The spec also mocks `@/lib/firebase` twice. | `tests/ai-uat/ai-uat.test.ts:414`, `:419`; duplicate mocks `:21-24` and `:73-76` | Restore the out-of-scope-only lists and fix the intent detector; delete the duplicate mock | NEW (2026-10-18) - 3446b0b, f5582d2 |
| M09-F51 | LOW | The chat widget's welcome text costs one uncached server read per full page load: the provider (mounted site-wide) fetches `/api/ai/public-settings`, which sets no `Cache-Control` and calls `aiSettingsService.getAISettings()` - which can insert default settings (`createDefaultSettings("system")`) from this public, unauthenticated GET when the row is missing. The provider also leaves a `console.warn` in production. | `components/ai/AIChatProvider.tsx:73-92`, `:84`; `app/api/ai/public-settings/route.ts:5-17`; `lib/ai/ai-settings/service.ts:44-46` | Add `s-maxage` and make the route read-only, or pass the welcome text down from the server layout | NEW (2026-10-18) - 577bbce / 3446b0b |
| M09-F52 | LOW | The AI Settings "Reset" button confirms, then shows "Settings reset to defaults (save to apply)" without changing anything. | `app/admin/ai/settings/page.tsx:357-362` | Implement the reset from the `DEFAULT_*` constants in `types/ai-settings.ts`, or remove the button | NEW (2026-10-18) - pre-existing in the 2026-09-19 snapshot, first recorded now |
| M09-F53 | LOW | Seven module files now begin with a file-wide `/* eslint-disable */` (6408c1d, "fix CI pipeline errors"), which makes `npm run lint` pass by switching it off for those files and hides F26/F28-class problems in them. | `app/admin/ai/health/page.tsx:1`, `app/admin/ai/knowledge/page.tsx:1`, `app/admin/ai/settings/page.tsx:1`, `app/admin/knowledge/page.tsx:1`, `components/ai/AIAnalyticsDashboard.tsx:1`, `components/ai/KnowledgeWorkflowDashboard.tsx:1`, `components/ai/MultiSourceRetrievalDashboard.tsx:1` | Remove the blanket disables and fix or line-scope each warning | NEW (2026-10-18) - 6408c1d |
| M09-F54 | LOW | `/api/admin/knowledge/[id]` is split across two stores: `GET` reads Supabase `ai_knowledge` through `getArticleById` (an `eq("id", …)` on a `uuid` column), while `PUT`/`DELETE` and the list route work on Firestore `knowledge`. Its only caller, `startEditingWithId` after "New article", passes a Firestore id, so the read always misses and the page falls back to a hardcoded placeholder article. It works today only because the placeholder matches what `createArticle` just posted. | `app/api/admin/knowledge/[id]/route.ts:3`, `:22`; `lib/ai/knowledge/repository.ts:118-131`; `supabase/migrations/20261013000000_create_ai_knowledge.sql:4`; `app/admin/knowledge/page.tsx:240`, `:253-270` | Fold into the F47 fix: one store for every verb of the admin knowledge API | NEW (verify 2026-10-18) - the route file is unchanged since 2026-09-19; fdaff98 moved `getArticleById` to Supabase underneath it |
| M09-F55 | MEDIUM | Two session stores for one chat. The widget writes Supabase `chat_sessions`/`chat_messages`, but `/api/chat` also writes a Firestore `chat_sessions/{id}` document holding the conversation (`arrayUnion` of every user and assistant message, pruned to 20) on every turn. Nothing reconciles the two, and `firestore.rules` allows anyone to read, create and update `chat_sessions`, so the Firestore copy of every devotee conversation is world-readable by session id or by listing the collection. | `app/api/chat/route.ts:143`, `:183`; `services/conversation.service.ts:154-175`, `:44` (`MAX_MESSAGES = 20`); `firestore.rules:186-190`; widget side `services/chat.service.ts:103-140` | Owner M08/M04: move the context store to the Supabase session row (or server-only storage) and close the `chat_sessions` read rule | NEW (verify 2026-10-18) - pre-existing; the widget half moved to Supabase in 224875d, the server half did not |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `AIChatProvider.tsx` state + `sendMessage` | `localStorage`, `crypto.randomUUID`, `fetch`, browser Supabase client (via `services/chat.service.ts`) | **adapt** | Swap `localStorage` for `AsyncStorage`/MMKV and `crypto.randomUUID` for `react-native-get-random-values` + `uuid`; the request/response logic and error mapping port as-is |
| `ChatWidget.tsx` | `next/dynamic`, `requestAnimationFrame`, `process.env.NEXT_PUBLIC_*` | **rewrite** | The whole mount-gating trick exists to dodge SSR hydration, which does not exist in RN; a native app just renders a modal |
| `ChatWindow.tsx` | Tailwind classes, `fixed`/`z-50`, `scrollIntoView`, `vh` units, `react-markdown` | **rewrite** | Layout, positioning and scrolling all differ; reuse the composition and the header/action set, not the markup |
| `MessageBubble.tsx` | `navigator.clipboard`, gradient classes | **rewrite** (logic reusable) | `@react-native-clipboard/clipboard`; the copy/regenerate/feedback state machine is portable |
| `MarkdownRenderer.tsx` | `dangerouslySetInnerHTML`, HTML string | **rewrite** | No DOM in RN; use `react-native-markdown-display`. Also see M09-F16 |
| `ChatInput.tsx` | `<textarea>`, `scrollHeight` auto-resize, `KeyboardEvent` | **rewrite** | `TextInput` with `multiline` + `onContentSizeChange` |
| `FloatingButton.tsx`, `TypingIndicator.tsx`, `QuickQuestionIcons.tsx` | `lucide-react`, CSS animation, hover | **rewrite** | `lucide-react-native` exists; hover has no analogue on touch (F33 makes this a feature fix too) |
| All 13 admin pages | Tailwind, DOM forms, global `prompt()` (`prompts/page.tsx:99`), `window.confirm`, inline SVG charts | **rewrite** | Admin is a desktop tool; the realistic answer is to keep it web-only |
| `app/api/**` route handlers | Next.js `NextRequest`/`NextResponse`, App Router file routing | **adapt** | Keep them as the HTTP API a native client calls; the handler bodies are framework-thin |
| `services/knowledge-workflow.service.ts` | `firebase/firestore` **client** SDK used server-side | **adapt** | Works in RN too (same web SDK), but it should move to the Admin SDK behind an API instead |
| `types/knowledge-workflow.ts`, `types/ai*.ts` | none | **reuse as-is** | Pure types - the natural contents of a shared package |
| `lib/knowledge/index.ts` | none | **reuse as-is** (but delete - F12) | Plain data + string matching |
| `tests/ai-uat/test-cases.ts`, `run-uat-tests.ts` | `fs`, `path`, `__dirname` | **adapt** | Test data is portable; the Node file I/O is not |
| `tests/ai-uat/ai-uat.spec.ts` | Playwright DOM selectors | **rewrite** | Native E2E needs Detox/Maestro |

What a React Native client would need from this module:

1. A stable HTTP contract. Today the widget depends on `/api/chat` returning `{ message, sessionId }` and quietly ignores `_debug`/`_ux`; that shape should be versioned and typed in a shared package before a second client exists.
2. The chat transport, session and error-mapping logic extracted out of `AIChatProvider.tsx` into a platform-free hook (`useChatSession`) whose only injected dependencies are a storage adapter and a fetch function. Roughly lines 140-311 are already platform-free.
3. Shared types: `AIMessage`, `DetectedLanguage`, `ChatResponse`, plus the knowledge and workflow types, published as a package rather than reached through `@/types/*`.
4. Message persistence and feedback moved behind API routes. The provider currently calls `services/chat.service.ts` from the browser (browser Supabase client for sessions and messages since 2026-10-06, client Firestore SDK for feedback); a native app would work, but it also means the Supabase anon key and RLS policies are the only thing between a device and `chat_messages`.
5. Server-side auth on every admin/knowledge route (F03, F04) - a native admin app cannot rely on `AdminAuthGuard`, which is client-side only.
6. A markdown renderer chosen per platform behind one component boundary, and `data-testid`/`accessibilityLabel` on the bubble and input so both web and native E2E can target them (F23).

**What `apps/mobile` does today (2026-10-18).** It does not consume any M09 code: `apps/mobile/app/(tabs)/ai.tsx` (183 lines, 0cb71b6 / 5813fc9, 2026-09-30) is a separate Expo screen that POSTs `{ messages }` to `${EXPO_PUBLIC_API_URL}/api/chat` (default `https://www.srsmathaynk.com`) and reads `data.message.content`. It sends no `sessionId` and no `detectedLanguage`, persists nothing, has no feedback/regenerate/copy, hardcodes its own welcome text instead of `/api/ai/public-settings`, and renders replies as plain `<Text>`, so markdown arrives raw. Point 1 above is therefore live: a second client of the untyped `/api/chat` contract now exists.

## Coverage

filesExpected 58, filesMentioned 58, omitted: none (re-counted by script on 2026-10-18 against the regenerated `.claude/state/inventory/M09.json`; no files were added to or deleted from the module since 2026-09-19).

Every file in `.claude/state/inventory/M09.json` appears at least once in the Key files table; the six large admin pages and the three dead dashboards were read by structure (exports, state, fetch/Firestore calls, JSX sections) rather than line by line, as the brief allows for files over 300 lines. `tests/ai-uat/test-cases.ts` (3,118 lines) was sampled and counted by script (275 cases) rather than read in full.

## UNCLEAR

- (2026-10-18) Whether Firestore `knowledge`, `chat_sessions` and the analytics collections were copied into Supabase once at migration time. If they were, F47/F48 lose everything written after 2026-10-06; if not, the Supabase tables also lack the history. Settled by comparing row counts in both stores - out of scope for a static read.
- (2026-10-18) Whether the Firebase project is still live. If it has been retired, the hub, analytics and training pages and `/api/admin/knowledge` fail outright instead of showing stale data.
- Whether `firestore.rules` as committed is the deployed ruleset. If the project runs in test mode, F05/F08 change from "denied" to "world-writable", which is worse. Settled by checking the Firebase console or a deploy log.
- Whether `where("__name__", "==", approval.articleId)` in `submitCommitteeVote` (`services/knowledge-workflow.service.ts:518`) resolves a bare document id or throws. The JS SDK's `documentId()` handling is version-dependent; a direct `doc()` get would avoid the question entirely. Settled by running it against an emulator - out of scope for a static read.
- Whether `npm run type-check` currently passes. (Resolved in part 2026-10-18: `cat.skipped` at `tests/ai-uat/run-uat-tests.ts:203` is now declared on `CategoryResult` at `:37` by d235868, so the strict-mode error suspected on 2026-09-19 is gone.) The rest is settled only by running the check (not permitted in this pass).
- Whether the `/api/admin/prompts`, `/api/admin/analytics` and `/api/admin/content` routes are called by anything outside this repository (a script, a cron, an external tool). Nothing inside it calls them. Settled by checking access logs.
- Whether `E2E_BASE_URL` is set as a GitHub secret. If not, CI E2E runs hit `work-2-lsyqjcumilhubnrb.prod-runtime.all-hands.dev` (`.github/workflows/ai-uat.yml:26`). Settled by looking at the repository secrets.

## Verification log (2026-09-19)

Skeptic pass over this file: 239 path citations extracted by script and resolved (0 missing, 0 line numbers past end of file); 26 factual claims re-opened against the code; all 42 original findings re-checked; inventory coverage re-diffed (58/58 full paths present verbatim, every Key-files line count matches disk).

- F01 mechanism wrong -> `getSystemPrompt()` at `app/api/chat/route.ts:250` is **inside the disabled block comment** `:232`-`:286`, so no stored prompt is read at runtime at all; live answers come from `generateResponse(...)` at `:162` -> evidence `grep -n "getSystemPrompt\|/\*\|\*/" app/api/chat/route.ts` returns exactly `:3, :232, :250, :286`.
- F01 "only callers of `getCurrentPrompt()` are the orphaned routes" wrong -> there is a third, `app/api/ai/settings/prompts/route.ts:12`, which feeds the Prompt Manager's display -> `grep -rn getCurrentPrompt`.
- `settings/ai` doc read cited at `lib/ai/settings.ts:38` -> `:39` (`doc(db, "settings", "ai")`); `:38` is `try {`.
- Data flow 4 step 5 and the "Change how the live system prompt is chosen" recipe rewritten to match the above.
- F02 field reads cited `:105-113` -> `:87-92`; added that the playground POSTs a bare `/api/chat` (`:66-73`) so `_debug` is never returned either (`_debug` gated on `?debug=true` at `app/api/chat/route.ts:294`).
- F04 / auth recipe "all ten workflow handlers" -> **fourteen** handlers across 8 route files, enumerated -> `grep -o "export async function [A-Z]*"` per file.
- F09 call sites `:100,:262,:443,:527,:660,:748` all wrong and one short -> `:104, :266, :360, :439, :529, :674, :744` (seven) -> `grep -n createAuditEntry`. Fault itself CONFIRMED: `performedBy?` is declared at `:580` and no call site passes it (the `performedBy` at `:281` belongs to the returned `WorkflowAction`, not the audit row).
- F15 second cite `analytics/page.tsx:375` does not exist -> the only two unbounded `getDocs` are `analytics/page.tsx:255` and `app/admin/ai/page.tsx:94`; the sibling reads at `:245`,`:247`,`:249` do carry `limit()`.
- F18 understated -> `_ux` is built only when `?ux=true` (`app/api/chat/route.ts:295`,`:302`) and the widget POSTs a bare URL (`AIChatProvider.tsx:156`), so `_ux` is never returned; cites corrected to `:295`,`:302`,`:329-336`.
- F21 cite `:117-119` -> `:113-114` (plus the same coercion in the debug log at `:103`).
- F25 import cite `:13` -> `:12`.
- F27 cite `:742` (a bare `}`) -> `:728` (`data as any;`).
- F29 cites `:150`,`:200`,`:223`,`:36-43` -> `coverage: 100` at `:225`, `cat.skipped++` at `:203`, interface at `:37-44`; added that `passed` at `:148` uses only `intentMatch` + confidence, which is why the language tautology is inert.
- F31 cites `:105-110`,`:114` -> `:100-105`, `:119` -> `grep -n console.log app/admin/ai/intents/page.tsx` returns `100, 119`.
- F36 cite `:99-111` -> `:100-112`.
- F38 cite `:781` -> `:780` (`limit(100)`); hardcoded zeros pinned to `:870` and `:912`.
- F42 cite `docs/AI-GUIDELINES.md:258-283` (a category table) -> `:229-244`, where `interface KnowledgeArticle` with `title.en/.kn` actually is.
- F24 cite `ai-uat.spec.ts:16` -> `:17` (the `BASE_URL` const).
- `app/admin/layout.tsx:23` (a `<Suspense>`) -> `:24` (`<AdminAuthGuard>`).
- UNCLEAR `where("__name__" ...)` cite `:509-512` -> `:518`.
- Focus question "mobile behaviour" was unanswered -> new paragraph under the widget tree with the actual breakpoint/position classes.
- Focus question "which admin AI pages are reachable" was only implied -> new reachability block under Entry points (sidebar 8 / hub 7 / URL-only 1).
- Focus question "duplicated knowledge routes (api/knowledge vs api/admin/knowledge vs api/ai/knowledge)" had no fault row -> added **M09-F43**.
- New: **M09-F44** `/admin/assistant` is URL-only; its only two links are in files nothing imports. **M09-F45** the hover rail overlaps the chat panel on phones. **M09-F46** `/api/knowledge/search` neither clamps nor `NaN`-guards `limit` on a `no-store` route.

Re-checked and left as written (spot evidence): F03 (`app/api/admin/knowledge/route.ts:87`,`:101` say "bypasses security rules" in so many words; zero auth tokens anywhere under `app/api/admin/knowledge/` or `app/api/knowledge/`), F05 and F08 (`firestore.rules` has 38 collection `match` blocks, none for `chatTraining` or any `knowledge_workflow*`/`knowledge_versions`/`knowledge_drafts`/`knowledge_audit_log`, and no catch-all - default deny), F06 (`describe.describe(` at 15 sites, `:161`-`:813`, `describe` never imported), F07, F10 (no importer for any of the three dashboards or for `components/ai/index.ts`), F11 and F12 (grep for callers/importers returns nothing), F13, F14, F16, F17, F19, F20, F22, F23, F26, F28, F30, F32-F35, F37, F39-F41. All 22 exported functions of `services/knowledge-workflow.service.ts` were checked against their cited line numbers and every one matches.

## Refresh log (2026-10-18)

Refreshed against HEAD 424fdb8 on branch `feature/temple-portal-knowledge-base`; diffed against the read-only 2026-09-19 snapshot with `diff --strip-trailing-cr -w` (raw `diff` reports every file as changed because of line endings). Delta for M09: 0 added, 0 deleted, 22 modified. Most of the 22 are Prettier reformatting; the substantive changes are listed below. Several of the biggest changes to this module's behaviour came from files **outside** its delta (M08's Supabase migration), which the fault table now reflects.

- Header: written 2026-09-19 -> refreshed 2026-10-18 at 424fdb8.
- Purpose: chat persisted to Firestore -> Supabase `chat_sessions` / `chat_messages` since 2026-10-06 -> `services/chat.service.ts:7-150`, commit 224875d.
- Entry points, provider row: no network call on mount -> fetches `/api/ai/public-settings` for the welcome text -> `components/ai/AIChatProvider.tsx:78`.
- Entry points, health row: pinged 8 settings endpoints -> probes `/api/ai/health` + 8 endpoints with a bearer token and classifies results -> `app/admin/ai/health/page.tsx:62-184`, `lib/ai/health-classify.ts`, commit 8d54714.
- Entry points, settings row: plain 5-tab form -> adds per-endpoint diagnostics and Retry; "Initialize Data" (already present) noted -> `app/admin/ai/settings/page.tsx:151-257`, `:279`.
- Entry points, `/api/admin/prompts*` auth: weak / none / none -> GET weak, writes verify a Firebase ID token -> `app/api/admin/prompts/route.ts:63`, `:113`, `[id]/route.ts:52`, `[id]/publish/route.ts:18`, commits da7a1fc / d235868 / 43c6d8f.
- Client-guard paragraph: "No admin API route in this module verifies a Firebase ID token" -> eight pages send a bearer token via `useAdminFetch`; the M08 routes verify it; prompt writes verify it; knowledge/workflow/analytics/content routes still verify nothing -> `hooks/useAdminFetch.ts:43`, `lib/auth/admin-auth.ts:186`, commits 0202801, d172ac1.
- Reachability: hub cards `:132-189` -> `:137-194`.
- Provider hooks paragraph: `getWelcomeMessage` (`lib/ai/settings.ts`) and Firestore `chat_sessions`/`messages` -> `/api/ai/public-settings` and Supabase tables -> commits 2891323, 3446b0b, 224875d.
- Admin page template: loader uses `fetch` -> `adminFetch` on 8 pages; analytics/training/health/settings deviations re-cited; new bullet for the eslint headers.
- Workflow and orphan dashboards: `:384`, `:38`, `:89`, `:48` -> `:385`, `:42`, `:90`, `:49` (file-wide `/* eslint-disable */` added at line 1 by 6408c1d; `StatusBadge` cite was already off by 3).
- Data flow 1: added step 0 (welcome fetch); `:131`, `:156`, `:180-184`, `:196-211` -> `:140`, `:165`, `:189-193`, `:205-220`; `saveMessage` `:85` writing Firestore -> `:103` writing Supabase `chat_messages`; swallow `:106` -> `:114-117`.
- Data flow 2 step 5: "the retrieval engine sees the change on its next cache miss" -> false; the engine reads Supabase `ai_knowledge` -> `lib/ai/knowledge/repository.ts:16`, commit fdaff98. Page cites `:96`, `:166` -> `:97`, `:167`.
- Data flow 3: `:99`, `:187-196`, `:200-208` -> `:129`, `:223-234`, `:240-248`; added the false success toast `:252`.
- Data flow 4: `ai_settings/main` Firestore document -> Supabase `ai_settings` row `main` (`lib/ai/ai-settings/admin-repository.ts:30-31`); repository `:265`/`:188` -> `:292`/`:225`; service `:378` -> `:402`; `getCurrentPrompt` callers `:32`, `:35`, `:12` -> `:33`, `:40`, `:17`; `lib/ai/settings.ts` and the `settings/ai` reader -> deleted (2891323).
- Data flow 6: mocks `:46-54` -> `:21-24`, `:27-36`, `:38-42`, `:73-76`, `:79` (f5582d2).
- Key files: line counts for the 22 modified files re-taken from today's inventory; notes updated for provider, hub, analytics, health, intents, ai/knowledge, prompts, settings, training, prompt routes and the Jest suite.
- Stores: `chat_sessions` split into Supabase (live) and Firestore (legacy, read only by hub/analytics); `messages` -> Supabase `chat_messages`; `volunteers` -> `volunteer_requests` (a correction - the snapshot already used `volunteer_requests`, `services/chat.service.ts:189`); `chatTraining` engine reader removed; `knowledge` no longer the engine's source and new `ai_knowledge` row added; analytics collections marked legacy with their new Supabase writers; `ai_settings` now Supabase; `settings/ai` now unread; localStorage cites `:118`, `:183`, `:235` -> `:127`, `:192`, `:244`.
- Cross-module: struck `lib/ai/settings.ts`; added `/api/ai/public-settings`, `/api/ai/health`, `/api/ai/settings/*`, `lib/ai/health-classify.ts` (M08), `hooks/useAdminFetch.ts` (M01), `lib/auth/admin-auth.ts` (M04); `services/chat.service.ts` purpose split by store; noted `apps/mobile` imports nothing.
- How to change: knowledge-field recipe now points at Supabase `ai_knowledge` and F47; new-page recipe requires `useAdminFetch`; prompt recipe no longer suggests editing `lib/ai/settings.ts`; auth recipe reuses `lib/auth/admin-auth.ts` and warns to switch `/admin/knowledge` to `useAdminFetch` first; badge cite `:40-49` -> `:43-52`; UAT cite `:185-331` -> `:210-358`.
- Faults: added a "Status 2026-10-18" column. 0 FIXED, 2 PARTLY FIXED (F13, F29), 44 STILL OPEN (19 of them with evidence MOVED), 7 NEW (F47-F53). F01, F03, F15, F32 and F43 re-worded because the Supabase migration changed their impact.
- Portability: provider row adds the browser Supabase client; `window.prompt` `:70` -> `prompt()` `:99`; platform-free range `131-302` -> `140-311`; persistence point re-worded for Supabase/RLS; new paragraph on `apps/mobile/app/(tabs)/ai.tsx` (does not consume M09, re-implements a minimal chat).
- Answers questions about: five topics added (F47, F48, admin bearer auth, welcome text source, mobile chat).
- Coverage: unchanged at 58/58 (no files added or deleted).
- UNCLEAR: two bullets added (one-off data copy at migration time; whether the Firebase project is still live).

Commits that drove the biggest changes: fdaff98 (2026-10-06, AI knowledge to Supabase - F47), 224875d (2026-10-06, chat sessions/messages to Supabase - F48), 54024a1 (2026-10-13, analytics migration verification - F48), 2891323 (2026-10-14, deleted `lib/ai/settings.ts` and `lib/ai/firebaseChat.ts` - F01, F49), 0202801 + d172ac1 + 8d54714 (2026-10-14/15, bearer-token admin fetch, stale-request guards, auth diagnostics), da7a1fc / d235868 / 43c6d8f (2026-09-20, prompt route hardening - F13, F29), 3446b0b + 577bbce (2026-10-14, public welcome endpoint and widened UAT asserts - F50, F51), 6408c1d (2026-10-03, blanket eslint disables - F53).

UNCLEAR (2026-10-18):
- Commit 577bbce is titled "restore intent assertions", but within M09 it only changed `components/ai/AIChatProvider.tsx`; the per-case UAT asserts are still `toBeDefined()`. It may have restored assertions in `tests/unit/intent.test.ts` (outside M09); not checked.
- The `useCallback` loaders on the intents, prompts, unknown-questions and hub pages omit `adminFetch` from their dependency lists (`[showMsg]` / `[]`). This looks harmless because `AdminAuthGuard` renders the page only after auth has loaded, so the first closure already has a user; whether a sign-out/sign-in without unmount leaves a stale token is not settled by a static read.
- Path check: every backticked path in this file was resolved by script on 2026-10-18. The only misses are `lib/ai/settings.ts` and `lib/ai/firebaseChat.ts` (deliberately cited as deleted) and the hypothetical `app/admin/ai/<slug>/` in the new-page recipe.

## Verification log (2026-10-18)

Skeptic pass over the 2026-10-18 refresh, run at HEAD 43361a3 (two docs-only commits on top of 424fdb8; no application file differs between them). Path check by script: 512 backticked path citations, 439 resolve as full paths; every miss is a deliberate deleted file (`lib/ai/settings.ts`, `lib/ai/firebaseChat.ts`), a historical cite inside the 2026-09-19 log, or a contextual shorthand (`AIChatProvider.tsx:78`, `[id]/route.ts:52`); 0 line numbers past end of file. Coverage re-diffed: 58/58 inventory files present, every Key-files line count within 1 of disk. 30 claims re-opened, all 53 fault rows re-checked.

- F48 "nothing has written Firestore `chat_sessions` since 2026-10-06" wrong -> `/api/chat` still writes it on every turn via `services/conversation.service.ts:161` (called at `app/api/chat/route.ts:183`), so the hub and analytics conversation counts still move -> `grep -n setDoc services/conversation.service.ts`; matches M08's own store table.
- F48 "Firestore `unknown_questions` no longer written" wrong -> still written for confidence < 60 by `lib/ai/generator.ts:73` → `services/analytics.service.ts:31`; only `ai_intent_distribution` and `ai_latency_records` are truly frozen -> severity HIGH -> MEDIUM; attribution 224875d / 54024a1 -> 2cd44c7 / 3d0d3b2 (2026-10-13), from `git log -S "from('ai_latency_records')" -- services/ai-analytics.service.ts`.
- Stores table: Firestore `chat_sessions` "(legacy) written by nothing" -> server context store, written by `/api/chat`, public-read per `firestore.rules:186-190`; the combined legacy analytics row split into a frozen row (intent, latency) and a live `unknown_questions` row.
- Entry-points row, analytics deviation bullet, hub and analytics Key-files notes, Purpose paragraph and the F48 "Answers questions" bullet re-worded to match the above.
- Data flow 1 step 5: added the server-side Firestore `chat_sessions` read/write (`app/api/chat/route.ts:143`, `:183`).
- F49 "introduced by 2891323" wrong -> pre-existing: in the 2026-09-19 snapshot `app/api/chat/route.ts:4` imported `generateFirebaseResponse`/`getTempleInfo` and called neither, so `chatTraining` was already write-only -> `grep -n generateFirebaseResponse` in the snapshot returns only the import. Also "only `chatTraining` references" now names `lib/supabase/migration-inventory.ts:23`. F32 and the `chatTraining` store row re-worded to match.
- F22 "PUT/DELETE cannot work" wrong mechanism -> PUT upserts a partial `knowledge/seed-<slug>` Firestore doc (REST PATCH with `updateMask`, no precondition, `lib/firebase-admin-rest.ts:51-63`); DELETE returns success because a 404 is tolerated (`:84`).
- Entry-points row and Key-files row for `/api/admin/knowledge/[id]` "read/update/delete via REST Admin SDK" wrong -> GET reads Supabase `ai_knowledge` via `getArticleById` (`app/api/admin/knowledge/[id]/route.ts:3`, `:22`) -> new **M09-F54**.
- New **M09-F55**: two session stores per chat, and the Firestore copy holds the transcript under a public-read rule (`services/conversation.service.ts:154-175`, `firestore.rules:186-190`).
- Client-guard paragraph: added that `/api/ai/knowledge/coverage` and `/import` ignore the bearer token -> neither file contains `requireAdminUser` / `verifyAdminUser`.
- F07 "3446b0b widened two out-of-scope lists" wrong -> f5582d2 widened both, 3446b0b added `DAILY_QUOTE` to one -> `git show f5582d2 3446b0b -- tests/ai-uat/ai-uat.test.ts`.
- Data flow 6: `package.json:20` -> `:26` (`test:ai-uat:jest`); mock list now includes `@/lib/ai/knowledge` (`tests/ai-uat/ai-uat.test.ts:184`).
- `/admin/assistant` Key-files note "ten `any` casts" -> nine (`grep -o "\bany\b" app/admin/assistant/page.tsx | wc -l`).
- UNCLEAR bullet on `cat.skipped` was stale (F29 already says it is fixed) -> marked resolved in part, citing `tests/ai-uat/run-uat-tests.ts:37`.

Re-checked and left as written: F01 (`getSystemPrompt` appears only at `app/api/chat/route.ts:250`, inside `:232`-`:286`; no import), F02 (`playground/page.tsx:69-95`, `:339`), F13 (GETs still guarded only by `verifyAdmin` / nothing; writes call `verifyAdminUser` and return 401 on null), F29, F47 (`lib/ai/knowledge/repository.ts:16` vs Firestore writes at `app/api/admin/knowledge/route.ts:102`, `[id]/route.ts:59`, `:98`, `app/api/ai/knowledge/import/route.ts:116`), F50, F51 (no `Cache-Control` in `app/api/ai/public-settings/route.ts`; `createDefaultSettings("system")` at `lib/ai/ai-settings/service.ts:45`; no cache in the service), F52 (`settings/page.tsx:357-362`, wired at `:589`), F53 (7 files, all line 1 blamed to 6408c1d), the eight `useAdminFetch` pages, the sidebar and hub menus, and every other row. The route and service files behind F03-F06, F09, F16, F19-F20, F25, F27, F37-F39, F46 show 0 lines of difference from the snapshot (`diff --strip-trailing-cr -w`), so their 2026-09-19 verification stands.
