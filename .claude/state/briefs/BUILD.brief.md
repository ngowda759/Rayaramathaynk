# Brief - BUILD: write the brain file for one module chunk

Read `.claude/state/briefs/RULES.md` first. Then this. Your dispatch names your chunk id.

## Goal

One markdown "brain file" that lets a future agent, who has never seen this repository, answer any
question about your module correctly and point to the exact files - purpose, structure, component
trees, data flow, how to change it, what is wrong with it, and what would not survive a move to
React Native.

## Inputs

```
.claude/state/chunks.json                     your chunk entry: title, roots, docs, focus questions
.claude/state/inventory/<id>.json             your files with lines, exports, imports, 'use client' flags (if missing, list the roots yourself)
.claude/state/inventory/SUMMARY.md            the Unassigned list - adopt any file that clearly belongs to your module and say so
.claude/state/inventory/import-graph.json     who imports whom (for cross-module dependencies)
docs/ARCHITECTURE.md, docs/DATA-MODEL.md      the documented intent; grade the code against it
<the docs listed in your chunk entry>         same - documented intent, not truth
AGENTS.md                                     the rules the code is supposed to follow (services only, no any, Server Components first, ...)
```

## Method

1. Read your chunk entry and inventory. Note `filesExpected` = the file count in your inventory JSON.
2. Read the docs listed for your chunk - quickly, to learn the vocabulary and the claims.
3. Read the entry points first (page.tsx, layout.tsx, route.ts, index.ts, the service files), then
   follow imports downward. Read every source file in your roots at least once, fully for files
   under 300 lines, by structure (exports, JSX tree, hooks used, service calls) for larger ones. Do
   not read files outside your roots except to confirm a boundary (one level of import is fine).
4. Answer every focus question in your chunk entry. Where a question's answer is "does not exist"
   or "documented but not implemented", say so - that is a finding.
5. Build the component tree for every page/route you own, as an indented tree:
   `PageComponent (server|client) app/(public)/x/page.tsx` -> children -> hooks -> services -> store.
   For admin CRUD pages that share a framework, draw the framework once and list the pages using it.
6. Write the brain file with the exact section structure below. Tables for inventories, numbered
   lists for flows, trees for composition. Every claim about code carries `path:line` or `path`.
7. Before returning, run a script over your brain file to list every `path` it cites and check each
   exists on disk; fix any that do not. Count how many of your inventory files are mentioned; aim for
   all of them (a table row is enough), and list the deliberately omitted ones under Coverage.

## The brain file - `.claude/skills/temple-portal-expert/brain/<id>-<slug>.md`

```
# <id> - <title>
> Brain file for the temple-portal expert skill. Written 2026-09-19 from code, not from docs. Verify against the code before acting on any claim.

## Answers questions about
- one bullet per question topic this file can answer (10-25 bullets, phrased the way a developer asks:
  "how does seva booking work end to end", "where is the admin menu defined")

## Purpose and business role
What this module does for devotees, admins or the system. 5-15 lines.

## Code roots
The paths you own (from chunks.json plus adopted files).

## Entry points
Table: route or entry | file | server/client | auth required | what it renders or does

## Component trees
One tree per page/feature (see Method 5). Use the (server|client) marker on every component.

## Data flow
Numbered flows for the 2-6 most important operations: UI event -> hook/handler -> service function ->
store (collection/table/file) -> back. Name the function and file at each step.

## Key files
Table: file | lines | role | key exports | notes. One row per file you own (group trivially similar files).

## Types and stores
Types used (types/*.ts) and every Firestore collection, Supabase table or static file touched, with read/write.

## Cross-module dependencies
What this module imports from other chunks (name the chunk id) and who imports it. Use import-graph.json.

## How to change it
Recipes: add a field, add a page, add a menu entry, change a rule - 3-8 recipes, each: files to touch in order.

## Faults, smells and risks
Table: id (<id>-F01...) | severity HIGH/MEDIUM/LOW | what | evidence path:line | suggested direction.
Include: architecture-rule violations (AGENTS.md), duplication, dead code, missing validation/auth,
error handling gaps, performance, accessibility, doc-vs-code drift. Be specific and evidenced.

## Portability notes (React Native / cross-platform)
Table: piece | web-only dependency (next/image, next/link, next/navigation, Server Components, DOM API,
CSS/Tailwind, framer-motion, tiptap, window/document, cookies...) | reuse as-is / adapt / rewrite | why.
Then 3-8 lines: what a React Native client would need from this module (API, shared types, shared logic).

## Coverage
filesExpected N, filesMentioned M, omitted: list with one-word reasons.

## UNCLEAR
Anything you could not determine, and what would settle it.
```

Expected size: 300-900 lines depending on the chunk. Long tables are fine; prose padding is not.

## Done means

- The brain file exists at the path above with every section present and non-empty.
- Every cited path exists (you checked by script).
- filesMentioned / filesExpected >= 0.9, or the gap is explained under Coverage.
- Every focus question from chunks.json is answered somewhere in the file.

## Output contract - structured return

```
chunk, title, filesExpected, filesMentioned, file (the brain file path),
findings: [{ id, severity, summary (<=40 words), evidence }]   (all rows of the Faults table),
portabilitySummary (<=60 words), unclear: [strings], notes (<=8 lines: contradictions, adopted files, anything the orchestrator must know)
```
