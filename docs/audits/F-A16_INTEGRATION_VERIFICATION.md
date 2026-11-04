# F-A16 — Integration verification (real PostgreSQL / Supabase role model)

**Status:** verification performed 2026-11-04 against a **disposable** local Supabase
image. The migrations remain **PROPOSED / NOT APPLIED** in production.
**PRODUCTION DATABASE NOT ACCESSED. NO PRODUCTION CHANGES EXECUTED. PR NOT MERGED.**

This document is the evidence behind the F-A16-02b guard's fail-closed message and the
F-A16-02 convergence correction. It exists because PGlite runs as a superuser and cannot
reproduce the Supabase privilege path; every claim below is labelled with the environment
that produced it.

---

## 1. Test environment architecture

| Property | Value |
| --- | --- |
| Engine | PostgreSQL 15.19 (`supabase/postgres:15.19.0.018`), x86_64 Linux |
| Image | Official Supabase Postgres image (the same image `supabase start` uses for the local stack) |
| `supautils` | **Present** — the image loads it; this is what lets a non-superuser `postgres` create event triggers |
| `shared_preload_libraries` | `pg_stat_statements, pgaudit, plpgsql, plpgsql_check, pg_cron, pg_net, pgsodium, timescaledb, auto_explain, pg_tle, plan_filter, supabase_vault` |
| Connection | `pg` (node-postgres) over TCP, `127.0.0.1`, disposable container port |
| Disposable DB name | `fa16_test` (matches the `test`/`fa16` guard in the harness) |
| Production access | **none** — no production URL, password, token or project ref was used |

Two roles connect:

* **`admin`** — `postgres`, the non-superuser role the production migrations run as.
* **`super`** — `supabase_admin`, the superuser, used **only** for the owner-run step and
  environment prep. It never applies the migrations.

Reference runs also used a **stock `postgres:17.5` / `17.11`** image and a Supabase image
with `supautils` removed, to isolate the superuser residual (section 9).

### Role model reproduced

| Role | `rolsuper` | `rolcanlogin` | `rolbypassrls` | Notes |
| --- | --- | --- | --- | --- |
| `postgres` | **false** | true | true | migration applier; `rolcreaterole`, `rolcreatedb` |
| `supabase_admin` | **true** | true | true | platform superuser |
| `anon` | false | false | false | |
| `authenticated` | false | false | false | |
| `service_role` | false | false | true | |

Memberships (measured): `postgres` is a member of `anon`, `authenticated`,
`service_role`, `pg_monitor`, `pg_read_all_data`, `pg_signal_backend`,
`supabase_privileged_role`. **`postgres` is NOT a member of `supabase_admin`** — the fact
that makes `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` fail from `postgres`.

`postgres` owns its own default ACL entries; `supabase_admin` owns separate ones in
`public` (and in `extensions`, `graphql`, `graphql_public`, `realtime`). The fresh image
defaults the database and `public` to `supabase_admin`'s ownership; the harness reassigns
the database to `postgres` and `public` to `pg_database_owner`, which is how a **real**
Supabase project is configured (otherwise `postgres` cannot create in `public`).

---

## 2. How to start and destroy the isolated environment

```bash
# Start a disposable Supabase-Postgres container.
docker run -d --name fa16-pgtest \
  -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=fa16_test \
  -p 55432:5432 supabase/postgres:15.19.0.018
sleep 15

# Run the real-PostgreSQL integration suite.
FA16_ALLOW_DISPOSABLE_DB=1 \
FA16_TEST_DB_URL="postgresql://postgres:testpass@127.0.0.1:55432/fa16_test" \
  npm run test:db:integration

# Destroy it. Nothing persists.
docker rm -f fa16-pgtest
```

The harness **refuses to run** unless the target is positively identified as disposable:
`FA16_ALLOW_DISPOSABLE_DB=1` must be set, the URL must be localhost or a name containing
`test`/`fa16`/`disposable`/`scratch`, and the URL must not contain `SUPABASE_PROJECT_REF`.
It never logs the connection string or any password.

---

## 3. Exact versions

* PostgreSQL **15.19** (Supabase image `postgres:15.19.0.018`).
* Contrast runs: stock **PostgreSQL 17.5 / 17.11**, and the same Supabase image with
  `supautils` absent from `shared_preload_libraries`.
* Extensions present: `plpgsql`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`.
* `supautils` present (loaded, not a `pg_extension` row — it is a shared library).

---

## 4. Role and membership setup

Reproduced by the harness `beforeAll`:

1. `anon`, `authenticated`, `service_role` created if missing (the image provides them).
2. `USAGE` on `public` granted to the three public-facing roles.
3. The database reassigned to `postgres`, `public` to `pg_database_owner` — matching a
   real project, where `postgres` has the implicit `CREATE` on `public`.
4. Disposable login roles `fa16_owner_member` and `fa16_rogue_owner` created with
   passwords, granted `USAGE, CREATE` on `public`. `fa16_owner_member` is additionally
   granted to `postgres` for the "guard can manage" case.

---

## 5. SQL test scenarios and results

Legend: **PASS** = demonstrated in the isolated real PostgreSQL/Supabase environment;
**FAIL** = behaviour did not meet the requirement; **BLOCKED** = environment could not
verify; **NOT TESTED** = not executed.

### Test A — F-A16-02b event trigger

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| A.1 | Function created by `postgres` | **PASS** | `proacl = {postgres=X/postgres,service_role=X/postgres}`; `has_function_privilege` anon=false, auth=false, svc=true; owner executes it |
| A.2 | Function created by a role the guard owner is a member of | **PASS** | anon=false, auth=false, svc=true |
| A.3 | Function created by a role the guard **cannot** manage | **PASS** | `CREATE` fails; `F-A16-02b: could not revoke EXECUTE on public.fa16_a3_fn() …`; no function survives |
| A.4 | Function outside `public` | **PASS** | implicit PUBLIC EXECUTE remains (anon=true) — guard did not run |
| A.5 | `CREATE OR REPLACE` in `public` | **PASS** | guard re-runs; anon=false, auth=false, svc=true |
| A.6 | Procedure in `public` | **PASS** | created; anon=false, svc=true (`ON ROUTINE`, not `ON FUNCTION`) |
| A.7 | Transaction safety on guard failure | **PASS** | the `CREATE` aborts; the function does not survive |
| A.8 | Event-trigger permissions | **PASS** | see below |

**A.8 details.** On the Supabase image `postgres` is **not** a superuser
(`rolsuper = false`) yet **successfully creates the event trigger** — the trigger is owned
by `postgres`, enabled (`O`), and the guard function is `SECURITY DEFINER` with
`proconfig = {search_path=pg_catalog}`. This is the `supautils` path: stock PostgreSQL
returns `permission denied to create event trigger` / `Must be superuser to create an
event trigger` for the same role (measured on PostgreSQL 17.11). So Supabase's managed
permissions **do** allow the installation, and the guard remains enabled. This is the
one behaviour that PGlite cannot prove and that this environment does.

### Test B — F-A16-02 owner-specific default privileges

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| B.1 | Initial owner state | **PASS** | 24 schema-scoped default-ACL entries; 6 in `public`; `postgres` and `supabase_admin` each own separate `public` rows |
| B.2 | F-A16-02 as `postgres` | **PASS** | fails closed: `F-A16-02: cannot tighten default privileges for object-creating role(s): supabase_admin`; `pg_default_acl` byte-identical afterwards (atomic rollback) |
| B.3 | Owner-run as `supabase_admin` | **PASS** | anon/authenticated gone from tables/sequences/functions in `public`; no PUBLIC entry on tables; `service_role` keeps DML, loses TRUNCATE/REFERENCES/TRIGGER |
| B.4 | New objects as `supabase_admin` | **PARTIAL** | tables/sequences follow the model; a **function** created by the superuser keeps PUBLIC EXECUTE — the documented residual (section 9) |
| B.5 | Idempotency | **PASS** | the owner-run is a no-op on re-run; F-A16-02 re-runs cleanly and converges |
| B.6 | Unauthorized owner operation | **PASS** | fails safely (`must be member of role "supabase_admin"`); default ACL unchanged |

**Convergence (the F-A16-02 correction).** Before the correction, re-running F-A16-02
after the owner-run failed closed again on `supabase_admin` purely because `postgres`
is still not a member of it — the documented "owner-run, then re-run" workflow never
converged. The correction makes the non-member branch re-read `supabase_admin`'s public
default ACL: a role that **still leaks** is failed closed on (unchanged); a role the
owner-run has **already remediated** is reported as converged. Demonstrated in B.2 → B.3
→ B.5: fail closed, owner-run, then two clean re-runs.

---

## 6. SQLSTATE and error messages for expected failures

| Case | Error | SQLSTATE |
| --- | --- | --- |
| A.3 / A.7 guard cannot manage the routine | `F-A16-02b: could not revoke EXECUTE on public.fa16_a3_fn() from anon/authenticated; the guard owner cannot manage the routine, so it would remain world-executable` | `P0001` (raised exception) |
| B.2 F-A16-02 cannot act for `supabase_admin` | `F-A16-02: cannot tighten default privileges for object-creating role(s): supabase_admin` | `P0001` |
| B.6 non-member `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` | `must be member of role "supabase_admin"` | `42501` (`insufficient_privilege`) |
| A.8 stock PostgreSQL, non-superuser event trigger | `permission denied to create event trigger "…"` / `Must be superuser to create an event trigger.` | `42501` |

---

## 7. Effective ACL evidence before and after

**A.1 — the guard's effect on a `postgres`-created function (effective privilege, not just `pg_default_acl`):**

```
 proname |  owner   |                  proacl                    | anon | auth | svc
---------+----------+--------------------------------------------+------+------+-----
 ev_pg   | postgres | {postgres=X/postgres,service_role=X/postgres} | f  |  f   |  t
```

**B.4 — a function created by the superuser `supabase_admin` (the residual):**

```
 proname |     owner      |                                          proacl                                              | anon | auth | svc
---------+----------------+---------------------------------------------------------------------------------------------+------+------+-----
 ev_su   | supabase_admin | {=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,service_role=X/supabase_admin} |  t  |  t   |  t
```

The leading `=X/supabase_admin` is the implicit **PUBLIC** EXECUTE. `anon` and
`authenticated` have no direct grant, but `has_function_privilege` is true for both
through PUBLIC.

**B.3 — `supabase_admin` public defaults after the owner-run:** no `anon=` /
`authenticated=` entry on tables, sequences or functions; no PUBLIC entry on tables;
`service_role` retains `arwd` (SELECT/INSERT/UPDATE/DELETE) and loses `T` (TRUNCATE).

---

## 8. Supabase-specific limitations

* **`supautils` cannot be loaded by the PGlite suite**, so PGlite proves the *SQL*
  (scoping, `ON ROUTINE`, fail-closed, `service_role` preservation, rollback) but not the
  Supabase privilege path. The Supabase image here **does** prove it (A.8).
* The production `postgres` role's ability to create event triggers depends on
  `supautils` being configured as it is in the image. The image matches; a project whose
  `supautils` configuration differs would need preflight confirmation.
* The fresh image's default ownership (`supabase_admin` owns the database and `public`)
  differs from a real project (`postgres` owns them). The harness corrects this before
  testing; the difference is recorded because it is not obvious.

---

## 9. The superuser residual (A.3 variant / B.4)

**A function created by the superuser `supabase_admin` is not covered by the guard.**

Measured: a `CREATE FUNCTION` executed by `supabase_admin` **does not fire the event
trigger at all**, so the implicit PUBLIC EXECUTE survives (section 7, `ev_su`).

Cause (isolated by contrast):

| Environment | Does the trigger fire for a superuser creator? |
| --- | --- |
| Supabase image **with** `supautils` | **No** |
| Supabase image **without** `supautils` | **Yes** |
| Stock PostgreSQL 17.11 | **Yes** |

So this is **not** "event triggers never fire for superusers". It is Supabase's
`supautils` privileged-DDL path: privileged DDL runs in a non-`origin` replication role,
and a default (`ENABLE ORIGIN`) event trigger does not fire in that mode. A plain
non-superuser `postgres` DDL is unaffected — which is why every other test passes.

**Why this is not closed here.** The guard never sees the statement, so there is nothing
for it to revoke. `ALTER EVENT TRIGGER … ENABLE ALWAYS` was tested and does **not** help.
Closing the gap needs a different mechanism (for example, a superuser-run remediation for
objects `supabase_admin` creates, or a policy that only `postgres` creates functions in
`public`). That is out of scope for F-A16-02b, so it is **recorded, not papered over**.

**Practical impact.** `anon` and `authenticated` cannot *reach* a function owned by
`supabase_admin` through PostgREST (schema exposure + no `USAGE`/grant path without an
explicit grant), so the reachable privilege is `service_role`, which is already
trusted-by-design for RPC. The residual is therefore low severity, but it is a real gap
and must not be described as "all public functions are locked down".

---

## 10. Implementation changes made as a result

1. **Guard fail-closed re-check** (`20261114990000_f_a16_public_function_execute_guard.sql`).
   The `REVOKE` a role may not perform only WARNS (`no privileges could be revoked`) and
   leaves the routine world-executable — it does **not** raise. The guard now re-reads
   `has_function_privilege('anon'|'authenticated', …)` after the revoke and RAISES if the
   grant survived. This is the A.3/A.3b defect. Security impact: without it, a function
   created by an unmanageable owner would remain world-executable **silently**.
2. **F-A16-02 §3c over-reach fix** (`20261115000000_f_a16_least_privilege_defaults.sql`).
   The old post-condition asserted *absence* of non-public default ACLs. A stock Supabase
   database has 24 schema-scoped entries, 9 of them non-`public` and naming
   `anon`/`authenticated` (`storage`, `graphql`, `graphql_public`, …), so the assertion
   failed on a correct project. It is now a **diff** against a pre-migration snapshot:
   it fails only if *this migration* added a non-public public-facing default.
3. **F-A16-02 convergence fix.** A non-member role whose public default ACL no longer
   leaks is reported as converged rather than failed closed on, so the documented
   "owner-run, then re-run" workflow terminates. A leaking role still aborts. Implemented
   inline (no helper object), preserving the file's "changes only default privileges"
   invariant.

---

## 11. Production-readiness recommendation

**Conditional PASS for the two migrations, with one documented residual.**

* F-A16-02b (guard) — **PASS** in the isolated Supabase environment for every creator the
  guard can manage (`postgres`, members), fails closed otherwise. The superuser residual
  is recorded, low severity, and out of scope.
* F-A16-02 (defaults) — **PASS** for the applying role; the owner-run step is required for
  `supabase_admin` and the migration now **converges** after it.
* **Preflight must still confirm**, on the production project, that `postgres` may create
  event triggers (the image says yes; a project's `supautils` config governs it). If it
  cannot, the guard migration fails closed with a clear error — which is the intended
  signal, not a silent no-op.

No change weakens a security check. The guard change makes it strictly stronger
(fail-closed); the F-A16-02 changes fix false failures and a non-terminating workflow
without relaxing any real assertion.

---

## 12. Reproduce

```bash
npm run test:db                 # PGlite (in-process; does NOT prove the Supabase path)
npm run test:db:integration     # real PostgreSQL; needs FA16_TEST_DB_URL + FA16_ALLOW_DISPOSABLE_DB=1
npm run test:db:integration     # all 13 scenarios above (skips if FA16_TEST_DB_URL is unset)
```
