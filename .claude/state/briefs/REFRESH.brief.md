# Brief - REFRESH: bring one brain file up to date with four weeks of code changes

Read `.claude/state/briefs/RULES.md` first (its repository root line is stale: the root is now
`D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected`, a git clone on branch
`feature/temple-portal-knowledge-base`; do not run git commands that change state - `git log`,
`git diff`, `git show` are fine and useful). Today is **2026-10-18** (Sunday). Then this. Your
dispatch names your chunk id.

## Goal

The brain file for your chunk was written on 2026-09-19 from a snapshot of this code. Since then
475 commits landed. After you finish, every claim in the brain file is true of the code as it is
today, every change that matters is described, and every fault row says whether it still exists.

## Inputs

```
.claude/skills/temple-portal-expert/brain/<id>-<slug>.md     the brain file to update (read it fully)
.claude/state/delta/2026-10-18/delta.json                    perModule.<id> = {added, deleted, modified} file lists for your chunk; `unowned` = new files nobody owns
.claude/state/inventory/<id>.json                            today's file list for your chunk (regenerated 2026-10-18)
.claude/state/chunks.json                                    your roots and focus questions
D:\Onboarding\Repos\POCs\General Purpose POCs\               the 2026-09-19 snapshot, read-only - diff any file against it: the same relative path exists there
git log --since=2026-09-19 --format='%ad %h %s' --date=short -- <your roots>    why things changed (skip "chore: update daily panchanga")
```

## Method

1. Read your brain file and your delta lists. For each modified file, diff snapshot vs today
   (`diff` or `git log -p` on the file) and read the change. Read every added file. Note deleted ones.
2. Update the brain file in place, minimal edits in its existing voice:
   - Entry points, Component trees, Data flow, Key files, Types and stores, Cross-module
     dependencies, How to change it: correct every claim the diff invalidates; add rows and tree
     entries for added files; strike deleted files (say "removed 2026-10 - see Refresh log").
   - Faults table: for every row, check the evidence line still exists and the fault still holds.
     Mark the row `FIXED (2026-10-18)` with the fixing commit hash, `STILL OPEN`, or `MOVED` with the
     new path:line. Add new faults the changes introduced, ids continuing the sequence.
   - Portability notes: if `apps/mobile` now consumes anything from your module, say what and how.
   - Answers questions about: add topics for new capabilities.
   - Coverage line: new filesExpected / filesMentioned from today's inventory.
3. Append `## Refresh log (2026-10-18)`: one line per change you made (`what was true -> what is
   true now -> evidence`), then the commit hashes that drove the biggest changes, then anything
   UNCLEAR.
4. Path check by script: every cited path exists today (paths deliberately described as absent are
   fine; say so). Fix the rest.
5. Chunk M16 only: re-run `node .claude/state/inventory/fields.mjs` from the repo root, then
   `node .claude/state/inventory/fields.mjs --expand <brain file>` ONLY IF the M16 Verification log
   does not warn against it; otherwise regenerate the affected collections by hand from the new
   fields.json. Add the Prisma schema (`prisma/schema.prisma`) as a third store kind if the app
   reads through it (grep `@prisma/client` and `prisma.` in app/ lib/ services/).

## Done means

- The brain file has a Refresh log; every fault row carries a 2026-10-18 status; zero broken paths.
- Every added file in your delta appears in the brain; every deleted one is struck.

## Output contract - structured return

```
chunk, filesAdded, filesDeleted, filesModified, claimsCorrected, faultsFixed, faultsStillOpen, faultsNew,
mobileConsumesThisModule (true|false), significantChanges: [<=6 one-line strings], file, notes (<=6 lines)
```
