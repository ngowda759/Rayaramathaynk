# Firestore Config Dump - Review & Supabase Migration

Full dump of every non-authentication Firestore config/collection for review and migration to Supabase. Produced with the Firebase CLI (firebase firestore:export) - no Admin SDK, no REST API.

## Why this exists

You asked for "all the configs from Firestore except authentication". Everything the app reads or writes is in the inventory below. Firebase Auth user records are NOT stored in Firestore ( they live in Firebase Auth itself), so they are intentionally excluded. Auth-related collections excluded from the dump: users, profiles, bookmarks, sessions.



## How to regenerate

```bash
npm install -g firebase-tools     # if not already installed
firebase login                     # one-time (or export FIREBASE_TOKEN=... for CI)
npm run firestore:dump            # export + convert in one shot
```

Output:
- data/firestore-export/ - raw Firebase CLI export (Firestore format)
- data/firestore-dump/<collection>.json - human-reviewable JSON array of docs
- data/firestore-dump/MANIFEST.json - inventory: collection -> file -> doc count



## Review layout

Each <collection>.json is an array of docs:

```json
{ "id": "<document id>", "exists": true, "fields": { "fieldName": value]; ... } }
```

Firestore timestamps are decoded to ISO-8601 strings, document references to full paths, and nested maps/arrays to plain JSON (the same shape you see in the Firebase Console.



## Collection inventory / Supabase migration map

Auth-related collections (excluded from dump(: users, profiles, bookmarks, sessions

| Firestore collection | What it is | Proposed Supabase table | Notes |
|---|---|---|---|
| settings | Site settings: about us, trust committee, finance, social | settings (key/value or single row) | Docs: config, aboutUs, socialLinks, trustCommittee, bankDetails... |
| homepage | Homepage hero / features / carousels | homepage | Doc: config |
| futurePlans | Future plans section | future_plans | |
| trust | Trust committee (AI KB source) | trust_committee | |
| announcements | Announcements / notices | announcements | Public read, admin write |
| events | Temple events & festivals | events | Public read, admin write |
| aaradhane, aaradhanes | Deity worship schedules | aaradhanes | Both names in code - pick one |
| timings | Temple darshan timings | timings | |
| sevas | Seva catalogue (also Receipt-sevas catalogue) | sevas | Already migrated (supabase/migrations/20260908120000_create_sevas_table.sql) |
| receiptSevas | Receipt-book seva catalogue | receipt_sevas | May be empty; code re-uses sevas |
| receipts | Receipt docs (server-only write, admin read) | receipts | Numbered via system counter |
| system | Internal counters (receipt numbering) | system_counters | Server-only reads/writes |
| dailyPoojas | Daily pooja schedule | daily_poojas | Already migrated (core migration SQL) |
| poojas | Pooja catalogue | poojas | Verify whether live in prod |
| donations | Donation records | donations | |
| donationCampaigns; donation_campaigns | Donation campaigns | donation_campaigns | Two names in code - confirm |
| sevaBookings | Seva bookings | seva_bookings | |
| bills | Billing records | bills | |
| volunteers | Volunteer records | volunteers | |
| volunteer_requests | Volunteer request forms | volunteer_requests | |
| members | Member records | members | |
| gallery; galleryAlbums; galleryMedia | Gallery items / albums / media | gallery_albums; gallery_media | |
| testimonials | Testimonials | testimonials | |
| temple_areas | Temple Explorer areas | temple_areas | |
| panchanga | Daily Hindu calendar | panchanga | |
| quotes | Daily spiritual quotes | quotes | |
| knowledge; knowledge_articles; knowledge_categories | AI knowledge base | knowledge_articles; knowledge_categories | |
| chatTraining | AI RAG / chunk corpus | ai_training_chunks | |
| ai_settings | AI assistant settings | ai_settings | |
| chat_sessions; messages; chat_metrics | AI chat sessions / messages | chat_sessions; chat_messages | |
| ai_token_usage; ai_latency_records; ai_intent_distribution; intent_metrics; intent_feedback | AI analytics | ai_token_usage; ai_latency_records; ai_intent_distribution | Ephemeral/log tables - optional |
| unknown_questions | Unanswered AI questions | unknown_questions | |
| page_views; daily_page_stats | Analytics | page_views | Ephemeral - optional |
| feedback | Public feedback | feedback | |
| notifications | Admin notifications | notifications | |



## Supabase target

- Existing tables: sevas, daily_poojas, events - see supabase/migrations/.
- Full proposed schema: docs/SUPABASE_DATABASE_SCHEMA.md..
- Migration helper: scripts/migrate-core-to-supabase.ts (sevas, daily_poojas, events) - extend it with the tables above once reviewed.



## Notes & probable dead config

- aaradhane vs aaradhanes - both used in code (aaradhane.service.ts) and both matched in rules. Pick one in Supabase..
- gallery, poojas, donationCampaigns vs donation_campaigns, receiptSevas, knowledge vs knowledge_articles - code/rules reference similar names, the dump will show which are actually populated...
- chat_metrics, intent_metrics, intent_feedback, daily_page_stats, sessions - referenced in older code,,may not exist in prod (Firestore export only emits collections that contain documents(



> **Note:** this directory is generated output,,re-run npm run firestore:dump to refresh it against the live database..
