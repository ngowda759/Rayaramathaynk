# F-A16 — Least-Privilege Remediation Plan

**Status: PROPOSED. NOT APPLIED TO PRODUCTION.**

**Repository:** `ngowda759/Rayaramathaynk` · **Base commit:** `3048196` (`main`)
**Audit source:** `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`,
`docs/audits/F-A16_PRODUCTION_CATALOG_RESULTS.md`,
`docs/audits/F-A16_PRODUCTION_EVIDENCE_SUMMARY.md`, and the prior deep dive
`docs/audits/F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md`.

**Mode:** code-only remediation. No production Supabase connection was opened, no SQL
was executed against a live database, no migration was applied or dispatched, and no
grant, RLS policy, role, environment or workflow was changed. Every statement in this
plan about *production* configuration is sourced from the supplied audit documents,
not from a live read.

**Evidence labelling used throughout:** *Confirmed* = visible in repository source or
in the supplied audit documents; *Assumption* = inferred, needs a live catalog read to
confirm; *Unverified* = the audit explicitly recorded it as unread.

---

## 1. Executive summary

| Finding | Severity | Confirmed? | Remediation in this PR | Applied? |
|---|---|---|---|---|
| F-A16-01 — broad existing table grants to `anon`/`authenticated` | **High** | Assumption (from F-A15.1 + platform defaults) | Proposed grant audit + explicit least-privilege migration is **deferred**; documented here with the exact query and the manual-validation list | No |
| F-A16-02 — broad default ACLs for future objects | **High** | Confirmed (platform defaults; repo has none) | `20261115000000_f_a16_least_privilege_defaults.sql` | No |
| F-A16-03 — RLS auto-enable fail-open | **Medium** | Confirmed (function body in F-A15.1) | `20261115000100_f_a16_fail_closed_rls_assertion.sql` | No |
| F-A16-04 — `seva_list_items` RLS, zero policies | **Info / by design** | Confirmed (migration + app code) | Documented as intentional; guard tests added | N/A |
| F-A16-05 — private Storage bucket, zero policies | **Info / by design** | Confirmed (app uses Vercel Blob) | Documented; guard tests added | N/A |
| F-A16-06 — migration ledger reconciliation | **Info** | Confirmed (repo files) | Reconciliation report + guard test | N/A |

The guiding principle is the one in the task brief: **a smaller, evidence-backed
remediation over broad permission changes.** The only two changes proposed are
additive: (a) tighten *future-object* default privileges, and (b) add a fail-closed
assertion around RLS auto-enable. Neither revokes a privilege on an existing object.

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

### 2.3 Two mechanics that decide the SQL (verified on Postgres 18 / PGlite)

Both were reproduced in an in-process Postgres before writing the migration; the
reproduction is now a permanent test (`tests/db/f-a16-least-privilege.test.ts`).

1. **Tables and sequences — the per-schema form is sufficient.**
   A per-schema `REVOKE` *does* subtract from a per-schema `GRANT`. Revoking
   `ALL ON TABLES` / `ALL ON SEQUENCES` from `anon, authenticated` removes the whole
   set for future objects.

2. **Functions — only the *global* form works.**
   `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
   is a documented **no-op** (PostgreSQL docs: *"This command has no effect, unless it
   is undoing a matching GRANT"* — per-schema defaults can only add, never remove, the
   global default). The implicit `PUBLIC` `EXECUTE` must be removed with the global
   form, and because `anon`/`authenticated` also hold their own explicit default grant,
   a second, per-schema `REVOKE … FROM anon, authenticated` is required. Both are in the
   migration. Measured effect on a new function:

   | Statement applied | `anon` can EXECUTE? |
   |---|---|
   | none (baseline) | yes |
   | per-schema `REVOKE … FROM anon, authenticated` only | **yes** (still inherits via `PUBLIC`) |
   | per-schema `REVOKE … FROM PUBLIC` only | **yes** (no-op) |
   | global `REVOKE … FROM PUBLIC` + per-schema `REVOKE … FROM anon, authenticated` | **no** |

### 2.4 Proposed least-privilege defaults

`supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql`:

| Statement | Effect on future objects |
|---|---|
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated` | new tables grant `anon`/`authenticated` nothing |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRIGGER, REFERENCES ON TABLES FROM service_role` | backend keeps DML; loses the two DDL rights RLS cannot compensate for |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated` | no public role can advance a sequence |
| `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` | removes the implicit `PUBLIC` `EXECUTE` on future functions |
| `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated` | removes the platform's explicit grant to those roles |
| guarded `DO` block repeating the above `FOR ROLE supabase_admin` | covers the other object-owning role when the current role may act for it; otherwise a `NOTICE` |

A `DO` block first **raises** if `anon`, `authenticated` or `service_role` is absent, so
the migration fails loudly rather than silently leaving the defaults broad on a
non-Supabase database.

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

### 2.7 What this finding cannot prove without a live read

* The **exact** current `pg_default_acl` rows for `postgres` and `supabase_admin`
  (the audit could not read the catalog; this plan reproduces the *documented platform*
  defaults).
* Whether any *additional* role owns objects in `public` (the `DO` block covers
  `supabase_admin`; a live `pg_default_acl` read is the confirmation).

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
  observes the enabler's effect.
* The assertion reads `pg_class.relrowsecurity` **by `cmd.objid`** for each newly
  created `public` table and `RAISE EXCEPTION` (SQLSTATE `insufficient_privilege`) if it
  is false. A failure therefore **prevents the unsafe table creation from succeeding**.

Measured (PGlite):

| Scenario | Result |
|---|---|
| enabler present, creates a `public` table | RLS on, creation succeeds |
| enabler **absent**, creates a `public` table | creation **rejected**, no table left behind |
| `CREATE TABLE … AS` then `DISABLE ROW LEVEL SECURITY` | creation **rejected** |
| creates a table in a non-`public` schema | allowed, RLS untouched (assertion scoped to `public`) |

### 3.4 Secure `search_path` preserved

The assertion is `SECURITY INVOKER` with `SET search_path = pg_catalog`; every object it
references (`pg_event_trigger_ddl_commands`, `pg_class`, `format`) is in `pg_catalog`.
It needs no elevated right, and it does not change `rls_auto_enable`'s own
`SET search_path = pg_catalog`.

### 3.5 Compatibility

* Supabase PostgreSQL 15+/18: `ddl_command_end` event triggers, `pg_event_trigger_ddl_commands()`
  and `pg_class.relrowsecurity` are all long-standing. Verified on PGlite 0.5.10 /
  PostgreSQL 18.6.
* Existing migrations: the assertion is forward-only. It does not scan or alter
  existing tables, so it cannot conflict with any applied migration. It is idempotent
  (`DROP EVENT TRIGGER IF EXISTS` then `CREATE`; `CREATE OR REPLACE FUNCTION`).

---

## 4. F-A16-01 — Excessive existing table grants (deferred, with the exact method)

### 4.1 Why this is deferred

The audit could not read the production catalog, so the *actual* current grants on the
67 `public` tables are **unverified**. A blanket `REVOKE` on an unread grant set risks
breaking a live read or write — exactly the failure mode the brief warns against. The
repository does, however, provide strong *evidence* of what the grants are likely to be,
and that evidence says the exposure is real.

### 4.2 Evidence

* **Platform defaults are broad.** See §2.1. Every table created before the proposed
  default hardening arrived with `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
  TRIGGER` for `anon` and `authenticated`.
* **The API layer already shows the effect.** `F-A16_PRODUCTION_EVIDENCE_SUMMARY.md` §3
  reports the `anon`-role census: 21 tables `401 permission denied`, 42 tables
  `200 … /0` (succeed but return 0 rows), and **4 tables where `anon` reads rows**
  (`events` 74, `aaradhanes` 2, `site_settings` 2, `social_links` 1). The 42
  "succeed but 0 rows" tables are the tell: the API **accepted** the request (so the
  `GRANT` is present) and RLS filtered everything (so only the deny-all policy saved
  it). That is a defence that depends entirely on every one of those tables having an
  RLS policy — and `seva_list_items` (F-A16-04) demonstrates that is not guaranteed.
* **RLS is not a substitute for the grant.** RLS does not apply to `TRUNCATE`,
  `REFERENCES` or `TRIGGER` at all. Those three privileges on `anon`/`authenticated`
  are pure over-grant regardless of policy. The repository already recognised this for
  the seva tables: `20261029235900_seva_privilege_hardening.sql` revokes
  `TRIGGER, REFERENCES` from `service_role, anon, authenticated` on seven tables, with a
  written rationale (*"a role holding TRIGGER on a table can add its own trigger there"*).

### 4.3 The privileges that need attention, and why

| Privilege | Risk | RLS mitigates? |
|---|---|---|
| `TRUNCATE` | destroys every row in one statement | **No** |
| `REFERENCES` | lets a role point a foreign key at the table | **No** |
| `TRIGGER` | lets a role attach a trigger that rewrites rows after a guard | **No** |
| `INSERT` / `UPDATE` / `DELETE` | writes | Yes, **if** a deny-all policy exists |
| `SELECT` | reads | Yes, **if** a deny-all policy exists |

### 4.4 Proposed method (not executed here)

The correct remediation is a *measured* one, run only after a live catalog read:

1. Read the current grant matrix (the F-A16 audit SQL §4 already does this:
   `role_table_grants` / `table_privileges`, cross-checked against `pg_class.relacl`).
2. For every table, decide the intended `anon`/`authenticated` grant from the
   application's own evidence:
   * `anon`/`authenticated` read with the browser client → needs `SELECT` (plus an RLS
     `SELECT` policy);
   * every other access → `service_role` only.
3. Revoke `TRUNCATE, REFERENCES, TRIGGER` from `anon, authenticated` **on every table** —
   no application path uses them, so this is safe without a per-table audit.
4. Revoke `INSERT, UPDATE, DELETE` from `anon, authenticated` on every table that has no
   RLS write policy (i.e. every table except the ones with an explicit public-write
   policy, of which there are currently none).
5. Leave `SELECT` in place wherever a table has a public read policy; otherwise revoke.
6. Re-run the audit's §4 and §3 to confirm the matrix matches intent.

### 4.5 Preserve legitimate public SELECT

`anon` currently reads rows from exactly four tables (`events`, `aaradhanes`,
`site_settings`, `social_links`). Their `SELECT` grant and their RLS read policy
(`20261105000000_events_public_select_policy.sql`,
`20261111000000_aaradhanes_public_select_policy.sql`, and the `site_settings` /
`social_links` policies in `20261010000000_create_settings.sql`) must be preserved. The
remediation must not revoke `SELECT` on those four.

### 4.6 Preserve admin and backend functionality

* The **admin dashboard** reads and writes through the service-role client
  (`createAdminClient()`), which bypasses RLS and keeps full DML — unaffected by any
  `anon`/`authenticated` revoke.
* The **seva operations** RPC surface runs as `service_role` through
  `createAdminClient().rpc(...)`; unaffected.
* The **Raya AI** retrieval modules choose the admin client on the server and the browser
  client only for public reads (`lib/ai/retrieval/*.ts`, `getSupabase()`); the browser
  path only ever reads the four public tables — unaffected.

### 4.7 Regression tests for F-A16-01

Because the grants cannot be read here, no behavioural F-A16-01 test is added (a test
against a guessed grant set would be a false assurance). The reconciliation and the
audit SQL §4 remain the verification mechanism, and §8 lists the manual validation the
owner must run before any F-A16-01 revoke. This is stated plainly rather than papered
over with a test that proves nothing.

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

Neither migration records a marker and neither changes an existing object, so both are
reversible by restoring the previous state explicitly.

### 7.1 F-A16-02 — restore the platform defaults

```sql
-- Restore the documented Supabase platform defaults for objects created by postgres.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
-- The global PUBLIC EXECUTE default cannot be "re-granted" via ALTER DEFAULT PRIVILEGES
-- in every Postgres version; if it must be restored, recreate it explicitly:
-- ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- If the FOR ROLE supabase_admin block ran, repeat the four statements FOR ROLE supabase_admin.
```

Rollback affects only **future** objects; no existing object's ACL changes in either
direction. If the platform default matters, the cleanest reversal is a fresh project
snapshot — but note this migration changes nothing that is live today.

### 7.2 F-A16-03 — drop the assertion

```sql
DROP EVENT TRIGGER IF EXISTS f_a16_assert_public_rls;
DROP FUNCTION IF EXISTS public.f_a16_assert_public_rls();
```

This restores the exact previous (fail-open) behaviour and does not touch `ensure_rls`.

### 7.3 Ordering

Apply F-A16-02 and F-A16-03 independently; neither depends on the other. Roll back in
either order. Rolling back F-A16-02 while keeping F-A16-03 leaves the RLS assertion in
force, which is the safe combination.

---

## 8. Before/after permission matrix

### 8.1 Default privileges (future objects) — F-A16-02

| Object | Role | Before (platform default) | After (proposed) |
|---|---|---|---|
| new table in `public` | `anon` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | **none** |
| new table in `public` | `authenticated` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | **none** |
| new table in `public` | `service_role` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE, DELETE |
| new sequence in `public` | `anon` | USAGE | **none** |
| new sequence in `public` | `authenticated` | USAGE | **none** |
| new sequence in `public` | `service_role` | USAGE | USAGE (unchanged) |
| new function in `public` | `anon` | EXECUTE (explicit + implicit PUBLIC) | **none** |
| new function in `public` | `authenticated` | EXECUTE (explicit + implicit PUBLIC) | **none** |
| new function in `public` | `service_role` | EXECUTE | EXECUTE (unchanged, reviewed exception) |
| **existing** object of any kind | any role | unchanged | **unchanged** |

### 8.2 RLS auto-enable — F-A16-03

| Scenario | Before | After |
|---|---|---|
| new `public` table, enabler installed and reached | RLS on | RLS on (unchanged) |
| new `public` table, enabler absent/disabled | created with RLS **off** | creation **rejected** |
| new `public` table, enabler throws (e.g. not owner) | creation aborted (re-raise) | creation aborted (unchanged) |
| new table in a non-`public` schema | allowed, RLS off | allowed, RLS off (unchanged) |

### 8.3 Existing table grants — F-A16-01 (proposed, not executed)

| Table class | Role | Likely current | Proposed |
|---|---|---|---|
| 4 public-read tables (`events`, `aaradhanes`, `site_settings`, `social_links`) | `anon`/`authenticated` | full DML set + RLS SELECT policy | **SELECT only** + policy |
| other 63 tables | `anon`/`authenticated` | full DML set, RLS deny-all | **no privilege** |
| all 67 tables | `anon`/`authenticated` | TRUNCATE, REFERENCES, TRIGGER | **revoked** |
| all 67 tables | `service_role` | full DML | unchanged (minus TRIGGER/REFERENCES where the seva hardening already applies) |

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
| 7 | Whether any role beyond `postgres`/`supabase_admin` owns objects in `public` | the `DO` block covers only `supabase_admin` | `SELECT DISTINCT pg_get_userbyid(relowner) FROM pg_class WHERE relnamespace='public'::regnamespace` |
| 8 | The event trigger `ensure_rls` is enabled | F-A16-03 assumes it runs before the assertion | `SELECT evtname, evtenabled FROM pg_event_trigger` |
| 9 | Raya AI retrieval browser paths | they use the browser client for public reads only | confirm no retrieval module reads a non-public table with the browser client |
| 10 | Vercel Blob credentials and bucket | the whole media path depends on it, not Supabase Storage | confirm `BLOB_READ_WRITE_TOKEN` and gallery rendering |

---

## 10. Confirmed vs assumed

| Claim | Status |
|---|---|
| The repository defines no default privileges; the broad ones are platform-supplied | **Confirmed** (repo search; `tests/db/harness.ts` rationale) |
| `rls_auto_enable` re-raises inside its `EXCEPTION` block | **Confirmed** (F-A15.1 §4.1 reproduces the body) |
| There is no post-condition check, so the guard is fail-open in the paths in §3.2 | **Confirmed** (function body) |
| `seva_list_items` is backend-only by design | **Confirmed** (migration + app search) |
| The application uses Vercel Blob, not Supabase Storage | **Confirmed** (repo search) |
| The exact current grant matrix on the 67 tables | **Unverified** — the audit could not read the catalog |
| The exact `pg_default_acl` rows for `postgres`/`supabase_admin` | **Assumption** — documented platform defaults, not a live read |
| That all 67 tables currently have RLS enabled | **Assumption** from F-A15.1; the F-A16 catalog read was not executed |

---

## 11. Files in this change

| File | Purpose |
|---|---|
| `supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql` | F-A16-02, proposed, not applied |
| `supabase/migrations/20261115000100_f_a16_fail_closed_rls_assertion.sql` | F-A16-03, proposed, not applied |
| `tests/unit/f-a16-least-privilege-defaults.test.ts` | structural guard for F-A16-02 |
| `tests/unit/f-a16-fail-closed-rls-assertion.test.ts` | structural guard for F-A16-03 |
| `tests/unit/f-a16-seva-list-items-and-storage.test.ts` | F-A16-04 / F-A16-05 guards |
| `tests/unit/f-a16-migration-ledger-reconciliation.test.ts` | F-A16-06 guard |
| `tests/db/f-a16-least-privilege.test.ts` | behavioural PGlite tests for both migrations |
| `docs/audits/F-A16_MIGRATION_LEDGER_RECONCILIATION.md` | F-A16-06 reconciliation report |
| `docs/audits/F-A16_REMEDIATION_PLAN.md` | this document |

**NOT APPLIED TO PRODUCTION.** No migration in this change has been applied to any
database, and no production credential was used.
