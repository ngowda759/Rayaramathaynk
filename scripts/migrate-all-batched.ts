#!/usr/bin/env node

/**
 * Migration Script: Batched execution
 */
import * as fs from "fs";
import * as path from "path";
import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import { migrateSupabaseCollection } from "../lib/supabase/migration-runner";
import { MIGRATION_INVENTORY, getBatchedMigratableCollections, InventoryItem, EXCLUDED_AUTH_COLLECTIONS } from "../lib/supabase/migration-inventory";
import * as Mappers from "../lib/supabase/migration-mappers";

export interface ManifestRecord {
  collection: string;
  destination: string | undefined;
  batch: number;
  status: "SUCCESS" | "FAILED" | "PARTIAL" | "SKIPPED";
  sourceCount: number;
  destinationCount: number | null;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  startedAt: string;
  completedAt: string;
  verificationStatus: "PASS" | "FAIL" | "UNKNOWN";
  failureReason?: string;
}

export interface Manifest {
  runId: string;
  overallStatus: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
  inventoryVersion: string;
  migrationType: "production" | "dry-run";
  batchSize: number;
  checkpointVersion?: string;
  checkpointSourceRunId?: string;
  checkpointSourceBranch?: string;
  excludedCollections: string[];
  reviewedCollections: string[];
  records: Record<string, ManifestRecord>;
}

export function validateMigrationCheckpoint(manifest: Manifest | null, args: ReturnType<typeof parseArgs>): boolean {
  if (!manifest) return false;

  if (!manifest.migrationType) {
    console.warn("Discarding checkpoint: Missing migrationType metadata.");
    return false;
  }

  if (manifest.migrationType === "dry-run" && !args.dryRun) {
    console.warn("Discarding checkpoint: Cannot use dry-run checkpoint for live migration run.");
    return false;
  }

  if (manifest.inventoryVersion !== "1.0") {
    console.warn(`Discarding checkpoint: Incompatible inventoryVersion ${manifest.inventoryVersion}.`);
    return false;
  }

  if (manifest.batchSize !== args.batchSize && manifest.batchSize !== undefined) {
    console.warn(`Discarding checkpoint: Batch size mismatch (checkpoint: ${manifest.batchSize}, current: ${args.batchSize}).`);
    return false;
  }

  if (!manifest.records || typeof manifest.records !== "object") {
    console.warn("Discarding checkpoint: Invalid or missing records structure.");
    return false;
  }

  return true;
}

export function getMapperFn(collection: string): ((id: string, data: any) => any) | null {
  const mapperMap: Record<string, keyof typeof Mappers> = {
    "sevas": "mapSeva",
    "dailyPoojas": "mapDailyPooja",
    "events": "mapEvent",
    "donations": "mapDonation",
    "donationCampaigns": "mapDonationCampaign",
    "donation_campaigns": "mapDonationCampaign",
    "galleryAlbums": "mapGalleryAlbum",
    "galleryMedia": "mapGalleryMedia",
    "testimonials": "mapTestimonial",
    "aaradhane": "mapAaradhane",
    "aaradhanes": "mapAaradhane",
    "sevaBookings": "mapSevaBooking",
    "volunteer_requests": "mapVolunteerRequest",
    "chat_sessions": "mapChatSession",
    "chat_messages": "mapChatMessage",
    "unknown_questions": "mapUnknownQuestion",
    "ai_intent_distribution": "mapIntentDistribution",
    "ai_latency_records": "mapLatencyRecord",
    "settings": "mapSettingsDocument",
    "homepage": "mapSettingsDocument",
  };

  const mapperName = mapperMap[collection];
  if (mapperName && typeof Mappers[mapperName] === "function") {
    return Mappers[mapperName] as any;
  }

  return null;
}

export function parseArgs(argv: string[]) {
  const args = {
    batch: -1,
    batchSize: 10,
    collections: [] as string[],
    retryFailed: false,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--batch" && i + 1 < argv.length) {
      args.batch = parseInt(argv[++i], 10);
    } else if (arg === "--batch-size" && i + 1 < argv.length) {
      args.batchSize = parseInt(argv[++i], 10);
    } else if (arg === "--collections" && i + 1 < argv.length) {
      args.collections = argv[++i].split(",").map(s => s.trim()).filter(Boolean);
    } else if (arg === "--retry-failed") {
      args.retryFailed = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

export function buildExecutionPlan(args: ReturnType<typeof parseArgs>, manifest: Manifest | null) {
  if (!validateMigrationCheckpoint(manifest, args)) {
    manifest = null;
  }

  if (args.retryFailed && args.collections.length === 0 && args.batch <= 0) {
    throw new Error("retry-failed requires either --batch or --collections to be specified.");
  }

  const allBatches = getBatchedMigratableCollections(args.batchSize);
  let collectionsToRun: { item: InventoryItem, batchIndex: number }[] = [];

  if (args.collections.length > 0) {
    for (const col of args.collections) {
      const inventoryItem = MIGRATION_INVENTORY.find(i => i.collection === col);
      if (!inventoryItem) {
        throw new Error(`Collection ${col} not found in inventory.`);
      }
      if (inventoryItem.classification === "EXCLUDE_AUTH") {
        throw new Error(`Collection ${col} is an authentication collection and MUST NOT be migrated.`);
      }
      if (inventoryItem.classification === "EXCLUDE_SYSTEM") {
        throw new Error(`Collection ${col} is a system collection and MUST NOT be migrated.`);
      }
      if (inventoryItem.classification === "REVIEW") {
        throw new Error(`Collection ${col} is marked for REVIEW. Its destination mapping must be approved first before it can be migrated.`);
      }
      if (inventoryItem.classification !== "MIGRATE") {
        throw new Error(`Collection ${col} has classification ${inventoryItem.classification} and cannot be migrated.`);
      }

      let batchIndex = 1;
      for (let i = 0; i < allBatches.length; i++) {
        if (allBatches[i].some(c => c.collection === col)) {
          batchIndex = i + 1;
          break;
        }
      }

      collectionsToRun.push({ item: inventoryItem, batchIndex });
    }
  } else if (args.batch > 0) {
    if (args.batch > allBatches.length) {
      throw new Error(`Batch ${args.batch} requested, but only ${allBatches.length} batches available.`);
    }
    const batchItems = allBatches[args.batch - 1];
    collectionsToRun = batchItems.map(item => ({ item, batchIndex: args.batch }));
  } else {
    // If no batch is specified, no collections are explicitly requested
    // Then we do NOT execute all batches by default.
    collectionsToRun = [];
  }

  if (args.retryFailed && manifest) {
    collectionsToRun = collectionsToRun.filter(runItem => {
      const record = manifest.records[runItem.item.collection];
      return !record || record.status !== "SUCCESS";
    });
  }

  return { collectionsToRun, allBatchesCount: allBatches.length };
}

export async function executePlan(
  plan: ReturnType<typeof buildExecutionPlan>,
  args: ReturnType<typeof parseArgs>
) {
  const db = await getAdminFirestore();
  const supabase = createAdminClient();

  const manifestPath = path.join(process.cwd(), "data", "migration-manifest.json");
  const dataDir = path.dirname(manifestPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let manifest: Manifest | null = null;
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }

  if (!validateMigrationCheckpoint(manifest, args)) {
    manifest = null;
  }

  if (!manifest) {
    manifest = {
      runId: new Date().toISOString(),
      overallStatus: "RUNNING",
      inventoryVersion: "1.0",
      migrationType: args.dryRun ? "dry-run" : "production",
      batchSize: args.batchSize,
      checkpointVersion: "1.0",
      checkpointSourceRunId: process.env.CHECKPOINT_SOURCE_RUN_ID || undefined,
      checkpointSourceBranch: process.env.CHECKPOINT_SOURCE_BRANCH || undefined,
      excludedCollections: EXCLUDED_AUTH_COLLECTIONS,
      reviewedCollections: MIGRATION_INVENTORY.filter(i => i.classification === "REVIEW").map(i => i.collection),
      records: {}
    };
  } else {
    // Preserve initial run checkpoint origins or overwrite with current
    manifest.migrationType = args.dryRun ? "dry-run" : "production";
    manifest.batchSize = args.batchSize;
    if (process.env.CHECKPOINT_SOURCE_RUN_ID) {
       manifest.checkpointSourceRunId = process.env.CHECKPOINT_SOURCE_RUN_ID;
    }
    if (process.env.CHECKPOINT_SOURCE_BRANCH) {
       manifest.checkpointSourceBranch = process.env.CHECKPOINT_SOURCE_BRANCH;
    }
  }

  let overallSuccess = true;
  let partial = false;

  for (const { item, batchIndex } of plan.collectionsToRun) {
    if (!item.destinationTable) {
      console.warn(`Skipping ${item.collection} (no destination table mapped)`);
      continue;
    }

    const mapperFn = getMapperFn(item.collection);
    if (!mapperFn) {
      console.warn(`Skipping ${item.collection} (no mapper function found)`);
      overallSuccess = false;
      manifest.records[item.collection] = {
        collection: item.collection,
        destination: item.destinationTable,
        batch: batchIndex,
        status: "FAILED",
        sourceCount: 0,
        destinationCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        verificationStatus: "UNKNOWN",
        failureReason: "No mapper function found"
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      continue;
    }

    console.log(`\n=== Migrating ${item.collection} -> ${item.destinationTable} (Batch ${batchIndex}) ===`);

    const startedAt = new Date().toISOString();

    try {
      const stats = await migrateSupabaseCollection(
        db,
        supabase,
        item.collection,
        item.destinationTable,
        mapperFn,
        args.dryRun
      );

      const isSuccess = stats.reconciliation.ok && stats.validationFailures === 0 && stats.writeFailures === 0;

      if (!isSuccess) {
        overallSuccess = false;
        partial = true;
      }

      manifest.records[item.collection] = {
        collection: item.collection,
        destination: item.destinationTable,
        batch: batchIndex,
        status: isSuccess ? "SUCCESS" : "FAILED",
        sourceCount: stats.sourceCount,
        destinationCount: stats.destinationRecords,
        migratedCount: stats.inserts + stats.updates,
        skippedCount: stats.existingRecords - stats.updates,
        failedCount: stats.validationFailures + stats.writeFailures,
        startedAt,
        completedAt: new Date().toISOString(),
        verificationStatus: stats.reconciliation.ok ? "PASS" : "FAIL",
        failureReason: isSuccess ? undefined : `${stats.validationFailures} validation failures, ${stats.writeFailures} write failures. ${stats.reconciliation.details}`
      };
    } catch (err: any) {
      overallSuccess = false;
      manifest.records[item.collection] = {
        collection: item.collection,
        destination: item.destinationTable,
        batch: batchIndex,
        status: "FAILED",
        sourceCount: 0,
        destinationCount: null,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        startedAt,
        completedAt: new Date().toISOString(),
        verificationStatus: "FAIL",
        failureReason: err?.message || String(err)
      };
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  manifest.overallStatus = overallSuccess ? "SUCCESS" : (partial ? "PARTIAL" : "FAILED");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return manifest;
}

export function generateMarkdownReport(manifest: Manifest) {
  const mdPath = path.join(process.cwd(), "docs", "FIRESTORE_SUPABASE_MIGRATION_STATUS.md");

  let md = `# Firestore to Supabase Migration Status\n\n`;
  md += `*Last Updated: ${new Date().toISOString()}*\n\n`;
  md += `**Overall Status**: ${manifest.overallStatus}\n`;
  md += `**Inventory Version**: ${manifest.inventoryVersion}\n\n`;

  md += `## Summary\n\n`;
  const records = Object.values(manifest.records);
  const successCount = records.filter(r => r.status === "SUCCESS").length;
  const failedCount = records.filter(r => r.status === "FAILED").length;
  const skippedCount = records.filter(r => r.status === "SKIPPED").length;

  md += `- Successful Collections: ${successCount}\n`;
  md += `- Failed Collections: ${failedCount}\n`;
  md += `- Skipped Collections: ${skippedCount}\n\n`;

  md += `## Batch Execution Details\n\n`;
  md += `| Collection | Destination Table | Batch | Status | Source Count | Migrated Count | Failures | Verification |\n`;
  md += `|------------|-------------------|-------|--------|--------------|----------------|----------|--------------|\n`;

  records.sort((a, b) => {
    if (a.batch !== b.batch) return a.batch - b.batch;
    return a.collection.localeCompare(b.collection);
  }).forEach(record => {
    md += `| ${record.collection} | ${record.destination || "N/A"} | ${record.batch} | ${record.status} | ${record.sourceCount} | ${record.migratedCount} | ${record.failedCount} | ${record.verificationStatus} |\n`;
  });

  if (failedCount > 0) {
    md += `\n## Failure Details\n\n`;
    records.filter(r => r.status === "FAILED").forEach(record => {
      md += `### ${record.collection}\n`;
      md += `- **Reason**: ${record.failureReason || "Unknown"}\n`;
      md += `- **Failed Documents**: ${record.failedCount}\n\n`;
    });
  }

  md += `## Excluded Collections\n\n`;
  md += `The following authentication and system collections are explicitly excluded from this application data migration:\n\n`;
  manifest.excludedCollections.forEach(col => {
    md += `- ${col}\n`;
  });

  md += `\n## Collections Requiring Review\n\n`;
  md += `The following collections exist in Firestore but require schema mapping or confirmation before they can be migrated:\n\n`;
  manifest.reviewedCollections.forEach(col => {
    md += `- ${col}\n`;
  });

  const docsDir = path.dirname(mdPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(mdPath, md);
  console.log(`Generated report at ${mdPath}`);
}

if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv.slice(2));
    console.log("Args:", args);
    const manifestPath = path.join(process.cwd(), "data", "migration-manifest.json");
    let existingManifest = null;
    if (fs.existsSync(manifestPath)) {
      existingManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
    const plan = buildExecutionPlan(args, existingManifest);

    if (plan.collectionsToRun.length === 0 && args.collections.length === 0 && args.batch === -1 && !args.retryFailed) {
      console.log("No execution parameters provided. Migration aborted.");
      console.log("Available batches:");
      const allBatches = getBatchedMigratableCollections(args.batchSize);
      allBatches.forEach((batch, idx) => {
        console.log(`\nBatch ${idx + 1}:`);
        batch.forEach(b => console.log(`  - ${b.collection} -> ${b.destinationTable}`));
      });
      console.log("\nUse --batch <number> or --collections <comma_separated> to execute.");
      process.exit(0);
    }

    console.log(`Plan: ${plan.collectionsToRun.length} collections to run.`);
    if (plan.collectionsToRun.length > 0) {
      const finalManifest = await executePlan(plan, args);
      generateMarkdownReport(finalManifest);
      if (finalManifest.overallStatus !== "SUCCESS") {
        process.exitCode = 1;
      }
    }
  })();
}
