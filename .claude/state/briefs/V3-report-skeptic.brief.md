# Brief - V3: refute the rearchitecture and React Native report

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

Nikhil will make decisions from `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`. Before
he does, someone tries to break it: wrong faults, unsupported recommendations, bad arithmetic,
portability claims that the code contradicts. You are that someone. Fix what breaks, in place.

## Inputs

```
docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md   the report under test
.claude/skills/temple-portal-expert/brain/*.md              the Faults and Portability sections the report drew from
.claude/state/verify/M*.md                                  which findings the skeptics confirmed or refuted
.claude/state/inventory/SUMMARY.md, import-graph.json       for coupling and size claims
package.json                                                dependency claims
```

## Method

1. **Fault register.** Sample 25 rows weighted toward HIGH. For each: open the evidence path:line.
   Is it real, at that severity, and is the source finding id one the skeptic CONFIRMED? Look for
   duplicates the dedupe missed and for HIGH items in the brain files the register dropped.
2. **Recommendation.** Steelman each losing option for two paragraphs in your report. Does the
   criteria table apply the same criteria to every option? Are the reuse percentages traceable to
   the portability matrix? Would a reasonable engineer pick differently, and if so, on what fact?
   State what fact would flip the recommendation and whether the report already says so.
3. **Portability matrix.** For 8 modules, compare the matrix row with the brain's Portability table.
   Any module marked reuse-as-is that imports next/* or touches the DOM is a refutation. Check the
   API-gap list against M12's route table.
4. **Arithmetic.** Recompute every working-day calculation in the roadmap table from Monday
   2026-09-21 (Mon-Fri, no holidays). Recompute the effort totals from the phase ranges. Check
   the executive summary's counts against the register (rows, severity split).
5. **Fix in place.** Re-read the file, correct refuted rows, wrong dates and totals, and matrix
   errors; add dropped HIGH items; append a section `## Reviewer notes (2026-09-19)` with your
   steelman summary, what you changed, and what remains a judgement call.
6. Write `.claude/state/verify/V3-report-skeptic.md` with the sampled-rows table, the option
   critique, the matrix check, the arithmetic check and the edit log.

## Done means

- Report exists; every arithmetic error corrected; every refuted row corrected or removed; the
  Reviewer notes section exists in the report under test.

## Output contract - structured return

```
rowsSampled, rowsHeld, rowsRefuted, rowsAdded, duplicatesFound, recommendationStands (true|false),
flipCondition (<=40 words), matrixRowsChecked, matrixRowsWrong, arithmeticErrors, editsMade,
file (report path), notes (<=8 lines)
```
