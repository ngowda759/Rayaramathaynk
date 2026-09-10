# Firestore dump (all non-auth data)

Live dump of every Firestore collection in project sri-raghavendra-mutt, except auth-owned collections.

Produced by:
- npm run firestore:dump     -> scripts/dump-firestore-live.ts (REST v1 + service-account JWT, paginated, retries until quota frees)
- npm run firestore:dump:cli -> Firebase CLI export wrapper (legacy path)
- npm run firestore:convert -> converts a Firebase CLI export dir into the same layout

Excluded (auth-owned, not config domain): users, profiles, bookmarks, sessions. Migrate those via Supabase Auth.

## Live inventory (probed 2026-09-10)

27 collections discovered (raw REST v1 probe with pagination):

| collection | docs |
|---|---|
| aaradhane | 2 |
| ai_settings |  1 |
| announcements |  2 |
| chat_sessions |  19 |
| dailyPoojas |  26 |
| donations |  1 |
| eventRegistrations |  1 |
| events |  36 |
| feedback |  2 |
| galleryAlbums |   4 |
| guruParampara |   1 |
| homepage |   1 |
| knowledge |   5 |
| members |   1 |
| messages | 101 |
| page_views |  ~47k |
| quotes |   (pending) |
| settings |   (pending) |
| sevaBookings |  (pending) |
| sevas |  (pending) |
| test |  0 |
| testimonials |   (pending) |
| timings |  (pending) |
| unknown_questions |32 (pending) |
| users |  (excluded) |
| volunteers |  (pending) |
| website-settings |  (pending) |

Note: quote/settings/sevaBookings/sevas/testimonials/timings/unknown_questions/volunteers/website-settings counts pending because the probe hit Firestore read quota 429 (RESOURCE_EXHAUSTED) after the big page_views fetch; the parked dump retries until quota resets and fills real files.

## Code-known collections not present live (verify if empty or not yet created((

receipts, receiptSevas, panchanga, temple_areas, poojas, galleryMedia, futurePlans,
trustCommittee, trust, donationCampaigns, donation_campaigns, bills, volunteer_requests, system,
ai_token_usage, ai_latency_records, ai_intent_distribution, ai_unknown_questions,
chat_messages, chatTraining, chat_metrics, intent_metrics, intent_feedback, daily_page_stats,
notifications, knowledge_articles, knowledge_categories, knowledge_workflow, knowledge_versions,
knowledge_workflow_actions, knowledge_review_comments, knowledge_committee_approvals,
knowledge_audit_log, knowledge_drafts, featuredContent, aaradhanes, gallery.

The MANIFEST.json (written at end of each dump run( marks these as expected-known-missing.

## Migrating to Supabase

1. Run npm run firestore:dump until MANIFEST shows no failed/unexpected needing review.
2. Each .json is a decoded array (Timestamps become ISO strings, Maps/GeoPoints/References decoded per scripts/lib/firestore-values.ts).
3. Design schema: config-like collections fit JSONB columns; relational collections (sevaBookings, eventRegistrations, donations) fit normalized tables. Keep doc IDs as PKs (references stay intact).
4. Migrate auth separately via Supabase Auth (users etc excluded here(. Mirror auth.users for FK-linked display data (e.g. donations.userId(.
5. Insert order: parents first (settings, sevas, aaradhane, timings, announcements, events), then children (sevaBookings, eventRegistrations, donations, messages, page_views(.
6. page_views is ~47k rows: batch insert (2k/batch( and index createdAt/doc-id.
7. Tooling: Postgres COPY from NDJSON works well; or pg-migrate with JSONB for config-like collections.

## Quota note

Firestore free tier is ~50k document reads/day (plus per-minute rate(. REST list counts as a read per doc; page_views alone is ~47k reads, so one big dump/day.
The parked npm run firestore:dump retries 48x for discovery with backoff and 5x per collection, so it compleTes on its own when quota resets. Do not run parallel instances.

Output: data/firestore-export/*.ndjson (raw wire docs(, data/firestore-dump/<collection>.json (decoded(, MANIFEST.json (classification(.
