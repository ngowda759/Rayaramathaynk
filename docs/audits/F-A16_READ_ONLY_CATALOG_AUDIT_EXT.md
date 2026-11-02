# F-A16 — Read-Only Catalog Audit Extension

**Status:** proposed, not run against production.
**Scope:** read-only query set. No GRANT, REVOKE, ALTER, CREATE, DROP or migration.
**Related:** `F-A16_READ_ONLY_CATALOG_AUDIT.sql` (baseline, 37 statements),
`F-A16_PRODUCTION_PREFLIGHT_2026-11-02.md` (what the API layer proved),
`F-A16_REMEDIATION_PLAN.md` (§9 items 7 / 7d / 7e).

---

## 1. Why a second file exists

The F-A16 production preflight reached the production **API** but not the production
**catalog**. PostgREST exposes only `public` and `graphql_public`, so
`pg_default_acl`, `pg_roles`, `has_schema_privilege` and grant *types* stayed unread.
Checks 1–5 and 8 of the preflight are therefore still **NOT VERIFIED**.

The baseline query set does not close that gap on its own. It reads
`pg_default_acl`, `information_schema` grants, `pg_policies` and `pg_proc`, but it
never calls an effective-privilege function and never reads the membership graph:

| Function / catalog | In the baseline? | Consequence of the gap |
|---|---|---|
| `has_schema_privilege()` | **no** | "can `anon` create in `public`?" — the migration's §0c question — is unanswerable |
| `has_table_privilege()` | **no** | `TRUNCATE`, `TRIGGER`, `REFERENCES` are invisible: they never surface as a row response, so no API probe can see them either |
| `has_function_privilege()` | **no** | effective EXECUTE (vs. one ACL entry) is unanswerable |
| `has_sequence_privilege()` | **no** | sequence grants come only from `information_schema`, which omits a role with no grant |
| `pg_auth_members` | **no** | an *inherited* privilege is invisible to a direct `nspacl` / `relacl` join |
| `aclexplode()` | **no** | a grant to **PUBLIC** (`grantee = 0`) cannot be named — `pg_get_userbyid(0)` returns `'unknown (OID=0)'`, never `'PUBLIC'` |

The extension adds exactly these. It is **additive**: the baseline file is unchanged
and still parses as 37 statements.

---

## 2. What it covers, mapped to the task list

| Required check | Section | Statement(s) |
|---|---|---|
| `pg_default_acl` | §E4 | 4 statements, expanded by grantee, plus a GLOBAL-only view and a count |
| `pg_roles` | §E1, §E3 | candidate creators; effective schema privilege |
| `pg_auth_members` | §E2 | membership edges, plus `pg_has_role` for the applying role |
| `has_schema_privilege()` | §E1, §E3 | effective CREATE / USAGE on `public` |
| `aclexplode()` | §E1, §E4, §E5, §E6 | PUBLIC-aware expansion of `nspacl`, `defaclacl`, `relacl`, `proacl` |
| Global **and** schema-specific table / sequence / function defaults | §E4 | `defaclnamespace = 0` (GLOBAL) and `= 'public'::regnamespace`; object types `'r'`/`'S'`/`'f'` |
| Effective privileges for candidate object creators | §E1, §E3 | `has_schema_privilege(r.oid, 'public', 'CREATE')` across all roles |

Section map: **E0** session guard · **E1** candidate creators · **E2** membership ·
**E3** effective schema privilege · **E4** default ACLs · **E5** effective table
privileges incl. TRUNCATE/TRIGGER/REFERENCES · **E6** function EXECUTE · **E7**
sequence privileges · **E8** self-describing summary.

**21 statements.** All are `SELECT`; none mutates anything.

---

## 3. How it runs

The runner now accepts more than one input file. Every positional argument except
the last is an input; the last is the output file.

```bash
node scripts/lib/run-catalog-audit.mjs \
  docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql \
  docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql \
  "$RUNNER_TEMP/f-a16-audit.log"
```

Through the existing workflow (`f-a16-production-catalog-audit`), set the
`include_extension` input to `true`. It defaults to `false`, so an existing run is
byte-for-byte unchanged unless the extension is requested.

The whole set runs in **one read-only session**: one identity verification, one
session-safety proof, one `BEGIN READ ONLY` transaction. The extension does not
introduce a second connection path.

### Safety, unchanged from the baseline

- Session forced read-only by ordinary SQL (`SET default_transaction_read_only = on`),
  then proven by reading `transaction_read_only` and `default_transaction_read_only`.
- Every statement inside `BEGIN READ ONLY … ROLLBACK`.
- Every statement classified against the runner's `SELECT`/`WITH`/`SHOW` allowlist
  **before** it is sent; anything else aborts the run.
- Destination and identity guards unchanged.
- Output still written only to the runner temp file, then age-encrypted. No catalog
  row reaches the public workflow log.

---

## 4. Testing

| Test | Kind | What it proves |
|---|---|---|
| `tests/unit/f-a16-audit-extension.test.ts` | static | baseline still 37 statements; extension is read-only under the runner's own `classify()`; covers every required catalog; avoids version-fragile `pg_auth_members` columns; workflow wiring; no row-content reads |
| `tests/db/f-a16-audit-extension-exec.test.ts` | behavioural (PGlite) | all 21 statements execute on real Postgres; detects a `TRUNCATE` grant a row-probe cannot see; resolves `PUBLIC` as `grantee = 0`; reads effective CREATE; summary returns one row |

Both run with no database credentials. `tests/db/**` uses an in-process Postgres.

---

## 5. Version compatibility

- `pg_auth_members` gained `inherit_option` and `set_option` in **PostgreSQL 16**.
  The extension selects only version-stable columns, so it does not break on an
  older server. A test asserts those column names are absent.
- `aclexplode()` and the `has_*_privilege()` family exist in every supported
  PostgreSQL version.
- `pg_default_acl`, `pg_roles`, `pg_class`, `pg_proc`, `pg_namespace` are standard
  catalogs; Supabase does not remove them.

---

## 6. What this extension still cannot do

- It does not prove **runtime** behaviour. A catalog read proves configuration.
- `has_*_privilege()` answers for the role **named**, not the connected role.
- `information_schema` views omit a role with no grant and never show PUBLIC;
  cross-check the `aclexplode` sections against them.
- It does not decrypt, re-run, or replace the existing encrypted audit artifact
  (run `41299082937`). If the owner can decrypt that, it may answer §E4 and §E5
  without a new run.

---

## 7. Blocker record

The extension cannot be executed from this environment:

- PostgREST reaches only `public` and `graphql_public`. `Accept-Profile: pg_catalog`
  returns `PGRST106`. There is no `pg/query` or `pg-meta` endpoint.
- No `SUPABASE_ACCESS_TOKEN` is available, so the Management API cannot be used.
- The approved read-only mechanism is the `f-a16-production-catalog-audit`
  workflow, which requires the production DB password and the age recipient as
  repository secrets, and is dispatched by the owner.

**No secret is requested or exposed.** Execution is left to the owner through the
existing approved mechanism.

---

**NOT APPLIED TO PRODUCTION.** This document and the query set describe a read-only
audit. No production object was read, changed, or granted.
