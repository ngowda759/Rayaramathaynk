# Phase 2 Batch 1 Migration Dry Run Report

**Status**: PENDING EXECUTABLE WORKFLOW RUN
(Execute the "Batched Firestore to Supabase Migration" GitHub Action to populate these results.)

**Reason**: The GitHub Action `.github/workflows/firestore-batched-migration.yml` has been updated to use the repository's `FIREBASE_SERVICE_ACCOUNT_JSON` secret (as was successfully used in Phase 1). Please trigger the action via `workflow_dispatch` (it defaults to `batch=1`, `batch_size=10`, `dry_run=true`, `retry_failed=false`). The output artifact (`migration-report`) will determine the final PASS/BLOCKED state.

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

## Validation Results (Placeholders for GH Actions Output)

| collection | source docs | destination table | existing rows | planned inserts | planned updates | validation failures | write failures |
|------------|-------------|-------------------|---------------|-----------------|-----------------|---------------------|----------------|
| `aaradhane` | TBD | `aaradhanes` | TBD | TBD | TBD | TBD | TBD |
| `aaradhanes` | TBD | `aaradhanes` | TBD | TBD | TBD | TBD | TBD |
| `ai_intent_distribution` | TBD | `ai_intent_distribution` | TBD | TBD | TBD | TBD | TBD |
| `ai_latency_records` | TBD | `ai_latency_records` | TBD | TBD | TBD | TBD | TBD |
| `chat_messages` | TBD | `chat_messages` | TBD | TBD | TBD | TBD | TBD |
| `chat_sessions` | TBD | `chat_sessions` | TBD | TBD | TBD | TBD | TBD |
| `dailyPoojas` | TBD | `daily_poojas` | TBD | TBD | TBD | TBD | TBD |
| `galleryAlbums` | TBD | `gallery_albums` | TBD | TBD | TBD | TBD | TBD |
| `galleryMedia` | TBD | `gallery_media` | TBD | TBD | TBD | TBD | TBD |
| `sevas` | TBD | `sevas` | TBD | TBD | TBD | TBD | TBD |

## Analysis: `aaradhane` vs `aaradhanes`
Both collections map to the same destination Supabase table `aaradhanes`.
Since both will be inserting/updating into the same table using the `firestore_id` as the primary key/conflict resolution key, there is a high risk of collisions if the source Firestore collections have overlapping document IDs.

**Reviewer Action Required**: Upon running the GitHub Action dry run, check the `migration-report` artifact. Ensure that the total `planned inserts` + `planned updates` across both collections do not inadvertently mask an ID collision (i.e., verify if duplicate `firestore_id` errors are reported or if documents silently overwrite one another). If a collision is reported, the task is **BLOCKED**.

## Final Result (To be determined by CI)
If Validation failures = 0 and Write failures = 0 across all 10 collections: **PASS**
Otherwise: **BLOCKED**
