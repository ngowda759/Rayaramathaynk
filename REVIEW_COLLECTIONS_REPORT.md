# Migration Scope Investigation Report

## Summary
- **Total REVIEW collections checked:** 44
- **Collections with production data:** UNAVAILABLE (Production credentials not provided in the environment. Firestore count was blocked.)
- **Collections with zero production documents:** UNAVAILABLE
- **Collections that are active and clearly require migration:** donations, donationCampaigns, sevaBookings, profiles, announcements, gallery, poojas, quotes, receiptSevas, volunteers, chat_metrics, page_views
- **Collections that are legacy/duplicate:** donation_campaigns (likely duplicate of donationCampaigns), gallery (legacy, replaced by galleryAlbums?)
- **Collections requiring a separate design decision:** settings, homepage, all AI and Knowledge collections (ai_settings, ai_token_usage, knowledge, knowledge_articles, knowledge_categories, knowledge_workflow, knowledge_versions, knowledge_workflow_actions, knowledge_review_comments, knowledge_committee_approvals, knowledge_audit_log, knowledge_drafts)

## Collection Analysis

| Collection | Firestore Count | Active Usage | Destination | Existing Mapper | Classification Recommendation | Evidence/Notes |
|---|---|---|---|---|---|---|
| donations | UNAVAILABLE | Yes | None | Yes | MIGRATE | Investigated via services/donation.service.ts |
| donationCampaigns | UNAVAILABLE | Yes | None | Yes | MIGRATE | Investigated via services/donationCampaign.service.ts |
| donation_campaigns | UNAVAILABLE | No | None | Yes | REVIEW / NEEDS DECISION | Likely duplicate of donationCampaigns |
| sevaBookings | UNAVAILABLE | Yes | None | Yes | MIGRATE | Investigated via services/sevaBooking.service.ts |
| profiles | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via services/profile.service.ts |
| bookmarks | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | Application data linked to auth but not strictly auth credentials. Confirm migration necessity. |
| settings | UNAVAILABLE | No | None | Yes | REVIEW / NEEDS DECISION | Requires conflict/mapping verification with homepage |
| homepage | UNAVAILABLE | No | None | Yes | REVIEW / NEEDS DECISION | Requires conflict/mapping verification with settings |
| announcements | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via services/announcement.service.ts |
| gallery | UNAVAILABLE | Yes | None | No | MIGRATE | Legacy gallery? Replaced by galleryAlbums? |
| timings | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| temple_areas | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| poojas | UNAVAILABLE | Yes | None | No | MIGRATE | Duplicate/Legacy of dailyPoojas? |
| panchanga | UNAVAILABLE | No | None | No | EXCLUDE | Local json-based generator used (data/panchanga) |
| quotes | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via services/quote.service.ts |
| featuredContent | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| futurePlans | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| trustCommittee | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| trust | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| bills | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| receiptSevas | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via receipt-sevas API route |
| receipts | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via receipts API route |
| volunteers | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via services/volunteer.service.ts |
| members | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| ai_settings | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| ai_token_usage | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| messages | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | Legacy messages? |
| chat_metrics | UNAVAILABLE | Yes | None | No | MIGRATE | No destination model explicitly defined |
| intent_metrics | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| intent_feedback | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| page_views | UNAVAILABLE | Yes | None | No | MIGRATE | Investigated via services/pageviews.service.ts |
| daily_page_stats | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| feedback | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| notifications | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION | No destination model explicitly defined |
| knowledge | UNAVAILABLE | Yes | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_articles | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_categories | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_workflow | UNAVAILABLE | Yes | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_versions | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_workflow_actions | UNAVAILABLE | Yes | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_review_comments | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_committee_approvals | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_audit_log | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |
| knowledge_drafts | UNAVAILABLE | No | None | No | REVIEW / NEEDS DECISION (Separate Domain) | No destination model explicitly defined |

## Notes
- I could not determine the exact production document counts for the collections since the required environment credentials (`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PRIVATE_KEY`, etc) were not available.
- Used source code grep and dependencies to determine if an existing application service relies on a collection.
- **temple_areas**: There is a seed script (`scripts/seed-temple-areas.ts`) and an export json in `data/panchanga`. It looks to be static/seed data.
- **panchanga**: Uses a python generation script (`scripts/panchanga.py`) to produce local json files in `data/panchanga/`. Thus, recommend EXCLUDE.
