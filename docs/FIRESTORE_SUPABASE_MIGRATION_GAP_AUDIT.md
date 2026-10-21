# Firestore → Supabase Migration Gap Audit

**Type:** read-only audit. No migration, no schema change, no production write.
**Repository:** `ngowda759/Rayaramathaynk`
**Branch audited:** `main` @ `c56ef97ef86d2c8117d62455d117378c55d16d00` (merge of PR #351), which was the `main` head at 2026-10-21T10:58:10Z when revision 2 was written.
**Audit date:** 2026-10-21 (revision 2 — re-validated against `main` @ `c56ef97`; revision 1 was against `665e6ff`)
**Report scope note (added in the final review):** `main` has since moved to `53bad41` (11 commits ahead of `c56ef97`), so the audited revision — and the PR branch built on it — is now behind `main`. The PR branch is based on `665e6ff` and therefore does not itself contain PRs #351, #353, #354 or #355; because this PR only **adds** one documentation file and touches nothing else, merging it cannot revert those commits. The newer commits touch `lib/ai/ai-settings/{service,validation}.ts`, prompt-manager admin routes/tests, `raya_ai_master_prompt.txt`, and `public/data/panchanga/current.json`. None of them change the inventory, the mappers, the Supabase migrations, the workflows, the Firestore rules, or the `lib/ai/retrieval/*` files, so the migration findings below are unaffected. The test totals in §9 were, however, captured against `c56ef97` and have drifted on newer `main` (see §9).
**Report status:** evidence-based; every status is traceable to a file/line, a command, or an explicitly-stated absence of evidence.

---

## 1. Executive summary

### 1.1 What is confirmed

1. **The Firestore → Supabase data migration has not completed for any business collection.** No complete, recent Firestore source export exists in the repository. The directories the dump scripts write to — `data/firestore-dump/` and `data/firestore-export/` — **do not exist** in the working tree and are gitignored; `git ls-files data/` shows no `*.ndjson` collection dump. The only source-shaped artefacts are `data/exports/aaradhane-events-2026*.json`, `-2027*.json`, and `supabase-events-all.json`, which are generator output, not a Firestore dump.
2. **Because source completeness cannot be established, no collection can be marked `MIGRATED_VERIFIED`.** Per the task's own rule, a destination table existing is not evidence of migration. This audit therefore contains **zero** `MIGRATED_VERIFIED` rows.
3. **The destination database cannot be reconciled from this environment.** The sandbox `SUPABASE_DB_URL` resolves to an unrelated project (public schema tables: `teams`, `matches`, `players`, `tournaments`, …) — not the temple database. Temple destination counts are therefore `UNKNOWN`, not zero. See §4.1.
4. **Raya AI is not yet Supabase-only.** Five in-scope runtime dependencies on Firestore remain reachable, including one on the live `/api/chat` path. See §6.
5. **`events` has a live, scheduled, unattended Firestore writer.** `.github/workflows/aaradhane.yml` runs on cron `30 3 1 1 *` (every 1 January) and invokes `scripts/generate-aaradhane.ts` **without `--dry-run`**, reaching `updateFirestoreWithAdmin()` → `docRef.set()/update()` on the `events` collection. Migrating `events` rows is therefore not sufficient for cutover; the scheduled writer must also be disabled or re-pointed. See §5.3.
6. **Two security issues of a different kind than migration status were found** and are reported in §11 because they are material to any data-migration work: a service-account private key is committed to a **public** repository, and the committed rules let any authenticated user create `donations` documents.

### 1.2 Primary blockers

| # | Blocker | Consequence |
|---|---|---|
| B1 | No complete Firestore source export | Source counts, field fidelity, orphan checks, duplicate detection all `UNKNOWN`. Blocks every `MIGRATED_VERIFIED` claim. |
| B2 | Temple Supabase destination is not reachable from this environment | Destination counts `UNKNOWN`. Reconciliation matrix is static-schema-only. |
| B3 | Two different Supabase project references appear in the evidence (`kvrkraqjuyxbraccxntk` in the reconciliation report vs. a different 20-char ref in the current environment) | It is not established which project is the temple production target. Any count reconciliation must first resolve this. |
| B4 | `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` is a title-only stub (1 line) | No authoritative status document exists; multiple root-level reports contradict each other (§8.1). |
| B5 | Five in-scope Raya AI Firestore dependencies remain | Supabase-only target for Raya AI is unmet. |
| B6 | Committed service-account private key in a public repo | Credential exposure; must be rotated regardless of migration state. |
| B7 | `events` has a scheduled unattended Firestore writer (`aaradhane.yml`, cron `30 3 1 1 *`) | Cutting `events` over to Supabase requires disabling/re-pointing this workflow, not just migrating rows. |

### 1.3 Scope note

This is revision 2 of the audit. Revision 1 was prepared against `main` @ `665e6ff` and published as PR #352 (still open; not a draft). Revision 2 re-validates every finding against `main` @ `c56ef97`, corrects two claims that did not survive re-checking (the scheduled-workflow finding in §5.3 and the RLS policy census in §4.2), and adds §7.2 (batch sequence), §7.3 (verified commands), §9 (validation evidence) and §10 (completion checklist).

Per the audit instruction, **no fixes were implemented and no migration was run**. Nothing was written to Firestore, Supabase, migration history, or application behaviour. No Firestore data was deleted or modified. PR #352 is a documentation-only change; it was not merged.

---

## 2. Source of truth inventory — Firestore collections and document paths

Method: static analysis of `services/*.ts`, `lib/**`, `app/**`, `firestore.rules`, `firestore.indexes.json`, `lib/supabase/migration-inventory.ts`, and `scripts/**`. `firestore.rules` contains **38** `match /` blocks (305 lines). `firestore.indexes.json` defines **23** indexes across **15** collection groups: `ai_intent_distribution`, `ai_latency_records`, `ai_token_usage`, `announcements`, `chat_messages`, `chat_sessions`, `donations`, `events`, `gallery`, `knowledge`, `quotes`, `sevaBookings`, `sevas`, `testimonials`, `users`.

**Source document counts: `UNKNOWN` for every collection.** The missing evidence is a complete `npm run firestore:dump` output; see §1.1(1) and §8.2. Historical counts quoted in `FIREBASE_MIGRATION_PHASE1_AUDIT.md` (e.g. `page_views` ~47k, `messages` 101, `events` 36) are **not** independently reproducible here and are treated as unverified.

### 2.1 Collections with active application code

| Collection / path | Definitive reference | Usage | Rules | Index | Inventory classification | Destination |
|---|---|---|---|---|---|---|
| `aaradhane` | `services/aaradhane.service.ts:16` | R+W | `firestore.rules:147` | — | MIGRATE | `aaradhanes` |
| `aaradhanes` | `services/aaradhane.service.ts:17` | R+W | `firestore.rules:152` | — | MIGRATE | `aaradhanes` |
| `ai_intent_distribution` | `services/ai-analytics.service.ts:40` | R+W | `:240` | ✅ | MIGRATE | `ai_intent_distribution` |
| `ai_latency_records` | `services/ai-analytics.service.ts:39` | R+W | `:234` | ✅ | MIGRATE | `ai_latency_records` |
| `ai_settings` | `lib/ai/ai-settings/admin-repository.ts:31` | R+W | `:253` | — | REVIEW | *(none)* |
| `announcements` | `services/announcement.service.ts:18` | R+W | `:63` | ✅ | REVIEW | *(none)* |
| `bills` | `services/billing.service.ts:28` | R+W | `:169` | — | REVIEW | *(none)* |
| `bookmarks` | `services/profile.service.ts:31` | R+W | — | — | REVIEW | *(none)* |
| `chat_metrics` | `services/analytics.service.ts:11` | R+W | — | — | REVIEW | *(none)* |
| `chat_sessions` | `app/admin/page.tsx:119` | R | `:213` | ✅ | MIGRATE | `chat_sessions` |
| `chatTraining` | `app/admin/ai/training/page.tsx:125` | R+W | — | — | EXCLUDE_SYSTEM | *(none)* |
| `dailyPoojas` | `services/pooja.service.ts:16` | R+W | — | — | MIGRATE | `daily_poojas` |
| `daily_page_stats` | `services/pageviews.service.ts:10` | R+W | — | — | REVIEW | *(none)* |
| `donation_campaigns` | `services/donationCampaign.service.ts:21` | R+W | — | — | REVIEW | `donation_campaigns` |
| `donations` | `services/donation.service.ts:5` | R+W | `:141` | ✅ | REVIEW | `donations` |
| `events` | `lib/aaradhane/firestore.ts:28`, `app/api/public/stats/route.ts:38` | R+W | `:68` | ✅ | MIGRATE | `events` |
| `featuredContent` | `app/admin/featured/page.tsx:109` | R+W | — | — | REVIEW | *(none)* |
| `feedback` | `services/chat.service.ts:190` | R+W | `:271` | — | REVIEW | *(none)* |
| `futurePlans` | `app/admin/settings/future-plans/page.tsx:34` | R+W | `:182` | — | REVIEW | *(none)* |
| `gallery` | `app/admin/content/page.tsx:93`, `services/dashboard.service.ts:23` | R | `:73` | ✅ | REVIEW | *(none)* |
| `galleryAlbums` | `services/gallery.service.ts:5` | R+W | `:79` | — | MIGRATE | `gallery_albums` |
| `galleryMedia` | `services/gallery.service.ts:6` | R+W | `:84` | — | MIGRATE | `gallery_media` |
| `guruParampara` | `lib/aaradhane/firestore-source.ts:22`, `app/admin/settings/guru-parampara/page.tsx:31` | R | — | — | **absent from inventory** | *(none)* |
| `homepage/config` | `services/homepage.service.ts:11-12` | R+W | `:176` | — | REVIEW | `settings_documents` |
| `intent_feedback` | `services/analytics.service.ts:180` | R+W | — | — | REVIEW | *(none)* |
| `intent_metrics` | `services/analytics.service.ts:12` | R+W | — | — | REVIEW | *(none)* |
| `knowledge` | `app/api/admin/knowledge/route.ts:10` | R+W | `:284` | ✅ | MIGRATE | `ai_knowledge` |
| `knowledge_audit_log` | `services/knowledge-workflow.service.ts:52` | R+W | — | — | REVIEW | *(none)* |
| `knowledge_committee_approvals` | `services/knowledge-workflow.service.ts:51` | R+W | — | — | REVIEW | *(none)* |
| `knowledge_drafts` | `services/knowledge-workflow.service.ts:53` | R+W | — | — | REVIEW | *(none)* |
| `knowledge_review_comments` | `services/knowledge-workflow.service.ts:50` | R+W | — | — | REVIEW | *(none)* |
| `knowledge_versions` | `services/knowledge-workflow.service.ts:48` | R+W | — | — | REVIEW | *(none)* |
| `knowledge_workflow` | `services/knowledge-workflow.service.ts:47` | R+W | — | — | REVIEW | *(none)* |
| `knowledge_workflow_actions` | `services/knowledge-workflow.service.ts:49` | R+W | — | — | REVIEW | *(none)* |
| `members` | `services/volunteer.service.ts:5` | R+W | `:201` | — | REVIEW | *(none)* |
| `notifications` | `services/testimonial.service.ts:361,428` | R+W | — | — | REVIEW | *(none)* |
| `page_views` | `services/pageviews.service.ts:9` | R+W | `:220` | — | REVIEW | *(none)* |
| `poojas` | `app/admin/content/page.tsx:95` | R | — | — | REVIEW | *(none)* |
| `profiles` | `services/profile.service.ts:30` | R+W | — | — | REVIEW | `profiles` |
| `quotes` | `services/quote.service.ts:38` | R+W | `:300` | ✅ | REVIEW | *(none)* |
| `settings/<doc>` | `app/admin/settings/about/page.tsx:66-67` (+ `footer`, `trustCommittee`, `facilities`, `poojaSchedule`, `festivalCalendar`, `guruParampara`, `socialLinks`, `shlokas`, `ekadashiCalendar`, `futurePlans`, `config`, `device`@`lib/device/settings.ts:53`) | R+W | `:162` | — | REVIEW | `site_settings`, `social_links`, `settings_documents` |
| `sevaBookings` | `services/sevaBooking.service.ts:5` | R+W | `:135` | ✅ | MIGRATE | `seva_bookings` |
| `sevas` | `services/seva.service.ts:6` | R+W | `:98` | ✅ | MIGRATE | `sevas` |
| `temple_areas` | rules-only `:278`; Supabase service `services/temple-areas.supabase.service.ts:6` | — | ✅ | — | REVIEW | `temple_areas` |
| `test` | `app/admin/test/page.tsx:15` | W | — | — | **absent from inventory** | *(none)* |
| `testimonials` | `services/testimonial.service.ts:5` | R+W | `:194` | ✅ | MIGRATE | `testimonials` |
| `timings` | `services/dashboard.service.ts:25` | R | `:89` | — | REVIEW | *(none)* |
| `trustCommittee` | `app/admin/settings/trust-committee/page.tsx:33` | R+W | `:188` | — | REVIEW | *(none)* |
| `unknown_questions` | `services/analytics.service.ts:10`, `lib/ai/unknown-logger.ts:9` | R+W | `:246` | — | MIGRATE | `unknown_questions` |
| `users` | `services/user.service.ts:15` | R+W | `:50` | ✅ | EXCLUDE_AUTH | `users` |
| `volunteer_requests` | `app/admin/content/page.tsx:99` | R | — | — | MIGRATE | `volunteer_requests` |
| `volunteers` | `services/volunteer.service.ts:6` | R+W | `:207` | — | REVIEW | *(none)* |

### 2.2 Collections with no application-code reference

| Collection | Where it exists only | Note |
|---|---|---|
| `ai_token_usage` | `firestore.rules:228`, `firestore.indexes.json:248` | rules + index only; referenced only in comments in `services/ai-analytics.service.ts` |
| `knowledge_articles` | `firestore.rules:289` | rules only |
| `knowledge_categories` | `firestore.rules:294` | rules only |
| `messages` | `firestore.rules:263` | rules only; mapped to `chat_messages` (`migration-mappers.ts:447`) |
| `receiptSevas` | `firestore.rules:107` | rules only |
| `receipts` | `firestore.rules:124` | rules only |
| `system` | `firestore.rules:130` | EXCLUDE_SYSTEM |
| `panchanga` | `lib/supabase/migration-inventory.ts:57` | inventory only; served from local cache `data/panchanga/` |
| `trust` | `lib/supabase/migration-inventory.ts:62` | inventory only |
| `sessions` | `lib/supabase/migration-inventory.ts:11` | EXCLUDE_AUTH; constant declared-but-unused at `services/pageviews.service.ts:11` |
| `ai_unknown_questions` | `scripts/migrate-ai-analytics.ts:59`, `scripts/convert-firestore-export.ts:20`, `scripts/dump-firestore-live.ts:211` | script-only; **dead collection name** — the live collection is `unknown_questions` |
| `donationCampaigns` | `scripts/migrate-all-batched.ts:110`, `scripts/convert-firestore-export.ts:18`, `scripts/dump-firestore-live.ts:209`, `scripts/read-firestore-counts.ts:7` | script-only; likely duplicate of `donation_campaigns` |

### 2.3 Inventory integrity problems (all confirmed by reading the source)

- `MIGRATION_INVENTORY` (`lib/supabase/migration-inventory.ts`) has a **runtime length of 61** entries: **15 MIGRATE**, **2 EXCLUDE_SYSTEM**, **42 REVIEW**, and **2 EXCLUDE_AUTH** (`users`, `sessions`). `EXCLUDED_AUTH_COLLECTIONS = ["users", "sessions"]` is spread into the array at lines 14-19, so both auth collections **are** present and classified as `EXCLUDE_AUTH`; they are not omitted. (Verified by importing the module with `node --experimental-strip-types` and reading `MIGRATION_INVENTORY.length`: 61. Counting only the 59 literal `{ collection: … }` lines undercounts by the two spread-in entries, and grep cannot see the `EXCLUDE_AUTH` classification because it is applied programmatically in the `.map()`, not written as a literal.) `FIREBASE_MIGRATION_PHASE1_AUDIT.md` §10 states "Total collections identified: 64"; the array has 61 entries and the set union with §2.1/§2.2 is larger still.
- `REVIEW_COLLECTIONS_REPORT.md` claims "Total REVIEW collections checked: 44". The array has **42** REVIEW entries.
- `migration_report.md` claims "exactly **14** collections marked `MIGRATE`". The array has **15** (`knowledge` is the extra one and has no `destinationTable`).
- Collections used by live code but **absent from the inventory**: `guruParampara` (`lib/aaradhane/firestore-source.ts:22`) and `test` (`app/admin/test/page.tsx:15`).
- The inventory contains **duplicate aliases** that would double-migrate into one table: `aaradhane` + `aaradhanes` → `aaradhanes`; `donations` + `donationCampaigns` + `donation_campaigns` → `donations`/`donation_campaigns`.
- `migrate-content-to-supabase.ts` actively migrates `users` (EXCLUDE_AUTH), `profiles`, `donations`, `donation_campaigns` (all REVIEW) — directly contradicting the inventory's own classifications.

### 2.4 Storage / external references

Firebase Storage is used in `app/admin/media/page.tsx:36` (`ref`, `listAll`, `getDownloadURL`, `deleteObject`) and `services/profile.service.ts:18` (`uploadBytes`, `getDownloadURL`, `deleteObject`); `storage.rules` exists. Gallery media rows carry `image_path` / `video_url` (`gallery_media`) which are **references into Firebase Storage**, not data. **No Storage object migration exists anywhere in the repository.** Even a fully successful Firestore→Supabase row migration leaves these objects on Firebase Storage. This is an unmapped migration workstream, not a code bug.

---

## 3. Migration evidence validation — stale and contradictory documentation

| Artefact | Verified against code/schema | Verdict |
|---|---|---|
| `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` | 1 line, title only | **STUB — no content.** Any doc referencing it as the status source is wrong. |
| `MIGRATION_DATA_RECONCILIATION_REPORT.md` | Names Supabase project `kvrkraqjuyxbraccxntk`; current env ref differs | **STALE/UNVERIFIABLE TARGET.** Its count table (`sevas` 10, `aaradhanes` 0, all others 0) cannot be attributed to the current environment's project. |
| `FIREBASE_MIGRATION_PHASE1_AUDIT.md` | "Total collections identified: 64"; array has 61 (runtime length) | **CONTRADICTED.** Also lists `ai_token_usage` and `announcements` as ACTIVE with destinations that do not exist in any migration. |
| `FIREBASE_MIGRATION_PHASE1_AUDIT.md` §11 | Concludes the 10 `sevas` rows are seed data from `scripts/seed-supabase-sevas.ts` | **CONSISTENT** with `scripts/seed-supabase-sevas.ts` and `scripts/verify-supabase-sevas.ts` (`EXPECTED SOURCE COUNT: 10`). Treat `sevas` as seeded, not migrated. |
| `docs/FIRESTORE_MIGRATION.md` | Describes `migrate-*.ts` scripts, `--dry-run`, reconciliation, ledger verification | **ACCURATE for the ETL tooling.** Does **not** claim data has been migrated. |
| `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` §2.3 | Lists remaining Firestore AI files including `lib/ai/retrieval/settings.ts`, `aaradhane.ts`, `sevas.ts`, `events.ts` | **STALE.** Those four are now Supabase-only; `grep -rn firebase lib/ai/` returns only `lib/ai/retrieval/announcements.ts:4,5`. |
| `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` §2.3 | Lists `services/chat.service.ts`, `ai-analytics.service.ts`, `conversation.service.ts` as Firestore-based | **PARTIALLY STALE.** `conversation.service.ts` and `ai-analytics.service.ts` are now Supabase-only; `chat.service.ts` is **mixed** (see §6). |
| `MIGRATION_VERIFICATION_REPORT.md` | Lists 11 remote migrations applied | **UNVERIFIABLE here** (temple DB unreachable). Note the ledger/version drift it documents is real and still relevant. |
| `PHASE_2_BATCH_1_DRY_RUN_REPORT.md` | Status "PENDING EXECUTABLE WORKFLOW RUN", values "TBD" | **NO EVIDENCE.** Contains no results. |
| `FIRESTORE_COUNTS_EXECUTION_REPORT.md`, `FIRESTORE_EXPORT_REPORT.md`, `FIRESTORE_PRODUCTION_EXPORT_REPORT.md` | All BLOCKED on credentials | **NO EVIDENCE.** Consistent with §1.1(1). |
| `REPORT_UNKNOWN_QUESTIONS_BLOCKER.md` | Records 44 migrated, 1 validation failure (`1cMSdGgkHf1gtgkGxn3z`, missing `question`) | **PARTIAL EVIDENCE**, from a CI log not present in the repo. Unverifiable here. |
| `MIGRATION_INVESTIGATION_REPORT.md` | Remote migration `20260918143124` (`create_content_tables`) renamed locally to `20261001000000` | **CREDIBLE**, consistent with the local file set and the mirror-marker pattern. |
| `migration_report.md` | "exactly 14 MIGRATE" | **CONTRADICTED** (15). |
| `REVIEW_COLLECTIONS_REPORT.md` | "44 REVIEW collections checked" | **CONTRADICTED** (42). |
| `PRODUCTION_REVIEW_COLLECTIONS_INVENTORY.md` | All counts UNAVAILABLE | **CONSISTENT** with §1.1(1). |

---

## 4. Destination schema and reconciliation matrix

### 4.1 Destination reachability — the decisive fact

```
$ python3 (psycopg2) SELECT current_database(), current_user, version()
database: postgres | user: postgres | PostgreSQL 17.6
$ SELECT table_name FROM information_schema.tables WHERE table_schema='public'
['_prisma_migrations','courts','match_games','match_participants','matches',
 'players','realtime_events','system_metadata','team_members','teams',
 'tournament_categories','tournament_entries','tournament_stages','tournaments']
```

The sandbox `SUPABASE_DB_URL` points at a **Tournament** project (14 tables), not the temple database. Therefore:

- **No temple destination count was read.** Reporting zero for these tables would be a false claim.
- `sevas` 10 rows, `aaradhanes` 0 rows, etc. from `MIGRATION_DATA_RECONCILIATION_REPORT.md` **cannot be reproduced or attributed** to the current project.
- Every destination count below is `UNKNOWN`, with the reason stated.

### 4.2 Static destination schema (from `supabase/migrations/*.sql` + `prisma/`)

**45 tables** are declared, all with `ENABLE ROW LEVEL SECURITY`. There are **56 `CREATE POLICY` statements across 44 of the 45 tables**. The distribution is heavily weighted to deny-all:

- **48 policies are named `Deny all …`** (all of them `FOR ALL TO public USING (false)`).
- **3 policies are named `Deny …` but not `Deny all …`** — the three per-operation write/update/delete denials on `ai_knowledge` (`Deny public write/update/delete access to ai_knowledge`).
- **5 policies are permissive reads** (named `Allow …`, none starting with `Deny`). They cover exactly **4 tables**:

| Table | Permissive policy | Effect |
|---|---|---|
| `temple_areas` | `Allow public read access to temple_areas` (×2, from `20240523000000` and `20240915`) | `FOR SELECT USING (true)` — fully public read |
| `site_settings` | `Allow public read access to site_settings` | `FOR SELECT TO public USING (true)` — fully public read |
| `social_links` | `Allow public read access to social_links` | `FOR SELECT TO public USING (true)` — fully public read |
| `ai_knowledge` | `Allow public read access to approved articles` | `FOR SELECT TO public USING (approved = true)` — public read of approved rows only |

- **`seva_list_items` enables RLS with no policy at all** (deny-all by default). It is the one table of the 45 with zero `CREATE POLICY` statements.

So the earlier summary that "only 4 have non-deny-all policies" is correct in the sense of *tables with any permissive read policy*, but it understated the policy coverage: 44 tables carry at least one explicit policy, 48 of which are deliberate `Deny all` statements. The security-relevant observation is unchanged and narrow: **only 4 tables are readable at all through RLS, and 41 tables are effectively service-role-only.** That matches `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` §2.2 ("RLS beyond deny-all" is a listed gap) — still true.

Tables: `sevas`, `daily_poojas`, `events`, `seva_bookings`, `settings_documents`, `chat_sessions`, `chat_messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records`, `users`, `profiles`, `donation_campaigns`, `donations`, `gallery_albums`, `gallery_media`, `testimonials`, `aaradhanes`, `volunteer_requests`, `site_settings`, `social_links`, `ai_settings`, `ai_knowledge`, `temple_areas`, plus 21 `seva_*`/ops tables (`staff`, `counters`, `counter_devices`, `seva_settings`, `cash_denominations`, `festival_days`, `festival_day_dates`, `receipt_series`, `receipt_series_years`, `receipt_number_gaps`, `group_counters`, `seva_rate_history`, `audit_log`, `ops_backup_runs`, `seva_orders`, `seva_receipts`, `seva_receipt_lines`, `day_closes`, `day_close_counts`, `devotee_profiles`, `seva_list_items`).

Prisma mirrors exactly **9** tables (`prisma/schema.prisma`); it is a mirror, not the source of truth. The 21 `seva_*`/ops tables are **native operational tables with no Firestore source** and are not migration targets.

### 4.3 Reconciliation matrix

| Source collection | Destination | Source count | Dest count | Mapping coverage | Reconciliation | Status |
|---|---|---|---|---|---|---|
| `events` | `events` | UNKNOWN | UNKNOWN | `mapEvent` (`migration-mappers.ts:760`) + `CORE_FIELD_SPECS.events` | Not performed | `PENDING_BOTH` |
| `sevas` | `sevas` | UNKNOWN | UNKNOWN | `mapSeva` (`:685`) + `CORE_FIELD_SPECS.sevas` | Not performed; **10 rows are seed data** (`scripts/seed-supabase-sevas.ts`) | `PENDING_BOTH` |
| `dailyPoojas` | `daily_poojas` | UNKNOWN | UNKNOWN | `mapDailyPooja` (`:736`) | Not performed | `PENDING_BOTH` |
| `sevaBookings` | `seva_bookings` | UNKNOWN | UNKNOWN | `mapSevaBooking` (`:705`) — **no field spec** | Not performed | `PENDING_BOTH` |
| `testimonials` | `testimonials` | UNKNOWN | UNKNOWN | `mapTestimonial` (`:340`) | Not performed | `PENDING_BOTH` |
| `galleryAlbums` | `gallery_albums` | UNKNOWN | UNKNOWN | `mapGalleryAlbum` (`:302`) | Not performed | `PENDING_BOTH` |
| `galleryMedia` | `gallery_media` | UNKNOWN | UNKNOWN | `mapGalleryMedia` (`:319`) | Not performed | `PENDING_BOTH` |
| `aaradhane` / `aaradhanes` | `aaradhanes` | UNKNOWN | UNKNOWN | `mapAaradhane` (`:360`) | Available test JSON = 19 docs; dest = UNKNOWN. Not a production reconciliation. | `PENDING_BOTH` |
| `volunteer_requests` | `volunteer_requests` | UNKNOWN | UNKNOWN | `mapVolunteerRequest` (`:382`) | Not performed | `PENDING_BOTH` |
| `users` | `users` | UNKNOWN | UNKNOWN | `mapUser` (`:219`) | Auth-owned; excluded | `EXPLICITLY_EXCLUDED` (auth) |
| `profiles` | `profiles` | UNKNOWN | UNKNOWN | `mapProfile` (`:236`) | Not performed | `PENDING_BOTH` |
| `donations` | `donations` | UNKNOWN | UNKNOWN | `mapDonation` (`:280`) | Not performed | `PENDING_BOTH` |
| `donation_campaigns` / `donationCampaigns` | `donation_campaigns` | UNKNOWN | UNKNOWN | `mapDonationCampaign` (`:260`) | Not performed; duplicate source aliases | `REVIEW_MAPPING` |
| `chat_sessions` | `chat_sessions` | UNKNOWN | UNKNOWN | `mapChatSession` (`:533`) | Not performed | `PENDING_BOTH` |
| `messages` | `chat_messages` | UNKNOWN | UNKNOWN | `mapChatMessage` (`:549`) | Not performed | `PENDING_BOTH` |
| `unknown_questions` | `unknown_questions` | UNKNOWN | UNKNOWN | `mapUnknownQuestion` (`:562`) | 1 known validation failure (missing `question`) | `PENDING_BOTH` |
| `ai_intent_distribution` | `ai_intent_distribution` | UNKNOWN | UNKNOWN | `mapIntentDistribution` (`:596`) | Not performed | `PENDING_BOTH` |
| `ai_latency_records` | `ai_latency_records` | UNKNOWN | UNKNOWN | `mapLatencyRecord` (`:612`) | Not performed | `PENDING_BOTH` |
| `knowledge` | `ai_knowledge` | UNKNOWN | UNKNOWN | `mapAiKnowledge` (`:853`) | Not performed | `PENDING_BOTH` |
| `settings/*`, `homepage/config` | `site_settings`, `social_links`, `settings_documents` | UNKNOWN | UNKNOWN | `mapSettingsDocument` (`:837`) JSONB-lossless; `site_settings`/`social_links` built inline | Not performed | `REVIEW_MAPPING` |
| `ai_settings` | `ai_settings` | UNKNOWN | UNKNOWN | **No ETL mapper**; seeded by `scripts/seed-ai-settings-supabase.ts` | Not performed | `REVIEW_MAPPING` |
| `announcements` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `quotes` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `bills` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `members`, `volunteers` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `page_views`, `daily_page_stats` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `chat_metrics`, `intent_metrics`, `intent_feedback` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `bookmarks` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `gallery`, `poojas`, `timings`, `guruParampara`, `featuredContent`, `futurePlans`, `trustCommittee` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `knowledge_*` (workflow family, 7) | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `notifications`, `feedback`, `temple_areas`, `ai_token_usage`, `receipts`, `receiptSevas`, `knowledge_articles`, `knowledge_categories`, `test` | *(none)* | UNKNOWN | — | **No mapper** | — | `REVIEW_MAPPING` |
| `system`, `chatTraining` | *(none)* | UNKNOWN | — | excluded by policy | — | `EXPLICITLY_EXCLUDED` |
| `sessions` | *(none)* | UNKNOWN | — | constant declared, unused | — | `EXPLICITLY_EXCLUDED` |

### 4.4 Field-level, orphan and duplicate checks

**All not performed, for the same single reason: no source export.** This is not a code defect — `lib/supabase/migration-helpers.ts` already implements the checks (`reconcileCounts` at `:101-112` enforces `source = inserts + updates + excludedMalformed + validationFailures + writeFailures`; `auditFieldCoverage` at `:167-183` fails a run on any observed-but-undeclared source field). They simply have no input.

Two mapping gaps are visible statically and are worth pre-registering before any run:

1. **`sevaBookings` has no `FieldCoverageSpec`.** `mapSevaBooking` (`migration-mappers.ts:705`) is not listed in `CONTENT_FIELD_SPECS`/`AI_FIELD_SPECS`/`CORE_FIELD_SPECS`, so `migrateSupabaseCollection` receives `fieldSpec === undefined` and the unmapped-field audit is silently skipped for this collection.
2. **`sevas` columns added in `20261020000000_seva_core.sql` are never populated by `mapSeva`:** `code`, `name_kn`, `visibility`, `multi_date`, `allow_amount_change`, `any_amount`, `prasadam_given`, `prasadam_items`, `income_ledger`, `updated_by_staff_id`. Either these are intentionally counter-native (documented nowhere) or they are unmapped fields.

---

## 5. Remaining Firestore dependencies — file by file

### 5.1 Active reads/writes in application code (non-AI temple portal)

| File | Kind | Firestore surface | Classification |
|---|---|---|---|
| `services/aaradhane.service.ts` | R+W | `aaradhane`, `aaradhanes`, `events` | ACTIVE_READ, ACTIVE_WRITE |
| `services/announcement.service.ts` | R+W | `announcements` | ACTIVE_READ, ACTIVE_WRITE |
| `services/analytics.service.ts` | R+W | `unknown_questions`, `chat_metrics`, `intent_metrics`, `intent_feedback` | ACTIVE_READ, ACTIVE_WRITE |
| `services/auth.service.ts` | R+W | `firebase/auth` + `users` | AUTH_DEPENDENCY |
| `services/billing.service.ts` | R+W | `bills` | ACTIVE_READ, ACTIVE_WRITE |
| `services/chat.service.ts` | R+W | `testimonials`, `volunteer_requests`, `feedback` (lines 172-340) | ACTIVE_READ, ACTIVE_WRITE (mixed file) |
| `services/daily-spiritual.service.ts` | R | `announcements` | ACTIVE_READ |
| `services/dashboard.service.ts`, `dashboard.service.client.ts` | R | `announcements`, `donations`, `events`, `gallery`, `sevas`, `timings`, `users` | ACTIVE_READ |
| `services/donation.service.ts` | R+W | `donations` | ACTIVE_READ, ACTIVE_WRITE |
| `services/donationCampaign.service.ts` | R+W | `donation_campaigns` | ACTIVE_READ, ACTIVE_WRITE |
| `services/gallery.service.ts` | R+W | `galleryAlbums`, `galleryMedia` | ACTIVE_READ, ACTIVE_WRITE |
| `services/homepage.service.ts` | R+W | `homepage/config` | ACTIVE_READ, ACTIVE_WRITE |
| `services/knowledge-workflow.service.ts` | R+W | `knowledge_workflow`, `knowledge_versions`, `knowledge_workflow_actions`, `knowledge_review_comments`, `knowledge_committee_approvals`, `knowledge_audit_log`, `knowledge_drafts` | ACTIVE_READ, ACTIVE_WRITE |
| `services/pageviews.service.ts` | R+W | `page_views`, `daily_page_stats` | ACTIVE_READ, ACTIVE_WRITE |
| `services/pooja.service.ts` | R+W | `dailyPoojas` | ACTIVE_READ, ACTIVE_WRITE |
| `services/profile.service.ts` | R+W + Storage | `profiles`, `bookmarks`; `uploadBytes`/`getDownloadURL`/`deleteObject` | ACTIVE_READ, ACTIVE_WRITE, STORAGE |
| `services/quote.service.ts` | R+W | `quotes` | ACTIVE_READ, ACTIVE_WRITE |
| `services/seva.service.ts` | R+W + **fallback** | `sevas`; lines 44,77 `// Fallback to Firestore` | ACTIVE_READ, ACTIVE_WRITE, RUNTIME_FALLBACK |
| `services/sevaBooking.service.ts` | R+W | `sevaBookings` | ACTIVE_READ, ACTIVE_WRITE |
| `services/testimonial.service.ts` | R+W | `testimonials`, `notifications` | ACTIVE_READ, ACTIVE_WRITE |
| `services/user.service.ts` | R+W | `users` | ACTIVE_READ, ACTIVE_WRITE |
| `services/volunteer.service.ts` | R+W | `members`, `volunteers` | ACTIVE_READ, ACTIVE_WRITE |
| `services/proof-report/database-export.service.ts` | R | dynamic `firebase/app` + `firebase/firestore` | MIGRATION_UTILITY |
| `app/api/public/stats/route.ts` | R | `events` via `getCountFromServer` | ACTIVE_READ |
| `app/api/public/receipts/route.ts` | R | `@/lib/admin-firebase` | ACTIVE_READ |
| `app/api/admin/knowledge/route.ts`, `[id]/route.ts` | R+W | `knowledge` via `@/lib/firebase-admin-rest` | ACTIVE_READ, ACTIVE_WRITE |
| `app/admin/content/page.tsx`, `featured/page.tsx`, `media/page.tsx` (+ Storage), `page.tsx` | R(+W) | `gallery`, `poojas`, `volunteer_requests`, `featuredContent`, `chat_sessions`, gallery Storage | ACTIVE_READ, ACTIVE_WRITE |
| `app/admin/billing/*` (3 pages) | R | `bills` | ACTIVE_READ |
| `app/admin/settings/*` (12 pages) | R+W | `settings/<doc>`, `homepage/config`, `futurePlans`, `trustCommittee`, `guruParampara` | ACTIVE_READ, ACTIVE_WRITE |
| `app/(public)/about|trust|facilities|future-plans/page.tsx` | R | `settings/<doc>`, `trustCommittee`, `futurePlans` | ACTIVE_READ |
| `app/admin/test/page.tsx`, `test-firebase/page.tsx` | R/W | `test`; dev probe | DEAD_CODE / TEST_ONLY |
| `components/layout/Footer.tsx` | R | `settings/<doc>` | ACTIVE_READ |
| `components/admin/events/EventForm.tsx` | — | `Timestamp` type only | TYPE_ONLY |
| `hooks/useGallery.ts`, `useHomepage.ts` (`onSnapshot`), `useFinanceSettings.ts`, `useDonationNotifications.ts` | R | `gallery`, `homepage/config`, finance settings, donation notifications | ACTIVE_READ |
| `lib/aaradhane/firestore.ts`, `firestore-source.ts`, `firestore-admin.ts`, `generator.ts` | R+W | `events`, `guruParampara` | ACTIVE_READ, ACTIVE_WRITE |
| `lib/device/settings.ts` | R+W | `settings/device` | ACTIVE_READ, ACTIVE_WRITE |
| `lib/date.ts`, `lib/auth.ts`, `utils/event.ts`, `types/*.ts` | — | `Timestamp`/auth types | TYPE_ONLY / AUTH_DEPENDENCY |
| `lib/auth/admin.ts`, `admin-auth.ts`, `verify-id-token.ts`, `lib/admin-firebase.ts` | — | `firebase-admin/auth`, `firebase-admin/firestore` | AUTH_DEPENDENCY |
| `lib/seva/server/identity-firebase.ts` | R+W | `firebase-admin/auth`, `firebase-admin/firestore` (`FieldValue`) | AUTH_DEPENDENCY |
| `lib/seva/server/catalogue.ts`, `finance.ts` | R | `getAdminFirestore()` | ACTIVE_READ |
| `context/AuthContext.tsx` | — | `onAuthStateChanged` | AUTH_DEPENDENCY |
| `components/admin/layout/AdminAuthGuard.tsx`, `components/auth/ProtectedRoute.tsx` | — | `getFirebaseConfigStatus`, `useAuth` | AUTH_DEPENDENCY |
| `lib/firebase.ts` | — | initialises `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage` | AUTH_DEPENDENCY (shared entry point) |

### 5.2 Migration / export utilities (expected, not defects)

`scripts/dump-firestore-live.ts`, `dump-firestore-staged.ts`, `dump-firestore-configs.sh`, `convert-firestore-export.ts`, `read-firestore-counts.ts`, `export-events.ts`, `import-events.ts`, `generate-events-firestore.ts`, `generate-aaradhane.ts`, `fetch-checkpoint.ts`, `check-*.ts`, `diagnostic-sevaBookings.ts`, `seed-guru-to-firestore.ts`, `seed-ai-settings.ts`, `seed-poojas.{ts,js}`, `seed-sevas.{ts,js}`, `seed-quotes.ts`, `seed-future-plans.ts`, `seed-guru-parampara.ts`, `seed-testimonials.ts`, `seed-trust-committee.ts`, `update-finance-settings.{ts,js}`, `scripts/seva/*`, `scripts/lib/admin-credentials.ts`, and all `migrate-*.ts` (which read Firestore by design).

### 5.3 Scheduled jobs and workflows

Four workflows have a `schedule:` (cron) trigger: `aaradhane.yml`, `panchanga.yml`, `seva-backup.yml`, `seva-maintenance.yml`. Of these, **exactly one — `aaradhane.yml` — has an active Firestore write path**, and it is the only *unattended* Firestore writer in the repository:

| Workflow | Trigger | Firestore activity |
|---|---|---|
| `.github/workflows/aaradhane.yml` | **`schedule` (cron `30 3 1 1 *`, every Jan 1) + `workflow_dispatch`** | **Active scheduled WRITE.** Step "Generate and Update Aaradhane Events" runs `npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year $TARGET_YEAR` **without `--dry-run`**, which reaches `lib/aaradhane/firestore-admin.ts` and calls `updateFirestoreWithAdmin()` — `docRef.update()` / `docRef.set()` on collection `events` (`firestore-admin.ts:19,215-229`). |
| `.github/workflows/panchanga.yml` | `schedule` (4 crons) | No Firestore reference. |
| `.github/workflows/seva-backup.yml` | `schedule` (daily) | No Firestore reference (Supabase-native seva counter). |
| `.github/workflows/seva-maintenance.yml` | `schedule` (monthly) | No Firestore reference. |
| `.github/workflows/firestore-batched-migration.yml` | `workflow_dispatch` | runs `scripts/fetch-checkpoint.ts`, `scripts/migrate-all-batched.ts` |
| `.github/workflows/firestore-production-export.yml` | `workflow_dispatch` | `npm run firestore:dump`; uploads `data/firestore-export/`, `data/firestore-dump/` |
| `.github/workflows/firestore-staged-migration.yml` | `workflow_dispatch` | `dump-firestore-staged.ts`, `migrate-staged-phase1.ts` |
| `.github/workflows/firestore-review-counts.yml` | `workflow_dispatch` | `scripts/read-firestore-counts.ts` (read-only) |
| `.github/workflows/ci.yml` | push / PR | **no Firestore**; job `build` = "Lint, typecheck, test, build" |

Two caveats on the `aaradhane.yml` write path, both verified in source:

1. The write is reached only when the *guard* step passes: the write step is gated on `inputs.dry_run != 'true' && steps.check_panchanga.outputs.exists == 'true'`. For a cron run `inputs.dry_run` is empty, so the guard reduces to "Panchanga data for the target year already exists in `data/panchanga/<year>/`". If it does not exist, the workflow takes the dry-run branch instead.
2. `generate-aaradhane.ts` defaults `firestore: false`, which selects the **local** Guru Parampara data file for *reading* — but the final "STEP 3: Updating Firestore" block calls `updateFirestoreWithAdmin()` **unconditionally** whenever `--dry-run` is absent (`generate-aaradhane.ts:216-231`). Reading from local data does **not** imply writing only locally.

Consequence for the migration: the `events` collection has a live, scheduled, unattended writer. Cutting `events` over to Supabase requires disabling or re-pointing this path, not merely migrating rows.

### 5.4 Test-only

`tests/rules/*` (Firestore rules unit tests), `tests/db/*`, `tests/e2e/*`, `tests/ai-uat/*`, and the `tests/unit/*` Firebase/auth suites. Test-only, no production effect.

---

## 6. Raya AI Supabase-only compliance matrix

Target (from `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` §1): *"No Raya AI runtime path reads or writes Firestore … Firestore is not used as a runtime fallback for Raya AI."*

**Verdict: NOT MET.** Five in-scope dependencies remain.

| # | File | Lines | Functions | Collection(s) | Classification | Reachable | Blocking compliance? |
|---|---|---|---|---|---|---|---|
| 1 | `lib/ai/retrieval/announcements.ts` | `4`, `5`, `52`, `56-77` | `collection, getDocs, query, where, orderBy` | `announcements` | **ACTIVE_READ + RUNTIME_FALLBACK** | **YES** — `lib/ai/index.ts:8` → `retrieval/index.ts` → `generator.ts:5,126` → `app/api/chat/route.ts:8` | **YES — live chat path** |
| 2 | `services/chat.service.ts` | `172-186`, `197-340` | `collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, limit, serverTimestamp` | `testimonials`, `volunteer_requests`, `feedback` | ACTIVE_READ, ACTIVE_WRITE | YES — `components/ai/AIChatProvider.tsx:10`; `app/admin/ai/{page,testimonials,volunteers}` | **YES — AI admin surface** |
| 3 | `services/knowledge-workflow.service.ts` | `20-21` + ~40 sites | full CRUD | 7 `knowledge_*` collections | ACTIVE_READ, ACTIVE_WRITE | YES — 8 routes under `app/api/knowledge/workflow/**` | **YES — knowledge workflow** |
| 4 | `app/api/admin/knowledge/route.ts`, `app/api/admin/knowledge/[id]/route.ts` | `:7` / `:6` + call sites | `getDocuments, addDocument, updateDocument, deleteDocument` | `knowledge` | ACTIVE_READ, ACTIVE_WRITE (Admin REST) | YES — `app/admin/knowledge/page.tsx`, `app/admin/ai/unknown-questions/page.tsx:223` | **YES** |
| 5 | `app/admin/ai/training/page.tsx` | `16-25`, `119-269` | `collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp` | `chatTraining` | ACTIVE_READ, ACTIVE_WRITE | YES — linked from `app/admin/ai/page.tsx:134` | Policy-dependent (see note) |
| 6 | `context/AuthContext.tsx` | `11`, `110-118` | `onAuthStateChanged` | Firebase Auth | AUTH_DEPENDENCY | YES | **NO** — see note |
| 7 | `components/admin/layout/AdminAuthGuard.tsx` | imports `@/lib/firebase` | `getFirebaseConfigStatus` | Firebase config gate | AUTH_DEPENDENCY | YES | **NO** — see note |

Notes:

- **Item 1 is the only true runtime fallback in `lib/ai/`.** Trigger: `if (!isFirebaseConfigured() || !db) return [];` (`:52`) and, on read failure, `catch { return cachedAnnouncements }` (`:56-77`). It returns stale in-memory cache rather than failing, which is exactly the "silent Firestore fallback" the plan forbids. There is **no Supabase `announcements` table**, so this cannot be cut over without a schema decision — it is a genuine design blocker, not just a code change.
- **Item 5** is the only entry already listed in the plan as deliberate (`chatTraining` = EXCLUDE_SYSTEM in `migration-inventory.ts:23`). Whether it blocks compliance depends on whether `chatTraining` is in scope. It is a live, reachable, in-`app/admin/ai` Firestore CRUD page.
- **Items 6-7 are auth, not data.** `tests/unit/raya-ai-auth-isolation.test.ts` explicitly asserts that `AdminAuthGuard` **keeps** its Firebase gate and that `admin-auth.ts` is untouched; porting them would break that guard. They are out of the "no Firestore *data* reads/writes" scope but are still Firebase runtime dependencies.
- The plan's own §4.2 non-negotiable #2 carves out `lib/ai/knowledge/repository.ts` (falls back to bundled seed data, not Firestore). That file is **already Supabase-only** and is not an offender.

### 6.1 Already Supabase-only (the compliant side)

- `lib/ai/**` except `retrieval/announcements.ts` — including all of `ai-settings/*`, `knowledge/*`, `intent/*`, `composer/*`, `retrieval/{aaradhane,donations,events,panchanga,registry,settings,sevas}`, `unknown-logger.ts`, `generator.ts`, `conversation-memory.ts`.
- `services/ai-analytics.service.ts`, `conversation.service.ts`, `knowledge.service.ts`, `multi-source-retrieval.service.ts`, `recommendation.service.ts`, `ml.service.ts`, `search.service.ts`, `content.service.ts`, `ux.service.ts`, `settings.service.ts`, `storage.service.ts`, `seva/*`.
- All of `app/api/ai/**` and `app/api/knowledge/**` except the workflow routes' service dependency.
- 14 of 15 `app/admin/ai/**` pages, and all of `components/ai/**`.

### 6.2 Guard tests

Read and replayed against source (not executed — `node_modules` is absent in this environment, so no test was run; this is a **source-replay** result, not a passing test run):

| Test | Asserts | Replay result |
|---|---|---|
| `tests/unit/ai-api-auth-wiring.test.ts` | 25 protected AI routes use `requireRayaAdminUser`; AI scopes free of `admin-firebase`/`firebase-admin`; CSP allows `*.supabase.co` | consistent |
| `tests/unit/no-firestore-analytics.test.ts` | `ai-analytics.service.ts` free of Firestore; generator has no `firebase/firestore` | consistent |
| `tests/unit/raya-ai-auth-isolation.test.ts` | `OUT_OF_SCOPE_FIREBASE_FILES` allowlist matches reality exactly | allowlist = `admin-auth.ts`, `admin.ts`, `verify-id-token.ts`, `retrieval/announcements.ts`, `admin/ai/training/page.tsx` — matches |
| `tests/unit/raya-ai-recovery-wiring.test.ts` | Supabase recovery flow | consistent |
| `tests/unit/conversation-service-supabase.test.ts` | `conversation.service.ts` Firestore-free | consistent |
| `tests/unit/bot-004-auth.test.ts` | `lib/auth/admin.ts` Firebase Admin token path | out of AI scope |

**Important:** the allowlist in `raya-ai-auth-isolation.test.ts` means items 1 and 5 are *expected* by the current test suite. The tests therefore do **not** currently fail on these; they encode the gap rather than catching it. `services/chat.service.ts` and `services/knowledge-workflow.service.ts` are **not** in that allowlist and are not covered by any AI-scope guard.

---

## 7. Prioritized migration backlog

Status vocabulary is restricted to the seven permitted values.

| # | Collection / area | Status | Evidence | Dependencies | Risk | Next action | Measurable completion criterion |
|---|---|---|---|---|---|---|---|
| 1 | **Source export (all collections)** | `BLOCKED_SOURCE_EXPORT` | `data/firestore-dump/` and `data/firestore-export/` do not exist; no `*.ndjson` tracked | Firebase credentials in CI (`FIREBASE_SERVICE_ACCOUNT_JSON`); daily Firestore read quota | Blocks all verification | Run `.github/workflows/firestore-production-export.yml` (read-only) and store the artifact | A complete dump exists with a MANIFEST listing every collection and a document count per collection |
| 2 | **Resolve the destination project** | `REVIEW_MAPPING` | Report cites `kvrkraqjuyxbraccxntk`; current env ref differs; sandbox DB is a Tournament project | Ops decision | Reconciliation against the wrong DB silently "passes" | Confirm the temple project ref with the owner; re-issue a read-only `SUPABASE_DB_URL` for it | A single named project ref is agreed and the 45 tables are listed from it |
| 3 | `sevas` | `PENDING_BOTH` | `mapSeva` exists; 10 rows are seed data (`scripts/seed-supabase-sevas.ts`); source count UNKNOWN | #1, #2 | Seed rows may mask missing production rows | Export, then dry-run `npm run migrate:sevas` | `source = inserts + updates + validationFailures` and dest count equals source count |
| 4 | `events` | `PENDING_BOTH` | `mapEvent` + `CORE_FIELD_SPECS.events`; test JSON = 38 docs; **plus a scheduled unattended Firestore writer** (`aaradhane.yml`, B7) | #1, #2, **B7** | Timestamp conversion; scheduled writer will keep re-creating Firestore rows after migration | Export, then dry-run `npm run migrate:core`; **and** retire/re-point the `aaradhane.yml` write step | Counts reconcile; no unmapped fields reported; `aaradhane.yml` no longer writes Firestore |
| 5 | `dailyPoojas` | `PENDING_BOTH` | `mapDailyPooja` | #1, #2 | `days text[]` shape | as above | as above |
| 6 | `sevaBookings` | `PENDING_BOTH` | `mapSevaBooking` exists but **no field spec** | #1, #2 | **Unmapped-field audit is skipped for this collection** | Add a `FieldCoverageSpec`, then migrate | Field coverage reports PASS |
| 7 | `testimonials` | `PENDING_BOTH` | `mapTestimonial` | #1, #2 | — | `npm run migrate:content` dry-run | Counts reconcile |
| 8 | `galleryAlbums`, `galleryMedia` | `PENDING_BOTH` | mappers `:302`, `:319`; `album_id` is text | #1, #2 | **Storage objects not migrated** | Migrate rows; plan a Storage workstream | Rows reconcile; every `image_path` resolves to a reachable object |
| 9 | `aaradhane` / `aaradhanes` | `PENDING_BOTH` | `mapAaradhane`; both aliases in inventory → one table | #1, #2 | Double-migration via two source aliases | Decide the canonical source collection first | One canonical source; counts reconcile; no duplicate `firestore_id` |
| 10 | `volunteer_requests` | `PENDING_BOTH` | `mapVolunteerRequest` | #1, #2 | — | `npm run migrate:content` | Counts reconcile |
| 11 | `unknown_questions` | `PENDING_BOTH` | `mapUnknownQuestion`; known validation failure on doc `1cMSdGgkHf1gtgkGxn3z` | #1, #2 | One doc has no `question` — will fail validation by design | Decide: fix source data or add an explicit exclusion | Reconciliation PASS with the failure either fixed or documented as excluded |
| 12 | `chat_sessions`, `messages` | `PENDING_BOTH` | `mapChatSession`, `mapChatMessage` | #1, #2 | `lastIntent`/`lastTopic`/`preferredLanguage` have no column | Export, then `npm run migrate:ai` | Counts reconcile; excluded fields listed |
| 13 | `ai_intent_distribution`, `ai_latency_records` | `PENDING_BOTH` | `mapIntentDistribution`, `mapLatencyRecord` | #1, #2 | — | `npm run migrate:ai` | Counts reconcile |
| 14 | `knowledge` | `PENDING_BOTH` | `mapAiKnowledge` → `ai_knowledge` | #1, #2 | mapper throws on any unmapped field | `scripts/migrate-ai-knowledge.ts` | Counts reconcile, no unmapped fields |
| 15 | `users` | `EXPLICITLY_EXCLUDED` | `EXCLUDED_AUTH_COLLECTIONS`; auth migrates via Supabase Auth | Supabase Auth migration | `migrate-content-to-supabase.ts` contradicts this | Remove `users` from the content migrator, or document the exception | Migrator no longer writes `users` |
| 16 | `sessions`, `bookmarks` | `EXPLICITLY_EXCLUDED` | `sessions` EXCLUDE_AUTH; `bookmarks` marked not-required in `FIREBASE_MIGRATION_PHASE1_AUDIT.md` | — | Low value, auth-linked | Confirm exclusion in writing | Owner sign-off recorded |
| 17 | `system`, `chatTraining` | `EXPLICITLY_EXCLUDED` | `migration-inventory.ts:22-23` EXCLUDE_SYSTEM | — | `chatTraining` is still live AI admin code | Confirm scope | Decision recorded |
| 18 | `profiles` | `PENDING_BOTH` | `mapProfile` | #1, #2 | Inventory says REVIEW, migrator migrates it | Decide and align | Inventory and migrator agree |
| 19 | `donations` | `PENDING_BOTH` | `mapDonation` | #1, #2 | Committed rules let any signed-in user create (see §11) | Decide mapping, then migrate | Counts reconcile |
| 20 | `donation_campaigns` + `donationCampaigns` | `REVIEW_MAPPING` | `mapDonationCampaign`; two source aliases | #1, #2 | Double-migration | Pick canonical source | One source, counts reconcile |
| 21 | `settings/*` + `homepage/config` | `REVIEW_MAPPING` | `mapSettingsDocument` (JSONB-lossless) + inline `site_settings`/`social_links` | #1, #2; settings/homepage conflict unresolved | Split mapping needs a rule | Define the doc→table rule, then `npm run migrate:settings` | Every settings doc lands in exactly one destination with no loss |
| 22 | `ai_settings` | `REVIEW_MAPPING` | No ETL mapper; seeded by `seed-ai-settings-supabase.ts`; Firestore reader at `lib/ai/ai-settings/admin-repository.ts:31` | Decide: seed vs migrate | Two sources of truth for AI config | Decide and remove the loser | Only one writer remains |
| 23 | `announcements` | `REVIEW_MAPPING` | `services/announcement.service.ts`; **no destination table** | Needs a schema decision | Blocks Raya AI item 1 | Decide: create `announcements` table or cut over to `settings_documents` | Table exists **or** the AI reader is re-pointed |
| 24 | `quotes`, `timings`, `temple_areas`, `gallery`, `poojas`, `guruParampara`, `featuredContent`, `futurePlans`, `trustCommittee`, `members`, `volunteers`, `bills`, `notifications`, `feedback`, `page_views`, `daily_page_stats`, `chat_metrics`, `intent_metrics`, `intent_feedback`, 7 × `knowledge_*` | `REVIEW_MAPPING` | Each has active code and **no mapper/destination** | #1; per-collection design decision | Largest backlog block | Triage each into migrate-or-retire; retire dead ones (`gallery`, `poojas` look legacy) | Each collection has a written disposition |
| 25 | `guruParampara`, `test` | `REVIEW_MAPPING` | In code, **absent from inventory** | — | Silent omission | Add to inventory or document as out of scope | Inventory covers all code-referenced collections |
| 26 | Raya AI item 1 — `lib/ai/retrieval/announcements.ts` | `PENDING_CODE_CUTOVER` | Live `/api/chat` path; Firestore read + stale-cache fallback | #23 (destination) | Live chatbot correctness | After #23, re-point the retriever and delete the fallback | `grep -rn firebase lib/ai/` returns nothing |
| 27 | Raya AI item 2 — `services/chat.service.ts` (testimonial/volunteer/feedback half) | `PENDING_BOTH` | `:172-340` | #8, #10, #24 (`feedback` has no destination) | Mixed file, easy to mis-edit | Split the file: Supabase half stays, Firestore half moves to a `testimonial.service`-style owner | No `firebase/firestore` import in `chat.service.ts` |
| 28 | Raya AI item 3 — `services/knowledge-workflow.service.ts` | `PENDING_BOTH` | 7 collections, ~40 call sites, 8 live routes | Needs 7 destination tables | Largest AI-scope block | Design the `knowledge_*` schema, then migrate | Service is Supabase-only and all 8 routes still pass |
| 29 | Raya AI item 4 — `app/api/admin/knowledge/**` | `PENDING_CODE_CUTOVER` | `@/lib/firebase-admin-rest` | #14 (`ai_knowledge` already exists) | Admin knowledge CRUD | Re-point to Supabase `ai_knowledge` | No `firebase-admin-rest` import in those routes |
| 30 | Raya AI item 5 — `app/admin/ai/training/page.tsx` | `REVIEW_MAPPING` | `chatTraining` CRUD | Scope decision | In `app/admin/ai` | Confirm whether `chatTraining` is in scope | Decision recorded; allowlist updated if cut over |
| 31 | Firebase Storage objects | `REVIEW_MAPPING` | `storage.rules`; `gallery_media.image_path`; `app/admin/media/page.tsx`; `services/profile.service.ts` | Storage migration plan | Data referenced but never migrated | Enumerate objects, choose a target, migrate | Every stored reference resolves post-cutover |
| 32 | RLS policies beyond deny-all | `PENDING_CODE_CUTOVER` | 45 tables RLS-enabled; only 4 have policies | Security design | **Security risk** | Define least-privilege policies | Every table has a deliberate policy or a documented service-role-only decision |
| 33 | Committed service-account key | `REVIEW_MAPPING` | `.firebase-adminsdk.json` is tracked (`git ls-files`) in a **public** repo | Owner action | **Critical credential exposure** | Rotate the key; purge from history; move to a secret | Key rotated and absent from the tree and history |
| 34 | `donations` create open to any signed-in user | `REVIEW_MAPPING` | `firestore.rules:141-145` `allow create: if isAuthenticated()` | Owner action | Spam/abuse by any authenticated account | Decide intended behaviour | Rules match the intended flow |

### 7.1 Dependency order

```
#1 export ─┐
#2 project ─┼─→ #3..#14 core/content/AI data ─→ #21..#24 settings & REVIEW triage
           │                                   └─→ #26..#30 Raya AI cutover
#23 announcements table ──────────────────────────→ #26 (hard blocker)
#31 Storage ──── independent workstream
#32 RLS ─────── independent, security-driven
#33 key rotation ─ independent, do first (security)
#B7 events scheduled writer ──→ must precede #4 cutover (code change, not data)
```

### 7.2 Proposed batch migration and reconciliation sequence

Ordered so that each batch is independently verifiable and no batch depends on an unverified predecessor. **No step below has been executed by this audit.**

| Phase | Batch | Collections | Command (dry-run first) | Reconciliation gate |
|---|---|---|---|---|
| 0 | Pre-flight | — | none (read-only) | Export artifact exists with per-collection counts; destination project ref confirmed |
| 1 | Core reference data | `sevas`, `dailyPoojas` | `npm run migrate:core -- --dry-run` | `source = inserts + updates + validationFailures`; dest count == source count |
| 2 | Core transactional | `events`, `sevaBookings` | `npm run migrate:core -- --dry-run`; `npm run migrate:seva-bookings -- --dry-run` | as above; **`sevaBookings` field spec must exist first** (#6) |
| 3 | Content | `testimonials`, `galleryAlbums`, `galleryMedia`, `volunteer_requests`, `aaradhane` | `npm run migrate:content -- --dry-run` | as above; canonical `aaradhane` source decided (#9) |
| 4 | Settings | `settings/*`, `homepage/config` | `npm run migrate:settings -- --dry-run` | every settings doc lands in exactly one destination, JSONB-lossless |
| 5 | AI / Raya | `chat_sessions`, `messages`, `unknown_questions`, `ai_intent_distribution`, `ai_latency_records`, `knowledge` | `npm run migrate:ai -- --dry-run` | as above; `lastIntent`/`lastTopic`/`preferredLanguage` listed as intentional exclusions |
| 6 | Batched remainder | all remaining `MIGRATE` entries | `npm run migrate:phase1 -- --batch <n> --dry-run` | per-batch manifest status `SUCCESS` |
| 7 | Code cutover | `events` scheduled writer, Raya AI 5 deps | — | `grep -rn firebase lib/ai/` empty; `aaradhane.yml` no longer writes Firestore |

`migrate:phase1` is **dry-run by default** in the sense that it refuses to run without `--batch`/`--collections`; note the flag is `--dry-run`, and `--retry-failed` requires `--batch` or `--collections` (`scripts/migrate-all-batched.ts:147-155,176`).

### 7.3 Exact, verified commands

All argument syntax below was read from the scripts and `package.json`, not inferred. **Do not run the write-capable variants until the source export exists and the destination project is confirmed.**

Read-only (safe to run now, no writes):

```bash
npm ci                                                    # restore deps
npm run verify:supabase-migrations:static                 # 45 tables / 602 columns / RLS coverage; exit 2 = live skipped
npm run firestore:dump                                    # read-only live Firestore dump -> data/firestore-dump/
npm run dump:staged -- settings events                    # positional collection args; allowlist = {settings, events}
npx jest tests/unit --silent                              # full unit suite (185 suites / 2247 tests at c56ef97; 186 / 2264 at main @ 53bad41)
```

Write-capable (do **not** run yet):

```bash
npm run migrate:core -- --dry-run
npm run migrate:content -- --dry-run
npm run migrate:ai -- --dry-run
npm run migrate:settings -- --dry-run
npm run migrate:sevas -- --dry-run
npm run migrate:daily-poojas -- --dry-run
npm run migrate:seva-bookings -- --dry-run
npm run migrate:phase1 -- --batch 1 --dry-run             # --dry-run; add --batch-size <n> to reshape batches
```

Export generation is deliberately a **CI** action, not a local one: `.github/workflows/firestore-production-export.yml` (`workflow_dispatch`) is the intended path, so that the service-account secret is supplied by GitHub and never handled locally.

---

## 8. Read-only checks needed to unblock missing source evidence

1. **Full Firestore export.** Run `.github/workflows/firestore-production-export.yml` (`workflow_dispatch`, read-only). This is the single highest-value action. **Do not** run it locally against production.
2. **Per-collection counts.** `.github/workflows/firestore-review-counts.yml` → `scripts/read-firestore-counts.ts`. Read-only.
3. **Confirm the destination project ref.** Ask the owner which Supabase project is the temple DB; compare to `kvrkraqjuyxbraccxntk`.
4. **Read-only destination introspection.** Against the confirmed project:
   `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;` and
   `SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY 1;` (approximate) or exact `count(*)` per table.
5. **Migration ledger read.** `scripts/verify-supabase-migrations.ts` in `--static` mode locally, then full mode against the confirmed project. Exit code `2` means "static passed, live skipped" — do not read that as success.
6. **Firebase Storage inventory.** List objects under the media bucket to size workstream #31.
7. **Rules review.** Re-read `firestore.rules` end-to-end (305 lines, 38 `match` blocks) for further authenticated-write surfaces beyond `donations`.
8. **Resolve `guruParampara` and `test`** — decide whether they hold production data before any export-scope decision.

### 8.1 Report and documentation conflicts (consolidated)

1. `docs/FIRESTORE_SUPABASE_MIGRATION_STATUS.md` is a 1-line stub but is named like the authoritative status file.
2. `FIREBASE_MIGRATION_PHASE1_AUDIT.md` says 64 collections; the inventory array has a runtime length of 61; `REVIEW_COLLECTIONS_REPORT.md` says 44 REVIEW; the array has 42; `migration_report.md` says 14 MIGRATE; the array has 15.
3. `MIGRATION_DATA_RECONCILIATION_REPORT.md` targets a different Supabase project than the current environment.
4. `docs/RAYA_AI_SUPABASE_MIGRATION_PLAN.md` §2.3 lists four `lib/ai/retrieval/*` files as Firestore-based that are now Supabase-only, and lists `conversation.service.ts`/`ai-analytics.service.ts` as Firestore-based when they are now Supabase-only.
5. `PHASE_2_BATCH_1_DRY_RUN_REPORT.md` contains only placeholders.
6. `migration-inventory.ts` and `migrate-content-to-supabase.ts` disagree about `users`, `profiles`, `donations`, `donation_campaigns`.
7. `MIGRATION_VERIFICATION_REPORT.md` documents ledger/version drift (remote `20260918143124` vs local `20261001000000`) — still unresolved.
8. `REPORT_UNKNOWN_QUESTIONS_BLOCKER.md` asserts a specific failing document; the underlying CI log is not in the repo.

---

## 9. Validation evidence (commands actually executed by this audit)

Every result below was produced by a command run during this audit. Nothing is reported as passing that was not run.

| # | Command | Result | Interpretation |
|---|---|---|---|
| 1 | `npm ci --no-audit --no-fund` | exit 0 | Dependencies restored; `node_modules` was absent at session start. |
| 2 | `npm run verify:supabase-migrations:static` | **exit 2**; "Migration files scanned: 32 / Tables declared: 45 / Column declarations parsed: 602 / Tables with RLS enabled: 45 / Tables WITHOUT RLS: none"; "LIVE DATABASE VERIFICATION SKIPPED (--static)" | Static schema expectations **PASS**. Exit `2` means *static passed, live skipped* — it is **not** a failure and **not** a live verification. |
| 3 | `npx jest tests/unit/migration-helpers.test.ts tests/unit/migration-mappers.test.ts tests/unit/supabase-migration-coverage.test.ts tests/unit/no-firestore-analytics.test.ts tests/unit/ai-api-auth-wiring.test.ts tests/unit/raya-ai-auth-isolation.test.ts tests/unit/conversation-service-supabase.test.ts --silent` | **7 suites passed, 167 tests passed, 0 failed** | Migration mapper/coverage/guard logic is internally consistent. Does **not** validate any real data. |
| 4 | `npx jest tests/unit --silent` | **185 suites passed, 2247 tests passed, 0 failed** | Full unit suite green on this revision. One suite emits a non-fatal `FATAL: Settings doc count mismatch. Manifest: 10, File: 1` log line yet still passes — worth a follow-up look, reported as an observation, not a failure. |
| 5 | `git ls-remote` / GitHub API branch + PR reads | — | `main` = `c56ef97` at audit time; PR #352 open, **not** a draft; PR #351 merged, password-recovery only. |

**Not executed, and why:** no `migrate:*` script, no `firestore:dump`, no `supabase db push`, no live verification mode. Live verification requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, which are unset in this environment; only `SUPABASE_DB_URL` is present and it targets an unrelated project (§4.1). Running any write-capable command is prohibited by this task.

### 9.1 Independent re-validation (final review, `main` @ `53bad41`)

A separate read-only review re-ran the safe checks and re-imported the modules. Commands, exit codes and results:

| # | Command | Result | Interpretation |
|---|---|---|---|
| R1 | `npm ci --no-audit --no-fund` | exit 0 | Dependencies restored. |
| R2 | `npm run verify:supabase-migrations:static` | **exit 2**; "Migration files scanned: 32 / Tables declared: 45 / Column declarations parsed: 602 / Tables with RLS enabled: 45 / Tables WITHOUT RLS: none" | Matches §9 rows 2. Exit 2 = live skipped, not a CI pass. |
| R3 | `npx jest tests/unit --silent` (on `main` @ `53bad41`) | **186 suites / 2264 tests passed**, 0 failed | The suite has grown since `c56ef97`; the §9 row 4 total of 185/2247 is correct **for `c56ef97` only**. |
| R4 | `npx jest tests/unit --silent` (checked out at `c56ef97`) | **185 suites / 2247 tests passed**, 0 failed | Confirms the §9 row 4 figures were accurate for the audited revision. |
| R5 | `npx jest … (the 7 named guard suites) --silent` | **7 suites / 167 tests passed** | Matches §9 row 3. |
| R6 | `node --experimental-strip-types` importing `MIGRATION_INVENTORY` | runtime length **61**; 15 MIGRATE / 42 REVIEW / 2 EXCLUDE_SYSTEM / 2 EXCLUDE_AUTH | Corrects the earlier "59 / 0 EXCLUDE_AUTH" claim in §2.3 and §12. |
| R7 | `python3` census over `supabase/migrations/*.sql` | 56 `CREATE POLICY` statements; 44 of 45 tables carry ≥1 policy; 48 named `Deny all …`; 3 further `Deny …` (all on `ai_knowledge`); 5 `Allow …` reads covering 4 tables; `seva_list_items` has none | Corrects the earlier "8 permissive" figure (actual permissive reads = 5). |
| R8 | read-only `psycopg2` introspection of `SUPABASE_DB_URL` | 14 tables, all Tournament-domain (`teams`, `matches`, `players`, `tournaments`, …) | Confirms §4.1: the sandbox DB is not the temple DB. No temple count was read. |

The re-validation changed only documentation text in this file (inventory entry count, the RLS permissive count, `main`-head drift, PR draft status, and the test-total provenance). No finding was reclassified and no migration status was upgraded.

---

## 10. Migration completion checklist

Migration may be declared complete only when **all** of the following hold. Each item names its evidence source. None are satisfied today except where noted.

| # | Criterion | Evidence required | Current |
|---|---|---|---|
| 1 | Every in-scope collection accounted for | Inventory covers all code-referenced collections incl. `guruParampara`, `test`, `donations` | ❌ gaps (§2.3) |
| 2 | Trustworthy source inventory/export exists | `data/firestore-dump/` artifact + MANIFEST with per-collection counts | ❌ (B1) |
| 3 | Every field mapped or explicitly excluded | `auditFieldCoverage` PASS per collection, with `FieldCoverageSpec` present | ❌ `sevaBookings` has none (§4.4) |
| 4 | No unexplained source→target count discrepancies | `reconcileCounts` PASS: `source = inserts + updates + excludedMalformed + validationFailures + writeFailures` | ❌ not performed |
| 5 | Validation/write failures resolved or accepted | Documented disposition per failing doc (e.g. `unknown_questions` doc `1cMSdGgkHf1gtgkGxn3z`) | ❌ undecided |
| 6 | Reconciled against the correct production project | Single agreed project ref; counts read from it | ❌ (B3) |
| 7 | All in-scope app dependencies cut over | `grep -rn "firebase/firestore\|firebase-admin" app lib services` returns only excluded paths | ❌ (§5) |
| 8 | No Firestore fallback in Raya AI | `grep -rn firebase lib/ai/` empty; guard test passes | ❌ (§6) |
| 9 | No legacy Firestore data deleted | Firestore collections intact; no delete operations issued | ✅ preserved (nothing run) |
| 10 | Scheduled writer retired | `aaradhane.yml` no longer writes Firestore `events` | ❌ (B7) |

---

## 11. Security observations relevant to this migration

These are reported because they affect the safety of the migration itself. **No secret value is reproduced in this report.**

1. **A Firebase service-account private key is committed to a public repository.** `git ls-files` lists `.firebase-adminsdk.json`; it is a `service_account` JSON containing a `private_key` (~1.7 kB) and `private_key_id`. The repository's `visibility` is `public` (GitHub API). The `.gitignore` lists `.firebase-adminsdk.json` **and** `data/firestore-dump/*`, yet `git ls-files` shows the key is tracked — i.e. it was force-added or committed before the ignore rule. The owner has confirmed this was added manually. **Recommended: rotate the key in Google Cloud, purge it from history, and load it from a secret.** Any key that has been in a public repo must be treated as compromised regardless of intent.
2. **`firestore.rules` lets any authenticated user create `donations` documents** (`firestore.rules:141-145`: `allow read: if isOwner(resource.data.userId) || isAdmin(); allow create: if isAuthenticated();`). This is a write surface on a financial collection open to every signed-in account, not just admins; worth an explicit owner decision before or during migration. Note it is *not* anonymous/public — `isAuthenticated()` is required.
3. **Two of the four permitted public SELECT policies expose data broadly** (`site_settings`, `temple_areas` `USING (true)`). Confirm that is intended.
4. **`seva_list_items` has RLS enabled with no policy** — deny-all. Confirm that is intended.
5. This audit deliberately did not read, copy, or print the contents of `.firebase-adminsdk.json`, any `.env*` file, or any Firestore document.

---

## 12. Closing statement

**Confirmed.**
- `main` @ `c56ef97` was the audited revision and was upstream head at audit time (verified via the GitHub API at 2026-10-21T10:58:10Z). Only PR #351 landed between revision 1 (`665e6ff`) and revision 2; it touched password-recovery files only and has no migration impact. `main` has since advanced to `53bad41`; that drift does not alter any migration finding (see the scope note at the top).
- No complete Firestore source export exists; `data/firestore-dump/` and `data/firestore-export/` do not exist and no `*.ndjson` is tracked.
- The temple Supabase destination is **not** reachable from this environment; the sandbox DB is a different project.
- 45 tables are declared across the 32 Supabase migrations, all RLS-enabled, 44 with at least one `CREATE POLICY`, 48 of the 56 policies being `Deny all …`, and 4 tables carrying a permissive `Allow …` read policy (`temple_areas`, `site_settings`, `social_links`, `ai_knowledge`). Tables/RLS verified by `npm run verify:supabase-migrations:static` → "Tables declared: 45 / Tables with RLS enabled: 45 / Tables WITHOUT RLS: none"; policy counts verified by an independent census of `supabase/migrations/*.sql`.
- 61 entries exist in `MIGRATION_INVENTORY` at runtime (15 MIGRATE / 42 REVIEW / 2 EXCLUDE_SYSTEM / 2 EXCLUDE_AUTH). Verified by importing the module and reading `MIGRATION_INVENTORY.length`.
- Raya AI is **not** Supabase-only: five in-scope dependencies remain, one of them on the live `/api/chat` path.
- `events` has a live scheduled unattended Firestore writer (`aaradhane.yml`).
- A service-account private key is committed to a public repository.

**Unknown.**
- Every source document count (no export).
- Every destination row count (wrong project).
- All field-level fidelity, orphan, duplicate and timestamp checks.
- Whether `kvrkraqjuyxbraccxntk` is the temple production project.
- Whether `guruParampara` and `test` hold production data.
- Whether the committed key has already been rotated.
- Whether the scheduled `aaradhane.yml` run has actually executed on a real cron (and thus written `events`) — GitHub Actions run history was not inspected.

**Blocked.**
- All `MIGRATED_VERIFIED` determinations, on the absence of a source export (B1) and a reachable, correctly-identified destination (B2/B3).
- Raya AI Supabase-only compliance, on the missing `announcements` destination (#23) and the un-designed `knowledge_*` schema (#28).
- `events` cutover, on retiring the scheduled Firestore writer (B7) in addition to the data migration.

**Safest next step.**
Rotate the exposed Firebase service-account key first (security, independent of migration), then run the read-only `.github/workflows/firestore-production-export.yml` to obtain the missing source export, then confirm the temple Supabase project ref and re-run the read-only destination introspection. Only after all three should any `migrate:*` script be dry-run.

**Not done, deliberately.** No migration was executed. No Firestore, Supabase, schema, or migration-history write occurred. No fix was implemented. No PR was merged. No Firestore data was deleted or modified.
