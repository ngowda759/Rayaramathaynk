# Supabase Data-Only Initialization Plan

The table-by-table plan for initializing the starter dataset in Supabase PostgreSQL, with
the read-only production counts observed on 2026-10-28, the RLS visibility limitation for
each table, and the exact proposed records.

This plan is **not executed here**. It documents what a separately approved production
initialization would do. See `docs/PRODUCTION_SUPABASE_READINESS.md` for the review verdict
and `docs/FRESH_SUPABASE_INITIALIZATION.md` for the procedure and its guards.

Source of truth for the plan: `lib/supabase/seed-data/plan.ts` (`SEED_PLAN`), applied by
`scripts/seed-fresh-supabase.ts`. A dry run prints the same list:

```bash
DATABASE_URL=<test-db-url> npx tsx scripts/seed-fresh-supabase.ts --local --dry-run
# 18 tables, 69 rows to upsert (conflict-safe)
```

## How to read this plan

- **Count (prod, read-only)** — rows observed with the public key. A `0` on a deny-all
  table is **not** proof of emptiness (RLS hides rows); such counts are marked
  **UNKNOWN**.
- **Seed mode** — `empty` seeds only when the table holds no rows; `always` upserts on a
  natural key. Every content table is `empty`.
- **Expected inserts** — computed against the observed production state. Where the true
  count is UNKNOWN the expectation is conditional.
- **Rollback identifiers** — the stable keys the starter rows carry, so a future cleanup
  can target them without touching owner rows. Content rows use a `seed-` prefixed
  `firestore_id` (or the stable `id`/`slug`); `settings_documents` rows use their
  `document_key`.

No value is fabricated: any owner fact not yet confirmed is stored as a `PLACEHOLDER - `
string. There are 9 placeholder values across the settings documents (§3).

## 1. Table-by-table plan

| # | Table | Count (prod, read-only) | RLS visibility limitation | Starter data appropriate? | Seed mode | Conflict key | Rows | Expected inserts | Rollback identifiers |
|---|-------|-------------------------|---------------------------|---------------------------|-----------|--------------|------|------------------|----------------------|
| 1 | `site_settings` | **2** | public read policy; count authoritative | **No** — already populated by the owner; leave untouched | empty | `firestore_id` | 1 | **0** (table not empty) | `firestore_id = 'seed-site-settings'` |
| 2 | `social_links` | **1** | public read policy; count authoritative | **No** — already populated; leave untouched | empty | `firestore_id` | 1 | **0** (table not empty) | `firestore_id = 'seed-social-links'` |
| 3 | `announcements` | 0 | public read policy; count authoritative | Yes | empty | `firestore_id` | 1 | **1** | `firestore_id = 'seed-announcement-welcome'` |
| 4 | `daily_poojas` | **UNKNOWN** (deny-all) | RLS-hidden: a non-zero table still reads `0` | Yes | empty | `firestore_id` | 13 | 13 if empty, else **0** | `firestore_id = 'seed-daily-pooja-*'` (13) |
| 5 | `donation_campaigns` | **UNKNOWN** (deny-all) | RLS-hidden | Yes | empty | `firestore_id` | 1 | 1 if empty, else **0** | `firestore_id = 'seed-donation-campaign-annadanam'` |
| 6 | `gallery_albums` | **UNKNOWN** (deny-all) | RLS-hidden | Yes | empty | `firestore_id` | 1 | 1 if empty, else **0** | `firestore_id = 'seed-gallery-album-temple'` |
| 7 | `gallery_media` | **UNKNOWN** (deny-all) | RLS-hidden | Yes, **only with #6** | empty, `dependsOn: gallery_albums` | `firestore_id` | 7 | 7 if #6 seeded, else **0** | `firestore_id = 'seed-gallery-media-*'` (7) |
| 8 | `temple_areas` | 0 | public read policy; count authoritative | Yes | empty | `id` | 2 | **2** | `id ∈ {garbhagriha, navagraha-shrine}` |
| 9 | `testimonials` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — owner facts only | empty | `id` | 0 | **0** | — (no seed rows) |
| 10 | `members` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — owner facts only | empty | `id` | 0 | **0** | — (no seed rows) |
| 11 | `volunteers` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — owner facts only | empty | `id` | 0 | **0** | — (no seed rows) |
| 12 | `quotes` | **UNKNOWN** (deny-all) | RLS-hidden | Yes (in-repo shloka text) | empty | `slug` | 33 | 33 if empty, else **0** | `slug = 'sri-raghavendra-stotra-verse-*'`, `…mangalashtakam…`, `guru-vandana-*`, `guru-stuti-*` (33) |
| 13 | `settings_documents` | **UNKNOWN** (deny-all) | RLS-hidden | Yes (missing keys only) | **always** | `document_key` | 9 | up to 9 (only missing keys) | `document_key ∈ {aboutUs, facilities, trustCommittee, futurePlans, poojaSchedule, festivalCalendar, ekadashiCalendar, footer, homepage}` |
| 14 | `page_views` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — analytics | table-only | — | 0 | **0** | — |
| 15 | `daily_page_stats` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — analytics | table-only | — | 0 | **0** | — |
| 16 | `intent_metrics` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — analytics | table-only | — | 0 | **0** | — |
| 17 | `intent_feedback` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — analytics | table-only | — | 0 | **0** | — |
| 18 | `chat_metrics` | **UNKNOWN** (deny-all) | RLS-hidden | **No** — analytics | table-only | — | 0 | **0** | — |

**Expected total inserts** = the two authoritatively-empty tables (`announcements` 1,
`temple_areas` 2 = **3 rows**), plus, for every UNKNOWN table that is in fact empty, its
row count (1–13 depending on the table), plus the missing `settings_documents` keys
(≤ 9). Because the true counts of the RLS-hidden tables cannot be established here, the
total is **conditional**, not a fixed number.

## 2. Parent–child dependency: gallery albums and media

`gallery_media.album_id` is a **loose reference** (`text` after
`20261002000000_align_content_firestore_ids.sql`) — there is no SQL foreign key. The
starter media rows carry `album_id = 'seed-gallery-album-temple'`, an identifier only this
plan inserts. The plan therefore declares `dependsOn: "gallery_albums"` on the media
operation, so it runs only when the album seed ran in the same pass:

- **Both empty** → album (1) + media (7) inserted; no orphaned media.
- **Album table already populated** (owner albums) → the album seed is skipped, so the
  media seed is **skipped too**; the owner's media is left untouched and no media points at
  a non-existent seed album.
- **Parent existence check fails** → the run aborts safely before inserting media.

`tests/db/fresh-seed.test.ts` proves all three cases against a throwaway Postgres.

## 3. Placeholders (no fabricated facts)

The settings documents are seeded with the owner's confirmed values where available and a
`PLACEHOLDER - ` string where not. Counts by document:

| Document | Fields | Placeholder values |
|----------|-------:|--------------------:|
| `aboutUs` | 31 | 1 |
| `facilities` | 12 | 2 |
| `trustCommittee` | 6 | 1 |
| `futurePlans` | 6 | 1 |
| `poojaSchedule` | 5 | 1 |
| `festivalCalendar` | 5 | 1 |
| `ekadashiCalendar` | 5 | 1 |
| `footer` | 4 | 0 |
| `homepage` | 29 | 1 |

No testimonials, prices, donation instructions, dates or committee names are invented.
After initialization the owner replaces each `PLACEHOLDER - ` value through the admin
console; `docs/FRESH_SUPABASE_INITIALIZATION.md` §"Step 3" gives the query to list them.

## 4. Repeatability, conflict behaviour and admin edits

- **Repeatable / conflict-safe.** Every content table is seeded only when empty; the
  `settings_documents` upsert uses `ON CONFLICT (document_key) DO NOTHING`. A second run
  inserts **+0** rows.
- **Administrator edits preserved.** Because no operation updates an existing row, an
  owner's edit to a seeded row survives every later run untouched. The plan never adds a
  parallel starter copy next to real data.
- **No legacy artifacts.** The plan imports no Firestore client and needs no Firebase
  credentials, Firestore export or network access.

## 5. Relationship and constraint validity

- **Conflict keys are real unique keys** — `firestore_id` (UNIQUE), `document_key`
  (UNIQUE), `slug` (UNIQUE), `id` (PRIMARY KEY). The db test asserts each required table
  exists after the migrations, so a missing table fails the run rather than silently
  skipping.
- **`album_id` typing** — `uuid` in the original DDL, widened to `text` by
  `20261002000000_align_content_firestore_ids.sql`; the seed's non-UUID album id is
  therefore valid once that migration is applied.
- **Access policies** — every seeded table is either publicly readable (a repo `SELECT`
  policy) or deny-all/service-role-only; the seed writes as the service role and adds no
  policy and weakens none.

## 6. What this plan does not do

- It does **not** run against production. There is no supported production seed path in
  `scripts/seed-fresh-supabase.ts`; it refuses the approved project and any non-test target.
- It does **not** delete or modify the two existing `site_settings` rows, or any owner row.
- It does **not** initialize analytics tables (`page_views`, `daily_page_stats`,
  `intent_metrics`, `intent_feedback`, `chat_metrics`) with rows.
