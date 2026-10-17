# M15 - Testing, CI/CD, deployment, tooling, project history and documentation health
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.
> Refreshed 2026-10-18 (Sunday) against HEAD `424fdb8` of `feature/temple-portal-knowledge-base` - 117 files of this chunk changed since the snapshot (93 added, 2 deleted, 22 modified). See *Refresh log (2026-10-18)* at the end.

## Answers questions about

- "what tests exist and how do I run them" - runners, configs, npm scripts, and which of them actually work
- "why does `npx playwright test` not pick up my config" - `tests/playwright.config.ts` has a broken `testDir`
- "which parts of the app have zero test coverage" - services, components, app routes, hooks
- "what runs in CI, and what gates a deploy to production" - 22 workflows (5 on 2026-09-19). Since 2026-10-03 `ci.yml` runs lint, typecheck, `npm test`, a server-only boundary check and build on every push/PR to `main` - but `deploy.yml` does not wait for it, so a red CI still ships (F02)
- "where is the deployment runbook" - `docs/DEPLOYMENT.md` is 0 bytes; there isn't one
- "how does the site get deployed and what secrets are needed" - `VERCEL_TOKEN`, `FIREBASE_SERVICE_ACCOUNT`, `E2E_BASE_URL`
- "where do the daily Panchanga and yearly Aaradhane jobs come from" - `.github/workflows/panchanga.yml`, `aaradhane.yml`
- "what are the Lighthouse budgets and are they enforced" - two budget files, enforced weakly
- "what is the history of this project, what sprint built what" - roadmap, sprint plan, sprint reports, lint/test artefacts
- "which docs can I trust" - per-file currency verdict with evidence for all 72 `docs/` files (27 of 2026-09-19 + 45 added) and the root reports
- "why do docs say Next.js 14 when package.json says 16" - documented drift, code is truth
- "what is `.continue`, `.openhands`, `fix_lint.sh`, `fix-websocket.ts`, `.deployment-trigger`" - agent tooling debris
- "what does the Postman collection cover" - 63 of 97 API routes (2026-10-18), one request pointing at a route that does not exist
- "what analytics are collected and where do they go" - `page_views`, `daily_page_stats`, `chat_metrics`, `intent_metrics`, `unknown_questions`, `intent_feedback`
- "why is the Firestore read quota blowing up" - the admin dashboard reads up to 10,000 `page_views` docs per load
- "is `npm run typecheck` actually checking my tests" - no, `tsconfig.json` excludes `tests/**` and `scripts/**`
- "is the `no any` rule enforced" - no, ESLint disables it for the whole source tree
- "who runs the AI UAT suite and what does it cover" - 275 UAT cases across 15 categories
- "what happened to the admin receipts auth removal described in REPORT.md" - it was reverted in code, and on 2026-09-21 (`9f3cad6`) `REPORT.md` itself was overwritten with a Supabase migration-history repair report, then on 2026-09-29 (`69d7f2d`, edited by `14d71c0`, `54963a1`) with a Phase 2 migration-blocker note. Root reports are rewritten by each agent run and only ever describe the last task (F44)
- "why are there hardcoded `*.prod-runtime.all-hands.dev` URLs in tests" - dead OpenHands sandbox hosts
- "what should I delete before a rearchitecture" - see *Tooling debris* and the Faults table
- "what is the AI development loop, `.ai/`, Jules, the OpenRouter review" - five `ai-loop-*` workflows, `.ai/loop.config.json` (`autoMerge: false`), `docs/DEVELOPMENT_AUTOMATION.md`, task briefs in `docs/tasks/` (Flow G)
- "which workflows touch production Firestore or Supabase, and what secrets do they need" - eleven `workflow_dispatch`-only workflows (Flow H and the *CI/CD* table)
- "why does lint pass now when it reported 836 problems on 2026-09-30" - 35 source files carry a blanket `/* eslint-disable */` added by `6408c1d`, and `tests/**` was exempted from `no-explicit-any` (F40)
- "can I trust a green `npm test`" - partly: several assertions were weakened to tautologies in 2026-10 (F39)
- "how do I run the AI-loop tests in `tests/automation-loop/`" - not from the repo's own tooling: they import `vitest`, which is not a dependency, and Jest's `testMatch` skips the folder; only an ad-hoc `npx vitest run tests/automation-loop/` (which downloads vitest) would run them, and no workflow does (F41)
- "is CI green" - yes on recent `main` commits per `docs/AI_SETTINGS_HEALTH_VERIFICATION_PLAN.md:136`; `c156d6c` (2026-10-16) cleared the two red non-CI checks (GitHub Pages Jekyll via `.nojekyll`, Supabase Preview via ledger marker migrations)
- "what tests cover the Firestore -> Supabase migration, the Prisma baseline and admin auth" - the 35 unit files added since 2026-09-19 (see the Jest unit table)

## Purpose and business role

This module is the repository's quality, delivery and self-description layer. It does not serve
devotees or admins directly; it is what the *team* uses to know whether the temple portal works,
how it gets to production, and what the project has been through.

It covers four things:

1. **Testing** - 50 Playwright spec files, 52 Jest unit files (~834 `it`/`test` calls; 17 files / ~500
   on 2026-09-19), 2 vitest files for the AI loop, a Jest setup file, an AI UAT corpus of 275 cases,
   7 Python report generators and 2 shell runners. The chunk inventory is 242 files / 66,631 lines on
   2026-10-18 (144 files / ~49,000 lines on 2026-09-19).
2. **Delivery** - 22 GitHub Actions workflows (five on 2026-09-19). One deploys to Vercel on every
   push to `main`; one (`ci.yml`, added 2026-10-03) runs lint, typecheck, Jest, a server-only boundary
   check and build on push/PR to `main`; two are scheduled content jobs (daily Panchanga, yearly
   Aaradhane) that commit generated data back into the repo; one runs the AI UAT Jest suite; one runs
   Lighthouse; five drive the autonomous AI development loop (Jules implements, OpenRouter reviews, a
   human merges); eleven are `workflow_dispatch`-only operations against production Firestore and
   Supabase (export, staged and batched migration, counts, diagnostics, schema push, Prisma drift gate,
   typed-confirmation applies).
3. **Project history** - the roadmap, the v2.0 sprint plan, five sprint testing summaries, a quality
   assessment, four root-level agent completion reports and, since 2026-09-19, ~30 agent audit and
   migration reports in `docs/` (BOT-001..BOT-004, PR #325, Phase 1/2 migration, Prisma baseline) plus
   the AI-loop task briefs in `docs/tasks/`. Read together these reconstruct what was
   planned, what was built, and what was reverted.
4. **Documentation health and analytics** - the `docs/` corpus (72 files on 2026-10-18: 55 top-level,
   10 in `docs/tasks/`, 7 in `docs/overview/` + `docs/rearchitecture/`; 27 on 2026-09-19) plus the two analytics
   services (`analytics.service.ts`, `pageviews.service.ts`) and the client tracker that feeds them.

The honest summary (2026-10-18): the *binding force* went from near zero to partial. A real CI
workflow now runs lint, typecheck, Jest and build on every PR and push to `main`, and it is green.
But it was turned green partly by switching checks off - a blanket `/* eslint-disable */` in 35 files
(F40) and tautological assertions in several unit tests (F39) - typecheck still skips the tests, no
workflow runs the e2e suites, the Playwright config is still misconfigured, and the production
deploy still runs independently of CI (F02).

## Code roots

From `.claude/state/chunks.json` (id M15):

```
tests/                                   50 spec files, 52 unit tests, 2 automation-loop (vitest), 1 setup, 7 Python, 2 shell
jest.config.ts
.github/                                 dependabot.yml + 22 workflows
vercel.json
lighthouse-budget.json, lighthouse-budget-mobile.json
start-test.sh, fix_lint.sh               (test_plan.sh, fix-websocket.ts: removed 2026-10 - see Refresh log)
tsconfig.scripts.json
.continue/, .openhands/
.deployment-trigger, .env.example
package.json
README.md, AGENTS.md
AGENTS_REPORT.md, COMPLETION_REPORT.md, REPORT.md, BLOCKED_REPORT.md, final_report.txt
services/analytics.service.ts, services/pageviews.service.ts
postman/
docs/                                    72 files: 55 top-level, docs/tasks/ 10, docs/overview/ 4, docs/rearchitecture/ 3
```

Adopted from the Unassigned list in `.claude/state/inventory/SUMMARY.md`:

- `components/analytics/PageViewTracker.tsx` - the only caller of `trackPageView`; belongs with
  `services/pageviews.service.ts`. **Where it is mounted:** the `(public)` route-group layout,
  `app/(public)/layout.tsx:2,11` - **not** the root `app/layout.tsx`, which never imports it
  (`grep -n "PageViewTracker" app/layout.tsx` -> no match). So it runs on the public site only:
  `/admin/*`, the `(auth)` group and the top-level `app/knowledge` and `app/calendar` trees are
  outside that layout and are never tracked by this component. `proxy.ts:57-75` (`addDoc` at `:72`) writes page views
  for *every* request, which is why the two writers double-count the public routes and only the
  proxy sees the admin ones (M01-F06). M02 owns the layout file and also lists this component as
  adopted; the analytics pipeline it feeds is here.

Also read as evidence but owned by nobody (recommend M15 adopt them in a later pass):
`reports/` (13 files - lint and sprint artefacts, `reports/generate_lint_reports.py`).

New since 2026-09-19 and also unowned (from `unowned` in `.claude/state/delta/2026-10-18/delta.json`;
recommend M15 adopt them): `.ai/` (34 files - the AI loop's config, prompts, JSON schemas, `.mjs`
scripts and state that the five `ai-loop-*` workflows execute and `tests/automation-loop/` exercises),
and 25 root files - agent reports (`BOT-005-security-report.md`, `FIREBASE_MIGRATION_PHASE1_AUDIT.md`,
`FIRESTORE_COUNTS_EXECUTION_REPORT.md`, `FIRESTORE_EXPORT_REPORT.md`,
`FIRESTORE_PRODUCTION_EXPORT_REPORT.md`, `MIGRATION_DATA_RECONCILIATION_REPORT.md`,
`MIGRATION_INVESTIGATION_REPORT.md`, `MIGRATION_VERIFICATION_REPORT.md`,
`PHASE_2_BATCH_1_DRY_RUN_REPORT.md`, `PRODUCTION_REVIEW_COLLECTIONS_INVENTORY.md`,
`REPORT_UNKNOWN_QUESTIONS_BLOCKER.md`, `REVIEW_COLLECTIONS_REPORT.md`, `migration_report.md`,
`fix_report.txt`, `result.md`, `plan.md`, `PR_BODY.md`, `pr_description.md`), lint dumps (`lint.txt`,
`lint2.txt`, `lint_files.txt`), a stray `0001-feat-implement-sevaBookings-mapper-and-fix-chat_mess.patch`,
`request_test.mjs`, `.nojekyll` and `prisma.config.ts`. The root `tsconfig.tsbuildinfo` was deleted
(`6928864`).

Read to confirm boundaries only, not owned: `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`,
`.gitignore`, `firestore.rules`, `app/admin/page.tsx`, `app/(public)/layout.tsx`.

## Entry points

| Route or entry | File | server/client | auth required | What it renders or does |
|---|---|---|---|---|
| `npm run build` | `package.json:14` | build | no | `next build`; `next.config.ts` sets no `ignoreBuildErrors` / `ignoreDuringBuilds` flags (re-verified 2026-10-18, file unchanged), so type errors do fail the build |
| `npm run lint` | `package.json:16` | build | no | bare `eslint`; config at `eslint.config.mjs`; run by `ci.yml:35` and green since `6408c1d` - partly via blanket disables (F40) |
| `npm run typecheck` | `package.json:17` | build | no | `tsc --noEmit` - excludes `tests/**`, `scripts/**` and (since 2026-09-30) `apps/mobile/**` (`tsconfig.json`); run by `ci.yml:38` |
| `npm test` | `package.json:18` | jsdom | no | Jest; `testMatch` is `tests/unit/**/*.test.ts`, `tests/unit/**/*.test.tsx` and `tests/ai-uat/**/*.test.ts` (`jest.config.ts:9`); env `jest-environment-jsdom` (`:5`), setup `tests/setup/jest.setup.ts` (`:10`); run by `ci.yml:41` |
| `npm run test:coverage` | `package.json:20` | jsdom | no | coverage collected from `lib/ai/**` only (`jest.config.ts:21-24`), threshold 50% |
| `npm run test:ai-uat` | `package.json:25` | node | no | `ts-node tests/ai-uat/run-uat-tests.ts` - custom runner, writes JSON/MD reports |
| `npm run test:ai-uat:jest` | `package.json:26` | node | no | `jest tests/ai-uat/ai-uat.test.ts` - run by `ai-uat.yml:50`; the same file also runs inside `npm test` in `ci.yml` |
| `npm run test:ai-uat:playwright` | `package.json:27` | node | no | `playwright test tests/ai-uat/ai-uat.spec.ts` - no `--config`, so `tests/playwright.config.ts` is ignored |
| `npm run report:ai-uat` | `package.json:28` | node | no | `tests/ai-uat/generate-report.ts` |
| `npm run firestore:dump` | `package.json:33` | node | service acct | live Firestore REST dump (see M11); run in CI by `firestore-production-export.yml:61` |
| `npm run prisma:*` | `package.json:6-11`, `:54` | node | DB URL | generate / validate / format / baseline SQL / drift / scoped drift (`scripts/lib/check-baseline-drift-scope.mjs`) / resolve baseline (`scripts/resolve-baseline-raya-ai.mjs`) - added 2026-10-15/16 |
| `npm run migrate:*`, `dump:staged`, `seed:supabase-sevas` | `package.json:37-47` | node | Firebase + Supabase service role | Firestore -> Supabase migrators (M11); every script target exists on disk |
| `npm run verify:supabase-migrations[:static/:json]`, `supabase:migrations:dry-run/push` | `package.json:48-52` | node / Supabase CLI | Supabase token | schema-ledger checks and pushes; driven by `supabase-migrations.yml` |
| `postinstall` | `package.json:53` | node | no | `prisma generate` - so every `npm ci` in every workflow now generates the Prisma client |
| GH Actions: push/PR to `main` | `.github/workflows/ci.yml:3-7` | CI | none | `npm ci` -> lint (`:35`) -> typecheck (`:38`) -> `npm test` (`:41`) -> `scripts/test-boundary.sh` (`:44`; a client page importing `lib/supabase/admin` must fail the build) -> build (`:47`). Added `b13e708` (2026-10-03) |
| GH Actions: push to `main` | `.github/workflows/deploy.yml:6-9` | CI | `VERCEL_TOKEN` | `npm ci` -> `vercel pull/build/deploy --prod`. **No lint, typecheck or test step, and no dependency on `ci.yml`.** |
| GH Actions: AI loop (5 workflows) | `.github/workflows/ai-loop-*.yml` | CI | `JULES_API_KEY`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN` | task dispatch -> Jules PR -> CI -> OpenRouter review -> merge gate -> next task (Flow G) |
| GH Actions: dispatch-only data operations (11 workflows) | see the *CI/CD* table | CI | Firebase / Supabase secrets | production export, migrations, diagnostics, Prisma drift and guarded applies (Flow H) |
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

Producers of analytics rows outside this chunk: `lib/ai/generator.ts:8` calls
`logUnknownQuestion`; `services/ml.service.ts:7` calls `logIntentFeedback`.

### 3. Test-runner trees (which runner reaches which files)

```
Jest  (jest.config.ts:9, preset ts-jest, testEnvironment jest-environment-jsdom (:5) - was node until 2026-10)
├── setupFiles tests/setup/jest.setup.ts        -> TextEncoder/streams/MessageChannel + undici fetch globals
├── testMatch **/tests/unit/**/*.test.ts        -> 46 files
├── testMatch **/tests/unit/**/*.test.tsx       -> 6 files (React Testing Library)     [52 files, ~834 tests]
└── testMatch **/tests/ai-uat/**/*.test.ts      -> 1 file  (tests/ai-uat/ai-uat.test.ts)
    coverage scope (jest.config.ts:21-24): lib/ai/** only   -> threshold 50% b/f/l/s
    CI: .github/workflows/ci.yml:41 `npm test` on every push/PR to main

Vitest  (NOT a dependency - no runner, F41)
└── tests/automation-loop/*.test.ts             -> 2 files, 115 tests; spawn .ai/scripts/*.mjs

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

1. `lib/ai/generator.ts:8` imports `logUnknownQuestion` from `services/analytics.service.ts` (called at
   `:73`). Since BOT-004 (2026-10-07..13) the chat composer logs unknown questions a second way, via
   `aiSettingsService.logUnknownQuestion` (`lib/ai/composer/composer.ts:304` -> `lib/ai/ai-settings/service.ts:525`,
   Supabase); `services/analytics.service.ts` itself is byte-identical to 2026-09-19 and still writes Firestore.
2. `logUnknownQuestion` (`:17`) writes to `unknown_questions` with `processed: false` and
   `serverTimestamp()`.
3. `logIntentUsage` (`:156`) writes an `intent_metrics` row per response with `usedFallback`.
4. Admin console calls `GET /api/admin/analytics` -> `getAnalyticsSummary`
   (`services/analytics.service.ts:338`) which fans out to three capped queries.
5. An admin correcting an intent triggers `services/ml.service.ts:7` -> `logIntentFeedback`
   (`services/analytics.service.ts:197`) -> `intent_feedback`.

### Flow C - a push to `main` reaches production

1. Developer pushes to `main`.
2. `.github/workflows/deploy.yml:18-27` checks out, sets up Node 22, `npm ci` (which now also runs
   `postinstall: prisma generate`, `package.json:53`).
3. `:29-36` installs Vercel CLI, `vercel pull --environment=production`, `vercel build --prod`.
4. `:38-39` `vercel deploy --prebuilt --prod`.
5. There is still **no** `npm run lint`, `npm run typecheck` or `npm test` step in this file. In
   parallel, on the same push, `.github/workflows/ci.yml:3-7` runs lint (`:35`), typecheck (`:38`),
   `npm test` (`:41`), `scripts/test-boundary.sh` (`:44`) and build (`:47`) - but `deploy.yml` has no
   `needs` or `workflow_run` link to it, so the deploy neither waits for nor stops on a red CI. The only
   other trigger is `workflow_dispatch`. A top-level `permissions: contents: read` was added at `:1-2`
   (`b13e708`).
6. An empty file `.deployment-trigger` exists at the repo root - its only plausible purpose is to be
   touched to force step 1.

### Flow D - daily Panchanga refresh

1. Cron fires four times a day (`.github/workflows/panchanga.yml:6-9`; the comment on `:5` claims
   "every 2 hours", which is wrong).
2. Sparse checkout of `scripts/` and `public/data/` (`:21-25`), Python 3.11, `pip install panchang`.
3. `python scripts/generate_panchanga.py` (`:35`) writes `public/data/panchanga/current.json`.
4. `:37-52` commits as `github-actions[bot]` and pushes with the default `GITHUB_TOKEN` (checkout at `:20` passes no other token). GitHub does not start workflows for pushes made with `GITHUB_TOKEN`, so neither `deploy.yml` nor `ci.yml` runs on these commits; the step's own message ("Vercel will automatically deploy the changes") relies on Vercel's Git integration, which is outside the repo (F46).
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
5. In CI the Jest variant runs twice: `.github/workflows/ai-uat.yml:50` when `lib/ai/**` changes, and
   inside `npm test` at `ci.yml:41` on every push/PR. Firebase, AI settings, the retrieval registry,
   retrieval and knowledge are mocked (`tests/ai-uat/ai-uat.test.ts:21,27,38,73,79,184` - `@/lib/firebase`
   is mocked twice) - so no live LLM, Firestore or Supabase calls.

### Flow G - the autonomous AI development loop (added 2026-10-03, `b13e708`)

1. A task lands in `.ai/state/task-queue.json` on `main` -> `.github/workflows/ai-loop-implement.yml`
   validates the loop config (`:54`), enforces a single active task (`:77`) and dispatches it to Jules
   (`JULES_API_KEY`) via `.ai/scripts/dispatch-conversation.mjs` (`:89`). OpenHands was the implementer
   until `d8e7969` (2026-10-04).
2. Jules opens a PR; `ci.yml` runs; on completion `ai-loop-review.yml` (`workflow_run: [CI]`) waits for
   CI (`:119`) and calls the OpenRouter reviewer (`OPENROUTER_API_KEY`, `.ai/scripts/chatgpt-review.mjs`, `:130`).
3. `ai-loop-merge-gate.yml` (`workflow_run: [AI loop review]`) re-derives the evidence with
   `.ai/scripts/merge-gate.mjs` (`:75`); with `.ai/loop.config.json` `autoMerge: false` it never merges -
   a human does (`docs/DEVELOPMENT_AUTOMATION.md`).
4. On merge, `ai-loop-next-task.yml` advances `.ai/state/loop-state.json` (`:117`) and dispatches the next
   task (`:164`). `ai-loop-validate.yml` validates the loop config and workflows on PR/push.
5. State on 2026-10-18: `completedTasks` AI-001..AI-008 in `.ai/state/loop-state.json`; briefs in
   `docs/tasks/`. The loop built the temple map (AI-002..004) and festival components (AI-005..008) -
   not the mobile milestones that `docs/DEVELOPMENT_PLAN.md` lists first.

### Flow H - production data operations (all `workflow_dispatch`, added 2026-09-21 .. 2026-10-16)

1. `firestore-production-export.yml` runs `npm run firestore:dump` (`:61`) with
   `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_PROJECT_ID`, validates it, and uploads
   `data/firestore-export/` + `data/firestore-dump/` as a 7-day artifact (`:228-236`) (F42).
2. `firestore-staged-migration.yml` (Phase 1: settings + events; dry-run by default, `confirm_production`
   required) and `firestore-batched-migration.yml` (checkpointed batches: `scripts/fetch-checkpoint.ts`
   `:80`, `scripts/migrate-all-batched.ts` `:108`, manifest artifact `:111-115`) write to Supabase with
   `SUPABASE_SERVICE_ROLE_KEY`.
3. `supabase-migrations.yml` links the project, lists, dry-runs and pushes schema migrations, then runs
   `npm run verify:supabase-migrations` (`:56-74`).
4. `prisma-baseline-drift-gate.yml` (modes scoped / drift / catalog), `resolve-raya-ai-baseline.yml` and
   `ai-knowledge-migration-apply.yml` are Prisma/DDL operations; the last two need a typed confirmation
   string (`resolve-baseline-raya-ai`, `apply-create-ai-knowledge`).
5. `check-collisions.yml`, `diagnostic-sevaBookings.yml`, `firestore-review-counts.yml` and
   `diagnose-supabase-connectivity.yml` are read-only diagnostics.

## Key files

### Runners and configs

| File | Lines | Role | Key exports | Notes |
|---|---|---|---|---|
| `package.json` | 132 | scripts + dependency manifest | - | next ^16.2.9, react 19.2.4, jest 29, playwright 1.61, prisma 7.10 + `@prisma/client` + `@prisma/adapter-pg` + `pg`, `@testing-library/react` 16 + `jest-dom`, `jest-environment-jsdom`, `cross-env`, `dotenv`; 49 scripts (25 on 2026-09-19), every script target verified present 2026-10-18 |
| `jest.config.ts` | 35 | Jest config | default `Config` | ts-jest, **jsdom** env (`:5`), `.tsx` tests matched (`:9`), `setupFiles` (`:10`), `@/` mapped; coverage scope `lib/ai/**` only (`:21-24`) |
| `tests/setup/jest.setup.ts` | 28 | Jest setup, added `8d54714` (2026-10-15) | - | polyfills `TextEncoder`/web streams/`MessageChannel` and installs `undici`'s `Request`/`Response`/`Headers`/`FormData`/`fetch` on the jsdom global; `undici` is not a declared dependency (F43) |
| `tests/playwright.config.ts` | 133 | Playwright config | default | `testDir: './tests/e2e'` resolves wrong (F01); 5 projects; html/json/junit reporters into `reports/` |
| `tsconfig.scripts.json` | 21 | ts-node config for `scripts/` and UAT runners | - | strict, CommonJS, includes `scripts/**`, `lib/**`, `types/**` |
| `vercel.json` | 23 | edge cache headers | - | `no-cache, no-store` on `/data/panchanga/*` |
| `lighthouse-budget.json` | 37 | desktop budget | - | perf >= 0.8, a11y >= 0.9, LCP <= 3000ms |
| `lighthouse-budget-mobile.json` | 34 | mobile budget | - | perf >= 0.7, a11y >= 0.85, LCP <= 4000ms |
| `.env.example` | 63 | env var template | - | Firebase, Vercel Blob, AI provider (openai/gemini/claude/openrouter), Supabase; since 2026-10-15 also a commented `PRISMA_DATABASE_URL` for migrations only (`:58-63`); safe to read |

### CI/CD

| File | Lines | Role | Trigger | Secrets |
|---|---|---|---|---|
| `.github/workflows/deploy.yml` | 39 | production deploy - independent of `ci.yml` | push `main`, dispatch | `VERCEL_TOKEN` |
| `.github/workflows/ci.yml` | 47 | lint, typecheck, `npm test`, boundary, build | push/PR `main` (concurrency-cancelled per ref) | none |
| `.github/workflows/ai-uat.yml` | 124 | AI UAT unit + Playwright + summary | push/PR on `lib/ai/**`, `components/ai/**`, `tests/ai-uat/**`, `AI_UAT.md` | `E2E_BASE_URL` (optional) |
| `.github/workflows/lighthouse-ci.yml` | 132 | desktop + mobile Lighthouse | push `main` on `app|components|lib`, dispatch | none |
| `.github/workflows/panchanga.yml` | 53 | daily Panchanga commit | 4 crons, dispatch | none (`contents: write`) |
| `.github/workflows/aaradhane.yml` | 281 | yearly Aaradhane -> Firestore | cron 1 Jan, dispatch | `FIREBASE_SERVICE_ACCOUNT` |
| `.github/dependabot.yml` | 15 | dependency PRs | weekly | - |
| `.github/workflows/ai-loop-implement.yml` | 91 | dispatch the active task to Jules | push `main` on `.ai/state/task-queue.json`, dispatch | `JULES_API_KEY`, `GITHUB_TOKEN` |
| `.github/workflows/ai-loop-review.yml` | 145 | OpenRouter review after CI | `workflow_run: [CI]`, dispatch | `OPENROUTER_API_KEY`, `JULES_API_KEY`, `GITHUB_TOKEN` |
| `.github/workflows/ai-loop-merge-gate.yml` | 101 | evaluate the merge gate (auto-merge off by config) | `workflow_run: [AI loop review]`, dispatch | `GITHUB_TOKEN` (`contents: write`) |
| `.github/workflows/ai-loop-next-task.yml` | 166 | advance loop state, dispatch the next task | PR closed, push on `.ai/state/loop-state.json`, dispatch | `JULES_API_KEY`, `GITHUB_TOKEN` |
| `.github/workflows/ai-loop-validate.yml` | 63 | validate loop config, workflows, state | PR/push `main` on `.ai/**`, workflows, `docs/tasks/**` (+3 filters naming paths that do not exist, F41) | none |
| `.github/workflows/supabase-migrations.yml` | 77 | link, list, dry-run, push schema, verify | dispatch | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY` |
| `.github/workflows/firestore-production-export.yml` | 243 | live Firestore dump -> 7-day artifact | dispatch | `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID` |
| `.github/workflows/firestore-staged-migration.yml` | 83 | Phase 1 (settings, events) dump + migrate | dispatch (dry-run default, `confirm_production`) | the three Firebase secrets + `FIREBASE_SERVICE_ACCOUNT_JSON`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `.github/workflows/firestore-batched-migration.yml` | 122 | checkpointed batch migration | dispatch (`target_ref`, `batch`, `batch_size`, `collections`, `retry_failed`, `dry_run`) | `FIREBASE_SERVICE_ACCOUNT_JSON`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN` |
| `.github/workflows/firestore-review-counts.yml` | 40 | read-only document counts | dispatch | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `.github/workflows/check-collisions.yml` | 36 | Firestore id-collision check | dispatch | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `.github/workflows/diagnostic-sevaBookings.yml` | 23 | sevaBookings diagnostic (moved from `scripts/.github/` by `5b6bb02`) | dispatch | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `.github/workflows/diagnose-supabase-connectivity.yml` | 40 | read-only Supabase connectivity | dispatch | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF` |
| `.github/workflows/prisma-baseline-drift-gate.yml` | 190 | Prisma drift: scoped / drift / catalog | dispatch | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |
| `.github/workflows/resolve-raya-ai-baseline.yml` | 62 | mark the Raya AI Prisma baseline applied; typed confirm | dispatch | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` |
| `.github/workflows/ai-knowledge-migration-apply.yml` | 61 | apply the single `ai_knowledge` migration; typed confirm | dispatch | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` |

The five original workflows (`ai-uat.yml`, `lighthouse-ci.yml`, `panchanga.yml`, `aaradhane.yml`,
`dependabot.yml`) are byte-identical to 2026-09-19 apart from line endings; `deploy.yml` only gained the
top-level `permissions` block.

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
| `tests/e2e/error-handling/error-handling.spec.ts` | 324 | 11 / 26 | Error Handling Module; `/* eslint-disable */` prepended at `:1` by `6408c1d` |
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

### Tests - Jest unit (`tests/unit/`, 52 files, ~834 tests; 17 files / ~500 tests on 2026-09-19)

The first 17 rows are the 2026-09-19 files (line counts updated); the rest were added since.

| File | Lines | tests | What it actually exercises |
|---|---|---|---|
| `tests/unit/intent.test.ts` | 721 | 118 | `lib/ai/intent` - real behaviour, the strongest suite here; earlier "accept either intent" softening was re-tightened to exact intents (`:101,188,207,214`), mocks `server-only` + `global.fetch` (`:20-28`) |
| `tests/unit/system-prompt.test.ts` | 403 | 66 | anti-hallucination rules in the system prompt |
| `tests/unit/knowledge-bootstrap.test.ts` | 340 | 40 | reads `seed/ai/*.json` off disk via `jest.requireActual("fs")`; no module imports |
| `tests/unit/knowledge-workflow.test.ts` | 572 | 39 | `types/knowledge-workflow` shapes |
| `tests/unit/multi-source-retrieval.test.ts` | 607 | 34 | `types/multi-source-retrieval` shapes; expected temple name now "Matha" |
| `tests/unit/response-generator.test.ts` | 431 | 31 | `lib/ai` response generation; **content assertions weakened to `toBeDefined()`** (`:184,206,253,275,317`) and out-of-scope prompts may now resolve to `TEMPLE_TIMINGS`/`DAILY_QUOTE` (`:298,305`) (F39) |
| `tests/unit/knowledge.test.ts` | 220 | 26 | seed articles; mocks `server-only` twice (`:1`, `:30`) |
| `tests/unit/quote.service.test.ts` | 594 | 25 | quote rotation logic via `types/quote` only - not `services/quote.service.ts`; pinned to `FIXED_TEST_DATE` (`:459`, `97cc52f`) after day-dependent CI failures; `:167,184` now branch on the festival name |
| `tests/unit/aaradhane/gurus.test.ts` | 205 | 24 | `GURU_AARADHANES` dataset (M14); month check widened to accept both transliterations (`:43`) |
| `tests/unit/ai-analytics.test.ts` | 573 | 21 | **imports no service** - redeclares local interfaces (F10) |
| `tests/unit/aaradhane/panchanga.test.ts` | 254 | 18 | `lib/aaradhane/panchanga` + fixture files (M14); **four assertions are `dates.length >= 0`** (`:113,137,166,179`; three introduced by `2891323`) (F39) |
| `tests/unit/receipt-validation.test.ts` | 156 | 17 | `lib/receipt/validation` (M14/M07) |
| `tests/unit/api-knowledge-routes.test.ts` | 271 | 16 | fs-based assertions about route files, not HTTP |
| `tests/unit/proof-report.test.ts` | 149 | 8 | `services/proof-report/*` (imports `:12-16`); now mocks `playwright` (`:1-9`); still hardcodes a dead OpenHands sandbox host at `:20`, fed to `new ProofReportService(testBaseUrl, ...)` at `:133` (F03) |
| `tests/unit/receipt-numbering.test.ts` | 47 | 8 | `lib/receipt/numbering` |
| `tests/unit/receipt-payment.test.ts` | 60 | 8 | UPI payment string + catalogue totals |
| `tests/unit/aaradhane/generator.test.ts` | 252 | 5 | `validateGeneratedEvents` (M14) |
| `tests/unit/admin-auth.test.ts` | 195 | 14 | `lib/auth/admin-auth` header handling, `firebase-admin/auth` mocked (BOT-005) |
| `tests/unit/admin-firebase.test.ts` | 149 | 5 | `lib/admin-firebase` init from `FIREBASE_SERVICE_ACCOUNT_JSON` / PEM vars, synthetic key |
| `tests/unit/ai-api-auth-wiring.test.ts` | 63 | 4 | fs-based: AI routes call `verifyAdminUser`, health route read-only, seed preserves values |
| `tests/unit/ai-health-classify.test.ts` | 134 | 17 | `lib/ai/health-classify` `classifyHttpResult` |
| `tests/unit/ai-settings.test.ts` | 171 | 6 | `lib/ai/ai-settings/validation` + `seed-data` (BOT-001) |
| `tests/unit/api-ai-health-route.test.ts` | 78 | 3 | `GET /api/ai/health` handler with auth + admin repository mocked |
| `tests/unit/api-ai-public-settings.test.ts` | 74 | 3 | `GET /api/ai/public-settings` handler |
| `tests/unit/apply-ai-knowledge-migration.test.ts` | 72 | 7 | guard rails of `scripts/apply-ai-knowledge-migration.mjs` via child process |
| `tests/unit/bot-004-action.test.ts` | 139 | 12 | `app/actions/settings` server-action authorization |
| `tests/unit/bot-004-auth.test.ts` | 102 | 8 | `lib/auth/admin` admin check |
| `tests/unit/bot-004-behavior.test.ts` | 157 | 9 | `services/ai-analytics.service` + `lib/ai/unknown-logger` on Supabase (the second unit file importing a service) |
| `tests/unit/bot-005-security.test.ts` | 13 | 1 | reads `lib/supabase/admin.ts` and asserts it contains `import 'server-only';` - a string check |
| `tests/unit/check-baseline-drift-scope.test.ts` | 97 | 8 | `scripts/lib/check-baseline-drift-scope.mjs` via child process |
| `tests/unit/ci-pages-and-supabase-ledger.test.ts` | 74 | 4 | `.nojekyll` exists; Supabase ledger marker migrations are comment-only (`c156d6c`) |
| `tests/unit/components/admin/ai-settings-page.test.tsx` | 130 | 4 | `app/admin/ai/settings/page` with `useAdminFetch` mocked (RTL) |
| `tests/unit/components/festival/FestivalCountdown.test.tsx` | 102 | 3 | `components/festival/FestivalCountdown` (AI-005) |
| `tests/unit/components/festival/FestivalGuide.test.tsx` | 60 | 4 | `components/festival/FestivalGuide` (AI-008) |
| `tests/unit/components/festival/FestivalLiveUpdates.test.tsx` | 35 | 3 | `components/festival/FestivalLiveUpdates` (AI-006) |
| `tests/unit/components/festival/FestivalPhotoHighlights.test.tsx` | 84 | 6 | `components/festival/FestivalPhotoHighlights` (AI-007) |
| `tests/unit/dump-firestore-live-credentials.test.ts` | 58 | 4 | `scripts/dump-firestore-live` credential resolution |
| `tests/unit/dump-firestore-live-jwt.test.ts` | 77 | 5 | JWT private-key validation, offline |
| `tests/unit/dump-firestore-live.test.ts` | 451 | 17 | `resolveCredentials`, pagination, retry/backoff of the live dumper |
| `tests/unit/fetch-checkpoint.test.ts` | 183 | 9 | `scripts/fetch-checkpoint` checkpoint validation |
| `tests/unit/firebase-key-parser.test.ts` | 58 | 7 | `lib/utils/firebase-key-parser` |
| `tests/unit/migrate-all-batched.test.ts` | 205 | 15 | `scripts/migrate-all-batched` execution plan + `lib/supabase/migration-inventory` |
| `tests/unit/migrate-staged-phase1.test.ts` | 151 | 10 | Phase 1 staged dump/migrate scripts (child process + checksums) |
| `tests/unit/migration-helpers.test.ts` | 175 | 19 | `lib/supabase/migration-helpers` timestamp preservation + coverage |
| `tests/unit/migration-mappers.test.ts` | 868 | 57 | `lib/supabase/migration-mappers` - missing-field fallbacks per collection |
| `tests/unit/no-firestore-analytics.test.ts` | 117 | 7 | fs-based: `services/ai-analytics.service.ts` and `lib/ai/unknown-logger.ts` contain no `firebase/firestore` |
| `tests/unit/prisma-schema-baseline.test.ts` | 326 | 20 | `prisma/schema.prisma` vs the baseline SQL (fs-based) |
| `tests/unit/resolve-baseline-raya-ai.test.ts` | 119 | 11 | guard rails of `scripts/resolve-baseline-raya-ai.mjs` |
| `tests/unit/seed-ai-settings-route.test.ts` | 162 | 5 | `POST /api/seed-ai-settings` handler |
| `tests/unit/seed-ai-settings.test.ts` | 93 | 3 | `scripts/seed-ai-settings-supabase` idempotency |
| `tests/unit/supabase-migration-coverage.test.ts` | 193 | 18 | `lib/supabase/migration-coverage` `extractDeclaredTables` |
| `tests/unit/useAdminFetch.test.tsx` | 146 | 6 | `hooks/useAdminFetch` token injection (`useAuth` mocked) |

### Tests - AI-loop tooling (`tests/automation-loop/`, added `b13e708`)

| File | Lines | tests | Notes |
|---|---|---|---|
| `tests/automation-loop/loop-scripts.test.ts` | 693 | 28 | spawns `.ai/scripts/*.mjs` as child processes; `import ... from 'vitest'` (`:6`) |
| `tests/automation-loop/review-loop.test.ts` | 1306 | 87 | imports `.ai/scripts/review-core.mjs`; vitest. Neither file is reachable by Jest or any workflow (F41) |

### Tests - AI UAT (`tests/ai-uat/`)

| File | Lines | Role |
|---|---|---|
| `tests/ai-uat/test-cases.ts` | 3118 | 275 cases, 15 `TestCategory` values, personas, `TEST_STATS` (`:3077`), `getTestsBy*` helpers |
| `tests/ai-uat/ai-uat.test.ts` | 653 | Jest suite; mocks firebase (twice), AI settings, retrieval registry, retrieval, knowledge (`:21,27,38,73,79,184`); lines 1-2 were injected by the now-deleted `fix-websocket.ts`; out-of-scope tests now accept `TEMPLE_TIMINGS` for "Write me a Python function" (`:414,419`) (F39) |
| `tests/ai-uat/ai-uat.spec.ts` | 908 | Playwright suite; `BASE_URL` falls back to a dead sandbox (`:17`) |
| `tests/ai-uat/run-uat-tests.ts` | 284 | standalone ts-node runner, writes `SummaryReport` with regressions; `CategoryResult` gained `skipped` (`:37,67`) |
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
| ~~`test_plan.sh`~~ | - | removed 2026-10 - see Refresh log (`224875d`, 2026-10-06) | done |
| `fix_lint.sh` | 10 | **rewritten by `6408c1d` (2026-10-03)**: prepends `/* eslint-disable */` to four app files instead of fixing them (F40) | delete |
| ~~`fix-websocket.ts`~~ | - | removed 2026-10 - see Refresh log (`356de70`, 2026-09-19); its injected lines remain at `tests/ai-uat/ai-uat.test.ts:1-2` | done |
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
**Refresh 2026-10-18 (Sunday):** the ages are still measured from 2026-09-19 - add 29 days
(2026-10-18 minus 2026-09-19, computed) for today's age. Rows dated after 2026-09-19 come from
`git log --since=2026-09-19` on this branch and carry no age.

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
| 2026-09-19 | - | Raya AI architecture refactor; `fix-websocket.ts` deleted; `docs/RAYA_AI_ARCHITECTURE.md` cut to 43 lines the next day | `356de70`, `da7a1fc` |
| 2026-09-21 | - | Supabase schema-migration workflow + seva_bookings migrator | `1e1e42f`, `549dfed` |
| 2026-09-22 .. 24 | - | production Firestore export workflow, rate-limit hardening, resumable batched migration; `tsconfig.tsbuildinfo` removed | `8d1ac28`, `21c9418`, `6928864` |
| 2026-09-28 | - | staged Phase 1 Firestore -> Supabase migration (settings, events) | `c46c706`, `docs/PHASE_1_MIGRATION_VALIDATION_ANALYSIS.md` |
| 2026-09-29 / 30 | - | Phase 2 Batch 1 dry run; `REPORT.md` overwritten (second time; first was `9f3cad6` on 2026-09-21); Expo app reconstructed in `apps/mobile/`, `COMPLETION_REPORT.md` overwritten (third time in two days: `7ec2af7`, `051c530`, `0cb71b6`) | `69d7f2d`, `14d71c0`, `0cb71b6` |
| 2026-10-01 | - | read-only Firestore counts workflow; Phase 2 readiness review | `31fd2dc`, `docs/REVIEW_MIGRATION_READINESS.md` |
| 2026-10-03 | - | AI development loop + `ci.yml`; lint made green with blanket disables | `b13e708`, `6408c1d` |
| 2026-10-04 | - | loop implementer switched from OpenHands to Jules | `d8e7969` |
| 2026-10-04 .. 07 | - | loop tasks AI-002..AI-008 (temple map, festival components) | `docs/tasks/`, `.ai/state/loop-state.json` |
| 2026-10-06 | - | BOT-001 AI settings rebuilt on Supabase (`final_report.txt` overwritten); BOT-002 knowledge, BOT-003 chat migrated | `fae5d51`, `fdaff98`, `224875d` |
| 2026-10-07 .. 14 | - | BOT-004 AI analytics migrated to Supabase, post-merge verification | `4de808e`, `283def3` |
| 2026-10-14 / 15 | - | BOT-005 server-side security hardening; `scripts/test-boundary.sh` added to CI; PR #325 corrective revision | `c479ad4`, `e465557`, `docs/PR_325_FINAL_CORRECTIVE_REVISION.md` |
| 2026-10-15 / 16 | - | Prisma foundation + Raya AI baseline, drift gate, `ai_knowledge` apply, baseline resolve, step-4 production verification | `2e8f0b1`, `8056265`, `afc9fda`, `623f015`, `84cdc02` |
| 2026-10-16 | - | two pre-existing red checks cleared (Pages Jekyll, Supabase Preview); quote tests pinned to a fixed date | `c156d6c`, `97cc52f` |
| 2026-10-18 | - | this knowledge base ported into the repo (`docs/overview/`, `docs/rearchitecture/`) | `3d6aa9d` |

**Planned vs built.** The v2.0 sprint plan was substantially delivered: `lib/i18n/`,
`app/(public)/profile/`, `app/(public)/display/page.tsx`, `app/(public)/live/page.tsx`,
`app/(public)/search/page.tsx`, `app/admin/library/page.tsx`, `app/admin/stotras/page.tsx` and
`app/admin/media/page.tsx` all exist. What did **not** keep pace is the record of it: `docs/ROADMAP.md`
still lists analytics and testimonials as unstarted (F31), `docs/API.md` still documents three
endpoints out of 97 (F16), and `docs/PROJECT_STRUCTURE.md` still describes a Next.js 14 tree with two
API routes. The Supabase migration was the one large planned item that demonstrably had not landed
by 2026-09-19; by 2026-10-18 most of it had, through CI (Phase 1 staged `c46c706`, batched `21c9418`,
BOT-001..004 AI tables, Prisma baseline `2e8f0b1`), which leaves `BLOCKED_REPORT.md` stale. Newer
plan-vs-built drift: `docs/DEVELOPMENT_PLAN.md` puts mobile milestones M1-M2 next, but the AI loop's
eight tasks built the temple map and festival components (`.ai/state/loop-state.json` `completedTasks`).

### Root reports (project history)

| File | Lines | What it records | Currency |
|---|---|---|---|
| `README.md` | 310 | setup, scripts, AI seeding, 4-phase roadmap | **partially stale** - no Supabase, no test scripts, no Panchanga/Aaradhane; "Maintainer: Naveen C" |
| `AGENTS.md` | 451 | the AI agent contract; tech stack table; Firestore dump notes dated 2026-09-10 (9 days old) | **current-ish but drifted** - `:213` says Next.js 14 |
| `AGENTS_REPORT.md` | 28 | ADC `projectId` fallback added to `lib/admin-firebase.ts` | plausible, undated |
| `COMPLETION_REPORT.md` | 17 | **overwritten 2026-09-30 (`0cb71b6`)**: claims a "production-ready" Expo app in `apps/mobile/` | **overstated** - `docs/MOBILE_COMPLETION_MATRIX.md` marks 13 feature rows MISSING |
| `REPORT.md` | 39 | **overwritten 2026-09-21 (`9f3cad6`, Supabase migration-history repair report), then 2026-09-29 (`69d7f2d`; edited by `14d71c0`, last touched `54963a1`)**: Phase 2 Batch 1 migration blockers (`imageUrl`/`description`/`significance`/`slug` -> `""` fallbacks); records lint at 836 problems / 84 errors | historical; the receipts-auth text (old F08) is gone |
| `BLOCKED_REPORT.md` | 12 | Firestore->Supabase migration aborted for missing credentials | **stale** - the migration has since run through CI (`firestore-staged-migration.yml`, `docs/PHASE_1_MIGRATION_VALIDATION_ANALYSIS.md`) |
| `final_report.txt` | 11 | **overwritten 2026-10-06 (`fae5d51`)**: now the BOT-001 "AI settings on Supabase" summary; the Firestore health audit described below is no longer in the file | historical |

The Firestore health audit that `final_report.txt` held until 2026-10-06 (`git show fae5d51^:final_report.txt`),
verified against code on 2026-09-19 and re-verified 2026-10-18 (all three lines unchanged):
`services/pooja.service.ts:16` still `const COLLECTION_NAME = "dailyPoojas"`; `firestore.rules` still has
a `match /sevas/{sevaId}` (`:76`) and **no** `dailyPoojas` match; `hooks/useDonationNotifications.ts:75`
still polls every 60 s. The audit's central finding is unfixed.

### `docs/` health - the 27 files of 2026-09-19, then the 45 added since

Verdicts as of 2026-09-19. Most of the corpus was written 2026-07-13 .. 2026-07-23, i.e. 58-68 days ago
(87-97 days on 2026-10-18). Re-checked 2026-10-18: only `docs/FIRESTORE_MIGRATION.md`,
`docs/RAYA_AI_ARCHITECTURE.md` and `docs/SUPABASE_DATABASE_SCHEMA.md` changed among these 27; the other
24 differ from the snapshot at most in line endings, so their verdicts stand.

| File | Lines | Stated date | Verdict | Evidence |
|---|---|---|---|---|
| `docs/CHANGELOG.md` | 0 | - | **empty** | 0 bytes |
| `docs/DEPLOYMENT.md` | 0 | - | **empty** | 0 bytes - yet `README.md` and `docs/SPRINT-5-DEPLOYMENT.md` both point at deployment as a documented topic |
| `docs/API.md` | 203 | - | **stale** | documents 3 endpoints (`/api/admin/users/create-admin`, `/api/admin/users/set-role`, `/api/gallery/local-assets`) out of 95 `route.ts` files (97 on 2026-10-18); base URL `rayaramathaynk.vercel.app` differs from the Postman `sri-raghavendra-mutt.vercel.app` |
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
| `docs/RAYA_AI_ARCHITECTURE.md` | 43 | none (rewritten 2026-09-20, `da7a1fc`) | **stale** | cut from 690 to 43 lines; `:41` says `lib/ai/knowledge/repository.ts` "still connects to Firestore", but it imports the Supabase clients at `:4-5` since BOT-002 (`fdaff98`) (F45) |
| `docs/AI_ASSISTANT.md` | 420 | none | **undated** | no "last updated" line anywhere; the only 2024 strings in the file are a sample payload value (`:324` `"lastChecked": "2024-01-01T00:00:00Z"`) and a model id (`:101` `claude-3-haiku-20240307`), neither of which dates the document. Content describes replacing Chatbase, so it is early |
| `docs/AI_ENHANCEMENTS.md` | 258 | "July 2026" | **status unknown** | header says "Status: In Progress" with no item-level state |
| `docs/PANCHANGA.md` | 428 | 2026-07-07/08 | current-ish | grade against M14 |
| `docs/AARADHANE_GENERATOR.md` | 377 | - | current-ish | duplicated at root as `AARADHANE_GENERATOR.md` (250 lines, different content) |
| `docs/QUOTE-ENGINE.md` | 534 | 2026-07-21 | current-ish | grade against M06 |
| `docs/FIREBASE.md` | 153 | - | current-ish | thin; predates Supabase |
| `docs/FIRESTORE_MIGRATION.md` | 161 | - | **current-ish** (was aspirational) | grew 77 -> 161 lines: documents the real per-collection migrators, their npm aliases and the checkpointed batched workflow; Phase 1 has run |
| `docs/SUPABASE_DATABASE_SCHEMA.md` | 438 | - | **partially aligned** (was a proposal) | now cites applied migrations (`supabase/migrations/20260921000000_align_seva_bookings_seva_id.sql`, `supabase/migrations/20261002000000_align_content_firestore_ids.sql`) and adds a `settings_documents` section, but `:4` still "outlines the proposed migration"; grade against M11 |
| `docs/ARCHITECTURE_DIAGRAM.html` | 648 | - | unverified | a standalone HTML diagram; not read in this pass |

#### Added since 2026-09-19 (45 files)

| File | Lines | Stated date | Verdict | Evidence |
|---|---|---|---|---|
| `docs/AI_SETTINGS_HEALTH_VERIFICATION_PLAN.md` | 201 | 2026-10-15/16 | current | records "Main CI workflow: **success**" (`:136`) - the only in-repo evidence that CI is green |
| `docs/BOT_001_AI_SETTINGS_AUDIT.md` | 90 | none | historical | pre-migration audit of the Firestore AI settings |
| `docs/BOT_001_AI_SETTINGS_RECONCILIATION.md` | 27 | none | historical | type reconciliation note |
| `docs/BOT_001_POST_MERGE_VERIFICATION.md` | 28 | none | historical | touched by `c156d6c` |
| `docs/BOT_002_KNOWLEDGE_AUDIT.md` | 37 | none | historical | Firestore knowledge audit |
| `docs/BOT_002_KNOWLEDGE_MIGRATION_REPORT.md` | 53 | none | historical | matches `lib/ai/knowledge/repository.ts:4-5` (Supabase) |
| `docs/BOT_003_CHAT_AUDIT.md` | 28 | none | historical | - |
| `docs/BOT_003_CHAT_MIGRATION_REPORT.md` | 77 | none | historical, one unverifiable claim | `:70` says `npx vitest run tests/automation-loop/` "successfully ran"; `vitest` is in no `package.json` dependency list, so that could only have worked by `npx` fetching vitest ad hoc - nothing in the repo or CI reproduces it (F41) |
| `docs/BOT_004_ANALYTICS_AUDIT.md` | 67 | none | historical | - |
| `docs/BOT_004_ANALYTICS_MIGRATION_REPORT.md` | 21 | none | historical | guarded by `tests/unit/no-firestore-analytics.test.ts` |
| `docs/DEVELOPMENT_AUTOMATION.md` | 50 | none | **current** | roles and flow match the `ai-loop-*` workflows and `.ai/loop.config.json` (`autoMerge: false`, `requireHumanApproval: true`) |
| `docs/DEVELOPMENT_PLAN.md` | 64 | none | **plan, diverged** | lists mobile M1-M2 next; the loop built temple-map and festival features instead |
| `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` | 2 | none | **stub** | one heading; the batched workflow overwrites it at run time and uploads it as an artifact (`firestore-batched-migration.yml:117-121`) - the committed copy carries nothing |
| `docs/KNOWLEDGE_LEARNINGS.md` | 3 | none | note | one BOT-002 lesson |
| `docs/MOBILE_COMPLETION_MATRIX.md` | 33 | none | partially stale | 13 rows MISSING; claims events via "API" while `apps/mobile/lib/api.ts:1-4` queries Supabase directly - grade against the mobile chunk |
| `docs/PHASE_1_MIGRATION_VALIDATION_ANALYSIS.md` | 66 | none | historical | Phase 1 run evidence |
| `docs/PRISMA-SCHEMA-BASELINE.md` | 622 | 2026-10-16 | **current** | matches `prisma/schema.prisma` and `tests/unit/prisma-schema-baseline.test.ts` |
| `docs/PR_325_FINAL_CORRECTIVE_REVISION.md` | 63 | none | historical | `:8` admits earlier AI cycles "improperly softened intent tests" (F39) |
| `docs/PR_325_REVISION_REPORT.md` | 46 | none | historical | - |
| `docs/RAYA_AI_ADMIN_GUIDE.md` | 41 | none | current-ish, thin | grade against M09 |
| `docs/RAYA_AI_DATA_FLOW.md` | 20 | none | current-ish, thin | grade against M08 |
| `docs/RAYA_AI_FRESH_SETUP_REPORT.md` | 48 | none | historical | - |
| `docs/RAYA_AI_SETTINGS.md` | 32 | none | current-ish, thin | grade against M09 |
| `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` | 352 | 2026-10-15 | **current** | edited by `c156d6c` |
| `docs/REVIEW_MIGRATION_READINESS.md` | 138 | none | historical | Phase 2 readiness |
| `docs/RUNBOOK-AI-KNOWLEDGE-APPLY.md` | 141 | none | **current** | the first real runbook in `docs/`; drives `ai-knowledge-migration-apply.yml` |
| `docs/SECURITY_SUPABASE_ACCESS_TOKEN_ROTATION.md` | 62 | 2026-10-16 | **open task** | token rotation not yet recorded as done |
| `docs/SUPABASE_MIGRATIONS.md` | 86 | none | current-ish | describes `supabase-migrations.yml` |
| `docs/tasks/AI-002-interactive-temple-map.md`, `docs/tasks/AI-002-interactive-temple-map.json` | 21, 24 | 2026-10-04 | done | AI loop brief + machine form |
| `docs/tasks/AI-003-temple-map-points-of-interest.md`, `docs/tasks/AI-003-temple-map-points-of-interest.json` | 23, 28 | 2026-10-05 | done | - |
| `docs/tasks/AI-004-add-accessibility-info.md`, `docs/tasks/AI-004-add-accessibility-info.json` | 24, 28 | 2026-10-05 | done | - |
| `docs/tasks/AI-005-implement-festival-countdown.md` | 24 | none | done | tested by `tests/unit/components/festival/FestivalCountdown.test.tsx` |
| `docs/tasks/AI-006-festival-live-updates.md` | 24 | none | done | `FestivalLiveUpdates.test.tsx` |
| `docs/tasks/AI-007-festival-photo-highlights.md` | 24 | none | done | `FestivalPhotoHighlights.test.tsx` |
| `docs/tasks/AI-008-festival-guide.md` | 24 | none | done | `FestivalGuide.test.tsx` |
| `docs/overview/OVERVIEW.md`, `docs/overview/TECHNICAL-GUIDE.md`, `docs/overview/KNOWLEDGE-BASE-GUIDE.md`, `docs/overview/temple-portal-brief.html` | 222, 635, 70, 1114 | 2026-09-19 (guide 2026-10-18) | **generated** by this knowledge base (`3d6aa9d`); their claims are as of 2026-09-19 until regenerated | e.g. `docs/overview/TECHNICAL-GUIDE.md:615-622` repeats this file's 2026-09-19 doc verdicts |
| `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`, `docs/rearchitecture/UI-REDESIGN-PLAN.md`, `docs/rearchitecture/ui-redesign-specimens.html` | 1461, 1139, 1572 | 2026-09-19 | **generated** (`3d6aa9d`) | the fault register there predates this refresh's F39-F45 |

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

Newer lint evidence (2026-09-30 .. 2026-10-03, outside `reports/`): `REPORT.md` records 836 problems /
84 errors / 752 warnings on 2026-09-30; root `lint.txt` (1,473 lines), `lint2.txt` (1,263) and
`lint_files.txt` (254) were committed by `6408c1d`, the commit that then silenced the errors (F40). None
of them agrees with the three July artefacts (F14).

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
| `.ai/state/loop-state.json`, `.ai/state/task-queue.json` (unowned) | AI-loop workflows | AI-loop workflows, committed back to `main` | `.github/workflows/ai-loop-next-task.yml:117`, `ai-loop-implement.yml:64-81` |
| GitHub Actions artifacts `firestore-production-export`, `migration-manifest`, `migration-report`, `migration-phase1-report` | `scripts/fetch-checkpoint.ts` reads `migration-manifest` | the data workflows | `firestore-production-export.yml:228-236`, `firestore-batched-migration.yml:111-121`, `firestore-staged-migration.yml:79-82` |

Analytics stores unchanged on 2026-10-18: `services/analytics.service.ts`,
`services/pageviews.service.ts` and `components/analytics/PageViewTracker.tsx` are byte-identical to the
snapshot. BOT-004 moved the *AI* analytics service (`services/ai-analytics.service.ts`, M10) and
`lib/ai/unknown-logger.ts` to Supabase, guarded by `tests/unit/no-firestore-analytics.test.ts` - that
does not touch the seven Firestore collections above.

## Cross-module dependencies

**This chunk imports from:**

| Target | Chunk | Via |
|---|---|---|
| `lib/firebase` (`db`, `isFirebaseConfigured`) | M01 / M10 | `services/analytics.service.ts:6`, `services/pageviews.service.ts:6` |
| `types/analytics` | M10 | `services/analytics.service.ts:8` |
| `lib/ai/intent`, `lib/ai/intent/types` | M08 | `tests/ai-uat/*`, `tests/unit/intent.test.ts`, `tests/unit/ai-analytics.test.ts` |
| `lib/ai/generator` | M08 | `tests/ai-uat/ai-uat.test.ts:18`, `tests/ai-uat/run-uat-tests.ts:21` |
| `lib/ai/knowledge`, `lib/ai/retrieval`, `lib/ai/retrieval/registry`, `lib/ai/ai-settings` | M08 | mocked in `tests/ai-uat/ai-uat.test.ts:27,38,79,184` |
| `lib/aaradhane/panchanga`, `types/aaradhane-generator` | M14 | `tests/unit/aaradhane/*` |
| `lib/receipt/validation`, `lib/receipt/numbering`, `types/receipt` | M07 / M14 | `tests/unit/receipt-*.test.ts` |
| `services/proof-report/*` | M14 | `tests/unit/proof-report.test.ts:12-16` |
| `lib/auth/admin-auth`, `lib/auth/admin`, `lib/admin-firebase`, `lib/utils/firebase-key-parser` | M04 | `tests/unit/admin-auth.test.ts`, `bot-004-auth.test.ts`, `admin-firebase.test.ts`, `firebase-key-parser.test.ts` |
| `lib/supabase/migration-mappers`, `migration-helpers`, `migration-coverage`, `migration-inventory`, `lib/supabase/admin` | M11 | `tests/unit/migration-*.test.ts`, `supabase-migration-coverage.test.ts`, `migrate-all-batched.test.ts`, `bot-005-security.test.ts` |
| `scripts/dump-firestore-live`, `fetch-checkpoint`, `migrate-all-batched`, `seed-ai-settings-supabase`, `*.mjs` guard scripts | M11 | the dump/migration/Prisma unit tests |
| `lib/ai/ai-settings/*`, `lib/ai/health-classify`, `lib/ai/unknown-logger`, `services/ai-analytics.service` | M08 / M09 / M10 | `tests/unit/ai-settings.test.ts`, `ai-health-classify.test.ts`, `bot-004-behavior.test.ts` |
| `app/api/ai/health`, `app/api/ai/public-settings`, `app/api/seed-ai-settings`, `app/actions/settings`, `app/admin/ai/settings/page` | M05 / M09 / M12 | route, action and page tests added 2026-10 |
| `components/festival/*`, `hooks/useAdminFetch` | M03 / M05 | RTL tests under `tests/unit/components/` and `tests/unit/useAdminFetch.test.tsx` |
| `.ai/scripts/*.mjs` (unowned) | - | `tests/automation-loop/*`, and the five `ai-loop-*` workflows |
| `scripts/test-boundary.sh` | M11 / M01 | `.github/workflows/ci.yml:44` |
| `lib/reports/report-saver` | M14 | `tests/reports/save-reports.spec.ts:17` |
| `types/quote`, `types/knowledge-workflow`, `types/multi-source-retrieval` | M10 | corresponding unit tests |
| `scripts/generate_panchanga.py`, `scripts/generate-aaradhane.ts` | M14 | the two scheduled workflows |

**Who imports this chunk:**

| Importer | Chunk | What it takes |
|---|---|---|
| `lib/ai/generator.ts:8` | M08 | `logUnknownQuestion` |
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

### 3. Make the deploy wait for CI

1. A gate exists since 2026-10-03 - `.github/workflows/ci.yml` (lint `:35`, typecheck `:38`, `npm test`
   `:41`, boundary `:44`, build `:47`) - but `deploy.yml` does not depend on it. Either switch
   `deploy.yml` to `on: workflow_run: { workflows: [CI], types: [completed], branches: [main] }` with
   `if: github.event.workflow_run.conclusion == 'success'`, or move the Vercel steps into `ci.yml` as a
   second job with `needs: build`.
2. Remove `continue-on-error: true` from the build steps in
   `.github/workflows/lighthouse-ci.yml:47` and `:99` - a failed build must fail the job.
3. Before trusting the gate, undo what made it green: remove the blanket `/* eslint-disable */` lines
   (F40) and restore the weakened assertions (F39).
4. If the e2e suite should run, add a job that does recipe 2 first, then
   `npx playwright test --config playwright.config.ts`.

### 4. Add a Jest unit test for a service

1. Put it in `tests/unit/<name>.test.ts` (or `.test.tsx` for a component - jsdom + React Testing
   Library, as `tests/unit/components/festival/*` do) - `jest.config.ts:9` matches only `tests/unit/**`
   and `tests/ai-uat/**`. A module that imports `server-only` needs
   `jest.mock("server-only", () => ({}), { virtual: true })` first (`tests/unit/knowledge.test.ts:1`).
2. Mock Firebase the way `tests/unit/ai-analytics.test.ts:36-42` does
   (`jest.mock("@/lib/firebase", ...)`), then import the **real** service - do not redeclare its types.
3. Widen `collectCoverageFrom` in `jest.config.ts:21-24` beyond `lib/ai/**` or the coverage number
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
3. 34 routes are missing on 2026-10-18 and `/api/admin/knowledge/approve` is present with no route file -
   the list is in F16's evidence.

### 9. Add a task to the AI development loop

1. Write a brief in `docs/tasks/<id>-<slug>.md` (and the `.json` form if the schema in
   `.ai/schemas/task-brief.schema.json` is used), then append the task to `.ai/state/task-queue.json`.
2. Push to `main`: `ai-loop-implement.yml` picks it up and dispatches it to Jules; nothing merges without
   a human (`.ai/loop.config.json` `autoMerge: false`).
3. Test the loop's own scripts with vitest once it is a devDependency (F41); until then
   `node .ai/scripts/validate-loop-config.mjs`, `validate-workflows.mjs`, `assert-trusted-review.mjs`,
   `loop-state.mjs status` and `loop-tasks.mjs status` are the checks `ai-loop-validate.yml:50-63` runs.

## Faults, smells and risks

| id | sev | What | Evidence | Direction |
|---|---|---|---|---|
| M15-F01 | HIGH | **STILL OPEN (2026-10-18)** - Playwright's config is never applied: `testDir: './tests/e2e'` resolves relative to the config's own folder, giving `tests/tests/e2e`, which does not exist; there is no root `playwright.config.ts`, so every invocation silently falls back to Playwright defaults - no projects, no reporters, no baseURL | `tests/playwright.config.ts:9`; no `playwright.config.*` at repo root; no `tests/tests/` directory; `package.json:21` calls `playwright test <path>` with no `--config` | Move the config to the root, or change `testDir` to `'./e2e'` and pass `--config` everywhere |
| M15-F02 | HIGH | **STILL OPEN (2026-10-18)** - Production deploy has no quality gate. Push to `main` goes straight to `vercel deploy --prod`; no lint, typecheck or test step exists in the workflow | `.github/workflows/deploy.yml:6-9` (trigger), `:18-39` (all steps). Since `b13e708` `.github/workflows/ci.yml` runs lint/typecheck/test/build on the same push, but `deploy.yml` has no `needs`/`workflow_run` link to it, so a red CI still deploys | Make `deploy.yml` run on `workflow_run` of CI success, or fold it into `ci.yml` with `needs: build` (recipe 3) |
| M15-F03 | HIGH | **STILL OPEN (2026-10-18)** - 13 test files reference dead OpenHands sandbox hosts. 11 of them ignore the environment entirely and can never pass again; 2 use the dead host only as a fallback. Verified 2026-09-19: `grep -rl all-hands.dev tests/` -> 15 files (13 tests + 2 Python generators) | Hardcoded, no env fallback: `tests/functional/01_homepage.spec.ts:3` and identically `02_`..`10_` (ten files), `tests/e2e_test.spec.ts:3`. Env-fallback to a dead host: `tests/ai-uat/ai-uat.spec.ts:17` (`process.env.E2E_BASE_URL \|\| <dead host>`). **Also `tests/unit/proof-report.test.ts:20`** (was `:11`), used at `:133` - and that file *does* run under `npm test`, now in CI (`ci.yml:41`), green only because `playwright` is mocked (`:1-9`). Re-run 2026-10-18: `grep -rl all-hands.dev tests/` -> the same 15 files. Python: `tests/generate_reports_final.py:13`, `tests/generate_playwright_report.py:24` | Replace with `process.env.BASE_URL ?? 'http://localhost:3000'` in all of them |
| M15-F04 | HIGH | **STILL OPEN (2026-10-18)** - `npm run typecheck` does not type-check the tests or the scripts - `tsconfig.json` excludes both - so ~20k lines of test code and every seeding/migration script are unchecked, and AGENTS.md's "Types Check passes" gate is hollow | `tsconfig.json` `"exclude": ["apps/mobile/**/*", "node_modules", "tests/**/*", "jest.config.ts", "scripts/**/*"]` (2026-10-18; `apps/mobile` added); `package.json:17`; so `ci.yml:38` typechecks neither the 52 unit files nor the migration scripts | Add a `tsconfig.test.json` that includes `tests/**` and `scripts/**`, and run both |
| M15-F05 | HIGH | **STILL OPEN (2026-10-18)** - The "no `any`" rule AGENTS.md is built on is switched off for the entire source tree: `services`, `types`, `hooks`, `scripts`, `app`, `components`, `lib` | `eslint.config.mjs:14-33` - since `6408c1d` the override also covers `tests/**` (`:26-27`) and turns off `no-require-imports` (`:31`); contradicts `AGENTS.md` "Do not use `any` type" | Re-enable as a warning and burn down, or drop the claim from AGENTS.md |
| M15-F06 | HIGH | **STILL OPEN (2026-10-18)** - The admin dashboard reads up to 10,000 `page_views` documents on every load and aggregates them client-side. The `days = 7` parameter is used only to compute `weekAgo`, and `weekAgo` is never referenced again - there is no `where()` on the query - so "last 7 days" is a lie: it always aggregates the most recent 10,000 rows whatever their date | `services/pageviews.service.ts:82` (signature `days = 7`), `:109` (`today` dead), `:110` (`weekAgo` computed, never read - grep for `weekAgo` returns one hit), `:113-119` (query is `orderBy timestamp desc, limit 10000`, no date filter); caller `app/admin/page.tsx:15` (import), `:156` calls `getAnalyticsSummary(30)` - the dashboard asks for 30 days and still gets the newest 10,000 rows; AGENTS.md notes `page_views` ~47k docs vs a 50k/day free-tier read cap | Aggregate on write into `daily_page_stats` and read only those docs |
| M15-F07 | HIGH | **STILL OPEN (2026-10-18)** - A Firebase Web API key and the production host are committed in the Postman collection variables | `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json` -> `variable[].firebaseApiKey` (value present), `baseUrl: https://sri-raghavendra-mutt.vercel.app` | Blank the variable values; ship an environment file separately |
| M15-F08 | HIGH | **FIXED (2026-10-18)** by `9f3cad6` (2026-09-21), which overwrote `REPORT.md` with an unrelated Supabase migration-history report (replaced again by `69d7f2d` on 2026-09-29; verified with `git show <sha>:REPORT.md`); the receipts guards remain in code - `REPORT.md` is a checked-in, undated record of deliberately deleting auth from the admin receipts API and UI. The code has since been restored, so the report now reads as a live instruction to a future agent | `REPORT.md:1-19` vs `app/api/admin/receipts/route.ts:2,21,149`, `app/api/admin/receipts/[id]/route.ts:2,21`, `app/api/admin/receipts/[id]/pdf/route.ts:2,49`, `app/admin/receipts/layout.tsx:4,12` (all guards present) | Delete it, or move it to `docs/history/` with a "REVERTED 2026-xx-xx" banner |
| M15-F09 | MEDIUM | **STILL OPEN (2026-10-18), narrowed** - Effectively zero unit coverage of the application: of 17 `tests/unit` files, 0 import `@/app`, `@/components`, `@/hooks`, `@/utils` or `@/context`, and exactly 1 imports `@/services`. Coverage is collected only from `lib/ai/**`, so the 50% threshold says nothing about 471 files in `app/` + `components/` or 41 services | `jest.config.ts:21-24`. 2026-09-19: verified by grepping every `from "@/..."` under `tests/unit/` - the only `@/services` hits were the three `@/services/proof-report/*` imports in `tests/unit/proof-report.test.ts` (now `:12-16`). 2026-10-18: of 52 unit files, 5 import from `app/`, 5 from `components/`, 2 from `hooks/`, 2 from `services/` - real progress, but coverage is still collected from `lib/ai/**` only | Widen `collectCoverageFrom`; start with the services that carry money (receipts, donations, bookings) |
| M15-F10 | MEDIUM | **STILL OPEN (2026-10-18)** - `tests/unit/ai-analytics.test.ts` is titled "Unit tests for AI Analytics Service" and contains 21 tests, but never imports `services/ai-analytics.service.ts`; it redeclares `TokenRecord`/`LatencyRecord`/`IntentRecord` locally and asserts on its own literals | `tests/unit/ai-analytics.test.ts:1-35` (only import is `@/lib/ai/intent/types`) | Import the real service behind the existing Firebase mock, or delete the file |
| M15-F11 | MEDIUM | **STILL OPEN (2026-10-18)** - 16 spec files - 4 at `tests/` root, 1 under `tests/reports/`, 11 under `tests/functional/` - are never executed by any npm script or workflow. Note the mechanism precisely: because the config never applies (F01), a bare `npx playwright test` from the repo root *would* collect them, and `tests/run_e2e_tests.sh:53` does exactly that for the `all` group - but no `package.json` script and no GitHub workflow ever invokes that shell script, so in practice a third of the suite has no runner | `tests/comprehensive_validation.spec.ts`, `tests/e2e_test.spec.ts`, `tests/kannada-font-validation.spec.ts`, `tests/quick_validation.spec.ts`, `tests/reports/save-reports.spec.ts`, `tests/functional/*.spec.ts` (11); `tests/playwright.config.ts:9`; `package.json:5-31` (no script names them); `tests/run_e2e_tests.sh:53` | Fold into `tests/e2e/` or delete; do not leave a third of the suite unreachable |
| M15-F12 | MEDIUM | **STILL OPEN (2026-10-18)** - **Four** of the five Python report generators hardcode `/workspace/project/Rayaramathaynk/...`; `generate_reports.py` opens such a path at module import, so importing it crashes anywhere but the original sandbox. No `requirements.txt` exists for `openpyxl` / `requests` | `tests/generate_reports.py:15,358,597,672,841,860`; `tests/generate_final_reports.py:94,179,210,272`; `tests/generate_playwright_report.py:96,148,234,364,414,432`; `tests/generate_reports_final.py:94,174,205,302` (missed in the first pass); `find . -name "requirements*.txt"` -> none | Delete the four; keep `generate_test_summary.py` (relative paths) and add a `requirements.txt` |
| M15-F13 | MEDIUM | **STILL OPEN (2026-10-18)** - `tests/generate_playwright_report.py` embeds a specific past run's numbers as literals (total 23, passed 6, failed 17, duration 53.05s, a sandbox URL) and writes them out as a fresh report - a generator of fabricated evidence | `tests/generate_playwright_report.py:14-30` | Delete |
| M15-F14 | MEDIUM | **STILL OPEN (2026-10-18), worse** - Three checked-in artefacts give three different lint results for the same codebase | `reports/LintReport.md` (60 issues / 12 errors) vs `reports/LintExecutiveSummary.md` (98 issues / 3 errors) vs `docs/QUALITY_ASSESSMENT_REPORT.md:224` (39 errors / 347 warnings); since then `REPORT.md` (836 problems / 84 errors, 2026-09-30) and root `lint.txt` / `lint2.txt` (`6408c1d`) - five sources, none current | Regenerate once, keep one artefact, delete the rest |
| M15-F15 | MEDIUM | **STILL OPEN (2026-10-18)** - Five documents state the framework is Next.js 14; `package.json` pins `next: ^16.2.9` with React 19.2.4. Only `reports/TESTING_SUMMARY.md:5` gets it right | `AGENTS.md:213`, `docs/ARCHITECTURE.md:18`, `docs/PROJECT_STRUCTURE.md:5,229`, `docs/QUALITY_ASSESSMENT_REPORT.md:13`, `.openhands/project-context.md:43` vs `package.json` dependencies | Fix the five; a version claim off by two majors invalidates every API recipe below it |
| M15-F16 | MEDIUM | **STILL OPEN (2026-10-18)** - Postman covers **63 of 95** API routes (66%) - **63 of 97 (65%) on 2026-10-18**: the two new routes `/api/ai/health` and `/api/ai/public-settings` are also absent, so 34 are missing - and contains one request for a route that does not exist. Re-counted 2026-09-19 with `:id`/`[id]` parameters normalised on both sides: 81 requests in 25 top-level folders, 64 distinct `/api/...` paths, of which 63 match a `route.ts` and 1 is orphaned. 32 routes are absent - **all 15 quotes routes** (10 public `/api/quotes/*` + 5 `/api/admin/quotes/*`), all 5 receipts routes (4 admin + `/api/public/receipts`), both `receipt-sevas`, both `temple-areas` pairs (4), `ai/knowledge/import`, two `knowledge/workflow` id routes, `revalidate`, `storage/videos`, `supabase-check` | script comparison of `postman/Sri_Raghavendra_Swamy_Matha_API.postman_collection.json` request URLs against all 95 `app/api/**/route.ts` (re-run 2026-10-18 against 97: 81 requests, 64 paths, 63 matched, same orphan); the orphan is `/api/admin/knowledge/approve`, which has no `route.ts` | Regenerate the collection from the route tree |
| M15-F17 | MEDIUM | **STILL OPEN (2026-10-18)** - `docs/DEPLOYMENT.md` and `docs/CHANGELOG.md` are 0 bytes while AGENTS.md declares `docs/` authoritative. There is no deployment runbook anywhere; `docs/SPRINT-5-DEPLOYMENT.md` is a feature doc despite its name | `wc -c docs/CHANGELOG.md docs/DEPLOYMENT.md` -> 0 (still, 2026-10-18; `docs/RUNBOOK-AI-KNOWLEDGE-APPLY.md` and `docs/SUPABASE_MIGRATIONS.md` are the first runbooks, but neither covers the Vercel deploy); `AGENTS.md` "Documentation Authority" | Write the runbook (env vars, Vercel project, secrets, rollback) or delete the stubs |
| M15-F18 | MEDIUM | **STILL OPEN (2026-10-18)** - Lighthouse CI cannot fail meaningfully: both jobs mark the build `continue-on-error: true`, then start a server and audit whatever is (or is not) there. The budget files also set `staticDistDir: ./.next` while the action is handed live URLs - mutually exclusive collection modes | `.github/workflows/lighthouse-ci.yml:46-47`, `:97-99`, `:59-68`, `:111-114`; `lighthouse-budget.json:3-7` | Drop `continue-on-error`; remove `staticDistDir` from the budgets |
| M15-F19 | MEDIUM | **STILL OPEN (2026-10-18)** - Default test credentials for three roles are committed, including passwords | `tests/e2e/sprint3/sprint3-test-utils.ts:5-18` (`admin@test.com` / `TestAdmin123!` etc.) | Require the env vars; fail fast when unset |
| M15-F20 | MEDIUM | **STILL OPEN (2026-10-18)** - The July quality report's P0 SEO item is still open: no sitemap or robots source exists | `docs/QUALITY_ASSESSMENT_REPORT.md:186`; `app/sitemap.ts`, `app/robots.ts`, `public/sitemap.xml`, `public/robots.txt` all absent. `reports/test_results.json` also records Open Graph title/description/image and Canonical URL all failing | Add `app/sitemap.ts` and `app/robots.ts` |
| M15-F21 | MEDIUM | **STILL OPEN (2026-10-18)** - Two exported functions named `getAnalyticsSummary` with different signatures and return shapes; `app/admin/page.tsx` and `app/api/admin/analytics/route.ts` each import a different one | `services/analytics.service.ts:338` vs `services/pageviews.service.ts:82` | Rename to `getTrafficSummary` / `getAiAnalyticsSummary` |
| M15-F22 | MEDIUM | **STILL OPEN (2026-10-18)** - `.github/workflows/ai-uat.yml` defaults `E2E_BASE_URL` to a dead OpenHands sandbox host, so the Playwright job points at a URL that cannot resolve - and the job is `continue-on-error` so it passes anyway | `.github/workflows/ai-uat.yml:26`, `:85` | Default to a preview URL, and drop `continue-on-error` |
| M15-F23 | MEDIUM | **FIXED (2026-10-18)** - `ci.yml` was added by `b13e708` (2026-10-03), but `6408c1d` the same day changed its test step to `npm test || true`, so failing tests did not fail CI until `c479ad4` (2026-10-14) restored `npm test`; the gate has been binding only since 2026-10-14 - No workflow runs `tests/unit` (17 files, ~499 tests), `tests/e2e` (33 files) or `tests/functional` (11 files). The only test command in CI is `npm run test:ai-uat:jest`, which runs one file, and only when `lib/ai/**` changes | 2026-09-19: `.github/workflows/ai-uat.yml:6-17,50`; no other workflow invoked `npm test`. 2026-10-18: `.github/workflows/ci.yml:34-47` runs lint, typecheck, `npm test` (52 unit files + the UAT Jest file) and build on every push/PR to `main`. Still unrun: `tests/e2e`, `tests/functional` (F11) and `tests/automation-loop` (F41) | Add a `test.yml` on push/PR running lint, typecheck and `npm test` |
| M15-F24 | LOW | **STILL OPEN (2026-10-18)** - Dead code in the page-view writer: `sourceField` and `deviceField` are computed and never used, so traffic-source and device breakdowns are never persisted to `daily_page_stats`; `SESSIONS_COLLECTION` and the exported `DailyStats` interface are unused; `where`, `updateDoc`, `Timestamp` are imported and unused | `services/pageviews.service.ts:7,11,21,59-60` | Either write the fields or delete them |
| M15-F25 | LOW | **STILL OPEN (2026-10-18)** - `detectDeviceType` is duplicated verbatim in the tracker component and the service | `components/analytics/PageViewTracker.tsx:38` and `services/pageviews.service.ts:219` | Extract to `lib/` |
| M15-F26 | LOW | **STILL OPEN (2026-10-18), partly fixed** - `fix-websocket.ts` mutates a committed test file in place; its output is already committed, including `(global as any)` inserted *above* the file's docblock, and `any` in `tests/` is not exempted by the ESLint override | `fix-websocket.ts` (deleted by `356de70`); `tests/ai-uat/ai-uat.test.ts:1-2` (shim still there although a `setupFiles` module now exists, `tests/setup/jest.setup.ts`); `tests/**` has been exempt from `no-explicit-any` since `6408c1d` (`eslint.config.mjs:26-27`) | Delete the script; move the shim into a Jest setup file |
| M15-F27 | LOW | **STILL OPEN (2026-10-18), partly fixed** - Throwaway one-line shell wrappers and a fragile runner: `test_plan.sh` is `npm run lint`, `fix_lint.sh` is `npm run lint -- --fix`, and `start-test.sh` relies on `kill %1` job control that does not work in a non-interactive shell | `test_plan.sh` (deleted by `224875d`); `fix_lint.sh` (rewritten by `6408c1d` into an `eslint-disable` injector, F40); `start-test.sh:1-4` (unchanged) | Delete the first two; replace the third with Playwright's `webServer` |
| M15-F28 | LOW | **STILL OPEN (2026-10-18), partly fixed** - `tsconfig.tsbuildinfo` (460 KB) and the whole `reports/` folder (xlsx, lint json, lint-output.txt) are committed; `.gitignore` covers neither | 2026-09-19: `.gitignore` had 47 lines, no `*.tsbuildinfo`, no `reports/`. 2026-10-18: `tsconfig.tsbuildinfo` deleted (`6928864`) and `*.tsbuildinfo` ignored (`.gitignore:48`); `reports/` still committed and unignored, now joined by root `lint.txt`, `lint2.txt`, `lint_files.txt` | Add both to `.gitignore` and remove from the index |
| M15-F29 | LOW | **STILL OPEN (2026-10-18)** - `panchanga.yml`'s comment says "every 2 hours at minute 30" but the cron list is four fixed daily times (06:30, 08:30, 21:30, 23:30 UTC) | `.github/workflows/panchanga.yml:5-9` | Fix the comment or the schedule |
| M15-F30 | LOW | **STILL OPEN (2026-10-18)** - Dependabot ignores every major version bump for every dependency, so Next, React and Firebase majors will never be proposed | `.github/dependabot.yml:8-10` | Narrow the ignore to the packages that genuinely need pinning |
| M15-F31 | LOW | **STILL OPEN (2026-10-18)** - `docs/ROADMAP.md` deprecates files that do not exist and lists shipped features as unbuilt | `docs/ROADMAP.md:236-238` names `lib/legacy-api.ts` and `lib/api/v2.ts` (neither on disk); `:106` lists "Analytics Dashboard 📋" though `app/api/admin/analytics/route.ts` exists; `:128` lists "Testimonials 📋" though `app/api/testimonials/route.ts` and `components/home/Testimonials.tsx` exist. `:17` says v1.0 completed January 2025, `:180` says 2025 Q4 | Rewrite from the code |
| M15-F32 | LOW | **STILL OPEN (2026-10-18)** - `FIRESTORE_IMPORT.md` tells the reader to run `npm run export:aaradhane`, which is not a script | `FIRESTORE_IMPORT.md:6-8` vs `package.json` scripts | Fix or remove |
| M15-F33 | LOW | **STILL OPEN (2026-10-18)** - `AARADHANE_GENERATOR.md` exists twice with different content - 250 lines at the root, 376 in `docs/` | `AARADHANE_GENERATOR.md`, `docs/AARADHANE_GENERATOR.md` (`diff` reports they differ) | Keep the `docs/` copy, delete the root one |
| M15-F34 | LOW | **STILL OPEN (2026-10-18)** - E2E assertions are frequently guarded by `if (count > 0)`, so a missing feature yields a green test. Worst offender: `tests/e2e/chatbot/chatbot.spec.ts` has 29 such guards across 20 tests | `grep -c "count() > 0"` vs `grep -c "^\s*test("` per file, re-run 2026-09-19: chatbot 29/20, sprint4/admin-expanded **25**/31, sprint3/admin-crud 16/34 | Assert presence explicitly, then assert behaviour |
| M15-F35 | LOW | **STILL OPEN (2026-10-18)** - `.deployment-trigger` is a 0-byte file with no reference anywhere in the repo | `ls -la` root; no grep hit outside the inventory | Document it in the (missing) deployment runbook or delete it |
| M15-F36 | LOW | **STILL OPEN (2026-10-18)** - `docs/AI_ASSISTANT.md` carries **no date stamp at all** - it is the one `docs/` file with neither a "Last Updated" line nor any date in its prose, so its currency cannot be judged. (Corrected on verification: the earlier claim that it was "stamped 2024-01-01" was wrong - that string is a sample payload value inside an API-response example) | `docs/AI_ASSISTANT.md:1-6` (no stamp in the header), `:324` `"lastChecked": "2024-01-01T00:00:00Z"` is inside a fenced JSON example, `:101` `claude-3-haiku-20240307` is a model id | Add a "Last Updated" line, or fold it into `docs/RAYA_AI_ARCHITECTURE.md` |
| M15-F37 | LOW | **STILL OPEN (2026-10-18)** - `tests/quick_validation.sh` defaults to port 3456 while everything else in the repo uses 3000 | `tests/quick_validation.sh:7` vs 12 occurrences of `localhost:3000` across `tests/` | Align the default |
| M15-F38 | MEDIUM | **NOT REPRODUCED (2026-10-18) - treat as closed** - The only test command CI runs may not compile. `fix-websocket.ts` injected `import WebSocket from "ws"` as line 1 of `tests/ai-uat/ai-uat.test.ts`. `ws` is present as a devDependency but **`@types/ws` is in neither `package.json` nor `package-lock.json`**, and `ws` ships no bundled declarations. ts-jest resolves `compilerOptions` from the root `tsconfig.json`, which sets `"strict": true` (hence `noImplicitAny`); the `transform` override in `jest.config.ts:11-17` sets only `jsx`/`esModuleInterop`/`allowSyntheticDefaultImports` and does not relax it. That combination raises TS7016 on an untyped module, which would fail `npm run test:ai-uat:jest` - the single test step in `.github/workflows/ai-uat.yml:50` | `tests/ai-uat/ai-uat.test.ts:1`; `package.json:97` (`"ws": "^8.21.3"` in devDependencies); `grep -n "@types/ws" package.json package-lock.json` -> no hit; `tsconfig.json` `"strict": true`; `jest.config.ts:11-17` | Add `@types/ws`, or move the shim into a `setupFiles` module with a local `.d.ts`. **Not executed** - static inference. 2026-10-18: not borne out, and the code explains why: the root `tsconfig.json` sets `"isolatedModules": true` and `ts-jest` is `^29.4.14` (`package.json:126`), a version that compiles per file (transpile-only) when that flag is set, so TS7016 is never raised. The CI success recorded at `docs/AI_SETTINGS_HEALTH_VERIFICATION_PLAN.md:136` is consistent with this but is a doc claim, not evidence; nothing was run. `@types/ws` is still absent; adding it remains good hygiene |
| M15-F39 | MEDIUM | **NEW (2026-10-18)** - Unit assertions were weakened until they cannot fail, so part of the newly green `npm test` proves nothing: four Panchanga date checks are `expect(dates.length).toBeGreaterThanOrEqual(0)`; five response-generator content checks became `toBeDefined()`; out-of-scope tests in two suites now accept `TEMPLE_TIMINGS` / `DAILY_QUOTE` / `GENERAL_GREETING` for "Write me a Python function" and "Is it raining today?"; the Guru lunar-month check accepts either transliteration list | `tests/unit/aaradhane/panchanga.test.ts:113,137,166,179` (three by `2891323`, 2026-10-14); `tests/unit/response-generator.test.ts:184,206,253,275,317` (`356de70`, 2026-09-19 - just after the snapshot) and `:298,305` (`ef7bb72`, BOT-005, 2026-10-15); `tests/ai-uat/ai-uat.test.ts:414` (`f5582d2`, 2026-09-19) and `:419` (`3446b0b`, 2026-10-14) - per `git blame`; `tests/unit/aaradhane/gurus.test.ts:43` (`2891323`); `docs/PR_325_FINAL_CORRECTIVE_REVISION.md:8` admits the same pattern for the intent tests, which were then re-tightened (`tests/unit/intent.test.ts:101,188,207,214`) | Restore the original expectations; where behaviour genuinely changed, assert the new exact value; reject `>= 0` and bare `toBeDefined()` on response content in review |
| M15-F40 | MEDIUM | **NEW (2026-10-18)** - CI's lint step was made green by silencing, not fixing: `6408c1d` (2026-10-03, authored by `google-labs-jules[bot]`) prepended a file-wide `/* eslint-disable */` to 35 files and rewrote `fix_lint.sh` to inject the same header. The 836 problems / 84 errors recorded in `REPORT.md` on 2026-09-30 are hidden, not paid | `grep -rln "^/\* eslint-disable \*/" app components lib services hooks context utils tests` -> 35 files on 2026-10-18 (12 `app/`, 15 `components/`, 5 `lib/`, 1 `context/`, 1 `hooks/`, 1 `tests/`) vs 0 in the 2026-09-19 snapshot; `fix_lint.sh:1-10`; `git show 6408c1d --stat`. The same commit also changed `ci.yml`'s test step to `npm test || true` (undone by `c479ad4`, 2026-10-14) and raised `IntentPriority.PANCHANGA` from 75 to 76 in `lib/ai/intent/types.ts` - a product change made to get tests through (`git show 6408c1d -- .github/workflows/ci.yml lib/ai/intent/types.ts`) | Replace each blanket header with line-level disables that carry a reason; delete `fix_lint.sh`; add `--max-warnings` to `npm run lint` |
| M15-F41 | MEDIUM | **NEW (2026-10-18)** - The AI loop's own tests cannot run: both `tests/automation-loop/*.test.ts` (115 tests, ~2,000 lines) import `vitest`, which is in no dependency list (`package-lock.json` mentions it only as an optional peer of another package), Jest's `testMatch` does not reach the folder, and no workflow runs them. `ai-loop-validate.yml`'s path filters name `tests/unit/ai-loop/**`, `docs/ai-development-loop.md` and `.openhands/skills/**`, none of which exist; `docs/BOT_003_CHAT_MIGRATION_REPORT.md:70` nevertheless reports a successful `npx vitest run tests/automation-loop/` | `tests/automation-loop/loop-scripts.test.ts:6`; `package.json:101-131` (devDependencies, no `vitest`); `jest.config.ts:9`; `.github/workflows/ai-loop-validate.yml:13-28` | Add `vitest` as a devDependency plus a `test:loop` script that `ai-loop-validate.yml` runs, or port the two files to Jest; fix the three dead path filters |
| M15-F42 | MEDIUM | **NEW (2026-10-18)** - A full production Firestore dump is uploaded as a GitHub Actions artifact, downloadable for 7 days by anyone with read access to the repository's Actions. The dumper excludes only the auth-owned collections, so donation, seva-booking and other devotee records are in it | `.github/workflows/firestore-production-export.yml:61` (dump), `:228-236` (`upload-artifact`, `retention-days: 7`); `scripts/dump-firestore-live.ts:217` (`EXCLUDED = users, profiles, bookmarks, sessions`) | Encrypt the artifact or write it to a private bucket; cut retention to 1 day; restrict who may dispatch the workflow |
| M15-F43 | LOW | **NEW (2026-10-18)** - `tests/setup/jest.setup.ts` `require`s `undici`, which is not a declared dependency (present only transitively, `package-lock.json:25798`), and the whole suite now runs under `jest-environment-jsdom` although most unit files are node-only (fs, child_process, scripts) - a dependency bump can silently remove `undici`, and the node tests pay jsdom's start-up cost | `tests/setup/jest.setup.ts:21`; `jest.config.ts:5,10`; no `undici` in `package.json` | Declare `undici` (or rely on Node 22's global `fetch`); set `testEnvironment: "node"` and mark the six `.tsx` tests with a `@jest-environment jsdom` docblock |
| M15-F44 | LOW | **NEW (2026-10-18)** - Root reports are overwritten rather than appended: `REPORT.md`, `COMPLETION_REPORT.md` and `final_report.txt` were each replaced by a later agent run, so each records only the most recent task and the earlier record is reachable only through git. 25 more unowned root files arrived since 2026-09-19 (agent reports, `PR_BODY.md`, `pr_description.md`, `plan.md`, `result.md`, ~246 KB of lint dumps, a `.patch` file, `request_test.mjs`) | `9f3cad6` then `69d7f2d` (`REPORT.md`), `7ec2af7`, `051c530` then `0cb71b6` (`COMPLETION_REPORT.md`, three overwrites on 2026-09-29/30), `fae5d51` (`final_report.txt`); the `unowned` list in `.claude/state/delta/2026-10-18/delta.json` | Write agent reports to `docs/history/<date>-<task>.md` and never overwrite; delete scratch files; add a root-file allowlist check to CI |
| M15-F45 | LOW | **NEW (2026-10-18)** - Docs written in the last four weeks are already stale or empty: `docs/RAYA_AI_ARCHITECTURE.md` says the knowledge repository still uses Firestore; `BLOCKED_REPORT.md` still says the migration is blocked; `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` is one heading; `COMPLETION_REPORT.md` calls the mobile app production-ready while `docs/MOBILE_COMPLETION_MATRIX.md` lists 13 rows MISSING | `docs/RAYA_AI_ARCHITECTURE.md:41` vs `lib/ai/knowledge/repository.ts:4-5`; `BLOCKED_REPORT.md:1-12` vs `docs/PHASE_1_MIGRATION_VALIDATION_ANALYSIS.md`; `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md:1`; `COMPLETION_REPORT.md:6-7` vs `docs/MOBILE_COMPLETION_MATRIX.md` | Treat agent reports as history (F44); keep the living docs (`docs/DEVELOPMENT_AUTOMATION.md`, `docs/PRISMA-SCHEMA-BASELINE.md`, `docs/RUNBOOK-AI-KNOWLEDGE-APPLY.md`, `docs/SUPABASE_MIGRATIONS.md`) under review whenever their code changes |
| M15-F46 | MEDIUM | **NEW (2026-10-18, verification)** - The daily Panchanga commit never triggers this repo's deploy or CI. `panchanga.yml` pushes with the default `GITHUB_TOKEN`, and GitHub starts no `on: push` workflow for such pushes, so `deploy.yml` and `ci.yml` do not run for the up-to-four-a-day `chore: update daily panchanga` commits (e.g. `424fdb8`, `3f9582c`, `5dd7f19`, all by `github-actions[bot]`). Either Vercel's Git integration deploys them - a second deploy path that bypasses CI and makes F02 worse - or `public/data/panchanga/current.json` reaches production only on the next human push | `.github/workflows/panchanga.yml:20-25` (checkout, no token), `:47-50` (`git push`), `:51` (`echo "✓ Vercel will automatically deploy the changes"`); `.github/workflows/deploy.yml:6-9`; `vercel.json` (no `git` block); `git log -3 -- public/data/panchanga/current.json` | Decide on one deploy path. If `deploy.yml` is it, push with a PAT or GitHub App token, or add a `workflow_run` trigger on the Panchanga workflow to `deploy.yml`; if Vercel Git is it, delete `deploy.yml` and make CI a required check on `main` |
| M15-F47 | LOW | **NEW (2026-10-18, verification)** - The merge-gate run summary claims a merge that does not happen. `merge-gate.mjs` exits 0 both when it arms a merge and when every gate passed but `autoMerge` is off; the workflow then prints "Every automated gate passed. The merge was armed (or performed)." for status 0, although with `autoMerge: false` nothing was armed | `.ai/scripts/merge-gate.mjs:222-224` (exit 0, "auto-merge is disabled by configuration"); `.github/workflows/ai-loop-merge-gate.yml:90`; `.ai/loop.config.json:54` (`"autoMerge": false`) | Give "passed, auto-merge disabled" its own exit code and message |
| M15-F48 | LOW | **NEW (2026-10-18, verification)** - `supabase-migrations.yml` pushes every pending migration to the production database in the same job, straight after the dry-run, with no confirmation input and no chance to read the dry-run first - unlike the two Prisma workflows, which demand a typed phrase. Its Supabase CLI is pinned to `1.200.0` | `.github/workflows/supabase-migrations.yml` (`on: workflow_dispatch` with no inputs; step "Run Supabase migration dry-run" then "Apply Supabase migrations"; `setup-cli` `version: '1.200.0'`) vs `.github/workflows/resolve-raya-ai-baseline.yml:37-40` | Split dry-run and push into two jobs with a GitHub environment approval between them, or require a typed confirmation input |

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
| `tests/unit/**` (52 files; 17 on 2026-09-19) | Jest + ts-jest, now `jest-environment-jsdom`; the 6 `.tsx` files use React Testing Library with `next/image` / `framer-motion`; route and action tests use `next/server` / `next/headers` | **reuse** the node-only files (lib, scripts, types) as-is; **rewrite** the 6 component tests with RNTL; route/action tests stay server-side | The original 17 still test `lib/ai`, `lib/receipt`, `lib/aaradhane` and types and run unchanged under `jest-expo` |
| `.github/workflows/ci.yml`, `ai-loop-*.yml`, the data workflows | GitHub Actions only | **reuse as-is** | Platform-neutral - but none of them builds, lints or tests `apps/mobile` today |
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

**`apps/mobile` and this module (2026-10-18).** The Expo app added by `0cb71b6` (2026-09-30) consumes
nothing from M15: `grep -rn "analytics|pageview|page_views|tests/" apps/mobile` (sources, `node_modules`
excluded) finds no import of the analytics services, the tracker, the Postman collection or any test
helper; `apps/mobile` has no test files; and no workflow `cd`s into it - the root `tsconfig.json` now
explicitly excludes `apps/mobile/**/*`, so `ci.yml`'s typecheck skips it too. Item 5 above (a mobile
pipeline sharing one test workflow) is still undone; `apps/mobile/lib/api.ts:1-4` reads Supabase
directly, so the server-side analytics endpoint of item 1 would be its first M15 dependency.

## Coverage

filesExpected 242, filesMentioned 242, omitted: none (2026-10-18, from today's `.claude/state/inventory/M15.json`;
checked by script - every inventory path occurs verbatim in this file). On 2026-09-19 it was 144 / 144.
The 242 are the 144 of 2026-09-19, minus `test_plan.sh` and `fix-websocket.ts`, plus the 93 delta
additions, plus 7 knowledge-base files under `docs/overview/` and `docs/rearchitecture/` that the
regenerated inventory now assigns to this chunk.

2026-10-18 refresh reading: every modified file was diffed against the snapshot; every added workflow
was read for triggers, secrets and commands (`ci.yml`, `deploy.yml`, the merge gate's decision step
and the production-export artifact step in full); every added test file was profiled (lines, test
count, first `describe`, imports) and the six weakened suites diffed line by line; every added doc was
profiled (lines, first heading, dates) and the short ones read whole. The 2026-09-19 text below is
kept as it was.

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

**Added 2026-10-18:**

- **Whether the CI success in `docs/AI_SETTINGS_HEALTH_VERIFICATION_PLAN.md:136` is current.** It names
  commits `deb1d29`, `795b06b`, `b705f1b`; `node_modules` is absent here, so nothing was run. Settled by
  the Actions tab for HEAD `424fdb8`.
- **Whether the GitHub repository and its Actions artifacts are public.** F42's severity depends on it.
  Settled by the repository's visibility setting.
- **Why ts-jest does not raise TS7016 on `import WebSocket from "ws"`** (F38). The `isolatedModules`
  explanation is an inference from the root `tsconfig.json`, not a run.
- **Whether Vercel's own Git integration also deploys `main`** in addition to `deploy.yml`. If it does,
  F02 has two ungated paths. `vercel.json` sets no `git.deploymentEnabled`, so nothing in the repo turns it off, and `panchanga.yml`'s push step assumes it is on (F46). Settled by the Vercel project settings.

**From 2026-09-19 (annotated 2026-10-18 where the answer changed):**

- *(2026-10-18: largely settled - this is now a git clone, `ci.yml` exists and a CI success is recorded
  at `docs/AI_SETTINGS_HEALTH_VERIFICATION_PLAN.md:136`; see the new UNCLEAR above.)*
  **Whether CI has ever been green.** This is not a git repository in this workspace, so there is no
  history, no branch list and no Actions run log. Everything in the *Project history* section is
  reconstructed from checked-in artefacts, whose own dates disagree. Settled by opening the GitHub
  repository named in `.openhands/project-context.md` and reading the Actions tab.
- *(2026-10-18: CI runs it at `ci.yml:35` and reports green - after `6408c1d` silenced 35 files, F40.)*
  **Whether `npm run lint` currently passes.** `node_modules` is absent and must stay absent, so the
  lint could not be run. Static reading says `tests/ai-uat/ai-uat.test.ts:2` uses `any` in a folder the
  ESLint override does not exempt, which suggests at least one error. Settled by `npm ci && npm run lint`.
- **Which production URL is real** - `docs/API.md` says `rayaramathaynk.vercel.app`, the Postman
  collection says `sri-raghavendra-mutt.vercel.app`. Settled by the Vercel project settings.
- **Whether `tests/functional/*` and the root specs were once passing** against the sandbox hosts, or
  were written blind. The hardcoded hosts are unreachable now, so it cannot be tested.
- *(2026-10-18: the AI loop switched its implementer from OpenHands to Jules on 2026-10-04, `d8e7969`;
  yet `c156d6c` on 2026-10-16 is still authored by `openhands`, and `.openhands/` is unchanged.)*
  **Whether the `.openhands` and `.continue` toolchains are still in use** by the team, or are residue
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

## Refresh log (2026-10-18)

Refreshed by the M15 refresh agent on 2026-10-18 (Sunday) against HEAD `424fdb8`. Delta: 93 added,
2 deleted, 22 modified (`perModule.M15` in `.claude/state/delta/2026-10-18/delta.json`). Format:
what was true -> what is true now -> evidence.

**Corrected claims**

1. 5 workflows -> 22 (ci, 6 ai-loop, 11 dispatch-only data/Prisma ops added) -> `ls .github/workflows` (Purpose, Code roots, Entry points, CI/CD table, Flows G-H).
2. No workflow runs lint/typecheck/`npm test` -> `ci.yml` runs all three plus boundary check and build on push/PR to `main` -> `.github/workflows/ci.yml:34-47`, added `b13e708` (F23 FIXED).
3. `deploy.yml` lines `:3-6`, `:15-36` -> `:6-9`, `:18-39`; top-level `permissions` added -> `cat -n .github/workflows/deploy.yml` (Entry points, Flow C, F02).
4. `package.json` 100 lines / 25 scripts -> 132 lines / 49 scripts; build/lint/typecheck/test/coverage/UAT/dump at `:14/:16/:17/:18/:20/:25-28/:33` -> `cat -n package.json`.
5. Jest env `node`, `.ts` only, no setup -> `jest-environment-jsdom` (`:5`), `.test.tsx` matched (`:9`), `setupFiles` (`:10`); coverage block `:20-23` -> `:21-24` -> `cat -n jest.config.ts`.
6. 17 unit files / ~499 tests -> 52 / ~834 -> `find tests/unit` + `it(`/`test(` count; 35 rows added to the unit table, 2 rows for `tests/automation-loop/`, 1 for `tests/setup/jest.setup.ts`.
7. Unit rows for intent, multi-source-retrieval, response-generator, knowledge, quote.service, gurus, panchanga, proof-report updated (line counts, mocks, weakened or re-tightened assertions) -> `diff` against the snapshot.
8. AI UAT Jest mocks at `:48,54,159` -> `:21,27,38,73,79,184`; generator import `:17` -> `:18`; `run-uat-tests.ts` import `:20` -> `:21` -> `grep -n jest.mock tests/ai-uat/ai-uat.test.ts`.
9. `lib/ai/generator.ts:42` -> `:8` (call at `:73`) -> `grep -n logUnknownQuestion lib/ai/generator.ts` (Flow B, Cross-module).
10. `proxy.ts:105-111` page-view writer -> `proxy.ts:57-75` -> `grep -n page_views proxy.ts`.
11. `tests/unit/proof-report.test.ts:3-7,11,124` -> `:12-16,20,133` -> `grep -n` (F03, F09, Cross-module).
12. `test_plan.sh`, `fix-websocket.ts` listed as live debris -> struck, deleted by `224875d` and `356de70`.
13. `fix_lint.sh` = `npm run lint -- --fix` -> an `eslint-disable` injector -> `fix_lint.sh:1-10`, `6408c1d`.
14. `eslint.config.mjs:18-34`, no `tests/**` exemption -> `:14-33`, `tests/**` exempt, `no-require-imports` off -> `cat -n eslint.config.mjs` (F05, F26).
15. `tsconfig.json` exclude list -> now also `apps/mobile/**/*` -> `tsconfig.json` (Entry points, F04).
16. `.gitignore` 47 lines, no `*.tsbuildinfo`, `tsconfig.tsbuildinfo` committed -> `*.tsbuildinfo` at `:48`, artefact deleted -> `6928864` (F28).
17. `REPORT.md` = receipts-auth removal -> Phase 2 Batch 1 migration blockers -> `9f3cad6` then `69d7f2d` (F08 FIXED, root reports table; corrected on verification, was `14d71c0`).
18. `COMPLETION_REPORT.md` = receipts Create tab -> mobile "production-ready" claim -> `0cb71b6`.
19. `final_report.txt` = Firestore health audit -> BOT-001 summary -> `fae5d51`; audit findings re-verified in code (`services/pooja.service.ts:16`, `firestore.rules:76`, `hooks/useDonationNotifications.ts:75`).
20. `BLOCKED_REPORT.md` "still true" -> stale; migration ran through CI -> `docs/PHASE_1_MIGRATION_VALIDATION_ANALYSIS.md`, `c46c706`.
21. `docs/RAYA_AI_ARCHITECTURE.md` 690 lines current-ish -> 43 lines, stale -> `:41` vs `lib/ai/knowledge/repository.ts:4-5`.
22. `docs/FIRESTORE_MIGRATION.md` aspirational -> current-ish (161 lines); `docs/SUPABASE_DATABASE_SCHEMA.md` proposal -> partially aligned (438 lines) -> `diff` against the snapshot.
23. `docs/` 27 files -> 72; 45 new rows in the docs health section -> `find docs -type f`.
24. Postman 63 of 95 routes, 32 missing -> 63 of 97, 34 missing (`/api/ai/health`, `/api/ai/public-settings` new) -> route comparison script (F16, recipe 8).
25. `.env.example` -> adds commented `PRISMA_DATABASE_URL` (`:58-63`).
26. Timeline extended with 15 dated rows 2026-09-19 .. 2026-10-18; ages note (+29 days, computed); planned-vs-built updated (Supabase migration landed; DEVELOPMENT_PLAN vs loop output).
27. Recipe 3 rewritten (gate exists, deploy does not wait); recipe 4 line refs and `.tsx`/`server-only` advice; recipe 8 count; recipe 9 added (AI loop task).
28. Portability: `tests/unit/**` row updated; CI row added; `apps/mobile` paragraph added - it consumes nothing from M15.
29. Coverage 144/144 -> 242/242.

**Fault statuses:** FIXED F08 (`9f3cad6`; the refresh first named `14d71c0` - corrected on verification), F23 (`b13e708`, binding only since `c479ad4`). NOT REPRODUCED F38 (CI runs the file and is green). STILL OPEN F01-F07, F09-F22, F24-F37 (35 rows; F09 narrowed, F14 worse, F26/F27/F28 partly fixed). NEW F39-F45.

**Commits behind the biggest changes:** `b13e708` (AI loop + `ci.yml`), `6408c1d` (lint silenced, `fix_lint.sh` rewritten), `c46c706` / `21c9418` / `8d1ac28` (migration and export workflows), `fae5d51` / `fdaff98` / `224875d` / `4de808e` (BOT-001..004 to Supabase), `2891323` and the BOT-005 series `498b672`..`ed9595a` (test weakening), `2e8f0b1` / `8056265` / `623f015` (Prisma), `c156d6c` (red checks cleared), `0cb71b6` (mobile app, `tsconfig` exclude), `3d6aa9d` (knowledge-base docs).

**Path check (script, 2026-10-18):** 523 backticked path-like tokens extracted; all resolve except
(a) paths described as absent on purpose - `app/sitemap.ts`, `app/robots.ts`, `public/sitemap.xml`,
`public/robots.txt`, `lib/legacy-api.ts`, `lib/api/v2.ts`, `tests/tests/`, root `playwright.config.ts`,
`requirements.txt`, `docs/ai-development-loop.md`, the deleted `test_plan.sh` / `fix-websocket.ts`, and the
proposed `tsconfig.test.json`, `test.yml`, `docs/history/`; (b) runtime outputs and config values -
`reports/playwright-test-results.json`, `data/firestore-export/`, `data/firestore-dump/`, the sandbox
path `/workspace/project/...`, `'./tests/e2e'`, `'./e2e'`, `scripts/.github/` (former location); (c) URL
paths (`/api/...`), route-name fragments (`route.ts`, `[id]/route.ts`, `storage/videos`), bare extensions, a repo URL and a branch name; (d) bare file names used as shorthand, each verified
to resolve uniquely - workflow names under `.github/workflows/`, test names under `tests/unit/` or
`tests/unit/components/festival/`, `run-uat-tests.ts` / `generate-report.ts` under `tests/ai-uat/`, the
Python generators under `tests/`, and `analytics.service.ts` / `pageviews.service.ts` under `services/`.
The 2026-09-19 *Verification log* above is left as written; its line numbers describe the snapshot.

**UNCLEAR:** see the four 2026-10-18 entries at the top of *UNCLEAR*. Also: the unowned `.ai/` folder
(34 files) and 25 new root files are described here but not owned by any chunk.

## Verification log (2026-10-18)

Skeptic pass over the 2026-10-18 refresh, by the M15 verifier on 2026-10-18 (Sunday), code at `424fdb8`
(HEAD `43361a3` adds docs only). 704 path-like tokens checked by script: 0 broken (the 52 unresolved
tokens are npm package names, bare extensions, URL fragments, runner-side files or paths described as
absent on purpose); no cited line number lies past the end of its file. 36 claims re-opened, all 45
fault rows re-evidenced, inventory 242/242 mentioned. Full report: `.claude/state/verify/M15-2026-10-18.md`.
Format: what was wrong -> what it says now -> evidence.

- "six `ai-loop-*` workflows" (5 places) -> five -> `ls .github/workflows/ai-loop-*` lists implement, merge-gate, next-task, review, validate; 6 + 5 + 11 = 22.
- F08 fixed "by `14d71c0` (2026-09-29)" (answers bullet, timeline, root reports, F08, F44, refresh log) -> by `9f3cad6` (2026-09-21); the Phase 2 text came from `69d7f2d` -> `git log -- REPORT.md`, `git show 9f3cad6:REPORT.md`, `git show 69d7f2d:REPORT.md`.
- `COMPLETION_REPORT.md` "overwritten by `0cb71b6`" -> overwritten three times, `7ec2af7`, `051c530` (2026-09-29), `0cb71b6` (2026-09-30) -> `git log -- COMPLETION_REPORT.md` (timeline, F44).
- F23 "FIXED by `b13e708`" -> `ci.yml` added by `b13e708`, but its test step was `npm test || true` from `6408c1d` until `c479ad4` (2026-10-14) -> `git show 6408c1d -- .github/workflows/ci.yml`, `git show c479ad4 -- .github/workflows/ci.yml`.
- F40 evidence lacked the `npm test || true` change and the `IntentPriority.PANCHANGA` 75 -> 76 product edit made in the same commit -> added -> `git show 6408c1d -- lib/ai/intent/types.ts`.
- F39 attributed the five `toBeDefined()` lines to "BOT-004/BOT-005 commits, 2026-10-14/15" and `ai-uat.test.ts:414,419` to `3446b0b` -> `356de70` (2026-09-19) for the five, `ef7bb72` for `:298,305`, `f5582d2` for `:414`, `3446b0b` for `:419` -> `git blame -L`.
- F38's closure rested on a doc's CI-success line -> now rests on code: `tsconfig.json` `isolatedModules: true` + `ts-jest ^29.4.14` (`package.json:126`); still not executed.
- `docs/BOT_003_CHAT_MIGRATION_REPORT.md:70` called "false", and the answers bullet said the loop tests "cannot" run -> unverifiable; `npx vitest` fetches vitest ad hoc, but nothing in the repo or CI does so -> `package.json` has no `vitest`; no workflow mentions `automation-loop`.
- `docs/API.md` "3 of 95" -> 3 of 97 (95 on 2026-09-19) -> `find app/api -name route.ts | wc -l` = 97.
- Flow D step 4 "Vercel redeploys on the push" -> the `GITHUB_TOKEN` push starts neither `deploy.yml` nor `ci.yml`; only Vercel's Git integration could deploy it -> `panchanga.yml:20-51`; new **F46**.
- F06 named only the import line for the caller -> adds `app/admin/page.tsx:156` `getAnalyticsSummary(30)`.
- Recipe 9 listed two of the five `ai-loop-validate.yml` checks -> all five -> `.github/workflows/ai-loop-validate.yml:50-63`.
- Answers bullet "all 27 `docs/` files" -> 72 (27 + 45) -> `find docs -type f | wc -l`.
- UNCLEAR on Vercel Git deploys: added that `vercel.json` has no `git` block and `panchanga.yml:51` assumes Git deploys are on.
- New **M15-F46** (MEDIUM, Panchanga commits bypass `deploy.yml`/`ci.yml`), **M15-F47** (LOW, merge-gate summary claims a merge with `autoMerge: false`), **M15-F48** (LOW, `supabase-migrations.yml` pushes to production with no confirmation).
