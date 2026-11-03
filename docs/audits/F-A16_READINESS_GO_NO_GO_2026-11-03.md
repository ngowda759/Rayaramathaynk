# F-A16 — Read-Only Production Verification: Go / No-Go Report

**Date (UTC):** 2026-11-03
**Repository:** `ngowda759/Rayaramathaynk`
**Scope:** Decide whether the F-A16 remediation migration's preconditions are proven
satisfied, using read-only evidence only.

**Mode:** Read-only. No production connection was opened, no migration applied, no
GRANT/REVOKE/DDL/DML issued, no RLS/Supabase/Vercel/GitHub-secret change, no deployment,
and **no workflow dispatched**. No age private key was accessed, requested, printed or
committed, and the existing encrypted artifact was **not** decrypted.

> This is evidence for owner review. It is **not** authorization to write to production.

---

## 0. Verdict

## ⛔ NOT READY — BLOCKED ON OWNER ACTION

The migration's preconditions **cannot be verified from the current state of the
repository**, for two independent reasons:

1. **The verification tooling is not on `main`.** PR #381 (which adds the
   `include_extension` input and the 21-statement extension that answers checks 1, 2, 4
   and 8) is **still an open draft, not merged**. The extension file does not exist on
   `main`.
2. **The audit run has not been authorized.** The task requires *explicit owner
   authorization* before dispatch, and that authorization has not been given.

Neither is a technical defect; both are process gates. Nothing is broken — the work
simply cannot proceed past this point without the owner.

---

## 1. Step 1 — Are PR #380 and #381 merged, and is the extension on `main`?

**No. Both are open, in draft, and not merged.**

| PR | Title | State | Draft | Merged | Head SHA | Base |
|---|---|---|---|---|---|---|
| #380 | F-A16 production preflight report | `open` | **true** | **false** | `193b0d3484468629dc02279afee8c99a552b0ccc` | `main` |
| #381 | F-A16 read-only catalog audit extension | `open` | **true** | **false** | `16c3f814fa231b3d1d3c24f990f358a20dde029e` | `main` |

`main` tip: `aa44f5a363b6e6b07e497b6b97f6936ba2a81fcd` (`chore: update daily panchanga`).

Presence on `main` (GitHub Contents API + local `git cat-file`):

| Path | On `main`? |
|---|---|
| `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql` | **404 — absent** |
| `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.md` | **absent** |
| `docs/audits/F-A16_PREFLIGHT_AND_CATALOG_INDEPENDENT_REVIEW_2026-11-03.md` | **absent** |
| `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` (baseline) | present (200) |
| `.github/workflows/f-a16-production-catalog-audit.yml` | present (200, **baseline form**) |
| `supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql` | present |
| `supabase/migrations/20261115000100_f_a16_fail_closed_rls_assertion.sql` | present |

`git cat-file -e origin/main:docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql` →
`fatal: path … exists on disk, but not in 'origin/main'`.

**Consequence:** dispatching the audit from `main` today runs the baseline only. The
extension cannot be requested from `main` because (a) the workflow on `main` has no
`include_extension` input and (b) the SQL file is not there. The verification that this
task is about is therefore **not dispatchable from `main`**.

---

## 2. Step 2 — Workflow inputs and safeguards

Workflow id `403365447`, name **F-A16 Production Catalog Audit (read-only)**, state
`active`, `workflow_dispatch` only (no schedule/push/PR trigger).

### 2.1 Inputs — they differ by ref

**On `main` (baseline):**

```yaml
on:
  workflow_dispatch:
    inputs:
      confirm:
        required: true
        type: string
```

**On PR #381 (`security/f-a16-audit-query-extension`):**

```yaml
on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type RUN-READ-ONLY-AUDIT to confirm a read-only production catalog audit.'
        required: true
        type: string
      include_extension:
        description: 'Also run the additive read-only extension (effective privileges, membership, default ACLs, grant types).'
        required: false
        default: false          # ← verified default false
        type: boolean
```

`include_extension` defaults to **`false`**, is `required: false`, and is passed to the
run step through `env` (`INCLUDE_EXTENSION: ${{ inputs.include_extension }}`) — never
interpolated into the shell. The baseline stays a **literal first argument**:

```bash
EXTRA_SQL_FILES=()
if [ "${INCLUDE_EXTENSION}" = "true" ]; then
  EXTRA_SQL_FILES+=(docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql)
fi
node scripts/lib/run-catalog-audit.mjs \
  docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql \
  "${EXTRA_SQL_FILES[@]}" \
  "$RUNNER_TEMP/f-a16-audit.log"
```

A run that omits `include_extension` is byte-for-byte the pre-existing run.

### 2.2 Safeguards (all verified present)

| Safeguard | Where | Effect |
|---|---|---|
| Confirmation phrase | "Confirm the operator typed the acknowledgement" | Aborts unless `confirm == RUN-READ-ONLY-AUDIT` |
| Least privilege | `permissions: contents: read` | No write scope on the token |
| No credential persistence | `actions/checkout` `persist-credentials: false` | Git credentials not left in `.git/config` |
| Serialisation | `concurrency.group: f-a16-catalog-audit`, `cancel-in-progress: false` | No concurrent runs |
| Bounded runtime | `timeout-minutes: 20` | Cannot hang |
| Encryption pre-validated | "Install age and validate the encryption recipient" | Fails **closed** before any DB connection if no valid recipient |
| Destination guard | `scripts/lib/guard-approved-db-url.mjs` | Fails closed on missing/malformed/ambiguous/mismatched URL |
| Independent identity | `scripts/lib/verify-production-identity.mjs` | Management API must report the approved ref **and** the connected region must match the control plane |
| Read-only session | `SET default_transaction_read_only = on` + `SHOW` proof | Aborts unless both `transaction_read_only` and `default_transaction_read_only` read `on` |
| Read-only txn | `BEGIN READ ONLY; … ROLLBACK;` | Every statement inside a read-only transaction |
| Statement allowlist | `classify()` in `run-catalog-audit.mjs` | Only `SELECT`/`WITH`/`SHOW`; forbidden keywords rejected after stripping string literals |
| Encrypted-only output | "Encrypt the audit output" (`if: always()`) | Plaintext log exists only in `$RUNNER_TEMP`; only `.age` + `.sha256` are uploaded |
| Artifact handling | `actions/upload-artifact@v4`, `retention-days: 30`, `if-no-files-found: error` | 30-day retention; fails if nothing produced |
| Fail on incomplete | "Fail when the audit was incomplete" | Exit 3 → job fails; partial output is never reported as complete |
| Non-sensitive summary | "Write a non-sensitive job summary" | Aggregate counts only — no rows, policy text, function bodies or credentials |

Runner exit codes: `0` complete, `1` safety-check failure, `3` incomplete.

---

## 3. Step 3 — Does the GitHub environment have required reviewers?

**No. The `f-a16-catalog-audit` environment has no protection rules at all.**

```json
{ "name": "f-a16-catalog-audit", "protection_rules": [], "deployment_branch_policy": null }
```

All four environments, for context:

| Environment | Protection rules |
|---|---|
| `f-a16-catalog-audit` | **0** |
| `github-pages` | 1 |
| `Preview` | 0 |
| `Production` | 0 |

The workflow's own comment states this explicitly (line 69):

> `environment:` binding is a deployment control, not an approval gate, until
> [required reviewers are configured]

**Reported as-is; nothing was weakened, added or bypassed.** Practical consequence: if
the owner intends a human approval step before the audit runs, it **does not currently
exist**. Dispatch is itself the authorization. This is a governance gap, not a
technical blocker — the workflow's other safeguards (identity, read-only proof,
allowlist) still hold.

---

## 4. Step 4 — Dispatch

**Not dispatched.** Two gates:

1. The task states dispatch is permitted **only after explicit owner authorization**.
   No such authorization is present in this session, so I stopped as instructed.
2. Even with authorization, a *useful* run requires a ref that contains the extension.
   Options for the owner:
   - **Merge PR #381**, then dispatch from `main`; **or**
   - Dispatch from the PR branch without merging:
     `gh workflow run f-a16-production-catalog-audit.yml --ref security/f-a16-audit-query-extension -f confirm=RUN-READ-ONLY-AUDIT -f include_extension=true`

   Dispatching from `main` today would run the baseline only and would reject
   `include_extension` (unknown input on that ref).

---

## 5. Step 5 — Exact dispatch command (for the owner, not executed)

```bash
gh workflow run f-a16-production-catalog-audit.yml \
  --repo ngowda759/Rayaramathaynk \
  --ref main \
  -f confirm=RUN-READ-ONLY-AUDIT \
  -f include_extension=true
```

(Use `--ref security/f-a16-audit-query-extension` instead if PR #381 is not merged yet.
`include_extension` is a **boolean** input — pass `true`, unquoted.)

Required repository secrets (names only; values are not readable via the API and were
not accessed): `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`,
and an age recipient in `F_A16_AUDIT_AGE_RECIPIENT` (or `SEVA_BACKUP_AGE_RECIPIENT`).
The workflow fails closed if any required one is missing.

---

## 6. Step 6 — Capturing and reviewing results

No extension results exist. The only audit run in history is **run 5 (`41299082937`,
success, 2026-11-01)**, which executed the **37-statement baseline** with verified
identity and a proven read-only session:

```
### SESSION SAFETY ###
  transaction_read_only         = on
  default_transaction_read_only = on
  approved_ref_fingerprint      = 233ede17c9c7
### IDENTITY ###
  identity              = control-plane and data-plane identity agree with the approved project
  connected_host_region = ap-south-1
### SUMMARY ###
  statements_total   = 37
  statements_ok      = 37
  statements_failed  = 0
  audit_complete     = true
```

Its catalog **rows** are inside the encrypted artifact
`f-a16-catalog-audit-41299082937` (unexpired to 2026-12-01) and were **not** decrypted —
the task forbids that without explicit owner authorization, and no authorized age private
key is available in this environment anyway.

Runs 1–4 all `failure` (earlier attempts on 2026-11-01, before run 5 succeeded). Run 5
is the only successful audit.

---

## 7. Step 7 — Seva `authenticated` access and migration pre/postconditions

### 7.1 Seva `authenticated` access — UNVERIFIED

The preflight verified `anon` holds **no** grant on the Seva surface (21 `NO_GRANT`
tables), so a missing grant fails before RLS is consulted. The **`authenticated`** role
was not tested — no test user exists and the API layer cannot enumerate it. This needs a
catalog read, which the extension provides (§E5 effective table privileges across roles).

### 7.2 Migration preconditions → which check answers each

The two F-A16 migrations fail closed at runtime. Their preconditions map to audit
coverage as follows:

| Migration precondition | Needs | Answered by | Status |
|---|---|---|---|
| F-A16-02 §0 — required Supabase roles exist | `pg_roles` | baseline | not read (encrypted) |
| F-A16-02 §0b — no **GLOBAL** default grants to `PUBLIC`/`anon`/`authenticated`; no global table default of `TRIGGER`/`REFERENCES` to `service_role` | `pg_default_acl` expanded by grantee | **extension §E4** | **NOT VERIFIED** |
| F-A16-02 §0c — no public-facing role can `CREATE` in `public` | `has_schema_privilege` | **extension §E1/§E3** | **NOT VERIFIED** |
| F-A16-02 §4 — every other creator role enumerated and covered | `pg_roles` + `pg_has_role` membership | **extension §E1/§E2** | **NOT VERIFIED** |
| F-A16-02 §5 — post-condition (defaults no longer broader than intended) | `pg_default_acl` + `has_function_privilege` | **extension §E4** | **NOT VERIFIED** |
| F-A16-03 §0 — an **enabled** `ddl_command_end` event trigger calls `rls_auto_enable()` | `pg_event_trigger.evtenabled` | **baseline §4 + §9** | not read (encrypted) — **decryptable via the existing artifact** |

**Important nuance for check 8:** the F-A16-03 precondition *is* covered by the
**baseline** — it lists `pg_event_trigger` with `evtenabled`, and §9 specifically
queries the `rls_auto_enable` trigger. That answer already exists inside the encrypted
run-5 artifact. So **decrypting the existing artifact (with owner authorization) would
close the F-A16-03 §0 precondition** without a new run. It would still not close the
F-A16-02 §0b/§0c/§4/§5 preconditions, which need the extension.

### 7.3 Check status summary (preflight §7, unchanged)

| # | Check | Status |
|---|---|---|
| 1 | Roles that can create in `public`, incl. inherited | **NOT VERIFIED** |
| 2 | Execution-role membership per creator | **NOT VERIFIED** |
| 3 | Global + schema default ACLs | **NOT VERIFIED** |
| 4 | Global `TRIGGER`/`REFERENCES` defaults for `service_role` | **NOT VERIFIED** |
| 5 | Global table/sequence defaults blocking the migration | **NOT VERIFIED** |
| 6 | anon/authenticated `SELECT` on the 4 public-read tables | VERIFIED (anon) |
| 7 | Migration pre/postconditions | PARTIAL |
| 8 | Owner-run SQL preconditions | **NOT VERIFIED** |

---

## 8. Step 8 — Go / No-Go

### Decision: **NOT READY** (blocked on owner action, not on a technical defect)

**What is proven (unchanged, independently re-confirmed in the prior review):**

- Production identity and the Vercel wiring are consistent with the approved project.
- The deployed anon key matches the audited key; the invalid publishable key is unused.
- The public settings allow-list holds.
- 67 public tables; the 21/11/31/4 classification is internally consistent.
- The Seva surface is `NO_GRANT` for `anon`.
- The audit automation is read-only, fails closed, and its baseline run completed 37/37
  with verified identity and a proven read-only session.

**What is NOT proven (the blockers):**

- Checks **1, 2, 4, 8** and the F-A16-02 §0b/§0c/§4/§5 preconditions — need the
  extension, which is **not on `main`**.
- Seva `authenticated` access — needs the extension's §E5.
- The `f-a16-catalog-audit` environment has **no required reviewers**.

### Unresolved risks

| Risk | Severity | Note |
|---|---|---|
| Blind apply of the migration | High | Its preconditions read `pg_default_acl` and `has_schema_privilege`, both unread. A blind apply either passes silently or aborts with the reason discovered only at apply time. |
| `authenticated` over-permission on Seva | Medium | Unknown until §E5 runs. |
| No human approval gate on the audit | Medium | `environment` has zero protection rules. |
| Invalid `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel | Low | Currently unused; real config defect. |
| Extension not on `main` | Low/process | Dispatch from `main` cannot request it. |

### Exact remediation steps (owner)

1. **Merge PR #381** (or dispatch from its branch). This puts the extension and the
   `include_extension` input on the dispatched ref.
2. **Optionally configure required reviewers** on the `f-a16-catalog-audit` environment
   if a human approval gate is wanted — today there is none.
3. **Authorize and dispatch** the audit with `confirm=RUN-READ-ONLY-AUDIT` and
   `include_extension=true` (§5).
4. **Retrieve and decrypt the artifact** with the authorized age private key
   (out-of-band; never committed or printed) and review §E1/§E2/§E4/§E5/§E8 against the
   preflight's checks 1, 2, 4, 8.
5. **Optionally decrypt the existing run-5 artifact** to close the F-A16-03 §0
   precondition without a new run.
6. **Then** decide whether the migration applies cleanly and whether the owner-run §4
   global revoke is needed.
7. **Fix** the invalid publishable key in the Vercel dashboard.

**Stop for owner approval before any production write.**

---

## 9. Files changed in this report

| File | Change |
|---|---|
| `docs/audits/F-A16_READINESS_GO_NO_GO_2026-11-03.md` | **New** — this report |

No application, migration, workflow or configuration file was changed.

## 10. Safety confirmation

- No production connection opened; the only reads were read-only GitHub API calls and
  local file inspection.
- No GRANT/REVOKE, DDL, DML, migration, RLS-policy, Supabase-config, Vercel-variable or
  GitHub-secret change.
- No deployment; no merge; no production workflow dispatch.
- No age private key accessed, requested, printed or committed; the encrypted artifact
  was **not** decrypted.
- No Supabase Auth change. No Firestore dependency or fallback introduced.

**NOT APPLIED TO PRODUCTION.**
