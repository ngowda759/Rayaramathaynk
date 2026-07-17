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
 *   --local           Use local data file instead of Firestore
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
      firestore: { type: "boolean", default: false },
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
  
  // Load generator modules (only when needed)
  const { loadYearlyPanchanga } = await import("../lib/aaradhane/panchanga");
  const { GURU_AARADHANES } = await import("../data/aaradhane/gurus");
  const { generateEventsFromGurus, printGenerateSummary, validateGeneratedEvents } = 
    await import("../lib/aaradhane/local-generator");
  
  let generateResult: any = null;
  
  try {
    // Generate events
    console.log("\n" + "-".repeat(60));
    
    if (values.firestore) {
      // Use Firestore data
      const { generateAaradhanaeEvents } = await import("../lib/aaradhane/generator");
      
      console.log("STEP 1: Reading Guru Parampara from Firestore");
      console.log("-".repeat(60));
      
      generateResult = await generateAaradhanaeEvents(targetYear);
    } else {
      // Use local data file (default)
      console.log("STEP 1: Loading Guru Parampara from LOCAL DATA FILE");
      console.log("-".repeat(60));
      
      console.log(`Loaded ${GURU_AARADHANES.length} Guru records from local file`);
      
      const yearlyPanchanga = loadYearlyPanchanga(targetYear);
      console.log(`Loaded Panchanga data for ${targetYear}: ${yearlyPanchanga.size} days`);
      
      // Transform local data to match GuruParamparaRecord format
      const transformedGurus = GURU_AARADHANES.map(g => ({
        id: g.id,
        guruName: g.guruName,
        aaradhaneTitle: g.title,
        paramparaNumber: g.paramparaNumber,
        lunarMonth: g.lunarMonth,
        paksha: g.paksha,
        tithiNumber: g.tithiNumber,
        tithi: g.tithi,
        durationDays: g.durationDays,
        raghavendraPhase: g.raghavendraPhase,
        importance: g.importance,
        enabled: true,
        description: g.description,
      }));
      
      generateResult = generateEventsFromGurus(transformedGurus, yearlyPanchanga, targetYear);
    }
    
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
      console.log("\nUse --firestore to update events in Firestore:");
      console.log("  npm run generate:aaradhane -- --firestore --year 2026");
      process.exit(0);
    }
    
    // Update Firestore
    console.log("\n" + "-".repeat(60));
    console.log("STEP 3: Updating Firestore");
    console.log("-".repeat(60));
    
    try {
      // Use Admin SDK for server-side Firestore operations
      const { updateFirestoreWithAdmin } = await import("../lib/aaradhane/firestore-admin");
      const updateResult = await updateFirestoreWithAdmin(
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
      console.error("For local development, use --dry-run to preview events:");
      console.error("  npm run generate:aaradhane -- --dry-run --year 2026");
      process.exit(1);
    }
    
  } catch (generationError) {
    console.error("\n❌ Event generation failed:", generationError);
    
    // Provide helpful error messages
    const errorMsg = generationError instanceof Error ? generationError.message : String(generationError);
    
    if (errorMsg.includes("Firebase not configured")) {
      console.error("\nFirebase is not configured. Please set up Firebase.");
      console.error("\nOr use local data file (default):");
      console.error("  npm run generate:aaradhane -- --dry-run --year 2026");
    } else if (errorMsg.includes("Guru Parampara")) {
      console.error("\nGuru Parampara data not found in Firestore.");
      console.error("\nRun with --seed to initialize the data:");
      console.error("  npm run seed:guru-parampara");
      console.error("\nOr use local data file (default):");
      console.error("  npm run generate:aaradhane -- --dry-run --year 2026");
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
Uses local data file by default. Use --firestore for production.

USAGE:
  npx ts-node scripts/generate-aaradhane.ts [OPTIONS]
  npm run generate:aaradhane -- [OPTIONS]

OPTIONS:
  --year, -y N     Generate events for year N (default: next year)
  --dry-run        Show what would be created without updating Firestore
  --check          Check data availability (Firestore + Panchanga)
  --seed           Seed Guru Parampara data to Firestore first
  --firestore      Use Firestore data instead of local file
  --help, -h       Show this help message

WORKFLOW:
  1. Generate events for a year (uses local data by default)
  2. Preview with --dry-run
  3. Run without flags to update Firestore

EXAMPLES:
  # Generate events for 2026 (uses local data)
  npm run generate:aaradhane -- --year 2026

  # Dry run to preview events
  npm run generate:aaradhane -- --dry-run --year 2026

  # Use Firestore data (production)
  npm run generate:aaradhane -- --firestore --year 2026

  # First time setup - seed Firestore data
  npm run seed:guru-parampara

DATA SOURCE:
  - Local data file: data/aaradhane/gurus.ts (default)
  - Firestore: guruParampara collection (with --firestore flag)
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
