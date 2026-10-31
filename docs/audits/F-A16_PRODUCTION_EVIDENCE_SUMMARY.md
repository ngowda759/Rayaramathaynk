# F-A16 — Production Evidence Summary

**Companion to:** `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`
**Baseline query set:** `docs/audits/F-A15.1_READ_ONLY_QUERIES.sql`
**Date (UTC):** 2026-10-31
**Mode:** Verification only. No production change was made.

This summary contains **no secrets and no financial values**. Project refs are shown only as
non-reversible SHA-256 prefixes for equality checks. No row contents are recorded.

---

## 1. Headline

| Question | Answer |
|---|---|
| Was the temple production project identity validated? | **Yes** — URL ref = `kvrkraqjuyxbraccxntk`; live `auth/v1/health` 200; live anon rows |
| Was the production **catalog** (SQL) reached? | **No** — direct host IPv6-only, no IPv6 egress, no DB password |
| Was read-only mode proven? | **Yes** at the API layer (GET-only); catalog layer not connected |
| Was the PR #370 production deployment confirmed? | **Yes** — Production deployment of `641a0d318f58c6640ff20081b9a8c5712c8e6af8` |
| Were the PR #370 endpoint checks run? | **Yes** — 3 pass, 1 unavailable (admin, no session) |
| Were any production changes made? | **No** |

---

## 2. Production identity evidence

### 2.1 Sandbox credential (non-production) — abort

| Item | Value (non-secret) |
|---|---|
| Approved ref | `kvrkraqjuyxbraccxntk` → SHA-256 prefix `233ede17c9c7` |
| Ref from `SUPABASE_DB_URL` / `_TX` / `PROJECT_REF` | SHA-256 prefix `72b54d98a3dc` — **≠ approved** |
| Reachable DB `public` tables | **14** (Tournament schema: `teams`, `matches`, `players`, `tournaments`, …) |

### 2.2 Owner-supplied production identity — validated

| Check | Result |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` ref = approved ref | **Yes** |
| Direct DB host `db.kvrkraqjuyxbraccxntk.supabase.co` | **Yes** (DNS resolves IPv6-only; sandbox has no IPv6 egress) |
| `GET /auth/v1/health` | **200** — GoTrue v2.197.0 |
| Live anon reads return production rows | **Yes** (`events` = 74) |
| DB password supplied | **No** — catalog SQL not possible |

---

## 3. Live anon-visibility census (all 67 repository tables)

Method: GET-only `?select=*&limit=0` + `Prefer: count=exact`; only status + `Content-Range` read.

| Class | Meaning | Count |
|---|---|---:|
| `401 permission denied` | `anon` has no table privilege | **21** |
| `200/206 … /0` | anon SELECT, RLS returns no rows (or empty) | **42** |
| `200/206 … /N` | anon reads N rows | **4** |
| Total probed | | **67** |

**Anon can read rows (4):** `events` = 74, `aaradhanes` = 2, `site_settings` = 2, `social_links` = 1.

**Anon denied entirely (21):** `audit_log`, `cash_denominations`, `counter_devices`, `counters`,
`day_close_counts`, `day_closes`, `devotee_profiles`, `festival_day_dates`, `festival_days`,
`group_counters`, `ops_backup_runs`, `receipt_number_gaps`, `receipt_series`, `receipt_series_years`,
`seva_list_items`, `seva_orders`, `seva_rate_history`, `seva_receipt_lines`, `seva_receipts`,
`seva_settings`, `staff`.

**Sensitive tables NOT readable by anon (0 rows):** `users`, `profiles`, `donations`,
`seva_bookings`, `settings_documents`, `bills`, `members`. **No anon-visible PII/financial rows.**

**Storage:** `GET /storage/v1/bucket` → `[]` (0 buckets) — **inconclusive** for the private bucket.

---

## 4. Catalog categories (all Unavailable)

| Category | Live result |
|---|---|
| A. Public tables / RLS / FORCE RLS / owners | Unavailable (no catalog session) |
| B. Effective table privileges (matrix) | Unavailable (only anon SELECT/no-grant observed) |
| C. RLS policies | Unavailable |
| D. Functions / SECURITY DEFINER / event triggers | Unavailable |
| E. Default privileges | Unavailable |
| F. Storage buckets / policies / object rows | Unavailable (anon list empty, inconclusive) |
| G. Migration ledger | Unavailable |
| H. Extensions (incl. `pg_graphql`) | Unavailable |

---

## 5. Comparison with F-A15.1

| Area | F-A15.1 reproduced | F-A16 live | Status |
|---|---:|---|---|
| Public tables | 67 | 67 reachable via PostgREST | Consistent (API); catalog Unavailable |
| RLS enabled | 67 | RLS active in effect | Consistent in effect; flag Unavailable |
| FORCE RLS | 0 | — | Unavailable |
| Public policies | 81 | — | Unavailable |
| Table privilege records | 1,088 | 21 tables have **no anon grant** | **Different from F-A15.1** |
| Public functions | 87 | — | Unavailable |
| SECURITY DEFINER functions | 1 | — | Unavailable |
| Default ACL entries | 6 | — | Unavailable |
| Storage buckets | 1 | anon list = 0 (inconclusive) | Unavailable |
| Storage policies | 0 | — | Unavailable |
| Applied migrations | 15 (Oct 2026) | — | Unavailable; drift partly confirmed |

**Key difference:** F-A15.1-3's "anon holds full grants on every table" is **contradicted** — 21/67
tables return `401` to anon. Repository privilege-hardening migrations are applied in production.

**Drift confirmed:** `events`/`aaradhanes` public-select policies (repo: "prepared, NOT applied") are
**applied in production** (F-A15.1-8).

---

## 6. Finding status after F-A16

| ID | F-A15.1 severity | F-A16 evidence status | Severity change |
|---|---|---|---|
| F-A15.1-1 | LOW | Unverified | None |
| F-A15.1-2 | LOW | Unverified | None |
| F-A15.1-3 | MEDIUM | **Different from F-A15.1** (21/67 tables have no anon grant) | None proposed |
| F-A15.1-4 | LOW | Unverified | None |
| F-A15.1-5 | LOW | **Confirmed in production** (anon denied outright) | None |
| F-A15.1-6 | MEDIUM | **Confirmed in production** (endpoint narrowed) | None proposed |
| F-A15.1-7 | LOW | Unverified (anon cannot enumerate buckets) | None |
| F-A15.1-8 | LOW | **Confirmed in production** (drift: policies applied) | None |

---

## 7. PR #370 production verification

**Deployment containment:** confirmed — Production deployment `7458138508` of
`641a0d318f58c6640ff20081b9a8c5712c8e6af8` (2026-10-31T11:44:55Z); the later Production deploy
`0691388` (PR #369) is documentation-only, so `641a0d3` is an ancestor of production. Host used:
`rayaramathaynk.vercel.app`.

| # | Check | HTTP | Outcome |
|---|---|---|---|
| 1 | `GET /api/public/settings/financeSettings` | 200 | Only `enabled`, `upi`, `bankTransfer`, `specialSevas`; `billing`/`billingEnabled`/`updatedAt` absent; no extra keys; only active special sevas → **PASS** |
| 2 | `GET /api/public/settings/device` | 404 | Document not served → **PASS** |
| 3 | `GET /donation` | 200 | Intended UPI / bank-transfer info renders → **PASS** |
| 4 | `GET /admin/billing`, `/admin/billing/create` | 200 | Unauthenticated shell; no test session → **Unavailable** |
| — | `GET /api/public/settings/unknownKeyXYZ` | 404 | Allow-list enforced (extra check) |

No financial values, account numbers, UPI identifiers, or secrets are recorded.

---

## 8. References

* Detailed report: `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`
* Baseline query set: `docs/audits/F-A15.1_READ_ONLY_QUERIES.sql`
* Prior audit: `docs/audits/F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md`
* Remediation proposal (unchanged, still Proposed): `docs/audits/F-A15.1_REMEDIATION_PROPOSAL.md`
* Public-settings projection: `docs/audits/F-A15.2_PUBLIC_SETTINGS_PROJECTION.md`

**Findings in this document are evidence, not authorization to remediate.**
