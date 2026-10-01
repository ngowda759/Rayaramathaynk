# Production Firestore Inventory for REVIEW Scope

**Note on Production Counts:** Production Firestore counts are **UNAVAILABLE** in this local execution environment.
*Exhaustive search details: Investigated `vercel env pull` (failed due to missing Vercel CLI token), checked `firebase-admin.json` (does not exist locally), checked GitHub Actions logs and configurations (`.github/workflows/firestore-batched-migration.yml`) which show that previous migrations authenticated via injected `FIREBASE_SERVICE_ACCOUNT_JSON` secrets which are not passed to this local container environment. Investigated application default credentials (`ADC`) which also failed. No local emulator endpoints are active.*

All the facts provided below are derived from static analysis of the source code.

## Collection Inventory

| Collection | Firestore Count | Active Code Usage | Existing Mapper | Intended Supabase Destination | Recommendation | Evidence |
|---|---|---|---|---|---|---|
| donations | UNAVAILABLE | Yes | Yes | None explicitly defined yet | MIGRATE | Used in `services/donation.service.ts` |
| donationCampaigns | UNAVAILABLE | Yes | Yes | None explicitly defined yet | MIGRATE | Used in `services/donationCampaign.service.ts` |
| donation_campaigns | UNAVAILABLE | No | Yes | None explicitly defined yet | DUPLICATE / LEGACY | Duplicate of `donationCampaigns`, verify production counts before dropping. |
| sevaBookings | UNAVAILABLE | Yes | Yes | None explicitly defined yet | MIGRATE | Used in `services/sevaBooking.service.ts` |
| profiles | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/profile.service.ts` |
| bookmarks | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/profile.service.ts` |
| settings | UNAVAILABLE | Yes | Yes | `site_settings`, `settings_documents`, `social_links` | CONFIG / SETTINGS | Found existing mapping scripts handling configuration split |
| homepage | UNAVAILABLE | Yes | Yes | Config map | CONFIG / SETTINGS | Homepage settings |
| announcements | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/announcement.service.ts` |
| gallery | UNAVAILABLE | Yes | No | None explicitly defined yet | DUPLICATE / LEGACY | Looks like legacy replacement by `galleryAlbums` / `galleryMedia` |
| timings | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | No service references found |
| temple_areas | UNAVAILABLE | No | No | None explicitly defined yet | CONFIG / SETTINGS | Only referenced in seed data (`quotes-seed-data.json`, `data/panchanga` etc) |
| poojas | UNAVAILABLE | Yes | No | None explicitly defined yet | DUPLICATE / LEGACY | Legacy collection replaced by `dailyPoojas` which maps to `daily_poojas` in Supabase |
| panchanga | UNAVAILABLE | No | No | None explicitly defined yet | EXCLUDE | Configured by local JSON/Python generator in `data/panchanga/` |
| quotes | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/quote.service.ts` |
| featuredContent | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | No service references found |
| futurePlans | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | No service references found |
| trustCommittee | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | No service references found |
| trust | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | No service references found |
| bills | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | Cannot see explicit service reference |
| receiptSevas | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in API/Service logic |
| receipts | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in API/Service logic |
| volunteers | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/volunteer.service.ts` |
| members | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Valid admin/public usage referenced in memories via `services/volunteer.service.ts` and related code |
| ai_settings | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | AI system configuration |
| ai_token_usage | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | AI metrics tracking |
| messages | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | Legacy messages? |
| chat_metrics | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/analytics.service.ts` |
| intent_metrics | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/analytics.service.ts` |
| intent_feedback | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/analytics.service.ts` |
| page_views | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/pageviews.service.ts` |
| daily_page_stats | UNAVAILABLE | No | No | None explicitly defined yet | NEEDS INVESTIGATION | No direct usage seen |
| feedback | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/testimonial.service.ts` & others |
| notifications | UNAVAILABLE | Yes | No | None explicitly defined yet | MIGRATE | Used in `services/testimonial.service.ts` & others |
| knowledge | UNAVAILABLE | No | No | None explicitly defined yet | SEPARATE DOMAIN | AI knowledge base domain |
| knowledge_articles | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |
| knowledge_categories | UNAVAILABLE | No | No | None explicitly defined yet | SEPARATE DOMAIN | AI knowledge base domain |
| knowledge_workflow | UNAVAILABLE | No | No | None explicitly defined yet | SEPARATE DOMAIN | AI knowledge base domain |
| knowledge_versions | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |
| knowledge_workflow_actions | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |
| knowledge_review_comments | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |
| knowledge_committee_approvals | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |
| knowledge_audit_log | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |
| knowledge_drafts | UNAVAILABLE | Yes | No | None explicitly defined yet | SEPARATE DOMAIN | Used in `services/knowledge-workflow.service.ts` |

## Summary Statistics
* **Total number of REVIEW collections checked**: 44
* **Number with production documents > 0**: UNAVAILABLE
* **Number with zero documents**: UNAVAILABLE
* **Number requiring migration (MIGRATE)**: 16
* **Number excluded (EXCLUDE)**: 1
* **Number duplicate/legacy (DUPLICATE / LEGACY)**: 3
* **Number requiring separate design (SEPARATE DOMAIN or CONFIG / SETTINGS)**: 15
* **Number needing further investigation (NEEDS INVESTIGATION)**: 9

## Special Checks and Observations
1. **`donationCampaigns` vs `donation_campaigns`**:
   - `donationCampaigns` has the actual active service class (`services/donationCampaign.service.ts`).
   - `donation_campaigns` is likely a legacy duplicate.
2. **`poojas` vs `dailyPoojas`**:
   - `poojas` is a legacy collection; the application actively queries `dailyPoojas` via `services/pooja.service.ts` and maps it to `daily_poojas` in Supabase.
3. **`gallery` vs `galleryAlbums`/`galleryMedia`**:
   - `gallery` appears to be legacy data structure replaced by the `galleryAlbums`/`galleryMedia` tables which are already part of the `MIGRATE` scope.
4. **`settings`**:
   - The application relies on `settings` for site configuration (`socialLinks`, `site settings`, etc.). A migration strategy needs to route distinct settings documents to multiple separate tables (e.g., `social_links`, `site_settings`, `settings_documents`).
5. **`homepage`**:
   - Handled via config map similar to `settings`.
6. **`panchanga`**:
   - Uses a local JSON/Python pipeline (`data/panchanga/`), does not require a database migration unless backend storage is redesigned.
7. **`temple_areas`**:
   - Treated as static/seed data (referencing JSON seed files), not dynamic user data in Firestore.
8. **`members`**:
   - Memory hints at valid public/admin usage in relation to volunteer/service functionality, recommending it for MIGRATE rather than discarding it.
9. **`bills`, `receipts`, `receiptSevas`**:
   - `receipts` and `receiptSevas` represent financial/transactional entities tied to the admin receipt module and the Seva Bookings public UI. Definitely require dedicated tables.
10. **AI and Knowledge collections**:
   - All `ai_*` and `knowledge_*` collections represent a distinct product domain and should be mapped out separately from standard portal data.
