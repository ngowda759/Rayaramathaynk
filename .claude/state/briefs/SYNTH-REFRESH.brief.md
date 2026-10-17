# Brief - SYNTH-REFRESH: propagate the refreshed brain files to the router, the docs and the reports

Read `.claude/state/briefs/RULES.md` first (root is now `D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected`,
a git clone on branch `feature/temple-portal-knowledge-base`; read-only git commands are fine).
Today is **2026-10-18** (Sunday). Your dispatch names which of the two roles you have.

## Role A - router and documents (Opus high)

Inputs: every `brain/*.md` Refresh log and Verification log sections (read only those, plus
"Answers questions about" and Entry points where the log says they changed); the new `M17` brain
file in full; `.claude/state/delta/2026-10-18/delta.json`; `.claude/state/inventory/SUMMARY.md`;
the structured results of the refreshers pasted in your dispatch.

Update in place, minimal edits:
1. `.claude/skills/temple-portal-expert/MIND-MAP.md` - add M17 to the Module map, Question router,
   Route index (the mobile app's screens and any new API prefixes), Store index (Prisma, new tables),
   Cross-cutting concerns (the `.ai/` loop under tooling); update counts (17 brain files, fault
   totals from the refreshed tables); re-check Unowned files against delta.json `unowned` and
   route the new root reports and `.nojekyll`/patch files to M15 or M17; add a dated line at the top:
   "Refreshed 2026-10-18 against commit <HEAD hash>".
2. `README.md` and `SKILL.md` in the skill folder - counts and the M17 mention; nothing else.
3. `docs/overview/OVERVIEW.md` and `TECHNICAL-GUIDE.md` - a "What changed since 2026-09-19"
   section near the top (10-20 lines: the mobile app, Prisma, the AI engine rewrite if the M08/M09
   logs say so, migration progress from M11, CI changes from M15), the module map row for M17,
   and corrections wherever a refresh log invalidated a sentence (grep the docs for the file names
   in the logs). Dates: say 2026-10-18 where you add text.
4. `docs/overview/temple-portal-brief.html` - the same "What changed" block as a short section,
   the M17 row, the at-a-glance numbers from today's SUMMARY.md. Keep it self-contained; verify by
   script afterwards: zero external resources, tags balanced, every colour literal in
   `app/globals.css`.
5. `.claude/state/CHECKPOINT.md` - append a "Run 4 - refresh 2026-10-18" block with what ran.
6. Script the link check across the skill folder and docs/overview: zero broken.

Return: `{ role: "A", filesEdited: [..], brokenLinks, htmlExternalResources, modulesInMap, whatChangedLines, notes }`

## Role B - the two decision reports (Opus xhigh)

Inputs: `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`, `docs/rearchitecture/UI-REDESIGN-PLAN.md`,
every brain Faults table (now carrying FIXED / STILL OPEN / MOVED / new rows), the M17 brain file,
`git log --since=2026-09-19 --format='%ad %h %s' --date=short | grep -v panchanga`.

Update in place, keeping every existing Reviewer-notes section:
1. Fault register: for each register row, read its source brain finding ids and set a status
   column: FIXED (commit), STILL OPEN, MOVED, or SUPERSEDED. Add register rows for new brain
   faults rated HIGH or MEDIUM. Recompute the totals and severity split everywhere they appear
   (executive summary, section 2 tables, appendix). Show the before/after counts in a new
   subsection "2.4 Register status as of 2026-10-18".
2. Reality check on the recommendation: `apps/mobile` exists now. Describe what it is (stack,
   screens, what it consumes) from the M17 brain file, state whether it matches Option B as
   recommended, and whether Phases 0-2 were done first as the report required (the fault statuses
   answer that). Add this as section "4.4 What happened since the recommendation (2026-10-18)".
   Do not change the recommendation unless the facts force it; if they do, change it everywhere.
3. Roadmap: the calendar started Monday 2026-09-21; four weeks have passed. Add a re-based
   calendar from Monday 2026-10-19 (Mon-Fri, no holidays, show the arithmetic per phase next to the
   original dates) in section 7, labelled as the re-base, keeping the original table.
4. UI plan: check the diagnosis rows' evidence lines still exist; mark rows whose dated pattern was
   removed as "RESOLVED (commit)"; note any redesign work already visible in the code under a new
   "Status as of 2026-10-18" subsection; re-check the specimen's colour literals are still all in
   `app/globals.css` (the token file may have changed - say if it did).
5. Append `## Reviewer notes` entries dated 2026-10-18 to both files with what changed.

Return: `{ role: "B", registerBefore: {HIGH,MEDIUM,LOW}, registerAfter: {HIGH,MEDIUM,LOW}, fixed, stillOpen, newRows,
recommendationStands, mobileMatchesOptionB, phases0to2Done (true|false|partial), rebasedPhase2Gate, uiRowsResolved,
specimenColoursStillInGlobals (true|false), filesEdited: [..], notes }`
