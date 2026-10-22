# Destructive authorization for the Seva monthly purge

Status: **proposal + minimal fail-closed implementation**. This document authorises
nothing. It records why the scheduled `seva-maintenance` purge is a separate
problem from "which database is the destination", and it specifies the explicit
authorization the purge needs before any deletion is allowed to run unattended.

Related: `docs/FIRESTORE_SUPABASE_MIGRATION_BACKLOG.md` (C-5, B-7),
`docs/SECURITY.md`.

---

## 1. What the purge does

`.github/workflows/seva-maintenance.yml` runs

```sql
select public.seva_purge_devotee_profiles();
```

which **DELETEs** devotee profiles not seen for three years. It is the only
destructive database operation in the repository's workflows, and it is the only
one with a `schedule:` trigger *and* a write.

## 2. Why the existing controls are not authorization

| Control | What it proves | Why it is not authorization to delete |
| --- | --- | --- |
| `scripts/lib/guard-approved-db-url.mjs` | The connection string resolves to the approved project. | It is a *destination* check. It cannot distinguish "an operator intends to purge" from "the cron fired at 03:00 on the 1st". |
| `environment: production` on the job | That the run is associated with an environment. | With `protection_rules: []` it pauses for nobody, and even with required reviewers it gates *whether the job starts*, not *whether deletion is intended*. A monthly cron that happens to satisfy the environment is still an unattended deletion. |
| `concurrency: seva-maintenance` | Two purges cannot overlap. | It prevents races, not unintended deletions. |
| The nightly encrypted backup | A recent copy exists. | It bounds the damage. It does not authorise the deletion. |

The conclusion the audit reached is that **the purge is a distinct destructive
authorization problem**. A destination guard and an environment binding are
necessary but not sufficient, and neither may be presented as sufficient.

## 3. Requirement

> Deletion must require an authorization that a scheduled execution structurally
> cannot supply.

"Structurally cannot supply" is the load-bearing phrase. A control that merely
*discourages* a scheduled run — a warning, a summary line, a default input value —
is bypassable because the schedule and the manual dispatch share the same code
path. The authorization must be a value that only a human-initiated
`workflow_dispatch` can carry.

## 4. Design: dispatch-only typed confirmation

Implemented in `.github/workflows/seva-maintenance.yml`:

1. A `workflow_dispatch` input `confirm_purge` (`required: false`, type string).
   A `schedule` event has no `inputs` context, so on a cron run the value is the
   empty string.
2. The purge step reads two values through `env:` — `CONFIRM_PURGE`
   (`inputs.confirm_purge`) and `EVENT_NAME` (`github.event_name`) — and:
   - exits **0** without deleting when `EVENT_NAME != workflow_dispatch`;
   - exits **1** without deleting when the phrase does not match exactly;
   - only then runs `psql`.
3. The phrase is compared as a quoted shell variable, never interpolated into the
   script text, so `$(...)`, backticks and `;` payloads cannot forge it and cannot
   execute. This mirrors the existing, behavioural-tested confirmation gates in
   `supabase-migrations.yml`, `ai-knowledge-migration-apply.yml` and
   `resolve-raya-ai-baseline.yml`.

Why this cannot be bypassed by a scheduled run: `github.event_name` is set by the
Actions runner, not by anything in the workflow file or the repository. A cron
event always reports `schedule`, so the first branch always fires. There is no
input value, repository variable, or secret that can make a scheduled run take the
purge branch.

Why this is better than disabling the cron outright: the schedule remains visible
in the Actions UI, so the operator keeps the monthly reminder that the purge
window has arrived. It now produces a no-op run with an explicit "No rows were
deleted" line instead of deleting unattended.

## 5. What is deliberately NOT done

- **The purge is not enabled, dispatched, or executed** by the PR that adds this
  design. The workflow's behaviour on a schedule changes from "deletes" to
  "deletes nothing"; the manual path is unchanged in effect and now additionally
  requires the phrase.
- **No `environment: production` is added** to this workflow. A reviewer gate on a
  monthly cron either stalls the schedule or, if configured to auto-approve,
  provides no real authorization. The dispatch-only typed phrase is the control.
- **No repository or environment settings are changed** through an API. Enabling
  required reviewers on `production`, and any future environment-level control, is
  an owner-only action in the GitHub UI (see §7).

## 6. Residual risk

| Risk | Assessment |
| --- | --- |
| An operator dispatches the workflow and types the phrase to delete data that should have been retained. | Accepted: this is the intended path, and it is now explicit and logged in the run's audit trail. The nightly backup provides recovery. |
| The purge function itself deletes more than intended. | Out of scope: the function is defined in SQL (`seva_purge_devotee_profiles()`), not in this repository's workflows. It is not changed here. |
| A future change reintroduces an unattended path (for example, defaulting `confirm_purge` to the phrase, or adding `|| true`). | Mitigated by `tests/unit/workflow-db-writer-guards.test.ts`, which asserts the purge step's condition names the phrase, that the phrase is not a default input, and that the workflow contains no environment binding claiming to authorise deletion. |
| The cron is removed and the monthly reminder is lost. | Accepted trade-off documented in §4; the reminder is retained as a no-op run. |

## 7. Owner-only configuration (not performed by this PR)

1. Confirm the exact phrase in the workflow matches the operator's intent before
   the first authorized purge.
2. Decide whether a second, independent control is wanted (for example, a
   protected environment with required reviewers used *in addition to* the typed
   phrase). If so, configure it in Settings > Environments; this repository's
   workflows must not claim it exists until it does.
3. Decide whether the cron should be removed entirely once the no-op reminder is
   no longer useful.

No production write, deletion, migration, schema change, RLS change, deployment,
workflow dispatch, or repository/environment settings change is performed by this
document or the workflow change it describes.
