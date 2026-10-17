# V3 — Skeptic report on `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`

Date: **2026-09-19** (Saturday). Report under test: `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`
(1,020 lines before this pass, 1,250 after). Brief: `.claude/state/briefs/V3-report-skeptic.brief.md`.

Method: every number recomputed from the repository by script, never read out of the brain files. Register
rows extracted by script from §2 only; the appendix mapping re-derived independently and diffed against the
fault tables of all 15 brain files; every sampled row opened at its cited `path:line`; every working-day
count recomputed from Monday 2026-09-21; the portability matrix compared row by row against each brain
file's own "Portability notes" table and against the code. No build, lint, type-check or test was run
(`node_modules` absent per RULES). Scratch scripts were written outside the repository (`%TEMP%`), so this
file is the only thing this agent added under `.claude/state/verify/`.

---

## 1. Verdict in one paragraph

The report survives its facts and fails its own method. **All 25 sampled rows are real at their cited
`path:line` — none refuted.** The appendix is complete (589 brain findings → 350 rows, nothing missing,
nothing phantom), there are no duplicate or missing ids, every phase date in §7.4 recomputes exactly, and
both effort totals sum correctly. What broke is §2.1's stated severity rule: it says a row takes the maximum
severity of its merged sources, and in **27 rows it did not**, burying 25 `CONFIRMED` HIGH brain findings at
MEDIUM or LOW — including R-030, which the same document names in §8 as an app-store blocker and in §4.1 as
the reason Option C fails. One HIGH finding (M03-F05) lost its substance entirely in the split and has been
restored as a new row. Two portability-matrix cells are refuted by the code. One arithmetic statement is
wrong: the 165-day calendar is the **low** end of the effort range, not the mid-case. The recommendation
(Option B) stands, but the criteria table does not apply the same footing to every option, and the reuse
percentage that anchors it is not traceable to anything.

---

## 2. Sampled rows — 25, weighted to HIGH

Sample deliberately excludes the fifteen rows the author had already re-checked. Severities shown are those
in the document **before** this pass.

| # | Row | Sev | Category | Evidence opened | Verdict |
|---|---|---|---|---|---|
| 1 | R-005 | HIGH | A | `firestore.rules:226-229` | **HELD** — `allow read: if true; allow write: if true` on `/ai_settings/{docId}`, verbatim |
| 2 | R-006 | HIGH | A | `storage.rules:5-8`, `:11-14` | **HELD** — unauthenticated write to `testimonials/**`; `{allPaths}` read+write for any signed-in user |
| 3 | R-008 | HIGH | A | `app/api/admin/users/set-role/route.ts:6-88`; `firestore.rules:36,40` | **HELD** — `POST` has rate limiting only; no identity check; client SDK, so latency of exploit depends on the `users` rules exactly as stated |
| 4 | R-009 | HIGH | A | `app/api/seed-ai-settings/route.ts:117-140` | **HELD** — `:119-120` returns `{uid:"admin",role:"admin"}` when `NODE_ENV==="production"`; `:139` returns `{uid:"dev-admin"}` otherwise. The 401 is unreachable |
| 5 | R-010 | HIGH | A | `app/admin/layout.tsx:21-33`; `find . -name middleware.ts` | **HELD** — guard is `<AdminAuthGuard>` inside the layout; `find` over the whole repo returns nothing |
| 6 | R-013 | HIGH | A | `app/api/public/receipts/route.ts:18-32` | **HELD** — `.orderBy("createdAt","desc").limit(1000)` then in-memory substring filter, no auth |
| 7 | R-014 | HIGH | A | `app/api/volunteer/route.ts:58-68` | **HELD** — bare `GET` returning `{requests}` with no identity check |
| 8 | R-015 | HIGH | A | `app/api/gallery/local-assets/route.ts:38-57` | **HELD** — `DELETE` does a path-prefix check then `fs.unlinkSync`; no auth anywhere in the handler |
| 9 | R-049 | HIGH | B | `services/seva.service.ts:11` vs `:76,:81,:86` | **HELD** — read via `getAllSevasAction()`, writes via `addDoc`/`updateDoc`/`deleteDoc` on Firestore |
| 10 | R-054 | HIGH | B | `app/admin/calendar/festivals/page.tsx:9-16`, `ekadashi/page.tsx` | **HELD** — `useState(calendar.festivals)`; `grep -c "setDoc\|getDoc\|addDoc\|updateDoc"` → **0** in both files |
| 11 | R-056 | HIGH | B | `services/storage.service.ts:6`; no upload route | **HELD** — `import { put, del, list } from '@vercel/blob'`; `app/api/storage/videos/route.ts` is `GET`-only (38 lines), so "no upload route" stands |
| 12 | R-065 | HIGH | B | `lib/receipt/pdf.ts:37-39`, `:185` | **HELD** — `toAscii` replaces `[^A-Za-z0-9 .,:;/#@()+-]` with a space; only `StandardFonts.Helvetica`/`HelveticaBold` embedded |
| 13 | R-071 | HIGH | B | `supabase/migrations/20260907112632_create_core_tables.sql:98-102` | **HELD** — `CREATE POLICY "Deny all public access to events" … FOR ALL TO public USING (false)` |
| 14 | R-075 | HIGH | B | `app/api/chat/route.ts:162`; `lib/ai/settings.ts:39` | **HELD** — the live path is `generateResponse(...)` at `:162`; `getSystemPrompt` is only inside the disabled block |
| 15 | R-159 | HIGH | C | scripted recount over `app/`, `components/`, `hooks/` | **HELD on the headline, corrected in detail** — 41 files hold the client SDK (6 under `app/api`), 47 files / 85 import lines when `@/lib/admin-firebase` is counted, 12 admin settings pages. Reproduced exactly. The trailing "15 more are under `lib/ai/**`" is **wrong**: 11 are under `lib/ai/**`, 4 are AI services under `services/` (M08-F16's own evidence list spans both). Corrected in place |
| 16 | R-234 | HIGH | E | `proxy.ts:110`; `components/analytics/PageViewTracker.tsx:19` | **HELD** — two independent `trackPageView` call sites on every GET |
| 17 | R-030 | MEDIUM | A | `services/sevaBooking.service.ts:83` | **HELD, severity refuted** — the browser writes `status: "confirmed"` and `paymentDate` off a user-typed reference. Source M03-F01 is HIGH and `CONFIRMED`. **Re-graded HIGH** |
| 18 | R-104 | MEDIUM | B | `app/admin/content/page.tsx:90,92,93` | **HELD, severity refuted** — `:90` filters events on a string `date`, `:92` on `active`, `:93` counts a `gallery` collection. Source M06-F08 is HIGH. **Re-graded HIGH** |
| 19 | R-163 | MEDIUM | C | `app/api/admin/aaradhane/route.ts:12`, `events/route.ts:7`, `quotes/route.ts:37`, `announcements/route.ts:10` | **HELD** — `{success,data}`, a bare array, `{quotes,total}` and `{error}` at the four cited lines |
| 20 | R-235 | MEDIUM | E | `services/sevaBooking.service.ts:43`; `user.service.ts:20` | **HELD** — `getDocs` over whole collections with no `limit` |
| 21 | R-236 | MEDIUM | E | `app/api/admin/receipts/route.ts:58-61` | **HELD** — `.limit(pageSize).offset((page-1)*pageSize)` |
| 22 | R-321 | MEDIUM | H | `tests/ai-uat/ai-uat.spec.ts:6` | **HELD, severity refuted** — the import at `:6` is `{ test, expect, Page }`; `describe.describe(` appears exactly 15 times. Source M09-F06 is HIGH. **Re-graded HIGH** |
| 23 | R-045 | LOW | A | `REPORT.md:1-12` | **HELD, severity refuted** — a checked-in record of deliberately removing `verifyAdminUser` from three receipt routes and `AdminAuthGuard` from the layout. Source M15-F08 is HIGH. **Re-graded MEDIUM** (see §3 exceptions) |
| 24 | R-140 | LOW | B | `lib/receipt/upi.ts:1` | **HELD, severity refuted** — `export const DEFAULT_UPI_ID = "9886364462@ptsbi"` is the payment fallback in two money paths. Source M03-F04 is HIGH. **Re-graded HIGH** |
| 25 | R-273 | LOW | D | `app/(public)/timeline/page.tsx:192`; `components/ui/VideoUploader.tsx:56-58`; `app/(public)/quotes/page.tsx:126-131` | **HELD at LOW** — `setTimeout(…,500)`, a `setInterval` progress bar capped at 90%, a 1,500 ms no-op. But its HIGH source M03-F05 lost its real substance in this split — see §3 |

**Totals: 25 sampled, 25 held on the facts, 0 refuted on the facts, 5 refuted on severity.**
**Duplicates the dedupe missed: 0.** Ids run R-001…R-350 with no gap and no repeat; the appendix names no
id that is absent from the register and reaches every row in it.

---

## 3. The systematic defect: severity was not the maximum of the merged sources

§2.1 asserted "Severity is the maximum of the merged sources." Scripted over the appendix mapping and the
severity column of all 15 brain fault tables:

| Check | Result |
|---|---|
| Brain findings graded HIGH | 123 |
| HIGH findings landing on a row where **no** carrying row is HIGH | **25** (27 distinct rows) |
| Of those 25, marked `CONFIRMED` in `.claude/state/verify/M*.md` | **25 of 25** — none was downgraded by a skeptic |
| Understatement of the HIGH count | 63 reported vs 85 after correction (**+35%**) |

The 25: M01-F08, M01-F09, M02-F03, M02-F06, M02-F07, M03-F01, M03-F04, M03-F05, M06-F05, M06-F08, M07-F06,
M07-F10, M09-F05, M09-F06, M09-F07, M10-F06, M10-F11, M10-F12, M13-F01, M13-F02, M13-F03, M13-F04, M13-F05,
M13-F06, M15-F08. (M13 contributed six of them: `.claude/state/verify/M13.md:119-124` marks F01–F06 all
`CONFIRMED`, two of them "and stronger than written".)

**Action taken — 21 rows re-graded to HIGH, 1 to MEDIUM, 1 row added, 3 exceptions declared.**

Promoted to HIGH: R-021, R-026, R-029, R-030, R-033, R-095, R-101, R-102, R-103, R-104, R-106, R-108,
R-118, R-140 (from LOW), R-165, R-180, R-181, R-182, R-188, R-321, R-322. Each was promoted because the
register row's *own* evidence sustains HIGH — broken authorization, money written by the browser, a page
that crashes, a feature that is dead in production, fabricated content served as real, or a test suite whose
green means nothing — not merely because the brain said so.

R-045 raised LOW → MEDIUM. `REPORT.md` is a standing instruction to delete receipts auth in a repository
whose `AGENTS.md` is read by every agent; the code is restored, so the risk is latent, not live.

**Row added — R-351 (HIGH, category B).** M03-F05 is HIGH and `CONFIRMED`, but the dedupe split it into
R-273 (LOW, fake loading states) and R-342 (MEDIUM, doc drift), leaving its actual substance in no row:
the public `/quotes` page renders five hardcoded quotes from `SAMPLE_QUOTES` and never touches the quote
engine. Verified: `app/(public)/quotes/page.tsx:29,76`; `grep -c "quoteService\|quote.service" app/(public)/quotes/page.tsx`
→ **0**; `services/quote.service.ts` is 1,039 lines; `find app/api/quotes -name route.ts` → **10**.

**Three exceptions kept and now declared in §2.1** rather than left silent:

| Row | Kept at | Source | Reason |
|---|---|---|---|
| R-203 | MEDIUM | M13-F05 (HIGH) | ~12,000 dead lines is scale, not danger; HIGH would dilute a triage list |
| R-170 | MEDIUM | M13-F06 (HIGH) | Barrel without `"use client"` bloats seven bundles; performance only |
| R-045 | MEDIUM | M15-F08 (HIGH) | The code it describes has been restored; risk is latent |

After the edits, a re-run of the same script reports exactly these three residual cases and no others.
A further 32 rows sit one grade below a MEDIUM source; in each the stronger aspect is carried by a sibling
row, which is the intended behaviour of the split, so none was changed.

**Reconciliation after edits (scripted, §2 only):**

| | rows | HIGH | MEDIUM | LOW |
|---|---:|---:|---:|---:|
| Before | 350 | 63 | 183 | 104 |
| After | **351** | **85** | **164** | **102** |

Per category after: A 48 (22/16/10), B 110 (40/41/29), C 43 (9/23/11), D 32 (2/16/14), E 26 (2/16/8),
F 27 (1/13/13), G 25 (0/18/7), H 22 (7/10/5), I 18 (2/11/5). Declared heading counts, the §2.2 table, the
executive summary and §4's two references all now carry the same numbers; the appendix still maps 589 → 351
with 0 missing and 0 phantom.

---

## 4. Recommendation critique

### 4.1 Does it stand?

**Yes — Option B — but on a narrower argument than §4.2 gives, and the criteria table is not applied evenly.**

### 4.2 Two defects in the comparison

**(a) The criteria are not applied on the same footing.** §4.1 is titled "the four options, same criteria",
but Option B's Risk cell judges B *after* Phase 2 ("mitigated by doing Phase 2 first") while Option C's
judges C against today's code ("ships all 350 faults to an app store"). No option ships before P2 — §3.3 and
§7.3 make Phases 0–2 common to all four. "C after Phase 2" is never priced. On equal footing C is a shell
over a hardened site at 25–45 person-weeks against B's 106–178, and the honest objection to it is a product
objection (a WebView's feel, and the native seam closed permanently), not the safety objection the table
presents.

**(b) The reuse percentages are not traceable to the portability matrix.** "~35–45% shared" for Option B has
no derivation anywhere in the document. Measured from the matrix's own assets: types 5,444 + AI engine 3,748
+ pure services ~2,970 + i18n 1,797 + receipt rules 579 ≈ **14,500 lines**, which is 9% of 158,773 total
source, **13%** excluding the 49,157 lines of tests/tooling, or **17%** further excluding the admin console
the matrix itself says stays web-only. 35–45% only holds if the server tier (M08+M11+M12 ≈ 38,800 lines) is
counted as "shared" — true, but not code in `packages/*`, and equally true of Option C. Option D's "55–70%"
is an industry figure with nothing in this repo behind it. Both cells were corrected and labelled.

### 4.3 Steelman of each losing option (summarised; written out in full in the report's §10.3)

- **C (Capacitor):** priced against a hardened site it buys the two things a temple audience asks for — an
  icon on the home screen and Aaradhane/Ekadashi reminders — for a quarter of B's cost. Guideline 4.2
  rejects *thin* wrappers; a shell adding push, camera and offline caching routinely passes. The report
  never costs this variant.
- **D (Solito + Tamagui):** §4.3's own trigger — "if the public site were being rewritten anyway" — is not
  hypothetical. The sibling `UI-REDESIGN-PLAN.md` re-specifies the primitive set (its §5) and every public
  page (its §6) over a component layer whose two most-used primitives are already non-functional stubs
  (R-201, R-202). Assumption 7.2(8) ("a re-skin, not a component-library rebuild") is in tension with the
  plan it points at.
- **A (universal Expo + RN-Web):** the SEO objection assumes SEO exists to lose. By the report's own
  evidence there is almost none — zero per-route metadata, no sitemap or robots (R-160), fabricated content
  on the indexable pages (R-103), and five of six public search filters returning nothing (R-108). The
  counter-argument in §4.2 nevertheless survives: a missing sitemap is cheap under Next and structural under
  RN-Web.

### 4.4 Would a reasonable engineer pick differently, and on what fact?

Yes — on one fact, and the report named it but mis-dated it.

> **Flip condition: if the UI redesign is approved at the scope `UI-REDESIGN-PLAN.md` actually describes
> (every primitive and every public page re-specified), the component library is being rebuilt once and
> Option D becomes the cheaper route to mobile.**

The report *did* state this (§4.3 bullet 2 and decision 7), so it is not an omission — but it placed the
decision at the "Phase-4 gate" in §4.3 and at "the Phase-3 gate, 2026-12-11" in decision 7, which are two
different dates and neither is correct. 2026-12-11 is the **Phase-2** gate. By the Phase-3 gate the
`packages/*` layout is committed; by the Phase-4 gate the re-skin budget is spent. Both references were
moved to **the Phase-2 gate, 2026-12-11**, which is the last point at which the answer can still change
anything.

---

## 5. Portability matrix check — 8 modules compared, 2 wrong

Compared against each brain file's own "Portability notes" table and against the code: **M01, M04, M07,
M08, M10, M11, M12, M13.**

| Check | Result |
|---|---|
| Verdict distribution "6 rewrite / 6 adapt / 3 reuse" | **Correct** — rewrite M01,M02,M03,M05,M06,M09; adapt M04,M07,M10,M13,M14,M15; reuse M08,M11,M12 |
| All 15 file/line pairs vs `.claude/state/inventory/SUMMARY.md` | **All 15 exact** |
| The three `reuse` rows (M08, M11, M12) — do they hide a `next/*` or DOM dependency? | **No.** M08 discloses `fs` in `retrieval/panchanga.ts` and `window`/`navigator` in `actionRegistry.ts`; M11 discloses `@supabase/ssr` browser and cookie clients; M12 discloses `next/server`. All three verdicts are qualified ("server-side", "it is the mobile API"). Not refutations |
| `reuse as-is` claims inside other rows | **2 refuted** |

**Refutation 1 — M04 row: "`types/user.ts` … reuse as-is".** `types/user.ts:1` is
`import { Timestamp } from "firebase/firestore"`. It is one of the five files R-168 calls "the single
largest obstacle to publishing `types/` as a cross-platform package", and stripping exactly this is P3 work.
The other four are `types/billing.ts`, `types/event.ts`, `types/profile.ts`, `types/aaradhane-generator.ts`
(`grep -ln Timestamp types/*.ts` → exactly those five). Row corrected to **adapt**.

**Refutation 2 — M13 row: "`lib/i18n/**` … reuse as-is".** `lib/i18n/context.tsx:93` calls
`localStorage.setItem`, `:94` sets `document.documentElement.lang`, `:102` calls `localStorage.getItem`.
Neither exists in React Native, and the report's own R-182 already cites this file as broken. Corrected to:
dictionaries and `config.ts` reuse, the provider **adapts**.

**Two softer tensions flagged, not edited:** M01 lists `lib/utils.ts` as reuse-as-is when its whole body is
`clsx` + `tailwind-merge` (a Tailwind class merger, meaningful only on a Tailwind-consuming renderer);
M02's "reuse as-is *once they call HTTP*" is a contradiction in terms.

**API-gap list vs the route table.** All 95 `app/api/**/route.ts` paths were listed and each of the 20
claimed gaps checked against them. **Nineteen are genuinely absent.** `/api/storage/videos` exists but is a
38-line `GET` listing, so gap 7 ("no upload route") stands. **Gap 20 is miscategorised**: `/api/search`,
`/api/search/suggestions` and `/api/testimonials` all exist, so that entry is a contract change to existing
routes, not a missing family. The list is now described as nineteen missing families plus one contract gap.

---

## 6. Arithmetic check

| Claim | Recomputed | Result |
|---|---|---|
| P0 15 wd from Mon 2026-09-21 | 2026-10-09 (Fri) | ✅ |
| P1 20 wd from Mon 2026-10-12 | 2026-11-06 (Fri) | ✅ |
| P2 25 wd from Mon 2026-11-09 | 2026-12-11 (Fri) | ✅ |
| P3 20 wd from Mon 2026-12-14 | 2027-01-08 (Fri) | ✅ (25 Dec and 1 Jan counted as working days — the report already flags this) |
| P4 30 wd from Mon 2027-01-11 | 2027-02-19 (Fri) | ✅ |
| P5 40 wd from Mon 2027-02-22 | 2027-04-16 (Fri) | ✅ |
| P6 15 wd from Mon 2027-04-19 | 2027-05-07 (Fri) | ✅ |
| Every phase starts the next working day after the previous end | 7 of 7 | ✅ |
| Working days sum to 165; 165th wd from 2026-09-21 | 165; 2027-05-07 (Fri) | ✅ |
| Person-week columns 6+12+18+10+24+28+8 / 10+20+30+16+40+48+14 | 106 / 178 | ✅ |
| "106 person-weeks is ~30 elapsed weeks and 178 is ~51" | 30.3 / 50.9 at 3.5 pw/week | ✅ |
| **"The calendar below lays out the mid-case at 165 working days / 33 elapsed weeks"** | 33 × 3.5 = **115.5 pw** = the **low** end (106) + 9%. The mid-case is 142 pw = 40.6 weeks = **203 wd, ending 2027-06-30 (Wed)**; the high end is 254 wd, ending **2027-09-09 (Thu)** | ❌ **the one arithmetic error** — corrected in §7.3 and in the executive summary |
| Panchanga runway "2027-12-31 … 468 days from today" | `data/panchanga/2027/2027-12-31.json` is the last file; 2026-09-19 → 2027-12-31 = 468 days | ✅ |
| "`data/calendar.ts` runs out on 2027-04-02 — during P5" | last date in the file is 2027-04-02; P5 is 2027-02-22 → 2027-04-16 | ✅ |
| Executive-summary counts vs the register | 350 rows / 63-183-104 matched the register exactly **before** the severity correction; 351 / 85-164-102 after | ✅ (self-consistent both times) |
| Decision deadlines vs phase boundaries | 11 of 12 correct; **decision 7 "the Phase-3 gate, 2026-12-11"** names the Phase-2 date, and §4.3 names a third gate for the same decision | ❌ corrected |

**Other counts reproduced from the repo:** 818 source files / 158,773 lines (matches
`.claude/state/inventory/SUMMARY.md:310-311`); 310 `"use client"`; 3 `server-only`;
`find app/api -name route.ts` → 95; `verifyAdminUser` in 5 of them; 47 files / 85 direct import lines and
41 client-SDK files over `app/`+`components/`+`hooks/`; 12 admin settings pages; 10 public `/api/quotes*`
routes; "Next.js 14" in exactly 5 documents; zero `t(` call sites against 825 translated strings.

**Two further factual corrections:** the pure AI core is **3,748** lines, not ~2,600
(`lib/ai/intent/**` 2,104 + `lib/ai/generator.ts` 1,191 + `services/ml.service.ts` 453) — which strengthens
the Option B case; and "15 files under `lib/ai/**`" is 11 under `lib/ai/**` plus 4 AI services under
`services/`.

---

## 7. Edit log — 51 edits, all in `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`

File re-read from disk immediately before editing. Every edit was an exact-string replacement with a
miss report; the single miss (the §2.1 severity sentence) was located and applied separately.

| # | Edits | What |
|---|---:|---|
| 1 | 20 | Register rows re-graded MEDIUM → HIGH (R-021, R-026, R-029, R-030, R-033, R-095, R-101, R-102, R-103, R-104, R-106, R-108, R-118, R-165, R-180, R-181, R-182, R-188, R-321, R-322) |
| 2 | 1 | R-140 LOW → HIGH |
| 3 | 1 | R-045 LOW → MEDIUM |
| 4 | 1 | New row **R-351** (HIGH, category B) inserted after R-078, the last HIGH row of category B |
| 5 | 1 | Executive summary item 2 — 351 rows / 85-164-102, and how it was re-checked |
| 6 | 1 | §2.1 result line — 351 rows / 85-164-102 |
| 7 | 1 | §2.1 severity rule — states the max-of-sources rule, names the three exceptions, and notes promoted rows were not re-sorted |
| 8 | 1 | §2.2 category-count table — all nine rows and the total |
| 9 | 1 | §2.4 heading — "B — Data integrity (110 rows)" |
| 10 | 3 | "350 faults" → "351 faults" (§4.1 Option C, §8 operational risk); "63 HIGH-severity faults" → "85" (§4.2) |
| 11 | 2 | Appendix header (589 → 351, with the provenance of R-351) and the M03 mapping (`F05→R-273/R-342/R-351`) |
| 12 | 1 | §7.3 — the calendar is the low end, not the mid-case; mid-case 203 wd → 2027-06-30; high end 254 wd → 2027-09-09 |
| 13 | 1 | Executive summary item 10 — same correction |
| 14 | 2 | Decision 7 and §4.3 bullet 2 — both moved to the Phase-2 gate, 2026-12-11, with the reason |
| 15 | 2 | §1.4 — AI core 3,748 lines (was ~2,600); "15 files under `lib/ai/**`" → 11 + 4 |
| 16 | 2 | R-159 detail correction; §3 "`lib/ai/generator.ts` and `lib/ai/intent/**`" line count → 3,295 |
| 17 | 2 | §4.2 and executive summary item 8 — measured line counts (5,444 / 3,748 / ~2,970) |
| 18 | 2 | §4.1 Option B reuse cell (derived 13–17%, with the server-tier caveat) and Option D cell (labelled as an unmeasured industry figure) |
| 19 | 2 | §5 matrix — M04 `types/user.ts` → adapt; M13 `lib/i18n/**` → dictionaries reuse, provider adapt |
| 20 | 2 | §6 — "Twenty gaps" → nineteen missing families + one contract gap; gap 20 relabelled |
| 21 | 1 | New section `## Reviewer notes (2026-09-19)` (10.1–10.7, ~230 lines) inserted after §9 and before the Appendix |
| 22 | 1 | Executive summary cross-reference tidied to name the Reviewer notes section by title |
| | **51** | |

Post-edit verification, all scripted: 351 register rows, 85/164/102, zero duplicate ids, zero gaps in
R-001…R-351, every category heading equal to its actual row count, appendix still 589 → 351 with 0 missing
and 0 phantom, every register row a well-formed 6-cell markdown row, and the residual severity-rule
divergence exactly the three declared exceptions.

---

## 8. What I could not test

- Nothing was built, linted, type-checked or run — `node_modules` is absent by rule. R-317 remains a static
  inference, and the true size of the `no-explicit-any` burn-down in P4 is unknowable until the rule is
  re-enabled.
- The ±40% spread on every effort number is unfalsifiable from a static read. I checked the arithmetic
  *within* the estimate, not the estimate.
- The 36-unreferenced-endpoints figure rests on `.claude/state/verify/_M12_callers.js`, which I did not
  re-run; the 95-route and 5-`verifyAdminUser` figures it builds on both reproduce.
- **UNCLEAR:** whether the three declared severity exceptions (R-203, R-170, R-045) should instead be HIGH.
  The stated rule says yes; triage value says no. The choice is now visible in §2.1 rather than silent, and
  is Nikhil's to make.
