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
**before** any database-changing command.

It has two dispatch modes:

- **`dry-run` (the default)** — read-only: it links, runs
  `supabase db push --dry-run --include-all` and enforces the pending-migration
  allowlist. It never writes to the database.
- **`apply`** — additionally requires the exact confirmation phrase
  `apply-supabase-migrations`. Only then does it run `supabase db push --include-all`,
  followed by `verify:supabase-migrations`.

The apply command appears exactly once and only in a step gated on
`if: ${{ inputs.mode == 'apply' }}`, so a dry-run cannot apply anything. Before the apply
step, `scripts/lib/check-pending-migrations.mjs` parses the dry-run's pending versions
from its `Would push these migrations:` bullet section and fails closed unless every
version is on the reviewed allowlist in `scripts/lib/pending-migrations.mjs`.

Owner prerequisites:

1. Configure the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`,
   `SUPABASE_DB_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Enable required reviewers** on the `production` environment
   (Settings → Environments). The environment exists but carries no protection rules, so
   the workflow is currently dispatch-gated but not reviewer-gated. Enabling required
   reviewers is what makes the human-approval step real.
3. Review every pending migration and confirm it is safe to apply. Add its version to
   `APPROVED_PENDING_MIGRATIONS` in `scripts/lib/pending-migrations.mjs` — an
   unapproved pending migration fails the run closed.
4. Dispatch the workflow with `mode: apply` and type the confirmation phrase
   `apply-supabase-migrations`.

There is **no automatic production migration path** in this repository: the workflow has
no `push` or `schedule` trigger.

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

## One-time Trust Committee initialization

The admin `/admin/settings/trust-committee` page and the public `/trust` page both read
`settings_documents` where `document_key = 'trustCommittee'` through the standard reader
path (admin `GET/PUT /api/admin/settings/[key]`, public `GET /api/public/settings/[key]`,
`services/settings-document.service.ts`). When that row is missing the admin page shows
"No members added yet" and the public page shows its built-in fallback — a data gap, not a
reader defect.

`scripts/seed-trust-committee-supabase.ts` creates that single row from the canonical
13-member data in `lib/supabase/seed-data/trust-committee.ts` (the Supabase-native
equivalent of the legacy Firestore `scripts/seed-trust-committee.ts`, with the unused
`phone`/`address` fields dropped). It is **Supabase-only** — it uses the existing Supabase
admin client (`@/lib/supabase/admin`), writes only the `trustCommittee` row, never reads or
writes Firestore, and never touches any other settings document.

```bash
# Dry run (the default; reads and reports, writes nothing):
npm run seed:trust-committee

# Apply (creates the row if missing; refuses to overwrite a populated document):
npm run seed:trust-committee -- --execute

# Replace an existing empty/incorrect document:
npm run seed:trust-committee -- --execute --force
```

Properties:

- **Idempotent.** A re-run after a successful create is a no-op (`state: matches`).
- **Refuses silent overwrite.** A document that already has members is left untouched
  unless `--force` is passed; an empty document is filled only with `--force`.
- **Validates before writing.** The canonical data must have 13 active members ordered
  1–13 with images present on disk, or the run exits `1` without touching the database.
- **Clear before/after summary.** Prints the target project fingerprint, the document
  key, the mode, and the member counts before and after; a write is verified afterwards.
- **No credentials printed.** The service-role key is never logged; only the project-ref
  fingerprint is shown.
- **No migration.** It writes data only; it does not create or alter any schema.

`tests/unit/trust-committee-seed.test.ts` pins the data, validation, classification and
runner logic; `tests/db/trust-committee-seed.test.ts` proves the write path against a real
(PGlite) Postgres: the row is created under the exact key with 13 active members, a re-run
is a no-op, other settings documents are untouched, and an owner-edited document is refused
without `--force`.

## Consolidated missing-settings initialization (Supabase-only)

A read-only production audit (2026-11-14) found that `public.settings_documents`
held 8 rows while the application reads more keys. This is the single, reviewed
mechanism that fills the missing rows. It replaces the earlier per-key one-offs
(`scripts/seed-trust-committee-supabase.ts` remains for the one-time Trust
Committee case).

### Purpose

Insert the `settings_documents` rows that are missing in a target project, using the
canonical seed data already in this repository (`SETTINGS_DOCUMENT_SEEDS`). It is
**insert-only**: a row that already exists — including an owner-edited one — is
never touched. There is deliberately no `--force`/overwrite path.

### Supported keys

The initializer acts only on the keys in `SETTINGS_INITIALIZATION_KEYS`
(`lib/supabase/seed-data/settings-initialization.ts`). A key is listed only when it
has canonical seed data **and** a confirmed application consumer. Today that is:

| Key | Consumer | Canonical source |
|-----|----------|------------------|
| `homepage` | `services/homepage.server.ts` → `Hero`, `Panchanga`, `TempleTimings` | `SETTINGS_DOCUMENT_SEEDS` |

Every other key the audit found missing is listed in `EXCLUDED_SETTINGS_KEYS` with
the reason it is deliberately not seeded, and the script prints that list on every
run. Those exclusions are decisions, not omissions:

| Key | Why it is not seeded |
|-----|----------------------|
| `guruParampara` | No canonical Supabase seed document; the admin page's built-in defaults (17 gurus) disagree with `GURU_BIOGRAPHIES` (18), so neither is proven canonical. |
| `socialLinks` | The admin page writes this document key but the public site reads the separate `social_links` **table**, which already holds the owner's links. Creating a document would duplicate the source of truth. See the design note below. |
| `shlokas` | The public page reads `data/shlokas.ts`; the document is admin-only. |
| `festivalCalendar` | The public page reads `data/calendar.ts`; the document is admin-only. |
| `ekadashiCalendar` | The public page reads `data/calendar.ts`; the document is admin-only. |
| `device` | No live reader — the public map uses the built-in `DEFAULT_DEVICE_SETTINGS`. |

### Dry-run command (default; writes nothing)

```bash
npm run seed:missing-settings
```

Prints the target fingerprint, the mode, the keys it will insert, and the keys it
will leave untouched. Nothing is written.

### Execute command (owner-approved)

```bash
npm run seed:missing-settings -- --execute --confirm initialize-missing-settings
```

`--execute` requires the exact phrase `initialize-missing-settings`. The command
inserts only missing rows, then verifies each inserted row holds the canonical
document, and exits `1` if verification fails.

### Production guard

The target ref is read from `NEXT_PUBLIC_SUPABASE_URL` and must resolve to a
`<ref>.supabase.co` project. The guard fails closed:

- an unverifiable or unrecognised ref is refused;
- `CI` or `VERCEL` refuses the run, so it can never fire automatically;
- a ref that looks like production but is not the approved project is refused;
- a **non-approved** ref is refused on `--execute` unless
  `--yes-this-is-a-test-project` is passed;
- the **approved production project** is the intended target and is allowed with
  the confirmation phrase; the script prints only a non-reversible fingerprint,
  never the ref or any secret.

### Expected verification output

```
=== VERIFY ===
  ✔ canonical documents verified for: homepage

✔ Settings initialized: homepage under settings_documents.
```

A failed verification prints the offending keys and exits `1`:

```
=== VERIFY ===
  ✖ homepage: stored document does not match the canonical seed

✖ Verification failed: a target document is missing or does not match the canonical seed.
```

### Warning

**Production execution requires owner approval.** The command is not wired to any
workflow or pull request, is `--execute`-gated behind a confirmation phrase, and
prints only fingerprints. Running it against production is a separate, explicitly
approved owner action. See "Production rollout" above.

### `socialLinks` design note (documented, not silently changed)

The audit confirmed a key/table mismatch:

```
Admin  → settings_documents.document_key = "socialLinks"
Public → public.social_links (table)
```

The admin page (`app/admin/settings/social-links/page.tsx`) reads and writes the
`socialLinks` **settings document**, while the public site
(`components/layout/SocialBar.tsx`, `Navbar`) reads the `social_links` **table**,
which already holds the owner's links. The two are not connected. This initializer
does **not** create a `socialLinks` document, because doing so would add a second,
divergent source of truth. Converging the two is a dedicated change with its own
review and is out of scope here.

## Verification

```bash
npm run verify:supabase-migrations          # live: needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run verify:supabase-migrations:static   # static only, no credentials
```

The static verifier exits `2` by design when it skips live verification ("static passed,
live skipped"); `2` is not a CI failure signal.

## Outstanding pre-merge safeguards

These are open items that must be resolved by the owner **before** production is
initialized. None of them is fixed by a seed run, and none requires deleting or
rewriting production data from this repository.

> Related documents:
> - `docs/PRODUCTION_SUPABASE_READINESS.md` — the read-only production readiness review
>   (verified vs unverified, and why privileged read-only access is currently blocked).
> - `docs/SUPABASE_DATA_ONLY_INITIALIZATION_PLAN.md` — the table-by-table seed plan with
>   the observed production counts, RLS visibility limitations and rollback identifiers.

### 1. `site_settings` duplicate rows (deterministic read; deletion is an owner action)

**Confirmed against production (read-only, 2026-10-28).** The migrated production
`site_settings` table holds **two rows that share one `updated_at` value**, and the public
reader selected a single row with `order(updated_at desc).limit(1).single()` — which is
non-deterministic on a tie. The two rows differ only in identity: one carries the real
temple name/contact, the other carries `firestore_id = 'trustCommittee'` — a *settings
document* (migrated losslessly into `settings_documents`), not site identity.

This repository no longer guesses. `services/settings.service.ts` adds `id` ascending as a
stable tiebreaker, so the read is deterministic without touching either row
(`tests/unit/settings-service-read.test.ts` pins the ordering). **No row is deleted or
rewritten here** — choosing which row is canonical is the owner's decision.

Inspect (read-only; run against production with the owner's credentials):

```sql
-- Which rows exist, and do they tie on updated_at?
select id, firestore_id, temple_name, contact_email, created_at, updated_at
from site_settings
order by updated_at desc, id asc;

-- Candidate "duplicate" pair: same updated_at.
select updated_at, count(*)
from site_settings
group by updated_at
having count(*) > 1;
```

Equivalent read-only REST check (publishable key only):

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/site_settings?select=id,firestore_id,updated_at&order=updated_at.desc,id.asc" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

The owner confirms which row is authoritative, then removes the `trustCommittee` row through
the admin console or an approved, separately reviewed SQL step. Until then the deterministic
read returns the newest row, tie-broken by `id`.

### 2. Final production initialization plan and exact records

Production initialization is **not** performed by any workflow or pull request in this
repository (see "Production initialization is not supported by this command"). When the
owner approves it, the exact starter set is the plan's `seedWhen: "empty"` content, 69 rows
across the content tables (the same list the dry run prints):

| Table | Rows | Conflict key |
|-------|------|--------------|
| `site_settings` | 1 | `firestore_id` |
| `social_links` | 1 | `firestore_id` |
| `announcements` | 1 | `firestore_id` |
| `daily_poojas` | 13 | `firestore_id` |
| `donation_campaigns` | 1 | `firestore_id` |
| `gallery_albums` | 1 | `firestore_id` |
| `gallery_media` | 7 | `firestore_id` (only when `gallery_albums` is seeded) |
| `temple_areas` | 2 | `id` |
| `quotes` | 33 | `slug` |
| `settings_documents` | 9 | `document_key` |

Each table is seeded **only when empty**; `settings_documents` inserts only the missing
document keys. `testimonials`, `members` and `volunteers` carry **no** seed rows (owner
facts only). Preview the exact rows at any time without writing:

```bash
DATABASE_URL=<test-db-url> npm run seed:fresh:dry-run
```

### 3. Production connectivity (verified read-only, 2026-10-28)

The approved project `kvrkraqjuyxbraccxntk` **is** reachable **read-only** with the public
credentials (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Verified
with `SELECT`-only REST calls: the project responded, and RLS gated every table.

What this environment **cannot** do is connect to production over raw PostgreSQL: the
`SUPABASE_DB_URL` / `SUPABASE_DB_URL_TX` values authenticate as a user belonging to a
**different** project, `SUPABASE_PROJECT_REF` is not the approved ref, and a direct connect
to the approved ref via the Supavisor pooler returns
`FATAL: (ENOTFOUND) tenant/user postgres.kvrkraqjuyxbraccxntk not found` (the supplied
password does not belong to that tenant).

Consequently, as of this revision **no production write of any kind was performed**, and no
`SUPABASE_DB_PASSWORD` for the approved project is available here. A production
initialization needs that password (or an approved service-role path) supplied by the owner.
Verify connectivity safely, read-only, before any initialization:

```bash
# Runs SELECTs and capability probes only; never writes, never prints a secret.
npm run diagnose:supabase-connectivity
```

Observed production row counts (read-only, 2026-10-28):

| Table | Rows | Note |
|-------|------|------|
| `site_settings` | 2 | the duplicate pair (§1) |
| `social_links` | 1 | migrated |
| `events` | 74 | owned by the app / aaradhane writer |
| all other content tables | 0 | `announcements`, `daily_poojas`, `quotes`, `gallery_albums`, `gallery_media`, `temple_areas`, `donation_campaigns`, `settings_documents`, `testimonials`, `members`, `volunteers` |

So production is a **near-empty fresh target**: the only populated content tables are the
`site_settings` pair, `social_links`, and `events`. The seed plan's empty-only rule therefore
seeds every table except those three (and `settings_documents` inserts its missing keys).

### 4. `isUserAdmin()` still reads Firestore (follow-up, separate from this PR)

`lib/auth/admin.ts` `isUserAdmin(uid)` resolves admin status from the Firestore `users`
collection, and `app/actions/settings.ts` gates settings writes with it. Firebase
**Authentication** (token verification, login, sessions) stays unchanged; this is a
separate question of *where the role is read from*.

- The settings **API routes** (`/api/admin/settings/[key]`) already use
  `requireAdminUser` (`lib/auth/admin-auth.ts`), which reads the role from Supabase
  `public.users` — the pattern to converge on.
- Converging `isUserAdmin` onto Supabase `public.users` (mirroring `requireAdminUser`) is a
  dedicated, separately reviewed change. It is **out of scope** for the fresh-seed work and
  must not be folded into this PR, because it changes authorization semantics.
