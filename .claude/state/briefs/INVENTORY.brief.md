# Brief - INVENTORY: mechanical file, export and import inventory per chunk

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

A script-generated inventory of the repository, split by the 15 chunks in `.claude/state/chunks.json`,
so that fifteen later analysts can each see exactly which files they own, how big each is, what it
exports, what it imports, and which files nobody owns.

## Inputs

```
.claude/state/chunks.json        the chunk list; each chunk has "roots" (paths or simple globs)
tsconfig.json                    for the path alias (probably "@/*" -> repo root) used in imports
```

## Method

1. Write `.claude/state/inventory/inventory.mjs` - plain Node (built-ins only, no dependencies).
2. Walk the repository once, skipping `node_modules`, `.next`, `.claude`, `.git`, `data/panchanga`
   (count its files only), `public` (list names and extensions only, never open), and any file over
   2 MB. For every `.ts .tsx .js .jsx .mjs .py .css .json .md .sql .yml .yaml .rules .sh .html`
   file record: path (forward slashes, repo-relative), lines, bytes.
3. For every `.ts .tsx .js .jsx .mjs` file additionally record, by regex, not a parser:
   `hasUseClient` (first non-comment line is `'use client'` or `"use client"`), `hasServerOnly`
   (imports `server-only`), `exports` (names after `export function|const|class|default|type|interface`),
   `imports` (module specifiers from `import ... from '...'` and `require('...')`), and
   `localImports` (specifiers starting with `@/`, `./`, `../`, resolved to a repo-relative file path
   using the tsconfig alias; try `.ts .tsx .js .jsx /index.ts /index.tsx` in that order).
4. Resolve each chunk's `roots` to files. A root is a directory (take everything under it), a file,
   or a glob with a single `*` in the last segment (e.g. `lib/*.ts`, `scripts/migrate-*.ts`).
   Write `.claude/state/inventory/<chunkId>.json` = `{ id, title, files: [...records], totals: { files, lines } }`.
5. Write `.claude/state/inventory/import-graph.json` = `{ "<file>": ["<local import file>", ...] }`
   for every source file in `app components services lib hooks types context utils`.
6. Write `.claude/state/inventory/SUMMARY.md`:
   - a table: chunk id, title, files, lines;
   - `## Unassigned` - every file under `app components services lib hooks types context utils data seed scripts tests` not in any chunk, one per line with its line count;
   - `## Assigned to more than one chunk` - files in 2+ chunks with the chunk ids (this is allowed, just list it);
   - `## Reverse dependency hot-spots` - the 30 most-imported local files with their importer counts;
   - the totals: source files, source lines, `'use client'` file count, `server-only` file count.
7. Run it: `node .claude/state/inventory/inventory.mjs`. Fix until it completes without error and the
   totals in SUMMARY.md are plausible (the repo has roughly 190k lines across app, components,
   services, lib, types, tests, scripts, data).

## Done means

- `.claude/state/inventory/M01.json` ... `M15.json`, `import-graph.json`, `SUMMARY.md` all exist.
- `SUMMARY.md` table has 15 rows and an Unassigned section.
- The script re-runs cleanly (`node .claude/state/inventory/inventory.mjs` twice, same output).

## Output contract - structured return

`{ chunks: [{id, files, lines}], unassignedFiles, multiAssignedFiles, useClientFiles, serverOnlyFiles, summaryPath, notes }`
`notes` <= 6 lines: anything odd (a root that matched nothing, alias not found, etc.).
