# M15 - Testing, CI/CD, deployment, tooling, project history and documentation health
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about

- "what tests exist and how do I run them" - runners, configs, npm scripts, and which of them actually work
- "why does `npx playwright test` not pick up my config" - `tests/playwright.config.ts` has a broken `testDir`
- "which parts of the app have zero test coverage" - services, components, app routes, hooks
- "what runs in CI, and what gates a deploy to production" - five workflows, and the answer is: nothing gates it
- "where is the deployment runbook" - `docs/DEPLOYMENT.md` is 0 bytes; there isn't one
- "how does the site get deployed and what secrets are needed" - `VERCEL_TOKEN`, `FIREBASE_SERVICE_ACCOUNT`, `E2E_BASE_URL`
- "where do the daily Panchanga and yearly Aaradhane jobs come from" - `.github/workflows/panchanga.yml`, `aaradhane.yml`
- "what are the Lighthouse budgets and are they enforced" - two budget files, enforced weakly
- "what is the history of this project, what sprint built what" - roadmap, sprint plan, sprint reports, lint/test artefacts
- "which docs can I trust" - per-file currency verdict with evidence for all 27 `docs/` files and the root reports
- "why do docs say Next.js 14 when package.json says 16" - documented drift, code is truth
- "what is `.continue`, `.openhands`, `fix_lint.sh`, `fix-websocket.ts`, `.deployment-trigger`" - agent tooling debris
- "what does the Postman collection cover" - 63 of 95 API routes, one request pointing at a route that does not exist
- "what analytics are collected and where do they go" - `page_views`, `daily_page_stats`, `chat_metrics`, `intent_metrics`, `unknown_questions`, `intent_feedback`
- "why is the Firestore read quota blowing up" - the admin dashboard reads up to 10,000 `page_views` docs per load
- "is `npm run typecheck` actually checking my tests" - no, `tsconfig.json` excludes `tests/**` and `scripts/**`
- "is the `no any` rule enforced" - no, ESLint disables it for the whole source tree
- "who runs the AI UAT suite and what does it cover" - 275 UAT cases across 15 categories
- "what happened to the admin receipts auth removal described in REPORT.md" - it was reverted; the report is stale
- "why are there hardcoded `*.prod-runtime.all-hands.dev` URLs in tests" - dead OpenHands sandbox hosts
- "what should I delete before a rearchitecture" - see *Tooling debris* and the Faults table

## Purpose and business role

This module is the repository's quality, delivery and self-description layer. It does not serve
devotees or admins directly; it is what the *team* uses to know whether the temple portal works,
how it gets to production, and what the project has been through.

It covers four things:

1. **Testing** - 50 Playwright spec files, 17 Jest unit files, an AI UAT corpus of 275 cases, 7 Python
   report generators and 2 shell runners. In total 144 files and ~49,000 lines: roughly a fifth of
   the repository by line count is test and meta material.
2. **Delivery** - five GitHub Actions workflows. One deploys to Vercel on every push to `main`; two
   are scheduled content jobs (daily Panchanga, yearly Aaradhane) that commit generated data back
   into the repo; one runs the AI UAT Jest suite; one runs Lighthouse.
3. **Project history** - the roadmap, the v2.0 sprint plan, five sprint testing summaries, a quality
   assessment and four root-level agent completion reports. Read together these reconstruct what was
   planned, what was built, and what was reverted.
4. **Documentation health and analytics** - the `docs/` corpus (27 files) plus the two analytics
   services (`analytics.service.ts`, `pageviews.service.ts`) and the client tracker that feeds them.

The honest summary: the *volume* of testing and documentation is large, its *binding force* is
near zero. No workflow runs the e2e suites, the Playwright config is misconfigured, typecheck skips
the tests, the lint rule the standards depend on is switched off, and the production deploy has no
gate in front of it.

## Code roots

From `.claude/state/chunks.json` (id M15):

```
tests/                                   50 spec files, 17 unit tests, 7 Python, 2 shell
jest.config.ts
.github/                                 dependabot.yml + 5 workflows
vercel.json
lighthouse-budget.json, lighthouse-budget-mobile.json
start-test.sh, test_plan.sh, fix_lint.sh, fix-websocket.ts
tsconfig.scripts.json
.continue/, .openhands/
.deployment-trigger, .env.example
package.json
README.md, AGENTS.md
AGENTS_REPORT.md, COMPLETION_REPORT.md, REPORT.md, BLOCKED_REPORT.md, final_report.txt
services/analytics.service.ts, services/pageviews.service.ts
postman/
docs/                                    27 files (26 .md + 1 .html)
```

Adopted from the Unassigned list in `.claude/state/inventory/SUMMARY.md`:

- `components/analytics/PageViewTracker.tsx` - the only caller of `trackPageView`; belongs with
  `services/pageviews.service.ts`. **Where it is mounted:** the `(public)` route-group layout,
  `app/(public)/layout.tsx:2,11` - **not** the root `app/layout.tsx`, which never imports it
  (`grep -n "PageViewTracker" app/layout.tsx` -> no match). So it runs on the public site only:
  `/admin/*`, the `(auth)` group and the top-level `app/knowledge` and `app/calendar` trees are
  outside that layout and are never tracked by this component. `proxy.ts:105-111` writes page views
  for *every* request, which is why the two writers double-count the public routes and only the
  proxy sees the admin ones (M01-F06). M02 owns the layout file and also lists this component as
  adopted; the analytics pipeline it feeds is here.

Also read as evidence but owned by nobody (recommend M15 adopt them in a later pass):
`reports/` (13 files - lint and sprint artefacts, `reports/generate_lint_reports.py`).

Read to confirm boundaries only, not owned: `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`,
`.gitignore`, `firestore.rules`, `app/admin/page.tsx`, `app/(public)/layout.tsx`.

## Entry points

| Route or entry | File | server/client | auth required | What it renders or does |
|---|---|---|---|---|
| `npm run build` | `package.json:8` | build | no | `next build`; `next.config.ts` sets no `ignoreBuildErrors` / `ignoreDuringBuilds` flags (verified 2026-09-19), so type errors do fail the build |
| `npm run lint` | `package.json:10` | build | no | bare `eslint`; config at `eslint.config.mjs` |
| `npm run typecheck` | `package.json:11` | build | no | `tsc --noEmit` - excludes `tests/**` and `scripts/**` (`tsconfig.json`) |
| `npm test` | `package.json:12` | node | no | Jest; `testMatch` is only `tests/unit/**/*.test.ts` and `tests/ai-uat/**/*.test.ts` (`jest.config.ts:9`) |
| `npm run test:coverage` | `package.json:14` | node | no | coverage collected from `lib/ai/**` only (`jest.config.ts:20-23`), threshold 50% |
| `npm run test:ai-uat` | `package.json:19` | node | no | `ts-node tests/ai-uat/run-uat-tests.ts` - custom runner, writes JSON/MD reports |
| `npm run test:ai-uat:jest` | `package.json:20` | node | no | `jest tests/ai-uat/ai-uat.test.ts` - the only test command any workflow runs |
| `npm run test:ai-uat:playwright` | `package.json:21` | node | no | `playwright test tests/ai-uat/ai-uat.spec.ts` - no `--config`, so `tests/playwright.config.ts` is ignored |
| `npm run report:ai-uat` | `package.json:22` | node | no | `tests/ai-uat/generate-report.ts` |
| `npm run firestore:dump` | `package.json:27` | node | service acct | live Firestore REST dump (see M11) |
| GH Actions: push to `main` | `.github/workflows/deploy.yml:3-6` | CI | `VERCEL_TOKEN` | `npm ci` -> `vercel pull/build/deploy --prod`. **No lint, typecheck or test step.** |
| GH Actions: push/PR touching `lib/ai/**` | `.github/workflows/ai-uat.yml:3-18` | CI | optional `E2E_BASE_URL` | Jest UAT job + Playwright job (`continue-on-error: true`) + summary job |
| GH Actions: push to `main` touching `app|components|lib` | `.github/workflows/lighthouse-ci.yml:3-12` | CI | none | desktop + mobile Lighthouse against a locally started server |
| GH Actions: cron 06:30/08:30/21:30/23:30 UTC | `.github/workflows/panchanga.yml:5-9` | CI | `contents: write` | runs `scripts/generate_panchanga.py`, commits `public/data/panchanga/current.json` |
| GH Actions: cron `30 3 1 1 *` | `.github/workflows/aaradhane.yml:5-6` | CI | `FIREBASE_SERVICE_ACCOUNT` | generates next year's Aaradhane events into Firestore |
| Dependabot | `.github/dependabot.yml` | CI | none | weekly npm + actions PRs, **all major updates ignored** |
| Vercel headers | `vercel.json:3-21` | edge | no | `no-store` cache headers on `/data/panchanga/*` |
| `<PageViewTracker />` | `app/(public)/layout.tsx:11` | client | no | fires `trackPageView` on every public-route navigation |
| `bash tests/run_e2e_tests.sh [group]` | `tests/run_e2e_tests.sh` | shell | no | wraps `npx playwright test` per folder, then `python3 tests/generate_test_summary.py` |
| `bash tests/quick_validation.sh` | `tests/quick_validation.sh` | shell | no | curl smoke test, default base `http://localhost:3456` |
| `bash start-test.sh` | `start-test.sh` | shell | no | starts prod server, runs user-journeys spec, `kill %1` |

## Component trees

### 1. Page-view tracking (the only runtime UI this chunk owns)

```
PublicLayout (server)                      app/(public)/layout.tsx
└── PageViewTracker (client)               components/analytics/PageViewTracker.tsx:30   [adopted]
    └── Suspense
        └── PageViewTrackerInner (client)  components/analytics/PageViewTracker.tsx:7
            ├── usePathname()              next/navigation
            ├── useSearchParams()          next/navigation
            ├── detectDeviceType()         local, reads navigator.userAgent  (:38)
            ├── detectLanguage()           local, reads navigator.language   (:51)
            └── trackPageView()            services/pageviews.service.ts:35
                ├── getOrCreateVisitorId() localStorage "visitor_id"  (:205)
                ├── addDoc -> page_views
                ├── setDoc -> daily_page_stats/{YYYY-MM-DD}
                └── setDoc -> daily_page_stats/{YYYY-MM-DD}_pages
```

Note the duplication: `detectDeviceType` exists identically in both
`components/analytics/PageViewTracker.tsx:38` and `services/pageviews.service.ts:219`.

### 2. Admin dashboard analytics read path

```
AdminDashboardPage (client)                app/admin/page.tsx
└── getAnalyticsSummary(days)              services/pageviews.service.ts:82
    └── getDocs(query(page_views, orderBy timestamp desc, limit 10000))   :113-119
        -> in-memory aggregation: unique visitors, top pages, sources, devices
        -> estimated session duration + bounce rate (heuristic, :166-168)
```

```
GET /api/admin/analytics                   app/api/admin/analytics/route.ts:7
└── getAnalyticsSummary()                  services/analytics.service.ts:338   (different function, same name)
    ├── getUnknownQuestionStats()          :94   -> unknown_questions (limit 1000)
    ├── getIntentFeedbackStats()           :226  -> intent_feedback  (limit 500)
    └── getFallbackRateMetrics()           :279  -> intent_metrics   (limit 1000)
POST /api/admin/analytics
└── logIntentFeedback()                    services/analytics.service.ts:197 -> intent_feedback
```

Producers of analytics rows outside this chunk: `lib/ai/generator.ts:42` calls
`logUnknownQuestion`; `services/ml.service.ts:7` calls `logIntentFeedback`.

### 3. Test-runner trees (which runner reaches which files)

```
Jest  (jest.config.ts:9, preset ts-jest, testEnvironment node)
├── testMatch **/tests/unit/**/*.test.ts        -> 17 files, ~499 tests
└── testMatch **/tests/ai-uat/**/*.test.ts      -> 1 file  (tests/ai-uat/ai-uat.test.ts)
    coverage scope (jest.config.ts:20-23): lib/ai/** only   -> threshold 50% b/f/l/s

Playwright (tests/playwright.config.ts)          BROKEN: testDir './tests/e2e' resolves to
├── projects chromium / firefox / webkit         tests/tests/e2e, which does not exist
├── Mobile Chrome (Pixel 5), Mobile Safari       (verified: no tests/tests/ directory)
└── reporters html+json+junit -> reports/
    -> in practice nobody passes --config, there is no root playwright.config.ts,
       so Playwright runs with defaults and picks up every *.spec.ts under cwd -
       which is why the "orphan" specs below are reachable by a bare
       `npx playwright test` from the repo root even though no script targets them

Custom TS runner (tests/ai-uat/run-uat-tests.ts)
└── ALL_UAT_TESTS (tests/ai-uat/test-cases.ts, 275 cases, 15 categories)
    ├── IntentDetector        lib/ai/intent
    └── generateResponse      lib/ai/generator
    -> writes reports, then tests/ai-uat/generate-report.ts renders them

Python (no requirements.txt anywhere in the repo)
├── tests/test_suite.py, tests/quick_test.py            requests-based HTTP smoke suites
└── tests/generate_*.py (5)                             openpyxl report writers, mostly abandoned

Shell
├── tests/run_e2e_tests.sh    group dispatcher -> npx playwright test -> generate_test_summary.py
├── tests/quick_validation.sh curl smoke, BASE_URL default localhost:3456
└── start-test.sh             prod server + one spec
```

## Data flow

### Flow A - a devotee loads a public page, the admin later sees it

1. `app/(public)/layout.tsx:11` renders `<PageViewTracker />` on every public route.
2. `PageViewTrackerInner` (`components/analytics/PageViewTracker.tsx:11`) fires a `useEffect` keyed on
   `pathname` + `searchParams`.
3. It calls `trackPageView({path, referrer, deviceType, language})` -
   `services/pageviews.service.ts:35`.
4. `getOrCreateVisitorId()` (`:205`) reads/writes `localStorage["visitor_id"]`.
5. Three Firestore writes: `addDoc(page_views)` (`:46`), `setDoc(daily_page_stats/{date})` with
   `increment(1)` (`:62`), `setDoc(daily_page_stats/{date}_pages)` with a per-path increment (`:69`).
6. Admin opens `/admin`; `app/admin/page.tsx:15` calls `getAnalyticsSummary()`
   (`services/pageviews.service.ts:82`), which reads **up to 10,000 `page_views` documents**
   (`:113-119`) and aggregates them in memory.
7. Every failure path returns a zeroed object (`:188-198`) - the dashboard shows zeros rather than an
   error, so a quota exhaustion looks identical to "no traffic".

### Flow B - Raya AI logs a question it could not answer

1. `lib/ai/generator.ts:42` imports `logUnknownQuestion` from `services/analytics.service.ts`.
2. `logUnknownQuestion` (`:17`) writes to `unknown_questions` with `processed: false` and
   `serverTimestamp()`.
3. `logIntentUsage` (`:156`) writes an `intent_metrics` row per response with `usedFallback`.
4. Admin console calls `GET /api/admin/analytics` -> `getAnalyticsSummary`
   (`services/analytics.service.ts:338`) which fans out to three capped queries.
5. An admin correcting an intent triggers `services/ml.service.ts:7` -> `logIntentFeedback`
   (`services/analytics.service.ts:197`) -> `intent_feedback`.

### Flow C - a push to `main` reaches production

1. Developer pushes to `main`.
2. `.github/workflows/deploy.yml:15-24` checks out, sets up Node 22, `npm ci`.
3. `:26-33` installs Vercel CLI, `vercel pull --environment=production`, `vercel build --prod`.
4. `:35-36` `vercel deploy --prebuilt --prod`.
5. There is **no** `npm run lint`, `npm run typecheck` or `npm test` step anywhere in this file.
   The only other trigger is `workflow_dispatch`.
6. An empty file `.deployment-trigger` exists at the repo root - its only plausible purpose is to be
   touched to force step 1.

### Flow D - daily Panchanga refresh

1. Cron fires four times a day (`.github/workflows/panchanga.yml:6-9`; the comment on `:5` claims
   "every 2 hours", which is wrong).
2. Sparse checkout of `scripts/` and `public/data/` (`:21-25`), Python 3.11, `pip install panchang`.
3. `python scripts/generate_panchanga.py` (`:35`) writes `public/data/panchanga/current.json`.
4. `:37-52` commits as `github-actions[bot]` and pushes; Vercel redeploys on the push.
5. `vercel.json:3-21` makes sure the file is served with `no-store`.

### Flow E - yearly Aaradhane generation

1. Cron `30 3 1 1 *` (1 January, 03:30 UTC = 09:00 IST) or `workflow_dispatch` with `year` /
   `dry_run` inputs (`.github/workflows/aaradhane.yml:5-19`).
2. `:67-82` checks `data/panchanga/<year>/` for JSON files. On disk today: `data/panchanga/2026` and
   `data/panchanga/2027`, 730 files total.
3. If absent, `:84-220` inlines a large Python heredoc that regenerates a whole year of Panchanga.
4. `:222-235` writes `FIREBASE_SERVICE_ACCOUNT` to `firebase-admin-key.json` in the runner workspace.
5. `:237-259` runs `scripts/generate-aaradhane.ts` in dry-run or live mode.

### Flow F - the AI UAT suite

1. `npm run test:ai-uat` -> `tests/ai-uat/run-uat-tests.ts:1`.
2. It imports `ALL_UAT_TESTS` and `TEST_STATS` from `tests/ai-uat/test-cases.ts:3077`, plus
   `IntentDetector` (`lib/ai/intent`) and `generateResponse` (`lib/ai/generator`).
3. Each case asserts detected intent, language and repository against the expectation; results are
   aggregated per `TestCategory` (`tests/ai-uat/test-cases.ts:12-28`, 15 categories including
   `PROMPT_INJECTION`, `MEMORY`, `KANNADA`, `MIXED`).
4. `tests/ai-uat/generate-report.ts` renders the JSON into a report under `reports/`.
5. In CI only the Jest variant runs (`.github/workflows/ai-uat.yml:50`), with Firebase, retrieval and
   knowledge all mocked (`tests/ai-uat/ai-uat.test.ts:48,54,159`) - so no live LLM or Firestore calls.

## Key files

### Runners and configs

| File | Lines | Role | Key exports | Notes |
|---|---|---|---|---|
| `package.json` | 100 | scripts + dependency manifest | - | next ^16.2.9, react 19.2.4, jest 29, playwright 1.61; 25 scripts, all script targets verified present |
| `jest.config.ts` | 35 | Jest config | default `Config` | ts-jest, node env, `@/` mapped; coverage scope `lib/ai/**` only |
| `tests/playwright.config.ts` | 133 | Playwright config | default | `testDir: './tests/e2e'` resolves wrong (F01); 5 projects; html/json/junit reporters into `reports/` |
| `tsconfig.scripts.json` | 21 | ts-node config for `scripts/` and UAT runners | - | strict, CommonJS, includes `scripts/**`, `lib/**`, `types/**` |
| `vercel.json` | 23 | edge cache headers | - | `no-cache, no-store` on `/data/panchanga/*` |
| `lighthouse-budget.json` | 37 | desktop budget | - | perf >= 0.8, a11y >= 0.9, LCP <= 3000ms |
| `lighthouse-budget-mobile.json` | 34 | mobile budget | - | perf >= 0.7, a11y >= 0.85, LCP <= 4000ms |
| `.env.example` | - | env var template | - | Firebase, Vercel Blob, AI provider (openai/gemini/claude/openrouter), Supabase; safe to read |

### CI/CD

| File | Lines | Role | Trigger | Secrets |
|---|---|---|---|---|
| `.github/workflows/deploy.yml` | 37 | production deploy | push `main`, dispatch | `VERCEL_TOKEN` |
| `.github/workflows/ai-uat.yml` | 124 | AI UAT unit + Playwright + summary | push/PR on `lib/ai/**`, `components/ai/**`, `tests/ai-uat/**`, `AI_UAT.md` | `E2E_BASE_URL` (optional) |
| `.github/workflows/lighthouse-ci.yml` | 132 | desktop + mobile Lighthouse | push `main` on `app|components|lib`, dispatch | none |
| `.github/workflows/panchanga.yml` | 53 | daily Panchanga commit | 4 crons, dispatch | none (`contents: write`) |
| `.github/workflows/aaradhane.yml` | 281 | yearly Aaradhane -> Firestore | cron 1 Jan, dispatch | `FIREBASE_SERVICE_ACCOUNT` |
| `.github/dependabot.yml` | 15 | dependency PRs | weekly | - |

### Tests - Playwright e2e (`tests/e2e/`, 33 specs)

| File | Lines | describes / tests | Covers |
|---|---|---|---|
| `tests/e2e/test-utils.ts` | 228 | - | shared helpers: `BASE_URL`, `VIEWPORTS`, `waitForPageLoad`, `getAllLinks`, `takeScreenshot`, `getMetaContent` |
| `tests/e2e/home/homepage.spec.ts` | 269 | 10 / 32 | Homepage Module - load, title, lang, viewport, nav, hero |
| `tests/e2e/about/about.spec.ts` | 203 | 11 / 23 | About Page Module |
| `tests/e2e/events/events.spec.ts` | 219 | 7 / 20 | Events Module |
| `tests/e2e/gallery/gallery.spec.ts` | 212 | 6 / 17 | Gallery Module |
| `tests/e2e/sevas/sevas.spec.ts` | 286 | 8 / 24 | Sevas (Services) Module |
| `tests/e2e/donations/donations.spec.ts` | 282 | 8 / 28 | Donations Module |
| `tests/e2e/aaradhane/aaradhane.spec.ts` | 285 | 19 / 30 | Aaradhane (Worship Schedule) Module |
| `tests/e2e/auth/auth.spec.ts` | 169 | 5 / 23 | Authentication Module |
| `tests/e2e/admin/admin.spec.ts` | 318 | 12 / 32 | Admin Portal Module |
| `tests/e2e/chatbot/chatbot.spec.ts` | 356 | 8 / 20 | Raya AI chatbot; heaviest conditional-assertion density (F33) |
| `tests/e2e/navigation/navigation.spec.ts` | 257 | 9 / 21 | Navigation Module |
| `tests/e2e/forms/forms.spec.ts` | 272 | 8 / 23 | Forms Module |
| `tests/e2e/api/api.spec.ts` | 177 | 9 / 25 | API Routes Module |
| `tests/e2e/api-integration/api-integration.spec.ts` | 300 | 15 / 35 | API Integration: Public Endpoints |
| `tests/e2e/firestore/firestore.spec.ts` | 236 | 8 / 20 | Firestore Module |
| `tests/e2e/storage/storage.spec.ts` | 196 | 6 / 13 | Firebase Storage Module |
| `tests/e2e/accessibility/accessibility.spec.ts` | 372 | 9 / 29 | Accessibility Module |
| `tests/e2e/performance/performance.spec.ts` | 313 | 9 / 20 | Performance Module |
| `tests/e2e/responsive/responsive.spec.ts` | 336 | 10 / 25 | Responsive Design Module |
| `tests/e2e/security/security.spec.ts` | 287 | 10 / 25 | Security Module |
| `tests/e2e/seo/seo.spec.ts` | 316 | 12 / 35 | SEO Module |
| `tests/e2e/error-handling/error-handling.spec.ts` | 324 | 11 / 26 | Error Handling Module |
| `tests/e2e/user-journeys/user-journeys.spec.ts` | 383 | 13 / 38 | User Journey: Temple Visitor |
| `tests/e2e/sprint3/sprint3-test-utils.ts` | 189 | - | `TEST_USERS` with default passwords (F19), `login()`, `AUTH_STORAGE_PATH` |
| `tests/e2e/sprint3/authenticated.spec.ts` | 372 | 7 / 23 | Authenticated User Tests - Sprint 3 |
| `tests/e2e/sprint3/admin-crud.spec.ts` | 493 | 10 / 34 | Admin Portal CRUD Tests - Sprint 3 |
| `tests/e2e/sprint3/visual-regression.spec.ts` | 417 | 8 / 20 | Visual Regression Tests - Sprint 3 |
| `tests/e2e/sprint3/performance-benchmark.spec.ts` | 523 | 8 / 24 | Performance Benchmarking - Sprint 3 |
| `tests/e2e/sprint4/admin-expanded.spec.ts` | 619 | 8 / 31 | Admin Expanded CRUD - Sprint 4 |
| `tests/e2e/sprint4/mobile-specific.spec.ts` | 717 | 7 / 25 | Mobile-Specific Tests - Sprint 4 |
| `tests/e2e/sprint4/security-tests.spec.ts` | 593 | 10 / 30 | Security Tests - Sprint 4 |
| `tests/e2e/sprint5/accessibility.spec.ts` | 508 | 7 / 24 | axe-core a11y - Sprint 5 (`@axe-core/playwright`) |
| `tests/e2e/sprint5/api-contract.spec.ts` | 428 | 11 / 30 | API Contract Testing - Sprint 5 |
| `tests/e2e/sprint5/chaos-engineering.spec.ts` | 461 | 8 / 20 | Chaos Engineering - Sprint 5 |
| `tests/e2e/sprint5/test-data-utils.ts` | 311 | - | factories: `EventData`, `UserData`, `SevaData`, `GalleryData` |

### Tests - functional suite (`tests/functional/`, 11 specs)

**Ten** of the eleven (`01_` .. `10_`) hardcode
`const BASE_URL = 'https://work-1-dhvcepsnljpkopbv.prod-runtime.all-hands.dev'` at line 3 - a dead
OpenHands sandbox (F03). They ignore `BASE_URL` from the environment. The eleventh,
`tests/functional/comprehensive.spec.ts:3`, hardcodes `http://localhost:3000` instead - also not
env-driven, but at least reachable locally.

| File | Lines | tests | Covers |
|---|---|---|---|
| `tests/functional/01_homepage.spec.ts` | 250 | 30 | Homepage Module |
| `tests/functional/02_authentication.spec.ts` | 226 | 25 | Authentication Module |
| `tests/functional/03_admin_dashboard.spec.ts` | 232 | 25 | Admin Dashboard Module |
| `tests/functional/04_devotees.spec.ts` | 312 | 32 | Devotees Module |
| `tests/functional/05_seva_booking.spec.ts` | 344 | 32 | Seva Booking Module |
| `tests/functional/06_donations.spec.ts` | 315 | 36 | Donation Module |
| `tests/functional/07_events_gallery_announcements.spec.ts` | 407 | 40 | Events / Gallery / Announcements |
| `tests/functional/08_mobile_responsive.spec.ts` | 349 | 35 | Mobile and Responsive Testing |
| `tests/functional/09_performance_security.spec.ts` | 445 | 45 | Performance + Security |
| `tests/functional/10_database_browser.spec.ts` | 285 | 40 | Database Validation |
| `tests/functional/comprehensive.spec.ts` | 640 | 57 | Homepage Functional Tests (+13 more describes) |

### Tests - orphan specs at `tests/` root

| File | Lines | tests | Notes |
|---|---|---|---|
| `tests/comprehensive_validation.spec.ts` | 660 | 90 | "Complete Application Retest - All Modules"; in no runner's default path |
| `tests/e2e_test.spec.ts` | 204 | 23 | hardcodes `work-2-yehrroerabrftaxm.prod-runtime.all-hands.dev:3` |
| `tests/kannada-font-validation.spec.ts` | 412 | 1 | font-glyph validation, writes screenshots + PDFs |
| `tests/quick_validation.spec.ts` | 102 | 15 | 15-check smoke |
| `tests/reports/save-reports.spec.ts` | 177 | 7 | demo for `@/lib/reports/report-saver` -> Vercel Blob; the `@/` alias will not resolve without a config |

### Tests - Jest unit (`tests/unit/`, 17 files, ~499 tests)

| File | Lines | tests | What it actually exercises |
|---|---|---|---|
| `tests/unit/intent.test.ts` | 712 | 118 | `lib/ai/intent` - real behaviour, the strongest suite here |
| `tests/unit/system-prompt.test.ts` | 403 | 66 | anti-hallucination rules in the system prompt |
| `tests/unit/knowledge-bootstrap.test.ts` | 340 | 40 | reads `seed/ai/*.json` off disk via `jest.requireActual("fs")`; no module imports |
| `tests/unit/knowledge-workflow.test.ts` | 572 | 39 | `types/knowledge-workflow` shapes |
| `tests/unit/multi-source-retrieval.test.ts` | 610 | 34 | `types/multi-source-retrieval` shapes |
| `tests/unit/response-generator.test.ts` | 408 | 31 | `lib/ai` response generation |
| `tests/unit/knowledge.test.ts` | 210 | 26 | seed articles |
| `tests/unit/quote.service.test.ts` | 582 | 25 | quote rotation logic via `types/quote` only - not `services/quote.service.ts` |
| `tests/unit/aaradhane/gurus.test.ts` | 206 | 24 | `GURU_AARADHANES` dataset (M14) |
| `tests/unit/ai-analytics.test.ts` | 573 | 21 | **imports no service** - redeclares local interfaces (F10) |
| `tests/unit/aaradhane/panchanga.test.ts` | 255 | 18 | `lib/aaradhane/panchanga` + fixture files (M14) |
| `tests/unit/receipt-validation.test.ts` | 156 | 17 | `lib/receipt/validation` (M14/M07) |
| `tests/unit/api-knowledge-routes.test.ts` | 271 | 16 | fs-based assertions about route files, not HTTP |
| `tests/unit/proof-report.test.ts` | 141 | 8 | `services/proof-report/*` - the only unit file importing a service; also hardcodes a dead OpenHands sandbox host at `:11`, fed to `new ProofReportService(testBaseUrl, ...)` at `:124` (F03) |
| `tests/unit/receipt-numbering.test.ts` | 47 | 8 | `lib/receipt/numbering` |
| `tests/unit/receipt-payment.test.ts` | 60 | 8 | UPI payment string + catalogue totals |
| `tests/unit/aaradhane/generator.test.ts` | 252 | 5 | `validateGeneratedEvents` (M14) |

### Tests - AI UAT (`tests/ai-uat/`)

| File | Lines | Role |
|---|---|---|
| `tests/ai-uat/test-cases.ts` | 3118 | 275 cases, 15 `TestCategory` values, personas, `TEST_STATS` (`:3077`), `getTestsBy*` helpers |
| `tests/ai-uat/ai-uat.test.ts` | 629 | Jest suite; mocks firebase/retrieval/knowledge (`:48,54,159`); lines 1-2 were injected by `fix-websocket.ts` |
| `tests/ai-uat/ai-uat.spec.ts` | 908 | Playwright suite; `BASE_URL` falls back to a dead sandbox (`:17`) |
| `tests/ai-uat/run-uat-tests.ts` | 285 | standalone ts-node runner, writes `SummaryReport` with regressions |
| `tests/ai-uat/generate-report.ts` | 414 | renders the JSON summary into human reports |
| `tests/ai-uat/index.ts` | 12 | barrel re-exporting test cases + `Intent`/`IntentCategory` |

### Tests - Python and shell

| File | Lines | Role | Verdict |
|---|---|---|---|
| `tests/test_suite.py` | 2315 | 200+ case `requests`-based HTTP suite, `TEST_BASE_URL` env | usable, no deps file |
| `tests/quick_test.py` | 602 | fast HTTP smoke suite | usable, no deps file |
| `tests/generate_test_summary.py` | 229 | reads `reports/playwright-test-results.json`, relative paths | the only portable generator |
| `tests/generate_reports.py` | 868 | opens `/workspace/project/Rayaramathaynk/reports/test_results.json` **at import time** (`:15`) | abandoned, crashes outside the sandbox |
| `tests/generate_reports_final.py` | 308 | hardcoded sandbox `BASE_URL` (`:13`) **and** `/workspace/project/...` output paths (`:94,174,205,302`), `TOTAL_TEST_CASES = 340` | abandoned |
| `tests/generate_final_reports.py` | 278 | writes to `/workspace/project/...` (`:94,179,210,272`) | abandoned |
| `tests/generate_playwright_report.py` | 440 | **hardcoded test results** (23/6/17, `:14-30`) written out as a report | abandoned + misleading (F13) |
| `tests/run_e2e_tests.sh` | 130 | group dispatcher for playwright + python summary | usable |
| `tests/quick_validation.sh` | 240 | curl smoke, `BASE_URL` default `localhost:3456` (`:7`) - the only place that port appears | usable, odd default |

### Root tooling and debris

| File | Lines | Role | Keep? |
|---|---|---|---|
| `start-test.sh` | 5 | start prod server, run one spec, `kill %1` | rewrite - job control fails under non-interactive `sh` |
| `test_plan.sh` | 2 | `npm run lint` | delete |
| `fix_lint.sh` | 2 | `npm run lint -- --fix` | delete |
| `fix-websocket.ts` | 10 | mutates `tests/ai-uat/ai-uat.test.ts` in place to inject a `ws` global | delete - its effect is already committed |
| `.deployment-trigger` | 0 | empty file, touched to force a deploy | keep only if documented |
| `.continue/rules.md` | 18 | Continue.dev agent rules; says "Next.js" with no version | keep, thin |
| `.openhands/README.md` | 43 | index of the OpenHands templates | keep |
| `.openhands/project-context.md` | 133 | persistent agent context; repo `github.com/ngowda759/Rayaramathaynk`; claims Next.js 14 (`:43`) | update |
| `.openhands/prompt-template.md` | 110 | task prompt template | keep |
| `.openhands/feature-template.md` | 247 | feature doc template | keep |
| `.openhands/review-checklist.md` | 150 | pre-commit review checklist | keep |
| `.openhands/sprint-template.md` | 182 | sprint planning template | keep |
| `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json` | 1614 | 81 requests / 25 top-level folders; committed Firebase Web API key + prod host | sanitise |

### Reconstructed timeline

Dates are absolute, taken from the artefacts themselves. Today is **2026-09-19 (Saturday)**; the
"age" column is `2026-09-19 minus the stated date`, computed, not estimated.

| Date | Age | Event | Source |
|---|---:|---|---|
| Jan 2025 (claimed) | ~20 months | v1.0 "Foundation" declared complete - public site + admin CRUD | `docs/ROADMAP.md:17` (its own timeline at `:180` says 2025 Q4 instead) |
| undated | - | `docs/AI_ASSISTANT.md` written - describes replacing the Chatbase integration with Raya AI, so it predates the 2026-07 AI docs; it carries **no date stamp at all** | `docs/AI_ASSISTANT.md:1-6` |
| 2026-01-15 | 247 days | first stamp on `docs/CONTENT-GUIDELINES.md` | `docs/CONTENT-GUIDELINES.md` |
| 2026-07-07/08 | 73/72 days | Panchanga engine documented | `docs/PANCHANGA.md` |
| 2026-07-13 07:20 | 68 days | first lint sweep - 60 issues / 12 errors | `reports/lint_results.json`, `reports/LintReport.md` |
| 2026-07-13 07:45 | 68 days | second lint artefact, same day, different numbers - 98 issues / 3 errors | `reports/LintExecutiveSummary.md`, `reports/lint-output.txt` |
| 2026-07-15 | 66 days | Raya AI architecture audit + AI UAT corpus written | `docs/AI_ARCHITECTURE_AUDIT.md`, `docs/RAYA_AI_ARCHITECTURE.md`, `AI_UAT.md` |
| 2026-07-19 | 62 days | the documentation push - 7 core docs stamped the same day | `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/SECURITY.md`, `docs/UI-GUIDELINES.md`, `docs/ADMIN-GUIDELINES.md`, `docs/AI-GUIDELINES.md`, `docs/ROADMAP.md` |
| 2026-07-20 | 61 days | quality assessment: "production-ready with minor improvements", build + typecheck pass, 39 lint errors | `docs/QUALITY_ASSESSMENT_REPORT.md:4,224` |
| 2026-07-21 | 60 days | quote engine documented | `docs/QUOTE-ENGINE.md` |
| 2026-07-23 | 58 days | v2.0 sprint plan written - 5 sprints, 20 modules | `docs/SPRINT-PLAN-V2.md:5` |
| 2026-07-28 | 53 days | the testing marathon: all five sprint testing summaries and the page-status run are stamped this date | `reports/SPRINT2..5_TESTING_SUMMARY.md`, `reports/TESTING_SUMMARY.md`, `reports/test_results.json` |
| undated, after | - | agent-run reports: ADC project-id fix, receipts "Create" tab, receipts auth removal (later reverted), Firestore health audit | `AGENTS_REPORT.md`, `COMPLETION_REPORT.md`, `REPORT.md`, `final_report.txt` |
| undated, after | - | Supabase migration designed, then blocked on credentials | `docs/SUPABASE_DATABASE_SCHEMA.md`, `docs/FIRESTORE_MIGRATION.md`, `BLOCKED_REPORT.md` |
| 2026-09-10 | 9 days | Firestore dump / Supabase migration tooling section appended to the agent contract | `AGENTS.md` |

**Planned vs built.** The v2.0 sprint plan was substantially delivered: `lib/i18n/`,
`app/(public)/profile/`, `app/(public)/display/page.tsx`, `app/(public)/live/page.tsx`,
`app/(public)/search/page.tsx`, `app/admin/library/page.tsx`, `app/admin/stotras/page.tsx` and
`app/admin/media/page.tsx` all exist. What did **not** keep pace is the record of it: `docs/ROADMAP.md`
still lists analytics and testimonials as unstarted (F31), `docs/API.md` still documents three
endpoints out of 95 (F16), and `docs/PROJECT_STRUCTURE.md` still describes a Next.js 14 tree with two
API routes. The Supabase migration is the one large planned item that demonstrably did not land.

### Root reports (project history)

| File | Lines | What it records | Currency |
|---|---|---|---|
| `README.md` | 310 | setup, scripts, AI seeding, 4-phase roadmap | **partially stale** - no Supabase, no test scripts, no Panchanga/Aaradhane; "Maintainer: Naveen C" |
| `AGENTS.md` | 451 | the AI agent contract; tech stack table; Firestore dump notes dated 2026-09-10 (9 days old) | **current-ish but drifted** - `:213` says Next.js 14 |
| `AGENTS_REPORT.md` | 28 | ADC `projectId` fallback added to `lib/admin-firebase.ts` | plausible, undated |
| `COMPLETION_REPORT.md` | 28 | `/receipts` page gained a "Create Receipt" tab | plausible, undated |
| `REPORT.md` | 37 | records deliberate removal of admin auth from receipts | **stale and dangerous** - reverted in code (F08) |
| `BLOCKED_REPORT.md` | 12 | Firestore->Supabase migration aborted for missing credentials | still true - see M11 |
| `final_report.txt` | - | Firestore health audit: sevas/dailyPoojas collection split, read-cost table | **mostly still true** (see below) |

`final_report.txt` verified against code on 2026-09-19:
`services/pooja.service.ts:16` still `const COLLECTION_NAME = "dailyPoojas"`; `firestore.rules` still has
a `match /sevas/{sevaId}` (`:76`) and **no** `dailyPoojas` match; `hooks/useDonationNotifications.ts:75`
still polls every 60 s. The audit's central finding is unfixed.

### `docs/` health - all 27 files

Verdicts as of 2026-09-19. Most of the corpus was written 2026-07-13 .. 2026-07-23, i.e. 58-68 days ago.

| File | Lines | Stated date | Verdict | Evidence |
|---|---|---|---|---|
| `docs/CHANGELOG.md` | 0 | - | **empty** | 0 bytes |
| `docs/DEPLOYMENT.md` | 0 | - | **empty** | 0 bytes - yet `README.md` and `docs/SPRINT-5-DEPLOYMENT.md` both point at deployment as a documented topic |
| `docs/API.md` | 203 | - | **stale** | documents 3 endpoints (`/api/admin/users/create-admin`, `/api/admin/users/set-role`, `/api/gallery/local-assets`) out of 95 `route.ts` files; base URL `rayaramathaynk.vercel.app` differs from the Postman `sri-raghavendra-mutt.vercel.app` |
| `docs/PROJECT_STRUCTURE.md` | 237 | - | **stale** | `:5,229` say Next.js 14; its `app/api/` tree lists 2 route groups against 95 actual; no `lib/ai`, `lib/i18n`, `lib/supabase`, `lib/receipt` |
| `docs/ARCHITECTURE.md` | 337 | 2026-07-19 | **partially stale** | `:18` "Frontend (Next.js 14)"; structure otherwise broadly matches |
| `docs/DATA-MODEL.md` | 839 | 2026-07-19 | **partially stale** | predates the Supabase work in `docs/SUPABASE_DATABASE_SCHEMA.md`; grade against M11 |
| `docs/SECURITY.md` | 619 | 2026-07-19 | **partially stale** | written before the receipts auth episode in `REPORT.md` |
| `docs/UI-GUIDELINES.md` | 430 | 2026-07-19 | current-ish | design-token guidance, no version claims |
| `docs/ADMIN-GUIDELINES.md` | 706 | 2026-07-19 | current-ish | admin CRUD patterns; grade against M05 |
| `docs/AI-GUIDELINES.md` | 487 | 2026-07-19 | current-ish | retrieval-first rules; matches `tests/unit/system-prompt.test.ts` |
| `docs/CONTENT-GUIDELINES.md` | 398 | 2026-07-19 (also 2026-01-15) | current-ish | two different "last updated" dates in one file |
| `docs/CODING-STANDARDS.md` | 116 | - | current-ish | naming conventions only; no `any`-policy statement to conflict with ESLint |
| `docs/ROADMAP.md` | 277 | 2026-07-19 | **partially stale** | deprecates `lib/legacy-api.ts` -> `lib/api/v2.ts`, neither exists; lists Analytics Dashboard and Testimonials as unbuilt though `app/api/admin/analytics/route.ts` and `app/api/testimonials/route.ts` exist; "v1.0 Completed January 2025" vs the timeline's "2025 Q4 v1.0 Complete" |
| `docs/SPRINT-PLAN-V2.md` | 394 | 2026-07-23 | **largely delivered** | every Sprint 1-5 artefact spot-checked exists: `lib/i18n/`, `app/(public)/profile/`, `app/(public)/display/page.tsx`, `app/admin/library|stotras|media/page.tsx`, `app/(public)/live/page.tsx`, `app/(public)/search/page.tsx` |
| `docs/SPRINT-5-DEPLOYMENT.md` | 266 | - | **current** | every route it names exists on disk; despite the title it is a feature doc, not a deployment runbook |
| `docs/QUALITY_ASSESSMENT_REPORT.md` | 229 | 2026-07-20 | **stale** | `:13` Next.js 14; `:224` "39 errors, 347 warnings"; P0 "add sitemap.xml" still open - no `app/sitemap.ts`, `app/robots.ts`, `public/sitemap.xml` or `public/robots.txt` |
| `docs/AI_ARCHITECTURE_AUDIT.md` | 409 | 2026-07-15 | historical | an audit snapshot; treat as history |
| `docs/RAYA_AI_ARCHITECTURE.md` | 690 | 2026-07-15 | current-ish | grade against M08 |
| `docs/AI_ASSISTANT.md` | 420 | none | **undated** | no "last updated" line anywhere; the only 2024 strings in the file are a sample payload value (`:324` `"lastChecked": "2024-01-01T00:00:00Z"`) and a model id (`:101` `claude-3-haiku-20240307`), neither of which dates the document. Content describes replacing Chatbase, so it is early |
| `docs/AI_ENHANCEMENTS.md` | 258 | "July 2026" | **status unknown** | header says "Status: In Progress" with no item-level state |
| `docs/PANCHANGA.md` | 428 | 2026-07-07/08 | current-ish | grade against M14 |
| `docs/AARADHANE_GENERATOR.md` | 377 | - | current-ish | duplicated at root as `AARADHANE_GENERATOR.md` (250 lines, different content) |
| `docs/QUOTE-ENGINE.md` | 534 | 2026-07-21 | current-ish | grade against M06 |
| `docs/FIREBASE.md` | 153 | - | current-ish | thin; predates Supabase |
| `docs/FIRESTORE_MIGRATION.md` | 77 | - | **aspirational** | describes a migration `BLOCKED_REPORT.md` says never ran |
| `docs/SUPABASE_DATABASE_SCHEMA.md` | 419 | - | **proposal, not reality** | "outlines the proposed migration"; grade against M11 |
| `docs/ARCHITECTURE_DIAGRAM.html` | 648 | - | unverified | a standalone HTML diagram; not read in this pass |

Root docs outside the `docs/` folder that also carry history:
`AI_UAT.md` (2026-07-15, owned by M09), `AARADHANE_QUICKREF.md` (references `scripts/panchanga.py`,
which exists), `FIRESTORE_IMPORT.md` (references `npm run export:aaradhane`, which does **not** exist
in `package.json`), `CLAUDE.md` (one line: `@AGENTS.md`).

### `reports/` artefacts (adopted as evidence, 13 files)

| File | What it says | Contradiction |
|---|---|---|
| `reports/lint_results.json` | `"timestamp": "2026-07-13T07:20:32"`, 60 issues / 12 errors / 48 warnings | - |
| `reports/LintReport.md` | 60 issues, 12 errors | agrees with the JSON |
| `reports/LintExecutiveSummary.md` | 98 issues, **3 errors**, 95 warnings, "Code Quality Score 96.9%" | disagrees with both |
| `reports/lint-output.txt` | `✖ 98 problems (3 errors, 95 warnings)` | matches the summary |
| `reports/LintIssues.xlsx`, `reports/LintBugReport.xlsx` | binary, not opened | - |
| `reports/generate_lint_reports.py` | produced the above | - |
| `reports/test_results.json` | `"timestamp": "2026-07-28T04:02"`, 29 checks, 25 pass, 4 fail - all three Open Graph checks and Canonical URL fail | - |
| `reports/TESTING_SUMMARY.md` | 23 pages tested, all passing, "Stack: Next.js 16, React 19" | the only artefact that gets the framework version right |
| `reports/SPRINT2..5_TESTING_SUMMARY.md` | all dated 28 July 2026; 82+, 100+, 90+, 75+ tests "Complete" | counts are round and unreconciled with the 1,300+ actual `test(` calls |

## Types and stores

Types this chunk touches (all defined elsewhere - see M10):

| Type | Defined in | Used by |
|---|---|---|
| `UnknownQuestion`, `ConversationMetric`, `IntentMetric` | `types/analytics.ts` | `services/analytics.service.ts:8` |
| `IntentFeedback` | **declared inline** at `services/analytics.service.ts:182` | `app/api/admin/analytics/route.ts:7`, `services/ml.service.ts` |
| `PageViewData`, `DailyStats` | `services/pageviews.service.ts:13,21` (inline, exported) | `DailyStats` is never consumed anywhere |
| `Intent`, `IntentCategory` | `lib/ai/intent/types.ts` | `tests/ai-uat/*`, `tests/unit/*` |
| `UATTestCase`, `ValidationCriteria` | `tests/ai-uat/test-cases.ts` | UAT runners |
| `EventData`, `UserData`, `SevaData`, `GalleryData` | `tests/e2e/sprint5/test-data-utils.ts` | sprint5 specs |
| `FontInfo`, `ValidationResult` | `tests/kannada-font-validation.spec.ts` | that spec only |
| `ReportMetadata` | `lib/reports/report-saver` (M14) | `tests/reports/save-reports.spec.ts` |

Firestore collections touched by this chunk:

| Collection | Read | Write | Where |
|---|---|---|---|
| `page_views` | yes (limit 10000) | yes (one doc per navigation) | `services/pageviews.service.ts:9,46,113` |
| `daily_page_stats` | no | yes (`{date}` and `{date}_pages`) | `services/pageviews.service.ts:10,58,69` |
| `sessions` | no | no | constant declared at `services/pageviews.service.ts:11` and never used |
| `unknown_questions` | yes (limit 20 / 1000) | yes | `services/analytics.service.ts:10,31,74,110` |
| `chat_metrics` | no | yes | `services/analytics.service.ts:11,54` |
| `intent_metrics` | yes (limit 1000) | yes | `services/analytics.service.ts:12,166,291` |
| `intent_feedback` | yes (limit 500) | yes | `services/analytics.service.ts:180,204,238` |

Files and non-Firestore stores:

| Store | Read | Write | Where |
|---|---|---|---|
| `localStorage["visitor_id"]` | yes | yes | `services/pageviews.service.ts:208-211` |
| `public/data/panchanga/current.json` | served | written by CI | `.github/workflows/panchanga.yml:43`, `vercel.json:4` |
| `data/panchanga/<year>/*.json` (730 files, 2026 + 2027) | read by the Aaradhane job | generated by CI | `.github/workflows/aaradhane.yml:71,88` |
| `reports/*` (html, json, xml, xlsx, md) | - | Playwright reporters + Python generators | `tests/playwright.config.ts:20-25` |
| `seed/ai/*.json` | read by tests | - | `tests/unit/knowledge-bootstrap.test.ts:10` |
| Vercel Blob `reports/` folder | - | written | `tests/reports/save-reports.spec.ts` via `lib/reports/report-saver` |

## Cross-module dependencies

**This chunk imports from:**

| Target | Chunk | Via |
|---|---|---|
| `lib/firebase` (`db`, `isFirebaseConfigured`) | M01 / M10 | `services/analytics.service.ts:6`, `services/pageviews.service.ts:6` |
| `types/analytics` | M10 | `services/analytics.service.ts:8` |
| `lib/ai/intent`, `lib/ai/intent/types` | M08 | `tests/ai-uat/*`, `tests/unit/intent.test.ts`, `tests/unit/ai-analytics.test.ts` |
| `lib/ai/generator` | M08 | `tests/ai-uat/ai-uat.test.ts:17`, `tests/ai-uat/run-uat-tests.ts:20` |
| `lib/ai/knowledge`, `lib/ai/retrieval` | M08 | mocked in `tests/ai-uat/ai-uat.test.ts:54,159` |
| `lib/aaradhane/panchanga`, `types/aaradhane-generator` | M14 | `tests/unit/aaradhane/*` |
| `lib/receipt/validation`, `lib/receipt/numbering`, `types/receipt` | M07 / M14 | `tests/unit/receipt-*.test.ts` |
| `services/proof-report/*` | M14 | `tests/unit/proof-report.test.ts:6-7` |
| `lib/reports/report-saver` | M14 | `tests/reports/save-reports.spec.ts:17` |
| `types/quote`, `types/knowledge-workflow`, `types/multi-source-retrieval` | M10 | corresponding unit tests |
| `scripts/generate_panchanga.py`, `scripts/generate-aaradhane.ts` | M14 | the two scheduled workflows |

**Who imports this chunk:**

| Importer | Chunk | What it takes |
|---|---|---|
| `lib/ai/generator.ts:42` | M08 | `logUnknownQuestion` |
| `services/ml.service.ts:7` | M10 | `logIntentFeedback` |
| `app/api/admin/analytics/route.ts:7` | M09 / M12 | `getAnalyticsSummary`, `logIntentFeedback`, `IntentFeedback` |
| `app/admin/page.tsx:15` | M05 | `getAnalyticsSummary` (the **pageviews** one) |
| `app/(public)/layout.tsx:2` | M01 / M02 | `PageViewTracker` |

Shared-ownership note (`.claude/state/inventory/SUMMARY.md`): `package.json` is shared with M01;
`.github/workflows/aaradhane.yml` and `panchanga.yml` with M14; `ai-uat.yml` with M09;
`services/analytics.service.ts` with M10.

## How to change it

### 1. Add a new e2e spec that actually runs

1. Create `tests/e2e/<feature>/<feature>.spec.ts`; import helpers from `../test-utils` (never hardcode a URL).
2. Fix the runner first (see recipe 2) or run it explicitly: `npx playwright test tests/e2e/<feature>`.
3. If it needs a logged-in session, import `login` and `TEST_USERS` from
   `tests/e2e/sprint3/sprint3-test-utils.ts` and set `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`.
4. If it needs fixtures, use the factories in `tests/e2e/sprint5/test-data-utils.ts`.
5. To have it run on a browser matrix, add a `testMatch` glob to a project in
   `tests/playwright.config.ts:46-90`.

### 2. Make the Playwright config take effect

1. Move `tests/playwright.config.ts` to the repo root as `playwright.config.ts`, **or** change
   `testDir` at `tests/playwright.config.ts:9` from `'./tests/e2e'` to `'./e2e'`.
2. Add `--config` to the playwright npm script (`package.json:21`) if you keep it under `tests/`.
3. Add a `webServer` block so the suite starts the app itself instead of relying on `start-test.sh`.
4. Re-check the `projects[].testMatch` globs - they are written relative to `testDir`.

### 3. Add a CI gate before deploy

1. Edit `.github/workflows/deploy.yml`; after `npm ci` (`:24`) insert `npm run lint`,
   `npm run typecheck`, `npm test`.
2. Remove `continue-on-error: true` from the build steps in
   `.github/workflows/lighthouse-ci.yml:47` and `:99` - a failed build must fail the job.
3. Add a `pull_request` trigger; today `deploy.yml` only reacts to `push` on `main`.
4. If the e2e suite should run, add a job that does recipe 2 first, then
   `npx playwright test --config playwright.config.ts`.

### 4. Add a Jest unit test for a service

1. Put it in `tests/unit/<name>.test.ts` - `jest.config.ts:9` matches only `tests/unit/**` and
   `tests/ai-uat/**`.
2. Mock Firebase the way `tests/unit/ai-analytics.test.ts:36-42` does
   (`jest.mock("@/lib/firebase", ...)`), then import the **real** service - do not redeclare its types.
3. Widen `collectCoverageFrom` in `jest.config.ts:20-23` beyond `lib/ai/**` or the coverage number
   will not move.
4. Remember `tsconfig.json` excludes `tests/**`, so `npm run typecheck` will not catch type errors in
   your test; either narrow that exclude or add a `tsconfig.test.json`.

### 5. Add or change an analytics metric

1. Add the field to the write in `services/pageviews.service.ts:46` (page views) or the relevant
   `addDoc` in `services/analytics.service.ts`.
2. Add it to the aggregation in `getAnalyticsSummary` - `services/pageviews.service.ts:82` for traffic,
   `services/analytics.service.ts:338` for AI.
3. Update the caller: `app/admin/page.tsx` or `app/api/admin/analytics/route.ts`.
4. Update the type: `types/analytics.ts` for the AI metrics, the inline interfaces at
   `services/pageviews.service.ts:13-30` for traffic.
5. Add a Firestore rule for any new collection - `firestore.rules` (M04/M11).
6. Consider aggregation-on-write rather than read-10000-and-count (see F06).

### 6. Add a scheduled content job

1. Copy `.github/workflows/panchanga.yml` as the template - it is the simplest.
2. Declare `permissions: contents: write` if it commits back (`:12-13`).
3. Use sparse checkout (`:21-25`) to keep the runner small.
4. If it writes to Firestore instead, follow `.github/workflows/aaradhane.yml:222-259`, which
   materialises `FIREBASE_SERVICE_ACCOUNT` into `firebase-admin-key.json` and guards on its absence.
5. Add the corresponding `npm run` script to `package.json` so it is runnable locally.

### 7. Retire a stale doc

1. Confirm the drift by code, not by another doc - the rule the rest of this file follows.
2. If it is a historical record (`REPORT.md`, `docs/AI_ARCHITECTURE_AUDIT.md`, `reports/SPRINT*`),
   move it under a `docs/history/` folder and stamp it with the date it describes.
3. If it is a live reference (`docs/API.md`, `docs/PROJECT_STRUCTURE.md`), regenerate it from the
   filesystem rather than editing by hand - both are mechanical.
4. Fill `docs/DEPLOYMENT.md` and `docs/CHANGELOG.md` or delete them; a 0-byte file that AGENTS.md
   calls authoritative is worse than no file.

### 8. Add an endpoint to the Postman collection

1. Edit `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json`, adding an item to the
   matching folder; use `{{baseUrl}}` and `{{firebaseToken}}`.
2. Strip `firebaseApiKey`'s committed value from `variable` before committing (F07).
3. 32 routes are currently missing and `/api/admin/knowledge/approve` is present with no route file -
   the list is in F16's evidence.

## Faults, smells and risks

| id | sev | What | Evidence | Direction |
|---|---|---|---|---|
| M15-F01 | HIGH | Playwright's config is never applied: `testDir: './tests/e2e'` resolves relative to the config's own folder, giving `tests/tests/e2e`, which does not exist; there is no root `playwright.config.ts`, so every invocation silently falls back to Playwright defaults - no projects, no reporters, no baseURL | `tests/playwright.config.ts:9`; no `playwright.config.*` at repo root; no `tests/tests/` directory; `package.json:21` calls `playwright test <path>` with no `--config` | Move the config to the root, or change `testDir` to `'./e2e'` and pass `--config` everywhere |
| M15-F02 | HIGH | Production deploy has no quality gate. Push to `main` goes straight to `vercel deploy --prod`; no lint, typecheck or test step exists in the workflow | `.github/workflows/deploy.yml:3-6` (trigger), `:23-36` (all steps) | Insert `npm run lint && npm run typecheck && npm test` before the Vercel steps |
| M15-F03 | HIGH | 13 test files reference dead OpenHands sandbox hosts. 11 of them ignore the environment entirely and can never pass again; 2 use the dead host only as a fallback. Verified 2026-09-19: `grep -rl all-hands.dev tests/` -> 15 files (13 tests + 2 Python generators) | Hardcoded, no env fallback: `tests/functional/01_homepage.spec.ts:3` and identically `02_`..`10_` (ten files), `tests/e2e_test.spec.ts:3`. Env-fallback to a dead host: `tests/ai-uat/ai-uat.spec.ts:17` (`process.env.E2E_BASE_URL \|\| <dead host>`). **Also `tests/unit/proof-report.test.ts:11`**, used at `:124` - and that file *does* run under `npm test`. Python: `tests/generate_reports_final.py:13`, `tests/generate_playwright_report.py:24` | Replace with `process.env.BASE_URL ?? 'http://localhost:3000'` in all of them |
| M15-F04 | HIGH | `npm run typecheck` does not type-check the tests or the scripts - `tsconfig.json` excludes both - so ~20k lines of test code and every seeding/migration script are unchecked, and AGENTS.md's "Types Check passes" gate is hollow | `tsconfig.json` `"exclude": ["node_modules","tests/**/*","jest.config.ts","scripts/**/*"]`; `package.json:11` | Add a `tsconfig.test.json` that includes `tests/**` and `scripts/**`, and run both |
| M15-F05 | HIGH | The "no `any`" rule AGENTS.md is built on is switched off for the entire source tree: `services`, `types`, `hooks`, `scripts`, `app`, `components`, `lib` | `eslint.config.mjs:18-34`; contradicts `AGENTS.md` "Do not use `any` type" | Re-enable as a warning and burn down, or drop the claim from AGENTS.md |
| M15-F06 | HIGH | The admin dashboard reads up to 10,000 `page_views` documents on every load and aggregates them client-side. The `days = 7` parameter is used only to compute `weekAgo`, and `weekAgo` is never referenced again - there is no `where()` on the query - so "last 7 days" is a lie: it always aggregates the most recent 10,000 rows whatever their date | `services/pageviews.service.ts:82` (signature `days = 7`), `:109` (`today` dead), `:110` (`weekAgo` computed, never read - grep for `weekAgo` returns one hit), `:113-119` (query is `orderBy timestamp desc, limit 10000`, no date filter); caller `app/admin/page.tsx:15`; AGENTS.md notes `page_views` ~47k docs vs a 50k/day free-tier read cap | Aggregate on write into `daily_page_stats` and read only those docs |
| M15-F07 | HIGH | A Firebase Web API key and the production host are committed in the Postman collection variables | `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json` -> `variable[].firebaseApiKey` (value present), `baseUrl: https://sri-raghavendra-mutt.vercel.app` | Blank the variable values; ship an environment file separately |
| M15-F08 | HIGH | `REPORT.md` is a checked-in, undated record of deliberately deleting auth from the admin receipts API and UI. The code has since been restored, so the report now reads as a live instruction to a future agent | `REPORT.md:1-19` vs `app/api/admin/receipts/route.ts:2,21,149`, `app/api/admin/receipts/[id]/route.ts:2,21`, `app/api/admin/receipts/[id]/pdf/route.ts:2,49`, `app/admin/receipts/layout.tsx:4,12` (all guards present) | Delete it, or move it to `docs/history/` with a "REVERTED 2026-xx-xx" banner |
| M15-F09 | MEDIUM | Effectively zero unit coverage of the application: of 17 `tests/unit` files, 0 import `@/app`, `@/components`, `@/hooks`, `@/utils` or `@/context`, and exactly 1 imports `@/services`. Coverage is collected only from `lib/ai/**`, so the 50% threshold says nothing about 471 files in `app/` + `components/` or 41 services | `jest.config.ts:20-23`; verified by grepping every `from "@/..."` under `tests/unit/` - the only `@/services` hits are the three `@/services/proof-report/*` imports in `tests/unit/proof-report.test.ts:3-7` | Widen `collectCoverageFrom`; start with the services that carry money (receipts, donations, bookings) |
| M15-F10 | MEDIUM | `tests/unit/ai-analytics.test.ts` is titled "Unit tests for AI Analytics Service" and contains 21 tests, but never imports `services/ai-analytics.service.ts`; it redeclares `TokenRecord`/`LatencyRecord`/`IntentRecord` locally and asserts on its own literals | `tests/unit/ai-analytics.test.ts:1-35` (only import is `@/lib/ai/intent/types`) | Import the real service behind the existing Firebase mock, or delete the file |
| M15-F11 | MEDIUM | 16 spec files - 4 at `tests/` root, 1 under `tests/reports/`, 11 under `tests/functional/` - are never executed by any npm script or workflow. Note the mechanism precisely: because the config never applies (F01), a bare `npx playwright test` from the repo root *would* collect them, and `tests/run_e2e_tests.sh:53` does exactly that for the `all` group - but no `package.json` script and no GitHub workflow ever invokes that shell script, so in practice a third of the suite has no runner | `tests/comprehensive_validation.spec.ts`, `tests/e2e_test.spec.ts`, `tests/kannada-font-validation.spec.ts`, `tests/quick_validation.spec.ts`, `tests/reports/save-reports.spec.ts`, `tests/functional/*.spec.ts` (11); `tests/playwright.config.ts:9`; `package.json:5-31` (no script names them); `tests/run_e2e_tests.sh:53` | Fold into `tests/e2e/` or delete; do not leave a third of the suite unreachable |
| M15-F12 | MEDIUM | **Four** of the five Python report generators hardcode `/workspace/project/Rayaramathaynk/...`; `generate_reports.py` opens such a path at module import, so importing it crashes anywhere but the original sandbox. No `requirements.txt` exists for `openpyxl` / `requests` | `tests/generate_reports.py:15,358,597,672,841,860`; `tests/generate_final_reports.py:94,179,210,272`; `tests/generate_playwright_report.py:96,148,234,364,414,432`; `tests/generate_reports_final.py:94,174,205,302` (missed in the first pass); `find . -name "requirements*.txt"` -> none | Delete the four; keep `generate_test_summary.py` (relative paths) and add a `requirements.txt` |
| M15-F13 | MEDIUM | `tests/generate_playwright_report.py` embeds a specific past run's numbers as literals (total 23, passed 6, failed 17, duration 53.05s, a sandbox URL) and writes them out as a fresh report - a generator of fabricated evidence | `tests/generate_playwright_report.py:14-30` | Delete |
| M15-F14 | MEDIUM | Three checked-in artefacts give three different lint results for the same codebase | `reports/LintReport.md` (60 issues / 12 errors) vs `reports/LintExecutiveSummary.md` (98 issues / 3 errors) vs `docs/QUALITY_ASSESSMENT_REPORT.md:224` (39 errors / 347 warnings) | Regenerate once, keep one artefact, delete the rest |
| M15-F15 | MEDIUM | Five documents state the framework is Next.js 14; `package.json` pins `next: ^16.2.9` with React 19.2.4. Only `reports/TESTING_SUMMARY.md:5` gets it right | `AGENTS.md:213`, `docs/ARCHITECTURE.md:18`, `docs/PROJECT_STRUCTURE.md:5,229`, `docs/QUALITY_ASSESSMENT_REPORT.md:13`, `.openhands/project-context.md:43` vs `package.json` dependencies | Fix the five; a version claim off by two majors invalidates every API recipe below it |
| M15-F16 | MEDIUM | Postman covers **63 of 95** API routes (66%) and contains one request for a route that does not exist. Re-counted 2026-09-19 with `:id`/`[id]` parameters normalised on both sides: 81 requests in 25 top-level folders, 64 distinct `/api/...` paths, of which 63 match a `route.ts` and 1 is orphaned. 32 routes are absent - **all 15 quotes routes** (10 public `/api/quotes/*` + 5 `/api/admin/quotes/*`), all 5 receipts routes (4 admin + `/api/public/receipts`), both `receipt-sevas`, both `temple-areas` pairs (4), `ai/knowledge/import`, two `knowledge/workflow` id routes, `revalidate`, `storage/videos`, `supabase-check` | script comparison of `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json` request URLs against all 95 `app/api/**/route.ts`; the orphan is `/api/admin/knowledge/approve`, which has no `route.ts` | Regenerate the collection from the route tree |
| M15-F17 | MEDIUM | `docs/DEPLOYMENT.md` and `docs/CHANGELOG.md` are 0 bytes while AGENTS.md declares `docs/` authoritative. There is no deployment runbook anywhere; `docs/SPRINT-5-DEPLOYMENT.md` is a feature doc despite its name | `wc -c docs/CHANGELOG.md docs/DEPLOYMENT.md` -> 0; `AGENTS.md` "Documentation Authority" | Write the runbook (env vars, Vercel project, secrets, rollback) or delete the stubs |
| M15-F18 | MEDIUM | Lighthouse CI cannot fail meaningfully: both jobs mark the build `continue-on-error: true`, then start a server and audit whatever is (or is not) there. The budget files also set `staticDistDir: ./.next` while the action is handed live URLs - mutually exclusive collection modes | `.github/workflows/lighthouse-ci.yml:46-47`, `:97-99`, `:59-68`, `:111-114`; `lighthouse-budget.json:3-7` | Drop `continue-on-error`; remove `staticDistDir` from the budgets |
| M15-F19 | MEDIUM | Default test credentials for three roles are committed, including passwords | `tests/e2e/sprint3/sprint3-test-utils.ts:5-18` (`admin@test.com` / `TestAdmin123!` etc.) | Require the env vars; fail fast when unset |
| M15-F20 | MEDIUM | The July quality report's P0 SEO item is still open: no sitemap or robots source exists | `docs/QUALITY_ASSESSMENT_REPORT.md:186`; `app/sitemap.ts`, `app/robots.ts`, `public/sitemap.xml`, `public/robots.txt` all absent. `reports/test_results.json` also records Open Graph title/description/image and Canonical URL all failing | Add `app/sitemap.ts` and `app/robots.ts` |
| M15-F21 | MEDIUM | Two exported functions named `getAnalyticsSummary` with different signatures and return shapes; `app/admin/page.tsx` and `app/api/admin/analytics/route.ts` each import a different one | `services/analytics.service.ts:338` vs `services/pageviews.service.ts:82` | Rename to `getTrafficSummary` / `getAiAnalyticsSummary` |
| M15-F22 | MEDIUM | `.github/workflows/ai-uat.yml` defaults `E2E_BASE_URL` to a dead OpenHands sandbox host, so the Playwright job points at a URL that cannot resolve - and the job is `continue-on-error` so it passes anyway | `.github/workflows/ai-uat.yml:26`, `:85` | Default to a preview URL, and drop `continue-on-error` |
| M15-F23 | MEDIUM | No workflow runs `tests/unit` (17 files, ~499 tests), `tests/e2e` (33 files) or `tests/functional` (11 files). The only test command in CI is `npm run test:ai-uat:jest`, which runs one file, and only when `lib/ai/**` changes | `.github/workflows/ai-uat.yml:6-17,50`; no other workflow invokes `npm test` | Add a `test.yml` on push/PR running lint, typecheck and `npm test` |
| M15-F24 | LOW | Dead code in the page-view writer: `sourceField` and `deviceField` are computed and never used, so traffic-source and device breakdowns are never persisted to `daily_page_stats`; `SESSIONS_COLLECTION` and the exported `DailyStats` interface are unused; `where`, `updateDoc`, `Timestamp` are imported and unused | `services/pageviews.service.ts:7,11,21,59-60` | Either write the fields or delete them |
| M15-F25 | LOW | `detectDeviceType` is duplicated verbatim in the tracker component and the service | `components/analytics/PageViewTracker.tsx:38` and `services/pageviews.service.ts:219` | Extract to `lib/` |
| M15-F26 | LOW | `fix-websocket.ts` mutates a committed test file in place; its output is already committed, including `(global as any)` inserted *above* the file's docblock, and `any` in `tests/` is not exempted by the ESLint override | `fix-websocket.ts:1-10`; `tests/ai-uat/ai-uat.test.ts:1-2`; `eslint.config.mjs:19-30` lists no `tests/**` | Delete the script; move the shim into a Jest setup file |
| M15-F27 | LOW | Throwaway one-line shell wrappers and a fragile runner: `test_plan.sh` is `npm run lint`, `fix_lint.sh` is `npm run lint -- --fix`, and `start-test.sh` relies on `kill %1` job control that does not work in a non-interactive shell | `test_plan.sh`, `fix_lint.sh`, `start-test.sh:1-4` | Delete the first two; replace the third with Playwright's `webServer` |
| M15-F28 | LOW | `tsconfig.tsbuildinfo` (460 KB) and the whole `reports/` folder (xlsx, lint json, lint-output.txt) are committed; `.gitignore` covers neither | `.gitignore` (47 lines, no `*.tsbuildinfo`, no `reports/`); `ls -la` at root | Add both to `.gitignore` and remove from the index |
| M15-F29 | LOW | `panchanga.yml`'s comment says "every 2 hours at minute 30" but the cron list is four fixed daily times (06:30, 08:30, 21:30, 23:30 UTC) | `.github/workflows/panchanga.yml:5-9` | Fix the comment or the schedule |
| M15-F30 | LOW | Dependabot ignores every major version bump for every dependency, so Next, React and Firebase majors will never be proposed | `.github/dependabot.yml:8-10` | Narrow the ignore to the packages that genuinely need pinning |
| M15-F31 | LOW | `docs/ROADMAP.md` deprecates files that do not exist and lists shipped features as unbuilt | `docs/ROADMAP.md:236-238` names `lib/legacy-api.ts` and `lib/api/v2.ts` (neither on disk); `:106` lists "Analytics Dashboard 📋" though `app/api/admin/analytics/route.ts` exists; `:128` lists "Testimonials 📋" though `app/api/testimonials/route.ts` and `components/home/Testimonials.tsx` exist. `:17` says v1.0 completed January 2025, `:180` says 2025 Q4 | Rewrite from the code |
| M15-F32 | LOW | `FIRESTORE_IMPORT.md` tells the reader to run `npm run export:aaradhane`, which is not a script | `FIRESTORE_IMPORT.md:6-8` vs `package.json` scripts | Fix or remove |
| M15-F33 | LOW | `AARADHANE_GENERATOR.md` exists twice with different content - 250 lines at the root, 376 in `docs/` | `AARADHANE_GENERATOR.md`, `docs/AARADHANE_GENERATOR.md` (`diff` reports they differ) | Keep the `docs/` copy, delete the root one |
| M15-F34 | LOW | E2E assertions are frequently guarded by `if (count > 0)`, so a missing feature yields a green test. Worst offender: `tests/e2e/chatbot/chatbot.spec.ts` has 29 such guards across 20 tests | `grep -c "count() > 0"` vs `grep -c "^\s*test("` per file, re-run 2026-09-19: chatbot 29/20, sprint4/admin-expanded **25**/31, sprint3/admin-crud 16/34 | Assert presence explicitly, then assert behaviour |
| M15-F35 | LOW | `.deployment-trigger` is a 0-byte file with no reference anywhere in the repo | `ls -la` root; no grep hit outside the inventory | Document it in the (missing) deployment runbook or delete it |
| M15-F36 | LOW | `docs/AI_ASSISTANT.md` carries **no date stamp at all** - it is the one `docs/` file with neither a "Last Updated" line nor any date in its prose, so its currency cannot be judged. (Corrected on verification: the earlier claim that it was "stamped 2024-01-01" was wrong - that string is a sample payload value inside an API-response example) | `docs/AI_ASSISTANT.md:1-6` (no stamp in the header), `:324` `"lastChecked": "2024-01-01T00:00:00Z"` is inside a fenced JSON example, `:101` `claude-3-haiku-20240307` is a model id | Add a "Last Updated" line, or fold it into `docs/RAYA_AI_ARCHITECTURE.md` |
| M15-F37 | LOW | `tests/quick_validation.sh` defaults to port 3456 while everything else in the repo uses 3000 | `tests/quick_validation.sh:7` vs 12 occurrences of `localhost:3000` across `tests/` | Align the default |
| M15-F38 | MEDIUM | The only test command CI runs may not compile. `fix-websocket.ts` injected `import WebSocket from "ws"` as line 1 of `tests/ai-uat/ai-uat.test.ts`. `ws` is present as a devDependency but **`@types/ws` is in neither `package.json` nor `package-lock.json`**, and `ws` ships no bundled declarations. ts-jest resolves `compilerOptions` from the root `tsconfig.json`, which sets `"strict": true` (hence `noImplicitAny`); the `transform` override in `jest.config.ts:11-17` sets only `jsx`/`esModuleInterop`/`allowSyntheticDefaultImports` and does not relax it. That combination raises TS7016 on an untyped module, which would fail `npm run test:ai-uat:jest` - the single test step in `.github/workflows/ai-uat.yml:50` | `tests/ai-uat/ai-uat.test.ts:1`; `package.json:97` (`"ws": "^8.21.3"` in devDependencies); `grep -n "@types/ws" package.json package-lock.json` -> no hit; `tsconfig.json` `"strict": true`; `jest.config.ts:11-17` | Add `@types/ws`, or move the shim into a `setupFiles` module with a local `.d.ts`. **Not executed** - `node_modules` is absent by rule, so this is a static inference; confirm with `npm ci && npm run test:ai-uat:jest` |

## Portability notes (React Native / cross-platform)

| Piece | Web-only dependency | Verdict | Why |
|---|---|---|---|
| `services/analytics.service.ts` | `firebase/firestore` web SDK via `@/lib/firebase` | **adapt** | Logic is platform-neutral; swap the SDK for `@react-native-firebase/firestore` or call an API route |
| `services/pageviews.service.ts` - aggregation (`:82-200`) | none beyond the SDK | **adapt** | Pure reduce over documents; move it server-side while you are at it (F06) |
| `services/pageviews.service.ts` - `getOrCreateVisitorId` (`:205`) | `localStorage`, `typeof window` | **rewrite** | Use `AsyncStorage` / `expo-secure-store`; the `typeof window === "undefined"` guard returns `"server"` and would silently do so on RN too |
| `services/pageviews.service.ts` - `detectDeviceType` (`:219`) | `navigator.userAgent` | **rewrite** | No UA on RN; use `Platform.OS` + `react-native-device-info` |
| `components/analytics/PageViewTracker.tsx` | `next/navigation` (`usePathname`, `useSearchParams`), `document.referrer`, `navigator.language`, `"use client"`, React `Suspense` around a router hook | **rewrite** | Replace with a React Navigation screen-change listener; there is no referrer and no query string in a native app |
| `vercel.json` cache headers | Vercel edge | **rewrite** | A native client must handle Panchanga freshness itself (ETag/If-Modified-Since or a versioned endpoint) |
| `tests/e2e/**`, `tests/functional/**`, `tests/ai-uat/ai-uat.spec.ts` (45 files) | Playwright, DOM selectors, `page.evaluate`, `window.scrollTo`, viewport emulation | **rewrite** | Browser automation does not transfer; the RN equivalent is Detox or Maestro. The *test case catalogue* transfers, the code does not |
| `tests/e2e/sprint5/accessibility.spec.ts` | `@axe-core/playwright` | **rewrite** | RN a11y is checked with `accessibilityLabel` assertions in RNTL, not axe |
| `tests/e2e/sprint3/visual-regression.spec.ts` | Playwright screenshots | **rewrite** | Use a native snapshot tool |
| `tests/unit/**` (17 files) | none - Jest + ts-jest, `testEnvironment: node` | **reuse as-is** | These test `lib/ai`, `lib/receipt`, `lib/aaradhane` and types; they run unchanged under `jest-expo` |
| `tests/ai-uat/test-cases.ts`, `run-uat-tests.ts`, `generate-report.ts` | none (Node `fs`/`path`) | **reuse as-is** | The 275-case corpus is the single most portable asset in this chunk |
| `tests/e2e/sprint5/test-data-utils.ts` | none | **reuse as-is** | Plain factories |
| `jest.config.ts` | ts-jest preset | **adapt** | Switch preset to `jest-expo` / `react-native`; keep `moduleNameMapper` |
| `.github/workflows/deploy.yml` | Vercel CLI | **adapt** | A mobile pipeline needs EAS Build / Fastlane instead; the web deploy stays |
| `.github/workflows/panchanga.yml`, `aaradhane.yml` | git commit-back, Firestore | **reuse as-is** | Backend content jobs; a native client consumes their output over HTTP |
| `.github/workflows/lighthouse-ci.yml`, both budget files | Lighthouse (web-only metric set) | **rewrite** | Native perf budgets are TTI/frame-rate, not LCP/CLS |
| `postman/*.json` | none | **reuse as-is** | Transport-level; the RN client hits the same routes |
| `docs/**`, root reports, `.openhands/**`, `.continue/rules.md` | none | **reuse as-is** | Prose |

**What a React Native client would need from this module:**

1. A **server-side analytics endpoint**. Today the client writes directly to Firestore
   (`services/pageviews.service.ts:46`) and the dashboard reads 10,000 docs back. Both platforms
   should POST an event to `/api/analytics/event` and let the server aggregate into
   `daily_page_stats`; that removes `localStorage`, the UA sniffing and the quota risk in one move.
2. A **shared visitor-identity contract** - an opaque id the platform layer supplies
   (`localStorage` on web, `AsyncStorage` on native) behind a single `getVisitorId()` interface.
3. The **shared types** it already has: `types/analytics.ts`, plus the inline `PageViewData` shape,
   which should move out of the service into `types/`.
4. The **UAT corpus** (`tests/ai-uat/test-cases.ts`) as the conformance suite for the mobile chat
   surface - it is pure data plus assertions against `lib/ai`, and carries no web dependency.
5. A **deploy pipeline split**: keep `deploy.yml` for web, add an EAS/Fastlane workflow for the app,
   and share one `test.yml` that runs lint, typecheck and Jest for both (which does not exist today - F23).
6. **Panchanga delivery over HTTP rather than static file**: the RN app cannot rely on
   `vercel.json`'s `no-store` header; expose `/api/panchanga/current` with an ETag.

## Coverage

filesExpected 144, filesMentioned 144, omitted: none.

Every path in `.claude/state/inventory/M15.json` appears at least once above, plus one adopted file
(`components/analytics/PageViewTracker.tsx`) and the 13 files under `reports/`, which the inventory
leaves unowned but which are the primary evidence for the project-history and documentation-health
questions in this chunk.

Read in full: all configs, all five workflows, both analytics services, the adopted tracker, all four
root reports, `final_report.txt`, `README.md`, `docs/ROADMAP.md`, `docs/QUALITY_ASSESSMENT_REPORT.md`,
`docs/SPRINT-5-DEPLOYMENT.md`, `.continue/rules.md`, `.openhands/README.md`, both shell runners.
Read by structure or sampled (per the brief's instruction not to bulk-read specs): the 50 spec files
(counted `describe`/`test`, first describe title, imports, hardcoded URLs), the 17 unit files
(imports + test counts), `tests/ai-uat/test-cases.ts` (3,118 lines - enum, stats and case count only),
the 7 Python files (headers and hardcoded paths), and the remaining `docs/` files (headers, dates and
targeted greps). `docs/ARCHITECTURE_DIAGRAM.html`, `reports/LintIssues.xlsx` and
`reports/LintBugReport.xlsx` were listed but not opened - the first is 648 lines of presentation
markup, the latter two are binary and the RULES forbid it. The 730 files under `data/panchanga/`
were counted, never read.

## UNCLEAR

- **Whether CI has ever been green.** This is not a git repository in this workspace, so there is no
  history, no branch list and no Actions run log. Everything in the *Project history* section is
  reconstructed from checked-in artefacts, whose own dates disagree. Settled by opening the GitHub
  repository named in `.openhands/project-context.md` and reading the Actions tab.
- **Whether `npm run lint` currently passes.** `node_modules` is absent and must stay absent, so the
  lint could not be run. Static reading says `tests/ai-uat/ai-uat.test.ts:2` uses `any` in a folder the
  ESLint override does not exempt, which suggests at least one error. Settled by `npm ci && npm run lint`.
- **Which production URL is real** - `docs/API.md` says `rayaramathaynk.vercel.app`, the Postman
  collection says `sri-raghavendra-mutt.vercel.app`. Settled by the Vercel project settings.
- **Whether `tests/functional/*` and the root specs were once passing** against the sandbox hosts, or
  were written blind. The hardcoded hosts are unreachable now, so it cannot be tested.
- **Whether the `.openhands` and `.continue` toolchains are still in use** by the team, or are residue
  from the agent runs that produced `AGENTS_REPORT.md` / `REPORT.md` / `final_report.txt`. Settled by
  asking the maintainer.
- **The real current lint/test numbers.** Three artefacts disagree (F14) and all three are 53-68 days
  old. Settled by one clean run after `npm ci`.
- **Whether `data/panchanga/` (730 files, repo root) or `public/data/panchanga/` (1 file) is the
  intended source of truth.** `aaradhane.yml:71` reads the former, `panchanga.yml:43` and `vercel.json:4`
  serve the latter. Both exist and neither is generated from the other in any script this chunk owns.
  Settled by M14.

## Verification log (2026-09-19)

Skeptic pass over this file: 365 cited paths extracted and existence-checked by script, 112 `path:line`
citations range-checked, 26 factual claims re-opened against the code, all 38 findings re-evidenced,
144/144 inventory files confirmed present by full path. Full report:
`.claude/state/verify/M15.md`.

- Entry points cited `package.json:9/:18/:19/:20/:21/:24` for build, test:ai-uat, :jest, :playwright, report:ai-uat, firestore:dump -> now `:8/:19/:20/:21/:22/:27` -> `cat -n package.json`: `"build"` is line 8, `"test:ai-uat"` 19, `":jest"` 20, `":playwright"` 21, `"report:ai-uat"` 22, `"firestore:dump"` 27.
- `jest.config.ts:10` for `testMatch` and `:19-22` for `collectCoverageFrom` (3 places: Entry points, F09, recipe 4) -> `:9` and `:20-23` -> `cat -n jest.config.ts`.
- Functional-suite header said "All eleven hardcode `work-1-dhvcepsnljpkopbv...`" -> now "Ten of the eleven"; the eleventh is called out -> `tests/functional/comprehensive.spec.ts:3` is `const BASE_URL = 'http://localhost:3000'`.
- F03 said "12 spec files ... ignore `BASE_URL`" -> now 13 test files, split into 11 with no env fallback and 2 with a dead-host fallback, and `tests/unit/proof-report.test.ts:11` added -> `grep -rn all-hands.dev tests/` returns 15 files; `tests/ai-uat/ai-uat.spec.ts:17` reads `process.env.E2E_BASE_URL` first, so it does not "ignore" the env; `tests/unit/proof-report.test.ts:11,124` was missed entirely and that file runs under `npm test`.
- F06 said "the `days` argument is computed and then never used" -> now states `days` feeds `weekAgo` at `:110` and `weekAgo` is what is never read -> `grep -n weekAgo services/pageviews.service.ts` returns exactly one line, `:110`; the query at `:113-119` carries no `where()`.
- F09 evidence cited `tests/unit/proof-report.test.ts:6-7` as "the lone service import" -> now `:3-7`, three `@/services/proof-report/*` imports -> import block spans lines 3-7.
- F11 said the 16 files "sit outside every runner's default path" - contradicted by F01's own "Playwright runs with defaults and picks up every `*.spec.ts` under cwd" -> now states the real mechanism: reachable by a bare `npx playwright test` from the root and by `tests/run_e2e_tests.sh:53`, but named by no npm script and no workflow. Also "5 at `tests/` root" -> 4 at root + 1 under `tests/reports/`.
- F12 said "Three of the five" Python generators hardcode `/workspace/project/...` -> now four -> `grep -rn "/workspace/project" tests/*.py` also hits `tests/generate_reports_final.py:94,174,205,302`.
- F16 said "64 of 95 (67%)", "all 11 quotes routes", "all 6 receipt routes", and the Postman row said "80 requests / 26 folders" -> now 63 of 95 (66%), 15 quotes routes, 5 receipts + 2 receipt-sevas, 81 requests / 25 folders -> re-ran the route comparison with `:id` and `[id]` normalised on both sides: 95 `route.ts`, 64 distinct Postman `/api` paths, 32 missing, 1 orphan; `len(collection['item'])` = 25.
- F34 said sprint4/admin-expanded has 23 guards -> 25 -> `grep -c "count() > 0" tests/e2e/sprint4/admin-expanded.spec.ts` = 25.
- F36 claimed `docs/AI_ASSISTANT.md` is "stamped 2024-01-01, 992 days before today" -> **REFUTED**; the finding now reads "carries no date stamp at all" -> the file's header (`:1-6`) has no date line; the only 2024 strings are `:324` `"lastChecked": "2024-01-01T00:00:00Z"` inside a fenced JSON response example and `:101` `claude-3-haiku-20240307`, a model id. The timeline row and the `docs/` health row were corrected to match.
- New: **M15-F38** (MEDIUM) - `ws` is a devDependency but `@types/ws` is absent from both `package.json` and `package-lock.json`, while ts-jest inherits `"strict": true` from the root `tsconfig.json`; `tests/ai-uat/ai-uat.test.ts:1` imports it, so the one test step in CI (`.github/workflows/ai-uat.yml:50`) is at risk of TS7016. Flagged as a static inference, not a run.

Re-confirmed unchanged (spot checks that survived): `tests/playwright.config.ts:9` + absence of `tests/tests/` and of any root `playwright.config.*` (F01); `.github/workflows/deploy.yml:3-6,23-36` has no lint/typecheck/test step (F02); `tsconfig.json` exclude list (F04); `eslint.config.mjs:18-34` turns `no-explicit-any` off for `services|types|hooks|scripts|app|components|lib` and exempts no `tests/**` path (F05, F26); `postman` `variable[].firebaseApiKey` holds a real value and `baseUrl` the prod host (F07); `REPORT.md:1-19` vs live guards at `app/api/admin/receipts/route.ts:2,21,149`, `[id]/route.ts:2,21`, `[id]/pdf/route.ts:2,49`, `app/admin/receipts/layout.tsx:4,12` (F08); `tests/unit/ai-analytics.test.ts` has exactly one import, `@/lib/ai/intent/types` at `:4`, and 21 tests (F10); `tests/generate_playwright_report.py:14-30` literals (F13); the three disagreeing lint artefacts (F14); Next.js 14 at `AGENTS.md:213`, `docs/ARCHITECTURE.md:18`, `docs/PROJECT_STRUCTURE.md:5,229`, `docs/QUALITY_ASSESSMENT_REPORT.md:13`, `.openhands/project-context.md:43` (F15); `docs/DEPLOYMENT.md` and `docs/CHANGELOG.md` at 0 bytes (F17); `lighthouse-ci.yml:46-47,97-99` + `staticDistDir` at `lighthouse-budget.json:5` (F18); `tests/e2e/sprint3/sprint3-test-utils.ts:5-18` credentials (F19); no `app/sitemap.ts`, `app/robots.ts`, `public/sitemap.xml`, `public/robots.txt` (F20); the two `getAnalyticsSummary` exports at `services/analytics.service.ts:338` and `services/pageviews.service.ts:82` with `app/admin/page.tsx:15` importing the latter (F21); `ai-uat.yml:26,85` (F22); no workflow runs `npm test`/`lint`/`typecheck` - `grep -rn "npm run" .github/workflows/` returns only `test:ai-uat:jest`, `test:ai-uat:playwright`, `build` and `start` (F23); the unused `sourceField`/`deviceField`/`SESSIONS_COLLECTION`/`DailyStats`/`where`/`updateDoc`/`Timestamp` in `services/pageviews.service.ts` (F24); `detectDeviceType` byte-identical at `components/analytics/PageViewTracker.tsx:38` and `services/pageviews.service.ts:219` (F25); `test_plan.sh`/`fix_lint.sh`/`start-test.sh:4` (F27); `.gitignore` 47 lines with no `*.tsbuildinfo` and no `reports/`, `tsconfig.tsbuildinfo` present at the root (F28); `panchanga.yml:5-9` comment vs four fixed crons (F29); `dependabot.yml:8-10` (F30); `docs/ROADMAP.md:17,106,128,180,236` (F31); `FIRESTORE_IMPORT.md:6-8` vs the scripts block (F32); `AARADHANE_GENERATOR.md` 250 vs `docs/AARADHANE_GENERATOR.md` 376 newlines, `diff -q` reports they differ (F33); `.deployment-trigger` 0 bytes (F35); `tests/quick_validation.sh:7` (F37). Also re-confirmed outside the findings: `next.config.ts` has no `ignoreBuildErrors`/`ignoreDuringBuilds`; `tests/ai-uat/test-cases.ts` holds exactly 275 cases in a 15-value `TestCategory` enum at `:12-28` with `TEST_STATS` at `:3077`; `app/(public)/layout.tsx` has no `"use client"` and renders `<PageViewTracker />` at `:11`; `final_report.txt`'s central bug is still live (`services/pooja.service.ts:16` = `"dailyPoojas"`, `firestore.rules:76` is a `match` block for the sevas collection with no `dailyPoojas` rule anywhere, `hooks/useDonationNotifications.ts:75` polls at 60000 ms).

**Gap-closure pass (2026-09-19).** *Code roots* now records **where** the adopted
`components/analytics/PageViewTracker.tsx` is mounted and what that excludes: it is rendered by
`app/(public)/layout.tsx:11` only, so the admin console, the `(auth)` group and the top-level
`app/knowledge` and `app/calendar` trees never reach `trackPageView` from the client - only
`proxy.ts` sees those. `grep -n "PageViewTracker" app/layout.tsx` returns nothing, which settles the
"is it in the root layout?" question the mind map left open. Coverage is unchanged at 144 + 1
adopted.
