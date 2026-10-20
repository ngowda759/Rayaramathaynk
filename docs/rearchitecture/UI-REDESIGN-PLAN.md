# UI Redesign Plan — Sri Raghavendra Swamy Matha portal

**Written:** 2026-09-19 · **Scope:** public site + admin console · **Status:** proposal, nothing implemented ·
**Re-checked:** 2026-10-18 against commit `424fdb8` — still nothing implemented (see *Status as of 2026-10-18* at the end of §1)
**Companion specimen:** [`ui-redesign-specimens.html`](./ui-redesign-specimens.html)

The colour values do not change. Everything else about how the interface looks and is placed —
typography, spacing, shape, elevation, grid, navigation, hero, cards, forms, tables, motion — is
re-specified here so a developer can open a component and know exactly which classes and tokens to
change.

Every claim in the Diagnosis is anchored to `path:line`, a reproducible count, or a computed
contrast ratio. Every convention borrowed from another site carries its URL.

---

## 1. Diagnosis — what makes it read as dated

Counts are from `app/` + `components/`, `*.tsx` only, measured 2026-09-19. Reproduce with
`grep -ro "<pattern>" app components --include=*.tsx | wc -l`.

### A. Colour discipline

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| A1 | Three parallel colour systems: 41 `oklch` `:root` tokens, 9 `--temple-*` extensions, and **5,471** literal `amber-*`/`orange-*`/`stone-*` class occurrences in components | `app/globals.css:128-193`; count over `app components` | Per-component hand-picked palette classes are how sites were built before design tokens existed; nothing can be re-themed or dark-moded |
| A2 | `<body>` pins `bg-stone-50 text-stone-900`, overriding the token rule one line below it in the cascade | `app/layout.tsx:81` vs `app/globals.css:234-236` | The token layer is decorative — the document itself opts out |
| A3 | **31** arbitrary hex values inside class strings across 7 distinct colours, none of them in `app/globals.css` (`from-[#fff8ef]` ×8, `to-[#fff8ef]` ×7, `to-[#fffdf8]` ×6, `bg-[#7A1024]` ×1 …) | `components/home/QuickServices.tsx:78`; repo-wide grep for `(bg\|from\|to)-\[#…\]` | Bespoke off-whites per section: the page has no single ground colour |
| A4 | **287** `bg-gradient-to-*` occurrences. The amber→orange diagonal is on the header's active pill, every hero, every CTA, the admin sidebar and the admin page header | `components/events/EventCard.tsx:144,257`; `components/admin/common/AdminPageHeader.tsx:18`; `components/admin/layout/AdminSidebar.tsx:162`; `components/layout/Navbar.tsx:197` | Gradient-as-default is the clearest 2014–2016 signature in the codebase |
| A5 | The home page's `QuickServices` tiles introduce eight unrelated hue pairs — orange, red, sky/cyan, emerald/green, violet/purple, pink/rose, indigo/blue, teal | `components/home/QuickServices.tsx:23,30,37,44,51,58,65,72` | Multicoloured icon tiles read as an app-store grid, not as one institution |
| A6 | No success / warning / info tokens exist; the only status token is `--destructive`. `StatusBadge` therefore hardcodes 10 English status strings onto 6 Tailwind hue families | `app/globals.css:156`; `components/admin/crud/StatusBadge.tsx:13-52` | Status colour is invented at each call site; an unknown status silently falls to stone |
| A7 | A complete 31-property dark palette exists and nothing ever adds the `dark` class | `app/globals.css:195-228`; M01-F13 | Dead weight that makes the token file look richer than it is |

### B. Typography

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| B1 | There is no page-title size. `h1` ranges from `text-2xl` (`/search`) to `text-6xl` (Hero), and `text-5xl font-bold` is used as a *section* `h2` in nine home components | `components/home/{DonationCTA:50,FeaturedSevasClient:24,GallerySection:43,QuickServices:99,TempleGalleryPreview:21,TempleInfo:129,TempleTimings:79,Testimonials:135,UpcomingEvents:23}.tsx` *(2026-10-18: MOVED — `UpcomingEvents.tsx:25`, now `text-4xl lg:text-5xl`, by `ee8390c`)* | Every section shouts at the same volume, so nothing is a heading |
| B2 | Ten size steps in live use — `text-sm` ×1290, `text-xs` ×460, `text-lg` ×296, `text-2xl` ×164, `text-xl` ×100, `text-3xl` ×78, `text-4xl` ×59, `text-5xl` ×36, `text-base` ×18, `text-6xl` ×11 | repo counts | The body default (`text-base`, 16px) is used 18 times against 1,290 uses of 14px: the site's reading size is a caption size |
| B3 | `@theme inline` maps `--font-sans: var(--font-sans)` (self-referential, never defined) and `--font-mono: var(--font-geist-mono)` (never defined), and re-maps `--font-heading` to the broken `--font-sans`, fighting the `:root` `--font-heading: "Playfair Display"` set 84 lines earlier | `app/globals.css:3,87-89`, `:237-239` | `html { font-sans }` resolves to nothing; the browser default stack is doing the work |
| B4 | `@import "tailwindcss"` and three other `@import`s sit at line 77, after 76 lines of real CSS rules, which the CSS spec does not allow | `app/globals.css:1-80` | Behaviour depends on the bundler, not the stylesheet |
| B5 | Kannada is handled by four overlapping rules (`:12-15`, `:18-22`, `:42-49`, `:60-62` with `!important`) while `h1…h6` is assigned Playfair Display twice (`:25-27`, `:68-75`). Playfair has no Kannada glyphs, so a Kannada heading falls to an unspecified fallback with a different x-height | `app/globals.css` as cited; `app/layout.tsx:18-29` | Bilingual headings do not sit on the same baseline or optical size |
| B6 | **82** tracked-out uppercase label runs (`uppercase tracking-*`) | repo count | The all-caps eyebrow above a heading is the most common generated-page tell |

### C. Shape and elevation

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| C1 | Six radius steps live at once — `rounded-lg` ×587, `rounded-full` ×538, `rounded-xl` ×447, `rounded-2xl` ×210, `rounded-3xl` ×86 — plus 23 one-off arbitrary radii in 6 shapes — `rounded-[32px]` ×16, `[30px]` ×3, `[24px]` ×1, `[36px]` ×1, `[4px]` ×1, `rounded-[min(var(--radius-4xl),24px)]` ×1. The `--radius` scalar and its seven derived steps are never referenced | repo counts; M02 visual inventory; `app/globals.css:119-125,171` | Nothing shares a corner, so nothing reads as one family |
| C2 | Shadow on everything: `shadow-lg` ×160, `shadow-xl` ×51, `shadow-2xl` ×36. The `Card` primitive itself ships `shadow-lg` | `components/ui/card.tsx:13` | Uniform drop shadows under every box is the SaaS-card kit; elevation stops meaning anything |
| C3 | Three box-shadow glow utilities — one a double 40px + 80px bloom — plus a text glow; four in all | `app/globals.css:383-398` | Neon bloom on a devotional site |
| C4 | **59** `backdrop-blur*` uses, including a header that swaps blur radius and shadow on scroll | `components/layout/Navbar.tsx:154-158` | Frosted glass applied as decoration rather than to separate layers |
| C5 | Hover lift and scale are the default card affordance: 15 `hover:-translate-y-*` and 42 `hover:scale-1*` sites — `scale-105` ×27, `scale-110` ×13, `scale-150` ×1, `scale-100` ×1 | `components/home/QuickServices.tsx`; `components/events/EventCard.tsx:257`; repo grep | Everything jumps on hover; on touch, none of it exists |

### D. Layout and rhythm

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| D1 | Five container widths in use — `max-w-7xl` ×62, `max-w-4xl` ×37, `max-w-3xl` ×30, `max-w-6xl` ×19, `max-w-5xl` ×5 — so the page changes width as you navigate | repo counts | No grid; each page was laid out on its own |
| D2 | Four vertical band heights with no rule for choosing — `py-12` ×58, `py-16` ×36, `py-20` ×20, `py-24` ×12 | repo counts | Sections drift; the eye cannot find a rhythm |
| D3 | Everything is centred. The shared `SectionHeading` is `mb-12 text-center`, and 15 files re-declare a centred amber-pill → `text-5xl` h2 → `text-lg` paragraph block inline | `components/common/SectionHeading.tsx:11`; `components/home/UpcomingEvents.tsx:19-27` and 14 sibling files *(2026-10-18: MOVED — `ee8390c` set the Upcoming Events copy left in an 8/12 column at `UpcomingEvents.tsx:15-34`, still inline and still not `SectionHeading`; the 14 siblings are unchanged)* | Centre-everything is a brochure layout; it makes scanning and bilingual text harder |
| D4 | Eight `<SacredDivider>` ornaments sit between the home page's sections | `components/home/HomeClient.tsx:40,45,50,54,58,73,77,81` | Decorative separators instead of whitespace; each one is also a framer-motion subtree |

### E. Navigation and chrome

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| E1 | 80px header that changes background opacity, blur radius and shadow on scroll; the active item is a filled amber→orange gradient pill with `shadow-lg` | `components/layout/Navbar.tsx:154-160,194-199` | A tall, shape-shifting header with a glowing pill; modern institutional headers are short, opaque and still |
| E2 | Three hand-maintained copies of the same menu: desktop nav, mobile panel, footer | `components/layout/Navbar.tsx:182-431` vs `:442-629`; `components/layout/Footer.tsx:36-54` | Any nav change is a three-file edit and they drift |
| E3 | The route group renders no chrome; 28 files under `app/` import `Navbar`/`Footer` themselves (plus `components/home/HomeClient.tsx`), and 7 page files in 3 route trees — `app/calendar/*` ×3, `app/knowledge/*` ×3, `app/debug` ×1 — sit outside `(public)` with no layout at all. `(auth)` does have a layout, but its `<main>` carries no `id="main-content"` | M01-F05; `app/(public)/layout.tsx:1-18`; `app/(auth)/layout.tsx:9` | Header state resets on every navigation |
| E4 | Five nav dropdowns are `<button>` + conditional `<div>` with no `aria-expanded`, `aria-haspopup`, `role="menu"`, Escape or arrow keys | `components/layout/Navbar.tsx:207-218,248-259,300-310,352-362,392-401` | Keyboard users cannot use the main navigation |

### F. Component consistency

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| F1 | Three buttons (`Button`, `TempleButton`, `AnimatedButton`), three inputs, two cards, two toast systems, two global searches | M01 key-files table; M01-F18, F19, F43 | The same concept looks different on different pages |
| F2 | `SectionHeading` exists with 8 importers, and the 15 highest-traffic section headers ignore it | `components/common/SectionHeading.tsx`; D3 evidence | The shared primitive is not the one in use |
| F3 | `lib/formStyles.ts` — named by `AGENTS.md:297` and `docs/CODING-STANDARDS.md:94` as *the* design tokens — has **zero** importers. The same control classes are re-declared in 8 files — the four form fields, `app/admin/{billing,bookings,donations}/page.tsx` and `components/ui/MicroInteractions.tsx` — as a split `clsx()` list, so a literal grep for the exported string finds only `lib/formStyles.ts` itself | `lib/formStyles.ts:1`; `components/ui/form/{FormTextField:39-46,FormTextArea:38-47,FormNumberField:38-47,FormSelectField:46-55}.tsx`; `grep -rl "rounded-xl border border-stone-300 bg-white px-4 py-3" app components` | The documented token module is a fiction |
| F4 | `lib/animations.ts` defines 25 shared variants and easings and is imported by nothing; **44** files import `framer-motion` and each defines its own | `lib/animations.ts:4-288`; repo count | Four motion vocabularies, none authoritative |
| F5 | `EventCard` renders no image although `TempleEvent.imageUrl` exists, and puts four equally-weighted outline buttons (Share / Calendar / Notify / Directions) *above* the only real action | `components/events/EventCard.tsx:141-260` | The card's visual budget goes to secondary utilities |
| F6 | `docs/UI-GUIDELINES.md` documents components that do not exist: `<DataTable>`/`<DataTableHeader>` (`:224-237`), shadcn `<Sidebar>` (`:251-265`), Card variants `flat`/`bordered` (`:172-173`), Button sizes `md`/`lg` (`:154-155`), `font-family: var(--font-sans)` (`:58`) | that file vs `components/ui/table.tsx`, `components/ui/card.tsx`, `components/ui/button.tsx:17`, `app/globals.css:87` | The guideline cannot be used as a yardstick; it describes a different product |

### G. Motion

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| G1 | **33** `whileInView` call sites across 44 framer-motion importers: nearly every section fades and rises as you scroll past it | repo counts | Scroll-triggered entrances on every block are the generic default |
| G2 | The hero runs one `<canvas>` requestAnimationFrame loop (`FloatingParticles`, 25 particles) plus 15 framer-motion divs on `repeat: Infinity` (`FloatingDots` draws no canvas) and two `DeepaFlame` canvases — four are written, two render, both `hidden lg:block` — behind a hand-rolled scroll listener driving a parallax | `components/home/Hero.tsx:31-60,118-130,304,324,332,335`; `components/ui/FloatingParticles.tsx:182,200,272-295` *(2026-10-18: MOVED to `:183,201,273-296` by the line-1 `/* eslint-disable */` of `6408c1d`)* | Ambient particle fields; a battery cost with no informational payload |
| G3 | Six infinite CSS animations ship globally — `pulse-ring` (2s), `float-gentle` (4s), `shimmer` (2s), `flicker` (0.5s), `skeleton-loading` (1.5s), `marquee-smooth` (30s) | `app/globals.css:498-565,613-617,653-665` | Something is always moving, so nothing that moves means anything |
| G4 | Motion durations are declared twice and agree nowhere: `ANIMATION_DURATION` in the dead `lib/animations.ts:4-10`, `duration-300` in the header, `0.4s` in `.temple-card`, `0.6s` in `.section-fade-in` | `lib/animations.ts:4-10`; `components/layout/Navbar.tsx:154`; `app/globals.css:431,598` | Transitions of different lengths on adjacent elements |

### H. Admin console

| # | Finding | Evidence | Why it reads as dated |
|---|---|---|---|
| H1 | The sidebar is a white→amber→orange vertical gradient, 17rem wide, with `shadow-xl shadow-amber-500/10` | `components/admin/layout/AdminSidebar.tsx:162` | A tinted, shadowed rail; current consoles use a flat surface and a hairline |
| H2 | Every admin page opens with the same `Sparkles` icon in a gradient tile, whatever the page is about — 58 importers | `components/admin/common/AdminPageHeader.tsx:18-19` | Decoration that carries zero information, repeated 58 times |
| H3 | Only 4 pages plus `EventTable` use `CrudTable`; `sevas`, `receipts`, `billing`, `pooja`, `aaradhane`, `seva-bookings`, `users`, `featured` and all of `ai/*` hand-roll their own `<table>` | M05 §9 pattern table | Nine table designs in one console |
| H4 | No skeletons anywhere in admin; the loading state is a bespoke spinner duplicated in two files | `app/admin/layout.tsx:14`, `components/admin/layout/AdminAuthGuard.tsx:27` | Full-page spinner then a layout jump |
| H5 | `TableActions` deletes immediately with no confirmation; where confirmation exists it is the browser `confirm()` — 38 call sites in 30 files, 10 of them in the 9 `app/admin/settings` pages | `components/admin/crud/TableActions.tsx:52-63`; M05 pattern table | A native OS dialog in the middle of a designed console |
| H6 | The dashboard re-declares `MiniStat` and `SectionCard` inline while `components/admin/common/StatCard.tsx` and `components/admin/common/SectionCard.tsx` exist, and its Refresh button is `window.location.reload()` | `app/admin/page.tsx:45,59` | Two stat tiles with different padding on the same screen |
| H7 | `CrudTable` has no sort affordance, no pagination, no right-alignment for money or counts, and no row density rule | `components/admin/crud/CrudTable.tsx:31-89` | Long lists become unusable; currency columns cannot be compared down a column |

### I. Accessibility — measured, not asserted

Ratios computed from the oklch values in `app/globals.css` and the Tailwind hex values for the
literal classes, sRGB relative luminance per WCAG 2.x.

| # | Pair | Ratio | Verdict | Evidence |
|---|---|---:|---|---|
| I1 | white on `bg-orange-600` (the primary Button) | **3.56:1** | fails AA 4.5:1 | `components/ui/button.tsx:34` |
| I2 | white on `from-amber-600 to-orange-500` (the CTA gradient) | **3.19:1 → 2.80:1** | fails AA across the whole sweep | `components/events/EventCard.tsx:257`; `components/home/*` CTAs |
| I3 | `text-orange-600` on white (Button `outline`) | **3.56:1** | fails AA | `components/ui/button.tsx:36` |
| I4 | `text-stone-400` on white (search icon, placeholders) | **2.52:1** | fails AA and 1.4.11 | `components/admin/common/SearchBox.tsx:28,39` |
| I5 | `--primary-foreground` on `--primary` | **2.14:1** | the token system's own primary pair fails | `app/globals.css:140-141` |
| I6 | `--primary` on `--card` | **2.26:1** | gold cannot carry text or an icon on white | `app/globals.css:134,140` |
| I7 | `--border` on `--card` | **1.44:1** | below the 3:1 WCAG 1.4.11 asks of a control boundary | `app/globals.css:134,159` |
| I8 | Two `aria-live` regions mounted at once; `announce()` pushes `JSON.stringify({message,priority})` into one | — | a screen reader reads raw JSON | `components/common/A11yProvider.tsx:39,54-63`; `app/layout.tsx:85` |
| I9 | The global skip link targets `#main-content` on routes that render no such element (`/calendar/*`, `/knowledge`, `/debug`, all `(auth)`) | — | first keyboard stop is a dead link | `app/layout.tsx:84`; M01-F47 |
| I10 | Nested `<main>`: the public layout renders one and 24 child pages render their own | — | two `main` landmarks per page | M03-F21 |

**The headline accessibility fact:** the site's primary action colour, in both the token system and
the shipped components, cannot legally carry white text. Gold and saffron are *light* colours. The
redesign below puts dark ink on gold rather than inventing a darker gold — which would be a new
colour value, and the palette stays.

### Status as of 2026-10-18

Re-checked on Sunday 2026-10-18 against code commit `424fdb8`, by script against the read-only 2026-09-19
snapshot; nothing was built or run.

**Evidence lines.** Every file the Diagnosis cites still exists. Comparing each cited line with the same line
in the snapshot gave 210 identical, 6 shifted down by one and 4 changed, and all ten differences sit in three
rows, now annotated in place:

| Row | What happened | Verdict |
|---|---|---|
| B1 | `UpcomingEvents.tsx:23` is now `:25`, and the heading became `text-4xl lg:text-5xl` (`ee8390c`, 2026-10-06) — still the shouting section `h2` at desktop width | MOVED, still open |
| D3 | The same commit moved the Upcoming Events header into an 8/12 column and dropped `mx-auto max-w-3xl text-center`, so that one copy is now left-aligned — incidentally, by a feature commit. It is still the inline pill → `h2` → paragraph block, not `SectionHeading`, and the other 14 copies are unchanged | MOVED, still open (1 of 15 de-centred) |
| G2 | `FloatingParticles.tsx` gained the file-wide `/* eslint-disable */` of `6408c1d` on line 1, so its anchors read one lower | MOVED, still open |

**No row is RESOLVED.** No row's dated pattern has been removed. The only removal anywhere in `app/` or
`components/` is the one D3 copy `ee8390c` de-centred — one `max-w-3xl` and two `text-center`s gone from
`components/home/UpcomingEvents.tsx` — and every other measured pattern is flat or higher file by file.

**The counts moved up, not down.** Same patterns, same scope (`app` + `components`, `*.tsx`); the snapshot
column reproduces this plan's own numbers exactly, which is what makes the comparison fair.

| Row | Pattern | 2026-09-19 | 2026-10-18 |
|---|---|---:|---:|
| A1 | `amber-*` / `orange-*` / `stone-*` literals | 5,471 | 5,515 |
| A3 | arbitrary hex in classes | 31 | 31 |
| A4 | `bg-gradient-to` | 287 | 289 |
| B2 | `text-sm` / `text-base` | 1,290 / 18 | 1,307 / 19 |
| B6 | `uppercase tracking-` | 82 | 85 |
| C1 | arbitrary radii `rounded-[` | 23 | 24 |
| C2 | `shadow-lg` / `shadow-xl` / `shadow-2xl` | 160 / 51 / 36 | 160 / 51 / 37 |
| C4 | `backdrop-blur` | 59 | 62 |
| C5 | `hover:-translate-y-` / `hover:scale-1` | 15 / 42 | 15 / 43 |
| D1 | `max-w-7xl` / `max-w-3xl` (the other three unchanged) | 62 / 30 | 63 / 29 |
| D2 | `py-12` / `py-16` / `py-20` / `py-24` | 58 / 36 / 20 / 12 | unchanged |
| F4 | files importing `framer-motion` | 44 | 45 |
| G1 | `whileInView` | 33 | 33 |
| H2 | `AdminPageHeader` importers | 58 | 58 |
| H5 | `confirm(` call sites | 38 | 38 |

**Redesign work visible in the code: none.** Every Phase 1–2 marker from §8 was looked for and is absent:
`app/globals.css` and `app/layout.tsx` are unchanged since 2026-09-19 (identical to the snapshot copies once
line endings are ignored, and untouched by any commit since), so the `@import` order, the self-referential font
variables, Playfair Display and `bg-stone-50 text-stone-900` are all still there; `lib/navigation.ts` does not
exist; `lib/formStyles.ts` and `lib/animations.ts` still have zero importers; `components/ui/TempleButton.tsx`
is still present; there is no shared `SectionHeader` primitive (the only `SectionHeader` is a file-local helper at
`components/recommendation/RecommendationsSection.tsx:142`, already there on 2026-09-19), no `statusTone`, no `Source_Serif_4`; `Navbar.tsx` is still
633 lines; the home page still carries eight `SacredDivider`s; nothing adds the `dark` class.

**New UI since 2026-09-19, all in the old idiom.** Five festival components (`components/festival/FestivalCountdown.tsx`,
`FestivalCountdownWrapper.tsx`, `FestivalLiveUpdates.tsx`, `FestivalPhotoHighlights.tsx`, `FestivalGuide.tsx`,
2026-10-06 → 07) bring 2 gradients, 3 `backdrop-blur`s and 3 tracked-uppercase eyebrows of their own — the
whole of the A4, C4 and B6 increases above; the home
Upcoming Events band became an 8/12 + 4/12 grid; Temple Explorer gained an accessibility panel that never
renders. And the Expo app in `apps/mobile` (2026-09-30) hard-codes a second brand palette — eight `temple.*` hex values in
`apps/mobile/tailwind.config.js:8-14`, led by maroon `#800000` and gold `#D4AF37` (`apps/mobile/app/(tabs)/_layout.tsx:9,12`,
`apps/mobile/tailwind.config.js:8,11`), with cream `#FFFDD0` also hard-coded in the screens; 22 distinct hex literals
in the app in all — none of which appears in the web code, and in neither form in `app/globals.css`. This plan and its specimen still
introduce no colour value; the product now carries two palettes. When the shared token package of the
migration report's §3.2 exists, the phone should take the converted `oklch()` tokens, not keep its own hex.

**The token file and the specimen.** `app/globals.css` has not changed, so §3's palette and every contrast
ratio in §1 *I* and §7.1 stand as computed. The specimen has not changed either; re-scripted on 2026-10-18 it
carries **28 distinct colour literals, 0 of them absent from `app/globals.css`**.

**Where this plan now sits in the programme.** The redesign is Phase 4 of the migration report, which its
§7.6 re-base places at Monday 2027-02-08 → Friday 2027-03-19; whether it is a re-skin or a component-library
rebuild (that report's §4.3 and decision 7) is due at the re-based Phase-2 gate, Friday 2027-01-08.

---

## 2. Design principles

### The direction, and what it deliberately is not

Before the principles, the one-line brief this plan designs against: *a bilingual notice board for a
working temple, run by volunteers, read on a phone in a queue.* Not a brochure, not a brand site, not
a donation funnel with a temple photograph on it.

The boldness budget is spent in exactly one place — the **Today panel** directly under the hero,
where the date, tithi, nakshatra, open/closed state and the day's seva are set as large, aligned,
tabular data. Everything around it is quiet: one accent, one measure, two radii, borders instead of
shadows. That is the opposite of the current design, which spends a little boldness on every one of
thirteen home-page sections and therefore has no focal point at all.

Three directions were considered and rejected. A **warm-cream-and-serif editorial layout** was
rejected because it is the current default output of every design tool and would read as generic
within a year, and because the existing `--background` is already a warm cream — leaning further into
it would have produced a site with no ground to contrast against. A **dark, jewel-toned "sacred"
treatment** built on `--temple-maroon` was rejected because a temple's public site is read outdoors
in daylight on cheap screens, where a dark ground loses more legibility than it gains in atmosphere;
maroon survives as the footer only. A **card-grid dashboard** for the home page was rejected on
NN/g's own grounds — cards suit heterogeneous, browsable content, and a devotee arriving at this site
is not browsing, they are checking one fact.

What follows are the eight principles that fall out of that direction, chosen for this subject — a Madhva matha in Yelahanka New Town serving a
bilingual, mostly phone-using congregation, plus a handful of trust volunteers running the console.

1. **The day is the hero.** The most characteristic artefact in a temple's world is not a photograph
   of the building — it is *today*: the tithi and nakshatra, whether the sanctum is open, which seva
   is being performed and at what time. That is what a devotee opens the site for. The home page
   opens with it, set as legible data, not as a decorated widget.
2. **One accent, four appearances.** `--primary` (gold) appears in exactly four roles on any page:
   the active navigation marker, the primary button fill, the "today" marker in the calendar, and
   the focus ring's companion. Gold is a highlight, not a surface. Deep red carries links; maroon
   carries the single ornamental rule.
3. **Content first, chrome last.** No section may be introduced by a badge, an ornament and a
   divider. A section is introduced by its heading and separated by whitespace.
4. **Left-aligned, single measure.** Body copy runs 62–70 characters in one 720px column. Centring
   is reserved for the hero and for empty states. Left alignment is also what makes a Kannada line
   and its English line read as a pair rather than as two independent objects.
5. **Both scripts, one skeleton.** Kannada and English sit on the same baseline grid at the same
   optical size. A heading typeface without Kannada coverage is not a heading typeface here.
6. **Motion answers an action.** Opening, expanding, confirming and dismissing may animate. Scrolling
   may not. Nothing loops. `prefers-reduced-motion` removes what remains.
7. **Mobile is the design, desktop is the variant.** Every specification below is written at 390px
   first. The admin console is the one exception and is designed at 1280px, with a working 390px
   fallback for on-the-day booking checks.
8. **One primitive per concept.** One button, one input, one card shell, one table, one toast. A
   second implementation of an existing concept is a defect, not a variant.

---

## 3. Keep — the palette

**No value in `app/globals.css:128-228` changes.** What changes is which token is allowed where.
sRGB hex shown for reference only; the CSS keeps the `oklch()` strings verbatim.

### Light mode semantic tokens

| Token | Value | sRGB | Role today | Role in the new system |
|---|---|---|---|---|
| `--background` | `oklch(0.985 0.015 95)` | `#fdfaef` | Declared, then overridden by `bg-stone-50` on `<body>` | **The only page ground.** Remove the `<body>` literals; every page sits on this |
| `--foreground` | `oklch(0.25 0.02 50)` | `#2a1f19` | Body ink (also overridden) | Body ink **and the ink on `--primary`** (7.10:1) |
| `--card` | `oklch(1 0 0)` | `#ffffff` | Card fill | Raised surface: cards, table body, sheet, modal, sticky bars |
| `--card-foreground` | `oklch(0.25 0.02 50)` | `#2a1f19` | = foreground | Unchanged; keep as the alias so a future dark mode works |
| `--popover` / `--popover-foreground` | `oklch(1 0 0)` / `oklch(0.25 0.02 50)` | `#ffffff` / `#2a1f19` | Unused in practice | Menus, dropdowns, date picker, combobox |
| `--primary` | `oklch(0.75 0.16 80)` | `#e2a000` | Nominal primary; components use `orange-600` instead | **The single accent.** Fill for the primary button, 2px active-nav underline, today-marker, selected chip. Never a text or icon colour on white (2.26:1) |
| `--primary-foreground` | `oklch(0.98 0.02 95)` | `#fcf9ea` | Text on primary — **2.14:1, unusable** | **Re-roled:** ink on *dark* surfaces only (maroon banner, deep-red destructive fill). Text on `--primary` becomes `--foreground` |
| `--secondary` | `oklch(0.95 0.02 90)` | `#f4eee0` | Barely used | Secondary button fill; table header fill; chip ground |
| `--secondary-foreground` | `oklch(0.3 0.02 50)` | `#362b25` | — | Ink on `--secondary` (11.86:1) |
| `--muted` | `oklch(0.95 0.015 90)` | `#f2eee3` | Barely used | Skeleton ground, disabled fill, code/quote ground |
| `--muted-foreground` | `oklch(0.5 0.02 50)` | `#6d6059` | Barely used | **Secondary text (6.04:1 on card)** *and* the resting border of every form control (`--border` is too light — see I7) |
| `--accent` | `oklch(0.92 0.06 60)` | `#ffdcbd` | Barely used | Quote-card ground and the hero's text panel; never a button |
| `--accent-foreground` | `oklch(0.35 0.08 45)` | `#5c2b13` | — | Ink on `--accent` (9.00:1) |
| `--destructive` | `oklch(0.55 0.2 25)` | `#cc272e` | Nominal | Destructive fill with `--primary-foreground` ink (5.08:1; `--card` ink is 5.38:1); error border and error text on white |
| `--border` | `oklch(0.88 0.02 85)` | `#ddd7c9` | Everything | **Decorative separators only** — table row rules, card outline, section rules. Not a control boundary (1.44:1) |
| `--input` | `oklch(0.94 0.02 90)` | `#f0ebdc` | Unused | Fill of a *filled* input (admin search); public inputs stay `--card` |
| `--ring` | `oklch(0.75 0.16 80)` | `#e2a000` | Nominal focus ring | Inner halo of the two-tone focus ring only; the **outer, load-bearing** ring stays `oklch(0.5 0.2 45)` from `app/globals.css:299` (6.22:1) |
| `--chart-1…5` | gold → deep-red ramp | `#e2a000 … #9b5e5e` | Charts | Unchanged. Note only `--chart-4` (4.14:1) and `--chart-5` (5.05:1) may carry text on white; 1–3 are fills with a label outside |
| `--sidebar…` (8 tokens) | `app/globals.css:174-181` | — | Declared for a shadcn `Sidebar` that does not exist | **Adopt them** for the real `AdminSidebar`, replacing its gradient. `--sidebar` `#faf8f1`, `--sidebar-border` `#ddd7c9` |
| `--radius` | `0.75rem` | — | Declared, ignored | Re-based — see §4.3 |

### Temple extensions

| Token | Value | sRGB | Role today | Role in the new system |
|---|---|---|---|---|
| `--temple-gold` | `oklch(0.78 0.18 85)` | `#ebab00` | Gradient stop | Hover state of `--primary` fills |
| `--temple-gold-light` | `oklch(0.85 0.12 85)` | `#f2c86c` | Gradient stop | Selected-row tint in admin tables; the only "highlight fill" |
| `--temple-gold-dark` | `oklch(0.65 0.2 80)` | `#cd7b00` | Gradient stop | Pressed state of `--primary`; a 3.28:1 icon-only colour on white (non-text, passes 1.4.11) |
| `--temple-saffron` | `oklch(0.72 0.2 55)` | `#ff7900` | Gradient stop everywhere | **Retired from surfaces.** Reserved for the festival/aaradhane category marker — a 4px left rule on a card, one place |
| `--temple-saffron-light` | `oklch(0.82 0.14 55)` | `#ffaa66` | Gradient stop | Ground of the festival marker's badge |
| `--temple-deep-red` | `oklch(0.45 0.18 25)` | `#a20519` | Unused | **Link colour** (8.18:1 on card) and the "closed" status ink |
| `--temple-maroon` | `oklch(0.35 0.12 20)` | `#6b141f` | Unused | The one dark surface: footer ground and the hero's status strip, with `--card` ink (11.98:1) or `--primary-foreground` ink (11.33:1) |
| `--temple-cream` | `oklch(0.96 0.02 92)` | `#f6f2e3` | Gradient stop | Alternate section band — the only way a section may differ from its neighbour |
| `--temple-warm-white` | `oklch(0.98 0.01 95)` | `#faf8f1` | Gradient stop | Admin canvas (`--sidebar` already equals it) |

### Dark mode

`app/globals.css:195-228` is a complete, correct dark palette that nothing activates. **Keep the
block, wire the switch** (`ProfileContext.updateTheme` already persists a `Theme`; only the
`<html class="dark">` toggle is missing — M01-F13). Everything specified below is written against
tokens, so dark mode costs one `useEffect`, not a redesign.

---

## 4. Change — the new token system

### 4.1 Type

**Replace Playfair Display. Keep Inter. Change the Kannada face to its serif sibling.** Three
families, three jobs, and both scripts finally share a skeleton.

| Role | Family | Why |
|---|---|---|
| Display + long-form body, Latin | **Source Serif 4** (variable, 400/600/700) | A text-first transitional serif that holds up at 15px as well as at 44px. Playfair is a Didone: its hairlines disappear below 24px and it has no Kannada companion |
| Display + body, Kannada | **Noto Serif Kannada** (400/600/700) | The serif sibling of the face already loaded, so a bilingual heading pair shares stroke contrast and x-height. Replaces `Noto_Sans_Kannada` in `app/layout.tsx:24-29` |
| UI chrome | **Inter** (already loaded) | Buttons, form labels, table headers, badges, breadcrumbs, admin everything. Confined to ≤16px |

Fallback stacks (the specimen uses these, so it degrades to Georgia / Segoe UI with no downloads):

```css
--font-serif: "Source Serif 4", "Noto Serif Kannada", Georgia, "Times New Roman", serif;
--font-ui:    Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
--font-kn:    "Noto Serif Kannada", "Source Serif 4", serif;
```

**Scale.** Nine steps, `clamp()` between 390px and 1280px, line heights on a 4px rhythm — the
5px-rhythm idea and the "one body size for everything" discipline are taken from the GOV.UK type
scale, sized down for a 16px base rather than GOV.UK's 19px.

| Token | Mobile → desktop | Line height | Weight | Family | Used for |
|---|---|---|---|---|---|
| `--text-display` | 32 → 44px | 1.1 | 600 | serif | Hero h1 only. One per page |
| `--text-h1` | 26 → 32px | 1.2 | 600 | serif | Page title |
| `--text-h2` | 21 → 24px | 1.3 | 600 | serif | Section heading |
| `--text-h3` | 18 → 20px | 1.35 | 600 | serif | Card title, form section |
| `--text-body-lg` | 17 → 18px | 1.6 | 400 | serif | Lead paragraph, article body |
| `--text-body` | 16 → 16px | 1.6 | 400 | serif (prose) / ui (interface) | **The default.** Never smaller for reading copy |
| `--text-ui` | 15 → 15px | 1.4 | 500 | ui | Buttons, labels, nav, table cells |
| `--text-meta` | 13 → 13px | 1.4 | 500 | ui | Date, location, price, table header, badge |
| `--text-micro` | 12 → 12px | 1.3 | 500 | ui | Footnote, caption. Never for anything actionable |

Line-height for Kannada is `1.75` at every step (the existing `.kannada-text` rule at
`app/globals.css:42-49` already uses 1.8 — keep the idea, unify the number). Measure is capped at
`68ch` for `--text-body` and `72ch` for `--text-body-lg`.

Deleted: `text-5xl`/`text-6xl` as section headings, the `.text-display`/`.text-heading`/
`.text-subheading` clamps at `app/globals.css:690-705`, all 82 `uppercase tracking-*` runs, and the
amber pill eyebrow.

### 4.2 Spacing

4px base. Nine steps only; anything else is a bug. The step list follows the Primer sizing
primitives, which run in 4px increments to 48px (with a 2px first step) and 16px increments above it.

| Token | px | Tailwind | Use |
|---|---:|---|---|
| `--space-1` | 4 | `1` | Icon-to-label gap |
| `--space-2` | 8 | `2` | Inside a badge; between stacked meta lines |
| `--space-3` | 12 | `3` | Control inner padding (vertical) |
| `--space-4` | 16 | `4` | Control inner padding (horizontal); page gutter on mobile |
| `--space-6` | 24 | `6` | Card padding; grid gutter |
| `--space-8` | 32 | `8` | Between a heading and its content |
| `--space-12` | 48 | `12` | **Section band, mobile** |
| `--space-16` | 64 | `16` | **Section band, desktop** |
| `--space-24` | 96 | `24` | **Page opener band only** |

**Section rhythm rule:** exactly three band heights — `py-12` on mobile, `py-16` on desktop,
`py-24` for the band immediately under the hero. `py-20` (20 uses) is deleted. Adjacent sections
never both get a band; the divider is the whitespace.

### 4.3 Radius

**Two values plus a pill.** `--radius` is re-based from `0.75rem` to `0.5rem` and the derived
`@theme inline` ladder at `app/globals.css:119-125` is replaced by three named tokens.

| Token | Value | Applies to |
|---|---|---|
| `--radius-control` | `0.5rem` (8px) | Button, input, select, textarea, badge, chip, tab, table cell focus |
| `--radius-surface` | `1rem` (16px) | Card, panel, modal, sheet, image frame, toast |
| `--radius-pill` | `9999px` | Avatars, status dots, and nothing else |

`rounded-2xl`, `rounded-3xl` and every `rounded-[NNpx]` are deleted. Of the 538 `rounded-full` uses,
only avatars and dots survive; pills-as-buttons become `--radius-control`. The two-value scale is
the Primer pattern (small / medium / large / full), narrowed because this product has two surface
classes, not four.

### 4.4 Elevation

**Cards do not have shadows. They have a border.** Only things that float above the page get one.

| Token | Value | Used by |
|---|---|---|
| — (none) | `border: 1px solid var(--border)` | Card, panel, table, stat tile, form section |
| `--shadow-raise` | `0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent), 0 2px 8px color-mix(in oklab, var(--foreground) 6%, transparent)` | Dropdown, popover, toast, sticky bar once scrolled |
| `--shadow-overlay` | `0 8px 32px color-mix(in oklab, var(--foreground) 14%, transparent)` | Modal, mobile nav sheet, drawer |

`color-mix` keeps the shadow tinted with the page's own ink and introduces no new colour value.
Deleted: `shadow-lg`/`xl`/`2xl` as decoration (247 uses), the four glow utilities
(`app/globals.css:383-398`), `.temple-card`'s hover shadow (`:436`), all 59 `backdrop-blur` uses
except the mobile sheet's scrim.

Interactive cards signal clickability the way NN/g describes — a border plus a ground distinct from
the canvas — and on hover change **only** the border to `--muted-foreground` and underline the
title. No lift, no scale, no shadow change.

### 4.5 Borders and dividers

| Situation | Rule | Reason |
|---|---|---|
| Form control boundary | `1px solid var(--muted-foreground)` (6.04:1) | `--border` is 1.44:1 and WCAG 1.4.11 asks 3:1 of a boundary that is the only indicator of a control. GOV.UK uses a dark 2px input border for the same reason |
| Control, focused | `2px solid var(--muted-foreground)` + outline `2px solid oklch(0.5 0.2 45)` offset `2px` | The outline colour already exists at `app/globals.css:299` and measures 6.22:1 |
| Control, error | `2px solid var(--destructive)` + an icon + a text message. Never colour alone | 1.4.1 |
| Card, table, panel | `1px solid var(--border)` | Decorative grouping, 1.4.11 does not apply |
| Section rule | `1px solid var(--border)`, full container width, no ornaments | Replaces `SacredDivider` |
| Category marker | `4px solid var(--temple-saffron)` on the card's inline-start edge | The one place saffron survives |

### 4.6 Container, grid, breakpoints

| Token | Value |
|---|---|
| `--container-page` | `min(100% - 2 * var(--gutter), 1200px)` |
| `--container-prose` | `min(100% - 2 * var(--gutter), 720px)` |
| `--gutter` | `16px` < 768px, `24px` 768–1023px, `32px` ≥ 1024px |
| Grid | 4 columns < 640px · 8 columns 640–1023px · 12 columns ≥ 1024px, gutter `--space-6` |

One page width. `max-w-7xl` (1280px) becomes `--container-page` (1200px); `max-w-4xl`, `max-w-3xl`,
`max-w-6xl`, `max-w-5xl` all become either `--container-page` or `--container-prose`. Breakpoints
stay Tailwind's defaults (640 / 768 / 1024 / 1280 / 1536) — they are already what the code uses and
match Primer's ladder closely enough that changing them buys nothing.

### 4.7 Motion

| Token | Value | Permitted on |
|---|---|---|
| `--motion-instant` | `120ms cubic-bezier(0.2,0,0.4,1)` | Colour, border, opacity on hover/active/focus |
| `--motion-enter` | `200ms cubic-bezier(0.2,0,0,1)` | Menu, popover, toast, sheet entering |
| `--motion-exit` | `140ms cubic-bezier(0.4,0,1,1)` | The same, leaving |
| `--motion-page` | `240ms` opacity only | Route change; no `y` translation |

Rules: **nothing animates on scroll** — all 33 `whileInView` sites are removed; **nothing loops** —
the five infinite keyframes and both canvases go; **transform is only used for things that actually
move** (a sheet sliding in, a disclosure opening); **one orchestrated moment per page** — on the
home page, the Today panel's three numerals fade in once over 200ms with a 40ms stagger, and that is
the only non-user-triggered motion on the site. `prefers-reduced-motion: reduce` removes even that
(the global rule at `app/globals.css:351-363` already does the heavy lifting; keep it).

`lib/animations.ts` becomes the single vocabulary — trimmed to the four durations above, one easing
pair, and four variants (`fade`, `sheet`, `popover`, `collapse`). The other 21 exports are deleted.

---

## 5. Primitive specifications

Each row: what exists today → what to write instead → why, in one line. "Classes" are Tailwind v4
with the tokens above exposed as theme values, written here as `bg-[--token]` so the mapping is
unambiguous; once the tokens are registered in `@theme`, the shorter `bg-primary` form is equivalent
and preferred in the code.

Two conventions run through every primitive and are worth stating once rather than in sixteen rows.
**First, a primitive owns its geometry and nothing else.** Height, padding, radius, border, type step
and focus treatment are decided inside the component; colour *role* is decided inside the component;
spacing *between* components is decided by the layout that contains them. A caller that passes
`className="mt-4 rounded-3xl"` is telling you the primitive is wrong. **Second, a primitive has one
implementation.** Where this plan says "retire", it means delete the file in the same pull request
that replaces it — the current codebase carries three buttons, three inputs, two toast systems and
two global searches precisely because each replacement was added beside its predecessor rather than
over it, and a redesign that repeats that mistake makes the next one twice as expensive.

### 5.1 Button — `components/ui/button.tsx`

| Variant | Today | Proposed | Rationale |
|---|---|---|---|
| `primary` | `bg-orange-600 hover:bg-orange-700 text-white h-11 rounded-lg px-4 py-3` (`:34,:43`) | `bg-[--primary] text-[--foreground] hover:bg-[--temple-gold] active:bg-[--temple-gold-dark] h-11 rounded-[--radius-control] px-5 text-ui font-medium` | White on orange-600 is 3.56:1; `--foreground` on `--primary` is 7.10:1 and uses the palette that already exists |
| `secondary` | `bg-stone-700 hover:bg-stone-800 text-white` (`:35`) | `bg-[--secondary] text-[--secondary-foreground] border border-[--border] hover:bg-[--muted]` | A dark slab is not a secondary action; 11.86:1 |
| `outline` | `border border-orange-600 text-orange-600 hover:bg-orange-50` (`:36`) | `border border-[--muted-foreground] text-[--foreground] hover:border-[--foreground] hover:bg-[--secondary]` | orange-600 text is 3.56:1 |
| `ghost` | `bg-transparent text-stone-700 hover:bg-stone-100` (`:39`) | `text-[--foreground] hover:bg-[--secondary]` | Unchanged in spirit, tokenised |
| `destructive` (merge `danger`) | two identical variants `bg-red-600` (`:37,:38`) | `bg-[--destructive] text-[--primary-foreground] hover:opacity-90` | 5.08:1; delete the duplicate `danger` key |
| `link` (new) | — | `text-[--temple-deep-red] underline underline-offset-4 decoration-1` | Links need a colour that passes: 8.18:1 |
| Sizes | `default h-11`, `sm h-9`, `icon h-10 rounded-full`, `icon-sm h-8 rounded-full` (`:43-46`) | `sm h-9 px-3`, `md h-11 px-5` (default), `lg h-12 px-6`, `icon h-11 w-11 rounded-[--radius-control]` | `icon-sm` at 32px is under Material's 48dp guidance; icon buttons square off with everything else |
| Loading | replaces children with the string `"Please wait…"` (`:60`) | keep the label, prepend a 16px spinner, `aria-busy="true"`, width locked | The button's name must not change mid-flow |
| Focus | inherits the global outline | `focus-visible:outline-2 focus-visible:outline-offset-2 outline-[oklch(0.5_0.2_45)]` | 6.22:1, already in `app/globals.css:299` |
| Retire | `components/ui/TempleButton.tsx` (126 lines), `AnimatedButton` in `components/ui/MicroInteractions.tsx` | — | Two of the three buttons are dead or decorative; F1 |

### 5.2 Input / select / textarea — `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/form/*`, `lib/formStyles.ts`

| Item | Today | Proposed | Rationale |
|---|---|---|---|
| Control shell | `w-full rounded-lg border border-stone-300 px-4 py-3` + `focus:ring-2 focus:ring-orange-200` (`components/ui/input.tsx:24-25`) | `h-11 w-full rounded-[--radius-control] border border-[--muted-foreground] bg-[--card] px-4 text-body` | 3:1 boundary; 44px touch height |
| Focus | orange ring, 2px, low contrast | `border-2 border-[--muted-foreground]` + outline `2px oklch(0.5 0.2 45)` offset 2 | Visible against gold and against white |
| Label | inside the component, `text-sm text-stone-700` (`components/ui/input.tsx:16`) | `text-meta font-medium text-[--foreground]`, always above, always `<label for>` | GOV.UK: label above, sized as a heading when it is the page's question |
| Hint | none | `text-meta text-[--muted-foreground]` between label and control, one short sentence, no full stop | GOV.UK hint-text rule |
| Error | `border-red-500` + `text-sm text-red-600` (`:26,:33`) | `border-2 border-[--destructive]`, `AlertCircle` 16px, message in `--destructive` at `text-meta`, `aria-describedby` wired | Colour alone is not a signal |
| Width | always `w-full` | width proportional to expected content — 4ch for a year, 10ch for a pincode, full for a name | GOV.UK input-width rule; a full-width year field is a lie about the input |
| Wrapper bug | `Input` wraps itself in `div.space-y-2`, so `className="hidden"` hides only the `<input>` | move the wrapper to `FormGroup`; `Input` renders only the control | M01 key-files note |
| Token source | `lib/formStyles.ts` has **zero** importers; the same classes are re-declared in 8 files (4 form fields, 3 admin pages, `components/ui/MicroInteractions.tsx`) | delete the string, export `controlClass`, `labelClass`, `hintClass`, `errorClass` from `lib/formStyles.ts` and import in all eight | F3 |
| Select | `FormSelectField` uses a native `<select>`; a correct base-ui `Select` exists unused | use `components/ui/select.tsx` | M01 calls it the most correct primitive in the kit |
| Switch | `FormSwitchField` is a native checkbox with hardcoded "Active"/"Inactive" labels | use `components/ui/switch.tsx`; caller supplies labels | Consistency, and the labels are not always right |

### 5.3 Card shells

| Card | Today | Proposed | Rationale |
|---|---|---|---|
| Base `Card` | `rounded-2xl border border-stone-200 bg-white shadow-lg` (`components/ui/card.tsx:13`) | `rounded-[--radius-surface] border border-[--border] bg-[--card]`, padding `--space-6` | Shadow removed; the border does the grouping (NN/g) |
| **Event card** `components/events/EventCard.tsx` | no image; gradient date header; green "N Days Left" pill; 4 outline buttons; gradient CTA (`:142-260`) | 3:2 `next/image` top (`event.imageUrl`, blurred placeholder) → `text-meta` type label ("Aaradhane" / "Festival") → `text-h3` title → date · time → location → one `primary` button "View event". Share / Calendar / Notify / Directions collapse into one `icon` ghost overflow button | The V&A card order is image → content-type label → title → date → location → price → link; four equal buttons above the real action invert the hierarchy |
| **Seva card** | list rows inside `SevaBooking` with no card | 4px `--temple-saffron` inline-start rule → name (Kannada line, then English) → duration · category meta → price right-aligned `tabular-nums` → "Book" `primary sm` | Price is the comparison axis, so it aligns down the column |
| **Gallery tile** | `hover:scale-110` inside `overflow-hidden` | 1:1 `next/image`, `--radius-surface`, no hover transform; caption below on hover-capable pointers only | Zoom-on-hover does not exist on the primary device |
| **Quote card** | `/quotes` renders 5 hardcoded quotes in generic cards (M03-F05) | `bg-[--accent]`, no border, no shadow; Kannada/Sanskrit line at `--text-body-lg` in `--font-kn`; translation at `--text-body`; attribution at `--text-meta` in `--accent-foreground` | The one place `--accent` is used as a surface; 9.00:1 |

### 5.4 Remaining primitives

| Primitive | Today | Proposed | Rationale |
|---|---|---|---|
| **Badge / tag** | `components/ui/badge.tsx` (token-based, but missing `"use client"` — M01-F29) and `StatusBadge` (10 hardcoded statuses → 6 hue families) | Add `"use client"`. Collapse to four semantic variants — `neutral` (`--secondary`), `positive` (`--chart-5`), `attention` (`--temple-gold-light`), `critical` (`--destructive` at 10%) — mapped by a `statusTone(status)` function, not by string | A new status must not silently render stone |
| **Section header** | 15 inline copies: centred amber pill → `text-5xl` h2 → `text-lg` p (`components/home/UpcomingEvents.tsx:19-27` et al.); `components/common/SectionHeading.tsx:11` is centred and unused | One `<SectionHeader title kannadaTitle? description? action?>`: left-aligned, `--text-h2`, optional Kannada line above at `--text-meta` in `--font-kn`, description at `--text-body` capped `68ch`, optional right-aligned text link | Kills the eyebrow-badge tell and the 15 copies in one move |
| **Nav bar, desktop** | 80px, scroll-reactive blur + shadow, gradient active pill, 56px logo + 2-line wordmark (`components/layout/Navbar.tsx:154-199`) | 64px, `bg-[--card]`, `border-b border-[--border]`, no blur, no scroll state. Order: 36px mark + one-line wordmark · primary links · search icon · language · account · one `primary sm` "Donate". Active link = 2px `--primary` underline flush to the bar's bottom edge | V&A and Rijksmuseum both run brand → primary links → utility → one CTA; neither changes appearance on scroll |
| **Nav bar, mobile** | 634-line second copy of the menu (`:442-629`) | 56px bar: mark · wordmark · search · menu. Menu opens a full-height sheet from a **single `lib/navigation.ts` manifest** shared with desktop and footer; groups as accordions; `--shadow-overlay`; Escape closes; focus trapped | Fixes E2/E4 and makes the RN drawer free later |
| **Footer** | 269 lines, gradient ground, third copy of the menu, direct Firestore read (`components/layout/Footer.tsx:70`) | `bg-[--temple-maroon]` ground, `--primary-foreground` ink (11.33:1; `--card` ink is 11.98:1). Four columns desktop / one accordion mobile, from the same manifest. Address, timings, one Kannada line, social row, ©. The mobile accordion is a native `<details>` per group with a 48px `<summary>`, so it works without JavaScript | The only dark surface on the site; it ends the page instead of fading out. **Open decision 6** — specimen `#site-footer`, which draws both logo treatments on maroon |
| **Hero** | `bg-sacred-gradient`, 1 particle canvas + 2 `DeepaFlame` canvases, 25 particles, 15 looping dots, parallax, 6 `TempleButton`s, `text-6xl` (`components/home/Hero.tsx:116-130`) | Full-bleed 21:9 image, no gradient overlay wash. Overlaid copy, left-aligned, in this order: Kannada name → English name (`--text-display`) → one sentence → **status strip** (`--temple-maroon` ground: "Open today · 6:00–12:00, 17:00–20:30") → two buttons (`primary` "Book a seva", `outline` "Today's timings"). **Below 768px the image sits above the text at 4:3 and nothing overlays it** | Rijksmuseum's order is institution → action sentence → status; overlaid text at phone width is the single most common legibility failure |
| **Today panel** (new) | `components/home/Panchanga.tsx` + `DailySpiritualDashboard` + `TempleStatusCard`, three widgets, ~5 motion elements | One panel directly under the hero: date (Gregorian + tithi/nakshatra) as a 3-column `--text-h3` numeric row, `tabular-nums`, `--temple-cream` ground, `--radius-surface`, no border. The page's one orchestrated moment | This is the site's reason to exist; it earns the boldness budget (principle 1) |
| **Stat tile** | `components/admin/common/StatCard.tsx` (`rounded-xl border bg-card p-4 hover:shadow-sm hover:border-orange-200`, uppercase label) and a second inline `MiniStat` (`app/admin/page.tsx:45`) | One tile: `--text-meta` sentence-case label → `--text-h1` value `tabular-nums` → optional `--text-micro` delta. `border border-[--border]`, `--radius-surface`, `--space-6`. No icon, no hover | The number is the content; a gradient icon tile beside it competes with it |
| **Table (admin)** | `CrudTable` `px-4 py-3`, `bg-muted/50` uppercase header, no sort, no pagination, no numeric alignment (`components/admin/crud/CrudTable.tsx:35-41,72-75`); 9 other hand-rolled tables | Header 40px, `bg-[--secondary]`, `--text-meta` sentence case, sticky. Body rows 48px, `--text-ui`, 1px `--border` rule, no zebra. Numeric and currency right-aligned `tabular-nums`. Sort affordance on sortable headers. Actions in a trailing 96px column, 40px icon buttons. Pagination bar below at 56px. Selected row `--temple-gold-light` | Material's data table is 52dp rows / 56dp header and tunes density by ±4dp padding; 48/40 is that shape at web scale. No zebra because a 1px rule is enough once rows are 48px |
| **Table row card** (below 768px) | no such component: `components/ui/table.tsx:10-12` wraps every table in `relative w-full overflow-x-auto`, so the phone gets a sideways-scrolling table; the 9 hand-rolled admin tables do the same | One `<article>` per row on the `Card` shell, `--radius-surface`, `--space-4` padding: name (Kannada line above, English below) with the status pill opposite → a `<dl>` of label/value pairs, `--text-meta`, values right-aligned `tabular-nums` → a hairline → one primary action chosen by status, plus the same 40px overflow icon button as the table's action column | The row card is the mobile form of the same data, not a second data model; keeping the `<dl>` label beside every value is what makes a card readable without a header row. **Open decision 9** — specimen `#admin-table-rowcards` |
| **Modal / drawer** | `components/ui/dialog.tsx` short-circuits base-ui state at `:14` (`if (isControlled && !open) return null`), killing exit animation; no `components/ui/sheet.tsx` exists; `/admin/featured` hand-rolls a `fixed inset-0` overlay | Fix `:14`; one `Dialog`. Desktop: centred, `min(560px, calc(100% - 64px))`, `--radius-surface`, `--shadow-overlay`, scrim `color-mix(in oklab, var(--foreground) 45%, transparent)`. **Mobile: bottom sheet**, full width, top corners only, 36×4 grab handle, drag-to-dismiss, footer padded by `calc(var(--space-6) + env(safe-area-inset-bottom))`. Title `--text-h3` with the Kannada line above it, actions bottom-right desktop / stacked full-width mobile with the primary on top | One overlay component, and a sheet is the phone-native form of a dialog. Specimen `#modal-drawer` |
| **Toast** | **two** systems: live `react-hot-toast` (65 importers, `app/layout.tsx:91`) and a dead 322-line copy (`components/ui/toast.tsx` 286 + `components/ui/toaster.tsx` 36); `sonner` installed with zero imports | **Keep `react-hot-toast`.** Delete `components/ui/toast.tsx`, `components/ui/toaster.tsx`, `components/ui/use-toast.ts` and the `sonner` dependency. Restyle the existing `toastOptions` (`app/layout.tsx:95-101`): `--radius-surface`, `--shadow-raise`, `bg-[--card]`, `--text-ui`, 4px inline-start rule in the tone colour, position `bottom-center` on mobile / `top-right` on desktop, 4s, `role="status"` | One library, already wired into 65 files; the decision is which to delete, not which to add |
| **Empty state** | `components/admin/common/EmptyState.tsx` with 1 admin importer; `CrudTable` has its own one-line `emptyMessage` row | One component: 24px `--muted-foreground` icon → `--text-h3` statement of what is not here → `--text-body` one line on how to get something here → one `primary` button. Centred, `--space-12` block, no border | "An empty screen is an invitation to act" — it needs a verb, not an apology |
| **Skeleton** | `components/common/SkeletonLoader.tsx` uses `bg-stone-200`; `.skeleton-temple` in `app/globals.css:613-617` is a shimmering gradient nobody imports | `bg-[--muted]`, `--radius-control`, opacity pulse 1.6s (the one exception to "nothing loops", because it communicates pending state). Shapes mirror the real layout's boxes. Delete `.skeleton-temple` | The shimmer sweep is decoration; a pulse is a status |

---

## 6. Page by page

Wireframes are desktop (≥1024px) then mobile (390px). "Changes" lists the files to touch.

### 6.1 Home — `app/(public)/page.tsx`, `components/home/HomeClient.tsx`

```
DESKTOP                                                   MOBILE (390)
┌────────────────────────────────────────────────────┐    ┌──────────────────────┐
│ ◈ Sri Raghavendra Swamy Matha   Visit  Sevas  Events│    │ ◈ SRS Matha    ⌕  ☰ │ 56
│                          Calendar  About  ⌕ ಕ ◯ [Donate]│  ├──────────────────────┤
├────────────────────────────────────────────────────┤ 64 │ ░░░ image 4:3 ░░░░░░ │
│ ░░░░░░░░░░░░░░░ image 21:9 ░░░░░░░░░░░░░░░░░░░░░░░ │    ├──────────────────────┤
│ ░ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ                      ░ │    │ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ │
│ ░ Sri Raghavendra Swamy Matha        (display 44) ░ │    │ Sri Raghavendra      │
│ ░ Yelahanka New Town, Bengaluru                   ░ │    │ Swamy Matha    (32)  │
│ ░ ▓ Open today · 6:00–12:00 · 17:00–20:30 ▓       ░ │    │ Yelahanka New Town   │
│ ░ [Book a seva]  [Today's timings]                ░ │    │ ▓ Open today ▓       │
└────────────────────────────────────────────────────┘    │ [Book a seva]        │
┌─ TODAY ────────────────────────────────────────────┐    │ [Today's timings]    │
│ Saturday, 19 September    Tithi        Nakshatra   │    ├──────────────────────┤
│ 2026                      Chaturdashi  Hasta       │    │ TODAY                │
│ ─────────────────────────────────────────────────  │    │ Sat 19 Sept 2026     │
│ Today's seva  Daily Pooja · 9:30 AM      [Book →]  │    │ Tithi   Chaturdashi  │
└────────────────────────────────────────────────────┘    │ Naksh.  Hasta        │
┌────────────────────────────────────────────────────┐    │ ──────────────────── │
│ Upcoming events                      All events →  │    │ Daily Pooja 9:30 [→] │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                │    ├──────────────────────┤
│ │ img 3:2 │ │ img 3:2 │ │ img 3:2 │                │    │ Upcoming events      │
│ │ Festival│ │ Aaradh. │ │ Event   │                │    │ ┌──────────────────┐ │
│ │ Title   │ │ Title   │ │ Title   │                │    │ │ img 3:2          │ │
│ │ 24 Sep  │ │ 2 Oct   │ │ 9 Oct   │                │    │ │ Festival         │ │
│ │ Main hall│ │Main hall│ │ Hall    │                │    │ │ Title            │ │
│ │ [View]  │ │ [View]  │ │ [View]  │                │    │ │ 24 Sep · Main hall│ │
│ └─────────┘ └─────────┘ └─────────┘                │    │ │ [View event]     │ │
└────────────────────────────────────────────────────┘    │ └──────────────────┘ │
┌─ cream band ───────────────────────────────────────┐    │ (carousel, 1 up)     │
│ Sevas and offerings                   All sevas →  │    ├──────────────────────┤
│ ▌Seva name ......... 45 min · Archana    ₹501 [Book]│   │ Sevas and offerings  │
│ ▌Seva name ......... 30 min · Pooja      ₹301 [Book]│   │ ▌Name  45min   ₹501  │
│ ▌Seva name ......... 20 min · Abhisheka  ₹201 [Book]│   │              [Book]  │
└────────────────────────────────────────────────────┘    ├──────────────────────┤
┌────────────────────────────────────────────────────┐    │ Gallery (2-col)      │
│ Gallery                                  See all → │    ├──────────────────────┤
│ [□][□][□][□]  [□][□][□][□]   1:1 tiles             │    │ Visit us  (map)      │
└────────────────────────────────────────────────────┘    ├──────────────────────┤
┌────────────────────────────────────────────────────┐    │ maroon footer,       │
│ Visit us          │ map (16:9)                     │    │ 4 accordions         │
│ address, timings  │                                │    └──────────────────────┘
└────────────────────────────────────────────────────┘
┌─ maroon footer: 4 columns ─────────────────────────┐
└────────────────────────────────────────────────────┘
```

**Changes.** Section count drops from 13 to 7. Delete all eight `<SacredDivider>` calls
(`components/home/HomeClient.tsx:40,45,50,54,58,73,77,81`) and `components/home/SacredDivider.tsx`. Delete
`FloatingParticles`/`FloatingDots`/`DeepaFlame` from `components/home/Hero.tsx:118-130` and the scroll listener at
`:31-60`. Fold `components/home/Panchanga.tsx`, `components/home/DailySpiritualDashboard.tsx` and `AnnouncementBar`/
`AnnouncementMarquee` into one `TodayPanel` (the marquee's 30s loop goes; an announcement becomes a
static line inside the panel). Rewrite `components/home/QuickServices.tsx` as the seva list — the eight hue pairs at
`:23-72` go. `components/home/UpcomingEvents.tsx`, `components/home/GallerySection.tsx`, `components/home/TempleGalleryPreview.tsx`,
`components/home/Testimonials.tsx`, `components/home/TempleMap.tsx`, `components/home/TempleInfo.tsx`, `components/home/TempleTimings.tsx`,
`components/home/FeaturedSevasClient.tsx`, `components/home/DonationCTA.tsx`, `components/home/SocialConnect.tsx` each lose their inline section
header for `<SectionHeader>`. `Testimonials` and `SocialBar`/`SocialConnect` merge into the footer.

### 6.2 Events list — `app/(public)/events/page.tsx`

```
DESKTOP                                            MOBILE
┌─────────────── nav 64 ─────────────────┐         ┌─ nav 56 ─────────┐
│ Home / Events                          │         │ Home / Events    │
│ Events                         (h1 32) │         │ Events           │
│ One line on what an event here is.     │         │ One line.        │
│ ┌ Upcoming │ Past │ Aaradhane ┐ ⌕ ____ │         │ [Upcoming▾] ⌕ __ │
│ ┌────────┐ ┌────────┐ ┌────────┐       │         │ ┌──────────────┐ │
│ │ 3:2    │ │ 3:2    │ │ 3:2    │  3-up │         │ │ 3:2   1-up   │ │
│ │ label  │ │ label  │ │ label  │       │         │ │ label        │ │
│ │ Title  │ │ Title  │ │ Title  │       │         │ │ Title        │ │
│ │ date   │ │ date   │ │ date   │       │         │ │ date·place   │ │
│ │ place  │ │ place  │ │ place  │       │         │ │ [View event] │ │
│ │ [View] │ │ [View] │ │ [View] │       │         │ └──────────────┘ │
│ └────────┘ └────────┘ └────────┘       │         │ … infinite/Load  │
│           [Load more]                  │         └──────────────────┘
└────────────────────────────────────────┘
```

**Changes.** `app/(public)/events/page.tsx:12` drops its own `<main>` (F-I10) and its
`max-w-7xl`/`px-6 py-16` for `--container-page` / `py-16`. `SectionHeading` (centred) is replaced by
the left-aligned `SectionHeader`. `components/events/EventGrid.tsx` gains the filter tabs and
`components/events/EventCard.tsx` is rewritten per §5.3.

### 6.3 Event detail — `app/(public)/events/[id]/page.tsx`

```
DESKTOP                                            MOBILE
┌────────────────────────────────────────┐         ┌──────────────────┐
│ Home / Events / Ganesha Chaturthi      │         │ ‹ Events         │
│ ░░░░░ image 21:9 ░░░░░░░░░░░░░░░░░░░░ │         │ ░ image 4:3 ░░░░ │
│ Festival                       (meta) │         │ Festival         │
│ Ganesha Chaturthi              (h1)   │         │ Ganesha          │
│ ┌──── prose 720 ──────┐ ┌─ aside 340 ┐│         │ Chaturthi        │
│ │ Lead paragraph 18px │ │ 24 Sep 2026││         │ ┌ details card ─┐│
│ │                     │ │ 6:00–20:30 ││         │ │ 24 Sep · 6:00 ││
│ │ Body 16px / 68ch    │ │ Main hall  ││         │ │ Main hall     ││
│ │                     │ │ ────────── ││         │ │ [Add to cal]  ││
│ │                     │ │ [Add to    ││         │ └───────────────┘│
│ │                     │ │  calendar] ││         │ Body 16px        │
│ │                     │ │ [Directions]│        │ …                │
│ └─────────────────────┘ │ [Share]    ││         │ ┌ sticky bottom ┐│
│ Related events (3 cards)└────────────┘│         │ │ [Book a seva] ││
└────────────────────────────────────────┘         └──────────────────┘
```

**Changes.** The four utility buttons move out of the card (§5.3) and become this aside. On mobile a
44px sticky bottom bar carries the single primary action — the pattern the booking flow needs
anyway.

### 6.4 Sevas and booking — `app/(public)/sevas/page.tsx`, `components/home/SevaBooking.tsx`

```
DESKTOP                                            MOBILE
┌────────────────────────────────────────┐         ┌──────────────────┐
│ Home / Sevas                           │         │ Home / Sevas     │
│ Sevas and offerings            (h1)    │         │ Sevas            │
│ ┌ list 1fr ────────────┐┌ summary 340 ┐│         │ ▌Name            │
│ │▌ Name                ││ Your booking││         │  45 min · Archana│
│ │  45 min · Archana    ││ ─────────── ││         │  ₹501     [Book] │
│ │                 ₹501 ││ Seva  Name  ││         │ ▌…               │
│ │              [Book]  ││ Date  24 Sep││         ├──────────────────┤
│ │▌ Name           ₹301 ││ Name  …     ││         │ (Book opens a    │
│ │              [Book]  ││ Total  ₹501 ││         │  bottom sheet,   │
│ └──────────────────────┘│ [Continue]  ││         │  one field per   │
│                         └─────────────┘│         │  step, sticky    │
│ Step 1 of 3 ▓▓▓▓▓▓░░░░░░░░░░░          │         │  [Continue])     │
└────────────────────────────────────────┘         └──────────────────┘
```

**Changes.** `components/home/SevaBooking.tsx` (20+ `useState`) is split into three steps — choose, details, confirm
— one question group per step, labels above, `Continue` left-aligned. The summary panel is sticky on
desktop and becomes the sheet's header on mobile. Fields use `lib/formStyles.ts` exports. The UPI
fallback literal at `:114` must be removed as part of this work (M03-F04) — the pay button is
disabled when `upiDetails.id` is absent, and the disabled state gets an explanatory line rather than
silence.

### 6.5 Donation — `app/(public)/donation/page.tsx`, `components/home/DonationForm.tsx`

```
DESKTOP                                            MOBILE
┌────────────────────────────────────────┐         ┌──────────────────┐
│ Support the matha              (h1)    │         │ Support the matha│
│ Two lines on what a gift pays for.     │         │ Two lines.       │
│ ┌ form 560 ───────────┐┌ why 340 ─────┐│         │ Amount           │
│ │ Amount               ││ Where gifts ││         │ [₹101][₹501][₹1k]│
│ │ [₹101][₹501][₹1,001] ││ go: 3 lines ││         │ [₹2,501][Other]  │
│ │ [₹2,501][Other ____] ││ ─────────── ││         │ Your details     │
│ │ ──────────────────── ││ 80G note    ││         │ Name  [_________]│
│ │ Your details         ││             ││         │ Phone [_________]│
│ │ Name   [___________] ││             ││         │ Email [_________]│
│ │ Phone  [__________]  ││             ││         │ ──────────────── │
│ │ Email  [___________] ││             ││         │ Total  ₹501      │
│ │ ──────────────────── ││             ││         │ ┌ sticky ───────┐│
│ │ Total          ₹501  ││             ││         │ │ [Give ₹501]   ││
│ │ [Give ₹501]          ││             ││         │ └───────────────┘│
│ └──────────────────────┘└─────────────┘│         └──────────────────┘
└────────────────────────────────────────┘
```

**Changes.** Five preset amounts in a 3+2 grid of 48px chips plus "Other"; the total restates above
the button; the button names the amount ("Give ₹501", not "Submit"). One-time only today, so no
toggle is drawn — when recurring giving arrives it is a two-option segmented control above Amount.
`components/home/DonationForm.tsx:83-93`'s four truthiness checks become per-field validation with messages
(M03-F10).

### 6.6 Calendar — `app/calendar/page.tsx`

```
DESKTOP                                            MOBILE
┌────────────────────────────────────────┐         ┌──────────────────┐
│ Calendar                        (h1)   │         │ Calendar         │
│ ‹ September 2026 ›        [Month|List] │         │ ‹ Sept 2026 ›    │
│ Mo Tu We Th Fr Sa Su                   │         │ Mo Tu We Th Fr Sa│
│  1  2  3  4  5  6  7                   │         │ (6-col grid,     │
│  8  9 10 11 12 13 14                   │         │  44px cells)     │
│ 15 16 17 18 ⬤19 20 21   ⬤ = today      │         │ ──────────────── │
│ 22 23 24● 25 26 27 28   ● = event      │         │ Selected day     │
│ ────────────────────────────────────── │         │ 19 Sept          │
│ 19 September · Chaturdashi · Hasta      │         │ Chaturdashi      │
│ · 9:30 Daily Pooja                     │         │ · 9:30 Pooja     │
│ · 18:00 Ekadashi discourse             │         └──────────────────┘
└────────────────────────────────────────┘
```

**Changes.** The month grid gets 44px cells (WCAG 2.5.8 min is 24×24; 44 is the comfortable figure
for a date grid). Today is the **only** gold marker on the page — principle 2. The three
`app/calendar/*` routes move into `app/(public)/` so they inherit chrome and `#main-content`
(M01-F05, M01-F47).

### 6.7 Profile — `app/(public)/profile/page.tsx`

```
DESKTOP                                            MOBILE
┌────────────────────────────────────────┐         ┌──────────────────┐
│ ┌ nav 220 ─┐┌ content ─────────────────┐│        │ Your account     │
│ │ Account  ││ Your account       (h1)  ││        │ [Profile ▾]      │
│ │ ▸Profile ││ ┌ card ──────────────────┐││       │ ┌ card ─────────┐│
│ │  Bookings││ │ ◯ avatar 64            │││       │ │ ◯ Name        ││
│ │  Receipts││ │ Name                   │││       │ │ phone · email ││
│ │  Saved   ││ │ phone · email          │││       │ │ [Edit]        ││
│ │  Prefs   ││ │ [Edit details]         │││       │ └───────────────┘│
│ │ ──────── ││ └────────────────────────┘││       │ Recent bookings  │
│ │  Sign out││ Recent bookings           ││       │ …                │
│ └──────────┘└──────────────────────────┘│        └──────────────────┘
└────────────────────────────────────────┘
```

**Changes.** The four member routes (`/profile`, `/profile/settings`, `/profile/preferences`,
`/favorites`) become one page with a left rail; the seven hardcoded notification rows at
`app/(public)/profile/page.tsx:256` become real preference rows or are removed. The four pages currently disagree
on their auth predicate (M03-F11) — one guard in a server layout, one client fallback.

### 6.8 Admin dashboard — `app/admin/page.tsx`

```
DESKTOP ≥1024                                                MOBILE
┌────────┬───────────────────────────────────────────┐       ┌──────────────┐
│ ◈ SRS  │ Dashboard                    ⌕ ___ 🔔 ◯  │ 56    │ ☰ Dashboard  │
│ Admin  ├───────────────────────────────────────────┤       ├──────────────┤
│        │ Dashboard                          (h1)   │       │ Users   1,204│
│▸Dash   │ Saturday, 19 September 2026               │       │ Donors    318│
│ Events │ ┌──────┬──────┬──────┬──────┬──────┬─────┐│       │ Events     12│
│ Sevas  │ │Users │Donors│Events│Books │Chats │Vols ││       │ … (2-col)    │
│ Bookings│ │1,204 │  318 │   12 │  87  │ 2.1k │  44 ││      ├──────────────┤
│ Donations││     │      │      │      │      │     ││       │ Needs action │
│ Gallery │ └──────┴──────┴──────┴──────┴──────┴─────┘│      │ …            │
│ Quotes │ ┌ Needs action ───────┐┌ This month ──────┐│      └──────────────┘
│ ──────  │ │ 4 bookings unpaid   ││ Donations ₹—     ││
│ Settings│ │ 2 events past       ││ Bookings  87     ││
│ Users   │ │ 1 quote unpublished ││ Page views 12.4k ││
│        │ └─────────────────────┘└──────────────────┘│
│        │ ┌ Recent bookings (table, 5 rows) ────────┐│
│ 256px  │ └─────────────────────────────────────────┘│
└────────┴───────────────────────────────────────────┘
```

**Changes.** `components/admin/layout/AdminSidebar.tsx:162` loses its gradient and shadow for `bg-[--sidebar]` +
`border-r border-[--sidebar-border]`, narrows from today's `lg:w-68` (17rem / 272px) to 256px
(`w-64`) as drawn above, and its raw `<a href>` links become `next/link` (they cause a
full reload today). `components/admin/common/AdminPageHeader.tsx:18-19` loses the `Sparkles` gradient tile for all 58
callers. The inline `MiniStat`/`SectionCard` at `app/admin/page.tsx:45,59` are deleted in favour of
`StatCard`/`SectionCard`. "Refresh" (`window.location.reload()`) becomes a refetch with a spinner in
the button. A **Needs action** panel replaces the six-tile analytics grid as the first thing a
volunteer sees — the console's job is the queue, not the vanity metric.

### 6.9 Admin CRUD — `app/admin/donations/page.tsx`

```
DESKTOP                                                       MOBILE
┌────────┬──────────────────────────────────────────────┐     ┌──────────────┐
│sidebar │ Donations                        [Export CSV]│     │ ☰ Donations  │
│        │ ┌ 3 stat tiles ─────────────────────────────┐│     │ ⌕ ________   │
│        │ │ Total ₹—   │ This month ₹—  │ Count 318   ││     │ [Status ▾]   │
│        │ └───────────────────────────────────────────┘│     │ ┌ row card ─┐│
│        │ ⌕ ________________  [Status ▾]  [Date ▾]     │     │ │ Name      ││
│        │ ┌─────────────────────────────────────────┐  │     │ │ 19 Sep    ││
│        │ │ Donor     ↕ Date    ↕   Amount ↕ Status │40│     │ │ ₹501 Paid ││
│        │ ├─────────────────────────────────────────┤  │     │ │        ⋯  ││
│        │ │ Name        19 Sep       ₹501  ●Paid ⋯ │48│     │ └───────────┘│
│        │ │ Name        18 Sep     ₹1,001  ●Paid ⋯ │48│     │ (cards, not  │
│        │ │ Name        18 Sep       ₹201  ○Pend ⋯ │48│     │  a scrolling │
│        │ ├─────────────────────────────────────────┤  │     │  table)      │
│        │ │ 1–25 of 318            ‹ 1 2 3 … 13 ›   │56│    └──────────────┘
│        │ └─────────────────────────────────────────┘  │
└────────┴──────────────────────────────────────────────┘
```

**Changes.** Amount right-aligned `tabular-nums` so a column can be read down. Sort arrows on Date
and Amount. Pagination replaces "render everything". The three inline `rounded-xl border bg-white
p-5` tiles at `:134,142,150` become `StatCard`. The `rounded-xl border border-stone-300` select at
`:176` becomes the shared `Select`. `TableActions`' immediate delete gets a confirm dialog (the
shared `Dialog`, not `window.confirm`). Below 768px the table becomes a list of row cards — a
horizontally scrolling table is not a mobile table.

---

## 7. Accessibility and language

### 7.1 Contrast on the new surfaces

Computed from the `oklch` values in `app/globals.css`, sRGB relative luminance, WCAG 2.x.

| Foreground | Background | Ratio | Passes |
|---|---|---:|---|
| `--foreground` | `--background` | **15.41:1** | AAA |
| `--foreground` | `--card` | **16.07:1** | AAA |
| `--foreground` | `--temple-cream` (alt band) | **14.32:1** | AAA |
| `--foreground` | `--primary` (primary button) | **7.10:1** | AAA |
| `--foreground` | `--accent` (quote card) | **12.42:1** | AAA |
| `--foreground` | `--secondary` (table header) | **13.90:1** | AAA |
| `--muted-foreground` | `--card` (secondary text) | **6.04:1** | AA, AAA large |
| `--muted-foreground` | `--background` | **5.79:1** | AA |
| `--muted-foreground` | `--muted` (on skeleton/disabled) | **5.22:1** | AA |
| `--secondary-foreground` | `--secondary` | **11.86:1** | AAA |
| `--accent-foreground` | `--accent` | **9.00:1** | AAA |
| `--temple-deep-red` | `--card` (links) | **8.18:1** | AAA |
| `--temple-deep-red` | `--accent` (link inside a quote card) | **6.32:1** | AA |
| `--primary-foreground` | `--temple-maroon` (footer) | **11.33:1** | AAA |
| `--card` | `--temple-maroon` (footer, alternative ink) | **11.98:1** | AAA |
| `--primary-foreground` | `--destructive` (destructive button) | **5.08:1** | AA |
| `--card` | `--destructive` (destructive button, alternative ink) | **5.38:1** | AA |
| `oklch(0.5 0.2 45)` focus outline | `--background` | **6.22:1** | AA (needs 3:1) |
| `oklch(0.5 0.2 45)` focus outline | `--card` | **6.49:1** | AA |
| `--muted-foreground` control border | `--card` | **6.04:1** | 1.4.11 (needs 3:1) |
| `--temple-gold-dark` icon-only | `--card` | **3.28:1** | 1.4.11 only — never for text |
| `--chart-5` / `--chart-4` label | `--card` | 5.05 / 4.14:1 | AA |
| `--chart-3` / `--chart-2` / `--chart-1` | `--card` | 3.40 / 2.80 / 2.26:1 | **fills only, label outside** |
| `--border` | `--card` | **1.44:1** | decorative rules only |

Three rules follow and must be enforced in review: **(a)** no white text on gold, saffron or amber,
ever; **(b)** `--primary`, `--temple-gold` and `--temple-saffron` are fills and markers, never text
or icon colours on a light ground; **(c)** the visible focus indicator is
`oklch(0.5 0.2 45)` from `app/globals.css:299`, never `--ring`.

### 7.2 Focus, targets, structure

- **Focus:** one rule — `:focus-visible { outline: 2px solid oklch(0.5 0.2 45); outline-offset: 2px }`,
  which `app/globals.css:298-301` already has. Delete the three competitors: the element-list repeat
  of the same outline at `:323-330`, the `box-shadow: 0 0 0 3px oklch(0.7 0.15 45 / 0.3)` at
  `:334-338`, and `.focus-ring-temple` at `:607-610`. An `<input>` today matches `:298`, `:329` and
  `:337` at once; four focus styles on one element read as a bug.
- **Targets:** 44×44 minimum on the public site, 40×40 in admin tables with 8px separation. WCAG 2.2
  SC 2.5.8 requires 24×24 CSS px; Material's guidance is 48dp. The current `icon-sm` button
  (`components/ui/button.tsx:46`) is 32px and the `TableActions` icons inherit it — both move up.
- **Landmarks:** one `<main id="main-content">` per page, in the route-group layout only. Remove the
  duplicate `<main>` from the 24 `(public)` pages and from `app/admin/layout.tsx:26`. `(auth)`
  already has a layout (`app/(auth)/layout.tsx:9`) whose `<main>` needs only `id="main-content"`;
  `calendar`, `knowledge` and `debug` have no layout at all and need one, so the global skip link
  resolves on all 7 of those pages (M01-F47).
- **Live region:** one. Delete the second (`components/common/A11yProvider.tsx:54`), and make `announce()` push a
  string, not `JSON.stringify(...)`.
- **Menus:** the nav dropdowns take `aria-haspopup`, `aria-expanded`, `role="menu"`, Escape and
  arrow keys — `components/common/LanguageSwitcher.tsx:73-87` already does this correctly and is the
  pattern to copy.
- **Motion:** the global `prefers-reduced-motion` block at `app/globals.css:351-363` stays and is
  the reason the redesign can afford its one orchestrated moment.

### 7.3 Kannada and English

- **One heading face per script, same metrics.** Noto Serif Kannada replaces Noto Sans Kannada in
  `app/layout.tsx:24-29` so a bilingual heading pair shares stroke contrast with Source Serif 4.
  Playfair Display is removed: it has no Kannada coverage, so today every Kannada heading silently
  renders in a fallback (B5).
- **One stack, not four.** `app/globals.css:12-15, 18-22, 42-49, 60-62` collapse to a single
  `:lang(kn), [lang="kn"] { font-family: var(--font-kn); line-height: 1.75 }`. Drop the `!important`
  at `:61`.
- **Pairing rule.** Where both scripts appear, Kannada goes **first** and English second, in the
  same block, with `--space-1` between and no separator character. Mark the Kannada element
  `lang="kn"` — today nothing does, so screen readers and the font stack both guess.
- **No transliteration in UI chrome.** Button and nav labels are English (`--font-ui`); Kannada
  appears in content: names, seva titles, shlokas, quotes, the temple name.
- **Fallback chain:** `"Noto Serif Kannada", "Noto Sans Kannada", "Tunga", sans-serif` — Tunga ships
  with Windows, so a devotee on an office machine with a slow connection still sees Kannada rather
  than boxes.
- **Numerals stay Western Arabic** (`tabular-nums`) throughout, including in the Today panel, because
  prices, times and counts are compared, not read aloud.

---

## 8. Implementation plan

Five phases. Each is independently shippable and leaves the site working. Verify at the end of each;
`npm run build && npm run lint && npm run typecheck` (the script is `typecheck`, not `type-check` —
`package.json:11`) plus the visual checks listed.

The order is not negotiable, and the reason is worth stating. Phase 1 changes only the token layer,
which today almost nothing consumes — so it is nearly a no-op visually, and that is the point: it
makes the tokens true before anything depends on them. Phase 2 rewrites the primitives, which is
where the site's appearance actually changes, and it deliberately ends with a deletion pass so the
dead alternatives cannot be re-adopted by the page work that follows. Phase 3 fixes the shell, which
must happen before the pages because moving `Navbar`/`Footer` into the layout touches the same 29
files the page work touches and doing both at once produces unreviewable diffs. Phases 4 and 5 are
then mostly mechanical substitution and can be parallelised across people, or paused indefinitely
without leaving the site half-designed — every page not yet reached still renders correctly on the
new primitives, just in its old layout. If the work has to stop somewhere, stop at the end of a
phase.

### Phase 1 — Tokens (1 file, ~2 days)

| # | File | Change |
|---|---|---|
| 1 | `app/globals.css` | Move all four `@import`s to lines 1–4 (F-B4). Delete `.bg-sacred-gradient`, `.bg-temple-hero`, `.bg-temple-card`, the four glow utilities, `.text-gradient-gold`, `.btn-glow-hover`, `.border-sacred*`, `.border-ornament`, `.sacred-pattern`, `.sacred-divider`, `.underline-animate`, `.temple-card*`, `.skeleton-temple`, `.section-fade-in`, `.text-display/.text-heading/.text-subheading`, and the five infinite keyframes |
| 2 | `app/globals.css` | Add `--font-serif/-ui/-kn`, the 9 type steps, 9 spacing steps, 3 radius tokens, 2 shadow tokens, container tokens, 4 motion tokens. Re-base `--radius` to `0.5rem`; replace the `@theme inline` radius ladder |
| 3 | `app/globals.css:87-89` | Fix `--font-sans`/`--font-mono`/`--font-heading` to point at the real next/font variables |
| 4 | `app/globals.css:12-62` | Collapse the four Kannada rules into one |
| 5 | `app/globals.css:334-338`, `:607-610` | Delete the duplicate focus styles |
| 6 | `app/layout.tsx:81` | Remove `bg-stone-50 text-stone-900` |
| 7 | `app/layout.tsx:18-29` | Swap `Playfair_Display` → `Source_Serif_4`, `Noto_Sans_Kannada` → `Noto_Serif_Kannada` |
| 8 | `lib/formStyles.ts` | Replace the single string with `controlClass`, `labelClass`, `hintClass`, `errorClass` |
| 9 | `lib/animations.ts` | Cut to 4 durations, 1 easing pair, 4 variants |

**Verify:** the site still builds and every page still renders; nothing should look *right* yet —
Phase 1 only stops the token layer lying. Diff `app/globals.css` line count (717 → ~380 expected).

### Phase 2 — Primitives (~12 files, ~4 days)

Order matters; each depends on the one above.

1. `components/ui/button.tsx` — §5.1. Merge `danger` into `destructive`; add `link`; resize.
2. `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/label.tsx` — §5.2; move the wrapper out of `Input`.
3. `components/ui/form/FormGroup.tsx` + the five fields — import `lib/formStyles.ts`; make
   `FormTextField` use `FormGroup` instead of duplicating it; switch `FormSelectField` to
   `components/ui/select.tsx` and `FormSwitchField` to `components/ui/switch.tsx`.
4. `components/ui/card.tsx` — border, no shadow, `--radius-surface`.
5. `components/ui/badge.tsx` — add `"use client"` (M01-F29); four tones.
6. `components/admin/crud/StatusBadge.tsx` — map through `statusTone()`.
7. `components/common/SectionHeading.tsx` → rewrite as `SectionHeader` (left-aligned, Kannada line,
   action slot).
8. `components/ui/dialog.tsx` — remove the `:14` short-circuit; add the mobile bottom-sheet variant.
9. `app/layout.tsx:91-105` — restyle `react-hot-toast`; **delete** `components/ui/toast.tsx`,
   `components/ui/toaster.tsx`, `components/ui/use-toast.ts` and the `sonner` dependency.
10. `components/common/SkeletonLoader.tsx` — token colours, pulse not shimmer.
11. `components/admin/common/EmptyState.tsx` — §5.4; wire it into `CrudTable`'s empty row.
12. Delete `components/ui/TempleButton.tsx`, `components/ui/TempleCard.tsx`, `components/ui/MicroInteractions.tsx`,
    `components/ui/AnimateIn.tsx`, `lib/animations.ts`, `components/ui/animations.ts` (a second, 14-line dead animations module with 5 exports and 0 importers), `components/ui/spinner.tsx`, `components/ui/FloatingParticles.tsx`, `components/ui/DeepaFlame.tsx`
    (2,358 lines of dead code per M01-F43 — do this *before* the page work so nothing re-adopts it).

**Verify:** grep for `bg-orange-600`, `from-amber-`, `shadow-lg`, `rounded-3xl`, `rounded-[`,
`hover:scale-`, `hover:-translate-y-` — counts should be falling, not rising. Open the specimen page
beside the app and compare each primitive.

### Phase 3 — Layout shell (~6 files, ~3 days)

1. Create `lib/navigation.ts` — one manifest (E2).
2. `components/layout/Navbar.tsx` — 634 → ~180 lines: 64/56px, no scroll state, underline active
   marker, sheet on mobile, dropdowns with real ARIA (copy `components/common/LanguageSwitcher.tsx:73-87`).
3. `components/layout/Footer.tsx` — maroon ground, manifest-driven, read through
   `settings.service` not `getDoc` (M01-F07).
4. `app/(public)/layout.tsx` — render `<Navbar>`/`<Footer>` here; remove the imports from all 29
   page files (M01-F05).
5. Move `app/calendar/*` and `app/knowledge/*` into `app/(public)/`.
6. `app/admin/layout.tsx`, `components/admin/layout/AdminShell.tsx` — one `<main id="main-content">`;
   `components/admin/layout/AdminSidebar.tsx:162` flat surface; `next/link` instead of raw `<a>`.

**Verify:** tab through the header on desktop and mobile with the mouse unplugged — every item
reachable, Escape closes, focus returns to the trigger. Confirm one `<main>` per page
(`document.querySelectorAll('main').length === 1`). Confirm the header no longer repaints on scroll.

### Phase 4 — Public pages (~25 files, ~6 days)

In traffic order: home (§6.1) → events list + detail (§6.2, §6.3) → sevas + booking (§6.4) →
donation (§6.5) → calendar (§6.6) → profile (§6.7) → the remaining information pages, which are
mostly a container-width and section-header swap.

Per page: replace the container class with `--container-page`/`--container-prose`; replace band
padding with the three-value rhythm; replace the inline section header with `<SectionHeader>`;
delete `whileInView`; delete `<SacredDivider>`.

**Verify:** at 390px, 768px and 1280px — no horizontal scroll, one page width, three band heights,
no element moves on scroll. With `prefers-reduced-motion: reduce` forced on, nothing animates.

### Phase 5 — Admin (~20 files, ~5 days)

1. `components/admin/common/AdminPageHeader.tsx` — drop the gradient tile (58 callers, one edit).
2. `components/admin/crud/CrudTable.tsx` — §5.4 table spec, sort, pagination, numeric alignment,
   mobile row cards.
3. Migrate the nine hand-rolled tables onto `CrudTable`; `app/admin/sevas/columns.ts` and
   `app/admin/gallery/columns.ts` already define the columns (M05-F37).
4. `app/admin/page.tsx` — Needs-action panel; delete inline `MiniStat`/`SectionCard`; real refetch.
5. `components/admin/crud/TableActions.tsx` + **38** `confirm()` call sites across 30 files — 10 of
   them in the 9 `app/admin/settings` pages, the rest spread over `app/admin/{ai/*,announcements,
   billing,bookings,donations,knowledge,quotes,sevas,shlokas,testimonials}` and 5 admin components.
   Budget for the whole set, not for ten. Shared confirm dialog.
6. Delete `AdminButton`, `ActionButton`, `AdminCard`, `SectionCard` (the dead one), `PageHeader`,
   `SearchBar`, `dashboard/*`, `DashboardCard` (M05 Recipe G).

**Verify:** every admin list renders 25 rows with pagination; currency columns align; a delete asks
first; the console works at 390px. Run `npx @axe-core/cli http://localhost:3000/admin` once
`node_modules` exists — target zero serious/critical violations on the dashboard, one CRUD page and
one settings page.

### Cross-phase verification checklist

| Check | Command / method | Target |
|---|---|---|
| No literal palette classes left | `grep -ro "\b\(amber\|orange\|stone\)-[0-9]\+" app components --include=*.tsx \| wc -l` | 5,471 → 0 (5,515 on 2026-10-18) |
| No arbitrary hex in classes | `grep -ro "\(bg\|text\|border\|from\|to\)-\[#" app components --include=*.tsx \| wc -l` | 31 → 0 |
| Radius steps | `grep -ro "rounded-[a-z0-9\[]*" app components --include=*.tsx \| sort -u` | 3 values |
| Gradients | `grep -ro "bg-gradient-to" app components --include=*.tsx \| wc -l` | 287 → 0 (289 on 2026-10-18) |
| Scroll motion | `grep -ro "whileInView" app components --include=*.tsx \| wc -l` | 33 → 0 |
| Container widths | `grep -ro "max-w-[0-9]xl" app components --include=*.tsx \| sort -u` | 0 (tokens only) |
| Contrast | axe + the table in §7.1 | no AA failure on text |
| Keyboard | tab the header, a form, a table, a dialog | no trap, no invisible focus |

---

## 9. Open decisions

These need Nikhil's taste or the trust's approval before Phase 1 ships.

1. **Replacing Playfair Display.** Source Serif 4 is the recommendation, but the display face is the
   most visible single change and the trust may have chosen Playfair deliberately. If it stays, B5
   still has to be solved: Playfair needs an explicit Kannada sibling in the stack and must not be
   applied to `h1…h6` globally.
2. **Swapping Noto Sans Kannada for Noto Serif Kannada.** A serif Kannada reads as more traditional;
   some devotees find the sans more legible on low-DPI phones. Worth showing both to two or three
   regular visitors before deciding.
3. **Dark ink on the gold button.** It is the accessible answer within the fixed palette, but gold
   with dark text is a strong look. The alternative is a maroon primary button with `--card` ink (11.98:1; `--primary-foreground` ink is 11.33:1), which
   makes the site read as maroon-led rather than gold-led. Pick one; do not ship both.
4. **Retiring saffron from surfaces.** Saffron currently appears on nearly every CTA. Confining it to
   the festival marker is a real loss of "temple-ness" for some viewers.
5. **Deleting the `QuickServices` eight-colour tiles.** They are the most colourful thing on the home
   page and may be the thing the trust likes most.
6. **The maroon footer.** The first genuinely dark surface on the site. Approve the wordmark and logo
   treatment on maroon before building it. **Drawn:** `docs/rearchitecture/ui-redesign-specimens.html`
   §`#site-footer` — four columns at desktop, the single-column `<details>` accordion in a 375px
   frame, and the two logo treatments side by side: **A** a reversed mark (light disc, maroon glyph)
   and **B** a knockout mark (1.5px light ring on the maroon itself). Footer ink measures
   **11.33:1** (`--primary-foreground` on `--temple-maroon`, AAA); `--card` ink is the brighter
   alternative at 11.98:1. Both marks are placeholders — the real logo is a raster file the specimen
   does not load.
7. **Wiring dark mode.** The palette exists and costs one `useEffect`. Does the trust want it, or
   should the 31-property block be deleted?
8. **Admin dashboard first screen.** "Needs action" replaces the analytics grid. That is a product
   decision about who the console is for — the volunteer on duty or the trustee reading numbers.
9. **Mobile tables as row cards.** Correct for readability, but a volunteer reconciling receipts on a
   phone may want the real columns and horizontal scroll. Confirm with whoever does that job.
   **Drawn:** `docs/rearchitecture/ui-redesign-specimens.html` §`#admin-table-rowcards` shows the
   same five donations both ways. **Option A** is the row-card list in the 375px frame — one card per
   donation, `<dl>` label/value pairs, status pill, one primary action that changes with the status.
   **Option B** is keeping the real columns and scrolling the table sideways, which is what
   `components/ui/table.tsx:10-12` already does. The rest of the specimen, and the §5.4 **Table row
   card** row, assume A.
10. **Scope of the Kannada-first rule.** Kannada before English everywhere in content is a statement.
    Confirm it is the trust's preference and not merely the developer's.

---

## 10. References

Every convention borrowed, with what was taken from it.

| Source | Borrowed |
|---|---|
| [GOV.UK Design System — Type scale](https://design-system.service.gov.uk/styles/type-scale/) | One body size used everywhere (19px there, 16px here); line heights on a fixed rhythm (multiples of 5 there, 4 here); a small fixed number of scale points rather than a continuous ladder — §4.1 |
| [GOV.UK Design System — Question pages](https://design-system.service.gov.uk/patterns/question-pages/) | One question group per step; the label above the control and doubling as the page heading; hint text as one short sentence without a full stop; input width proportional to expected content; the continue button left-aligned "so users do not miss it" — §5.2, §6.4, §6.5 |
| [Victoria and Albert Museum](https://www.vam.ac.uk/) | Header order (brand → primary links → utility icons → membership CTA); card anatomy ordered image → content-type label → title → date → location → price → link — §5.4 nav, §5.3 event card |
| [Rijksmuseum](https://www.rijksmuseum.nl/en) | Full-bleed hero image with overlaid copy in the order institution name → one-line action sentence → descriptive line → an "OPEN TODAY" status indicator; a single accent colour (gold) carried through branding and interactive elements — §5.4 hero, principle 2 |
| [Templeton Religion Trust](https://www.templetonreligiontrust.org/) | A non-profit card grid that leads with attribution and title rather than an image, and a 2×2 "areas of focus" grid as the site's only decorative moment — §6.1 section count |
| [Nielsen Norman Group — Cards](https://www.nngroup.com/articles/cards-component/) | A card needs a border and a ground distinct from the canvas to group its content; a slight shadow is a clickability signifier (the inference that a non-interactive panel should therefore not have one is this plan's, not the article's); do not use cards where people compare options or scan search results — §4.4, §5.3, §6.9 mobile |
| [GitHub Primer — Size primitives](https://primer.style/foundations/primitives/size) | A 4px-increment spacing ladder (2px first step) coarsening to 16px steps above 48px; a four-value radius scale (3 / 6 / 12 / full) narrowed here to two plus a pill; named control heights (24 / 28 / 32 / 40 / 48) as the basis for the 36 / 44 / 48 button sizes — §4.2, §4.3, §5.1 |
| [Material Design — Data tables](https://m2.material.io/components/data-tables/web) | Baseline 52dp row with a 56dp header (adapted to 48/40 at web scale); density changed by ±4dp of padding rather than by a different component — §5.4 table |
| [Material Design 3 — Grids and spacing / density](https://m3.material.io/foundations/layout/grids-spacing/density) | Density as three named modes rather than a free variable; a 48dp minimum touch target maintained even at compact density — §5.4, §7.2 |
| [W3C — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | The 24×24 CSS px floor and its spacing exception, which sets the *minimum* the admin tables must clear; the public site's 44px is a comfort figure above it — §7.2, §6.6 |

---

*Diagnosis rows: 53. Primitives specified: 19. Pages wireframed: 9. References cited: 10. New colour
values introduced: 0. Every `path:line` in the Diagnosis was verified against the working tree on
2026-09-19; the only file referenced that does not exist is `lib/navigation.ts`, which Phase 3
creates. Eight rows were corrected in review on 2026-09-19 — see §11. Re-checked 2026-10-18: every cited file
still exists, three rows' anchors moved (B1, D3, G2), none is resolved, and the specimen's 28 colour literals
are all still in `app/globals.css`, which has not changed — see §1, *Status as of 2026-10-18*, and §12.*

---

## 11. Reviewer notes (2026-09-19)

An adversarial review of this plan and its specimen ran on 2026-09-19 against the working tree. All
53 Diagnosis rows were re-opened at their cited `path:line`, 26 contrast claims were recomputed from
the `oklch()` values, the specimen was scripted for external resources and colour values, and four of
the ten references were re-fetched. **Forty-five rows held exactly. Eight were wrong and are now
corrected above.** Nothing in the direction, the principles or the palette discipline changed — the
errors were all counts and two mis-paired ratios, and every one of them made the plan slightly more
dramatic than the code warrants, which is the direction a diagnosis is most likely to drift.

### Corrected in place

| Row | Claimed | Actually | Where |
|---|---|---|---|
| A3 | 31 hex literals across **9** distinct colours | 31 across **7** — `#fff8ef`, `#fffdf8`, `#fff9ef`, `#fff6ea`, `#fffaf4`, `#fffaf3`, `#7A1024` | repo grep for `rounded`-style arbitrary values on `app components --include=*.tsx` |
| C1 | `rounded-[32px]` ×9, `[30px]` ×3, `[36px]` ×1 (13) | **23** arbitrary radii in 6 shapes: `[32px]` ×16, `[30px]` ×3, `[24px]` ×1, `[36px]` ×1, `[4px]` ×1, `rounded-[min(var(--radius-4xl),24px)]` ×1 | same grep on `rounded-[` |
| C3 | "Four glow utilities … plus a text glow" (5) | **four in all** — three box-shadow glows + one text glow | `app/globals.css:383,387,391,396` |
| C5 | 33 `hover:scale-1*`, six `hover:scale-110` | **42** — `scale-105` ×27, `scale-110` ×**13**, `scale-150` ×1, `scale-100` ×1 | repo grep |
| D4 | **Seven** `SacredDivider`s | **Eight**; the row's own eight line numbers already said so | `components/home/HomeClient.tsx:40,45,50,54,58,73,77,81` |
| E3 | 29 page files; **4 routes outside `(public)` with no layout at all** | 28 files under `app/` + `components/home/HomeClient.tsx`; **7 page files in 3 trees** (`calendar` ×3, `knowledge` ×3, `debug`). `(auth)` **has** a layout — its `<main>` simply lacks `id="main-content"` | `app/(auth)/layout.tsx:9`; `find app -name layout.tsx` |
| G2 | **two** `<canvas>` rAF loops (25 particles + 15 dots) | **one** canvas rAF loop; `FloatingDots` draws no canvas — it is 15 framer-motion `<div>`s on `repeat: Infinity`. Separately, four `DeepaFlame` are written and two render | `components/ui/FloatingParticles.tsx:182,200,272-295`; `components/home/Hero.tsx:304,324,332,335` |
| G3 | **Five** infinite keyframes | **Six** — `skeleton-loading` (1.5s) is also `infinite` | `app/globals.css:616,619` |

Two contrast figures were attached to the wrong token. Both ratios are real; both belong to `--card`
(pure white), not to `--primary-foreground` (`#fcf9ea`):

| Pair | Was | Is |
|---|---|---|
| `--primary-foreground` on `--temple-maroon` (footer; §3, §5.4, §7.1, §9.3) | 11.98:1 | **11.33:1** — still AAA. `--card` on maroon is the 11.98:1 |
| `--primary-foreground` on `--destructive` (§3, §5.1, §7.1) | 5.38:1 | **5.08:1** — still AA. `--card` on destructive is the 5.38:1 |

The other 24 recomputed pairs matched to two decimal places, including the two that carry the whole
argument: white on `bg-orange-600` is **3.56:1** and `--primary-foreground` on `--primary` is
**2.14:1**. The headline accessibility fact stands.

Four further corrections were folded into the body: the Primer ladder runs in **4px** increments to
48px (2px first step) and 16px steps above, not 2px throughout (§4.2, §10); `confirm()` has **38**
call sites in 30 files, of which 10 are in the nine `app/admin/settings` pages the plan counted (H5,
Phase 5 — budget for 38, not 10); the `formStyles` control classes are re-declared in **8** files,
not 4, three of them admin pages outside `components/ui/form` and one `components/ui/MicroInteractions.tsx` (F3, §5.2); and an `<input>` today
matches **three** competing focus rules — `:298`, `:329`, `:337` — plus `.focus-ring-temple`, where
§7.2 named only two. Phase 2's deletion list gained `components/ui/animations.ts`, a second dead
animations module (14 lines, 5 exports, 0 importers) that sat beside `lib/animations.ts` unnoticed.

### Checked and confirmed, so they can be relied on

Every count in B2 (ten type steps, `text-sm` ×1290 against `text-base` ×18), C2, D1, D2, A1 (5,471),
A4 (287), B6 (82), G1 (33), C4 (59) and A7 (31 dark properties) reproduced exactly. Every
`app/globals.css` line reference is exact — `:298-301`, `:334-338`, `:351-363`, `:383-398`,
`:607-610`, `:613-617`, `:690-705`. So are `components/ui/button.tsx:34-46`, `components/ui/card.tsx:13`,
`components/ui/input.tsx:14,16,24-26,33`, `components/home/QuickServices.tsx:23-72`, `components/admin/layout/AdminSidebar.tsx:162`,
`components/admin/common/AdminPageHeader.tsx:18-19` (58 callers), `components/admin/crud/StatusBadge.tsx:13-52` (10 statuses, 6 hue families,
stone fallback), `components/admin/crud/CrudTable.tsx` (4 pages plus `components/admin/events/EventTable.tsx`), `components/common/A11yProvider.tsx:39,54-63`, and all
nine `text-5xl` section headings in B1. F6 is exact: `docs/UI-GUIDELINES.md:154-155, 172-173,
224-237, 251-265, 58` all document things the code does not have.

### The specimen

Scripted: **0** external resources of any kind — no `<link>`, no `<script src>`, no `<img>`, no
`@import`, no `url()`, no `fetch`. **28** colour literals, **0** of which are absent from
`app/globals.css`. 65 KB. Tags balance with zero mismatches. Kannada renders in 25 runs with nine
`lang="kn"` attributes. `.phone` is `width:390px; max-width:100%` and `--gutter` is 16px below
768px, so nothing overflows at 375px.

Two primitives the plan specified but the specimen omitted were added during this review, using only
CSS the page already carried: the **gallery tile** (1:1 tiles, hover moves the border rather than
zooming the image) and a **current-vs-proposed pane for the section header** — the plan's
most-repeated defect, fifteen inline copies, previously had no before/after, and the page was
already carrying fourteen lines of `.old-secthead` CSS that nothing used.

### Completed in the specimen on 2026-09-19 — the three that were missing

The three primitives this review recorded as undrawn have since been added, each needing new CSS
rather than markup alone. All three are now on the page with a caption citing their plan section:

1. **Modal / drawer** (§5.4) — `#modal-drawer`. The centred desktop dialog at
   `min(560px, 100%)` with `--shadow-overlay` and the 45% `--foreground` scrim, and beside it the
   **mobile bottom sheet** in a 375px frame: grab handle, top corners only, actions stacked full
   width with the primary on top, footer padded by `calc(var(--space-6) + env(safe-area-inset-bottom))`.
   The content is the seva booking confirmation from §6.4, Kannada title above English.
2. **Mobile row-card table** (§6.9) — `#admin-table-rowcards`. The desktop table and the row-card
   list side by side, the same five donations in both, captioned as option A against option B.
3. **The maroon site footer** (§5.4) — `#site-footer`. Four columns at desktop, the `<details>`
   accordion at 375px, and the two candidate logo treatments on maroon for open decision 6.

Re-verified after the addition: **0** external resources, **0** colour values absent from
`app/globals.css` (28 distinct literals, unchanged), tags balance with zero mismatches, 97 KB,
nothing fixed wider than the 375px frame's own `max-width: 100%`.

### What remains a taste decision, not a defect

The ten open decisions in §9 are unchanged by this review and none is resolvable from the code. Two
are worth re-stating because the review touched them:

- **Decision 3 (gold button ink).** The measurement is now firm in both directions: `--foreground`
  on `--primary` is 7.10:1, and a maroon button carries `--card` at 11.98:1 or `--primary-foreground`
  at 11.33:1. All three are accessible. Which one the site *is* is a question of identity, not of
  compliance.
- **Decision 6 (maroon footer).** The specimen's own page header is maroon and can stand as proof of
  the surface; the footer layout still needs drawing before sign-off.

One judgement in the plan is the plan's own and is now marked as such: NN/g says a shadow is a
clickability signifier, but does not say a non-interactive panel must therefore have none. The
inference is sound and worth keeping — it is simply not a citation.

### Recorded, not fixed (outside this plan's remit)

- `docs/UI-GUIDELINES.md` documents six components and APIs that do not exist (F6). It should be
  regenerated from the code after Phase 2 rather than patched.
- `AGENTS.md` states Next.js 14; `package.json` runs Next 16.2.9.
- `components/ui/animations.ts` and `lib/animations.ts` are two separate dead animation modules.
- `lib/formStyles.ts` is named as *the* design-token module by `AGENTS.md` and
  `docs/CODING-STANDARDS.md` and has zero importers; until Phase 1 runs, both documents are wrong.

*Review file: `.claude/state/verify/V4-redesign-critic.md`.*

Specimen completed (2026-09-19): added modal/drawer, row-card table, footer.

---

## 12. Reviewer notes (2026-10-18)

A refresh pass four weeks after the plan was written, against code commit `424fdb8`. The brief was to check
that the Diagnosis still describes the code, mark anything the code has since resolved, note any redesign work
already in the code, and re-check the specimen's colours against the token file. The 2026-09-19 notes above
stand unchanged; nothing in §2–§10 was edited except two baselines in §8's checklist.

### What changed in this document

- **Header** — a *Re-checked 2026-10-18* note beside the status.
- **New subsection at the end of §1, *Status as of 2026-10-18*** — the evidence check, the count comparison,
  the search for redesign work, the new UI built since, and the token-file and specimen check.
- **Rows B1, D3 and G2** — a dated *MOVED* note in each Evidence cell. The original citations are kept, so the
  2026-09-19 reading can still be reproduced against the snapshot.
- **§8 cross-phase checklist** — the A1 and A4 baselines now show their 2026-10-18 values beside the originals;
  the targets are unchanged.
- **Closing summary line** under §10 — one sentence on the re-check.

### What was checked, and how

- **All 53 Diagnosis rows** were re-opened by script: each cited `path:line` was compared with the same line
  in the read-only snapshot. 210 lines matched, 6 had moved down one line, 4 had changed; every file exists.
  The three affected rows are B1, D3 and G2. **No row is RESOLVED** — none of the dated patterns has been
  removed, and only one of the fifteen centred section headers (D3) has changed, as a side effect of a
  feature commit.
- **Every count in the §1 status table was recomputed** on both trees with the same patterns. The snapshot
  side reproduced the plan's numbers exactly; the 2026-10-18 side is flat or higher on all but one —
  `max-w-3xl`, 30 → 29, which is the de-centred Upcoming Events header.
- **Phase 1–2 markers** — tokens, fonts, the formStyles module, the navigation manifest, the deleted
  primitives, the new primitives — were looked for one by one. None is present.
- **`app/globals.css`** has the same git blob as on 2026-09-19 (this checkout's copy differs only in CRLF line
  endings). **The specimen** is byte-identical to the snapshot copy once line endings are ignored, and its 28
  distinct colour literals are all in `app/globals.css`: specimen colours still all in the token file — **yes**.

### Judgement calls

- **D3 is MOVED, not RESOLVED.** One of fifteen copies is now left-aligned, but the row's defect — fifteen
  inline re-declarations instead of the shared primitive — is untouched, and the copy that moved still shouts.
- **The mobile app's hex palette is recorded, not added to the palette.** They are a second, conflicting
  brand definition rather than a change to this plan's palette; §3's "the colour values do not change" still
  describes the web, and the fix belongs to the shared token package the migration report plans.

### Skeptic re-check (2026-10-18)

An adversarial pass over the refresh above on Sunday 2026-10-18, against code commit `424fdb8`; nothing was
built or run. The full report is `.claude/state/verify/B-skeptic-2026-10-18.md`.

- **No row is RESOLVED.** Confirmed by comparing every pattern file by file between the snapshot and
  `424fdb8`. The only file where any count fell is `components/home/UpcomingEvents.tsx`: `max-w-3xl` 1 → 0
  and `text-center` 2 → 0. That is D3's one de-centred copy, correctly marked MOVED. All other changes are
  increases, and they come from the festival components, the AI admin pages, Temple Explorer and `/live`.
- **Evidence lines.** An independent per-line comparison counted in a different unit, expanding every range,
  so its totals differ from the 210 / 6 / 4 above. It found differences in the same three rows only: B1, D3
  and G2. Every cited file exists.
- **Counts and markers.** Every number in the 2026-10-18 count table was reproduced exactly on both trees.
  The festival components account for the whole of the A4, C4 and B6 increases, as stated. Other checks:
  - `app/globals.css` has the same blob as the snapshot (`1973fe3`; last touched 2026-07-20).
  - `app/layout.tsx` matches the snapshot.
  - `lib/navigation.ts` is absent.
  - `lib/formStyles.ts` and `lib/animations.ts` each have 0 importers.
  - `TempleButton.tsx` is present.
  - `Navbar.tsx` is 633 lines, and there are 8 `SacredDivider`s.
- **The specimen.** It matches the snapshot copy byte for byte once line endings are ignored. It has 28
  distinct colour literals (all `oklch()`), and 0 are missing from `app/globals.css`.
- **Corrected in place.**
  - "No dated pattern has been removed anywhere" was literally false, because of D3's removal. It now says no
    row's pattern was removed, and names the one removal.
  - "There is no `SectionHeader`" overlooked the file-local helper at
    `components/recommendation/RecommendationsSection.tsx:142`, which predates the snapshot. It now says no
    *shared* `SectionHeader` primitive exists.
  - The mobile palette is eight `temple.*` hex values, not two. Three of them recur in screen styles, and
    the app has 22 distinct hex literals in all. The status text and the judgement call now say so.
