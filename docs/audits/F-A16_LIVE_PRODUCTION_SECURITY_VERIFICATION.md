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
* **Effective API access layer: reached and verified read-only.** The owner-supplied publishable key
  authenticates against the production PostgREST API, so the audit **validated the production
  identity live** and measured the **effective anon view** of every table with GET-only requests.
  This is real production evidence, just one layer above the raw catalog.

**What the live API layer established (production, read-only, GET-only):**

* **Identity is now proven.** The supplied URL ref equals the approved ref
  `kvrkraqjuyxbraccxntk`; production `GET /auth/v1/health` returns **200** (`GoTrue v2.197.0`); and
  anon reads return live production rows.
* **All 67 repository tables are exposed through PostgREST** (none returned "not in schema cache"),
  consistent with the F-A15.1 "67 public tables" figure — but this is a reachability proxy, not a
  catalog count.
* **Only 4 of 67 tables expose non-zero rows to `anon`:** `events` (74), `aaradhanes` (2),
  `site_settings` (2), `social_links` (1).
* **API-observed:** 21 of 67 tables return `401 permission denied` to `anon` — the API denies
  `anon` on them. This is **consistent with** `anon` holding no table privilege there, but the
  **grant matrix is a catalog fact and was not read**; the denial itself is the observed evidence.
  It contradicts F-A15.1-3's *effective* claim ("`anon` holds full grants on every table") for the
  `anon` role.
* **API-observed:** no anon-visible PII/financial rows — `users`, `profiles`, `donations`,
  `seva_bookings`, `settings_documents` all return **0 rows** to `anon`.
* **API-observed:** `anon` can read published `events` and `aaradhanes` rows. This is **consistent
  with** the two "prepared, NOT applied" public-select policies being applied in production
  (F-A15.1 drift item D2), but the **policy catalog and migration ledger were not read**; that
  remains a catalog fact.

### 1.1 Evidence layers — keep these apart

This report distinguishes three evidence layers and **never reports a fact from one layer as if it
came from another**:

| Layer | What it covers | How obtained | Status here |
|---|---|---|---|
| **Catalog** | table/RLS flags, policy definitions & counts, privilege matrix, functions & EXECUTE, FORCE RLS, default ACLs, migration ledger, extensions | PostgreSQL catalog reads (`pg_class`, `pg_policies`, `pg_proc`, `pg_default_acl`, `information_schema`, `supabase_migrations`) | **Not obtained** — no DB session |
| **API** | what the `anon` role can actually read under whatever security is in force, HTTP status, row counts, endpoint responses | GET-only PostgREST/HTTP against production | **Obtained, read-only** |
| **Source** | repository migrations, merged application code | static review | Reproduced |

Rules applied throughout:
* An API observation is reported as **API-observed behaviour**, never as a catalog fact.
* A catalog finding stays **Unverified** unless read from the catalog, even when API behaviour is
  consistent with it.
* "Consistent with" is **not** "confirmed as".

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
| Effective anon visibility per table | **Verified live (API layer)** |

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

**Conclusion:** production identity is **validated**; the effective API access layer is reachable and
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

| Class | API-observed meaning | Count |
|---|---|---:|
| `401 permission denied` | the API denies `anon` on this table (consistent with no table grant) | **21** |
| `200/206 … /0` | `anon` request succeeds but **0 rows are returned** (RLS default-deny, or table empty) | **42** |
| `200/206 … /N` | `anon` **reads N rows** | **4** |
| Total | | **67** |

> These are **API-layer observations**. "`401 permission denied`" is the API's response; it does
> **not** by itself prove the absence of a catalog grant, and "0 rows" does not by itself prove a
> deny-all policy (the table could simply be empty). The privilege matrix and policy catalogue
> remain **catalog facts that were not read** (§4).

**Tables the API denies to `anon` (401) — 21:** `audit_log`, `cash_denominations`,
`counter_devices`, `counters`, `day_close_counts`, `day_closes`, `devotee_profiles`,
`festival_day_dates`, `festival_days`, `group_counters`, `ops_backup_runs`, `receipt_number_gaps`,
`receipt_series`, `receipt_series_years`, `seva_list_items`, `seva_orders`, `seva_rate_history`,
`seva_receipt_lines`, `seva_receipts`, `seva_settings`, `staff`.

**Tables `anon` can read rows from (4):**

| Table | Anon-visible rows (API) |
|---|---:|
| `events` | 74 |
| `aaradhanes` | 2 |
| `site_settings` | 2 |
| `social_links` | 1 |

**Sensitive tables the API returns 0 rows for to `anon`:** `users`, `profiles`, `donations`,
`seva_bookings`, `settings_documents`, `bills`, `members` (0 rows), and `devotee_profiles`, `staff`,
`seva_orders`, `seva_receipts` (401). **No anon-visible PII or financial rows were observed at the
API layer.** (Whether this is a grant denial or an RLS deny-all policy is a catalog fact not read.)

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
| Public tables | 67 | 67 reachable via PostgREST (none 404) — **API observation** | **Consistent (API layer)**; catalog count Unavailable |
| RLS enabled | 67 | not read from catalog; API shows per-table access and row-return behaviour; it does not establish whether zero rows result from RLS filtering or empty tables | **Unavailable (catalog)**; API behaviour consistent |
| FORCE RLS | 0 | — | Unavailable (catalog) |
| Public policies | 81 | — | Unavailable (catalog) |
| Table privilege records | 1,088 | not read from catalog; API denies `anon` on 21 tables | **Unavailable (catalog)**; F-A15.1-3 contradicted *in effect* for `anon` |
| Public functions | 87 | — | Unavailable (catalog) |
| SECURITY DEFINER functions | 1 | — | Unavailable (catalog) |
| Default ACL entries | 6 | — | Unavailable (catalog) |
| Storage buckets | 1 | anon bucket list = 0 (inconclusive) | Unavailable |
| Storage policies | 0 | — | Unavailable (catalog) |
| Applied migrations | 15 (Oct 2026) | — (ledger unread) | Unavailable (catalog); drift **consistent** with API behaviour |

> Every row's "F-A16 live" column is either an **API observation** (explicitly labelled) or
> **Unavailable** because the catalog was not read. No catalog count is asserted from API behaviour.

**Difference classification (layer-explicit):**

* **API-observed, `anon` denied on 21 tables** — the API denies `anon` on those tables. This
  contradicts F-A15.1-3's **effective** claim that `anon` holds full grants on *every* table. It is
  **consistent with** the repository's `REVOKE`/privilege-hardening migrations being applied in
  production, but that is a **catalog fact not read**, so it is not asserted here.
* **API-observed, `events`/`aaradhanes` readable by `anon`** — consistent with the two
  "prepared, NOT applied" public-select policies being applied in production (F-A15.1 drift item
  D2). The **policy catalogue and migration ledger were not read**, so the drift itself stays a
  catalog fact.
* All numeric catalog counts remain **inconclusive** (no catalog read).

---

## 6. Reassessment of F-A15.1 findings using live evidence

| ID | Finding | F-A15.1 severity | F-A16 evidence status | Severity change? |
|---|---|---|---|---|
| F-A15.1-1 | `rls_auto_enable()` SECURITY DEFINER + EXECUTE | LOW | **Unverified** (catalog not read) | None |
| F-A15.1-2 | `update_updated_at_column()` EXECUTE | LOW | **Unverified** (catalog not read) | None |
| F-A15.1-3 | Broad default/existing table privileges | MEDIUM | **Unverified (catalog)**; API-observed behaviour contradicts it *in effect* for `anon` | None proposed (see §6.3) |
| F-A15.1-4 | FORCE RLS off | LOW | **Unverified** (catalog not read) | None |
| F-A15.1-5 | `seva_list_items` RLS no policy | LOW | **Unverified (catalog)**; API-observed: `anon` denied on this table | None |
| F-A15.1-6 | Public settings endpoint exposure | MEDIUM | **Confirmed in production** (deployed endpoint behaviour) | None proposed |
| F-A15.1-7 | Private Storage bucket, no policies | LOW | **Unverified** (catalog not read; anon cannot enumerate buckets) | None |
| F-A15.1-8 | Migration/catalog drift | LOW | **Unverified (catalog)**; API-observed behaviour is consistent with the drift | None |

### 6.1 F-A15.1-1 — `rls_auto_enable()` SECURITY DEFINER
**Unverified.** The function's attributes and EXECUTE grants need `pg_proc`; the catalog is
unreachable. No severity change. (Note: the linter concern is about `EXECUTE` via
`POST /rest/v1/rpc/`; that path was **not** exercised — no RPC was invoked.)

### 6.2 F-A15.1-2 — `update_updated_at_column()` EXECUTE
**Unverified.** Same reason. No severity change.

### 6.3 F-A15.1-3 — broad table privileges — **Unverified (catalog); contradicted in effect (API)**
**Catalog status: Unverified** — the grant matrix (`information_schema.role_table_grants`) was not
read. **API-observed:** 21 of 67 tables return `401 permission denied` to `anon` (`audit_log`, all
`seva_*`/POS/receipt tables, `staff`, `counters`, …), so F-A15.1-3's *effective* claim that `anon`
holds *full* grants on *every* table does not hold for `anon` as observed. Whether `anon` truly has
no grant (vs. a PostgREST/RLS denial) is a **catalog fact not read**. **Caveats:** only `anon` was
observable (no `authenticated` session); and only `SELECT` is observable over GET — write privileges
were deliberately **not** probed. No severity change is proposed; the API-observed evidence is
*milder* than F-A15.1's reproduction for the `anon` role.

### 6.4 F-A15.1-4 — FORCE RLS
**Unverified.** Requires `pg_class.relforcerowsecurity`. No severity change.

### 6.5 F-A15.1-5 — `seva_list_items` — **Unverified (catalog); API-observed denial**
**Catalog status: Unverified** — `pg_class.relrowsecurity` / `pg_policies` were not read.
**API-observed:** `anon` receives **`401 permission denied for table seva_list_items`**. The
*observed* state is at least as safe as F-A15.1's description ("RLS enabled, no policy,
default-deny"). Whether that is a missing table grant or an RLS deny-all remains a catalog fact.
No severity change.

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

Additionally, the **API** returns **0 rows** for `settings_documents` to `anon` (whether via grant
denial or RLS deny-all is a catalog fact not read), so the settings documents are only reachable
through the server-side, service-role projection. This finding is about **deployed endpoint
behaviour** (a deployment fact, not a catalog fact), and it is **Confirmed in production**; no
severity change; no financial values are reproduced in this report.

### 6.7 F-A15.1-7 — Storage bucket / policies — **Unverified**
`GET /storage/v1/bucket` with the publishable key returned **0 buckets**. Because the anon key only
lists buckets the role may see, this does **not** prove the private `RayaramathaYNK` bucket is
absent, nor that Storage policies changed. Requires the `storage.buckets`/`pg_policies` catalog read.
No severity change.

### 6.8 F-A15.1-8 — migration/catalog drift — **Unverified (catalog); API-observed behaviour consistent**
**Catalog status: Unverified** — the policy catalogue and `supabase_migrations.schema_migrations`
ledger were not read. **API-observed:** `anon` reads **74** rows from `events` and **2** from
`aaradhanes`. That behaviour is **consistent with** the two public-select policies
(`20261105000000_events_public_select_policy.sql`,
`20261111000000_aaradhanes_public_select_policy.sql`) — both commented "prepared, NOT applied" in the
repository — being applied in production, i.e. consistent with F-A15.1's drift item D2. **The drift
itself remains a catalog fact**, not proven by API behaviour. The applied-migration count still
requires the ledger. No severity change.

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
7. **F-A15.1-1, -2, -3, -4, -5, -7, -8 remain Unverified as catalog facts** and must not be
   presented as live catalog results. Where API behaviour is consistent with them, that is stated
   as *consistency*, not confirmation.
8. **The API layer proves only the `anon` role's effective reads.** It cannot substitute for the
   catalog on counts, grants, policies, functions, ACLs, or the ledger.

---

## 9. Items requiring owner decisions

1. **Provide a read-only production credential for the catalog layer** (a Supabase pooler URL with
   the DB password, or run `F-A15.1_READ_ONLY_QUERIES.sql` in the SQL editor with a read-only role),
   so the remaining catalog categories (privileges matrix, policies, functions, FORCE RLS, default
   ACLs, migration ledger, extensions) can be completed. The direct host is IPv6-only, so a
   **pooler (IPv4) URL** is the practical route from this environment.
2. **Decide whether `events` (74 anon-visible rows) and `aaradhanes` (2) should be anon-readable**
   in production. The API shows `anon` reading them, which is consistent with the repository's
   "prepared, NOT applied" policies being applied — but that is a catalog fact to confirm with the
   catalog read in item 1. No action is implied by this report.
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
| 2 | 2026-10-31 | Owner supplied the production identity (URL, publishable key, direct DB host). Identity **validated** live; added the **effective anon-visibility census** of all 67 tables via GET-only PostgREST probes (§4A). Catalog categories remain Unavailable (IPv6-only host, no DB password). No production change made. |
| 3 | 2026-10-31 | **Evidence-layer correction.** Added §1.1 (Catalog / API / Source layer separation) and re-scoped every statement so API-observed behaviour is never presented as a catalog fact. Reverted the rev-2 over-claims: F-A15.1-3, -5 and -8 are now **Unverified (catalog)** with the API observation stated separately as *consistent with*; only F-A15.1-6 (deployed endpoint behaviour) remains **Confirmed in production**. §4A, §5, §6 and §8 updated accordingly. No finding severity changed; no production change made. |
| 4 | 2026-10-31 | **Wording: no implied RLS verification.** Renamed "RLS-effective layer" to "effective API access layer", and replaced "API shows per-table row filtering" with wording that states the API shows access and row-return behaviour only and **does not establish whether zero rows result from RLS filtering or empty tables**. Removed the "(RLS applied)" gloss from the layer table. No content change beyond wording; no production change made. |
