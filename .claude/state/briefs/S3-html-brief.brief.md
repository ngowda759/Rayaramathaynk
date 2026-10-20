# Brief - S3: the self-contained HTML overview brief (CoreFlex Solutions theme)

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

One HTML file Nikhil can email or drop on Teams that briefs a reader on this application in ten
minutes: what it is, how it is structured, the component trees that matter, the data stores, the
AI pipeline, and where to look next. It is styled in the CoreFlex Solutions (CFS) house theme and is
entirely self-contained - one file, nothing beside it.

## Inputs

```
docs/overview/OVERVIEW.md                                     the content source - written just before you; keep the facts identical
docs/overview/TECHNICAL-GUIDE.md                              the content source for the technical half
.claude/state/inventory/SUMMARY.md                            the at-a-glance numbers
.claude/skills/temple-portal-expert/brain/M01-*.md            root layout tree; M02 for the home page tree; M08 for the AI pipeline
C:\Users\HP ELITEBOOK\.claude\skills\coreflex-html-theme\SKILL.md      the CFS theme - palette, Century Gothic type stack, layout conventions, logo rules. Read it fully and follow it.
C:\Users\HP ELITEBOOK\.claude\skills\coreflex-html-theme\assets\cfs-logo.svg   the logo to inline
```

## Method

1. Read the CFS theme skill fully. The two rules it stresses most: red `#AF2027` is a sharp accent
   used in at most four places on the page, and an emailed file must be entirely self-contained -
   logo inlined as SVG, no `<link>` to fonts or stylesheets, no external `<script>`, no remote images.
   The company is CoreFlex Solutions, abbreviated CFS, never CFX.
2. Read OVERVIEW.md and TECHNICAL-GUIDE.md. Do not re-derive facts from code; if a fact is missing
   from both, open the brain file it points at.
3. Write `docs/overview/temple-portal-brief.html`, in this order:
   - header band with the inlined CFS logo, title "Temple Portal - Application Brief", the date
     2026-09-19 and "Prepared for: Nikhil, CoreFlex Solutions";
   - **At a glance** - a row of 6-8 stat tiles (routes, API routes, components, services, source
     lines, tests, data stores, modules) from SUMMARY.md and the guide;
   - **What it is** - the product paragraph and the users;
   - **Feature map** - a card grid, one card per feature area with its routes;
   - **Architecture** - an inline SVG diagram: browser -> Next.js app (server / client split) ->
     services layer -> Firebase (Auth, Firestore, Storage) | Supabase | Vercel Blob | LLM provider |
     email. Boxes and arrows, labelled, legible at 900px wide, theme colours only;
   - **Module map** - a table of the 15 modules: id, name, owns, brain file path (as text, not a link
     - the reader may not have the repository);
   - **How a request flows** - the three lifecycles from the guide as numbered steps;
   - **Component trees** - root layout, public layout, home page, admin shell - as `<pre>` trees;
   - **Data** - store catalogue and migration state table;
   - **Raya AI pipeline** - one diagram or numbered flow;
   - **State of the platform** - the honest paragraph plus a short table of the top risks (pull
     from OVERVIEW.md's platform-state paragraph; do not invent);
   - **Where to look next** - the expert skill, the technical guide, the two rearchitecture reports;
   - footer with CFS and the date.
4. Constraints: total file size under 400 KB; the logo SVG inlined once (reuse via `<use>` if it
   appears twice); print stylesheet so it prints cleanly to A4; readable on a phone (16px gutters,
   tables scroll horizontally, no horizontal page scroll); dark-mode handled the way the CFS skill
   says, if it says; semantic headings; no JavaScript needed for reading (a small script for the
   table of contents is acceptable, inline).
5. Verify by script: zero `http://` or `https://` occurrences in `src=`, `href=` of `<link>`, or
   `<script src>`; count occurrences of `#AF2027` (or its rgb) in CSS rules and confirm it is used
   in at most four distinct places; file size; well-formed HTML (matching tags for the main
   sections).

## Done means

- `docs/overview/temple-portal-brief.html` exists, under 400 KB, no external resources, logo inline.
- Every section listed above is present and its facts match OVERVIEW.md / TECHNICAL-GUIDE.md.

## Output contract - structured return

```
output (path), bytes, externalResources (count, must be 0), redAccentUses, sections: [names],
factsCheckedAgainstDocs, notes (<=6 lines)
```
