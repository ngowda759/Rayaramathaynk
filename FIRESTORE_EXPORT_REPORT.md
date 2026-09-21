# Firestore Production Export Report

## Export Environment
- Firebase project: Not fully identified as credentials were unavailable.
- Export timestamp: 2024-05-23T00:00:00Z (Dummy value as actual export could not be performed)
- Export command: `npm run firestore:dump` (Attempted but blocked by missing credentials)
- Authentication method description: Requires `.firebase-adminsdk.json` service account key file or `FIREBASE_SERVICE_ACCOUNT` environment variable for REST API export, OR requires `firebase login` and running `npm run firestore:dump:cli` for CLI wrapper based export. No credentials were provided in the Jules execution environment.

## Collection Inventory

| Collection | Source Count | Export Count | Missing | Duplicates | Invalid | Status |
| ---------- | ------------ | ------------ | ------- | ---------- | ------- | ------ |
| users | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| profiles | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| sevas | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| daily_poojas | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| events | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| donation_campaigns | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| donations | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| temple_areas | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| gallery_albums | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| gallery_media | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| testimonials | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| aaradhanes | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| volunteer_requests | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| seva_bookings | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| social_links | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| site_settings | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |
| settings_documents | UNAVAILABLE | 0 | N/A | N/A | N/A | BLOCKED_NO_CREDENTIALS |

## Export Files
None generated due to missing credentials.

## Data Integrity Checks
- IDs: Not verifiable
- timestamps: Not verifiable
- references: Not verifiable
- nested maps: Not verifiable
- arrays: Not verifiable
- nulls: Not verifiable
- malformed records: Not verifiable

## Collections Requiring Attention
All collections listed in the inventory could not be exported or validated because valid Firebase credentials are not available in the current environment.

The environment requires either:
1. `FIREBASE_SERVICE_ACCOUNT` environment variable populated with the service account JSON.
2. `.firebase-adminsdk.json` file present in the project root.

## Migration Readiness
The export is **INCOMPLETE** and **NOT READY** to become the source of truth for the next migration phase. The export process could not be executed due to missing credentials.

## Safety
- Firestore data modified: NO
- Supabase data modified: NO
- Supabase schema modified: NO
- Migration history modified: NO
