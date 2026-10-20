# Brief - G1V: refute and correct the field catalogue (M16)

Read `.claude/state/briefs/RULES.md` first, then `.claude/state/briefs/VERIFY.brief.md` for the
method and rules of engagement - they apply here with the substitutions below.

## Substitutions

- The brain file under test is `.claude/skills/temple-portal-expert/brain/M16-collection-field-catalogue.md`.
- There is no chunks.json entry; the "inventory" is the collection and table list in
  `.claude/skills/temple-portal-expert/brain/M11-data-model-persistence-and-migration.md` (Types and stores section).
- Your report goes to `.claude/state/verify/M16.md`.

## What to break

1. **Completeness.** Every collection and table named in M11 has a subsection. Script the diff.
2. **Field claims.** Sample 40 field rows across at least 20 collections, weighted toward the ones
   the app writes most (bookings, donations, receipts, sevas, events, users/profiles, AI settings,
   knowledge). For each: open the cited writer and reader lines. Is the field really written there,
   read there, with that shape? Look for fields the harvester missed in the same call site.
3. **Types.** For 10 collections with a declared type, diff the type's fields against the table.
4. **Supabase.** For 10 tables, check columns against the migration SQL and the read/write sites.
5. **Orphans.** Re-check 10 "written never read" and 5 "read never written" claims by grep.
6. **Mismatches.** Check 5 doc-vs-code mismatch claims against docs/DATA-MODEL.md.
7. **Paths.** Script the existence check over every cited path.

Correct in place, append `## Verification log (2026-09-19)`, write the report.

## Output contract - structured return

```
pathsChecked, pathsBroken, pathsFixed, collectionsExpected, collectionsPresent, tablesExpected, tablesPresent,
fieldRowsSampled, fieldRowsConfirmed, fieldRowsRefuted, fieldRowsUncertain, fieldsAdded, orphansRefuted,
file, notes (<=8 lines)
```
