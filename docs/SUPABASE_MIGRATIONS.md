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

## Troubleshooting

- **Dry-run fails:** If `supabase db push --dry-run` fails, review the migration files in `supabase/migrations/` for syntax errors or conflicts with the existing remote schema. Fix the SQL locally before retrying.
- **Verification fails:** The `verify-supabase-migrations.ts` script checks both static schema expectations and the live database ledger. Ensure your migration files use the canonical 14-digit prefix (e.g., `20260907112632_create_core_tables.sql`).
- **Connection issues:** Verify that the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` are valid, and ensure the remote project is not paused.
