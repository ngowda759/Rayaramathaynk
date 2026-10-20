# Brief - V4: critique the UI redesign plan and specimen

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

The redesign plan is evidenced, implementable by a developer without further design work, keeps the
palette, respects accessibility and Kannada script, and the specimen page actually shows what the
plan says. Break what is weak; fix what is fixable in place; report the rest.

## Inputs

```
docs/rearchitecture/UI-REDESIGN-PLAN.md
docs/rearchitecture/ui-redesign-specimens.html
app/globals.css, lib/formStyles.ts                     the palette that must be preserved
components/ui, components/layout, components/home      the files the plan claims to change
.claude/skills/temple-portal-expert/brain/M01-*.md     the token inventory
docs/UI-GUIDELINES.md                                   documented intent
C:\Users\HP ELITEBOOK\.claude\plugins\cache\claude-plugins-official\frontend-design\1dd995193ba2\skills\frontend-design\SKILL.md
```

## Method

1. **Diagnosis.** Open the evidence for 15 diagnosis rows. Is the dated pattern really there at
   that path:line? Is the "why it reads as dated" reasoning defensible or taste dressed as fact?
2. **Implementability.** Pick 8 primitive specs and 3 page wireframes. For each, could a developer
   open the named file and apply the change with only what the plan says? Missing class names,
   tokens without values, "modernise" without a spec - those are defects.
3. **Palette.** Script it: every colour value in the specimen HTML and every colour value named in
   the plan appears in globals.css or formStyles.ts (allow rgba/hsl variants of the same token).
4. **Accessibility and language.** Check the stated contrast ratios for 6 colour pairs (compute
   them). Check the plan addresses focus styles, touch targets >= 44px, reduced motion, and Kannada
   font rendering with a fallback stack. Check the specimen renders Kannada sample text.
5. **Specimen.** Zero external resources (script it); every primitive the plan specifies appears;
   the "current vs proposed" pairs use the real current classes; header says it is not the CoreFlex
   theme; under 300 KB; readable at 375px by inspection of the CSS.
6. **References.** Every borrowed convention cites a URL; spot-check 3 with WebFetch (read-only) to
   see the convention is really there.
7. **Fix in place.** Re-read each file, then correct wrong evidence, fill missing class/token specs
   where the answer is determinable from the code, fix contrast claims, add missing primitives to
   the specimen if small. Append `## Reviewer notes (2026-09-19)` to the plan with what you changed
   and what remains a taste decision for Nikhil.
8. Write `.claude/state/verify/V4-redesign-critic.md` with all checks and the edit log.

## Done means

- Report exists; palette check passes; specimen self-contained; every refuted diagnosis row fixed
  or removed; Reviewer notes appended.

## Output contract - structured return

```
diagnosisChecked, diagnosisHeld, diagnosisRefuted, specsChecked, specsImplementable, specsFixed,
newColourValues (must be 0), contrastPairsChecked, contrastFailures, specimenExternalResources,
specimenMissingPrimitives: [strings], referencesSpotChecked, referencesHeld, editsMade,
file (report path), notes (<=8 lines)
```
