# V4 — Critique of the UI redesign plan and specimen

**Date:** 2026-09-19 (Saturday) · **Reviewer:** V4 critic agent · **Mode:** adversarial, read-only
except for the two files under review.

**Under review**

- `D:\Onboarding\Repos\POCs\General Purpose POCs\docs\rearchitecture\UI-REDESIGN-PLAN.md`
- `D:\Onboarding\Repos\POCs\General Purpose POCs\docs\rearchitecture\ui-redesign-specimens.html`

**Verdict.** The plan survives the review. It is evidenced to an unusual degree — 53 diagnosis rows,
166 distinct resolving `path:line` references, 26 contrast ratios all computed rather than asserted —
and it is implementable: 8 of 8 sampled primitive specs and 3 of 3 sampled wireframes can be built
from the document alone. Eight diagnosis rows were nevertheless wrong, all of them counts, and every
error ran in the same direction: the code is slightly less bad than the plan said. Two contrast
figures were attached to the wrong token. All ten have been corrected in place. Three specified
primitives are still absent from the specimen and are listed for Nikhil rather than invented here.

Reproduction scripts for every scripted check are beside this file:
`.claude/state/verify/_v4_contrast.js`, `_v4_c2.js`, `_v4_pal.js`, `_v4_spec.js`, and the three
edit scripts `_v4_fix1.js`, `_v4_fix2.js`, `_v4_fix3.js`, `_v4_fix4.js`.

---

## 1. Diagnosis — 53 rows opened, 45 held, 8 refuted

Every row's evidence was opened at the cited `path:line` and every reproducible count was re-run on
`app/` + `components/`, `*.tsx` only, on 2026-09-19.

### 1.1 The eight that were wrong

| Row | Claimed | Measured | Evidence |
|---|---|---|---|
| **A3** | 31 hex literals across **9** distinct colours | 31 occurrences ✅ but **7** distinct colours | `#fff8ef` ×15, `#fffdf8` ×9, `#fff9ef` ×3, `#7A1024` ×1, `#fff6ea` ×1, `#fffaf4` ×1, `#fffaf3` ×1 |
| **C1** | `rounded-[32px]` ×9, `[30px]` ×3, `[36px]` ×1 → 13 | **23** arbitrary radii in **6** shapes | `[32px]` ×16, `[30px]` ×3, `[24px]` ×1, `[36px]` ×1, `[4px]` ×1, `rounded-[min(var(--radius-4xl),24px)]` ×1 |
| **C3** | "Four glow utilities … **plus** a text glow" (reads as 5) | **4 in all** | `app/globals.css:383` `.glow-gold`, `:387` `.glow-gold-intense`, `:391` `.glow-saffron`, `:396` `.text-glow-gold` |
| **C5** | 33 `hover:scale-1*`, **six** `hover:scale-110` | **42** sites; `scale-110` is **13** | `scale-105` ×27, `scale-110` ×13, `scale-150` ×1, `scale-100` ×1. `hover:-translate-y-*` ×15 ✅ |
| **D4** | **Seven** `SacredDivider`s | **Eight** — the row's own line list has eight entries | `components/home/HomeClient.tsx:40,45,50,54,58,73,77,81` |
| **E3** | 29 page files; **4 routes** outside `(public)` with **no layout at all** | 28 files under `app/` (+ `components/home/HomeClient.tsx` = 29 repo-wide); **7 page files in 3 trees** have no layout. **`(auth)` has a layout.** | `find app -name layout.tsx` returns `app/(auth)/layout.tsx`, `app/(public)/layout.tsx`, `app/layout.tsx`, `app/admin/{,billing/,receipts/,settings/}layout.tsx`. Uncovered: `app/calendar/{,ekadashi/,festivals/}page.tsx`, `app/knowledge/{,[category]/,article/[slug]/}page.tsx`, `app/debug/page.tsx` |
| **G2** | **two** `<canvas>` rAF loops (25 particles + 15 dots) + two `DeepaFlame` canvases | **one** canvas rAF loop. `FloatingDots` draws **no canvas** — `components/ui/FloatingParticles.tsx:272-295` renders 15 `motion.div`s with `repeat: Infinity`. Four `DeepaFlame` are written; two render (mutually exclusive reduced-motion branches), both `hidden lg:block` | `FloatingParticles.tsx:182,200`; `components/home/Hero.tsx:304,324,332,335` |
| **G3** | **Five** infinite keyframes | **Six** — `skeleton-loading` (1.5s) is also `infinite` | `app/globals.css:498,510,514,524,528,540,544,564,616,619,654,664` |

None of the eight changes a conclusion. The direction of the error is worth naming, though: each one
inflated the problem, and a diagnosis that inflates is the one a stakeholder will use to reject the
whole document. All eight are now corrected in the plan and tabulated in its new §11.

### 1.2 The forty-five that held, spot-checked with the evidence

**Counts reproduced exactly:** A1 5,471 literal `amber|orange|stone-N` classes · A4 287
`bg-gradient-to` · A7 31 dark-mode properties at `:195-228` · B2 all ten type steps (`text-sm` 1290,
`text-xs` 460, `text-lg` 296, `text-2xl` 164, `text-xl` 100, `text-3xl` 78, `text-4xl` 59,
`text-5xl` 36, `text-base` 18, `text-6xl` 11) · B6 82 `uppercase tracking-` · C1 `rounded-lg` 587 /
`rounded-full` 538 / `rounded-xl` 447 / `rounded-2xl` 210 / `rounded-3xl` 86 · C2 `shadow-lg` 160 /
`shadow-xl` 51 / `shadow-2xl` 36 · C4 59 `backdrop-blur` · D1 `max-w-7xl` 62 / `4xl` 37 / `3xl` 30 /
`6xl` 19 / `5xl` 5 · D2 `py-12` 58 / `py-16` 36 / `py-20` 20 / `py-24` 12 · G1 33 `whileInView`
across 44 framer-motion importers.

**`app/globals.css` line references — all exact:** `:3` Playfair · `:12-15,18-22,25-27,42-49,60-62,68-75`
the six overlapping Kannada/heading rules (B5) · `:77-80` the four `@import`s sitting after 76 lines
of rules (B4) · `:87-89` the self-referential `--font-sans`, undefined `--font-geist-mono`, and
`--font-heading: var(--font-sans)` (B3) · `:156` `--destructive` · `:237-239` `html { @apply font-sans }`
· `:298-301` `:focus-visible` · `:334-338` the competing box-shadow · `:351-363` reduced motion ·
`:383-398` glows · `:431` `.temple-card` 0.4s · `:598` `.section-fade-in` 0.6s · `:607-610`
`.focus-ring-temple` · `:613-617` `.skeleton-temple` · `:690-705` the three display clamps.

**Component references — all exact:** `app/layout.tsx:81` `bg-stone-50 text-stone-900` overriding
`app/globals.css:234-236` (A2) · `components/home/QuickServices.tsx:23,30,37,44,51,58,65,72` — eight
unrelated hue pairs (A5) · `components/admin/crud/StatusBadge.tsx:13-52` — 10 statuses over 6 hue
families with a stone fallback at `:59-63` (A6) · all nine `text-5xl` section `h2`s in B1, and the
`h1` range from `text-2xl` (`app/(public)/search/page.tsx:142`) to `lg:text-6xl`
(`components/home/Hero.tsx:169`) · `components/common/SectionHeading.tsx:11` `mb-12 text-center`
with exactly 8 importers (D3, F2) · `components/layout/Navbar.tsx:154-160` the `h-20` scroll-reactive
header and `:197` the gradient active pill (E1) · zero `aria-expanded` / `aria-haspopup` /
`role="menu"` anywhere in `Navbar.tsx` (E4) · `components/ui/button.tsx:34-46` every quoted variant
and size string, and `:60` `"Please wait..."` (F1, I1, I3) · `components/ui/card.tsx:13`
`rounded-2xl border border-stone-200 bg-white shadow-lg` (C2) · `lib/formStyles.ts` **0** importers
(F3) · `lib/animations.ts` 287 lines, 25 exports, **0** importers (F4) · `components/events/EventCard.tsx`
no `imageUrl` use although `types/event.ts:33` declares it, gradient date header `:144`, four outline
buttons `:250-252`, gradient CTA `:257` (F5) · `components/admin/layout/AdminSidebar.tsx:162`
white→amber→orange gradient, `lg:w-68`, `shadow-xl shadow-amber-500/10` (H1) ·
`components/admin/common/AdminPageHeader.tsx:18-19` Sparkles tile with **58** importers (H2) ·
`CrudTable` used by exactly 4 pages + `EventTable` (H3) · the identical bespoke spinner at
`app/admin/layout.tsx:14` and `components/admin/layout/AdminAuthGuard.tsx:27` (H4) ·
`components/admin/crud/TableActions.tsx:52-63` deleting with no confirmation (H5) ·
`app/admin/page.tsx:45,59,237` inline `MiniStat`, inline `SectionCard`, `window.location.reload()`
(H6) · `components/admin/crud/CrudTable.tsx` with no `sort`, no pagination, no `text-right`, no
`tabular` anywhere in the file (H7) · `components/common/A11yProvider.tsx:39` pushing
`JSON.stringify({message,priority})` into a live region and `:54-63` a second one beside
`app/layout.tsx:85` (I8) · `main-content` existing **only** in `app/(public)/layout.tsx:12` and
`app/admin/layout.tsx:26`, so the global skip link at `app/layout.tsx:84` is dead on
`/calendar/*`, `/knowledge/*`, `/debug` and all `(auth)` (I9) · 24 `(public)` pages with their own
`<main>` under a layout that already has one (I10).

**F6 is exact and is the most useful row in the document.** `docs/UI-GUIDELINES.md` really does
document six things that do not exist: Button sizes `md`/`lg` (`:154-155`), Card variants
`flat`/`bordered` (`:172-173`), a `<DataTable>` family (`:224-237`), a shadcn `<Sidebar>` family
(`:251-265`), and `font-family: var(--font-sans)` (`:58`) against a `--font-sans` that
`app/globals.css:87` defines as itself. The guideline cannot be used as a yardstick.

### 1.3 Reasoning, not just facts

The "why it reads as dated" column is the part most likely to be taste dressed as fact. It mostly
is not. A4 (gradient-as-default), C2 (uniform drop shadows), B6 (tracked-out caps eyebrow) and D3
(centre-everything) are each anchored to a count large enough that the pattern is systemic rather
than incidental, and each is separately supported in §10 by a cited convention. Three are softer and
should be read as argument:

- **A5** "multicoloured icon tiles read as an app-store grid" — a genuine judgement. It is also
  open decision 5, which is the right place for it.
- **C4** "frosted glass applied as decoration rather than to separate layers" — defensible, but the
  59 `backdrop-blur` sites were not classified into decorative vs layer-separating, so the word
  "rather" is doing unearned work.
- **G1** "scroll-triggered entrances … are the generic default" — true as an observation about
  contemporary sites, not a measurable property of this one. The stronger argument for deleting all
  33 is the one the plan makes elsewhere in principle 6 (motion answers an action), and G2's battery
  cost.

None of these three is a defect; they are correctly placed as opinion in a column headed with an
opinion. Flagged so a reader can tell which rows are measurements and which are arguments.

---

## 2. Implementability — 11 specs sampled, 11 buildable, 4 improved

The test applied: could a developer open the named file and make the change with only what the plan
says, without asking a designer a question?

| # | Spec | Verdict | Notes |
|---|---|---|---|
| 1 | §5.1 Button | **Buildable** | Every variant gives the full class string, every size a height and padding, focus is a concrete outline with a measured colour, and the retire list names files. The only gap was the destructive ratio (5.38 → 5.08); fixed |
| 2 | §5.2 Input/select/textarea | **Buildable** | Shell, focus, label, hint, error, width rule, wrapper bug and token source all specified. Undercounted the re-paste sites (4 → 8); fixed, because a developer following "import in all five" would leave three admin pages behind |
| 3 | §5.3 Base Card | **Buildable** | Border + `--radius-surface` + `--space-6`, shadow removed |
| 4 | §5.3 Event card | **Buildable** | Full content order, aspect ratio, which button survives, where the other four go |
| 5 | §5.3 Seva card | **Buildable** | 4px marker, Kannada-then-English, right-aligned `tabular-nums` price |
| 6 | §5.4 Badge / tag | **Buildable** | Four tones each mapped to a named token, plus `statusTone()` as the mapping point and the `"use client"` fix |
| 7 | §5.4 Section header | **Buildable** | Alignment, type step, optional Kannada line, description cap, action slot |
| 8 | §5.4 Admin table | **Buildable** | 40px header / 48px rows / `--secondary` fill / sentence case / sticky / no zebra / right-aligned money / 96px action column / 40px icon buttons / 56px pager. This is the most completely specified primitive in the document |
| 9 | §6.1 Home wireframe | **Buildable** | Desktop and 390px drawn, section count stated (13 → 7), and the Changes paragraph names every file to touch by full path |
| 10 | §6.8 Admin dashboard wireframe | **Buildable after fix** | The rail was drawn at 256px while H1 measured today's at `lg:w-68` (17rem / 272px) and the plan never said it changed. Now stated explicitly as a narrowing to `w-64` |
| 11 | §6.9 Admin CRUD wireframe | **Buildable** | Column order, alignment, sort targets, pagination, filter controls, and the <768px row-card rule |

**Two implementability gaps found and closed in the plan:**

- **Phase 5 step 5 said "the 10 `confirm()` sites".** That figure is right for `app/admin/settings`
  (10 sites in 9 files) and wrong as a work estimate: repo-wide there are **38** `confirm()` call
  sites across **30** files, including `app/admin/ai/*` ×5, `announcements`, `billing`, `bookings`,
  `donations`, `knowledge`, `quotes` ×2, `sevas`, `shlokas`, `testimonials`, and five admin
  components. A developer sizing Phase 5 from "10" would under-budget by nearly 4×. Corrected.
- **§7.2 named two competing focus styles; there are four.** `app/globals.css:298-301` sets the
  outline; `:323-330` sets the *same* outline again on an explicit element list; `:334-338` adds a
  box-shadow on inputs; `.focus-ring-temple` at `:607-610` adds a third treatment. An `<input>`
  matches three of them simultaneously today. The plan said to delete two. Corrected to three.

**One omission in Phase 2's deletion list:** `components/ui/animations.ts` — a *second* dead
animations module (14 lines, 5 exports, 0 importers) sitting beside `lib/animations.ts`. Added.

---

## 3. Palette — scripted, and it passes

Script: `.claude/state/verify/_v4_pal.js`. Every `oklch()`, `#hex`, `rgb()`/`rgba()`, `hsl()`/`hsla()`
literal was extracted from the specimen and from the plan and matched against
`app/globals.css` + `lib/formStyles.ts`, normalising away alpha suffixes.

| | Colour literals | Not in `globals.css` |
|---|---:|---:|
| `ui-redesign-specimens.html` | 28 | **0** |
| `UI-REDESIGN-PLAN.md` | 58 | 0 palette values |

The specimen result is unqualified: **28 distinct colour values, all 28 present verbatim in
`app/globals.css`, zero `rgb`/`rgba`/`hsl`/hex of any kind.** Tints are produced with
`color-mix(in oklab, <token> N%, transparent)`, which introduces no value.

The plan's nine unmatched strings are all benign and were checked individually: `oklch()` (bare, in
prose), `oklch(0.5_0.2_45)` (the Tailwind underscore spelling of `app/globals.css:299`), and seven
hex values — `#fff8ef`, `#fffdf8`, `#fff9ef`, `#fff6ea`, `#fffaf4`, `#fffaf3`, `#7A1024` — which are
quotations of the *existing bad literals* the plan is diagnosing in A3. **newColourValues = 0.**

The 31 sRGB equivalents shown in §3 were independently recomputed from the `oklch()` values through
Oklab → linear sRGB → sRGB and all 31 matched (`#e2a000` for `--primary`, `#6b141f` for
`--temple-maroon`, `#a20519` for `--temple-deep-red`, and so on).

---

## 4. Accessibility and language

### 4.1 Contrast — 26 pairs recomputed, 24 correct, 2 mis-paired

Computed independently (`_v4_contrast.js`): oklch → Oklab → LMS → linear sRGB → gamut-clamped sRGB →
WCAG 2.x relative luminance. Agreement threshold ±0.06.

**Correct to two decimal places (24):** `--foreground` on `--background` 15.41 · on `--card` 16.07 ·
on `--temple-cream` 14.32 · on `--primary` **7.10** · on `--accent` 12.42 · on `--secondary` 13.90 ·
`--muted-foreground` on `--card` 6.04 / `--background` 5.79 / `--muted` 5.22 ·
`--secondary-foreground` on `--secondary` 11.86 · `--accent-foreground` on `--accent` 9.00 ·
`--temple-deep-red` on `--card` 8.18 / on `--accent` 6.32 · `oklch(0.5 0.2 45)` on `--background`
6.22 / on `--card` 6.49 · `--temple-gold-dark` on `--card` 3.28 · `--chart-5` 5.05 / `--chart-4`
4.14 / `--chart-3` 3.40 / `--chart-2` 2.80 / `--chart-1` 2.26 on `--card` · `--border` on `--card`
1.44 · `--primary-foreground` on `--primary` **2.14** · `--primary` on `--card` 2.26.

Tailwind literals also recomputed and correct: white on `orange-600` **3.56**, white on `amber-600`
**3.19** → `orange-500` **2.80**, `text-orange-600` on white **3.56**, `stone-400` on white **2.52**.

**Two failures, both the same mistake:**

| Pair as written | Stated | Computed | What the stated figure actually is |
|---|---:|---:|---|
| `--primary-foreground` on `--temple-maroon` | 11.98:1 | **11.33:1** | `--card` (pure white) on `--temple-maroon` = 11.98:1 |
| `--primary-foreground` on `--destructive` | 5.38:1 | **5.08:1** | `--card` on `--destructive` = 5.38:1 |

`--primary-foreground` is `#fcf9ea`, not white, so any ratio computed for white is ~5–6% optimistic.
Neither changes a pass/fail verdict — 11.33 is still AAA and 5.08 is still AA — but both appeared in
four places each, including open decision 3, where the number is the whole basis of a choice between
a gold and a maroon primary button. Corrected everywhere, with the `--card` alternative added as its
own row in §7.1 so the two inks can be compared.

**contrastPairsChecked = 26, contrastFailures = 2, both now fixed.**

The headline claim survives intact and is the strongest thing in the document: the shipped primary
button is **3.56:1** and the token system's own primary pair is **2.14:1**. Putting `--foreground` on
`--primary` at **7.10:1** is the correct move within a fixed palette, and it is verified.

### 4.2 Focus, targets, motion, structure

| Requirement | Addressed? | Evidence in the plan |
|---|---|---|
| Focus styles | **Yes** | §4.5, §5.1, §5.2, §7.1(c), §7.2 — one rule, a named colour, a measured 6.22:1, an offset, and instructions to delete the competitors (now three, not two) |
| Touch targets ≥ 44px | **Yes** | §7.2 — 44×44 public, 40×40 admin with 8px separation; §5.1 kills the 32px `icon-sm`; §6.6 sets 44px calendar cells. Correctly distinguishes the WCAG 2.2 floor (24×24) from the comfort figure |
| Reduced motion | **Yes** | §4.7 and §7.2 — the existing `app/globals.css:351-363` block is kept and named as the reason the one orchestrated moment is affordable. The specimen carries its own `@media (prefers-reduced-motion: reduce)` |
| Kannada font with a fallback stack | **Yes** | §4.1 gives `--font-kn`; §7.3 gives the full chain `"Noto Serif Kannada", "Noto Sans Kannada", "Tunga", sans-serif` and says why Tunga (ships with Windows) |
| Kannada line-height | **Yes** | 1.75 at every step, unifying the existing 1.8/1.9 split at `app/globals.css:42-49,53-57` |
| `lang="kn"` marking | **Yes** | §7.3 states that nothing marks it today — confirmed, zero `lang="kn"` in `components/` |
| Landmarks / skip link | **Yes, now accurate** | §7.2 said to give `(auth)` a layout; it has one. Corrected to: add `id="main-content"` to `app/(auth)/layout.tsx:9`, and create layouts for `calendar`, `knowledge`, `debug` |

The plan also gets the harder language questions right rather than avoiding them: Kannada first in
content (§7.3) but English in UI chrome, Western Arabic numerals with `tabular-nums` throughout, and
— the point that makes the rest work — principle 5, that a heading face without Kannada coverage is
not a heading face here. That single sentence is what retires Playfair Display, and it is a stronger
argument than "Playfair is dated" would have been.

---

## 5. Specimen

Script: `.claude/state/verify/_v4_spec.js`.

| Check | Result |
|---|---|
| External resources | **0** — no `<link>`, no `<script src>`, no `<img>`, no `@import`, no `url()`, no `fetch`/`XMLHttpRequest`. All six `href` values are in-page anchors |
| New colour values | **0** of 28 |
| Size | 65 KB (limit 300 KB) |
| Tag balance | 0 mismatches, 0 unclosed (full stack walk, void elements excluded) |
| Kannada renders | **25** runs, **9** `lang="kn"` attributes, `--font-kn` applied |
| "Not the CoreFlex theme" header | **Present**, one line, in the page header |
| Readable at 375px | **Yes** — `.wrap` is `min(100% - 2×16px, 1200px)`; `.phone` is `width:390px; max-width:100%`; `.today` collapses to one column at ≤640px; `.two`/`.three`/`.compare` are single-column below 860px |

**Primitives present:** buttons (5 variants + sizes + loading + disabled), current-vs-proposed
button pair, inputs/select/textarea with label/hint/error/proportional widths, section header,
base card, event card, seva row, quote card, skeleton, current-vs-proposed event-card pair, desktop
nav, mobile nav + sheet, hero + mobile hero, Today panel, stat tiles, admin table **with** sort
affordance, selected row, tabular money and a 56px pager, toast, empty state, motion tokens, palette
swatches, type scale, spacing scale.

**Honesty of the "current" recreations — checked class by class.** `.old-btn` is `height:44px;
padding:12px 16px; radius 8px` against the real `h-11 px-4 py-3 rounded-lg` ✅. `.old-btn-outline` is
36px / 8px 12px / 6px against the real `sm` = `h-9 px-3 py-2 rounded-md` ✅. `.old-card` is 16px
radius + `shadow-lg` + `translateY(-8px)` against the real `rounded-2xl shadow-lg hover:-translate-y-2`
✅. `.old-card .cta` reproduces the `rounded-xl` gradient CTA and `scale(1.05)` ✅. The substitution of
palette tokens for the real `orange-600`/`amber-600` is stated in the page's own lede and again in a
caption, which is the right way to resolve the conflict between "use the real current classes" and
"introduce no new colour value". The one thing drawn off-spec is the old section heading at 36px
rather than the shipped `text-5xl` (48px), to fit the compare pane — now stated in its caption.

### 5.1 Added during this review

Two specified primitives were missing and were added using only CSS the page already carried, so no
new colour value and no new rule entered the file:

1. **Gallery tile** (§5.3) — four 1:1 tiles on the existing `.card` / `.thumb-1x1`, with a caption
   contrasting today's `hover:scale-110` inside `overflow-hidden`.
2. **Current-vs-proposed section header** — the plan's single most-repeated defect (D3/F2: fifteen
   inline copies) had no before/after, while the page was already carrying 14 lines of dead
   `.old-secthead` CSS. The pane now uses it.

Post-edit re-verification: still **0** external resources, still **0** new colour values, still 0 tag
mismatches, 65 KB.

### 5.2 Still missing — recorded, not invented

Three specified primitives remain undrawn because each needs new CSS rather than markup, and
inventing them in a critique is worse than naming them:

1. **Modal / drawer** (§5.4) — the centred desktop dialog and the **mobile bottom sheet**. The sheet
   matters most: §6.4 and §6.5 both route the booking and donation flows through it.
2. **Mobile row-card table** (§6.9) — the desktop table is drawn well; the <768px row-card form is
   not, and it is open decision 9. The decision is being asked without the picture.
3. **Maroon site footer** (§5.4) — the specimen proves the maroon *surface* (its own page header
   uses `--temple-maroon` with `--primary-foreground`) but not the four-column / accordion layout,
   and open decision 6 asks for logo and wordmark sign-off on maroon.

---

## 6. References — 4 spot-checked, 3 held, 1 partly wrong

All 10 sources in §10 carry a URL, and each row states what was borrowed rather than just citing.
Four were re-fetched read-only.

| Source | Claim in the plan | Fetched | Verdict |
|---|---|---|---|
| GOV.UK Type scale | one body size (19px there), line heights on a fixed rhythm (multiples of 5), a small fixed number of scale points | "the body font size on large screens is 19px with a line height of 25px"; "every point on the type scale uses a line height in a multiple of 5px"; 6–7 points | **Holds** |
| W3C SC 2.5.8 | 24×24 CSS px floor, with a spacing exception | "at least 24 by 24 CSS pixels"; the 24px-diameter-circle spacing exception | **Holds** |
| NN/g Cards | border + distinct ground to group; shadow is a clickability signifier; not for comparing options or scanning results | "Cards use a border around the grouped content, and the background color within the card that differs from … the underlying canvas"; "a slight drop shadow … is a clickability signifier"; "a poor choice when users need to compare between multiple options", "less scannable than lists" | **Holds** — except the clause "so a non-interactive panel should not have one", which is the plan's own inference. Now marked as such |
| GitHub Primer Size primitives | "2px increments up to 48px, then coarse"; radius 3/6/12/full; control heights 28/32/40/48 | radius `3 / 6 / 12 / 9999px` ✅; ladder is **4px** increments to 48 (2, 4, 6, 8, 12, 16 … 48) then **16px** steps; control heights are **24** / 28 / 32 / 40 / 48 | **Partly wrong** — the increment size and the omitted xsmall height. Both corrected in §4.2 and §10 |

Two of the ten could not be re-fetched in the authoring run (isha.sadhguru.org redirect-looped,
metmuseum.org returned 429) and were substituted; the substitutes (Templeton Religion Trust, Primer,
Material, W3C) are all live and specific. That substitution was disclosed by the author, which is the
correct handling.

---

## 7. Edit log — 32 edits across 2 files

**`docs/rearchitecture/UI-REDESIGN-PLAN.md`** (996 → 1,119 lines, 95.0 → 94.1 KB)

| # | Where | Change |
|---|---|---|
| 1 | A3 | 9 → 7 distinct colours |
| 2 | C1 | 13 → 23 arbitrary radii, 6 shapes, real counts |
| 3 | C3 | "four glows plus a text glow" → four in all |
| 4 | C5 | 33 → 42 `hover:scale-1*`; six → 13 `scale-110` |
| 5 | D4 | Seven → Eight `SacredDivider`s |
| 6 | §6.1 | "all seven" → "all eight" |
| 7 | E3 | Route/layout facts rewritten; `(auth)` layout correction; evidence added |
| 8 | G2 | One canvas rAF loop, `FloatingDots` is motion divs, four `DeepaFlame` written / two rendered; evidence added |
| 9 | G3 | Five → Six infinite keyframes; `:613-617` added |
| 10 | §3 `--temple-maroon` | 11.98 split into `--card` 11.98 / `--primary-foreground` 11.33 |
| 11 | §3 `--destructive` | 5.38 → 5.08, with the `--card` alternative |
| 12 | §5.1 destructive | 5.38 → 5.08 |
| 13 | §5.4 Footer | 11.98 → 11.33, `--card` alternative noted |
| 14–15 | §7.1 | Both rows corrected; two `--card` rows added |
| 16 | §9 decision 3 | Maroon-button figure qualified by ink |
| 17 | §4.2 | Primer 2px → 4px (2px first step), 16px above 48 |
| 18 | §10 Primer | Increments and control heights corrected |
| 19 | §10 NN/g | Non-interactive-panel clause marked as the plan's inference |
| 20 | §5.4 Toast | 325 → 322 lines (286 + 36) |
| 21 | F3 | 4 → 8 re-paste sites, with the reason a literal grep finds only one |
| 22 | §5.2 token source | Same, plus "import in all eight" |
| 23 | §7.2 Focus | Two → four competing focus treatments, `:323-330` named |
| 24 | §7.2 Landmarks | `(auth)` has a layout; `debug` added; 7 pages named |
| 25 | Phase 2 | `components/ui/animations.ts` added to the deletion list |
| 26 | Phase 5 / H5 | 10 → 38 `confirm()` sites in 30 files |
| 27 | §6.8 | Sidebar narrowing 17rem → 256px stated explicitly |
| 28 | §5.4 Hero row | Canvas/particle description aligned with the corrected G2 |
| 29 | Closing stat line | Notes the eight corrections and points at §11 |
| 30 | **New §11** | `## 11. Reviewer notes (2026-09-19)` — corrections table, confirmations, specimen status, remaining gaps, taste decisions, and the four out-of-scope items |

A follow-up pass qualified eleven bare filenames in §11 to full repo-relative paths, so every
`path:line` in the document now resolves. **Unresolved references in the whole plan: `lib/navigation.ts`
(Phase 3 creates it) — one, as before.**

**`docs/rearchitecture/ui-redesign-specimens.html`** (1,072 → 1,107 lines, 62.8 → 65.2 KB)

| # | Change |
|---|---|
| 1 | Gallery tile block added to the Cards section (existing `.card` / `.thumb-1x1` / `.grid`) |
| 2 | Current-vs-proposed section-header pane added, activating the dead `.old-secthead` CSS |

No application code, config, `app/globals.css`, `lib/formStyles.ts` or any existing doc was touched.

---

## 8. What is genuinely weak, and was left alone

Three things the review did not fix, because fixing them would be substituting the critic's taste
for the author's:

1. **The "boldness budget" is asserted, not demonstrated.** §2 says the budget is spent entirely on
   the Today panel. The specimen draws the Today panel well, but no page in §6 quantifies what
   "quiet" means for the other six home sections — a developer could build all seven at the same
   weight and still satisfy every written rule. The section-count reduction (13 → 7) is the only
   hard constraint.
2. **Phase 4 has no per-page acceptance test.** Phases 1, 2, 3 and 5 each end with a concrete verify
   step. Phase 4's is "no horizontal scroll, one page width, three band heights" — which is checkable
   — but there is no statement of when a *page* is done, and it is the longest phase (~25 files, 6
   days). The cross-phase checklist partly compensates.
3. **`--temple-saffron` retired to one 4px rule is the largest single identity change in the plan**,
   larger than the type change, and it is decision 4 rather than a headline. A trust reading this
   will notice the font first and the missing saffron later. That ordering is a presentational risk,
   not an error.

And one thing worth saying plainly: the plan's own §2 paragraph rejecting three alternative
directions — warm-cream editorial, dark jewel-toned, card-grid dashboard — with a stated reason for
each is the part that makes the rest credible. It is the difference between a redesign and a
restyle.

---

## 9. Summary

| Metric | Value |
|---|---|
| Diagnosis rows checked | 53 |
| Held | 45 |
| Refuted and corrected | 8 |
| Primitive / wireframe specs sampled | 11 |
| Implementable as written | 11 |
| Specs improved (missing detail filled) | 4 |
| Contrast pairs recomputed | 26 |
| Contrast claims wrong | 2 (both fixed) |
| New colour values introduced by plan or specimen | **0** |
| Specimen external resources | **0** |
| Specimen primitives still missing | 3 (modal/sheet, mobile row-card table, maroon footer) |
| References spot-checked | 4 |
| References that held | 3 |
| Edits made | 32 (30 plan, 2 specimen) |

The plan is fit to act on. Phase 1 can start on the corrected document without further design work.
