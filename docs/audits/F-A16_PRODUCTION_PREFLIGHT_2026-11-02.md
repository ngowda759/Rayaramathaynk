# F-A16 — Production Preflight (read-only) — 2026-11-02

**Repository:** `ngowda759/Rayaramathaynk`
**Approved production project:** `kvrkraqjuyxbraccxntk` (region `ap-south-1`)
**Revision under assessment:** `dc4aef8` (merge of PR #379, head `14f7a94`)
**Mode:** Read-only. **No production change was made.** No DDL, DML, grant, revoke,
RLS, function, Storage, env or workflow change was issued against production.

> Evidence for human review, **not** authorization to remediate. The approved project
> ref is named once, because it is already public in other committed documents and in
> `scripts/lib/approved-project.mjs`; every credential is identified only by a SHA-256
> fingerprint prefix. No credential, connection string, row content or catalog object
> definition appears in this document.

---

## 1. What changed since the earlier preflight

An earlier version of this document reported all eight checks **BLOCKED** for lack of
credentials. Credentials were then supplied, and the API layer is now reachable. The
result is a **split verdict**:

| Layer | Reachable now? | What it can establish |
|---|---|---|
| **Production API** (PostgREST / Storage / Auth) | **Yes** | Effective row visibility per role; function reachability; bucket metadata |
| **SQL catalog** (`pg_default_acl`, `pg_roles`, `has_*_privilege`, ledger) | **No** | Grant *types* (TRUNCATE/TRIGGER/REFERENCES), default ACLs, ledger |

So findings that can be decided from observed API behaviour are now **verified**;
findings that need a catalog read remain **not verified**. Both labels are used below.

---

## 2. Credential inventory and identity

| Credential supplied | Resolves to | Usable? |
|---|---|---|
| `SUPABASE_URL` = `…kvrkraqjuyxbraccxntk.supabase.co` | approved ref (fp `233ede17c9c7`) | **yes** |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`, fp `a1d8fb1a7f07`) | approved project | **yes** — full API read |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`eyJ…`, fp `4e93bd27b6f1`) | approved project, role `anon` | **yes** |
| `SUPABASE_JWKS_URL` | approved project, 1 EC P-256 key | **yes** (HTTP 200) |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, fp `d38fe9995705`) | **neither project** | **no** — `401 Invalid API key` |

### 2.1 The publishable key is invalid — needs owner attention

`sb_publishable_…` (fp `d38fe9995705`) returns
`{"message":"Invalid API key","hint":"Double check your API key."}` against:

- the approved project (`/rest/v1/events` → 401), and
- the sandbox/tournament project (`/rest/v1/events` → 401).

The **secret** key from the same configuration is valid for the approved project, so
the configuration set is otherwise correct. The publishable key is either stale,
revoked, mistranscribed, or belongs to a third project. **This is a real configuration
defect to confirm in the Vercel dashboard** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
if present). It did not block this audit because the legacy anon JWT — which the
deployed bundle actually uses — is valid.

### 2.2 The anon key matches what production ships

The supplied `NEXT_PUBLIC_SUPABASE_ANON_KEY` is **byte-identical** (fp
`4e93bd27b6f1`) to the anon JWT the deployed Vercel bundle serves. Claims: `ref` =
approved ref, `role` = `anon`, `exp` = 2036-07-09. So the key audited here is exactly
the one real anonymous visitors use — not a stand-in.

### 2.3 Vercel configuration validated from the deployment itself

No Vercel credentials or CLI are available in this environment, so the dashboard could
not be read directly. The **deployed artefact** was used instead, which is the
strongest available evidence that the configuration is in effect:

| Check | Result |
|---|---|
| Supabase URL in the served bundle | `https://kvrkraqjuyxbraccxntk.supabase.co` — **matches the approved ref** |
| Anon key in the served bundle | valid, role `anon`, approved ref |
| Server-side key works | `GET /api/public/settings/financeSettings` → **200** with a `data` payload (a server-side Supabase read) |
| Public settings allow-list holds | `/api/public/settings/device` → 404; `/api/public/settings/unknownKeyXYZ` → 404 |
| Raya AI server path works | `GET /api/chat` → 200 |
| Public pages render | `/`, `/donation`, `/gallery`, `/calendar`, `/sevas` → 200 |

**Conclusion: the Vercel production environment is correctly wired to the approved
project.** The only exception is the invalid publishable key (§2.1), which is unused
by the current bundle.

---

## 3. Verified anon privilege matrix — all 67 public tables

Method: for each of the 67 public tables, an unauthenticated request as the
**production anon key** and the same request as the **secret key**, compared.

`401 permission denied for table X` proves the role holds **no** table privilege
(a missing grant fails before RLS is consulted). `200` proves a **grant exists**.
Comparing anon's row count against the secret key's separates *RLS hiding rows* from
*a genuinely empty table*.

### 3.0 Resolving the 67-vs-68 count (read this before citing either number)

Two counts appear in this document, and both are correct for what they measure:

| Number | What it counts | Where |
|---|---|---|
| **68** | raw entries in the PostgREST OpenAPI `paths` map that are not `/rpc/*` | §4 (no-drift re-check) |
| **67** | **actual public tables** — the number this matrix classifies | §3 |

The difference is a **counting artefact, not a table**. The OpenAPI document
includes a `"/"` entry: the specification root (`GET /rest/v1/`), which the service
exposes to `service_role` only and which is not a table at all. A naive transform of
the form `path.slice(1)` turns `"/"` into the empty string `""` and silently counts it
as a 68th table. That is exactly how the `68` figure arose during the no-drift check.

Verified directly against the live specification:

| Measure | Value |
|---|---|
| raw `paths` entries | 145 |
| non-`/rpc/` entries | 68 |
| of those, the spec root `"/"` | 1 |
| **distinct public tables** | **67** |

The `68` figure is therefore **not** a claim that a 68th table exists. The table
census in §3 — and the 21 / 11 / 31 / 4 split — is over **67** tables and is
unaffected. An earlier revision of this document used `68 schema tables` loosely in
§4; it has been corrected there to `68 non-RPC OpenAPI entries (67 tables + the
specification root)`.

This is the same class of error the repository's table-coverage check already guards
against in `scripts/verify-supabase-migrations.ts` (it filters the specification root
`"/"` out of the OpenAPI `paths` before deriving table names), which is why the
distinction is recorded here rather than silently reconciled.

| Class | Meaning | Count |
|---|---|---|
| `NO_GRANT` | anon has **no** privilege on the table | **21** |
| `GRANT_RLS_BLOCKED` | anon holds a **grant**, RLS returns zero rows | **11** |
| `GRANT_EMPTY` | anon holds a grant, table genuinely empty | **31** |
| `GRANT_VISIBLE` | anon holds a grant **and reads rows** | **4** |
| | **total** | **67** |

### 3.1 `GRANT_VISIBLE` — the intended public-read set (4)

`aaradhanes` (2 rows), `events` (74), `site_settings` (2), `social_links` (1).

**These four are exactly the set the remediation plan names as legitimate public
reads.** The observed behaviour matches the intended access model, and each is
protected by an RLS `SELECT` policy. This is the functional surface that must survive
any F-A16-01 revoke.

### 3.2 `GRANT_RLS_BLOCKED` — anon holds a grant, RLS hides everything (11)

`ai_settings`, `chat_sessions`, `daily_poojas`, `gallery_albums`, `page_views`,
`quotes`, `settings_documents`, `sevas`, `testimonials`, `unknown_questions`, `users`.

This is the class that matters most for F-A16-01. Each of these has an **anon SELECT
grant** — the grant the finding is about — yet returns zero rows because RLS denies.
The row counts visible only to the secret key show these tables are **not** empty:

| Table | Rows | | Table | Rows |
|---|---:|---|---|---:|
| `page_views` | 113 | | `settings_documents` | 7 |
| `unknown_questions` | 45 | | `quotes` | 6 |
| `daily_poojas` | 26 | | `gallery_albums` | 4 |
| `sevas` | 23 | | `testimonials` | 2 |
| `chat_sessions` | 20 | | `ai_settings`, `users` | 1 each |

**Assessment — defence in depth is working, but the grants are real and unnecessary.**
No row is exposed today. The risk is that these grants are *load-bearing on RLS
alone*: any future `DISABLE ROW LEVEL SECURITY`, `ALTER TABLE … NO FORCE`, or a
permissive policy added by mistake would expose `page_views`, `unknown_questions`,
`users` and the rest immediately, with no grant layer left to stop it. This is a
concrete, evidence-backed argument for the F-A16-01 revoke — and, equally, the reason
it must be done by *revoking grants*, not by touching policies.

`daily_poojas`, `sevas`, `gallery_albums` and `testimonials` are public-facing content.
The API shows the application reaches them **without** anon access (the pages render
and the server routes return 200 via the server-side key), so their anon grant is
unnecessary. **This should be confirmed against the code before revoking** (§9).

### 3.3 `NO_GRANT` — already least-privilege for anon (21)

`audit_log`, `cash_denominations`, `counter_devices`, `counters`, `day_close_counts`,
`day_closes`, `devotee_profiles`, `festival_day_dates`, `festival_days`,
`group_counters`, `ops_backup_runs`, `receipt_number_gaps`, `receipt_series`,
`receipt_series_years`, `seva_list_items`, `seva_orders`, `seva_rate_history`,
`seva_receipt_lines`, `seva_receipts`, `seva_settings`, `staff`.

**The entire Seva operational surface is already closed to anon**, including
`seva_list_items`. This is a strong positive result.

### 3.4 `GRANT_EMPTY` (31)

`ai_chat_feedback`, `ai_intent_distribution`, `ai_knowledge`, `ai_latency_records`,
`ai_testimonials`, `ai_volunteer_requests`, `announcements`, `bills`, `chat_messages`,
`chat_metrics`, `chat_training`, `daily_page_stats`, `donation_campaigns`, `donations`,
`featured_content`, `gallery_media`, `intent_feedback`, `intent_metrics`,
`knowledge_audit_log`, `knowledge_committee_approvals`, `knowledge_drafts`,
`knowledge_review_comments`, `knowledge_versions`, `knowledge_workflow`,
`knowledge_workflow_actions`, `members`, `profiles`, `seva_bookings`, `temple_areas`,
`volunteer_requests`, `volunteers`.

These carry an anon grant but hold no rows **at this moment**. They are the same
latent risk as §3.2: the grant is present, only emptiness prevents exposure. Several
(`donations`, `profiles`, `members`, `bills`, `seva_bookings`) would be sensitive the
moment data arrives.

---

## 4. F-A16-03 — anon EXECUTE on `rls_auto_enable` (verified)

**Confirmed reachable by `anon`.**

Method, using controls to avoid a false positive:

| Function | anon | Meaning |
|---|---|---|
| `rls_auto_enable` | **400** `cannot display a value of type event_trigger` | **passed the EXECUTE check**; failed later on argument serialization |
| `seva_next_staff_no` | **401** `permission denied for function …` | the signature of *missing* EXECUTE |
| `seva_purge_devotee_profiles` | **401** `permission denied for function …` | same |
| `seva_admin_check_keys` | 404 (needs args) | not reachable without parameters |

`rls_auto_enable` is the **only** probed function that returns 400 for anon rather
than 401, i.e. the only one where anon's EXECUTE grant let the call through. This
corroborates the plan's F-A16-03 premise that the helper carries a broad `EXECUTE`
grant — **from the API, independently of the catalog**.

**No side effect occurred.** `rls_auto_enable` is an event-trigger function whose
first argument is an `event_trigger`; a REST call cannot supply one, so the call
aborted at serialization before any `ALTER TABLE … ENABLE ROW LEVEL SECURITY` ran.
A no-drift re-check afterwards confirmed 68 non-RPC OpenAPI entries (67 public tables + the
specification root, see §3.0) and `events` = 74, unchanged.

**Not established:** whether `authenticated` and `PUBLIC` also hold EXECUTE (needs the
catalog). The migration's function-grant revoke should still target all three.

---

## 5. F-A16-04 — `seva_list_items` (verified)

**Class `NO_GRANT`.** RLS is enabled with zero policies *and* anon holds no table
privilege at all. Anonymous access is blocked twice over, and the entire Seva
operational surface (§3.3) is likewise closed.

**Assessment: backend-only is confirmed by observation.** No direct anon client access
exists. The correct disposition is to **document this as intentional** and add a
regression test asserting the denial — **not** to add a policy. This matches the task
instruction not to create a permissive policy merely to make a table accessible.

*Caveat:* `authenticated` was not separately tested (no test user). Staff access via
`authenticated` remains unverified and needs a catalog read.

---

## 6. F-A16-05 — Storage (verified, consistent with the audit)

| Item | Observed |
|---|---|
| Buckets | **1** — `RayaramathaYNK` |
| Bucket public flag | **`false`** (private) |
| Objects | **0** (listing returned an empty set) |

This reproduces the audit's "one private bucket, zero Storage policies, zero Storage
objects". **The bucket is not public** and there is nothing to expose. No policy is
proposed: there is no evidenced application requirement for one, and creating a policy
for an empty bucket would only widen the surface.

**Open question for the owner:** `gallery_albums` (4 rows) and `gallery_media` exist in
Postgres while the Storage bucket is empty. Gallery content appears to be served from
table rows rather than Storage objects. If media upload is intended, the bucket is
unused; if it is legacy, the bucket could be removed. Either way **no Storage policy
should be added** on current evidence.

---

## 7. Check status

| # | Check | Status | Basis |
|---|---|---|---|
| 1 | Roles that can create in `public`, incl. inherited | **NOT VERIFIED** | needs catalog |
| 2 | Execution-role membership per creator | **NOT VERIFIED** | needs catalog |
| 3 | Global + schema default ACLs | **NOT VERIFIED** | needs catalog |
| 4 | Global `TRIGGER`/`REFERENCES` defaults for `service_role` | **NOT VERIFIED** | needs catalog |
| 5 | Global table/sequence defaults blocking the migration | **NOT VERIFIED** | needs catalog |
| 6 | anon/authenticated `SELECT` on the 4 public-read tables | **VERIFIED (anon)** | §3.1 |
| 7 | Migration pre/postconditions | **PARTIAL** | §8 |
| 8 | Owner-run SQL preconditions | **NOT VERIFIED** | needs catalog |
| — | **Anon grant matrix over all 67 tables** | **VERIFIED** | §3 |
| — | **Anon EXECUTE on `rls_auto_enable`** | **VERIFIED** | §4 |
| — | **`seva_list_items` backend-only** | **VERIFIED (anon)** | §5 |
| — | **Storage: 1 private bucket, 0 objects** | **VERIFIED** | §6 |
| — | Project identity + Vercel wiring | **VERIFIED** | §2 |

### Why checks 1–5 and 8 still cannot be closed

PostgREST exposes only `public` and `graphql_public`; `Accept-Profile: pg_catalog`
returns `PGRST106` ("Only the following schemas are exposed: public, graphql_public").
There is no `pg-meta`/`pg/query` endpoint on this host, and no `SUPABASE_ACCESS_TOKEN`
for the Management API. **The SQL catalog is therefore unreachable with these keys.**
The supplied keys close the *API* layer, not the *catalog* layer.

This matters because the migration's preconditions (§0b global defaults, §0c effective
CREATE) read `pg_default_acl` and `has_schema_privilege` — exactly the surface that
remains unreadable.

---

## 8. Migration precondition assessment (partial)

The preconditions in `supabase/migrations/20261115000000_f_a16_least_privilege_defaults.sql`
are **runtime guards**: they re-evaluate at apply time and abort the transaction if
unsatisfied. An unsatisfied precondition therefore cannot leave defaults broad — the
migration simply fails and rolls back. The preflight's value is predicting *which*
outcome, not preventing harm.

| Precondition | Status |
|---|---|
| §0 / §0b — no global default grants to `PUBLIC`/`anon`/`authenticated`; no global table default of `TRIGGER`/`REFERENCES` to `service_role` | **NOT VERIFIED** — needs `pg_default_acl` |
| §0c — no public-facing role can create in `public` | **NOT VERIFIED** — needs `has_schema_privilege` |
| §4 — every other creator role enumerated and covered | **NOT VERIFIED** — needs `pg_roles` + membership |
| §5 — post-condition | **NOT VERIFIED** |
| Functional safety: the 4 public-read tables keep their anon `SELECT` | **VERIFIED for anon** (§3.1) — the grant and rows are present *today*; the revoke must preserve them |

**Net:** whether the migration applies cleanly, or aborts and requires the owner-run
§4 step first, is still unknown. That is the single largest remaining unknown.

---

## 9. Application dependencies requiring manual validation

| # | Dependency | Why it needs a human |
|---|---|---|
| 1 | `daily_poojas`, `sevas`, `gallery_albums`, `testimonials` | public-facing content; anon holds a grant but RLS hides rows. Confirm the app reaches them via the **server-side** key only, then their anon grant is safe to revoke. If any page reads them with the **anon** key, revoking breaks it. |
| 2 | `announcements` | named in the plan as a Raya AI retrieval source; anon-granted and empty. Confirm the retrieval path uses the server key. |
| 3 | `settings_documents` (7 rows) | served through `/api/public/settings/*` (verified 200). Confirm the route uses the server key, not anon. |
| 4 | `page_views` (113 rows) | analytics. Confirm nothing public writes to it with an anon key before revoking INSERT. |
| 5 | `users` (1 row) | anon holds a grant. Any revoke is unambiguously correct, but confirm no public path reads it. |
| 6 | `authenticated`-role access to `seva_list_items` and the Seva surface | not testable without a test user; needs a catalog read or a seeded test account. |
| 7 | Gallery media path | bucket is empty while `gallery_albums` has rows — confirm whether Storage is intended at all. |

---

## 10. Recommendation

**Do not apply the migration or the owner-run SQL yet.** The API layer is now clean and
well-evidenced, but the **catalog layer that decides whether the migration applies is
still unreadable**. Applying now would be a blind apply whose preconditions would
either pass silently or abort — and the abort reason would be discovered only at apply
time.

Concretely, in order:

1. **Fix the invalid publishable key** (§2.1) — a genuine configuration defect, though
   unused by the current bundle.
2. **Extend the read-only audit query set** to cover what the API cannot: effective
   `CREATE` (`has_schema_privilege`), membership (`pg_auth_members` / `pg_has_role`),
   effective `SELECT` (`has_table_privilege`), and grant *types* (TRUNCATE / TRIGGER /
   REFERENCES, which row visibility cannot reveal). The SQL is already drafted in the
   plan's §9 items 7 / 7d / 7e.
3. **Consider the existing audit artifact, but do not rely on it to close the gap** —
   run `41299082937` already completed 37/37 baseline statements on 2026-11-01
   (artifact `f-a16-catalog-audit-41299082937`, unexpired to 2026-12-01, encrypted with
   age). It contains the **baseline only**: it reads `pg_default_acl` as raw ACL text
   (§5), so it can *partially* inform checks 3, 4 and 5, but it has no
   `has_schema_privilege` (checks 1/2) and no grantee-expanded ACL (the extension's
   §E4). It **cannot** answer checks 1, 2 or 8. Decrypting it needs the authorized age
   private key, which is not available in the audit environment; the fresh run below
   is required regardless.
4. **Then** decide whether the owner-run §4 global revoke is needed and whether the
   migration will apply.

### What is safe to assert now

- The **four public-read tables are exactly right** and must be preserved (§3.1).
- **`seva_list_items` and the whole Seva surface are correctly backend-only** (§3.3, §5).
- **Storage is correctly private with no objects** (§6).
- **`rls_auto_enable` does carry an anon-reachable EXECUTE grant** (§4) — F-A16-03 is
  real, independently of the catalog.
- **11 tables are protected by RLS alone, with a live anon grant** (§3.2) — the
  strongest evidence yet for the F-A16-01 revoke, and the reason it should be a
  *grant* change rather than a *policy* change.
- **Production and Vercel are correctly wired to the approved project** (§2.3).

---

## 11. Provenance

| Item | Value |
|---|---|
| Approved ref fp | `233ede17c9c7` |
| Anon key fp (matches deployed bundle) | `4e93bd27b6f1` |
| Secret key fp | `a1d8fb1a7f07` |
| Invalid publishable key fp | `d38fe9995705` |
| Public tables classified | 67 |
| Prior audit run | `41299082937` (2026-11-01), 37/37 statements, encrypted artifact sha256 `21213cf0…3c247f` |
| Exposed PostgREST schemas | `public`, `graphql_public` |
| Region | `ap-south-1` (pooler reachable; direct host IPv6-only) |

Fingerprints are SHA-256 prefixes — sufficient for equality comparison, not reversible.
**Findings are evidence, not authorization to remediate.**
