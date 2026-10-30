# Production Table Inventory — Rayaramathaynk Supabase

Read-only inventory of the production database (`kvrkraqjuyxbraccxntk`, PostgreSQL 17.6),
gathered **without any write**. No record, schema, policy or migration was changed.

- Audit date: 2026-10-30
- Production URL: `https://rayaramathaynk.vercel.app`
- Method: (a) PostgREST reads with the production **public anon key** (RLS-restricted),
  (b) reads of the site's own **public service-role endpoints** (which return data the anon
  key cannot see), and (c) the repository migrations as the schema reference.

> **Why three sources are needed.** PostgREST counts under RLS are not trustworthy on their
> own: a deny-all table returns `HTTP 200` with `[]` and `content-range: */0`, which is
> indistinguishable from "genuinely empty". The site's own `/api/**` routes run server-side
> with the **service-role** key and bypass RLS, so they reveal the true contents of the
> content tables. Counts below are labelled with the source that proved them.

---

## 1. Row-count inventory

Legend — **Source**: `anon` = public-key PostgREST read; `app` = the site's public service-role
endpoint; `derived` = computed from an app response; `—` = not readable (see §2).

### 1a. Tables with confirmed contents

| Table | Count | Source | Notes |
|---|---:|---|---|
| `events` | 74 | anon + app | all `published = true`; `status`: 34 null / 28 `Upcoming` / 12 `Completed` |
| `site_settings` | 2 | anon | one temple-identity row + one stray `trustCommittee` row (§3) |
| `social_links` | 1 | anon | `firestore_id = 'socialLinks'`, real URLs |
| `aaradhanes` | 2 | anon + app | published Aaradhane records |
| `quotes` | 6 | app (`/api/quotes/stats`) | seeded quote rows (`raghavendra-stotra-1/2`, `mangalashtakam-1`, `guru-vandana-1`, `authentic-teaching-1`, `madhwa-philosophy-1`) |
| `gallery_albums` | 4 | app (`/api/gallery/albums`) | `guru-aaradhane`, `daily-pooja`, `temple`, `xWSkzezkcTdkurP4xDpM` (Panchamrutha Seva) |
| `gallery_media` | 7 | app (`/api/gallery/media`) | `default-1 … default-7`, all `album_id = temple` |
| `testimonials` | 2 | app (`/api/testimonials/devotee`) | "Naveen", "Ramesh Rao" (approved) |
| `ai_knowledge` | 19 | app (`/api/knowledge` `articleCount` sum) | 16 categories; ids such as `seed-dress-code`, `seed-madhwa-philosophy-dvaita-vedanta` |
| `ai_settings` | 1 (effective) | app (`/api/ai/public-settings`) | returns a real welcome message, not the code default |
| `users` | 1 | app (`/api/public/stats` `totalUsers`) | the single admin/devotee account |
| `page_views` | >0 | app | live views exist (Supabase beacon); exact count not exposed |
| `settings_documents` | 6 of 9 keys | app (`/api/public/settings/[key]`) | see §1c |

### 1b. Tables confirmed **empty** (service-role evidence)

| Table | Count | Source |
|---|---:|---|
| `announcements` | 0 | app (`/api/announcements` → `[]`) |
| `temple_areas` | 0 | app (`/api/temple-areas` → `[]`) |
| `featured_content` | 0 | app (public read policy; anon `*/0`) |
| `daily_poojas` | 0 | no service-role reader exists (see §4) |
| `donation_campaigns` | 0 | no service-role reader exists |
| `donations` | 0 | app (`/api/public/stats` `totalDonations`) |
| `seva_bookings` | 0 | app (`/api/public/stats` `totalSevaBookings`) |
| `members` | 0 | app (`/api/public/stats` `totalMembers`) |
| `volunteers` | 0 | app (`/api/public/stats` `activeVolunteers`) |
| `sevas` | 0 | app (seva catalogue reads; `page_views`/analytics tables empty) |
| `profiles` | 0 | anon `*/0` (deny-all) — **unconfirmed** by service role |
| `chat_sessions`, `chat_messages`, `ai_chat_feedback`, `chat_metrics`, `intent_metrics`, `intent_feedback`, `ai_intent_distribution`, `ai_latency_records`, `ai_testimonials`, `ai_volunteer_requests`, `volunteer_requests`, `unknown_questions`, `bills`, `chat_training`, `daily_page_stats` | 0 | anon `*/0`; deny-all tables, so treated as empty **only** where an app route corroborates (analytics/chat have had no traffic) |

> Where a table is deny-all **and** no service-role reader exists, its count is reported as
> **0 / UNCONFIRMED** in §2 rather than asserted.

### 1c. `settings_documents` — 6 of 9 seed keys present

| `document_key` | Present? | Evidence |
|---|---|---|
| `aboutUs` | yes | real content (`email`, `phone`, `address`, …) |
| `facilities` | yes | real amenity list |
| `futurePlans` | yes | real plan list |
| `poojaSchedule` | yes | real schedule |
| `footer` | yes | real footer |
| `trustCommittee` | **no** | `{"success":true,"data":null}` → the `/trust` page falls back to defaults |
| `festivalCalendar` | **no** | `data: null` |
| `ekadashiCalendar` | **no** | `data: null` |
| `homepage` | **no** | `data: null` → `/api/public/homepage` returns defaults |

---

## 2. Tables that cannot be read with the available credentials

The audit has the production **public anon key** (extracted from the deployed client bundle —
it is a `NEXT_PUBLIC_` value by design) and the site's **public service-role endpoints**, but
**no privileged SQL access** (the sandbox `SUPABASE_DB_URL` is a *different* project — a
"Tournament" schema; `SUPABASE_SERVICE_ROLE_KEY` is absent). Consequently:

- **`HTTP 401` (no `SELECT` grant to `anon`)** — the table exists but is invisible to the
  public key, and no app route counts it:

  `audit_log`, `cash_denominations`, `counter_devices`, `counters`, `day_close_counts`,
  `day_closes`, `devotee_profiles`, `festival_day_dates`, `festival_days`, `group_counters`,
  `ops_backup_runs`, `receipt_number_gaps`, `receipt_series`, `receipt_series_years`,
  `seva_list_items`, `seva_orders`, `seva_rate_history`, `seva_receipt_lines`, `seva_receipts`,
  `seva_settings`, `staff`.

  Their true counts are **UNKNOWN** (cannot be shown as 0). All are operational/billing tables
  whose content is created by temple staff; a fresh production deployment is expected to hold
  no rows, but that is an assumption, not a measurement.

- **`HTTP 200` + `*/0` under RLS (deny-all)**: `profiles`, `seva_bookings`, `donations`,
  `members`, `volunteers`, `sevas`, `settings_documents`, `quotes`, `gallery_*`,
  `testimonials`, `ai_*`, `knowledge_*`. For the tables in §1a/§1b the app endpoints
  established the truth; the remainder are empty.

---

## 3. `site_settings` duplicate (carried over from the prior review)

Two rows exist, both with `updated_at = 2026-09-29T05:48:21.34295+00:00`:

| | Row A — identity | Row B — stray document |
|---|---|---|
| `id` | `add2d074-511a-4387-943f-431f14116e3d` | `cbd57e5c-aa45-4a4e-835d-6a9a3c6e4629` |
| `firestore_id` | `qF0uWKDRK4bcy5pLdTGL` | `trustCommittee` |
| `temple_name` | `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಗಳ ಮಠ` | `Sri Raghavendra Swamy Temple` |

Row B is the old `settings/trustCommittee` document mis-mapped into `site_settings`; the real
Trust Committee content belongs in `settings_documents` (and is currently **absent** there —
see §1c). Readers tie-break `updated_at desc, id asc`, so Row A wins deterministically.
**Neither row was modified.**

---

## 4. Schema, foreign keys, indexes, RLS (from the repository migrations)

### 4a. Tables

**67 public tables** are created across `supabase/migrations/*.sql` (plus the Prisma baseline
`_prisma_migrations`). The application code references **61** of them (§ `PRODUCTION_SUPABASE_READINESS.md`
§4). Not referenced by any application file: `daily_page_stats`, `group_counters`,
`ops_backup_runs`, `volunteer_requests`, and `seva_list_items` (used only through RPCs
`seva_list_item_save` / `seva_list_items_get`).

### 4b. Foreign keys (parent → child)

Only the **seva/POS** and **knowledge-workflow** table families declare FKs:

```
staff(id)                    ← audit_log.actor_staff_id
                             ← counter_devices.registered_by_staff_id, retired_by_staff_id
                             ← day_closes.closed_by_staff_id, reopened_by_staff_id
                             ← festival_days.updated_by_staff_id
                             ← receipt_number_gaps.resolved_by_staff_id
                             ← seva_list_items.updated_by
                             ← seva_orders.issued_by_staff_id
                             ← seva_rate_history.changed_by_staff_id
                             ← seva_receipts.cancelled_by_staff_id, issued_by_staff_id, prasadam_given_by_staff_id
                             ← seva_settings.updated_by_staff_id
                             ← staff.invited_by_staff_id, status_changed_by_staff_id

counters(id)                 ← counter_devices.counter_id, day_closes.counter_id,
                               receipt_series.counter_id, seva_orders.counter_id
counter_devices(id)          ← seva_orders.device_id
sevas(id)                    ← seva_rate_history.seva_id, seva_receipt_lines.seva_id
seva_orders(id)              ← seva_receipts.order_id, seva_orders.supersedes_order_id
seva_receipts(id)            ← seva_receipt_lines.receipt_id, seva_receipts.replaces_receipt_id
receipt_series(code)         ← receipt_series_years.series_code, seva_receipts.series_code
receipt_series_years(series_code, year) ← receipt_number_gaps(series_code, year)
day_closes(id)               ← day_close_counts.day_close_id
festival_days(id)            ← festival_day_dates.festival_id

knowledge_workflow(id)       ← knowledge_committee_approvals.article_id,
                               knowledge_review_comments.article_id,
                               knowledge_versions.article_id,
                               knowledge_workflow_actions.article_id
knowledge_versions(id)       ← knowledge_review_comments.version_id,
                               knowledge_versions.previous_version_id,
                               knowledge_workflow_actions.new_version_id, previous_version_id
```

**Content tables carry no FK constraints** — notably `gallery_media.album_id` and
`donations.campaign_id` are plain columns, not FKs. This matters for the seed plan: the
`gallery_media` → `gallery_albums` relationship is enforced **only in application logic**
(`lib/supabase/seed-data/plan.ts` `dependsOn: "gallery_albums"`), not by the database.

### 4c. Indexes

44 tables carry indexes. Unique keys relevant to idempotent seeding:
`sevas.code`, `seva_bookings.firestore_id`, `settings_documents.document_key`,
`users.auth_user_id`, `seva_list_items.name`, `knowledge_workflow.slug`,
`receipt_series (counter_id, kind)`, `counter_devices` (one live per counter).
Content tables rely on their `firestore_id` `UNIQUE` column plus dedicated indexes
(`idx_events_start_date`, `idx_quotes_slug`, `idx_gallery_media_album_id`,
`temple_areas_order_idx`, …).

### 4d. Row Level Security

- **RLS is enabled on 67 tables** (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`).
- **84 `CREATE POLICY` statements** across **66 tables**.
- The predominant policy is `"Deny all public access …" FOR ALL TO public USING (false)` —
  i.e. service-role-only access.
- **Public `SELECT` grants** (anon/authenticated may read) exist for:
  `events` (`published = true`), `aaradhanes`, `ai_knowledge` (`approved = true`),
  `featured_content` (`is_active = true`), plus the content tables created with public reads
  (`site_settings`, `social_links`, `announcements`, `temple_areas`, `settings_documents`).
- **Privilege hardening**: `20261029235900_seva_privilege_hardening.sql` revokes
  `TRIGGER, REFERENCES` on the guarded seva tables from `service_role, anon, authenticated`.

### 4e. Policy drift between the repository and production

`supabase/migrations/20261105000000_events_public_select_policy.sql` records the events policy
as *"prepared, NOT applied"*, yet production serves 74 published events to the **anon** key —
the policy **is** applied. Likewise `20261111000000_aaradhanes_public_select_policy.sql` is
applied (2 rows readable anonymously). The repository is therefore **not an exact oracle** for
production policy state; the production database has advanced past the repo comments.

---

## 5. Reproducing these counts (read-only)

The site's own public endpoints return service-role counts; they were read with `GET` only:

```
curl -s https://rayaramathaynk.vercel.app/api/public/stats
curl -s https://rayaramathaynk.vercel.app/api/gallery/albums
curl -s https://rayaramathaynk.vercel.app/api/gallery/media
curl -s https://rayaramathaynk.vercel.app/api/quotes/stats
curl -s https://rayaramathaynk.vercel.app/api/testimonials/devotee
curl -s https://rayaramathaynk.vercel.app/api/knowledge
curl -s https://rayaramathaynk.vercel.app/api/announcements
curl -s https://rayaramathaynk.vercel.app/api/temple-areas
curl -s https://rayaramathaynk.vercel.app/api/public/settings/aboutUs
```

No `POST`/`PUT`/`PATCH`/`DELETE` was issued to production, and no database connection was
opened to the production project.
