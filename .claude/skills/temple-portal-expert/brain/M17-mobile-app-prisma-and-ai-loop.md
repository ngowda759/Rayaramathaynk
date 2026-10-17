# M17 - New since 2026-09-19 - the Expo mobile app, the Prisma layer, the .ai autonomous loop and the new root reports
> Brain file for the temple-portal expert skill. Written 2026-10-18 from code, not from docs (new chunk; nothing here existed in the 2026-09-19 snapshot). Read against HEAD `3d6aa9d` (the knowledge-base port commit on top of `424fdb8`); verified 2026-10-18 against `43361a3` (docs-only on top, code identical). Verify against the code before acting on any claim.

## Answers questions about

- "is there a mobile app, what is it built with and what version of Expo / React Native?"
- "which screens does the mobile app have and what does each one show?"
- "where does the mobile app get its data - the web API or Supabase directly?"
- "why are the mobile Home, Sevas, Events and Gallery tabs empty?"
- "how does the mobile Raya AI tab talk to the chatbot?"
- "does the mobile app have login, seva booking, donations, receipts, panchanga, notifications, Kannada?"
- "what does the mobile app share with the web app (types, tokens, packages)?"
- "does the mobile app follow the Option B plan in docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md section 4?"
- "what is Prisma doing in this repo, which tables does it model, and who imports `@prisma/client`?"
- "did Prisma replace the Supabase client?"
- "what is the Prisma baseline and why are there two `20261015000000_baseline_raya_ai` files?"
- "what is the `.ai/` folder and how does the autonomous AI development loop work?"
- "which GitHub workflows drive the loop, what triggers them and what can they write?"
- "who implements, who reviews and who merges in the AI loop?"
- "which AI-loop tasks were actually delivered (AI-001 ... AI-008)?"
- "what is protected from the AI loop and what is not?"
- "what do BOT-005-security-report.md, FIREBASE_MIGRATION_PHASE1_AUDIT.md, the FIRESTORE_*_REPORT.md files and MIGRATION_DATA_RECONCILIATION_REPORT.md say, and are they true?"
- "what is the stray `.patch` file at the root and the empty `.nojekyll`?"
- "what security or architecture problems did these new areas introduce?"
- "what would the mobile app still need before it could ship to the stores?"

## Purpose and business role

Four unrelated additions landed between 2026-09-21 and 2026-10-16, all written by bots (`google-labs-jules[bot]`, `openhands`, `github-actions[bot]`) and merged by one human maintainer:

1. **`apps/mobile`** - an Expo Router devotee app (7 tabs + one modal) created 2026-09-30 in three Jules commits (`0cb71b6` "Mobile app reconstruction", `5813fc9` "Final Mobile Hardening", `a93cc34`). It is a read-only brochure: temple info, daily poojas, sevas list/detail, events, gallery, a Raya AI chat, and a "More" menu. No login, no booking, no payment. It reads Supabase tables directly with the anon key; only the chat goes through the web API (`POST /api/chat`).
2. **`prisma/`** + `prisma.config.ts` + `lib/prisma.ts` - a Prisma 7 schema that *mirrors* nine existing Supabase tables (the Raya AI tables plus `users`/`profiles`), a baseline migration meant to be recorded as "applied" on the live ledger, and a server-only client singleton. Added 2026-10-15 by OpenHands (`2e8f0b1`, "PR-1"). Nothing imports the client yet.
3. **`.ai/`** - a repository-owned "autonomous AI development loop" (loop id AI-001): a next-task/architect stage and an implementer (Jules), an external reviewer model (OpenRouter `openrouter/free`), a merge gate and a task queue, driven by five `.github/workflows/ai-loop-*.yml` workflows. It has closed eight tasks (AI-001 ... AI-008) between 2026-10-03 and 2026-10-14; only two of them produced application code.
4. **Root reports** - six bot- or maintainer-written status reports about the Firestore -> Supabase migration and the BOT-005 security hardening, a leftover `git format-patch` file, and an empty `.nojekyll`.

None of these change what a devotee sees on the website. The mobile app is the first second client of the backend, which is exactly the situation the 2026-09-19 report said must not happen before server-side auth and an API contract exist.

## Code roots

| Root | Tracked files | Notes |
|---|---:|---|
| `apps/mobile` | 34 | 16 source/config files, 1 lockfile (10,054 lines), 8 PNG assets, `LICENSE` (Expo template MIT), `.gitignore`, README, AGENTS |
| `prisma` | 3 | `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql` |
| `app/api/mobile` | 0 | **Does not exist.** No mobile-specific API was built (see M17-F03) |
| `.ai` | 34 | 3 top-level JSON, 6 prompts, 5 schemas, 17 scripts (15 `.mjs` + 2 `.d.mts`), 3 state files |
| root files | 8 | `.nojekyll`, `0001-feat-implement-sevaBookings-mapper-and-fix-chat_mess.patch`, `BOT-005-security-report.md`, `FIREBASE_MIGRATION_PHASE1_AUDIT.md`, `FIRESTORE_COUNTS_EXECUTION_REPORT.md`, `FIRESTORE_EXPORT_REPORT.md`, `FIRESTORE_PRODUCTION_EXPORT_REPORT.md`, `MIGRATION_DATA_RECONCILIATION_REPORT.md` |

**Adopted** (unassigned in `.claude/state/inventory/SUMMARY.md`, or a root config with no owner): `prisma.config.ts`, `scripts/resolve-baseline-raya-ai.mjs`.
**Covered by reference, owned elsewhere:** `lib/prisma.ts` (M01); `.github/workflows/ai-loop-implement.yml`, `.github/workflows/ai-loop-review.yml`, `.github/workflows/ai-loop-merge-gate.yml`, `.github/workflows/ai-loop-next-task.yml`, `.github/workflows/ai-loop-validate.yml`, `.github/workflows/prisma-baseline-drift-gate.yml`, `.github/workflows/resolve-raya-ai-baseline.yml` (M15); `tests/automation-loop/loop-scripts.test.ts`, `tests/automation-loop/review-loop.test.ts`, `tests/unit/prisma-schema-baseline.test.ts`, `docs/PRISMA-SCHEMA-BASELINE.md` (M15); `scripts/lib/check-baseline-drift-scope.mjs` (M11).

## Entry points

| Route or entry | File | Kind | Auth required | What it renders or does |
|---|---|---|---|---|
| app entry | `apps/mobile/package.json:4` (`"main": "expo-router/entry"`) | native | - | Expo Router boots `apps/mobile/app/_layout.tsx` |
| root stack | `apps/mobile/app/_layout.tsx` | client (RN) | no | `Stack` with `(tabs)` (no header) and `sevas/[id]` as a modal titled "Seva Details" |
| tab navigator | `apps/mobile/app/(tabs)/_layout.tsx` | client | no | 7 `Tabs.Screen`: index, temple, sevas, events, gallery, ai, more; maroon header `#800000`, gold active tint `#D4AF37` |
| `/` Home tab | `apps/mobile/app/(tabs)/index.tsx` | client | no | temple name + city from settings, daily poojas list, darshan timings |
| `/temple` | `apps/mobile/app/(tabs)/temple.tsx` | client | no | about text, timings, address/phone/email, "Get Directions" deep link to Maps |
| `/sevas` | `apps/mobile/app/(tabs)/sevas.tsx` | client | no | searchable `FlatList` of sevas -> push `/sevas/[id]` |
| `/sevas/[id]` | `apps/mobile/app/sevas/[id].tsx` | client | no | seva title, amount, description, "Contact temple authorities for booking" |
| `/events` | `apps/mobile/app/(tabs)/events.tsx` | client | no | `FlatList` of published events with a date box |
| `/gallery` | `apps/mobile/app/(tabs)/gallery.tsx` | client | no | albums, each a horizontal `FlatList` of `expo-image` thumbnails |
| `/ai` | `apps/mobile/app/(tabs)/ai.tsx` | client | no | chat UI posting to `${EXPO_PUBLIC_API_URL}/api/chat` |
| `/more` | `apps/mobile/app/(tabs)/more.tsx` | client | no | Visit Website, Share App, Privacy Policy links; app version |
| Prisma client | `lib/prisma.ts` | server-only | n/a | singleton `PrismaClient` over `@prisma/adapter-pg`; **0 importers** |
| Prisma CLI config | `prisma.config.ts` | node | DB URL from env | points Prisma at `prisma/schema.prisma` and `prisma/migrations`; URL from `PRISMA_DATABASE_URL` or `SUPABASE_DB_URL` |
| `npm run prisma:*` | `package.json:6-11,53-54` | npm scripts | - | generate / validate / format / baseline / drift / drift:scoped / resolve:baseline; `postinstall` runs `prisma generate` |
| AI loop: implement | `.github/workflows/ai-loop-implement.yml` | GH Actions | `JULES_API_KEY` | on push to `main` touching `.ai/state/task-queue.json` (`:17-21`): pick the approved task, dispatch Jules with `automationMode: AUTO_CREATE_PR` |
| AI loop: review | `.github/workflows/ai-loop-review.yml` | GH Actions (`workflow_run` of CI, `:38-41`) | `OPENROUTER_API_KEY` | wait for CI, ask the reviewer model for a JSON verdict, comment on the PR, route the verdict |
| AI loop: merge gate | `.github/workflows/ai-loop-merge-gate.yml` | GH Actions (`workflow_run` of review, `:17-20`) | `contents: write` | evaluate the gate; with `autoMerge: false` it never merges |
| AI loop: next task | `.github/workflows/ai-loop-next-task.yml` | GH Actions (`pull_request: closed`, push, dispatch, `:44-51`) | `contents: write` | mark the task done, push the state to `main`, dispatch the next-task conversation to Jules |
| AI loop: validate | `.github/workflows/ai-loop-validate.yml` | GH Actions | read | schema-validate `.ai/` config/state, lint workflows, assert trusted-workflow invariants |

## Component trees

All mobile components are React Native client components; there are no shared components, hooks or a `components/` folder (the README mentions one "if separated in future", `apps/mobile/README.md:23`).

```
RootLayout (client) apps/mobile/app/_layout.tsx
├─ Stack (expo-router)
│  ├─ Stack.Screen "(tabs)" headerShown:false
│  │  └─ TabLayout (client) apps/mobile/app/(tabs)/_layout.tsx  -> Tabs + Ionicons
│  │     ├─ HomeScreen (client) app/(tabs)/index.tsx
│  │     │   ScrollView > hero View(Text temple_name, Text address.split(',')[0])
│  │     │   > section "Daily Poojas" (ActivityIndicator | poojas.map Row(Text time, Text title))
│  │     │   > section "Darshan Timings" (settings.timings.morning/evening)
│  │     │   hooks: useState x3, useEffect -> Promise.all([fetchDailyPoojas(), fetchWebsiteSettings()])
│  │     │   data: lib/api.ts -> lib/supabase.ts -> Supabase daily_poojas, website_settings
│  │     ├─ TempleScreen (client) app/(tabs)/temple.tsx
│  │     │   ScrollView > card About(aboutText) > card Timings(Ionicons sunny/moon)
│  │     │   > card Location&Contact (+ TouchableOpacity "Get Directions" -> openMap)
│  │     │   hooks: useState x2, useEffect -> fetchWebsiteSettings()
│  │     │   native: Linking.canOpenURL/openURL (maps: / geo: / https google maps), Platform.select
│  │     ├─ SevasScreen (client) app/(tabs)/sevas.tsx
│  │     │   View > TextInput(search) > FlatList(cards: title, description, ₹amount) -> router.push(`/sevas/${id}`)
│  │     │   hooks: useState x3, useEffect -> fetchSevas(), useRouter
│  │     ├─ EventsScreen (client) app/(tabs)/events.tsx
│  │     │   FlatList(card: dateBox(format MMM/dd via date-fns), title, description, start_time)
│  │     │   hooks: useState x2, useEffect -> fetchEvents()
│  │     ├─ GalleryScreen (client) app/(tabs)/gallery.tsx
│  │     │   FlatList(albums) > per album: Text title > horizontal FlatList(expo-image Image uri=media.url)
│  │     │   hooks: useState x2, useEffect -> fetchGalleryAlbums()
│  │     ├─ AIScreen (client) app/(tabs)/ai.tsx
│  │     │   KeyboardAvoidingView > FlatList(message bubbles, plain Text) > input row(TextInput, send TouchableOpacity)
│  │     │   hooks: useState x3; handler sendMessage -> fetch POST {API_URL}/api/chat {messages}
│  │     └─ MoreScreen (client) app/(tabs)/more.tsx
│  │         menu: Linking.openURL(site), Share.share, Linking.openURL(site/privacy-policy); Constants.expoConfig.version
│  └─ Stack.Screen "sevas/[id]" presentation:'modal'
│     └─ SevaDetailScreen (client) app/sevas/[id].tsx
│         hooks: useLocalSearchParams<{id}>, useState x3, useEffect -> supabase.from('sevas').select('*').eq('id',id).single()
│         (imports lib/supabase.ts directly - the only screen that bypasses lib/api.ts)
└─ StatusBar (expo-status-bar)
```

AI loop composition (process, not UI):

```
ai-loop-next-task.yml  (pull_request closed | push | dispatch)
 ├─ validate-loop-config.mjs  -> loop-schema.mjs -> schemas/*.json
 ├─ advance-after-merge.mjs   -> loop-core.mjs classifyMergedLoopPr / selectMergedTaskPr
 │                             -> loop-state.mjs (complete, set next-task); writes state/task-queue.json
 ├─ git commit + git push origin HEAD:main  (state files only)
 ├─ loop-tasks.mjs enforce-single
 └─ dispatch-conversation.mjs --stage next-task  -> prompts/system.md + prompts/next-task.md -> Jules API
        Jules opens a PR adding docs/tasks/<id>.md and appending the brief to state/task-queue.json
ai-loop-implement.yml  (push to main touching state/task-queue.json)
 ├─ loop-tasks.mjs active / enforce-single / start   (start is never committed)
 └─ dispatch-conversation.mjs --stage implement -> prompts/system.md + prompts/implementation.md -> Jules (AUTO_CREATE_PR)
CI (ci.yml) on the PR
ai-loop-review.yml  (workflow_run: CI completed)
 ├─ assert-trusted-review.mjs ; resolve-review-pr.mjs ; validate-loop-config.mjs
 ├─ wait-for-ci.mjs
 └─ chatgpt-review.mjs -> review-core.mjs (planReview, classifyCi, buildReviewRequestBody, decisionFor)
        -> fetch OpenRouter -> PR comment carrying <!-- ai-loop-review round head verdict -->
        -> changes-requested: dispatchFix -> dispatch-conversation.mjs --stage fix  (exits 1: unsupported)
ai-loop-merge-gate.yml (workflow_run: AI loop review completed)
 └─ merge-gate.mjs -> loop-core.mjs evaluateMergeGate -> autoMerge:false => "passed every gate; auto-merge is disabled" (exit 0)
Human merges the PR -> ai-loop-next-task.yml again
```

## Data flow

1. **Mobile Sevas list -> detail.** `SevasScreen` mounts -> `useEffect` -> `fetchSevas()` (`apps/mobile/lib/api.ts:3-13`) -> `supabase.from('sevas').select('*').eq('active', true).gt('amount', 0).order('display_order')` with the anon key from `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`apps/mobile/lib/supabase.ts:5-15`) -> Supabase `sevas`, whose only policy is `FOR ALL TO public USING (false)` (`supabase/migrations/20260907112632_create_core_tables.sql:86-90`) -> zero rows, no error -> `setSevas([])` -> "No sevas found". Even with rows the list would still be empty: the search filter `s.title?.toLowerCase().includes(search...)` (`apps/mobile/app/(tabs)/sevas.tsx:27-29`) evaluates to `undefined` for every row because the column is `name`, not `title` (`supabase/migrations/20260907112632_create_core_tables.sql:16`), so every row is filtered out before the card (`apps/mobile/app/(tabs)/sevas.tsx:53`) ever renders. Tap -> `router.push('/sevas/<id>')` -> `SevaDetailScreen` queries `sevas` by id directly (`apps/mobile/app/sevas/[id].tsx:22-26`) -> `.single()` errors on 0 rows -> "Seva not found or temporarily unavailable."
2. **Mobile Home / Temple.** `Promise.all([fetchDailyPoojas(), fetchWebsiteSettings()])` (`apps/mobile/app/(tabs)/index.tsx:14-17`) -> `daily_poojas` (deny-all RLS, `supabase/migrations/20260907112632_create_core_tables.sql:92-96`; the field read is `time`, the column is `start_time`, `:40`) and `website_settings` (`apps/mobile/lib/api.ts:47-56`) - **a table no migration creates**; the closest are `site_settings` (`supabase/migrations/20261010000000_create_settings.sql:4`) and `settings_documents` (`supabase/migrations/20260922000000_create_settings_documents.sql:17`). PostgREST returns an error, `load()` logs it and the screen shows "Temple Information Unavailable" / "Location Unavailable" (`apps/mobile/app/(tabs)/index.tsx:32-33`); the Temple tab shows "Temple information is currently unavailable." (`apps/mobile/app/(tabs)/temple.tsx:62-64`).
3. **Mobile Gallery.** `fetchGalleryAlbums()` selects `gallery_albums` with an embedded `gallery_media(*)` (`apps/mobile/lib/api.ts:37-45`). Both tables are deny-all (`supabase/migrations/20261001000000_create_content_tables.sql:125,150`); `gallery_media.album_id` is a "loose reference" with no foreign key (`:133`, widened to text by `supabase/migrations/20261002000000_align_content_firestore_ids.sql:33-40`), so PostgREST cannot resolve the embed; and the image uri reads `media.url` while the column is `image_path` (`supabase/migrations/20261001000000_create_content_tables.sql:138`).
4. **Mobile Raya AI.** `sendMessage` (`apps/mobile/app/(tabs)/ai.tsx:26-88`) -> POST `${EXPO_PUBLIC_API_URL || 'https://www.srsmathaynk.com'}/api/chat` with `{ messages: [{role, content}...] }` (no `sessionId`, `userId` or `detectedLanguage`) -> `app/api/chat/route.ts:100` destructures `{messages, sessionId, userId, detectedLanguage}`, rate-limits by `x-forwarded-for` (`app/api/chat/route.ts:71-85`), runs the M08 engine, returns `{ message, sessionId }` (`app/api/chat/route.ts:304-306`) -> the app keeps only `message.id/content` (`apps/mobile/app/(tabs)/ai.tsx:68-73`) and drops the returned `sessionId`, so every turn starts a new server session (and the server's reply `sessionId` for a session-less call is a fresh `crypto.randomUUID()`, not the id it stored under, `app/api/chat/route.ts:158` vs `:306` - so even a client that kept it would only continue from turn 2, R-079); the Markdown answer is shown as plain `Text` (`apps/mobile/app/(tabs)/ai.tsx:105-108`). This is the **only** mobile path that uses the web API, and the only one that can work today.
5. **Prisma (intended, not wired).** A future repository would `import { prisma } from "@/lib/prisma"` -> `PrismaClient({ adapter: new PrismaPg({ connectionString }) })` (`lib/prisma.ts:39-51`) -> models `AiSettings`, `AiKnowledge`, `ChatSession`, `ChatMessage`, `UnknownQuestion`, `AiIntentDistribution`, `AiLatencyRecord`, `User`, `Profile` (`prisma/schema.prisma:32-265`). Today a repo-wide grep for `lib/prisma`, `@prisma/client` and `generated/prisma` in application code finds only `lib/prisma.ts:5` itself; all runtime Supabase access still goes through `@supabase/supabase-js` (`lib/supabase/admin.ts`, `lib/supabase/server.ts`).
6. **AI loop, one task.** Human merges a Jules "next task" PR that appends a brief to `.ai/state/task-queue.json`. That one merge fires two workflows at once: (a) the merge is a push to `main` touching `task-queue.json`, so `ai-loop-implement.yml` (`.github/workflows/ai-loop-implement.yml:17-21`) dispatches Jules to implement the newly approved task; (b) `pull_request: closed` runs `ai-loop-next-task.yml` -> `advance-after-merge.mjs` -> `classifyMergedLoopPr` (`.ai/scripts/loop-core.mjs:158-193`; the `AI-\d+` title/branch rule at `:174-178` is skipped only when the branch contains the literal `next-task`) -> if it attributes a task it marks it `done` (`.ai/scripts/advance-after-merge.mjs:212-219`) and pushes the state to `main` with `GITHUB_TOKEN` (`.github/workflows/ai-loop-next-task.yml:120-131`). A `GITHUB_TOKEN` push does not start other workflow runs (GitHub platform rule), so that state push does **not** re-trigger implement or the `push` recovery path of next-task (see M17-F25). Then -> Jules opens a PR -> CI -> `ai-loop-review.yml` -> `chatgpt-review.mjs` asks OpenRouter -> PR comment with a verdict marker -> `ai-loop-merge-gate.yml` evaluates and stops because `autoMerge` is `false` (`.ai/loop.config.json:54`, `.ai/scripts/merge-gate.mjs:222-225`) -> a human merges. See M17-F04 for why step 2 completes the wrong thing.

## Key files

### apps/mobile

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `apps/mobile/package.json` | 67 | manifest | - | Expo `~57.0.25`, react-native `0.86.3`, React `19.2.3`, expo-router `~57.0.23`, nativewind `^4.2.7`, tailwindcss `^3.4.19`, TypeScript `~6.0.3`; `"build": "npx expo export -p ios"` (iOS only, `:58`); disables `no-explicit-any` (`:61-65`); not a workspace of the root |
| `apps/mobile/package-lock.json` | 10054 | lockfile | - | 756 package entries; separate from the root lockfile |
| `apps/mobile/app.json` | 43 | Expo config | - | name "Sri Raghavendra Swamy Temple", slug `rayara-matha-ynk`, scheme `rayaramathaynk`, bundle/package `com.rayaramathaynk.mobile`, plugins expo-router, expo-font, expo-secure-store, expo-notifications, expo-status-bar; `typedRoutes` |
| `apps/mobile/babel.config.js` | 10 | Babel | - | `babel-preset-expo` with `jsxImportSource: "nativewind"` + `nativewind/babel` |
| `apps/mobile/tailwind.config.js` | 21 | Tailwind 3 | - | `temple.*` colours (gold `#D4AF37`, maroon `#800000`, cream, saffron); content globs include a non-existent `components/` |
| `apps/mobile/app/global.css` | 11 | Tailwind entry | - | **never imported**; no `metro.config.js` exists, so NativeWind is not wired |
| `apps/mobile/app/global.d.ts` | 5 | ambient types | `*.css` module | unused |
| `apps/mobile/eslint.config.mjs` | 8 | ESLint flat config | - | only `"@typescript-eslint/no-explicit-any": "off"`; no parser or plugin loaded |
| `apps/mobile/tsconfig.json` | 7 | TS | - | extends `expo/tsconfig.base`, `strict: true` |
| `apps/mobile/.gitignore` | 41 | ignore | - | Expo template; ignores `/ios`, `/android`, `.env*.local` |
| `apps/mobile/LICENSE` | - | MIT (650 Industries) | - | Expo template leftover |
| `apps/mobile/README.md` | 35 | doc | - | env vars `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`; EAS build; push "to be implemented" |
| `apps/mobile/AGENTS.md` | 42 | agent doc | - | generic Expo template; says routes live in `src/app/` (`:28`), they live in `app/` |
| `apps/mobile/app/_layout.tsx` | 16 | root stack | `default RootLayout` | no fonts, no splash handling, no providers, no auth gate |
| `apps/mobile/app/(tabs)/_layout.tsx` | 68 | tabs | `default TabLayout` | 7 tabs; colours hard-coded (`:9-14`) |
| `apps/mobile/app/(tabs)/index.tsx` | 123 | Home | `default HomeScreen` | imports 5 types, uses 2 (`:3`) |
| `apps/mobile/app/(tabs)/temple.tsx` | 157 | Temple | `default TempleScreen` | coordinate validation `:31-35`; sensible native deep-link fallback `:46-55` |
| `apps/mobile/app/(tabs)/sevas.tsx` | 92 | Sevas list | `default SevasScreen` | placeholder "Search poojas and sevas" but only sevas |
| `apps/mobile/app/sevas/[id].tsx` | 144 | Seva detail modal | `default SevaDetailScreen` | queries Supabase directly, bypassing `apps/mobile/lib/api.ts` |
| `apps/mobile/app/(tabs)/events.tsx` | 97 | Events | `default EventsScreen` | no filter on past events though the empty text says "No upcoming events" |
| `apps/mobile/app/(tabs)/gallery.tsx` | 69 | Gallery | `default GalleryScreen` | `Math.random()` key fallback `:39` |
| `apps/mobile/app/(tabs)/ai.tsx` | 184 | Raya AI chat | `default AIScreen` | the only API consumer; good HTTP-status messages `:50-58` |
| `apps/mobile/app/(tabs)/more.tsx` | 87 | More | `default MoreScreen` | links to `/privacy-policy`, which no web route serves |
| `apps/mobile/lib/supabase.ts` | 16 | Supabase client | `supabase` | `createClient(url || '', key || '')` with AsyncStorage persistence; nothing ever signs in |
| `apps/mobile/lib/api.ts` | 57 | data access | `fetchSevas`, `fetchEvents`, `fetchDailyPoojas`, `fetchGalleryAlbums`, `fetchWebsiteSettings` | 5 direct table reads; untyped results |
| `apps/mobile/lib/types.ts` | 46 | mobile-only types | `WebsiteSettings`, `Seva`, `Pooja`, `Event`, `Album` | hand-written; disagree with both `types/*.ts` and the SQL columns |
| `apps/mobile/assets/icon.png`, `apps/mobile/assets/favicon.png`, `apps/mobile/assets/splash-icon.png`, `apps/mobile/assets/android-icon-background.png`, `apps/mobile/assets/android-icon-foreground.png`, `apps/mobile/assets/android-icon-monochrome.png` | - | Expo template images | - | **unused**: `apps/mobile/app.json` points every icon at `ynk_matha_logo.png` |
| `apps/mobile/assets/images/logos/ynk_matha_logo.png`, `apps/mobile/assets/images/logos/social-preview.png` | - | brand images | - | logo used for icon, adaptive icon, favicon and notification icon (`apps/mobile/app.json:7,16,24,33`); `social-preview.png` unused |

### Prisma

| File | Lines | Role | Key exports | Notes |
|---|---:|---|---|---|
| `prisma/schema.prisma` | 265 | schema mirror | 9 models | header says the SQL migrations stay the source of truth (`:3-10`); generator `prisma-client` -> `../generated/prisma` (`:15-18`, gitignored at `.gitignore:51`); datasource URL deliberately absent (`:20-25`) |
| `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql` | 222 | Prisma baseline | - | 9 `CREATE TABLE` + 18 indexes; **no** triggers, RLS or policies; plain `CREATE TABLE` - meant to be *marked applied*, never executed |
| `prisma/migrations/migration_lock.toml` | 3 | lock | - | `provider = "postgresql"` |
| `prisma.config.ts` (adopted) | 31 | Prisma 7 config | default `defineConfig` | URL from `PRISMA_DATABASE_URL` ?? `SUPABASE_DB_URL`; imports `dotenv/config` |
| `lib/prisma.ts` (M01, by reference) | 61 | client singleton | `prisma`, default | `import "server-only"`; `PrismaPg` adapter; `globalThis` cache in dev; query logging opt-in via `PRISMA_LOG_QUERIES` |
| `scripts/resolve-baseline-raya-ai.mjs` (adopted) | 166 | guarded `migrate resolve --applied` | - | needs `RESOLVE_CONFIRM=resolve-baseline-raya-ai`, project ref and DB password; re-runs the scoped drift gate first; writes one row to `supabase_migrations.schema_migrations` |
| `supabase/migrations/20261015000000_baseline_raya_ai.sql` (M11, by reference) | 13 | ledger marker | - | comment-only file with the same version, added 2026-10-16 so the Supabase integration stops reporting a missing remote version |

Prisma models -> Supabase tables:

| Model | `@@map` | Source migration (per schema comment) | Mirrors faithfully? |
|---|---|---|---|
| `AiSettings` | `ai_settings` | `supabase/migrations/20261012000000_create_ai_settings_table.sql` | yes; `updatedAt` deliberately without `@updatedAt` (`prisma/schema.prisma:47-51`) |
| `AiKnowledge` | `ai_knowledge` | `supabase/migrations/20261013000000_create_ai_knowledge.sql` | yes; the live table was created 2026-10-16 by a guarded apply (`docs/PRISMA-SCHEMA-BASELINE.md` §4.1.3) |
| `ChatSession` | `chat_sessions` | `supabase/migrations/20260930000000_create_ai_tables.sql` | yes |
| `ChatMessage` | `chat_messages` | same | yes; no FK to sessions on purpose (`prisma/schema.prisma:120-126`) |
| `UnknownQuestion` | `unknown_questions` | same | yes |
| `AiIntentDistribution` | `ai_intent_distribution` | same | yes |
| `AiLatencyRecord` | `ai_latency_records` | same | yes |
| `User` | `users` | `supabase/migrations/20261001000000_create_content_tables.sql` | yes; described as the future RBAC source ("PR-3") - not done, `lib/auth/admin.ts` still checks Firestore |
| `Profile` | `profiles` | same | yes |

Not modelled (owned by other modules, deferred per `docs/PRISMA-SCHEMA-BASELINE.md` §5 item 5): `sevas`, `daily_poojas`, `events`, `seva_bookings`, `settings_documents`, `site_settings`, `social_links`, `donation_campaigns`, `donations`, `gallery_albums`, `gallery_media`, `testimonials`, `aaradhanes`, `volunteer_requests`, `temple_areas`.

**Did Prisma replace the Supabase client? No.** It sits beside it and is not used at runtime. The only `@prisma/*` import in the code base is `lib/prisma.ts:3-5`, and nothing imports `lib/prisma.ts` (`.claude/state/inventory/import-graph.json` has no edge into it; a repo-wide grep confirms). `package.json:60-61,84,124` adds `@prisma/adapter-pg`, `@prisma/client`, `pg` and `prisma`, and `postinstall: prisma generate` (`package.json:53`), so every `npm ci` now generates a client nobody calls.

### .ai (the autonomous loop)

| File | Lines | Role | Key exports / commands | Notes |
|---|---:|---|---|---|
| `.ai/loop.config.json` | 77 | all loop knobs | - | `maxReviewRounds 3`, `baseBranch main`, `requiredChecks ["Lint, typecheck, test, build"]`, `protectedPaths` (`:12-18`), secrets `JULES_API_KEY`, `OPENROUTER_API_KEY`, reviewer `openrouter/free` (`:29-38`), `mergeGate.requireHumanApproval: true` (`:43`), `automation.autoMerge: false` (`:54`), limits 60 files / 2,500 diff lines |
| `.ai/current-task.json` | 10 | stale bootstrap marker | - | still "AI-001 in_progress" - superseded by `.ai/state/loop-state.json` |
| `.ai/development-plan.json` | 62 | phase list | - | M0 "Development Automation" in progress; M1-M8 are mobile phases ("Mobile Application Audit", "Seva Booking", ... "Android / iOS Release Readiness"), all `pending` with no tasks |
| `.ai/prompts/system.md` | 125 | shared contract | - | roles table (`:8-16`), "the loop merges, a human does not" (`:40-43`), hard stops (`:97-114`) |
| `.ai/prompts/architect.md` | 58 | architect stage | - | brief schema, `humanApproval: false` |
| `.ai/prompts/next-task.md` | 45 | next-task stage | - | "never propose a task that starts mobile implementation" (`:33-34`) |
| `.ai/prompts/implementation.md` | 59 | implementer stage | - | Vitest, `npm run format`, `npm run test:e2e`, `.ai/templates/` - none exist here |
| `.ai/prompts/fix.md` | 59 | fixer stage | - | FIXED/DECLINED protocol |
| `.ai/prompts/review.md` | 126 | reviewer stage | - | JSON-only verdict; names OpenHands as fixer (`:5`) and `packages/infrastructure` (`:44`) |
| `.ai/schemas/loop-config.schema.json` | 260 | JSON Schema | - | required keys of the config |
| `.ai/schemas/loop-state.schema.json` | 127 | JSON Schema | - | status enum, round, currentPr, history |
| `.ai/schemas/review-report.schema.json` | 126 | JSON Schema | - | verdict, findings, acceptanceCriteria |
| `.ai/schemas/task-brief.schema.json` | 117 | JSON Schema | - | id, title, phase, status, acceptanceCriteria, outOfScope, humanApproval |
| `.ai/schemas/task-queue.schema.json` | 17 | JSON Schema | - | `{version, updatedAt, tasks[]}` |
| `.ai/scripts/loop-core.mjs` | 802 | pure rules | `loadConfig`, `isAiManagedPullRequest`, `classifyMergedLoopPr`, `selectMergedTaskPr`, `resolveNextTaskId`, `validateTaskSequence`, `assertSingleActiveTask`, `protectedPathViolations`, `CREDENTIAL_PATTERNS`, `TRANSITIONS`, `evaluateMergeGate`, `HARD_STOPS`, `classifyEvent` | state machine `:504-525`; merge gate `:601-743` |
| `.ai/scripts/loop-core.d.mts` | 209 | types for tests | - | declaration file so `tests/automation-loop/*.test.ts` type-check |
| `.ai/scripts/review-core.mjs` | 767 | pure review rules | `reviewMarker`, `parseReviewMarkers`, `reviewedHeads`, `planReview`, `classifyCi`, `coerceVerdict`, `normalizeModelReport`, `validateReport`, `buildReviewRequestBody`, `parseModelJson`, `decisionFor`, `buildComment`, `buildFixContext` | marker regex `:24-25` |
| `.ai/scripts/review-core.d.mts` | 176 | types for tests | - | - |
| `.ai/scripts/chatgpt-review.mjs` | 808 | review CLI | - | gh + OpenRouter `fetch` (`:300-310`); appends `review-log.jsonl` (`:331,731`); `dispatchFix` (`:404-433`, called `:777`) |
| `.ai/scripts/dispatch-conversation.mjs` | 235 | Jules dispatcher | - | concatenates prompts + context, POSTs `https://jules.googleapis.com/v1alpha/sessions` (`:205`); `--stage fix` exits 1 "currently unsupported" (`:146-152`); `AUTO_CREATE_PR` for implement (`:176-180`) |
| `.ai/scripts/advance-after-merge.mjs` | 341 | post-merge reconciler | - | `reconcileMerge` `:173-238` |
| `.ai/scripts/merge-gate.mjs` | 273 | merge CLI | - | `latestVerdict` `:111-120`; exits 0 without merging when `autoMerge` is false (`:222-225`) |
| `.ai/scripts/loop-state.mjs` | 356 | state CLI | `status`, `set`, `next-round`, `stop`, `complete`, `reset`, `recover`, `log` | schema-validated writes, `--force` escape hatch |
| `.ai/scripts/loop-tasks.mjs` | 340 | queue CLI | `active`, `next-id`, `start`, `complete`, `append`, `enforce-single`, `status` | `append` forces `humanApproval:false`, `status:"approved"` |
| `.ai/scripts/loop-schema.mjs` | 126 | mini JSON-Schema validator | `loadJson`, `validateAgainstSchema` | dependency-free |
| `.ai/scripts/validate-loop-config.mjs` | 210 | validator | - | config/state/queue/log against schemas + cross-file invariants |
| `.ai/scripts/validate-workflows.mjs` | 97 | workflow linter | - | no tabs, `permissions:` present, pinned `uses:` |
| `.ai/scripts/assert-trusted-review.mjs` | 160 | security guard | - | review + merge-gate workflows: checkout pinned to default branch, `persist-credentials: false`, no `npm ci`, no `pull_request_target` |
| `.ai/scripts/resolve-review-pr.mjs` | 166 | PR resolver for `workflow_run` | - | writes `number=` to `$GITHUB_OUTPUT` |
| `.ai/scripts/wait-for-ci.mjs` | 136 | CI poller | - | polls `gh pr checks` for `requiredChecks` |
| `.ai/scripts/detect-changed-areas.mjs` | 112 | path classifier | - | area rules for `apps/api`, `apps/web`, `packages/*` (`:16-31`) - another repository's layout |
| `.ai/state/loop-state.json` | 127 | live state | - | `status: "next-task"`, `completedTasks` AI-001...AI-008, last update 2026-10-14T16:26:10Z |
| `.ai/state/task-queue.json` | 252 | task queue | - | 8 tasks, all `done`, PRs 291, 301, 302, 304, 307, 314, 318, 322 |
| `.ai/state/review-log.jsonl` | 0 | review log | - | **empty** - no review was ever persisted |

What the loop actually delivered (from `.ai/state/task-queue.json` and `git show --stat <headSha>`):

| Task | Title | PR | What the recorded merge contains | Delivered? |
|---|---|---|---|---|
| AI-001 | Establish the loop | 291 | the `.ai/` tree itself | yes (infrastructure) |
| AI-002 | Interactive Temple Map Foundation | 301 | `.ai/state/task-queue.json` + `docs/tasks/AI-002-interactive-temple-map.md` + `docs/tasks/AI-002-interactive-temple-map.json` only | **no** - `app/(public)/map/page.tsx` never existed in history |
| AI-003 | Points of Interest | 302 | queue + `docs/tasks/AI-003-*` only | **no** |
| AI-004 | Accessibility Info | 304 | queue + `docs/tasks/AI-004-*` only | **no** |
| AI-005 | Festival Countdown | 307 | queue + `docs/tasks/AI-005-*` only | brief only (`components/festival/FestivalCountdown.tsx` exists, delivered outside this task record) |
| AI-006 | Festival Live Updates | 314 | state + queue + `docs/tasks/AI-006-festival-live-updates.md` (branch `jules-...`, merged after the `next-task` guard landed, so the guard did not catch it) | brief only (`components/festival/FestivalLiveUpdates.tsx` exists, delivered outside this record) |
| AI-007 | Festival Photo Highlights | 318 | `components/festival/FestivalExperience.tsx` | yes |
| AI-008 | Festival Guide | 322 | `components/festival/FestivalGuide.tsx`, its test, `FestivalExperience.tsx` | yes |

Every merge in that table was made by the human maintainer, not by the loop.

### Root reports - one line each

| File | Date (git) | Author | What it claims | Does the code agree? |
|---|---|---|---|---|
| `BOT-005-security-report.md` | 2026-10-14 -> 10-15 | Jules | `lib/supabase/admin.ts` is `server-only`; `NODE_ENV==="test"` bypasses removed; settings server actions gated by `checkAdminAuth`; CI `|| true` removed; `scripts/test-boundary.sh` enforces the boundary; 1,079 tests / 43 suites pass | **Mostly.** `lib/supabase/admin.ts:1` is `import 'server-only'`; no `NODE_ENV === "test"` left in `lib`/`app`/`services`; `.github/workflows/ci.yml` has no `|| true` and runs `./scripts/test-boundary.sh` (`:44`); `app/actions/settings.ts:26-35` calls `checkAdminAuth`. But that check reads an `Authorization: Bearer` header from the server-action request, which a browser-invoked action does not send, so in practice only `ADMIN_API_KEY` callers pass (`lib/auth/admin.ts:38`, plain `===`). Test count not verifiable statically (55 `*.test.ts(x)` files exist now) |
| `FIREBASE_MIGRATION_PHASE1_AUDIT.md` | 2026-09-23 | Jules | 64 collections inventoried, 0 have local source data, all `WAIT_FOR_FIRESTORE_EXPORT`; the 10 Supabase `sevas` rows are seed data from `scripts/seed-supabase-sevas.ts` | Consistent with the tree: `data/firestore-dump/` and `data/firestore-export/` do not exist; `data/exports/` holds only events/aaradhane generator output |
| `FIRESTORE_COUNTS_EXECUTION_REPORT.md` | 2026-10-01 | Jules | could not dispatch `firestore-review-counts.yml` (no `gh`, no token); all counts UNAVAILABLE; no writes | A non-result. The workflow exists (`.github/workflows/firestore-review-counts.yml`) |
| `FIRESTORE_EXPORT_REPORT.md` | 2026-09-21 | Jules | export via `npm run firestore:dump` blocked by missing credentials; 17 collections all `BLOCKED_NO_CREDENTIALS` | A non-result; consistent |
| `FIRESTORE_PRODUCTION_EXPORT_REPORT.md` | 2026-09-22 | Jules | export not performed, `FIREBASE_*` env vars missing | A non-result; duplicates the previous one |
| `MIGRATION_DATA_RECONCILIATION_REPORT.md` | 2026-09-21 | maintainer | live Supabase: almost every table empty; `events` 38 = 38; `sevas` 10 unexplained; `aaradhanes` 19 source vs 0 in Supabase = confirmed gap; names the project ref | Code cannot confirm live counts. Its live table list has no `website_settings`, corroborating M17-F02. Commits the project ref at `:37` |
| `0001-feat-implement-sevaBookings-mapper-and-fix-chat_mess.patch` | 2026-10-01 | Jules | `git format-patch` of "implement sevaBookings mapper and fix chat_messages mapping" | **Already applied**: `lib/supabase/migration-mappers.ts:705` has `mapSevaBooking`, `scripts/migrate-all-batched.ts:117` maps it, `lib/supabase/migration-inventory.ts:36,45` carry the edited rows. The file is a leftover |
| `.nojekyll` | 2026-10-16 | OpenHands (`c156d6c`) | empty; opts GitHub Pages out of Jekyll because Pages (legacy, repo root) failed to render `docs/UI-GUIDELINES.md` as Liquid | Fixes a red check, but means Pages publishes the repository root as static files (M17-F21) |

## Types and stores

**Types.** The mobile app uses only `apps/mobile/lib/types.ts` (5 interfaces) plus two inline interfaces in `apps/mobile/app/(tabs)/ai.tsx:5-17`. It imports nothing from the web `types/` tree; there is no `packages/` directory. Field-by-field disagreement with the real columns:

| Mobile type field | Read in | Real column | Source |
|---|---|---|---|
| `Seva.title` | `apps/mobile/app/(tabs)/sevas.tsx:28,53`, `apps/mobile/app/sevas/[id].tsx:61` | `sevas.name` | `supabase/migrations/20260907112632_create_core_tables.sql:16` |
| `Pooja.time` | `apps/mobile/app/(tabs)/index.tsx:43` | `daily_poojas.start_time` | same file `:40` |
| `Album.cover_url` | declared only | `gallery_albums.cover_image` | `supabase/migrations/20261001000000_create_content_tables.sql:114` |
| `Album.gallery_media[].url` | `apps/mobile/app/(tabs)/gallery.tsx:43` | `gallery_media.image_path` | same file `:138` |
| `WebsiteSettings.*` (from `website_settings.value`) | `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/temple.tsx` | table does not exist; `site_settings` has `temple_name`, `contact_email`, `contact_phone`, `address` but no `timings`, `aboutText`, `location_lat/lng` | `supabase/migrations/20261010000000_create_settings.sql:4-15` |
| `Event.start_date`, `start_time`, `image_url` | `apps/mobile/app/(tabs)/events.tsx` | match `events` | `supabase/migrations/20260907112632_create_core_tables.sql:53-70` |

**Stores touched.**

| Store | By | Access | RLS / reality |
|---|---|---|---|
| Supabase `sevas` | `apps/mobile/lib/api.ts:4`, `apps/mobile/app/sevas/[id].tsx:22` | read (anon) | deny-all policy -> 0 rows |
| Supabase `events` | `apps/mobile/lib/api.ts:16` | read (anon) | deny-all -> 0 rows |
| Supabase `daily_poojas` | `apps/mobile/lib/api.ts:27` | read (anon) | deny-all; also 0 rows live per the reconciliation report |
| Supabase `gallery_albums` + `gallery_media` | `apps/mobile/lib/api.ts:38` | read (anon) | deny-all; no FK for the embed |
| Supabase `website_settings` | `apps/mobile/lib/api.ts:49` | read (anon) | **table does not exist** |
| HTTP `POST /api/chat` | `apps/mobile/app/(tabs)/ai.tsx:44` | call | works; writes chat sessions/messages server-side (M08) |
| AsyncStorage Supabase session key | `apps/mobile/lib/supabase.ts:10` | read/write | holds nothing - no sign-in exists |
| Postgres (9 tables) via Prisma | `lib/prisma.ts` | none yet | Prisma cannot express RLS/triggers (`docs/PRISMA-SCHEMA-BASELINE.md` §5a) |
| `supabase_migrations.schema_migrations` | `scripts/resolve-baseline-raya-ai.mjs` | one guarded insert | production ledger |
| `.ai/state/*.json`, `.ai/state/review-log.jsonl` | `.ai/scripts/*` | read/write in Actions runners | only `.github/workflows/ai-loop-next-task.yml:120-131` commits state back to `main` |
| GitHub PR comments (verdict markers) | `.ai/scripts/chatgpt-review.mjs`, `.ai/scripts/merge-gate.mjs`, `.ai/scripts/advance-after-merge.mjs` | write/read | the durable review record; author not checked |
| Jules API / OpenRouter API | `.ai/scripts/dispatch-conversation.mjs:205`, `.ai/scripts/chatgpt-review.mjs:300` | outbound | external services receiving prompts, briefs and full diffs |

## Cross-module dependencies

| This chunk uses | Owned by | How |
|---|---|---|
| `app/api/chat/route.ts` | M08 / M12 | the mobile chat calls it (`apps/mobile/app/(tabs)/ai.tsx:44`) |
| Supabase schema `supabase/migrations/*.sql` | M11 | mobile reads 5 tables; Prisma mirrors 9 |
| `lib/supabase/admin.ts`, `scripts/test-boundary.sh` | M11 / M15 | the `server-only` convention `lib/prisma.ts` copies |
| `lib/auth/admin.ts`, `app/actions/settings.ts` | M04 / M05 | subject of the BOT-005 report |
| `lib/supabase/migration-mappers.ts`, `lib/supabase/migration-inventory.ts`, `scripts/migrate-all-batched.ts` | M11 | target of the leftover patch |
| `.github/workflows/ci.yml` and the seven loop/Prisma workflows | M15 | the loop reads CI results; drift/resolve workflows drive Prisma |
| `tests/automation-loop/loop-scripts.test.ts`, `tests/automation-loop/review-loop.test.ts`, `tests/unit/prisma-schema-baseline.test.ts`, `tests/unit/resolve-baseline-raya-ai.test.ts`, `tests/unit/check-baseline-drift-scope.test.ts`, `tests/unit/ci-pages-and-supabase-ledger.test.ts` | M15 | tests of this chunk's scripts and files |
| `components/festival/FestivalGuide.tsx`, `components/festival/FestivalPhotoHighlights.tsx`, `components/festival/FestivalExperience.tsx` | M02 | output of loop tasks AI-007 and AI-008 |

Who imports this chunk: nobody. `.claude/state/inventory/import-graph.json` has zero edges into `apps/mobile`, `.ai/` or `prisma.config.ts`, and none into `lib/prisma.ts`. `apps/mobile` is excluded from the root type-check (`tsconfig.json` `exclude: ["apps/mobile/**/*", ...]`), is not an npm workspace (no `workspaces` key in the root `package.json`), and no workflow builds, type-checks or tests it. The one exception is incidental: root CI's `npm run lint` is a bare `eslint` (ESLint 9, config looked up from the repo root) whose `eslint.config.mjs` has no ignore for `apps/mobile`, so the mobile `.ts`/`.tsx`/`.js` files are linted with the **Next.js** rule set, never with `apps/mobile/eslint.config.mjs`.

## How to change it

1. **Make the mobile app show real data (the right way, per report §3.1/§6).** Add public read routes in the web app - `GET /api/sevas` (+ `[id]`), `GET /api/events`, `GET /api/poojas`, `GET /api/gallery`, `GET /api/settings/{docId}` (gap rows 1, 4-6, 8 of `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` §6) reading through the server-side services with the service-role client -> replace each function in `apps/mobile/lib/api.ts` with a `fetch` to `${EXPO_PUBLIC_API_URL}/api/...` -> map to shared types -> delete `apps/mobile/lib/supabase.ts` and the `@supabase/*` deps from `apps/mobile/package.json`.
   *Quick but worse alternative:* a new `supabase/migrations/*.sql` adding `FOR SELECT TO anon USING (active)` / `USING (published)` policies, and fixing the column names in `apps/mobile/lib/api.ts` and `apps/mobile/lib/types.ts`. This makes Supabase RLS the authorization layer for a binary that cannot be patched quickly, which the report's sequencing forbids.
2. **Share types instead of duplicating them.** Create `packages/domain` (report §3.2), move the platform-free `types/*.ts` there, add root `"workspaces": ["apps/*", "packages/*"]`, point `apps/mobile/tsconfig.json` `paths` at it, delete `apps/mobile/lib/types.ts`.
3. **Add a mobile screen.** Create `apps/mobile/app/(tabs)/<name>.tsx` (default export), register it in `apps/mobile/app/(tabs)/_layout.tsx` with an Ionicons icon, add its fetcher to `apps/mobile/lib/api.ts`. For a pushed detail screen add `apps/mobile/app/<name>/[id].tsx` and a `Stack.Screen` in `apps/mobile/app/_layout.tsx`.
4. **Keep the chat session.** First fix the server so a session-less call returns the id it actually stored (`app/api/chat/route.ts:158` generates one id, `:306` returns a different random one - M08/R-079); then in `apps/mobile/app/(tabs)/ai.tsx` store the returned `sessionId` in state (and AsyncStorage) and send it with every request; render `message.content` with a Markdown renderer or, better, have `/api/chat` return blocks (report §5 row M08).
5. **Start using Prisma for one table.** Add a server-only repository that imports `prisma` from `lib/prisma.ts`, switch one read in `lib/ai/ai-settings/repository.ts` from `createAdminClient()` to `prisma.aiSettings.findUnique({ where: { id: "main" } })`, keep the SQL migration as the source of truth, and run `npm run prisma:drift:scoped` (or `.github/workflows/prisma-baseline-drift-gate.yml`) before any `npm run prisma:resolve:baseline`.
6. **Add a table to Prisma.** Write the SQL migration in `supabase/migrations/` first, then transcribe the model into `prisma/schema.prisma` with `@@map`/`@map`, run `npm run prisma:validate` and the scoped drift gate, and extend `tests/unit/prisma-schema-baseline.test.ts`. Never author the table in Prisma first: Prisma cannot carry the RLS policy.
7. **Change what the AI loop may touch.** Edit `.ai/loop.config.json` `protectedPaths` (add at least `supabase/migrations/**`, `firestore.rules`, `storage.rules`, `.github/workflows/**`, `apps/mobile/app.json`); `.ai/scripts/validate-loop-config.mjs` checks the syntax on the next `ai-loop-validate.yml` run.
8. **Pause the loop.** Set `"enabled": false` and `"nextTaskEnabled": false` under `automation` in `.ai/loop.config.json`, or run `node .ai/scripts/loop-state.mjs stop` with a reason and commit the state.

## Faults, smells and risks

| id | severity | what | evidence path:line | suggested direction |
|---|---|---|---|---|
| M17-F01 | HIGH | The mobile app reads Supabase directly with the anon key, and every table it reads has a deny-all RLS policy, so Home, Sevas, Seva detail, Events and Gallery can only ever be empty. Same root cause as report R-071, now on a second client | `apps/mobile/lib/api.ts:3-56`; `apps/mobile/lib/supabase.ts:5-15`; `supabase/migrations/20260907112632_create_core_tables.sql:86-102`; `supabase/migrations/20261001000000_create_content_tables.sql:124-125,149-150` | Serve these reads from public `GET /api/*` routes (recipe 1); do not open anon RLS on tables the web treats as server-only |
| M17-F02 | HIGH | Mobile queries a table that does not exist (`website_settings`) and reads wrong columns (`sevas.title` vs `name`, `daily_poojas.time` vs `start_time`, `gallery_media.url` vs `image_path`); the `gallery_media(*)` embed needs a FK that does not exist. Even with RLS opened the screens would be broken - the Sevas list would still be empty because its search filter on the missing `title` drops every row | `apps/mobile/lib/api.ts:40,49`; `apps/mobile/lib/types.ts:16-45`; `apps/mobile/app/(tabs)/sevas.tsx:27-29,53`; `apps/mobile/app/(tabs)/index.tsx:43`; `apps/mobile/app/(tabs)/gallery.tsx:43`; `supabase/migrations/20260907112632_create_core_tables.sql:16,40`; `supabase/migrations/20261001000000_create_content_tables.sql:133,138`; `supabase/migrations/20261010000000_create_settings.sql:4` | Generate Supabase types or share `packages/domain`; one contract test per fetcher against a migrated database |
| M17-F03 | HIGH | The Expo app was built 2026-09-30, 72 calendar days before the Phase-2 gate (2026-12-11) that report §3.3 step 7 and §4.1 require before any mobile work; it bypasses layer 3 (API), has no `packages/*`, no `app/api/mobile`, and duplicates types and design tokens - Option B in name only | `git log -- apps/mobile` (`0cb71b6`, `5813fc9`, `a93cc34`, all 2026-09-30); `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` §3.3, §4.1-4.2; `apps/mobile/lib/types.ts`; `apps/mobile/tailwind.config.js:7-15` | Treat `apps/mobile` as a prototype until the §6 endpoints and server-side auth exist |
| M17-F04 | HIGH | The AI loop marks a task `done` when the PR that merely queues its brief merges: `classifyMergedLoopPr` takes the `AI-\d+` in the PR title/branch. A guard skipping branches that contain `next-task` (`.ai/scripts/loop-core.mjs:174`) landed via PR #308 at 2026-10-06 15:33:31 IST - 30 s *after* AI-005's brief PR #307 merged - so AI-002...AI-005 were completed by brief-only PRs before it, and AI-006's brief PR #314 still slipped through afterwards because Jules named its branch `jules-...` (the guard keys on a substring, and Jules ignores `nextTaskBranchPrefix: "automation/next-task-"`, `.ai/loop.config.json:63`). AI-002's required `app/(public)/map/page.tsx` never existed; nothing reopens these tasks | `.ai/scripts/loop-core.mjs:174-178`; `.ai/scripts/advance-after-merge.mjs:212-219`; `.ai/state/task-queue.json` (AI-002 `pr: 301` ... AI-006 `pr: 314`, branch `jules-15261422888858952515-e7f7bbfb`); `git show --stat 3ea259c` (only queue + `docs/tasks/AI-002-*`); `git blame -L 174,177 .ai/scripts/loop-core.mjs` (`f3b222e`) | Distinguish brief PRs from implementation PRs by label, not branch name; require the recorded `currentPr` before completing; reopen AI-002...AI-004 |
| M17-F05 | MEDIUM | Review verdicts are read from any PR comment containing the HTML marker; no author check. A forged `<!-- ai-loop-review round=9 head=<sha> verdict=approved -->` both suppresses the real review (head counted as reviewed) and satisfies the merge gate. Latent HIGH the day `autoMerge` is turned on | `.ai/scripts/merge-gate.mjs:111-120`; `.ai/scripts/review-core.mjs:24-25,64-80,91-104` | Accept markers only from `github-actions[bot]`, or store verdicts in a check run |
| M17-F06 | MEDIUM | The fix stage cannot run: `dispatch-conversation.mjs --stage fix` exits 1 ("same-PR fix continuation is currently unsupported") and `chatgpt-review.mjs` calls it on every `changes-requested`, so the documented review -> fix -> re-review cycle fails the workflow instead | `.ai/scripts/dispatch-conversation.mjs:146-152`; `.ai/scripts/chatgpt-review.mjs:404-433,777`; `.ai/prompts/system.md:76-95` | Implement fix dispatch, or make `changes-requested` an explicit hard stop and correct `system.md` |
| M17-F07 | MEDIUM | `protectedPaths` protects Prisma migrations (unused) but not the real ones: `supabase/migrations/**`, `firestore.rules`, `storage.rules`, the other workflows (incl. `ai-loop-next-task.yml` with `contents: write`), `vercel.json`, `apps/mobile/app.json`, nor `.ai/**` itself - an implementer PR may rewrite `protectedPaths`, the merge-gate rules or the prompts (effective once merged, since review/merge run base-branch code). Credential patterns miss `*adminsdk*.json` | `.ai/loop.config.json:12-18`; `.ai/scripts/loop-core.mjs:484-490`; `.github/workflows/ai-loop-next-task.yml:63-66` | Add those globs (and `.ai/**`); make any `.github/workflows/**` change a hard stop |
| M17-F08 | MEDIUM | The loop's prompts and scripts were copied from another project and describe a repo that is not this one: `VITE_` env vars, Vitest, OpenHands as fixer, `packages/infrastructure`, `apps/api`/`apps/web`, `docs/phase-*.md`, `.ai/templates/`, `npm run format`, `npm run test:e2e`, "PR #18", "rankings, automatic draw" | `.ai/prompts/system.md:54`; `.ai/prompts/implementation.md:28,32-33,37`; `.ai/prompts/review.md:5,44`; `.ai/prompts/architect.md:41,54`; `.ai/prompts/fix.md:40`; `.ai/scripts/detect-changed-areas.mjs:16-31` | Rewrite the prompts against `AGENTS.md`, Jest, `npm run typecheck` and the real folder layout |
| M17-F09 | MEDIUM | Doc-vs-config contradiction on who merges: `system.md` says "the loop merges, a human does not", but `autoMerge` is `false`, `mergeGate.requireHumanApproval` is never read by any script, and all task merges were made by the maintainer | `.ai/prompts/system.md:23-26,40-43`; `.ai/loop.config.json:43,54`; `.ai/scripts/validate-loop-config.mjs:129-133` (only `requireCiGreen`/`requireReviewPassed` are read); `git log --grep "#301"` | State the human merge step honestly; delete or implement `requireHumanApproval` |
| M17-F10 | MEDIUM | Loop state is not durable: the review log is empty because the review workflow has `contents: read`; `loop-tasks.mjs start` in the implement workflow is never committed; only the next-task workflow pushes state, directly to `main` without review | `.ai/state/review-log.jsonl` (0 bytes); `.github/workflows/ai-loop-review.yml:53-57`; `.github/workflows/ai-loop-implement.yml:33-35,80-81`; `.github/workflows/ai-loop-next-task.yml:120-131` | Persist state in one place (state branch or issue), or drop the review log and its claim in `.ai/scripts/chatgpt-review.mjs:17` |
| M17-F11 | MEDIUM | The reviewer is `openrouter/free`, a router that picks an arbitrary free model; full PR diffs, bodies and briefs leave the organisation to unvetted providers, and the verdict is non-deterministic | `.ai/loop.config.json:29-38`; `.ai/scripts/chatgpt-review.mjs:300-310` | Pin a named model under a data-use agreement; never send diffs that touch `.env*` or migrations |
| M17-F12 | MEDIUM | The mobile Supabase client is created at import with `url || ''`; `createClient` throws on an empty URL, so a build without `EXPO_PUBLIC_SUPABASE_URL` crashes every screen importing `apps/mobile/lib/api.ts`. The production site URL is hard-coded in three places | `apps/mobile/lib/supabase.ts:5-8`; `apps/mobile/app/(tabs)/ai.tsx:42`; `apps/mobile/app/(tabs)/more.tsx:6-7` | One config module reading `expo-constants` extra with a startup check |
| M17-F13 | MEDIUM | Mobile chat drops the server `sessionId` (every turn is a new session), renders Markdown as raw text, and its send button has no `accessibilityLabel`; it also sends the hard-coded greeting and its own client-side error strings back to the server as `assistant` history, and inherits R-079 (the server returns a different random id from the one it stored) | `apps/mobile/app/(tabs)/ai.tsx:20-22,36-48,68-73,80-84,105-108,121`; `app/api/chat/route.ts:100,158,304-306` | Persist and send `sessionId`; block-structured answers (report §5 row M08); a11y labels |
| M17-F14 | MEDIUM | No auth, booking, donation, receipt or payment path exists; seva detail says "Contact temple authorities". The M3/M5 phases in `.ai/development-plan.json` are `pending` with no tasks, and every loop brief lists "Mobile implementation" out of scope - nobody owns the app's roadmap | `apps/mobile/app/sevas/[id].tsx:71-75`; `.ai/development-plan.json:12-60`; `.ai/prompts/next-task.md:33-34` | Decide whether the app is a prototype or a product before more work lands |
| M17-F15 | LOW | "Privacy Policy" opens `https://www.srsmathaynk.com/privacy-policy`, but no web route serves `/privacy-policy`; both stores require a working privacy URL | `apps/mobile/app/(tabs)/more.tsx:7`; no `privacy` path under `app/` | Add the page (M02) before any store submission |
| M17-F16 | LOW | Mobile tooling is dead or broken: the ESLint flat config turns off a `@typescript-eslint` rule without loading the plugin or a TS parser and disables `no-explicit-any` (AGENTS.md forbids `any`); NativeWind/Tailwind configured but `global.css` never imported, no `metro.config.js`, zero `className` uses; unused deps `@supabase/ssr`, `axios`, `expo-secure-store`, `expo-notifications`, `expo-haptics`, `expo-av`, `@react-native-picker/picker`; the mobile `"lint": "eslint ."` script cannot run because `eslint` itself is not a dependency (only `eslint-config-prettier`/`eslint-plugin-prettier`); build exports iOS only; root CI never type-checks the app and lints it only incidentally, with the root Next.js ESLint rules (root `eslint.config.mjs` has no `apps/mobile` ignore) | `apps/mobile/eslint.config.mjs:1-7`; `apps/mobile/package.json:6-40,58,61-65`; `apps/mobile/babel.config.js:5-6`; `apps/mobile/app/global.css`; `apps/mobile/AGENTS.md:28`; `tsconfig.json` (exclude `apps/mobile/**/*`); `.github/workflows/ci.yml:32-47` | Pick StyleSheet or NativeWind and delete the other; add a mobile CI job running `tsc --noEmit` and `expo lint` |
| M17-F17 | LOW | Smells in every screen: five types imported, two used; errors only `console.error`ed and shown as "Unavailable"; `Math.random()` list keys; colours hard-coded per file instead of a token module; Expo template icons committed but unused | `apps/mobile/app/(tabs)/index.tsx:3,20-21`; `apps/mobile/app/(tabs)/gallery.tsx:39`; `apps/mobile/app/(tabs)/_layout.tsx:9-14`; `apps/mobile/app.json:7` vs `apps/mobile/assets/icon.png` | A shared data hook with error state; a `theme.ts` token object |
| M17-F18 | MEDIUM | The Prisma layer is dead at runtime: `lib/prisma.ts` has zero importers, 9 of ~24 live tables are modelled, the doc records live drift on 2026-10-16, and the loop's rule "Prisma only in `packages/infrastructure`" points at a folder that does not exist; yet `postinstall` makes every install generate it | `lib/prisma.ts:1-61`; `prisma/schema.prisma:12-13`; `package.json:53`; `docs/PRISMA-SCHEMA-BASELINE.md` §4.1.1; `.ai/prompts/review.md:44` | Wire the first repository (recipe 5), or delete `lib/prisma.ts` together with `postinstall` - dropping `postinstall` alone breaks `npm run typecheck`, because the root `tsconfig.json` includes `lib/prisma.ts`, which imports the gitignored `@/generated/prisma/client` (`lib/prisma.ts:5`) |
| M17-F19 | LOW | Runtime and migrations share one URL: `lib/prisma.ts` uses `PRISMA_DATABASE_URL ?? SUPABASE_DB_URL`, the variable `prisma.config.ts` documents as the direct, non-pooled migration connection that must be kept separate from the runtime pooler | `lib/prisma.ts:26-27`; `prisma.config.ts:9-15` | Add a pooled runtime variable before the first runtime use |
| M17-F20 | LOW | Two files carry migration version `20261015000000_baseline_raya_ai` with different content (222-line Prisma DDL vs a 13-line comment marker); the Prisma DDL has no RLS and plain `CREATE TABLE`, so an accidental `prisma migrate deploy` on a fresh database would create AI tables with RLS off | `prisma/migrations/20261015000000_baseline_raya_ai/migration.sql:1-5`; `supabase/migrations/20261015000000_baseline_raya_ai.sql:1-13`; `docs/PRISMA-SCHEMA-BASELINE.md` §5a | Document `migrate deploy` as forbidden in `prisma.config.ts`; add a CI guard |
| M17-F21 | MEDIUM | GitHub Pages serves the repository root (legacy build); the root reports and docs were already published (Jekyll rendered every `.md` to HTML), and `.nojekyll` additionally turns off Jekyll's exclusion of dot-folders, so `.ai/` and `.github/` are now served as raw static files too. If the site is public while the repo is private, this publishes internal reports, the Supabase project ref and the loop prompts | `.nojekyll` (commit `c156d6c` message); `MIGRATION_DATA_RECONCILIATION_REPORT.md:37` | Disable Pages, or point it at a `docs/` or `gh-pages` source |
| M17-F22 | LOW | `prisma-baseline-drift-gate.yml` accepts a full Postgres URL (with password) as a `workflow_dispatch` input; inputs are stored in run metadata and masking happens only after the step starts | `.github/workflows/prisma-baseline-drift-gate.yml:37-40,68-76` | Take a secret name, never a URL, as input |
| M17-F23 | LOW | Root clutter: an already-applied `.patch`, three "BLOCKED" non-reports, a stale `.ai/current-task.json` still saying AI-001 in progress, and `docs/tasks/` inconsistent (AI-002...AI-004 have `.md` + `.json`, AI-005...AI-008 have `.md` only) | `0001-feat-implement-sevaBookings-mapper-and-fix-chat_mess.patch`; `lib/supabase/migration-mappers.ts:705`; `.ai/current-task.json:3-6`; `docs/tasks/` (10 files) | Move reports to a dated `docs/` folder; delete the patch and `current-task.json` |
| M17-F24 | LOW | BOT-005's "settings server actions locked down" holds only for API-key callers: the action authenticates by a `Bearer` header the browser never sends to a server action, and `ADMIN_API_KEY` is compared with `===` and grants `uid: "api-admin"` | `app/actions/settings.ts:26-35`; `lib/auth/admin.ts:37-40`; `services/settings.service.ts:70-76` | Verify the Firebase session in the action; constant-time key compare (M04/M05) |
| M17-F25 | LOW | The loop's only state commit is pushed with `GITHUB_TOKEN`, and GitHub does not start workflow runs for `GITHUB_TOKEN` pushes. So the `push` triggers both workflows declare - implement on `task-queue.json`, next-task's recovery path on `loop-state.json` - never fire from the loop's own state commits; implementation is actually started by the human merge of the brief PR, in parallel with (and racing) the next-task workflow that is rewriting the same queue file | `.github/workflows/ai-loop-next-task.yml:44-51,120-131`; `.github/workflows/ai-loop-implement.yml:17-21`; `.ai/scripts/advance-after-merge.mjs:243-259` (push-recovery design comment) | Chain stages with `workflow_dispatch`/`workflow_call` (or a PAT/GitHub App token) explicitly, and serialise both workflows on one concurrency group |

## Portability notes (React Native / cross-platform)

The mobile app *is* the React Native client, so this table grades it against the report's portability matrix (`docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` §5) and §4.2 Option B.

| Piece | Web-only dependency | Reuse / adapt / rewrite | Why |
|---|---|---|---|
| `apps/mobile/app/**` screens | none (RN primitives, expo-router, expo-image) | reuse | genuinely native; `StyleSheet`, `FlatList`, `Linking`, `Share` |
| `apps/mobile/lib/api.ts` | none, but couples the device to table names and RLS | rewrite | report §3.1 layer 4: the device should call HTTP, not the database |
| `apps/mobile/lib/supabase.ts` | none | delete once the API exists | the anon client only helps if RLS opens, which the web does not rely on |
| `apps/mobile/lib/types.ts` | none | replace with `packages/domain` | duplicates and contradicts `types/*.ts` |
| `apps/mobile/tailwind.config.js`, `apps/mobile/babel.config.js` NativeWind | none | delete or finish | half-wired; screens use `StyleSheet` |
| mobile colours `#800000` / `#D4AF37` | n/a | adapt | the web uses `oklch()` tokens (`app/globals.css:140-153`); neither hex appears anywhere in the web code, so the two clients already disagree on brand (the report wanted `packages/tokens`) |
| `prisma/schema.prisma` + `lib/prisma.ts` | `server-only`, `pg` | server-side only | the right layer (report layer 2); must never be bundled into Expo |
| `.ai/` loop | GitHub Actions, `gh` CLI | n/a | tooling, not product |

**Where reality matches §4 Option B:** a separate Expo app, Next kept for the web, `apps/mobile` sits where §3.2 puts it, Expo Router + native modules (`expo-image`; `Linking` deep links to Maps exactly as §5 row M07 suggests for UPI), chat through `POST /api/chat` unchanged (§5 row M08).
**Where it departs:** started before the gate (§3.3 step 7); no `packages/domain`, `packages/api-client`, `packages/tokens`, `packages/i18n` or `packages/config` and no npm workspaces; talks to Supabase directly instead of the API (§3.1 layer 4 rule); none of the 19 missing endpoint families in §6 was built (no `app/api/mobile`, no `app/api/sevas`); no EAS config (`eas.json` absent) and no mobile CI (§4.1 "two pipelines").

**What the app still lacks versus the §5 matrix:** auth and a persistence adapter (M04 row; no Firebase Auth at all); booking, payment and donation writes plus a real payment integration (M03); receipts - the report's "natural first mobile screen" (M07); panchanga/calendar/aaradhane (M14; needs `GET /api/panchanga`); announcements, homepage, testimonials and settings pages (M02); Kannada/i18n (M13; the `lib/i18n` dictionaries are unused); notifications (`expo-notifications` is in `apps/mobile/app.json` but no code; needs `/api/push/subscriptions`, M13); offline caching; analytics (`/api/analytics/event`); the knowledge centre (M09); accessibility labels; and any tests (`jest-expo`, Detox/Maestro per the M15 row).

What a React Native client needs from the rest of the system: the §6 public read endpoints with one envelope and pagination; `GET /api/me/*` behind a token-exchange endpoint; generated or shared domain types; a token module shared with the web; `/api/chat` returning blocks and honouring `sessionId`; a privacy-policy page; and an EAS + test pipeline.

## Coverage

filesExpected 79 (all tracked files under the chunk roots: `apps/mobile` 34, `prisma` 3, `.ai` 34, root 8). The inventory JSON listed 62 and chunks.json estimated 75; the inventory missed `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, `.ai/scripts/loop-core.d.mts`, `.ai/scripts/review-core.d.mts`, `.ai/state/review-log.jsonl`, `apps/mobile/.gitignore`, `apps/mobile/LICENSE`, the 8 PNGs, `.nojekyll` and the `.patch`.
filesMentioned 79 - every file is named in a table row above; the PNGs are named but deliberately not opened (RULES: no binary files).
Omitted: none. Adopted: `prisma.config.ts`, `scripts/resolve-baseline-raya-ai.mjs`. `app/api/mobile` does not exist.

## UNCLEAR

- UNCLEAR: whether the AI review stage has ever produced a verdict on a real PR - `.ai/state/review-log.jsonl` is empty by construction (M17-F10) and PR comments are not in the clone. Settle with `gh pr view 322 --comments` and look for the `ai-loop-review` marker.
- UNCLEAR: whether the GitHub repository and its Pages site are public. Settle in repository Settings -> Pages / visibility; this decides the real severity of M17-F21.
- UNCLEAR: whether anyone has run the mobile app against a database where it worked (e.g. with RLS opened and a hand-made `website_settings` table). No migration, script or doc creates `website_settings`; settle by asking the maintainer or querying the live catalog.
- UNCLEAR: whether `@react-navigation/native@6` / `@react-navigation/bottom-tabs@6`, pinned beside `expo-router ~57`, resolve to a working navigator; settle with `npx expo-doctor` in `apps/mobile` (not run: no installs allowed).
- UNCLEAR: whether the Prisma baseline was actually resolved on the live ledger. `supabase/migrations/20261015000000_baseline_raya_ai.sql:3-5` says it was; `docs/PRISMA-SCHEMA-BASELINE.md` §4.1.1 says drift blocked it on 2026-10-16. Settle with the catalog mode of `.github/workflows/prisma-baseline-drift-gate.yml` or a read of `supabase_migrations.schema_migrations` for version `20261015000000`.
- UNCLEAR: BOT-005's "1,079 tests across 43 suites" is not verifiable statically; 55 test files exist under `tests/` today. Settle with the CI log for commit `abb15d9`.

## Verification log (2026-10-18)

Skeptic pass against `43361a3` (code identical to `3d6aa9d`). 291 cited paths checked, 0 broken (the 9 non-existent paths still cited are 8 deliberate "does not exist" claims and the grep string `lib/prisma`). 32 claims sampled: 24 confirmed, 6 refuted, 2 uncertain. 24 findings reviewed: all real, 8 amended, 0 refuted; 1 added (M17-F25). Report: `.claude/state/verify/M17-2026-10-18.md`.

- Data flow 1 said "even with rows the card renders `item.title`" -> the search filter on the missing `title` drops every row first, so the list stays empty -> `apps/mobile/app/(tabs)/sevas.tsx:27-29`
- Data flow 4 / recipe 4 implied that keeping the returned `sessionId` fixes continuity -> the server returns a fresh random id, not the one it stored; fix the server first -> `app/api/chat/route.ts:158,306`
- Data flow 6 said the next-task workflow's state push triggers `ai-loop-implement.yml` -> the human merge of the brief PR triggers it; a `GITHUB_TOKEN` push starts no workflow runs (new M17-F25) -> `.github/workflows/ai-loop-next-task.yml:120-131`, `.github/workflows/ai-loop-implement.yml:17-21`
- Prisma key-file row said "20 indexes" -> 18 -> `grep -c INDEX prisma/migrations/20261015000000_baseline_raya_ai/migration.sql`
- AI-006 delivery row said its brief is "not in tree" -> `docs/tasks/AI-006-festival-live-updates.md` exists; PR #314's `jules-...` branch slipped past the guard -> `git show --stat 39c5dd5`
- Who-imports paragraph said "no workflow ... lints it" -> root CI's bare `eslint` lints `apps/mobile` with the Next.js rules -> root `eslint.config.mjs` (no `apps/mobile` ignore), `package.json` `"lint": "eslint"`
- M17-F02 -> adds the Sevas filter that drops every row -> `apps/mobile/app/(tabs)/sevas.tsx:27-29`
- M17-F04 said `classifyMergedLoopPr` "takes any `AI-\d+`" -> a `next-task` branch guard exists since PR #308 (30 s after AI-005's merge); AI-006 still slipped through on a `jules-...` branch; severity kept HIGH -> `.ai/scripts/loop-core.mjs:174`, `git blame` `f3b222e`, `git merge-base --is-ancestor f3b222e 60b216f^1` = false
- M17-F07 -> adds that `.ai/**` itself is unprotected -> `.ai/loop.config.json:12-18`
- M17-F13 -> adds greeting/error strings echoed back as assistant history and the server-side id mismatch -> `apps/mobile/app/(tabs)/ai.tsx:20-22,80-84`, `app/api/chat/route.ts:158`
- M17-F16 said root CI never lints the app -> it lints it incidentally with the Next.js rules; adds that `eslint` is not even a mobile dependency -> `apps/mobile/package.json:42-50,57`
- M17-F18 direction "drop `postinstall`" -> dropping it alone breaks typecheck, because `lib/prisma.ts` is type-checked and imports the gitignored client -> `lib/prisma.ts:5`, `tsconfig.json` include `**/*.ts`
- M17-F21 blamed `.nojekyll` for publishing the root reports -> Jekyll already rendered them; `.nojekyll` adds the dot-folders -> commit `c156d6c` message
- M17-F23 said `docs/tasks/` is missing the AI-006...AI-008 briefs -> all `.md` briefs AI-002...AI-008 exist; only AI-005...AI-008 lack `.json` -> `ls docs/tasks`
- Added M17-F25 (LOW): `GITHUB_TOKEN` state pushes never trigger the declared `push` stages -> `.github/workflows/ai-loop-next-task.yml:120-131`
