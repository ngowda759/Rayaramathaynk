# Batch 3 Investigation Report

Based on the investigation into `lib/supabase/migration-inventory.ts` and `scripts/migrate-all-batched.ts`:

1. **Inspect the current migration inventory used by `scripts/migrate-all-batched.ts`:**
   The inventory is defined in `lib/supabase/migration-inventory.ts`. It contains an array of `InventoryItem` objects classified as `MIGRATE`, `EXCLUDE_AUTH`, `EXCLUDE_SYSTEM`, or `REVIEW`.

2. **List the complete collection inventory and show which collections belong to Batch 1 and Batch 2:**
   There are exactly **14** collections marked with `classification: "MIGRATE"` in `MIGRATION_INVENTORY`:
   - `sevas`
   - `dailyPoojas`
   - `events`
   - `galleryAlbums`
   - `galleryMedia`
   - `testimonials`
   - `aaradhane`
   - `aaradhanes`
   - `volunteer_requests`
   - `chat_sessions`
   - `chat_messages`
   - `unknown_questions`
   - `ai_intent_distribution`
   - `ai_latency_records`

   The `getBatchedMigratableCollections` function sorts these 14 alphabetically and splits them by the `batchSize` of 10:
   - **Batch 1 (10 items):** `aaradhane`, `aaradhanes`, `ai_intent_distribution`, `ai_latency_records`, `chat_messages`, `chat_sessions`, `dailyPoojas`, `events`, `galleryAlbums`, `galleryMedia`
   - **Batch 2 (4 items):** `sevas`, `testimonials`, `unknown_questions`, `volunteer_requests`

3. **Verify whether Batch 1 and Batch 2 together cover ALL intended Firestore collections:**
   Yes, Batch 1 and Batch 2 cover 100% of the currently approved `MIGRATE` scope (the 14 collections explicitly configured with `classification: "MIGRATE"`). However, this does not mean the entire Firebase → Supabase migration is complete, as there are other collections awaiting review.

4. **Compare this against the authoritative migration inventory/configuration:**
   `docs/SUPABASE_DATABASE_SCHEMA.md` shows that other tables exist and are mapped (e.g. `settings_documents`, `social_links`, `site_settings`, `seva_bookings`, `donations`, `donation_campaigns`).
   In `lib/supabase/migration-inventory.ts`, the corresponding Firestore collections are currently marked as **`REVIEW`** rather than `MIGRATE`. Collections marked as `REVIEW` are actively, intentionally excluded by the migration planner and require separate investigation/approval before migration.

5. **Confirm whether any collections are missing from the inventory:**
   No collections are missing from the inventory itself. The inventory in `migration-inventory.ts` accurately tracks all known collections. However, several collections (such as `donations`, `donationCampaigns`, `sevaBookings`, `profiles`, `settings`) are classified as `REVIEW`. Since they are `REVIEW`, the batch script intentionally excludes them from the migratable total, keeping the migratable count at 14 (which perfectly fits into 2 batches of 10).

6. **Verify that the successful Batch 1 and Batch 2 checkpoints/manifests account for all intended collections:**
   Batch 1 and Batch 2 perfectly account for the 14 currently active `MIGRATE` items in the codebase.

7. **Do not rerun Batch 1 or Batch 2:**
   Understood.

8. **Do not change database schema or migration mappings:**
   Understood.

9. **Do not modify batching behavior merely to make Batch 3 possible:**
   Understood.

### Conclusion and Safest Minimal Fix
The error `Error: Batch 3 requested, but only 2 batches available` is accurate because there are only 14 collections currently configured for migration.
**No Batch 3 is required** based on the *current* `MIGRATE` classification.

If the collections currently in `REVIEW` (`donations`, `donationCampaigns`, `sevaBookings`, `settings`, `profiles`) are later approved for migration, the safest minimal fix will be to change their `classification` from `"REVIEW"` to `"MIGRATE"` in `lib/supabase/migration-inventory.ts` and add the `destinationTable` property to each. This will increase the total migratable collections beyond 20, naturally spawning a Batch 3.

No code changes have been made to logic, schemas, or inventory classifications as per instructions.
