# PR-D4a — Aaradhane writer: deterministic keys, idempotent upsert, explicit apply

Status: **IMPLEMENTED on this branch** (code + tests). Not enabled in the workflow.
Production migration status remains **HOLD**.

Parent: `docs/AARADHANE_SUPABASE_CUTOVER_PLAN.md`. Read
`docs/AARADHANE_CUTOVER_READINESS_REVIEW.md` first — it corrects three specifics that
this proposal depends on.

Scope: the **writer only**. This PR does **not** enable the Supabase writer in the
workflow and does not add the `events` `SELECT` policy.

### Implementation record

| File | Change |
|---|---|
| `lib/aaradhane/supabase-writer.ts` | **New.** The Supabase/PostgreSQL writer: canonical key, ownership filter, batch upsert on `firestore_id` with per-row fallback, explicit `apply`, provenance-column reporting |
| `lib/aaradhane/generator.ts` | Firestore removed: `generateAaradhanaeEvents` now takes guru records as an argument and returns events; `eventToFirestoreDocument` deleted |
| `scripts/generate-aaradhane.ts` | Firestore write and `--firestore`/`--seed` paths removed; writes to Supabase via the new writer; writing requires `--apply` |
| `lib/aaradhane/firestore{,-admin,-rest,-source}.ts` | **Deleted** (the writer being replaced, plus three unreferenced modules) |
| `scripts/generate-events-firestore.ts`, `scripts/import-events.ts`, `scripts/seed-guru-parampara.ts`, `scripts/seed-guru-to-firestore.ts` | **Deleted** (further Firestore writers to the same collection) |
| `tests/unit/aaradhane/supabase-writer.test.ts` | **New.** 20 tests: key, status, mapping, ownership, plan-only, upsert, retry |
| `tests/unit/aaradhane/firestore-write-retirement.test.ts` | **New.** 6 tests pinning the absence of every Firestore write path |

Two deliberate deviations from the proposal as written:

- **Provenance columns are not written.** `auto_generated`, `year`, `guru`,
  `parampara_number`, `raghavendra_phase`, `lunar_calendar`, `rituals`, `offerings` and
  `significance` have no destination column yet. They are dropped by default and
  reported by `unmappedFields()` on every run, rather than silently discarded. Writing
  them requires the schema change in §3.2 of the parent plan, which stays on hold.
- **`--dry-run` is retained as an accepted no-op.** It cannot cause a write, and
  `--apply --dry-run` is refused rather than resolved.

## 1. Objective

Give the Aaradhane event writer a deterministic key and an idempotent Supabase upsert,
and make writing an explicit opt-in. Success is measured by golden-file parity with the
rows the repository already ships, and by re-running being a no-op.

## 2. What already exists (reuse, do not rebuild)

| Existing thing | Where | How it is used here |
|---|---|---|
| `eventKey` = `` `${guru.id}-${year}` `` | `lib/aaradhane/generator.ts:211` | **The key.** Already the shipped `firestore_id` form |
| Golden rows, 38 across 2026–2027 | `data/exports/supabase-events-{2026,2027,all}.json` | Acceptance oracle |
| Batch-then-row-by-row retry | `lib/supabase/migration-runner.ts:142,150-154` | Retry shape to copy |
| Upsert precedent | `scripts/migrate-events-to-supabase-from-json.ts:28-30` | `onConflict: "firestore_id"` |
| Event mapper | `lib/supabase/migration-mappers.ts:mapEvent`, `CORE_FIELD_SPECS.events:668` | Column mapping reference |
| `events` table | `20260907112632_create_core_tables.sql:53-70` | Destination |

## 3. Required changes

### 3.1 The key

Use the `eventKey` **as-is**: `firestore_id = ${guru.id}-${year}`.

- No `generated-` prefix. The prefix appears nowhere in the repository; adopting it
  would duplicate every row relative to `npm run migrate:events-from-json`.
- No phase suffix. The three Raghavendra phases are separate guru IDs
  (`raghavendra-poorva`/`-madhya`/`-uttara`, `data/aaradhane/gurus.ts:311,327,343`), so
  `guru.id` already disambiguates them.

### 3.2 Idempotent upsert

`upsert(rows, { onConflict: "firestore_id" })`, batch first, row-by-row on failure,
accumulating per-row failures exactly as `migration-runner.ts` does. Re-running the same
year must produce zero new rows and zero changed rows.

### 3.3 Ownership filter

Refuse to write a row whose `firestore_id` is not `${guru.id}-${year}` for a guru in the
generator's own list. This is a **code-level** check against the generated set, not a
database flag, because the columns a flag would need do not exist yet (§4). Add the
columns in the same migration as the date columns; until then, the filter is enforced in
the writer.

Never delete. A re-run must not remove rows absent from its batch, even if the expected
set shrank. Stale-row cleanup, if ever needed, is a separate explicitly authorised step.

### 3.4 Dates

Aaradhane dates are Indian civil dates.

- Write `start_on` / `end_on` as `date`, from the panchanga `YYYY-MM-DD` string, with no
  `Date` round-trip.
- Keep `start_date` / `end_date` `timestamptz` populated for compatibility with
  `mapEvent` and `services/event.service.ts`, but treat them as derived.
- Derive the target year in `Asia/Kolkata`. `scripts/generate-aaradhane.ts:27` already
  pins the process TZ; do not rely on that alone.

### 3.5 Explicit apply

Today, no flag means write. Invert it:

- Writing requires an explicit `--apply`.
- `--dry-run` and no-flag both compute, report, and write nothing.
- Keep `--dry-run` accepted for compatibility.

### 3.6 Both generators

`lib/aaradhane/firestore-admin.ts` and `lib/aaradhane/local-generator.ts:112` both emit
`date: startDate`. The new path must handle both or assert which one runs, and must not
leave a second writer with the old semantics.

### 3.7 Retries

Bounded retry with backoff for transient errors only; reuse the batch-then-row-by-row
shape. Fail the run loudly when a non-empty expected set produced zero rows.

## 4. Schema dependency

This PR **requires** a migration adding:

| Column | Type | Why |
|---|---|---|
| `start_on` | `date` | Correct civil-date storage |
| `end_on` | `date` | Correct civil-date storage |
| `auto_generated` | `boolean` | Ownership provenance |
| `year` | `integer` | Ownership provenance, and the key's year |

The 19 emitted fields map to only 9 existing columns; `auto_generated`, `year`, `guru`,
`guru_name`, `parampara_number`, `raghavendra_phase`, `lunar_calendar`, `rituals`,
`offerings` and `significance` have no destination column at all. Decide per field:
store it, drop it deliberately, or park it in a `jsonb` column. Do not let them vanish
silently.

The migration is additive and nullable; it is reviewed separately from the writer and
must not be bundled with any RLS change.

## 5. Acceptance criteria

**Correctness**
1. Every row for 2026 and 2027 matches `data/exports/supabase-events-2026.json` /
   `-2027.json` on `firestore_id`, `title`, `start_on`, `end_on`, `category`, `status`,
   `published`, `featured`.
2. `firestore_id` values are exactly the 38 in `supabase-events-all.json`. No
   `generated-` prefix. The three Raghavendra rows are `raghavendra-poorva-2027`,
   `raghavendra-madhya-2027`, `raghavendra-uttara-2027`.
3. Running the writer twice for the same year: second run reports 0 inserts, 0 updates.

**Safety**
4. A no-flag run writes nothing. A `--dry-run` run writes nothing. Both are asserted
   with a stubbed client that records calls, and the assertion is on *zero writes*, not
   on exit code.
5. A row whose `firestore_id` is not in the generated set is rejected, and the rejection
   is asserted.
6. A re-run with a shrunken expected set deletes nothing.

**Dates**
7. `start_on` equals the panchanga civil date string, for a case whose UTC rendering
   would differ, and the assertion does not depend on the machine TZ.

**Failure handling**
8. A batch failure falls back to row-by-row; a persistent row failure is reported per
   row, not swallowed.
9. A non-empty expected set producing zero rows fails the run.

**Regression**
10. `npx jest tests/unit` passes; `tsc --noEmit` exits 0; lint has no new errors.
11. The existing `tests/unit/aaradhane/{generator,gurus,panchanga}.test.ts` still pass,
    and `--dry-run`'s existing output is unchanged for callers that use it.

## 6. Out of scope

No workflow edit. No `events` `SELECT` policy. No reader change. No RLS, credential or
production change. No change to `services/event.service.ts` (PR-D4c owns its bug). No
Firestore removal.

## 7. Risks

1. **Silent field loss.** Ten emitted fields have no column; without an explicit
   decision they disappear and the loss is invisible.
2. **String artefacts.** The shipped exports contain the strings `"None"`/`"True"`/
   `"False"` in `start_time`, `image_url`, `featured`, `published`. Golden-file parity
   must assert the *intended* values, not reproduce that artefact.
3. **Two generators drifting.** Handling only one leaves the other writing the old way.
4. **`--apply` inversion breaking a caller.** Enumerate callers first: `package.json`
   `generate:aaradhane`, the workflow, and two console hints in
   `scripts/seed-guru-to-firestore.ts:349` and `scripts/seed-guru-parampara.ts:400`.

## 8. Files expected to change

- `lib/aaradhane/` — new Supabase writer module; `firestore-admin.ts` and
  `local-generator.ts` aligned or explicitly fenced.
- `scripts/generate-aaradhane.ts` — `--apply`, keep `--dry-run`.
- `supabase/migrations/<ts>_events_civil_dates_and_provenance.sql` — additive.
- `lib/supabase/migration-mappers.ts` — extend `CORE_FIELD_SPECS.events`.
- `tests/unit/aaradhane/` — new writer tests, including the golden-file test.
- `docs/AARADHANE_GENERATOR.md` — document the new flag and key.

## 9. Dependencies

- **Depends on:** owner approval of the key form and the schema additions (§10 of the
  review).
- **Blocks:** PR-D4b.
- **Does not depend on:** the live cron, the reader cutover, or the `events` `SELECT`
  policy.

## 10. Owner decisions

1. Confirm `${guru.id}-${year}` and retire the `generated-` form.
2. Approve the four columns, and the per-field decision for the other six.
3. Approve inverting the default to require `--apply`.
