# Aaradhane cutover — implementation-readiness review of PR #360

Status: **read-only review, plus a record of what has since been implemented.** No
schema, credential or database change. Production migration status remains **HOLD**.

Reviewed: PR #360 (`docs/AARADHANE_SUPABASE_CUTOVER_PLAN.md`, head `bedaf908`, base `78454f5a`).

Verdict: **NOT READY as written.** The plan's direction is sound, but three of its
load-bearing specifics are contradicted by the repository. They are cheap to fix now
and expensive to discover mid-implementation. The plan must be corrected before PR-D4a
starts. Corrections are listed in §7 and were applied to the plan in this change.

## 0. What has since been implemented

The corrections below were applied to the plan, and the writer half (PR-D4a) plus the
containment half of PR-D4b are now implemented on this branch. Each correction maps to
shipped code:

| Correction | Where it landed |
|---|---|
| §2 — key is `${guru.id}-${year}`, no prefix, no phase suffix | `lib/aaradhane/supabase-writer.ts` (`canonicalEventId`); asserted in `supabase-writer.test.ts` |
| §4 — ownership cannot key on `auto_generated`/`year` (columns do not exist) | Ownership keys on the canonical key plus `category = "Aaradhane"`; provenance columns reported, not written |
| §5 — the write was armed today via dispatch, not by cron alone | The write is removed entirely: the credential step and every Firestore writer are deleted, and no step passes `--apply` |
| §3 — the reader surface is wider than stated | Re-enumerated in the plan's §3.8; no reader changed here |

Remaining work is the *enabling* half of PR-D4b (schema decision, the `--apply` step, a
`concurrency` group) and PR-D4c (reader cutover). Neither is started.

## 1. What the review checked

| # | Claim in the plan | Method | Result |
|---|---|---|---|
| 1 | Writer creates random IDs; updates use a heuristic | Read `lib/aaradhane/firestore-admin.ts` | **Confirmed** |
| 2 | `eventKey` is the only deterministic key, never persisted | Read `lib/aaradhane/generator.ts` | **Confirmed** |
| 3 | Proposed key `generated-<year>-<guruId>[-<phase>]` | Cross-check against shipped data and existing scripts | **CONTRADICTED — see §2** |
| 4 | "Admin/stats read `events` via the Firebase client SDK" | Read every `events` reader | **INCOMPLETE — see §3** |
| 5 | Ownership filter keys on `auto_generated` / `year` | Check those columns exist | **CONTRADICTED — no such columns — see §4** |
| 6 | Cron "writes by default" | Read the step conditions and the panchanga gate | **PARTLY RIGHT — mis-scoped. The write is armed *today* via dispatch — see §5** |
| 7 | Readers must be cut over separately | Enumerate the reader surface | **Confirmed, but wider than stated — see §3** |
| 8 | Retries reuse the batch-then-row-by-row pattern | Read `lib/supabase/migration-runner.ts` | **Confirmed** |

## 2. BLOCKER — the proposed ID form conflicts with the shipped convention

The plan proposes `firestore_id = generated-<year>-<guruId>`, with a phase suffix for
Sri Raghavendra. The repository already uses a different form, and it is already in
use:

`data/exports/supabase-events-2027.json` (19 rows, produced for
`npm run migrate:events-from-json`) contains:

```
madhvacharya-2027  padmanabha-teertha-2027  narahari-teertha-2027  …
raghavendra-poorva-2027  raghavendra-madhya-2027  raghavendra-uttara-2027
```

That is exactly `${guru.id}-${year}` — the existing `eventKey`
(`lib/aaradhane/generator.ts:211`), with **no prefix**.

Two consequences:

1. **The `generated-` prefix is invented.** `grep` finds no `generated-` identifier
   anywhere in `scripts/`, `lib/`, `app/`, `services/` or `data/`. Adopting it would
   make the scheduled writer disagree with `npm run migrate:events-from-json`, so the
   same logical event would land twice under two `firestore_id` values. That is a
   duplicate-row bug wearing the costume of idempotency.
2. **The phase suffix is unnecessary and would be wrong.** The three Raghavendra
   phases are already **separate guru records** with distinct IDs
   (`data/aaradhane/gurus.ts:311,327,343` — `raghavendra-poorva`, `raghavendra-madhya`,
   `raghavendra-uttara`). `${guru.id}-${year}` already disambiguates them. The plan's
   §3.1 "two phases collapse onto one row" risk is real *only* if the key omits
   `guru.id`; with `guru.id` present the collision cannot happen. Adding a suffix would
   produce `generated-2027-raghavendra-poorva-poorva`.

**Correction:** the key is `${guru.id}-${year}` — the `eventKey` as-is. No prefix, no
phase suffix. The plan's §3.1 has been rewritten.

## 3. BLOCKER — the reader surface is split four ways, and two branches are already broken

The plan says readers stay on "the Firebase client SDK". That is true for some readers
and false for others. There are **four** distinct reader populations:

| Population | Files | Client | Status today |
|---|---|---|---|
| **A — Firebase SDK, direct** | `app/admin/page.tsx:118,123`; `app/admin/content/page.tsx:89,90,119,168`; `app/admin/featured/page.tsx:144`; `app/api/public/stats/route.ts:38,44`; `services/dashboard.service.ts:21`; `services/daily-spiritual.service.ts:293,331` | Firebase `db` | Reads Firestore |
| **B — Supabase, via `event.service.ts`** | 15 files, incl. `app/admin/events/page.tsx`, `app/admin/events/[id]/edit/page.tsx`, `app/(public)/events/[id]/page.tsx`, `app/api/events/route.ts`, `components/events/EventGrid.tsx`, `services/search.service.ts` | Supabase **anon** | **Silently returns `[]`** |
| **C — Supabase, server-side, already correct** | `lib/ai/retrieval/events.ts` | `createAdminClient()` server-side, `createClient()` in browser (`:13-15`) | Reads Supabase `events` correctly |
| **D — not a reader** | `services/aaradhane.service.ts` | — | Correctly excludes `events` (`:183`) |

Population B is a **pre-existing latent bug**, and the plan does not account for it:

- `services/event.service.ts:2,4` builds its client from
  `lib/supabase/client.ts` → `createBrowserClient` with
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`lib/supabase/client.ts:36-39`).
- `events` has RLS enabled with a single deny-all policy
  (`supabase/migrations/20260907112632_create_core_tables.sql:81,98-102`:
  `FOR ALL TO public USING (false)`). No `SELECT` policy was ever added — `grep`
  across all migrations finds no other `events` policy.
- `getEvents()` swallows the failure and returns `[]` (`services/event.service.ts:42-52`).

So the admin events list and the public event detail page read **nothing** today, and
`POST /api/events` cannot write. The backlog already anticipated the fix — its RLS
table says `events` needs `SELECT` "required for Aaradhane cutover + public calendar" —
but that policy **does not exist**.

This matters to the plan because it changes the shape of PR-D4c: the reader cutover is
not "point the readers at Supabase", it is "add the `events` `SELECT` policy, then fix
the readers that are already pointed at Supabase and silently failing". Conflating the
two would let a broken reader look like a completed cutover.

**Population C is the counter-example that proves the point.** `lib/ai/retrieval/events.ts`
reads the same table, selects the same columns, and uses `createAdminClient()` on the
server (`:13-15`, `:22-29`) — and it works. Population B fails for exactly one reason:
it uses the anon key where the table denies all. The fix for B is therefore already
demonstrated in the repository; do not invent a new pattern.

Two existing entries in `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` bear
on this and should be updated rather than duplicated:

- **R-104** (HIGH, open) records the `date`/`active` field mismatch on
  `app/admin/content/page.tsx`. It is the same finding as §3.3 below; the review
  confirms it and PR-D4c should close it.
- **R-361** (HIGH, open) says "Raya AI answers event questions from Firestore while the
  admin events service writes Supabase `events`". The first half is **stale**:
  `lib/ai/retrieval/events.ts` contains no Firestore reference (`grep` count 0) and
  queries Supabase. The *divergence* it describes is real but is now between
  population A (Firestore) and populations B/C (Supabase), not between Raya and the
  admin service. R-361's premise needs correcting, not just its status.

**Reported, not fixed.** Fixing the policy, `event.service.ts`, R-104 or R-361 is
outside this task's scope (it would change application behaviour and RLS). PR-D4c owns
them.

## 4. BLOCKER — the ownership filter cannot be built as specified

The plan's §3.2 says the payload "must carry `auto_generated`/`year`" so the writer can
refuse to touch manually curated rows. Neither column exists.

The writer emits **19** fields (`lib/aaradhane/generator.ts:313-341`). The Supabase
`events` table has columns for **9** of them
(`supabase/migrations/20260907112632_create_core_tables.sql:53-70`):

```
doc field (snake_case)      destination column
start_date end_date         start_date end_date        (as timestamptz)
title description location  title description location
featured published category featured published category
image_url status            image_url status
------------------------------------------------------------
auto_generated              — NO COLUMN
year                        — NO COLUMN
guru  guru_name             — NO COLUMN
parampara_number            — NO COLUMN
raghavendra_phase           — NO COLUMN
lunar_calendar              — NO COLUMN
rituals  offerings          — NO COLUMN
significance                — NO COLUMN
```

The mapper agrees: `CORE_FIELD_SPECS.events`
(`lib/supabase/migration-mappers.ts:668-682`) lists 10 mapped and 4 transformed fields
and does not mention any of the ten above.

So the ownership filter has nothing to read. The plan must either (a) add the columns it
needs (`auto_generated`, `year`, and — see §6 — a provenance marker) in the same
migration that adds the `date` columns, or (b) derive ownership from the `firestore_id`
pattern alone. Option (b) is weaker: it cannot distinguish a generated row from a
hand-made row that happens to be named `<guru>-<year>`. The plan now states (a)
explicitly and lists the columns.

## 5. CORRECTION — the write is armed now, via dispatch; the cron's next fire is not

The plan stated the scheduled job writes by default. The truth is more exposed than
that in one direction and less in another.

The live step is gated on the panchanga step's output, evaluated **before** any
generation runs (`.github/workflows/aaradhane.yml:254`):

```yaml
if: inputs.dry_run != 'true' && steps.check_panchanga.outputs.exists == 'true'
```

`check_panchanga` (`:75`) sets `exists=true` only if `data/panchanga/<TARGET_YEAR>/`
already exists in the checkout. The generate step that would create the directory runs
only when `exists != 'true'`, *after* the output was computed, so it cannot flip it.

**The exposure today (2026-10-22).** `TARGET_YEAR = CURRENT_YEAR + 1 = 2027`, and
`data/panchanga/2027/` exists (365 files). So `exists=true` **right now**: any
`workflow_dispatch` without `dry_run=true` reaches the live write step immediately. The
write path is armed, not dormant.

**The cron's next fire.** `schedule` is `30 3 1 1 *` — 1 January only. On 2027-01-01 the
target becomes 2028, `data/panchanga/2028/` does not exist, so the live step is skipped
and the dry-run step runs. That is the one tick the gate protects. It is not a safety
property worth relying on: committing 2028 panchanga is routine, and the tick after that
writes to production.

**Why this changes the remediation.** The guard must land before the next
`workflow_dispatch` as well as before the next panchanga commit — i.e. there is no
"before next January" grace period. The plan's severity claim was right for the wrong
reason, and its ordering was therefore wrong. The plan now says this.

## 6. Additional findings

**6.1 Two generators, one output shape.** `lib/aaradhane/local-generator.ts:112` is the
alternative to `firestore-admin.ts` and also emits `date: startDate`. Both paths feed
`eventToFirestoreDocument`. PR-D4a must handle both or assert which one runs.

**6.1a A fourth reader already does this correctly.** `lib/ai/retrieval/events.ts` reads
Supabase `events` server-side via `createAdminClient()` (`:13-15,22-29`) and filters
`.eq("published", true)`. It is the working pattern for population B (§3) and the
authority for the `SELECT` predicate PR-D4c should adopt.

**6.2 A second, unwatched Firestore writer to `events`.** `scripts/generate-events-firestore.ts`
(344 lines) writes to the same collection via the Admin SDK. No workflow invokes it, so
it is outside PR-A2's scope, but it belongs in the B-1 inventory and PR-D4b's removal
checklist.

**6.3 `ts-node` vs `tsx`.** The workflow runs
`npx ts-node --project tsconfig.scripts.json` (`aaradhane.yml:251,269`); the npm script
runs `npx tsx` (`package.json`). Both are devDependencies. PR-D4b must either preserve
the existing invocation or unify it deliberately — the plan was silent.

**6.4 The existing exports are a ready-made acceptance oracle.** `data/exports/`
already holds `supabase-events-2026.json`, `supabase-events-2027.json` and
`supabase-events-all.json` (38 rows across 2026–2027), in the exact row shape PR-D4a
must produce. PR-D4a should assert against these as golden files rather than inventing
fixtures. Note their `start_date` values are UTC-midnight ISO strings
(`2026-03-28T00:00:00.000Z`) and several fields are the **strings** `"None"`/`"True"`/
`"False"` — a serialisation artefact the plan should not silently inherit.

**6.5 `environment: production` is a secret boundary, not an approval gate.** Nothing in
the repository grants it required reviewers. The plan already says this; the review
confirms it and PR-D4b must not treat the binding as authorisation.

**6.6 No test covers the Supabase `events` reader path.** `tests/unit/aaradhane/` covers
the generator, gurus and panchanga; nothing covers `event.service.ts`. PR-D4c needs
new tests, and the §3 bug is exactly the kind they would have caught.

## 7. Corrections applied to the plan

1. §3.1 — key is `${guru.id}-${year}`, no prefix, no phase suffix (§2 above).
2. §3.2 — ownership needs new columns; `auto_generated`/`year` do not exist (§4).
3. §2/§3.3 — the required `events` `SELECT` policy does not exist and is a PR-D4c
   dependency, not an assumption (§3).
4. §1 — the cron write is conditional on pre-committed panchanga, and the write is
   **armed today** via `workflow_dispatch` (§5).
5. §3.7 — PR-D4a should assert against `data/exports/*` as golden files (§6.4).
6. §3.6 — added the `generate-events-firestore.ts` removal to the B-1 checklist (§6.2).
7. §3.3/§4 — the reader surface has **four** populations, not two; `lib/ai/retrieval/events.ts`
   already reads Supabase server-side and is the pattern to copy (§3).

## 8. Dependencies between the phases

```
PR-D4a (writer, unwired)
   │  needs: corrected key form; new columns (auto_generated, year, start_on, end_on)
   │  does NOT need: the SELECT policy, the reader changes, or the workflow
   ▼
PR-D4b (workflow re-point)
   │  needs: PR-D4a merged AND the guard/`environment`/`concurrency` in place
   │  needs: the events SELECT policy ONLY IF the run reads back to verify
   │  MUST land before the next panchanga commit for a future year
   ▼
PR-D4c (reader cutover + Firestore retirement)
      needs: PR-D4b writing rows AND the events SELECT policy AND the date/active
             field reconciliation AND the event.service.ts bug fixed
      blocks: nothing; it may trail D4b, but Firestore must not be retired until
              every reader in §3 is verified against Supabase
```

The **live cron writer** is an input to PR-D4b's ordering, not to PR-D4a: the writer can
be built and tested while the cron is still writing to Firestore, because PR-D4a does
not wire itself into the workflow. The **admin-reader cutover** is entirely PR-D4c and
must not be bundled into D4b, or a schema/policy change would ride along with a workflow
change.

## 9. Acceptance criteria, at a glance

Detailed criteria are in the three proposal documents. The gates that decide "done":

- **D4a** — golden-file parity with `data/exports/supabase-events-*.json`; running the
  writer twice yields the same rows; a no-flag and a `--dry-run` run write nothing; the
  ownership filter rejects a non-generated row; no implicit delete.
- **D4b** — the canonical guard is the first database-touching statement; a
  `schedule` run cannot reach the writer; `environment: production` present and
  *declared not sufficient*; the workflow-completeness test enumerates this writer.
- **D4c** — the `events` `SELECT` policy exists and is minimal; `event.service.ts` no
  longer silently returns `[]`; the `date`/`active` readers are reconciled; every reader
  in §3 is verified; Firestore reads are gone only after that.

## 10. Owner decisions required

1. Confirm the key form `${guru.id}-${year}` (the review's recommendation) and retire
   the `generated-` proposal.
2. Approve the schema additions: `start_on`/`end_on date`, `auto_generated`, `year`.
3. Approve the `events` `SELECT` policy and its exact predicate (the backlog says
   `SELECT` for anon; confirm it should not be row-filtered by `published`).
4. Decide the `date`/`active` field question: add the columns, or fix the readers to
   use `start_date`/`published`. Today those queries match nothing in either store.
5. Decide whether the cron is disabled, or kept and made non-writing, until a manual
   first run is approved.
6. Sequence: confirm PR-D4b lands before the next panchanga commit for a future year.
