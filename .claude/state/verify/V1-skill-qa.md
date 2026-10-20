# V1 - Cold-user QA of `.claude/skills/temple-portal-expert`

Run 2026-09-19. Method: read `SKILL.md` and `MIND-MAP.md` once, then answer 15 questions strictly by
the protocol (route -> open the named brain section -> confirm in code -> answer with `path:line`).
`chunks.json`, the briefs and the `M*.md` verify reports were **not** opened before the run.

**Score: 13 ROUTED-AND-CORRECT, 1 ROUTED-BUT-BRAIN-WRONG, 1 NOT-ROUTABLE (now fixed and re-run), 0 ANSWERED-FROM-CODE-ONLY.**

---

## Results table

| # | Question | Router row used | Brain file + section | Code opened to confirm | Turns | Verdict |
|---|---|---|---|---|---|---|
| 1 | How does a devotee book a seva, end to end, and what gets written where? | "How does *&lt;feature&gt;* work end to end?" -> feature module | M03 **Data flow** §1 | `services/seva.service.ts:9-39,74`, `app/actions/sevas.ts:4-9`, `services/sevaBooking.service.ts:34,81`, `components/home/SevaBooking.tsx:114,127,146,152,181,190` | 2 | ROUTED-AND-CORRECT |
| 2 | Where is the admin sidebar menu defined, and how do I add an entry? | "How do I add *&lt;x&gt;*?" -> owning module; Cross-cutting *Navigation* row | M05 **Data flow** Flow 6 + **How to change it** Recipe A | `components/admin/layout/AdminSidebar.tsx:12,37,104,107` (`iconMap`, `allNavigation`, `getFilteredNavigation`); grep for importers of `layout/navigation.ts` -> none | 2 | ROUTED-AND-CORRECT |
| 3 | Which Firestore collections or Supabase tables does the donation flow write to? | "Which collection or table stores *&lt;data&gt;*?" -> M11 | M11 **Types and stores** (rows 450-451, 503-504) + **Migration state per domain** | `services/donation.service.ts:5`, `services/donationCampaign.service.ts:21`, `app/api/public/stats/route.ts:36,51`; `grep "from('donations')"` -> 0 hits | 2 | ROUTED-AND-CORRECT |
| 4 | How does Raya AI decide which knowledge source to use for a question? | "How does *&lt;feature&gt;* work end to end?" -> M08 | M08 **Data flow** Flows 1-3 | `lib/ai/generator.ts:1056,1061,1066,1074,1082,1085+`, `lib/ai/intent/detector.ts:204,216`, `lib/ai/retrieval/index.ts:120-136,210-230`, `app/api/chat/route.ts:160-235` | 3 | ROUTED-AND-CORRECT |
| 5 | How are the daily panchanga files produced, and when does the data run out? | Module map M14 ("how the 730 day files are produced and when they run out") | M14 **Data flow** Flow A | `.github/workflows/panchanga.yml:1-40`; `ls data/panchanga` -> `2026/` 365 + `2027/` 365 files, last file `2027-12-31.json` | 2 | ROUTED-AND-CORRECT |
| 6 | Which API routes accept writes without any authentication check? | "Is this endpoint protected?" -> M12, then M04 | M12 **Entry points** (auth column + legend) | `find app/api -name route.ts` -> **95**; `grep -rl verifyAdminUser app/api` -> **5** (receipts / receipt-sevas only); `ls middleware.ts` -> absent; scripted scan: **53** route files export POST/PUT/PATCH/DELETE with no auth reference at all | 2 | ROUTED-AND-CORRECT |
| 7 | Where are the site's colours defined, and which files would a palette change touch? | "Where is *&lt;thing&gt;* defined?" -> M01; Cross-cutting *Design tokens* row | M01 **Design tokens** + **How to change it** Recipe C | `app/globals.css:128-193` (`:root`, oklch), `:171` (`--radius`), `:184-192` (`--temple-*`), `:195` (`.dark`), `app/layout.tsx:81` (`bg-stone-50`); `grep -rno "amber-\|orange-\|stone-"` -> **5,471**; no `tailwind.config.*` | 2 | ROUTED-AND-CORRECT |
| 8 | How are receipts numbered and turned into PDFs? | Module map M07 / M14 ("receipt numbering, PDF drawing") | M14 **Data flow** Flow C | `lib/receipt/numbering.ts:1,8,29`, `lib/receipt/admin.ts:45-58`, `lib/receipt/pdf.ts:176`, `app/api/admin/receipts/[id]/send/route.ts` (one-line stub, read verbatim) | 2 | ROUTED-AND-CORRECT |
| 9 | What is the migration state of sevas between Firestore and Supabase? | "Why does an admin edit not show on the public site?" -> M11 | M11 **Migration state per domain** (Sevas row) | `services/seva.service.ts:11` (read via server action) vs `:76,:81,:86` (`addDoc`/`updateDoc`/`deleteDoc` on Firestore); `grep "from('sevas')"` -> only `app/actions/sevas.ts` plus 3 scripts | 2 | ROUTED-AND-CORRECT |
| 10 | Which parts of the app have no automated tests at all? | "Is *&lt;module&gt;* tested?" -> M15 **Coverage** | M15 **Coverage** (wrong section), then M15 **Component trees** §3 *Test-runner trees* and **Key files** `Tests - ...` | `jest.config.ts:9,20-23` (`testMatch` = `tests/unit/**` + `tests/ai-uat/**`, `testEnvironment: node`, coverage scope `lib/ai/**` only), `ls tests/unit` -> 14 entries, `package.json` scripts | 3 | **ROUTED-BUT-BRAIN-WRONG** - the router row names *Coverage*, but *Coverage* in every brain file is **file-inventory** coverage ("filesExpected 144, filesMentioned 144"), not test coverage. The answer lives in M15 *Component trees* §3 and *Key files*. Fixed in MIND-MAP (edit 1). |
| 11 | What breaks if I change `services/seva.service.ts`? | "What breaks if I change *&lt;y&gt;*?" -> module, then M10 | M10 **Who imports each service** (line 646) + **Key files** row 361 | `grep -rn "seva.service\|sevaService"` -> exactly 2 importers: `app/admin/assistant/page.tsx:9,44` and `components/home/SevaBooking.tsx:9,62` | 2 | ROUTED-AND-CORRECT |
| 12 | Explain this file: `components/admin/aaradhane/CreateAaradhane.tsx` (picked at random from 215 `components/**/*.tsx`) | no row existed for "explain this file"; fell back to the Module map *owns* column -> M07 | M07 **Key files** row 450, **Component trees** line 266, **Faults** M07-F14 | `components/admin/aaradhane/CreateAaradhane.tsx:1-40` (client, `useAuth`, `aaradhaneService`), `:108-145` - `alert()` at `:112`/`:140` and the `// TEMPORARY` `"admin@temple.com"` fallback at `:115-116` | 2 | ROUTED-AND-CORRECT (router row added anyway - edit 2) |
| 13 | What is a *Sevakarta*, and where does the app use the word? | "What is this Sanskrit or Kannada word?" -> *Glossary* | none - the Glossary had no row, and no brain file defines the term | `components/home/SevaBooking.tsx:472` ("Sevakartas must be present at the Mutt premises for Sankalpa and Seva/Pooja"), `:407` (Sankalpa in the notes placeholder) | 3 | **NOT-ROUTABLE** -> Glossary rows added for Sevakarta, Sankalpa, Annadana and Mutt (edit 4); **re-run after the edit: ROUTED-AND-CORRECT** |
| 14 | What does the route `/profile/preferences` do? | "What does route *&lt;path&gt;* do?" -> Route index | Route index row was incomplete (`/profile`, `/profile/settings`, `/favorites` only); M03 **Entry points** has the route and **Data flow** §4 has its write path | `app/(public)/profile/preferences/page.tsx:75-95` (theme, 7 notification and 4 device toggles), `context/ProfileContext.tsx` -> `services/profile.service.ts` merged `updateDoc` on `profiles/{uid}` | 2 | ROUTED-AND-CORRECT (index gap fixed - edit 5) |
| 15 | Where is the `Receipt` type defined and what is in it? | "Where is *&lt;thing&gt;* defined?" -> M10 for types | M10 **Key files** -> *Types* row 421 | `types/receipt.ts` read in full (`PaymentMode = "upi"`, `ReceiptItem`, `Receipt`, and `ReceiptCreateInput` which deliberately omits rates and totals); importer count `grep -rl "@/types/receipt\""` -> **13**, matching the brain | 2 | ROUTED-AND-CORRECT |

Average 2.2 turns per question. No question needed a brain file other than the one the router named
(Q10 needed a different *section* of the right file), and no answer had to be reconstructed from a
blind grep.

---

## Critique of the skill text (against the writing-skills yardstick)

**Description - good.** 800 characters (under the 1024 limit), third person, and a genuine trigger
list rather than a summary: 13 question shapes in quotes ("how does X work end to end", "what breaks
if I change X", "is this tested", "can this move to React Native") plus 19 domain words (seva,
aaradhane, panchanga, gotra, Raya AI, receipt book, UPI and so on). A cold user asking any of the 15
questions above in their own words would hit at least one trigger.

**Body length - over, if the example counts.** The protocol body is **460 words** (436 before my
edits); with the worked example it is **630**. Read strictly, "under 500 words" over everything after
the frontmatter fails. The example earns its keep (below), so the right fix is trimming Overview and
Scope rather than cutting the example - not done here, because the brief allows only routing fixes.

**Red flags - real failure modes, and I hit one.** All six describe things a model actually does:
"answering from memory about Next.js" (this repo is Next **16**, where `middleware.ts` is now
`proxy.ts` - training data says otherwise), "quoting `docs/*.md` as evidence" (M15 grades 27 doc
files and several are stale; `docs/DATA-MODEL.md` is demonstrably wrong about `sevaBookings`),
"reading a whole brain file" (they are 62-97 KB - reading one costs more than the answer is worth),
"skipping the mind map and grepping blind", and "saying a feature works because a doc says so". The
sixth, the `AGENTS.md` reminder, is a house rule rather than a failure mode, but it is cheap to keep.

**Worked example - concrete and, checked, accurate.** I verified it rather than trusting it:
`app/admin/settings/social-links/page.tsx:33` (`const DOCUMENT = "socialLinks"`) writes Firestore,
`services/settings.service.ts:121` reads Supabase `social_links`, and the only writer of that table
is `scripts/migrate-settings.ts:78-80`. The example demonstrates all four protocol steps on one real
bug, with a runnable grep and a fault id. It is the part of the skill that most improves a cold run.

**Protocol - one real gap, now closed.** Step 1 listed the Question router, Route index, Store index,
Glossary and Cross-cutting table, but not the **Module map** - the only way to route a question whose
subject is a *file path* ("explain `components/.../CreateAaradhane.tsx`"). Q12 had to fall back on it
without being told to. Step 2 also needed the warning that *Coverage* is not test coverage.

**Scope statement - correct and observed.** "This skill explains and locates. It does not implement."
None of the 15 answers needed a code change to be useful, and the change-shaped questions (2, 11)
were answerable as an ordered file list plus the `AGENTS.md` planning reminder.

---

## Edits made (SKILL.md, MIND-MAP.md, README.md only)

1. **MIND-MAP Question router, "Is *&lt;module&gt;* tested?"** - re-pointed from *M15 Coverage / the
   module's Coverage* to *M15 Component trees -> Test-runner trees*, then *M15 Key files -> the
   `Tests - ...` tables*, then the module's *Faults*. Added a blockquote under the router stating
   that a brain file's **Coverage** section is file-inventory coverage, not test coverage.
2. **MIND-MAP Question router, new row** - `"Explain this file" / "what is <path/File.tsx>?"` ->
   the module owning its directory (Module map *owns* column) -> **Key files**, then **Component
   trees** and **Faults**. This is the row Q12 needed and did not have.
3. **MIND-MAP Question router, "What is dead code here?"** - the old row sent the reader to
   *Coverage* for "the zero-importer lists"; those live in M10 **Cross-module dependencies**
   (*Who imports each service*, plus the explicit zero-importer list at M10:532). Row corrected.
4. **MIND-MAP Glossary, 4 new rows** - **Sevakarta** (the sponsoring devotee,
   `components/home/SevaBooking.tsx:472`), **Sankalpa** (the vow that explains why the booking form
   collects gotra, nakshatra and raashi, `SevaBooking.tsx:407,472`), **Annadana** (free-food
   offering; About/timeline/volunteer copy and the AI policy settings) and **Mutt** (the alternate
   spelling of Matha that the UI copy and the Postman host actually use).
5. **MIND-MAP Route index, page routes** - added `/profile/preferences`; replaced the non-existent
   `/knowledge/[slug]` with the real `/knowledge/[category]` and `/knowledge/article/[slug]`; removed
   `/ai` (there is no `app/(public)/ai/page.tsx`, only `ai/analytics`); corrected
   "`/admin/settings/*` (16 pages)" to 14 `page.tsx` files and "`/admin/ai/*` (13 pages)" to 12,
   both counted with `find ... -name page.tsx | wc -l`.
6. **SKILL.md step 1** - added "a file path the **Module map**'s *owns* column" to the routing
   options. **SKILL.md step 2** - added "A brain file's **Coverage** section is file coverage, not
   test coverage - tests live in M15."
7. **README.md** - one paragraph after the section list saying the same thing about *Coverage*, so a
   reader skimming the README does not form the wrong expectation.

Nothing under `brain/` was edited.

---

## Brain defects found (reported, not fixed)

| File | Section | Issue | Evidence |
|---|---|---|---|
| `brain/M03-public-devotional-and-transactions.md` | Data flow §1, step 4 | The client-side booking reference is quoted as `SVA-${Date.now().toString(36)}`; the code also calls `.toUpperCase()`. Cosmetic, but it reads as verbatim and a reader grepping for the literal will not find it. | `components/home/SevaBooking.tsx:152` - ``const ref = `SVA-${Date.now().toString(36).toUpperCase()}`;`` |

Everything else I checked held. Verified and **correct**: M05-F02 (the Site Settings save calls
`services/settings.service.ts:72,96`, which dynamically import the Supabase service-role admin client
from a client component), M07's wrong-route-param fault
(`app/admin/receipts/[receiptId]/page.tsx:32,35,45` read `params.id`), M08's headline that no LLM is
ever called (the `getAIProvider()` call site at `app/api/chat/route.ts:236-253` sits inside a
`/* OLD FALLBACK CODE - DISABLED FOR SAFETY */` block), M02-F08 (no `export const metadata` or
`generateMetadata` anywhere under `app/(public)`; the only ten files carrying either are
`app/layout.tsx`, three `app/knowledge/*` pages and six admin create/edit pages), M12-F05 (95 route
files, 5 with `verifyAdminUser`), M13's "not a PWA" (no manifest and no service worker under
`public/`), the Supabase table count (21 distinct tables across the 8 migration files), and M10's
importer counts for `seva.service.ts` (2) and `types/receipt.ts` (13).

**Not a defect, but worth knowing:** brain line counts are `split("\n").length`, one more than
`wc -l` for a newline-terminated file (`types/receipt.ts` 44 vs 43, `CreateAaradhane.tsx` 442 vs 441,
`seva.service.ts` 91 vs 90). Consistent everywhere I checked, so it is a convention rather than an
error - but a reader comparing against `wc -l` will see an off-by-one every time.

---

## Repository observations outside my scope (per RULES, recorded not fixed)

- `app/(public)/ai/` contains only `analytics/`, and that operations console is a public,
  unauthenticated page (M12-F43). The MIND-MAP previously advertised a `/ai` page that does not
  exist.
- 53 API route files export a write method (POST/PUT/PATCH/DELETE) with no authentication reference
  of any kind - a blunter number than "5 of 95 verify a token" conveys on its own.
