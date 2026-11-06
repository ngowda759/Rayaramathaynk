# F-A16 — Production Post-Application Verification

**Status: EXECUTED (read-only).** This document records a **read-only** verification of the
F-A16 remediation **after** it was applied to the production project. No DDL, DML, `GRANT`,
`REVOKE`, migration, secret change or workflow dispatch was performed to produce it. The
session was read-only, proven in-band (see §2).

**Target:** `kvrkraqjuyxbraccxntk` (region `ap-south-1`) · **PostgreSQL:** 17.6 ·
**Date:** 2026-11-06 · **Reproduce with:** `docs/audits/F-A16_POST_APPLICATION_VERIFICATION.sql`

> This is the post-application counterpart to
> `docs/audits/F-A16_INTEGRATION_VERIFICATION.md` (which verified the migrations against a
> disposable local PostgreSQL). That document answers "does the SQL behave as designed?".
> This one answers "did it actually take effect in production, and did it break anything?".

---

## 1. Scope

Five questions were asked of production, and each is answered below with catalog evidence:

1. Can `anon` / `authenticated` still execute `rls_auto_enable()` or
   `update_updated_at_column()`?
2. Do `service_role` and the function owners still retain execution?
3. Have the `supabase_admin` `public` default privileges been tightened as intended?
4. Are the existing application functions, triggers and RLS policies intact?
5. Does the migration ledger record the migrations?

---

## 2. Environment and method

| Item | Value |
|---|---|
| Target project | `kvrkraqjuyxbraccxntk` (`ap-south-1`) |
| Server version | PostgreSQL **17.6** |
| Session role | the project owner role (`postgres`), the same role the migration workflow uses |
| Transport | Supavisor **session pooler** over IPv4 (the direct host is IPv6-only) |
| Read-only enforcement | three independent controls: session `default_transaction_read_only=on`, an explicit `BEGIN READ ONLY` transaction, and `search_path=pg_catalog` |
| In-band proof | `current_setting('transaction_read_only') = on` in the same session that ran every query below |

**What this can prove.** The catalog state of the target at the time of the read:
function ACLs and effective `EXECUTE`, default ACLs, table/policy/trigger/event-trigger
presence, object ownership, and the migration ledger.

**What it cannot prove.** Runtime behaviour for a specific end-user request (policy
composition with row data, role membership at request time), and whether the recorded DDL
matches the repository files byte-for-byte (a ledger entry is a claim, not the DDL).

The verification was performed from an external read-only session. No production
credential is recorded here or anywhere in this change; connection details are deliberately
omitted.

---

## 3. Results

| # | Question | Result |
|---|---|---|
| 1 | `anon`/`authenticated` cannot execute the two functions | **PASS** |
| 2 | `service_role` and owners retain execution | **PASS** |
| 3 | `supabase_admin` `public` default privileges tightened | **FAIL** — still broad (latent, see §4.3) |
| 4 | Existing functions, triggers, RLS policies intact | **PASS** |
| 5 | Migration ledger records the migrations | **PASS** |

**Overall:** the customer-applicable remediation took effect and did not regress the
application. One documented residual (the `supabase_admin` defaults) remains open and is
**not reachable** with the current object ownership (verified: zero `supabase_admin`-owned
objects in `public`).

---

## 4. Evidence, item by item

### 4.1 Item 1 — `anon`/`authenticated` EXECUTE revoked: PASS

Both target functions now carry an owner-and-`service_role`-only ACL:

| Function | Owner | SECURITY DEFINER | ACL |
|---|---|---|---|
| `public.rls_auto_enable()` | `postgres` | true | `{postgres=X/postgres,service_role=X/postgres}` |
| `public.update_updated_at_column()` | `postgres` | false | `{postgres=X/postgres,service_role=X/postgres}` |

Effective `EXECUTE` (`has_function_privilege`):

| Function | `anon` | `authenticated` | `service_role` | owner |
|---|---|---|---|---|
| `public.rls_auto_enable()` | **false** | **false** | true | true |
| `public.update_updated_at_column()` | **false** | **false** | true | true |

Two sweeps confirm the revocation is not confined to those two rows:

* every `public` function executable by `anon` **or** `authenticated` → **0 rows**;
* `public` functions carrying a `PUBLIC` (`grantee = 0`) `EXECUTE` entry → **0**.

A behavioural cross-check from the public data API agrees: calling
`/rest/v1/rpc/rls_auto_enable` as `anon` returns
`42501 permission denied for function rls_auto_enable`. (`update_updated_at_column`
returns `trigger`, so PostgREST does not expose it over `/rpc/`; the catalog rows above are
the evidence for it.)

### 4.2 Item 2 — `service_role` and owners retain execution: PASS

Both functions keep `service_role` and the owner (`postgres`) with `EXECUTE` (table in
§4.1). This matches the design: `service_role` is the server-side path the application uses
(`createAdminClient()` → service role), and the owner is required to own the function.

### 4.3 Item 3 — `supabase_admin` `public` default privileges: FAIL (latent)

The `supabase_admin`-owned `public` default ACLs are **unchanged and still broad**:

| object type | default ACL |
|---|---|
| `r` (tables) | `{postgres=arwdDxtm/supabase_admin, anon=arwdDxtm/supabase_admin, authenticated=arwdDxtm/supabase_admin, service_role=arwdDxtm/supabase_admin}` |
| `f` (functions) | `{postgres=X/supabase_admin, anon=X/supabase_admin, authenticated=X/supabase_admin, service_role=X/supabase_admin}` |
| `S` (sequences) | `{postgres=rwU/supabase_admin, anon=rwU/supabase_admin, authenticated=rwU/supabase_admin, service_role=rwU/supabase_admin}` |

The applying role's **own** defaults, by contrast, are tightened to owner-only
(`{postgres=arwdDxtm/postgres}`, `{postgres=X/postgres}`, `{postgres=rwU/postgres}`), and
the **global** default ACLs are clean (a single `postgres f {postgres=X/postgres}`).

This is the documented residual (finding **R-1**). It is **not** a migration defect: default
privileges are per-owner, and `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` requires
membership in `supabase_admin`. Measured on production:

```
pg_has_role('postgres', 'supabase_admin', 'MEMBER') = false
pg_has_role('postgres', 'service_role',  'MEMBER') = true
supabase_admin: rolsuper = true, rolbypassrls = true
```

So the customer `postgres` role can never tighten them; F-A16-02 therefore scopes
`supabase_admin` out and reports it. Closing it requires a Supabase-side action.

**Why it is latent, not live.** Default privileges only affect **future** objects created
**by that owner**. Production has **zero** `supabase_admin`-owned objects in `public`:

| owner | tables (`r`) | sequences (`S`) | functions |
|---|---|---|---|
| `postgres` | 67 | 5 | 89 |
| `supabase_admin` | 0 | 0 | 0 |

Nothing currently inherits those defaults, and the F-A16-02b forward guard closes the
function-`EXECUTE` half of the risk for future objects created through the normal path. The
residual is an open platform-side item, not an active exposure.

### 4.4 Item 4 — functions, triggers and RLS policies intact: PASS

| Measure | Production | Reference (F-A15.1 baseline) |
|---|---|---|
| `public` tables | 67 | 67 |
| tables with RLS enabled | 67 | 67 |
| `public` policies | 81 | 81 |
| `public` functions | 89 | 87 (+2 F-A16 guard functions) |
| `public` (non-internal) triggers | 52 | — |

* The application read surface still works: as `anon`, `events` returned a row and
  `sevas` / `donations` / `announcements` returned zero rows under RLS — i.e. policies are
  present and still filtering.
* **F-A16-01 took effect:** no `TRUNCATE`, `REFERENCES` or `TRIGGER` privilege remains for
  `anon`, `authenticated` or `service_role` on any `public` table. `anon`/`authenticated`
  keep `SELECT`/`INSERT`/`UPDATE`/`DELETE` (RLS-gated), and `service_role` keeps DML.
* **Event triggers present and enabled (`evtenabled = 'O'`):**

  | event trigger | function | owner |
  |---|---|---|
  | `ensure_rls` | `public.rls_auto_enable()` | `postgres` |
  | `f_a16_public_fn_guard` | `public.f_a16_public_fn_guard()` | `postgres` |
  | `f_a16_assert_public_rls` | `public.f_a16_assert_public_rls()` | `postgres` |

* **Guard hardening confirmed:** `f_a16_public_fn_guard` is `SECURITY DEFINER` with
  `search_path=pg_catalog`; `f_a16_assert_public_rls` also carries
  `search_path=pg_catalog`.

This also **resolves the preflight NO-GO**: `f_a16_public_fn_guard` is installed and
enabled, which demonstrates that the production `postgres` role *can* `CREATE EVENT TRIGGER`
(the Supabase `supautils` path works for this project).

### 4.5 Item 5 — migration ledger: PASS

The ledger (`supabase_migrations.schema_migrations`, 46 rows) records all five F-A16
migrations:

```
20261114990000  f_a16_public_function_execute_guard
20261115000000  f_a16_least_privilege_defaults
20261115000100  f_a16_fail_closed_rls_assertion
20261115000200  f_a16_existing_table_privileges
20261115000300  f_a16_existing_function_privileges
```

---

## 5. Supabase-specific findings

* **Event triggers are permitted** for the customer `postgres` role through `supautils`
  (demonstrated by the three installed, enabled event triggers). The preflight's
  load-bearing NO-GO prerequisite is therefore satisfied.
* **`supabase_admin` is not manageable by the customer role** (`pg_has_role = false`), and
  is a superuser — consistent with the hosted-Supabase constraint recorded in
  `F-A16_EXECUTION_CHECKLISTS.md`.
* **Global (all-schema) default ACLs are clean** — one owner-only entry for `postgres`.

---

## 6. Residual and recommendation

* **R-1 (open, platform-side, latent).** `supabase_admin`'s `public` defaults remain broad.
  No `supabase_admin`-owned object exists in `public`, so there is no live exposure. Closing
  it needs a Supabase-side action; the retained owner-run files
  (`docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql`,
  `..._function_guard.sql`) are the reference for that path and remain optional for the
  customer.
* **Customer-applicable remediation: complete.** Items 1, 2, 4 and 5 pass on production.
* **Recommended follow-ups for the owner:**
  1. Treat this as the post-application evidence record; no further production change is
     required for the customer path.
  2. Decide on R-1 (platform action, or accept-and-document).
  3. Disable the Supabase GitHub integration's **Deploy to production** on `main`
     (Dashboard → Project Settings → Integrations) so future migrations are applied only
     through the reviewed, dispatch-gated workflow.
  4. Rotate the project database password, since it is a shared owner-role credential.

---

## 7. Reproducing this verification

Run `docs/audits/F-A16_POST_APPLICATION_VERIFICATION.sql` in a **read-only** session
against the approved project. It contains only `SELECT` statements, opens with an explicit
read-only assertion, and prints the same evidence recorded above.
