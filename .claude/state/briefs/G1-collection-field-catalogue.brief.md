# Brief - G1: field-level catalogue of every Firestore collection and Supabase table

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

A brain file that answers "what fields does collection X have, who writes them, who reads them" for
every store the application touches. The M11 skeptic reported this half of the data-model question
was never answered: the M11 brain lists collections, rules, indexes and call sites, but not fields.

## Inputs

```
.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md   the collection list (63 Firestore collections, 21 Supabase tables) and the "no TS type" list - start from its Types and stores section
.claude/skills/temple-portal-expert/brain/M10-services-and-types-catalogue.md            service -> collection map, types -> services map
types/*.ts                                                                                the declared shapes, where one exists
services/*.ts, lib/**, app/api/**, app/**/page.tsx, scripts/*.ts, seed/**                 the read and write sites
supabase/migrations/*.sql                                                                 table columns and RLS
docs/DATA-MODEL.md, docs/SUPABASE_DATABASE_SCHEMA.md                                      the documented claims, to mark mismatches
.claude/state/briefs/BUILD.brief.md                                                       the house style for brain files (header line, "Answers questions about", tables, path:line evidence)
```

## Method

1. Take the collection and table lists from M11. Do not re-derive them; if you find a collection M11
   missed, add it and say so under Coverage.
2. Write `.claude/state/inventory/fields.mjs` (plain Node) that, for each collection name, finds the
   call sites (`collection(`, `doc(`, `collectionGroup(`, `.from('<table>')`, string literals of the
   name) and, within a window around each call site, harvests field names from: object literals
   passed to `setDoc/addDoc/updateDoc/set/update/insert/upsert`, `where('<f>'`, `orderBy('<f>'`,
   `data().<f>` / `data.<f>` / `doc.<f>` reads, and destructuring. Emit
   `.claude/state/inventory/fields.json` = `{ "<collection>": { "<field>": { writes: [path:line], reads: [path:line] } } }`.
   Regex harvesting will over- and under-match; use it to find candidates, then confirm the
   important ones by opening the file. Say in the brain what the script does and does not catch.
3. For each collection: merge the declared type (types/*.ts) with the harvested fields. Table:
   field | type (declared, or inferred with "?") | required? | written by | read by | notes (index,
   rule, doc-model claim, mismatch). Then one line each: rule that governs it (from M11), index (from
   firestore.indexes.json), migration status (from M11), the Supabase table replacing it if any.
4. For each Supabase table: columns from the migration (name, type, nullable, default), RLS summary,
   which code reads and writes it (grep `.from('<table>')`), and the Firestore collection it mirrors.
5. Orphans and mismatches: fields written but never read; fields read but never written (expected
   from seed data or manual entry - say which); collections with no TS type; fields in the TS type
   that no code writes; names where docs/DATA-MODEL.md disagrees with the code.
6. Write `.claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md`:
   ```
   # M16 - Collection and table field catalogue
   > Brain file ... (same header line as the other brain files, dated 2026-09-19)
   ## Answers questions about
   ## Scope and method            (what the script harvested, what it cannot see, how to re-run it)
   ## Index                        (table: store | kind | type file | fields | writers | readers | migration state | jump link)
   ## Firestore collections        (one ### subsection per collection, alphabetical)
   ## Supabase tables              (one ### subsection per table)
   ## Orphans and mismatches
   ## How to change it             (add a field end to end: type -> service -> rule -> index -> admin form -> public reader)
   ## Coverage                     (collections in M11: N, catalogued: N; tables: N/N)
   ## UNCLEAR
   ```
   Expected 900-1600 lines. Every writer and reader carries `path:line`.
7. Path check by script before returning (every cited path exists).

## Done means

- The brain file exists with every collection and table from M11 present as a subsection.
- `fields.mjs` re-runs cleanly and `fields.json` exists.
- Zero broken cited paths.

## Output contract - structured return

```
collections, tables, fieldsTotal, collectionsWithoutType, orphanFieldsWrittenNeverRead, orphanFieldsReadNeverWritten,
docMismatches, collectionsAddedBeyondM11: [names], file, notes (<=8 lines)
```
