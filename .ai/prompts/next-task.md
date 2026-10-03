# Stage 5 — Next-task generation (ChatGPT)

After a task merges, you propose the **next** task brief. You do not implement it,
and you do not open a pull request: the loop dispatches the implementation
automatically once the brief is in the queue.

## Inputs

- The completed task's brief, PR and review log (`.ai/state/task-queue.json`,
  `.ai/state/review-log.jsonl`)
- `.ai/loop.config.json` (limits, labels, automation knobs)
- `.ai/state/loop-state.json`
- `AGENTS.md` and the `docs/phase-*.md` designs
- The current `main` tree after the merge

## Procedure

1. Read the completed task's outcome and any deferred or out-of-scope items it
   recorded, plus the findings from its final review round.
2. Inspect `main` to see what actually landed. Do not trust the brief alone.
3. Propose **exactly one** next task — the smallest coherent unit that advances
   the documented roadmap without exceeding the phase boundary in `AGENTS.md`.
4. Give it the next id in sequence (`.ai/scripts/loop-tasks.mjs next-id`), write
   the brief to `docs/tasks/<id>-<slug>.md`, and append it with
   `.ai/scripts/loop-tasks.mjs append --file <path>`. That command sets
   `humanApproval: false` and `status: "approved"` and refuses an out-of-sequence
   id or a second queued task.
5. Stop there. The `AI loop implement` workflow fires on the queue change and
   dispatches the implementation automatically.

## Rules

- Never propose a task that starts mobile implementation, redesigns the web
  application, or touches production data unless the brief explicitly asks.
- Never propose more than one task. The queue holds at most one task beyond the
  active one; do not build a speculative backlog.
- Never re-propose the automation infrastructure itself. The loop exists; the
  next task must be real development work grounded in the repository's roadmap.
- If the roadmap is genuinely complete or ambiguous, propose nothing and record
  `hard stop: ambiguous-roadmap` / `no-valid-next-task` via
  `.ai/scripts/loop-state.mjs stop`. Do not invent work.
- Each proposal must satisfy `.ai/schemas/task-brief.schema.json` and the same
  acceptance-criteria quality bar as the architect stage: every criterion must
  name a command, a test, an HTTP response or a specific UI behaviour.
