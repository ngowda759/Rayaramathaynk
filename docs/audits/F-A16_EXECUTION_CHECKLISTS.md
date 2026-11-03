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
| `20261114990000_f_a16_public_function_execute_guard.sql` | `supabase db push` (automated) | Pure forward guard; changes no existing object. |
| `20261115000000_f_a16_least_privilege_defaults.sql` | `supabase db push` (automated), **but it fails closed** if it cannot act for every `public` default-ACL owner | Default privileges are per-owner; the platform `postgres` cannot act for `supabase_admin`. |
| `20261115000100_f_a16_fail_closed_rls_assertion.sql` | `supabase db push` (automated) | Additive assertion; refuses to install without an enabled enabler. |
| `20261115000200_f_a16_existing_table_privileges.sql` | `supabase db push` (automated) | Catalog-driven revoke of three privileges; no DML, no policy. |
| `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` | **Owner-run, manually** | The role(s) the automated migration could not act for. Run as that role, or as a superuser. |
| The global-default remediation (§4 of the owner-run file) | **Owner-run, manually, and only if §Preflight step 5 finds a global entry** | A global statement changes every schema. The 2026-11-03 audit found 0, so this is expected to be a no-op. |

The automated migrations are idempotent. The owner-run file is also idempotent and
re-checks its own precondition, so it cannot silently do nothing.

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

Expected: 24 entries across `postgres` and `supabase_admin`. Note which owners appear —
they are the candidate set the automated migration enumerates.

### 3. Can the applying role act for each `public` default-ACL owner?

```sql
SELECT DISTINCT pg_get_userbyid(d.defaclrole) AS candidate_owner,
       pg_has_role(current_user, d.defaclrole, 'MEMBER') AS applier_may_act_for_it
  FROM pg_default_acl d
 WHERE d.defaclnamespace = 'public'::regnamespace
 ORDER BY 1;
```

If any row is `false`, the automated F-A16-02 migration **will stop** (by design). Plan to
run `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` as the owner (or a superuser)
first, then re-run the migration. The 2026-11-03 audit says `supabase_admin` is such an
owner.

### 4. Roles that effectively hold `CREATE` on `public`

```sql
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create
  FROM pg_roles r
 WHERE has_schema_privilege(r.oid, 'public', 'CREATE')
 ORDER BY 1;
```

These are **not** enumerated by the migration (their tables are owner-only and their
functions are covered by the forward guard). Read this so the owner-run step can decide
whether to cover them too. If `anon`, `authenticated` or `service_role` appear, the
migration will **refuse** (section 0c) — that is a misconfiguration to fix first.

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
`authenticated` on tables or sequences, or `TRIGGER`/`REFERENCES` for `service_role` on
tables, the migration **will refuse** — see the owner-run file §4 for the (owner-reviewed)
global remedy.

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
`seva_orders`, `seva_rate_history`, `seva_receipt_lines`, `seva_receipts`, `staff`. These
are the tables where `service_role` keeps `TRUNCATE`.

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

---

## Execution

**NOT EXECUTED.** Only an owner runs these.

1. **Automated migrations.** On the normal path, `supabase db push` applies the four
   migrations in filename order. F-A16-02 is expected to stop with
   `F-A16-02: cannot tighten default privileges for object-creating role(s): supabase_admin`.
   That is the intended fail-closed behaviour, not a failure of the change.

2. **Owner-run step.** Run `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` as
   `supabase_admin` (or as a superuser). It re-checks `pg_has_role` and raises if the
   operator still cannot act.

3. **Re-run F-A16-02.** With the owner's defaults tightened, the migration should now pass
   its section 2 loop and its post-condition.

4. **Global defaults.** Only if preflight step 5 found an entry: run the owner-run file §4
   (global form). Its blast radius is every schema — treat it as a separate change with its
   own review.

5. **F-A16-01.** Applies automatically in step 1; verify in §Post-execution.

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
          AND a.privilege_type IN ('TRIGGER','REFERENCES'))
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
-- No public-facing role may hold TRUNCATE/REFERENCES/TRIGGER, except service_role's
-- TRUNCATE on a BEFORE TRUNCATE-guarded table.
SELECT c.relname, r.rolname, p.priv
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS p(priv)
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r','p')
   AND has_table_privilege(r.rolname, c.oid, p.priv)
   AND NOT (
        r.rolname = 'service_role' AND p.priv = 'TRUNCATE'
        AND EXISTS (SELECT 1 FROM pg_trigger t
                     WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
                       AND (t.tgtype & 2) = 2 AND (t.tgtype & 32) = 32)
   )
 ORDER BY 1, 2, 3;
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

### C. Smoke test the application

* Load the four public pages (events, aaradhane, settings-driven pages, social links) and
  confirm they render rows.
* Perform one admin write through the dashboard (service-role path) and confirm it
  succeeds.
* Run one seva RPC through the admin UI.

### D. F-A16-03 — RLS assertion

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

### F-A16-03 — drop the assertion

```sql
DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls;
DROP FUNCTION IF EXISTS public.f_a16_assert_public_rls();
```

### F-A16-01 — restore the three privileges

```sql
GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
-- Then re-run the pre-existing seva hardening so the guarded tables stay tight:
REVOKE TRIGGER, REFERENCES ON TABLE audit_log, staff, seva_rate_history, seva_orders,
  seva_receipts, seva_receipt_lines, day_closes FROM service_role, anon, authenticated;
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
