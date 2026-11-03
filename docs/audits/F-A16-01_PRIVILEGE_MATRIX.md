# F-A16-01 — Table-by-table privilege matrix

**Status: PROPOSED. NOT APPLIED. No production database was read or written by this file.**

**Source of truth:** the 2026-11-03 read-only production catalog audit. It recorded, for
the 67 `public` tables:

* `anon` and `authenticated` hold `REFERENCES`, `TRIGGER`, `TRUNCATE` on numerous tables;
* `service_role` holds the same on multiple tables;
* exactly four tables are public-read: `aaradhanes`, `events`, `site_settings`,
  `social_links`.

The audit summary reports privilege *classes per role*, not a per-table row dump. This
matrix is therefore written as **rules over the catalog**, not a hard-coded 67-row list,
so it stays correct as tables are added and can be applied by one migration. The
per-table rows are reproduced at execution time by the read-only query in
`docs/audits/F-A16_EXECUTION_CHECKLISTS.md` §Preflight.

---

## 1. The two phases, and why they are separate

| Phase | Privileges | RLS compensates? | In this change? | Why |
|---|---|---|---|---|
| **A — now** | `TRUNCATE`, `REFERENCES`, `TRIGGER` | **No** | Yes, `20261115000200_f_a16_existing_table_privileges.sql` | No application path uses them, and RLS does not filter them. Safe to revoke everywhere without a per-table audit. |
| **B — deferred** | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Yes, *if* a deny-all policy exists | No | Revoking a DML privilege can break a live read or write. It is gated on a live grant read and an application-dependency pass. |

Phase B is specified in §5 below. It is deliberately **not executed**.

---

## 2. Phase A matrix — current vs intended, per role

Legend: **R** = revoke, **K** = keep, **K (guarded)** = keep only where a
`BEFORE TRUNCATE` trigger exists.

| Privilege | `anon` | `authenticated` | `service_role` | `PUBLIC` |
|---|---|---|---|---|
| `TRUNCATE` on any `public` table | **R** | **R** | **R**, except **K (guarded)** on the 9 guarded tables | not granted (audit found none) |
| `REFERENCES` on any `public` table | **R** | **R** | **R** | not granted |
| `TRIGGER` on any `public` table | **R** | **R** | **R** | not granted |
| `SELECT` / `INSERT` / `UPDATE` / `DELETE` | **K** (Phase B) | **K** (Phase B) | **K** | **K** (not touched) |
| Sequence `USAGE` | **K** (Phase B) | **K** (Phase B) | **K** | not touched |
| Function `EXECUTE` | Phase B / guard | Phase B / guard | **K** | Phase B / guard |

"Phase B / guard" for function `EXECUTE`: the forward guard
(`20261114990000_f_a16_public_function_execute_guard.sql`) handles **new** functions.
Existing functions are §12 of the remediation plan.

### 2.1 Why `service_role` keeps `TRUNCATE` on the nine guarded tables

Nine tables carry a `BEFORE TRUNCATE` trigger that raises (the audit base list):
`audit_log`, `staff`, `seva_rate_history`, `seva_orders`, `seva_receipts`,
`seva_receipt_lines`, `day_closes`, `receipt_number_gaps`, `receipt_series_years`.

The guard only fires for a role that **holds** `TRUNCATE`; the table owner's own
`TRUNCATE` is not intercepted. Keeping `TRUNCATE` on `service_role` for these nine is what
keeps the guard reachable for a non-owner role. On the other 58 tables `service_role` has
no such guard to protect, so `TRUNCATE` is revoked there.

The migration reads this from `pg_trigger` (`tgtype & 2` = BEFORE, `tgtype & 32` =
TRUNCATE), so a table that gains a guard later is honoured without editing the migration.

### 2.2 Why `anon`/`authenticated` lose `TRUNCATE` even on the guarded tables

The guard is a second line of defence, not a substitute for the grant. An `anon` role has
no reason to hold `TRUNCATE` on any table, guarded or not, so it is revoked everywhere.

---

## 3. The four public-read tables

| Table | `anon` SELECT | `authenticated` SELECT | Policy (migration) |
|---|---|---|---|
| `events` | keep | keep | `20261105000000_events_public_select_policy.sql` |
| `aaradhanes` | keep | keep | `20261111000000_aaradhanes_public_select_policy.sql` |
| `site_settings` | keep | keep | `20261010000000_create_settings.sql` |
| `social_links` | keep | keep | `20261010000000_create_settings.sql` |

The migration never touches `SELECT` or any policy. Its post-condition fails (and rolls
back) if one of these four no longer has a non-`false` `SELECT` policy, so the public-read
surface cannot be broken silently.

---

## 4. Tables explicitly excluded

| Excluded | Why |
|---|---|
| Supabase **Auth** tables (`auth.*`) | Out of scope; never named. A structural test asserts the file contains no `auth.` reference. |
| `storage`, `graphql`, `graphql_public` | Platform-managed; the sweep filters `n.nspname = 'public'`. |
| `seva_list_items` | Already `REVOKE ALL` + RLS-enabled + zero policies by design (F-A16-04). The Phase A revoke is a no-op on it; the pre-existing hardening is re-issued to keep it visible in one place. |
| Non-`public` schemas generally | A behavioural test proves a table in another schema keeps all privileges. |
| Existing `PUBLIC` grants | The audit found none; a blanket `REVOKE … FROM PUBLIC` could strip owner-intended access. A structural test pins that the migration never revokes from `PUBLIC`. |

---

## 5. Phase B — the deferred DML specification (NOT EXECUTED)

This is the plan for a later, separately-reviewed change. It is **not** in the migration.

### 5.1 Decision rule per table

1. Read the live grant matrix and the RLS policy set for each of the 67 tables.
2. Classify each table:
   * **public-read** (`SELECT` + a non-`false` `SELECT` policy, reachable from the browser
     client): keep `SELECT`; revoke `INSERT`/`UPDATE`/`DELETE` from `anon`/`authenticated`.
   * **backend-only** (no policy, or a deny-all policy): revoke all four from
     `anon`/`authenticated`; keep `service_role`.
   * **public-write** (an explicit write policy exists): keep the granted DML. The audit
     found none, but the rule is stated so the classification is not "revoke unless
     proven", which is what breaks a live write.
3. Keep `service_role` DML on every table and sequence `USAGE` everywhere.

### 5.2 Open question that must be resolved first

A static sweep of `supabase/migrations/*.sql` finds non-`false` `SELECT` policies on more
than the four audited tables — at least `temple_areas`, `announcements`, `ai_knowledge`
(approved rows) and `featured_content` (active rows). The audit's API census shows only
four tables returning rows to `anon`, which is consistent with the others being empty of
matching rows or unreachable from the client.

This does not affect Phase A (which never revokes `SELECT`), but Phase B **must** resolve
it before revoking any DML: a table with a live public-read policy that is simply empty
today would be broken by a `SELECT` revoke the moment it gains a row.

### 5.3 Verification the owner must run before Phase B

See `docs/audits/F-A16_EXECUTION_CHECKLISTS.md` §Preflight and the audit SQL §4. In
particular: confirm every browser-client read path in `lib/ai/retrieval/*.ts`,
`services/quote.service.ts`, `services/announcement.service.ts` and
`services/daily-spiritual.service.ts` reads only a table Phase B keeps `SELECT` on.

---

## 6. Expected impact

* **Phase A (this change):** every `anon`/`authenticated`/`service_role` grant of
  `TRUNCATE`/`REFERENCES`/`TRIGGER` on a `public` table is removed, except `service_role`'s
  `TRUNCATE` on the nine guarded tables. No read or write path changes. No policy changes.
  No DML changes. Idempotent.
* **Phase B (deferred):** would remove DML from `anon`/`authenticated` on backend-only
  tables. Not executed; not in this change.
