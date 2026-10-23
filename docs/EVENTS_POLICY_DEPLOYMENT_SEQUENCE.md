# `events` public-read policy — deployment sequence

Status: **analysis + recommendation. Nothing here is executed.** The policy migration
(`supabase/migrations/20261105000000_events_public_select_policy.sql`) is prepared and
**unapplied**; applying it is an owner action through the gated `supabase-migrations.yml`
dispatch.

Related: `docs/PR-D4c_READER_CUTOVER.md` §3.1/§3.2, `docs/AARADHANE_CUTOVER_READINESS_REVIEW.md`
§3, `tests/unit/aaradhane/events-select-policy.test.ts`.

---

## 1. The question

The public events list and the homepage strip read Supabase `events` **from the browser
with the anon key** (`services/event.service.ts:2,4` → `lib/supabase/client.ts`
`createBrowserClient`). `events` carries a single `FOR ALL TO public USING (false)`
policy (`20260907112632_create_core_tables.sql:98-102`). So today the anon read is denied,
and `getEvents()` surfaces the failure instead of masking it
(`services/event.service.ts:60-71`).

Merging the policy migration into `main` does not apply it — migrations apply only when
an operator dispatches `supabase-migrations.yml`. The question this document answers is:
**in what order must the policy and the code land so the public page is never broken?**

## 2. Why the policy is sufficient without a `GRANT`

RLS and table privileges are two independent gates: a permissive policy still returns
nothing if the role lacks `SELECT` on the table, and a table grant still returns nothing
if RLS denies the row.

- Supabase grants the `anon` and `authenticated` roles table privileges on tables in the
  `public` schema by default. `events` is **never `REVOKE`d** — `grep REVOKE` across
  `supabase/migrations/` finds only the `seva_*` tables
  (`20261020000000_seva_core.sql:678-690`), which is why those tables need no policy to
  stay closed.
- The working precedent is in the repository: `site_settings` and `temple_areas` are read
  from the browser with the anon key and are gated by a permissive policy alone
  (`20261010000000_create_settings.sql:57`,
  `20240523000000_create_temple_areas.sql:32`), with no accompanying `GRANT`.

So the policy is the only missing piece for `events`, and it needs no `GRANT` statement.
This is asserted (the migration contains no `GRANT`) by
`tests/unit/aaradhane/events-select-policy.test.ts`.

**Not verified here:** that the deployed project's actual default privileges match this
reasoning. The reasoning is from the migrations, and the default-privilege assumption is
standard for Supabase but is not observable from this sandbox. It is a pre-flight check in
§5, not an assumption to skip.

## 3. The two populations and their timing

| Population | Readers | Client | Needs the policy? |
|---|---|---|---|
| Public list + homepage | `app/(public)/events/page.tsx`, `components/events/EventGrid.tsx`, `components/home/UpcomingEvents.tsx`, `services/quote.service.ts`, `services/search.service.ts` | anon (`createClient`) | **Yes** — `published = true` rows |
| Admin list + edit | `app/admin/events/page.tsx`, `app/admin/events/[id]/edit/page.tsx`, `app/admin/assistant/page.tsx` | anon today | Needs **unpublished** rows too, which the policy must not expose |

The policy grants `SELECT ... USING (published = true)`. That is correct for the public
readers and *insufficient* for the admin readers, which must see drafts. That split is
PR-D4c §3.2's decision (route the admin readers through a service-role route). **PR #360
does not re-route the admin readers** — it is the writer/reader-fix PR, not the admin
re-route. Therefore, until PR-D4c's admin re-route lands:

- the public page works once the policy is applied;
- the **admin** events list also uses the anon client, so it will show published rows
  only. This is not a regression — with the deny-all policy it currently throws a read
  error and shows nothing — but it is a residual limitation: drafts are invisible to the
  admin until the re-route lands.

That limitation, not a regression, is why §4 gates the merge on the policy and why PR-D4c
must close the admin path.

## 4. Recommended sequence — apply the policy **before** the merge

The decisive fact is that **merging this PR deploys it.** A push to `main` reaches
production with no in-repo approval gate, and the policy is applied by a separate,
owner-triggered action. So the two halves can never land "together in one release": the
code ships the instant the PR is merged, and the policy does not ship with it.

**Which mechanism performs the deploy.** Two paths exist and only one is live:

- `.github/workflows/deploy.yml` contains `vercel deploy --prebuilt --prod` and has no
  `environment:` gate, but it is **disabled** (`state: disabled_manually`) and its last run
  was 2026-07-13. It is therefore *not* what deploys today.
- **The live deployer is Vercel's own Git integration.** On the merge commit it created a
  `Production` deployment (`vercel[bot]`, environment `Production`, 2026-10-23T10:27:40Z,
  ~2.5 minutes after the merge), with no GitHub-side gate at all.

Both paths have the same property that matters here — **there is no in-repo approval gate
on a production deploy** — so the ordering rule holds regardless of which one runs. Do not
read "deploy.yml has no `environment:`" as the proof: the proof is that *no* configured
path gates the deploy, and the live path is not even in the repository.

Meanwhile the policy is applied only by a manual `workflow_dispatch`
(`supabase-migrations.yml`). Note that this is the *documented* path, and on 2026-10-23 it
was not the path that actually applied the policy — see the closing note.

That inverts the naive order. The correct sequence is:

1. **Apply the policy first** — dispatch `supabase-migrations.yml` with the confirmation
   phrase. This is safe with the *pre-merge* code live: the policy only grants anon
   `SELECT` on `published = true` rows, and the pre-merge `getEvents()` returned `[]` on
   the denial, so the worst case is that the currently-blank public list starts showing
   published events. It cannot break anything that works today.
2. **Verify, read-only** (§5), that the policy exists and that a published row is readable
   while an unpublished one is not.
3. **Then merge PR #360.** The push to `main` deploys the reader code to production with
   the policy already present, so the public events page and the homepage strip work
   immediately.
4. **Then** PR-D4c's admin re-route, so the admin list can see drafts again.

**Do not merge before step 1.** Merging first deploys `EventReadError` while `events` is
still deny-all, so the public events list and the homepage upcoming-events strip render an
error state instead of events — a production regression, caused by the deploy-on-merge
coupling, not by the code.

If the owner wants the `guruParampara` guard (which has no policy dependency) in
production before the policy work is scheduled, the safe split is to **merge that part
alone** — but that requires unbundling it from the reader change, which is a PR-scope
decision, not something this branch can do by itself. Absent that split, the whole PR is
gated on step 1.

**Do not** apply the policy and then leave the admin list un-migrated indefinitely: the
draft-invisibility limitation in §3 is real and PR-D4c owns closing it. If the admin list
must show drafts promptly, deploy the admin re-route (PR-D4c §3.2) in the same release as
the policy.

## 5. Pre-flight and post-apply verification (read-only)

Before applying:

- Confirm the live policy state: `select polname, cmd, roles, qual from pg_policies
  where tablename = 'events';` — expect exactly the deny-all policy and no `SELECT` policy.
- Confirm the default privilege assumption from §2:
  `select grantee, privilege_type from information_schema.role_table_grants
  where table_name = 'events' and grantee in ('anon','authenticated');` — expect `SELECT`.

After applying:

- Re-run the `pg_policies` query: expect the new `Allow public read of published events`
  policy alongside the deny-all one, and confirm it is `cmd = SELECT` and `qual` contains
  `published = true`.
- From the browser session (or `curl` with the anon key against the REST endpoint),
  confirm a published row is returned and an unpublished one is not.

None of these run in CI or in this PR; they are the owner's gate.

## 6. What would break, and the guard

- **Merging before the policy** → the push to `main` ships the reader to production while
  `events` is deny-all, so the public events list and homepage strip show an error state.
  **This is the one order that breaks production**, and it is the order a plain "merge when
  CI is green" would take. §4's step 1 exists to prevent it.
- **Applying the policy first** → no break; the policy is additive and the pre-merge reader
  already tolerated the denial.
- **Policy too broad** (e.g. `USING (true)`) → drafts leak. The policy text is asserted by
  `events-select-policy.test.ts` (`USING (published = true)`, no `USING (true)`, `SELECT`
  only, `TO anon, authenticated`).
- **Policy applied by a non-gated path** → the same test asserts no other workflow
  references the migration file, so only the manual dispatch can apply it.

## 7. Owner actions (GitHub/Supabase configuration, not code)

1. Dispatch `supabase-migrations.yml` with the confirmation phrase to apply the policy,
   after reviewing the SQL. This is the supported way to apply it, and it must happen
   **before** the merge.
2. Ensure the `production` environment has required reviewers if the dispatch is to be
   reviewer-gated. **As of 2026-10-23 the `Production` environment has
   `protection_rules: []`, so it pauses for nobody.** This is an owner-only setting
   (Settings > Environments).
3. Decide whether the admin draft-invisibility limitation (§3) is acceptable until PR-D4c,
   or whether the admin re-route must ship with the policy.
4. Note for the merge decision: because no configured path gates a production deploy,
   **merging is deploying**. If the owner wants a deploy gate rather than a policy-first
   ordering, that is a repository/Vercel change (enable `deploy.yml` with
   `environment: production` + required reviewers, or gate the Vercel Git integration),
   which this document deliberately does not make.

## 8. Observed outcome of the 2026-10-23 merge (recorded, not assumed)

PR #360 was merged **before** this sequence was followed, so the record is worth keeping
straight rather than claiming the plan held.

| Time (UTC, 2026-10-23) | Event |
| --- | --- |
| 05:56 | `4a1f109f` adds the policy migration **to the branch**, not `main` |
| 10:24:53 | PR #360 merged into `main` (`ce266e7c`) |
| 10:25:13 | `pages build and deployment` check starts (this is the `deploy` check-run on the merge commit — it is GitHub Pages, not Vercel) |
| 10:27:40 | Vercel `Production` deployment of `ce266e7c` by `vercel[bot]` — **reader code live** |
| 10:30:07 | `supabase-migrations.yml` dispatched manually (`run 39939546372`) |
| 10:31:20 | That run reports **"Remote database is up to date"** — it applied nothing |

Two conclusions:

1. **The policy was not applied by that dispatch.** The `supabase migration list` output
   from the run already shows `20261105000000` in *both* the LOCAL and REMOTE columns
   before the `db push` step, and `db push` then found nothing to do. Whatever applied the
   policy, it was not the documented dispatch — most plausibly the Supabase GitHub
   integration's own preview/deploy hook, which is outside this repository and cannot be
   audited from the YAML. **Do not treat "the dispatch succeeded" as evidence the policy
   was applied by the dispatch.**
2. **There was a real window (≈10:27:40 → policy live) in which the reader code was live
   and the policy was not.** The public events page survived it: a read-only check of
   production `rayaramathaynk.vercel.app/events` renders real published events, so the
   window closed without a user-visible error. That is luck of timing, not the plan
   working. The next cutover must apply the policy *first* and verify it before merging.

The residual limitation in §3 (drafts invisible to the admin list) is **live** and is
PR-D4c's to close.
