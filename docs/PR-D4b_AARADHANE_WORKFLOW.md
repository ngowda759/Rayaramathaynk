# PR-D4b — Aaradhane workflow re-point: guard, environment, concurrency

Status: **PROPOSAL ONLY.** Not implemented. No workflow dispatched or edited. No
production change. Production migration status remains **HOLD**.

Parent: `docs/AARADHANE_SUPABASE_CUTOVER_PLAN.md`. Depends on PR-D4a. Read
`docs/AARADHANE_CUTOVER_READINESS_REVIEW.md` first.

Scope: `.github/workflows/aaradhane.yml` only. This PR removes the Firestore write path
and points the job at the Supabase writer from PR-D4a, behind the canonical guard.

## 1. Objective

Make the scheduled Aaradhane job unable to write to any database without first proving
its destination is approved, and unable to write on a schedule at all until a human
enables it.

## 2. The current risk, stated precisely

`aaradhane.yml` has **no** `environment`, **no** `concurrency`, and **no** destination
guard. Its live step (`:254`) is:

```yaml
if: inputs.dry_run != 'true' && steps.check_panchanga.outputs.exists == 'true'
```

Two facts from the review that change the urgency and the ordering:

1. **The write is armed today.** `check_panchanga` (`:75`) sets `exists=true` only if
   `data/panchanga/<TARGET_YEAR>/` is already in the checkout, and that output is
   computed *before* the generate step that would create the directory. The target is
   `CURRENT_YEAR + 1`. As of 2026-10-22 that is **2027**, and `data/panchanga/2027/`
   exists (365 files) — so `exists=true` now, and any `workflow_dispatch` without
   `dry_run=true` reaches the live write step immediately.
2. **The cron's one protected tick is not protection.** `schedule` is `30 3 1 1 *`.
   On 2027-01-01 the target becomes 2028, whose panchanga is absent, so the live step is
   skipped and the dry-run step runs. Committing 2028 panchanga is routine, and the tick
   after that writes to production with no destination guard, no `environment` and no
   concurrency control.

So this PR is racing the next `workflow_dispatch` *and* the next panchanga commit for a
future year. There is no grace period. That is the ordering constraint that matters.

## 3. Required changes

### 3.1 Canonical guard, first

Add `node scripts/lib/guard-approved-supabase-url.mjs` (or the project-identity guard,
per the pattern the two Firestore migration workflows use) as the **first
database-touching statement**, before the writer step. Reuse the existing guard
implementation; do not create a second one. Destination validation must complete before
the first connection or write.

### 3.2 `environment: production`

Add it to the writing job, matching the five workflows that already carry it. **State
plainly in the PR body that this is a secret/deployment boundary and not an approval
gate** — the repository grants it no required reviewers, so it does not by itself
authorise a write.

### 3.3 `concurrency`

Add a group so two runs cannot interleave. A cron tick and a manual dispatch overlapping
is a realistic duplicate-write scenario.

### 3.4 Remove the Firestore write

- Remove the Firestore-writing step and the `FIREBASE_SERVICE_ACCOUNT` /
  `firebase-admin-key.json` materialisation.
- Remove the `updateFirestoreWithAdmin` import path from the invoked script.
- Add `scripts/generate-events-firestore.ts` to the B-1 removal inventory: it is a
  second Admin-SDK writer to `events` that no workflow currently invokes, so it will not
  show up in a workflow census.

### 3.5 Scheduled path must not write

Keep the `schedule` trigger, but make the scheduled path non-writing until a human
enables it. A `schedule` event carries empty `inputs.dry_run`, so the existing condition
cannot distinguish "scheduled" from "dispatched without the flag". Gate the write on an
explicit signal that only `workflow_dispatch` can supply.

### 3.6 Explicit apply

The live step must pass PR-D4a's `--apply`. A run that reaches the writer without it
writes nothing — belt and braces with §3.5.

### 3.7 Invocation consistency

The workflow uses `npx ts-node --project tsconfig.scripts.json` (`:251,269`); the npm
script uses `npx tsx`. Both are devDependencies. Preserve the existing invocation or
unify it deliberately and say which — do not leave the two silently divergent.

## 4. Acceptance criteria

**Guard ordering**
1. In the workflow text, the guard statement precedes the first database-touching
   statement. Asserted by `guardOrderingViolations` in the existing test helper, not by
   eye.
2. A run whose destination fails validation exits non-zero **before** any write. Assert
   with a stubbed client that records calls: the assertion is on *zero writes*, not on
   exit code.
3. The guard is the existing approved-project/approved-URL implementation — no new
   guard file is added.

**Schedule safety**
4. A `schedule`-event simulation cannot reach the writer. Assert zero writes.
5. A `workflow_dispatch` without the explicit apply signal cannot reach the writer.
   Assert zero writes.
6. Only an explicit, human-supplied signal plus `--apply` permits a write.

**Inventory completeness**
7. `tests/unit/workflow-writer-inventory.ts` enumerates this writer. The inventory
   currently excludes it because the writer is Firestore-only (`DB_SIGNALS` is
   Postgres-specific, `:553-560`); once it targets Supabase it must be listed, and the
   completeness test must fail if it is removed or loses its guard.
8. The test asserts the writer is present in `DB_WRITER_INVENTORY` — a writer silently
   dropping out of the inventory is a failure, not a pass.

**Hygiene**
9. `environment: production` present, and the PR body explicitly denies that it is
   authorisation.
10. `concurrency` present.
11. No `FIREBASE_SERVICE_ACCOUNT` or `firebase-admin-key.json` reference remains.
12. `node .ai/scripts/validate-workflows.mjs` exits 0.

## 5. Out of scope

No `events` `SELECT` policy. No reader change. No schema change. No Firestore
retirement. No `seva-maintenance` change. Nothing is dispatched or run.

## 6. Risks

1. **Removing the Firestore write before Supabase rows are confirmed** leaves the
   calendar empty. PR-D4a's golden-file test is the mitigation; do not merge D4b until
   D4a is merged and its parity test is green.
2. **Guard placement.** Putting the guard in a separate step before the writer is not
   sufficient if an earlier step touches a database. The ordering test must scan the
   whole job.
3. **`environment` false comfort.** The binding changes nothing without required
   reviewers; the PR must not imply otherwise.
4. **Silent schedule regression.** If the new scheduled path is mis-gated it could
   either write on schedule or never run; both need an explicit assertion.

## 7. Files expected to change

- `.github/workflows/aaradhane.yml`
- `tests/unit/workflow-writer-inventory.ts` — add this writer to `DB_WRITER_INVENTORY`
- `tests/unit/workflow-db-writer-guards.test.ts` — regression cases
- `docs/FIRESTORE_SUPABASE_MIGRATION_BACKLOG.md` — B-1 status

## 8. Dependencies

- **Depends on:** PR-D4a merged; owner approval that the Supabase rows are correct.
- **Blocks:** PR-D4c (a cutover cannot be verified before the writer exists).
- **Ordering constraint:** must land before the next `workflow_dispatch` and before the
  next panchanga commit for a future year — the write is armed today (review §5).
- **Does not depend on:** the `events` `SELECT` policy, unless the job reads back to
  verify its own write. If it does, that policy is a hard dependency and must be stated
  in the PR.

## 9. Owner decisions

1. Confirm the scheduled path is disabled-by-default until a manual first run.
2. Confirm `ts-node` stays, or approve the switch to `tsx`.
3. Confirm whether the job reads back to verify; if so, sequence the `SELECT` policy
   before this PR.
