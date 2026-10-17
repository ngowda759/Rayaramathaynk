# Brief - G3: apply the option criteria evenly and price Option C after Phase 2

Read `.claude/state/briefs/RULES.md` first. Then this. You edit one file; re-read it from disk
before editing, keep the reviewer's existing notes, and record every change.

## Goal

The skeptic (V3) confirmed the rearchitecture report's recommendation stands but flagged one
unresolved defect: section 4.1 judges Option C (native shell around the existing site) before
Phase 2 while judging Option B (Next web + Expo mobile sharing packages) after Phase 2, and "C after
Phase 2" is never priced. Nikhil will decide from this table, so every option must be judged at the
same gate with the same assumptions, and the recommendation re-tested against the result.

## Inputs

```
docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md     the report - sections 4 (options), 7 (effort, assumptions, roadmap), 10 (reviewer notes, 10.3 is the flagged item), executive summary
.claude/state/verify/V3-report-skeptic.md                    the skeptic's reasoning, steelman paragraphs and the flip condition
.claude/skills/temple-portal-expert/brain/M13-*.md           device capabilities - what a native shell would and would not get for free
.claude/skills/temple-portal-expert/brain/M12-api-layer.md   API gaps that a shell (C) sidesteps and a native client (B/D) must fill
.claude/skills/temple-portal-expert/brain/M04-*.md           auth - cookies/redirects in a shell vs tokens in a native client
```

## Method

1. Read section 4 and section 7 fully, then V3's option critique and 10.3.
2. Fix the gate. State one evaluation gate for all four options - the end of Phase 2 (auth, API
   contract, services boundary and store migration fixed) as the report already uses for B - and
   say in one sentence why that gate (the Phase-2 work is required regardless of option). Re-score
   every criterion for every option at that gate. Where a score changes, say from what and why.
3. Price Option C properly, twice: (i) C as a stop-gap before Phase 2 (what it costs, what it does
   not fix, and the rework when B/D follows), (ii) C after Phase 2 (shell + push + deep links +
   store submission + offline caching), using section 7's assumptions (team size, skill, weeks per
   person) and the same working-day calendar from Monday 2026-09-21 (Mon-Fri, no holidays). Show the
   arithmetic in the same table format section 7.4 uses.
4. Re-test the recommendation. With the even table, does B still win? If yes, say what margin and
   what would flip it (keep V3's flip condition, sharpen the date of the UI-redesign gate that V3
   said was wrong). If no, change the recommendation everywhere it appears - executive summary,
   section 4 conclusion, section 9 decisions - and say so plainly.
5. Update 10.3 to record the fix, and append to the Reviewer notes section a dated entry
   `Criteria alignment (2026-09-19)` with what changed. Do not remove the skeptic's notes.
6. Re-check the arithmetic of every date you touched and the effort totals.

## Done means

- Section 4.1 states one gate and scores all four options at it.
- Option C has effort ranges and calendar dates for both timings, arithmetic shown.
- The recommendation text is consistent across the summary, section 4, section 9 and 10.3.

## Output contract - structured return

```
gateUsed, scoresChanged: [option - criterion - from - to], optionC: { preWeeksLow, preWeeksHigh, postWeeksLow, postWeeksHigh, postEndDate },
recommendationStands (true|false), recommendedOption, flipCondition (<=40 words), sectionsEdited: [names], notes (<=8 lines)
```
