# F-A16 — Production Evidence Summary

**Companion to:** `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`
**Baseline query set:** `docs/audits/F-A15.1_READ_ONLY_QUERIES.sql`
**Date (UTC):** 2026-10-31
**Mode:** Verification only. No production change was made.

This summary contains **no secrets and no financial values**. Project refs are shown only as
non-reversible SHA-256 prefixes for equality checks.

---

## 1. Headline

| Question | Answer |
|---|---|
| Was the temple production database reached? | **No** — mandatory abort condition met |
| Was project identity validated as `kvrkraqjuyxbraccxntk`? | **No** — the available credential is a different project |
| Was read-only mode proven? | Only on the **non-production** reachable DB (`transaction_read_only=on`); not applicable to production |
| Were live catalog counts obtained? | **No** — all categories Unavailable |
| Was the PR #370 production deployment confirmed? | **Yes** — Production deployment of `641a0d318f58c6640ff20081b9a8c5712c8e6af8` |
| Were the PR #370 endpoint checks run? | **Yes** — 3 pass, 1 unavailable (admin, no session) |
| Were any production changes made? | **No** |

---

## 2. Production identity evidence

| Item | Value (non-secret) |
|---|---|
| Approved ref | `kvrkraqjuyxbraccxntk` → SHA-256 prefix `233ede17c9c7` |
| Ref from `SUPABASE_DB_URL` | SHA-256 prefix `72b54d98a3dc` — **≠ approved** |
| Ref from `SUPABASE_DB_URL_TX` | SHA-256 prefix `72b54d98a3dc` — **≠ approved** |
| Ref in `SUPABASE_PROJECT_REF` | SHA-256 prefix `72b54d98a3dc` — **≠ approved** |
| Reachable DB `public` table count | **14** (Tournament schema: `teams`, `matches`, `players`, `tournaments`, …) |
| Expected temple `public` table count (F-A15.1 reproduction) | 67 |
| Production host liveness | `kvrkraqjuyxbraccxntk.supabase.co` resolves; unauthenticated `GET /rest/v1/` → **401** (existence only, not access) |

**Conclusion:** the only available database credential targets an unrelated project. Abort triggered
per task §2. No substitute database used.

---

## 3. Live catalog counts

**None available.** The F-A15.1 query set was reviewed (all statements are read-only) but **not
executed** against any database other than the non-production probe.

| Category | Live result |
|---|---|
| A. Public tables / RLS / FORCE RLS / owners | Unavailable |
| B. Effective table privileges | Unavailable |
| C. RLS policies | Unavailable |
| D. Functions / SECURITY DEFINER / event triggers | Unavailable |
| E. Default privileges | Unavailable |
| F. Storage buckets / policies / object rows | Unavailable |
| G. Migration ledger | Unavailable |
| H. Extensions (incl. `pg_graphql`) | Unavailable |

---

## 4. Comparison with F-A15.1 (all rows Unavailable)

| Area | F-A15.1 reproduced | F-A16 live | Status |
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

No difference can be classified (real change vs drift vs scope) without a live read.

---

## 5. PR #370 production verification

**Deployment containment:** confirmed — Production deployment `7458138508` of
`641a0d318f58c6640ff20081b9a8c5712c8e6af8` (2026-10-31T11:44:55Z); later Production deployment
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

## 6. Finding status after F-A16

| ID | F-A15.1 severity | F-A16 evidence status | Severity change |
|---|---|---|---|
| F-A15.1-1 | LOW | Unverified | None |
| F-A15.1-2 | LOW | Unverified | None |
| F-A15.1-3 | MEDIUM | Unverified | None |
| F-A15.1-4 | LOW | Unverified | None |
| F-A15.1-5 | LOW | Unverified | None |
| F-A15.1-6 | MEDIUM | **Confirmed in production** (endpoint narrowed as designed) | None proposed |
| F-A15.1-7 | LOW | Unverified | None |
| F-A15.1-8 | LOW | Unverified | None |

---

## 7. References

* Detailed report: `docs/audits/F-A16_LIVE_PRODUCTION_SECURITY_VERIFICATION.md`
* Baseline query set: `docs/audits/F-A15.1_READ_ONLY_QUERIES.sql`
* Prior audit: `docs/audits/F-A15.1_SUPABASE_SECURITY_DEEP_DIVE.md`
* Remediation proposal (unchanged, still Proposed): `docs/audits/F-A15.1_REMEDIATION_PROPOSAL.md`
* Public-settings projection: `docs/audits/F-A15.2_PUBLIC_SETTINGS_PROJECTION.md`

**Findings in this document are evidence, not authorization to remediate.**
