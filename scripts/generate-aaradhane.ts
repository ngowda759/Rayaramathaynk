#!/usr/bin/env npx ts-node
/**
 * Aaradhane Event Generator Script
 * 
 * Generates all Guru Aaradhane events for a given year based on Hindu Panchanga.
 * Reads lunar calendar data from Firestore (guruParampara collection).
 * Updates Firestore with the generated events.
 * 
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year 2027
 *   npm run generate:aaradhane
 * 
 * Options:
 *   --year N          Generate events for year N (default: current year + 1)
 *   --dry-run         Don't update Firestore, just show what would be created
 *   --check           Only check if data exists, don't generate
 *   --seed            Seed Guru Parampara data to Firestore first
 */

import * as fs from "fs";
import * as path from "path";
import { parseArgs } from "util";

// Set timezone for consistent date handling
process.env.TZ = "Asia/Kolkata";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("GURU AARADHANE EVENT GENERATOR");
  console.log("=".repeat(60));
  
  // Parse command line arguments
  const { values } = parseArgs({
    options: {
      year: { type: "string", short: "y" },
      "dry-run": { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      seed: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  
  // Show help
  if (values.help) {
    showHelp();
    process.exit(0);
  }
  
  // Determine year
  let targetYear: number;
  if (values.year) {
    targetYear = parseInt(values.year, 10);
    if (isNaN(targetYear)) {
      console.error("Error: Invalid year specified");
      process.exit(1);
    }
  } else {
    // Default to next year
    const now = new Date();
    targetYear = now.getFullYear() + 1;
    console.log(`\nNo year specified. Generating events for ${targetYear} (next year)`);
  }
  
  console.log(`\nTarget Year: ${targetYear}`);
  console.log(`Timezone: Asia/Kolkata`);
  
  // Check if Panchanga data exists
  const panchangaDir = path.join(process.cwd(), "data", "panchanga", String(targetYear));
  
  if (!fs.existsSync(panchangaDir)) {
    console.error(`\n❌ Error: Panchanga data not found for year ${targetYear}`);
    console.error(`\nExpected location: ${panchangaDir}`);
    console.error("\nPlease generate Panchanga data first by running:");
    console.error(`  python scripts/generate_panchanga.py`);
    console.error("\nOr use the GitHub Actions workflow to generate Panchanga data.");
    process.exit(1);
  }
  
  // Count available Panchanga files
  const panchangaFiles = fs.readdirSync(panchangaDir).filter(f => f.endsWith(".json"));
  console.log(`Panchanga data: ${panchangaFiles.length} days found`);
  
  // Optionally seed Guru Parampara data first
  if (values.seed) {
    console.log("\n" + "-".repeat(60));
    console.log("SEEDING GURU PARAMPARA DATA");
    console.log("-".repeat(60));
    
    try {
      const { seedGuruParampara } = await import("./seed-guru-parampara");
      const seeded = await seedGuruParampara(false);
      if (!seeded) {
        console.log("\n⚠️ Could not seed Guru Parampara data. Continuing anyway...");
      }
    } catch (e) {
      console.log("\n⚠️ Could not seed Guru Parampara data:", e);
    }
  }
  
  if (values.check) {
    // Check Guru Parampara data in Firestore
    const { hasGuruParamparaData, getGuruAaradhaneCount } = await import("../lib/aaradhane/firestore-source");
    
    console.log("\n" + "-".repeat(60));
    console.log("CHECKING DATA AVAILABILITY");
    console.log("-".repeat(60));
    
    const hasGuruData = await hasGuruParamparaData();
    console.log(`Guru Parampara data in Firestore: ${hasGuruData ? "✓ Found" : "✗ Not found"}`);
    
    if (hasGuruData) {
      const count = await getGuruAaradhaneCount();
      console.log(`Guru Aaradhane records: ${count}`);
    }
    
    console.log(`Panchanga data for ${targetYear}: ${panchangaFiles.length > 0 ? "✓ Found" : "✗ Not found"}`);
    console.log("\n✓ All checks passed");
    process.exit(0);
  }
  
  // Load generator modules
  const { generateAaradhanaeEvents, printGenerateSummary, validateGeneratedEvents } = 
    await import("../lib/aaradhane/generator");
  const { updateFirestoreEvents, printUpdateSummary } = 
    await import("../lib/aaradhane/firestore");
  
  // Generate events
  console.log("\n" + "-".repeat(60));
  console.log("STEP 1: Reading Guru Parampara from Firestore");
  console.log("-".repeat(60));
  
  try {
    const generateResult = await generateAaradhanaeEvents(targetYear);
    
    // Print generation summary
    printGenerateSummary(generateResult, targetYear);
    
    // Validate events
    console.log("\n" + "-".repeat(60));
    console.log("STEP 2: Validating Generated Events");
    console.log("-".repeat(60));
    
    const validation = validateGeneratedEvents(generateResult, targetYear);
    
    if (!validation.valid) {
      console.warn("\n⚠️ Validation warnings:");
      for (const error of validation.errors) {
        console.warn(`  - ${error}`);
      }
    } else {
      console.log("\n✓ All events validated successfully");
    }
    
    if (values["dry-run"]) {
      console.log("\n" + "=".repeat(60));
      console.log("DRY RUN MODE - No changes made to Firestore");
      console.log("=".repeat(60));
      console.log("\nTo apply changes, run without --dry-run flag");
      process.exit(0);
    }
    
    // Update Firestore
    console.log("\n" + "-".repeat(60));
    console.log("STEP 3: Updating Firestore");
    console.log("-".repeat(60));
    
    try {
      const updateResult = await updateFirestoreEvents(
        generateResult.events,
        targetYear,
        true
      );
      
      // Print update summary
      printUpdateSummary(updateResult);
      
      console.log("\n" + "=".repeat(60));
      console.log("GENERATION COMPLETE");
      console.log("=".repeat(60));
      console.log("\nGenerated Events:");
      console.log(`  Total: ${generateResult.summary.total}`);
      console.log(`\nFirestore Operations:`);
      console.log(`  Created: ${updateResult.summary.created}`);
      console.log(`  Updated: ${updateResult.summary.updated}`);
      console.log(`  Skipped: ${updateResult.summary.skipped}`);
      console.log(`  Errors: ${updateResult.summary.errors}`);
      
      if (updateResult.summary.errors > 0) {
        console.log("\n⚠️ Some operations failed. Check errors above.");
        process.exit(1);
      }
      
    } catch (firestoreError) {
      console.error("\n❌ Firestore update failed:", firestoreError);
      console.error("\nNote: Make sure you have Firebase Admin SDK configured.");
      console.error("For local development, you may need to set up service account credentials.");
      process.exit(1);
    }
    
  } catch (generationError) {
    console.error("\n❌ Event generation failed:", generationError);
    
    // Provide helpful error messages
    const errorMsg = generationError instanceof Error ? generationError.message : String(generationError);
    
    if (errorMsg.includes("Firebase not configured")) {
      console.error("\nFirebase is not configured. Please set up Firebase.");
      console.error("\nRun with --seed first to seed Guru Parampara data:");
      console.error("  npm run generate:aaradhane -- --seed --year 2027");
    } else if (errorMsg.includes("Guru Parampara")) {
      console.error("\nGuru Parampara data not found in Firestore.");
      console.error("\nRun with --seed to initialize the data:");
      console.error("  npm run generate:aaradhane -- --seed");
    } else if (errorMsg.includes("Panchanga")) {
      console.error("\nPanchanga data not found.");
      console.error("\nGenerate Panchanga data first:");
      console.error("  python scripts/generate_panchanga.py");
    }
    
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
AARADHANE EVENT GENERATOR

Generates Guru Aaradhane events for a given year based on Hindu Panchanga.
Reads lunar calendar configuration from Firestore.

USAGE:
  npx ts-node scripts/generate-aaradhane.ts [OPTIONS]
  npm run generate:aaradhane -- [OPTIONS]

OPTIONS:
  --year, -y N     Generate events for year N (default: next year)
  --dry-run        Show what would be created without updating Firestore
  --check          Check data availability (Firestore + Panchanga)
  --seed           Seed Guru Parampara data to Firestore first
  --help, -h       Show this help message

WORKFLOW:
  1. First time: Run with --seed to initialize Guru Parampara data
  2. Generate events for a year
  3. Events automatically appear in Admin → Events

EXAMPLES:
  # First time setup - seed Guru Parampara data
  npm run generate:aaradhane -- --seed

  # Generate events for next year
  npm run generate:aaradhane

  # Generate events for a specific year
  npm run generate:aaradhane -- --year 2027

  # Check data availability
  npm run generate:aaradhane -- --check

  # Dry run to see what would be created
  npm run generate:aaradhane -- --dry-run --year 2027

DATA SOURCE:
  - Guru Parampara lunar calendar data: Firestore (guruParampara collection)
  - Panchanga data: data/panchanga/{year}/ directory

MAINTENANCE:
  - Add/edit Gurus in Admin → Settings → Guru Parampara
  - Lunar calendar data is stored in Firestore
  - Next January run automatically picks up changes

For Panchanga data generation:
  python scripts/generate_panchanga.py
`);
}

// Run main function
main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
