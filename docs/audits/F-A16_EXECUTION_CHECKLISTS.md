# F-A16 — Production preflight, verification and rollback checklists

**Status: NOT EXECUTED. Nothing in this file has been run against production.**

This file is the operator-facing companion to `docs/audits/F-A16_REMEDIATION_PLAN.md`. It
separates three things the plan deliberately keeps apart:

1. what to check **before** applying anything (§Preflight),
2. how to apply, and who may apply each part (§Execution),
3. how to verify afterwards (§Post-execution) and how to undo (§Rollback).

Every SQL statement here is either read-only (preflight / post-execution) or an owner-run
remediation that is clearly marked. No statement in this file was executed by this change.

---

## Automated vs owner-run — what runs how

| Artifact | Applied by | Why |
|---|---|---|
| `20261114990000_f_a16_public_function_execute_guard.sql` | `supabase db push` (automated) | Pure forward guard; changes no existing object. **Requires the ability to `CREATE EVENT TRIGGER`** — see preflight step 11. |
| `20261115000000_f_a16_least_privilege_defaults.sql` | `supabase db push` (automated) | Tightens the `public` default privileges of the applying role (and any role it may act for). A role it may not act for — `supabase_admin` on hosted Supabase — is **out of scope** and reported, not failed closed on. |
| `20261115000100_f_a16_fail_closed_rls_assertion.sql` | `supabase db push` (automated) | Additive assertion; refuses to install without an enabled enabler. |
| `20261115000200_f_a16_existing_table_privileges.sql` | `supabase db push` (automated) | Catalog-driven revoke of three privileges; no DML, no policy. |
| `20261115000300_f_a16_existing_function_privileges.sql` | `supabase db push` (automated) | Revokes `EXECUTE` on the two existing world-executable functions (`rls_auto_enable`, `update_updated_at_column`) from `PUBLIC`/`anon`/`authenticated`; keeps `service_role`. |
| `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` | **Retained, optional** | No longer required for the revised path: `supabase_admin` is a platform-internal role the customer `postgres` cannot act for, and the 2026-11-05 inventory found no `supabase_admin`-owned object in `public`. Kept for reference / a platform-assisted path only. |
| `docs/audits/F-A16_OWNER_RUN_supabase_admin_function_guard.sql` | **Retained, optional** | Closes the `supabase_admin`-created-function gap (a `supautils` `fmgr`-hook skip). Not required for the customer path; the F-A16-07 existing-function step covers pre-existing functions. Kept for reference / a platform-assisted path only. |
| The global-default remediation (§4 of the owner-run defaults file) | **Owner-run, only if a global default owned by the applying role is found** | A global statement changes every schema. The 2026-11-03 audit found 0, so this is expected to be a no-op. |

The automated migrations are idempotent. The owner-run files remain idempotent and
re-check their own preconditions, but they are **not required** for the hosted-Supabase
path (see "Hosted-Supabase constraint" below).

> **Hosted-Supabase constraint.** `supabase_admin` is a platform-internal superuser role.
> The customer `postgres` session is neither a superuser nor a member of `supabase_admin`,
> so `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` is denied and can never be part of
> a customer-applied migration. F-A16-02 therefore remediates only the default privileges
> a customer role can own and change, and the two owner-run files are retained for
> reference / a platform-assisted path, not required for the revised path.

> **Note on `CREATE EVENT TRIGGER`.** Two of the automated migrations install event
> triggers (`f_a16_public_fn_guard`, `f_a16_assert_public_rls`). `CREATE EVENT TRIGGER` is
> a superuser-only operation in stock PostgreSQL; on Supabase the `postgres` role is not a
> superuser and relies on the platform's `supautils` extension to create and manage event
> triggers. This is **unverified for the target project** — confirm it in preflight step 11
> before relying on these two migrations. If `postgres` cannot create event triggers, the
> migration aborts (fail closed) and the two event-trigger artifacts need an owner-run path.

---

## Preflight (read-only)

Run these in the Supabase SQL editor. They change nothing. The 2026-11-03 audit already
answered most of them; re-run to confirm nothing drifted since.

### 1. Roles present

```sql
SELECT rolname FROM pg_roles
 WHERE rolname IN ('anon', 'authenticated', 'service_role', 'supabase_admin', 'pg_database_owner')
 ORDER BY 1;
```

Expected: all five present. If `anon`/`authenticated`/`service_role` are missing, stop —
this is not a Supabase target.

### 2. Schema-scoped default ACLs for `public`, by owner

```sql
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       d.defaclobjtype AS object_type,
       d.defaclacl::text AS default_acl
  FROM pg_default_acl d
 WHERE d.defaclnamespace = 'public'::regnamespace
 ORDER BY 1, 2;
```

Expected: **6** entries in `public` — `postgres` and `supabase_admin`, each with one
`r` (tables), `S` (sequences) and `f` (functions) row. (The wider figure "24" is the
total across *all* schemas: `public`, `storage`, `extensions`, `graphql`,
`graphql_public`, `realtime`, `auth` — see the F-A16 integration verification doc.
This `public`-scoped query returns 6, not 24.) Note which owners appear — they are the
candidate set the automated migration enumerates.

### 3. Can the applying role act for each `public` default-ACL owner?

```sql
SELECT DISTINCT pg_get_userbyid(d.defaclrole) AS candidate_owner,
       pg_has_role(current_user, d.defaclrole, 'MEMBER') AS applier_may_act_for_it
  FROM pg_default_acl d
 WHERE d.defaclnamespace = 'public'::regnamespace
 ORDER BY 1;
```

If any row is `false`, that owner's `public` defaults are **out of scope** for the
automated F-A16-02 migration (the applying role cannot act for it), which reports it and
proceeds. On hosted Supabase, `supabase_admin` is such an owner: the 2026-11-05 inventory
found no `supabase_admin`-owned object in `public`, so no customer object is affected. The
owner-run defaults file is retained for reference / a platform-assisted path only.

### 4. Roles that effectively hold `CREATE` on `public` — the creator inventory

```sql
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create
  FROM pg_roles r
 WHERE has_schema_privilege(r.oid, 'public', 'CREATE')
 ORDER BY 1;
```

This is the second half of the F-A16-02 creator inventory (class B — creators that own no
default ACL of their own; see the migration header §2). The migration now enumerates this
class too and emits a `RAISE NOTICE` naming them, but it does not revoke for them (there is
no default privilege to change) and does not fail closed on them. Read this list so the
owner-run step can decide whether any of them needs attention. If `anon`, `authenticated`
or `service_role` appear, the migration will **refuse** (section 0c) — that is a
misconfiguration to fix first.

### 5. Global (`ns = 0`) default ACLs

```sql
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
  FROM pg_default_acl d, aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 0
 ORDER BY 1, 2, 3, 4;
```

Expected: **empty** (the 2026-11-03 audit found 0). If a row names `PUBLIC`/`anon`/
`authenticated` on tables or sequences, or `TRUNCATE`/`TRIGGER`/`REFERENCES` for
`service_role` on tables, the migration **will refuse** — see the owner-run file §4 for the
(owner-reviewed) global remedy.

### 6. The live per-table privilege matrix

```sql
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
 ORDER BY 1, 2, 3;
```

Save this. It is the "before" for §Post-execution, and it is what the deferred Phase B
(plan §4.4) needs.

### 7. `BEFORE TRUNCATE` guard tables

```sql
SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_trigger t ON t.tgrelid = c.oid AND NOT t.tgisinternal
 WHERE n.nspname = 'public' AND (t.tgtype & 2) = 2 AND (t.tgtype & 32) = 32
 ORDER BY 1;
```

Expected: `audit_log`, `day_closes`, `receipt_number_gaps`, `receipt_series_years`,
`seva_orders`, `seva_rate_history`, `seva_receipt_lines`, `seva_receipts`, `staff`. Each of
these keeps its guard after F-A16-01: a `BEFORE TRUNCATE` trigger fires for the table owner
and for a superuser as well as for a non-owner holding `TRUNCATE` (measured on PostgreSQL
17/18), so the guard does not depend on any role keeping `TRUNCATE`. F-A16-01 therefore
revokes `TRUNCATE` from **every** role here — there is no exception (matrix §2.1).

### 8. The four public-read policies

```sql
SELECT tablename, policyname, cmd, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('events', 'aaradhanes', 'site_settings', 'social_links')
   AND cmd IN ('SELECT', 'ALL')
 ORDER BY 1, 2;
```

Expected: at least one non-`false` `SELECT` policy per table. The F-A16-01 post-condition
fails if one is missing.

### 9. The RLS enabler (for F-A16-03)

```sql
SELECT e.evtname, e.evtenabled, e.evtfoid::regprocedure AS function_called
  FROM pg_event_trigger e
 WHERE e.evtevent = 'ddl_command_end'
 ORDER BY e.evtname;
```

Expected: `ensure_rls` present and enabled. F-A16-03 refuses to install otherwise.

### 10. Confirm the target

Before applying, confirm the project ref and that this is the intended production project.
The `supabase-migrations.yml` workflow has a project-ref guard; if applying via
`supabase db push`, verify `supabase/.temp/project-ref` or the linked project.

### 11. Can the applying role create event triggers?

```sql
SELECT current_user AS applying_role,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
       EXISTS (SELECT 1 FROM pg_event_trigger) AS has_event_triggers,
       (SELECT count(*) FROM pg_extension WHERE extname = 'supautils') AS supautils_installed;
```

`CREATE EVENT TRIGGER` is superuser-only in stock PostgreSQL. Supabase's `postgres` role is
not a superuser; it can create event triggers only through the platform `supautils`
extension. This check tells the operator whether the two event-trigger artifacts
(`f_a16_public_fn_guard`, `f_a16_assert_public_rls`) can install:

* `is_superuser = true`, or `supautils_installed = 1`, or `has_event_triggers = true` — the
  platform path is present; the event-trigger migrations should install.
* all false/0 — the platform path is **not** confirmed. Do **not** assume; either confirm
  with the platform or plan an owner-run path. A `CREATE EVENT TRIGGER` failure aborts the
  migration (fail closed), so it cannot silently half-apply.

The repository's test suite runs as a superuser and cannot load `supautils`, so it proves
the SQL but **not** this platform path. Treat this step as mandatory.

---

## Execution

**NOT EXECUTED.** Only an owner runs these.

1. **Automated migrations.** On the normal path, `supabase db push` applies the five
   migrations in filename order (14990000, 15000000, 15000100, 15000200, 15000300). On
   hosted Supabase the F-A16-02 migration now **applies** (it treats `supabase_admin` as
   out of scope rather than failing closed), and F-A16-07 revokes `EXECUTE` on the two
   existing functions. No owner-run step is required for this path.

2. **(Optional) owner-run steps.** The two `docs/audits/F-A16_OWNER_RUN_*.sql` files are
   **retained for reference / a platform-assisted path** and are **not required** for the
   customer path: `supabase_admin` is a platform-internal role the customer `postgres`
   cannot act for, and the 2026-11-05 inventory found no `supabase_admin`-owned object in
   `public`. Run them only if the platform provides the superuser capability.

3. **Global defaults.** Only if preflight step 5 finds a global entry **owned by the
   applying role**: run the owner-run defaults file §4 (global form). Its blast radius is
   every schema — treat it as a separate change with its own review. A global entry owned
   by `supabase_admin` is out of scope.

4. **Verify.** Run §Post-execution A/B/D and the smoke test.

---

## Post-execution verification (read-only)

**NOT EXECUTED.**

### A. F-A16-02 / 02b — default privileges

```sql
-- No public-facing grantee may remain in any public default ACL (the owner self-entry is
-- excluded, as it is inherent and cannot be revoked).
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
  FROM pg_default_acl d, aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 'public'::regnamespace
   AND a.grantee <> d.defaclrole
   AND (
        (d.defaclobjtype IN ('r','S')
          AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated')))
     OR (d.defaclobjtype = 'r'
          AND pg_get_userbyid(a.grantee) = 'service_role'
          AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES'))
     OR (d.defaclobjtype = 'f'
          AND pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
   );
```

Expected: **empty**. A `PUBLIC` function entry (`grantee = 0`, objtype `f`) is *not* a
failure — the implicit `PUBLIC` EXECUTE is closed forward by the guard, not by the
migration.

```sql
-- No global default may have been created by the change.
SELECT count(*) FROM pg_default_acl WHERE defaclnamespace = 0;
```

Expected: `0`.

```sql
-- The forward guard is installed and enabled.
SELECT evtname, evtenabled FROM pg_event_trigger WHERE evtname = 'f_a16_public_fn_guard';
```

Expected: one row, `evtenabled = 'O'` (enabled).

```sql
-- Behavioural proof: a new public function is not anon-executable, but service_role can.
CREATE FUNCTION public.f_a16_verify_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';
SELECT has_function_privilege('anon', 'public.f_a16_verify_fn()', 'EXECUTE') AS anon,
       has_function_privilege('service_role', 'public.f_a16_verify_fn()', 'EXECUTE') AS svc;
DROP FUNCTION public.f_a16_verify_fn();
```

Expected: `anon = false`, `svc = true`.

### B. F-A16-01 — existing table privileges

```sql
-- No public-facing role may hold TRUNCATE/REFERENCES/TRIGGER. No exception: service_role
-- loses all three too (the earlier "keep TRUNCATE on guarded tables" exception was removed
-- because a BEFORE TRUNCATE trigger fires for the owner and superusers anyway).
SELECT c.relname, r.rolname, p.priv
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r','p')
   AND has_table_privilege(r.rolname, c.oid, p.priv)
 ORDER BY 1, 2, 3;
```

Expected: **empty**.

```sql
-- PUBLIC must not hold any of the three either.
SELECT c.relname, p.priv
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
 WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
   AND has_table_privilege('public', c.oid, p.priv)
 ORDER BY 1, 2;
```

Expected: **empty**.

```sql
-- service_role keeps DML everywhere.
SELECT count(*) AS tables_missing_svc_dml
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
   AND NOT (has_table_privilege('service_role', c.oid, 'SELECT')
        AND has_table_privilege('service_role', c.oid, 'INSERT')
        AND has_table_privilege('service_role', c.oid, 'UPDATE')
        AND has_table_privilege('service_role', c.oid, 'DELETE'));
```

Expected: `0`.

```sql
-- The four public-read tables keep SELECT for anon and authenticated, and their policy.
SELECT t.relname,
       has_table_privilege('anon', t.oid, 'SELECT')          AS anon_select,
       has_table_privilege('authenticated', t.oid, 'SELECT') AS auth_select
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
 WHERE n.nspname = 'public'
   AND t.relname IN ('events','aaradhanes','site_settings','social_links')
 ORDER BY 1;
```

Expected: both `true` on every row.

### C. F-A16-07 — existing function privileges

```sql
-- Neither internal function may be executable by anon/authenticated, and service_role must
-- keep EXECUTE.
SELECT p.oid::regprocedure AS fn,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS svc
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('rls_auto_enable', 'update_updated_at_column')
 ORDER BY 1;
```

Expected: `anon = false`, `auth = false`, `svc = true` for both rows.

### D. Smoke test the application

* Load the four public pages (events, aaradhane, settings-driven pages, social links) and
  confirm they render rows.
* Perform one admin write through the dashboard (service-role path) and confirm it
  succeeds.
* Run one seva RPC through the admin UI.
* Update any row carrying an `update_updated_at` trigger and confirm `updated_at` advances.

### E. F-A16-03 — RLS assertion

```sql
SELECT evtname, evtenabled FROM pg_event_trigger WHERE evtname = 'f_a16_assert_public_rls';
```

Expected: present and enabled.

---

## Rollback

**NOT EXECUTED.** Roll each part back independently; see the remediation plan §7 for the
rationale.

### F-A16-02 — restore the platform defaults

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
-- Repeat FOR ROLE supabase_admin if the owner-run step ran.
```

### F-A16-02b — drop the forward guard

```sql
DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard;
DROP FUNCTION IF EXISTS public.f_a16_public_fn_guard();
```

### F-A16-07 — restore the two function grants

```sql
-- Restores the pre-migration over-grant exactly (this is the point of a rollback).
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC, anon, authenticated;
```

### F-A16-03 — drop the assertion

```sql
DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls;
DROP FUNCTION IF EXISTS public.f_a16_assert_public_rls();
```

### F-A16-01 — restore the three privileges

```sql
-- Restores the pre-migration over-grant exactly (this is the point of a rollback): all
-- three privileges to all three roles. There is no exception to reproduce — the migration
-- had no exception either.
GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
-- Then re-run the pre-existing seva hardening so the guarded tables return to their
-- pre-F-A16 state (TRIGGER/REFERENCES revoked on seven tables; DELETE/TRUNCATE revoked from
-- service_role on receipt_number_gaps, receipt_series_years):
REVOKE TRIGGER, REFERENCES ON TABLE audit_log, staff, seva_rate_history, seva_orders,
  seva_receipts, seva_receipt_lines, day_closes FROM service_role, anon, authenticated;
REVOKE DELETE, TRUNCATE ON TABLE receipt_number_gaps, receipt_series_years FROM service_role;
```

### Rollback verification

After any rollback, re-run §Post-execution A/B for the part rolled back and confirm the
matrix matches the pre-change state from preflight step 6. No DML and no policy is restored,
because none was changed.

---

## What this change did NOT do

* No production connection, no DDL, no DML, no `GRANT`/`REVOKE` was executed.
* No migration was applied or dispatched.
* No RLS policy, role, environment variable or workflow was changed.
* No Supabase Auth object was read or written.
