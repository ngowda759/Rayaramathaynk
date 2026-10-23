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

That limitation, not a regression, is why the sequence below still deploys policy and
code together, and why PR-D4c must close the admin path.

## 4. Recommended sequence

**Deploy the policy and the reader code as one release, policy first.** Concretely:

1. **Merge the reader code** (`services/event.service.ts` surfacing the error,
   `EventGrid` error state, the admin edit page rethrow) into `main`. On its own this
   changes an empty grid into a visible error — a *worse-looking but more honest* page
   while the policy is absent. Acceptable only if step 2 follows in the same release.
2. **Apply the policy migration** via the gated dispatch (`supabase-migrations.yml`), so
   the `events` `SELECT` policy exists before the new code serves traffic. Applying it
   before the code is harmless: an unused permissive read policy changes nothing for a
   reader that already fails closed.
3. **Verify** with the read-only checks in §5.

Order matters in exactly one direction: **policy before code is safe; code before policy
is a window of visible errors on the public events page.** If a single atomic release is
not possible, apply the policy first and deploy code second.

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

- **Applying without the code** → no change; the policy is additive.
- **Code without the policy** → public events page shows the surfaced read error until the
  policy lands. This is why §4 pairs them.
- **Policy too broad** (e.g. `USING (true)`) → drafts leak. The policy text is asserted by
  `events-select-policy.test.ts` (`USING (published = true)`, no `USING (true)`, `SELECT`
  only, `TO anon, authenticated`).
- **Policy applied by a non-gated path** → the same test asserts no other workflow
  references the migration file, so only the manual dispatch can apply it.

## 7. Owner actions (GitHub/Supabase configuration, not code)

1. Dispatch `supabase-migrations.yml` with the confirmation phrase to apply the policy,
   after reviewing the SQL. This is the only supported way to apply it.
2. Ensure the `production` environment has required reviewers if the dispatch is to be
   reviewer-gated; the workflow's own header states the environment currently carries no
   protection rules.
3. Decide whether the admin draft-invisibility limitation (§3) is acceptable until PR-D4c,
   or whether the admin re-route must ship with the policy.
