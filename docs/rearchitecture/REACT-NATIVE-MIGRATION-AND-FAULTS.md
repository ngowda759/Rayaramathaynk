# React Native migration, fault register and rearchitecture plan

**Sri Raghavendra Swamy Matha portal (`temple-portal`, v0.1.0)**
**Written 2026-09-19 (Saturday). Roadmap counted from Monday 2026-09-21.**
Sources: the 15 verified brain files under `.claude/skills/temple-portal-expert/brain/`, the 15 skeptic
reports under `.claude/state/verify/`, the file inventory under `.claude/state/inventory/`, and the code
itself. Every claim below carries a `path:line`, a count, or a command's output. Where a shipped document
and the code disagree, the code is treated as the truth and the disagreement is recorded as a finding.

---

## Executive summary

1. The portal is a Next.js 16.2.9 / React 19.2.4 App Router application — **818 source files, 158,773 lines**, of which **310 carry `"use client"`** and only 3 are `server-only`. It is documented as Next.js 14 in five places.
2. The deduplicated fault register below holds **351 rows** drawn from **589 verified module findings**: **85 HIGH, 164 MEDIUM, 102 LOW**. Fifteen rows were re-checked against the code while writing; a further 25 were re-checked by the reviewer and all 25 held at their evidence, but 21 were re-graded upward and one dropped HIGH was added — see `## Reviewer notes (2026-09-19)`.
3. The dominant class is security: **88 of 95 API route files perform no identity check** (`grep -rl verifyAdminUser app/api` → 5), there is no `middleware.ts`, and `firestore.rules:231-234` re-matches `/settings/{docId}` with `allow write: if true`, making every settings document world-writable.
4. A Firebase **service-account private key is committed in nine scripts** (`grep -rln "BEGIN PRIVATE KEY" scripts/`), and the production Web API key is hardcoded in four more places including a Postman collection served from `public/`.
5. The data layer is split-brained between Firestore and Supabase with no boundary: sevas are **read from Supabase and written to Firestore** (`services/seva.service.ts:11` vs `:76,:81,:86`); social links are edited in Firestore and read from Supabase; **25 collections the code uses have no rule block at all**.
6. Money and records are unreliable: every receipt is recorded as UPI (`services/receipt.service.ts:23`), invoice numbers never increment, the receipt report aggregates exactly one row, receipt delivery is a stub that returns `{success:true}`, and adhik-masa handling would place Sri Raghavendra Swamy's own Aaradhane 30 days early.
7. The documented architecture is largely aspirational. "Server Components First", "No Direct Firebase Calls", "No `any`", "hybrid retrieval with an LLM fallback" and a rate limiter, middleware and zod validation described in `docs/SECURITY.md` are all absent from the code.
8. For mobile, the good news is that the **types, the domain maths and the AI engine are already platform-neutral** — 5,444 lines of types, 3,748 lines of AI ranking/NLP and ~2,970 lines of other pure services move untouched. The bad news is that **most page data never passes through HTTP**: it is read from Firestore or Supabase inside components, so a second client has nothing to call. **20 endpoint families are missing.**
9. **Recommended path: Option B — keep Next.js for the web, add an Expo app, and share `packages/*` in a monorepo.** All four options are scored at one gate — the end of Phase 2, **2026-12-11** — because Phases 0–2 are required whatever is chosen (§4.1). Incremental from that gate: **B 70–118 person-weeks, C 22–42, D 104–160, A 114–180.** Option A loses the SEO the site exists for. Option C is genuinely the cheap answer — 48–76 person-weeks less than B, delivered by 2027-03-05 at worst (§7.5) — but it buys a WebView, leaves no `packages/*` behind, and costs **12–23 person-weeks more** than B alone if a native client ever follows; it wins only if the requirement is an icon and reminders and nothing native ever follows. Option D is the right idea with the wrong timing unless the redesign is approved as a component-library rebuild, which is decided at that same 2026-12-11 gate.
10. **Effort: 106–178 person-weeks**, seven phases, **165 working days (33 elapsed weeks) from 2026-09-21 to 2027-05-07** at a team of four — which is the *low* end of that range, not its middle; the mid-case finishes 2027-06-30 and the high end 2027-09-09 (§7.3). No mobile work should start before Phase 2 (API contract and server-side auth) is complete.

---

## 1. Current state — the architecture as built

### 1.1 The shape of it

```
                          BROWSER
  ┌────────────────────────────────────────────────────────────────────────┐
  │ app/layout.tsx (the one meaningful Server Component)                    │
  │   └── AuthProvider > ProfileProvider > AIChatProvider  (all "use client")│
  │        └── everything below <body> hydrates                             │
  │                                                                          │
  │  (public) 20 pages   (auth) 3 pages   /admin ~60 pages   /calendar /knowledge
  │      │                    │                  │                (outside the group)
  │      │                    │                  │                                  │
  │      ├─── 41 files import the CLIENT Firebase SDK directly ──────────────┐     │
  │      ├─── services/* imported straight into components ──────────────┐   │     │
  │      └─── fetch("/api/...") from client islands only                 │   │     │
  └───────────────────────────────────┬──────────────────────────────────┼───┼─────┘
                                      │                                  │   │
             ┌────────────────────────┴─────────────┐                    │   │
             │  app/api/** — 95 route handlers      │                    │   │
             │  5 call verifyAdminUser. 88 have no  │                    │   │
             │  identity check. 36 have no caller.  │                    │   │
             │  1 server action (app/actions/sevas) │                    │   │
             └───────┬──────────────────────┬───────┘                    │   │
                     │                      │                            │   │
        lib/admin-firebase (Admin SDK)   lib/firebase (CLIENT SDK,       │   │
        used by 6 routes                 used inside server handlers)    │   │
                     │                      │                            │   │
  ┌──────────────────┴──────────────────────┴────────────────────────────┴───┴────┐
  │  FIRESTORE (50+ collections, 38 rule blocks)   │  SUPABASE (events, sevas,     │
  │  rules are the only enforcement for the        │  site_settings, social_links, │
  │  browser-issued writes                         │  temple_areas, ai_* tables)   │
  └────────────────────────────────────────────────┴───────────────────────────────┘
        + Vercel Blob (uploads, broken)   + public/ filesystem (gallery, panchanga)
        + data/panchanga/** (730 JSON files, 3.1 MB, build-time only)
```

### 1.2 Where the boundaries leak

The folder coupling computed from `.claude/state/inventory/import-graph.json` (1,456 edges) reads like a
layered app at first glance — `app → components` 346, `app → services` 123, `services → types` 57 — and then
the leaks show up:

| Leak | Count | What it means |
|---|---:|---|
| `app → lib` | 96 | Pages reach past the service layer into `lib/`, which holds business data (`lib/sevas.ts:24-45` invents seva prices), Node-only code (`lib/gallery.ts:22` scans the filesystem) and a second auth implementation (`lib/auth.ts:20-133`). |
| `components → services` | 42 | Components fetch their own data; the "Server Component → Service → Firestore → HTML" flow at `docs/ARCHITECTURE.md:137` is not what runs. |
| `lib → components` | 3 | `lib/device/index.ts:90-136` re-exports eight client component modules with no `"use client"`, so importing one hook pulls every device widget into the bundle. |
| `components → app`, `services → app` | 1 each | `services/seva.service.ts:11` imports the server action `app/actions/sevas.ts`; a component reaches into `app/`. |
| `types → lib` | 5 | `types/` is not declarations-only: `types/guru.ts` holds 371 lines of biographies, `types/quote.ts` 494 lines of seed data, `types/festival.ts:149-164` returns Tailwind class names. |

The single biggest structural fact is that **41 files hold the client Firebase SDK outside `services/`**
(M10-F05: 35 pages/components/hooks plus 6 API routes; 47 files carry 85 direct `firebase/*` import lines).
Twelve of them are admin settings pages doing `doc/getDoc/setDoc` inline against `settings/*` singletons.
`AGENTS.md` forbids exactly this, and `docs/ARCHITECTURE.md:100` repeats the prohibition.

The SDK boundary also runs the wrong way in both directions. Client SDK code runs on the server —
`app/api/admin/users/create-admin/route.ts:62,81` drives the module-level client `auth` singleton with
`createUserWithEmailAndPassword` then `signOut`, which races across concurrent requests in a warm lambda
— while server-only code is reachable from the browser: `services/settings.service.ts:72,96` dynamically
imports the Supabase **service-role** client from a page that is `"use client"`, so saving Site Settings
can never succeed (M05-F02).

### 1.3 The two data stores and the state of the migration

There is no documented boundary between Firestore and Supabase, and the migration is frozen mid-move.
`docs/DATA-MODEL.md:20` still says "Firestore — Primary database for all application data" and does not
mention Supabase at all.

| Domain | Reads from | Writes to | State |
|---|---|---|---|
| Events | Supabase `events` | Supabase, keyed by a legacy `firestore_id` column (`services/event.service.ts:23,58,71,114,123`) | Migrated, with the old key frozen into every query |
| Sevas | Supabase via `getAllSevasAction` (`services/seva.service.ts:11`) | **Firestore** (`:76,:81,:86`) | **Split-brain — admin edits are invisible to readers** |
| Social links | Supabase `social_links` (`services/settings.service.ts:121`) | **Firestore `settings/socialLinks`** (`app/admin/settings/social-links/page.tsx:89`) | **Split-brain — no code writes the table** |
| Site settings | Supabase `site_settings` | Supabase service-role from the browser — throws | Broken |
| Temple areas | Supabase, two conflicting migrations create the table with different PK types | Supabase service-role, unauthenticated public route | Ambiguous schema |
| AI settings / analytics | Supabase `ai_*` tables **and** Firestore `settings/ai`, `ai_settings/main` | Both | Three parallel stores |
| Everything else (bookings, donations, receipts, bills, gallery, quotes, knowledge, profiles) | Firestore | Firestore, mostly from the browser | Not migrated |

Four Supabase migration files carry timestamps in the future relative to today (`20260920`, `20260930`,
`20261001`, `20261010`), so a migration authored on 2026-09-19 sorts *before* them.

### 1.4 The AI engine and its coupling

Raya AI is the largest single subsystem — M08 (19,651 lines) plus M09 (18,016). Its core is also the most
portable code in the repository: `lib/ai/generator.ts`, `lib/ai/intent/**` and `services/ml.service.ts` are
**3,748** lines of pure TypeScript with no DOM and no Next APIs (`lib/ai/intent/**` 2,104 + `lib/ai/generator.ts`
1,191 + `services/ml.service.ts` 453, counted 2026-09-19 — the brain files' "~2,600" undercounts it).

The coupling problems are all at the edges:

- **There is no LLM.** `grep -rn "usesLLM: true" lib app services` → 0. The only `provider.generateResponse`
  call site sits inside the `/* OLD FALLBACK CODE - DISABLED FOR SAFETY */` block at
  `app/api/chat/route.ts:232-286`. `AGENTS.md` and `docs/AI-GUIDELINES.md:41-52` both describe a hybrid
  retrieval chain ending in an LLM.
- **No stored prompt is read at runtime at all.** The Prompt Manager writes
  `ai_settings/main.prompt.currentPromptId`; the only `getSystemPrompt()` call is inside the disabled block.
  The live answer comes from `generateResponse(...)` at `:162` (M09-F01).
- **The admin console is decoration.** Prompt versions, intent metadata, confidence thresholds, response
  templates, temple/visitor information and policies are stored and never read by the generator; the one
  setting consumed is `aiBehavior.debugMode`, which leaks internal debug text into devotee-visible answers
  (M08-F15).
- **15 files issue `collection()`/`doc()` calls inline off `@/lib/firebase` — 11 of them under `lib/ai/**`
  and 4 AI services under `services/`** (M08-F16 cites both; the count is not lib/ai-only), using
  the *client* SDK inside server route handlers — so every AI read is subject to Firestore rules and the
  client quota rather than admin credentials (M08-F16).
- **No analytics are ever recorded.** `recordTokenUsage`, `recordLatency`, `recordIntentDistribution` and
  `recordUnknownQuestion` have zero callers (`services/ai-analytics.service.ts:97,123,159,193`), so every
  AI dashboard reads an empty collection and reports "healthy".
- Rate limiting and every cache in the engine are per-process in-memory `Map`s, which on Vercel means one
  bucket per warm lambda.

### 1.5 The HTTP surface

95 route handlers exist. They are grouped by folder, not by contract: `/api/admin/*` (24 files),
`/api/ai/*` (22, every one unauthenticated), and the rest. Six response envelopes coexist —
`{success,data}`, `{success,<noun>}`, bare arrays, bare objects, `{<noun>,total}`, and `{error}` vs
`{success:false,error}` (M12-F27). Pagination exists on exactly one family (receipts), and it uses
Firestore `.offset()`, which bills a read for every skipped document.

Most *page* data does not come through this layer at all. Public pages import `services/*` directly; the
routes are called only from `"use client"` islands. **36 of the 95 endpoints have no reference anywhere in
the repository** (`.claude/state/verify/_M12_callers.js`), and five more are referenced only by Playwright
specs. Meanwhile `app/admin/calendar/ekadashi/page.tsx:34,62,80` and
`app/admin/calendar/festivals/page.tsx:31,60,79` call `/api/calendar`, which does not exist — six call sites
against a 404 that `fetch` does not throw on, so the `catch` never runs and the UI reports success.

---
## 2. Fault register

### 2.1 How it was built

Every finding in the "Faults, smells and risks" table of all 15 brain files was collected — **589 findings**
after the skeptic pass had corrected, downgraded, refuted or added rows (the brain tables are the
post-verification versions; `.claude/state/verify/M*.md` records each verdict). Findings that share a root
cause across modules were merged into one register row that cites every source id, which is why, for
example, the hardcoded Firebase Web key appears once here and five times there.

Result: **351 register rows — 85 HIGH, 164 MEDIUM, 102 LOW.** Rows are grouped into the nine categories
below and ordered by severity within each group, **except where a reviewer re-grade has left a promoted row
below its band** — 22 rows were re-graded upward on 2026-09-19 and were not re-sorted; see the Reviewer
notes. Severity is the maximum of the merged sources, with three named exceptions — R-045, R-170 and R-203 —
where a module-local HIGH is carried at a lower grade because the merged row's impact is scale, bundle size
or staleness rather than correctness, money or access. Each exception is listed in the Reviewer notes.
"Blast radius" is reflected in the ordering within a severity band: repo-wide causes come before
single-screen ones.

Fifteen rows were independently re-checked against the code while writing this report — R-004, R-007,
R-016 (via `/debug`), R-059, R-060, R-063, R-076, R-201, R-062, R-002, R-011, R-180, R-182, R-068, R-311.
**All fifteen held**, including the subtle ones: `Number(null) === 0` does pass `Number.isInteger`, so the
receipt report's `pageSize` really does clamp to 1 (`app/api/admin/receipts/route.ts:36`); and
`data/panchanga/2027/2027-12-31.json` really is the last file, leaving **468 days** of runway from today.

### 2.2 Category counts

| Category | HIGH | MEDIUM | LOW | Rows |
|---|---:|---:|---:|---:|
| A. Security | 22 | 16 | 10 | 48 |
| B. Data integrity | 40 | 41 | 29 | 110 |
| C. Architecture violation | 9 | 23 | 11 | 43 |
| D. Duplication and dead code | 2 | 16 | 14 | 32 |
| E. Performance | 2 | 16 | 8 | 26 |
| F. Reliability and error handling | 1 | 13 | 13 | 27 |
| G. Accessibility and UX | 0 | 18 | 7 | 25 |
| H. Tooling and CI | 7 | 10 | 5 | 22 |
| I. Documentation drift | 2 | 11 | 5 | 18 |
| **Total** | **85** | **164** | **102** | **351** |

### 2.3 A — Security (48 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-001 | HIGH | Production Firebase Web config (apiKey, projectId, appId, senderId, measurementId) hardcoded as `\|\|` fallbacks in four places and committed in a Postman collection; the app silently runs against the live project when env is missing | `lib/firebase.ts:57-65`; `proxy.ts:8-13`; `app/api/seed-ai-settings/route.ts:63,74`; `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json` `variable[].firebaseApiKey` | M01-F01, M08-F03, M10-F01, M12-F04, M15-F07 |
| R-002 | HIGH | A Firebase **service-account private key** is committed in nine scripts together with `project_id`, `private_key_id` and `client_email` — full admin access to `sri-raghavendra-mutt` for anyone with the repo | `grep -rln "BEGIN PRIVATE KEY" scripts/` → `check-about-us.ts:5-32`, `check-trust-committee.ts:5-32`, `seed-poojas.{ts:36-63,js:89}`, `seed-sevas.{ts:36-63,js:89}`, `seed-trust-committee.ts:171-198`, `update-finance-settings.{ts:5,js:48}` | M11-F02 |
| R-003 | HIGH | Admin SDK accepts `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY` and falls back to the literal `"invalid-key"` / `"demo-project"`, so `clientEmail && privateKey` passes with no real key and a `NEXT_PUBLIC_` private key would be bundled to the browser | `lib/admin-firebase.ts:56,58,64` | M01-F02, M10-F30 |
| R-004 | HIGH | `firestore.rules` matches `/settings/{docId}` twice; the second block is `allow write: if true`. Firestore ORs allow-rules, so every settings document — About Us, Trust Committee, footer, finance, AI config — is world-writable | `firestore.rules:136-139` and `:231-234` | M04-F01, M11-F03 |
| R-005 | HIGH | `ai_settings` is world-readable **and** world-writable — anyone on the internet can rewrite the AI system prompt | `firestore.rules:226-229` | M04-F02 |
| R-006 | HIGH | `storage.rules` allows unauthenticated writes to `testimonials/**` with no size or content-type limit, and lets any signed-in user read and write **any** object in the bucket | `storage.rules:5-8`, `:11-14` | M04-F03, M11-F06 |
| R-007 | HIGH | `POST /api/admin/users/create-admin` has no authentication and writes `role:"super_admin"`; the write succeeds under the checked-in rules because the route is signed in as the user it just created. It is published with a production cURL and a Postman collection served from the web root | `app/api/admin/users/create-admin/route.ts:7-79`; `firestore.rules:39`; `docs/API.md:171`; `public/postman_collection.json:986`; `vercel.json:1-22` (no exclusions) | M04-F04, M04-F19, M04-F38, M12-F01 |
| R-008 | HIGH | `POST /api/admin/users/set-role` has no authentication and accepts any email and any role including `super_admin`. Latent rather than live only because it uses the client SDK, which the rules deny — any loosening of the `users` rules makes it an instant escalation path | `app/api/admin/users/set-role/route.ts:6-88`; `firestore.rules:36,40` | M04-F05, M12-F02 |
| R-009 | HIGH | `/api/seed-ai-settings`'s auth helper can never fail — it returns an admin identity unconditionally in production and `{uid:"dev-admin"}` otherwise, so the 401 is unreachable. It overwrites eight settings documents, and the `GET` performs writes | `app/api/seed-ai-settings/route.ts:117-140`, `:539-543`, `:547-610`, `:637-644` | M08-F02, M08-F20, M12-F03 |
| R-010 | HIGH | Admin authorization is entirely client-side: there is no `middleware.ts` anywhere, and `app/admin/layout.tsx` relies on a `"use client"` guard, so all admin markup and JS are served to anonymous visitors | `app/admin/layout.tsx:22-31`; `components/admin/layout/AdminAuthGuard.tsx:1`; `find . -maxdepth 3 -name middleware.ts` → nothing | M04-F08 |
| R-011 | HIGH | **88 of 95 route files perform no identity check.** Only five call `verifyAdminUser`; every `/api/ai/*` route and `/api/chat` is open; all `/api/admin/knowledge*` handlers write through the REST Admin SDK explicitly "bypassing security rules"; all 14 `/api/knowledge/workflow/**` handlers take the actor from the request body; `/api/admin/prompts`' gate is a no-op outside production | `grep -rl verifyAdminUser app/api` → 5; `app/api/ai/settings/route.ts:23-25` (`TODO: Add proper admin authentication`); `app/api/admin/knowledge/route.ts:89-112`; `app/api/knowledge/workflow/articles/[id]/route.ts:69-79`; `app/api/admin/prompts/route.ts:11-19` | M12-F05, M08-F01, M09-F03, M09-F04, M09-F13, M12-F16 |
| R-012 | HIGH | Unauthenticated writes to core business data: events, announcements, donations, bookings, temple areas (both the public and the admin twin), aaradhane, quotes, `quotes/seed`, `quotes/bulk` and `ai/knowledge/import`. The temple-areas writes run on the Supabase **service-role** client | `app/api/events/[id]/route.ts:21,37`; `app/api/temple-areas/route.ts:14-31`; `app/api/temple-areas/[id]/route.ts:23,39`; `app/api/admin/aaradhane/[id]/route.ts:40,67`; `app/api/admin/quotes/seed/route.ts:10`; `app/api/ai/knowledge/import/route.ts:50,116`; `services/temple-areas.supabase.service.ts:98,129,159` | M12-F06, M12-F08, M06-F03, M10-F42, M03-F03 |
| R-013 | HIGH | `GET /api/public/receipts` is unauthenticated and substring-matches phone/email across the newest 1000 bookings, returning up to 20 full records — names, emails, phone numbers, payment references. A two-character query enumerates devotee contact details | `app/api/public/receipts/route.ts:6,20,28,45-64`; called from `app/(public)/receipts/page.tsx:53` | M03-F02, M07-F07, M12-F09 |
| R-014 | HIGH | `GET /api/volunteer` returns every volunteer request — names, phone numbers, e-mail addresses — with no authentication. `GET /api/bookings` and `GET /api/donations` are the same shape (inert today only because their services are client-SDK) | `app/api/volunteer/route.ts:58-68`; `app/api/bookings/route.ts:4`; `app/api/donations/route.ts:4`; `services/sevaBooking.service.ts:40-50` | M02-F05, M12-F10, M07-F42 |
| R-015 | HIGH | `DELETE /api/gallery/local-assets` unlinks files from `public/` with no auth (a path-prefix check only), is called by a live admin component, and its cURL is published | `app/api/gallery/local-assets/route.ts:38-57`; caller `components/admin/gallery/LocalGalleryAssets.tsx:47`; `docs/API.md:135` | M06-F04, M12-F07 |
| R-016 | HIGH | `/debug` is a live, unauthenticated route outside `/admin` that renders `NEXT_PUBLIC_FIREBASE_API_KEY` and `OPENAI_API_KEY.substring(0,20)`. It is a `"use client"` page with no `dynamic` export, so Next still prerenders it server-side, where `process.env.OPENAI_API_KEY` is the real value and lands in the HTML payload. `/admin/test` and `/admin/test-firebase` are the same class | `app/debug/page.tsx:4-5,26,33`; `app/admin/test/page.tsx:15`; `app/admin/test-firebase/page.tsx:30`; `components/debug/ClientEnvDebug.tsx:4-18` | M01-F31, M05-F07 |
| R-017 | HIGH | Three report/dashboard routes have no authentication or rate limiting; `POST /api/reports/save` accepts an arbitrary base64 body and writes it to Vercel Blob | `app/api/reports/save/route.ts:27`; `app/api/reports/list/route.ts:11`; `app/api/dashboard/daily-spiritual/route.ts:7` | M05-F08 |
| R-018 | MEDIUM | `create-admin` drives the module-level **client** Firebase Auth singleton from a server route (`createUserWithEmailAndPassword` then `signOut`); in a warm serverless instance that object is shared by concurrent requests, so one caller's sign-in races another's and the `setDoc` runs as whoever is signed in at that moment | `app/api/admin/users/create-admin/route.ts:62,65,81`; `lib/firebase.ts:70,88` | M04-F37 |
| R-019 | MEDIUM | The client Firebase SDK is used inside server handlers generally, so writes are subject to client security rules and share process-global auth state | `app/api/admin/users/set-role/route.ts:3`; `app/api/public/stats/route.ts:6`; `app/api/ai/knowledge/coverage/route.ts:2`; `app/api/ai/knowledge/import/route.ts:2` | M12-F18, M08-F16 |
| R-020 | MEDIUM | Audit identity is taken from unauthenticated request headers: `x-user-id` in 11 route files, `x-user-email` in 2. Every "who changed this" record is forgeable | `grep -rl x-user-id app/api` → 11; `app/api/ai/settings/route.ts:25`; `app/api/admin/prompts/route.ts:108`; `app/api/admin/aaradhane/route.ts:33`; `app/api/admin/quotes/route.ts:46` | M12-F17 |
| R-021 | HIGH | `AdminAuthGuard` collapses every `requiredPermission` value to `canAccessAdmin`, the exported `withPermission` HOC ignores its argument entirely, and sidebar permission filtering is a no-op except for one group — so a priest or office-staff account reaches `/admin/users`, Billing and the Receipt Book | `components/admin/layout/AdminAuthGuard.tsx:129-148`, `:156-163`; `components/admin/layout/AdminSidebar.tsx:107-126` (`const filteredItems = section.items;` at `:110`) | M04-F09, M04-F10, M05-F10, M05-F11, M07-F06 |
| R-022 | MEDIUM | `checkAdminAuth` returns a fake admin whenever `NODE_ENV === "development"` and otherwise accepts **any** bearer token longer than 10 characters. Dead today (zero importers outside the barrel), and the barrel exports only this unsafe verifier, so the safe one is the harder import to find | `lib/auth/admin.ts:29-31`, `:48-50`; `lib/auth/index.ts:2` | M04-F06, M04-F12 |
| R-023 | MEDIUM | `verifyAdminUser` uses a blocklist (`devotee`, `volunteer`) rather than an allowlist, so a user whose role is empty, misspelled or newly invented passes as an admin on every receipt route | `lib/auth/admin-auth.ts:18,60-64` | M07-F37 |
| R-024 | MEDIUM | Open redirect after login: the `redirect` query parameter goes straight to `window.location.href` with no same-origin check | `components/auth/LoginForm.tsx:61-64` | M04-F18 |
| R-025 | MEDIUM | Rate limiting is a per-process in-memory `Map`, applied to 2 of 95 routes, and `/api/chat` reimplements the same thing separately. On Vercel each warm lambda has its own bucket, so the limiter does not limit | `lib/rate-limit.ts:11,28-30` (2 importers); `app/api/chat/route.ts:29-51` | M01-F25, M04-F21, M12-F12 |
| R-026 | HIGH | No request-body validation anywhere: `grep -rn zod app/api` → 0. `/api/chat` accepts an unbounded `messages` array and an arbitrary `detectedLanguage` with no length cap, echoes content into logs and writes it verbatim into Firestore | `app/api/chat/route.ts:100-121`, `:242-253`; `services/conversation.service.ts:137-151` | M08-F21, M10-F11, M12-F13 |
| R-027 | MEDIUM | `POST /api/revalidate` purges arbitrary paths with no auth and no allow-list — a trivial cache-thrash DoS | `app/api/revalidate/route.ts:10,26-30` | M12-F11 |
| R-028 | MEDIUM | Bulk quote operations loop one Firestore write per id with no transaction and no cap on the array — an unauthenticated write amplifier | `app/api/admin/quotes/route.ts:88-95,125-132` | M12-F28 |
| R-029 | HIGH | Browser-issued writes with no server-side validation: testimonials (name, location, quote **and phone**), donations (four truthiness checks), seva bookings, gallery albums and media (empty title, slug and image path all persist) | `services/testimonial.service.ts:287,246`; `components/home/DonationForm.tsx:83-93`; `services/donation.service.ts:37`; `components/admin/gallery/AlbumDialog.tsx:74-85`, `MediaDialog.tsx:115-136` | M02-F06, M03-F10, M06-F19, M10-F11 |
| R-030 | HIGH | **Payment status is set by the browser.** `updatePayment` writes `paymentStatus:"completed"` and `status:"confirmed"` from client code on a user-typed reference; nothing verifies the transaction | `services/sevaBooking.service.ts:81-84`; called from `components/home/SevaBooking.tsx:190` | M03-F01 |
| R-031 | MEDIUM | The `donations` create rule requires only authentication, with no `userId == auth.uid` check, unlike `sevaBookings`; and `DonationRecord` has no `userId` at all, so the owner-read clause can only ever deny | `firestore.rules:119-123` vs `:113-117`; `firestore.rules:120`; `types/donation.ts:13-42`; `services/donation.service.ts:39` | M04-F23, M07-F25 |
| R-032 | MEDIUM | The Raya AI operations console is a **public page**: `/ai/analytics` sits in the public route group with no guard and polls the unauthenticated `/api/ai/analytics` every 60 s, publishing conversation volume, unique users, latency, error rate and token usage to anonymous visitors | `app/(public)/ai/analytics/page.tsx:1,294,337,353`; `app/(public)/layout.tsx:4-17` | M03-F32, M12-F43 |
| R-033 | HIGH | Two conflicting CSPs and header sets are emitted — a broad one from `next.config.ts` and an older narrower one from the proxy — and both allow `'unsafe-inline' 'unsafe-eval'` for scripts | `next.config.ts:33-34`; `proxy.ts:38` | M01-F08 |
| R-034 | MEDIUM | Article HTML is built from Firestore content and injected with `dangerouslySetInnerHTML` with no sanitiser — stored XSS if an admin account or the collection is compromised | `components/knowledge/KnowledgeArticleClient.tsx:267,339-365` | M03-F07 |
| R-035 | MEDIUM | `MarkdownRenderer` escapes `<`/`>` and then interpolates an unvalidated URL into `href`, so a `javascript:` URL in model output becomes a live link | `components/ai/MarkdownRenderer.tsx:15,46,54` | M09-F16 |
| R-036 | MEDIUM | `highlightKeywords` interpolates user input into a `RegExp` with no escaping and returns an HTML string — regex injection / ReDoS, and XSS if ever fed to `dangerouslySetInnerHTML` | `services/search.service.ts:389-391` | M02-F16 |
| R-037 | MEDIUM | Default test credentials for three roles, including passwords, are committed | `tests/e2e/sprint3/sprint3-test-utils.ts:5-18` | M15-F19 |
| R-038 | LOW | `/api/supabase-check` is an unauthenticated environment probe reporting which Supabase variables are configured, including whether a service-role key is present | `app/api/supabase-check/route.ts:5-19,41-46` | M04-F34, M11-F16, M12-F33 |
| R-039 | LOW | Internal error text leaked to clients via `details: error.message` / `String(error)` | `app/api/quotes/route.ts:45`; `app/api/revalidate/route.ts:40`; `app/api/storage/videos/route.ts:26` | M12-F29 |
| R-040 | LOW | PII in logs and stores: `/api/chat` logs the caller IP and the first 50 characters of every message, the intent detector logs the whole untruncated message plus five more lines per request, the unknown-question logger stores `ip` and `userAgent`, and the admin users page `console.log`s the entire users collection | `app/api/chat/route.ts:77,121`; `lib/ai/intent/detector.ts:213,217,230,234,238,242`; `lib/ai/unknown-logger.ts:24-28`; `app/admin/users/page.tsx:25-26` | M08-F22, M12-F30, M04-F25 |
| R-041 | LOW | `/api/temple-areas/*` is a near-verbatim copy of `/api/admin/temple-areas/*` with a different envelope; every write method in the service is service-role only, with no RLS-respecting twin | `app/api/temple-areas/route.ts:1-32` vs `app/api/admin/temple-areas/route.ts:1-34`; `services/temple-areas.supabase.service.ts:98,129,159` | M06-F13, M10-F31 |
| R-042 | LOW | A 34 KB Postman collection describing the unauthenticated admin-creation endpoints is served from the web root | `public/postman_collection.json:986,1008` | M13-F30 |
| R-043 | LOW | Email verification and approval are collected and never enforced: `isApproved:false` is written at registration and no code path reads it; `emailVerified` is stored and every guard ignores it | `services/auth.service.ts:65,110`; `grep -rn isApproved` finds only writers | M04-F24 |
| R-044 | LOW | `scripts/setup-admin.ts` guards on `'your-firebase-auth-uid'` while the shipped placeholder is `'YOUR_UID_FROM_FIREBASE'`, so the guard never fires and an unedited `npm run setup-admin` writes `users/YOUR_UID_FROM_FIREBASE` with `role:'super_admin'` | `scripts/setup-admin.ts:34` vs `:43`; `package.json:15` | M04-F40, M11-F14 |
| R-045 | MEDIUM | `REPORT.md` is a checked-in, undated record of deliberately deleting authentication from the receipts API and UI. The code has since been restored, so the file now reads as a live instruction to a future agent | `REPORT.md:1-19` vs `app/api/admin/receipts/route.ts:2,21,149` | M15-F08 |
| R-046 | LOW | `/display` is a public unauthenticated kiosk page that reloads the whole document every five minutes and is world-readable | `app/(public)/display/page.tsx:46,181-188` | M03-F17 |
| R-047 | LOW | `.env.example` omits every server-side credential the code reads (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`, `ADMIN_API_KEY`), so a fresh clone fails silently rather than loudly | `.env.example:1-57` vs `lib/admin-firebase.ts:55-64`, `lib/auth/admin.ts:42` | M04-F30 |
| R-048 | LOW | `/qr` builds a print document with `document.write` of an unescaped template string containing `data.title`/`data.description` — safe today because both are local constants, a stored-XSS sink the moment they come from Firestore | `app/(public)/qr/page.tsx:38-75` | M03-F29, M13-F21 |

### 2.4 B — Data integrity (110 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-049 | HIGH | **Sevas are read from Supabase and written to Firestore.** Every admin create/update/delete is invisible to the public site until a migration script is re-run by hand | `services/seva.service.ts:11` (read via `getAllSevasAction`) vs `:76,:81,:86` (`addDoc`/`updateDoc`/`deleteDoc`) | M03-F25, M10-F02, M11-F01 |
| R-050 | HIGH | **Social links are a second split-brain domain.** The admin editor saves the Firestore document `settings/socialLinks`; every consumer reads the Supabase `social_links` table, which no code path writes | `app/admin/settings/social-links/page.tsx:32-33,89` vs `services/settings.service.ts:121`, consumed by `components/home/SocialBar.tsx:12`, `components/layout/Navbar.tsx:8`, `app/(public)/display/page.tsx:19` | M05-F03, M11-F30 |
| R-051 | HIGH | Five settings documents have no reader anywhere — `guruParampara`, `shlokas`, `poojaSchedule`, `ekadashiCalendar`, `festivalCalendar`. Staff can spend an afternoon editing content that never appears, while the public calendar imports a compiled constant | writes at `app/admin/settings/{guru-parampara:197, shlokas:84, puja-schedule:111, ekadashi-calendar:89, festival-calendar:82}/page.tsx`; readers `app/calendar/page.tsx:3`, `lib/festival-utils.ts:7`; `grep -rn "festivalCalendar\|ekadashiCalendar"` → 2 writers, 0 readers | M05-F04, M14-F01 |
| R-052 | HIGH | Saving Site Settings can never succeed: the `"use client"` page calls a service that dynamically imports the Supabase **service-role** admin client, which throws in the browser | `app/admin/settings/page.tsx:69-71` → `services/settings.service.ts:72,96` → `lib/supabase/admin.ts:4` | M05-F02, M10-F04 |
| R-053 | HIGH | The admin Ekadashi and Festival editors POST/PUT to `/api/calendar`, which does not exist. `fetch` resolves 404 rather than throwing, so the `catch` never runs, the UI reports success and the edit is lost on reload — six call sites across two screens | `app/admin/calendar/ekadashi/page.tsx:34,62,80`; `app/admin/calendar/festivals/page.tsx:31,60,79`; `ls app/api` lists 23 directories, none named `calendar` | M03-F33, M07-F04, M12-F19 |
| R-054 | HIGH | Two further admin calendar pages edit React state only — add, edit or delete a festival and it is gone on reload; no Firestore call at all | `app/admin/calendar/festivals/page.tsx:9-16`; `app/admin/calendar/ekadashi/page.tsx` (no `setDoc`/`getDoc`) | M14-F02 |
| R-055 | HIGH | Three "management" screens persist nothing: `/admin/library` and `/admin/stotras` are hardcoded arrays whose Add/Edit/Delete buttons have no handlers; `/admin/shlokas` mutates state seeded from a static file | `app/admin/library/page.tsx:29,87,117,217-222`; `app/admin/stotras/page.tsx:28,76,181-186`; `app/admin/shlokas/page.tsx:20,57,83,104` | M06-F07 |
| R-056 | HIGH | Media upload cannot work in production: `@vercel/blob` `put`/`del`/`list` are called from four `"use client"` components with a server-only token, and there is no upload route anywhere in `app/api`. The Videos panel is permanently empty with the failure swallowed by `.catch(() => [])` | `services/storage.service.ts:6,69,173,181`; `components/ui/ImageUploader.tsx:67`, `VideoUploader.tsx:61`; `components/admin/gallery/GalleryDashboard.tsx:52`, `VideosManager.tsx:37`; `.env.example:20` | M02-F04, M06-F01, M06-F02, M10-F03 |
| R-057 | HIGH | Event dates are wrong in both directions: `EventForm` builds Firestore `Timestamp` objects and hands them to a Supabase-backed service; the read path assigns raw ISO strings into `Timestamp`-typed fields; and the detail page calls `.toDate()` on that string, so **every event detail page crashes** | `components/admin/events/EventForm.tsx:59-68,154,170`; `services/event.service.ts:26-27,77-78`; `types/event.ts:18-19`; `app/(public)/events/[id]/page.tsx:63` | M02-F02, M06-F06 |
| R-058 | HIGH | The Supabase `events` table is addressed through a legacy `firestore_id` column, never its own id; `addEvent` mints one with `crypto.randomUUID()` and `TempleEvent.id` is mapped back out of it | `services/event.service.ts:23,58,71,114,123` | M06-F30 |
| R-059 | HIGH | Dashboard donation revenue, average and donor count are permanently zero: the query filters `status == "completed"` while `DonationStatus` is `pending \| received \| failed` | `app/admin/page.tsx:172` vs `types/donation.ts:1-4` (`services/report.service.ts:14` uses the right value) | M05-F01 |
| R-060 | HIGH | **The receipt report aggregates exactly one receipt.** `getReceiptReport` sends no `pageSize`; `Number(null) === 0` passes `Number.isInteger`, so the `: 50` default never fires and the clamp yields 1. Every collection total on the admin Reports page is wrong, silently | `services/receipt.service.ts:88-95`; `app/api/admin/receipts/route.ts:31,36,58-61,67-132` | M07-F41 |
| R-061 | HIGH | Invoice numbers never increment: `createBill` formats `prefix + settings.billing.invoiceNumber` and nothing writes the counter back, so every invoice carries the same number until a human edits Billing Settings | `services/billing.service.ts:141-160`; `app/admin/billing/create/page.tsx:127-130`; `app/admin/billing/settings/page.tsx:180-185` | M07-F02, M10-F07 |
| R-062 | HIGH | Every receipt is recorded as UPI — the payment-mode ternary has the identical value on both branches, silently rewriting any future mode | `services/receipt.service.ts:23` (`data.paymentMode === "upi" ? "upi" : "upi"`) | M07-F34, M10-F08 |
| R-063 | HIGH | Receipt detail and print pages read `params.id` while the route segment is `[receiptId]`, so the loader returns before its `finally` and both pages hang on a spinner forever. Every issued receipt is unviewable, unprintable and undownloadable from the UI | `app/admin/receipts/[receiptId]/page.tsx:32,35`; `.../print/page.tsx:33,36` | M07-F01 |
| R-064 | HIGH | "Send receipt" is a two-line stub returning `{success:true}` while the fully written nodemailer and WhatsApp senders have zero importers; `emailDelivery`/`whatsappDelivery` are never written | `app/api/admin/receipts/[id]/send/route.ts` (whole file); `lib/services/email.ts:1-10`; `lib/services/whatsapp.ts:1-8`; `types/receipt.ts:26-27` | M07-F08, M10-F09, M14-F05, M12-F21 |
| R-065 | HIGH | The receipt PDF silently mangles Kannada and Devanagari: only `StandardFonts.Helvetica` is embedded and `toAscii` replaces every non-Latin character with a space, so devotee names, seva names and notes in Kannada print blank | `lib/receipt/pdf.ts:37-40,185-186`; `lib/receipt/upi.ts:31-34` | M14-F04 |
| R-066 | HIGH | The receipt logo is embedded into a throwaway `PDFDocument` and then drawn on a different one — pdf-lib images are document-scoped. The path is always taken, because the third logo candidate exists on disk | `lib/receipt/pdf.ts:203-208,221-225` drawn at `:76` | M14-F07 |
| R-067 | HIGH | Adhik (leap) masa is parsed (`is_adhik`) and never read when matching, and the match takes `slice(0,1)` — the earliest date, which in an adhik year is the leap month. Replaying the match over the committed 2026 data puts **Sri Raghavendra Swamy's own Aaradhane on 2026-05-26 instead of 2026-06-25, thirty days early** | `lib/aaradhane/panchanga.ts:36,115-183,182`; `data/aaradhane/gurus.ts:331-333`; 30 adhik Jyeṣṭha days in `data/panchanga/2026` | M14-F32 |
| R-068 | HIGH | Panchanga data ends `2027-12-31` — **468 days of runway as of 2026-09-19**. From 2028-01-01 the Aaradhane generator throws `Panchanga data not found` and no Aaradhane events can be produced | `data/panchanga/2027/2027-12-31.json` is the last file; `lib/aaradhane/panchanga.ts:68-71` | M14-F03 |
| R-069 | HIGH | The Aaradhane workflow never writes Firestore on the first run for a new year: the live-update step is gated on a `check_panchanga` output evaluated *before* the generate step | `.github/workflows/aaradhane.yml:84-85` vs `:238`, `:244` | M14-F06 |
| R-070 | HIGH | **25 collections the code uses have no `match` block in `firestore.rules`**, so every client-SDK read and write on them is denied by default — including `profiles`, `bookmarks`, `dailyPoojas`, `poojas`, `chatTraining`, `featuredContent` and the seven `knowledge_*` workflow collections. The devotee profile read fails and the error is swallowed | `firestore.rules:34-277` (38 blocks); `services/profile.service.ts:30-31`; `context/ProfileContext.tsx:111-115`; `services/knowledge-workflow.service.ts:46-54`; `app/admin/ai/training/page.tsx:114` | M11-F05, M04-F07, M09-F05, M09-F08 |
| R-071 | HIGH | Application code reads Supabase tables whose only RLS policy is `FOR ALL TO public USING (false)` using the anon browser client. Those reads return zero rows in production and the services swallow the error and return `[]` | `services/event.service.ts:2,46` + `supabase/migrations/20260907112632_create_core_tables.sql:98-102`; `services/ai-analytics.service.ts:134,170` + `20260930000000_create_ai_tables.sql:95-96`; `lib/ai/ai-settings/repository.ts:391,94` | M11-F04 |
| R-072 | HIGH | Two conflicting `temple_areas` migrations create the same table with different primary-key types (`uuid` vs `text`) and different columns. Both use `IF NOT EXISTS`, so the deployed schema depends on which ran first and nothing in the repo records the answer | `supabase/migrations/20240523000000_create_temple_areas.sql:1-16` vs `20240915_create_temple_areas.sql:1-18`; `scripts/seed-temple-areas-supabase.ts:48` writes a text id | M11-F07 |
| R-073 | HIGH | **No AI analytics are ever recorded.** `recordTokenUsage`, `recordLatency`, `recordIntentDistribution` and `recordUnknownQuestion` have zero callers, so every `/api/ai/analytics*` route, the health check and every admin chart read permanently empty collections and report "healthy" | `services/ai-analytics.service.ts:97,123,159,193` — repo-wide grep finds only the definitions | M08-F07 |
| R-074 | HIGH | Unknown questions are scattered across three stores with two schemas; nothing the chat writes reaches either admin screen until somebody re-runs a migration script by hand, so the triage list is a manual snapshot | writers `services/analytics.service.ts:31` (`processed:false`) and `lib/ai/unknown-logger.ts:55` (`reviewed:false`); readers `app/api/ai/analytics/unknown-questions/route.ts:17` and `app/api/ai/settings/unknown-questions/route.ts:19` → `lib/ai/ai-settings/repository.ts:453`; copier `scripts/migrate-ai-to-supabase.ts:220` | M08-F08, M11-F08 |
| R-075 | HIGH | Publishing a prompt version has no effect on the live chat, and neither does editing `settings/ai.systemPrompt`: **no stored system prompt is read at runtime at all**, because the only `getSystemPrompt()` call site is inside the disabled block. Two parallel AI settings stores plus a third set of write-only documents never reconcile | `app/api/chat/route.ts:162,232,250,286`; `lib/ai/settings.ts:39,68,96`; `lib/ai/ai-settings/repository.ts:42-44,62`; `app/api/seed-ai-settings/route.ts:547,558,577,582,587` | M09-F01, M08-F14, M08-F15 |
| R-076 | HIGH | The documented "hybrid retrieval (Firebase + LLM fallback)" does not exist — no code path calls an LLM. The sole `provider.generateResponse` call site is inside a comment block and `grep -rn "usesLLM: true"` returns 0 | `app/api/chat/route.ts:215-231,232-286`; `lib/ai/generator.ts` handlers; `AGENTS.md` Tech Stack; `docs/AI-GUIDELINES.md:41-52` | M08-F04 |
| R-077 | HIGH | `Intent.DRESS_CODE` and `Intent.VISITOR_GUIDELINES` share the `case` label of `Intent.TEMPLE_TIMINGS` and are answered by `handleTempleTimings(language)`. A devotee asking "what should I wear to the temple?" is told when the temple opens. Both intents have their own patterns and examples, so they fire regularly | `lib/ai/generator.ts:1087-1090`, handler signature at `:95-97`; `lib/ai/intent/patterns.ts:409,425`; `lib/ai/intent/detector.ts:127,130` | M08-F30 |
| R-078 | HIGH | Follow-up detection is fed the wrong text — `getSessionContext` matches the **assistant's** previous reply against the follow-up patterns — and the computed `enrichedMessage` is destructured at the route and never used | `services/conversation.service.ts:327-329`; `app/api/chat/route.ts:143` | M08-F06 |
| R-351 | HIGH | **The public `/quotes` page ignores the entire quote engine.** It renders five hardcoded quotes from a literal `SAMPLE_QUOTES` array and never references `quoteService` (0 occurrences in the file), while a 1,039-line engine, 10 public `/api/quotes*` route files and a full admin CRUD screen sit unread; the "AI Explanation" button is a 1,500 ms `setTimeout` that produces nothing | `app/(public)/quotes/page.tsx:29,76,126-131` (`grep -c quoteService` -> 0) vs `services/quote.service.ts` (1,039 lines, `:494,:670`); `find app/api/quotes -name route.ts` -> 10 | M03-F05 |
| R-079 | MEDIUM | The chat response returns a session id that is not the one written to Firestore, so turn 1 is orphaned in a `chat_sessions` document nothing will read again and one such document leaks per new chat. It self-heals from turn 2 | `app/api/chat/route.ts:130,138,158,183,306`; `services/conversation.service.ts:157-171`; `components/ai/AIChatProvider.tsx:180-183` | M08-F05 |
| R-080 | MEDIUM | Two seeders write two different collections for the same data — the CLI writes Firestore `articles`, the HTTP importer writes `knowledge`, and only `knowledge` is read. `npm run seed:ai` appears to succeed and changes nothing | `scripts/seed-ai-knowledge.ts:65,143` vs `app/api/ai/knowledge/import/route.ts:73,114`; reader `lib/ai/knowledge/repository.ts:27,93` | M08-F13, M11-F09 |
| R-081 | MEDIUM | `seed/ai/faq.json` carries a `questions` array instead of `content`, so after import its article has `content: ""` and can never be matched by `searchArticles` | `seed/ai/faq.json` keys vs the other 14 seed files; `lib/ai/knowledge/repository.ts:66,194-200` | M08-F12 |
| R-082 | MEDIUM | Aaradhane data is read and deleted across two or three collection names (`aaradhane`, `aaradhanes`, `events`) chosen by fallback, and the delete fallback is unreachable because Firestore `deleteDoc` resolves on a missing document — so a record living only in `aaradhanes` is never deleted while the UI says "deleted successfully" | `services/aaradhane.service.ts:16-18,164,175,244-273`; `components/admin/aaradhane/AaradhaneTable.tsx:52-54`; `firestore.rules:125,130` | M03-F30, M07-F15, M07-F43, M10-F16, M14-F28 |
| R-083 | MEDIUM | `billingService.addPayment` is a read-modify-write with no transaction: two concurrent payments lose one and the bill's money disagrees with its receipts | `services/billing.service.ts:232-265` (`getBill` at `:237`, `updateDoc` at `:258`) | M07-F44, M10-F07 |
| R-084 | MEDIUM | Counter and array fields are incremented by read-then-write instead of `increment()`/`arrayUnion` — lost updates on `messageCount`, `favorites` and `recentlyViewed` | `services/chat.service.ts:104-110`; `services/profile.service.ts:264-277,303-322` | M10-F21 |
| R-085 | MEDIUM | Reordering poojas and aaradhanes issues two independent `updateDoc` calls with no transaction; a failure between them leaves two rows with the same `displayOrder` | `components/admin/pooja/PoojaTable.tsx:70-77`; `components/admin/aaradhane/AaradhaneTable.tsx:74-81` | M07-F16 |
| R-086 | MEDIUM | Money is plain JavaScript `number` throughout (`sevaAmount`, `rate`, `subtotal`, `totalAmount`, `balanceDue`); `Math.max(0, newBalanceDue)` hides a negative residue instead of flagging an overpayment | `types/billing.ts:42-47`; `types/receipt.ts:19-20`; `lib/receipt/validation.ts:6-16`; `services/billing.service.ts:245-261` | M07-F27 |
| R-087 | MEDIUM | `lib/firebase-admin-rest.ts` serialises every JavaScript number as `integerValue`, so decimal amounts are corrupted or rejected; documents are fetched at a fixed `pageSize=100` with no cursor | `lib/firebase-admin-rest.ts:93,121-122,130` | M10-F33 |
| R-088 | MEDIUM | The receipt "to" date filter calls `toDate.setHours(23,59,999)` — 999 **seconds** — pushing the upper bound roughly fifteen minutes into the next day, and the `NaN` check runs after the mutation | `app/api/admin/receipts/route.ts:48-52` | M07-F18, M12-F26 |
| R-089 | MEDIUM | The receipt PDF picks its temple header from whichever document in the whole `settings` collection was updated last — and then never draws it: `options.temple` is merged but used only for the PDF metadata title, while the visible header draws two string literals and the footer reads `DEFAULT_TEMPLE` | `app/api/admin/receipts/[id]/pdf/route.ts:24-43` (`orderBy("updatedAt","desc").limit(1)`); `lib/receipt/pdf.ts:79-80,171,179,181` | M07-F19, M14-F41 |
| R-090 | MEDIUM | Receipt PDF layout defects: the "Address" label is drawn at the same y as the email row and the value is never drawn; there is no pagination, so enough rows render over the footer; and `truncate` strips exactly four characters once regardless of overflow, and is applied to notes only | `lib/receipt/pdf.ts:42-47,83-90,104-110,113-133,166,187` | M14-F08, M14-F09, M14-F43 |
| R-091 | MEDIUM | Client-minted receipt references (`SVA-…`, `DON-…`) are generated in the browser, shown on the receipt and never written to Firestore, so the paper trail cannot be matched to a record | `components/home/SevaBooking.tsx:152` vs `services/sevaBooking.service.ts:36`; `components/home/DonationForm.tsx:98` vs `services/donation.service.ts:39` | M03-F09 |
| R-092 | MEDIUM | Nine composite indexes the code needs are absent, and several declared ones target the wrong field or collection (`announcements.active` vs the real `isActive`; `chat_messages` vs the real `messages`). Those queries fail at runtime with `FAILED_PRECONDITION` | `firestore.indexes.json:92-105,122-129` vs `services/announcement.service.ts:48`, `chat.service.ts:118`, `billing.service.ts:108,119,131`, `gallery.service.ts:182,194`, `sevaBooking.service.ts:55`, `testimonial.service.ts:77`, `knowledge-workflow.service.ts:87,317,378,608,1038` | M11-F12 |
| R-093 | MEDIUM | Four Supabase migration files carry timestamps in the future relative to 2026-09-19 (`20260920`, `20260930`, `20261001`, `20261010`), so a migration authored today sorts before them | `supabase/migrations/` filenames | M11-F13 |
| R-094 | MEDIUM | Seeding scripts are unsafe: `seed-poojas` deletes every document in `dailyPoojas` before seeding with no `--dry-run` and a hardcoded production credential; `seed-sevas` calls `.add()` unconditionally so every re-run duplicates the catalogue; `seed-temple-areas.ts` spreads camelCase keys into a snake_case table and fails on every row | `scripts/seed-poojas.ts:85-90`, `seed-poojas.js:112`; `scripts/seed-sevas.ts:86-98` (`.add()` at `:93`); `scripts/seed-temple-areas.ts:36-40` | M11-F10, M11-F11, M11-F15 |
| R-095 | HIGH | `FavoriteButton` reads favourite state from `profile.favorites` but writes to the bookmarks store, so the heart never reflects a save and repeated clicks create duplicate bookmarks | `components/common/FavoriteButton.tsx:36,61-79` vs `context/ProfileContext.tsx:203-205,213-217` | M01-F09 |
| R-096 | MEDIUM | `profileService.removeBookmark(uid, bookmarkId)` matches on the `itemId` field while `addBookmark` returns the Firestore document id, so callers holding the returned id cannot delete | `services/profile.service.ts:327-352` vs `:357-375` | M10-F20 |
| R-097 | MEDIUM | The admin "Active" checkbox writes `active` while every security check reads `isActive`. Deactivating a staff account in `/admin/users` does **not** revoke their admin API access, and every registered user shows as Active because `data.active` is undefined | `components/admin/users/UserForm.tsx:31`; `types/user.ts:94`; `services/user.service.ts:25,48,64,76` vs `services/auth.service.ts:66`, `lib/auth/admin-auth.ts:55`, `firestore.rules:38` | M04-F36 |
| R-098 | MEDIUM | `userService.addUser` uses `addDoc`, so admin-created users get a random document id instead of the Firebase Auth uid; `isOwner(userId)` can then never match and the user cannot read their own document | `services/user.service.ts:64`; `firestore.rules:35` | M04-F17 |
| R-099 | MEDIUM | Role vocabulary is inconsistent across four places — `UserRole` mixes Title Case and snake_case, the rules check one list, `UserForm` writes `"Temple Admin"`, `set-role` accepts snake_case only — so a user created through the admin UI fails `isAdmin()`, `normalizeRole` has three unreachable cases, and `UserStats` counts zero admins for anyone bootstrapped through the API | `types/user.ts:3-16,22,26,31,36`; `firestore.rules:18`; `components/admin/users/UserForm.tsx:119-125`; `app/api/admin/users/set-role/route.ts:54`; `app/admin/users/page.tsx:70-79` | M04-F16, M10-F35, M04-F39 |
| R-100 | MEDIUM | Deleting a user removes only the Firestore document; the Firebase Auth account survives and is recreated on next login by `authService.login` | `components/admin/users/DeleteUserDialog.tsx:27`; `services/auth.service.ts:94` | M04-F29 |
| R-101 | HIGH | Two competing session models write `chat_sessions` with different field sets, and two services claim `testimonials` with different semantics, so an admin-created testimonial appears in one pending list and not the other | `services/conversation.service.ts:60` vs `services/chat.service.ts:20,31-40`; `services/chat.service.ts:173-188` vs `services/testimonial.service.ts:68-107` | M10-F13, M10-F12 |
| R-102 | HIGH | `testimonial.service.ts` short-circuits to `null` whenever `window` is undefined, so every server render and every API route silently gets the four hardcoded `DEFAULT_TESTIMONIALS` instead of real data | `services/testimonial.service.ts:12`, returned at `:140,166,169,178,192,210,219` | M02-F19, M10-F06 |
| R-103 | HIGH | Fabricated content ships as real: four named devotees with quotes and photo paths render whenever Firestore is empty; seven phantom gallery rows with ids `default-1..7` cannot be edited or deleted; `/live` presents five invented streams all pointing at YouTube id `dQw4w9WgXcQ`, and Raya AI deep-links to it | `services/testimonial.service.ts:32-66`; `services/gallery.service.ts:9,151-173`; `app/(public)/live/page.tsx:37-94`; `lib/ai/actions/actionRegistry.ts:102,249` | M02-F22, M06-F18, M02-F07, M02-F39 |
| R-104 | HIGH | The content dashboard's numbers are wrong by construction: it counts a `gallery` collection that does not exist, filters announcements on `active` when the field is `isActive`, and filters events on a string `date` field when events live in Supabase | `app/admin/content/page.tsx:90,92,93` vs `services/gallery.service.ts:6`, `announcement.service.ts:48`, `event.service.ts:46` | M06-F08 |
| R-105 | MEDIUM | `/admin/media` reads `data.url \|\| data.imageUrl` while the service writes `imagePath`, so every gallery item renders with an empty `src`; the `onError` fallback and two of three default entries point at files that do not exist | `app/admin/media/page.tsx:55-57,87,298-300`; `types/gallery.ts:49`; `public/images/gallery/` holds one file | M06-F09 |
| R-106 | HIGH | Quotes cannot be edited or deleted from the list: `quoteColumns` has no `actions` column, so the `onEdit`/`onDelete` handlers passed to `CrudTable` are unreachable | `app/admin/quotes/columns.tsx:26-133`; `components/admin/crud/createCrudColumns.tsx:18`; `app/admin/quotes/page.tsx:452` | M06-F05 |
| R-107 | MEDIUM | The public calendar is a static TypeScript file pinned to 2026 whose data runs out on 2027-04-02; ten files depend on it with no fallback, and "More Spiritual Calendars Coming Soon" is hardcoded copy | `data/calendar.ts:3-12,26,29-55,53`; `app/calendar/page.tsx:29,148-168` | M03-F14, M11-F28 |
| R-108 | HIGH | Five of the six search type filters return nothing because the UI's type names do not match `SearchResultType`, and `searchAll` never searches gurus or announcements although both are declared types with buckets and URL routing | `app/(public)/search/page.tsx:29,77` vs `types/search.ts:6-13`; `services/search.service.ts:34-61,357,361-367` | M02-F03, M02-F38 |
| R-109 | MEDIUM | Knowledge previous/next, bookmark and recently-viewed links point at `/knowledge/<article-slug>`, which resolves to the `[category]` route and calls `notFound()` — every one of those links 404s, while the same files get it right elsewhere | broken at `components/knowledge/KnowledgeArticleClient.tsx:275,291`, `KnowledgeCentreClient.tsx:300,335`; correct at `KnowledgeArticleClient.tsx:315`; guard `app/knowledge/[category]/page.tsx:32-38` | M03-F34 |
| R-110 | MEDIUM | `/admin/knowledge` lists seed articles as ordinary rows with edit and delete buttons, but their ids come from the slug and no such Firestore document exists, so `PUT`/`DELETE` cannot work | `app/api/admin/knowledge/route.ts:46-66`; `app/admin/knowledge/page.tsx:166,200` | M09-F22, M12-F36 |
| R-111 | MEDIUM | `getNextStatus` returns the current status for an illegal transition, but `performWorkflowAction` still writes an action row and still stamps `publishedAt`/`archivedAt` — a publish on a draft records a publication that did not happen | `services/knowledge-workflow.service.ts:241-260,290-302` | M09-F19 |
| R-112 | MEDIUM | `createAuditEntry` is never passed `performedBy` at any of its seven call sites, so every audit row records what happened but not who | `services/knowledge-workflow.service.ts:576-598`; call sites `:104,266,360,439,529,674,744` | M09-F09 |
| R-113 | MEDIUM | There is no role check anywhere in the knowledge workflow: `WorkflowRole` is declared, imported and never used; any caller can review, vote and publish, and `submitCommitteeVote` never checks membership | `types/knowledge-workflow.ts:22-26`; `services/knowledge-workflow.service.ts:37,452-500` | M09-F20, M09-F37 |
| R-114 | MEDIUM | The intents editor forces `language: "en"` on every keyword and example it saves, so editing an intent silently destroys its Kannada keywords | `app/admin/ai/intents/page.tsx:113-114` | M09-F21 |
| R-115 | MEDIUM | `deviceSettingsService.initialize()` is never called, so the Firestore `settings/device` document is never read and every admin-configurable value falls back to hard-coded defaults; `update()` uses `updateDoc`, which throws if the document does not exist, and the error is swallowed by a `console.warn` | `lib/device/settings.ts:38,45-53,85-95`; `types/device.ts:265` | M13-F10, M13-F11 |
| R-116 | MEDIUM | Two competing notification-preference pages with different key sets and different stores, plus three device-settings stores including a page-local interface that shadows the exported type | `app/(public)/notifications/page.tsx:34-88` vs `app/(public)/pages/notifications/page.tsx:38-101`; `lib/device/settings.ts:196` vs `app/(public)/pages/settings/page.tsx:30-42` vs `types/device.ts:235` | M02-F13, M13-F07, M13-F08 |
| R-117 | MEDIUM | The admin menu is defined three times and only one copy is live, so any nav edit has a two-in-three chance of doing nothing; the three lists disagree about where "Shlokas" points. The public nav is likewise three hand-maintained copies of the same link arrays | `components/admin/layout/AdminSidebar.tsx:37` (inline, live) vs `components/admin/layout/navigation.ts:92` (0 importers) vs `components/admin/AdminSidebar.tsx:86`; `components/layout/Navbar.tsx:182-431` vs `:442-629` vs `components/layout/Footer.tsx:36-54` | M06-F29, M01-F24 |
| R-118 | HIGH | The "notification" system is `setTimeout` over an in-memory `Map` — no service worker, no Web Push, no FCM, no persistence — while the UI promises email notifications, festival reminders 7 days ahead and event reminders 30 minutes ahead, none of which anything sends | `lib/device/notifications/index.ts:10,103-127`; `app/(public)/notifications/page.tsx:357-372`; `ls app/api` has no reminder or cron route | M13-F03, M13-F36 |
| R-119 | MEDIUM | `/shlokas` availability is decided by `new Date().getHours()` inside a client component's lazy `useState` — the server clock during SSR, the device clock during hydration, a guaranteed mismatch near the boundary | `app/(public)/shlokas/page.tsx:14-17,28` | M03-F18 |
| R-120 | MEDIUM | Both `pages/*` routes initialise `useState` from `localStorage` inside the initialiser, so server markup uses defaults and the client uses stored values | `app/(public)/pages/notifications/page.tsx:105`; `app/(public)/pages/settings/page.tsx:50` | M02-F25 |
| R-121 | MEDIUM | `direction` is computed as `locale === "sa" ? "rtl" : "ltr"`, marking Sanskrit right-to-left and contradicting `localeDirections.sa === "ltr"` in the same module | `lib/i18n/context.tsx:124` vs `lib/i18n/config.ts:30-34` | M13-F16 |
| R-122 | MEDIUM | Receipt list statistics and search are page-scoped but presented as totals: "Total Receipts", "Total Amount" and "Collected Today" are computed over the 50 loaded rows, `SearchBox` filters only those rows, and `hasMore` is guessed from the page length. `ReceiptListParams.search` is sent and the route never reads it | `app/admin/receipts/page.tsx:45,85-96,98-109`; `services/receipt.service.ts:62` | M07-F17 |
| R-123 | MEDIUM | Donation reconciliation is incomplete: `receiptNumber` and `adminRemarks` are read-only with no screen to set them, `collectedBy` is written as `""` and never rendered anywhere, and donations are completely disconnected from the Receipt Book | `types/donation.ts:32-38`; `services/donation.service.ts:29,39,66-69`; `components/admin/donations/DonationDetails.tsx:88-93,106-114` | M07-F24 |
| R-124 | MEDIUM | No booking state machine and no notifications: any status can jump to any other, the pencil silently confirms, and nothing informs the devotee of a confirmation or cancellation | `app/admin/bookings/[id]/page.tsx:218-248`; `app/admin/bookings/page.tsx:191-195` | M07-F12 |
| R-125 | MEDIUM | `EditPooja` cannot edit `days` or `displayOrder` and turns `category` — a union with a `<Select>` on the create form — into a free-text input cast `as PoojaCategory`, so an editor can write a category no filter matches | `components/admin/pooja/EditPooja.tsx:68-77,129-136` vs `CreatePooja.tsx:171-180,205-209` | M07-F13 |
| R-126 | MEDIUM | `CreateAaradhane` falls back to `"admin@temple.com"` when no user is signed in, over a `// TEMPORARY ... for testing` comment, forging the audit trail | `components/admin/aaradhane/CreateAaradhane.tsx:112,116-117,140` | M07-F14 |
| R-127 | MEDIUM | Saving Billing Settings unconditionally writes `billingEnabled: true`, silently turning the whole billing module on for everyone | `app/admin/billing/settings/page.tsx:76-84` | M07-F30 |
| R-128 | LOW | Custom knowledge categories created in the UI live only in component state and are re-derived from existing articles on reload, so an empty new category disappears | `app/admin/knowledge/page.tsx:100-112,292` | M09-F36 |
| R-129 | LOW | `getWorkflowStatistics` is capped by a hardcoded `limit(100)`, so all counters silently plateau at 100; `averageReviewTime`/`averageApprovalTime` are hardcoded `0`; and four accepted query params are never applied as filters | `services/knowledge-workflow.service.ts:764-812,780,870,912`; `types/knowledge-workflow.ts:168-177` | M09-F38, M09-F39 |
| R-130 | LOW | The 5-tab AI settings form saves five endpoints with `Promise.all` and no rollback, so a partial failure leaves the AI's facts half-updated | `app/admin/ai/settings/page.tsx:135-160` | M09-F35 |
| R-131 | LOW | Two undocumented confidence thresholds run in series and neither comes from settings: the detector rewrites anything below 20 to `Intent.FAQ` before the generator applies its own constant 60, so the unknown-question log records `FAQ` rather than the detector's real best guess — exactly the field an admin needs | `lib/ai/intent/detector.ts:196,241-248`; `lib/ai/generator.ts:49,1066,1074-1080` | M08-F31 |
| R-132 | LOW | Out-of-scope detection uses plain substring `includes` and runs **first**, before any intent matching, so `"pm"` rejects "does the temple close at 8:30pm?" and `food`/`app`/`website`/`hotel booking` collide with the ANNADANA and SEVA_BOOKING intents | `lib/ai/intent/patterns.ts:647,659,671`; `lib/ai/intent/detector.ts:216,622-637` | M08-F10 |
| R-133 | LOW | `isPlaceholderKey` treats any key containing `"sk-"` as a placeholder; every genuine OpenAI key starts with `sk-`, so `isConfigured()` is always false and `GET /api/chat` always reports `configured:false` | `lib/ai/provider.ts:11-31,316-319` | M08-F11 |
| R-134 | LOW | The `Intent` enum, the pattern table and the generator switch are three lists that do not line up — 42 members, 37 pattern rows, 33 case labels. Nine intents fall through `default` to a knowledge lookup, so a devotee asking to book a seva gets a knowledge-base answer; and two `case` labels are duplicated, making one category unreachable | `lib/ai/intent/types.ts:4-78`; `lib/ai/intent/patterns.ts`; `lib/ai/generator.ts:1086-1176`; `lib/ai/intent/detector.ts:571-572` vs `:599-600` | M08-F25, M08-F24 |
| R-135 | LOW | `ProfileSettingsPage` seeds its form state from `profile` at first render only, so the inputs keep stale values after the profile loads | `app/(public)/profile/settings/page.tsx:24-28` | M03-F31 |
| R-136 | LOW | `lib/sevas.ts` invents prices and durations by array index over whatever image files exist in `public/images/sevas`, so a devotee-facing price is a function of filename sort order | `lib/sevas.ts:24-25,74-79` | M03-F26, M01-F34 |
| R-137 | LOW | `/pooja` never uses `poojaService`; the schedule shown comes from a different component while the `dailyPoojas` collection is admin-only — two sources of truth for pooja timings | `app/(public)/pooja/page.tsx:21` vs `services/pooja.service.ts:40` | M03-F27 |
| R-138 | LOW | `temple-areas.supabase.service.ts` imports the bundled defaults and never uses them, so an empty table shows "Coming Soon"; and it passes an unbound method to `rows.map` | `services/temple-areas.supabase.service.ts:4,188`; `components/temple-explorer/TempleExplorer.tsx:200` | M03-F28, M10-F40 |
| R-139 | LOW | Temple identity is claimed by four places — Supabase `site_settings`, Firestore `settings/footer`, the homepage form's contact section and `website-settings/temple.json` — and `HomeClient` renders `<TempleMap/>` with no props, so hardcoded defaults always win over the CMS values | `types/settings.ts:1-10`; `components/admin/settings/homepage/types.ts:24-28`; `website-settings/temple.json:2-23`; `components/home/TempleMap.tsx:13-17`; `components/home/HomeClient.tsx:52` | M02-F18, M05-F34 |
| R-140 | HIGH | Real contact details and a live UPI VPA are hardcoded in source (`9886364462@ptsbi`, `+91 9886364462`), used as the payment fallback in two forms, and a **third, different** contact record (a personal Gmail address) is baked into dead AI code — three mutually inconsistent "official" contacts | `lib/receipt/upi.ts:1-2`; `lib/receipt/pdf.ts:23`; `components/home/SevaBooking.tsx:114`; `components/home/DonationForm.tsx:66`; `lib/ai/firebaseChat.ts:228-243`; `lib/ai/retrieval/settings.ts:20-21` | M14-F29, M03-F04, M08-F23 |
| R-141 | LOW | ICS output has no all-day branch and no `VTIMEZONE`/`TZID`, so an all-day Aaradhane becomes a timed event offset by the UTC delta (timed events themselves are correct — the trailing `Z` is preserved) | `lib/device/calendar/index.ts:67-84,201-203` | M13-F26 |
| R-142 | LOW | Browser notifications have no click handler, so tapping one does nothing and cannot deep-link to the event it announces | `lib/device/notifications/index.ts:64-89` | M13-F35 |
| R-143 | LOW | `locationService` keeps a single `watchId` on the singleton, so two components watching position overwrite each other and one `clearWatch` stops both | `lib/device/location/index.ts:16,72-99,104-109` | M13-F20 |
| R-144 | LOW | `qrScanner.switchCamera()` restarts the scanner into the hardcoded element id `"qr-reader"`, ignoring the id the caller started with | `lib/device/qr/scanner.ts:249,266` vs `components/device/QRScanner.tsx:310` | M13-F27 |
| R-145 | LOW | `shareService.share()` returns `false` even after the clipboard fallback succeeded, so callers report failure on a successful share; the hook version disagrees with the service | `lib/device/share/index.ts:100-116` vs `lib/device/hooks/useShare.ts:55-65` | M13-F24 |
| R-146 | LOW | `DeviceActionType` declares 14 values and only 11 handlers are registered, so `share_quote`, `notify_seva` and `share_daily_panchanga` fail at runtime rather than at compile time | `lib/device/actions.ts:9-23` vs the 11 `this.register(...)` calls | M13-F37 |
| R-147 | LOW | Festival enrichment is keyed on exact English display strings, so `"Mahanavami & Vijayadashami"` matches no description and falls back to boilerplate | `lib/festival-utils.ts:110` vs `data/calendar.ts:33,41` | M14-F36 |
| R-148 | LOW | The multi-day date add in the Aaradhane matcher goes through the local clock and is correct only because the generator pins `TZ=Asia/Kolkata`; under a DST timezone it duplicates or skips a day | `lib/aaradhane/panchanga.ts:171-175`; TZ pinned at `scripts/generate-aaradhane.ts:27` | M14-F31 |
| R-149 | LOW | Validation failures in the Aaradhane generator are printed as warnings and the run proceeds to write Firestore | `scripts/generate-aaradhane.ts:204-211,228` | M14-F33 |
| R-150 | LOW | The Guru dataset exists three times — a TS module, a JSON file and a Firestore document — with no sync check, and the lunar enums are declared twice | `data/aaradhane/gurus.ts:11-26`; `data/aaradhane/aaradhanaes.json`; `types/aaradhane-generator.ts:10-25` | M14-F12 |
| R-151 | LOW | `types/daily-spiritual.ts` declares `PanchangaSummary`, `PrasadaInfo` and `DEFAULT_PRASADA`, none of which the service ever produces — so the "daily spiritual" API named after panchanga returns no panchanga | `types/daily-spiritual.ts:28,58,150` vs `services/daily-spiritual.service.ts:434-441` | M14-F27 |
| R-152 | LOW | `POST /api/contact` validates and sanitises, then only `console.log`s — no email, no store — while the devotee is told "we will get back to you" | `app/api/contact/route.ts:46-51` | M12-F20 |
| R-153 | LOW | The `"personalized"` recommendation branch constructs an empty `UserBehavior` on every call, so it is identical to `homepage` | `app/api/recommendations/route.ts:30-40` | M12-F22 |
| R-154 | LOW | `recommendation.getUpcomingEvents()` is a stub returning `[]`, so no event is ever recommended although the UI advertises event recommendations | `services/recommendation.service.ts:226-229` | M02-F33 |
| R-155 | LOW | `admin/quotes/bulk` validate mode reports `valid = quotes.length - errors.length`, and one row can raise three errors, so `valid` can go negative | `app/api/admin/quotes/bulk/route.ts:34-38` | M12-F37 |
| R-156 | LOW | Content errors in the hardcoded timeline: "Entered Brindavan Brindavan Brindavan at Mantap", and a 1622 Brindavana attributed to a guru the same file says was born in 1595 | `app/(public)/timeline/page.tsx:48-51` vs `types/guru.ts` | M02-F32 |
| R-157 | LOW | The seed route writes a document literally named `%20RayaAI` (URL-encoded leading space) into `ai_settings`, and reports a clean name back to the caller | `app/api/seed-ai-settings/route.ts:547,621,644` | M12-F35, M08-F14 |
### 2.5 C — Architecture violation (43 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-158 | HIGH | The product is client-rendered against a documented "Server Components First" principle: **310 of 818 source files carry `"use client"`** and only 3 are `server-only`. 42 of the 50 `.tsx` files in the shell are client; 16 of the 20 public pages are, and three of the remaining four hand off immediately to a client subtree. `app/layout.tsx` is the one meaningful Server Component and it mounts a four-deep client provider stack | `.claude/state/inventory/SUMMARY.md` totals; `components/home/HomeClient.tsx:1`; `app/layout.tsx:86-88`; `docs/ARCHITECTURE.md:137`; `AGENTS.md` Architecture Principles #1 | M02-F01, M11-F19, M01 §Server-Components-first |
| R-159 | HIGH | **41 files hold the client Firebase SDK outside the service layer** (35 pages/components/hooks plus 6 API routes; 47 files carry 85 direct `firebase/*` import lines), against `AGENTS.md` "No Direct Firebase Calls — use services only". Twelve are admin settings pages doing `doc/getDoc/setDoc` inline against `settings/*` singletons. Separately, 15 files call Firestore inline off `@/lib/firebase` — 11 under `lib/ai/**` and 4 AI services under `services/` (M08-F16); the 41/47/85 counts are scoped to `app/`, `components/` and `hooks/` only | `app/admin/settings/*/page.tsx:7-8`; `app/admin/page.tsx:12-13`; `app/(public)/{about,facilities,future-plans,trust}/page.tsx`; `components/layout/Footer.tsx:8-9`; `hooks/useFinanceSettings.ts:4-5`, `useGallery.ts:10,12`; `lib/ai/retrieval/*.ts:4-5`; `lib/device/settings.ts:45-53` | M10-F05, M01-F07, M02-F09, M05-F09, M06-F16, M08-F16, M09-F14, M11-F19, M13-F12, M14-F38 |
| R-160 | HIGH | Zero per-route SEO metadata on a site whose whole purpose is public discovery: no `export const metadata` or `generateMetadata` anywhere under `app/(public)`, so all 20 routes share one title and description. There is no `app/sitemap.ts`, `app/robots.ts`, `public/sitemap.xml` or `public/robots.txt` either | `grep -rn "export const metadata\|generateMetadata" "app/(public)/"` → nothing; `app/layout.tsx:31`; all four SEO files absent | M02-F08, M15-F20 |
| R-161 | HIGH | The public route group renders no header or footer: 29 files import `Navbar`/`Footer` individually, so chrome changes need 29 edits and the header re-mounts on every navigation. Four routes (`/calendar`, `/calendar/ekadashi`, `/calendar/festivals`, `/knowledge`) sit outside the group entirely with no layout of their own, and seven public pages import neither | `app/(public)/layout.tsx:1-18`; 29 importers of `components/layout/Navbar`; `app/knowledge/page.tsx:4,19` vs `app/knowledge/[category]/page.tsx` | M01-F05, M03-F22 |
| R-162 | MEDIUM | `lib/` holds business logic and Node-only code with no `server-only` guard: seva names and prices, a filesystem gallery scan, a full-collection event query, and Firestore persistence for device settings | `lib/sevas.ts:24-45`; `lib/gallery.ts:22`; `lib/firebase.ts:156,164-199`; `lib/device/settings.ts:45-53` | M01-F26, M01-F34, M10-F22, M13-F12 |
| R-163 | MEDIUM | No response-shape contract across 95 routes: `{success,data}`, `{success,<noun>}`, bare arrays, bare objects, `{<noun>,total}` and `{error}` vs `{success:false,error}` all coexist | `app/api/admin/aaradhane/route.ts:12` vs `app/api/events/route.ts:7` vs `app/api/quotes/route.ts:37` vs `app/api/announcements/route.ts:10` | M12-F27 |
| R-164 | MEDIUM | Duplicate and competing route families for one resource, with different shapes and different (non-)auth: quotes, temple areas, prompts, knowledge (four families), unknown questions, analytics | `app/api/temple-areas/route.ts:14` and `app/api/admin/temple-areas/route.ts:14`; `app/api/admin/prompts/route.ts:102` and `app/api/ai/settings/prompts/route.ts:64`; `app/api/knowledge/route.ts:16`, `app/api/admin/knowledge/route.ts:22`, `app/api/ai/knowledge/coverage/route.ts:2-3`, `services/knowledge-workflow.service.ts:47` | M12-F15, M09-F43, M09-F11 |
| R-165 | HIGH | The whole knowledge-workflow subsystem (~2,000 lines) is unreachable: its only UI is never imported and none of its seven collections has a rule block, so its client-SDK writes are denied by default | `components/ai/KnowledgeWorkflowDashboard.tsx:384`; `services/knowledge-workflow.service.ts:46-54` vs `firestore.rules` | M09-F05 |
| R-166 | MEDIUM | `services/` is split between classes-with-singletons, plain object literals and bare exported functions, with three different "Firebase missing" policies (`throw`, `return []`, `return defaults`) | classes `sevaBooking`, `billing`, `event`; objects `pooja.service.ts:39`, `gallery.service.ts:110`, `volunteer.service.ts:38`, `aaradhane.service.ts:157`; functions `chat`, `analytics`, `testimonial`, `knowledge-workflow` | M10-F27 |
| R-167 | MEDIUM | 17 exported type names are declared in more than one file — `TempleEvent` in three — so autocomplete picks the wrong one | `types/event.ts` / `types/multi-source-retrieval.ts` / `types/proof-report.ts`; `types/ai.ts` / `types/homepage.ts`; `types/billing.ts` / `types/seva-booking.ts`; `types/calendar.ts` / `types/festival.ts` | M10-F29 |
| R-168 | MEDIUM | Five `types/*.ts` files import `Timestamp` from `firebase/firestore`, coupling the shared vocabulary to the web SDK — the single largest obstacle to publishing `types/` as a cross-platform package | `types/user.ts:1`, `types/billing.ts`, `types/event.ts`, `types/profile.ts`, `types/aaradhane-generator.ts:8` | M10-F36, M06-F06 |
| R-169 | MEDIUM | Content and static data live in `types/`: 371 lines of guru biographies, 347 of temple-area seed data, 194 of festivals with functions, and `DEFAULT_QUOTES_DATA` in a 494-line `types/quote.ts`. Editing content requires a deploy | `types/guru.ts:64,322-343`; `types/temple-explorer.ts`; `types/festival.ts`; `types/quote.ts:362` | M02-F31, M06-F26, M10-F41 |
| R-170 | MEDIUM | `lib/device/index.ts` re-exports eight client component modules alongside the hooks and has no `"use client"`, so a page importing only `useShare` pulls every device widget, `Dialog`, `Card`, `Switch` and the full icon set into its client bundle — seven pages do exactly this | `lib/device/index.ts:90-136`; consumers `components/home/DailyQuoteWidget.tsx:7`, `components/events/EventCard.tsx:7`, `app/(public)/qr/page.tsx:11`, and four more | M13-F06 |
| R-171 | MEDIUM | Modules that call browser APIs with no `"use client"` directive: `hooks/a11y/index.ts` (eight hooks touching `document` and `matchMedia`), `components/ui/badge.tsx` (base-ui `useRender`), `components/home/GallerySection.tsx` (framer-motion). They work only because every importer is already a client component | `hooks/a11y/index.ts:1-6,14,88,186,220`; `components/ui/badge.tsx:1-8,36`; `components/home/GallerySection.tsx:1-5` | M13-F09, M01-F29, M02-F14 |
| R-172 | MEDIUM | Server Components import services that instantiate the **browser** Supabase client at module scope, so server-side reads carry the anon key | `app/admin/events/[id]/edit/page.tsx:17`; `services/event.service.ts:2-4`; importers `app/api/events/route.ts`, `app/api/events/[id]/route.ts` | M06-F17, M10-F23 |
| R-173 | MEDIUM | No cache invalidation after a content write: `/api/revalidate` exists and its only caller is the homepage settings form, so saving an event, announcement, gallery item or quote never revalidates the public pages | `app/api/revalidate/route.ts:10`; sole caller `components/admin/settings/homepage/useHomepageForm.ts:91`; `EventForm.tsx:175-176` uses `router.refresh()` only | M06-F15 |
| R-174 | MEDIUM | The HTTP layer is bypassed: six content routes have no caller because the admin screens call the SDKs directly, so route-level validation never runs — and **36 of the 95 endpoints have no reference anywhere in the repository**, several of them write paths | `grep` over `app components lib services hooks` finds no `fetch("/api/events…")`, `"/api/announcements"`, `"/api/testimonials"`, `"/api/storage/videos"`; `.claude/state/verify/_M12_callers.js` → 36 | M06-F14, M12-F44 |
| R-175 | MEDIUM | Three parallel colour systems — oklch tokens in `:root`, `--temple-*` extensions, and literal `amber-*`/`orange-*`/`stone-*` classes in components — and `<body>` hardcodes `bg-stone-50 text-stone-900`, overriding the token rule at the document level. The "primary" token is gold; the primary Button is `orange-600` | `app/globals.css:140,184-192,234-236`; `app/layout.tsx:81`; `components/ui/button.tsx:34`; `components/ui/TempleButton.tsx:44` | M01-F11, M01-F12 |
| R-176 | MEDIUM | `@import "tailwindcss"` and three other `@import`s appear at line 77 of `globals.css`, after 76 lines of real CSS; the spec requires `@import` first, so behaviour depends on the bundler | `app/globals.css:1-80` | M01-F14 |
| R-177 | MEDIUM | `@theme inline` maps `--font-sans` to itself, `--font-mono` to a variable that is never defined, and `--font-heading` to `--font-sans`, fighting the `:root` value set at line 3 | `app/globals.css:3,87-89` vs `app/layout.tsx:13-29` | M01-F15 |
| R-178 | MEDIUM | A complete 31-property dark palette exists under `.dark` and nothing ever adds the `dark` class; `ProfileContext.updateTheme` persists a theme that nothing applies | `app/globals.css:195-228`; `context/ProfileContext.tsx:158-163` | M01-F13 |
| R-179 | MEDIUM | `lib/formStyles.ts` — named by `AGENTS.md:297` and `docs/CODING-STANDARDS.md:94` as *the* design tokens — has zero importers, and its exact class string is re-pasted in four form fields | `lib/formStyles.ts:1`; duplicates at `FormTextField.tsx:39-46`, `FormTextArea.tsx:38-47`, `FormNumberField.tsx:38-47`, `FormSelectField.tsx:46-55` | M01-F16 |
| R-180 | HIGH | `Permissions-Policy: camera=(), microphone=(), geolocation=()` disables camera and geolocation for the whole origin, so every geolocation and QR-scanning feature in the product is dead in production while the UI still offers them | `next.config.ts:29-30`; consumers `lib/device/location/index.ts:44`, `lib/device/permissions/index.ts:140,147` | M13-F01 |
| R-181 | HIGH | QR scanning loads `html5-qrcode` from `unpkg.com` at runtime; the package is not a dependency, and the site CSP's `script-src 'self' 'unsafe-inline' 'unsafe-eval'` does not allow unpkg, so the script is blocked | `lib/device/qr/scanner.ts:78`; `package.json` has no `html5-qrcode`; `next.config.ts:33` | M13-F04 |
| R-182 | HIGH | `useI18n()` throws when no provider is present and `I18nProvider` is mounted nowhere, so the two profile pages that render `LanguageSwitcher` crash | `lib/i18n/context.tsx:53,146`; `app/layout.tsx:84-88` has no `I18nProvider`; rendered at `app/(public)/profile/page.tsx:115`, `profile/preferences/page.tsx:144` | M13-F02 |
| R-183 | MEDIUM | 825 translated strings (275 keys × en/kn/sa, Kannada 0% identical to English) are unreachable: `grep -rn 't("' app components` → 0 and `grep -rn '= useTranslation()' app components` → 0, while `docs/ARCHITECTURE.md:180` claims language support | `lib/i18n/dictionaries/kn.json` (275 leaves); `docs/ARCHITECTURE.md:180` | M13-F15 |
| R-184 | MEDIUM | No PWA assets at all — no `manifest.json` or `app/manifest.ts`, no service worker, no offline page, no icon set (`public/icons/` holds only `.gitkeep`) — while the module ships `usePWAInstall`, `isServiceWorkerSupported` and an offline indicator | `find public app -iname "manifest*" -o -iname "sw.js"` empty; `ls public/icons` → `.gitkeep`; `lib/device/hooks/useDevice.ts:104`; `lib/device/capabilities/index.ts:86` | M13-F17 |
| R-185 | MEDIUM | `app/layout.tsx:67` links `/favicon.ico` and the notification service uses the same path as an icon, but only `favicon.svg` exists — a 404 on every page | `app/layout.tsx:67`; `lib/device/notifications/index.ts:98`; `ls public/` | M13-F18 |
| R-186 | MEDIUM | Hardcoded deployment URLs contradict `metadataBase`: `/qr` builds printed QR codes against `https://rayaramathaynk.vercel.app` while the app declares `https://www.srsmathaynk.com` | `app/(public)/qr/page.tsx:15-16` vs `app/layout.tsx:32` | M13-F19, M03-F29 |
| R-187 | MEDIUM | Three storage backends are in play at once: Vercel Blob (the intended one, broken), Firebase Storage (imported into `/admin/media` and never called), and the `public/` filesystem (scanned by `lib/gallery.ts` and deleted through an unauthenticated route) | `app/admin/media/page.tsx:25,36`; `lib/firebase.ts:90,220`; `lib/gallery.ts:22`; `app/api/gallery/local-assets/route.ts` | M06-F31, M06-F04 |
| R-188 | HIGH | `/admin/sevas` is the Member/Volunteer register, not a seva catalogue: the page component is `VolunteerPage` and its columns export `memberColumns`/`volunteerColumns`, while the real seva-catalogue components exist with no importer | `app/admin/sevas/page.tsx:9,11,13,122`; `app/admin/sevas/columns.ts:4,48`; `components/admin/sevas/SevaForm.tsx:25` | M07-F10 |
| R-189 | MEDIUM | Routes that exist and cannot be reached: three public routes have no inbound link anywhere (`/search`, `/pages/notifications`, `/pages/settings`), four more are reachable only through the AI assistant, nine devotional routes are absent from both Navbar and Footer, and six admin routes are absent from the live sidebar (`/admin/featured`, `/admin/settings`, `/admin/website-settings/temple-information`, `/admin/calendar/ekadashi`, `/admin/calendar/festivals`, `/admin/seva-bookings`, plus `/admin/assistant`) | `components/layout/Navbar.tsx:17-82`; `components/layout/Footer.tsx:36-53`; `components/admin/layout/AdminSidebar.tsx:37-104`; `lib/ai/actions/actionRegistry.ts:102-106,249` | M02-F12, M03-F16, M05-F06, M05-F36, M07-F21, M09-F44 |
| R-190 | LOW | `utils/redirect.ts` switches on roles that `normalizeRole` does not produce and routes to `/priest`, `/staff` and `/devotee`, none of which exist as routes; the module is unused | `utils/redirect.ts:3-25` vs `context/AuthContext.tsx:156-166`; `ls app` | M01-F36, M04-F15 |
| R-191 | LOW | `lib/config.ts` (`SITE`) and `lib/constants.ts` (`TEMPLE`) hold the same latitude, longitude and timezone under different names, and neither is imported | `lib/config.ts:1-16`; `lib/constants.ts:1-6` | M01-F33 |
| R-192 | LOW | Business data hardcoded in `lib/`: seva names, prices (`₹501`, `₹301`…) and durations, in Node-only modules with no `server-only` guard | `lib/sevas.ts:24-45`; `lib/gallery.ts:22` | M01-F34 |
| R-193 | LOW | The repository's only server action uses the Supabase service-role client with no caller check and returns raw table rows | `app/actions/sevas.ts:2,5,12` | M12-F42 |
| R-194 | LOW | `/api/knowledge/search` `parseInt`s `limit` without clamping or rejecting `NaN`, and is unauthenticated with `Cache-Control: no-store`, so any caller sizes an uncached Firestore read | `app/api/knowledge/search/route.ts:14,20,24` | M09-F46 |
| R-195 | LOW | No `OPTIONS` handler and no CORS headers anywhere, so a browser client on another origin cannot use this API | `grep -rn "export async function OPTIONS" app/api` → 0 | M12-F38 |
| R-196 | LOW | `vercel.json` carries only cache headers for `/data/panchanga/*` — no function memory, duration or region config, while `maxDuration` is set inline in one route | `vercel.json:1-23`; `app/api/reports/save/route.ts:5` | M12-F41 |
| R-197 | LOW | `lib/panchanga-cache.ts` presents itself as a cache but `getCachedPanchanga` always returns em-dash placeholders, and `getPanchangaWithFallback` has no caller | `lib/panchanga-cache.ts:11-21,23` | M01-F35, M14-F25 |
| R-198 | LOW | `getLocaleFromPath` assumes a `/[locale]/...` route structure; no `app/[locale]` segment exists, so the function is dead and misleading | `lib/i18n/config.ts:94-103` | M13-F29 |
| R-199 | LOW | Two parallel device action registries under near-identical specifiers (`lib/device/actions.ts` vs `lib/device/actions/index.ts`), both re-exported by the barrel — one resolved by file, one by directory | `lib/device/index.ts:40-42`; `lib/device/actions.ts:41`; `lib/device/actions/index.ts:78` | M13-F23 |
| R-200 | LOW | `types/festival.ts` mixes presentation into a types module: `getSeasonColor` returns Tailwind gradient class names | `types/festival.ts:149-164` | M14-F34 |

### 2.6 D — Duplication and dead code (32 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-201 | HIGH | `components/ui/tabs.tsx` is a non-functional stub: `TabsTrigger` hardcodes `data-state="active"` and discards `value`; `TabsContent` discards `value` and always renders, so **every panel shows at once** on both quote editors | `components/ui/tabs.tsx:36-52,54-68`; consumers `app/admin/quotes/new/page.tsx:20`, `app/admin/quotes/[id]/edit/page.tsx:20` | M01-F03 |
| R-202 | HIGH | `components/ui/dropdown-menu.tsx` is a set of plain `div`s — no open/close state, no portal, no positioning, no keyboard handling, no `role="menu"` — and its content renders permanently | `components/ui/dropdown-menu.tsx:8-40`; consumers `app/admin/quotes/page.tsx`, `components/device/LocationButton.tsx` | M01-F04 |
| R-203 | MEDIUM | Roughly **12,000 lines of dead code** with zero importers, spread across every module: 22 files/2,358 lines in the shell, ~1,800 in the public site, ~1,600 in the admin platform, ~600 in devotional ops, ~2,400 in the AI engine, 1,987 in the AI console, ~3,500 in device capabilities, 608 in the Aaradhane libs, plus eight empty `data/` files and a duplicated seed JSON | `.claude/state/inventory/import-graph.json` reverse index, confirmed per module by grep | M01-F43, M02-F11, M03-F15, M05-F15, M06-F12, M07-F20, M08-F09, M09-F10, M09-F11, M09-F12, M10-F15, M13-F05, M14-F10, M11-F20, M11-F21 |
| R-204 | MEDIUM | An entire second toast system (reducer + components + renderer, 325 lines) is dead — `toaster.tsx` has no importer and `ToastViewport` returns `null` — while `react-hot-toast` is the live system and `sonner` is a third, declared dependency with zero imports repo-wide | `components/ui/toast.tsx:274`; `components/ui/toaster.tsx:13`; `app/layout.tsx:91`; `package.json:63,68` | M01-F18, M05-F24 |
| R-205 | MEDIUM | Two full `GlobalSearch` implementations (379 + 350 lines) exist and neither is imported, while `/api/search` is implemented. One of them holds the only `router.push("/search")` in the repository, which is why `/search` is unreachable | `components/common/Search/GlobalSearch.tsx:71,100`; `components/search/GlobalSearch.tsx:30` | M01-F19, M02-F41 |
| R-206 | MEDIUM | `lib/auth.ts` is a full functional duplicate of `services/auth.service.ts` with no importer, and it shadows the `lib/auth/` directory barrel, so the specifier `@/lib/auth` resolves to the **dead file**. The barrel itself exports only the unsafe verifier | `lib/auth.ts:20-133` vs `services/auth.service.ts:37-129`; `lib/auth/index.ts:2` | M01-F20, M04-F11, M01-F48, M04-F12 |
| R-207 | MEDIUM | `lib/animations.ts` defines 25 shared framer-motion variants and easing scales and is imported by nothing; every animated component redefines its own variants inline | `lib/animations.ts:4-288`; zero importers in the import graph | M01-F17 |
| R-208 | MEDIUM | Five `@tiptap/*` packages and a `RichTextEditor.tsx` exist with no importer, and there is **no rich-text field anywhere** — every long-form field is a plain `<textarea>` | `components/admin/RichTextEditor.tsx:3-7`; `package.json` tiptap block; `EventForm.tsx:210`, `AnnouncementForm.tsx:115` | M06-F11 |
| R-209 | MEDIUM | Six gallery routes and three parallel form implementations for one job: `/admin/gallery` and `/admin/gallery/media` render the identical dashboard, and `GalleryForm`, `CreateImage` and `EditImage` duplicate the same fields and validation three times | `app/admin/gallery/page.tsx:16` vs `media/page.tsx:14`; `GalleryForm.tsx:82` vs `CreateImage.tsx:47` vs `EditImage.tsx:55` | M06-F10 |
| R-210 | MEDIUM | Two booking UIs over one collection (`/admin/bookings` with `CrudTable`, `/admin/seva-bookings` hand-rolled) duplicating the status ladder and colour scheme, plus a third dead copy under `components/` | `app/admin/bookings/page.tsx:182`; `app/admin/seva-bookings/page.tsx:10,88-200`; `components/admin/bookings/[id]/page.tsx:13` | M07-F11 |
| R-211 | MEDIUM | `quotes/new` (603 lines) and `quotes/[id]/edit` (663 lines) are ~90% identical; the delta is load-on-mount, POST vs PUT, and a delete button | both files | M06-F23 |
| R-212 | MEDIUM | Three live implementations of the same admin idea coexist: two crud-column builders, two error boundaries, two search boxes, two page headers, and `SectionCard` as a file *and* re-declared inline in the dashboard | `lib/crud-columns.tsx:9` vs `components/admin/crud/createCrudColumns.tsx:14`; `app/admin/page.tsx:59` vs `components/admin/common/SectionCard.tsx:8` | M05-F16 |
| R-213 | MEDIUM | `hooks/useFinanceSettings.ts:22-47` is a verbatim copy of the load-and-merge block in the finance settings page, including the identical eleven-line billing-defaults fallback | both files | M05-F17 |
| R-214 | MEDIUM | `services/report.service.ts` implements exactly the revenue/donation/booking summary that `/admin/reports` recomputes inline, and is imported by nothing | `services/report.service.ts:7-63` vs `app/admin/reports/page.tsx:116-130` | M05-F18, M10-F15 |
| R-215 | MEDIUM | Two dead dashboard services export the same symbol `dashboardService` from the same class name `DashboardService`; the `.client` variant downloads every document of eight collections to count them | `services/dashboard.service.ts:6,43`; `services/dashboard.service.client.ts:5,24-26,47` | M10-F14 |
| R-216 | MEDIUM | `lib/aaradhane/local-generator.ts` and `generator.ts` are near-identical copies of `generateSingleEvent`, `printGenerateSummary` and `validateGeneratedEvents`; a fix in one silently misses the other | `local-generator.ts:77-132,134,170` vs `generator.ts:183-258,370,407` | M14-F11 |
| R-217 | MEDIUM | `lib/aaradhane/firestore.ts` (490 lines) and `firestore-rest.ts` (118, with a hardcoded project id) are dead, while `docs/AARADHANE_GENERATOR.md:177` documents the first as a key component | no importer outside the folder; the live path is `firestore-admin.ts` via `scripts/generate-aaradhane.ts:230`; `lib/aaradhane/firestore-rest.ts:6` | M14-F10, M14-F30 |
| R-218 | MEDIUM | Documents and data files duplicated at the repo root: two `AARADHANE_GENERATOR.md` with different content (250 vs 376 lines) and two `quotes-seed-data.json` in different shapes, only one of which any code reads | `AARADHANE_GENERATOR.md` vs `docs/AARADHANE_GENERATOR.md`; `quotes-seed-data.json` vs `seed/quotes-seed-data.json`; `scripts/seed-quotes.ts:844` | M14-F22, M15-F33, M11-F21 |
| R-219 | LOW | The same helpers are written many times over: three date formatters with different signatures and one dead; `formatPdfAmount` defined twice with identical bodies; `formatCurrency` redefined in six files; `detectDeviceType` duplicated verbatim in a component and a service | `lib/utils.ts:8`, `lib/format.ts:45,61`, `lib/date.ts:3`; `lib/receipt/upi.ts:35` and `lib/receipt/pdf.ts:197`; six `app/admin/**` files; `components/analytics/PageViewTracker.tsx:38` and `services/pageviews.service.ts:219` | M01-F32, M07-F32, M14-F24, M14-F26, M15-F25 |
| R-220 | LOW | `galleryService` exposes five alias methods that only forward to the `*Media` versions — two vocabularies for one collection | `services/gallery.service.ts:175,215,225,234,243` | M02-F36, M10-F38 |
| R-221 | LOW | Script-level duplication: the `EXPECTED` collection list is copied verbatim into two files, two npm scripts point at the same converter, and a 25-line shell wrapper's only executable statement `exec`s an npm script | `scripts/dump-firestore-live.ts:11-22` and `scripts/convert-firestore-export.ts:14-25`; `package.json` scripts; `scripts/dump-firestore-configs.sh:25` | M11-F22, M11-F23 |
| R-222 | LOW | Dead imports, unused state and no-op statements throughout: unused `useRouter`/`useCallback`, four unused service imports in `/favorites`, ~55 lines of commented-out LLM code, a bare `data as any;` expression statement, unused route-handler imports in eight files, and computed-but-unused page-view fields so traffic-source and device breakdowns are never persisted | `context/ProfileContext.tsx:9,20,63`; `app/(public)/favorites/page.tsx:8-11,60`; `app/api/chat/route.ts:3-26,232-286`; `services/knowledge-workflow.service.ts:728`; `app/api/knowledge/workflow/articles/route.ts:8-10`; `services/pageviews.service.ts:7,11,21,59-60` | M01-F38, M03-F19, M08-F26, M09-F27, M09-F28, M10-F37, M12-F31, M12-F32, M15-F24, M13-F25, M06-F21, M05-F29, M02-F40 |
| R-223 | LOW | Reduced-motion detection is implemented twice, independently | `hooks/useReducedMotion.ts:12-33` vs `components/common/A11yProvider.tsx:22-34` | M13-F31 |
| R-224 | LOW | Six of the eight accessibility hooks have no consumer, while the app has custom dropdowns and dialogs that need exactly them | `hooks/a11y/index.ts`; only `useHighContrast` and `useKeyboardNavigationMode` are imported | M13-F32 |
| R-225 | LOW | Eight files in `data/` are empty, `data/galleryCategories.ts` is imported by nothing, and `homepage/config` is a stray 456-byte extensionless JSON file committed at the repo root that will drift from the live document | inventory line counts; `grep -rn galleryCategories`; `homepage/config` | M11-F20, M05-F35 |
| R-226 | LOW | Duplicate assets and starter cruft in `public/`: one testimonial image in three directories, one photo in both `.jpg` and `.png`, and four unmodified Next.js starter SVGs | `public/images/gallery/`, `public/images/testimonials/`, `public/testimonials/`; `public/*.svg` | M13-F30 |
| R-227 | LOW | `services/quote.service.ts:243` defines `isCacheValid()` which nothing calls; `getTodaysQuote` does its own check and therefore ignores `CACHE_DURATION` | `services/quote.service.ts:39,243,672,694` | M03-F23 |
| R-228 | LOW | Naming traps: `FullGallery.tsx` default-exports `GalleryGrid`; `services/volunteer.service.ts` has nothing to do with the `/volunteer` page; `DailyQuoteWidget` exists twice; two different `Festival` interfaces; two exported `getAnalyticsSummary` with different signatures, each imported by a different caller | `components/home/FullGallery.tsx:47`; `services/volunteer.service.ts:83` vs `app/api/volunteer/route.ts:2`; `types/calendar.ts:6` vs `types/festival.ts:6`; `services/analytics.service.ts:338` vs `services/pageviews.service.ts:82` | M02-F35, M14-F35, M15-F21 |
| R-229 | LOW | `types/quote.ts` is 494 lines because `DEFAULT_QUOTES_DATA`, `FESTIVAL_QUOTE_MAP` and `WEEKDAY_QUOTE_MAP` live in the types folder | `types/quote.ts:362` | M06-F26 |
| R-230 | LOW | `.deployment-trigger` is a 0-byte file with no reference anywhere in the repository | root listing; no grep hit | M15-F35 |
| R-231 | LOW | Throwaway tooling: `test_plan.sh` is `npm run lint`, `fix_lint.sh` is `npm run lint -- --fix`, `start-test.sh` relies on job control that does not work non-interactively, and `fix-websocket.ts` mutates a committed test file in place with its output already committed | `test_plan.sh`, `fix_lint.sh`, `start-test.sh:1-4`, `fix-websocket.ts:1-10`; `tests/ai-uat/ai-uat.test.ts:1-2` | M15-F27, M15-F26 |
| R-232 | LOW | `TempleEvent.status` is marked "Legacy (will be removed later)" yet is still written on create, still a table column, and the list page computes a *different* status at render time from the dates | `types/event.ts:35-36`; `components/admin/events/EventForm.tsx:168`; `app/admin/events/page.tsx:44-58` | M06-F27 |

### 2.7 E — Performance (26 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-233 | HIGH | The admin dashboard reads up to **10,000 `page_views` documents** on every load and aggregates them client-side; the `days = 7` parameter computes a `weekAgo` that is never referenced, so there is no `where()` and "last 7 days" is a lie. The collection holds ~47k documents against a 50k/day free-tier read cap | `services/pageviews.service.ts:82,109,110,113-119`; caller `app/admin/page.tsx:15`; quota note in `CLAUDE.md` | M10-F10, M15-F06 |
| R-234 | HIGH | Two independent page-view writers run on every public GET — one in the proxy, one in a client tracker — doubling Firestore writes on the collection already near the quota | `proxy.ts:105-111`; `components/analytics/PageViewTracker.tsx:11-25` | M01-F06 |
| R-235 | MEDIUM | No pagination anywhere except receipts: bookings, donations, bills, quotes, testimonials, users, gallery media, events, announcements and workflow articles all fetch whole collections and filter in the browser; the events service does `select('*')` with no `published` predicate and then filters twice | `services/sevaBooking.service.ts:43`; `donation.service.ts:46`; `billing.service.ts:94`; `user.service.ts:20`; `gallery.service.ts:157`; `event.service.ts:46`; `app/admin/users/page.tsx:37-51`; `components/events/EventGrid.tsx:45` | M10-F25, M07-F36, M12-F39, M04-F25, M02-F15 |
| R-236 | MEDIUM | Firestore `.offset()` pagination on receipts bills a read for every skipped document — page 50 of a 10,000-row export reads 500,000 documents | `app/api/admin/receipts/route.ts:58-61` | M12-F24 |
| R-237 | MEDIUM | `getNextUpcomingEvent()` reads the entire `events` collection and filters in JS, with a comment admitting it is avoiding an index — and it lives in `lib/firebase.ts`, which has 78 importers, so it is in every bundle | `lib/firebase.ts:155-199` | M01-F26, M10-F22 |
| R-238 | MEDIUM | Unbounded `getDocs(collection(db,"chat_sessions"))` with no `limit`, run twice on every admin AI page view and then filtered in the browser | `app/admin/ai/analytics/page.tsx:255`; `app/admin/ai/page.tsx:94` | M09-F15 |
| R-239 | MEDIUM | `/admin/featured` loads the complete `events`, `announcements`, `sevas` and `knowledge` collections in the browser just to populate a picker, with no limit or projection | `app/admin/featured/page.tsx:143-146`; `services/dashboard.service.client.ts:24-25` | M05-F19 |
| R-240 | MEDIUM | `/api/public/stats` runs six count queries plus a full scan of completed donations on every request, uncached | `app/api/public/stats/route.ts:33-60` | M12-F25 |
| R-241 | MEDIUM | Module-level in-memory caches and queues in a serverless runtime — per lambda, invisible to other instances, with `clearXCache()` clearing only one. Two carry "would be Firestore in production" comments | `services/quote.service.ts:39-46`; `knowledge.service.ts:27-28`; `ml.service.ts:39-41`; `multi-source-retrieval.service.ts:508,552-553`; `lib/ai/retrieval/*.ts` module-level caches | M08-F17, M10-F19, M03-F23 |
| R-242 | MEDIUM | Six independent client fetches fire after home-page hydration (announcements, homepage config snapshot, panchanga JSON, Supabase events, recommendations, testimonials, social links), each with its own spinner or empty band, so the page reflows repeatedly | `components/home/Hero.tsx:63`; `AnnouncementBar.tsx:34`; `SocialBar.tsx:34`; `components/events/EventGrid.tsx:57` | M02-F17 |
| R-243 | MEDIUM | Context values are rebuilt on every render in both global providers — no `useMemo`, no `useCallback` — so 13 and 10 consumer trees re-render on any auth or profile change | `context/AuthContext.tsx:168-187`; `context/ProfileContext.tsx:231-254` | M01-F28 |
| R-244 | MEDIUM | `useDonationNotifications` polls Firestore every 60 seconds for 20 documents for as long as the tab is open, regardless of visibility | `hooks/useDonationNotifications.ts:32-38,75` | M01-F27 |
| R-245 | MEDIUM | Three always-on device timers: the notification count is polled every second **per mounted hook**, permissions are re-queried every 30 seconds, and the analytics queue flushes every 5 seconds and is never cleared | `lib/device/hooks/useNotifications.tsx:45`; `lib/device/permissions/index.ts:297`; `services/device-analytics.service.ts:35` | M13-F13 |
| R-246 | MEDIUM | `/display` runs eight effects, three of them holding live intervals (1 s clock, 10 s slideshow, 5 min `window.location.reload()`), on a world-readable page | `app/(public)/display/page.tsx:53-58,170-178,181-188` | M03-F17 |
| R-247 | MEDIUM | 27 of 71 public-site files import framer-motion, with 99 `<motion.*>` elements across 25 files; `SacredDivider` spins two rings forever (60 s and 45 s, `repeat: Infinity`) and is rendered eight times on the home page | counted over the chunk; `components/home/SacredDivider.tsx:29-40` | M02-F21 |
| R-248 | MEDIUM | The proof report launches five separate Chromium instances for one run, each opening its own pages | `chromium.launch` in `accessibility`, `crawler`, `pdf-generator`, `screenshot` and `seo` services, all started at `proof-report.service.ts:74-78` | M14-F17 |
| R-249 | MEDIUM | `link-validator` and `image-validator` fire unbounded concurrent `fetch`es with no retry or rate limit — on a large site this self-DoSes the target | `link-validator.service.ts:59`; `image-validator.service.ts:41` | M14-F39 |
| R-250 | MEDIUM | `data/panchanga` ships 3.1 MB across 730 JSON files that no runtime code reads — only build-time scripts — yet they are part of every clone, checkout and Vercel build context | `lib/aaradhane/panchanga.ts:65` is the only reader; the site reads `public/data/panchanga/current.json` | M14-F20 |
| R-251 | LOW | `generator.ts` schedules a 30-minute `setTimeout` per session to evict one quote-category cache entry; in a long-lived server this pins timers and memory per session, and in serverless it never fires | `lib/ai/generator.ts:978-994` | M08-F18 |
| R-252 | LOW | `getArticlePageData(slug)` is called twice per request — once in `generateMetadata` and once in the page — and the category page awaits two service calls sequentially | `app/knowledge/article/[slug]/page.tsx:13,32`; `app/knowledge/[category]/page.tsx:43-44` | M03-F24 |
| R-253 | LOW | `/favorites` imports `eventService`, `quoteService`, `galleryService` and `knowledgeService` and calls none of them; pulling `quoteService` into a client bundle drags in 1,040 lines and the Firestore client | `app/(public)/favorites/page.tsx:8-11` | M03-F19 |
| R-254 | LOW | `findDatesForLunarDate` iterates the whole 365-entry map per Guru — 19 × 365 scans per generator run | `lib/aaradhane/panchanga.ts:124` | M14-F31 |
| R-255 | LOW | `content-quality.calculateSimilarity` compares page texts pairwise, O(n²) over full visible text | `services/proof-report/content-quality.service.ts:101` | M14-F40 |
| R-256 | LOW | `useQRCodeGenerator(data, size)` lists the object `data` in its effect deps, so callers passing an inline literal regenerate the QR code on every render | `lib/device/qr/QRCode.tsx:124` vs the correct `:461` | M13-F28 |
| R-257 | LOW | `useToast`'s subscribe effect lists `[state]` as its dependency, so it unsubscribes and resubscribes on every state change | `components/ui/toast.tsx:174-182` | M01-F44 |
| R-258 | LOW | Every Vercel Blob upload uses `addRandomSuffix:false`, so two files with the same generated name overwrite each other; testimonial images are keyed by name and phone | `services/storage.service.ts:72,96,143,261`; caller `services/testimonial.service.ts:307-309` | M10-F39 |

### 2.8 F — Reliability and error handling (27 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-259 | HIGH | Errors are swallowed into `[]`/`null` with a `console.error` across the service layer — **242 `console.*` calls in 33 of 102 files** — so callers cannot distinguish "no rows" from "permission denied" or "missing index". `getSocialLinks()` even returns a plausible-looking default on both error and empty | `services/sevaBooking.service.ts:46-49`; `gallery.service.ts:117-120`; `announcement.service.ts:39-42`; `temple-areas.supabase.service.ts:20-29`; `settings.service.ts:21,131,134` | M10-F24, M02-F19, M11-F31 |
| R-260 | MEDIUM | The knowledge repository's `try/catch` turns *any* failure — missing index, rules denial, offline — into a silent fall-back to in-code `SEED_ARTICLES`, so a broken knowledge base is indistinguishable from a working one | `lib/ai/knowledge/repository.ts:91-121` | M08-F28 |
| R-261 | MEDIUM | `lib/supabase/client.ts` falls back to `https://placeholder.supabase.co` / `"placeholder"` when env vars are absent, turning a configuration error into confusing empty pages instead of a startup failure | `lib/supabase/client.ts:4-5` vs `lib/supabase/admin.ts:4-6` which throws | M04-F31, M11-F17 |
| R-262 | MEDIUM | No timeouts, retries or circuit breaking on any outbound call; the four provider `fetch` calls and every Firestore read can hang until the platform kills the request, and the chat route converts anything containing "timeout" into a 504 after the fact | `lib/ai/provider.ts:96,132,191,228`; `app/api/chat/route.ts:359-365` | M08-F29 |
| R-263 | MEDIUM | Chat history persistence failures are swallowed with an empty catch and a comment saying not to log, so a broken `messages` write is invisible in production | `components/ai/AIChatProvider.tsx:101-109` | M09-F41 |
| R-264 | MEDIUM | Errors are swallowed into `console.error` on most non-receipt admin paths, leaving the UI in a silent empty state | `app/admin/pooja/page.tsx:19-21`; `PoojaStats:18`; `AaradhaneStats:19`; `EditPooja:52,80`; `EditAaradhane:56` | M07-F38 |
| R-265 | MEDIUM | `AdminErrorBoundary` renders `error.stack` verbatim to the user and invites them to send it to the developer; `AdminPageWrapper` renders `error.message`; neither reports to any monitoring service | `components/admin/common/AdminErrorBoundary.tsx:36-41`; `AdminPageWrapper.tsx:42` | M05-F27 |
| R-266 | MEDIUM | Settings pages have no unsaved-changes protection — no dirty tracking, no `beforeunload`, no route-change confirm — while the sidebar navigates with a raw `<a href>` on desktop and `window.location.href` on mobile, forcing a full document reload. Editing the 666-line About Us form and clicking a menu item loses everything silently | `components/admin/layout/AdminSidebar.tsx:218,349-352`; any settings page | M05-F33, M05-F12 |
| R-267 | MEDIUM | `lib/settings/temple.ts:7` logs and discards its payload, and the `/admin/website-settings/temple-information` submit handler is a `console.log` — temple-settings saves are silently lost | `lib/settings/temple.ts:7-10`; `components/admin/settings/sections/TempleDetailsCard.tsx:36` | M05-F05, M10-F28 |
| R-268 | MEDIUM | `/api/admin/content` GET actions `freshness` and `review` return hardcoded placeholder JSON describing what they *would* do, and `getArticlesNeedingReview` is imported and unused | `app/api/admin/content/route.ts:12,46-71` | M09-F25, M12-F21 |
| R-269 | MEDIUM | `/api/search/suggestions` returns HTTP 500 with an empty array body, so a client cannot distinguish "no suggestions" from "broken" | `app/api/search/suggestions/route.ts:20` | M12-F40 |
| R-270 | MEDIUM | `lib/reports/report-saver.ts` calls `fetch('/api/reports/save')` with a relative URL from Node/Playwright, where relative URLs are invalid, so every export path throws at the first save; its only importer is a spec that therefore exercises a path that cannot work | `lib/reports/report-saver.ts:33`; `tests/reports/save-reports.spec.ts:18` | M14-F15 |
| R-271 | MEDIUM | Report and proof scripts default to a dead third-party sandbox host or hardcode `localhost:3000` instead of requiring an environment variable | `scripts/generate-proof-report.ts:28`; `scripts/save-report.ts:26` | M14-F16 |
| R-272 | MEDIUM | Proof-report crawling is a hardcoded list of 17 routes while the repo has 47 non-admin `page.tsx` files, and the comment above the list claims the routes are "discovered from the app directory structure" | `services/proof-report/crawler.service.ts:66,67-85`; `find app -name page.tsx \| grep -v /admin/ \| wc -l` = 47 | M14-F18 |
| R-273 | LOW | Fake loading states and fabricated progress: `/timeline` and `/live` run `setTimeout(…, 500)` over hardcoded arrays; `VideoUploader` shows a timer-driven progress bar rather than real upload progress; the `/quotes` "AI Explanation" button is a 1,500 ms timer that produces nothing; `/stotras` has a fake 500 ms load over five hardcoded stotras | `app/(public)/timeline/page.tsx:192`; `live/page.tsx:102`; `components/ui/VideoUploader.tsx:55-64`; `app/(public)/quotes/page.tsx:126-131`; `stotras/page.tsx:40,106` | M02-F30, M01-F41, M03-F05, M03-F06 |
| R-274 | LOW | `/donation/success` and `/donation/failure` are unreachable — `DonationForm` shows an in-page dialog and never navigates — and the success page promises "A receipt has been sent to your email address", which nothing sends | `app/(public)/donation/success/page.tsx:20-22`; the only references in the repo are two Playwright `page.goto` calls | M03-F08 |
| R-275 | LOW | Broken internal links on live pages: `/trust` → `/contact` (absent), `/admin/content` → `/admin/knowledge/new` (absent), `/admin/billing` "View" → `/admin/billing/{id}` (absent), the admin header search → `/admin/timings` (absent), and search FAQ results → `/knowledge/faq` (absent) | `app/(public)/trust/page.tsx:210`; `app/admin/content/page.tsx:263`; `app/admin/billing/page.tsx:332`; `components/admin/layout/AdminHeader.tsx:69`; `services/search.service.ts:346` | M02-F23, M06-F28, M07-F31, M05-F30, M02-F34 |
| R-276 | LOW | `/events?filter=past` is linked from the navbar but `EventGrid` never reads `useSearchParams`, so the link lands on the default "upcoming" view | `components/layout/Navbar.tsx:82` vs `components/events/EventGrid.tsx:27` | M02-F24 |
| R-277 | LOW | The receipt create form is `<form onSubmit={goToPay}>` and `goToPay()` takes no event and never calls `preventDefault()`, so pressing Enter triggers a native submit and a full page reload, losing the entered receipt | `app/admin/receipts/create/page.tsx:156-163,320` | M07-F29 |
| R-278 | LOW | `billingService` uses the deprecated `String.prototype.substr` and `Date.now().toString()` as an id, which collides for two items created in the same millisecond | `services/billing.service.ts:149,199,242` | M07-F39 |
| R-279 | LOW | `NotificationDropdown` declares `hasError` state and an early `return null` on it that nothing ever sets; the mobile search button has an `aria-label` and no `onClick` | `components/admin/layout/NotificationDropdown.tsx:25,40-42`; `AdminHeader.tsx:146-151` | M05-F29 |
| R-280 | LOW | `SevaReceipt.printReceipt()` replaces `document.body.innerHTML`, prints, then restores it — destroying and remounting the whole React tree and losing every event handler | `components/home/SevaReceipt.tsx:93-100` | M02-F29 |
| R-281 | LOW | `getStatusBadge` interpolates `style.text` — a label like `"Draft"` — into `className`, so every badge carries a junk class | `app/admin/billing/page.tsx:122-137` | M07-F28 |
| R-282 | LOW | `UserRoleBadge` indexes its colour map with no fallback, so a role written by `set-role` renders an unstyled pill | `components/admin/users/UserRoleBadge.tsx:7-21,26` | M04-F28 |
| R-283 | LOW | `TempleButton`'s `outline` variant uses `border-gradient-to-r`, which is not a Tailwind class, so the variant has no border | `components/ui/TempleButton.tsx:60` | M01-F39 |
| R-284 | LOW | `SectionTransition` spreads the initial offset into its `animate` target and then overrides it with `y:0, x:0` | `components/ui/PageTransition.tsx:123` | M01-F40 |
| R-285 | LOW | An unescaped entity in JSX (`doesn't`) will fail `react/no-unescaped-entities` under `npm run lint` | `app/(public)/notifications/page.tsx:183` | M13-F34 |

### 2.9 G — Accessibility and UX (25 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-286 | MEDIUM | `FocusTrap` derives its container from `(children as any)?.props?.ref` — not a real React API — so the guard never engages and no modal in the app is focus-trapped, despite the app advertising a11y support | `components/common/A11yProvider.tsx:120-163`; the working `useFocusTrap` sits unused at `hooks/a11y/index.ts:54` | M01-F21 |
| R-287 | MEDIUM | Two live regions are mounted at once; `A11yProvider.announce()` pushes `JSON.stringify({message,priority})` into one, so a screen reader reads raw JSON, and nothing ever dispatches the event the other listens for, so it is permanently empty | `components/common/A11yProvider.tsx:39,54-63,168-192`; `app/layout.tsx:85` | M01-F22 |
| R-288 | MEDIUM | The Navbar's five dropdowns are `<button>` plus a conditional `<div>` with no `aria-expanded`, `aria-haspopup`, `role="menu"`, Escape handling or arrow-key navigation — all four are mandated by the UI guidelines | `components/layout/Navbar.tsx:207-218,248-259,300-310,352-362,392-401`; `docs/UI-GUIDELINES.md` "Keyboard Navigation" | M01-F23 |
| R-289 | MEDIUM | The globally mounted `SkipLink` always targets `#main-content`, but only two layouts render that id. On `/calendar`, `/calendar/ekadashi`, `/calendar/festivals`, `/knowledge`, `/debug` and every `(auth)` route the first keyboard stop is a dead link | `app/layout.tsx:84`; `components/common/A11yProvider.tsx:79-95`; ids at `app/(public)/layout.tsx:12` and `app/admin/layout.tsx:26` only | M01-F47 |
| R-290 | MEDIUM | Nested `<main>` landmarks in both shells: the public layout renders `<main id="main-content">` and 24 child pages render their own; `AdminShell` renders `<main>` and the admin layout renders another inside it. Two `main` elements per page breaks landmark navigation | `app/(public)/layout.tsx:12` vs 24 child pages; `components/admin/layout/AdminShell.tsx:50` vs `app/admin/layout.tsx:26` | M03-F21, M05-F14 |
| R-291 | MEDIUM | No dialog in the product is a real dialog: `FormDialog` is a bare fixed overlay with no focus trap, Escape handler, `role="dialog"`, `aria-modal` or backdrop click; the gallery, album and temple-area dialogs are the same; the testimonial modal and gallery lightbox trap no focus; and the chat window sets `aria-modal="true"` and `role="dialog"` while trapping nothing and never moving focus | `components/admin/common/FormDialog.tsx:20-37`; `components/admin/gallery/AlbumDialog.tsx:100-146`; `components/home/Testimonials.tsx:232+`; `components/ai/ChatWindow.tsx:54-56` | M05-F28, M06-F24, M09-F34, M02-F20 |
| R-292 | MEDIUM | Accessible names and labels are largely absent: 51 `<button>` elements against 11 `aria-*` attributes and a single `role=` across the 71 public-site files; icon-only action buttons throughout the admin tables carry only a `title`; `<Label>` without `htmlFor`; table headers with no `scope` and no caption; and a "Remember me" checkbox bound to nothing | counted over the chunk; `components/admin/gallery/AlbumGrid.tsx:86-100`; `components/admin/users/UserTable.tsx:18-26`; `components/auth/LoginForm.tsx:128-145` | M02-F20, M06-F24, M07-F35, M04-F35 |
| R-293 | MEDIUM | `prefers-reduced-motion` is honoured in 3 of the 27 files that import framer-motion, while `docs/UI-GUIDELINES.md:354` says "Always respect" | `useReducedMotion` present only in `Hero.tsx`, `TempleInfo.tsx`, `TempleTimings.tsx` | M02-F21 |
| R-294 | MEDIUM | `QuickQuestionIcons` opens only on `onMouseEnter`/`onMouseLeave` with `pointerEvents` gated on hover — no keyboard focus and no tap target — while the welcome screen tells devotees to "hover over the left panel"; on a phone the rail also overlaps the open chat panel and cannot be dismissed | `components/ai/QuickQuestionIcons.tsx:55-66`; `components/ai/ChatWindow.tsx:48-51,180` | M09-F33, M09-F45 |
| R-295 | MEDIUM | Destructive confirmation is inconsistent and sometimes absent: `TableActions` calls `onDelete` with no confirmation at all; ten call sites across nine settings pages use the bare global `confirm(...)`; `window.confirm`/`alert()` appear in the user, event and gallery paths while the rest of the app uses `react-hot-toast` | `components/admin/crud/TableActions.tsx:52-63`; `app/admin/settings/finance/page.tsx:133`; `components/admin/users/DeleteUserDialog.tsx:20`; `EventForm.tsx:134,145,179`; `docs/ADMIN-GUIDELINES.md:370` | M04-F27, M05-F22, M06-F20 |
| R-296 | MEDIUM | `CrudTable` is a table skeleton only: no sorting UI (`enableSorting` is set but no header is clickable), no pagination, no row selection, no loading skeleton, and `CrudColumn.width`/`.align` are declared and never read — while `docs/ADMIN-GUIDELINES.md:82-208` specifies all of them | `components/admin/crud/CrudTable.tsx:25-89`; `types/crud.ts:40-45` | M05-F20 |
| R-297 | MEDIUM | `StatusBadge` keys on capitalised English display strings (`"Active"`, `"Paid"`) while the domain enums are lowercase, so any column passing a raw enum renders the grey fallback — and the component is untranslatable by construction | `components/admin/crud/StatusBadge.tsx:12-53` vs `types/donation.ts:1-4` | M05-F21 |
| R-298 | MEDIUM | `UserForm` has no validation at all — an empty name or email can be saved — while the public forms use zod | `components/admin/users/UserForm.tsx:34-56` | M04-F26 |
| R-299 | MEDIUM | Route protection is inconsistent and partly inverted: `GuestOnly` renders children for signed-in users too, so `/register` is reachable while authenticated; `ProtectedRoute` is dead; and four devotee pages re-implement the check with two different predicates that can disagree while the profile loads | `components/auth/GuestOnly.tsx:42-43`; `components/auth/ProtectedRoute.tsx` (no importer); `app/(public)/profile/page.tsx:23` vs `favorites/page.tsx:107` | M04-F13, M04-F14, M03-F11 |
| R-300 | MEDIUM | The desktop sidebar is `lg:w-68` (272 px) while the content column is padded `lg:pl-64` (256 px), so the sidebar overlaps the content by 16 px at every `lg` breakpoint | `components/admin/layout/AdminSidebar.tsx:162` vs `AdminShell.tsx:48` | M05-F13 |
| R-301 | MEDIUM | `AdminAuthGuard` is applied up to three times on a single settings page and twice on billing — three auth subscriptions and three spinner states for one navigation | `app/admin/layout.tsx:24`; `app/admin/settings/layout.tsx:12`; `app/admin/settings/page.tsx:165`; `app/admin/billing/layout.tsx:12` and `page.tsx:369` | M05-F31, M07-F26 |
| R-302 | MEDIUM | The admin header's "search" is a keyword-to-route jump table, one of whose targets does not exist, while the real results panel component is dead | `components/admin/layout/AdminHeader.tsx:69`; `components/admin/dashboard/AdminSearchResults.tsx` (0 importers) | M05-F30 |
| R-303 | MEDIUM | Raw `<img>` used instead of `next/image` in the shared uploader, the CRUD image cell and three public pages, against `AGENTS.md`'s "Optimize images with next/image"; `EventCard` renders no image at all although `TempleEvent.imageUrl` exists | `components/ui/ImageUploader.tsx:132,138`; `components/admin/crud/CrudTableCell.tsx:81`; `app/(public)/search/page.tsx:250`; `components/home/TestimonialSubmissionForm.tsx:292`; `components/recommendation/RecommendationCard.tsx:65` | M01-F30, M06-F24 |
| R-304 | LOW | Uploader identity is faked in two places — `MediaGrid` passes the literal `"admin"` and `MediaDialog` sets `uploadedBy: "admin"` — so `galleryMedia.uploadedBy` is meaningless for anything created through the dashboard | `components/admin/gallery/MediaGrid.tsx:43`; `MediaDialog.tsx:126`; the correct version is `app/admin/gallery/new/page.tsx:26` | M06-F22 |
| R-305 | LOW | `GalleryToolbar`'s "Add Media" button has no `onClick`; the working one lives inside `MediaGrid` | `components/admin/gallery/GalleryToolbar.tsx:43-46` vs `MediaGrid.tsx:69` | M06-F21 |
| R-306 | LOW | `BookingDetails` and `DonationDetails` refresh with `window.location.reload()` after a mutation | `components/admin/bookings/BookingDetails.tsx:34`; `components/admin/donations/DonationDetails.tsx:34` | M07-F33 |
| R-307 | LOW | `key={index}` on editable calendar rows, plus unlabelled bulk-select checkboxes and native `<select>` filters with no `<label>` | `app/admin/calendar/ekadashi/page.tsx:165`; `app/admin/sevas/page.tsx:182-187`; `app/admin/bookings/page.tsx:127-152` | M07-F35 |
| R-308 | LOW | The spinner markup is copy-pasted six times repo-wide and the amber page-background gradient nine times, across both the admin and the auth screens | `app/admin/layout.tsx:14`; `AdminAuthGuard.tsx:27`; `app/(auth)/login/page.tsx:7`; `components/auth/GuestOnly.tsx:15`, `LoginForm.tsx:95`, `ProtectedRoute.tsx:18` | M05-F32 |
| R-309 | LOW | The visual language has no rules: four band heights (`py-24/20/16/12`), five container widths so the site changes width as you navigate, three radius vocabularies including one-off pixel values, `h1` sizes from `text-2xl` to `text-6xl`, `shadow-2xl` used 19 times though the docs define four levels, and eight unrelated hues in one tile set. The section-header, hero and card patterns are copy-pasted rather than componentised | measured across the 71 public-site files; `docs/UI-GUIDELINES.md:92` | M02 visual inventory |
| R-310 | LOW | `Hero` hand-rolls scroll tracking with `new MotionValue(0)` and a manual scroll listener "to avoid hydration errors", duplicating framer-motion's `useScroll` and an unused in-repo hook | `components/home/Hero.tsx:28-58` vs `hooks/useInViewAnimation.ts:48` | M02-F26 |

### 2.10 H — Tooling and CI (22 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-311 | HIGH | **Playwright's config is never applied.** `testDir: './tests/e2e'` resolves relative to the config's own folder, giving `tests/tests/e2e`, which does not exist; there is no root `playwright.config.*`, and `package.json` calls `playwright test <path>` with no `--config`. Every invocation silently falls back to Playwright defaults — no projects, no reporters, no baseURL | `tests/playwright.config.ts:9`; `ls playwright.config.*` → not found; `package.json:21` | M15-F01 |
| R-312 | HIGH | Production deploy has no quality gate: a push to `main` goes straight to `vercel deploy --prod` with no lint, typecheck or test step | `.github/workflows/deploy.yml:3-6,23-36` | M15-F02 |
| R-313 | HIGH | 13 test files point at dead OpenHands sandbox hosts; 11 ignore the environment entirely and can never pass again, and one of them (`tests/unit/proof-report.test.ts:11`) runs under `npm test`. The AI UAT workflow defaults `E2E_BASE_URL` to the same dead host and is `continue-on-error`, so it passes anyway | `grep -rl all-hands.dev tests/` → 15; `tests/functional/01_homepage.spec.ts:3` and nine siblings; `.github/workflows/ai-uat.yml:26,85` | M15-F03, M09-F24, M15-F22 |
| R-314 | HIGH | `npm run typecheck` does not check the tests or the scripts — `tsconfig.json` excludes both — so ~20k lines of test code and every seeding and migration script are unchecked, and the "Types Check passes" gate in `AGENTS.md` is hollow | `tsconfig.json` `"exclude": ["node_modules","tests/**/*","jest.config.ts","scripts/**/*"]`; `package.json:11` | M15-F04, M01-F42 |
| R-315 | HIGH | The "no `any`" rule the whole contributor contract is built on is switched off for the entire source tree (`app`, `components`, `hooks`, `lib`, `services`, `types`, `scripts`), and roughly **300 typed `any` occurrences** follow — 119 in the service/type catalogue alone, 25 route files, 23 in the devotional module, 21 in the public site | `eslint.config.mjs:18-34` vs `AGENTS.md` Quick Reference and `docs/CODING-STANDARDS.md:76`; per-module counts | M01-F10, M15-F05, M02-F28, M03-F20, M04-F20, M05-F25, M06-F16, M07-F22, M08-F19, M09-F26, M10-F32, M11-F26, M12-F23, M13-F22, M14-F19 |
| R-316 | MEDIUM | No workflow runs `tests/unit` (17 files, ~499 tests), `tests/e2e` (33 files) or `tests/functional` (11 files). The only test command in CI runs one file, and only when `lib/ai/**` changes | `.github/workflows/ai-uat.yml:6-17,50`; no other workflow invokes `npm test` | M15-F23 |
| R-317 | MEDIUM | That one CI test command may not compile: `fix-websocket.ts` injected `import WebSocket from "ws"` as line 1 of the test file, `ws` ships no declarations, and `@types/ws` is in neither `package.json` nor `package-lock.json` — under the root `"strict": true` that raises TS7016 | `tests/ai-uat/ai-uat.test.ts:1`; `package.json:97`; `grep -n "@types/ws" package.json package-lock.json` → no hit; `jest.config.ts:11-17` | M15-F38 |
| R-318 | MEDIUM | Effectively zero unit coverage of the application: of 17 `tests/unit` files, none import `@/app`, `@/components`, `@/hooks`, `@/utils` or `@/context`, and exactly one imports `@/services`; coverage is collected only from `lib/ai/**`. One 21-test file titled "AI Analytics Service" never imports the service and asserts on its own local literals | `jest.config.ts:20-23`; `tests/unit/ai-analytics.test.ts:1-35` | M15-F09, M15-F10 |
| R-319 | MEDIUM | 16 spec files have no runner: because the config never applies, a bare `npx playwright test` *would* collect them and one shell script does exactly that — but no npm script and no workflow ever invokes it, so a third of the suite is unreachable | `tests/comprehensive_validation.spec.ts`, `tests/e2e_test.spec.ts`, `tests/kannada-font-validation.spec.ts`, `tests/quick_validation.spec.ts`, `tests/reports/save-reports.spec.ts`, `tests/functional/*.spec.ts` (11); `tests/run_e2e_tests.sh:53` | M15-F11 |
| R-320 | MEDIUM | The Playwright API-contract suite is written against endpoints that do not exist (`/api/sevas`, `/api/admin/events`, `/api/admin/settings`, `/api/auth/login`, `/api/v1/events`, `/api/health`), and asserts `status === 200` on one that can only 404 — so it cannot be passing and gives no contract assurance | `tests/e2e/sprint5/api-contract.spec.ts:52-53,169,317,319,329,353`; `tests/functional/09_performance_security.spec.ts:377` | M12-F45 |
| R-321 | HIGH | The AI E2E spec cannot even load — `describe` is used 15 times and never imported — and its message locator matches nothing the widget renders, so `sendMessage` always returns `""` and every assertion fails | `tests/ai-uat/ai-uat.spec.ts:6,150`; no `data-testid` in `components/ai/` | M09-F06, M09-F23 |
| R-322 | HIGH | The 275-case UAT suite never checks the expected intent — each test asserts only that `intent` is defined and `confidence > 0` — while `AI_UAT.md:488-493` claims a >95% intent-accuracy pass criterion. The runner also has a tautological language check and hardcodes `coverage: 100` | `tests/ai-uat/ai-uat.test.ts:187-331`; `tests/ai-uat/run-uat-tests.ts:144-148,203,225` | M09-F07, M09-F29 |
| R-323 | MEDIUM | Lighthouse CI cannot fail meaningfully: both jobs mark the build `continue-on-error: true`, and the budget files set `staticDistDir` while the action is handed live URLs — mutually exclusive collection modes | `.github/workflows/lighthouse-ci.yml:46-47,59-68,97-99,111-114`; `lighthouse-budget.json:3-7` | M15-F18 |
| R-324 | MEDIUM | Four of the five Python report generators hardcode a foreign sandbox path (one opens it at module import, so importing it crashes anywhere else), one embeds a specific past run's numbers as literals and writes them out as a fresh report, and there is no `requirements.txt` for `openpyxl`/`requests`. `reports/generate_lint_reports.py` has the same problem and its outputs are frozen at 2026-07-13, two months stale | `tests/generate_reports.py:15,358,…`; `tests/generate_playwright_report.py:14-30`; `reports/generate_lint_reports.py:16`; `find . -name "requirements*.txt"` → none | M15-F12, M15-F13, M14-F23 |
| R-325 | MEDIUM | E2E assertions are routinely guarded by `if (count > 0)`, so a missing feature yields a green test — 29 such guards across 20 tests in the chatbot spec, 25 across 31 in the admin-expanded spec, 16 across 34 in admin-crud | per-file grep counts, re-run 2026-09-19 | M15-F34 |
| R-326 | MEDIUM | The Postman collection covers 63 of 95 routes (66%) and contains one request for a route that does not exist; all 15 quotes routes, all 5 receipts routes and both temple-areas pairs are absent | script comparison of collection URLs against all 95 `app/api/**/route.ts`; the orphan is `/api/admin/knowledge/approve` | M15-F16 |
| R-327 | MEDIUM | Dependabot ignores every major version bump for every dependency, so Next, React and Firebase majors will never be proposed | `.github/dependabot.yml:8-10` | M15-F30 |
| R-328 | LOW | Three checked-in artefacts give three different lint results for the same codebase (60 issues/12 errors, 98/3, 39 errors/347 warnings) | `reports/LintReport.md`; `reports/LintExecutiveSummary.md`; `docs/QUALITY_ASSESSMENT_REPORT.md:224` | M15-F14 |
| R-329 | LOW | `tsconfig.tsbuildinfo` (460 KB) and the whole `reports/` folder are committed and `.gitignore` covers neither; and `FIRESTORE_IMPORT.md` tells the operator to save a service-account key under a filename `.gitignore` does not match | `.gitignore` (47 lines); `FIRESTORE_IMPORT.md:62` vs `.gitignore:41` | M15-F28, M11-F27 |
| R-330 | LOW | `tests/quick_validation.sh` defaults to port 3456 while the other twelve occurrences in `tests/` use 3000 | `tests/quick_validation.sh:7` | M15-F37 |
| R-331 | LOW | The Aaradhane workflow writes a service-account JSON into the checkout as `firebase-admin-key.json` and never removes it, and embeds 130 lines of Python that re-implement `scripts/panchanga.py` and will silently desynchronise from it | `.github/workflows/aaradhane.yml:94-218,232-233,247` | M14-F13, M14-F14 |
| R-332 | LOW | No test anywhere covers `lib/device` or `lib/i18n` — not the Haversine maths, the ICS escaping, the QR payload parser or the dictionary loader | no file under `tests/` references either path | M13-F33 |

### 2.11 I — Documentation drift (18 rows)

| # | Sev | Fault | Evidence | Source ids |
|---|---|---|---|---|
| R-333 | HIGH | `docs/SECURITY.md` describes a system that does not exist: an authorization middleware, Google OAuth "enabled", secure session cookies with 24-hour expiry, an 8-character password minimum, an Upstash Redis rate limiter with a per-endpoint table, and zod server-side validation. None of the six is in the repository | `docs/SECURITY.md:25,28-38,47,110-130,302,315-345,418-453`; `grep -rn zod app/api` → 0; no `middleware.ts`; `components/auth/RegisterForm.tsx:28` enforces 6 | M04-F22, M12-F13 |
| R-334 | HIGH | `docs/API.md` documents 4 endpoints across 3 of the 95 route files and is otherwise the only API reference — and it publishes a working production cURL for the two unauthenticated user-management endpoints | `docs/API.md:12-17,55-60,106,135,169-181` vs 95 route files | M12-F14, M04-F38 |
| R-335 | MEDIUM | Five documents state the framework is Next.js 14; `package.json` pins `next: ^16.2.9` with React 19.2.4, the `proxy.ts` convention and Tailwind v4 with no `tailwind.config.*`. Only one report in the repo gets it right. A version claim off by two majors invalidates every API recipe beneath it | `AGENTS.md:213`; `docs/ARCHITECTURE.md:18`; `docs/PROJECT_STRUCTURE.md:5,229`; `docs/QUALITY_ASSESSMENT_REPORT.md:13`; `.openhands/project-context.md:43` vs `package.json:55,59,92` | M01-F46, M15-F15 |
| R-336 | MEDIUM | `docs/DATA-MODEL.md` is materially wrong about the shipped schema: it documents a `panchanga` collection that does not exist, gives `sevaBookings` five fields the types do not have and a `paymentStatus` value the code does not use, names `donationCampaigns` where the code uses `donation_campaigns`, lists donation fields `DonationRecord` lacks (including the 80G fields a temple actually needs), documents 14 collections against 50+ in code, never mentions `receipts`, `bills`, `system/receiptCounter` or `dailyPoojas`, and claims Firestore is the primary database with no mention of Supabase | `docs/DATA-MODEL.md:20,76-118,122-170,385-420,708-742,800,820-823` vs `types/seva-booking.ts:1-31`, `types/donation.ts:13-42`, `services/donationCampaign.service.ts:21`, `firestore.rules:102,108,142` | M03-F12, M03-F13, M07-F40, M11-F18 |
| R-337 | MEDIUM | `docs/ARCHITECTURE.md` declares an `IService<T>` contract (`getAll/getById/create/update/delete`) and shows `eventService.getAll()`. No service implements the interface and that method does not exist on any of them | `docs/ARCHITECTURE.md:188-203` vs `services/event.service.ts:42`, `seva.service.ts:9`, `pooja.service.ts:40`, `billing.service.ts:92` | M10-F26 |
| R-338 | MEDIUM | `docs/ADMIN-GUIDELINES.md` prescribes a sidebar tree matching neither live file, a `usePermissions()` hook that does not exist, audit logging that exists nowhere in admin code, and a `sonner` toast example while all 66 call sites use `react-hot-toast` | `docs/ADMIN-GUIDELINES.md:16-49,347,481-558,688`; `ls hooks/`; `grep -rn "from \"sonner\""` → 0 | M05-F23 |
| R-339 | MEDIUM | `docs/UI-GUIDELINES.md` documents `<DataTable>`/`<DataTableHeader>`, shadcn `<Sidebar>` primitives, Card variants, Button sizes, a font-family variable and a `useReducedMotion` return shape that do not exist, plus an npm script name that is wrong; `docs/PROJECT_STRUCTURE.md:64` lists a `components/shared/` folder that is not on disk | `docs/UI-GUIDELINES.md` vs `components/ui/table.tsx:107-116`, `card.tsx`, `button.tsx:17`, `app/globals.css:87`, `hooks/useReducedMotion.ts:9`, `package.json:11` | M01-F45 |
| R-340 | MEDIUM | The four AI documents describe a system that is not the one running: a hybrid retrieval chain ending in an LLM, "Semantic Embeddings — OpenAI/sentence-transformers ✅ Done" (the implementation is Jaccard overlap plus a keyword table), a donations collection the AI never reads, a "Response Source: AI Provider or Firebase Fallback" that is neither, and a bilingual `KnowledgeArticle` shape with `title.en/.kn` that the code does not have | `docs/AI-GUIDELINES.md:38,41-52,229-244`; `docs/AI_ENHANCEMENTS.md:53`; `docs/AI_ARCHITECTURE_AUDIT.md`; vs `services/ml.service.ts:126-160`, `lib/ai/retrieval/donations.ts:31-78`, `app/api/admin/knowledge/route.ts:29-40` | M08-F27, M09-F42, M08-F04 |
| R-341 | MEDIUM | `docs/SUPABASE_DATABASE_SCHEMA.md:339-341` mandates that all Supabase access be server-side behind a Firebase token check; four runtime modules import the browser anon client | cited lines vs `services/event.service.ts:2`, `settings.service.ts:1`, `ai-analytics.service.ts:19`, `lib/ai/ai-settings/repository.ts:1` | M04-F32 |
| R-342 | MEDIUM | `docs/QUOTE-ENGINE.md:486` claims the admin quote endpoints "require auth" (they do not, and they trust an unverified `x-user-email` header), and `docs/QUOTE-ENGINE.md:11` describes the `/quotes` page as Firestore-driven while it renders five hardcoded quotes and ignores the entire quote engine | `docs/QUOTE-ENGINE.md:11,486` vs `app/api/admin/quotes/route.ts:46`, `app/(public)/quotes/page.tsx:29,76` | M06-F03, M03-F05 |
| R-343 | MEDIUM | `AI_UAT.md` claims a >95% intent-accuracy pass criterion the suite cannot enforce and documents CLI flags (`--category=1`, `--coverage`, `--report`) that the runner does not parse — it reads no `process.argv` at all | `AI_UAT.md:465-478,488-493` vs `tests/ai-uat/run-uat-tests.ts` | M09-F07, M09-F30 |
| R-344 | MEDIUM | `docs/DEPLOYMENT.md` and `docs/CHANGELOG.md` are **0 bytes** while `AGENTS.md` declares `docs/` authoritative. There is no deployment runbook anywhere — no env-var list, no Vercel project notes, no secrets inventory, no rollback procedure — and `docs/SPRINT-5-DEPLOYMENT.md` is a feature doc despite its name | `wc -c docs/CHANGELOG.md docs/DEPLOYMENT.md` → 0 | M15-F17 |
| R-345 | MEDIUM | `docs/ROADMAP.md` deprecates two files that are not on disk, lists shipped features as unbuilt (Analytics Dashboard, Testimonials), and contradicts itself on dates (v1.0 completed January 2025 at `:17`, 2025 Q4 at `:180`) | `docs/ROADMAP.md:17,106,128,180,236-238` | M15-F31 |
| R-346 | LOW | The Aaradhane and Panchanga documents promise commands that do not exist (`npm run export:aaradhane`) or do not work (`python scripts/generate_panchanga.py` has no `--year` flag, and the runtime error message tells the operator to run it), and `docs/PANCHANGA.md` documents three daily crons while the workflow has four, none of them matching | `AARADHANE_QUICKREF.md:13`; `AARADHANE_GENERATOR.md:59`; `FIRESTORE_IMPORT.md:6-8`; `lib/aaradhane/panchanga.ts:70`; `docs/PANCHANGA.md:270-273` vs `.github/workflows/panchanga.yml:6-9` | M14-F21, M14-F42, M15-F32 |
| R-347 | LOW | `docs/AI_ASSISTANT.md` carries no date stamp at all — the one `docs/` file with neither a "Last Updated" line nor any date in its prose — so its currency cannot be judged | `docs/AI_ASSISTANT.md:1-6` | M15-F36 |
| R-348 | LOW | `FIRESTORE_IMPORT.md` tells the operator to import Aaradhane events into the `aaradhanes` collection, but every generator and service writes them to `events` | `FIRESTORE_IMPORT.md:31` vs `lib/aaradhane/firestore.ts:28` | M11-F27 |
| R-349 | LOW | `panchanga.yml`'s comment says "every 2 hours at minute 30" while the cron list is four fixed daily times | `.github/workflows/panchanga.yml:5-9` | M15-F29 |
| R-350 | LOW | The July quality report's P0 SEO item is still open two months later; `reports/test_results.json` also records Open Graph title, description and image and the canonical URL all failing | `docs/QUALITY_ASSESSMENT_REPORT.md:186`; `reports/test_results.json` | M15-F20 |

---
## 3. Target architecture

### 3.1 The layering to aim for

The current design fails in one specific way: **there is no layer that both a browser and a phone could
talk to.** Page data is read by importing a service that builds its own Firestore or Supabase client in
whatever process imports it. That is why 41 files hold the SDK, why `firestore.rules` is the only access
control, and why a second client is impossible without duplicating every business rule.

The target is five layers with one rule each:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. DOMAIN            types, enums, validation, pure maths              │
  │                      RULE: no import of next/*, firebase/*, react, DOM │
  ├────────────────────────────────────────────────────────────────────────┤
  │ 2. DATA ACCESS       repositories over Firestore/Supabase, admin creds  │
  │                      RULE: server-only. Never imported by a component. │
  ├────────────────────────────────────────────────────────────────────────┤
  │ 3. API               route handlers: authenticate, validate, call a     │
  │                      repository, map to the domain type, one envelope   │
  │                      RULE: every write is authenticated. No exceptions. │
  ├────────────────────────────────────────────────────────────────────────┤
  │ 4. API CLIENT        typed fetch services + auth token + error mapping  │
  │                      RULE: platform-free. `receipt.service.ts` already  │
  │                      has this shape — it is the template.               │
  ├────────────────────────────────────────────────────────────────────────┤
  │ 5. UI                web (Next) and native (Expo), each with its own    │
  │                      renderer over a shared design-token package        │
  └────────────────────────────────────────────────────────────────────────┘
```

Two of these already exist in embryo and should be recognised as such rather than rebuilt:

- **Layer 1** is `types/` (37 of 42 files are already platform-free) plus the pure logic already scattered
  through `services/` and `lib/`: `ml` (453), `ux` (366), `content` (371), `recommendation` (497), `search`
  (410), `multi-source-retrieval` (586) and `knowledge` (286) — ~2,970 lines that move untouched — plus
  `lib/receipt/{numbering,validation,upi}.ts`, `types/festival.ts`'s date maths, `lib/festival-utils.ts`,
  and the lunar-matching core of the Aaradhane generator.
- **Layer 4** exists exactly once: `services/receipt.service.ts` and `services/receiptSeva.service.ts` are
  typed `fetch` wrappers with a bearer token. The only change they need for a phone is an absolute,
  configurable `BASE_URL`.

### 3.2 Monorepo layout

```
temple-portal/
├─ apps/
│  ├─ web/                      the current Next.js app, minus what moves out
│  └─ mobile/                   Expo (React Native), devotee-facing first
├─ packages/
│  ├─ domain/                   types/*, enums, zod schemas, pure maths
│  │                            ← types/, lib/receipt/{numbering,validation,upi}.ts,
│  │                              types/festival.ts helpers, lib/festival-utils.ts,
│  │                              the Aaradhane lunar matcher, lib/format.ts
│  ├─ api-client/               typed fetch services, auth-token injection,
│  │                            error mapping, one response envelope
│  │                            ← receipt.service.ts + receiptSeva.service.ts as the
│  │                              template; every other browser-side service rewritten
│  │                              into this shape
│  ├─ logic/                    ml, ux, content, recommendation, search,
│  │                            multi-source-retrieval, knowledge  (pure, server or client)
│  ├─ ai-engine/                lib/ai/generator + lib/ai/intent + prompts
│  │                            (server-side; the phone calls /api/chat)
│  ├─ tokens/                   colour ramp, spacing, radii, type scale, motion
│  │                            durations/easings as a TS object — NOT Tailwind strings
│  ├─ i18n/                     lib/i18n/* + the 275×3 dictionaries (already portable)
│  └─ config/                   navigation manifest, feature flags, route names
├─ server/
│  ├─ data/                     repositories on firebase-admin / Supabase service role
│  │                            ← the ~20 Firestore CRUD services, rewritten server-side
│  └─ jobs/                     panchanga, aaradhane, proof-report, seeders, migrations
└─ infra/                       firestore.rules, indexes, storage.rules, supabase/migrations
```

What moves where, concretely:

| From | To | Note |
|---|---|---|
| `types/*.ts` (37 files) | `packages/domain` | First strip the `firebase/firestore` `Timestamp` import from five files (R-168) and move the embedded content data out (R-169) |
| `services/{ml,ux,content,recommendation,search,multi-source-retrieval,knowledge}.service.ts` | `packages/logic` | No changes needed |
| `services/receipt.service.ts`, `receiptSeva.service.ts` | `packages/api-client` | Make `BASE_URL` absolute and injectable |
| The other ~20 Firestore CRUD services | **split**: query logic to `server/data`, a thin `fetch` twin to `packages/api-client` | This is the single biggest piece of work and the one that unblocks mobile |
| `lib/ai/**` (generator, intent, retrieval, prompts) | `packages/ai-engine` + `server/data` | The retrieval modules keep their logic and lose their direct SDK handles |
| `lib/receipt/pdf.ts`, `admin.ts`, `lib/aaradhane/firestore-admin.ts`, `lib/services/{email,whatsapp}.ts` | `server/` only | Receipt numbering, rate resolution and PDF rendering must never run on a device |
| `app/globals.css` token values, `lib/formStyles.ts`, `lib/animations.ts` | `packages/tokens` | Convert `oklch()` to hex; the motion durations and easings translate to Reanimated directly |
| `components/layout/Navbar.tsx:16-44`, `Footer.tsx:36-54`, `AdminSidebar.tsx:37-104` | `packages/config/navigation.ts` | Three hand-maintained copies become one data file (R-117) |
| `lib/i18n/**` | `packages/i18n` | Already portable; Metro bundles the JSON |
| `data/panchanga/**` | `server/jobs` + an HTTP endpoint | 730 files must leave the client build context (R-250) |

### 3.3 Sequencing — what must be true before any mobile work starts

The order is not negotiable, because each step removes a reason the next one would have to be redone.

1. **Security first (R-001 … R-017).** Rotate the service-account key and the Web API key; delete the two
   bootstrap routes; delete `/debug`, `/admin/test`, `/admin/test-firebase`; fix the duplicated
   `firestore.rules` blocks and `storage.rules`. A second client multiplies every one of these; a phone
   binary is also far harder to patch than a web deploy.
2. **Server-side authorization (R-010, R-011).** A `middleware.ts` or a shared route wrapper that verifies
   a Firebase ID token and a role claim, applied to every non-GET handler and every privileged GET. Mobile
   *cannot* rely on "the admin UI only shows this button to admins" — the client-side guard is the only
   authorization that exists today.
3. **Finish the store migration (R-049, R-050, R-051, R-070, R-071, R-072).** Two clients reading different
   truths from a split-brain domain is a support nightmare that no amount of UI work hides. Decide the
   owner per domain, migrate, and delete the loser.
4. **The API contract (§6).** One envelope, real pagination, typed errors, and the 20 missing endpoint
   families. This is what the phone actually talks to.
5. **The services boundary.** Rewrite the browser-side services into `packages/api-client`, and move the
   query logic into `server/data` behind the routes. After this, `firestore.rules` stops being the
   application's authorization layer and becomes a defence in depth.
6. **Extract `packages/*`.** Mechanical once 1–5 are done, and pointless before.
7. **Then, and only then, the Expo app.**

### 3.4 What to leave alone

- **`lib/ai/generator.ts` and `lib/ai/intent/**`.** 3,295 lines of pure, working classification and
  formatting. Fix the specific defects (R-077, R-134, R-132) but do not restructure it.
- **The Panchanga Python pipeline and the GitHub Actions content jobs.** They are the only non-JavaScript
  part of the product and they work; fix R-069 and R-331 and leave the design.
- **`firestore.rules` and `firestore.indexes.json` as a concept.** They are the one artefact both clients
  share unchanged. Correct them (R-004, R-070, R-092), do not replace them.
- **The receipt pipeline's server-side boundary.** Receipt numbering (`lib/receipt/admin.ts:45-58`), rate
  resolution (`:78-117`) and PDF rendering are already server-only and must stay that way.
- **Supabase SQL migrations.** Platform-neutral and the most portable asset in the data layer; fix the
  ordering (R-093) and the duplicate table (R-072), keep the mechanism.
- **The 275-case AI UAT corpus.** Pure data; it becomes the conformance suite for the mobile chat surface.

---

## 4. React Native options and recommendation

### 4.1 The four options, one gate, the same criteria

**The gate.** All four options are scored at **the end of Phase 2 — Friday 2026-12-11** (§7.4): server-side
auth, the API contract, the services boundary and the store consolidation in place. That gate is used
because **the Phase-2 work is required whatever is chosen** — §3.3's order and §7.3's phases 0–2 are common
to all four, and no second client of any kind, Expo binary or WebView shell, can ship over a codebase where
88 of 95 route files perform no identity check.

Two consequences. **Costs below are incremental from the gate**, with the gross figure in brackets; the
common Phases 0–2 are 36–60 person-weeks and 60 working days (§7.3, §7.4) and are spent identically under A,
B, C and D. And **Option C is now priced at both timings** — as a stop-gap taken before the gate, and as a
shell built after it — in §7.5. The previous version of this table judged B after Phase 2 and C against
today's code, which compared a plan with a photograph; cells that moved are marked *Re-scored at the gate*.

| Criterion | **A — Expo + React Native Web, one universal codebase replacing the Next site** | **B — Keep Next for web, add Expo, share `packages/*` in a monorepo** | **C — Wrap the existing site (Capacitor / PWA-to-store) in a native shell** | **D — Universal UI stack (Solito + Tamagui) over Next + Expo** |
|---|---|---|---|---|
| **Code reuse (web ↔ native)** | Highest in theory — one component tree. In practice this repo has **no reusable UI**: the ~350 components are Tailwind class strings on `div`/`table`, with two base primitives that are non-functional stubs (R-201, R-202). Reuse would be of code that must be written first. *At the gate: unchanged — P4's redesign is after the gate, so the deficit is exactly as described.* | **~13–17% of source lines shared as `packages/*`** — measured, not estimated: types 5,444 + AI engine 3,748 + pure logic ~2,970 + i18n 1,797 + receipt rules 579 = ~14,500 lines, against 158,773 total (9%), 109,616 excluding tests/tooling (13%) or 85,281 excluding the web-only admin console (17%). The often-quoted "35–45%" only holds if the *server* tier (M08+M11+M12, ~38,800 lines) is counted as shared, which it is — both clients call it — but it is not code in `packages/*`. Every screen is still written twice. *At the gate: unchanged.* | **Re-scored at the gate.** ~100% of the *web app* — it **is** the web app — and **0% engineering reuse**. Judged at the gate this reads worse, not better: choosing C means stopping after P2, so P3's `packages/*` extraction (10–16 pw) is never paid for and the ~14,500 measured portable lines stay unshared. C is the only option that leaves nothing behind for whatever comes next. | 55–70% shared once Tamagui components replace the current ones — an industry figure, not one measured here; no UI in this repo has been ported to test it. The highest honest ceiling, reached only after a full UI rewrite. *At the gate: unchanged.* |
| **Web SEO impact** | **Severe.** RN-Web renders client-side; the Next server rendering, per-route metadata, sitemap and ISR that the temple's public discovery depends on would have to be rebuilt or abandoned. The site already has zero per-route metadata (R-160) — Option A makes that permanent instead of fixable. | **None.** Next keeps SSR/ISR and gains the per-route metadata, sitemap and robots it is missing. | **Re-scored at the gate.** **None** for the web (it is unchanged), and the store-review risk that replaced it is smaller than the old cell implied: at the gate the wrapper carries a hardened site, the fabricated devotees and phantom gallery rows are deleted in P1 (R-103) and the browser-set payment status is fixed in P2 (R-030). What survives is guideline 4.2 itself — carried in the Risk row. | **Low.** Solito preserves Next SSR for the web route tree; the shared components render on the server. Some Tamagui/SSR friction remains. |
| **Native capability access** | Full (Expo modules). | Full (Expo modules), and this is where the biggest product win sits: `expo-notifications` schedules OS-level reminders that survive app termination, replacing the `setTimeout`-over-a-`Map` scheduler (R-118); `expo-camera` and `expo-location` replace the QR and location paths that the origin's `Permissions-Policy` currently kills outright (R-180, R-181). | **Re-scored at the gate: poor-to-middling → middling.** Camera and geolocation work through Capacitor plugins **once R-180 and R-181 are fixed — and neither appears in any phase's scope list in §7.3**, so that fix is C's own cost, priced in §7.5. Push through FCM is adequate for the one notification this product actually needs, a daily Aaradhane/Ekadashi reminder, and §6 gap 15 (`POST/DELETE /api/push/subscriptions`) is delivered by P2, so after the gate C inherits the subscription endpoint and owes only the scheduler and the send path. Background scheduling and deep OS integration stay second-class — a real limit, but a narrower one than "poor". | Full (Expo modules). |
| **Team skill fit** | Requires the team to learn RN *and* give up Next conventions at the same moment. | React + TypeScript carries over directly; RN adds `StyleSheet`/NativeWind, navigation and the Expo module set. The web team keeps working in the stack it knows. | Lowest bar — almost no new skills. | Highest bar: Solito routing, Tamagui's compiler, and a monorepo, all new at once. |
| **Build / release complexity** | One pipeline, but a new one; the existing Vercel deploy is replaced. | Two pipelines: keep `deploy.yml` for web, add EAS Build for the app. Both need the `test.yml` that does not exist today (R-316). | **Re-scored at the gate.** Still the simplest — one web pipeline plus a store wrapper — but no longer free: the binary needs the same `test.yml` that does not exist (R-316) and the `deploy.yml` quality gate (R-312) as every other option, because a WebView ships whatever the last web deploy shipped and cannot be rolled back the way that deploy can. | Two pipelines plus a compiler step in both. |
| **Risk** | **Very high.** A rewrite of a working (if faulty) public site, during a fault-fix programme, with SEO regression as the failure mode. At the gate it is worse, not better: P3 and P4 (34–56 pw) are web-refactor work A discards. | **Moderate.** The web app keeps shipping; mobile lands incrementally, screen by screen. The API-contract-churn risk is retired by the gate itself — this cell was always the gate-judged one, which is what made the old table uneven. | **Re-scored at the gate: high → moderate.** The safety objection dissolves: a shell over a hardened site does not ship 351 faults, because P0–P2 fixed them. Two objections remain and both are *product* objections. **Guideline 4.2** — a thin wrapper is rejected; a shell adding push, deep links, offline caching and camera routinely passes, but the first submission is a coin-flip, and §7.5 budgets a contingency round for it. **The native seam closes permanently** — the WebView is the ceiling, and 7.2(5)'s three money screens (seva booking, donations, receipts) sit inside it, where decision 6's payment model is exactly what review scrutinises. | **Moderate-high.** Technically sound; the risk is schedule — it front-loads a full design-system build before any user-visible mobile feature. |
| **Rough cost** *(incremental from the gate; gross in brackets)* | **114–180** (150–240 gross) — rebuild web + build native + re-earn SEO, with P0–P2 already spent | **70–118** (106–178 gross) — P3 10–16 + P4 24–40 + P5 28–48 + P6 8–14 (§7.3) | **22–42** (58–102 gross) — derived line by line in §7.5. Taken *before* the gate instead, **29–51** including the unavoidable P0 ride-along | **104–160** (140–220 gross) |

### 4.2 Recommendation: Option B

**Keep Next.js for the web. Add an Expo app. Share `packages/*` in a monorepo.**

Three reasons decide it.

**First, the shared layer is where the value is, and it is not the UI.** The measured portable assets in
this codebase are types (5,444 lines), pure logic (~2,970 lines), the AI engine (3,748 lines), the i18n
dictionaries (825 strings) and the receipt domain rules. None of that is a component. Meanwhile the UI is
~350 Tailwind-styled DOM components whose two most-used primitives are broken stubs. Options A and D pay
their whole cost to share a UI layer that does not exist yet and is scheduled to be redesigned anyway.
Option B captures the real reuse for a fraction of that.

**Second, this is a public temple site and SEO is the product.** The entire public tree exists to be found —
festivals, sevas, the guru parampara, the calendar. It currently has *zero* per-route metadata and no
sitemap (R-160), which is a bug with a cheap fix under Next and a structural problem under RN-Web. Option A
trades a fixable weakness for a permanent one.

**Third, the phase order is forced by the faults, and Option B is the only option that tolerates it.**
Nothing mobile can start before server-side auth and an API contract exist. Option B lets the team spend
Phases 0–3 fixing the web app — which keeps shipping the whole time — and the extraction work done there is
exactly the work the phone needs. Under Option A those same phases would be spent on a codebase being
replaced.

**Re-tested on the even table (2026-09-19).** With every option scored at the Phase-2 gate and Option C
priced at both timings, the cost row reads **C 22–42, B 70–118, D 104–160, A 114–180** incremental
person-weeks. **C is 48–76 person-weeks cheaper than B** — the widest gap in the table, and the reason
levelling the gate mattered. B still wins, but on a narrower argument than the three above, and an
arithmetic one rather than a safety one.

- **C is cheaper only if it is final.** If a native client ever follows, C-then-B costs **118–201**
  person-weeks against B's **106–178** straight through — **12–23 person-weeks more** — because 13–22 of C's
  build is discarded (the Capacitor projects, the WebView deep-link plumbing, the service-worker cache) and
  only 10–19 carries over (icons and splash, store listings and privacy disclosures, the push subscription
  store and scheduler). Arithmetic in §7.5.
- **C forecloses where B accumulates.** C is the only option that leaves nothing behind: P3's `packages/*`
  extraction is never paid for, so the ~14,500 measured portable lines stay unshared and the next client
  starts where this one did. B's P3 output is the asset every later option consumes.
- **The scoped product is not a shell.** 7.2(5) scopes the devotee app as calendar, events, sevas and
  booking, donations, receipts, knowledge, Raya AI chat and notifications. Three of those are money screens,
  and a WebView carrying a manual-UPI flow into store review is decision 6 at its hardest.

**What C does buy, stated plainly.** From the same gate C delivers in 31–60 working days (2027-01-25 to
2027-03-05) against B's 105–169 (2027-05-07 to 2027-08-05) — at its worst case two months earlier than B at
its best. If the board's requirement is the narrow one — an icon on the home screen and Aaradhane/Ekadashi
reminders — C is the rational buy and this recommendation should change. That is now a stated flip condition
in §4.3 rather than an unpriced assertion.

**Why the others lose, in one line each.** **A** rebuilds a working public site and sacrifices its SEO to
share a UI layer that has to be written from scratch either way. **C** is the cheap answer to a narrower
question than 7.2(5) asks: at the gate it is safe, but it buys a WebView, closes the native seam for good,
and costs 12–23 person-weeks more than B alone the moment a native client follows. **D** is the right
architecture arriving at the wrong time: it demands the design system be finished before the first mobile
screen, and this team has neither the design system nor Solito/Tamagui experience today — unless the
redesign is approved as a rebuild, which is decided at this same gate.

### 4.3 What would change the recommendation

- **If the requirement is narrower than 7.2(5) assumes — an icon on the home screen plus Aaradhane and
  Ekadashi reminders, and no native client ever** — then Option C wins outright and this recommendation
  should change. Priced at the gate it is 22–42 person-weeks against B's 70–118 (§7.5), delivering by
  2027-01-25 at best and 2027-03-05 at worst. The condition is the word *ever*: C is cheaper only if it is
  the last mobile decision, because C-then-B costs 12–23 person-weeks more than B alone. Settle the scope
  question — product, not engineering — at the same Phase-2 gate.
- **If the admin console were the mobile target rather than the devotee app**, Option C becomes defensible
  on its own terms: admin is desktop-shaped, SEO-irrelevant, and a wrapper over a hardened admin surface is
  cheap. At the gate the surface *is* hardened, so the old parenthetical ("not recommended today only
  because the admin surface is not hardened") no longer applies; what stands against it is 7.2(5)'s scope
  decision and the 20–30 person-weeks decision 8 attaches to admin-on-mobile.
- **If the public site were being rewritten anyway** — and the redesign work in the sibling report could
  become that — then D's economics improve sharply, because the UI rewrite is paid for once instead of
  twice. Revisit D at the **Phase-2 gate**, whose last working day is **Friday 2026-12-11**, not the Phase-4
  gate: P3 opens the next working day, **Monday 2026-12-14**, and commits the `packages/*` layout in its
  first week, so the answer must be in hand on 12-11 and not merely tabled for it; by P4 the re-skin budget
  is committed as well. The sibling `UI-REDESIGN-PLAN.md` already re-specifies every primitive (its §5) and
  every public page (its §6), which is closer to a component-library rebuild than to the re-skin assumption
  7.2(8) asserts. This is the one condition in this list that may already be true.
- **If SEO stopped mattering** (a members-only portal, or all discovery moving to the app), A's main
  objection disappears and its single-codebase economics win.
- **If the team shrinks below two engineers**, none of A, B or D is deliverable in a year; the honest
  answer then is to fix the web app, ship a proper PWA (manifest, service worker, icons — all missing,
  R-184), and defer native.

---

## 5. Portability matrix

One row per module. "Verdict" is the dominant disposition of the module's code for a React Native client.
Counts: **6 rewrite, 6 adapt, 3 reuse (server-side or platform-free).**

| Module | Files / lines | Verdict | Blocking web-only dependencies | What the mobile app needs instead |
|---|---:|---|---|---|
| **M01** App shell, design tokens, shared UI kit | 88 / 10,641 | **Rewrite** | Next App Router, `next/font`, `next/image`, `next/link`, Tailwind v4 + `oklch()` + `@theme`, `@base-ui/react` primitives (DOM portals, `data-*` selectors), framer-motion v12, `<canvas>`, `IntersectionObserver`, `window.scroll*` | `packages/tokens` (hex, not oklch) + a re-implemented primitive set against the same prop API; `AuthContext`/`ProfileContext` **adapt** (swap `browserLocalPersistence` for `getReactNativePersistence`); `lib/format.ts`, `lib/utils.ts`, `lib/festival-utils.ts` **reuse as-is** |
| **M02** Public information pages | 71 / 15,935 | **Rewrite** | All 20 pages (App Router, `useSearchParams`, Server Components), every component (Tailwind, `next/image`, 99 `<motion.*>` nodes), `<iframe>` maps and YouTube, `@vercel/blob` server SDK in a client page, `window.print()` | New endpoints for homepage, announcements, testimonials and the four settings-content pages (none exist); `services/{event,gallery,announcement,homepage,volunteer,search,recommendation}.service.ts` **reuse as-is** once they call HTTP |
| **M03** Public devotional and transactions | 51 / 10,008 | **Rewrite** | 24 page files, all Tailwind styling, `@supabase/ssr` cookie client, `"use server"` actions, `dangerouslySetInnerHTML`, `document.write`, `window.print()`, `fs.readdirSync` in `lib/sevas.ts` | A real HTTP API for **every write** — booking, payment confirmation, donation, profile, bookmarks — because the phone cannot call server actions and must not hold the service-role key; plus a payment integration, since "copy the UPI id and type back a reference" (R-030) will not survive store review |
| **M04** Auth, users, roles, security | 36 / 2,897 | **Adapt** | `next/navigation`, `next/link`, `window.location`, `window.confirm`, `<table>`, `@supabase/ssr` cookie sessions in `lib/supabase/server.ts` | `services/auth.service.ts`, `services/user.service.ts` and `normalizeRole` **reuse as-is**; `types/user.ts` **adapt**, not reuse — it is one of the five type files that import `Timestamp` from `firebase/firestore` (`types/user.ts:1`, R-168), which P3 strips; persistence injected per platform; deep-link handling to replace `?redirect=`; and a real server-side session layer — every one of R-007, R-008, R-010 becomes immediately exploitable with a second client |
| **M05** Admin console — shell, dashboard, CRUD, settings | 88 / 12,553 | **Rewrite** (recommend: keep web-only) | App Router layouts, `framer-motion`, `document` listeners, ⌘K, `<table>`, `Blob`/`URL.createObjectURL` CSV export, `window.print()`, twelve pages with inline Firestore calls | If an admin app is ever wanted: `settingsService.get/save(docId)` behind authenticated routes (neither exists), the nav manifest lifted out of the sidebar, and `types/crud.ts` + `createCrudColumns` retargeted — TanStack Table is headless, so one `columns.ts` can feed a web `<table>` and an RN `FlatList` |
| **M06** Admin content and media | 75 / 11,782 | **Rewrite** (recommend: keep web-only) | 21 App Router pages, Radix dialogs, `<input type="file">`, `FileReader`, `<video>`, tiptap/ProseMirror, `navigator.clipboard`, `@vercel/blob` | `POST /api/upload` (does not exist), authenticated CRUD routes for events/gallery/announcements/quotes/testimonials/temple-areas; `types/{gallery,event,announcement,quote}.ts` **reuse as-is** once `TempleEvent`'s `Timestamp` becomes an ISO string |
| **M07** Admin devotional operations | 68 / 9,917 | **Adapt** | Every `app/admin/**/page.tsx`, `window.print()` + `@media print`, `URL.createObjectURL` download, `window.open` + `document.write`, `window.confirm` | **The Receipt Book is the natural first mobile screen** — it is already token-authenticated JSON and its two services are thin `fetch` wrappers needing only an absolute base URL. `lib/receipt/{validation,numbering,upi}.ts` **reuse as-is**; the UPI deep link is *better* on native (`Linking.openURL`). Everything else needs `/api/admin/{bookings,donations,poojas,aaradhane,bills}` built first |
| **M08** Raya AI — retrieval engine, intents, chat API | 90 / 19,651 | **Reuse (server-side)** | `lib/ai/retrieval/panchanga.ts` reads `fs`; `lib/ai/actions/actionRegistry.ts` uses `window`/`navigator` (and is dead); provider secrets must stay server-side | `POST /api/chat` unchanged, with `_debug`/`_ux` behind query flags; answers should stop being pre-rendered Markdown strings and become `{blocks, actions, suggestedFollowUps}`, since RN has no Markdown renderer without a library. Fix R-079 first or the phone loses turn 1 exactly as the web does |
| **M09** Raya AI console, chat UI, knowledge workflow | 58 / 18,016 | **Rewrite** | `next/dynamic` SSR-gating, Tailwind positioning, `scrollIntoView`, `dangerouslySetInnerHTML`, `<textarea>` auto-resize, `window.prompt`, inline SVG charts, `localStorage` | Extract `useChatSession` (roughly `AIChatProvider.tsx:131-302`, already platform-free) behind a storage adapter and a fetch function; a versioned `{message, sessionId}` contract; `data-testid`/`accessibilityLabel` so one E2E catalogue serves both. The 13 admin pages should stay web-only |
| **M10** Service layer and type catalogue | 102 / 20,960 | **Adapt** | `lib/firebase.ts` (`typeof window`, `browserLocalPersistence`), `@supabase/ssr`, `@vercel/blob` + `atob`/`Blob`/`File` in `storage.service.ts`, `localStorage`/`navigator.userAgent` in `pageviews.service.ts`, the `window` gate in `testimonial.service.ts` | 37 of 42 `types/*.ts` **reuse as-is**; the seven pure services (~2,970 lines) **reuse as-is**; the ~20 Firestore CRUD services split into `server/data` + a `fetch` twin. `services/receipt.service.ts` is the template for the twin |
| **M11** Data model, persistence, rules, migration | 86 / 12,122 | **Reuse (server-side)** | `@supabase/ssr` browser and cookie clients; `data/panchanga/**` and `seed/ai/*.json` read through `fs`/`process.cwd()` | SQL migrations, `firestore.rules`, `firestore.indexes.json`, `storage.rules` and every script **reuse as-is**; panchanga and shloka data served over HTTP; generated Supabase types so the two clients cannot drift; and RLS policies that actually permit the anon role, or the phone sees the same empty screens the web anon client does (R-071) |
| **M12** API routes and server actions | 98 / 6,998 | **Reuse (it is the mobile API)** | `next/server` types (cosmetic), route-segment `dynamic`/`revalidate`, `revalidatePath`, the one `"use server"` action, `fs` in two routes, a PDF returned `inline` | ~90 of 95 endpoints are callable verbatim: plain JSON, no cookies, no CSRF, token-based. The work is coverage (§6), auth on every write, one envelope, real pagination, and `Cache-Control` headers in place of route-segment config |
| **M13** Device capabilities, i18n, offline/PWA | 114 / 11,845 | **Adapt** | `navigator.*` throughout, `Notification` + `setTimeout` scheduling, CDN-loaded `html5-qrcode`, `document` focus/tab semantics in `hooks/a11y`, `localStorage`, 11 Tailwind widgets | **The easiest module to move and the one that gains most.** `types/device.ts`, the `lib/i18n` dictionaries and `config.ts` (275×3 strings), the distance/ICS/share/QR-payload maths and `services/ux.service.ts` **reuse as-is** — but **not** `lib/i18n/**` wholesale: `lib/i18n/context.tsx:93,94,102` calls `localStorage` and sets `document.documentElement.lang`, so the provider is **adapt**, not reuse; the hook layer (`useShare`, `useLocation`, `useNotifications`, `useCalendar`, `useQRScanner`, `usePermission`) is already the right seam — supply `*.native.ts` implementations. ~3,500 lines of unused widgets should be deleted, not ported |
| **M14** Domain engines — panchanga, aaradhane, receipts, reports | 62 / 13,368 | **Adapt** | `fs`/`path`/`process.cwd()` in the panchanga loaders, `pdf-lib` + filesystem fonts, `firebase-admin`, Playwright/Chromium in the proof-report services, CPython in the pipeline | `lib/receipt/{numbering,validation,upi}.ts`, `types/festival.ts` helpers, `lib/festival-utils.ts`, `data/calendar.ts` and `data/aaradhane/gurus.ts` **reuse as-is**; needs `GET /api/panchanga?date=` and a Firestore-backed calendar endpoint; PDFs are downloaded from a signed URL, never rendered on device; the proof-report tooling never ships |
| **M15** Testing, CI/CD, tooling, repo health | 144 / 49,157 | **Adapt** | Playwright DOM selectors and `@axe-core/playwright` (45 files), Lighthouse budgets, `vercel.json` cache headers, `navigator.userAgent`/`localStorage` in the analytics tracker | `tests/unit/**` (17 files) **reuse as-is** under `jest-expo`; the 275-case UAT corpus **reuse as-is** as the mobile chat conformance suite; E2E rewritten in Detox or Maestro; a shared `test.yml` plus an EAS/Fastlane pipeline beside the Vercel one; and a server-side `/api/analytics/event` so neither client writes Firestore directly |

---

## 6. API contract gaps

These are the endpoint families a React Native client needs that **do not exist today**, because the data is
read inside a Server Component or a client component that imports a service directly. Nineteen are genuinely
absent from `app/api/**`; entry 20 is different in kind — `/api/search` and `/api/testimonials` both exist, so
that row is a contract change to existing routes, not a missing family. Nineteen missing families, one contract gap.

| # | Missing endpoint | What serves this today | Register rows it also fixes |
|---|---|---|---|
| 1 | `GET /api/sevas` (+ `[id]`) | `app/actions/sevas.ts`, a `"use server"` action callable only from Next — and the Playwright contract suite already asserts against this non-existent route | R-049, R-193, R-320 |
| 2 | `GET /api/panchanga/current`, `GET /api/panchanga?date=` | `lib/aaradhane/panchanga.ts:65` reads 730 files from disk; the site fetches the static `public/data/panchanga/current.json` with a `no-store` header | R-250, R-068 |
| 3 | `GET/POST/PUT/DELETE /api/calendar` (ekadashi + festivals) | Nothing — two admin screens call it at six call sites and get a swallowed 404 | R-053, R-054, R-107 |
| 4 | `GET /api/homepage` | `homepageService` reads Firestore from a client component | R-159, R-242 |
| 5 | `GET/PUT /api/settings/{docId}` (about, trust, facilities, future-plans, footer, social, finance, temple identity) | Twelve admin pages and four public pages call `doc/getDoc/setDoc` inline | R-050, R-051, R-052, R-139, R-159 |
| 6 | `GET /api/gallery` (albums + media) | `galleryService` from the browser; the only gallery route deletes files from `public/` with no auth | R-015, R-056, R-105 |
| 7 | `POST /api/upload` | Nothing — `@vercel/blob` is called from four client components with a server-only token | R-056 |
| 8 | `GET /api/poojas` | `poojaService` reads `dailyPoojas`, a collection with no rule block, from the browser | R-070, R-137 |
| 9 | `GET /api/aaradhane` (public read) | Only `/api/admin/aaradhane` exists, and it reads whichever of three collections is non-empty | R-082 |
| 10 | `GET /api/shlokas`, `GET /api/stotras` | Hardcoded arrays inside two page files; there is no collection and no service | R-051, R-055, R-273 |
| 11 | `GET /api/me/bookings`, `GET /api/me/donations` | `/api/bookings` and `/api/donations` return whole collections unauthenticated, and are inert besides | R-014, R-235 |
| 12 | `GET/PUT /api/me/profile`, `/api/me/bookmarks`, `/api/me/preferences` | `profileService` writes Firestore directly to `profiles` and `bookmarks`, which have **no rule block**, so every read is denied and the error is swallowed | R-070, R-095, R-096, R-116 |
| 13 | `POST /api/bookings/{id}/payment` (+ a gateway webhook) | The **browser** writes `paymentStatus:"completed"` on a user-typed reference | R-030, R-091 |
| 14 | `POST /api/analytics/event` (+ server-side aggregation into `daily_page_stats`) | Two client writers race on every page view and the dashboard reads 10,000 documents back | R-233, R-234 |
| 15 | `POST/DELETE /api/push/subscriptions` | Nothing — "notifications" are `setTimeout` over an in-memory `Map`, and the UI promises reminders nothing sends | R-118, R-184 |
| 16 | `GET/PUT /api/device-settings` | `deviceSettingsService` reads Firestore from the client and its `initialize()` is never called | R-115 |
| 17 | `GET /api/guru-parampara`, `/api/trust-committee`, `/api/temple-timings` | Content lives in `types/guru.ts` and in settings documents that nothing reads | R-051, R-169 |
| 18 | `GET /api/receipts/mine` (booking id + OTP or signed token) | `/api/public/receipts` substring-searches 1000 bookings and returns full PII | R-013 |
| 19 | `POST /api/auth/session` + `GET /api/health` | No token exchange endpoint and no health check; the contract suite asserts against `/api/auth/login` and `/api/health`, neither of which exists | R-010, R-320 |
| 20 *(contract, not missing)* | `GET /api/search` needs pagination, and testimonials need a write path the site actually uses — both routes exist | Search returns everything; testimonials are written to Firestore straight from the browser while `/api/testimonials` sits unused | R-029, R-174, R-235 |

Beyond coverage, three contract-level changes are needed before a typed client can exist at all: **one
response envelope** (six coexist today — R-163), **real cursor pagination** (only receipts paginate, with
`.offset()` — R-235, R-236), and **shared TypeScript types exported from `packages/domain`** so the two
clients cannot drift. That last one is the single highest-value portability investment in the whole
programme.

---
## 7. Effort, assumptions and roadmap

### 7.1 This is an estimate

Every number below is an estimate produced by reading the code, not by running it. `node_modules` is absent
by rule, so nothing was built, linted, type-checked or executed: R-317 (the CI test command may not compile)
is a static inference, and the true size of the "fix the `any`s" work cannot be known until
`@typescript-eslint/no-explicit-any` is switched back on and the errors are counted. Treat the ranges as
planning inputs with roughly ±40% spread, not commitments.

### 7.2 Assumptions

1. **Team of four**: three full-stack engineers (React/TypeScript, no React Native experience yet) plus a
   designer at 50%. One engineer becomes the mobile lead from Phase 3 onward.
2. **Capacity**: ~3.5 productive person-weeks per elapsed week after meetings, support and review.
3. **The web app keeps shipping throughout.** No feature freeze is assumed; roughly 20% of capacity is
   already reserved inside the estimates for keeping the lights on.
4. **The store migration finishes in Phase 1.** If it does not, Phase 2 and everything after it must be
   re-done per domain as each one moves; add 6–10 person-weeks and treat Phase 5 as unschedulable.
5. **Mobile scope is the devotee app only** — calendar, events, sevas and booking, donations, receipts,
   knowledge, Raya AI chat, notifications. The admin console stays web-only, which is what the portability
   matrix recommends for M05, M06 and the 13 admin AI pages.
6. **No payment gateway integration is in scope.** If app-store review forces a real gateway (likely — see
   §8), add 8–14 person-weeks and a compliance review.
7. **Working days are Monday–Friday. No public holidays are deducted**, which is deliberately optimistic:
   the Indian calendar alone would remove roughly 12 days over this span, and the temple's own festival
   season will remove more. Add ~3 elapsed weeks for a realistic holiday allowance.
8. Design tokens and the redesign direction are settled in parallel by the designer and land in Phase 4;
   the redesign is scoped as a re-skin over `packages/tokens`, not a component-library rebuild.

### 7.3 Effort by phase

| Phase | Scope | Person-weeks (low–high) |
|---|---|---:|
| **P0** Security stop-the-bleeding | Rotate the service-account key and the Web API key; strip literals from 13 files; delete `create-admin`, `set-role`, `/debug`, `/admin/test`, `/admin/test-firebase`, `seed-ai-settings`; fix the duplicate `firestore.rules` block, `ai_settings` and `storage.rules`; remove the Postman collection from `public/`; add a quality gate to `deploy.yml`. Register rows R-001…R-017, R-045, R-312 | 6–10 |
| **P1** Correctness and store consolidation | Decide the owner per domain and finish sevas, social links and the settings documents; add the 25 missing rule blocks and the 9 missing indexes; fix RLS; resolve the duplicate `temple_areas` migration; fix the money and receipt defects (R-059…R-067, R-083…R-091); generate panchanga through 2029 and fix adhik-masa; delete the ~12,000 lines of dead code. R-049…R-107 plus R-203 | 12–20 |
| **P2** API contract and server-side auth | `middleware.ts` or a shared route wrapper verifying a Firebase ID token and role claim on every write and every privileged read; zod schemas at each boundary; one response envelope; cursor pagination; the 20 missing endpoint families from §6; a shared rate-limit store. R-010…R-037, R-163, and all of §6 | 18–30 |
| **P3** Monorepo extraction | Workspace setup; publish `packages/{domain,api-client,logic,ai-engine,tokens,i18n,config}`; strip `Timestamp` from the five type files; move content data out of `types/`; rewrite the ~20 browser services into `fetch` clients over P2's routes; move query logic into `server/data`; extract the navigation manifest. R-159, R-166…R-169, R-179, R-212…R-215 | 10–16 |
| **P4** Web refactor and redesign | Point `apps/web` at the shared packages; move data fetching into Server Components and add per-route metadata, sitemap and robots; one header/footer layout; fix the two broken UI primitives and the dialog/focus/landmark defects; apply the redesign over `packages/tokens`; re-enable `no-explicit-any` and burn it down; write the missing `test.yml`. R-158…R-161, R-175…R-179, R-201, R-202, R-286…R-310, R-311…R-327 | 24–40 |
| **P5** Expo devotee app MVP | Expo + React Navigation skeleton; auth with `getReactNativePersistence`; calendar, events, sevas and booking, donations, receipts (the Receipt Book is the natural first screen), knowledge, Raya AI chat; `expo-notifications` push replacing the `setTimeout` scheduler; `expo-camera` QR; native implementations behind the existing `lib/device` hook signatures; Detox or Maestro smoke suite | 28–48 |
| **P6** Store release and hardening | App icons and splash (the icon directory is empty today), store listings, privacy disclosures, EAS Build pipeline, beta, review cycles, crash reporting, performance pass | 8–14 |
| | **Total** | **106–178** |

At 3.5 productive person-weeks per elapsed week, 106 person-weeks is ~30 elapsed weeks and 178 is
~51 elapsed weeks. The calendar below lays out the **low end**, not the mid-case: 165 working days is 33
elapsed weeks, and 33 x 3.5 = 115.5 person-weeks, which is the 106 low end plus 9%. The mid-case (142
person-weeks) is 40.6 elapsed weeks = 203 working days, ending **2027-06-30**; the high end (178
person-weeks) is 50.9 elapsed weeks = 254 working days, ending **2027-09-09**. Read the table below as the
optimistic schedule and hold the two later dates as the realistic and pessimistic ones, before the ~3 weeks
of public holidays that assumption 7 also excludes.

### 7.4 Calendar — the arithmetic

Counting **Monday–Friday only, no holidays deducted**. Today is Saturday 2026-09-19, so the first working
day is **Monday 2026-09-21**. Each phase starts on the next working day after the previous phase ends; the
"end" column is the *n*-th working day counted inclusively from the start date.

| Phase | Start (weekday) | Working days | End (weekday) | Arithmetic |
|---|---|---:|---|---|
| P0 Security | 2026-09-21 (Mon) | 15 | 2026-10-09 (Fri) | Mon 09-21 is day 1; 15 working days = 3 full weeks; week 1 ends Fri 09-25 (day 5), week 2 Fri 10-02 (day 10), week 3 Fri 10-09 (day 15) |
| P1 Correctness and stores | 2026-10-12 (Mon) | 20 | 2026-11-06 (Fri) | 20 working days = 4 weeks from Mon 10-12: 10-16 (5), 10-23 (10), 10-30 (15), 11-06 (20) |
| P2 API contract and auth | 2026-11-09 (Mon) | 25 | 2026-12-11 (Fri) | 25 = 5 weeks from Mon 11-09: 11-13 (5), 11-20 (10), 11-27 (15), 12-04 (20), 12-11 (25) |
| P3 Monorepo extraction | 2026-12-14 (Mon) | 20 | 2027-01-08 (Fri) | 20 = 4 weeks from Mon 12-14: 12-18 (5), 12-25 (10), 01-01 (15), 01-08 (20). **Note: days 10 and 15 land on 25 Dec and 1 Jan**, counted as working days per the stated assumption — deduct at least 2 days here in practice |
| P4 Web refactor and redesign | 2027-01-11 (Mon) | 30 | 2027-02-19 (Fri) | 30 = 6 weeks from Mon 01-11: 01-15 (5), 01-22 (10), 01-29 (15), 02-05 (20), 02-12 (25), 02-19 (30) |
| P5 Expo devotee app MVP | 2027-02-22 (Mon) | 40 | 2027-04-16 (Fri) | 40 = 8 weeks from Mon 02-22: 02-26 (5), 03-05 (10), 03-12 (15), 03-19 (20), 03-26 (25), 04-02 (30), 04-09 (35), 04-16 (40) |
| P6 Store release and hardening | 2027-04-19 (Mon) | 15 | **2027-05-07 (Fri)** | 15 = 3 weeks from Mon 04-19: 04-23 (5), 04-30 (10), 05-07 (15) |
| | | **165** | | 165 working days = **33 elapsed weeks**; verified: the 165th working day from 2026-09-21 is 2027-05-07 |

Two schedule notes. **The panchanga runway sets a hard deadline inside this window**: data ends
2027-12-31, which is 468 days from today, so the 2028+ generation (Phase 1) must not slip past roughly
Q3 2027 or the Aaradhane generator starts throwing. And **P2 is the true critical path** — nothing in P3,
P5 or P6 can start before the API contract and server-side auth exist, while P4 can overlap P3 by roughly
two weeks if the designer's tokens land early.

### 7.5 Option C priced at both timings — the arithmetic

Same conventions as §7.4: Monday–Friday only, no holidays deducted, team of four (7.2(1)) at ~3.5 productive
person-weeks per elapsed week (7.2(2)). Working days = person-weeks ÷ 3.5 × 5, rounded to the nearest whole
day — the same conversion §7.3 uses for its mid- and high-case dates. This is the pricing §10.3 said the
report owed and did not have.

**(i) Option C as a stop-gap, taken *before* Phase 2.** Starts Monday 2026-09-21, the same first working day
§7.4 uses.

| Item | Why it is C's cost | Person-weeks (low–high) |
|---|---|---:|
| P0 security ride-along | Not optional here: a store binary cannot be patched the way a web deploy can, and P0 is the minimum that makes a shipped shell defensible at all (§7.3 P0) | 6–10 |
| Capacitor shell | iOS and Android projects, build config, one release pipeline | 2–3 |
| PWA prerequisites | `app/manifest.ts`, the 192/512 and maskable icon set (`public/icons/` holds only `.gitkeep`), splash screens, a registered service worker — none of it exists (R-184) | 2–4 |
| CSP and `Permissions-Policy` unblock | `next.config.ts:29-30` kills camera and geolocation origin-wide (R-180); the QR scanner loads a non-dependency from a CDN the site's own CSP blocks (R-181) | 2–3 |
| Push | FCM/APNs plugin **plus** the `POST/DELETE /api/push/subscriptions` family §6 gap 15 says does not exist, **plus** the reminder scheduler and send path — there is no cron or reminder route under `app/api` today | 4–7 |
| Deep links | Universal Links / App Links, and a validated redirect allow-list to replace `?redirect=` and `window.location.href` | 2–3 |
| Offline caching | App shell and rendered HTML only: most page data is read from Firestore inside Server Components, so there is no JSON response to cache | 2–3 |
| Store submission | Listings, privacy disclosures, beta, review cycles, crash reporting | 5–10 |
| Guideline-4.2 contingency | Larger before the gate: the wrapper adds little native surface, and the site still shows four invented devotees and five phantom live streams (R-103) and lets the browser mark a booking paid (R-030) at review time | 4–8 |
| | **Total** | **29–51** |

| Timing | Person-weeks | Elapsed weeks | Working days | Start (weekday) | End (weekday) | Arithmetic |
|---|---:|---:|---:|---|---|---|
| Low | 29 | 8.29 | 41 | 2026-09-21 (Mon) | **2026-11-16 (Mon)** | 29 ÷ 3.5 = 8.29 ew; 8.29 × 5 = 41.4 → 41 wd; from Mon 09-21: 10-09 (15), 10-30 (30), 11-13 (40), 11-16 (41) |
| High | 51 | 14.57 | 73 | 2026-09-21 (Mon) | **2026-12-30 (Wed)** | 51 ÷ 3.5 = 14.57 ew; 14.57 × 5 = 72.9 → 73 wd; 11-06 (35), 12-04 (55), 12-18 (65), 12-25 (70), 12-30 (73). Days 70 and 73 straddle 25 Dec and 1 Jan, counted as working days per 7.2(7) |

**What it does not fix: everything P1 and P2 do.** At the low-end date of 2026-11-16 the shell ships a site
that still returns 1,000 bookings of devotee PII to anyone who asks (R-013), still reads sevas from Supabase
and writes them to Firestore (R-049), still lets the browser mark a booking paid on a user-typed reference
(R-030), still carries the fabricated devotees and phantom gallery rows (R-103), and still has none of the
nineteen missing endpoint families. Only P0's rows are closed. A WebView ships whatever the web ships.

**The rework if B or D follows.**

| | Person-weeks (low–high) |
|---|---:|
| C as a stop-gap (above) | 29–51 |
| P1 + P2, still owed | 30–50 |
| P3 – P6, still owed | 70–118 |
| *less* what carries over: icons and splash, store listings and privacy disclosures, the push subscription store and scheduler | −10 – −19 |
| **C-then-B total** | **119–200** |
| B straight through (§7.3) | 106–178 |
| **Penalty for taking C first** | **+13 – +22** |

Arithmetic: 29 + 30 + 70 − 10 = 119; 51 + 50 + 118 − 19 = 200; against 106 and 178, a penalty of +13 and
+22. What is discarded is 13–22 person-weeks of C's own build — the Capacitor projects, the WebView
deep-link plumbing and the service-worker cache, none of which an Expo client uses.

**(ii) Option C *after* Phase 2.** Starts Monday 2026-12-14, the next working day after the gate.

| Item | What changes after the gate | Person-weeks (low–high) |
|---|---|---:|
| Capacitor shell | Unchanged in kind, plus a second release pipeline beside `deploy.yml` and the `test.yml` P0 wrote | 2–4 |
| PWA prerequisites | Unchanged — manifest, icon set, splash, service-worker registration; still absent at the gate (R-184 sits in P4, which C does not reach) | 2–4 |
| Camera and geolocation unblock | Still C's own cost: R-180 and R-181 appear in no phase's scope list in §7.3, so the gate does not deliver them | 2–3 |
| Push | Cheaper: P2 delivers `/api/push/subscriptions` (§6 gap 15), so C owes the FCM/APNs plugin, the WebView-to-native token handover, and the server-side scheduler and send path | 3–6 |
| Deep links | Unchanged — Universal Links / App Links plus the shared validated redirect allow-list | 2–3 |
| Offline caching | Dearer and worth more: P2's real endpoints give a cache-first strategy something to cache — calendar, panchanga, events, sevas. No write queue | 3–6 |
| Store submission | Unchanged | 5–10 |
| Guideline-4.2 contingency | Smaller: the shell now adds push, deep links, offline caching and camera over a hardened site, which is the profile that passes | 3–6 |
| | **Total** | **22–42** |

| Timing | Person-weeks | Elapsed weeks | Working days | Start (weekday) | End (weekday) | Arithmetic |
|---|---:|---:|---:|---|---|---|
| Low | 22 | 6.29 | 31 | 2026-12-14 (Mon) | **2027-01-25 (Mon)** | 22 ÷ 3.5 = 6.29 ew; 6.29 × 5 = 31.4 → 31 wd; from Mon 12-14: 12-25 (10), 01-01 (15), 01-22 (30), 01-25 (31) |
| High | 42 | 12.00 | 60 | 2026-12-14 (Mon) | **2027-03-05 (Fri)** | 42 ÷ 3.5 = 12.00 ew exactly; 12 × 5 = 60 wd; 01-08 (20), 02-05 (40), 02-19 (50), 03-05 (60) |

**Against B, measured from the same gate.** B's remaining work is P3–P6: 70–118 person-weeks, which §7.4
lays out as 105 working days (2026-12-14 → 2027-05-07) on the low-end calendar, and 169 working days
(→ 2027-08-05) at the high end. (70 ÷ 3.5 × 5 = 100, five days short of §7.4's 105; the difference is the
same 9% slack §7.3 already discloses between 165 working days and the 106-person-week low end.) So C after
the gate is **48–76 person-weeks cheaper than B and lands three to five months earlier like-for-like** —
low end 2027-01-25 against 2027-05-07, high end 2027-03-05 against 2027-08-05 — and even C's worst case
beats B's best by two months.

**And the same penalty applies if B follows anyway.** 36–60 (P0–P2) + 22–42 (C) + 70–118 (P3–P6) − 10–19
carried over = **118–201** against B's 106–178: **12–23 person-weeks more**. Both timings give the same
answer. **C is cheaper only if it is the last mobile decision this programme takes.**

---

## 8. Risks

### Technical

| Risk | Why it is real here | Mitigation |
|---|---|---|
| **The committed service-account key is already compromised** | It sits in nine files (R-002) and the repo's history. Nothing in the repository can tell you whether it has been used | Rotate in the Firebase console **before** anything else in P0, then audit Firestore and Storage access logs for the period the key was live |
| **The split-brain domains diverge further during the fix** | Sevas and social links are written to one store and read from another *right now* (R-049, R-050); every day of admin use widens the gap | Freeze admin writes to the affected screens on day 1 of P1, migrate, then unfreeze |
| **The API contract churns after mobile work starts** | Six response envelopes coexist today (R-163); if the shape is still moving in P5, every screen is rewritten | Version the contract at the end of P2 and add contract tests — the existing Playwright contract suite tests endpoints that do not exist (R-320) and must be rewritten against the real surface first |
| **Re-enabling `no-explicit-any` uncovers more than expected** | ~300 occurrences are visible statically, concentrated in Firestore mappers; the real count after strict mode is unknown because tests and scripts are excluded from typecheck (R-314, R-315) | Turn it on as a *warning* in P0, count the real number, and budget P4 from that count rather than from this estimate |
| **Firestore free-tier quota during migration** | `page_views` alone holds ~47k documents against a 50k/day read cap, and two writers add to it every request (R-233, R-234) | Fix the double-write in P0; run one dump per day as the project notes already require; consider a paid tier for the migration window |
| **React Native learning curve is underestimated** | The team has no RN experience; the estimate assumes one engineer becomes the mobile lead in P3 | Start that engineer on `packages/*` extraction in P3 with an Expo spike running alongside; do not let P5 be the first RN code anyone writes |

### Product

| Risk | Why it is real here | Mitigation |
|---|---|---|
| **App-store rejection over the payment flow** | Today's flow is "copy a UPI id, pay outside the app, type the reference back" and the **browser** then marks the booking paid (R-030). Reviewers treat this as an unverified transaction, and donations in-app raise their own policy questions | Decide the payment model at the Phase-2 gate (§9, decision 6). A server-verified gateway is the safe path |
| **Fabricated content ships to a store** | Four invented devotees with photos, seven phantom gallery rows, five fake live streams pointing at one YouTube id (R-103) | Delete in P1. A store listing showing invented testimonials is a reputational and policy problem, not a cosmetic one |
| **The devotee-facing calendar goes stale mid-programme** | `data/calendar.ts` runs out on 2027-04-02 — *during P5* — and the admin editors that look like they maintain it write to a 404 (R-053, R-107) | Move the calendar to Firestore in P1, not P4 |
| **SEO regression during the P4 refactor** | Moving data fetching into Server Components touches every public page at once | Add per-route metadata, the sitemap and robots *first*, capture a Lighthouse and Search Console baseline before the refactor, and ship page-group by page-group |
| **The AI answers get worse before better** | Fixing the dress-code/visitor-guidelines collision (R-077) and the nine intents falling through to a knowledge lookup (R-134) changes answers devotees may be used to | Use the 275-case UAT corpus as the regression gate — but fix R-322 first, since the suite currently asserts nothing about intent |

### Operational

| Risk | Why it is real here | Mitigation |
|---|---|---|
| **There is no deployment runbook** | `docs/DEPLOYMENT.md` is 0 bytes (R-344), and the only deploy path is a push to `main` with no quality gate (R-312) | Write the runbook in P0 alongside the gate; it is a precondition for a second release pipeline |
| **No monitoring, no error reporting** | Errors are swallowed into `console.error` in 33 service files (R-259) and the error boundaries report to nothing (R-265) | Add error reporting in P0 — without it, none of the P1 fixes can be confirmed in production |
| **Nobody can tell whether a test passing means anything** | The Playwright config never applies (R-311), 13 files point at dead hosts (R-313), no workflow runs the unit suite (R-316), and E2E assertions are guarded by `if (count > 0)` (R-325) | Treat P0's quality gate as the first deliverable, not a chore; a green build must mean something before 351 faults are fixed against it |
| **Key-person dependency on the Python panchanga pipeline** | It is the only non-JavaScript part of the product, its workflow embeds 130 duplicated lines (R-331), and the documented commands do not work (R-346) | Document and de-duplicate it in P1; generating 2028+ is the forcing function |
| **Two release cadences after P5** | Web ships continuously, the app ships through store review | Decide the versioning and backward-compatibility policy at the Phase-4 gate (§9, decision 10) — an API change that breaks an installed app cannot be rolled back the way a web deploy can |

---

## 9. Decisions needed

These are the twelve choices that block or redirect the work. Each names the deadline and the consequence
of deferring it.

1. **Rotate the Firebase service-account key — yes or no, this week.** It is committed in nine files. If
   the answer is not "immediately", nothing else in this report is worth scheduling. *(Blocks P0; decide
   by 2026-09-21.)*
2. **Which store owns which domain?** Firestore or Supabase, per domain, written down. Sevas, social links,
   settings content and AI settings are actively split today. *(Blocks P1; decide by 2026-10-09.)*
3. **Delete or fix the unauthenticated bootstrap routes?** `create-admin` and `set-role` are documented
   with a production cURL and a Postman collection served from the web root. Deleting them means
   provisioning admins through `scripts/setup-admin.ts` instead. *(Blocks P0.)*
4. **Is the knowledge-workflow subsystem alive?** ~2,000 lines, no UI, no rules, no reader. Wire it up or
   delete it — leaving it half-live is what produced R-165 and R-110. *(Blocks P1.)*
5. **Does Raya AI get a real LLM, or is it a deterministic template engine?** No code path calls an LLM
   today and four documents say otherwise. The answer changes the prompt-management work, the cost model
   and the injection surface. *(Blocks P2; decide by 2026-11-09.)*
6. **What is the payment model?** Keep manual UPI reconciliation, or integrate a gateway with server-side
   verification. The current browser-set payment status will not pass app-store review and is a live
   integrity hole on the web too. *(Blocks P5, and the answer shapes P2's API design.)*
7. **Confirm Option B.** Next for web plus Expo for mobile with shared packages, 70–118 person-weeks
   incremental from the gate. Two alternatives are live, both priced at the same gate (§4.1, §7.5): **D**
   (Solito/Tamagui, 104–160) *if* the redesign is going to rebuild the component library anyway, and **C**
   (native shell, 22–42) *if* the requirement is an icon on the home screen plus Aaradhane and Ekadashi
   reminders and no native client is ever wanted — C is cheaper only if it is final, since C-then-B costs
   12–23 person-weeks more than B alone. *(Decide **by Friday 2026-12-11**, the last working day of Phase 2.
   P3 opens Monday 2026-12-14 and commits the `packages/*` layout in its first week, so the answer must be
   in hand on 12-11, not merely tabled for it.)*
8. **Does the admin console go mobile at all?** The matrix recommends web-only for M05, M06 and the 13
   admin AI pages. If the answer is yes, add 20–30 person-weeks and revisit the API scope. *(Decide by the
   Phase-2 gate.)*
9. **Which languages does the UI actually support?** 825 translated strings exist and **zero** `t()` call
   sites do. Either wire i18n up in P4 or state in the docs that the UI is English-only and the AI layer is
   bilingual — and delete the switcher that currently crashes two pages. *(Decide by 2027-01-11.)*
10. **Versioning and backward-compatibility policy for the API once an app is installed.** A web deploy can
    be rolled back; a shipped binary cannot. *(Decide by the Phase-4 gate, 2027-02-19.)*
11. **Who owns the temple's authoritative contact record, UPI id and identity?** Four places claim it today
    and a fifth, different contact (a personal Gmail address) is baked into dead AI code. One owner, one
    document, read everywhere. *(Blocks P1.)*
12. **Rewrite the docs from the code, or raise the code to the docs?** Eighteen register rows are pure
    drift, including a `docs/SECURITY.md` that describes six controls that do not exist. Whichever way it
    goes, `AGENTS.md` is the first file every contributor and every AI agent reads, and it is wrong about
    the framework version by two majors. *(Decide by the Phase-1 gate, 2026-11-06.)*

---

## Reviewer notes (2026-09-19)

An adversarial pass over this document, written by a second agent whose brief was to break it rather than
agree with it. Everything below was checked against the code on 2026-09-19, not against the brain files.
The register, the option table, the portability matrix, the API-gap list and every date in §7.4 were
re-derived from scratch; the corrections are already applied in the body above, and this section records
what changed and what is still a judgement call.

### 10.1 What held

- **All 25 sampled register rows are real at their cited `path:line`.** The sample was weighted toward
  HIGH (16 HIGH, 6 MEDIUM, 3 LOW) and deliberately avoided the fifteen the author had already re-checked.
  Nothing was refuted on the facts. Spot-verified verbatim: `firestore.rules:226-229` (`ai_settings`
  world-writable), `storage.rules:5-8`/`:11-14`, `app/api/seed-ai-settings/route.ts:119-120` (the auth
  helper returns an admin identity unconditionally in production), `app/api/public/receipts/route.ts:28`
  (`.limit(1000)` then in-memory substring match), `app/api/gallery/local-assets/route.ts:38-57`
  (unauthenticated `fs.unlinkSync`), `services/seva.service.ts:11` vs `:76,:81,:86` (read Supabase, write
  Firestore), `app/admin/calendar/festivals/page.tsx` and `.../ekadashi/page.tsx` (zero
  `setDoc`/`getDoc`/`addDoc`/`updateDoc` between them), `lib/receipt/pdf.ts:37-39,185` (`toAscii` + only
  `StandardFonts.Helvetica`), `services/receipt.service.ts:23`
  (`data.paymentMode === "upi" ? "upi" : "upi"`), `supabase/migrations/20260907112632_create_core_tables.sql:98-102`
  (`FOR ALL TO public USING (false)`), `proxy.ts:110` + `components/analytics/PageViewTracker.tsx:19`
  (two page-view writers), `app/admin/content/page.tsx:90,92,93`, `app/api/admin/receipts/route.ts:58-61`
  (`.offset()`), `services/sevaBooking.service.ts:83` (browser writes `status:"confirmed"`),
  `REPORT.md:1-12`, `lib/receipt/upi.ts:1`, `app/api/chat/route.ts:162`.
- **No duplicate register ids and no gaps.** Ids run R-001…R-350 with every integer used exactly once
  (R-351 added by this review).
- **The appendix is complete and honest.** Re-derived independently: the 15 brain files hold exactly 589
  fault rows; the appendix maps exactly 589; nothing missing, nothing phantom; every R-id it names exists
  and every register row is reached by at least one finding.
- **Every date in §7.4 recomputes exactly.** Counting Mon–Fri from Monday 2026-09-21, each phase start is
  the next working day after the previous end, and each end is the *n*-th working day counted inclusively:
  P0 15 → 2026-10-09, P1 20 → 2026-11-06, P2 25 → 2026-12-11, P3 20 → 2027-01-08, P4 30 → 2027-02-19,
  P5 40 → 2027-04-16, P6 15 → 2027-05-07. The phase days sum to 165 and the 165th working day from
  2026-09-21 is indeed Friday 2027-05-07. The person-week columns sum to 106 and 178. The 468-day panchanga
  runway (2026-09-19 → 2027-12-31) is correct, and `data/calendar.ts` really does end 2027-04-02.
- **The headline counts reconcile.** 818 source files / 158,773 lines match `.claude/state/inventory/SUMMARY.md`
  exactly; 310 `"use client"` and 3 `server-only` reproduce; `find app/api -name route.ts` → 95 and
  `verifyAdminUser` appears in exactly 5 of them; 47 files / 85 import lines reproduce precisely over
  `app/`, `components/` and `hooks/` when `@/lib/admin-firebase` is included, of which 41 hold the client
  SDK and 12 are admin settings pages; "documented as Next.js 14" is true of exactly five documents
  (`AGENTS.md:213`, `.openhands/project-context.md:43`, `docs/ARCHITECTURE.md:18`,
  `docs/PROJECT_STRUCTURE.md:5,229`, `docs/QUALITY_ASSESSMENT_REPORT.md:13`).
- **Nineteen of the twenty API gaps are genuinely absent** from the 95 route files. `/api/storage/videos`
  exists but is a `GET` listing only, so "no upload route" stands.

### 10.2 The one systematic defect: severity was not the maximum of the merged sources

§2.1 stated that a register row takes the maximum severity of the findings merged into it. It did not.
Scripted over the appendix mapping and the brain severity columns, **25 brain findings graded HIGH landed
on rows where no carrying row was HIGH** — 27 rows in all. Every one of those source findings is marked
`CONFIRMED` in the corresponding `.claude/state/verify/M*.md`; none was downgraded by a skeptic. The effect
was to understate the HIGH count by a third and to bury, at MEDIUM, faults the document itself treats as
headline material elsewhere — R-030 (the browser sets `paymentStatus`) is named in §8 as an app-store
blocker and in §4.1 as a reason Option C fails, while the register graded it MEDIUM.

**Twenty-one rows re-graded upward** (all to HIGH unless noted), each because the register row's own
evidence sustains the grade, not merely because the brain said so:

| Row | Was | Now | Source | Why HIGH on its own evidence |
|---|---|---|---|---|
| R-021 | MEDIUM | HIGH | M07-F06 | Every `requiredPermission` collapses to `canAccessAdmin`; a priest account reaches `/admin/users`, Billing and the Receipt Book |
| R-026 | MEDIUM | HIGH | M10-F11 | Zero request-body validation across 95 routes; `/api/chat` writes an unbounded body verbatim into Firestore and logs |
| R-029 | MEDIUM | HIGH | M02-F06, M10-F11 | Browser-issued writes of devotee name, phone and quote with no server-side validation |
| R-030 | MEDIUM | HIGH | M03-F01 | The browser marks a booking paid on a user-typed reference |
| R-033 | MEDIUM | HIGH | M01-F08 | Two conflicting CSPs, both allowing `'unsafe-inline' 'unsafe-eval'` |
| R-095 | MEDIUM | HIGH | M01-F09 | Favourites read one store and write another; every click creates a duplicate bookmark |
| R-101 | MEDIUM | HIGH | M10-F12 | Two services claim `testimonials` with different semantics; an admin-created row appears in one list and not the other |
| R-102 | MEDIUM | HIGH | M10-F06 | Every server render and every API route silently receives four hardcoded testimonials instead of data |
| R-103 | MEDIUM | HIGH | M02-F07 | Fabricated devotees, phantom gallery rows and five invented live streams ship as real content |
| R-104 | MEDIUM | HIGH | M06-F08 | The content dashboard counts a collection that does not exist and filters on fields that are not there |
| R-106 | MEDIUM | HIGH | M06-F05 | Quotes cannot be edited or deleted at all — the actions column does not exist |
| R-108 | MEDIUM | HIGH | M02-F03 | Five of six public search filters return nothing; gurus and announcements are never searched |
| R-118 | MEDIUM | HIGH | M13-F03 | The UI promises reminders that nothing sends; "notifications" are `setTimeout` over an in-memory `Map` |
| R-140 | LOW | HIGH | M03-F04 | A hardcoded personal UPI id is the payment fallback in two money paths |
| R-165 | MEDIUM | HIGH | M09-F05 | A ~2,000-line subsystem with no UI, no rules and no reader; its writes are denied by default |
| R-180 | MEDIUM | HIGH | M13-F01 | `Permissions-Policy` kills camera and geolocation origin-wide while the UI still offers them |
| R-181 | MEDIUM | HIGH | M13-F04 | The QR scanner loads a non-dependency from a CDN the site's own CSP blocks |
| R-182 | MEDIUM | HIGH | M13-F02 | Two profile pages crash: `useI18n()` throws and no `error.tsx` exists anywhere in `app/` |
| R-188 | MEDIUM | HIGH | M07-F10 | `/admin/sevas` is the volunteer register; the real seva-catalogue admin UI has no importer |
| R-321 | MEDIUM | HIGH | M09-F06 | The AI E2E spec cannot load (`describe` never imported), so every assertion silently passes |
| R-322 | MEDIUM | HIGH | M09-F07 | The 275-case UAT suite asserts nothing about intent while the docs claim >95% accuracy — the regression gate §8 relies on does not work |

R-045 was raised LOW → MEDIUM: `REPORT.md` is a checked-in, undated instruction to delete authentication
from the receipts API, and this repository is explicitly agent-driven.

**One dropped HIGH was added as R-351.** M03-F05 is HIGH in the brain and `CONFIRMED`, but the dedupe split
it into a LOW row about fake loading states (R-273) and a MEDIUM row about documentation drift (R-342),
leaving its actual substance — the public `/quotes` page renders five hardcoded quotes and never touches
the 1,039-line quote engine, its ten public routes or its admin CRUD — in no row at all. Verified:
`grep -c quoteService app/(public)/quotes/page.tsx` → 0.

**Three deliberate exceptions remain**, now stated in §2.1 instead of being silent:

| Row | Grade | Brain source | Why it is not HIGH here |
|---|---|---|---|
| R-203 | MEDIUM | M13-F05 (HIGH) | ~12,000 dead lines repo-wide is scale, not danger; grading it HIGH would dilute a list meant for triage |
| R-170 | MEDIUM | M13-F06 (HIGH) | A missing `"use client"` on a barrel bloats seven pages' bundles; a performance fault with no correctness or access impact |
| R-045 | MEDIUM | M15-F08 (HIGH) | The code it describes has been restored; the risk is that a future agent re-applies it, which is real but latent |

After these changes the register is **351 rows — 85 HIGH, 164 MEDIUM, 102 LOW**, and the category table,
the section headings, the executive summary and §4 all carry the same numbers. A residual 32 rows sit one
grade below a MEDIUM source; in each the stronger aspect is carried by a sibling row, which is the intended
behaviour of the split. Promoted rows were **not** re-sorted inside their severity bands, so a HIGH row may
appear below MEDIUM ones; the §2.1 ordering note now says so.

### 10.3 Steelmanning the three losing options

**Option C (Capacitor / native shell), steelmanned.** The §4.1 table was titled "the four options, same
criteria", and on one criterion it was not. Option B is judged *after* Phases 0–2 — its risk row says the
main danger is API-contract churn, "mitigated by doing Phase 2 first" — while Option C is judged against
today's codebase: "ships all 351 faults to an app store". No option ships before P2; the phase order in
§3.3 and §7.3 is common to all four. Judged on the same footing, C is a shell over a *hardened* site, and
its cost (25–45 person-weeks against B's 106–178 — the figures as the table then stated them; since priced
properly at 22–42 and 70–118 incremental from the gate, §7.5) buys the two things a temple audience asks for —
an icon on the home screen and push reminders for Aaradhane and Ekadashi — for a quarter of the money. Its
real objections are narrower than the table admits: App Store guideline 4.2 rejects thin wrappers, but a
shell that adds push, camera and offline caching routinely passes; Capacitor's push and background
scheduling are second-class, but this product's notification need is a daily calendar reminder, not a
real-time feed. The honest statement is that C is a *product* decision — accept a WebView's feel and lose
the native seam forever — not the safety decision the table frames it as. The report should have priced
"C after Phase 2" and did not.

**Fixed 2026-09-19.** §4.1 now states one gate — the end of Phase 2, Friday 2026-12-11 — and scores all four
options at it, and §7.5 prices Option C at both timings: **29–51 person-weeks as a stop-gap before the gate**
(ending 2026-11-16 to 2026-12-30, P0 riding along, P1 and P2 unfixed) and **22–42 person-weeks after it**
(2027-01-25 to 2027-03-05). Four Option C cells were re-scored, Risk from "high, differently" to "moderate".
The recommendation was re-tested against the even table and **stands at Option B**, on the arithmetic that
C-then-B costs 12–23 person-weeks more than B alone, not on the safety claim this paragraph refutes. See
§10.8.

**Option D (Solito + Tamagui), steelmanned.** §4.3 already concedes that D's economics improve sharply "if
the public site were being rewritten anyway", and treats that as a hypothetical to revisit later. It is not
hypothetical. The sibling `UI-REDESIGN-PLAN.md`, written the same day and commissioned in the same breath,
re-specifies the primitive set (its §5: button, inputs, card shells, "remaining primitives") and every
public page (its §6), against a component layer whose two most-used primitives are already non-functional
stubs (R-201, R-202). Assumption 7.2(8) — "the redesign is scoped as a re-skin over `packages/tokens`, not
a component-library rebuild" — is therefore in tension with the plan it points at. If the primitives are
being rewritten once, rewriting them in Tamagui instead of Tailwind is a larger single job that deletes the
"every screen written twice" line item from Option B's ledger permanently. D's remaining objections are
real but are schedule and skill objections, not architectural ones, and both shrink if the redesign is
going to happen in P4 regardless. This is why §4.3 and decision 7 have been moved forward to the **Phase-2
gate (2026-12-11)**: after P3 the `packages/*` layout is committed and after P4 the re-skin budget is spent,
so a Phase-4 revisit is a revisit that cannot act.

**Option A (one universal Expo + RN-Web codebase), steelmanned.** The SEO objection assumes there is SEO to
lose. By this document's own evidence there is very little: zero per-route metadata, no sitemap, no robots
(R-160), fabricated content on the pages Google would index (R-103), and a public search that returns
nothing for five of six filters (R-108). "Losing" that costs less than the table implies, and a single
universal codebase removes the two-renderer tax forever. The counter in §4.2 is nevertheless correct and
survives: an absent sitemap is a two-day fix under Next and a structural problem under RN-Web, so A trades
a cheap fixable weakness for a permanent one, and it does so by rewriting a site that currently works.

**The recommendation stands.** Option B still wins, but for a narrower reason than §4.2 gives. The "35–45%
shared" figure that anchors the reuse criterion is not traceable to the portability matrix and has been
corrected: the measured `packages/*` share is ~14,500 lines, which is 9% of all source, 13% excluding
tests and tooling, and 17% excluding the admin console that stays web-only. The 35–45% number only holds if
the server tier is counted as "shared", which is true of every option including C. Option D's "55–70%" is
equally unmeasured and is now labelled as such. What actually decides it is not the percentage but the
sequencing argument in §4.2's third paragraph: Phases 0–3 must happen under any option, they are the work
the phone needs, and only B lets the web app keep shipping while they happen.

### 10.4 What would flip it, stated plainly

**If the UI redesign is approved at the scope `UI-REDESIGN-PLAN.md` actually describes — every primitive and
every public page re-specified — then the component library is being rebuilt once, and Option D becomes the
cheaper path to a mobile client. That decision lands at the Phase-2 gate, 2026-12-11, not later.** The
report now says this in §4.3 and in decision 7; before this review it said "revisit at the Phase-4 gate",
by which time both the `packages/*` layout and the re-skin budget are committed. The other three flip
conditions in §4.3 were checked and stand as written.

*(Sharpened 2026-09-19: the decision must be **taken on** Friday 2026-12-11, not merely tabled for it — P3
opens the next working day, Monday 2026-12-14, and commits the `packages/*` layout in its first week. A
second flip condition, available only now that Option C has a price, is recorded in §10.8.)*

### 10.5 Portability matrix — two rows were wrong

Eight module rows were compared against the brain files' own Portability tables and against the code.
Verdict distribution (6 rewrite / 6 adapt / 3 reuse) is arithmetically right, and all fifteen file/line
pairs match `.claude/state/inventory/SUMMARY.md` exactly. The three `reuse` verdicts (M08, M11, M12) all
disclose their `next/*` and DOM dependencies in the blocking-dependencies column, so none is a hidden
refutation. Two `reuse as-is` claims inside other rows were refuted by the code and are corrected above:

1. **M04 claimed `types/user.ts` reuse as-is.** `types/user.ts:1` is `import { Timestamp } from "firebase/firestore"` —
   it is one of the five files R-168 names as the largest obstacle to publishing `types/` cross-platform,
   and P3 is scheduled to strip exactly this. The row now says **adapt**.
2. **M13 claimed `lib/i18n/**` reuse as-is.** `lib/i18n/context.tsx:93,94,102` calls `localStorage.setItem`,
   `localStorage.getItem` and sets `document.documentElement.lang`. The dictionaries and `config.ts` do
   reuse; the provider is **adapt**.

Two softer tensions were left in place and are flagged rather than edited: M01 lists `lib/utils.ts` as
reuse-as-is when its entire body is `clsx` + `tailwind-merge`, a Tailwind class merger that only means
anything on a renderer that consumes Tailwind classes; and M02's "reuse as-is *once they call HTTP*" is a
contradiction in terms — a service rewritten to call HTTP is not reuse. Neither changes a verdict.

### 10.6 Arithmetic — one real error

Every working-day count, every phase boundary and both effort totals recompute exactly (§10.1). One
statement did not: §7.3 called the 165-working-day calendar "the mid-case". At the document's own stated
capacity of 3.5 productive person-weeks per elapsed week, 33 elapsed weeks buys 115.5 person-weeks, which is
the **low** end (106) plus 9%. The mid-case of the 106–178 range is 142 person-weeks = 40.6 elapsed weeks =
203 working days, ending **2027-06-30**; the high end is 254 working days, ending **2027-09-09**. §7.3 and
the executive summary now say so. Note that §7.2(7) separately sets aside ~3 elapsed weeks of public
holidays that none of these three dates deducts, and §7.4's own note that P3 days 10 and 15 fall on 25
December and 1 January still stands.

Two smaller factual corrections: the pure AI core is **3,748** lines, not ~2,600 (`lib/ai/intent/**` 2,104 +
`lib/ai/generator.ts` 1,191 + `services/ml.service.ts` 453, counted 2026-09-19) — which strengthens the
Option B case rather than weakening it; and the "15 files under `lib/ai/**`" claim in §1.4 and R-159 is 11
under `lib/ai/**` plus 4 AI services under `services/`, since M08-F16's own evidence list spans both.

### 10.7 What remains a judgement call

- **Whether R-203, R-170 and R-045 belong at HIGH.** The stated max-of-sources rule says yes; triage value
  says no. They are now listed as exceptions so the choice is visible rather than silent.
- **Option C's true cost after Phase 2.** Priced on 2026-09-19 in §7.5: **22–42 person-weeks** incremental,
  2027-01-25 to 2027-03-05, against B's 70–118 and 2027-05-07 to 2027-08-05. What remains a judgement call
  is no longer the number but the requirement. If the board's actual ask is "an icon on the home screen and
  Aaradhane reminders" and no native client is ever wanted, C wins by 48–76 person-weeks; if a native client
  ever follows, C costs 12–23 person-weeks more than going straight to B. That is a product decision and it
  is due at the same Phase-2 gate as decision 7.
- **Whether the redesign is a re-skin or a rebuild.** This is the single fact that decides B versus D, it is
  a scoping decision nobody has taken yet, and the two sibling documents currently assume different answers.
- **The ±40% spread on every effort number.** `node_modules` is absent by rule, so nothing was built,
  linted, type-checked or run — by this reviewer either. R-317 remains a static inference. The size of the
  `no-explicit-any` burn-down in P4 is unknowable until the rule is switched back on.
- **Severity ordering inside bands.** 22 promoted rows were not re-sorted. Re-sorting 351 rows would churn
  the ids readers are already citing; the ordering note in §2.1 was changed instead.

### 10.8 Criteria alignment (2026-09-19)

A third pass, on the one defect §10.3 recorded and left open: §4.1 judged Option B *after* Phase 2 and
Option C *against today's code*, and "C after Phase 2" was never priced. The table is what the decision gets
taken from, so it now applies one gate to all four options.

**The gate.** The end of Phase 2 — **Friday 2026-12-11** — because the Phase-2 work is required whatever is
chosen: §3.3's order and §7.3's phases 0–2 (36–60 person-weeks, 60 working days) are common to A, B, C and
D, and no second client of any kind can ship over a codebase where 88 of 95 route files perform no identity
check. Costs in §4.1 are now incremental from that gate with the gross figure in brackets.

**Cells re-scored.** Eight, seven of them in the cost row or in Option C:

| Option | Criterion | From | To |
|---|---|---|---|
| C | Risk | "High, differently. Ships all 351 faults to an app store…" | **Moderate** — the safety objection dissolves at the gate; what remains is guideline 4.2 and the permanently closed native seam, both product objections |
| C | Native capability access | "Poor to middling" | **Middling** — camera and geolocation via Capacitor once R-180/R-181 are fixed (C's own cost; they are in no phase's scope list), push adequate for a daily reminder, P2 delivering the subscription endpoint; background scheduling stays second-class |
| C | Code reuse | "~100% 'reuse' — it *is* the web app" | Same fact, opposite reading: **0% engineering reuse**, and C is the only option that never pays for P3's `packages/*`, so the next client starts from zero |
| C | Web SEO impact | "None for the web — but store-review risk replaces SEO risk" | **None**, and the store-review risk is smaller: R-103 is deleted in P1 and R-030 fixed in P2, leaving guideline 4.2 alone |
| C | Build / release complexity | "One web pipeline plus a thin store wrapper. Simplest." | Still simplest, **but not free**: the binary needs R-316's missing `test.yml` and R-312's quality gate like every other option |
| C | Rough cost | 25–45 person-weeks (asserted, undated) | **22–42 incremental** after the gate (58–102 gross); **29–51** if taken before it, P0 included — both derived line by line in §7.5 |
| B | Rough cost | 106–178 person-weeks | **70–118 incremental** (106–178 gross) = P3 10–16 + P4 24–40 + P5 28–48 + P6 8–14 |
| A / D | Rough cost | 150–240 / 140–220 | **114–180** and **104–160 incremental** (gross unchanged) |

Option A's and D's non-cost cells were re-read at the gate and none moved; A's Risk cell gained one sentence
noting that the gate makes A worse, since P3 and P4 are web-refactor work A discards. B's Risk cell was
always the gate-judged one — that asymmetry is what this pass removed.

**Option C priced at both timings — new §7.5.** As a stop-gap before the gate: **29–51 person-weeks** from
Monday 2026-09-21, 41 working days to **2026-11-16** at the low end and 73 to **2026-12-30** at the high end,
including a 6–10 person-week P0 ride-along that is not optional because a store binary cannot be patched the
way a web deploy can — and it fixes nothing P1 and P2 fix. After the gate: **22–42 person-weeks** from Monday
2026-12-14, 31 working days to **2027-01-25** and 60 to **2027-03-05**. The previously asserted 25–45 was
neither figure; it excluded both the P0 ride-along and the guideline-4.2 contingency round.

**The recommendation was re-tested and stands: Option B.** On the even table C is 48–76 person-weeks cheaper
than B and lands three to five months earlier like-for-like, so the margin is no longer a safety margin. What decides it is
arithmetic: C-then-B costs **118–201** person-weeks against B's **106–178** straight through — 12–23 more —
because 13–22 of C's build is discarded and only 10–19 carries over. C is cheaper only if it is the last
mobile decision the programme takes, and 7.2(5)'s scope — three money screens inside a WebView going through
store review — is not the product C is cheap for.

**Flip conditions.** V3's stands and is sharpened: if the redesign is approved at the scope
`UI-REDESIGN-PLAN.md` describes, the component library is rebuilt once and **D** becomes the cheaper route —
decided **on Friday 2026-12-11**, not merely tabled for it, because P3 opens Monday 2026-12-14 and commits
the `packages/*` layout in its first week. A second condition is now stated because C has a price: if the
requirement narrows to a home-screen icon plus Aaradhane and Ekadashi reminders with no native client ever,
**C** wins outright.

**Sections edited.** Executive summary item 9; §4.1 (heading, new gate preamble, six of seven table rows);
§4.2 (re-test block and the "why the others lose" line for C); §4.3 (new first bullet, admin bullet
re-stated at the gate, gate date sharpened); new **§7.5**; §9 decision 7; §10.3 and §10.7 bullet 2 to record
the fix; this entry.

**What did not change.** The register and its 351 rows / 85-164-102 split, the portability matrix, §6, §7.3's
person-week totals and every date in §7.4. The gross range is still 106–178 person-weeks and the low-end
calendar still ends 2027-05-07. The skeptic's notes in §10.1–10.7 stand; two passages were appended to, none
removed.

---

## Appendix: finding id index

Maps every module finding id to the register row(s) that carry it. 589 source findings → 351 register rows. R-351 was added by the reviewer from a HIGH aspect of M03-F05 that the original dedupe split across a LOW and a MEDIUM row.

**M01** F01→R-001, F02→R-003, F03→R-201, F04→R-202, F05→R-161, F06→R-234, F07→R-159, F08→R-033, F09→R-095, F10→R-315, F11→R-175, F12→R-175, F13→R-178, F14→R-176, F15→R-177, F16→R-179, F17→R-207, F18→R-204, F19→R-205, F20→R-206, F21→R-286, F22→R-287, F23→R-288, F24→R-117, F25→R-025, F26→R-162/R-237, F27→R-244, F28→R-243, F29→R-171, F30→R-303, F31→R-016, F32→R-219, F33→R-191, F34→R-136/R-162/R-192, F35→R-197, F36→R-190, F37→R-040, F38→R-222, F39→R-283, F40→R-284, F41→R-273, F42→R-314, F43→R-203, F44→R-257, F45→R-339, F46→R-335, F47→R-289, F48→R-206.

**M02** F01→R-158, F02→R-057, F03→R-108, F04→R-056, F05→R-014, F06→R-029, F07→R-103, F08→R-160, F09→R-159, F10→R-057, F11→R-203, F12→R-189, F13→R-116, F14→R-171, F15→R-235, F16→R-036, F17→R-242, F18→R-139, F19→R-102/R-259, F20→R-291/R-292, F21→R-247/R-293, F22→R-103, F23→R-275, F24→R-276, F25→R-120, F26→R-310, F27→R-040, F28→R-315, F29→R-280, F30→R-273, F31→R-169, F32→R-156, F33→R-154, F34→R-275, F35→R-228, F36→R-220, F37→R-203, F38→R-108, F39→R-103, F40→R-222, F41→R-205. Visual inventory→R-309.

**M03** F01→R-030, F02→R-013, F03→R-012, F04→R-140, F05→R-273/R-342/R-351, F06→R-273, F07→R-034, F08→R-274, F09→R-091, F10→R-029, F11→R-299, F12→R-336, F13→R-336, F14→R-107, F15→R-203, F16→R-189, F17→R-046/R-246, F18→R-119, F19→R-222/R-253, F20→R-315, F21→R-290, F22→R-161, F23→R-227/R-241, F24→R-252, F25→R-049, F26→R-136, F27→R-137, F28→R-138, F29→R-048/R-186, F30→R-082, F31→R-135, F32→R-032, F33→R-053, F34→R-109.

**M04** F01→R-004, F02→R-005, F03→R-006, F04→R-007, F05→R-008, F06→R-022, F07→R-070, F08→R-010, F09→R-021, F10→R-021, F11→R-206, F12→R-022/R-206, F13→R-299, F14→R-299, F15→R-190, F16→R-099, F17→R-098, F18→R-024, F19→R-007, F20→R-315, F21→R-025, F22→R-333, F23→R-031, F24→R-043, F25→R-040/R-235, F26→R-298, F27→R-295, F28→R-282, F29→R-100, F30→R-047, F31→R-261, F32→R-341, F33→R-040, F34→R-038, F35→R-292, F36→R-097, F37→R-018, F38→R-007/R-042/R-334, F39→R-099, F40→R-044.

**M05** F01→R-059, F02→R-052, F03→R-050, F04→R-051, F05→R-267, F06→R-189, F07→R-016, F08→R-017, F09→R-159, F10→R-021, F11→R-021, F12→R-266, F13→R-300, F14→R-290, F15→R-203, F16→R-212, F17→R-213, F18→R-214, F19→R-239, F20→R-296, F21→R-297, F22→R-295, F23→R-338, F24→R-204, F25→R-315, F26→R-040, F27→R-265, F28→R-291, F29→R-222/R-279, F30→R-275/R-302, F31→R-301, F32→R-308, F33→R-266, F34→R-139, F35→R-225, F36→R-189, F37→R-212.

**M06** F01→R-056, F02→R-056, F03→R-012/R-342, F04→R-015/R-187, F05→R-106, F06→R-057/R-168, F07→R-055, F08→R-104, F09→R-105, F10→R-209, F11→R-208, F12→R-203, F13→R-041, F14→R-174, F15→R-173, F16→R-159/R-315, F17→R-172, F18→R-103, F19→R-029, F20→R-295, F21→R-222/R-305, F22→R-304, F23→R-211, F24→R-291/R-292/R-303, F25→R-040, F26→R-169/R-229, F27→R-232, F28→R-275, F29→R-117, F30→R-058, F31→R-187.

**M07** F01→R-063, F02→R-061, F03→R-012, F04→R-053, F05→R-014, F06→R-021, F07→R-013, F08→R-064, F09→R-070, F10→R-188, F11→R-210, F12→R-124, F13→R-125, F14→R-126, F15→R-082, F16→R-085, F17→R-122, F18→R-088, F19→R-089, F20→R-203, F21→R-189, F22→R-315, F23→R-159, F24→R-123, F25→R-031, F26→R-301, F27→R-086, F28→R-281, F29→R-277, F30→R-127, F31→R-275, F32→R-219, F33→R-306, F34→R-062, F35→R-292/R-307, F36→R-235, F37→R-023, F38→R-264, F39→R-278, F40→R-336, F41→R-060, F42→R-014, F43→R-082, F44→R-083.

**M08** F01→R-011, F02→R-009, F03→R-001, F04→R-076/R-340, F05→R-079, F06→R-078, F07→R-073, F08→R-074, F09→R-203, F10→R-132, F11→R-133, F12→R-081, F13→R-080, F14→R-075/R-157, F15→R-075, F16→R-019/R-159, F17→R-025/R-241, F18→R-251, F19→R-315, F20→R-009, F21→R-026, F22→R-040, F23→R-140, F24→R-134, F25→R-134, F26→R-222, F27→R-340, F28→R-260, F29→R-262, F30→R-077, F31→R-131.

**M09** F01→R-075, F02→(playground reads fields the API never returns — folded into R-075's evidence), F03→R-011, F04→R-011, F05→R-165, F06→R-321, F07→R-322/R-343, F08→R-070, F09→R-112, F10→R-203, F11→R-164/R-203, F12→R-203, F13→R-011/R-020, F14→R-159, F15→R-238, F16→R-035, F17→(two markdown renderers — folded into R-035), F18→(the `_ux` envelope is never requested — folded into R-174), F19→R-111, F20→R-113, F21→R-114, F22→R-110, F23→R-321, F24→R-313, F25→R-268, F26→R-315, F27→R-222, F28→R-222, F29→R-322, F30→R-343, F31→R-040, F32→(training seed duplicates settings facts — folded into R-139), F33→R-294, F34→R-291, F35→R-130, F36→R-128, F37→R-113, F38→R-129, F39→R-129, F40→(regenerate drops the language — folded into R-079's family), F41→R-263, F42→R-340, F43→R-164, F44→R-189, F45→R-294, F46→R-194.

**M10** F01→R-001, F02→R-049, F03→R-056, F04→R-052, F05→R-159, F06→R-102, F07→R-061/R-083, F08→R-062, F09→R-064, F10→R-233, F11→R-026/R-029, F12→R-101, F13→R-101, F14→R-215, F15→R-203/R-214, F16→R-082, F17→(`isFirebaseConfigured` used without calling it — folded into R-259), F18→(AI telemetry gated on the wrong store — folded into R-073), F19→R-241, F20→R-096, F21→R-084, F22→R-237, F23→R-172, F24→R-259, F25→R-235, F26→R-337, F27→R-166, F28→R-267, F29→R-167, F30→R-003, F31→R-041, F32→R-315, F33→R-087, F34→R-203, F35→R-099, F36→R-168, F37→R-222, F38→R-220, F39→R-258, F40→R-138, F41→R-169, F42→R-012.

**M11** F01→R-049, F02→R-002, F03→R-004, F04→R-071, F05→R-070, F06→R-006, F07→R-072, F08→R-074, F09→R-080, F10→R-094, F11→R-094, F12→R-092, F13→R-093, F14→R-044, F15→R-094, F16→R-038, F17→R-261, F18→R-336, F19→R-158/R-159, F20→R-203/R-225, F21→R-203/R-218, F22→R-221, F23→R-221, F24→(a migration script with no dry-run — folded into R-094), F25→(a no-op migration with a contradictory header — folded into R-093), F26→R-315, F27→R-329/R-348, F28→R-107, F29→(a hardcoded expected count in a verify script — folded into R-094), F30→R-050, F31→R-259.

**M12** F01→R-007, F02→R-008, F03→R-009, F04→R-001, F05→R-011, F06→R-012, F07→R-015, F08→R-012, F09→R-013, F10→R-014, F11→R-027, F12→R-025, F13→R-026/R-333, F14→R-334, F15→R-164, F16→R-011, F17→R-020, F18→R-019, F19→R-053, F20→R-152, F21→R-064/R-268, F22→R-153, F23→R-315, F24→R-236, F25→R-240, F26→R-088, F27→R-163, F28→R-028, F29→R-039, F30→R-040, F31→R-222, F32→R-222, F33→R-038, F34→(a doc comment advertising a sub-route that does not exist — folded into R-334), F35→R-157, F36→R-110, F37→R-155, F38→R-195, F39→R-235, F40→R-269, F41→R-196, F42→R-193, F43→R-032, F44→R-174, F45→R-320.

**M13** F01→R-180, F02→R-182, F03→R-118, F04→R-181, F05→R-203, F06→R-170, F07→R-116, F08→R-116, F09→R-171, F10→R-115, F11→R-115, F12→R-159/R-162, F13→R-245, F14→(device analytics collected and discarded — folded into R-203), F15→R-183, F16→R-121, F17→R-184, F18→R-185, F19→R-186, F20→R-143, F21→R-048, F22→R-315, F23→R-199, F24→R-145, F25→R-222, F26→R-141, F27→R-144, F28→R-256, F29→R-198, F30→R-042/R-226, F31→R-223, F32→R-224, F33→R-332, F34→R-285, F35→R-142, F36→R-118, F37→R-146, F38→(a hook sets `isSharing` and never exposes it — folded into R-145).

**M14** F01→R-051, F02→R-054, F03→R-068, F04→R-065, F05→R-064, F06→R-069, F07→R-066, F08→R-090, F09→R-090, F10→R-217, F11→R-216, F12→R-150, F13→R-331, F14→R-331, F15→R-270, F16→R-271, F17→R-248, F18→R-272, F19→R-315, F20→R-250, F21→R-346, F22→R-218, F23→R-324, F24→R-219, F25→R-197, F26→R-219, F27→R-151, F28→R-082, F29→R-140, F30→R-217, F31→R-148/R-254, F32→R-067, F33→R-149, F34→R-200, F35→R-228, F36→R-147, F37→(the a11y proof service has no axe-core — folded into R-272), F38→R-159, F39→R-249, F40→R-255, F41→R-089, F42→R-346, F43→R-090.

**M15** F01→R-311, F02→R-312, F03→R-313, F04→R-314, F05→R-315, F06→R-233, F07→R-001, F08→R-045, F09→R-318, F10→R-318, F11→R-319, F12→R-324, F13→R-324, F14→R-328, F15→R-335, F16→R-326, F17→R-344, F18→R-323, F19→R-037, F20→R-160/R-350, F21→R-228, F22→R-313, F23→R-316, F24→R-222, F25→R-219, F26→R-231, F27→R-231, F28→R-329, F29→R-349, F30→R-327, F31→R-345, F32→R-346, F33→R-218, F34→R-325, F35→R-230, F36→R-347, F37→R-330, F38→R-317.

---

*Prepared 2026-09-19 from the verified brain files, the skeptic reports and the code. Effort figures are
estimates. No build, lint, type-check or test was executed in producing this document.*
