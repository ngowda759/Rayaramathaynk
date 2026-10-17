# Brief - S4: React Native migration analysis, fault register and rearchitecture report

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

A report Nikhil can take into a planning meeting that answers three questions with evidence:
(1) what is wrong with this codebase today and how serious each item is; (2) how it should be
re-architected; (3) what it would take to serve both browser and mobile from one React codebase
(React Native), with options compared, a recommendation, a portability matrix per module, and an
effort estimate with its assumptions shown.

## Inputs

```
.claude/skills/temple-portal-expert/brain/*.md        the 15 verified brain files - read every "Faults, smells and risks", "Portability notes", "Cross-module dependencies" and "Types and stores" section in full; skim the rest
.claude/state/verify/M*.md                            skeptic reports - the confirmed/refuted status of every finding; use only CONFIRMED findings, or ones you re-verify yourself
.claude/state/inventory/SUMMARY.md                    sizes, 'use client' count, hot-spot files
.claude/state/inventory/import-graph.json             coupling between folders
docs/ARCHITECTURE.md, AGENTS.md                       the intended architecture - the yardstick
package.json                                          dependencies (web-only ones matter: next/*, tiptap, framer-motion, react-datepicker, pdf-lib, nodemailer...)
```

## Method

1. Build the fault register first. Collect every CONFIRMED finding from the 15 brain files. Dedupe
   across modules (the same root cause reported twice becomes one entry that cites both). Classify:
   Security | Data integrity | Architecture violation | Duplication and dead code | Performance |
   Reliability and error handling | Accessibility and UX | Tooling and CI | Documentation drift.
   Rank by severity then by blast radius. Every row keeps its `path:line` evidence and its source
   finding ids (e.g. M04-F02, M12-F07). Spot-check 15 of them in the code yourself.
2. Describe the current architecture as built (not as documented) in one page with a diagram:
   layers, where the boundaries leak (from M10's SDK-boundary findings, M12's route table), the two
   data stores and the migration state (M11), the AI engine coupling (M08/M09).
3. Rearchitecture recommendations: a target layering (domain/types, data access, API, web UI,
   mobile UI), a monorepo layout proposal with concrete package names and what moves where, the
   sequencing (what to fix before any mobile work starts - usually auth, the API contract, the
   services boundary, finishing the store migration), and what to leave alone.
4. React Native path - compare at least four options with the same criteria table (code reuse %,
   web SEO impact, native capability access, team skill fit, build/release complexity, risk,
   rough cost): (A) Expo + React Native Web, one universal codebase replacing the Next site;
   (B) keep Next for web, add an Expo app, share `packages/*` (types, domain logic, API client,
   design tokens) in a monorepo; (C) wrap the existing site (Capacitor / PWA-to-store) with a
   native shell; (D) a universal-UI stack (Solito/Tamagui or similar) over Next + Expo. Recommend
   one, say why the others lose, and say what would change the recommendation.
5. Portability matrix: one row per module M01-M15 from the brain Portability tables: reuse as-is /
   adapt / rewrite / server-side only, the blocking web-only dependencies, and the API the mobile
   app would need (from M12's route table - list the gaps: data fetched only inside Server
   Components with no route handler).
6. Effort and roadmap. Give ranges in person-weeks per phase, state every assumption (team size,
   skill level, whether the store migration finishes first). Turn the phases into a calendar
   starting Monday 2026-09-21 counting working days (Mon-Fri, no holidays assumed - say so); show
   the arithmetic for each phase end date in a small table. Mark the estimate as an estimate.
7. Risks (technical, product, operational) and the decisions Nikhil must make, as a short list.
8. Write `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` with the structure:
   Executive summary (10 lines) / 1 Current state / 2 Fault register / 3 Target architecture /
   4 React Native options and recommendation / 5 Portability matrix / 6 API contract gaps /
   7 Effort, assumptions and roadmap / 8 Risks / 9 Decisions needed / Appendix: finding id index.
   Expected length 4000-8000 words plus tables. Evidence over adjectives. Date it 2026-09-19.

## Done means

- The file exists with all nine sections and the appendix.
- Every fault register row has evidence and source ids; the count of rows and the severity split
  appear in the executive summary.
- The options table has four rows and the same criteria columns for each.
- The roadmap table shows start date, working days, end date and the arithmetic for each phase.

## Output contract - structured return

```
output (path), words, faultsTotal, faultsBySeverity: {HIGH, MEDIUM, LOW}, faultsSpotChecked, faultsSpotCheckHeld,
recommendedOption (A|B|C|D), effortRangeWeeks: {low, high}, modulesRewrite, modulesAdapt, modulesReuse,
apiGaps, decisionsNeeded, notes (<=8 lines)
```
