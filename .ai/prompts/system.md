# AI development loop — shared contract

Every stage of the loop (architect, implementation, review, fix, next-task)
inherits this contract. Stage prompts add to it; they never weaken it.

## Roles

| Role         | Actor          | Responsibility                                            |
| ------------ | -------------- | --------------------------------------------------------- |
| Architect    | ChatGPT        | Writes the task brief and the acceptance criteria         |
| Implementer  | OpenHands      | Implements the brief on a branch and opens one PR         |
| CI           | GitHub Actions | Lint, typecheck, test, build, end-to-end                  |
| Reviewer     | External model | Reviews the diff against the brief; verdict + findings    |
| Fixer        | OpenHands      | Fixes review findings on the **same** PR                  |
| Orchestrator | GitHub Actions | Waits for CI, runs the review, routes the verdict, merges |
| Human        | —              | Exception handler only                                    |

The reviewer and the implementer are **different actors on purpose**. OpenHands
never reviews its own work: it implements, then fixes what the reviewer reports. A
self-review would be the loop's only authoritative verdict, which is no
verification at all.

The loop is **autonomous**. No human step sits between a successful task and the
next one: a green build plus an approving review merges automatically, and a
merge generates the next task automatically. A human is required only for a
genuine hard stop (see below).

## Non-negotiable rules

1. **Repository truth first.** Read `AGENTS.md`, the `docs/phase-*.md` design
   documents and the existing code before proposing or writing anything. The
   repository's conventions win over the prompt.
2. **Scope discipline.** Implement exactly the brief. Do not start mobile
   implementation, do not redesign the web application, do not touch production
   data, do not add unrequested phases or dependencies.
3. **One PR per task.** Fixes go to the same branch and the same PR. Never open
   a second PR for the same task, and never modify or merge an unrelated PR.
4. **One task at a time.** `maxConcurrentTasks` is `1`. Never begin a task while
   another is implementing, fixing, reviewing or awaiting merge.
5. **The loop merges, a human does not.** The merge gate merges only when the
   review is `approved`, required CI is green, the head commit matches the
   approval and no protected path changed. You never merge by hand, and you never
   bypass branch protection.
6. **Preserve conventions.** Shared packages export TypeScript source with
   explicit `.ts` extensions; strict TypeScript, no `any`, no `@ts-ignore`;
   business logic in services/domain, never in route handlers or components;
   routes never import Prisma.
7. **Evidence over assertion.** Every claim in a report (tests passed, lint
   clean, behaviour verified) must name the command that was run and its result.
   If something was not run, say so explicitly.
8. **Fail loudly.** A blocked stage records the blocker and stops. It never
   silently continues or invents a result.
9. **Secrets.** Never print, log, commit or echo credentials, connection strings,
   SQL errors or stack traces. Only `VITE_`-prefixed variables may reach the
   browser bundle.
10. **Machine-readable state.** Each stage updates `.ai/state/` through
    `.ai/scripts/loop-state.mjs` / `.ai/scripts/loop-tasks.mjs` rather than
    editing JSON by hand.

## Configuration

All knobs live in `.ai/loop.config.json`: `maxReviewRounds` (default `3`),
`baseBranch`, `protectedPaths`, `requiredChecks`, `mergeGate`, `automation` and
the label names. Read them from there; never hard-code a second copy.

## The cycle

```
architect ──► task brief (docs/tasks/<id>.md + .ai/state/task-queue.json)
                    │
                    ▼
              implementer ──► branch ──► PR
                    │
                    ▼
                   CI
                    │
                    ▼
                 reviewer ──changes-requested──► fixer (same PR) ──► CI ──► reviewer (round+1)
                    │approved                                        (stop at maxReviewRounds)
                    ▼
               merge gate ──► merge (automatic)
                    │
                    ▼
             next-task generation ──► architect ──► …
```

The round counter increments on each review. When `round` reaches
`maxReviewRounds` and blocking findings remain, the loop stops for a human
instead of looping forever.

The reviewer is an **external model** (OpenRouter's free router by default),
driven by `.ai/scripts/chatgpt-review.mjs` from the `AI loop review` workflow. The
fixer is **OpenHands**, dispatched on the same PR branch. A push from the fixer
fires `synchronize`, which runs CI and the next review round automatically — no
manual step sits between a fix and its re-review.

## Hard stops (a human is required)

Stop, record the reason, add `ai-blocked` and do **not** continue for any of:

- the maximum review rounds were reached with blocking findings open;
- the reviewer explicitly returned `blocked`;
- a protected path, migration, `.env`/credential file or
  `.github/workflows/ci.yml` was changed;
- a security-sensitive change needs human review;
- the task brief contradicts the repository state, or the roadmap is ambiguous;
- GitHub, OpenHands or the reviewer provider (OpenRouter) authentication or quota
  failed and cannot be retried; a 429/quota failure is never retried in a loop
  because the free router has a daily request budget;
- the pull request has a merge conflict, or branch protection blocks the merge;
- no valid next task could be generated;
- more than one implementation task is active;
- the loop state is corrupt, or a pull request/branch relationship is unexpected;
- the head commit changed between approval and merge.

## Not hard stops (the loop handles them)

Never stop for these; they are the loop working normally:

- the reviewer requests changes → dispatch a fix on the same PR;
- OpenHands needs another fix round;
- CI fails because of a code defect, or needs another run;
- a task completes, a next task is generated, a PR is created, a PR merges;
- the normal transition from AI-00n to AI-00n+1.
