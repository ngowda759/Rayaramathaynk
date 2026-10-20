# Brief - G2: close the documentation gaps the reviewers found

Read `.claude/state/briefs/RULES.md` first. Then this. You edit existing files; re-read each from
disk immediately before editing, keep edits minimal and in the file's existing voice, and record
every edit in your return.

## Goal

After this task, every source file in the repository is described by some brain file, the mind map
routes to the new M16 field catalogue, and no document in the run still says a sibling document
"does not exist yet".

## Inputs

```
.claude/state/inventory/SUMMARY.md                       "## Unassigned" - the 11 files no brain file owns
.claude/state/inventory/import-graph.json                 who imports each of them (dead or live)
.claude/skills/temple-portal-expert/brain/*.md            the brain files you will append to (M02, M03, M05, M06, M11, M15) and M16 (just written and verified)
.claude/skills/temple-portal-expert/{SKILL,MIND-MAP,README}.md
.claude/state/verify/V1-skill-qa.md                       brain defect 1 (M03 flow step 4) and the QA's observations
docs/overview/OVERVIEW.md, docs/overview/TECHNICAL-GUIDE.md, docs/overview/temple-portal-brief.html
.claude/state/briefs/BUILD.brief.md                       house style for brain sections
```

## Method

1. **Unassigned files (11).** For each, open it, grep its importers, and add it to the right brain
   file: a Key files row, and where it matters a note in Faults (dead duplicate, second copy of a
   job) or Entry points (a script) or Component trees (if mounted). Expected homes, confirm from code:
   `components/admin/AdminHeader.tsx`, `AdminSidebar.tsx`, `DashboardCard.tsx` -> M05 (are they dead
   duplicates of `components/admin/layout/*`? importer count decides); `RichTextEditor.tsx` -> M06;
   `components/analytics/PageViewTracker.tsx` -> M15 (and where it is mounted - M01 root layout?);
   `components/debug/ClientEnvDebug.tsx` -> M05 (debug pages) with a Faults row if it exposes env;
   `scripts/export-events.ts`, `import-events.ts`, `generate-events-firestore.ts` -> M11 (scripts) with
   a pointer from M06 events; `scripts/update-finance-settings.js` and `.ts` -> M11 with a Faults row
   for the duplicate and a pointer from M05 finance settings. Update each touched file's Coverage line.
2. **`app/(public)/pages/settings`** - M02 lists it as an orphan route with no description. Open it,
   describe what it renders and whether anything links to it, in M02 (or M03 if it is profile-like;
   then cross-reference from M02).
3. **Search ranking** - add a "Search ranking" flow to M02's Data flow describing how
   `services/search.service.ts` scores and orders results (read the service; cite lines).
4. **M03 brain defect** - Data flow, flow 1 (Seva booking) step 4 quotes the booking reference as
   `SVA-${Date.now().toString(36)}`; the code at `components/home/SevaBooking.tsx:152` also calls
   `.toUpperCase()`. Fix the literal.
5. **MIND-MAP.md** - (a) line ~364 says the rearchitecture report "is being written in parallel with
   this one and does not exist yet": it exists now at `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md`,
   alongside `UI-REDESIGN-PLAN.md` and `ui-redesign-specimens.html` - fix the sentence and link all
   three; (b) add M16 to the Module map with its brain link and "ask it about" topics; (c) add
   Question-router rows for "what fields does <collection> have", "who writes <field>", "which
   collections have no TS type" -> M16; (d) in the Store index, add one line pointing field-level
   detail to M16; (e) in Unowned files, mark the 11 files as now documented, naming the brain file
   for each. **README.md** - mention M16 in the layout and the count of brain files (16).
   **SKILL.md** - only if the module count or a protocol step names "15"; otherwise leave it.
6. **docs/overview/OVERVIEW.md, TECHNICAL-GUIDE.md** - where the text refers to the expert skill or
   the rearchitecture reports as plain paths because they did not exist yet, make them relative
   markdown links; add M16 to the module map (16 rows) and a one-line pointer in the data section.
   Script the link check afterwards (zero broken).
7. **docs/overview/temple-portal-brief.html** - add the M16 row to the module-map table and mention
   the field catalogue in "Where to look next". Afterwards verify by script: still zero external
   resources, tags balanced, size under 400 KB, red accent rules unchanged.

## Done means

- SUMMARY.md's 11 unassigned files each appear in a brain file (grep each path across brain/).
- MIND-MAP.md has 16 module rows, the M16 router rows, and no "does not exist yet" sentence.
- Both overview docs link to the skill and the reports; link check zero broken; HTML checks pass.

## Output contract - structured return

```
unassignedDocumented, brainFilesEdited: [names], mindMapEdits, readmeEdited, skillEdited,
overviewEdits, guideEdits, htmlEdited, htmlExternalResources, htmlBytes, brokenLinks,
edits: [one line each: file - what changed], notes (<=8 lines)
```
