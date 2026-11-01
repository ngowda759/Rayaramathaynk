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
| Identity check (destination) | `scripts/lib/guard-approved-db-url.mjs` (fails closed on missing, malformed, ambiguous or mismatched URL) |
| Identity check (independent) | `scripts/lib/verify-production-identity.mjs`: the Management API (control plane) must report the approved ref, the connected pooler region must match the region the control plane reports, and the session must carry the Supabase-managed roles. Fails closed when the control plane cannot confirm. |
| **Result** | **Not yet verified live.** The identity checks run inside the workflow, on the connection string the workflow derives. Until the workflow is dispatched, no live identity has been proven. |

A configured `SUPABASE_PROJECT_REF` is **not** treated as proof of the connected
database, and neither is the pooler username: `postgres.<ref>` is a destination
guard, not independent evidence. Identity requires the control-plane correlation
above; if it cannot be established the run aborts before any catalog query.

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
| Incomplete-audit handling | The runner exits **3** when any catalog statement fails, preserves the partial rows, and marks the output `AUDIT INCOMPLETE`; the workflow then fails the job after the encrypted partial output has been uploaded, so a partial run is never reported as complete |
| Output location | Encrypted artifact `f-a16-catalog-audit-<run_id>` (age), 30-day retention, on first successful run |
| Output confidentiality | Catalog rows are written only to the runner temp dir, never printed to the log or the job summary; the artifact is age-encrypted before upload because the repository is public |

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

## 8. Hardening applied to the automation

The automation was reviewed and hardened. Each item below is enforced in code and
covered by an automated test in `tests/unit/f-a16-audit-hardening.test.ts`.

| # | Hardening | Where |
|---|---|---|
| 1 | The age recipient is validated **before** any production connection is derived or probed | workflow: "Install age and validate the encryption recipient" runs before "Derive and verify target connection" |
| 2 | The recipient is validated structurally (bech32 HRP `age`, 62 characters, recomputed checksum) and, when present, by the real `age` tooling — not by a substring match | `scripts/lib/age-recipient.mjs` |
| 3 | A failed catalog statement makes the runner exit **3**, preserves the partial rows, and marks the output `AUDIT INCOMPLETE`; the workflow fails the job after uploading the encrypted partial output | `scripts/lib/run-catalog-audit.mjs`, workflow "Fail when the audit was incomplete" |
| 4 | Identity is independently verified from the control plane and correlated with the connected pooler region, plus a Supabase-role fingerprint; the run fails closed when identity cannot be established. The database name, the server IP and the username are never sufficient on their own | `scripts/lib/verify-production-identity.mjs` |
| 5 | Catalog rows, function definitions, policies and ACLs never reach the log or the job summary; the summary reports only counts and a completeness verdict | workflow summary step, runner stdout |
| 6 | The only uploaded artifact is the age-encrypted file; the upload is gated on the encrypt step's output | workflow "Encrypt"/"Upload" steps |
| 7 | Errors are redacted before they are recorded: passwords (in URLs, after `password=`, or bare), the pooler username, and the project ref | `scripts/lib/run-catalog-audit.mjs` `redact()` |
| 8 | The SELECT-only SQL and the production project allowlist are unchanged | `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql`, `scripts/lib/approved-project.mjs` |

## 9. Evidence limitations
- A statement that fails on permissions is reported as a limitation, not retried
  with a different credential. Because such a failure makes the run incomplete, the
  workflow fails the job; the encrypted partial output is still preserved.
- The runner executes the fixed query file only; it does not read application table
  rows.
- A catalog read proves configuration, not runtime behaviour under a specific
  request. F-A15.1-6 (deployed endpoint behaviour) is therefore out of scope here.

## 10. Recommended next investigation steps

1. Owner dispatches the workflow with the acknowledgement input, in a session with
   the required-reviewer environment gate configured.
2. Retrieve the encrypted artifact and decrypt it with the holder's age private key.
3. Fill §3–§7 of this document from the decrypted output, labelling each result
   *Confirmed in production* / *Different from F-A15.1* / *Unverified*.
4. Reconcile each F-A15.1 finding against the live catalog and record any
   difference with its cause (real change / migration drift / scope difference /
   inconclusive).

## 11. Confirmation of no production change

No INSERT, UPDATE, DELETE, UPSERT, TRUNCATE, CREATE, ALTER, DROP, GRANT, REVOKE,
migration, migration repair, RLS/policy/privilege/function/trigger/Storage change,
RPC call, dashboard change, environment-variable change, or deployment was
performed. The workflow is read-only and manually triggered, and it was **not**
dispatched as part of preparing it.
