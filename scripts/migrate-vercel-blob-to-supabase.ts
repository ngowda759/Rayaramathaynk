/**
 * Utility script to migrate existing Vercel Blob files and references to Supabase Storage.
 *
 * NOTE: This script is intended to be run manually by an administrator possessing
 * the original `BLOB_READ_WRITE_TOKEN`. The code repository itself no longer
 * has this token or the `@vercel/blob` dependency.
 *
 * Requirements to run:
 * 1. An active `BLOB_READ_WRITE_TOKEN` in your environment.
 * 2. Supabase credentials configured (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
 * 3. Temporarily install `@vercel/blob` (`npm install @vercel/blob --no-save`) to fetch the list.
 *
 * Usage:
 * npx tsx scripts/migrate-vercel-blob-to-supabase.ts
 */

import { list } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const VERCEL_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!VERCEL_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required environment variables.");
  console.error("Ensure BLOB_READ_WRITE_TOKEN, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET_NAME = 'temple-media';

async function migrateFiles() {
  console.log("Starting migration from Vercel Blob to Supabase Storage...");

  let cursor;
  let totalMigrated = 0;
  let totalFailed = 0;

  do {
    const response = await list({
      token: VERCEL_TOKEN,
      limit: 100,
      cursor,
    });

    for (const blob of response.blobs) {
      console.log(`Migrating: ${blob.pathname}...`);
      try {
        // Download from Vercel
        const res = await fetch(blob.url);
        if (!res.ok) throw new Error(`Failed to download ${blob.url}: ${res.statusText}`);
        const buffer = await res.arrayBuffer();

        // Upload to Supabase
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(blob.pathname, Buffer.from(buffer), {
            contentType: blob.contentType,
            upsert: true,
          });

        if (error) throw error;

        console.log(`✅ Success: ${blob.pathname}`);
        totalMigrated++;
      } catch (err) {
        console.error(`❌ Failed: ${blob.pathname}`, err);
        totalFailed++;
      }
    }

    cursor = response.cursor;
  } while (cursor);

  console.log("=========================================");
  console.log("Migration Complete!");
  console.log(`Migrated: ${totalMigrated}`);
  console.log(`Failed: ${totalFailed}`);
  console.log("=========================================");
  console.log("Database References:");
  console.log("After the files are migrated, you must update the database to replace");
  console.log("the old Vercel Blob URLs with the new Supabase URLs.");
  console.log("For example, running SQL like:");
  console.log(`UPDATE testimonials SET image = REPLACE(image, 'https://<your-vercel-id>.blob.vercel-storage.com/', '${SUPABASE_URL}/storage/v1/object/public/temple-media/');`);
}

migrateFiles().catch(console.error);
