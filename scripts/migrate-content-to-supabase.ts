#!/usr/bin/env node

/**
 * Migration Script: Content Collections (Firestore -> Supabase)
 *
 * Collections: users, profiles, donation_campaigns, donations, galleryAlbums,
 *              galleryMedia, testimonials, aaradhane, volunteer_requests
 *
 * Mapping and validation live in lib/supabase/migration-mappers.ts so the exact
 * transforms are unit tested against fixtures. See that module for the
 * data-preservation rules (no synthetic timestamps, verbatim Firestore IDs,
 * no placeholder business data).
 *
 * Run with `--dry-run` to validate without writing.
 */

import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import {
  CONTENT_FIELD_SPECS,
  mapUser,
  mapProfile,
  mapDonationCampaign,
  mapDonation,
  mapGalleryAlbum,
  mapGalleryMedia,
  mapTestimonial,
  mapAaradhane,
  mapVolunteerRequest,
} from "../lib/supabase/migration-mappers";
import {
  migrateSupabaseCollection,
  reportMigrationOutcome,
  MigrationStats,
} from "../lib/supabase/migration-runner";

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=== CONTENT MIGRATION (Firestore -> Supabase) ===");
  console.log(isDryRun ? "=== DRY-RUN MODE: no data will be written ===" : "=== LIVE MODE ===");

  const results: MigrationStats[] = [];
  const collections: [string, string, (id: string, data: any) => any][] = [
    ["users", "users", mapUser],
    ["profiles", "profiles", mapProfile],
    ["donation_campaigns", "donation_campaigns", mapDonationCampaign],
    ["donations", "donations", mapDonation],
    ["galleryAlbums", "gallery_albums", mapGalleryAlbum],
    ["galleryMedia", "gallery_media", mapGalleryMedia],
    ["testimonials", "testimonials", mapTestimonial],
    ["aaradhane", "aaradhanes", mapAaradhane],
    ["volunteer_requests", "volunteer_requests", mapVolunteerRequest],
  ];

  try {
    const db = await getAdminFirestore();
    const supabase = createAdminClient();

    for (const [collection, table, mapper] of collections) {
      results.push(
        await migrateSupabaseCollection(
          db,
          supabase,
          collection,
          table,
          mapper,
          isDryRun,
          CONTENT_FIELD_SPECS[collection]
        )
      );
    }

    reportMigrationOutcome(results);
  } catch (error: any) {
    console.error("\nMigration could not run:", error?.message || error);
    console.log(`\n=== OVERALL SUMMARY ===\nRESULT: BLOCKED\nReason: ${error?.message || error}`);
    process.exit(1);
  }
}

run();
