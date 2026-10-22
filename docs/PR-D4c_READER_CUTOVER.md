# PR-D4c — Reader cutover: `events` SELECT policy, `event.service.ts` fix, field reconciliation

Status: **PROPOSAL ONLY.** Not implemented. No RLS, schema, code, credential or database
change. Production migration status remains **HOLD**.

Parent: `docs/AARADHANE_SUPABASE_CUTOVER_PLAN.md`. Depends on PR-D4b. Read
`docs/AARADHANE_CUTOVER_READINESS_REVIEW.md` §3 first — this PR is larger than the
parent plan assumed, because the reader surface is split three ways and one branch is
already broken.

Scope: readers only. No writer change, no workflow change.

## 1. Objective

Make every `events` reader read the same store, and retire the Firestore reads only once
that is true and verified. The parent plan treated this as "point the readers at
Supabase". It is not: one population is already pointed at Supabase and silently failing.

## 2. The four reader populations

| Population | Files | Reads today | After D4c |
|---|---|---|---|
| **A — Firebase SDK, direct** | `app/admin/page.tsx:118,123`; `app/admin/content/page.tsx:89,90,119,168`; `app/admin/featured/page.tsx:144`; `app/api/public/stats/route.ts:38,44`; `services/dashboard.service.ts:21`; `services/daily-spiritual.service.ts:293,331` | Firestore | Supabase |
| **B — Supabase via `event.service.ts`** | 15 files: `app/(public)/events/[id]/page.tsx`, `app/(public)/favorites/page.tsx`, `app/admin/assistant/page.tsx`, `app/admin/events/page.tsx`, `app/admin/events/[id]/edit/page.tsx`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `components/events/EventGrid.tsx`, `components/common/PersonalizedHomepage.tsx`, `components/admin/events/{EventForm,EventTable,DeleteEventDialog}.tsx`, `services/{quote,recommendation,search}.service.ts` | Supabase **anon** — **returns `[]`** | Supabase, working |
| **C — Supabase, server-side, correct** | `lib/ai/retrieval/events.ts` | Supabase via `createAdminClient()` (`:13-15,22-29`) | **unchanged — use as the pattern** |
| **D — not a reader** | `services/aaradhane.service.ts` | — | unchanged |

Population C is the reference implementation: it reads the same table with
`createAdminClient()` server-side and works. Population B is the broken variant of the
same query, using the anon key. Do not invent a new pattern for B — follow C.

Population B is a **live, user-facing defect** that predates this work:

- `services/event.service.ts:2,4` uses `createClient()` from `lib/supabase/client.ts`,
  which is `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (`lib/supabase/client.ts:36-39`).
- `events` has RLS enabled with a single deny-all policy
  (`20260907112632_create_core_tables.sql:81,98-102`), and no migration adds a `SELECT`
  policy.
- `getEvents()` catches the error and returns `[]` (`services/event.service.ts:42-52`).

Consequently `components/events/EventGrid.tsx:33-34` — which renders the public events
list — receives an empty array. `EventGrid` is mounted both by the public events page
(`app/(public)/events/page.tsx:5,22`) and by the **homepage** via
`components/home/HomeClient.tsx:5,56` → `components/home/UpcomingEvents.tsx:37`, so the
homepage's upcoming-events strip is affected too. The admin events table and the public
event detail page are affected as well.

**Verification caveat.** This is established from the migrations and the code in the
repository. It has **not** been confirmed against the live database, which this task is
forbidden to connect to. If the live database diverges from the migrations (for example,
a `SELECT` policy was added out of band), population B works and only the policy needs
to be captured in a migration. The first action of PR-D4c is therefore to **confirm the
live policy state from the Supabase dashboard**, not to assume either way. The backlog
already lists the requirement — its RLS table says `events` needs `SELECT` "required for
Aaradhane cutover + public calendar" — so the intent is not in doubt; only the current
state is.

## 3. Required changes

### 3.1 `events` SELECT policy

Add the minimal `SELECT` policy for the read path, in a reviewed migration. Decide and
state:

- **Predicate.** If the policy serves the public site, it must not expose unpublished or
  draft rows. `published = true` is the natural predicate; the parent plan's `date`/
  `active` idea does not apply (see §3.3). If it serves the admin list too, anon cannot
  satisfy both — the admin list needs an authenticated or server-side path, which is
  §3.2.
- **Role.** `anon` for the public read; `authenticated` if Firebase-authenticated admins
  are bridged. Do not grant `ALL`.

Note the backlog's parallel item: `seva_list_items` has RLS but no policy. Same class of
defect, different table; do not fix it here.

### 3.2 Route population B through a server-side client

`event.service.ts` currently runs in the browser with the anon key. Two options:

- **Option 1 — server route + service-role client.** Move reads behind
  `app/api/events/*` using `createAdminClient()` (`lib/supabase/admin.ts`), and have the
  client components fetch the route. Pros: keeps the table deny-all for anon; admin
  reads are authorised by the existing Firebase session guard on the route. Cons: the
  public list gains a server hop; the public list then needs the route to be genuinely
  public.
- **Option 2 — anon client + SELECT policy.** Keep `event.service.ts` client-side and
  rely on the §3.1 policy. Pros: minimal change. Cons: the admin list can no longer see
  unpublished rows; the policy must be tight enough that it does not leak drafts.

**Recommendation: Option 1 for the admin list, Option 2 for the public list.** The two
have different authorisation needs and forcing them through one client is what produced
this bug. State the split explicitly rather than picking one for both.

### 3.3 Reconcile the `date` / `active` queries

Three readers query fields that **no writer sets and the destination does not have**:

- `app/admin/page.tsx:123` and `app/admin/content/page.tsx:90` and
  `app/api/public/stats/route.ts:44`: `where("date", ">=", …)`.
- `app/admin/content/page.tsx:168`: `where("active", "==", false)`.

The Aaradhane writer emits `startDate`/`published`, not `date`/`active`
(`lib/aaradhane/generator.ts:313-341`); `active` is not in `TempleEvent`
(`types/event.ts`) and is not a column on Supabase `events`
(`20260907112632_create_core_tables.sql:53-70` — `active` exists on `sevas`, not
`events`). So these queries match nothing in either store today.

Pick one and apply it consistently:

- **Option A** — fix the readers to use `start_date`/`published`.
- **Option B** — add `date`/`active` as compatibility columns and have the writer
  populate them.

Option A is cleaner. Option B entrenches two names for one concept. Either way the
decision must be recorded, because leaving it undecided means the admin dashboard keeps
reporting zero upcoming events after the cutover and looks like a regression.

### 3.4 Retire the Firestore reads

Only after every file in population A and B is verified against Supabase:

- Remove the Firestore `events` reads listed in §2.
- Remove the `EVENTS_COLLECTION` constant in `services/aaradhane.service.ts:18` — it is
  declared and never used (dead), so it should not survive as a false lead.
- Confirm no `collection(db, "events")` remains.

## 4. Acceptance criteria

**Policy**
1. The live policy state is confirmed and recorded before any code change.
2. The new `SELECT` policy is minimal: no `ALL`, no draft/unpublished exposure to
   `anon`. Asserted by reading the migration text.
3. The policy is asserted to be *sufficient* for the intended role and *insufficient*
   for writes.

**Readers**
4. `getEvents()` no longer returns `[]` on a successful read. A regression test asserts a
   non-empty result for seeded rows — the test that would have caught the current bug.
5. Every file in population B is verified to read real rows.
6. Every file in population A reads Supabase, with no `collection(db, "events")` left.
7. The `date`/`active` decision is applied, and the admin "upcoming events" count is
   asserted to be non-zero against seeded data.

**Retirement**
8. Firestore `events` reads are gone only after 4–7 pass.
9. `EVENTS_COLLECTION` removed.
10. `npx jest tests/unit` passes; `tsc --noEmit` exits 0; lint has no new errors.
11. The public events list and the homepage featured event render seeded rows (manual
    check, screenshots in the PR).

## 5. Out of scope

No writer change. No workflow change. No `seva_list_items` policy. No other collection's
cutover. No production data movement.

## 6. Risks

1. **Cutting over readers onto an empty store.** If the policy is added but PR-D4b has
   not populated rows, the public list goes from "empty" to "empty" and the change looks
   like a no-op — or worse, an admin list that worked via Firestore breaks. Verify with
   seeded rows first.
2. **Broadening RLS to fix a reader.** The tempting fix is a permissive policy. That
   would expose draft events publicly. Keep the policy tight and use the server route for
   the admin list.
3. **Bundling a schema/RLS change with a workflow change.** Forbidden here: D4b is the
   workflow, D4c is the readers and policy. Keep them apart so each can be reviewed and
   reverted alone.
4. **The `date`/`active` mismatch being mistaken for a cutover regression.** It is
   pre-existing. Record it as such so the diff is not blamed for it.

## 7. Files expected to change

- `supabase/migrations/<ts>_events_select_policy.sql` — additive, reviewed
- `services/event.service.ts` — client choice, error handling
- `app/api/events/route.ts`, `app/api/events/[id]/route.ts` — server-side reads
- `components/events/EventGrid.tsx`, `components/common/PersonalizedHomepage.tsx` — data source
- `app/admin/page.tsx`, `app/admin/content/page.tsx`, `app/admin/featured/page.tsx`,
  `app/api/public/stats/route.ts`, `services/dashboard.service.ts`,
  `services/daily-spiritual.service.ts` — population A
- `services/aaradhane.service.ts` — remove the dead constant
- `docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md` — close **R-104** (the
  `date`/`active` mismatch) and correct **R-361**, whose "Raya AI answers from Firestore"
  premise is stale (`lib/ai/retrieval/events.ts` queries Supabase and contains no
  Firestore reference). Do not add a duplicate entry for either finding.
- `tests/unit/` — new reader tests
- `docs/DATA-MODEL.md`, `docs/FIRESTORE_SUPABASE_MIGRATION_BACKLOG.md`

## 8. Dependencies

- **Depends on:** PR-D4b merged and writing rows; the live policy state confirmed; owner
  decisions in §9.
- **Blocks:** nothing, but **Firestore must not be retired until every reader is
  verified**.
- **Must not be bundled with** PR-D4a or PR-D4b.

## 9. Owner decisions

1. Confirm the live `events` RLS state (the one fact this review could not verify).
2. Approve the policy predicate and role, and confirm drafts must not be public.
3. Choose the population-B split: server route for admin, anon+policy for public.
4. Choose the `date`/`active` reconciliation (Option A recommended).
