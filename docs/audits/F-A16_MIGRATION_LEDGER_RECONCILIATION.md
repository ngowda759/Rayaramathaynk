# F-A16-06 — Migration Ledger Reconciliation

**Status: ANALYSIS ONLY. NOT APPLIED TO PRODUCTION.**
**Base commit:** `3048196` (`main`) · **Audit snapshot date:** 2026-11-01

This report compares the repository's migration files against the migration-ledger
snapshot recorded in the F-A16 audit, and identifies entries that need human
investigation. It does **not** modify the production migration ledger, does **not** mark
any migration as applied, and does **not** run `supabase migration repair`.

All facts below are reproducible from the repository alone; the counts are also pinned
by `tests/unit/f-a16-migration-ledger-reconciliation.test.ts`.

---

## 1. Repository migration inventory (at `3048196`)

| Measure | Value |
|---|---|
| `supabase/migrations/*.sql` files | **41** |
| Files with a canonical 14-digit version prefix | **40** |
| Files with a non-14-digit prefix | **1** — `20240915_create_temple_areas.sql` |
| Duplicate **version** prefixes | **0** |
| Duplicate **names** (distinct versions) | **2** — `create_temple_areas`, `seed_ai_settings` |

> This PR adds **two** proposed migrations (`20261115000000_f_a16_least_privilege_defaults.sql`,
> `20261115000100_f_a16_fail_closed_rls_assertion.sql`), both `NOT APPLIED`. They are
> excluded from the counts above, which describe the audit base commit.

---

## 2. The audit snapshot's "41 entries, some future-dated"

The audit reported **41 ledger entries**, some with version identifiers dated **later
than the audit date (2026-11-01)**. Both observations are explained by the repository
state:

### 2.1 The 41 entries correspond to the 41 repository files

The repository has exactly 41 migration files at the audit base commit. The snapshot's
count matching the file count is consistent with the ledger recording **one entry per
applied file**. This is corroboration, not proof: the ledger was not read live, so the
mapping of each entry to a file is an **assumption**.

### 2.2 The future-dated versions are real files, committed ahead of their version date

Migrations in this repository are authored with a *planned* timestamp. Files are named
for the date the change is intended to land, which can be **after** the audit date when
a change is prepared in advance. The repository contains **14** files whose version is
later than `20261101`:

| Version | File |
|---|---|
| 20261102000000 | `seva_final_fixes.sql` |
| 20261102000100 | `seva_refunds_paper.sql` |
| 20261102000200 | `seva_followups.sql` |
| 20261102000300 | `seva_final_touches.sql` |
| 20261103000000 | `add_auth_user_id_to_users.sql` |
| 20261104000000 | `add_events_provenance_columns.sql` |
| 20261105000000 | `events_public_select_policy.sql` |
| 20261110000000 | `fresh_supabase_native_content.sql` |
| 20261110000001 | `reconcile_temple_areas.sql` |
| 20261111000000 | `aaradhanes_public_select_policy.sql` |
| 20261112000000 | `ai_chat_tables.sql` |
| 20261113000000 | `knowledge_workflow_tables.sql` |
| 20261114000000 | `admin_console_tables.sql` |
| 20261114000100 | `donations_updated_at.sql` |

(`20261101000000_seva_paper_size_not_null.sql` is same-day, not later, and is excluded.)

**This is expected, not a defect.** `supabase db push` applies *pending* migrations
(those newer than the remote ledger) in filename order, so a future-dated file is
simply a pending migration. The existing guard in
`tests/unit/raya-admin-schema-migration.test.ts` encodes the same rule for
`20261103000000_add_auth_user_id_to_users.sql`: it must sort **after** the last version
already applied in production (`20261102000300`) and be the only file at its version.

---

## 3. Entries needing human investigation

### 3.1 The one non-canonical version — `20240915_create_temple_areas.sql` (**investigate**)

* Its prefix is **8 digits** (`20240915`), not the canonical 14. `migrationVersionFromFilename`
  returns `null` for it (a unit test pins this), so it is invisible to any tool that keys
  on the canonical form.
* It is the **second** `create_temple_areas` file. `20240523000000_create_temple_areas.sql`
  defines `id uuid` with no `image_url`/`has360_view`; `20240915` defines `id text` with
  those columns. Both use `CREATE TABLE IF NOT EXISTS`, so the **first** definition wins
  (migrations apply in filename order) and the second silently does nothing.
* The application needs the *second* shape: `services/temple-areas.supabase.service.ts`
  writes `image_url`, `has360_view` and a slug id.
* `20261110000001_reconcile_temple_areas.sql` repairs this idempotently (adds the columns,
  converts `id uuid → text` under a guard). It is **pending** (not applied at the audit
  base), so production may still be on the uuid shape.

**Question for the owner:** is production's `temple_areas.id` `uuid` or `text`? If
`uuid`, the reconcile migration is required and the public temple-areas page is
currently degraded. This cannot be answered without the live catalog read the audit
could not perform.

### 3.2 The duplicate name `seed_ai_settings` (**informational**)

* `20261006101759_seed_ai_settings.sql` — a **ledger marker only**, deliberately no DDL
  or DML, recorded because the seed was applied out of band.
* `20261012000001_seed_ai_settings.sql` — the **real** seed, ordered after
  `20261012000000_create_ai_settings_table.sql`.
* Distinct versions, so `db push` can order them; the shared name is intentional and
  documented in each file's header. No action needed.

### 3.3 Remote-only entries from prior reconciliation (**historical, verify**)

`MIGRATION_INVESTIGATION_REPORT.md` records a remote-only ledger entry
`20260918143124 create_content_tables` with no local file. The repository's
`20261001000000_create_content_tables.sql` was introduced by commit
`3a1dc9760226cab8ef5288ef507be698b13b78cb` on 2026-09-18, immediately after that
timestamp — strong evidence the migration was **renamed/re-versioned before commit**,
leaving a stale ledger row. `MIGRATION_VERIFICATION_REPORT.md` concludes the remote and
local histories otherwise match and **no migration is pending** at that time.

**Question for the owner:** does the live ledger still contain `20260918143124`? If so,
it is stale history drift, not a missing schema change. Repairing it (`supabase migration
repair`) is a ledger-only action and must be done deliberately, never as part of this PR.

---

## 4. What is *not* a problem

| Observation | Verdict |
|---|---|
| 41 files, 41 ledger entries | consistent; one entry per file |
| 14 versions dated after the audit date | expected — pending migrations, applied in order by `db push` |
| `20261101000000_seva_paper_size_not_null.sql` on the audit date | same-day, not future-dated |
| Two files named `create_temple_areas` | distinct versions; the second is a documented no-op |
| Two files named `seed_ai_settings` | marker + real seed, intentionally separate |
| No duplicate version prefixes | `db push` ordering is unambiguous |

---

## 5. Recommended actions (none taken here)

1. **Read the live ledger** (`supabase_migrations.schema_migrations`) and compare it
   file-by-file against the 41 (now 43) repository files. This is the only way to turn
   §2.1's assumption into a fact.
2. **Confirm `temple_areas.id`'s type in production** (§3.1) and, if it is `uuid`, apply
   `20261110000001_reconcile_temple_areas.sql` through the normal reviewed path.
3. **Decide on the stale `20260918143124` entry** (§3.3) separately, with the ledger
   evidence recorded first.
4. **Do not** mark any migration applied, and **do not** run `supabase migration repair`
   as part of this remediation.

### 5.1 The two proposed F-A16 migrations, for ledger purposes

This reconciliation covers the *existing* 43 files at base `3048196`. The F-A16
remediation adds two more, which are **proposed and not applied**:

| Proposed file | Version | Applied? | Note |
|---|---|---|---|
| `supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql` | 20261115000000 | **No** | future-dated relative to the 2026-10-31 snapshot, consistent with the other pending files in §2.2 |
| `supabase/migrations/20261115000100_f_a16_fail_closed_rls_assertion.sql` | 20261115000100 | **No** | same |

Their versions sort after every existing canonical file, so they do not introduce an
out-of-order entry: `supabase db push` refuses a file older than the remote maximum, and
these are newer than all of them. The ledger reconciliation itself remains read-only —
these rows exist only in the working tree until a human applies them.

---

## 6. Reconciliation table

| Repository file | Version | In audit snapshot? | Note |
|---|---|---|---|
| `20240523000000_create_temple_areas.sql` | 20240523000000 | assumed yes | uuid definition; wins |
| `20240915_create_temple_areas.sql` | *(8-digit)* | **unclear** | non-canonical; silently a no-op |
| `20260907112632_create_core_tables.sql` | 20260907112632 | assumed yes | sevas, daily_poojas, events |
| … (remaining canonical files) | 14-digit | assumed yes | ordered, no duplicates |
| `20261110000001_reconcile_temple_areas.sql` | 20261110000001 | **pending** | future-dated; needed for §3.1 |
| … (14 other future-dated files) | > 20261101 | **pending** | expected |

The full file list is `ls supabase/migrations/*.sql`; the guard test asserts the counts,
the non-canonical file, the duplicate names and the future-dated set, so this table
cannot drift silently.

---

## 7. Confirmation of no ledger or production change

No row of `supabase_migrations.schema_migrations` was read, written, repaired or marked.
No migration was applied, dispatched, or pushed. No production database was connected.

The two F-A16 migrations named in §5.1 are **proposed only**: they exist in the working
tree, carry a `Status: PROPOSED. NOT APPLIED.` header, and have not been run against any
database (they are exercised only against an in-process PGlite instance in
`tests/db/f-a16-least-privilege.test.ts`).

**NOT APPLIED TO PRODUCTION.**
