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

**The production temple database could not be reached, and the audit aborted the catalog portion as
required by the mandatory abort condition (§2).** The only database credential available in the
sandbox (`SUPABASE_DB_URL` / `SUPABASE_DB_URL_TX`) resolves to a **different, non-approved project**
— the unrelated "Tournament" project (`teams`, `matches`, `players`, `tournaments`, …). Its project
ref does **not** equal the approved ref `kvrkraqjuyxbraccxntk`, and its host is not
`kvrkraqjuyxbraccxntk.supabase.co`. Per §2, the audit did **not** run the F-A15.1 catalog queries
against it and did **not** substitute it for production. **No live catalog counts for the temple
project are available.** Every catalog area in §4 is therefore reported **Unavailable**.

The one portion of the task that *could* be executed independently — the **separate PR #370 HTTP
endpoint checks (§7)** — was performed against the production website. The production deployment of
merge commit `641a0d318f58c6640ff20081b9a8c5712c8e6af8` **was independently confirmed**, and the
endpoint checks **passed**:

* `GET /api/public/settings/device` → **HTTP 404** (no `device` document served).
* `GET /api/public/settings/financeSettings` → **HTTP 200** with a **narrow, allow-listed
  projection** (`enabled`, `upi`, `bankTransfer`, `specialSevas`); the forbidden fields `billing`,
  `billingEnabled` and `updatedAt` are **absent**; only **active** special sevas are returned.
* `GET /donation` → **HTTP 200**; the page still renders intended UPI / bank-transfer information.
* Admin billing pages → served an **unauthenticated shell** (no valid test session available);
  admin billing verification is **Unavailable** (login with guessed credentials was not attempted).

So the headline result of F-A16 is a **partial** one: the **F-A15.1-6** application-code fix is now
**verified in production** (upgraded from "unverified in production"), while **every database-level
finding (F-A15.1-1…5, 7, 8) remains unverified against the live temple catalog** because production
database access is not available from this environment.

| Result | Status |
|---|---|
| Production temple DB reached | **No** — abort condition met |
| Production project identity proven | **No** (cannot be, given the credential) |
| Read-only session proven on temple DB | **No** (not connected) |
| Read-only session proven on the only reachable DB | **Yes** (`transaction_read_only=on`) — but that DB is not production |
| PR #370 production deployment confirmed | **Yes** — Production deployment of `641a0d3` |
| PR #370 endpoint checks | **Executed and passed** |
| Live catalog counts | **Unavailable** for all categories |

---

## 2. Production identity validation — outcome

The task requires obtaining the connection through the existing secure secret mechanism (never via
chat), then inspecting host/project identity without exposing credentials, and aborting if the target
is not exactly `kvrkraqjuyxbraccxntk` / `kvrkraqjuyxbraccxntk.supabase.co`.

### 2.1 What was inspected

* The sandbox exposes only these database-related environment variables (names only; values never
  printed): `SUPABASE_DB_URL`, `SUPABASE_DB_URL_TX`, `SUPABASE_PROJECT_REF`, `SUPABASE_POOLER_HOST`.
* The project ref carried by each URL was resolved with the repository's own fail-closed helper
  `scripts/lib/approved-project.mjs` (`analyzeDbUrlRef` / `isApprovedRef`), which extracts the ref
  from the Supavisor username `postgres.<ref>` and/or the host `db.<ref>.supabase.co` and refuses to
  guess when they conflict.

### 2.2 Identity result (fingerprints only — no secret values)

| Value | SHA-256 prefix (12 hex) | Equals approved ref? |
|---|---|---|
| Approved ref `kvrkraqjuyxbraccxntk` | `233ede17c9c7` | — |
| Ref resolved from `SUPABASE_DB_URL` | `72b54d98a3dc` | **No** |
| Ref resolved from `SUPABASE_DB_URL_TX` | `72b54d98a3dc` | **No** |
| Ref in `SUPABASE_PROJECT_REF` | `72b54d98a3dc` | **No** |

The resolved ref is a well-formed 20-character ref (the extractor did not fail closed), but it is a
**different project** from the approved one. A non-reversible SHA-256 prefix is used so the report
proves *inequality* without disclosing the value.

### 2.3 Corroborating evidence that the reachable DB is not production

A read-only identity probe of the reachable database returned:

* `current_database = postgres`, connecting role prefix `postgres` (pooler user form).
* `transaction_read_only = on`, `default_transaction_read_only = on`.
* **14** tables in `public`, whose names are the unrelated Tournament schema:
  `_prisma_migrations`, `courts`, `match_games`, `match_participants`, `matches`, `players`,
  `realtime_events`, `system_metadata`, `team_members`, `teams`, `tournament_categories`,
  `tournament_entries`, …

Production (per F-A15.1 reproduction) is expected to hold **67** temple tables. The reachable
database holds 14 Tournament tables. **This is the same unrelated project F-A15.1 already
identified**; it has not changed and it is not the temple database.

### 2.4 Abort decision

The mandatory abort condition in §2 of the task is met:

* The project ref does not match `kvrkraqjuyxbraccxntk`. ✅ (abort trigger)
* The host is not `kvrkraqjuyxbraccxntk.supabase.co`. ✅ (abort trigger)
* The connection points to a project other than the approved one. ✅ (abort trigger)

**Action taken:** the F-A15.1 catalog queries in §4 were **not executed** against the reachable
database. No substitute database was used. No credential was requested from the owner. The abort
reason is recorded here **without revealing secrets** — only ref fingerprints and non-sensitive
catalog shape.

### 2.5 Production host liveness (non-secret, informational only)

The production project host `kvrkraqjuyxbraccxntk.supabase.co` resolves publicly (Cloudflare edge) and
answers an unauthenticated `GET /rest/v1/` with **HTTP 401**. This confirms the project **exists** and
its public API is reachable over the network — but it does **not** grant catalog access and no
credential for it is available here. Reachability of the API host is **not** proof of database
identity and was **not** treated as such.

---

## 3. Read-only connection/safety evidence

* **On the reachable (non-production) database**, read-only mode was enforced *before* opening the
  session and proven:
  * connection opened with `options="-c default_transaction_read_only=on"`, then
    `conn.set_session(readonly=True, autocommit=True)`;
  * `SHOW transaction_read_only` → `on`;
  * `SELECT current_setting('default_transaction_read_only')` → `on`.
  * Only catalog `SELECT`s were run; no function/RPC was invoked.
* **On the temple production database**: no session exists, therefore read-only mode could not be
  established there. Per §3 of the task ("If the connection cannot enforce read-only mode, stop"),
  the catalog audit stopped.
* No statement that changes database state was used to establish safety mode on any connection.

---

## 4. Query coverage and timestamps

| Timestamp (UTC) | Step |
|---|---|
| 2026-10-31T12:44:37Z | Identity inspection, ref resolution, abort decision recorded |
| 2026-10-31T12:4xZ | Read-only identity probe of the reachable (non-production) DB |
| 2026-10-31T12:4xZ | GitHub API: PR #370 merge SHA + Production deployment lineage |
| 2026-10-31T12:4xZ | PR #370 GET-only endpoint checks against `rayaramathaynk.vercel.app` |

**F-A15.1_READ_ONLY_QUERIES.sql coverage:** all statements were reviewed and each is read-only
(`SELECT` / catalog reads only — no DML, DDL, GRANT/REVOKE, TRUNCATE, or function invocation). **None
of them was executed**, because the only reachable database is not the approved production project.
Every category below is therefore **Unavailable**.

| Category (task §4) | Status |
|---|---|
| A. Public tables and RLS | **Unavailable** — not production |
| B. Effective table privileges | **Unavailable** — not production |
| C. RLS policies | **Unavailable** — not production |
| D. Functions and execution privileges | **Unavailable** — not production |
| E. Default privileges | **Unavailable** — not production |
| F. Supabase Storage | **Unavailable** — not production |
| G. Migration ledger | **Unavailable** — not production |
| H. Extensions (`pg_graphql` et al.) | **Unavailable** — not production |

No permission errors were encountered, because no queries were run against production. There is
**no privilege-escalation attempt** and **no credential switch**; the environment simply has no
production credential.

---

## 5. Comparison with F-A15.1

Live counts are not obtainable, so every row is **Unavailable**. The "F-A15.1 reproduced" column is
the value F-A15.1 derived from repository migrations (it was explicitly labelled there as a
reproduction, not a live read).

| Area | F-A15.1 reproduced result | F-A16 live result | Status |
|---|---:|---:|---|
| Public tables | 67 | — | Unavailable |
| RLS enabled | 67 | — | Unavailable |
| FORCE RLS | 0 | — | Unavailable |
| Public policies | 81 | — | Unavailable |
| Table privilege records | 1,088 | — | Unavailable |
| Public functions | 87 | — | Unavailable |
| SECURITY DEFINER functions | 1 | — | Unavailable |
| Default ACL entries | 6 | — | Unavailable |
| Storage buckets | 1 | — | Unavailable |
| Storage policies | 0 | — | Unavailable |
| Applied migrations | 15 (Oct 2026, per F-A15.1) | — | Unavailable |

**Why no difference can be explained.** Because no live catalog read was possible, no difference
between F-A15.1 and production can be classified as a real production change, a repository
migration drift, or a scope/permission difference. All differences remain **inconclusive** by
construction, and F-A15.1's reproduced numbers must continue to be treated as *reproductions*, not
verified production counts.

The repository itself carries **41** `supabase/migrations/*.sql` files, while F-A15.1 reported the
ledger as carrying ~15 applied migrations and explicitly noted the ledger drifts. F-A16 **cannot**
confirm or refute the applied count without production access.

---

## 6. Reassessment of F-A15.1 findings using live evidence

Evidence labels used exactly as defined in the task.

| ID | Finding | F-A15.1 severity | F-A16 evidence status | Severity change? |
|---|---|---|---|---|
| F-A15.1-1 | `rls_auto_enable()` SECURITY DEFINER + EXECUTE grants | LOW | **Unverified** (DB not reached) | None |
| F-A15.1-2 | `update_updated_at_column()` EXECUTE grants | LOW | **Unverified** | None |
| F-A15.1-3 | Broad default/existing table privileges | MEDIUM | **Unverified** | None |
| F-A15.1-4 | FORCE RLS off on all tables | LOW | **Unverified** | None |
| F-A15.1-5 | `seva_list_items` RLS with no policy | LOW | **Unverified** | None |
| F-A15.1-6 | Public settings endpoint exposure | MEDIUM | **Confirmed in production** (endpoints narrowed as designed) | None proposed — see §6.6 |
| F-A15.1-7 | Private Storage bucket `RayaramathaYNK`, no policies | LOW | **Unverified** | None |
| F-A15.1-8 | Migration/catalog drift | LOW | **Unverified** | None |

### 6.1 F-A15.1-1 — `rls_auto_enable()` SECURITY DEFINER
**Unverified.** The function's existence, `SECURITY DEFINER` attribute, `EXECUTE` grants and
non-RPC-reachability could not be re-measured against production. No severity change.

### 6.2 F-A15.1-2 — `update_updated_at_column()` EXECUTE grants
**Unverified.** No production catalog read. No severity change.

### 6.3 F-A15.1-3 — broad table privileges
**Unverified.** The 1,088-record reconciliation in F-A15.1 was explicitly arithmetic, not a measured
count; F-A16 cannot measure it. No severity change.

### 6.4 F-A15.1-4 — FORCE RLS
**Unverified.** No production catalog read. No severity change.

### 6.5 F-A15.1-5 — `seva_list_items` RLS with no policy
**Unverified.** No production catalog read. No severity change.

### 6.6 F-A15.1-6 — public settings endpoint exposure — **Confirmed in production**
F-A15.1 recorded this as "remediated in application code (PR #370, merged `641a0d3`) — unverified in
production". F-A16 **independently confirmed the production deployment** and re-tested the deployed
behaviour:

* **Deployment lineage.** GitHub reports PR #370 merged with merge commit
  `641a0d318f58c6640ff20081b9a8c5712c8e6af8`, and a **Production** deployment of exactly that SHA
  (`deployment id 7458138508`, created 2026-10-31T11:44:55Z). The subsequent Production deployment
  (`0691388`, PR #369) is a documentation-only merge, so production also contains `641a0d3` as an
  ancestor. (The site is served from `rayaramathaynk.vercel.app`; the custom domain
  `rayaramathaynk.com` / `www.rayaramathaynk.com` did **not** resolve from this sandbox.)
* **`GET /api/public/settings/device` → HTTP 404**, JSON `{"error": ...}`. The `device` document is
  no longer served. (The rejection is a route-level allow-list check before any settings read; this
  is visible in the merged source at `app/api/public/settings/[key]/route.ts`, which returns 404 for
  any key outside `PUBLIC_KEYS` — but F-A16 could not read application logs, so "rejected before
  database access" is supported by source, not by log evidence.)
* **`GET /api/public/settings/financeSettings` → HTTP 200** with top-level keys
  `enabled`, `upi`, `bankTransfer`, `specialSevas` **only**. The forbidden fields
  `billing`, `billingEnabled`, `updatedAt` are **absent**, and there are **no extra keys** beyond the
  allow-list. `specialSevas` returned only entries with `isActive = true`.
* **`GET /api/public/settings/unknownKeyXYZ` → HTTP 404** (allow-list enforced).

**Conclusion:** F-A15.1-6's remediation is now **Confirmed in production** for the endpoint
behaviour (no `billing`/`billingEnabled`/`updatedAt`, no inactive sevas, `device` 404). The donation
projection intentionally still includes `upi.id` and `bankTransfer.accountNumber`/`ifscCode`; these
are the fields the public donation page uses and are treated by F-A15.1 as plausibly intended-public
donation details. **No severity change is proposed**, and this confirmation is **not** authorization
to remediate anything else. No financial values are reproduced in this report.

> Note: F-A15.1-6 was the only finding whose impact was *disclosure of real data* rather than
> configuration hardening. With the endpoint now narrowed in production, the remaining risk is the
> residual, plausibly-intended public donation details.

### 6.7 F-A15.1-7 — Storage bucket / policies
**Unverified.** Storage catalog reads require the production database; not performed. No severity
change.

### 6.8 F-A15.1-8 — migration/catalog drift
**Unverified.** The applied-migration ledger could not be read. No severity change.

---

## 7. PR #370 production HTTP checks — results

Deployment containment was confirmed first (Production deployment of `641a0d3`; see §6.6), so the
checks were executed. All requests were **GET only**. No form was submitted, no payment initiated,
no login attempted, no setting changed. No financial values are reproduced.

| # | Check | Result |
|---|---|---|
| 1 | `GET /api/public/settings/financeSettings` | **200**; only public donation projection; `billing`/`billingEnabled`/`updatedAt` absent; unknown fields absent; only active special sevas returned → **PASS** |
| 2 | `GET /api/public/settings/device` | **404** → **PASS** (log-level "rejected before DB access" not independently observable — see §6.6) |
| 3 | Public donation page (`GET /donation`) | **200**; intended UPI / bank-transfer information still renders → **PASS** |
| 4 | Admin billing pages (`GET /admin/billing`, `/admin/billing/create`) | Served an **unauthenticated shell** (contains "unauthorized"); **no valid test session available** → **Unavailable** |

Admin billing verification is **Unavailable** because no valid authenticated test session exists in
this environment; the task explicitly forbids attempting login with guessed credentials and forbids
changing or saving settings.

---

## 8. Limitations and inaccessible checks

1. **No production database access.** The environment provides no credential for
   `kvrkraqjuyxbraccxntk`; the only DB credential points to an unrelated project. This is the
   single, decisive limitation: **all catalog-level findings are unverified**.
2. **Custom domain did not resolve** (`rayaramathaynk.com`, `www.rayaramathaynk.com` — NXDOMAIN from
   this sandbox). Checks were run against the confirmed Vercel production host
   `rayaramathaynk.vercel.app` (HTTP 200, `Server: Vercel`).
3. **No application-log access**, so "device rejected before database access" is evidenced by merged
   source, not by logs.
4. **No authenticated admin session**, so admin billing verification is unavailable.
5. **F-A15.1-1…5, 7, 8 remain Unverified** and must not be presented as live production facts.

---

## 9. Items requiring owner decisions

1. **Provide a read-only production credential (or run the query set in the Supabase SQL editor with
   a read-only role) for `kvrkraqjuyxbraccxntk`**, so F-A16's catalog portion can actually complete.
   Without it, no live count for tables, RLS, policies, privileges, functions, default ACLs, Storage,
   the migration ledger, or extensions can be produced.
2. **Confirm which production URL is canonical** — `rayaramathaynk.vercel.app` (reachable, used here)
   vs the non-resolving `rayaramathaynk.com` custom domain.
3. **Decide whether the residual public donation fields** (`upi.id`,
   `bankTransfer.accountNumber`/`ifscCode`) are intended to be public. They are returned by the
   narrowed endpoint and rendered by the public donation page. No action is implied by this report.
4. **Decide whether to schedule the F-A15.1-1…5, 7, 8 catalog verification** once (1) is available.
5. **No remediation is authorized by this report.** The F-A15.1 remediation proposal remains
   **Proposed** and untouched.

---

## 10. Explicit statement on production changes

**No production change of any kind was made.** No INSERT/UPDATE/DELETE/UPSERT/TRUNCATE, no
CREATE/ALTER/DROP, no GRANT/REVOKE, no migration applied or repaired, no RLS/policy/privilege/
function/trigger/Storage change, no RPC or function invocation, no dashboard change, no environment
variable change, no deployment, no workflow dispatch, and no Firestore access. The only network
actions taken were read-only GitHub API GETs and GET requests to the production website for the PR
#370 checks. No credentials, database URLs, passwords, tokens, or service-role keys were printed,
logged, or committed; only non-reversible SHA-256 prefixes of refs are recorded, for equality proof.

---

## 11. Revision history

| Rev | Date (UTC) | Change |
|---|---|---|
| 1 | 2026-10-31 | Initial F-A16 report. Catalog portion **aborted** (production DB not reachable; credential resolves to a non-approved project). PR #370 production deployment **confirmed**; endpoint checks **passed**; admin billing **unavailable**. No production changes made. |
