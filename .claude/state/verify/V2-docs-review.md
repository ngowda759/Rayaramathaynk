# V2 — Review of the overview docs and the HTML brief

**Date:** 2026-09-19 · **Agent:** V2 · **Repository root:** `D:\Onboarding\Repos\POCs\General Purpose POCs`

Files reviewed and corrected in place:

- `docs/overview/OVERVIEW.md`
- `docs/overview/TECHNICAL-GUIDE.md`
- `docs/overview/temple-portal-brief.html`

Yardsticks: the fifteen brain files under `.claude/skills/temple-portal-expert/brain/`,
`.claude/state/inventory/SUMMARY.md`, the code itself, and
`C:\Users\HP ELITEBOOK\.claude\skills\coreflex-html-theme\SKILL.md`.

---

## 1. Claims table

30 claims sampled across the two markdown documents. 14 of them were checked against the code
directly (marked **code**); the rest against the brain file they were synthesised from.

| # | Claim (and where it appears) | Verdict | Evidence |
|---|---|---|---|
| 1 | Repository is `temple-portal`, `package.json:2` | CONFIRMED | **code** `package.json:2` `"name": "temple-portal"` |
| 2 | Next.js **16.2.9** pinned at `package.json:55` | CONFIRMED | **code** `package.json:55` `"next": "^16.2.9"` |
| 3 | React 19.2.4, TypeScript 5.9.3, Framer Motion 12.42, Firebase 12.15, Supabase 2.116, `@vercel/blob` 2.6 | CONFIRMED | **code** `package.json:59,96,52,51,38,47` |
| 4 | 95 `route.ts` files under `app/api/` | CONFIRMED | **code** `find app/api -name route.ts` = 95 |
| 5 | 22 routes under `/api/ai/*` | CONFIRMED | **code** `find app/api/ai -name route.ts` = 22 |
| 6 | 818 source files, 158,773 lines, 310 `"use client"`, exactly 3 `server-only` | CONFIRMED | `.claude/state/inventory/SUMMARY.md` "Totals" |
| 7 | 54 services = 41 top-level + 13 under `proof-report/` | CONFIRMED | **code** `ls services/*.ts` = 41 (includes `dashboard.service.client.ts`), `ls services/proof-report/*.ts` = 13 |
| 8 | 42 declaration files in `types/` | CONFIRMED | **code** `ls types/*.ts` = 42 |
| 9 | 730 JSON files under `data/panchanga/` | CONFIRMED | **code** `find data/panchanga -type f` = 730 (`2026/`, `2027/`) |
| 10 | 130 page routes; 230 files under `components/` (HTML at-a-glance tiles) | CONFIRMED | **code** `find app -name page.tsx` = 130; `find components -type f` = 230 |
| 11 | 50 Playwright specs, 17 Jest unit files, 275-case AI UAT corpus, 5 workflows | CONFIRMED | **code** 50 `*.spec.ts`, 17 files under `tests/unit/`, 276 `question:` hits in `tests/ai-uat/test-cases.ts` (one is the interface field), 5 files in `.github/workflows/` |
| 12 | `docs/CHANGELOG.md` and `docs/DEPLOYMENT.md` are 0 bytes | CONFIRMED | **code** `ls -la` — both 0 |
| 13 | Home page: `app/(public)/page.tsx` `revalidate = 60`; `lib/gallery.ts:21` `getTempleGalleryImages()` | CONFIRMED | **code** `app/(public)/page.tsx:6`; `lib/gallery.ts:21` |
| 14 | Seva flow: `SevaBooking.tsx:114` (UPI fallback literal), `:127`, `:146`, `:181` | CONFIRMED | **code** `:114` `upiDetails?.id \|\| "9886364462@ptsbi"`, `:127` `handleSubmitClick`, `:146` `handleBooking`, `:181` `handleSavePaymentReference` |
| 15 | `sevaBooking.service.ts:34` `createBooking`, `:55` `where userId` + `orderBy createdAt`, `:81` `updatePayment` sets `paymentStatus:"completed"` / `status:"confirmed"` | CONFIRMED | **code** all three lines exact |
| 16 | Sevas split brain: reads Supabase via `app/actions/sevas.ts:4` (service-role), writes Firestore | CONFIRMED | **code** `services/seva.service.ts:11` calls `getAllSevasAction()`; `app/actions/sevas.ts:4` uses `createAdminClient()` |
| 17 | `app/(public)/events/[id]/page.tsx:63` calls `.toDate()` on what Supabase returns as an ISO string | CONFIRMED | **code** `:63` `const startDate = event.startDate.toDate();` |
| 18 | Chat route refs `:80`, `:112`, `:124`, `:143`, `:158`, `:162`, `:183`, `:192`, `:232-286` (commented block), `:306` `resolvedSessionId \|\| crypto.randomUUID()`, `:385` public GET | CONFIRMED | **code** every line matches; `:232` = `/*`, `:286` = `*/` |
| 19 | `lib/ai/generator.ts:1056` `generateResponse()`; `:95` `handleTempleTimings()`; `lib/ai/retrieval/settings.ts:164`, `DEFAULT_SETTINGS` at `:17` | CONFIRMED | **code** all four exact |
| 20 | `firestore.rules`: `settings` declared twice (`:136-139`, `:231-234`, the second `write: if true`); `ai_settings` world-read/write at `:226-229` | CONFIRMED | **code** exact |
| 21 | `firestore.indexes.json` declares 22 composite indexes | CONFIRMED | **code** `indexes.length` = 22 |
| 22 | `eslint.config.mjs:18-34` turns `@typescript-eslint/no-explicit-any` off for app, components, hooks, lib, services, types, scripts | CONFIRMED | **code** exact range |
| 23 | 88 of the 95 API route files perform no identity check; 5 use `verifyAdminUser`, 1 API-key gate, 1 gate that cannot fail | CONFIRMED | **code** 7 files match any auth token: the 5 `receipts` / `receipt-sevas` routes, `seed-ai-settings` (API key), `admin/prompts` |
| 24 | 825 translated strings, never rendered | CONFIRMED | **code** `lib/i18n/dictionaries/{en,kn,sa}.json` = 275 keys each |
| 25 | Nine device widgets with zero consumers | CONFIRMED | **code** 9 `.tsx` files in `components/device/` plus `index.ts` |
| 26 | 42 intents | CONFIRMED | **code** `Intent` enum, `lib/ai/intent/types.ts:4-78` = 42 members; M08 brain line 319 |
| 27 | Four future-dated Supabase migrations (`20260920…`, `20260930…`, `20261001…`, `20261010…`) | CONFIRMED | **code** `ls supabase/migrations` |
| 28 | Nineteen Guru Aaradhanes | CONFIRMED | M14 brain lines 38, 218, 266-267 (`data/aaradhane/gurus.ts`, `AARADHANE_COUNT`, `totalCount: 19`) |
| 29 | Fourteen settings pages under `/admin/settings` | CONFIRMED | **code** 13 sub-directories + `app/admin/settings/page.tsx`; M05 brain line 40 |
| 30 | Temple areas are Supabase-only, `services/temple-areas.supabase.service.ts:6` | CONFIRMED | **code** `:6` `const TABLE_NAME = "temple_areas"` |
| 31 | `services/auth.service.ts:147` authenticates against Firebase Auth and loads `users/{uid}` (OVERVIEW, admin journey step 1) | **REFUTED** | **code** the file is 147 lines long; `:147` is `export const authService = new AuthService();`. `login()` is at `:76`, `signInWithEmailAndPassword` at `:82`, the `users/{uid}` read at `:133` |
| 32 | `detectIntent()` lives at `lib/ai/intent/detector.ts:204` (guide §4.3 step 6 and §9; HTML flow step 5 and diagram) | **REFUTED** | **code** `:204` is `detect(message)`, a private class method; the exported `detectIntent()` is at `:677`. The sub-refs `:216`, `:256`, `:285`, `:476` and `:321` are all correct |
| 33 | "Dispatch to one of **42** handlers" / "one of 42 intent handlers" (guide §4.3 step 7 and §9; HTML prose, step 6 and diagram) | **REFUTED** | **code** `grep -c "case Intent\."` in `lib/ai/generator.ts` = **33** (`:1087`-`:1163`); M08-F25 records 42 enum members / 37 patterns / 33 `case` labels, with nine intents falling through `default` |
| 34 | `/admin` plus "roughly sixty" sub-routes; layout row "The admin console, ~60 routes"; HTML tile "~60 admin" | **REFUTED** | **code** `find app/admin -name page.tsx` = **83** (so 82 sub-routes). Breakdown of the 130 page routes: 37 `(public)` + 3 `(auth)` + 83 `admin` + 7 (`calendar`, `knowledge`, `debug`) |
| 35 | "an eleven-page admin console at `/admin/ai`" (OVERVIEW; HTML Raya AI card) | **REFUTED** | **code** `find app/admin/ai -name page.tsx` = **12**; M09 brain line 44 reads "11 admin AI pages + hub page" |
| 36 | `proxy.ts` is Next 16's rename of `middleware.ts` and intercepts every non-static GET | **UNCERTAIN** | `proxy.ts:84` exports `export default async function proxy(request: NextRequest)` with no `config` / `matcher` export. `node_modules` is absent, so the framework contract cannot be read. Carried as written (M01's wording) and flagged here |

**Totals:** 30 sampled · 24 CONFIRMED · 5 REFUTED · 1 UNCERTAIN.

A related **internal inconsistency** (not a claim about the code, so not counted above): the guide
said in §1/§2 that `proxy.ts` *is* Next 16's `middleware.ts`, then in §8.3 that "there is no
`middleware.ts` … so no request is authorized before it is served". Both statements were literally
true but read as a contradiction. Reworded to "no request-time authorization" in all four places
(guide §8.3, OVERVIEW state paragraph, HTML rules bullet, HTML risk row).

---

## 2. HTML ↔ markdown consistency

| Area | Result |
|---|---|
| At-a-glance tiles (130 routes, 95 handlers, 230 components, 54 services, 818 files, 158,773 lines, 67 test files, 4 stores, 15 modules, 730 panchanga files, 3 `server-only`) | Match the markdown and the inventory. One divergence — the "Page routes" subtitle said "~60 admin" (D2 below) |
| Module map (15 rows: ID, module, one-liner, brain file) | All 15 rows identical to OVERVIEW's table |
| Flow 1 — home page render | Same 6 steps, same call sites; the HTML condenses the six post-hydration round-trips into one step without changing any fact |
| Flow 2 — seva booking | The HTML numbers it 1-8 (OVERVIEW 1-9, guide 1-7); each document's callout refers to its own numbering ("Step 5" in the HTML, "Step 8" in OVERVIEW) and both point at `handleSavePaymentReference`. Self-consistent |
| Flow 3 — Raya AI message | Same call sites; two shared errors (D3 and the `detectIntent` location) fixed in both |
| Platform-state paragraph | The HTML splits OVERVIEW's single paragraph into four; wording is otherwise verbatim, including all four headline claims |
| Stack table | The HTML omits the "Forms / validation" and "Toasts" rows. Condensation, not a contradiction — left as is |
| Index paragraph | The HTML omits `messages` (the `chat_messages` collection-group index) from the guide's list of twelve. Condensation ("notably …") — left as is |
| Test-count framing | The HTML tile says 67 test files (50 + 17); guide §10 says 144 files / ~49,000 lines for the whole `tests/` tree (Python, shell and fixtures included). Different scopes, both correct |

### Divergences found (4) — all fixed

| # | Divergence | Fix |
|---|---|---|
| D1 | The HTML AI store-catalogue row omitted `ai_unknown_questions`, which the guide's §8.1 table lists | Added to the HTML row |
| D2 | The HTML tile subtitle "public, auth and ~60 admin" and the card "roughly sixty sub-routes" carried the same wrong count as the markdown (claim 34) | Tile → "37 public, 3 auth, 83 admin"; card → "82 sub-routes"; markdown corrected to match |
| D3 | "42 intent handlers" appeared in the HTML prose, step 6 and the ASCII pipeline diagram, mirroring the markdown error (claim 33) | All three changed to 33 `case Intent.*` handlers, in both documents |
| D4 | "No `middleware.ts`, so no request is authorized" appeared in the HTML rules bullet, the risk table and the state paragraph, mirroring the guide's §8.3 phrasing | Reworded to "no request-time authorization" in all locations, in both documents |

---

## 3. Link check (scripted)

A `node` walk over every `[text](target)` in the two markdown files, resolving each relative target
against the file's own directory:

```
total relative links 60   broken 0
```

All 60 resolve — the 30 brain-file links, the two cross-links between OVERVIEW and TECHNICAL-GUIDE,
and the links into the existing `docs/` corpus (`ARCHITECTURE.md`, `DATA-MODEL.md`,
`PROJECT_STRUCTURE.md`, `RAYA_AI_ARCHITECTURE.md`, `API.md`, `SECURITY.md`, `CHANGELOG.md`,
`DEPLOYMENT.md`, `QUALITY_ASSESSMENT_REPORT.md`, `ROADMAP.md`). Re-run after the edits: still 0.

Two forward references are written as plain code paths rather than markdown links, so they cannot
break: `.claude/skills/temple-portal-expert/` (now populated — `SKILL.md`, `README.md`,
`MIND-MAP.md`, `brain/`) and `docs/rearchitecture/` (currently holds `UI-REDESIGN-PLAN.md` and
`ui-redesign-specimens.html`; the React Native portability analysis and the consolidated fault report
that both documents promise are not on disk yet).

---

## 4. HTML self-containment and theme checklist

| Check | Required | Measured | Verdict |
|---|---|---|---|
| File size | < 400 KB | **85,977 bytes** (84 KB) after edits; 85,499 before | PASS |
| `http(s)://` anywhere in the file | 0 | **0** | PASS |
| External `src=` / `<link href>` / `<script src>` / `url(` / `@import` | 0 | **0** each | PASS |
| `@font-face` | 0 | **0** | PASS |
| CFS logo inline | inline, 46 paths, uncoloured, white plate | `<symbol id="cfs-logo" viewBox="0 0 650 136">` with **46** `<path>` elements, fills `#3C3C3E` ×4, `#7B7B7B` ×34, `#AF2127` ×8 — matches the skill's spec exactly; referenced twice via `<use href="#cfs-logo">`, both on white plates | PASS |
| `<title>` | present | `Temple Portal - Application Brief` | PASS |
| `<h1>` count | 1 | **1** | PASS |
| Heading nesting | no level skipped | was **2 jumps** (`h2`→`h4` in "Feature map" and in "Where to look next") | **FIXED** — 12 card headings promoted to `<h3>` and the `.card h4` selector renamed to `.card h3` with `color:var(--charcoal)`, so rendering is unchanged. Re-run: `jumps: none` |
| Print stylesheet | present | one `@media print` block: A4 `@page`, light-only token override, `page-break` rules, `.tablewrap{overflow:visible}` + `table{min-width:0}` so tables print whole | PASS |
| Distinct CSS rules using the red | 4 or fewer | **4** — `a` (links, `:94`), `:focus-visible` (`:96`), `.dot` (callout bullet, `:134`), `.pill-critical` (critical state, `:164`). Exactly the four roles the skill permits | PASS |
| Raw `#AF2027` literals | token declarations only | 3 — `:root` (`:19`), the print token block (`:226`), and `.pill-critical` inside `@media print` with `print-color-adjust:exact` (`:242`). The logo's `#AF2127` is the lockup's own fill, not the accent | PASS |
| Typeface stack | Century Gothic first | `--sans:"Century Gothic","Avenir Next",Futura,"Trebuchet MS","Segoe UI",system-ui,sans-serif`; `--mono:Consolas,"Cascadia Mono","Courier New",monospace`. Every `font-family` in the file resolves to `var(--sans)` or `var(--mono)` | PASS |
| Palette | all 12 tokens, both themes | All 12 light values match the skill exactly; redefined under `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}` **and** `:root[data-theme="dark"]`; `body` carries an explicit `background:var(--paper)` | PASS |
| Tables wrapped | every table in `overflow-x:auto` | **5 tables, 5 `.tablewrap` containers**: `.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:4px}` | PASS |
| No horizontal overflow at 375px | container ≤ viewport | `body{padding:20px 16px 44px}` and `.sheet{padding:26px 18px 44px}` under `@media (max-width:760px)` give a 16px gutter; `.cards` and `.toc ol` collapse to one column at 760px, `.tiles` at 420px; the only wide boxes are `table{min-width:560px}` and `<pre>`, both inside `overflow-x:auto` scrollers; `.routes` uses `word-break:break-word`, `td.path` uses `word-break:break-all`. No page-level horizontal scroll | PASS |
| Spelling | CoreFlex Solutions / CFS | Correct throughout; no "CFX" | PASS |
| Viewport meta | present | `width=device-width, initial-scale=1` | PASS |
| Reduced motion | honoured | `@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}` | PASS |

No theme violations were found beyond the heading nesting.

---

## 5. Edit log

15 edits across the three files.

### `docs/overview/OVERVIEW.md` (4)

1. Feature map, Admin console — "`/admin` and roughly sixty sub-routes" → "`/admin` and its 82 sub-routes (83 `page.tsx` files under `app/admin/`)". (claim 34)
2. Feature map, Raya AI — "an eleven-page admin console at `/admin/ai`" → "an admin console at `/admin/ai` — a hub and eleven sub-pages". (claim 35)
3. Admin journey step 1 — "`services/auth.service.ts:147` authenticates … and loads the `users/{uid}` profile" → "`services/auth.service.ts:82` authenticates … and `:133` loads the `users/{uid}` profile". (claim 31)
4. State-of-the-platform paragraph — "there is no `middleware.ts`, the admin gate is …" → "the request-time interceptor `proxy.ts` authorizes nothing, the admin gate is …". (D4)

### `docs/overview/TECHNICAL-GUIDE.md` (6)

5. §3 repository layout — "The admin console, ~60 routes" → "The admin console, 83 `page.tsx` routes". (claim 34)
6. §4.3 step 6 — `detector.ts:204` `detectIntent()` → "`detector.ts:677` `detectIntent()`, which delegates to `IntentDetector.detect()` (`:204`)". (claim 32)
7. §4.3 step 7 — "Dispatch to one of 42 handlers" → "Dispatch to one of the generator's **33** `case Intent.*` handlers — 42 intents, so nine fall through the `default` branch (M08-F25)". (claim 33)
8. §9 pipeline one-liner — "one of 42 intent handlers" → "one of 33 generator handlers". (claim 33)
9. §9 intent-detection paragraph — "(`lib/ai/intent/detector.ts:204`)" → "(exported `detectIntent()` at `lib/ai/intent/detector.ts:677`, delegating to `IntentDetector.detect()` at `:204`)". (claim 32)
10. §8.3 last bullet — "**No middleware.** There is no `middleware.ts` … so no request is authorized before it is served" → "**No request-time authorization.** The only request-time interceptor is `proxy.ts`, which writes `page_views` and sets headers and authorizes nothing". (D4)

### `docs/overview/temple-portal-brief.html` (5 groups, 25 string replacements)

11. Counts — at-a-glance tile subtitle "public, auth and ~60 admin" → "37 public, 3 auth, 83 admin"; admin card routes "and roughly sixty sub-routes" → "82 sub-routes"; Raya AI card "an eleven-page admin console" → "an admin console of a hub and eleven sub-pages". (claims 34, 35 / D2)
12. AI pipeline — flow step 5 now cites `detector.ts:677` `detectIntent()` → `IntentDetector.detect()` (`:204`); flow step 6, the section prose and the ASCII diagram now read 33 `case Intent.*` handlers with the "42 intents — nine fall through" note. (claims 32, 33 / D3)
13. Authorization — the rules bullet, the risk-table row and the state paragraph reworded from "no `middleware.ts`" to "no request-time authorization", naming `proxy.ts` as the interceptor that authorizes nothing. (D4)
14. Store catalogue — `ai_unknown_questions` added to the AI row's Firestore list. (D1)
15. Heading nesting — `.card h4{font-size:14.5px}` → `.card h3{font-size:14.5px;color:var(--charcoal)}`, and the 12 card headings (8 feature cards, 4 "where to look next" cards) changed from `<h4>` to `<h3>`, removing both `h2`→`h4` jumps.

Nothing was restructured; no section was added, removed or reordered.

---

## 6. Done-means check

- Report exists: this file.
- Broken links: **0** (60 relative links, re-verified after editing).
- External resources in the HTML: **0**.
- Red accent: **4** CSS rules — at the limit, all four in permitted roles.
- REFUTED facts corrected: **5 of 5**, in every place each one appeared, markdown and HTML.

---

## 7. Notes for the orchestrator

- `docs/rearchitecture/` holds only `UI-REDESIGN-PLAN.md` and `ui-redesign-specimens.html`. Both
  overview documents and the HTML promise three reports there (React Native portability, consolidated
  faults, UI redesign). If the first two never land, the "Where to go next" wording overstates.
- `.claude/skills/temple-portal-expert/SKILL.md` now exists, so the gap the authoring agent noted is
  closed.
- Claim 36 (`proxy.ts` as the Next 16 middleware) stays UNCLEAR and cannot be settled without
  `node_modules`. The documents' *consequence* claims no longer depend on how it resolves.
- Not fixed, recorded only (outside this brief's output paths): in TECHNICAL-GUIDE §8.2 the Sevas
  write citations `:76,81,86` point at each method's `if (!db)` guard rather than the
  `addDoc` / `updateDoc` / `deleteDoc` line one below. Method-accurate, so left alone.
- Also recorded only: OVERVIEW's seva journey cites `services/seva.service.ts:9` (the `getAllSevas`
  method) where the server-action call is at `:11`, and `components/events/EventGrid.tsx:29` (the
  `useEffect` that loads) where `getPublishedEvents()` is called at `:34`. Both point inside the right
  construct, so neither was changed.
