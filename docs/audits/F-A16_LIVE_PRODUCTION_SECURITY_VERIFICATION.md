# F-A16 — Live Production Supabase Security Verification (Strict Read-Only)

**Project:** Sri Raghavendra Swamy Matha (Rayaramathaynk)
**Approved production Supabase project:** `kvrkraqjuyxbraccxntk` (`https://kvrkraqjuyxbraccxntk.supabase.co`)
**Base branch:** `main` @ `0691388` (merge of PR #369)
**Previous audit:** `docs/audits/F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md`
**Baseline query set:** `docs/audits/F-A15.1_READ_ONLY_QUERIES.sql`
**Date (UTC):** 2026-10-31
**Mode:** Verification only. **No production change, migration, policy/privilege change, deployment, or workflow dispatch was performed.**

---

## 1. Executive summary

F-A16 set out to connect to the live production temple database (`kvrkraqjuyxbraccxntk`) and
re-measure the F-A15.1 catalog findings against the real production catalog.

The audit proceeded in two layers, because only one of them is reachable from this environment:

* **Catalog layer (SQL over PostgreSQL): still unreachable.** The only database credential in the
  sandbox (`SUPABASE_DB_URL` / `SUPABASE_DB_URL_TX` / `SUPABASE_PROJECT_REF`) resolves to a
  **different, non-approved project** — the unrelated "Tournament" project (`teams`, `matches`,
  `players`, …). Per the mandatory abort condition, the F-A15.1 catalog query set was **not** run
  against it and **no substitute database was used**. The owner then supplied the production
  identity — `NEXT_PUBLIC_SUPABASE_URL`, a publishable key, and the direct DB host
  `db.kvrkraqjuyxbraccxntk.supabase.co:5432` (user `postgres`, database `postgres`). The direct DB
  host is **IPv6-only**, and this sandbox has **no IPv6 egress**; no DB **password** was supplied in
  any case. **Catalog SQL therefore remains impossible from here.** All catalog categories
  (privilege records, policy counts, functions, FORCE RLS, default ACLs, migration ledger,
  extensions) are **Unavailable**.
* **API / RLS-effective layer: reached and verified read-only.** The owner-supplied publishable key
  authenticates against the production PostgREST API, so the audit **validated the production
  identity live** and measured the **effective (RLS-applied) anon view** of every table with
  GET-only requests. This is real production evidence, just one layer above the raw catalog.

**What the live API layer established (production, read-only, GET-only):**

* **Identity is now proven.** The supplied URL ref equals the approved ref
  `kvrkraqjuyxbraccxntk`; production `GET /auth/v1/health` returns **200** (`GoTrue v2.197.0`); and
  anon reads return live production rows.
* **All 67 repository tables are exposed through PostgREST** (none returned "not in schema cache"),
  consistent with the F-A15.1 "67 public tables" figure — but this is a reachability proxy, not a
  catalog count.
* **Only 4 of 67 tables expose non-zero rows to `anon`:** `events` (74), `aaradhanes` (2),
  `site_settings` (2), `social_links` (1).
* **21 of 67 tables return `401 permission denied`** to `anon` — i.e. `anon` holds **no table
  grant at all** on those tables, which is *stronger* than F-A15.1-3's "full grants on every table"
  description. This is a **difference from F-A15.1**, and it confirms the `seva_*`/POS privilege
  hardening is applied in production.
* **No anon-visible PII/financial leakage observed:** `users`, `profiles`, `donations`,
  `seva_bookings`, `settings_documents` all return **0 rows** to `anon`.
* **The two "prepared, NOT applied" policy migrations are in fact applied in production**
  (F-A15.1 drift item D2): `events` and `aaradhanes` serve rows to `anon`.

The separate PR #370 website checks (§7) also passed, and the production deployment of
`641a0d318f58c6640ff20081b9a8c5712c8e6af8` was confirmed. The F-A15.1-6 fix is **Confirmed in
production**.

| Result | Status |
|---|---|
| Production temple DB (catalog SQL) reached | **No** — IPv6-only host unreachable, no DB password |
| Production project identity proven | **Yes** — URL ref, live auth health, live anon data |
| Read-only session proven | **Yes** at the API layer (GET-only); N/A at catalog layer |
| Read-only session proven on the only reachable DB | Yes (`transaction_read_only=on`) — but that DB is not production |
| PR #370 production deployment confirmed | **Yes** — Production deployment of `641a0d3` |
| PR #370 endpoint checks | **Executed and passed** |
| Catalog counts (privileges/policies/functions/ACL/ledger) | **Unavailable** |
| Effective anon visibility per table | **Verified live** |

---

## 2. Production identity validation — outcome

### 2.1 Layer 1 — the sandbox DB credential (non-production)

The sandbox exposes only `SUPABASE_DB_URL`, `SUPABASE_DB_URL_TX`, `SUPABASE_PROJECT_REF`,
`SUPABASE_POOLER_HOST`. The project ref carried by each was resolved with the repository's own
fail-closed helper `scripts/lib/approved-project.mjs`:

| Value | SHA-256 prefix (12 hex) | Equals approved ref? |
|---|---|---|
| Approved ref `kvrkraqjuyxbraccxntk` | `233ede17c9c7` | — |
| Ref resolved from `SUPABASE_DB_URL` | `72b54d98a3dc` | **No** |
| Ref resolved from `SUPABASE_DB_URL_TX` | `72b54d98a3dc` | **No** |
| Ref in `SUPABASE_PROJECT_REF` | `72b54d98a3dc` | **No** |

A read-only identity probe of that database returned 14 public tables (`teams`, `matches`,
`players`, `tournaments`, …) — the unrelated **Tournament** project. The mandatory abort condition
was met, so the F-A15.1 catalog queries were **not** executed against it. No substitute was used.

### 2.2 Layer 2 — the owner-supplied production identity (validated)

The owner supplied, in-session and for validation only (values **not** recorded in this repository):

* `NEXT_PUBLIC_SUPABASE_URL` → `https://kvrkraqjuyxbraccxntk.supabase.co` (ref label
  `kvrkraqjuyxbraccxntk` — **equals the approved ref**);
* a publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`);
* direct DB target: host `db.kvrkraqjuyxbraccxntk.supabase.co`, port `5432`, database `postgres`,
  user `postgres` (**no password**).

Validation performed (read-only):

| Check | Result |
|---|---|
| URL ref equals `APPROVED_PROJECT_REF` | **Yes** |
| DB host equals `db.kvrkraqjuyxbraccxntk.supabase.co` | **Yes** |
| `GET /auth/v1/health` (publishable key) | **200** — `{"version":"v2.197.0","name":"GoTrue"}` |
| Anon table reads return live production rows | **Yes** (e.g. `events` = 74 rows) |
| Direct DB host reachable from sandbox | **No** — resolves IPv6-only (`2406:da1a:…`); sandbox has no IPv6 egress; no DB password provided |

**Conclusion:** production identity is **validated**; the API/RLS-effective layer is reachable and
was audited read-only. The **catalog SQL layer is not reachable** from this environment.

### 2.3 Production host liveness (non-secret, informational)

`kvrkraqjuyxbraccxntk.supabase.co` resolves (Cloudflare edge) and answers an unauthenticated
`GET /rest/v1/` with **401**. The public API is reachable; that alone is not proof of identity, so
it was corroborated by the ref comparison and the live auth-health call above.

---

## 3. Read-only connection/safety evidence

* **Catalog layer (non-production DB):** read-only enforced before the session
  (`options="-c default_transaction_read_only=on"`, `set_session(readonly=True, autocommit=True)`);
  `SHOW transaction_read_only` → `on`; `default_transaction_read_only` → `on`. Catalog `SELECT`s
  only; no function/RPC invoked.
* **Production catalog layer:** no session could be opened (IPv6-only host, no password), so
  read-only mode could not be established there; per the task ("If the connection cannot enforce
  read-only mode, stop"), the catalog audit stopped.
* **Production API layer:** every request was **`GET` only**, with `limit=0` and
  `Prefer: count=exact`, reading only `Content-Range`/status. **No `POST`/`PATCH`/`PUT`/`DELETE`
  was ever sent; no RPC, no GraphQL, no function invocation, no write of any kind.** No row
  *contents* of sensitive tables were retrieved (all returned 0 rows; only aggregate counts were
  read).

---

## 4. Query coverage and timestamps

| Timestamp (UTC) | Step |
|---|---|
| 2026-10-31T12:44Z | Sandbox identity inspection + abort decision (non-production credential) |
| 2026-10-31T12:4xZ | GitHub API: PR #370 merge SHA + Production deployment lineage |
| 2026-10-31T12:4xZ | PR #370 GET-only website endpoint checks (pass) |
| 2026-10-31T12:5xZ | Owner-supplied identity validated (URL ref, auth health, DB host DNS/TCP) |
| 2026-10-31T12:5xZ | Live GET-only anon-visibility probe of all 67 repository tables |

**Catalog categories (§4 of the task) — all Unavailable** (no catalog session): A tables/RLS, B
privileges, C policies, D functions, E default privileges, F Storage, G migration ledger,
H extensions. The `F-A15.1_READ_ONLY_QUERIES.sql` statements were each reviewed as read-only, but
none could be executed against production.

**API-layer evidence replaces the catalog read for *effective* behaviour** (not for object counts) —
see §4A.

---

## 4A. Live production results — effective anon visibility (API layer)

Method: `GET /rest/v1/<table>?select=*&limit=0` with the publishable key and `Prefer: count=exact`;
only the HTTP status and `Content-Range` count were read. All 67 repository public tables were
probed. Classification:

| Class | Meaning | Count |
|---|---|---:|
| `401 permission denied` | `anon` has **no table privilege** (hardened) | **21** |
| `200/206 … /0` | `anon` has SELECT but **RLS returns no rows** (or table empty) | **42** |
| `200/206 … /N` | `anon` **reads N rows** | **4** |
| Total | | **67** |

**Tables `anon` cannot touch at all (401) — 21:** `audit_log`, `cash_denominations`,
`counter_devices`, `counters`, `day_close_counts`, `day_closes`, `devotee_profiles`,
`festival_day_dates`, `festival_days`, `group_counters`, `ops_backup_runs`, `receipt_number_gaps`,
`receipt_series`, `receipt_series_years`, `seva_list_items`, `seva_orders`, `seva_rate_history`,
`seva_receipt_lines`, `seva_receipts`, `seva_settings`, `staff`.

**Tables `anon` can read rows from (4):**

| Table | Anon-visible rows |
|---|---:|
| `events` | 74 |
| `aaradhanes` | 2 |
| `site_settings` | 2 |
| `social_links` | 1 |

**Sensitive tables confirmed NOT readable by `anon` (0 rows):** `users`, `profiles`, `donations`,
`seva_bookings`, `settings_documents`, `bills`, `members`, `devotee_profiles` (401), `staff` (401),
`seva_orders` (401), `seva_receipts` (401). **No anon-visible PII or financial rows were observed.**

**Storage:** `GET /storage/v1/bucket` with the publishable key returned `[]` (0 buckets). With an
anon key Supabase only lists buckets the role may see, so this is **inconclusive** for the existence
of the private `RayaramathaYNK` bucket (see §6.7).

**Not obtainable at this layer:** policy counts, per-role privilege matrices (INSERT/UPDATE/DELETE/
TRUNCATE/REFERENCES/TRIGGER), function inventory and EXECUTE grants, FORCE RLS flags, default ACLs,
the migration ledger, and installed extensions. Those require the catalog (§4).

---

## 5. Comparison with F-A15.1

| Area | F-A15.1 reproduced | F-A16 live | Status |
|---|---:|---|---|
| Public tables | 67 | 67 reachable via PostgREST (none 404) | **Consistent (API layer)**; exact catalog count Unavailable |
| RLS enabled | 67 | RLS demonstrably active (42 tables return 0, not all rows) | **Consistent in effect**; catalog flag Unavailable |
| FORCE RLS | 0 | — | Unavailable |
| Public policies | 81 | — | Unavailable |
| Table privilege records | 1,088 | 21 tables have **no anon grant**; 46 have anon SELECT | **Different from F-A15.1** (see F-A15.1-3); exact matrix Unavailable |
| Public functions | 87 | — | Unavailable |
| SECURITY DEFINER functions | 1 | — | Unavailable |
| Default ACL entries | 6 | — | Unavailable |
| Storage buckets | 1 | anon bucket list = 0 (inconclusive) | Unavailable |
| Storage policies | 0 | — | Unavailable |
| Applied migrations | 15 (Oct 2026) | — (ledger unread) | Unavailable; drift **partly confirmed** via F-A15.1-8 |

**Difference classification:**

* **"21 tables without an anon grant" — real production state** (directly observed), which means
  F-A15.1-3's "anon holds full grants on **every** table" is **not accurate for anon**. It is
  evidence that the repository's `REVOKE`/privilege-hardening migrations *are* applied in production
  (a **real production change** relative to the naive Supabase default), and a **repository-drift
  correction** to F-A15.1.
* **`events`/`aaradhanes` readable by anon — repository migration drift confirmed**: those policies
  are marked "prepared, NOT applied" in the repo but **are applied in production** (F-A15.1 drift
  item D2).
* All numeric catalog counts remain **inconclusive** (scope/permission limitation: no catalog read).

---

## 6. Reassessment of F-A15.1 findings using live evidence

| ID | Finding | F-A15.1 severity | F-A16 evidence status | Severity change? |
|---|---|---|---|---|
| F-A15.1-1 | `rls_auto_enable()` SECURITY DEFINER + EXECUTE | LOW | **Unverified** (needs catalog) | None |
| F-A15.1-2 | `update_updated_at_column()` EXECUTE | LOW | **Unverified** | None |
| F-A15.1-3 | Broad default/existing table privileges | MEDIUM | **Different from F-A15.1** — 21/67 tables have no anon grant | None proposed (see §6.3) |
| F-A15.1-4 | FORCE RLS off | LOW | **Unverified** | None |
| F-A15.1-5 | `seva_list_items` RLS no policy | LOW | **Confirmed in production** (anon denied outright) | None |
| F-A15.1-6 | Public settings endpoint exposure | MEDIUM | **Confirmed in production** (endpoint narrowed) | None proposed |
| F-A15.1-7 | Private Storage bucket, no policies | LOW | **Unverified** (anon cannot enumerate buckets) | None |
| F-A15.1-8 | Migration/catalog drift | LOW | **Confirmed in production** (events/aaradhanes policies applied) | None |

### 6.1 F-A15.1-1 — `rls_auto_enable()` SECURITY DEFINER
**Unverified.** The function's attributes and EXECUTE grants need `pg_proc`; the catalog is
unreachable. No severity change. (Note: the linter concern is about `EXECUTE` via
`POST /rest/v1/rpc/`; that path was **not** exercised — no RPC was invoked.)

### 6.2 F-A15.1-2 — `update_updated_at_column()` EXECUTE
**Unverified.** Same reason. No severity change.

### 6.3 F-A15.1-3 — broad table privileges — **Different from F-A15.1**
Live evidence: **21 of 67 tables return `401 permission denied`** to `anon`, i.e. `anon` has **no**
table grant on them (`audit_log`, all `seva_*`/POS/receipt tables, `staff`, `counters`, …). The
F-A15.1 claim that `anon` holds *full* grants (`SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER`) on *every* table is therefore **contradicted for `anon`**. The repository's
privilege-hardening migrations are evidently applied in production. **Caveats:** only `anon` was
observable (no `authenticated` session); and only `SELECT` is observable over GET — write privileges
were deliberately **not** probed. No severity change is proposed; if anything the live evidence is
*milder* than F-A15.1's reproduction for the `anon` role.

### 6.4 F-A15.1-4 — FORCE RLS
**Unverified.** Requires `pg_class.relforcerowsecurity`. No severity change.

### 6.5 F-A15.1-5 — `seva_list_items` — **Confirmed in production**
Live evidence: `anon` receives **`401 permission denied for table seva_list_items`** — stronger than
"RLS enabled, no policy (default-deny)": `anon` has no table privilege at all. The finding is
**Confirmed in production**, and the observed state is at least as safe as F-A15.1 described. No
severity change.

### 6.6 F-A15.1-6 — public settings endpoint — **Confirmed in production**
PR #370's merge commit `641a0d318f58c6640ff20081b9a8c5712c8e6af8` has a **Production** deployment;
the later Production deploy (`0691388`, PR #369) is documentation-only, so `641a0d3` is an ancestor
of production. Website checks (GET-only, `https://rayaramathaynk.vercel.app`):

* `GET /api/public/settings/device` → **404**.
* `GET /api/public/settings/financeSettings` → **200**, top-level keys
  `enabled`/`upi`/`bankTransfer`/`specialSevas` **only**; `billing`, `billingEnabled`, `updatedAt`
  **absent**; no extra keys; only `isActive = true` special sevas.
* `GET /api/public/settings/unknownKeyXYZ` → **404** (allow-list enforced).
* `GET /donation` → **200**; intended UPI / bank-transfer information renders.

Additionally, at the database layer `settings_documents` returns **0 rows** to `anon` (deny-all), so
the settings documents are only reachable through the server-side, service-role projection.
**Confirmed in production**; no severity change; no financial values are reproduced in this report.

### 6.7 F-A15.1-7 — Storage bucket / policies — **Unverified**
`GET /storage/v1/bucket` with the publishable key returned **0 buckets**. Because the anon key only
lists buckets the role may see, this does **not** prove the private `RayaramathaYNK` bucket is
absent, nor that Storage policies changed. Requires the `storage.buckets`/`pg_policies` catalog read.
No severity change.

### 6.8 F-A15.1-8 — migration/catalog drift — **Confirmed in production**
Live evidence: `events` serves **74** rows and `aaradhanes` serves **2** rows to `anon`, so the
policies in `20261105000000_events_public_select_policy.sql` and
`20261111000000_aaradhanes_public_select_policy.sql` — both commented "prepared, NOT applied" in the
repository — **are applied in production**. This **confirms** F-A15.1's drift item D2. The exact
applied-migration count still requires the ledger. No severity change.

---

## 7. PR #370 production HTTP checks — results

Deployment containment confirmed first (Production deployment of `641a0d3`), then checks run
GET-only. No form submitted, no payment initiated, no login attempted, no setting changed. No
financial values reproduced.

| # | Check | Result |
|---|---|---|
| 1 | `GET /api/public/settings/financeSettings` | **200**; only public donation projection; `billing`/`billingEnabled`/`updatedAt` absent; unknown fields absent; only active special sevas → **PASS** |
| 2 | `GET /api/public/settings/device` | **404** → **PASS** (log-level "rejected before DB access" not observable; supported by merged source, not logs) |
| 3 | Public donation page (`GET /donation`) | **200**; intended UPI / bank-transfer info renders → **PASS** |
| 4 | Admin billing pages (`GET /admin/billing`, `/admin/billing/create`) | Served an **unauthenticated shell** ("unauthorized"); **no valid test session available** → **Unavailable** |

---

## 8. Limitations and inaccessible checks

1. **No catalog SQL.** The production direct DB host is IPv6-only and unreachable from this sandbox,
   and no DB password was supplied. All catalog-level counts (privileges, policies, functions, FORCE
   RLS, default ACLs, ledger, extensions) are therefore unavailable.
2. **Only the `anon` role was observable.** `authenticated`-role visibility and write privileges
   could not be tested without a session (and writes were deliberately not attempted).
3. **Storage bucket enumeration is inconclusive** with an anon key.
4. **No application-log access**, so "device rejected before DB access" is evidenced by merged source.
5. **No authenticated admin session**, so admin billing verification is unavailable.
6. **Custom domain did not resolve** (`rayaramathaynk.com`, `www.rayaramathaynk.com` — NXDOMAIN);
   checks used the confirmed production host `rayaramathaynk.vercel.app`.
7. **F-A15.1-1, -2, -4, -7 remain Unverified** and must not be presented as live production facts.

---

## 9. Items requiring owner decisions

1. **Provide a read-only production credential for the catalog layer** (a Supabase pooler URL with
   the DB password, or run `F-A15.1_READ_ONLY_QUERIES.sql` in the SQL editor with a read-only role),
   so the remaining catalog categories (privileges matrix, policies, functions, FORCE RLS, default
   ACLs, migration ledger, extensions) can be completed. The direct host is IPv6-only, so a
   **pooler (IPv4) URL** is the practical route from this environment.
2. **Decide whether `events` (74 rows) and `aaradhanes` (2 rows) should be anon-readable** in
   production, since the repository marks those policies "prepared, NOT applied" but production has
   them applied (F-A15.1-8 drift). No action is implied by this report.
3. **Confirm the canonical production URL** — `rayaramathaynk.vercel.app` (reachable) vs the
   non-resolving `rayaramathaynk.com` custom domain.
4. **Decide whether the residual public donation fields** (`upi.id`,
   `bankTransfer.accountNumber`/`ifscCode`) are intended to be public (they are returned by the
   narrowed endpoint and rendered on the public donation page).
5. **No remediation is authorized by this report.** The F-A15.1 remediation proposal remains
   **Proposed** and untouched.

---

## 10. Explicit statement on production changes

**No production change of any kind was made.** No INSERT/UPDATE/DELETE/UPSERT/TRUNCATE, no
CREATE/ALTER/DROP, no GRANT/REVOKE, no migration applied or repaired, no RLS/policy/privilege/
function/trigger/Storage change, no RPC or function invocation, no GraphQL, no dashboard change, no
environment variable change, no deployment, no workflow dispatch, and no Firestore access. The only
network actions were read-only GitHub API GETs, GET requests to the production website (PR #370
checks), and GET-only PostgREST probes (`limit=0`, `count=exact`) for the anon-visibility census.

**Secrets handling.** The owner-supplied publishable key and DB host details were used in-session for
validation only and are **not** recorded in this repository or this report; no DB URL, password,
token, service-role key, or connection string is committed or printed. Project refs are shown only
as non-reversible SHA-256 prefixes. No sensitive row contents were retrieved.

---

## 11. Revision history

| Rev | Date (UTC) | Change |
|---|---|---|
| 1 | 2026-10-31 | Initial F-A16. Catalog portion aborted (non-approved sandbox credential). PR #370 deployment confirmed; website checks passed; admin unavailable. |
| 2 | 2026-10-31 | Owner supplied the production identity (URL, publishable key, direct DB host). Identity **validated** live; added the **effective anon-visibility census** of all 67 tables via GET-only PostgREST probes (§4A). F-A15.1-5 and -8 upgraded to **Confirmed in production**; F-A15.1-3 marked **Different from F-A15.1**; catalog categories remain Unavailable (IPv6-only host, no DB password). No production change made. |
