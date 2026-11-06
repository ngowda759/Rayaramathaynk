# F-A16 — Least-Privilege Remediation Plan

**Status: PROPOSED. NOT APPLIED TO PRODUCTION.**

**Repository:** `ngowda759/Rayaramathaynk` · **Base commit:** `6f371ae` (`main`)
**Audit source:** the 2026-11-03 read-only production catalog audit, plus
`docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`,
`docs/audits/F-A16_PRODUCTION_CATALOG_RESULTS.md`,
`docs/audits/F-A16_PRODUCTION_EVIDENCE_SUMMARY.md`, and the prior deep dive
`docs/audits/F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md`.

**Revision 2 (2026-11-03).** The 2026-11-03 production audit supplied the numbers this
plan previously had to assume, and three of them changed the design:

* **67 public tables, 5 sequences, 87 functions, 24 schema-scoped default ACL entries,
  0 global default ACL entries.** The migration's global
  `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` is therefore
  **removed**: there is nothing global to revoke, and the statement would only *create* a
  global entry that changes the defaults for `storage`, `graphql` and `graphql_public`.
  The implicit `PUBLIC` EXECUTE residual is closed **forward** instead
  (`20261114990000_f_a16_public_function_execute_guard.sql`).
* `postgres` **and** `supabase_admin` both own default privileges in `public`, and
  `postgres` cannot manage `supabase_admin`'s through current membership. **Correction
  (2026-11-05):** `supabase_admin` is a platform-internal superuser role; the customer
  `postgres` session can never act for it, so an owner-run step from the customer role is
  not possible. It is therefore **out of scope**, not a required manual step. Whether any
  object exists under `supabase_admin`'s `public` defaults is **UNRESOLVED** — no production
  catalog read has established it, and there is no "2026-11-05 read-only production
  inventory" (no such run, artifact or commit; see
  `F-A16_INTEGRATION_VERIFICATION.md` §10.1–10.2). The migration reports the owner and
  proceeds; the customer-controllable state is still verified and fails closed.
* `anon` and `authenticated` hold `REFERENCES`, `TRIGGER`, `TRUNCATE` on numerous
  existing tables (and `service_role` on multiple). F-A16-01 is no longer deferred: a
  narrow, reviewable migration now exists
  (`20261115000200_f_a16_existing_table_privileges.sql`), and the table-by-table matrix is
  `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md`.

**Mode:** code-only remediation. No production Supabase connection was opened, no SQL
was executed against a live database, no migration was applied or dispatched, and no
grant, RLS policy, role, environment or workflow was changed. Every statement in this
plan about *production* configuration is sourced from the supplied audit documents and
the 2026-11-03 catalog audit, not from a live read by this change.

**Evidence labelling used throughout:** *Confirmed* = visible in repository source, in
the supplied audit documents, or in the 2026-11-03 catalog audit; *Assumption* = inferred,
needs a live catalog read to confirm; *Unverified* = the audit explicitly recorded it as
unread.

---

## 1. Executive summary

| Finding | Severity | Confirmed? | Remediation in this PR | Applied? |
|---|---|---|---|---|
| F-A16-01 — broad existing table grants to `anon`/`authenticated` | **High** | Confirmed (2026-11-03 audit: REFERENCES/TRIGGER/TRUNCATE on numerous tables) | `20261115000200_f_a16_existing_table_privileges.sql` — revokes only the three RLS-invisible privileges, catalog-driven, with pre/post-conditions; DML revokes remain deferred with the matrix in `F-A16-01_PRIVILEGE_MATRIX.md` | No |
| F-A16-02 — broad default ACLs for future objects | **High** | Confirmed (24 schema-scoped entries, 0 global) | `20261115000000_f_a16_least_privilege_defaults.sql` — **`public`-scoped only**, tightens the applying role's own `public` defaults and those of any role it may act for; a role it may not act for (`supabase_admin`) is out of scope and reported. `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` is retained as an optional reference path | No |
| F-A16-02b — implicit `PUBLIC` EXECUTE on future functions | **Medium** | Confirmed (PostgreSQL default; the audit found no global default to revoke) | `20261114990000_f_a16_public_function_execute_guard.sql` — forward event-trigger guard, scoped to `public` | No |
| F-A16-03 — RLS auto-enable fail-open | **Medium** | Confirmed (function body in F-A15.1) | `20261115000100_f_a16_fail_closed_rls_assertion.sql` | No |
| F-A16-04 — `seva_list_items` RLS, zero policies | **Info / by design** | Confirmed (migration + app code) | Documented as intentional; guard tests added | N/A |
| F-A16-05 — private Storage bucket, zero policies | **Info / by design** | Confirmed (app uses Vercel Blob) | Documented; guard tests added | N/A |
| F-A16-06 — migration ledger reconciliation | **Info** | Confirmed (repo files) | Reconciliation report + guard test | N/A |
| F-A16-07 — `PUBLIC` EXECUTE on two existing functions | **Low** | Confirmed (2026-11-03 audit: `rls_auto_enable`, `update_updated_at_column`) | `20261115000300_f_a16_existing_function_privileges.sql` — revokes `EXECUTE` from `PUBLIC`/`anon`/`authenticated`, keeps `service_role` | No |

The guiding principle is the one in the task brief: **a smaller, evidence-backed
remediation over broad permission changes.** F-A16-02 changes only *future-object*
defaults. F-A16-01 changes *existing-object* ACLs, but only for the three privileges RLS
cannot compensate for (`TRUNCATE`, `REFERENCES`, `TRIGGER`) — never `SELECT`/`INSERT`/
`UPDATE`/`DELETE`. Nothing here revokes a DML privilege or alters an RLS policy.

---

## 2. F-A16-02 — Default privileges

### 2.1 Evidence

*The default ACL is not defined in this repository.*

A repo-wide search finds `ALTER DEFAULT PRIVILEGES` in exactly one place:

```
tests/db/harness.ts:50  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
tests/db/harness.ts:51  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
tests/db/harness.ts:52  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
```

No `supabase/migrations/*.sql` file contains the statement. The harness exists to
*recreate the platform's defaults* so the seva migrations' `REVOKE`s are meaningful
under test — which is itself confirmation that the defaults are platform-supplied and
broader than the application needs.

`F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md` §4 (row: *"`rls_auto_enable()` executable by
anon/authenticated/service_role — PostgreSQL default `PUBLIC` `EXECUTE` on new
functions — Confirmed (default, not an explicit grant)"*) is the corroborating
evidence for the function half.

### 2.2 Affected objects

| Object type | Future objects created by `postgres` / `supabase_admin` in `public` |
|---|---|
| Tables | new tables arrive with `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` for `anon`, `authenticated`, `service_role` |
| Sequences | new sequences arrive with `USAGE` for all three |
| Functions | new functions arrive with `EXECUTE` for all three **and** the implicit `PUBLIC` `EXECUTE` |

### 2.3 Three mechanics that decide the SQL (verified on Postgres 18 / PGlite)

All three were reproduced in an in-process Postgres before writing the migration; the
reproductions are now permanent tests (`tests/db/f-a16-least-privilege.test.ts`).

1. **Tables and sequences — the per-schema form is sufficient, for named roles and for
   `PUBLIC`.** A per-schema `REVOKE` *does* subtract from a per-schema `GRANT`. Revoking
   `ALL ON TABLES` / `ALL ON SEQUENCES` from `anon, authenticated, PUBLIC` removes the
   whole set for future objects. Measured: a per-schema
   `GRANT SELECT ON TABLES TO PUBLIC` is removed by a per-schema
   `REVOKE ALL ON TABLES FROM PUBLIC`, and a new table is then not `anon`-readable.

2. **Functions — only the *global* form removes the implicit `PUBLIC` EXECUTE, and this
   migration deliberately does not use it.**
   `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
   is a documented **no-op** (per-schema defaults can only add to, never subtract from,
   the global default). The global form is the only thing that removes the implicit
   `PUBLIC` EXECUTE — but it changes the defaults for **every schema**, and the
   2026-11-03 audit found **0 global default ACL entries**, so it would only *create* a
   global entry. The migration therefore:

   * removes the platform's explicit per-schema grant to `anon`/`authenticated`
     (`REVOKE EXECUTE … FROM anon, authenticated`, which *is* effective), and
   * closes the implicit `PUBLIC` EXECUTE **forward** with
     `20261114990000_f_a16_public_function_execute_guard.sql`.

   Measured effect on a new function:

   | Statement applied | `anon` can EXECUTE? |
   |---|---|
   | none (baseline) | yes |
   | per-schema `REVOKE … FROM anon, authenticated` only | **yes** (still inherits via `PUBLIC`) |
   | per-schema `REVOKE … FROM PUBLIC` only | **yes** (no-op) |
   | **global** `REVOKE … FROM PUBLIC` (removed from this change) | **no**, but changes every schema |
   | forward guard `f_a16_public_fn_guard` (this change) | **no**, and scoped to `public` |

3. **Ownership — `ALTER DEFAULT PRIVILEGES FOR ROLE x` needs membership in `x`.** A
   superuser counts as a member; a plain role is refused for any role it is not a member
   of. The audit found `postgres` and `supabase_admin` both own `public` defaults and that
   `postgres` cannot manage `supabase_admin`'s. Because `supabase_admin` is a
   platform-internal superuser the customer role can never act for (2026-11-05 correction),
   the migration tightens the defaults of every owner it **may** act for and treats the rest
   as out of scope, reporting them via `RAISE NOTICE` rather than failing closed.

### 2.4 Proposed least-privilege defaults

`supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql` — every statement
carries `IN SCHEMA public`; the file issues **no** global statement:

| Statement | Effect on future objects |
|---|---|
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated` | new tables grant `anon`/`authenticated` nothing |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC` | no per-schema `PUBLIC` table default can survive (no-op today) |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role` | backend keeps DML; loses the three rights RLS cannot compensate for (same set F-A16-01 revokes on existing tables) |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated` | no public role can advance a sequence |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC` | as above, for a `PUBLIC` default (no-op today) |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated` | removes the platform's explicit grant to those roles |
| `DO` block enumerating candidate creators from `pg_default_acl` rows for `public` (**no grantee filter**) and repeating the above `FOR ROLE <creator>` for each owner the applying role may act for | covers a creator whose public default ACL names only some other grantee |
| `DO` block reporting (via `RAISE NOTICE`) a creator the applying role may **not** act for | that role is out of scope on hosted Supabase (e.g. `supabase_admin`); the customer-controllable state is still verified below |
| `DO` block verifying the post-condition via `aclexplode`, including global (`ns=0`) rows, for owners the applying role may act for | a silent no-op revoke cannot pass |
| `DO` block failing if a public-facing role holds a default ACL in a **non-`public`** schema | positive assertion that the change stayed inside `public` |
| `DO` block raising `NOTICE` (not an error) when the forward guard is absent | records the implicit-`PUBLIC`-EXECUTE residual rather than pretending it is gone |

`supabase/migrations/20261114990000_f_a16_public_function_execute_guard.sql` — the
forward guard. A `SECURITY DEFINER` event trigger on `ddl_command_end` that revokes
EXECUTE from `PUBLIC, anon, authenticated` on each new `public` function and keeps
`service_role`. It sorts before F-A16-02 so it is installed first on a normal
`supabase db push`.

A `DO` block first **raises** if `anon`, `authenticated` or `service_role` is absent, so
the migration fails loudly rather than silently leaving the defaults broad on a
non-Supabase database.

#### 2.4.1 Why the migration enumerates roles instead of naming them

Default privileges belong to the role that will *create* the object, not to the schema.
`ALTER DEFAULT PRIVILEGES FOR ROLE x` may only be issued by a member of `x` (or by a
superuser) — verified on PGlite: a member may act for a role it is a member of, and is
refused for any other. A migration that only named `postgres` and `supabase_admin` would
therefore be wrong twice over: it would miss a third owner if one existed, and it would
have no way to tell a reviewer whether a role had actually been covered.

#### 2.4.2 Why discovery is not filtered by grantee

An earlier revision of section 2 discovered owners with
`pg_default_acl … WHERE defaclacl::text ~ '(^|[,{])(anon|authenticated|service_role)='`.
That is a **targeted search for rows naming those grantees**, not an inventory: a role
with `ALTER DEFAULT PRIVILEGES FOR ROLE temple_creator IN SCHEMA public GRANT SELECT ON
TABLES TO reporting_role` has a `pg_default_acl` row for `public`, but the row does not
name `anon`/`authenticated`/`service_role`, so the filter skips the role entirely. The
unfiltered inventory puts it in the candidate set, so the migration fails closed on it
rather than silently skipping it. Reproduced on PGlite and pinned by
`tests/db/f-a16-least-privilege.test.ts`.

#### 2.4.2a A public-facing role must not be a creator (section 0c)

If `anon`, `authenticated` or `service_role` can itself create in `public`, the remediation
is no longer well-defined: "public-facing role" and "creator" stop being disjoint sets, and
such a role owns the defaults for objects it creates. Removing the right is a **schema-ACL**
change (`REVOKE CREATE ON SCHEMA`), which is existing-object grant territory (F-A16-01) and
is deliberately deferred.

So section 0c checks `has_schema_privilege` for those three roles and **fails closed** if
any holds CREATE — directly, through a role they are members of, or via `PUBLIC`. This is a
state that needs a human decision, not a silent pass. The plan's §9 item 7d is the
read-only query that answers it ahead of time.

#### 2.4.2b The creator inventory: default-ACL owners *and* effective-CREATE holders

The creator inventory is the **union of two classes**, and the migration now enumerates and
reports both (F-A16-02 correction, 2026-11-03):

* **Class (A) — default-ACL owners.** A role with a `pg_default_acl` row for `public`. Its
  new objects carry those defaults. These are the roles the migration **revokes** for, and
  the ones it **fails closed** on when it cannot act for them.
* **Class (B) — effective-CREATE holders.** A role for which
  `has_schema_privilege(role, 'public', 'CREATE')` is true but that owns no default ACL for
  `public`. Its new objects fall back to the hardwired Postgres defaults. For tables and
  sequences those grant nothing to anyone but the owner (measured `relacl IS NULL`), so
  there is no default privilege to change. Its new **functions** carry the implicit
  `PUBLIC` EXECUTE, which a per-schema `REVOKE … FROM PUBLIC` cannot remove.

Class (B) is **inventoried and reported** — the migration emits a `RAISE NOTICE` naming the
roles — but it is deliberately **not revoked** (nothing to revoke) and **not failed closed
on**. An earlier revision enumerated only class (A) and left class (B) invisible to the
operator, which is an incomplete inventory: the operator could not see the full creator set.
A still-earlier revision tried to make class (B) *fail closed*, which widened the
fail-closed set without closing the residual (a role the applier cannot act for would abort
the migration, and the per-schema revoke it attempted was a no-op for the function case).

What actually closes class (B)'s function residual is the forward guard, which fires for
**any** creator, including one this migration cannot act for — proven in
`tests/db/f-a16-least-privilege.test.ts`, "inventories a CREATE holder with no default ACL
row, without failing closed on it". Its new tables are owner-only by the hardwired default
(measured `relacl IS NULL`). The owner-run step remains the place where a superuser can act
for any role. See §2.4.3 and §2.6.

#### 2.4.2c The forward guard: `ON ROUTINE`, and the Supabase event-trigger caveat

The forward function-EXECUTE guard (`20261114990000_…`) revokes with

```sql
REVOKE EXECUTE ON ROUTINE <identity> FROM PUBLIC, anon, authenticated
```

**`ON ROUTINE`, not `ON FUNCTION` (F-A16-02b correction, 2026-11-03).** `ON FUNCTION`
rejects a procedure with `is not a function`; because the guard's `EXECUTE` raises, that
error aborted the *creating* statement, so the previous revision made `CREATE PROCEDURE` in
`public` impossible. Reproduced on PostgreSQL 17.11 and 18.6:

```
CREATE PROCEDURE public.p1() LANGUAGE sql AS $$ SELECT 1; $$;
ERROR:  public.p1() is not a function
CONTEXT:  SQL statement "REVOKE EXECUTE ON FUNCTION public.p1() FROM PUBLIC, anon, authenticated"
          PL/pgSQL function public.f_a16_public_fn_guard() line 17 at EXECUTE
```

`ON ROUTINE` covers both functions and procedures (`prokind` `f` and `p`), and
`cmd.object_identity` already carries the signature it needs. Verified on both versions.

**Supabase compatibility — not provable from the repo's test suite.** `CREATE EVENT
TRIGGER` is superuser-only in stock PostgreSQL (measured: a non-superuser gets `permission
denied to create event trigger`). Supabase's `postgres` role is **not** a superuser; it can
create event triggers only because the platform `supautils` extension intercepts the
statement and elevates briefly. The repo's tests run as a superuser and cannot load
`supautils`, so they prove the SQL but **not** this platform path. Whether `postgres` on
the target project may create event triggers is **unverified** and must be confirmed in
preflight (`docs/audits/F-A16_EXECUTION_CHECKLISTS.md` §11). The guard does not gate on
`rolsuper`; a `CREATE EVENT TRIGGER` failure aborts the migration (fail closed), so it
cannot silently half-apply.

#### 2.4.3a Global default privileges — why they are fail-closed, not remediated

`ALTER DEFAULT PRIVILEGES` without `IN SCHEMA` is **global**: it applies to objects created
in every schema, and a schema-scoped `REVOKE` **cannot subtract it**. Measured on PGlite:

```sql
ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC;                                  -- global
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;   -- per-schema
CREATE TABLE public.t (id int);
-- has_table_privilege('anon', 'public.t', 'SELECT')  =>  true   (the schema revoke did nothing)
```

Left unchecked, sections 1–2 would report success while every new `public` table stayed
readable by `anon` through the global entry. Section 0b therefore **fails closed** while such
a default exists. The scope is deliberate:

| Global default | Section 0b | Why |
|---|---|---|
| tables / sequences → `PUBLIC` or `anon`/`authenticated` | **refuses** | not removable by a schema-scoped revoke; needs the global form |
| tables → `TRUNCATE`, `TRIGGER` or `REFERENCES` for `service_role` | **refuses** | these are exactly the three section 1 revokes per schema, and a global grant survives that revoke — measured: after `IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role`, a new public table still reported them as true |
| tables → ordinary DML for `service_role` | **allowed** | `service_role` keeps DML on future tables by design |
| functions → `PUBLIC` | **allowed** | the corrected migration no longer removes it; it is closed forward by the guard, so refusing here would block a state the guard handles |
| functions → a named `anon`/`authenticated` | **refuses** | survives the per-schema revoke; not removed by this migration |

The `service_role` row is worth stating plainly because it is the one case where the
privilege holder is *not* a public-facing role. The reasoning is not "service_role is
untrusted" — it is that section 1 already decided these three privileges should not arrive by
default, and a global grant would silently defeat that decision for every future table. DML
is deliberately excluded, so a global DML default is not refused.

The fix for what 0b refuses is **not** applied here. The global form changes defaults for
every schema in the database, including platform-managed schemas this migration must not
touch — a broader action than F-A16-02 supports. It is an owner-reviewed step:
`docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` §4 (with §4b as its verification),
with the blast radius and the pre-flight checks spelled out. The plan's §9 item 7b is the
read-only query.

#### 2.4.3 Scope and limitations of the discovery

Stated explicitly, because the migration must not imply more than it does:

* **The catalog cannot enumerate roles that do not exist yet.** A role created after this
  migration runs carries no default ACL, so it reverts to the hardwired defaults: tables
  owner-only (safe), functions with the implicit `PUBLIC` `EXECUTE` (closed forward by the
  guard). If the platform later attaches a broad per-role default ACL to any role, that ACL
  is equally invisible to this run.
* **Every creator is inventoried.** The union of (A) default-ACL owners and (B)
  effective-CREATE holders is enumerated; class (A) is revoked and failed closed on, class
  (B) is reported. What no catalog query can do is enumerate a role that **does not exist
  yet** (see the first bullet) — that is a provisioning event, not an inventory gap.
* **The post-condition verifies the scope the migration established** — every role that
  owns a `public` default ACL, plus the global table/sequence checks. It asserts that every
  covered role's revoke took effect. It does **not** assert that a future creator will not
  appear, because no catalog query can. Read it as "the roles this file could see are
  covered", not "all future creators are covered".
* **Explicit catalog entries do not establish any future session's effective privileges.**
  `pg_default_acl` records what a *creating role* will stamp on new objects. What a
  *grantee* can then do also depends on inherited role memberships, `PUBLIC`, and
  `BYPASSRLS`, none of which a default-ACL inventory describes. This migration narrows the
  defaults; it is not a proof about any session's effective access.

The residual risk from the first two bullets is recorded in §2.6 and covered by the
operational control named there.

Section 2 of the migration discovers the owner set from `pg_default_acl`, applies the
revokes for each owner it may act for, and **reports** (not raises on) any owner it may not
act for. On hosted Supabase that is the expected, permanent state for `supabase_admin` — the
customer `postgres` session can never be a member of a platform-internal superuser role — so
failing closed on it would make F-A16-02 unappliable. The customer-controllable state — every
`public` default ACL owned by the applying role or a role it may act for — is still verified
in section 3 and **fails closed** if it is not least-privilege. `ALTER DEFAULT PRIVILEGES` is
transactional (verified on PGlite), so a section-3 failure rolls the whole migration back.

The two owner-run files are therefore **retained for reference / a platform-assisted path**,
not required for the customer path:

* `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` — the same tightening, run as
  the role that owns the defaults (or as a superuser), only if the platform provides that
  capability. It re-checks `pg_has_role(current_user, target, 'MEMBER')` and raises if the
  operator still cannot act, so it cannot silently do nothing either.

The precondition for applying the migration is therefore simply that it runs as the
migration applier (`postgres`). It no longer needs to be a member of every `public`
default-ACL owner, because a non-member owner is out of scope. Whether any
`supabase_admin`-owned object exists in `public` is **UNRESOLVED** (no production catalog
read), so the migration does not depend on that claim: it gates the runtime checks on the
applying role's own membership rather than on what objects exist. Section 9 item 7 is the
read-only catalog query that would confirm the object set.

### 2.5 Explicitly preserved backend privileges

* `service_role` keeps `SELECT, INSERT, UPDATE, DELETE` on future tables and `USAGE` on
  future sequences — the server-side application writes through
  `createAdminClient()` and reads sequences on insert.
* `service_role` keeps `EXECUTE` on future functions. This is a **reviewed exception**,
  not an oversight: the seva RPC surface is ~90 functions called via
  `createAdminClient().rpc(...)` (`lib/seva/server/rpc.ts:42`) and most rely on the
  default rather than an explicit `GRANT`. Revoking it would require adding an explicit
  grant to every future function — a larger change than this finding supports. If a
  later review wants the tighter default, the change is mechanical: add
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM service_role`
  and an explicit `GRANT EXECUTE` per function in the same migration that creates it.

### 2.6 Existing-object grants vs future-object default privileges — the distinction

This is the single most important distinction in the finding, and it is why the
migration is safe to apply without an application-dependency audit:

* **Default privileges** (`ALTER DEFAULT PRIVILEGES`) change only the ACL that Postgres
  will stamp on objects created **later**. They cannot and do not touch any existing
  object. Re-running the migration is a no-op.
* **Existing-object grants** (`GRANT`/`REVOKE` on a named table/sequence/function) are
  what F-A16-01 is about, and they **are** touched by an application-dependency audit
  because revoking one can break a live read or write. This plan deliberately does not
  propose any such revoke without that audit (§4).

**Residual risk this migration cannot close.** A role created *after* the migration runs
carries no default ACL of its own, so it reverts to the hardwired defaults: tables
owner-only (safe), functions with the implicit `PUBLIC` `EXECUTE` (closed forward by the
guard). The same applies if the platform later attaches a broad per-role default ACL to any
role, and to a role that creates in `public` while owning no default ACL row (§2.4.2b).
None is a grant this migration can revoke — all are provisioning events that happen after
it. The controls are:

* creating a role, or changing a platform default ACL, is a deliberate, reviewed act in
  this project, not something the application does at runtime;
* the forward function-EXECUTE guard (`20261114990000_…`) covers **any** creator's new
  functions for `PUBLIC`/`anon`/`authenticated`, including a creator this migration cannot
  enumerate;
* the tables that must never be client-reachable (`seva_*`) are additionally protected by
  RLS plus their own explicit `REVOKE`s, so they do not depend on the default ACL alone;
* §9 item 7 is the read-only query that re-checks the owner set, so a future reviewer can
  confirm nothing new appeared without acting for it.

**Creator inventory coverage (corrected 2026-11-03; scope corrected 2026-11-05).** Section
2 enumerates both classes of creator: (A) default-ACL owners, which it revokes for when it
may act for them and reports when it may not, and (B) effective-CREATE holders with no
default ACL, which it reports via `RAISE NOTICE` (§2.4.2b). Class (B) needs no revoke — its
tables/sequences are owner-only by the hardwired default — and its function residual is the
guard's job. The one thing the catalog still cannot enumerate is a role that **does not exist
yet**; that is a provisioning event, and the controls above (deliberate reviewed act; forward
guard) cover it.

### 2.7 What this finding cannot prove without a live read

* The **exact** current `pg_default_acl` rows for `postgres` and `supabase_admin`. The
  2026-11-03 audit recorded **24 schema-scoped entries and 0 global entries**; the exact
  per-role breakdown still needs the §9 item 6 read.
* The **complete** set of `public` default-ACL owners. The migration reads the catalog at
  apply time and reports any owner it may not act for, but the *list* still needs a live read
  to document which owner(s) are out of scope (§9 item 7).
* Whether any **global** (`ns=0`) function default ACL grants `EXECUTE` directly to
  `anon`/`authenticated`. Section 0b checks for this shape (for owners the applying role may
  act for); the 2026-11-03 audit recorded 0 global entries, and §9 item 7b confirms.
* Whether the applying role is a member of every `public` default-ACL owner. The 2026-11-03
  audit says it is **not** (`postgres` cannot manage `supabase_admin`'s); under the corrected
  design that owner is out of scope, reported via `RAISE NOTICE`, and does not stop the
  migration.
* **What any future session can actually do.** Default ACLs describe what a creating role
  stamps on new objects; effective privileges also depend on inherited memberships,
  `PUBLIC` and `BYPASSRLS`. Nothing here is a substitute for a live effective-privilege
  read.

---

## 3. F-A16-03 — RLS auto-enable fail-open behaviour

### 3.1 Evidence — the current exception handling

The function is **not in this repository** (`grep -r "rls_auto_enable\|ensure_rls"`
over `*.ts/*.sql/*.md/*.mjs` finds only the F-A15.1 analysis). Its body, reproduced in
`F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md` §4.1 from the official Supabase docs, is:

```sql
BEGIN
  EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
  RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
    RAISE;                    -- the exception is re-raised
END;
```

### 3.2 Is RLS activation failure swallowed?

**No — not inside the `BEGIN/EXCEPTION` block.** The `RAISE;` re-raises, so a failure
to run `ALTER TABLE … ENABLE ROW LEVEL SECURITY` aborts the creating transaction.

**But the overall behaviour is still fail-open**, for three reasons that the
`EXCEPTION` block does not cover:

1. **No post-condition check.** The function *attempts* the `ALTER`; it never verifies
   the flag afterwards. Any path where the `ALTER` is skipped or has no effect leaves a
   table with RLS off and the `CREATE TABLE` still succeeds.
2. **The schema filter.** `IF cmd.schema_name IN ('public')` means a table created in
   any other schema is left alone — correct for the platform's scope, but it means the
   guard is not a general invariant.
3. **`ALTER TABLE … ENABLE ROW LEVEL SECURITY` requires table ownership.**
   Verified on PGlite: when the creating role is not the table owner, the statement
   fails with `must be owner of table <t>` and the `CREATE TABLE` is aborted by the
   re-raise. That is fail-closed *when the exception path is reached* — but it depends
   entirely on the enabler being installed, enabled, and reached for that object. If the
   event trigger is disabled or absent, nothing checks.

### 3.3 Proposed fail-closed behaviour

`supabase/migrations/20261115000100_f_a16_fail_closed_rls_assertion.sql` — **additive**:

* It does **not** weaken, rename, drop or replace `ensure_rls` or `rls_auto_enable()`
  (the brief forbids that as a workaround, and a structural test asserts it).
* It adds a second, repo-owned event trigger `f_a16_assert_public_rls` on the **same**
  `ddl_command_end` tags. Postgres fires same-event triggers in name order, so
  `ensure_rls` (e…) runs before `f_a16_assert_public_rls` (f…): the assertion always
  observes the enabler's effect. (Proven, not assumed: two triggers created in the
  reverse of their name order still fired in name order on PGlite.)
* **Precondition.** The assertion blocks *any* `public` table that reaches
  `ddl_command_end` with RLS off, so it is incompatible with the repository's own
  `CREATE TABLE …; ALTER TABLE … ENABLE ROW LEVEL SECURITY;` pattern *unless* an enabled
  enabler runs first. The migration therefore verifies that an enabled
  `ddl_command_end` trigger calling `rls_auto_enable()` exists and **raises** if it does
  not, before creating anything. Installing the guard without an enabler would turn every
  future table creation into a hard failure — worse than failing the migration.
* The assertion reads `pg_class.relrowsecurity` **by `cmd.objid`** for each newly
  created `public` table and `RAISE EXCEPTION` (SQLSTATE `insufficient_privilege`) if it
  is false. A failure therefore **prevents the unsafe table creation from succeeding**.

Measured (PGlite):

| Scenario | Result |
|---|---|
| enabler present **and enabled**, assertion installed | installed; repo pattern (`CREATE TABLE`, then explicit `ENABLE RLS`) succeeds |
| enabler **absent** | assertion **refuses to install** (precondition) |
| enabler present but **disabled** | assertion **refuses to install** (precondition) |
| enabler disabled **after** install, creates a `public` table | creation **rejected**, no table left behind |
| `CREATE TABLE … AS` then `DISABLE ROW LEVEL SECURITY` | creation **rejected** |
| `CREATE TABLE IF NOT EXISTS` on an existing table | allowed — the event does not fire when the statement is skipped, so re-running a migration is not a spurious failure |
| creates a table in a non-`public` schema | allowed, RLS untouched (assertion scoped to `public`) |

**Reviewed gap — a partition created by `CREATE TABLE … PARTITION OF` (2026-11-03).**
Measured on PostgreSQL 17: `CREATE TABLE public.p PARTITION OF public.par …` emits
`command_tag = 'CREATE TABLE'` and `object_type = 'table'` for the new partition, and a
partition is **not** born with its parent's RLS (`relrowsecurity = false`, and
`ALTER TABLE … ENABLE ROW LEVEL SECURITY` on the partition is required and permitted). So
if a partitioned table is created in `public` while the enabler is disabled, the assertion
would fire on the parent and reject the whole statement — which is the desired fail-closed
outcome for the parent. The residual is narrower: a partition added to an *already-existing*
partitioned table. The assertion's post-condition (read `relrowsecurity` on each
`public` object that reached `ddl_command_end`) does not distinguish a partition from an
ordinary table, so it will also reject that partition — again fail-closed. No application
table in this repository is partitioned (a repository search finds no `PARTITION BY`), so
the gap is theoretical; it is recorded so a future reviewer is not surprised. The
assertion's `relkind IN ('r','p')` read and its scope filter are unchanged.

### 3.4 Secure `search_path` preserved

The assertion is `SECURITY INVOKER` with `SET search_path = pg_catalog`; every object it
references (`pg_event_trigger_ddl_commands`, `pg_class`, `format`) is in `pg_catalog`.
It needs no elevated right, and it does not change `rls_auto_enable`'s own
`SET search_path = pg_catalog`.

The assertion body contains **no** `RAISE LOG`/`WARNING`/`NOTICE` and no
`EXCEPTION WHEN` handler: it can only raise. A `NOTICE` in the assertion body would make
it fail open, so a structural test forbids one there. (The *precondition* block, which
runs once at install time, does emit a `NOTICE` on the success path — that is not a
failure path.)

### 3.5 Compatibility

**What was verified where.** Every behavioural claim in §3.3 was measured on PGlite
0.5.10 / PostgreSQL 18.6, an in-process Postgres. That is a faithful test of *Postgres
semantics* — event-trigger firing order, `ddl_command_end` behaviour for
`CREATE TABLE IF NOT EXISTS`, `pg_event_trigger_ddl_commands()` fields,
`pg_class.relrowsecurity`, and the transactionality of `ALTER DEFAULT PRIVILEGES`. It is
**not** a test of the Supabase platform layer, and it must not be reported as one.

| Assumption | Status | How it can be confirmed (read-only) |
|---|---|---|
| Event triggers fire in name order for the same event | **Verified** (PGlite; two triggers created in reverse name order still fired by name) | not needed — PostgreSQL behaviour |
| The enabler trigger is named `ensure_rls` | **Assumption** (Supabase docs + F-A15.1) | `SELECT evtname, evtenabled, evtfoid::regprocedure FROM pg_event_trigger` |
| `ensure_rls` is enabled | **Unverified** — the audit could not read it (F-A15.1 §12 item 5) | same query, read `evtenabled` |
| `ensure_rls`'s function is owned by `postgres` and is `SECURITY DEFINER` | **UNRESOLVED / Assumption** (F-A15.1 §4.1 assumed `postgres`; the F-A16 preflight states `supabase_admin`; no confirming read) | `SELECT proowner::regrole, prosecdef FROM pg_proc WHERE proname='rls_auto_enable'` — see `F-A16_INTEGRATION_VERIFICATION.md` §10.1 |
| The `f_a16_assert_public_rls` name sorts after `ensure_rls` | **Verified by construction** (`e` < `f`) | `SELECT evtname FROM pg_event_trigger ORDER BY evtname` |
| The applying role may create an event trigger | **Unverified for the target project** — `CREATE EVENT TRIGGER` is superuser-only in stock PostgreSQL; Supabase's `postgres` relies on `supautils`. The repo's tests run as superuser and cannot load `supautils`, so they do not prove this path | preflight `F-A16_EXECUTION_CHECKLISTS.md` §11 (reads `rolsuper`, `supautils`, and whether any event trigger exists) |
| Supabase PostgreSQL supports `ddl_command_end` event triggers | **Confirmed** — this is how the platform's own `ensure_rls` works | not needed |

The precondition block is written so that the two load-bearing assumptions (`ensure_rls`
exists, and is enabled) are **checked at apply time** rather than trusted. If either is
false the migration stops with an actionable message instead of installing a guard that
would block every future table creation.

* Existing migrations: the assertion is forward-only. It does not scan or alter
  existing tables, so it cannot conflict with any applied migration. It is idempotent
  (`DROP EVENT TRIGGER IF EXISTS` then `CREATE`; `CREATE OR REPLACE FUNCTION`).

### 3.6 The read-only checks this finding needs in production

Run these in the Supabase SQL editor. They are read-only and change nothing; they
confirm the precondition and the owner set against the real catalog. They are given
inline rather than appended to `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` so that
artifact — and the guard that pins its statement count and its SELECT-only property —
stays exactly as the completed audit produced it.

```sql
-- Does the enabler exist, what is it called, and is it enabled?
SELECT e.evtname, e.evtenabled, e.evtfoid::regprocedure AS function_called,
       pg_get_userbyid(e.evtowner) AS owner
  FROM pg_event_trigger e
 WHERE e.evtevent = 'ddl_command_end'
 ORDER BY e.evtname;

-- Is the enabler's function SECURITY DEFINER with a pinned search_path?
SELECT p.proname, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) AS owner
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable';

-- What are the exact default ACLs, and who owns them? The owner list for F-A16-02,
-- with NO grantee filter — an inventory, not a search for anon/authenticated.
SELECT pg_get_userbyid(d.defaclrole) AS owner_role, n.nspname AS schema,
       d.defaclobjtype AS object_type, d.defaclacl::text AS default_acl
  FROM pg_default_acl d
  LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
 ORDER BY 1, 2, 3;

-- Global (defaclnamespace = 0) default ACLs — assessed separately, because the implicit
-- PUBLIC EXECUTE on future functions is a global default and a per-schema read cannot see
-- it. For tables/sequences a row here is the one a schema-scoped REVOKE CANNOT subtract.
SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
       CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type
  FROM pg_default_acl d, aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace = 0
 ORDER BY 1, 2, 3, 4;

-- The complete owner set for `public` default ACLs: every pg_default_acl row for public,
-- with NO grantee filter — an inventory, not a search for anon/authenticated. This is the
-- candidate set the migration enumerates; a row here that the applying role cannot act for
-- makes the migration fail closed and hand you the owner-run step.
SELECT pg_get_userbyid(d.defaclrole) AS candidate_creator,
       pg_has_role(current_user, d.defaclrole, 'MEMBER') AS applier_may_act_for_it
  FROM pg_default_acl d
 WHERE d.defaclnamespace = 'public'::regnamespace
   AND pg_get_userbyid(d.defaclrole) <> 'pg_database_owner'
 ORDER BY 1;

-- Roles that EFFECTIVELY hold CREATE on public (inheritance- and PUBLIC-aware). These are
-- NOT enumerated by the migration (see plan §2.4.2b): their tables are owner-only and their
-- functions are covered by the forward guard. Read this to know which roles the owner-run
-- step should also consider.
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create
  FROM pg_roles r
 WHERE has_schema_privilege(r.oid, 'public', 'CREATE')
 ORDER BY 1;

-- Do any public-facing roles effectively hold CREATE on public? Section 0c fails closed
-- on a non-empty result.
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create
  FROM pg_roles r
 WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
 ORDER BY 1;
```

The result of the third and fourth queries is what decides whether the migration applies in
one pass or stops and requires the owner-run step. Note what these queries do **not**
establish: they cannot list creators that do not exist yet, and a default-ACL row does not
describe any session's *effective* privileges (those also depend on inherited memberships,
`PUBLIC` and `BYPASSRLS`). See §2.4.3.

---

## 4. F-A16-01 — Excessive existing table grants (narrow migration)

### 4.1 Why the scope is narrow

The 2026-11-03 audit read the production catalog: `anon` and `authenticated` hold
`REFERENCES`, `TRIGGER`, `TRUNCATE` on numerous existing tables, and `service_role` on
multiple. Those three privileges are the part of the platform's broad grant that **RLS
cannot compensate for**:

| Privilege | Risk | RLS mitigates? |
|---|---|---|
| `TRUNCATE` | destroys every row in one statement | **No** |
| `REFERENCES` | lets a role point a foreign key at the table | **No** |
| `TRIGGER` | lets a role attach a trigger that rewrites rows after a guard | **No** |
| `INSERT` / `UPDATE` / `DELETE` | writes | Yes, **if** a deny-all policy exists |
| `SELECT` | reads | Yes, **if** a deny-all policy exists |

Revoking those three is safe without a per-table application audit: no application path
uses them, and none is row-filtered by a policy. The DML privileges are a different
question — revoking them *can* break a live read or write — and are therefore handled by a
separate, owner-gated phase (§4.4) with a full matrix, not by this migration.

### 4.2 Evidence

* **Platform defaults are broad.** See §2.1. Every table created before the default
  hardening arrived with `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`
  for `anon` and `authenticated`.
* **The API layer already shows the effect.** `F-A16_PRODUCTION_EVIDENCE_SUMMARY.md` §3
  reports the `anon`-role census: 21 tables `401 permission denied`, 42 tables `200 … /0`
  (succeed but return 0 rows), and **4 tables where `anon` reads rows** (`events` 74,
  `aaradhanes` 2, `site_settings` 2, `social_links` 1). The 42 "succeed but 0 rows" tables
  are the tell: the API **accepted** the request (so the `GRANT` is present) and RLS
  filtered everything (so only the deny-all policy saved it). That is a defence that
  depends entirely on every one of those tables having an RLS policy — and
  `seva_list_items` (F-A16-04) demonstrates that is not guaranteed.
* **The repository already recognised this.** `20261029235900_seva_privilege_hardening.sql`
  revokes `TRIGGER, REFERENCES` from `service_role, anon, authenticated` on seven guarded
  tables, with the written rationale *"a role holding TRIGGER on a table can add its own
  trigger there"*. This migration generalises that decision to every public table.

### 4.3 The migration

`supabase/migrations/20261115000200_f_a16_existing_table_privileges.sql`:

| Step | Statement shape | Effect |
|---|---|---|
| 1 | `REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.<t> FROM anon, authenticated`, for every `public` table | no public-facing role holds any of the three |
| 2 | `REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.<t> FROM service_role`, for every `public` table | backend keeps DML and sequence `USAGE`; loses all three of `TRUNCATE`/`REFERENCES`/`TRIGGER` — **no exception** |
| 3 | re-issue `REVOKE TRIGGER, REFERENCES` on the seven seva tables (catalog-guarded) | idempotent; keeps the pre-existing hardening visible in one place |
| 4 | post-condition: fail if any public-facing role or `PUBLIC` still holds any of the three, or if one of the four public-read tables lost its `SELECT` policy **or** its `anon`/`authenticated` `SELECT` grant | the migration rolls back rather than reporting a false success |

Everything is **catalog-driven** (`pg_class` filtered to `nspname = 'public'`,
`relkind IN ('r','p')`), so the table set cannot drift from the schema.

**Correction (2026-11-03) — the `service_role` `TRUNCATE` exception was removed.** An
earlier revision kept `TRUNCATE` on `service_role` for the tables carrying a `BEFORE
TRUNCATE` guard, and read the exception from `pg_trigger` (`tgtype & 32`). That premise was
wrong: a `BEFORE TRUNCATE` trigger fires for the **table owner** and for a **superuser** as
well as for a non-owner holding `TRUNCATE` (measured on PostgreSQL 17.11 and 18.6). The
guard is therefore reachable for every role that can truncate, and keeping `TRUNCATE` on
`service_role` protected nothing. The exception list is now **empty**; the migration no
longer reads `pg_trigger`. See `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` §2.1 for the
measurements.

The nine tables with a `BEFORE TRUNCATE` guard at the audit base are `audit_log`, `staff`,
`seva_rate_history`, `seva_orders`, `seva_receipts`, `seva_receipt_lines`, `day_closes`,
`receipt_number_gaps`, `receipt_series_years`. Each is still protected after step 2: the
guard fires for any role permitted to truncate, and no public-facing role holds `TRUNCATE`
on any of them afterwards.

### 4.4 What is deliberately *not* in this migration

* **No `SELECT`/`INSERT`/`UPDATE`/`DELETE` revocation.** The audit's API census is evidence
  for a later phase, not for this one. That phase is specified table-by-table in
  `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` and is **not executed here**. It is gated on a
  live grant read and an application-dependency pass.
* **No policy is created, altered or dropped.** Step 4 *verifies* the four public-read
  policies still exist rather than assuming it.
* **No Supabase Auth or platform-schema object is named.** The sweep filters
  `n.nspname = 'public'`, and a structural test asserts the file never mentions `auth.`,
  `storage.` or `graphql`.
* **`PUBLIC` is not revoked from on existing tables.** The audit found no `PUBLIC` grant on
  an existing table, and a blanket `REVOKE ALL … FROM PUBLIC` could strip owner-intended
  access. A structural test pins this.

### 4.5 Preserve legitimate public SELECT

`anon` currently reads rows from exactly four tables (`events`, `aaradhanes`,
`site_settings`, `social_links`). Their `SELECT` grant and their RLS read policy
(`20261105000000_events_public_select_policy.sql`,
`20261111000000_aaradhanes_public_select_policy.sql`, and the `site_settings` /
`social_links` policies in `20261010000000_create_settings.sql`) must be preserved. This
migration never touches `SELECT` or any policy, and its post-condition fails if one of
those four loses its policy.

**Reviewer note — the public-read surface may be wider than four tables.** A static sweep
of `supabase/migrations/*.sql` finds non-`false` `SELECT` policies on `temple_areas`,
`announcements`, `ai_knowledge` (approved rows) and `featured_content` (active rows) as
well. The audit's *API census* shows only four tables actually returning rows to `anon`,
which is consistent with those tables being empty of matching rows or unreachable from the
client. This does not affect F-A16-01 (which never revokes `SELECT`), but it must be
resolved before the deferred DML phase, and it is recorded as an open question in the PR.
The table-by-table review is in `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` §4A.

### 4.6 Preserve admin and backend functionality

* The **admin dashboard** reads and writes through the service-role client
  (`createAdminClient()`), which bypasses RLS and keeps full DML — unaffected by any
  `anon`/`authenticated` revoke.
* The **seva operations** RPC surface runs as `service_role` through
  `createAdminClient().rpc(...)`; unaffected.
* The **Raya AI** retrieval modules choose the admin client on the server and the browser
  client only for public reads (`lib/ai/retrieval/*.ts`, `getSupabase()`); the browser
  path only ever reads the four public tables — unaffected.
* `service_role` keeps `SELECT/INSERT/UPDATE/DELETE` on every table and `USAGE` on every
  sequence; only the three RLS-invisible privileges (`TRUNCATE`, `REFERENCES`, `TRIGGER`)
  are removed — on `anon`, `authenticated` **and** `service_role`.

### 4.7 Regression tests for F-A16-01

* `tests/db/f-a16-existing-privileges.test.ts` — behavioural (PGlite): the three privileges
  are revoked from `anon`/`authenticated`; the four public-read tables keep `SELECT` and
  their policy; `service_role` keeps DML; `service_role` loses `TRUNCATE` even on a guarded
  table, and the guard still fires for the owner; a non-`public` table is untouched; the
  migration is idempotent; a missing public-read policy makes it fail closed and roll back.
* `tests/unit/f-a16-existing-privileges.test.ts` — structural: only the three privileges
  are ever revoked; never from `PUBLIC`; only the three public-facing roles; every table
  revoke is `public.`-qualified; no `auth.`/`storage.`/`graphql` reference; catalog-driven;
  no `pg_trigger`/`tgtype` exception remains; the post-condition asserts `PUBLIC` holds none
  of the three and that the four public-read tables keep their `SELECT` grant.

---


## 5. F-A16-04 — `seva_list_items`

### 5.1 Access pattern (repository evidence)

* The table is created in `20261030000000_seva_lists.sql`.
* RLS is enabled, and **no policy is ever created** on it — in that file or any other
  (a test asserts this across all migrations).
* `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role` then
  `GRANT SELECT, INSERT, UPDATE … TO service_role`. No `anon`/`authenticated` grant.
* All access is through three functions, each `GRANT EXECUTE … TO service_role` only:
  `seva_list_items_get()`, `seva_list_item_save(jsonb, uuid)`, and the guard
  `seva_list_items_guard()`.
* No application file references the table directly (a test asserts this across
  `app/`, `services/`, `lib/`, `components/`); the admin UI calls the functions through
  `lib/seva/server/rpc.ts` as `service_role`.

### 5.2 Conclusion — backend-only is intentional

Access is **exclusively through trusted backend operations**. The zero-policy state is
the intended, correct posture: RLS enabled (so a future mistake cannot silently expose
the table) with no policy (so the only path is the `service_role` functions). The audit's
`401 permission denied` for `anon` on this table is the expected result.

### 5.3 Proposed action

**None.** Do **not** create a permissive policy. The remediation is documentation (§5.2)
plus guard tests that pin the closed posture
(`tests/unit/f-a16-seva-list-items-and-storage.test.ts`), so a later edit cannot open
the table or grant it to a public role without failing CI.

---

## 6. F-A16-05 — Storage

### 6.1 Implementation (repository evidence)

* **No application code uses Supabase Storage.** A repo-wide search for
  `.storage.from(`, `createBucket(`, `getPublicUrl` over `app/`, `services/`, `lib/`,
  `components/`, `scripts/` finds nothing (a test asserts this).
* **All media uses Vercel Blob.** `services/storage.service.ts` imports
  `put, del, list` from `@vercel/blob`; gallery, testimonial and profile images and the
  video uploader all route through it
  (`services/testimonial.server.ts`, `services/profile.server.ts`,
  `components/ui/ImageUploader.tsx`, `components/ui/VideoUploader.tsx`).
* The public gallery reads blobs with `list()` from `@vercel/blob`
  (`app/(public)/gallery/page.tsx`).

### 6.2 Intended access model

Supabase Storage is **not part of the application's access model**. The one private
bucket the audit found, with zero policies and zero objects, is therefore inert: nothing
reads or writes it, so no policy is required for the application to function.

### 6.3 Proposed action

**None.** Do **not** make the bucket public and do **not** add a Storage policy: there is
no application requirement that would justify one, and the brief is explicit that a
policy must be supported by an actual requirement. If the owner later confirms the bucket
is intended for a new feature, the narrowest policy for that feature should be added
then, against the confirmed requirement. The guard tests pin the current state so a
policy cannot be added "to make the bucket work" without this failing.

---
## 7. Rollback plan

No migration here records a marker. F-A16-02/02b change only future-object behaviour;
F-A16-01 changes existing ACLs and is reversed by re-granting. Each is reversible on its
own.

### 7.1 F-A16-02 — restore the platform defaults

If the migration covered more than the applying role, the rollback must be repeated
`FOR ROLE <owner>` for each owner it touched. The owner-run step
(`docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` §3) carries the `FOR ROLE`
form of the rollback for `supabase_admin`.

```sql
-- Restore the documented Supabase platform defaults for objects created by postgres.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- If the FOR ROLE supabase_admin block ran, repeat the three statements FOR ROLE supabase_admin.
```

Note what is **not** needed: the migration issues no global statement, so there is no global
entry to restore. An earlier revision revoked `PUBLIC` EXECUTE globally; that statement is
gone, so the rollback is exactly the three platform defaults above.

Rollback affects only **future** objects; no existing object's ACL changes in either
direction. If the platform default matters, the cleanest reversal is a fresh project
snapshot — but note this migration changes nothing that is live today.

### 7.2 F-A16-02b — drop the forward guard

```sql
DROP EVENT TRIGGER IF EXISTS f_a16_public_fn_guard;
DROP FUNCTION IF EXISTS public.f_a16_public_fn_guard();
```

This restores the previous behaviour for functions created after the rollback: they carry
the implicit `PUBLIC` EXECUTE again. It does **not** re-grant anything on functions that
already exist (the guard only ever acted on new ones). Roll it back only if the
`PUBLIC` EXECUTE residual is accepted.

### 7.3 F-A16-03 — drop the assertion

```sql
DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls;
DROP FUNCTION IF EXISTS public.f_a16_assert_public_rls();
```

This restores the exact previous (fail-open) behaviour and does not touch `ensure_rls`.

### 7.4 F-A16-01 — restore the three privileges

```sql
-- Restore the platform over-grant (this is the point of a rollback):
GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Then re-run the pre-existing seva hardening so the guarded tables stay tight:
REVOKE TRIGGER, REFERENCES ON TABLE audit_log, staff, seva_rate_history, seva_orders,
  seva_receipts, seva_receipt_lines, day_closes FROM service_role, anon, authenticated;
```

`docs/audits/F-A16_EXECUTION_CHECKLISTS.md` §Rollback carries the full procedure. The
rollback touches only the three privileges — no DML and no policy is restored, because none
was changed.

### 7.5 Ordering

The migrations are independent. The intended order is the filename order, which
`supabase db push` follows:

1. `20261114990000_f_a16_public_function_execute_guard.sql` (forward guard, so it exists
   before any later function is created),
2. `20261115000000_f_a16_least_privilege_defaults.sql` (F-A16-02),
3. `20261115000100_f_a16_fail_closed_rls_assertion.sql` (F-A16-03),
4. `20261115000200_f_a16_existing_table_privileges.sql` (F-A16-01).

Roll back in any order. Rolling back F-A16-02/02b while keeping F-A16-01 and F-A16-03
leaves existing tables tight and the RLS assertion in force, which is the safe combination.

---

## 8. Before/after permission matrix

### 8.1 Default privileges (future objects) — F-A16-02 / F-A16-02b

| Object | Role | Before (platform default) | After |
|---|---|---|---|
| new table in `public` | `anon` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | **none** |
| new table in `public` | `authenticated` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | **none** |
| new table in `public` | `service_role` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE, DELETE |
| new sequence in `public` | `anon` | USAGE | **none** |
| new sequence in `public` | `authenticated` | USAGE | **none** |
| new sequence in `public` | `service_role` | USAGE | USAGE (unchanged) |
| new function in `public` | `anon` | EXECUTE (explicit + implicit PUBLIC) | **none** (forward guard) |
| new function in `public` | `authenticated` | EXECUTE (explicit + implicit PUBLIC) | **none** (forward guard) |
| new function in `public` | `service_role` | EXECUTE | EXECUTE (unchanged, reviewed exception) |
| **existing** object of any kind | any role | unchanged | **unchanged** by F-A16-02/02b |
| new object owned by **another** `public` default-ACL owner (e.g. `supabase_admin`) | `anon`/`authenticated` | broad defaults | **none** — or the migration **stops** and the owner-run step is required |

The forward guard is what closes the two "none" rows for functions. Without it, a new
function is anon-executable through the implicit `PUBLIC` EXECUTE even after F-A16-02
(measured; see §2.3).

### 8.2 RLS auto-enable — F-A16-03

| Scenario | Before | After |
|---|---|---|
| new `public` table, enabler installed and reached | RLS on | RLS on (unchanged) |
| new `public` table, enabler absent/disabled | created with RLS **off** | creation **rejected** |
| new `public` table, enabler throws (e.g. not owner) | creation aborted (re-raise) | creation aborted (unchanged) |
| new table in a non-`public` schema | allowed, RLS off | allowed, RLS off (unchanged) |
| **applying the assertion** with no enabled enabler | n/a | migration **refused** (precondition) — no guard installed |
| `CREATE TABLE IF NOT EXISTS` on an existing table | no-op | no-op (event does not fire) |

### 8.3 Existing table grants — F-A16-01 (proposed, not executed)

| Table class | Role | Current (from audit) | After this migration |
|---|---|---|---|
| all 67 public tables | `anon`/`authenticated` | TRUNCATE, REFERENCES, TRIGGER (among others) | **revoked** (this migration) |
| all 67 public tables | `anon`/`authenticated` | SELECT, INSERT, UPDATE, DELETE | **unchanged** (deferred phase) |
| 4 public-read tables (`events`, `aaradhanes`, `site_settings`, `social_links`) | `anon`/`authenticated` | SELECT + RLS SELECT policy | **SELECT grant + policy preserved** (verified) |
| 9 guarded tables (audit_log, staff, seva_*) | `service_role` | TRUNCATE + TRIGGER + REFERENCES | **all three revoked** — the guard fires for the owner/superuser too, so no exception is needed |
| all 67 tables | `service_role` | TRUNCATE, REFERENCES, TRIGGER | **all three revoked** |
| all 67 tables | `service_role` | SELECT, INSERT, UPDATE, DELETE | **unchanged** |

The DML rows are specified table-by-table in
`docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` and are **not executed here**.

---

---

## 9. Application dependencies that require manual validation

These must be checked by the owner against the live catalog before any F-A16-01 revoke,
and re-checked after applying F-A16-02 to confirm no future path regressed.

| # | Dependency | Why it matters | How to validate |
|---|---|---|---|
| 1 | `anon`/`authenticated` `SELECT` on `events`, `aaradhanes`, `site_settings`, `social_links` | public pages and Raya AI browser reads depend on it | confirm the grant and the RLS `SELECT` policy exist; load the public pages |
| 2 | `service_role` DML on all 67 tables | every admin write and seva RPC uses it | confirm `service_role` retains DML after any revoke |
| 3 | `service_role` `EXECUTE` on ~90 seva functions | the RPC surface; relies on the function default kept in §2.5 | confirm the default is unchanged, or add explicit grants before tightening it |
| 4 | Sequences used by `INSERT` (`serial`/identity) | `service_role` needs `USAGE` on the sequence | confirm `service_role` sequence `USAGE` is retained |
| 5 | `anon` `401 permission denied` on 21 tables | confirms the API refuses those tables for `anon` | re-run the audit census |
| 6 | `pg_default_acl` rows for `postgres` **and** `supabase_admin` | the migration assumes the documented defaults | read `pg_default_acl` live and compare |
| 7 | **Every** `public` default-ACL owner, and whether the applying role is a member of each | the migration enumerates owners and **fails closed** on any it cannot cover; the 2026-11-03 audit says `postgres` cannot act for `supabase_admin`, so the owner-run step is expected | `SELECT DISTINCT pg_get_userbyid(defaclrole) FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace`; then `SELECT pg_has_role(current_user, '<owner>', 'MEMBER')` per owner |
| 7a | Roles that **effectively hold CREATE** on `public` (inheritance- and `PUBLIC`-aware) | the migration deliberately does **not** enumerate these (§2.4.2b): their tables are owner-only and their functions are covered by the forward guard. Read this to decide whether the owner-run step should also cover them | `SELECT rolname FROM pg_roles r WHERE has_schema_privilege(r.oid,'public','CREATE')` |
| 7b | Any **global** (`defaclnamespace = 0`) table or sequence default ACL naming `PUBLIC`, `anon` or `authenticated`; any global **table** default of `TRIGGER`/`REFERENCES` for `service_role`; any global **function** default naming `anon`/`authenticated` | section 0b **fails closed** on these; a schema-scoped REVOKE cannot subtract them, and the global remedy is an owner action. The 2026-11-03 audit recorded **0 global entries**, so this should be empty | `SELECT pg_get_userbyid(d.defaclrole), CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' END, CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END, a.privilege_type FROM pg_default_acl d, aclexplode(d.defaclacl) a WHERE d.defaclnamespace = 0` |
| 7c | The `pg_database_owner` pseudo-role is present (PG 15+) | the migration skips it explicitly; if a target is PG 14 the name may be absent, which the skip tolerates | `SELECT rolname FROM pg_roles WHERE rolname = 'pg_database_owner'` |
| 7d | Whether `anon`, `authenticated` or `service_role` can **effectively create** in `public` | section 0c **fails closed** if any can; removing CREATE is a schema-ACL change (F-A16-01 scope, deferred) | `SELECT rolname FROM pg_roles r WHERE rolname IN ('anon','authenticated','service_role') AND has_schema_privilege(r.oid,'public','CREATE')` |
| 7e | Whether `CREATE` on `public` was granted to `PUBLIC` | it makes every role an effective creator and section 0c will refuse | `SELECT nspacl::text FROM pg_namespace WHERE nspname='public'` — look for `=C/` |
| 8 | The event trigger `ensure_rls` exists, is named that, and is **enabled** | F-A16-03's precondition checks this at apply time and refuses if not | `SELECT evtname, evtenabled, evtfoid::regprocedure FROM pg_event_trigger WHERE evtevent='ddl_command_end'` |
| 11 | Whether the applying role may create an event trigger at all | only `postgres` (via `supautils`) manages event triggers on Supabase | attempt is the test — the migration fails loudly; confirm by running it in a transaction and rolling back |
| 9 | Raya AI retrieval browser paths | they use the browser client for public reads only | confirm no retrieval module reads a non-public table with the browser client |
| 10 | Vercel Blob credentials and bucket | the whole media path depends on it, not Supabase Storage | confirm `BLOB_READ_WRITE_TOKEN` and gallery rendering |

---

## 10. Confirmed vs assumed

| Claim | Status |
|---|---|
| 67 public tables, 5 sequences, 87 functions, 24 schema-scoped default ACLs, **0 global default ACLs** | **Confirmed** (2026-11-03 production catalog audit) |
| `postgres` and `supabase_admin` both own default privileges in `public`; `postgres` cannot manage `supabase_admin`'s | **Confirmed** (2026-11-03 audit) |
| `anon`/`authenticated` hold `REFERENCES`, `TRIGGER`, `TRUNCATE` on numerous tables; `service_role` on multiple | **Confirmed** (2026-11-03 audit) |
| `rls_auto_enable` and `update_updated_at_column` have `PUBLIC` EXECUTE | **Confirmed** (2026-11-03 audit) |
| The repository defines no default privileges; the broad ones are platform-supplied | **Confirmed** (repo search; `tests/db/harness.ts` rationale) |
| `rls_auto_enable` re-raises inside its `EXCEPTION` block | **Confirmed** (F-A15.1 §4.1 reproduces the body) |
| There is no post-condition check, so the guard is fail-open in the paths in §3.2 | **Confirmed** (function body) |
| `seva_list_items` is backend-only by design | **Confirmed** (migration + app search) |
| The application uses Vercel Blob, not Supabase Storage | **Confirmed** (repo search) |
| The exact per-table grant matrix on the 67 tables | **Partially confirmed** — the 2026-11-03 audit gives the privilege classes per role; the per-table rows still need the §9 item 6 read |
| The exact per-role `pg_default_acl` breakdown | **Partially confirmed** — 24 schema-scoped / 0 global; per-role detail needs §9 item 6 |
| That all 67 tables currently have RLS enabled | **Assumption** from F-A15.1; the F-A16 catalog read was not executed |
| Event triggers fire in name order for the same event | **Verified** on PGlite with triggers created in reverse name order |
| `ALTER DEFAULT PRIVILEGES` is transactional, so a raised post-condition rolls the migration back | **Verified** on PGlite (revoke inside a txn, raise, rollback → defaults unchanged) |
| A member of a role may issue `ALTER DEFAULT PRIVILEGES FOR ROLE` for it; a non-member is refused | **Verified** on PGlite |
| A role with `CREATE` on `public` but no `pg_default_acl` row still confers the implicit `PUBLIC` `EXECUTE` on functions it creates | **Verified** on PGlite (`has_function_privilege('anon', …)` is true) |
| A role with no default ACL row produces owner-only tables (hardwired default) | **Verified** on PGlite (`relacl IS NULL`) |
| A grantee-filtered `pg_default_acl` search misses a role whose public default ACL names only another grantee | **Verified** on PGlite (the filtered query omits it; the migration covers it) |
| A per-schema `REVOKE … FROM PUBLIC` on FUNCTIONS is a no-op | **Verified** on PGlite (a new function stays anon-executable) |
| The forward guard revokes EXECUTE from `PUBLIC`/`anon`/`authenticated` and keeps `service_role` | **Verified** on PGlite (`tests/db/f-a16-existing-privileges.test.ts`) |
| The forward guard fires for a creator the migration cannot enumerate | **Verified** on PGlite (`ghost_creator`) |
| A schema-scoped `REVOKE` cannot subtract a global default privilege | **Verified** on PGlite (`anon` still had SELECT on a new table after the schema revoke) |
| `pg_get_userbyid(0)` returns `'unknown (OID=0)'`, not NULL | **Verified** on PGlite (so an `IN ('anon',…)` test never matches PUBLIC) |
| `ALTER DEFAULT PRIVILEGES` always keeps a non-revocable `owner=<privs>/owner` entry | **Verified** on PGlite (`REVOKE … FROM anon` left `{anon=X/anon}`) |
| The corrected migration creates **no** global (`ns=0`) default ACL row | **Verified** on PGlite (the global statement was removed; the post-condition asserts it) |
| A global `TRIGGER`/`REFERENCES` default for `service_role` survives the schema-scoped revoke | **Verified** on PGlite (a new public table still reported both as true) |
| The F-A16-01 revoke leaves the four public-read tables' `SELECT` and policies intact | **Verified** on PGlite |
| The F-A16-01 revoke keeps `service_role` `TRUNCATE` on a guarded table and removes it elsewhere | **Verified** on PGlite |
| PGlite results transfer to Supabase production | **NOT verified** — PGlite proves PostgreSQL semantics only; the platform layer needs the §3.6 read-only queries |
| The complete set of `public` default-ACL owners in production | **Unverified** — the migration enumerates at apply time and fails closed; the *list* needs §9 item 7 |
| Whether any global table/sequence/function default exists in production | **Confirmed 0** by the 2026-11-03 audit; §9 item 7b re-confirms |
| Whether `anon`/`authenticated`/`service_role` can create in `public` in production | **Unverified** — section 0c checks it at apply time; the live read in §9 items 7d/7e confirms it |
| Whether the public-read surface is exactly the four audited tables | **Open question** — a static policy sweep finds more non-`false` SELECT policies (§4.5). F-A16-01 never revokes SELECT, so it is unaffected; the deferred DML phase must resolve it |

---

## 11. Files in this change

| File | Purpose |
|---|---|
| `supabase/migrations/20261114990000_f_a16_public_function_execute_guard.sql` | F-A16-02b forward function-EXECUTE guard, proposed, not applied |
| `supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql` | F-A16-02, proposed, not applied |
| `supabase/migrations/20261115000100_f_a16_fail_closed_rls_assertion.sql` | F-A16-03, proposed, not applied |
| `supabase/migrations/20261115000200_f_a16_existing_table_privileges.sql` | F-A16-01, proposed, not applied |
| `supabase/migrations/20261115000300_f_a16_existing_function_privileges.sql` | F-A16-07, proposed, not applied |
| `tests/unit/f-a16-least-privilege-defaults.test.ts` | structural guard for F-A16-02 |
| `tests/unit/f-a16-existing-privileges.test.ts` | structural guard for F-A16-01 / F-A16-02b |
| `tests/unit/f-a16-existing-function-privileges.test.ts` | structural guard for F-A16-07 |
| `tests/unit/f-a16-fail-closed-rls-assertion.test.ts` | structural guard for F-A16-03 |
| `tests/unit/f-a16-seva-list-items-and-storage.test.ts` | F-A16-04 / F-A16-05 guards |
| `tests/unit/f-a16-migration-ledger-reconciliation.test.ts` | F-A16-06 guard |
| `tests/db/f-a16-least-privilege.test.ts` | behavioural PGlite tests for F-A16-02 / F-A16-03 |
| `tests/db/f-a16-existing-privileges.test.ts` | behavioural PGlite tests for F-A16-01 / F-A16-02b |
| `tests/db/f-a16-existing-function-privileges.test.ts` | behavioural PGlite tests for F-A16-07 |
| `tests/db/integration/f-a16.integration.test.ts` | real-PostgreSQL integration tests (event trigger, default privileges, F-A16-07) |
| `docs/audits/F-A16_INTEGRATION_VERIFICATION.md` | real-PostgreSQL integration verification report |
| `docs/audits/F-A16_OWNER_RUN_supabase_admin_defaults.sql` | F-A16-02 optional reference path for platform-internal owners |
| `docs/audits/F-A16_OWNER_RUN_supabase_admin_function_guard.sql` | F-A16-02b optional reference path for the superuser-created-function gap |
| `docs/audits/F-A16-01_PRIVILEGE_MATRIX.md` | F-A16-01 table-by-table privilege matrix (incl. the deferred DML phase) |
| `docs/audits/F-A16_EXECUTION_CHECKLISTS.md` | production preflight, post-execution verification, and rollback checklists |
| `docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md` | F-A16-06 reconciliation report |
| `docs/audits/F-A16_REMEDIATION_PLAN.md` | this document |

**NOT APPLIED TO PRODUCTION.** No migration in this change has been applied to any
database, and no production credential was used.

---

## 12. F-A16-07 — `PUBLIC` EXECUTE on two existing functions

The 2026-11-03 audit found `PUBLIC` EXECUTE on exactly two functions:
`rls_auto_enable` and `update_updated_at_column`. **Update (2026-11-05):** both are now
remediated by `supabase/migrations/20261115000300_f_a16_existing_function_privileges.sql`,
which revokes `EXECUTE` from `PUBLIC`, `anon` and `authenticated` and keeps `service_role`.
The reasoning below is retained as the justification for that migration.

### 12.1 `rls_auto_enable`

* **Owner / SECURITY DEFINER:** the platform enabler (see §3). `SECURITY DEFINER` with
  `SET search_path = pg_catalog`.
* **Caller:** an **event trigger** (`ensure_rls`), not a client. An event trigger executes
  its function as the role that owns the trigger (the owner of `ensure_rls`), not as the
  session role, so a `PUBLIC` EXECUTE grant is **not** required for it to fire.
* **Decision:** the `PUBLIC` EXECUTE grant is **not necessary** and is revoked. Revoking a
  grant on a function (not the function itself) is within F-A16's scope: it removes the
  client-reachable surface without altering the platform-owned object or its event trigger.
  The function only enables RLS, and only an event trigger invokes it.

### 12.2 `update_updated_at_column`

* **Owner / SECURITY DEFINER:** it is a plain trigger function (no `SECURITY DEFINER` in
  the repo's definition); the audit confirms the `PUBLIC` grant is the PostgreSQL implicit
  one.
* **Caller:** a `BEFORE UPDATE` **trigger** on the tables that carry an `updated_at`
  column. Trigger functions are invoked by the trigger machinery, not by a session role, so
  a `PUBLIC` EXECUTE grant is **not** required for the trigger to fire.
* **Residual risk if left:** a client could call it directly. The function body only sets
  `NEW.updated_at = now()` and returns `NEW`; called outside a trigger it raises (no `NEW`
  record) rather than doing anything. The exposure is therefore informational.
* **Correction (2026-11-03) — `REVOKE … FROM PUBLIC` alone is not enough.** The function is
  a *new* `public` function, so the platform default ACL also granted `EXECUTE` **directly**
  to `anon` and `authenticated`. `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC` removes only the
  implicit PUBLIC entry and **leaves the direct `anon`/`authenticated` grants in place** —
  measured on PostgreSQL 17: after `REVOKE … FROM PUBLIC`, `has_function_privilege('anon',
  …, 'EXECUTE')` is still `true`; only after `REVOKE … FROM PUBLIC, anon, authenticated` does
  it become `false`. So the safe statement must name all three grantees:

  ```sql
  REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
  ```

  (This is the same set the forward guard uses, so the guard and the one-off revoke agree.)
  Verified: the trigger still fires after the revoke (the trigger machinery does not consult
  the session role's EXECUTE), and `service_role` keeps EXECUTE.
* **Decision:** the corrected revoke is applied by
  `20261115000300_f_a16_existing_function_privileges.sql`. It is the least-privilege
  position, the trigger still fires after it, and `service_role` keeps EXECUTE. A repo
  search finds no client code that calls the function directly.

### 12.3 Why this is not a blind revoke

Both functions are invoked by the trigger machinery, which runs as the object owner and
does not consult the session role's `EXECUTE` privilege. That is why EXECUTE can be revoked
without breaking them. The migration revokes only the grant, never the function, so the
platform-owned `rls_auto_enable` and its event trigger are untouched. The forward guard
(§2.4) prevents the same pattern arising on **new** functions — and it uses `ON ROUTINE`
(not `ON FUNCTION`) so a new **procedure** is covered too (see §2.4.2c).

---

## 13. Post-execution verification and preflight

The full production preflight checklist, post-execution verification checklist and rollback
procedure are in `docs/audits/F-A16_EXECUTION_CHECKLISTS.md`. They are separate from this
plan so an operator can follow them without reading the design rationale. Every step is
marked **NOT EXECUTED** until an owner runs it.

---

## 14. Automatic production migration on `main` (rollout constraint)

This plan assumes an operator controls when migrations reach production. That assumption is
false today: a **Supabase GitHub integration** (`Supabase Preview`, app slug `supabase`)
applies pending `supabase/migrations/*.sql` to the production project on **every push to
`main`**, independently of the manually dispatched `.github/workflows/supabase-migrations.yml`.
It is currently failing at `20261115000000_f_a16_least_privilege_defaults.sql`, and `main`
receives roughly a dozen pushes a day (the scheduled `panchanga.yml` commits), so the
F-A16 files are being attempted on a cadence no operator chose.

Merging this branch to `main` therefore **fires the automatic deploy**. Before merging any
F-A16 migration, an owner must disable the integration's **Deploy to production** option
(Supabase Dashboard → Project Settings → Integrations → GitHub Integration), or accept that
the migrations apply without the preflight and dry-run steps in §13. This cannot be fixed
from the repository: there is no Management API endpoint for the setting, and the
`config.toml` `[db.migrations] enabled = false` switch (a) is not honoured by the pinned CLI
1.200.0 and (b) would also disable the manual workflow.

Full analysis, evidence, owner procedure and the repository-side guards added for it:
`docs/audits/F-A16_INTEGRATION_VERIFICATION.md` §13.
