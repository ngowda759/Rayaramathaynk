# Brief - S2: the human-facing overview and technical guide

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

Two documents a developer new to this repository reads on day one and comes away knowing what the
application is, who uses it, how it is put together end to end, and where to look for anything.
They synthesise the fifteen brain files; they do not duplicate the existing `docs/` (link to those).

## Inputs

```
.claude/skills/temple-portal-expert/brain/*.md   the 15 verified brain files - the source of truth for this task
.claude/state/inventory/SUMMARY.md               counts: files, lines, per-module sizes, 'use client' count
.claude/state/chunks.json                        module ids and titles
docs/ARCHITECTURE.md, docs/PROJECT_STRUCTURE.md, docs/DATA-MODEL.md, docs/RAYA_AI_ARCHITECTURE.md   existing docs to link, and to note where they are stale (the brain files say where)
README.md, package.json                          name, scripts, dependency list
```

## Method

1. Read SUMMARY.md and every brain file's Purpose, Entry points, Data flow and Cross-module sections.
   Read Component trees and Faults for the modules you will describe in depth (public site, admin,
   AI, data).
2. Write `docs/overview/OVERVIEW.md` (900-1500 words plus tables) for a product-minded reader:
   - what the application is and for whom (devotees, temple administrators, the trust), in plain words;
   - the feature map: public site, member features, admin console, Raya AI, calendar/panchanga,
     receipts/billing, device features - one paragraph each with the route(s);
   - two user journeys end to end (a devotee books a seva; an admin publishes an event) as numbered
     steps naming the page, then the component, then the service, then the store;
   - the module map (15 rows: id, name, one line, brain file link);
   - the state of the platform in one honest paragraph: what is complete, what is half-migrated
     (Firestore to Supabase), what is scaffolding or dead - drawn from the brain Faults tables;
   - where to go next (TECHNICAL-GUIDE.md, the expert skill, the rearchitecture reports).
3. Write `docs/overview/TECHNICAL-GUIDE.md` (2500-4500 words plus tables and trees) for an engineer:
   - stack and versions (Next 16 App Router, React 19, Tailwind 4, TypeScript strict, Firebase,
     Supabase, Vercel) and what that implies (Server Components, route handlers, proxy.ts);
   - runtime topology: browser -> Next app (server/client boundary) -> services -> stores and
     external services (Firebase Auth/Firestore/Storage, Supabase, Vercel Blob, LLM provider, email);
     describe it in words and as an ASCII diagram;
   - repository layout: folder -> purpose -> module id, one table;
   - the request lifecycle for three flows with file:line at each step: (1) rendering the home page,
     (2) a seva booking write, (3) one Raya AI chat message;
   - component trees: the root layout, the public layout, the admin shell, the home page, one CRUD
     admin page - copied or condensed from the brain files;
   - data: the store catalogue (collections and tables -> module), the migration state per domain,
     security rules in summary, indexes;
   - Raya AI pipeline in one page;
   - build, test, CI/CD and deployment as they actually are (from M15), including what is stale;
   - conventions the code follows and where it does not (services-only rule, no `any`, Server
     Components first) with counts from the brain files;
   - a "where to look" table: task -> file(s) -> brain section.
   - Every fact traces to a brain file or to code; cite `path` or `path:line`. Link each section to the
     brain file that has the detail.
4. Mark stale existing docs where you link them ("stale - see M15 documentation health").
5. Check every relative link resolves. Date both documents 2026-09-19.

## Done means

- Both files exist with the sections above, within the word ranges.
- Zero unresolved relative links (script it).
- Each of the 15 module ids is linked at least once across the two docs.

## Output contract - structured return

```
outputs: [paths], overviewWords, guideWords, modulesLinked, brokenLinks, staleDocsFlagged: [names],
unclear: [strings], notes (<=8 lines)
```
