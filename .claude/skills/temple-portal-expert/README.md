# temple-portal-expert

Built **2026-09-19** against the repository at `D:\Onboarding\Repos\POCs\General Purpose POCs`.
Refreshed **2026-10-18** against commit `424fdb8` of the git clone at
`D:\Onboarding\Repos\POCs\General Purpose POCs Git Connected` - 17 brain files, with M17 added for
the Expo mobile app, the Prisma layer, the `.ai/` development loop and the new root reports.

## What this folder is

The resident expert on the **Sri Raghavendra Swamy Matha portal** (`temple-portal`, deployed as
*Rayaramatha*): a Next.js 16 temple website with a public devotee site, a ~60-screen admin console
and the Raya AI assistant, on Firebase and a half-finished Supabase migration.

It is deliberately three layers, not one file:

| Layer | File | Job |
|---|---|---|
| Protocol | [`SKILL.md`](SKILL.md) | How to answer a question: route, read one section, confirm in the code, answer in the right shape |
| Router | [`MIND-MAP.md`](MIND-MAP.md) | Module map, question router, route index, store index, cross-cutting concerns, glossary, find-it recipes, known problem areas, unowned files |
| Detail | [`brain/`](brain/) | 17 verified files, `M01`-`M17`, roughly 2.1 MB total |

`M01`-`M15` and `M17` are module files and all have the same sections, so the router can name one precisely:
*Answers questions about, Purpose and business role, Code roots, Entry points, Component trees, Data
flow, Key files, Types and stores, Cross-module dependencies, How to change it, Faults smells and
risks, Portability notes, Coverage, UNCLEAR, Verification log*.

`M16` is the exception: it owns no code and is an index rather than a module, so its shape is
*Answers questions about, Scope and method, Index, Firestore collections, Supabase tables, Orphans
and mismatches, How to change it, Coverage, UNCLEAR, Verification log*. Ask it what fields a
collection has, who writes a field and who reads it back, and which collections have no TypeScript
type at all.

*Coverage* there means **file coverage** - which of that module's inventory files the brain file
accounts for, and how deeply each was read. It is not test coverage: what is tested is M15's
*Component trees* &rarr; *Test-runner trees* and its `Tests - …` tables under *Key files*.

## How to use it

- **Just ask.** "How does seva booking work?", "Which collection stores receipts?", "What does
  `/api/chat` do?", "What would it take to add a field to an event?" - the skill's description
  triggers on those shapes and on the domain words.
- **Or invoke it by name:** `/temple-portal-expert`.
- **For a cold start**, read `MIND-MAP.md` top to bottom once: *What this application is*, the
  *Module map* and the *Glossary* give you the whole product in about ten minutes.

The skill explains and locates. It does not write code. When you do change code, the repository's
own rules in [`AGENTS.md`](../../../AGENTS.md) - the Mandatory Planning Phase, decision validation
and definition of done - apply.

## File layout

```
.claude/skills/temple-portal-expert/
  SKILL.md        the protocol (436-word body) and one worked example
  MIND-MAP.md     the routing tables
  README.md       this file
  brain/
    M01-foundation-and-ui-kit.md                                 app shell, tokens, UI kit
    M02-public-information-pages.md                              home and institutional pages
    M03-public-devotional-and-transactions.md                    sevas, donations, member pages
    M04-auth-users-and-security.md                               auth, roles, rules
    M05-admin-platform-and-settings.md                           admin shell, dashboard, settings
    M06-admin-content-and-media.md                               events, gallery, media, content
    M07-admin-devotional-operations.md                           bookings, billing, receipts
    M08-raya-ai-engine.md                                        retrieval, intents, chat API
    M09-raya-ai-console-and-knowledge-workflow.md                chat UI, AI console, knowledge
    M10-services-and-types-catalogue.md                          every service and type
    M11-data-model-persistence-and-migration.md                  collections, tables, migration
    M12-api-layer.md                                             all 97 route handlers
    M13-device-capabilities-i18n-and-pwa.md                      device, i18n, a11y, PWA
    M14-domain-engines-panchanga-aaradhane-receipts-reports.md   panchanga, aaradhane, PDFs
    M15-testing-ci-tooling-and-repo-health.md                    tests, CI, docs health
    M16-collection-field-catalogue.md                            every field of every collection
    M17-mobile-app-prisma-and-ai-loop.md                         Expo app, Prisma, .ai loop, root reports
```

Supporting state that produced these files lives outside the skill and is not needed to use it:
`.claude/state/chunks.json` (the module definitions), `.claude/state/inventory/SUMMARY.md` (file and
line counts, unassigned files, import hot-spots) and `.claude/state/verify/M*.md` (the skeptic pass
that corrected each brain file). One exception: `M16`'s tables are regenerated from
`.claude/state/inventory/fields.json` by `.claude/state/inventory/fields.mjs`, so that pair is
worth keeping if you intend to refresh the field catalogue rather than edit it by hand.

## Keeping the brain fresh

A brain file is a snapshot of the code on 2026-09-19, refreshed on 2026-10-18 (each file's *Refresh
log* says what moved). It goes stale the moment that module changes.

1. **After changing a module**, re-run the verify brief for that module id against the changed files,
   and fold its corrections back into the brain file. The previous run's logs in
   `.claude/state/verify/M*.md` show the expected shape: path check, line-citation check, fault
   re-verification, counts.
2. **Small corrections need no re-run.** If you find the brain contradicting the code while answering
   a question, the code wins - fix the line in the brain file there and then, and say so. The skill
   protocol requires this.
3. **New routes, collections or modules** go into `MIND-MAP.md` as well as the brain file: the Route
   index, the Store index and the Question router are what make a topic findable at all.
4. **Check the Verification log** at the foot of a brain file before trusting a surprising claim; it
   records what was machine-checked on 2026-09-19 and what was not.
