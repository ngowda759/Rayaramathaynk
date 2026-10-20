# Brief - S1: the expert skill and its mind map

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

A Claude Code skill at `.claude/skills/temple-portal-expert/` that behaves as the resident expert on
this application: given any question about what the app does, how a module is built, where
something lives, what a change would touch, or what is broken, it routes to the right brain file,
confirms against the code, and answers with file references. It must work for someone who opens this
repository cold, and it must not try to hold everything in one file - the mind map routes, the
brain files hold the detail.

## Inputs

```
.claude/skills/temple-portal-expert/brain/*.md       the 15 verified brain files (read the first ~80 lines and the section headings of each; dip in as needed)
.claude/state/chunks.json                            chunk ids, titles, roots
.claude/state/inventory/SUMMARY.md                   totals, unassigned files, hot-spot files
.claude/state/verify/M*.md                           what the skeptics changed (skim the logs)
AGENTS.md                                            the repository's rules; the skill must point developers at them for change requests
C:\Users\HP ELITEBOOK\.claude\plugins\cache\claude-plugins-official\superpowers\6.3.0\skills\writing-skills\SKILL.md   how a good skill is written (frontmatter, <500-word body, triggers, red flags)
```

## Method

1. Read writing-skills first. Then read every brain file's header, "Answers questions about", "Code
   roots", "Entry points" and section list. Build a private list of every question topic and the
   brain file that answers it; note overlaps (two files claim the same topic) and gaps (a route,
   collection or folder no brain file owns - use SUMMARY.md's Unassigned list).
2. Write `MIND-MAP.md` - the routing table. Sections, in this order:
   - **What this application is** - 6-10 lines: product, users (devotees, admins, trust), the
     stack in one line, the two data stores and the migration state in one line.
   - **Module map** - table: module id | brain file (relative link) | owns (code roots, short) |
     ask it about (the top 5-8 question topics).
   - **Question router** - table of question shapes -> where to go: "how does <feature> work end to
     end", "where is <thing> defined", "which collection stores <data>", "what does route <path> do",
     "how do I add <x>", "what breaks if I change <y>", "is <module> tested", "what is wrong with
     <module>", "can <module> move to React Native". Each row names the brain section to open first.
   - **Route index** - every route group and API prefix -> module id (from the brain Entry points).
   - **Store index** - every Firestore collection and Supabase table -> module id(s) that read/write it.
   - **Cross-cutting concerns** - auth, styling/tokens, i18n, analytics, error handling, rate
     limiting, caching/revalidation, testing, CI -> module id and file.
   - **Glossary** - the domain words a newcomer will not know (Seva, Pooja, Aaradhane, Panchanga,
     Ekadashi, Guru Parampara, Shloka, Stotra, Raya AI, Matha, Brindavana, Prasada, and any others
     that appear in the brain files), one line each, with the module that owns the concept.
   - **Find-it recipes** - 8-12 grep/glob patterns that answer common locate questions fast.
   - **Known problem areas** - one line per module pointing at its Faults table, and a pointer to
     `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` (being written in parallel - link it
     even if it does not exist yet, and say so).
   - **Unowned files** - the Unassigned list from SUMMARY.md, grouped, with the closest module.
3. Write `SKILL.md`. Frontmatter: `name: temple-portal-expert`; `description` that triggers on
   questions about this codebase (how does, where is, what does, explain, which file, which
   collection, walk me through, what would it take to change, is this tested, and on the domain
   words) - write it the way writing-skills says. Body under 500 words, the protocol:
   1. Classify the question with the Question router in MIND-MAP.md; pick the module(s).
   2. Open the named brain section. Never answer from the brain alone when the answer will be acted
      on: confirm against the code the brain cites (grep the symbol, open the file).
   3. Answer with `path:line` references, the component tree or flow excerpt, and the caveats the
      brain lists. Short answers for locate questions; flows for how-does questions; a file list in
      order for change questions, plus a reminder that AGENTS.md's planning phase applies to code changes.
   4. When the brain and the code disagree, the code wins: fix the brain file in the same turn and
      say so. When a question has no home, answer from the code and add the topic to the mind map.
   5. Scope: this skill explains and locates; it does not implement. If asked to build, hand over the
      file list and the relevant "How to change it" recipe and stop.
   Include a red-flags list (answering from memory; quoting a doc instead of code; reading a whole
   module when the brain names the file; skipping the mind map and grepping blindly) and one worked
   example (question -> router row -> brain section -> code check -> answer shape).
4. Write `README.md` (short): what the folder is, how to invoke the skill (`/temple-portal-expert`
   or by asking a question), how to keep the brain fresh (re-run the verify brief on a module after
   changing it), the file layout, and the date built.
5. Check every relative link in the three files resolves. Check the body word count of SKILL.md.

## Done means

- `SKILL.md`, `MIND-MAP.md`, `README.md` exist in `.claude/skills/temple-portal-expert/`.
- Every module id M01-M15 appears in the Module map with a working link.
- Every route group listed in the brain files' Entry points appears in the Route index.
- SKILL.md body <= 500 words (the frontmatter and the worked example excluded), and its
  description names at least 12 trigger phrases including domain words.

## Output contract - structured return

```
outputs: [paths], skillBodyWords, modulesMapped, routesIndexed, storesIndexed, glossaryTerms,
overlaps: [topic - files], gaps: [what has no owner], notes (<=8 lines)
```
