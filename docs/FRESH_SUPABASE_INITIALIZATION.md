# Fresh Supabase Initialization

This document describes how the application's starter dataset is created in Supabase
PostgreSQL, and the separately approved procedure required to initialize **production**.

It is the document referenced by `scripts/seed-fresh-supabase.ts`. Schema deployment and
data initialization are two different operations with two different approval paths.

> Schema migration ≠ data initialization.
> Schema deployment (tables, policies, functions) happens first, through the guarded
> `Deploy Supabase Migrations` workflow. Data initialization creates the starter rows
> afterwards. Neither operation is performed by a pull request.

## What initialization creates

`scripts/seed-fresh-supabase.ts` runs the plan in `lib/supabase/seed-data/plan.ts`. It
creates the starter rows for every in-scope application module:

| Table | Rows | Conflict key |
|-------|------|--------------|
| `site_settings` | 1 | `firestore_id` |
| `social_links` | 1 | `firestore_id` |
| `announcements` | 1 | `firestore_id` |
| `daily_poojas` | 13 | `firestore_id` |
| `donation_campaigns` | 1 | `firestore_id` |
| `gallery_albums` | 1 | `firestore_id` |
| `gallery_media` | 7 | `firestore_id` |
| `temple_areas` | 2 | `id` |
| `quotes` | 33 | `slug` |
| `settings_documents` | 9 | `document_key` |
| `page_views`, `daily_page_stats`, `intent_metrics`, `intent_feedback`, `chat_metrics` | 0 (table only) | — |

`testimonials`, `members` and `volunteers` are created by the migrations but deliberately
seeded with **no rows**: the plan carries no fabricated testimonials or member records.

The nine `settings_documents` keys are `aboutUs`, `ekadashiCalendar`, `facilities`,
`festivalCalendar`, `footer`, `futurePlans`, `homepage`, `poojaSchedule` and
`trustCommittee`.

### Properties the plan guarantees

- **Repeatable and conflict-safe.** A content table is seeded only when it is **empty**;
  `settings_documents` inserts each row with `ON CONFLICT (document_key) DO NOTHING`.
  Either way a second run inserts `+0` rows.
- **Never duplicates owner content.** A table that already holds rows — including a
  project that previously imported its own content under different identifiers — is left
  exactly as it is. The starter rows are added only to genuinely empty tables, so a re-run
  can never create a parallel copy next to real data.
- **Dependent rows never orphan.** `gallery_media` rows carry `album_id =
  'seed-gallery-album-temple'`, an identifier only this plan inserts. The media operation
  declares `dependsOn: "gallery_albums"` and runs only when the album seed ran in the same
  pass, so when a project already owns albums the media is left untouched rather than
  inserted as orphans pointing at an album that does not exist.
- **Administrator edits are preserved.** Because the plan never updates an existing row,
  an owner's edit to a seeded row survives every later run untouched.
- **No legacy artifacts.** The plan imports no Firestore client and needs no Firebase
  credentials, no Firestore export and no network access.
- **No fabricated facts.** Verified temple identity comes only from in-repo sources
  (`website-settings/temple.json`, `data/shlokas.ts`, `seed/ai/*.json`). Any value the
  owner has not yet confirmed is prefixed `PLACEHOLDER - ` and left blank rather than
  invented. No timings, prices, donation instructions, dates, committee names or
  testimonials are fabricated.

`tests/db/fresh-seed.test.ts` proves all of these against a throwaway in-process Postgres
(PGlite): every required table exists after the migrations, the first run creates the
starter rows, the second run inserts nothing, an administrator's edit to a seeded row
survives the next run, and a table that already holds rows is skipped rather than
duplicated.

## Local / test initialization (safe, the default)

```bash
DATABASE_URL="postgres://…" npx tsx scripts/seed-fresh-supabase.ts --local
```

Writes only to the Postgres reached by `DATABASE_URL` (a local Supabase stack or the
PGlite-backed test harness). Nothing else is touched.

Add `--dry-run` to print the plan and write nothing:

```bash
DATABASE_URL="postgres://…" npx tsx scripts/seed-fresh-supabase.ts --local --dry-run
```

## Test-project initialization

To seed a Supabase **test** project explicitly:

```bash
npx tsx scripts/seed-fresh-supabase.ts \
  --project-ref <test-ref> --yes-this-is-a-test-project
```

This reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
environment or `.env.local` / `.env`, exactly like `create-first-super-admin.ts`.

## Populating a project that already holds content

A project that already has real content — for example one that previously imported its own
rows under different identifiers — is handled safely by the same plan:

- every content table is seeded **only when empty**, so existing rows are never duplicated
  and never overwritten;
- `settings_documents` adds only the document keys that are missing and leaves the rest
  byte-for-byte;
- tables the owner has never populated (the usual case for `announcements`,
  `gallery_media`, `temple_areas`, `donation_campaigns`, `members`, `volunteers`) are
  filled with the starter rows;
- a dependent table (`gallery_media`) is filled only when its parent (`gallery_albums`)
  was seeded in the same run, so an existing album set never gains orphaned media.

`tests/db/fresh-seed.test.ts` covers this case directly: it pre-populates a table with an
owner-curated row and asserts the run skips it, leaves the row intact, still seeds the
empty tables, and that a second run inserts nothing. A dedicated gallery-dependency suite
proves both the empty-parent (album + media seeded, zero orphans) and populated-parent
(media skipped, owner media preserved) cases, and that a parent existence-check failure
aborts the run safely.

## Production initialization is not supported by this command

The command **refuses** any run it cannot prove is a test target. It exits `1` with a
plain message when:

- `NODE_ENV=production`, `VERCEL` or `CI` is set;
- both `--local` and `--project-ref` are given, or neither is;
- a `--project-ref` run is missing `--yes-this-is-a-test-project`;
- the `--project-ref` is the **approved production project** (`kvrkraqjuyxbraccxntk`,
  matched through the shared `scripts/lib/approved-project.mjs` constant, so it cannot
  drift from the value the migration workflow guards against);
- `NEXT_PUBLIC_SUPABASE_URL` does not resolve to the `--project-ref`;
- the project ref matches `prod`, `production` or `live`;
- `--local` is given without `DATABASE_URL`;
- `DATABASE_URL` resolves to the approved production project, or is ambiguous about which
  project it names.

There is therefore **no supported production seed path**. Initializing production is a
separate, reviewed change with its own approval, and is **not** performed by this
repository's automation or by any pull request.

## Test-project migration verification (safe, read-only)

`.github/workflows/supabase-migrations-test.yml` (`Verify Supabase Migrations (Test Project)`)
verifies pending migrations against a **dedicated test project**. It is separate from the
production deploy workflow and never applies anything:

- `workflow_dispatch` only — never on push or a schedule;
- no `environment: production` binding and no production secret referenced; every
  credential is `TEST_`-prefixed;
- `scripts/lib/guard-test-project.mjs` runs before `supabase link` and before any
  Supabase command, and refuses anything that is not explicitly allow-listed as a test
  project — in particular it **always refuses the approved production project**;
- the only database commands are `supabase migration list` and
  `supabase db push --dry-run`. There is no `supabase db push`, no seed command and no
  SQL write;
- when the test project, the allowlist or the test credentials are not configured, the
  job fails with an actionable message instead of falling back to production or inferring
  a project from a URL.

To use it, an owner first configures (see the failure message for the same list):

1. A dedicated Supabase **test** project (never the production project).
2. Repository variable `TEST_SUPABASE_PROJECT_REFS` — a comma-separated allowlist of test
   project refs. A malformed entry, or the production ref, makes the guard refuse.
3. Repository variable `TEST_SUPABASE_URL` — the test project's API URL (optional; when
   set, it must resolve to the dispatched ref).
4. Repository secrets `TEST_SUPABASE_ACCESS_TOKEN` and `TEST_SUPABASE_DB_PASSWORD` — from
   the test project only.

Then dispatch the workflow with `test_project_ref` set to an allow-listed ref and the
confirmation phrase `verify-test-supabase-migrations`.

## Production rollout (owner actions, separately approved)

Schema and data are deployed in two separate, individually approved steps.

### Step 1 — apply the schema migrations

Use the guarded workflow `.github/workflows/supabase-migrations.yml`
(`Deploy Supabase Migrations`). It is `workflow_dispatch`-only, never runs on push or a
schedule, is bound to the `production` environment, is serialised by a concurrency
group, and runs a hard project-ref guard (`scripts/lib/guard-approved-project.mjs`)
**before** any database-changing command. It runs a dry-run, then `db push`, then
`verify:supabase-migrations`.

Owner prerequisites:

1. Configure the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`,
   `SUPABASE_DB_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Enable required reviewers** on the `production` environment
   (Settings → Environments). The environment exists but carries no protection rules, so
   the workflow is currently dispatch-gated but not reviewer-gated. Enabling required
   reviewers is what makes the human-approval step real.
3. Dispatch the workflow and type the confirmation phrase `apply-supabase-migrations`.

### Step 2 — initialize the production starter dataset

Production data initialization is **not** wired to the CLI. It requires a separate,
explicitly approved procedure that is out of scope for this change. Two acceptable forms,
both requiring owner sign-off recorded outside this repository:

- a one-off, owner-run initialization against production using the same reviewed plan
  (`lib/supabase/seed-data/plan.ts`) under a documented approval, or
- a follow-up change that adds an approved production path with its own review.

Until that approval exists, production stays uninitialized by this repository and the
public site shows the code's built-in defaults.

### Step 3 — supply the owner facts

After initialization, replace every `PLACEHOLDER - ` value through the admin console. To
find what remains:

```sql
select document_key
from settings_documents
where data::text like '%PLACEHOLDER - %';
```

Every remaining placeholder is a value the owner has not yet confirmed. None of them is a
fabricated value.

## Verification

```bash
npm run verify:supabase-migrations          # live: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run verify:supabase-migrations:static   # static only, no credentials
```

The static verifier exits `2` by design when it skips live verification ("static passed,
live skipped"); `2` is not a CI failure signal.
