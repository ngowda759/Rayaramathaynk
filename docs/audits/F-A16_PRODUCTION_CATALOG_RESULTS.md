# F-A16 — Production Catalog Audit Results

**Status: AUTOMATION PREPARED — AUDIT NOT YET EXECUTED.**

This document is the report shell for the automated F-A16 production catalog audit.
The workflow and runner are implemented and validated, but the audit has **not been
run**, so every catalog category below is **Unverified**. No row in this document
claims a production result.

- Automation: `.github/workflows/f-a16-production-catalog-audit.yml`
- Runner: `scripts/lib/run-catalog-audit.mjs`
- Query set: `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` (37 SELECT/SHOW statements)
- Approved target: `kvrkraqjuyxbraccxntk` (`https://kvrkraqjuyxbraccxntk.supabase.co`)
- Prior reproduction: `docs/audits/F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md`

> No production change was made. This audit is read-only. Findings are evidence,
> not authorization to remediate.

---

## 1. Production identity validation

| Item | Value |
|---|---|
| Approved project ref | `kvrkraqjuyxbraccxntk` |
| Approved host | `kvrkraqjuyxbraccxntk.supabase.co` |
| Identity check | `scripts/lib/guard-approved-db-url.mjs` (fails closed on missing, malformed, ambiguous or mismatched URL) |
| Second check | `scripts/lib/run-catalog-audit.mjs` re-derives the ref from the connection string and refuses any project other than the approved one |
| **Result** | **Not yet verified live.** The identity checks run inside the workflow, on the connection string the workflow derives. Until the workflow is dispatched, no live identity has been proven. |

A configured `SUPABASE_PROJECT_REF` is **not** treated as proof of the connected
database. The connected ref is re-derived from the pooler username
(`postgres.<ref>`) and must equal the approved ref, or the run aborts before any
query is sent.

## 2. Database role and read-only verification

| Item | Value |
|---|---|
| Role used | Derived from the pooler connection string (`postgres.<ref>`, the project owner role) |
| Read-only enforcement | `BEGIN READ ONLY` transaction + `default_transaction_read_only=on` startup parameter + SELECT/WITH/SHOW allowlist in the runner |
| Session proof | The runner reads `show transaction_read_only` and `show default_transaction_read_only`; if either is not `on` it aborts before running any audit statement |
| **Result** | **Not yet verified live.** The proof is emitted by the runner on the first run; the session-safety block is written to the encrypted output. |

## 3. Audit execution summary

| Item | Value |
|---|---|
| Executed | **No** |
| Execution timestamp (UTC) | — |
| Statements total | 37 (parsed and allowlist-checked offline; see §5) |
| Statements succeeded | — |
| Statements failed | — |
| Query errors | — |
| Output location | Encrypted artifact `f-a16-catalog-audit-<run_id>` (age), 30-day retention, on first successful run |

## 4. Results by catalog category

Every category is **Unverified** until the workflow runs. The "Feeds finding"
column links each category to the F-A15.1 finding it is meant to confirm or
disprove.

| # | Category | Status | Feeds finding |
|---|---|---|---|
| 1 | Table inventory and RLS flags (`pg_class`, `pg_tables`) | Unverified | F-A15.1-4 |
| 2 | FORCE ROW LEVEL SECURITY (`relforcerowsecurity`) | Unverified | F-A15.1-4 |
| 3 | RLS policies (`pg_policies`: text, cmd, roles, permissive/restrictive) | Unverified | F-A15.1-5 |
| 4 | Table grants and privilege matrix (`role_table_grants`, `table_privileges`) | Unverified | F-A15.1-3 |
| 5 | Function EXECUTE permissions (`has_function_privilege`) | Unverified | F-A15.1-1, F-A15.1-2 |
| 6 | SECURITY DEFINER functions (`pg_proc.prosecdef`) | Unverified | F-A15.1-1 |
| 7 | Default privileges and ACLs (`pg_default_acl`) | Unverified | F-A15.1-3 |
| 8 | Storage buckets and policies (`storage.buckets`, `pg_policies`) | Unverified | F-A15.1-7 |
| 9 | Migration history (`supabase_migrations.schema_migrations`) | Unverified | F-A15.1-8 |
| 10 | Extensions (`pg_extension`, incl. `pg_graphql`) | Unverified | lint family |
| 11 | Sequence privileges | Unverified | completeness |
| 12 | RLS auto-enable surface, per-table policy summary | Unverified | F-A15.1-1 |

## 5. Findings: confirmed / disproved / unverified

| Finding | Description | Status |
|---|---|---|
| F-A15.1-1 | `rls_auto_enable()` SECURITY DEFINER + EXECUTE grants | **Unverified** |
| F-A15.1-2 | `update_updated_at_column()` EXECUTE grants | **Unverified** |
| F-A15.1-3 | Broad default and existing table privileges | **Unverified** |
| F-A15.1-4 | FORCE RLS status | **Unverified** |
| F-A15.1-5 | `seva_list_items` RLS/policy state | **Unverified** |
| F-A15.1-6 | Public settings endpoint exposure | **Not applicable to a catalog audit** — this is a deployed-code question, verified separately by API checks (PR #370) |
| F-A15.1-7 | Storage bucket and policy state | **Unverified** |
| F-A15.1-8 | Migration/catalog drift | **Unverified** |

No finding is marked *Confirmed in production* or *Different from F-A15.1*: neither
label may be used without a live catalog read.

## 6. Evidence layers

This audit keeps three evidence sources strictly separate, so a conclusion from one
is never presented as a conclusion from another.

| Layer | Source | Can establish |
|---|---|---|
| PostgreSQL catalog | This workflow (catalog reads) | RLS flags, policy definitions, grants, function attributes, default ACLs, ledger, extensions |
| Production API | Deployed HTTP endpoints (PR #370 checks) | Whether an endpoint returns a projection; **not** whether RLS is configured |
| Repository source / migration | `supabase/migrations/**`, F-A15.1 reproduction | What the schema is *declared* to be; not what production *is* |

**An API zero-row response is not evidence that RLS is enabled or that a policy
denies access.** RLS configuration is only ever concluded from a catalog read.

## 7. Inaccessible catalog objects

To be recorded from the run's failed-statement summary. Categories that may be
restricted by role permissions include `storage.*` and
`supabase_migrations.schema_migrations`; the runner records each failed statement
with its error and continues, rather than aborting the whole run.

## 8. Evidence limitations

- The audit runs as the project owner role over the **session pooler (IPv4)**; the
  direct host `db.<ref>.supabase.co` is IPv6-only and unreachable from
  GitHub-hosted runners.
- A statement that fails on permissions is reported as a limitation, not retried
  with a different credential.
- The runner executes the fixed query file only; it does not read application table
  rows.
- A catalog read proves configuration, not runtime behaviour under a specific
  request. F-A15.1-6 (deployed endpoint behaviour) is therefore out of scope here.

## 9. Recommended next investigation steps

1. Owner dispatches the workflow with the acknowledgement input, in a session with
   the required-reviewer environment gate configured.
2. Retrieve the encrypted artifact and decrypt it with the holder's age private key.
3. Fill §3–§7 of this document from the decrypted output, labelling each result
   *Confirmed in production* / *Different from F-A15.1* / *Unverified*.
4. Reconcile each F-A15.1 finding against the live catalog and record any
   difference with its cause (real change / migration drift / scope difference /
   inconclusive).

## 10. Confirmation of no production change

No INSERT, UPDATE, DELETE, UPSERT, TRUNCATE, CREATE, ALTER, DROP, GRANT, REVOKE,
migration, migration repair, RLS/policy/privilege/function/trigger/Storage change,
RPC call, dashboard change, environment-variable change, or deployment was
performed. The workflow is read-only and manually triggered, and it was **not**
dispatched as part of preparing it.
