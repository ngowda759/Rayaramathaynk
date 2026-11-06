# F-A16-01 — Table-by-table privilege matrix

**Status: the migration EXISTS and is FULLY TESTED LOCALLY; PRODUCTION APPLICATION IS
PENDING. No production database was read or written by this file.**

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

Legend: **R** = revoke, **K** = keep.

| Privilege | `anon` | `authenticated` | `service_role` | `PUBLIC` |
|---|---|---|---|---|
| `TRUNCATE` on any `public` table | **R** | **R** | **R** | not granted (audit found none) |
| `REFERENCES` on any `public` table | **R** | **R** | **R** | not granted |
| `TRIGGER` on any `public` table | **R** | **R** | **R** | not granted |
| `SELECT` / `INSERT` / `UPDATE` / `DELETE` | **K** (Phase B) | **K** (Phase B) | **K** | **K** (not touched) |
| Sequence `USAGE` | **K** (Phase B) | **K** (Phase B) | **K** | not touched |
| Function `EXECUTE` | Phase B / guard | Phase B / guard | **K** | Phase B / guard |

"Phase B / guard" for function `EXECUTE`: the forward guard
(`20261114990000_f_a16_public_function_execute_guard.sql`) handles **new** functions.
Existing functions are §12 of the remediation plan.

### 2.1 Why `service_role` loses `TRUNCATE` too — the exception is removed

An earlier revision of this change kept `TRUNCATE` for `service_role` on the tables
carrying a `BEFORE TRUNCATE` guard, on the stated premise that "the guard only fires for a
role that holds `TRUNCATE`; keeping it on `service_role` is what keeps the guard reachable
for a non-owner role". **That premise is false.** Measured on PostgreSQL 17.11 and 18.6:

| Who truncates | Holds `TRUNCATE`? | Guard fires? | Result |
|---|---|---|---|
| Table owner (non-superuser) | yes (owner) | **yes** | blocked |
| Superuser (owner or not) | yes (superuser) | **yes** | blocked |
| Non-owner granted `TRUNCATE` | yes | **yes** | blocked |
| Non-owner without `TRUNCATE` | no | n/a | `permission denied` |

A `BEFORE TRUNCATE` trigger is a *statement* trigger on the table; Postgres fires it for
every role that is permitted to truncate, including the owner and a superuser. So the guard
is reachable for every role that could ever trip it, and keeping `TRUNCATE` on
`service_role` protected nothing. The reviewed exception list is therefore **empty**:
`service_role` loses `TRUNCATE`, `REFERENCES` and `TRIGGER` on every `public` table, exactly
as `anon` and `authenticated` do.

This is consistent with the pre-existing hardening:
`20261029235900_seva_privilege_hardening.sql` already revokes `TRIGGER, REFERENCES` from
`service_role, anon, authenticated` on seven guarded tables, and
`20261102000000_seva_final_fixes.sql` already revokes `DELETE, TRUNCATE` from `service_role`
on `receipt_number_gaps` and `receipt_series_years`.

The migration no longer reads `pg_trigger` at all; there is no per-table exception to keep
in sync. The application never truncates (a repository search finds no `TRUNCATE` statement
in any function body, script or application path), so this removes an unused privilege.

### 2.2 The nine `BEFORE TRUNCATE` guard tables (reviewed, no exception)

For the review record, the tables carrying a `BEFORE TRUNCATE` guard are:
`audit_log`, `staff`, `seva_rate_history`, `seva_orders`, `seva_receipts`,
`seva_receipt_lines`, `day_closes`, `receipt_number_gaps`, `receipt_series_years`. Each is
still protected after Phase A: the guard fires for any role permitted to truncate (§2.1),
and none of the three public-facing roles holds `TRUNCATE` on any of them afterwards.

---

## 3. The four public-read tables

| Table | `anon` SELECT | `authenticated` SELECT | Policy (migration) |
|---|---|---|---|
| `events` | keep | keep | `20261105000000_events_public_select_policy.sql` |
| `aaradhanes` | keep | keep | `20261111000000_aaradhanes_public_select_policy.sql` |
| `site_settings` | keep | keep | `20261010000000_create_settings.sql` |
| `social_links` | keep | keep | `20261010000000_create_settings.sql` |

The migration never touches `SELECT` or any policy. Its post-condition fails (and rolls
back) if one of these four no longer has a non-`false` `SELECT` policy, **or** if it no
longer grants `SELECT` to `anon`/`authenticated`, so the public-read surface cannot be
broken silently.

---

## 4. Tables explicitly excluded

| Excluded | Why |
|---|---|
| Supabase **Auth** tables (`auth.*`) | Out of scope; never named. A structural test asserts the file contains no `auth.` reference. |
| `storage`, `graphql`, `graphql_public` | Platform-managed; the sweep filters `n.nspname = 'public'`. |
| `seva_list_items` | Already `REVOKE ALL` + RLS-enabled + zero policies by design (F-A16-04). The Phase A revoke is a no-op on it (it holds no `TRUNCATE`/`REFERENCES`/`TRIGGER` to revoke). |
| Non-`public` schemas generally | A behavioural test proves a table in another schema keeps all privileges. |
| Existing `PUBLIC` grants | The audit found none; a blanket `REVOKE … FROM PUBLIC` could strip owner-intended access. A structural test pins that the migration never revokes from `PUBLIC`; the post-condition instead *asserts* `PUBLIC` holds none of the three. |

---

## 4A. The public-read surface beyond the four audited tables (reviewed, NOT revoked)

The 2026-11-03 audit's API census reports exactly four tables returning rows to `anon`
(`events`, `aaradhanes`, `site_settings`, `social_links`). A static sweep of
`supabase/migrations/*.sql` finds non-`false` `SELECT` policies on more tables. This
section records the review, because Phase B must not revoke a `SELECT` on a table whose
public read is real but empty today.

| Table | Non-`false` `SELECT` policy in repo? | Browser-client read path? | Class |
|---|---|---|---|
| `temple_areas` | yes (`20240915_create_temple_areas.sql`) | served via `app/api/temple-areas/route.ts` → `services/temple-areas.supabase.service.ts` (`createAdminClient()` on the server path, `createClient()` on the browser path) | **server-mediated public read**; `anon` SELECT may be needed if the browser client path is used |
| `announcements` | yes (`is_active` predicate) | `lib/ai/retrieval/announcements.ts` uses the **browser** client; admin reads use `createAdminClient()` | **browser public read** |
| `ai_knowledge` | yes (`approved` predicate) | `lib/ai/retrieval/*` and admin routes | **browser public read (approved rows)** |
| `featured_content` | yes (`active` predicate) | admin/dashboard surfaces | **uncertain** — no confirmed anon path |

Consequence: **Phase A is unaffected** (it never revokes `SELECT`), but **Phase B must not
revoke `SELECT` from `anon` on any of these** without first confirming the browser path.
The audit's API census is a row-count observation, not a policy inventory; "0 rows to
`anon`" is consistent with an empty table behind a live public-read policy. Phase B is
therefore gated on the owner-side verification in §5.3, not on the four-table census alone.

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
(approved rows) and `featured_content` (active rows), listed in §4A. The audit's API census
shows only four tables returning rows to `anon`, which is consistent with the others being
empty of matching rows or unreachable from the client.

This does not affect Phase A (which never revokes `SELECT`), but Phase B **must** resolve
it before revoking any DML: a table with a live public-read policy that is simply empty
today would be broken by a `SELECT` revoke the moment it gains a row.

### 5.3 Verification the owner must run before Phase B

See `docs/audits/F-A16_EXECUTION_CHECKLISTS.md` §Preflight and the audit SQL §4. In
particular: confirm every browser-client read path in `lib/ai/retrieval/*.ts`,
`services/quote.service.ts`, `services/announcement.service.ts` and
`services/daily-spiritual.service.ts` reads only a table Phase B keeps `SELECT` on. The
§4A table is the starting list, not the final classification.

---

## 6. Expected impact

* **Phase A (this change):** every `anon`/`authenticated`/`service_role` grant of
  `TRUNCATE`/`REFERENCES`/`TRIGGER` on a `public` table is removed. There is **no
  exception** — `service_role` loses all three too (§2.1). No read or write path changes.
  No policy changes. No DML changes. Idempotent.
* **Phase B (deferred):** would remove DML from `anon`/`authenticated` on backend-only
  tables. Not executed; not in this change.
