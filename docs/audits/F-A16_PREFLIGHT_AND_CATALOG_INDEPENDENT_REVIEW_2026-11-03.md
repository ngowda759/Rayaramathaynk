# F-A16 — Independent Review: Production Preflight (#380) and Catalog Audit Extension (#381)

**Date (UTC):** 2026-11-03
**Repository:** `ngowda759/Rayaramathaynk`
**Reviewed revisions**

| PR | Head SHA | Base | Size |
|---|---|---|---|
| #380 `docs/f-a16-production-preflight` | `924a0246fcce58389c3ede75156a7fb37127d383` | `main` `dc4aef86ada4b18c538fae4c279143ad7afb0719` | 1 file, +387 |
| #381 `security/f-a16-audit-query-extension` | `2655fc752912b96242eb360e33f8bab6a7739e37` | `main` `dc4aef86ada4b18c538fae4c279143ad7afb0719` | 6 files, +952/−6 |

**Mode:** read-only. **No production change was made.** No DDL, DML, GRANT, REVOKE,
RLS, function, Storage, Vercel or workflow change was issued against production. No
production workflow was dispatched. No migration was applied. No secret was read,
requested, printed or committed.

> Evidence for owner review, **not** authorization to remediate.

---

## 0. Verdict

**NOT READY — ADDITIONAL VERIFICATION REQUIRED.**

The API layer is well-evidenced and the remediation direction is sound, but the
catalog layer that decides *whether the migration applies cleanly* is still unread.
One genuine defect in the extension (a reversed `pg_auth_members` column
orientation) and two documentation inaccuracies were found and corrected. The
existing encrypted artifact is intact and usable, but it contains only the 37-statement
baseline — it cannot close the E4/E5 gap, so the extension must still be executed by
the owner.

---

## 1. Task A — PR #380 Production Preflight: review results

### 1.1 Findings validated against available evidence

| Preflight claim | Independent check | Result |
|---|---|---|
| Approved ref `kvrkraqjuyxbraccxntk`, region `ap-south-1` | Reproduced from run `41299082937` log (`Project region (Management API): ap-south-1`) and artifact identity line | **Confirmed** |
| Anon key in the deployed bundle = audited key, fp `4e93bd27b6f1` | Re-fetched the live bundle; decoded the JWT. `role=anon`, `ref=kvrkraqjuyxbraccxntk`, `exp=2099214093` (2036-07-09). SHA-256 prefix `4e93bd27b6f1` | **Confirmed byte-for-byte** |
| Vercel production wired to the approved project | Live GETs: `/`, `/donation`, `/gallery`, `/calendar`, `/sevas` → 200; `/api/public/settings/financeSettings` → 200; `/api/public/settings/device` → 404 (allow-list holds); `/api/chat` → 200 | **Confirmed** |
| `sb_publishable_…` (fp `d38fe9995705`) invalid and unused | `sb_publishable` appears in the shipped bundle **only** as a literal string test inside the Supabase JS library (`startsWith("sb_publishable_")`), never as a configured value. `lib/supabase/client.ts` prefers `NEXT_PUBLIC_SUPABASE_ANON_KEY` over the publishable name. | **Confirmed** — the publishable key is unused by the current bundle |
| No credentials/tokens/secrets in the report | Scanned for `sb_secret_*`, `sb_publishable_*`, JWTs, `postgres://…:…@`, PEM blocks — none. Only SHA-256 fingerprint prefixes. | **Confirmed clean** |
| Project ref appears as a 20-char literal (3×) | The report states refs appear "only as SHA-256 prefixes", but the literal `kvrkraqjuyxbraccxntk` appears 3× | **Minor inaccuracy** — the ref is already public in other committed docs and in `scripts/lib/approved-project.mjs`; not a secret. Recommend rewording the claim. |

### 1.2 Table inventory and the 21/11/31/4 classification

The 67 tables named across the four classes were extracted programmatically and
checked:

- **4 + 11 + 21 + 31 = 67**, with **67 distinct names and no duplicates**.
- The set is exactly the set of `CREATE TABLE` names in `supabase/migrations/`
  (68 raw matches, of which one — `t` — is a table inside a *comment* in
  `20261115000000_f_a16_least_privilege_defaults.sql:163`, not a real table). So
  **67 real public tables** is consistent with the repository schema.

**Confirmed.** The classification totals and membership are internally consistent and
consistent with the migration sources.

### 1.3 The 67-versus-68 discrepancy

The preflight §3.0 explains it as: the PostgREST OpenAPI `paths` map has 68 non-`/rpc/`
entries, one of which is the specification root `"/"`; a naive `path.slice(1)` turns
`"/"` into `""` and counts it as a 68th "table". The preflight attributes this to a
guard "already in `scripts/lib/run-catalog-audit.mjs`".

**Partially confirmed.** The `"/"`-filtering pattern exists in the repository, but in
`scripts/verify-supabase-migrations.ts:139-142`
(`.filter((p) => p !== "/")`), **not** in `run-catalog-audit.mjs`. The mechanism and
the arithmetic are correct; the attribution is imprecise. Recommended correction:
cite `scripts/verify-supabase-migrations.ts`, or soften "the audit infrastructure
already guards against" to "the repository's table-coverage check guards against".

**Arithmetic confirmed:** 145 raw `paths` − `/rpc/` entries = 68 non-RPC entries = 67
tables + the spec root. The correction note in §4 is sound.

### 1.4 GRANT and RLS findings

The 11 `GRANT_RLS_BLOCKED` tables carry an `anon` SELECT grant but return zero rows
because RLS denies. The row counts the preflight quotes from the secret-key read
(`page_views` 113, `unknown_questions` 45, `daily_poojas` 26, `sevas` 23,
`chat_sessions` 20, `settings_documents` 7, `quotes` 6, `gallery_albums` 4,
`testimonials` 2, `ai_settings`/`users` 1 each) are **API observations** and cannot be
independently re-verified from this environment (no production DB password; PostgREST
exposes only `public`/`graphql_public`). They are **internally consistent** with the
`F-A16_PRODUCTION_EVIDENCE_SUMMARY.md` census and with
`PRODUCTION_TABLE_INVENTORY.md`, but remain **API-layer observations, not catalog
facts**. The preflight labels them correctly as such.

The argument that these grants are "load-bearing on RLS alone" is **logically sound**:
an `anon` SELECT grant that RLS currently denies would become an exposure the moment
RLS is disabled or a permissive policy is added. This is a fair basis for a *grant*
revoke rather than a policy change.

### 1.5 Seva backend-only findings

`seva_list_items` and the 20 other Seva tables are in the `NO_GRANT` class (anon holds
no privilege; a missing grant fails before RLS is consulted). **Confirmed as a strong
positive result** — the Seva operational surface is already least-privilege for `anon`.

**Caveat preserved:** `authenticated` was not separately tested (no test user). Staff
access via `authenticated` remains unverified and needs a catalog read. The preflight
states this.

### 1.6 Vercel production observations

All live GET observations were independently reproduced (§1.1). The deployment serves
the approved project's anon key and the approved Supabase URL. **Confirmed.**

### 1.7 Unsupported assumptions and missing evidence

| Item | Assessment |
|---|---|
| "No Vercel credentials or CLI are available… the deployed artefact was used instead" | **Fair and clearly stated.** The bundle is the strongest available evidence of the effective config. |
| `authenticated` behaviour | **Unverified** (stated). |
| Checks 1–5 and 8 | **Unverified** (stated). These are the migration's own preconditions. |
| Run `41299082937` "may answer checks 3, 4 and 5 without a new run" | **Overstated** — see §3. The artifact contains only the 37-statement baseline, which reads `pg_default_acl` (check 3) but **not** `has_schema_privilege` (check 1/2) or the global `TRIGGER`/`REFERENCES` grant types as *effective* privileges (check 4). It may partially inform checks 3 and 5; it cannot close checks 1, 2, 4, 8. |
| `F_A16_AUDIT_AGE_RECIPIENT` / key availability | Not addressed in the preflight; see §3.4. |
| Approval gate on the audit environment | Not addressed; see §5.3 — the environment has **no protection rules**, so the "approval gate" is not currently enforced. |

### 1.8 Task A conclusion

The preflight is **technically sound and appropriately hedged**. Three small
corrections are warranted (the `slice(1)` attribution, the "refs appear only as
fingerprints" wording, and the overstatement about what the existing artifact can
close). It should not be marked complete until the catalog checks are closed by a run
of the extension.

---

## 2. Task B — PR #381 Catalog Audit Extension: review results

### 2.1 All 21 statements are read-only

Parsed the extension exactly as the runner does (strip `--` comments, split on `;`):

- **21 statements**, every one starting with `SELECT` (none `WITH`/`SHOW`).
- Under the runner's own `classify()` — the `SELECT`/`WITH`/`SHOW` allowlist plus the
  forbidden-keyword scan with string literals stripped — **all 21 pass**.
- The keywords `TRUNCATE`, `REFERENCES`, `TRIGGER` appear **only as quoted privilege
  names** inside `VALUES (...)` lists; the classifier strips string literals, so they
  do not trip the guard. `EXECUTE` appears only as a quoted privilege name and as
  `has_function_privilege(..., 'EXECUTE')`.

**Confirmed read-only.** No `INSERT/UPDATE/DELETE/UPSERT/CREATE/ALTER/DROP/GRANT/
REVOKE/COMMENT/CALL/DO/COPY/VACUUM/ANALYZE/REINDEX/CLUSTER/MERGE/LOCK/SET/RESET/
EXECUTE/PERFORM` token exists outside a string literal.

### 2.2 Effective privilege checks — verified

- §E1/§E3 call `has_schema_privilege(r.oid, 'public', 'CREATE')` across `pg_roles`.
- §E5 calls `has_table_privilege(role, oid, privilege)` for the 7 table privileges.
- §E6 calls `has_function_privilege('anon'|'authenticated'|'service_role', oid, 'EXECUTE')`.
- §E7 calls `has_sequence_privilege(...)` for `USAGE`/`SELECT`/`UPDATE`.

**Confirmed.** Each answers for the role *named*, which the doc states explicitly.

### 2.3 PUBLIC grant detection — verified

Every place public-facing roles are named, the filter is
`a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated','service_role')`,
and PUBLIC is labelled from the OID test (`CASE WHEN a.grantee = 0 THEN 'PUBLIC' …`).
This correctly avoids the trap that `pg_get_userbyid(0)` returns `'unknown (OID=0)'`,
never `'PUBLIC'`. **Confirmed.**

### 2.4 Inherited role membership checks — **defect found and fixed**

§E2 read `pg_auth_members` with the aliases **reversed**:

```sql
-- before (incorrect)
SELECT m.roleid::regrole::text AS member_role,
       m.member::regrole::text AS granted_role,
```

In `pg_auth_members`, **`roleid` is the role that is GRANTED** (the privilege holder)
and **`member` is the role that RECEIVES it** (the inheritor). This was verified
empirically against a real Postgres:

```
CREATE ROLE group_role; CREATE ROLE member_role; GRANT group_role TO member_role;
→ roleid::regrole = 'group_role' (granted), member::regrole = 'member_role' (member)
```

Under the original aliases, every membership edge in the audit output would have been
reported inverted — i.e. the audit would have stated that the privilege-holder is the
member and vice-versa, which is the opposite of the fact and directly relevant to the
migration's §4 "is the applying role a member of every candidate creator?" question.

**Fixed** in `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql` (aliases corrected and
a comment added explaining the orientation), and a new behavioural test
(`orients pg_auth_members as roleid=granted, member=member`) now pins the orientation
against a real Postgres so a future edit cannot silently invert it. The matching
assertion in the existing test was also corrected. This is a genuine technical defect,
corrected in place without weakening any guard.

The related `pg_has_role(current_user, r.oid, 'MEMBER')` checks in §E1/§E2 are
**correct** as written (`pg_has_role(member, role, 'MEMBER')`).

### 2.5 TRUNCATE / TRIGGER / REFERENCES detection — verified

§E5 detects the three high-risk types two ways: `has_table_privilege()` (effective) and
`aclexplode(relacl)` (raw ACL), plus a compact aggregate. The PGlite test proves a
`TRUNCATE` grant that a row-visibility probe cannot see is detected. **Confirmed.**

### 2.6 Global and schema-specific default privileges — verified

§E4 covers `pg_default_acl` expanded by grantee (`aclexplode`), with `defaclnamespace
= 0` (GLOBAL) and `= 'public'::regnamespace` (schema) distinguished, object types
`'r'`/`'S'`/`'f'`/`'T'`/`'n'`, a GLOBAL-only view, a scope/type count, and a
public-facing-grantee filter. **Confirmed.** The GLOBAL scope matters because a
schema-scoped REVOKE cannot subtract a global default — the migration's §0b premise.

### 2.7 Multi-input audit runner — verified

`ARGS = process.argv.slice(2)`; `OUT_FILE = ARGS[ARGS.length - 1]`;
`SQL_FILES = ARGS.slice(0, -1)`. The original single-input invocation
(`<sql> <out>`) still works (`SQL_FILES` has one element). Usage message updated.
Each file is parsed independently and concatenated, so the extension cannot change how
the baseline is counted. **Confirmed.** The existing
`tests/unit/f-a16-sql-path.test.ts` (which extracts the baseline path from the
workflow with `/^\s*([^\s\\]+\.sql)\s*\\?$/m`) still passes because the workflow keeps
the baseline as a **literal** first argument and appends the extension via a bash
array — the extraction is unaffected.

### 2.8 Workflow `include_extension` defaults to false — verified

```yaml
include_extension:
  description: '…'
  required: false
  default: false
  type: boolean
```

and in the run step:

```bash
EXTRA_SQL_FILES=()
if [ "${INCLUDE_EXTENSION}" = "true" ]; then
  EXTRA_SQL_FILES+=(docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql)
fi
```

The input is passed through `env` (never interpolated into the shell), consistent with
the existing `confirm` handling. **Confirmed.** With `include_extension` omitted, the
run is byte-for-byte the pre-existing run.

### 2.9 Original 37-statement baseline unchanged — verified

`git diff main pr-381 -- docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` is empty;
the blob SHA is identical (`e38d01ea162368409e16da533908a28b1fd0ddce`) on both. Parses
as exactly **37** statements, all `SELECT`/`SHOW`/`WITH`. **Confirmed.**

### 2.10 Same read-only transaction and preserved safety checks — verified

The extension is appended to the same `checked` list and runs inside the **same**
`BEGIN READ ONLY … ROLLBACK` transaction, after the same `enforceReadOnly()` proof and
the same `assertProductionIdentity()`. Destination guard, identity guard, session
read-only proof, per-statement timeout, connection timeout and the `classify()`
allowlist are all unchanged. A non-`SELECT` statement in either file aborts the run
before anything executes. **Confirmed — no guard was weakened.**

### 2.11 Test coverage and error handling — verified

| Suite | Result (this review) |
|---|---|
| `npx jest tests/unit/f-a16` | **7 suites, 126 passed, 1 skipped** |
| `tests/db/f-a16-audit-extension-exec.test.ts` | **8 passed** (was 7; +1 for the orientation test) |

The runner records per-statement failures with redaction, preserves partial output and
returns exit 3 (incomplete); the workflow encrypts partial output, then fails the job so
a partial audit is never green. Error handling is sound.

### 2.12 Documentation inaccuracies corrected

Two claims about what the baseline covers were inaccurate:

1. The extension SQL header and `.md` claimed the baseline "never calls
   `has_function_privilege()`". The baseline **does** call it, in §4, for `anon`,
   `authenticated` and `service_role`. Corrected to: it calls it for those three roles
   but not for other roles and never sees the PUBLIC EXECUTE entry.
2. The `.md` coverage table row for `has_function_privilege()` changed from **no** to
   **partly**.

The substantive gap claims (`has_schema_privilege`, `has_table_privilege`,
`has_sequence_privilege`, `pg_auth_members`, `aclexplode`, grant *types*) are all
**correct** and verified by grep of the baseline file.

### 2.13 Task B conclusion

The extension is well-constructed, additive, genuinely read-only and backward
compatible. **One genuine defect (reversed `pg_auth_members` aliases) and two
documentation inaccuracies were found and corrected.** No security guard was weakened.

---

## 3. Task C — Existing encrypted artifact (run 41299082937)

### 3.1 Does the artifact still exist? — **Yes**

| Field | Value |
|---|---|
| Run | `41299082937`, workflow `F-A16 Production Catalog Audit (read-only)`, `workflow_dispatch` |
| Conclusion | **success**, run attempt 1, run number 5, head `304819680f2ad31d5d597877d0d72ef538ac2b1e` (`main`) |
| Created / updated | 2026-11-01T10:48:23Z / 10:50:45Z |
| Artifact | `f-a16-catalog-audit-41299082937`, id `13080158531` |
| Size | 503,139 bytes |
| **Expired** | **false** — expires 2026-12-01T10:50:41Z |
| GitHub artifact digest | `sha256:1261752271c814ca60810c54e5d066913e53f3789e76c4033805ad1740a6592c` |

The artifact was downloaded (read-only) and contains two files:

- `f-a16-catalog-audit-2026-11-01T105041Z.age` (502,686 bytes) — the age ciphertext
- `f-a16-catalog-audit-2026-11-01T105041Z.age.sha256` — `21213cf004cd8ea95780d58dd2cd49626b0f25eb812e2f25e8018213713c247f`

### 3.2 Can its metadata and completeness be verified? — **Yes**

From the run log (downloaded via the Actions API; no secrets present):

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

So: identity independently verified (control-plane + data-plane), session proven
read-only, **37/37 statements executed, 0 failed, complete**. The inner `.sha256` file
matches the preflight §11 citation (`21213cf0…3c247f`). The age file's X25519
recipient is `aG8MerAc4JlqCN5zER1okabvMi7e6EIvxjukgh54swE` (a public key — safe to
record).

### 3.3 Does it contain the E4/E5 information the preflight needs? — **Only partly; it cannot close the gap**

The artifact contains the **37-statement baseline only**. Mapping to the extension's
sections and the preflight's unverified checks:

| Preflight check | Baseline statement present? | Can the artifact close it? |
|---|---|---|
| 3 — global + schema default ACLs | §5 reads `pg_default_acl` (owner, schema, objtype, **raw `defaclacl` text**) and the global-only subset and a count | **Partially** — the raw ACL text is there, but it is **not expanded by grantee**, so PUBLIC (`grantee = 0`) and per-grantee privilege types are not directly named. Usable with manual interpretation; the extension's §E4 is cleaner. |
| 4 — global `TRIGGER`/`REFERENCES` defaults for `service_role` | §5 raw `defaclacl` text only | **Partially** — only as unparsed ACL text; no effective-privilege answer. |
| 1 — roles that can create in `public`, incl. inherited | **absent** — no `has_schema_privilege` | **No** |
| 2 — execution-role membership per creator | **absent** — no `pg_auth_members` | **No** |
| 5 — global table/sequence defaults blocking the migration | raw `pg_default_acl` only | **Partially** |
| 8 — owner-run SQL preconditions | **absent** | **No** |

**Conclusion:** the existing artifact can *partially inform* checks 3, 4 and 5 from raw
ACL text, but it **cannot** answer checks 1, 2 or 8, and it does not give the
grantee-expanded, effective-privilege form the extension provides. The preflight's
suggestion that the artifact "may answer checks 3, 4 and 5 without a new run" is
**overstated**; the extension run is still required.

### 3.4 Can the artifact be decrypted with an authorized owner-provided age key? — **No key is available here; documented as a blocker**

- No age **identity** (private key) is present in this environment: no
  `AGE_IDENTITY`/`AGE_SECRET_KEY`-style variable, no age key file anywhere on the
  filesystem, and the `age` binary is not installed.
- The repository's only age reference is the **public recipient**
  (`scripts/lib/age-recipient.mjs`, `F_A16_AUDIT_AGE_RECIPIENT` falling back to
  `SEVA_BACKUP_AGE_RECIPIENT`); a recipient cannot decrypt.
- The `age` file header confirms a single X25519 recipient:
  `age-encryption.org/v1 → X25519 aG8MerAc4JlqCN5zER1okabvMi7e6EIvxjukgh54swE`.

**Per the task's security restrictions, this is where the artifact investigation
stops.** No attempt was made to obtain, guess or brute-force the key, and no
encryption was bypassed. **Blocker:** the authorized age private key must be supplied
by the owner (out-of-band, never committed and never printed) before the artifact can
be read. If the owner decrypts it, the raw §5 `pg_default_acl` output may partially
inform checks 3–5 as above.

---

## 4. Task D — Extension execution readiness (owner instructions)

**Do not dispatch yet.** The following is the exact, verified procedure for the owner.
It was **not** executed as part of this review.

### 4.1 Workflow input configuration — verified

Workflow: `.github/workflows/f-a16-production-catalog-audit.yml` → **F-A16 Production
Catalog Audit (read-only)**. Trigger: `workflow_dispatch` only (no schedule, push or
PR trigger).

Required inputs:

| Input | Type | Required | Value |
|---|---|---|---|
| `confirm` | string | yes | `RUN-READ-ONLY-AUDIT` |
| `include_extension` | boolean | no (default `false`) | **`true`** |

`permissions: contents: read`; `concurrency.group: f-a16-catalog-audit`;
`timeout-minutes: 20`. The workflow is bound to `environment: f-a16-catalog-audit`.

Dispatch (owner, from a machine with the token):

```bash
gh workflow run f-a16-production-catalog-audit.yml \
  --repo ngowda759/Rayaramathaynk \
  --ref main \
  -f confirm=RUN-READ-ONLY-AUDIT \
  -f include_extension=true
```

> Note: `include_extension` is a `boolean` input; pass `true`/`false` (not a quoted
> string).

### 4.2 Repository secrets and expected configuration — verified names

| Secret | Required for | Notes |
|---|---|---|
| `SUPABASE_PROJECT_REF` | project guard + region lookup | `kvrkraqjuyxbraccxntk` |
| `SUPABASE_DB_PASSWORD` | derives the pooler connection string | production DB password |
| `SUPABASE_ACCESS_TOKEN` | Management API identity verification | required; the run aborts without it |
| `F_A16_AUDIT_AGE_RECIPIENT` (preferred) or `SEVA_BACKUP_AGE_RECIPIENT` | encrypts the output | the workflow **fails closed** if neither is set/valid |

The repository's secret **names** are visible via the API; their **values** are not
readable (GitHub does not expose them), and were not accessed. Confirm each secret
exists before dispatch — the workflow's "Guard approved project ref", "Derive and
verify target connection" and "Install age and validate the encryption recipient" steps
each fail closed with an explicit error if a secret is missing.

### 4.3 Age encryption and artifact handling — verified

- `age` is installed and the recipient is validated by
  `scripts/lib/age-recipient.mjs` **before** any production connection is derived.
- The audit output is written only to `$RUNNER_TEMP/f-a16-audit.log`; stdout carries
  only the aggregate summary.
- The log is encrypted to `f-a16-catalog-audit-<stamp>.age`, a `.sha256` is written,
  and only those two files are uploaded (`actions/upload-artifact@v4`,
  `retention-days: 30`, `if-no-files-found: error`).
- Encrypted output is produced even on exit 3 (partial), so partial rows are preserved
  in encrypted form only.

### 4.4 Production identity validation — verified

Two independent checks run before any catalog statement:

1. **Destination guard** — `guard-approved-db-url.mjs` verifies the derived URL
   resolves to exactly one project and it is the approved ref.
2. **Independent identity** — `verify-production-identity.mjs` requires the Management
   API to report the approved ref, the connected pooler region to match the region the
   control plane reports, and the session to carry the Supabase-managed roles. Fails
   closed if the control plane cannot confirm.

Proven in run `41299082937`: `identity = control-plane and data-plane identity agree
with the approved project`, `connected_host_region = ap-south-1`.

### 4.5 Read-only transaction enforcement — verified

Three independent mechanisms: `SET default_transaction_read_only = on` sent as ordinary
SQL (the pooler-reliable path; Supavisor drops the startup `options` packet), proven by
reading `transaction_read_only` and `default_transaction_read_only` (the run aborts
unless both are `on`); every statement inside `BEGIN READ ONLY … ROLLBACK`; and the
`SELECT`/`WITH`/`SHOW` allowlist that aborts before sending anything else.

### 4.6 Output completeness and failure handling — verified

- Every statement is attempted; failures are recorded with the error redacted and
  preserved in the output file.
- Exit codes: `0` complete, `1` safety-check failure, `3` incomplete.
- On `3`, the workflow warns, still encrypts and uploads the partial output, then a
  later step **fails the job** so partial output is never reported as complete.
- A non-sensitive aggregate is written to the job summary; no catalog rows, policy
  text, function definitions or credentials.

### 4.7 Prerequisite for the extension to be meaningful

The extension must be **merged to `main`** (or dispatched from the PR branch `ref`)
for `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql` to exist at the checked-out
revision. As of this review, PR #381 is a **draft**, so the extension file is **not on
`main`**. Dispatching from `main` with `include_extension=true` today would make the
runner fail to open the extension file. The owner must either dispatch from the PR
branch, or merge PR #381 first. (This review did not dispatch anything.)

### 4.8 Expected extension output size

The baseline produced a ~503 KB encrypted artifact. The extension adds 21 statements
(the §E5 statements alone can emit one row per role × table × privilege, and §E4 one
row per default-ACL entry). Expect a larger plaintext log; the runner has a 20 s
per-statement timeout, so this should be well within limits.

---

## 5. Task E — Final reconciliation

### 5.1 Findings confirmed by API evidence

- Approved project identity and Vercel wiring (§1.1).
- The deployed anon key is byte-identical to the audited key (fp `4e93bd27b6f1`,
  `role=anon`, ref `kvrkraqjuyxbraccxntk`).
- The invalid publishable key is **unused** by the bundle (only a library literal).
- The public settings allow-list holds (`device` → 404).
- The 67-table set and the 21/11/31/4 classification are internally consistent and
  consistent with the migration sources.
- The Seva surface is `NO_GRANT` for `anon`.

### 5.2 Findings confirmed by catalog evidence

- **None new from this review.** The catalog is unreachable from this environment
  (PostgREST exposes only `public`/`graphql_public`; no Management API token; no
  production DB password).
- However, the run `41299082937` log proves a catalog session *did* execute 37/37
  baseline statements with verified identity and a proven read-only session — so the
  baseline catalog evidence exists inside the encrypted artifact.

### 5.3 Findings confirmed by existing encrypted artifacts

- Artifact `13080158531` exists, unexpired (to 2026-12-01), 37/37 complete, identity
  verified, read-only proven.
- It contains the **baseline only**; it can partially inform checks 3–5 from raw
  `pg_default_acl` text but cannot close checks 1, 2 or 8.
- It **cannot be decrypted here** — no authorized age private key is available. This
  is a documented blocker, not a bypass attempt.
- **New finding:** the `f-a16-catalog-audit` environment has **no protection rules**
  (`protection_rules: []`), so the workflow's comment that it is an "approval gate"
  is **not currently enforced**. Without required reviewers configured, the workflow
  runs on dispatch with no human approval step. Recommend the owner add required
  reviewers (or accept that dispatch is itself the authorization).

### 5.4 Remaining unverified checks

| # | Check | Why still open |
|---|---|---|
| 1 | Roles that can create in `public`, incl. inherited | needs `has_schema_privilege` (§E1/§E3) |
| 2 | Execution-role membership per creator | needs `pg_auth_members`/`pg_has_role` (§E2) |
| 3 | Global + schema default ACLs, expanded by grantee | baseline has raw text; §E4 gives the grantee-expanded form |
| 4 | Global `TRIGGER`/`REFERENCES` defaults for `service_role` | needs effective-privilege or expanded-ACL read (§E4) |
| 5 | Global table/sequence defaults blocking the migration | partially in baseline; §E4 completes it |
| 8 | Owner-run SQL preconditions | needs §E1–§E7 |
| — | `authenticated` access to Seva tables | needs catalog read or a seeded test user |
| — | Migration pre/postconditions (check 7) | runtime guards; decided at apply time |

### 5.5 Differences between the preflight and catalog results

No contradictions — the preflight is API-layer, the extension is catalog-layer, and the
preflight explicitly labels catalog items "NOT VERIFIED". Two *documentation*
inaccuracies in PR #381 (baseline `has_function_privilege` claim) and one in PR #380
(`path.slice(1)` attribution) were corrected. One *technical defect* in the extension
(reversed `pg_auth_members` aliases) was corrected. No case was found where the
preflight claims a catalog fact it cannot support.

### 5.6 Is F-A16 remediation safe to proceed?

**Not yet — additional verification is required first.** Applying the migration now
would be a blind apply: its preconditions read `pg_default_acl` and
`has_schema_privilege`, which remain unread for this project. The preconditions are
runtime guards, so a blind apply would either pass silently or abort with the reason
discovered only at apply time. The API layer is clean and the direction is sound, but
the deciding catalog facts are missing.

What is already safe to assert (unchanged from the preflight, independently
re-confirmed): the 4 public-read tables are the intended public surface; the Seva
surface is backend-only; Storage is private with no objects; `rls_auto_enable` carries
an anon-reachable EXECUTE grant; 11 tables are protected by RLS alone with a live anon
grant.

### 5.7 Exact outstanding owner actions

1. **Review and merge PR #381** (or dispatch the audit from its branch) so the
   extension file exists at the dispatched revision. PR #381 is a draft by design.
2. **Decide the age-key question.** Either supply the authorized age private key
   out-of-band to decrypt artifact `13080158531` (which can *partially* inform checks
   3–5), or proceed straight to a fresh run. The fresh run is required either way for
   checks 1, 2 and 8.
3. **Dispatch `f-a16-production-catalog-audit` with `include_extension=true`** (§4).
   Not done by this review.
4. **Configure required reviewers on the `f-a16-catalog-audit` environment** if a human
   approval gate is wanted; today there is none.
5. **Fix the invalid publishable key** in the Vercel dashboard
   (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), which is a real (currently harmless)
   configuration defect.
6. **Then** decide whether the owner-run §4 global revoke is needed and whether the
   migration will apply cleanly, using the extension output.

---

## 6. Files changed in this review

| File | Change |
|---|---|
| `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.sql` | **Fixed** reversed `pg_auth_members` aliases (§E2) + orientation comment; **corrected** the baseline `has_function_privilege` claim in the header |
| `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT_EXT.md` | **Corrected** the `has_function_privilege()` baseline-coverage row |
| `tests/db/f-a16-audit-extension-exec.test.ts` | **Fixed** the E2 assertion orientation; **added** a behavioural test pinning `roleid`=granted / `member`=member |
| `docs/audits/F-A16_PREFLIGHT_AND_CATALOG_INDEPENDENT_REVIEW_2026-11-03.md` | **New** — this report |

No change was made to PR #380's report (its findings are sound; the three wording
corrections above are recommendations, not defects that change any conclusion).

## 7. Test and CI results (this review)

| Check | Result |
|---|---|
| `npx jest tests/unit/f-a16 --silent` | 7 suites, **126 passed**, 1 skipped |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js -c jest.db.config.ts --runInBand tests/db/f-a16-audit-extension-exec.test.ts` | 1 suite, **8 passed** |
| Baseline statement count | **37**, all `SELECT`/`SHOW`/`WITH` |
| Extension statement count | **21**, all `SELECT`, all pass `classify()` |
| Baseline blob unchanged | `e38d01ea162368409e16da533908a28b1fd0ddce` on both `main` and `pr-381` |

Full unit suite, typecheck, lint and build were run separately; see the completion
report in the PR conversation for the final numbers against the pushed commit.

## 8. Production safety confirmation

- No production connection was opened by this review. The only production reads were
  read-only HTTPS GETs to the public site and read-only GitHub API calls.
- No GRANT/REVOKE, ALTER/CREATE/DROP, INSERT/UPDATE/DELETE, migration, RLS-policy,
  Supabase-config, Vercel-env, GitHub-secret or deployment change was made.
- No production workflow was dispatched.
- No secret was read, requested, printed or committed. The age private key is absent
  and was not sought.
- No Firestore dependency or fallback was introduced; no unrelated application code was
  modified.

**NOT APPLIED TO PRODUCTION.**
