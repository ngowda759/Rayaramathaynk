# Brief - VERIFY: refute and correct one brain file

Read `.claude/state/briefs/RULES.md` first. Then this. Your dispatch names your chunk id and the
builder's structured result.

## Goal

The brain file for your chunk is correct enough to act on: every path exists, the flows and trees
match the code, the findings are real, and nothing important in the chunk is missing. You are the
skeptic, not a second author. Your job is to break the builder's claims against the code, then fix
what broke.

## Inputs

```
.claude/state/chunks.json                                  the chunk entry (roots, focus questions)
.claude/state/inventory/<id>.json                          the file list the builder was given
.claude/skills/temple-portal-expert/brain/<id>-<slug>.md   the brain file under test
.claude/state/briefs/BUILD.brief.md                        the format and standards it was held to
```

## Method

1. **Paths.** Script it: extract every `path` or `path:line` cited in the brain file, check existence,
   and where a line number is given check that the line (±3) plausibly contains what is claimed
   (grep the named symbol). Record broken ones.
2. **Claims.** Pick at least 20 factual claims spread across Entry points, Component trees, Data flow,
   Types and stores, and How to change it. For each, open the code and try to prove it wrong: a
   component marked server that has 'use client'; a flow that names a service the page never
   imports; a collection name that does not appear in the service; a recipe that misses a file.
   Prefer the claims that matter most - the ones a developer would act on. Record each as
   CONFIRMED / REFUTED / UNCERTAIN with evidence.
3. **Findings.** For every row of the Faults table: open the evidence. Is the fault real, at that
   line, at that severity? Mark CONFIRMED / REFUTED / DOWNGRADE / UPGRADE with a reason.
4. **Coverage.** Diff the inventory file list against the files the brain mentions. For every
   unmentioned file over 40 lines, open it and decide whether it needs a row or a tree entry.
   Look for things the builder could have missed entirely: a second export path, a hidden route,
   a server action, an API route the module calls that is not named.
5. **Focus questions.** Check each focus question in chunks.json has an actual answer in the file,
   not a restatement.
6. **Correct in place.** Re-read the brain file from disk, then fix every REFUTED claim, broken path,
   wrong severity and coverage gap directly in the brain file - minimal edits, keep the builder's
   structure. Add new findings you found (ids continue the sequence). Append a final section:
   `## Verification log (2026-09-19)` listing every change as one line: `what was wrong -> what it says now -> evidence`.
7. Write your report to `.claude/state/verify/<id>.md`: the path check results, the claims table, the
   findings table, coverage additions, and the log.

## Rules of engagement

- You edit only the brain file for your chunk and your own report. Nothing else.
- A claim you cannot check in the code is UNCERTAIN, not CONFIRMED.
- Do not soften findings to be polite and do not add findings without `path:line` evidence.
- Do not rewrite sections that are correct. The builder's voice stays.

## Done means

- `.claude/state/verify/<id>.md` exists with the four tables and counts.
- The brain file has a Verification log section and zero broken paths (re-run your path script).

## Output contract - structured return

```
chunk, pathsChecked, pathsBroken, pathsFixed,
claimsSampled, claimsConfirmed, claimsRefuted, claimsUncertain,
findingsReviewed, findingsConfirmed, findingsRefuted, findingsAdded,
filesUnmentionedBefore, filesAddedToBrain,
focusQuestionsUnanswered: [strings],
file (your report path), notes (<=8 lines)
```
