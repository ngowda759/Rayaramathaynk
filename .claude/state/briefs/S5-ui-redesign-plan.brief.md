# Brief - S5: UI redesign plan for the public site and admin console

Read `.claude/state/briefs/RULES.md` first. Then this. You are the one agent in this run allowed to
use WebSearch and WebFetch, read-only, to study public reference websites.

## Goal

A redesign plan Nikhil will implement himself. The colour palette stays. Everything else about how
the UI elements look and are placed - typography, spacing, shape, elevation, layout grid,
navigation, hero, cards, forms, tables, motion - is re-specified to read as a current, well-made
website rather than one from ten years ago. The plan must be concrete enough that a developer can
open a component and know exactly what classes and tokens to change, and it comes with a
self-contained specimen page showing the proposed primitives.

## Inputs

```
.claude/skills/temple-portal-expert/brain/M01-*.md    design tokens as defined today (globals.css, lib/formStyles.ts, lib/animations.ts), the components/ui kit, layout components
.claude/skills/temple-portal-expert/brain/M02-*.md    home and information pages - the visual inventory section
.claude/skills/temple-portal-expert/brain/M03-*.md    devotional pages, forms
.claude/skills/temple-portal-expert/brain/M05-*.md    admin shell, tables, forms, toasts
app/globals.css, lib/formStyles.ts, lib/animations.ts   read directly - these are the tokens you keep or replace
components/ui, components/layout, components/home       read the actual class names in use (sample 12-20 files, the ones the brain calls out)
docs/UI-GUIDELINES.md                                   the documented intent, to note where it is outdated
C:\Users\HP ELITEBOOK\.claude\plugins\cache\claude-plugins-official\frontend-design\1dd995193ba2\skills\frontend-design\SKILL.md   read fully - guidance on intentional, non-templated visual direction
```

## Method

1. Read the frontend-design skill, then M01's token inventory and the four brain files' visual
   sections, then the actual CSS and 12-20 components. Write down, with `path:line`, what makes the
   current UI read as dated or "funky": e.g. heavy gradients, drop shadows on everything, mixed
   border radii, inconsistent spacing steps, decorative icons, multiple competing type scales,
   centred-everything layouts, animation on scroll for every section, dense admin tables with no
   hierarchy, inconsistent buttons, emoji or clip-art usage, mixed toast libraries. Only claims with
   evidence go in.
2. Research 5-8 reference websites read-only and note concrete placement conventions, not vibes:
   navigation height and behaviour, hero proportions and copy hierarchy, card anatomy (image ratio,
   padding, title/meta order), section rhythm (vertical spacing scale), type scale (sizes and
   weights actually used), how they use one accent colour, how little motion they use, how forms
   and admin tables are laid out. Choose references relevant to a temple / cultural / non-profit
   institution and to well-made admin consoles - for example major museum and heritage sites,
   established spiritual organisations' sites, a charity donation flow, and one or two admin
   dashboards known for clarity. Cite the URL for every convention you borrow.
3. Write `docs/rearchitecture/UI-REDESIGN-PLAN.md` (3500-6500 words plus tables):
   - **Diagnosis** - the evidenced list from step 1, grouped, each with a one-line "why it reads as dated";
   - **Design principles** - 5-8 principles for this site (calm, content-first, one accent, generous
     whitespace, legible Kannada and English side by side, motion only for meaning, mobile-first);
   - **Keep** - the palette: list every colour token from globals.css with its current role, and the
     roles you assign in the new system (the values do not change; their usage may);
   - **Change** - the new token system: type scale (font families to keep or replace - note Kannada
     script needs; sizes; weights; line heights), spacing scale, radius scale (one or two values),
     elevation (shadows: when and how little), border and divider rules, container widths and grid,
     breakpoints, motion rules (durations, what may animate, reduced-motion behaviour);
   - **Primitive specs** - a table per primitive: button (variants), input/select/textarea, card
     (event card, seva card, gallery tile, quote card), badge/tag, section header, nav bar (desktop
     and mobile), footer, hero, stat tile, table (admin), modal/drawer, toast (pick one library),
     empty state, skeleton. Each row: current file(s) and classes -> proposed classes/tokens ->
     rationale in one line;
   - **Page-by-page** - for the home page, events list and detail, sevas and booking, donation,
     calendar, profile, admin dashboard and one admin CRUD page: an ASCII wireframe of the new
     layout at desktop and at mobile, the section order, and what changes from today (by file);
   - **Accessibility and language** - contrast checks for the kept palette on the new surfaces
     (state the ratios), focus styles, touch targets, Kannada font rendering and fallback;
   - **Implementation plan** - phases Nikhil can execute: tokens first, then primitives, then
     layout shell, then pages, then admin; each phase lists the files to touch in order and how to
     verify (visual check list, axe run when node_modules exists);
   - **Open decisions** - anything that needs Nikhil's taste or the trust's approval;
   - **References** - the URLs and what was borrowed from each.
4. Write `docs/rearchitecture/ui-redesign-specimens.html` - a self-contained specimen page (no
   external fonts, scripts or images; system fonts or a named stack that degrades gracefully) using
   the site's own palette tokens, showing the proposed primitives side by side with a one-line
   caption each: type scale, spacing scale, buttons, inputs, event card, seva card, quote card,
   section header, nav bar (desktop and mobile widths), hero, stat tiles, an admin table, a toast,
   an empty state. Add a short "current vs proposed" pair for the button and the card, recreating the
   current one from its real classes so the difference is visible. This page shows the temple site's
   proposed look; it is deliberately not in the CoreFlex theme, and its header should say so in one
   line. Under 300 KB.
5. Verify: every `path:line` in the diagnosis exists; the specimen has zero external resources;
   every colour value in the specimen appears in globals.css (script both checks).

## Done means

- Both files exist. The plan has every section above; the specimen has every primitive listed.
- Every diagnosis row has evidence; every borrowed convention has a URL.
- No new colour values were introduced (the script says so).

## Output contract - structured return

```
outputs: [paths], words, diagnosisRows, primitivesSpecified, pagesWireframed, referencesCited,
newColourValuesIntroduced (must be 0), specimenBytes, specimenExternalResources (must be 0),
openDecisions: [strings], notes (<=8 lines)
```
