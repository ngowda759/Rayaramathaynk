# Brief - V2: review the overview docs and the HTML brief

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

The two overview documents and the HTML brief are factually right, internally consistent, and the
HTML is genuinely self-contained and on-theme. Fix what is wrong in place.

## Inputs

```
docs/overview/OVERVIEW.md
docs/overview/TECHNICAL-GUIDE.md
docs/overview/temple-portal-brief.html
.claude/skills/temple-portal-expert/brain/*.md            the source of truth the docs were synthesised from
.claude/state/inventory/SUMMARY.md                        the numbers
C:\Users\HP ELITEBOOK\.claude\skills\coreflex-html-theme\SKILL.md   the theme rules the HTML must meet
```

## Method

1. **Facts.** Sample 25 factual claims across the two markdown docs (routes, file paths, flow steps,
   counts, migration states, versions). Check each against the brain file it should come from and,
   for 10 of them, against the code. CONFIRMED / REFUTED / UNCERTAIN with evidence.
2. **Consistency.** The HTML must say what the markdown says: compare the at-a-glance numbers, the
   module table, the three flows and the platform-state paragraph. List every divergence.
3. **Links.** Script it: every relative link in the two markdown files resolves to a file.
4. **HTML self-containment and theme.** Script it: no `http(s)://` in `src=`, `<link href>`,
   `<script src>`, `url(`; logo SVG present inline; count distinct CSS rules using `#AF2027`
   (max four places); file size under 400 KB; `<title>` present; headings nested properly; a print
   stylesheet exists; no horizontal overflow at 375px (check container widths and table wrappers
   by reading the CSS). Read the CFS theme skill and check the typeface stack and palette it
   requires are the ones used.
5. **Fix in place.** Re-read from disk, then correct REFUTED facts, divergences, broken links and
   theme violations directly in the three files - minimal edits. Do not restructure.
6. Write `.claude/state/verify/V2-docs-review.md`: the claims table, divergences, link results, the
   HTML checklist with values, and the edit log.

## Done means

- Report exists. Zero broken links, zero external resources, red accent within limit, all REFUTED
  facts corrected.

## Output contract - structured return

```
claimsSampled, claimsConfirmed, claimsRefuted, claimsUncertain, divergencesFound, divergencesFixed,
brokenLinks, externalResources, redAccentUses, htmlBytes, editsMade, file (report path), notes (<=6 lines)
```
