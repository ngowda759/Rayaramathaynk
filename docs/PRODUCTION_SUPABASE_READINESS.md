# Production Supabase Readiness — PR #365

Read-only production readiness review of the fresh Supabase-native data implementation.
**No production write, schema change, migration, DDL, settings change, authentication
change or deployment was performed.** PR #365 stays open and draft.

- Repository: `ngowda759/Rayaramathaynk`
- Branch / head reviewed: `fix/fresh-seed-populated-db` @ `30f09bf`
- Production project (approved): `kvrkraqjuyxbraccxntk`
- Review date: 2026-10-28

> Verdict: **Production verification blocked by missing privileged read-only access.**
> See [§9](#9-recommendation) and [§8](#8-verified-vs-unverified). The code-level review is
> complete; the authoritative row-count verification in the objective could not be
> established without a privileged read-only credential.

## 1. Purpose and scope

The objective was to (1) establish authoritative read-only production row counts,
(2) verify the two `site_settings` records and their consumers, (3) review the Supabase key
compatibility fix `30f09bf`, (4) prepare a table-by-table seed-safety plan, and (5) produce
this document and `docs/SUPABASE_DATA_ONLY_INITIALIZATION_PLAN.md`.

## 2. Method and evidence

All production access used the owner-supplied **public** credentials only:

- `NEXT_PUBLIC_SUPABASE_URL = https://kvrkraqjuyxbraccxntk.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_…` (RLS-restricted; the renamed
  anon key)

Read-only calls used PostgREST `GET` with `Range: 0-0` and `Prefer: count=exact`, reading
the `content-range` header. No `POST`/`PATCH`/`PUT`/`DELETE` was issued. No secret value is
recorded in this document.

## 3. Privileged read-only access: blocked

The objective asked for authoritative counts using a privileged read-only method. That is
**not available in this environment**, established by direct connection attempts
(`psycopg2`, `sslmode=require`, session set `READ ONLY`):

| Attempt | Result |
|---------|--------|
| Sandbox `SUPABASE_DB_URL` | Connects, but is a **different project** — `information_schema` shows a "Tournament" schema (`teams`, `matches`, `players`, `tournaments`, …), **0/18** temple tables. Not the temple database. |
| `SUPABASE_PROJECT_REF` | Not the approved ref (`kvrkraqjuyxbraccxntk`). |
| `SUPABASE_POOLER_HOST` | Points at a pooler for the sandbox project, not the approved ref. |
| Approved ref via Supavisor pooler (6 regions, port 6543, user `postgres.kvrkraqjuyxbraccxntk`) | `FATAL: (ENOTFOUND) tenant/user postgres.kvrkraqjuyxbraccxntk not found` (the supplied password does not belong to that tenant). |
| Approved ref direct host `db.kvrkraqjuyxbraccxntk.supabase.co:5432` | `could not translate host name … No address associated with hostname` (not resolvable here; Supabase direct connections are IPv6). |
| `SUPABASE_SERVICE_ROLE_KEY` | Absent from the environment. |

No privileged credential is available, and none was requested to be committed to the
repository or printed to logs. Raw-PostgreSQL access to production therefore requires the
owner to supply the project DB password (or an approved service-role path).

## 4. Production row-count verification (read-only, public credentials)

All 67 temple tables were probed. The result splits into three groups. **A zero from a
deny-all table is not evidence of emptiness**: under RLS, PostgREST returns `200` with `[]`
when the role holds `SELECT` but a `Deny all … USING (false)` policy filters every row, and
`401` when the role holds no table-level `SELECT` at all. In both cases a non-zero table
would still look "empty".

### 4a. Authoritative — publicly readable (a repo-defined `SELECT` policy exists)

| Table | Rows | Notes |
|-------|------|-------|
| `events` | **74** | all `published = true`; public policy applied |
| `site_settings` | **2** | the duplicate pair — §5 |
| `aaradhanes` | **2** | published Aaradhane records |
| `social_links` | **1** | `firestore_id = 'socialLinks'` |
| `announcements` | 0 | public read policy present |
| `temple_areas` | 0 | public read policy present |
| `featured_content` | 0 | public read policy present |
| `ai_knowledge` | 0 | `approved = true` read policy present |

These are the only tables whose counts are independently confirmable through the public key.

### 4b. RLS-hidden — returns `200`/`0`, but the zero is **not** proof of emptiness

Per the repo migrations these tables are deny-all (service-role only), so RLS silently
filters their rows for the public key: `daily_poojas`, `donation_campaigns`,
`gallery_albums`, `gallery_media`, `testimonials`, `members`, `volunteers`, `quotes`,
`settings_documents`, `donations`, `sevas`, `ai_settings`, `chat_sessions`, `chat_messages`,
`chat_training`, `ai_chat_feedback`, `ai_intent_distribution`, `ai_latency_records`,
`ai_testimonials`, `ai_volunteer_requests`, `bills`, `intent_feedback`, `page_views`,
`daily_page_stats`, `intent_metrics`, `chat_metrics`, and the `knowledge_*` tables.
Their true counts are **UNKNOWN** from here.

### 4c. Denied — returns `401` (no public `SELECT` grant)

`audit_log`, `staff`, `counters`, `counter_devices`, `cash_denominations`,
`festival_days`, `festival_day_dates`, `group_counters`, `ops_backup_runs`,
`receipt_series`, `receipt_series_years`, `receipt_number_gaps`, `seva_settings`,
`seva_orders`, `seva_receipts`, `seva_receipt_lines`, `seva_rate_history`,
`seva_list_items`, `day_closes`, `day_close_counts`, `devotee_profiles`. Counts are
**UNKNOWN**.

### 4d. Policy drift between production and the repository

The repository's `supabase/migrations/20261105000000_events_public_select_policy.sql`
records the events policy as **"prepared, NOT applied"**, yet the public key reads 74
published events — the policy **is** applied in production. Likewise
`20261111000000_aaradhanes_public_select_policy.sql` is applied (2 rows readable). The
production policy state has therefore advanced past what the repo comment claims. This is
documentation drift only; it is called out because it means the repository cannot be used
as an exact oracle for production policy state. The repository's stated *intent* (public
read of published events / aaradhanes only) matches what was observed.

## 5. `site_settings` verification

Two rows exist, both sharing one `updated_at`:

| | Row A — identity | Row B — stray document |
|---|---|---|
| `id` | `add2d074-511a-4387-943f-431f14116e3d` | `cbd57e5c-aa45-4a4e-835d-6a9a3c6e4629` |
| `firestore_id` | `qF0uWKDRK4bcy5pLdTGL` | `trustCommittee` |
| `temple_name` | `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಗಳ ಮಠ` | `Sri Raghavendra Swamy Temple` |
| `contact_email` | owner address | `info@example.com` |
| `contact_phone` | owner number | `+91 80 2332 3456` |
| `updated_at` | `2026-09-29T05:48:21.34295+00:00` | `2026-09-29T05:48:21.34295+00:00` |

Row B is the `settings/trustCommittee` document mis-mapped into `site_settings` during the
original migration; the real Trust Committee content lives in `settings_documents`
(`document_key = 'trustCommittee'`).

### Consumers

| Consumer | Reads | Impact of removing/modifying a row |
|----------|-------|-----------------------------------|
| `services/settings.service.ts` `getSettings()` | `site_settings` via `order(updated_at desc).order(id asc).limit(1).single()` | Site identity (name/contact/footer). Already deterministic (`id` tiebreaker). |
| `services/proof-report/database-export.service.ts` `readSiteSettings()` | `site_settings` via `.limit(1).maybeSingle()` | Developer proof-report only. **Was non-deterministic; fixed in this review** (§7). |
| `app/actions/settings.ts` (admin create/update) | `site_settings` by `id` | Admin edits the identity row; unaffected by the duplicate. |
| `app/(public)/trust/page.tsx`, `app/admin/settings/trust-committee/page.tsx`, `hooks/useSettingsDocument.ts`, `app/api/public/settings/[key]/route.ts`, `app/api/admin/settings/[key]/route.ts` | `settings_documents` key `trustCommittee` — **not** `site_settings` | Do **not** read the `site_settings` row at all. |

**Conclusion.** Nothing in the application reads the `trustCommittee` row of
`site_settings`; the real Trust Committee content is served from `settings_documents`. So
Row B is inert: removing it would break nothing, and leaving it also breaks nothing once
both readers tie-break deterministically. **Neither row was deleted or modified.** Choosing
the canonical row remains the owner's decision.

### Deterministic selection

Both readers now order `updated_at` descending **then `id` ascending**, so the identity row
(`add2d074…`) is selected deterministically. `tests/unit/settings-service-read.test.ts` and
`tests/unit/proof-report-site-settings-order.test.ts` pin the ordering so it cannot
silently regress.

## 6. Supabase key compatibility fix (`30f09bf`)

| Check | Result |
|-------|--------|
| Both env names work | `resolveSupabasePublicKey()` accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `validateSupabasePublicConfig` and `getSupabaseConfigStatus` use it. |
| Legacy-key precedence consistent client/server | `lib/supabase/client.ts` and `lib/supabase/server.ts` both use `ANON || PUBLISHABLE` (legacy first), matching the helper. |
| No service-role credential exposed | The service-role key is read only in `lib/supabase/admin.ts` (guarded by `import 'server-only'`), `app/api/supabase-check/route.ts` (a boolean `!!…` presence flag, never the value) and the developer `database-export.service.ts`. No `NEXT_PUBLIC_` service-role variable exists. |
| Diagnostics do not print credentials | `scripts/diagnose-supabase-connectivity.ts` prints presence and **length only** (`present (len N)`); it never prints a key value. |
| Playwright isolation preserved | `tests/e2e/seva/playwright.config.ts` pins `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `webServer.env`, so a real key in `.env.local` cannot reach the browser test run. `tests/unit/seva/e2e-isolation.test.ts` enforces this. |
| Authentication unchanged | The change only selects which public key string the client uses; token verification, login, sessions and admin authorization are untouched. |

`tests/unit/supabase-public-config.test.ts` covers the fallback; `tsc`, eslint (0 errors)
and the full suites pass (§7).

## 7. Code review of the new routes, hook and services

- **`/api/public/stats` and `/api/admin/dashboard-stats`** — reviewed for the objective's
  security requirements: public endpoints return only deliberately public aggregate
  information; admin endpoints enforce the existing Firebase-token verification and
  administrator-role checks. (See the PR body for the per-route authorization notes.)
- **`useSettingsDocument` hook** — reviewed for loading-state regressions (it keeps caller
  defaults until the document arrives, so first paint is never blank), silently swallowed
  errors (it surfaces a failed load through `loading` and logs the status), missing
  authorization headers (admin reads/writes send the Firebase ID token) and unintended
  overwrites (`settings_documents` writes go through the admin route, not a blind upsert).
- **Service-role client exposure** — `lib/supabase/admin.ts` begins with
  `import 'server-only'`, so a browser bundle that imports it fails the build; the service
  role key is never read from a `NEXT_PUBLIC_` variable.

### Defect found and fixed in this review (non-destructive)

`services/proof-report/database-export.service.ts` read `site_settings` with
`.select('*').limit(1).maybeSingle()` — **no ordering** — the same non-determinism already
fixed in `services/settings.service.ts`. On the production tie it could report the stray
`trustCommittee` row instead of the temple identity. Fixed to order
`updated_at desc, id asc` (the same rule), with a new regression test
`tests/unit/proof-report-site-settings-order.test.ts`. No data was read, written or
changed by this fix.

## 8. Verified vs unverified

**Verified (read-only, public credentials):**

- Production is reachable read-only; RLS gates every table.
- Publicly visible content: `events` 74 (all published), `site_settings` 2, `aaradhanes` 2,
  `social_links` 1; `announcements`, `temple_areas`, `featured_content`, `ai_knowledge` 0.
- The two `site_settings` rows, their `firestore_id`s, and the exact tie on `updated_at`.
- Both `site_settings` readers are now deterministic; a regression test pins each.
- The key-compatibility fix `30f09bf` behaves as intended; no credential is printed or
  bundled.
- `npx tsc --noEmit` clean; eslint 0 errors; **unit 207 suites / 2668 tests pass**;
  **`test:db` (PGlite) 17 suites / 244 tests pass**; `next build` succeeds.

**Unverified (blocked — no privileged read-only access):**

- True row counts for every deny-all table (38 RLS-hidden + 21 denied) — includes
  `daily_poojas`, `quotes`, `gallery_albums`, `gallery_media`, `settings_documents`,
  `donation_campaigns`, `testimonials`, `members`, `volunteers`, `donations`, `sevas`, the
  `seva_*` tables, `users`, `profiles` and the `ai_*` / `knowledge_*` tables.
- Whether the production schema exactly matches the repository migrations (no
  `information_schema` access to production).
- The finalized seed-safety plan's "expected inserted rows" for the RLS-hidden tables
  (they depend on the true counts above).

## 9. Recommendation

**Production verification blocked by missing privileged read-only access.**

The public-visibility verification, the `site_settings` review, the key-fix review and the
code review are complete, and the one in-scope defect found (proof-report
`site_settings` non-determinism) is fixed with a regression test. The authoritative
table-by-table row-count verification the objective asked for — and therefore the finalized
seed plan's exact "expected inserted rows" — cannot be established here. To unblock, the
owner must supply **either** the approved project's DB password for a read-only
(`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`) connection, **or** an approved
service-role read-only path. No credential should be committed to the repository or printed
to logs.

No production write, schema change, migration, DDL, settings change, authentication change
or deployment was performed. PR #365 remains open and draft.
