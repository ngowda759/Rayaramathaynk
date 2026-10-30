# Proposed Fresh Data Seed Plan — Rayaramathaynk

A proposed, **not executed** plan for filling the missing production data identified in
`PRODUCTION_SUPABASE_READINESS.md`. **Nothing in this document has been run against
production.**

- Production Supabase project: `kvrkraqjuyxbraccxntk`
- Seed entry point: `npm run seed:fresh` → `scripts/seed-fresh-supabase.ts`
- Plan source: `lib/supabase/seed-data/{plan,runner,content,quotes,settings-documents}.ts`
- Audit date: 2026-10-30

---

## 1. The blocking fact: there is no supported production seed path

`scripts/seed-fresh-supabase.ts` **cannot write to production by design**:

- `checkGuards` (`scripts/seed-fresh-supabase.ts:63-101`) refuses when
  `NODE_ENV=production`, `VERCEL` or `CI` is set.
- `--project-ref` refuses the approved project explicitly
  (`:78` — *"Refusing to seed: --project-ref is the approved production project … This command
  has no supported production seed path."*), and `--yes-this-is-a-test-project` is required.
- `--local` requires an explicit `DATABASE_URL` and refuses any URL that resolves to the
  approved project (`:88-97`), including via the Supavisor username
  (`scripts/lib/approved-project.mjs` `analyzeDbUrlRef`).
- `APPROVED_PROJECT_REF = "kvrkraqjuyxbraccxntk"` (`scripts/lib/approved-project.mjs:16`) is
  the production ref, so the guard and the target are the same value by construction.

**Consequence**: filling production data is **not** a matter of "just run the seed". It needs a
deliberate, separately-reviewed mechanism (see §4). This is a **safety feature**, not a defect —
it prevents an accidental production overwrite.

### 1.1 A second, unintended seeding path has been removed

Separately from `scripts/seed-fresh-supabase.ts`, the quote service used to seed itself. When
`QuoteService.getTodaysQuote` found no active quote it called `seedDefaultQuotes()`, inserting
the 33 `DEFAULT_QUOTES_DATA` rows, and it fired a `viewCount` UPDATE on every non-cached read
(`services/quote.server.ts`). Because `getTodaysQuote` is reached from the public homepage
render, **a page view or a build-time prerender could write to `quotes`**. That is a seeding
path with no explicit operation and no guard.

It has been removed in this PR. The only way to seed quotes is now the explicit, admin-guarded
`POST /api/admin/quotes/seed` (or the `quotes` section of the fresh seed). This makes the
"populate `quotes`" step below a genuinely controlled operation, as intended.

That operation is also safe to repeat: `seedDefaultQuotes` returns early when any active quote
exists, and `createQuote` inserts on the unique `slug`, so a re-run cannot duplicate a quote
(it fails on the constraint instead). The removal therefore does not change repeatability — it
removes a write that had no guard at all.

---

## 2. What the seed would insert (dry-run, verified locally)

`DATABASE_URL=<sandbox> npm run seed:fresh:dry-run` prints:

```
18 tables, 69 rows to upsert (conflict-safe).
  site_settings        1 rows on firestore_id   (only if the table is empty)
  social_links         1 rows on firestore_id   (only if the table is empty)
  announcements        1 rows on firestore_id   (only if the table is empty)
  daily_poojas        13 rows on firestore_id   (only if the table is empty)
  donation_campaigns   1 rows on firestore_id   (only if the table is empty)
  gallery_albums       1 rows on firestore_id   (only if the table is empty)
  gallery_media        7 rows on firestore_id   (only if the table is empty) (only if gallery_albums is seeded this run)
  temple_areas         2 rows on id             (only if the table is empty)
  testimonials         0 rows on id             (only if the table is empty)
  members              0 rows on id             (only if the table is empty)
  volunteers           0 rows on id             (only if the table is empty)
  quotes              33 rows on slug           (only if the table is empty)
  settings_documents   9 rows on document_key
  page_views / daily_page_stats / intent_metrics / intent_feedback / chat_metrics  (table only)
Dry run complete. Nothing was written.
```

### 2.1 What this would fix in production

| Missing data (from readiness §7) | Seed row(s) | Effect |
|---|---|---|
| `daily_poojas` empty | 13 rows | `/pooja` gains the schedule |
| `announcements` empty | 1 row | site banner appears |
| `temple_areas` empty | 2 rows | `/api/temple-areas` returns data |
| `donation_campaigns` empty | 1 row | donation CTA gains a campaign |
| `settings_documents` 4 of 9 keys missing | 9 keys (adds `trustCommittee`, `festivalCalendar`, `ekadashiCalendar`, `homepage`) | `/trust`, both calendars and the homepage gain content |
| `quotes` thin (6) | 33 rows — **skipped**, table is not empty | no change (see §3.2) |
| `sevas` empty | **not in plan** | `/seva` stays empty (owner-owned) |
| `featured_content` empty | **not in plan** | homepage carousel stays empty |

### 2.2 What this would **not** fix

`sevas`, `featured_content`, `members`, `volunteers`, `testimonials` are either absent from the
plan or seed 0 rows. The plan needs new entries if the owner wants starter content there.

---

## 3. Safety properties (verified in code + tests)

### 3.1 Overwrite protection

- `seedWhen:"empty"` (the default for every content table): the runner checks
  `port.tableHasRows(table)` and **skips the table entirely** when it holds any row
  (`lib/supabase/seed-data/runner.ts:95`). Existing production rows are never touched.
- `seedWhen:"always"` applies **only** to `settings_documents` and uses
  `ON CONFLICT (document_key) DO NOTHING` — it adds missing keys and never rewrites an existing
  document (`runner.ts:9-11`; `tests/db/fresh-seed.test.ts:247`).
- `insertOnly` tables (`page_views`, `daily_page_stats`, `intent_metrics`, `intent_feedback`,
  `chat_metrics`) are **never seeded** (`runner.ts:84`) — the plan lists them only to assert the
  tables exist, so no analytics are fabricated.

### 3.2 Idempotency / repeatability — **yes**

Running the plan twice produces no second change: content tables are non-empty after run 1 and
skipped in run 2; `settings_documents` keys are present after run 1 and skipped in run 2;
`quotes` conflicts on the `slug` unique key. `tests/db/fresh-seed.test.ts:135` asserts
"seeds the starter rows on the first run and nothing on the second".

### 3.3 Parent–child dependency

`gallery_media.dependsOn = "gallery_albums"` (`lib/supabase/seed-data/plan.ts`). The child runs
only when the parent was seeded **in the same run** (`runner.ts:88`), so media never reference
albums that were not inserted. If the parent-existence check fails, the runner **aborts the whole
run** (fail-safe; `tests/db/fresh-seed.test.ts:364`). No other dependency exists, and no content
table has a database FK, so ordering risk is limited to gallery.

### 3.4 Duplicate protection

Conflict targets: `settings_documents.document_key`, `quotes.slug`, and `firestore_id` on every
content table (all `UNIQUE`). The runner asserts the conflict target exists before inserting, so
a missing unique index fails loudly instead of duplicating rows.

### 3.5 Non-fabrication

`tests/db/fresh-seed.test.ts:188` asserts unverified owner facts remain placeholders and are
never fabricated. Any content that the temple must supply (phone numbers, timings, trustee
names) should be reviewed by the owner before publishing.

---

## 4. Proposed execution options (for owner approval — none executed)

Because no production seed path exists, choose one of:

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **A. Admin UI (recommended)** | Owner enters the missing content through the existing admin screens (site settings, daily pooja, announcements, temple areas, settings documents). | Uses audited, guarded routes; no new write path; owner controls wording. | Manual; slow for 33 quotes / 13 poojas. |
| **B. Reviewed one-off script** | Add a `--project-ref <ref>` **production** branch behind an explicit `--i-understand-this-writes-production` flag plus the existing project-ref guard, run once from a reviewed PR. | Reproducible; reuses the tested runner. | Adds a production write path to a tool that deliberately has none — highest risk, needs security review. |
| **C. SQL export + manual apply** | Generate `INSERT … ON CONFLICT DO NOTHING` statements from the seed data and have the owner apply them in the Supabase SQL editor. | No new code path; owner sees every statement. | Manual; drifts from the seed data. |

**Recommendation: Option A for owner-authored content** (`trustCommittee`, `homepage`,
`festivalCalendar`, `ekadashiCalendar`, `sevas`), and **Option C for bulk mechanical data**
(`quotes` ×33, `daily_poojas` ×13) where the values are already curated in the repository.

### 4.1 Preconditions before any production write

1. Owner approval recorded (which tables, which rows).
2. A read-only backup/snapshot of the affected tables.
3. Confirm the target project ref is `kvrkraqjuyxbraccxntk` **by value**, not by env inference
   (readiness F-A9).
4. Run the dry-run against the intended target first and attach the output to the approval.

### 4.2 Post-write verification (read-only)

- `GET /api/public/settings/trustCommittee`, `/festivalCalendar`, `/ekadashiCalendar` →
  `data != null`.
- `GET /api/announcements` → non-empty.
- `GET /api/temple-areas` → 2 rows.
- `GET /api/public/stats` → unchanged user/event counts (no collateral change).
- Re-run the seed dry-run: it should report the now-populated tables as skipped.

---

## 5. Per-item plan

| # | Item | Table / key | Rows | Mode | Option | Owner input needed |
|---|---|---|---:|---|---|---|
| 1 | Daily pooja schedule | `daily_poojas` | 13 | empty-only | C | Verify timings |
| 2 | Announcement | `announcements` | 1 | empty-only | A | Author text |
| 3 | Trust Committee | `settings_documents('trustCommittee')` | 1 | always (adds) | A | **Trustee names/roles** |
| 4 | Festival calendar | `settings_documents('festivalCalendar')` | 1 | always (adds) | A | Confirm festival dates |
| 5 | Ekadashi calendar | `settings_documents('ekadashiCalendar')` | 1 | always (adds) | A | Confirm |
| 6 | Homepage config | `settings_documents('homepage')` | 1 | always (adds) | A | Hero copy/images |
| 7 | Temple areas | `temple_areas` | 2 | empty-only | A | Confirm areas |
| 8 | Donation campaign | `donation_campaigns` | 1 | empty-only | A | Confirm campaign |
| 9 | Quotes | `quotes` | 33 | empty-only (**skipped while 6 rows exist**) | C | None (curated) |
| 10 | Seva catalogue | `sevas` | n/a | — | A | **Owner-owned** |
| 11 | Featured content | `featured_content` | n/a | — | A | **Owner-owned** |

> Item 9 note: because `quotes` already holds 6 rows, the `seedWhen:"empty"` rule **skips** the
> table. To reach 33, either the owner adds the rest through the admin UI, or a targeted
> `ON CONFLICT (slug) DO NOTHING` insert (Option C) adds only the 27 missing slugs.

---

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Accidental production write | Low | High | Existing guard refuses production; keep it. |
| Wrong database targeted | Medium | High | Verify the ref by value; use `analyzeDbUrlRef`. |
| Placeholder content published as fact | Medium | Medium | `tests/db/fresh-seed.test.ts:188`; owner review before publish. |
| `settings_documents` overwrite | Low | Low | `DO NOTHING` on `document_key`; verified by test. |
| Gallery orphans | Low | Low | `dependsOn` + fail-safe abort; verified by tests. |
| Parallel starter copy next to real rows | Low | Medium | `seedWhen:"empty"` skips any populated table. |

---

## 7. Explicit non-actions

This plan was produced without: running any migration, writing any row, changing any policy,
touching Firebase Auth, restoring a Firestore fallback, or printing any credential. It stops at
the proposal, as instructed.
