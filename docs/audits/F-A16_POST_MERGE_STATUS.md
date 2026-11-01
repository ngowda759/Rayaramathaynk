# F-A16 — Post-Merge Status and Production Catalog Audit Readiness

**Project:** Sri Raghavendra Swamy Matha (Rayaramathaynk)
**Approved production Supabase project:** `kvrkraqjuyxbraccxntk`
**Date (UTC):** 2026-10-31
**Mode:** Audit and documentation only. **No production change was made.** No migration, schema,
grant/revoke, RLS/policy, function, Storage, environment, deployment, workflow, or Firestore change.

**Scope:** verify that PR #371 merged into `main`, re-confirm the F-A16 documentation, state the
outstanding catalog-verification requirements, and prepare the read-only catalog audit for owner
execution.

**Companion files:**
* `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md` (detailed F-A16 report)
* `docs/audits/F-A16_PRODUCTION_EVIDENCE_SUMMARY.md` (evidence matrix)
* `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` (new; the catalog read, for owner execution)
* `docs/audits/F-A15.1_READ_ONLY_QUERIES.sql` (baseline query set)

---

## 1. PR #371 merge verification

Retrieved from the GitHub REST API on 2026-10-31.

| Check | Result |
|---|---|
| PR number / title | #371 — `docs(security): F-A16 live production Supabase verification` |
| State | **closed** ✅ |
| `merged` | **true** ✅ |
| Merge commit SHA | **`9d0d89ac92f54a863c4dd0f76cbd2abce919af09`** |
| Merged at (UTC) | 2026-10-31T14:40:01Z |
| Merged by | `ngowda759` |
| Target (base) branch | **`main`** ✅ |
| Head branch / SHA | `audit/f-a16-live-production-verification` @ `b582677643cd3b67405fc906198869b665252c9b` ✅ |
| Files changed | 2 (docs-only) · +581 / −0 |
| Commits in PR | 4 (rev 1–4) |

**Merge commit present in `main` history:** ✅ — `git log origin/main` contains
`9d0d89a Merge pull request #371 …`; the merge commit is an ancestor of the current `main` tip
`5256be8`. The three commits on `main` *after* the merge are automated
`chore: update daily panchanga` commits and do not touch the F-A16 docs.

---

## 2. Documentation verification

| File on `main` | Blob SHA | Merged-head blob | Verdict |
|---|---|---|---|
| `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md` | `f0e5d2c7f11f…` | `f0e5d2c7f11f…` | **Identical** ✅ |
| `docs/audits/F-A16_PRODUCTION_EVIDENCE_SUMMARY.md` | `25de60575923…` | `25de60575923…` | **Identical** ✅ |

The versions on `main` are byte-for-byte the rev-4 versions that were merged; no post-merge edit
occurred.

### 2.1 API-versus-catalog distinction — still correct

Verified on the merged text:

* §1.1 defines the three evidence layers (Catalog / API / Source) and the rule that an API
  observation is never reported as a catalog fact.
* The only "Confirmed in production" label is **F-A15.1-6**, which is *deployed endpoint behaviour*
  (a deployment fact), not a catalog fact.
* F-A15.1-3, -5, -8 are **Unverified (catalog)**, with API observations stated separately as
  *consistent with*.
* The rev-4 wording fix is present: the comparison row now reads "…it does not establish whether
  zero rows result from RLS filtering or empty tables", and the layer is named the "effective API
  access layer" (no "RLS-effective" / "RLS applied" phrasing outside the revision-history entry,
  which quotes the change).
* No residual `TODO`/`FIXME`/placeholder text.

### 2.2 Outstanding documentation corrections

**None.** The F-A16 reports are complete and internally consistent. The only open documentation
work is the *next phase* (the catalog audit below), not a correction to what was merged.

---

## 3. Final finding-status matrix

Classification vocabulary used in this task:

* **Verified from PostgreSQL catalog** — read from `pg_class` / `pg_policies` / `pg_proc` /
  `information_schema` / `pg_default_acl` / the migration ledger on the production project.
* **Observed through production API** — read from the live production PostgREST/HTTP surface.
* **Reviewed from repository source/migrations** — read from `supabase/migrations/` and app code.
* **Unverified / blocked** — none of the above obtained.

| Audit item | Status today | Evidence obtained | What would move it to "Verified from catalog" |
|---|---|---|---|
| **RLS enabled/disabled flags** | **Unverified / blocked** (catalog). *Reviewed from source*: migrations enable RLS per table. *Observed via API*: row-return behaviour is consistent with RLS, but a 0-row response does **not** prove RLS is on. | F-A16 §4A (API); repo migrations | §1 of `F-A16_READ_ONLY_CATALOG_AUDIT.sql` (`pg_class.relrowsecurity`) |
| **RLS policy definitions & counts** | **Unverified / blocked** (catalog). *Reviewed from source*: policy text exists in migrations (incl. two "prepared, NOT applied" files). | F-A16 §4A (API); repo migrations | §3 (`pg_policies` full text + counts) |
| **Table grants / privilege matrix** | **Unverified / blocked** (catalog). *Observed via API*: `anon` denied on 21/67 tables — consistent with, but not proof of, the grant matrix. | F-A16 §4A (API) | §2 (`information_schema.role_table_grants` + per-role totals) |
| **Function EXECUTE privileges** | **Unverified / blocked** (catalog). | — | §4 (`pg_proc` + `has_function_privilege`) |
| **FORCE ROW LEVEL SECURITY** | **Unverified / blocked** (catalog). | — | §1 (`pg_class.relforcerowsecurity`) |
| **Default privileges / ACLs** | **Unverified / blocked** (catalog). | — | §5 (`pg_default_acl`) |
| **Applied migration history** | **Unverified / blocked** (catalog). *Observed via API*: `events`/`aaradhanes` readable — consistent with the two public-select policies being applied. | F-A16 §4A (API); repo migrations | §7 (`supabase_migrations.schema_migrations`) |
| **Storage bucket & object policies** | **Unverified / blocked** (catalog). *Observed via API*: `anon` bucket list is empty — **inconclusive**, an anon key sees only permitted buckets. | F-A16 §4A (API) | §6 (`storage.buckets`, `pg_policies`, object COUNT) |
| **Extensions (incl. `pg_graphql`)** | **Unverified / blocked** (catalog). | — | §8 (`pg_extension`) |
| **F-A15.1-6 — public settings endpoint** | **Observed through production API / deployment** (the one item genuinely confirmed). | PR #370 deployment containment + live GET checks | n/a — already confirmed at the deployment layer |
| **`seva_list_items` RLS/policy state (F-A15.1-5)** | **Unverified / blocked** (catalog). *Observed via API*: `anon` gets `401` — does not establish the catalog configuration. | F-A16 §4A (API) | §1 + §3 |
| **`rls_auto_enable()` / `update_updated_at_column()` (F-A15.1-1/-2)** | **Unverified / blocked** (catalog). | — | §4 + §9 |

**Explicit guards honoured in this matrix:**

* A zero-row API response does **not** prove RLS is enabled or deny-all.
* A `401` response does **not** independently establish the underlying catalog configuration.
* No policy, grant, or privilege is claimed to exist unless verified from the production catalog.

---

## 4. Outstanding catalog verification requirements

All catalog items above are blocked on a single prerequisite: **a verified read-only PostgreSQL
session to `kvrkraqjuyxbraccxntk`.** Until that exists, none of the catalog findings can be stated as
verified, and the audit must not be declared complete.

To finish the catalog audit, the following must be read on the production project:

1. `pg_class` / `pg_namespace` and `pg_tables` — tables, RLS, FORCE RLS, owners.
2. `information_schema.role_table_grants` and `information_schema.table_privileges` — the full privilege matrix.
3. `pg_policies` — policy text, counts, permissive/restrictive split.
4. `pg_proc` + `has_function_privilege` — function inventory, SECURITY DEFINER, EXECUTE grants.
5. `pg_default_acl` — default privileges.
6. `storage.buckets` + `pg_policies` (schema `storage`) + object **count**.
7. `supabase_migrations.schema_migrations` — applied ledger.
8. `pg_extension` — installed extensions (esp. `pg_graphql`).

All eight are covered by `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` (§1–§11).

---

## 5. Production access blocker (still present)

**The production catalog could not be read from this environment.** The blocker is unchanged from
F-A16 and re-confirmed here:

| Requirement | State | Detail |
|---|---|---|
| Sandbox DB credential targets the approved project | **NO** | `SUPABASE_DB_URL`, `SUPABASE_DB_URL_TX` and `SUPABASE_PROJECT_REF` all resolve to the **non-approved** project (fingerprint `72b54d98a3dc` vs approved `233ede17c9c7`). Mandatory abort condition — **not used**, no substitute database used. |
| Production direct host reachable | **NO** | `db.kvrkraqjuyxbraccxntk.supabase.co` resolves **IPv6-only** (`AAAA 2406:da1a:314:7102:e04d:8a16:a597:137b`; no `A` record — verified via DoH). |
| Sandbox has IPv6 egress | **NO** | No `inet6` address on any interface; an IPv6 literal connect fails with `OSError [Errno 99] Cannot assign requested address`; `getaddrinfo` on the production host returns "No address associated with hostname". |
| Production DB password | **NOT PROVIDED** | No credential was supplied; none was requested or printed. |
| Read-only session established to production | **NO** | Not possible without the above. |
| PostgreSQL client available | **NO** | No `psql`; no `psycopg2`/`psycopg` installed. (Installable, but moot without connectivity + credential.) |

**Conclusion:** a production catalog session **cannot be established from this sandbox**, and per
the mandatory abort condition the audit stopped rather than substitute another database. This is an
**environment/access limitation, not a finding about the temple project**.

> Note (non-secret): the sandbox's own `SUPABASE_POOLER_HOST` resolves to an IPv4 address, so a
> **pooler** endpoint is reachable in principle from this environment. What is missing for
> production is (a) a pooler connection string **for `kvrkraqjuyxbraccxntk`** and (b) the database
> password. Those are owner-held secrets and must not be pasted into chat.

---

## 6. Exact next steps for completing the catalog audit

For the **project owner** (no credentials should be sent through chat):

1. **Open the approved project** `kvrkraqjuyxbraccxntk` in the Supabase dashboard → **SQL Editor**
   (this runs as the `postgres` owner role, which can read the whole catalog).
2. **Paste `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql`, one section at a time (§0 first).**
   Every statement is a `SELECT`/`SHOW`; the file changes nothing.
3. **Capture the results** (copy each section's output to a file, or export) and attach them to this
   audit — do **not** paste raw secrets or row contents; the queries return metadata only.
4. **Alternative (read-only session):** create/use a read-only connection and run
   `SET default_transaction_read_only = on;` then the file via `psql -f`. Prefer the **pooler
   (IPv4)** host; `db.<ref>.supabase.co` is IPv6-only.
5. If a section errors (e.g. `storage.*` or `supabase_migrations.*` absent/restricted), record the
   **section number and exact error** and continue — do not escalate privileges.

For the **audit** (next session, once results exist):

6. Reconcile the catalog output against the F-A15.1 reproduction numbers (67 tables / 0 FORCE RLS /
   81 policies / 1,088 privilege records / 87 functions / 1 SECURITY DEFINER / 6 default ACLs /
   1 bucket / 0 storage policies / 15 migrations) and against the F-A16 API observations.
7. Promote each matrix row from **Unverified** to **Verified from PostgreSQL catalog**, and record
   any **different** results as production facts (not as drift assumptions).
8. Only then decide whether any finding needs an owner decision. **Remediation proposals P1–P6 must
   not be started** as part of the audit.

---

## 7. Confirmation that no production changes were made

**No production change of any kind was made in this task.** Specifically, there was:

* no INSERT / UPDATE / DELETE / UPSERT / TRUNCATE;
* no CREATE / ALTER / DROP / COMMENT;
* no GRANT / REVOKE;
* no migration applied, repaired, or marked;
* no RLS, policy, privilege, function, trigger, or Storage change;
* no RPC or function invocation (none of the audit SQL invokes a function);
* no GraphQL query;
* no Supabase dashboard change;
* no environment-variable change;
* no deployment and no workflow dispatch;
* no Firestore access or fallback;
* no remediation proposal (P1–P6) started.

The only actions taken were: read-only GitHub REST GETs, read-only local repository reads
(`git`, `grep`, file views), a non-secret DNS lookup (DoH), and read-only static validation of the
SQL files. No database connection to production was opened (it could not be). No credentials were
printed, requested, or committed. Project refs are shown only as non-reversible SHA-256 prefixes.

---

## 8. Readiness summary

| Question | Answer |
|---|---|
| Is the SQL audit ready for owner execution? | **Yes** — `docs/audits/F-A16_READ_ONLY_CATALOG_AUDIT.sql` is complete, SELECT-only (37 statements, validated), and covers all outstanding catalog items. |
| Is the production catalog audit complete? | **No** — 0% of the catalog items are verified; 100% blocked on production read access. |
| What is verified? | The **API/deployment** layer only (F-A16): identity validated live, anon-visibility census, PR #370 endpoint behaviour. |
| What remains unverified? | All catalog items in §3 — RLS flags, policies, grants, EXECUTE, FORCE RLS, default ACLs, ledger, Storage, extensions. |
| Access blocker? | **Yes** — no production read-only session (non-approved sandbox credential + IPv6-only host + no password). See §5. |
