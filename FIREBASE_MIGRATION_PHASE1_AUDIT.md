# Firebase Migration Phase 1 Audit

## 1. FIRESTORE COLLECTION INVENTORY

| Firestore Collection | Defined/Discovered From | Source Data Available? | Known Document Count | Current Application Usage | Supabase Destination | Migration Status |
|---|---|---|---|---|---|---|
| aaradhane | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | aaradhanes | WAIT_FOR_FIRESTORE_EXPORT |
| aaradhanes | EXPECTED | NO | 19 HISTORICAL | ACTIVE (API/Migrate) | aaradhanes | WAIT_FOR_FIRESTORE_EXPORT |
| ai_intent_distribution | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | ai_intent_distribution | WAIT_FOR_FIRESTORE_EXPORT |
| ai_latency_records | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | ai_latency_records | WAIT_FOR_FIRESTORE_EXPORT |
| ai_settings | EXPECTED | NO | UNKNOWN | ACTIVE (AI/Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| ai_token_usage | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | ai_token_usage | WAIT_FOR_FIRESTORE_EXPORT |
| ai_unknown_questions | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | unknown_questions | WAIT_FOR_FIRESTORE_EXPORT |
| announcements | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | announcements | WAIT_FOR_FIRESTORE_EXPORT |
| articles | CODE | NO | UNKNOWN | ACTIVE (AI/Knowledge) | knowledge | WAIT_FOR_FIRESTORE_EXPORT |
| bills | EXPECTED | NO | UNKNOWN | ACTIVE (Billing) | bills | WAIT_FOR_FIRESTORE_EXPORT |
| bookmarks | EXCLUDED | NO | 0 | NOT_REQUIRED | N/A | NOT_REQUIRED |
| chatTraining | EXPECTED | NO | UNKNOWN | ACTIVE (AI Training) | chatTraining | WAIT_FOR_FIRESTORE_EXPORT |
| chat_messages | EXPECTED | NO | UNKNOWN | ACTIVE (AI Chat) | chat_messages | WAIT_FOR_FIRESTORE_EXPORT |
| chat_metrics | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | chat_metrics | WAIT_FOR_FIRESTORE_EXPORT |
| chat_sessions | EXPECTED | NO | 19 HISTORICAL | ACTIVE (AI Chat) | chat_sessions | WAIT_FOR_FIRESTORE_EXPORT |
| dailyPoojas | EXPECTED | NO | 26 HISTORICAL | ACTIVE (UI/Admin) | daily_poojas | WAIT_FOR_FIRESTORE_EXPORT |
| daily_page_stats | EXPECTED | NO | UNKNOWN | ACTIVE (Analytics) | daily_page_stats | WAIT_FOR_FIRESTORE_EXPORT |
| donationCampaigns | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | donation_campaigns | WAIT_FOR_FIRESTORE_EXPORT |
| donation_campaigns | EXPECTED | NO | UNKNOWN | ACTIVE (UI) | donation_campaigns | WAIT_FOR_FIRESTORE_EXPORT |
| donations | EXPECTED | NO | 1 HISTORICAL | ACTIVE (UI/Admin) | donations | WAIT_FOR_FIRESTORE_EXPORT |
| events | EXPECTED | NO | 36 HISTORICAL | ACTIVE (UI/Admin) | events | WAIT_FOR_FIRESTORE_EXPORT |
| featuredContent | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | featured_content | WAIT_FOR_FIRESTORE_EXPORT |
| feedback | EXPECTED | NO | 2 HISTORICAL | ACTIVE (Admin) | feedback | WAIT_FOR_FIRESTORE_EXPORT |
| futurePlans | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| gallery | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | gallery_media | WAIT_FOR_FIRESTORE_EXPORT |
| galleryAlbums | EXPECTED | NO | 4 HISTORICAL | ACTIVE (UI/Admin) | gallery_albums | WAIT_FOR_FIRESTORE_EXPORT |
| galleryMedia | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | gallery_media | WAIT_FOR_FIRESTORE_EXPORT |
| homepage | EXPECTED | NO | 1 HISTORICAL | ACTIVE (UI/Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| intent_feedback | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | intent_feedback | WAIT_FOR_FIRESTORE_EXPORT |
| intent_metrics | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | intent_metrics | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge | EXPECTED | NO | 5 HISTORICAL | ACTIVE (UI/Admin) | knowledge | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_articles | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_audit_log | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_audit_log | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_categories | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_categories | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_committee_approvals | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_committee_approvals | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_drafts | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_drafts | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_review_comments | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_review_comments | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_versions | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_versions | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_workflow | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_workflow | WAIT_FOR_FIRESTORE_EXPORT |
| knowledge_workflow_actions | EXPECTED | NO | UNKNOWN | ACTIVE (Knowledge) | knowledge_workflow_actions | WAIT_FOR_FIRESTORE_EXPORT |
| members | EXPECTED | NO | 1 HISTORICAL | ACTIVE (Admin) | users/profiles | WAIT_FOR_FIRESTORE_EXPORT |
| messages | EXPECTED | NO | 101 HISTORICAL | ACTIVE (AI Chat) | chat_messages | WAIT_FOR_FIRESTORE_EXPORT |
| notifications | EXPECTED | NO | UNKNOWN | ACTIVE (System) | notifications | WAIT_FOR_FIRESTORE_EXPORT |
| page_views | EXPECTED | NO | ~47k HISTORICAL | ACTIVE (Analytics) | page_views | WAIT_FOR_FIRESTORE_EXPORT |
| panchanga | EXPECTED | NO | UNKNOWN | ACTIVE (UI) | panchanga | WAIT_FOR_FIRESTORE_EXPORT |
| poojas | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | daily_poojas | WAIT_FOR_FIRESTORE_EXPORT |
| profiles | EXCLUDED | NO | 0 | NOT_REQUIRED | profiles | NOT_REQUIRED |
| quotes | EXPECTED | NO | UNKNOWN | ACTIVE (UI) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| receiptSevas | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | sevas (unified) | WAIT_FOR_FIRESTORE_EXPORT |
| receipts | EXPECTED | NO | UNKNOWN | ACTIVE (Admin) | receipts | WAIT_FOR_FIRESTORE_EXPORT |
| sessions | EXCLUDED | NO | 0 | NOT_REQUIRED | N/A | NOT_REQUIRED |
| settings | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| sevaBookings | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | seva_bookings | WAIT_FOR_FIRESTORE_EXPORT |
| sevas | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | sevas | WAIT_FOR_FIRESTORE_EXPORT |
| system | EXPECTED | NO | UNKNOWN | ACTIVE (System) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| temple_areas | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | temple_areas | WAIT_FOR_FIRESTORE_EXPORT |
| testimonials | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | testimonials | WAIT_FOR_FIRESTORE_EXPORT |
| timings | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| trust | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| trustCommittee | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | site_settings (JSON) | WAIT_FOR_FIRESTORE_EXPORT |
| unknown_questions | EXPECTED | NO | 32 HISTORICAL | ACTIVE (Admin) | unknown_questions | WAIT_FOR_FIRESTORE_EXPORT |
| users | EXCLUDED | NO | 0 | NOT_REQUIRED | users | NOT_REQUIRED |
| volunteer_requests | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | volunteer_requests | WAIT_FOR_FIRESTORE_EXPORT |
| volunteers | EXPECTED | NO | UNKNOWN | ACTIVE (UI/Admin) | volunteers | WAIT_FOR_FIRESTORE_EXPORT |

## 2. AVAILABLE FIRESTORE SOURCE DATA

No complete source data (JSON, NDJSON, CSV) from Firestore is available in the repository.
The directory `data/firestore-dump/` contains a `README.md` and some historical exports, but no files matching the required collections are currently populated due to `RESOURCE_EXHAUSTED` (HTTP 429) errors during the `firestore:dump` process.

## 3. SUPABASE DESTINATION MAPPING

| Source Collection | Destination Table | Primary Key | Source ID Preserved | Notes |
|---|---|---|---|---|
| `sevas` | `sevas` | `id` (uuid) | Yes (`firestore_id`) | 1:1 mapping |
| `dailyPoojas` | `daily_poojas` | `id` (uuid) | Yes (`firestore_id`) | 1:1 mapping |
| `events` | `events` | `id` (uuid) | Yes (`firestore_id`) | Timestamp conversions required |
| `users` | `users` | `id` (uuid) | Yes (`firestore_id`) | Supabase Auth mapping |
| `profiles` | `profiles` | `id` (uuid) | Yes (`firestore_id`) | Extension of users |
| `donations` | `donations` | `id` (uuid) | Yes (`firestore_id`) | |
| `donation_campaigns` | `donation_campaigns` | `id` (uuid) | Yes (`firestore_id`) | |
| `galleryAlbums` | `gallery_albums` | `id` (uuid) | Yes (`firestore_id`) | |
| `galleryMedia` | `gallery_media` | `id` (uuid) | Yes (`firestore_id`) | FK to `gallery_albums` |
| `testimonials` | `testimonials` | `id` (uuid) | Yes (`firestore_id`) | |
| `aaradhane` | `aaradhanes` | `id` (uuid) | Yes (`firestore_id`) | Nested arrays mapped to JSONB |
| `sevaBookings` | `seva_bookings` | `id` (uuid) | Yes (`firestore_id`) | |
| `settings` | `site_settings` | `id` (uuid) | Yes (`firestore_id`) | Document-style mapping to JSONB |

*Destination table confirmed absent from the repository schema:* `receipts`, `bills`.

## 4. APPLICATION USAGE

Most collections are classified as ACTIVE based on explicit references in service classes (`services/`, `lib/ai/`, `lib/aaradhane/`, `lib/receipt/`).

## 5. DATA QUALITY CHECK

Blocked. No source data available to validate.

## 6. CURRENT SUPABASE COMPARISON

| Collection | Status | Note |
|---|---|---|
| `events` | NOT_VERIFIABLE | Source unavailable, Supabase history exists. |
| `aaradhanes` | NOT_VERIFIABLE | Source unavailable, Supabase history exists. |
| `sevas` | NOT_VERIFIABLE | See Seva Data Provenance section. |

## 7. MIGRATION PRIORITY

*   All expected production collections (except auth exclusions): `WAIT_FOR_FIRESTORE_EXPORT`
*   Auth exclusions (`users`, `profiles`, `bookmarks`, `sessions`): `NOT_REQUIRED`

## 8. PHASE 1 CANDIDATES

None. `PHASE_1_READY` requires source data, which is currently unavailable due to rate limits.

## 9. FIRESTORE RECOVERY PLAN

1.  **Firestore recovery**: Wait for the Google Cloud Quota (429 RESOURCE_EXHAUSTED) to reset (typically 24 hours).
2.  **Single-collection validation**: Test connection with a small, known collection (e.g., `settings`).
3.  **Small batch export**: Implement/resume paginated extraction with strict rate-limiting (already implemented in `globalPacer` in `dump-firestore-live.ts`).
4.  **Source validation**: Verify downloaded NDJSON files for integrity.
5.  **Supabase migration**: Run specific migration scripts (e.g., `migrate-sevas.ts`) against local source data.
6.  **Reconciliation**: Compare source and destination counts/fields.
7.  **Next collection**: Proceed iteratively.

## 10. FINAL PHASE 1 SUMMARY

*   Total collections identified: 64
*   Expected collections: 60
*   Excluded collections: 4
*   Additional collections: 1 (`articles` found in code)
*   Collections with local source data: 0
*   Collections without source data: 60
*   Collections with Supabase destinations: ~15 mapped in schema
*   PHASE_1_READY: 0
*   WAIT_FOR_FIRESTORE_EXPORT: 60
*   LEGACY_REVIEW: 0
*   NOT_REQUIRED: 4
*   Confirmed mismatches: 0
*   Unresolved items: 60 (blocked by quota)

## 11. Sevas Data Provenance

The 10 rows currently in the Supabase `sevas` table were placed there by a seeding script, not migrated from Firestore.

| Evidence | Finding | Confidence |
|---|---|---|
| `scripts/seed-supabase-sevas.ts` | Contains exactly 10 hardcoded `TargetSeva` records (e.g., "Panchamrutha Seva", "Annadana Seva (1 Day)"). They are assigned synthetic `firestore_id` values like `seed_aradhana_seva_1`, `seed_aradhana_seva_2`, etc. | High |
| `scripts/verify-supabase-sevas.ts` | The script explicitly expects 10 rows in Supabase: `EXPECTED SOURCE COUNT: 10`. | High |
| `services/seva.service.ts` | Code has been modified to query Supabase first (`getAllSevasAction`) and fallback to Firestore if Supabase fails. | High |
| `check-firestore-sevas.ts` | Output shows Firestore read is BLOCKED due to `RESOURCE_EXHAUSTED`. | High |

**Conclusion:** The 10 rows in the Supabase `sevas` table are seed data. The actual production `sevas` collection in Firestore cannot be migrated until the rate limit is lifted.

**Updated Classification for `sevas`:** `WAIT_FOR_FIRESTORE_EXPORT`.
