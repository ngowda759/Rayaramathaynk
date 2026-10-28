# Supabase Schema Migrations

This document covers the deployment workflow for Supabase PostgreSQL schema migrations.

> **Important:** Schema migration ≠ Data migration.
> Schema deployment (creating tables, policies, etc.) must happen first. Firestore → Supabase data migration remains a separate controlled operation and is detailed in `docs/FIRESTORE_MIGRATION.md`.

## Prerequisites

To apply schema migrations, you need:
- Node.js version compatible with the repository (e.g., v22).
- Supabase CLI installed.

### GitHub Actions Secrets

For the automated workflow, the following secrets must be configured in your GitHub repository:
- `SUPABASE_ACCESS_TOKEN`: A Personal Access Token for the Supabase CLI.
- `SUPABASE_PROJECT_REF`: The project reference ID for your Supabase project (e.g., `abcdefghijklmnopqrst`).

## Local Development & Configuration

To configure your local environment for Supabase migrations:

```bash
# Log in to the Supabase CLI (requires Personal Access Token)
supabase login

# Link your local project to the remote Supabase project
supabase link --project-ref <PROJECT_REF>
```

> **Note:** Never hardcode `<PROJECT_REF>` or commit it to source control if it's sensitive.

### Running a Local Dry-Run

Before applying migrations, always run a dry-run to preview the changes without modifying the database:

```bash
npm run supabase:migrations:dry-run
# which maps to: supabase db push --dry-run
```

### Applying Migrations Locally

Once you have verified the dry-run output, apply the migrations:

```bash
npm run supabase:migrations:push
# which maps to: supabase db push
```

After pushing, run the verifier to ensure the schema matches expectations:

```bash
npm run verify:supabase-migrations
```

## GitHub Actions Workflow

A dedicated manual workflow is available in `.github/workflows/supabase-migrations.yml`.

### What the workflow does:
1. Triggers manually via `workflow_dispatch`.
2. Checks out the repository and installs dependencies via `npm ci`.
3. Installs the Supabase CLI.
4. Links to the configured Supabase project using the configured secrets.
5. Runs a dry-run (`supabase db push --dry-run`) first. The workflow fails immediately if the dry-run fails.
6. Only if the dry-run succeeds, it applies the migrations (`supabase db push`).
7. Finally, it runs the static and live verification (`npm run verify:supabase-migrations`).

### What it deliberately does NOT do:
- **No data migration:** It does NOT run Firestore data migration scripts or import Firestore data.
- **No destructive operations:** It does NOT delete PostgreSQL tables, reset the database, or use `supabase db reset`.
- **No automatic execution:** It does NOT run automatically on every push to `main` merely because a PR is opened.

### How to trigger the workflow manually
1. Navigate to the **Actions** tab in the GitHub repository.
2. Select **Deploy Supabase Migrations** from the left sidebar.
3. Click **Run workflow**, select the branch (e.g., `main`), and confirm.

## Test-project migration verification (read-only)

`.github/workflows/supabase-migrations-test.yml` (`Verify Supabase Migrations (Test Project)`)
verifies pending migrations against a **dedicated test project**, separately from the
production deploy above. It is safe to run at any time because it never applies anything.

### What the workflow does:
1. Triggers manually via `workflow_dispatch`, and requires the typed confirmation phrase
   `verify-test-supabase-migrations`.
2. Fails with an actionable message if the test project ref, the allowlist or the
   test credentials are not configured — it never falls back to production.
3. Runs `scripts/lib/guard-test-project.mjs`, which refuses anything that is not
   explicitly allow-listed as a test project. It **always refuses the approved
   production project**.
4. Links to the test project and runs `supabase migration list`, then
   `supabase db push --dry-run`.

### What it deliberately does NOT do:
- **No `supabase db push`:** the only `db push` is the `--dry-run` form. Nothing is applied.
- **No data or seed step:** it does not run seed or migration scripts.
- **No production credential:** every credential is `TEST_`-prefixed, and the workflow
  binds no `environment: production`.

### Configuration (owner action, once)

1. Create a dedicated Supabase **test** project (never the production project).
2. Set repository variable `TEST_SUPABASE_PROJECT_REFS` to a comma-separated allowlist of
   test project refs. A malformed entry, or the production ref, makes the guard refuse.
3. Optionally set repository variable `TEST_SUPABASE_URL` to the test project's API URL.
   When set, it must resolve to the dispatched ref — the ref is never inferred from a URL
   substring.
4. Set repository secrets `TEST_SUPABASE_ACCESS_TOKEN` and `TEST_SUPABASE_DB_PASSWORD`
   from the test project only.

Then dispatch the workflow with `test_project_ref` set to an allow-listed ref.

## Troubleshooting

- **Dry-run fails:** If `supabase db push --dry-run` fails, review the migration files in `supabase/migrations/` for syntax errors or conflicts with the existing remote schema. Fix the SQL locally before retrying.
- **Verification fails:** The `verify-supabase-migrations.ts` script checks both static schema expectations and the live database ledger. Ensure your migration files use the canonical 14-digit prefix (e.g., `20260907112632_create_core_tables.sql`).
- **Connection issues:** Verify that the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` are valid, and ensure the remote project is not paused.

---

## Seva Entry migrations

Seva Entry adds the migration files below. They are additive (new tables, new columns with defaults, new functions); none
changes or drops what the website already has.

| File | What it adds |
|---|---|
| `20261020000000_seva_core.sql` | staff, counters, counter PCs, receipt series and years, number gaps, group counters, settings, denominations, festival days, the new `sevas` columns, rate history, the audit log, backup runs; row level security and revokes |
| `20261020000100_seva_receipts.sql` | orders, receipts, receipt lines, day closes and counts, devotee profiles; guard triggers |
| `20261020000200_seva_seed.sql` | series C1, OF1, W, WT; Counter 1; the cash denominations; a settings row with SAMPLE text |
| `20261021000000_seva_functions_issue.sql` | issuing, offline sync, prints, cancel and spoiled reissue |
| `20261021000100_seva_functions_ops.sql` | prasadam, counter PCs, number gaps, heartbeat, day close |
| `20261021000200_seva_functions_admin.sql` | catalogue, settings, counter UPI change detection, staff, reports, Needs attention |
| `20261029235900_seva_privilege_hardening.sql` | revokes `TRIGGER` and `REFERENCES` on the guarded tables |
| `20261030000000_seva_lists.sql` | the gotra, nakshatra and rashi lists (`seva_list_items`) and their functions |
| `20261031000000_seva_paper_size.sql` | the receipt paper size columns on `seva_settings` |
| `20261101000000_seva_paper_size_not_null.sql` | `seva_settings.paper_size` NOT NULL (a null row set to `a5` first); not yet pushed |
| `20261102000000_seva_final_fixes.sql` | final-review fixes (A5-FIX F2): offline sync pricing, closed-day cancel, sync and close rules, Replace this PC by year, gap ownership and guards, own-counter idempotency, view-only and reissue rules in SQL, visible-length reasons; not yet pushed |
| `20261102000100_seva_refunds_paper.sql` | refunds and the paper book (A5-FIX F4): settling a due refund, entering a gap's slips from the paper book; not yet pushed |
| `20261102000200_seva_followups.sql` | follow-ups to the final-review fixes (A5-FIX F5): view-only refused at the counter in SQL, the `unprinted_online` and `sync_refused` cards, office-refused outbox items and their set-aside, the reason on the close-day override; not yet pushed |
| `20261102000300_seva_final_touches.sql` | the re-check's leftovers (FINAL-FIX, 2026-10-20); see its row in `docs/DATA-MODEL.md`; not yet pushed |

**Frozen files.** Every file up to and including `20261031000000_seva_paper_size.sql` was applied to the developer's
test project: the files up to `20261030000000_seva_lists.sql` on 2026-10-19, `20261031000000_seva_paper_size.sql` on
2026-10-20. Such a file is never edited again: a change is a new file with a later timestamp, written to
be additive and safe to run once on a database that already has the old ones.

**How they were tested.**

- Every seva migration runs in the database test layer (`npm run test:db`, `tests/db/**`) on **PGlite** (an in-process
  Postgres), applied twice to prove each file is safe to run again, with tests for the SQL functions, guards and
  triggers.
- PGlite is Postgres 18 while Supabase runs **Postgres 15**, so the SQL avoids anything newer than 15 (no
  `MERGE ... RETURNING`, `ANY_VALUE`, `JSON_TABLE` or SQL/JSON constructors); reviewers check this by reading the SQL.
- The files were pushed with `npx supabase db push` to the developer's own Supabase test project (the files up to the
  lists file on 2026-10-19, the paper size file after it).

**Pushing a new migration to a test project.** From the repository folder, with the project linked once
(`npx supabase login`, `npx supabase link --project-ref <ref>`), run `npx supabase db push --dry-run` to see which
files are new, then `npx supabase db push`. On the live project the site owner runs the **Deploy Supabase
Migrations** workflow instead (`docs/seva/SETUP-GUIDE.md` B1).
