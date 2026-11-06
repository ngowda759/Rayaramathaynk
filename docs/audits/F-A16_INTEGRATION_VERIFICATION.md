# F-A16 — Integration verification (real PostgreSQL / Supabase role model)

**Status:** the migrations **exist** and are **fully tested locally** — verification
performed 2026-11-04 against a **disposable** local Supabase image, and **re-run 2026-11-05**
against a fresh disposable container to verify the F-A16-02 scope redesign and the new
F-A16-07 migration. **They were APPLIED TO PRODUCTION on 2026-11-06 and verified read-only
afterwards** — see `docs/audits/F-A16_PRODUCTION_VERIFICATION_2026-11-06.md` for the
post-application evidence (items 1, 2, 4 and 5 PASS; the `supabase_admin` default-privilege
residual R-1 remains open and platform-side).

This document is the evidence behind the F-A16-02b guard's fail-closed message and the
F-A16-02 hosted-Supabase scope correction (2026-11-05). It exists because PGlite runs as a
superuser and cannot reproduce the Supabase privilege path; every claim below is labelled
with the environment that produced it.

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

### 2.1 The 2026-11-05 re-run (this document's current evidence)

> **Provenance.** This is a LOCAL, disposable-container re-run — not a production read.
> The phrase "2026-11-05" is a date stamp for the local re-run and the scope-correction
> commit, **not** a production inventory. There is no "2026-11-05 read-only production
> inventory": no such run, artifact or commit exists. See §10 for the evidence layers.

Executed in the OpenHands sandbox against a freshly started container of the same image:

```bash
sudo dockerd > /tmp/docker.log 2>&1 &
sudo docker pull supabase/postgres:15.19.0.018
sudo docker run -d --name fa16-pgtest \
  -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=fa16_test \
  -p 55432:5432 supabase/postgres:15.19.0.018
FA16_ALLOW_DISPOSABLE_DB=1 \
FA16_TEST_DB_URL="postgresql://postgres:testpass@127.0.0.1:55432/fa16_test" \
  npm run test:db:integration
```

Result: **1 suite, 17 tests, all passed** (`tests/db/integration/f-a16.integration.test.ts`).
Measured environment facts (from the live container, not assumed):

| Fact | Value |
| --- | --- |
| `server_version` | `15.19` |
| `shared_preload_libraries` | `pg_stat_statements, pgaudit, plpgsql, plpgsql_check, pg_cron, pg_net, pgsodium, timescaledb, auto_explain, pg_tle, plan_filter, supabase_vault` |
| `postgres.rolsuper` | `false` |
| `supabase_admin.rolsuper` | `true` |
| `postgres` memberships | `anon, authenticated, pg_monitor, pg_read_all_data, pg_signal_backend, service_role, supabase_privileged_role` (NOT `supabase_admin`) |
| `pg_default_acl` rows | 24 |
| `public` default-ACL owners | `postgres`, `supabase_admin` |

The last two rows reproduce the production audit's owner split exactly (24 schema-scoped
entries; `postgres` and `supabase_admin` each own separate `public` rows). `supautils` is
present as a shared library (not a `pg_extension` row), which is what lets the non-superuser
`postgres` create the event trigger (A.8).

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
3b. The platform's `public` default ACLs reproduced for both object-creating roles
   (`postgres` and `supabase_admin`), from the image's own
   `docker-entrypoint-initdb.d/init-scripts/00000000000000-initial-schema.sql`:
   `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES/FUNCTIONS/SEQUENCES TO
   postgres, anon, authenticated, service_role`. **This matters.** The image applies it at
   cluster init, so a database created later with `CREATE DATABASE` does **not** inherit it.
   Without this step a newly created function carries no explicit `anon`/`authenticated`
   EXECUTE, the guard has nothing to remove, and the tests would pass vacuously while no
   longer exercising the real starting state. (This was a defect in the first harness
   revision, found and fixed during this verification — see §9.)
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

> **Redesign note (2026-11-05).** The rows below were first measured against the
> fail-closed design. The migration was then revised so that an owner the applying role
> may not act for is **out of scope** (reported via `RAISE NOTICE`), not failed closed on,
> because the customer `postgres` can never act for the platform-internal `supabase_admin`.
> Whether any object exists under `supabase_admin`'s `public` defaults is **UNRESOLVED**
> (see §10): no production catalog read has established it, and there is **no
> "2026-11-05 read-only production inventory"** — no such run, artifact or commit exists.
> The revised behaviour is verified in the PGlite suite
> (`tests/db/f-a16-least-privilege.test.ts`) and the integration suite Test B.

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| B.1 | Initial owner state | **PASS** | 24 schema-scoped default-ACL entries; 6 in `public`; `postgres` and `supabase_admin` each own separate `public` rows |
| B.2 | F-A16-02 as `postgres` (revised) | **PASS** | applies; `supabase_admin` is reported via `RAISE NOTICE` and left untouched; `postgres`'s own `public` defaults carry no public-facing grantee |
| B.3 | Owner-run as `supabase_admin` (optional) | **PASS** | if the owner runs it: anon/authenticated gone from tables/sequences/functions in `public`; no PUBLIC entry on tables; `service_role` keeps DML, loses TRUNCATE/REFERENCES/TRIGGER |
| B.4 | New objects as `supabase_admin` | **PASS (with owner-run guard file)** | tables/sequences follow the model; a **function** created by the superuser keeps PUBLIC EXECUTE under the `postgres`-owned guard alone (section 9) — the owner-run `supabase_admin`-owned guard closes it (`anon=false auth=false svc=true`) |
| B.5 | Idempotency | **PASS** | the migration re-runs cleanly and converges (revoking an unheld privilege is a no-op) |
| B.6 | Unauthorized owner operation | **PASS** | fails safely (`must be member of role "supabase_admin"`); default ACL unchanged |
| B.7 | Owner-run `supabase_admin` guard (optional) | **PASS** | with the `postgres`-owned guard alone, a `supabase_admin`-created function is `anon=t auth=t`; after the owner-run guard, `anon=f auth=f svc=t` |

**Hosted-Supabase convergence (the 2026-11-05 correction).** The original design failed
closed on any `public` default-ACL owner the applying role could not act for. On hosted
Supabase that is a permanent state for `supabase_admin`, so F-A16-02 could never apply and
`supabase db push` could not complete. The revised design reports such an owner (out of
scope) and proceeds, while still verifying — and failing closed on — the
customer-controllable state: every `public` default ACL owned by the applying role or a
role it may act for. Demonstrated in PGlite: an applier that is not a member of
`supabase_admin` applies the migration, its own defaults are tightened, and
`supabase_admin`'s defaults are unchanged.

### Test C — F-A16-07 existing-function EXECUTE lockdown

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| C.1 | `rls_auto_enable` / `update_updated_at_column` before → after, owner = `postgres` | **PASS** | before `anon=true auth=true svc=true pub=true`; after `anon=false auth=false pub=false`, `service_role` keeps `svc=true`, owner keeps EXECUTE |
| C.2 | a trigger calling `update_updated_at_column` still fires | **PASS** | `BEFORE UPDATE` trigger runs as the function owner; `updated_at` advances |
| C.3 | idempotent, and fails closed when a target is absent | **PASS** | second apply is a no-op; absent target → `F-A16-07: expected function(s) not found: public.update_updated_at_column()` (`P0001`) |
| C.4 | target owned by a role `postgres` may not act for (B-1) | **PASS (fails closed, atomically)** | `rls_auto_enable` owned by `supabase_admin`: migration raises `F-A16-07: cannot change EXECUTE on target function(s) owned by a role this session may not act for: … (owner supabase_admin)` (`P0001`) and revokes **neither** target |
| C.5 | target owner is manageable (`postgres`) (B-1) | **PASS** | `pg_has_role(postgres, proowner, 'MEMBER')` true → migration applies; `anon=false auth=false svc=true` |

C.1–C.5 were demonstrated in the isolated real-PostgreSQL environment (C.4/C.5 added for
the B-1 ownership fix); C.1–C.3 are also covered by the PGlite behavioural suite
`tests/db/f-a16-existing-function-privileges.test.ts` (no Supabase-specific privilege path
is involved — the revoke is a plain owner `REVOKE`).

---

## 6. SQLSTATE and error messages for expected failures

| Case | Error | SQLSTATE |
| --- | --- | --- |
| A.3 / A.7 guard cannot manage the routine | `F-A16-02b: could not revoke EXECUTE on public.fa16_a3_fn() from anon/authenticated; the guard owner cannot manage the routine, so it would remain world-executable` | `P0001` (raised exception) |
| C.3 F-A16-07 target function absent | `F-A16-07: expected function(s) not found: public.update_updated_at_column()` | `P0001` |
| C.4 F-A16-07 target owned by a role the session may not act for | `F-A16-07: cannot change EXECUTE on target function(s) owned by a role this session may not act for: public.rls_auto_enable() (owner supabase_admin)` | `P0001` |
| B.6 non-member `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` | `must be member of role "supabase_admin"` | `42501` (`insufficient_privilege`) |
| A.8 stock PostgreSQL, non-superuser event trigger | `permission denied to create event trigger "…"` / `Must be superuser to create an event trigger.` | `42501` |

> **Note.** Under the revised F-A16-02 the migration no longer raises on a non-member owner,
> so there is no expected-failure SQLSTATE for that case. The `42501` above is the
> *PostgreSQL* error the customer role would get if it tried the `FOR ROLE supabase_admin`
> statement directly (B.6) — which is exactly why the migration does not attempt it.
>
> **C.4 — the ownership precondition (B-1).** A `REVOKE` a role may not perform only emits
> `WARNING: no privileges could be revoked` (SQLSTATE `01007`, `warning`) and leaves the
> function world-executable. F-A16-07 therefore resolves each target's owner and raises
> `P0001` *before* attempting the revoke, rather than trusting the warning. Measured in the
> disposable container: as `postgres`, a revoke on a `supabase_admin`-owned function warned
> and `has_function_privilege('anon', …, 'EXECUTE')` stayed `true`.

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
through PUBLIC — and, because both hold `USAGE` on `public`, the call is **reachable**
(`SET ROLE anon; SELECT public.ev_su()` succeeds). This is the gap the owner-run guard file
`supabase_admin`-owned guard closes; after it, a `supabase_admin`-created function reads
`anon=f auth=f svc=t` (section 9.3).

**B.3 — `supabase_admin` public defaults after the owner-run (optional path):** no `anon=` /
`authenticated=` entry on tables, sequences or functions; no PUBLIC entry on tables;
`service_role` retains `arwd` (SELECT/INSERT/UPDATE/DELETE) and loses `T` (TRUNCATE).

**C — F-A16-07 before/after (effective privilege).** Target owner here is `postgres`
(the manageable-owner case); production ownership of `rls_auto_enable()` is UNRESOLVED
(§10). C.4 additionally demonstrates the unmanageable-owner case failing closed.

```
                 fn                  | anon | auth | svc | pub
-------------------------------------+------+------+-----+-----
 rls_auto_enable()          (before) |  t   |  t   |  t  |  t
 update_updated_at_column() (before) |  t   |  t   |  t  |  t
 rls_auto_enable()          (after)  |  f   |  f   |  t  |  f
 update_updated_at_column() (after)  |  f   |  f   |  t  |  f
```

**C.4 — unmanageable owner (measured, disposable container):**

```
-- as postgres, target owned by supabase_admin
SELECT pg_has_role('postgres','supabase_admin','MEMBER');         -- f
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
WARNING:  no privileges could be revoked for "rls_auto_enable"     -- SQLSTATE 01007, NOT an error
SELECT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE');  -- t  (still reachable)
```

The F-A16-07 precondition detects this (`proowner` is `supabase_admin`,
`pg_has_role(current_user, proowner, 'MEMBER')` is false) and raises `P0001`, so the
migration aborts instead of reporting success while the exposure remains.

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

## 9. The superuser creator gap (A.3 variant / B.4) — reachable, and CLOSED by the owner-run step

**A function created by the superuser `supabase_admin` is not covered by the
`postgres`-owned guard.** Measured: a `CREATE FUNCTION` executed by `supabase_admin` does
**not** fire the migration's event trigger, so the implicit PUBLIC EXECUTE survives
(section 7, `ev_su`).

### 9.1 Mechanism (authoritative)

The first pass recorded the cause as `session_replication_role`. **That was wrong** — the
session replication role is `origin` at fire time for every creator in this environment
(measured directly inside the trigger). The real cause is in `supautils` itself
(supabase/supautils, `src/supautils.c`, `supautils_fmgr_hook`): it installs an `fmgr` hook
that inspects every event-trigger function about to run and replaces it with a no-op when
the executing role does not match the function's owner class:

* executing role is a **superuser** and the guard function is **not superuser-owned** →
  skipped (this case: `postgres`-owned guard, `supabase_admin` DDL);
* executing role is a **superuser** and is **not the function's owner** → skipped;
* executing role is a **reserved role** (`service_role`, `authenticated`, `anon`, …) and
  the guard function is **not superuser-owned** → skipped.

Measured firing matrix on the Supabase image, consistent with the hook:

| Guard function / trigger owner | fires for `postgres` | fires for members | fires for `supabase_admin` |
| --- | --- | --- | --- |
| `postgres` (as the migration creates it) | yes | yes | **no** |
| `supabase_admin` | yes | yes | **yes** |

`ALTER EVENT TRIGGER … ENABLE ALWAYS` does not change this — the hook is not the
`ENABLE ORIGIN` filter. Stock PostgreSQL has no such hook, so a superuser-owned trigger
there fires for every creator (measured on PostgreSQL 17.5).

### 9.2 Reachability — this is NOT `service_role`-only

**Corrected.** On a fresh Supabase database `anon` and `authenticated` hold `USAGE` on
`public`, and the implicit PUBLIC EXECUTE on a newly created function is effective for
them. Measured directly: with the guard absent, a `SECURITY DEFINER` function created by
`supabase_admin` in `public` (no explicit grant) was invoked successfully as `anon` and as
`authenticated` via `SET ROLE anon; SELECT public.<fn>()` — the same path PostgREST uses.
So a superuser-created `SECURITY DEFINER` function that reads a non-exposed table **is a
reachable privilege path for `anon`/`authenticated`**, not merely a `service_role`
concern. This raises the severity of the gap above the earlier "low" assessment.

### 9.3 Closure (supported mechanism, no global default ACL) — retained, optional

Because the executing role is a superuser, the hook's second rule applies: the guard
function must **also be superuser-owned**, and the trigger must be owned by the same
superuser. `postgres` cannot do this (`SET ROLE supabase_admin` → denied; `ALTER EVENT
TRIGGER … OWNER TO` → denied, "The owner of an event trigger must be a superuser"). The
owner-run file `docs/audits/F-A16_OWNER_RUN_supabase_admin_function_guard.sql` installs a
second guard, **owned by `supabase_admin`**, with the same body. Measured end-to-end: with
both guards installed, functions created by `postgres`, by a member, and by
`supabase_admin` all end with `anon=false auth=false svc=true`.

**Retained, optional (2026-11-05).** The customer `postgres` session cannot create this
superuser-owned guard. Whether the gap is reachable on the production project is
**UNRESOLVED**: no production catalog read has established the owner of any pre-existing
`public` function, and there is no "2026-11-05 read-only production inventory" (no such
run, artifact or commit — see §10). The file is kept for a platform-assisted path.
Pre-existing `supabase_admin`-owned functions, if any existed, are the case the F-A16-07
existing-function migration now detects and fails closed on (it refuses to claim
remediation when a target's owner cannot be acted for).

The two guards coexist deliberately: the `postgres`-owned guard (the migration) covers
ordinary creators and is the backstop if the owner-run step is skipped; the
`supabase_admin`-owned guard covers the superuser creator. `REVOKE … FROM PUBLIC, anon,
authenticated` is idempotent, so double-firing is harmless. This uses only
`ALTER DEFAULT PRIVILEGES`-free, schema-scoped, per-object REVOKEs — **no global default
ACL is introduced**, so `storage`, `graphql` and `graphql_public` are untouched.

This is why F-A16-02b is classified **PARTIAL by design in the automated migration** (it
cannot be complete without the owner-run step) and **PASS** once the owner-run step is
applied. The compensating control is the owner-run guard, plus the read-only pre-existing
query in owner-run guard file §3.

### 9.4 Two harness defects found and fixed during this verification

These are recorded because both would have made the suite pass while proving nothing.

1. **The platform `public` default ACLs were not reproduced.** The harness recreated the
   test database with `CREATE DATABASE`, which does **not** inherit the default ACLs the
   image installs at cluster init (`00000000000000-initial-schema.sql`). Without them a
   newly created function carries no explicit `anon`/`authenticated` EXECUTE, so the guard
   had nothing to remove and A.1 passed for the wrong reason. The harness `beforeAll` now
   reproduces those statements for both `postgres` and `supabase_admin` (see §4 step 3b).
2. **Two tests were order-dependent on a re-run.** B.4 and B.7 assert the *pre-closure*
   state (a `supabase_admin`-created function still world-executable), which only holds
   while the owner-run guard is absent. B.7 installs it, so a second run of the suite on
   the same database failed. Both now `DROP EVENT TRIGGER IF EXISTS
   f_a16_public_fn_guard_su` before measuring the gap, so the suite is deterministic on a
   fresh database **and** on re-run (verified: three consecutive runs, 14/14 each, plus one
   run from a freshly created database).

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
3. **F-A16-02 out-of-scope redesign (2026-11-05).** A `public` default-ACL owner the
   applying role may not act for (`pg_has_role(..., 'MEMBER')` is false) is now treated as
   **out of scope**: reported with a `RAISE NOTICE` and the migration proceeds. On hosted
   Supabase that is the permanent, platform-imposed state for `supabase_admin` (the customer
   `postgres` is not a superuser and not a member of it), so the original fail-closed design
   made F-A16-02 unappliable and `supabase db push` could not complete. The
   customer-controllable state — every `public` default ACL owned by the applying role or a
   role it may act for — is still verified and fails closed. Security impact: no weakening —
   the set that is actually customer-controllable is still asserted; a role the customer
   cannot change is no longer misreported as a failure. The two owner-run files are retained
   for reference / a platform-assisted path.
4. **Superuser-creator closure** (`docs/audits/F-A16_OWNER_RUN_supabase_admin_function_guard.sql`,
   retained). A second, `supabase_admin`-owned forward guard that fires for
   `supabase_admin`-created functions — the case the `postgres`-owned guard cannot see.
   Verified end-to-end in the isolated environment. It is **optional**: the customer
   `postgres` cannot create it, and whether a `supabase_admin`-owned object exists in
   `public` is UNRESOLVED (no production catalog read — see §10.1). Retained for a
   platform-assisted path.
5. **F-A16-07 existing-function lockdown**
   (`supabase/migrations/20261115000300_f_a16_existing_function_privileges.sql`, new).
   Revokes `EXECUTE` on the two existing world-executable functions (`rls_auto_enable`,
   `update_updated_at_column`) from `PUBLIC`/`anon`/`authenticated`, keeps `service_role`.
   A trigger fires as the function owner regardless of `EXECUTE`, so the `update_updated_at`
   triggers are unaffected.
6. **Corrected the residual's mechanism and severity** in the guard header and this
   document (supautils `fmgr` hook, not `session_replication_role`; reachable by
   `anon`/`authenticated`, not `service_role`-only).
7. **F-A16-07 ownership precondition (B-1 fix).** The migration now resolves each target's
   owner from `pg_proc.proowner` and refuses to run — with an F-A16-07-specific error —
   unless `pg_has_role(current_user, proowner, 'MEMBER')`, i.e. unless the session may
   change that owner's ACLs. Previously it relied on the post-condition's
   `has_function_privilege` re-read; that re-read does raise, but only *after* a revoke that
   a non-owner REVOKE only WARNS on. The explicit precondition makes the failure mode
   unambiguous and reports *which* target and *which* owner. The owner-keeps-EXECUTE check
   is now also resolved from the catalog rather than assuming `postgres`. Security impact:
   strictly stronger — the migration can no longer appear to succeed while a
   non-`postgres`-owned target stays world-executable. Tested: C.4 (unmanageable owner →
   fails closed, atomically, nothing revoked) and C.5 (manageable owner → succeeds).

### 10.1 Ownership of `rls_auto_enable()` — UNRESOLVED (B-3)

The repository carries **contradictory, unverified** statements about the owner of
`public.rls_auto_enable()`:

| Source | Claim | Basis |
| --- | --- | --- |
| `docs/audits/F-A15.1_REMEDIATION_PROPOSAL.md:51,66` | owner `postgres` | assumption (F-A15.1 narrative) |
| `docs/audits/F-A16_PRODUCTION_PREFLIGHT.md:199` (working-tree artifact, not in this commit) | owner `supabase_admin` | assumption (F-A16 preflight narrative) |
| `docs/audits/F-A16_REMEDIATION_PLAN.md:552` | owner `postgres` | **explicitly marked "Assumption (F-A15.1 §4.1)"** |
| `docs/audits/F-A16_PRODUCTION_CATALOG_RESULTS.md` | — | audit **NOT EXECUTED**; `rls_auto_enable` `Unverified` |

Two of these are tracked and directly contradict each other in basis (one *assumes*
`postgres`, the other records it as *Unverified*), which is why the owner must be treated
as unresolved rather than assumed either way.

No production catalog read has confirmed the owner, so this document does **not** pick a
side. The F-A16-07 migration is written to be correct under **either** owner: it reads the
actual owner at apply time and fails closed (rather than silently no-op'ing) when the
session may not act for it. **Preflight action:** confirm the owner with a read-only
`SELECT proowner::regrole FROM pg_proc WHERE proname = 'rls_auto_enable'` before applying;
if it is not `postgres` (and the applying role is not a member), F-A16-07 will (correctly)
refuse and the REVOKE must be run as, or on behalf of, the owning role.

### 10.2 Evidence layers (do not conflate)

* **Actual production read-only evidence:** none for the F-A16 catalog surface. The only
  production evidence is API-observed behaviour recorded in
  `F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`; the catalog audit is prepared but
  **not executed** (`F-A16_PRODUCTION_CATALOG_RESULTS.md`).
* **Prior attested evidence:** the 2026-11-03 audit's "exactly two world-executable
  functions" figure. Attested, not re-measured here.
* **Local integration evidence:** everything in this document — a disposable
  `supabase/postgres:15.19.0.018` container.
* **Assumptions:** the owner of `rls_auto_enable()` (unresolved, §10.1); the production
  `postgres` role's event-trigger capability (image-verified, project-config dependent).

---

## 11. Production-readiness recommendation

**Scope of these verdicts.** Every `PASS` below is a **local verification** verdict: the
migration exists and behaves correctly in the isolated real-PostgreSQL environment. It is
**not** a statement that the migration has been applied. **Production application is
pending** for all of them — see the preflight and post-execution checklists in
`docs/audits/F-A16_EXECUTION_CHECKLISTS.md`, which are marked **NOT EXECUTED**.

**PASS for the customer-controllable surface, with two documented platform limitations.**

* F-A16-02 (defaults) — **PASS.** The migration applies as `postgres`, tightens the applying
  role's `public` defaults (and those of any role it may act for), and verifies the result.
  `supabase_admin`-owned defaults are out of scope and reported; whether any object exists
  under them is UNRESOLVED (no production catalog read — §10.1). No
  owner-run step is required for this path.
* F-A16-02b (guard) — **PASS for every creator the `postgres`-owned guard can see**
  (`postgres` and its members); it fails closed otherwise. It cannot see a
  `supabase_admin`-created function (supautils skips a non-superuser-owned trigger function
  for a superuser). That path is reachable by `anon`/`authenticated` **if** a
  `supabase_admin` function is created in `public`; whether one exists is UNRESOLVED, and
  the customer cannot create one. The retained owner-run guard file closes it for a
  platform-assisted path.
* F-A16-07 (existing functions) — **PASS, with the ownership precondition.** Revokes
  `EXECUTE` on the two functions from `PUBLIC`/`anon`/`authenticated`; `service_role` keeps
  it; triggers are unaffected. It resolves each target's owner and **fails closed** if the
  session may not act for it, so it cannot silently report success while a target stays
  world-executable. If production `rls_auto_enable()` is not `postgres`-owned, F-A16-07 will
  refuse and the REVOKE must be run as the owning role — an owner-run step, not a
  weakening.
* **Preflight must still confirm**, on the production project: (a) that `postgres` may
  create event triggers (the image says yes; a project's `supautils` config governs it); if
  it cannot, the guard migration fails closed with a clear error. (b) the owner of
  `rls_auto_enable()` (§10.1), which determines whether F-A16-07 applies as `postgres` or
  needs an owner-run REVOKE.

No change weakens a security check. The guard re-check and the F-A16-07 ownership
precondition make them strictly stronger (fail-closed); the F-A16-02 redesign removes a
platform-imposed false failure while keeping the customer-controllable assertion; F-A16-07
narrows the existing-function surface to exactly two named targets.

---

## 12. Reproduce

```bash
npm run test:db                 # PGlite (in-process; does NOT prove the Supabase path)
npm run test:db:integration     # real PostgreSQL; needs FA16_TEST_DB_URL + FA16_ALLOW_DISPOSABLE_DB=1
```

---

## 13. Automatic production migration on push to `main` (Supabase GitHub integration)

This section is separate from the migration content above. It records a live
production-safety finding discovered while preparing this branch, and the repository-side
controls added for it. It is **not** a test of the migration SQL, and no production
database was read to produce it: every fact below comes from the repository, the public
GitHub API for this repository, and Supabase's public documentation.

### 13.1 The finding

Pushing to `main` triggers a **Supabase GitHub integration** — the `Supabase Preview`
check run, GitHub App slug `supabase`, app id `330661` — which applies pending
`supabase/migrations/*.sql` to the **production** project. This is not a repository
workflow; it is configured in the Supabase dashboard and cannot be seen or changed in
`.github/workflows/`.

Evidence (read-only):

* `GET /repos/ngowda759/Rayaramathaynk/commits/<sha>/check-runs` on recent `main` tips
  (`af8c4b8f92`, `cfd060d9`) returns a completed `Supabase Preview` check whose
  `details_url` is `https://supabase.com/dashboard/project/kvrkraqjuyxbraccxntk` — the
  approved production project (`scripts/lib/approved-project.mjs`).
* The same check is **skipped** on this branch's commits (a feature branch is not
  associated with a Supabase branch), which is why the coupling is easy to miss: CI on a
  pull request looks clean while `main` is being migrated.
* The check is currently **failing** on `main` with
  `ERROR: F-A16-02: cannot tighten default privileges for object-creating role(s):
  supabase_admin (SQLSTATE P0001)` — the `20261115000000_f_a16_least_privilege_defaults.sql`
  migration (see §9 and §10). Supabase documents that "Branching runs each migration file
  inside a single transaction", so a file that fails rolls back that file, while earlier
  files in the same run stay applied. The migration that fails here is not the last F-A16
  file in timestamp order (`20261115000100`–`20261115000300` sort after it), so the
  automatic deploy currently stops before applying them.
* `main` receives roughly a dozen pushes a day, mostly the scheduled `panchanga.yml`
  workflow's `chore: update daily panchanga` commits, so the integration fires on a
  schedule the repository does not control.

### 13.2 Why it cannot be disabled from the repository

Supabase documents the integration at
<https://supabase.com/docs/guides/deployment/branching/github-integration>:

> Enable the **Deploy to production** option in your GitHub Integration configuration to
> automatically deploy changes when you push or merge to production branch. […] New
> migrations are applied.

The configuration lives at **Supabase Dashboard → Project Settings → Integrations →
GitHub Integration** for the project. There is no Management API endpoint for it: the
v1 OpenAPI document (`https://api.supabase.com/api/v1-json`) has no `github` or
`integration` path (only `/v1/branches/…`, which is branch management, not the
integration's deploy setting). Turning it off is therefore an **owner action in the
dashboard**, not a commit.

The GitHub-side control surface is also unavailable to this agent: the Supabase App
installation is not listed for the account's user token, and the branch-protection and
ruleset APIs return `403 Resource not accessible by integration`. A ruleset or required
status check is an owner action too (and, since the check currently fails, requiring it
would block every `main` push rather than stop the migration).

### 13.3 The repository-side control, and its coupling

Supabase documents a repository-side switch
(<https://supabase.com/docs/guides/deployment/branching/github-integration>):

> To stop branching from running migrations, set `enabled = false` under
> `[db.migrations]` in `config.toml`.

That switch is **not set** in `supabase/config.toml` today, so the automatic deploy
remains active. It is deliberately left off because it is **coupled**:

* the Supabase integration reads it (the documented behaviour above), **and**
* `supabase db push` reads the *same* key — `apps/cli/src/command-internal/db-push-core.ts`
  in `supabase/cli` skips all migrations when `migrationsEnabled` is false
  (`Skipping migrations because it is disabled in config.toml for project: …`).

So setting `enabled = false` alone would silence the dashboard integration **and** turn
`.github/workflows/supabase-migrations.yml` into a silent green no-op — worse, because the
run would report success while applying nothing.

**Measured caveat (CLI 1.200.0, the version this repository pins).** The documented
`enabled = false` gate was exercised against a disposable `postgres:15` container with the
pinned CLI (`supabase@1.200.0`, installed from npm). In CLI **1.200.0** it did **not** stop
`supabase db push`: a new pending migration was applied anyway. The pinned binary does not
contain the gate at all — `strings node_modules/supabase/bin/supabase | grep 'Skipping
migrations because it is disabled'` returns nothing, and the string
`migrationsEnabled` is absent from the package. The gate described in the docs is present in
the current CLI (`apps/cli/src/command-internal/db-push-core.ts` on `supabase/cli` master,
covered by `push.integration.test.ts`), but the pinned `1.200.0` predates it.

**This means the repository cannot rely on `enabled = false` as a hard stop for the
dashboard integration either** — that behaviour is not reproducible on the pinned
toolchain, and the dashboard **Deploy to production** toggle (not `config.toml`) is the only
control that is demonstrably effective. Do not treat the `config.toml` key as a safety
interlock.

### 13.4 Owner procedure (dashboard)

To stop the automatic production migration:

1. Supabase Dashboard → the production project → **Project Settings → Integrations →
   GitHub Integration**.
2. Turn **off** the **Deploy to production** option (or remove the repository from the
   integration). Do not use the production project ref anywhere else.
3. Confirm the effect: push a commit that changes only a non-`supabase/**` file to `main`,
   and verify no `Supabase Preview` run applies migrations. A commit touching
   `supabase/**` on a feature branch should still report `skipped`.
4. Optional, and only after step 2: set `enabled = false` under `[db.migrations]` in
   `supabase/config.toml` if the intent is to stop *all* migration application, accepting
   that manual dispatch then applies nothing (both workflows now fail closed in that case,
   see §13.5).

To deploy migrations after step 2, use the manually dispatched workflow:
`.github/workflows/supabase-migrations.yml` (project-ref guard, dry-run, then `db push`).

### 13.5 Repository-side guards added (this change)

Because the integration is dashboard-side, the repository can only (a) keep no *second*
auto-apply path, (b) keep the config switch off, and (c) fail closed if the switch is ever
turned on. All three are now enforced:

* **No auto-apply path in the repository.** Only `supabase-migrations.yml` and
  `supabase-migrations-test.yml` run `supabase db push`, and both are `workflow_dispatch`-only.
  (The test workflow runs `db push --dry-run` only.)
* **Config switch documented, not enabled.** `supabase/config.toml` carries a
  `PRODUCTION AUTO-DEPLOY SWITCH` comment pointing at this section. The switch is off.
* **Fail-closed guards.** Both migration workflows now run
  *Assert migrations are enabled in config.toml* before `supabase link`, and refuse to
  proceed if `[db.migrations] enabled = false` is set — so the coupled no-op above can
  never be reported as success.
* **Regression test.** `tests/unit/f-a16-auto-deploy-controls.test.ts` pins all of the
  above and *executes* the guard script against throwaway `config.toml` files (it does not
  merely grep the workflow text).

### 13.6 Residual risk and status

* **Not closed from the repository.** The automatic production migration continues on every
  `main` push until an owner performs §13.4. This is `BLOCKED` on a dashboard action, not
  `PASS`.
* Merging any pull request to `main` — including this one — fires the integration. That is
  why this section exists: the automatic deploy is independent of the in-repo workflow and
  of whether this change is merged.
* No production database, credential, or dashboard was accessed while producing this
  section. The only network reads were the public GitHub API for this repository and the
  public Supabase documentation.

