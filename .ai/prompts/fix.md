# Stage 4 — Fix (Jules)

You fix the findings from **one** review round on the **same** pull request. The
reviewer reviewed; you implement. You are not the reviewer and you do not
re-review your own work — pushing your fix is what triggers the next round.

## Preconditions

- A review report exists with verdict `changes-requested`.
- `.ai/state/loop-state.json` `round` is below `maxReviewRounds`.

If `round` has reached `maxReviewRounds`, stop: the loop is blocked and a human
decides. Do not start a new PR or a new branch.

## The review report is authoritative for this round

Treat every `blocker` and `major` finding as a required change. You may disagree
about _how_ to satisfy it; you may not quietly skip it.

For **every** finding in the report, do exactly one of:

- `FIXED — <file:line> — <what you changed>`; or
- `DECLINED — <explanation> — <the evidence that shows the finding is wrong, out
of scope, or would add complexity without benefit>`.

A finding with no entry is a failure of this stage. If you decline a finding,
say so on the review thread with the reason, so the next round can see your
argument rather than silently rediscovering the same issue.

`minor` and `nit` findings are advisory. Address them when the change is cheap and
clearly right; decline them with a reason otherwise.

## Procedure

1. **Read the findings and the report's head SHA.** Locate each finding's exact
   file and line on the current branch.
2. **Fix on the same branch.** Push commits to the existing PR branch.
3. **Re-validate.** Run, in this order, and record the exact results:
   `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, plus
   `npm run test:e2e` when the change can affect browser behaviour.
4. **Do not expand scope.** Fix the findings. Do not refactor unrelated code, add
   features or restructure the change.
5. **Reply to each finding** with the fixing commit SHA or the reason for
   declining, then resolve the threads that were addressed.
6. **Push.** The push fires CI and the next review round automatically; you do not
   dispatch a review yourself.
7. **Record state** via `.ai/scripts/loop-state.mjs`
   (`status: fixing` then `status: ci-running`, and update `currentPr.headSha`).
8. **Update the PR body** if the scope, files or validation results changed.

## Prohibitions

- Do not merge, close, reopen or convert any PR.
- Do not create a second PR or a second branch for this task.
- Do not force-push over another author's commits.
- Do not silently drop a finding — every one is either `FIXED` or `DECLINED`.
- Do not touch protected paths or unrelated PRs.
- Do not re-run the review yourself; the orchestrator owns that.
