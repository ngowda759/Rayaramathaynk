# User memory

### Raya AI Supabase password recovery (PR #350, 2026-10-21)

- **"Invalid email or password" on `/admin/ai/login` was most likely a config gap, not a bad
  password.** `lib/supabase/client.ts` falls back to `https://placeholder.supabase.co` + `"placeholder"`
  when `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, so a deployment missing
  them fails at sign-in *identically* to a wrong password. Login now maps each failure
  (`lib/auth/raya-auth-errors.ts`); never collapse config/transport errors into a credential error.
- **A Supabase recovery link has three shapes and the browser client auto-redeems two of them during
  initialization** (`?code=` PKCE and `#access_token=`, which also emits `PASSWORD_RECOVERY`).
  `getSession()` awaits that init, so await it *before* any `exchangeCodeForSession` — an
  unconditional exchange double-consumes a single-use code. `?token_hash=` is the only one needing
  `verifyOtp({type:"recovery"})`.
- **A reset link landing on the homepage means the `redirectTo` origin is not on Authentication →
  URL Configuration → Redirect URLs** — Supabase falls back to Site URL. Dashboard-only fix; see
  `docs/RAYA_AI_PASSWORD_RECOVERY.md`.
- `AdminAuthGuard` must exempt all three `/admin/ai/{login,forgot-password,reset-password}` via
  `isRayaAiPublicAuthPath` (`lib/auth/raya-auth-routes.ts`); gating the reset page drops the credential.
- **`components/ui/input.tsx` default variant now wires `htmlFor`/`id`** (`props.id ?? useId()`); it did
  not before, so `getByLabelText` failed on it.
- **Next 16 lint error:** `setState` synchronously inside `useEffect` is an error. A `useCallback`
  called from an effect that `setState`s before its first `await` trips it — put the `await` first and
  try/catch inside the callback, then `void fn()` from the effect.
- Details: `.openhands/memory/2026-10-21.md`.

### Production Supabase schema verification for PR #349 (2026-10-20)

- **The sandbox `SUPABASE_DB_URL`/`SUPABASE_DB_PASSWORD` point at the WRONG project** — a Tournament DB
  (`courts, matches, players, teams, tournament_*`, 14 public tables, **no `users`**), not the temple.
  The temple project ref is 20 chars and has 45 public tables. You cannot inspect the temple DB from the
  sandbox; its credentials exist **only as GitHub Actions secrets**.
- **The sanctioned read-only production path is two `workflow_dispatch` workflows** (both documented as
  never writing): `.github/workflows/diagnose-supabase-connectivity.yml` (REST + Auth + raw PG probe) and
  `.github/workflows/prisma-baseline-drift-gate.yml` (`mode: catalog|scoped|drift`). Dispatch with
  `GITHUB_PERSONAL_ACCESS_TOKEN` (has `workflow` scope) via
  `POST /repos/{o}/{r}/actions/workflows/{id}/dispatches` with `{"ref":"<branch>","inputs":{...}}`;
  read output by downloading `/actions/runs/{id}/logs` (zip; `unzip` is absent — use python `zipfile`).
  The drift gate is the only tool that compares `prisma/schema.prisma` to the **real** target DB.
- **`mode: catalog` + `tables: users` dumps real production `public.users`**: columns are exactly
  `id, firestore_id, email, display_name, phone_number, photo_url, role, active, created_at, updated_at`
  — **no `auth_user_id`**. Constraints are only `users_pkey` + `users_firestore_id_key`; there is
  **no unique constraint on `email`** (confirms the bootstrap's caution empirically).
- **Scoped drift proves the expected delta**: on `main` it is PASS (production == main schema); on the
  PR branch it is FAIL with exactly `changed tables (1): users`. So the migration is the *only* in-scope
  change and is genuinely unapplied. Also: 36 out-of-scope tables differ by design.
- **BLOCKER — the migration is out of order.** `20261022000000` is older than 8 already-applied
  migrations (max applied `20261102000300`). The repo applies with a bare `supabase db push`
  (`npm run supabase:migrations:push`), and the CLI **refuses out-of-order files** ("inserted before the
  last migration on remote database … rerun with `--include-all`"). Fix by renumbering the file to
  `> 20261102000300` (e.g. `20261103000000_…`) — the migration is unapplied everywhere so a rename is
  safe. Adding `--include-all` would change automation and is out of scope without approval.
- **`auth.users` is empty in production** (Auth admin API returned 0 users), and the temple has 0
  Supabase Auth users — so the bootstrap will *create* the first admin. `public.users` rows are legacy
  Firebase-era rows, so linking one needs `RAYA_ADMIN_LINK_LEGACY_EMAIL=1`. The bootstrap also **cannot
  run before the migration** (it queries `auth_user_id`).
- **RLS and row-level data cannot be inspected with sanctioned tooling** — no workflow accepts arbitrary
  SQL (`psql` appears only in `seva-backup.yml`/`seva-maintenance.yml`), and the catalog dumper covers
  columns/constraints/indexes/triggers but **not `pg_policies`**. Those checks need operator-run queries.
- `supabase/config.toml` sets `major_version = 15` while production is **PostgreSQL 17.6** — local dev
  stack differs from prod; harmless for this migration (uuid + partial index + FK are version-stable).


### PR #349 hardening round (2026-10-20, commit 68427d9)

- **`public.users.email` is NOT NULL but NOT unique** (verified on `postgres:16-alpine` built from the
  repo's own migrations — two rows with the same email insert fine). Any code that matches a user by
  email must treat it as a hint, never as identity.
- **The `auth_user_id` migration semantics were verified empirically**, not by reading SQL: nullable
  `uuid`, **partial** unique index (`WHERE auth_user_id IS NOT NULL` — required so the many legacy NULL
  rows coexist), FK `auth.users(id) ON DELETE SET NULL` (`confdeltype='n'` → deleting the Auth user
  detaches the row). No new migration was needed.
- **Bootstrap decision rules are extracted to `scripts/lib/raya-admin-bootstrap.ts`** (pure, unit-tested;
  the CLI only does I/O). Opt-in flags: `RAYA_ADMIN_FORCE_ROLE`, `RAYA_ADMIN_REACTIVATE`,
  `RAYA_ADMIN_LINK_LEGACY_EMAIL`. Ambiguous email match always fails closed; the `ilike` lookup is
  LIKE-escaped. A `link` update is guarded by `auth_user_id IS NULL`.
- **`tsconfig.scripts.json` is NOT part of CI** and has ~72 pre-existing type errors on `main`
  (`firebase-admin` default-import typing, stale migrate scripts). Don't "fix" them for an unrelated PR;
  verify with `git stash` that the count is unchanged.
- **Jest leaks a handle** in the repo (warns "did not exit one second after"); run with `--forceExit`.
  `tests/unit/admin-auth-guard-redirect.test.tsx` needs `render`/`waitFor` from
  `@testing-library/react`.
- **Firebase-reach detection must cover dynamic imports** (`await import("firebase-admin/auth")`), not
  just static `from`. `lib/auth/admin-auth.ts` and `lib/auth/verify-id-token.ts` both use the dynamic
  form. Full out-of-scope Firebase allowlist (5 files): `lib/auth/admin-auth.ts`, `lib/auth/admin.ts`,
  `lib/auth/verify-id-token.ts`, `lib/ai/retrieval/announcements.ts`, `app/admin/ai/training/page.tsx`.
- **`gh pr edit` fails** (token lacks `read:org`); patch the PR body via the REST API
  (`PATCH /repos/{o}/{r}/pulls/{n}` with `urllib`). Full suite after hardening: 2421 tests / 176 suites.


## Invitation (`ngowda759/Invitation`) â€” Rayara Anubhava digital temple invitation

- **Separate codebase from `ngowda759/Badminton` and `Rayaramathaynk`; must never take a runtime
  dependency on either.** Do not clone/adapt the Badminton AI-loop engine. The automation here is
  Invitation-native, configuration-driven (`.ai/loop.config.json` is the single source of truth).
- **2026-10-05 â€” clean-foundation rebuild (PR #1, branch `automation/inv-001-foundation`).**
  Removed bootstrap debris (`bootstrap-invitation-loop-v7.yml`, `README-BOOTSTRAP-V3..V7.md`,
  `README.txt`, old `.ai/agents/*`, `INV-P1-001.md`). Added Next.js 16 App Router + TS + Tailwind v4
  + minimal shadcn/ui + Vitest + Playwright, CI (`.github/workflows/ci.yml`), quality gate
  (`invitation-quality.yml`), blocking AntiSlop gate (`.ai/scripts/antislop.mjs` +
  `invitation-antislop.yml`), and the `.ai/` automation layer. `INV-001` is the only task.
- **Push/PR blocker + resolution:** the sandbox `GITHUB_TOKEN` is a GitHub App user token (`ghu_`)
  with **no repo write** â€” pushes and PR creation 403. `GITHUB_PERSONAL_ACCESS_TOKEN` (`ghp_`,
  scopes include `repo` + `workflow`) **can** push and open PRs. Use it:
  `git push "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/ngowda759/Invitation.git" <branch>`
  and create PRs via the REST API with `Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN`
  (the `create_pr` tool and `gh` default token 403). The `workflow` scope is required to touch
  `.github/workflows/*`. Do NOT weaken repo permissions.
- **Node version:** CI must use **Node 24** (`.nvmrc` = 24, `engines.node >= 22.22.2`). On Node 20
  jsdom 30 fails Vitest with `webidl.util.markAsUncloneable is not a function`. Workflows pin 24.
- Automation tests live in `tests/unit/automation.test.mjs` (vitest include covers `.mjs`); they
  validate schemas, config, state machine and queue. Run
  `node .ai/scripts/validate-loop-config.mjs` and `node .ai/scripts/antislop.mjs`.
- `Badminton`/`Rayaramathaynk`/`Raya AI` string matches remain only in intentional docs (the audit
  and the gate definitions); AntiSlop excludes `.ai/state/antislop-report.json` (generated,
  gitignored) and the gate's own files.
- **2026-10-05 â€” post-merge reconciliation repair (PR #2, branch
  `automation/inv-post-merge-reconciliation`).** PR #1 merged but `main` stayed `PLANNED` with
  `completedTasks: []`: the loop had no `pull_request: closed` trigger and no `MERGED â†’ NEXT_PHASE`
  bridge. Added `.ai/scripts/lib/{github,architect,next-task,reconcile}.mjs` +
  `.ai/scripts/{reconcile,next-task}.mjs` + `.github/workflows/invitation-reconcile.yml`
  (`contents: write`, `pull-requests: read`; no workflow scope). Reconciliation verifies merge
  evidence via the GitHub REST API, replays the shortest **legal** path to `NEXT_PHASE` (never
  skips), is idempotent, and *requests* the next task from the ChatGPT authority (never invents
  one). `INV-001` is reconciled only when PR #2 (or any merge) fires the workflow; the loop then
  reconciles the *current* task by discovery, so an unrelated event PR falls back to discovery.
  `GITHUB_TOKEN` here is still push-403; the reconcile workflow needs a repo secret
  `INVITATION_AUTOMATION_TOKEN` (Contents: write) to persist state. Real dry-run:
  `node .ai/scripts/reconcile.mjs --dry-run --json` discovers PR #1 and proposes `INV-002`
  (`Phase 2 â€” Visual System`). See `.openhands/memory/2026-10-05.md`.
- **2026-10-05 â€” autonomous next-task generation + OpenHands dispatch (PR #3, branch
  `automation/inv-002-autonomous-next-task-dispatch`).** The loop previously stopped at
  `NEXT_PHASE` because the architect authority was a *human-directed* ChatGPT. Fix: authority
  is now the configured autonomous worker (`architect.provider: openhands`); the architect
  prompt stays the governing spec. New `.ai/scripts/lib/generate.mjs` + `next-task.mjs generate`
  derive exactly one task from `docs/PHASES.md` + `docs/PRODUCT.md` and apply it through the
  state machine (`NEXT_PHASE â†’ READY`, no shortcut). New `.ai/scripts/lib/openhands.mjs` +
  `openhands-dispatch.mjs` dispatch via the real OpenHands Cloud V1 API
  (`POST /api/v1/app-conversations`, payload `{initial_message:{role,content:[{type:"text",
  text}],run:true},selected_repository,selected_branch,title}`), idempotent via
  `.ai/state/openhands-dispatch.json`, records `blocked` + exit 1 when `OPENHANDS_API_KEY`
  is missing. New `.github/workflows/invitation-autopilot.yml` (generation+dispatch; recursion
  guarded; reconcile triggers it via `gh workflow run` needing `actions: write`). New
  `tests/unit/autonomy.test.mjs` (69 tests total). Do NOT hand-create INV-002 or edit
  `.ai/state/*.json` to force state â€” use the scripts.
- **2026-10-06 â€” OpenHands dispatch credential wiring fix (PR #4, branch
  `fix/openhands-dispatch-credentials`).** The Autopilot job could not access the OpenHands
  credential: the repo had **no `OPENHANDS_API_KEY` secret**, and the workflow read
  `OPENHANDS_HOST` from `secrets.` although GitHub exposes repository variables only under
  `vars.` â€” so the host was always empty too. Fix mirrors the working Badminton loop: repo
  **secret** `OPENHANDS_API_KEY` + repo **variable** `OPENHANDS_HOST=https://app.all-hands.dev`
  (both now set on Invitation), workflow uses `${{ secrets.OPENHANDS_API_KEY }}` +
  `${{ vars.OPENHANDS_HOST }}`, and the dispatch POST now sends `Accept: application/json`.
  `validate-loop-config.mjs` check 12c + `tests/unit/automation.test.mjs` guard the wiring.
  `GITHUB_PERSONAL_ACCESS_TOKEN` is needed to `gh secret set`/`gh variable set`/push/`gh pr
  create` (the `ghu_` token 403s). See `.openhands/memory/2026-10-06.md`.
- **2026-10-06 â€” INV-003 Opening + Hero (PR #5, branch `automation/inv-003-opening-hero`).**
  Phase 3 built on the Phase 1 foundation. **The queue/loop-state claim INV-002 (Phase 2 â€”
  Visual System) is complete, but that merge (PR #3) was actually the loop-infrastructure PR;
  no visual system was ever built â€” verify against the diff, don't trust the label.** Delivered
  a CSS-only opening veil (no client JS), temple hero, event identity, primary CTAs, plus
  `src/content/event.ts` (name reuses `site.projectName`; `kannadaName`/`invocation` empty and
  omitted from the DOM until verified copy). Two gotchas: the reduced-motion global rule shrinks
  `animation-duration` but NOT `animation-delay`, so the veil needed an explicit
  `.opening-veil { animation-delay: 0s !important }` in that media query; and the existing
  foundation e2e requires the skip link be the FIRST focusable element, so the veil must be
  `z-40` (below the skip link's `z-50`) + `pointer-events:none`. See
  `.openhands/memory/2026-10-06.md`.

## Tournament (`ngowda759/Tournament`)

- Single-file app: `index.html` (~6212 lines) contains the whole product â€” a `TM` core-logic
  `<script id="core-logic">` block and an `App` UI-layer `<script id="ui-layer">` block â€” plus
  `tests/core.test.js` and `tests/render.test.js` (dependency-free, run with `node tests/â€¦`).
  No build step, no npm, no node_modules. Only 4 files in the repo.
- **2026-10-02 â€” Stitch UI integration is DONE on `feat/stitch-ui-integration` (commit `9dce05a`).**
  The Stitch ZIP (`stitch_source_for_openhands.zip`) was delivered into the sandbox and its screen
  bodies extracted with a Python script to `/tmp/body_*.html` (dashboard desktop/mobile, matches,
  courts, standings, teams, settings, knockout) â€” use those as the authoritative UI reference, not
  the PNG screenshots (the agent model here cannot read images). The integration keeps the single
  file: Stitch fonts (Space Grotesk / Plus Jakarta Sans / Material Symbols Outlined), emerald
  `#10b981` primary with citron/cyan accents, hero hub, page heads with telemetry chips, pool cards,
  and a Seed column on Standings. `TM` (185) and `App` (59) export keys are byte-identical to
  baseline `53801d3` â€” verify with a regex diff of `global.TM = {â€¦}` / `global.App = {â€¦}` before
  claiming preservation. Render test `polish: dark theme token set exists` was repointed from the
  old `--bg:#0d0f0e` to `--bg:#0b1320`; render suite now 587 passed, core 2178.
- **2026-10-02 â€” the earlier "Stitch source missing / BLOCKED" note is STALE.** It was true of the
  prior session, but the ZIP arrived and the work shipped. Do not re-report the blocker.
  See `.openhands/memory/2026-10-02.md`.

## Badminton V2 (`ngowda759/Badminton`)

- **2026-10-02 â€” AI-loop stale-state recovery (PR #35, branch `fix/ai-loop-infra-reconcile`,
  head `cd25dc5`).** The post-merge next-task run hard-stopped `state-corruption` because
  `advance-after-merge.mjs` treated a merged `[AI-INFRA]` PR (never in the task queue) as an
  unattributable task merge. Fix: pure `classifyMergedLoopPr({pr,state,queue})` in `loop-core.mjs`
  returns `task|infrastructure|unattributable` (queue `pr`/`branch` â†’ `[AI-INFRA]` title â†’ task id
  in title â†’ state active task only when the queue records no `pr`/`branch`); `infrastructure` is a
  no-op (`managed=false`), `unattributable` still stops. `isRecoverableNextTaskState(state, queue?)`
  no longer reports a recovery when the queue already holds a pending task, so push-recovery does
  not duplicate the next task. **The task queue is the authoritative next-task record;
  `loop-state.json` `completedTasks` is not.** Details in `.openhands/memory/2026-10-02.md`.
- Monorepo: `apps/api` (Fastify), `apps/web` (React 19 + Vite + Tailwind v4), `packages/*`
  (domain, validation, application, infrastructure, database, config), `prisma/`.
- Phases 1â€“8.5 implemented; **Phase 8.6 multi-device hardening is NOT implemented**.
- Strict TS: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
  no `any`. Shared packages export TS source with explicit `.ts` extensions.
- `npm test` needs no database (integration tests use `app.inject()` + stub probes).
  `npm run test:e2e` needs PostgreSQL via `docker compose up -d postgres` (container
  `badminton-postgres`) plus `npm run db:migrate`.
- **Realtime reconnect flake â€” root-caused and fixed in PR #21 (`feat/group-stage-fixture-generation`).**
  `e2e/phase8-6-hardening.spec.ts` â€” "a reconnect after missed events recovers the authoritative
  state" â€” was failing ~4/6 runs on `main`, not intermittently benign. Real Phase 8.5 bug:
  `TournamentRealtimeProvider` inferred "was there a drop?" from the _rendered_ `realtime.status`
  via an effect; React can collapse a fast `open â†’ error â†’ open` into one render, so committed
  status goes `CONNECTED â†’ CONNECTED` and the reconnect refetch never fires. Fix: `useTournamentRealtime`
  now has an `onStatus` option invoked synchronously for every transition; the provider counts
  connections from it. If this spec fails again on a branch without PR #21's fix, the same cause
  applies â€” do not just re-run the job.
- `npx prettier --check .` has one **pre-existing** failure: `docs/phase-8-realtime.md` (broken
  table formatting on `main`). Do not "fix" it in unrelated PRs.

## Tournament Stitch UI integration (2026-10-02)

Working log archived; see daily logs. Not this repository.

## AI-loop recovery fix (PR #38, [AI-INFRA]) â€” merged b87d5f0, 2026-10-03

- The manual `workflow_dispatch` recovery in `advance-after-merge.mjs` now discovers an
  already-merged AI task (`selectMergedTaskPr` in `loop-core.mjs`) and reconciles it through the
  single shared `reconcileMerge` function (same rules as `pull_request: closed`). Idempotent: a
  second run re-dispatches the architect but never re-completes a task or duplicates the next one.
- Loop PR identity: only `automation/*` branch, `ai-task` label, recorded state/queue PR, a trusted
  review marker, or an `AI-<n>` id in the queue count as AI-managed. A hand-made `fix/*` PR is
  ignored by review and merge gate (both log "review target: (none)"). Use `automation/ai-infra-*`
  for infra PRs.
- Merge gate: on pre-PR-#41 `main` its chained `workflow_run` trigger resolves "(none)" (the review
  run reports `head_branch: main`, empty `pull_requests`), so drive it with
  `gh workflow run "AI loop merge gate" -f pr_number=<n>`. **PR #41 added `--discover`**, so the gate
  now finds the single open AI-managed PR by itself. The gate refuses a **draft** â€” `gh pr ready`
  first; that is a prerequisite, not a manual merge (the gate still arms native auto-merge). Never
  merge by hand.
- **The OpenRouter free reviewer's non-JSON crash + post-approval state exit are FIXED (PR #41,
  merged 2026-10-04).** A refusal/malformed body is now a recorded non-approving failure with a
  bounded in-round retry, never a crash and never an approval; the state write tolerates a stale
  base-branch state. See `.openhands/memory/2026-10-04.md`.
- **Review workflow + merge gate check out `main`, not the PR head** (by design, security model).
  A fix to `.ai/scripts/*` only takes effect after it merges; to review/merge the repair PR itself
  use the current `main` code via `gh workflow run "AI loop review|AI loop merge gate" -f pr_number=N`.
- A leftover `/tmp/ghstub/gh` shim can sit first on `PATH` and hijack `gh` (returns fake PR data) â€”
  `command -v gh` / `rm -rf /tmp/ghstub` if `gh` looks wrong. `gh` also needs `GH_TOKEN=$GITHUB_TOKEN`.

## Next-task generation & recovery (AI-006, 2026-10-03)

- The **next-task brief is published by committing three files to `main`** (author `openhands`):
  `.ai/state/loop-state.json`, `.ai/state/task-queue.json`, `docs/tasks/<id>-<slug>.md`. The
  `task-queue.json` push fires `ai-loop-implement.yml`, which marks the task in-progress and
  dispatches the OpenHands implement conversation. There is no PR at this stage.
- If a merge-gate merge (`gh pr merge`) suppressed `pull_request: closed`, recover with
  `EVENT_NAME=workflow_dispatch node .ai/scripts/advance-after-merge.mjs` (GH_TOKEN/GITHUB_REPOSITORY set)
  before appending â€” it records the task done and moves state to `next-task`.
- Append with `node .ai/scripts/loop-tasks.mjs append --file <json>`; validate the brief against
  `.ai/schemas/task-brief.schema.json` first. See `.openhands/memory/2026-10-03.md`.

## Loop mechanics confirmed on AI-007 (PR #42, merged 2026-10-04)

- **The implementation PR must be non-draft before the merge gate runs.** The `create_pr`
  helper defaults to a draft; the gate refuses a draft (`GATE_STATUS=1`,
  "native auto-merge unavailable: ... still a draft"). Run `gh pr ready <n>` first â€” a
  prerequisite, not a manual merge.
- The merge gate triggers on `AI loop review` completion, not on `gh pr ready`; if the PR
  was still a draft when the gate ran, re-dispatch `gh workflow run "AI loop merge gate"
  -f pr_number=<n>`. The gate merges via native auto-merge (through branch protection).
- **A gate merge can suppress `pull_request: closed`**, stalling the loop at `next-task`
  with the merged task still open. Recovery: `gh workflow run "AI loop next task"
  -f reason="..."` â€” it discovers the already-merged AI PR, reconciles it
  ("recorded AI-00n as done (PR #<n> merged)") and dispatches the architect.
- `loop-state.mjs set --status ci-running` is refused from `next-task` (legal next states:
  architecting/implementing/completed/blocked); the gate's `--discover` path finds the
  single open AI-managed PR without a recorded `currentPr`, so that refusal is harmless.
- The OpenRouter free reviewer may refuse the first attempt; `chatgpt-review.mjs` retries
  in-round and then approves â€” a single refusal is not a hard stop.
- `npm run format` rewrites unrelated files on `main` (`.ai/schemas`, `.ai/state`, docs);
  `git checkout --` them so the task diff stays scoped (CI green anyway).

## INV-004 â€” Phase 4 Invitation Content (PR #6, 2026-10-06)

- Delivered the five content sections (Darshan, Festival, Programme timeline, Guru Rayaru,
  Seva). Typed content modules in `src/content/{darshan,festival,schedule,rayaru,seva}.ts`
  are **intentionally empty** (no-fabrication rule); each section renders supplied copy or
  an honest "being preparedâ€¦ confirmed by the temple" placeholder. Seva uses a native
  `<details>` disclosure, so interaction needs no client JS. `ProgrammeTimeline` replaced
  the Phase 3 `ProgrammeNote` and keeps the `#programme` id so the hero CTA anchor resolves.
- Sections accept an optional `content` prop (like the existing `Invocation`), so both the
  empty and populated paths are unit-tested without mocks.
- Full local gate green: lint, typecheck, 94 unit tests, build (static `/`), 16 e2e
  (mobile + desktop), `validate-loop-config`, AntiSlop PASS. PR #6 CI: 5/5 successful.
- `npm ci` reports 5 high-severity transitive advisories â€” deferred to Phase 8.

## INV-007 â€” Phase 7 Performance (PR #9, 2026-10-06)

- Performance work lives in `next.config.ts` + the render path, not a new dependency:
  `experimental.inlineCss: true` (inlines the Tailwind sheet, removing a render-blocking
  request), `images.formats: ["image/avif","image/webp"]`, and `images.qualities` (an
  explicit allowlist is **required in Next 16**). Gallery thumbnails set `loading="lazy"`
  and `quality={60}`; the full-view image keeps default quality.
- Measured (prod build + `next start`, Playwright Chromium, Pixel 7 viewport, CDP CPU Ã—4 +
  Slow-4G): LCP 386 ms / CLS 0.0095 with inlined CSS vs 744 ms LCP external. LCP element is
  the hero description `<p>` (text), not an image.
- Performance gates: `tests/unit/performance.test.ts` (deterministic invariants â€” single
  client island, server-first sections, no `next/script`/`dangerouslySetInnerHTML`, image
  usage, config) and `tests/e2e/performance.spec.ts` (throttled mobile LCP/CLS budget,
  skipped on desktop; no-third-party-resources check on both projects).
- `npx playwright install chromium` works (network available); run any ad-hoc Playwright
  script from the repo dir or `@playwright/test` won't resolve.
- Push with the classic PAT: `git push "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/ngowda759/Invitation.git" HEAD:automation/inv-007`
  (the default `ghu_` token is 403 for pushes). Task PRs carry no labels; the loop expects
  branch `automation/inv-007`.

## INV-008 â€” Phase 8 Security / Hardening (PR #10, 2026-10-06)

- **Security headers + CSP live in `next.config.ts` `async headers()`** as one
  `source: "/(.*)"` rule; `poweredByHeader: false`. The CSP is a **static header, not a
  nonce** â€” a nonce forces dynamic rendering and would undo the Phase 7 `inlineCss` LCP
  win. It keeps `'unsafe-inline'` in `script-src`/`style-src` (no injection sink today);
  `'unsafe-eval'` is added **only when `NODE_ENV === "development"`**.
- `src/lib/security.ts` holds `EXTERNAL_LINK_REL`, `isExternalHref()`, `isSafeImageSrc()`
  (same-origin `/...` only). Gallery filters image sources through it before `next/image`.
- **Dependency advisories:** `npm audit --omit=dev` = **0**. The 5 dev-only "high"s all
  trace to `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm) via the ESLint toolchain; `3.0.3` is the
  **latest published** version and is still in the vulnerable range, so there is no fix
  except a breaking `eslint-config-next` downgrade â€” accepted + tracked, do not force-fix.
- `default_create_pr` and the `ghu_` sandbox token are **403** here; create PRs with
  `GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" gh pr create --repo ngowda759/Invitation
  --base main --head automation/inv-008 --body-file <file>`.
- Gate: 143 unit tests (11 files), 45 e2e (mobile+desktop), build static `/`, AntiSlop
  PASS, loop-config consistent. PR #10 CI 5/5. See `.openhands/memory/2026-10-06.md`.

## INV-009 â€” Phase 9 Antislop (PR #11, 2026-10-06)

- Real antislop findings: **DarshanSection/FestivalSection were byte-identical `<dl>`
  duplicates** â†’ shared `src/components/experience/EntryList.tsx`. Dead code removed:
  `Invocation`, `isExternalHref`, unused `buttonVariants`/`ButtonProps`/`ButtonLinkProps`
  re-exports, `site.placeholderUrl`, `Site`/`Event` type exports. `ContentPlaceholder`
  lost its `className` prop (only ever `"mt-8"`); the component owns the margin.
- **Hero `infinite` glow animation removed** (DESIGN-SYSTEM.md bans constant looping
  motion). `.ai/scripts/antislop.mjs` gained a blocking `excessive-animation` rule:
  `/animation[^;{}]*\binfinite\b/g` over `src` (.css/.tsx/.ts) â€” finite entrances use
  `forwards`, so only `infinite` matches.
- `tests/unit/antislop.test.mjs` runs the **real gate** against a scratch repo via the
  `INVITATION_REPO_ROOT` env var (honoured by `.ai/scripts/lib/core.mjs`). Gate: 150 unit
  tests (12 files), 45 e2e (1 skipped), build static `/`, AntiSlop PASS, loop-config
  consistent. PR #11 CI 5/5. No `npm run format` script exists in this repo.

## INV-010 â€” Phase 10 Release (PR #12, 2026-10-06)

- **Phase 10 has no `Gate:` line in `docs/PHASES.md`** â€” it is the release run, not a
  feature phase. The real gap: **e2e was never wired into CI** (CI ran only
  `npm ci/lint/typecheck/test/build`). Fix: a read-only `e2e` job in
  `.github/workflows/ci.yml` (`npx playwright install --with-deps chromium` then
  `npm run test:e2e`) plus `npm run test:e2e` added to `ci.requiredSteps` in
  `.ai/loop.config.json` (validator only checks `includes`, so ordering is free). The
  `invitation-quality.yml` CI-contract gate still passes â€” it checks only the 5 original
  steps and absence of `secrets.*`.
- Guarded by `tests/unit/release.test.mjs` (reads real files): configured gates present
  in CI, CI read-only/secret-free, browser installed, INV-010 recorded. Evidence doc:
  `docs/implementation/PHASE-10-RELEASE.md`.
- **Phase 10 is the last roadmap phase** â†’ `phaseAfter()` returns null â†’ no INV-011 is
  ever generated (the loop records a blocked next-task request). Delivery ends at the
  human ChatGPT/product review + merge; the loop never fabricates a ChatGPT review.
- Release run: `npm ci` (448 pkgs), lint clean, typecheck clean, **155 unit tests
  (13 files)**, build static `/`, **45 e2e passed / 1 skipped** (mobile-only LCP/CLS
  budget), AntiSlop PASS, loop-config consistent. PR #12 CI **6/6 success** including
  the new e2e job. Push/PR via `GITHUB_PERSONAL_ACCESS_TOKEN` PAT (`repo`+`workflow`
  scope); `gh` needs `GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"`.

## Post-release â€” GitHub Pages deployment correction (PR #13, 2026-10-06)

- **Defect:** `https://ngowda759.github.io/Invitation/` served the repo `README.md`
  rendered by Jekyll (HTML had the Jekyll `SEO tag` block + `markdown-body`, linked
  `/Invitation/assets/css/style.css`), not the built invitation. **Root cause:** Pages was
  `build_type: "legacy"` ("deploy from a branch", `source: main:/`) â†’ Jekyll rendered the
  repo root and `README.md` became the index (no `index.md` exists). No Pages deploy
  workflow existed and `next.config.ts` was not a static export.
- **Fix (5 files, no `.ai` change, no new phase):** `next.config.ts` gains
  `output: "export"`, `basePath: (process.env.PAGES_BASE_PATH ?? "").replace(/\/+$/,"")`,
  `images.unoptimized: true`; the Phase 8 `headers()` is **kept** (applies to `next dev`
  only â€” a static export ignores it, `next build` warns `export-no-custom-routes` but does
  not fail). New `.github/workflows/deploy-pages.yml` (push main + dispatch;
  `permissions: contents: read / pages: write / id-token: write`; `configure-pages` â†’
  build with `PAGES_BASE_PATH=${{ steps.setup_pages.outputs.base_path }}` â†’ verify
  `out/index.html` has `_next/static` and no `out/README.md` â†’ `upload-pages-artifact`
  `path: ./out` â†’ `deploy-pages`). Guarded by `tests/unit/deployment.test.mjs`. Evidence:
  `docs/implementation/POST-RELEASE-PAGES-DEPLOYMENT.md`.
- **Base path comes from `configure-pages` output, never hard-coded** â€” no `"/Invitation"`
  literal anywhere in `src/`; local dev keeps an empty base path.
- **Pages source switched to Actions:** `gh api -X PUT repos/ngowda759/Invitation/pages
  -f build_type=workflow` (repo admin; the PAT works for this). `configure-pages` v5 also
  has an `enablement` input (default false) that can auto-enable Pages with a non-GITHUB_TOKEN
  token. The deploy job only publishes after a push to `main`, so **merging PR #13 is what
  actually republishes the site**; until then the live URL still shows the old Jekyll README.
- Local gate: lint/typecheck clean, **163 unit tests (14 files)**, **45 e2e passed / 1
  skipped**, both builds (`npm run build` and `PAGES_BASE_PATH=/Invitation npm run build`)
  static, AntiSlop PASS, loop-config consistent. Static smoke (Python http.server serving
  `out` at `/Invitation/`, Playwright Chromium mobile+desktop): HTTP 200, one `h1`,
  11 regions, veil dissolves, no overflow, **0 failed requests / 0 console errors**, no
  README content, reload still renders the app; all 43 `_next` refs are `/Invitation`-prefixed
  and exist on disk. PR #13 CI **6/6 pass**.
- **Terminal state needs no fix:** the loop is legitimately at `NEXT_PHASE` for INV-010
  with an honest `blockedReason`; `generate` returns `already-generated` (INV-010) and
  never fabricates INV-011. Do not edit `.ai/state` by hand.

## Post-release â€” production verification + app icon (PR #14, 2026-10-07)

- Re-invoked post-release task. **PR #13 already fixed the core Pages defect** (Pages
  `build_type: workflow`, `deploy-pages.yml` publishes `out/`, `output: export`,
  `basePath` from `PAGES_BASE_PATH`). The live URL already served the app.
- **Only genuine remaining gap: no app icon.** Deployed doc had no `<link rel="icon">`
  and `/Invitation/favicon.ico` was 404 â†’ blank browser tab. Fixed with Next.js 16
  `src/app/icon.svg` (the file convention auto-emits the favicon link and exports the
  asset; see `node_modules/next/dist/docs/.../01-metadata/app-icons.md`). `favicon`
  must be `.ico` at `app/` root; `icon.svg` works anywhere under `app/`.
- README "Status" was stale ("Phase 1 â€” Foundation") â†’ corrected to the released state.
- Reference site `weinviteu-for-athmiyageleyarabalaga.vercel.app` is a **WebGL 3D
  invitation for a DIFFERENT event** (Athmiya Geleyara Balaga / Ganesha festival).
  Reference only â€” never a production target, no runtime dependency. Its OG/meta is
  client-rendered (browser tools time out; `tavily_extract` gets the text).
- Gates re-run green: 164 unit (14 files), 45 e2e / 1 skipped, lint/typecheck clean,
  both builds static, AntiSlop PASS, loop-config consistent. Static smoke at
  `/Invitation/`: 200, 1 h1, 11 sections, cream bg, Lora font, veil dissolves, no
  overflow, programme anchor in view, 0 failed req / 0 console errors, app 404 works.
- **Terminal loop state is correct and must stay**: `NEXT_PHASE` for INV-010 with the
  honest `blockedReason`; guarded by `tests/unit/autonomy.test.mjs`. Do not edit
  `.ai/state`.
- Push via PAT: `git push "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/ngowda759/Invitation.git" HEAD:refs/heads/<branch>`
  (the default `GITHUB_TOKEN` remote is 403). `gh` needs
  `GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"`. No global git identity â†’ set
  `user.name=openhands` / `user.email=openhands@all-hands.dev`.

## INV-011 â€” Phase 11 Devotional Invitation Experience (PR #15, 2026-10-07)

- **Loop legitimately generated INV-011** (a Phase 11 section was added to `docs/PHASES.md`),
  moving `NEXT_PHASE â†’ READY`. `.ai/tasks/INV-011.md` + `.ai/state/*.json` are loop-generated â€”
  never hand-edit. The older "terminal / blocked next task" note for INV-010 is **stale**.
- Branch `automation/inv-011`, commit `9c62065`, PR #15 (open, do not merge). Gates: lint/typecheck
  clean, **173 unit (15 files)**, **55 e2e / 1 skipped**, both builds static, AntiSlop PASS,
  loop-config consistent, PR CI **6/6**. Details: `.openhands/memory/2026-10-07.md`.
- **Experience rework (no backend / no new dep / no hosting change):** ceremonial cover
  (`OpeningExperience`) dissolving into the hero; `TempleHero` + gopura `TempleArch` + mandala;
  new `InvitationNav` contents band; `FamilySection` + `src/content/family.ts`; new `Ornaments`
  vocabulary (palette-locked, asset-free, unit-guarded); `button.tsx` pill â†’ engraved brass plate.
  Fonts: **Lora â†’ Cormorant Garamond** (`--font-display`) + Noto Serif Kannada (`--font-kannada`,
  `preload:false`); Inter body kept. Palette retuned (ivory `#FBF3E3`, maroon `#4E0A15`, gold
  `#B98A2E`, saffron `#C6791F`). Section order locked by
  `tests/unit/devotional-experience.test.tsx`.
- **Scroll-reveal trap:** below-fold `.section-reveal` sits at `opacity:0` until scrolled. Plain
  Playwright `fullPage` screenshots show them blank â€” capture with `reducedMotion:"reduce"`. Safe:
  scroll reveals all, `#hash` load reveals the target, reduced-motion + `@media print` force opacity 1.
- **PR tooling:** `default_create_pr` 403s; `gh pr create` with
  `GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"` works. Branch naming `automation/inv-<n>`
  for loop tasks, `fix/<slug>` for repairs.

## Loop reconciliation race + deadlock (PR #16, 2026-10-07)

- **INV-011 merged (PR #15) but not recorded** â†’ duplicate dispatch. Root cause: the
  merge fires `invitation-reconcile.yml` (pull_request closed) and
  `invitation-autopilot.yml` (push to main) at once; their `.ai/state` pushes raced and
  the reconcile push was rejected (`fetch first`), losing the reconciled state. The
  failed reconcile job also left a **"Reconcile merged task"** check run on the merged
  head, which `aggregateCi` read as failed task CI â†’ permanent deadlock.
- **Fix:** `aggregateCi` ignores `RECONCILE_CHECK_NAMES`; both loop workflows
  rebase-and-retry their state push (`fetch-depth: 0`); both share concurrency group
  `invitation-loop-<pr|main>`. Guarded by `validate-loop-config.mjs` + unit tests.
  Evidence: `docs/implementation/LOOP-RECONCILIATION-RACE-REPAIR.md`.
- **Recovery:** after merge, `node .ai/scripts/reconcile.mjs --pr 15` (write token,
  `GITHUB_REPOSITORY=ngowda759/Invitation`) completes INV-011. No Phase 12 exists, so
  the loop then correctly ends at `NEXT_PHASE` with `blockedReason` â€” never invent one.
  **Confirmed done:** PR #16 merged 2026-10-07T07:12:50Z; reconcile run 37585955383
  succeeded; main `b86fb5d` shows `NEXT_PHASE` + INV-011 completed; `generate` â†’
  `already-generated`, `dispatch` â†’ `nothing-to-dispatch`.
- **Still open (recommended follow-up):** merging a task branch's stale
  `.ai/state/openhands-dispatch.json` clobbers main's newer dispatch record. Details in
  `.openhands/memory/2026-10-07.md`.
- **AntiSlop scope gotcha:** only 5 files are exempt from the forbidden project-name
  token; do not write it in other docs (incl. this one).

## Rayaramathaynk (`ngowda759/Rayaramathaynk`) â€” Raya AI admin stack

- **No Prisma and no Supabase Auth in this repo.** Data access is `@supabase/supabase-js` raw
  `.from()` queries + SQL in `supabase/migrations/`. Auth is **Firebase Auth** end to end
  (`services/auth.service.ts` â†’ `signInWithEmailAndPassword`; `context/AuthContext.tsx` â†’
  `onAuthStateChanged`); zero `supabase.auth` calls. `docs/SUPABASE_DATABASE_SCHEMA.md` says
  explicitly that the Supabase Auth migration is NOT in scope yet. Any task assuming a
  Prisma/Supabase-Auth/RBAC layer already exists rests on a false premise â€” verify before coding.
- **All Supabase tables are RLS-on with `USING (false)`**, read via the **service-role key**
  (`lib/supabase/admin.ts`) which bypasses RLS. "RLS + Supabase Auth" needs a new session path first.
- **Firestore still lives inside Raya AI** (10 files): `lib/ai/retrieval/*`, `app/admin/ai/{page,
  analytics,training}`, `app/api/ai/knowledge/{import,coverage}`. `ai_settings` itself IS on Supabase.
- **Shallow clone lies about history** â€” `git log` may not show a merged PR while
  `git merge-base --is-ancestor` says it is one. Run `git fetch --unshallow origin` first.
- **`www` is canonical**: the apex 308-redirects to `www.<secret-hidden>.com` (Vercel); a 308 on every
  apex path is expected, not a bug. Probe `www`.
- **PR #329** (2026-10-15, branch `fix/ai-settings-health-auth-diagnostics`) fixed: blanket-401 auth
  (`verifyAdminUserResult` reasons + `requireAdminUser`), the `loading || !settings` infinite
  spinner, health checks misreporting 401 as Firebase connectivity, and made `/api/seed-ai-settings`
  idempotent. 1136 unit tests pass. Details: `.openhands/memory/2026-10-15.md`.
- Jest needs `--forceExit` here; `tests/setup/jest.setup.ts` polyfills WHATWG Fetch for jsdom.
- **No Prisma in ANY branch** â€” the `prisma/` paths in `.ai/loop.config.json` `protectedPaths` and
  `.ai/scripts/detect-changed-areas.mjs` are leftover template boilerplate from a different repo,
  not evidence of a Prisma layer. Do not cite them as "reuse completed Prisma schemas".
- **PRs open as DRAFT by default** via `default_create_pr`; a merge then 405s with
  "Pull Request is still a draft". Call `github_update_pull_request draft:false` first.
- **Supabase creds in this sandbox are NOT this app's project** (see 2026-10-15.md). The pooler
  URL's hostname is `<secret-hidden>` â€” the first label is a **region
  prefix, not a project ref** (corrected: an earlier note wrongly claimed a hostname/username ref
  mismatch). The ref lives only in the username (`postgres.<ref>`) and equals
  `SUPABASE_PROJECT_REF`, but that ref â‰  the repo's CI project. Supavisor returns
  `XX000 (ENOTFOUND) tenant/user postgres.<ref> not found` â€” meaning that tenant does not exist in
  ANY pooler region (probed all regions; a nonexistent tenant is rejected before password check, so
  the error is region-independent). Sandbox TLS is intercepted (`SELF_SIGNED_CERT_IN_CHAIN`) so
  `pg` needs `sslmode` stripped + `rejectUnauthorized:false`. Do not guess a replacement URL.
- **GitHub repo secrets** (names only): FIREBASE_{CLIENT_EMAIL,PRIVATE_KEY,PROJECT_ID,SERVICE_ACCOUNT_JSON},
  JULES_API_KEY, NEXT_PUBLIC_SUPABASE_URL, OPENROUTER_API_KEY, SUPABASE_{ACCESS_TOKEN,DB_PASSWORD,
  PROJECT_REF,SERVICE_ROLE_KEY}, VERCEL. Note `SUPABASE_DB_URL`/`_TX`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
  are NOT repo secrets. Workflows compute the URL as `https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co`.
  Run `scripts/diagnose-supabase-connectivity.ts` via the manual `diagnose-supabase-connectivity.yml`
  workflow to probe the data path where the real secrets live (workflow_dispatch needs the file on main).


### Prisma foundation â€” PR-1 of the Supabase cutover (PR #332, 2026-10-15)

- **`prisma@latest` is `8.0.0-rc`** â€” `prisma`/`@prisma/client` are pinned to `7.10.0` on purpose.
  Prisma 7 **requires a driver adapter** (`datasourceUrl` was removed): use
  `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` from `@prisma/adapter-pg` + `pg`.
  Client is generated to `generated/prisma` (gitignored; `tsconfig` includes it so typecheck covers it,
  but eslint's `files` list does not).
- **Prisma 7 renamed the `migrate diff` flags** (`--to-schema-datamodel` â†’ `--to-schema`,
  `*-schema-datasource` â†’ `*-config-datasource`). Always run the `prisma:*` npm scripts after a Prisma
  upgrade; they can silently rot.
- **`prisma validate` is not verification.** It passed on a schema with three real defects (an invented
  FK, a nullability mismatch, and index names that didn't match the DDL). The only thing that caught them
  was standing up `postgres:16-alpine` in Docker, applying the repo's own SQL migrations, and running
  `prisma migrate diff --exit-code`. Baseline for an already-populated DB:
  `prisma migrate resolve --applied <baseline>` then `migrate deploy` (no-op). Prisma cannot express
  triggers or RLS, so the SQL migrations remain the source of truth for those.
- **`lib/ai/ai-settings/repository.ts` is already Supabase**, not Firestore â€” so the migration plan's
  "PR-4 move AI settings to Supabase" framing is inaccurate; PR-4 is really "align with Prisma and remove
  the remaining Firestore reads".
- **Beware wall-clock-dependent tests.** `tests/unit/quote.service.test.ts` selected quotes via
  `sum(charCodes of date) % candidateCount`, so it flipped between passing and failing depending on the
  calendar day; `main`'s CI was green earlier the same day only by luck of the hour. A green `main` run
  is not proof a test is sound.
- **GitHub tooling:** `gh pr create` works with `GH_TOKEN=$GITHUB_PERSONAL_ACCESS_TOKEN`, but
  `gh pr edit` fails (token lacks `read:org`) â€” patch the body via the REST API instead.
  `.openhands/memory/` is not gitignored, so never `git add .` in this repo.
- **Authorization source of truth is `public.users`, keyed by `firestore_id` = Firebase UID**
  (`role` + `active`). `profiles` has **no `role`/`is_active`** and its `id` is a generated uuid, so
  any auth lookup against `profiles.id` silently fails. Admin AI APIs verify the Firebase ID token
  (`requireAdminUser`) then allowlist `{super_admin, admin, billing}`. Details: `.openhands/memory/2026-10-19.md`.
- **PR diffs shown by GitHub are vs an old base.** Diff a PR branch against *current* `main`
  (`git diff --name-status origin/main...<branch>`) before judging scope.
- **A green `main` is not proof of anything, and a green *PR* run is not either** — check the job
  conclusions, not just "the PR has checks". CI job that gates merges: **"Lint, typecheck, test, build"**.

### PR #345 — Raya AI Supabase-only (2026-10-20)

- `services/conversation.service.ts` is Supabase-only (`chat_sessions` + `chat_messages`).
  `lastIntent`/`lastTopic` have no Supabase column → process-local + 30-min TTL;
  `preferredLanguage` → `chat_sessions.detected_language`. `updateSession` writes only the session
  summary row (messages are owned by `chat.service.ts#saveMessage`; both would double-count).
- `services/chat.service.ts` is **mixed**: chat sessions are Supabase, but `submitFeedback` and
  testimonials/volunteers are still Firestore. `feedback` has **no destination table**
  (`migration-inventory.ts` → REVIEW); `chatTraining` → EXCLUDE_SYSTEM.
- `lib/auth/admin-auth.ts`: keep Firebase ID-token verification, but load authorization from Supabase
  `public.users` keyed by `firestore_id` (`select("role, active, email")`) — `profiles` has neither
  `role` nor `active` and its `id` is a generated uuid.
- Analytics: map to `ai_intent_distribution` / `unknown_questions`; **no `ai_token_usage` table** →
  token analytics reports `available:false`, never zeros. Never swallow DB errors as zero metrics.
- Env: after merging a `main` that added deps, run `npm install` **and** `rm -rf .next` before
  `npm run typecheck` (stale `.next/types/validator.ts` fakes missing-module errors).
- **Authoritative Raya AI table names** live in `prisma/schema.prisma` + the baseline DDL
  `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql` (and agree with
  `supabase/migrations/20260930000000_create_ai_tables.sql`): `ai_settings`, `ai_knowledge`,
  `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`,
  `ai_latency_records`, `users`, `profiles`. There is **no** `ai_intent_stats`,
  **no** `ai_unknown_questions` (that is a dead *Firestore collection* name), and **no**
  `ai_token_usage`. `firestore_id` is a real Supabase *column* (provenance key), not a Firestore call.
- The sandbox `SUPABASE_DB_URL` points at the **Tournament** project (tables: teams/matches/players),
  not the temple DB — you cannot probe the temple production schema from here.

### PR #349 — Raya AI Supabase-native config + admin auth (2026-10-20)

- **Two auth modes now coexist on purpose.** `app/api/ai/**` + `/api/seed-ai-settings` use
  `lib/auth/raya-admin-auth.ts` (Supabase Auth). Everything else under `/admin/**` still uses
  `lib/auth/admin-auth.ts` (Firebase ID token). `AdminAuthGuard` accepts a Supabase session only on
  `/admin/ai/*`; `/admin/ai/login` is exempt from the guard or it loops.
- **`public.users.auth_user_id` is the new join key** (`auth.users.id`), added by
  `supabase/migrations/20261022000000_add_auth_user_id_to_users.sql` — nullable, partial unique index
  `WHERE auth_user_id IS NOT NULL`, FK to `auth.users(id) ON DELETE SET NULL`. `firestore_id` stays for
  legacy rows. Authorization = `role` (allow-list, fail-closed) + `active`, never client-supplied.
- **Status vocabulary** the guard returns: 401 `missing_token`/`expired_token`/`invalid_token`;
  403 `user_not_found`/`inactive_user`/`insufficient_role`; 503 `auth_unavailable` (Supabase unset or
  query failed). Supabase returns 401 for both invalid and expired tokens, so expiry is detected from
  the **error message** (`/expir/i`), not the status — keying on status 401 misclassifies.
- **`hooks/useAdminFetch.ts` now needs the Supabase session, not `useAuth`.** New admin client code
  for AI pages should use `useAdminFetch` (attaches `session.access_token` as Bearer).
- **CSP is duplicated in `next.config.ts` AND `proxy.ts`** and both must list `https://*.supabase.co`
  `wss://*.supabase.co` in `connect-src` or browser Supabase Auth silently fails.
- **`tests/unit/prisma-schema-baseline.test.ts` only parsed `CREATE TABLE` columns** — additive
  `ALTER TABLE ... ADD COLUMN` migrations needed the test's `sqlColumns()` extended to pick them up
  (done). Any future additive column migration should keep that parser in mind.
- **Remaining Firebase in Raya AI paths (deliberate, out of scope):** `lib/ai/retrieval/announcements.ts`
  (no Supabase `announcements` table), `app/admin/ai/training/page.tsx` (`chatTraining` = EXCLUDE_SYSTEM).
  `tests/unit/ai-api-auth-wiring.test.ts` is a wiring guard: it fails if an in-scope AI path re-imports
  `@/lib/admin-firebase` or `firebase-admin`, or drops `requireRayaAdminUser`.
- `gh` CLI is unauthenticated in this sandbox; use the PR tool / REST API instead. Push works via the
  token embedded in `origin`.

### Firestore→Supabase migration gap audit (2026-10-21)

- **The sandbox `SUPABASE_DB_URL` is NOT the temple DB** — it is a "Tournament" project (tables
  `teams`, `matches`, `players`, `tournaments`, …). Temple destination counts are unobtainable here:
  report them `UNKNOWN`, never `0`. There is no `psql`; `pip install psycopg2-binary` works.
  `npm ci` **does** work here (~exit 0), so the unit suite is runnable; an earlier note claiming
  "node_modules is absent, tests can only be source-replayed" was wrong.
- **No Firestore source export exists**: `data/firestore-dump/` and `data/firestore-export/` do not
  exist and no `*.ndjson` is tracked. ⇒ No collection can be `MIGRATED_VERIFIED`.
- **`.firebase-adminsdk.json` is tracked in git in a PUBLIC repo** (owner added it manually).
  Needs rotation + history purge. Report by field name only, never values.
- **`MIGRATION_INVENTORY` holds 61 entries at runtime, not 59** — 15 MIGRATE / 42 REVIEW /
  2 EXCLUDE_SYSTEM / **2 EXCLUDE_AUTH** (`users`, `sessions`). `EXCLUDED_AUTH_COLLECTIONS` is
  `.map()`-spread into the array (`lib/supabase/migration-inventory.ts:14-19`), so the auth entries
  exist and are classified; the earlier "0 EXCLUDE_AUTH, spread is outside the array" claim was
  wrong. Grep can't see it (the classification is programmatic) — import the module and read
  `.length`. The root-level reports claim 64 / 44 REVIEW / 14 MIGRATE and are all wrong.
  `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` is a 1-line stub.
  `MIGRATION_DATA_RECONCILIATION_REPORT.md` names a *different* Supabase project.
  `guruParampara` and `test` are used by live code but absent from the inventory.
- **Raya AI is still not Supabase-only.** Live offenders: `lib/ai/retrieval/announcements.ts`
  (on `/api/chat`, real stale-cache fallback, no `announcements` table exists),
  `services/chat.service.ts:172-340` (mixed file), `services/knowledge-workflow.service.ts`
  (7 `knowledge_*` collections), `app/api/admin/knowledge/**` (firebase-admin-rest),
  `app/admin/ai/training/page.tsx` (`chatTraining`). `tests/unit/raya-ai-auth-isolation.test.ts`
  *encodes* two of these in an allowlist, so it does not fail on them.
- **A scheduled workflow DOES write Firestore.** `.github/workflows/aaradhane.yml` runs on cron
  `30 3 1 1 *` (Jan 1) and invokes `scripts/generate-aaradhane.ts` **without `--dry-run`**, reaching
  `updateFirestoreWithAdmin()` → `docRef.set()/update()` on the **`events`** collection
  (`lib/aaradhane/firestore-admin.ts:19,215-229`). Gotcha: `generate-aaradhane.ts` defaults
  `firestore: false`, which only selects the *local* Guru Parampara file for **reading** — the
  "STEP 3: Updating Firestore" block still writes whenever `--dry-run` is absent. So `events` cannot
  be cut over by migrating rows alone; the workflow must be retired/re-pointed. Other scheduled
  workflows (`panchanga.yml`, `seva-backup.yml`, `seva-maintenance.yml`) do not touch Firestore.
  (Rev 1 of the audit wrongly claimed no workflow was scheduled — re-check every claim.)
- 45 Supabase tables, all RLS-enabled. **56 `CREATE POLICY` statements across 44 of 45 tables**:
  48 named `Deny all …`, **3 named `Deny …`** (the per-op write/update/delete denials on
  `ai_knowledge`), and **5 permissive `Allow …` reads** covering 4 tables (`temple_areas` ×2,
  `site_settings`, `social_links`, `ai_knowledge`); `seva_list_items` has RLS but no policy. So 41
  tables are effectively service-role-only. (An earlier note said "8 permissive" — wrong: a
  "not starting with 'Deny all'" filter also catches the 3 `Deny …` policies.) `mapSevaBooking`
  (`migration-mappers.ts:705`) has no `FieldCoverageSpec`, and `migrate-all-batched.ts:331` calls
  `migrateSupabaseCollection` without the `fieldSpec` arg → its unmapped-field audit is silently
  skipped. Firebase Storage objects have no migration path at all.
- **Counting gotcha:** `grep`/regex census of SQL is easy to get wrong here — policy names contain
  spaces, so `CREATE POLICY "Name" ON tbl` needs `(?:"([^"]+)"|(\w+))`, and per-table grouping needs
  the same tolerance. A naive regex reported "4 policies" (rev 1) and "0 policies" (first retry).
- **Pushing after a rebase:** the branch was rebased, so `git push` was rejected non-fast-forward.
  Rather than force-push, rebuild rev 2 as a new commit on top of the *remote* tip
  (`git checkout -B <branch> <remote-tip>` then `git checkout <new-commit> -- <path>`) and push
  normally — history stays append-only and the PR updates cleanly.
- **Local `origin/main` can be stale.** `git diff origin/main HEAD` showed 10 unrelated files after
  the rebase; the *server-computed* PR file list (`/pulls/N/files`) correctly showed 1 file. Trust
  the API for PR scope, not a possibly-stale local ref.
- Full audit: `docs/FIRESTORE_SUPABASE_MIGRATION_GAP_AUDIT.md` on branch
  `audit/firestore-supabase-migration-gap` (pushed; PR #352, **open and NOT a draft**).
  Rev 2 = `47a86bc` (based on remote tip `0b76948`); final-review corrections = `d04c951`
  (inventory 61, RLS census, revision drift, new §9.1). CI all green on `d04c951`
  (incl. gating "Lint, typecheck, test, build", Vercel, CodeQL).
- **Test totals are revision-dependent:** `npx jest tests/unit --silent` = 185 suites / 2247 tests
  at `c56ef97`, 186 / 2264 at `53bad41`. Always name the commit with a test count.
  `verify:supabase-migrations:static` exits **2** by design ("static passed, live skipped") — never
  report it as a passing CI exit code.
  Local-only safety refs: tag `safety/rev2-d80536d`, branch `backup/pre-rebase-0b76948`.

