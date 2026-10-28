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

- **Repeatable and conflict-safe.** Every write is
  `INSERT ... ON CONFLICT (<key>) DO NOTHING`, so a second run inserts `+0` rows.
- **Administrator edits are preserved.** Because the plan never updates an existing row,
  an owner's edit to a seeded row survives every later run untouched.
- **No legacy artifacts.** The plan imports no Firestore client and needs no Firebase
  credentials, no Firestore export and no network access.
- **No fabricated facts.** Verified temple identity comes only from in-repo sources
  (`website-settings/temple.json`, `data/shlokas.ts`, `seed/ai/*.json`). Any value the
  owner has not yet confirmed is prefixed `PLACEHOLDER - ` and left blank rather than
  invented. No timings, prices, donation instructions, dates, committee names or
  testimonials are fabricated.

`tests/db/fresh-seed.test.ts` proves all four properties against a throwaway in-process
Postgres (PGlite): every required table exists after the migrations, the first run
creates the starter rows, the second run inserts nothing, and an administrator's edit to
a seeded row survives the next run.

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

## Production initialization is not supported by this command

The command **refuses** any run it cannot prove is a test target. It exits `1` with a
plain message when:

- `NODE_ENV=production`, `VERCEL` or `CI` is set;
- both `--local` and `--project-ref` are given, or neither is;
- a `--project-ref` run is missing `--yes-this-is-a-test-project`;
- `NEXT_PUBLIC_SUPABASE_URL` does not contain the `--project-ref`;
- the project ref matches `prod`, `production` or `live`;
- `--local` is given without `DATABASE_URL`.

There is therefore **no supported production seed path**. Initializing production is a
separate, reviewed change with its own approval, and is **not** performed by this
repository's automation or by any pull request.

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
