# Brief - G4: add the three missing primitives to the UI specimen page

Read `.claude/state/briefs/RULES.md` first. Then this. You edit two files; re-read each from disk
before editing and record every change.

## Goal

The redesign critic (V4) found the specimen page shows 19 of the plan's primitives and is missing
three that open decisions depend on. Add them so Nikhil can decide with the picture in front of him.

## Inputs

```
docs/rearchitecture/UI-REDESIGN-PLAN.md                 sections 5.4 (footer), 6.4 and 6.5 (booking and donation flows through a modal / bottom sheet), 6.9 (admin table below 768px), the primitive spec table, open decisions 6 and 9
docs/rearchitecture/ui-redesign-specimens.html          the page to extend - reuse its existing tokens, classes and caption pattern
.claude/state/verify/V4-redesign-critic.md              the critic's exact description of what is missing
app/globals.css                                         the only source of colour values allowed
components/ui/dialog.tsx, components/ui/sheet.tsx, components/ui/table.tsx (if they exist)   the current primitives, for a "current" reference where the plan specifies one
```

## Method

1. Read the plan sections named above and the critic's three bullets. Read the specimen's CSS to
   learn its token names, spacing scale and caption markup.
2. Add three specimen sections, each with a one-line caption citing the plan section:
   - **Modal / drawer** - the centred desktop dialog (max width, radius, elevation, header/body/
     footer, primary and secondary actions per the plan's button spec) and the mobile bottom sheet
     (grab handle, safe-area padding, the same content) side by side. Use the seva booking
     confirmation as the content, with Kannada and English titles as the plan prescribes.
   - **Admin table, mobile row-cards** - the desktop table the specimen already has (or a copy of
     it) at full width, and beside it the same rows rendered as the plan's row-card pattern at a
     375px-wide frame: label/value pairs, status pill, primary action. Caption says this is open
     decision 9's option A and the horizontal-scroll table is option B.
   - **Site footer** - the maroon footer from 5.4: four columns at desktop (about, visit, seva and
     donate, connect), the single-column accordion at mobile, logo and wordmark treatment placeholder
     as the plan describes, contrast-checked text on maroon (state the ratio in the caption).
3. Constraints, checked by script before you return: no external resources of any kind; every colour
   literal appears in `app/globals.css` (rgba/hsl variants of the same token allowed); tags balanced;
   file under 300 KB; readable at 375px (no fixed widths above the viewport); Kannada sample text
   present in the new sections.
4. In the plan, update open decisions 6 and 9 to point at the new specimen sections by id, and add
   the three primitives to the primitive spec table if they lack rows (with current file -> proposed
   classes/tokens -> rationale). Append a line to the plan's Reviewer notes:
   `Specimen completed (2026-09-19): added modal/drawer, row-card table, footer.`

## Done means

- The specimen shows the three primitives with captions; script checks pass.
- The plan's open decisions 6 and 9 reference the specimen sections.

## Output contract - structured return

```
primitivesAdded: [names], specimenBytes, externalResources, newColourValues, tagsBalanced (true|false),
planEdits: [one line each], footerContrastRatio, notes (<=6 lines)
```
