# Phase 2 Batch 1 Migration Dry Run Report

**Status**: BLOCKED

**Reason**: Live database credentials (`firebase-admin.json` or Supabase environment variables) are missing and could not be retrieved via `npx vercel env pull .env.local` due to lack of Vercel authentication.

## Expected Batch 1 Collections
1. `aaradhane` -> `aaradhanes`
2. `aaradhanes` -> `aaradhanes`
3. `ai_intent_distribution` -> `ai_intent_distribution`
4. `ai_latency_records` -> `ai_latency_records`
5. `chat_messages` -> `chat_messages`
6. `chat_sessions` -> `chat_sessions`
7. `dailyPoojas` -> `daily_poojas`
8. `galleryAlbums` -> `gallery_albums`
9. `galleryMedia` -> `gallery_media`
10. `sevas` -> `sevas`

## Validation Results
Could not be executed. The task is BLOCKED because live database credentials for Firestore and Supabase are missing.

## Analysis: `aaradhane` vs `aaradhanes`
Both `aaradhane` and `aaradhanes` collections map to the same destination Supabase table `aaradhanes`.
Since both will be inserting/updating into the same table using the `firestore_id` as the primary key/conflict resolution key, there is a high risk of collisions if the source Firestore collections have overlapping document IDs. We need to fetch and compare both collections to determine if overlapping IDs contain conflicting data before running this batch in production. A collision would result in one collection's record overwriting the other's during migration.
