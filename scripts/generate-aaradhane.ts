#!/usr/bin/env npx ts-node
/**
 * Aaradhane Event Generator Script
 *
 * Generates all Guru Aaradhane events for a given year based on Hindu Panchanga.
 * Source data comes from the local `data/aaradhane/gurus.ts` file. Generated
 * events are persisted to Supabase by `lib/aaradhane/supabase-writer.ts`.
 *
 * This script never writes to Firestore. It has no Firestore import and no
 * Firestore fallback: if Supabase is unavailable the run fails, it does not
 * divert the write elsewhere.
 *
 * Writing requires an explicit --apply. Without it the run is a dry run and no
 * database connection is opened.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year 2027
 *   npm run generate:aaradhane -- --year 2027 --apply
 *
 * Options:
 *   --year N          Generate events for year N (default: current year + 1)
 *   --apply           Write to Supabase. Omit for a dry run (the default).
 *   --check           Only check if source data exists, don't generate
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
      apply: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  // `--dry-run` is retained for compatibility with existing callers (the Aaradhane
  // workflow passes it). It is a no-op that can only ever prevent a write, so a
  // combination with `--apply` is contradictory and refused rather than resolved.
  if (values["dry-run"] && values.apply) {
    console.error("Error: --apply and --dry-run are mutually exclusive.");
    process.exit(1);
  }
  
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
  
  if (values.check) {
    const { GURU_AARADHANES } = await import("../data/aaradhane/gurus");

    console.log("\n" + "-".repeat(60));
    console.log("CHECKING DATA AVAILABILITY");
    console.log("-".repeat(60));

    console.log(`Guru Aaradhane records (local data file): ${GURU_AARADHANES.length}`);
    console.log(`Panchanga data for ${targetYear}: ${panchangaFiles.length > 0 ? "\u2713 Found" : "\u2717 Not found"}`);
    console.log("\n\u2713 All checks passed");
    process.exit(0);
  }

  const { loadYearlyPanchanga } = await import("../lib/aaradhane/panchanga");
  const { GURU_AARADHANES } = await import("../data/aaradhane/gurus");
  const { generateEventsFromGurus } = await import("../lib/aaradhane/local-generator");
  const { printGenerateSummary, validateGeneratedEvents } =
    await import("../lib/aaradhane/generator");

  let generateResult: ReturnType<typeof generateEventsFromGurus>;

  try {
    console.log("\n" + "-".repeat(60));
    console.log("STEP 1: Loading Guru Parampara from LOCAL DATA FILE");
    console.log("-".repeat(60));
    console.log(`Loaded ${GURU_AARADHANES.length} Guru records from local file`);

    const yearlyPanchanga = loadYearlyPanchanga(targetYear);
    console.log(`Loaded Panchanga data for ${targetYear}: ${yearlyPanchanga.size} days`);

    const transformedGurus = GURU_AARADHANES.map((g) => ({
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
    
    if (!values.apply || values["dry-run"]) {
      console.log("\n" + "=".repeat(60));
      console.log("DRY RUN MODE - no database connection opened");
      console.log("=".repeat(60));
      console.log("\nRe-run with --apply to write the planned events to Supabase.");
      process.exit(0);
    }

    console.log("\n" + "-".repeat(60));
    console.log("STEP 3: Upserting events into Supabase");
    console.log("-".repeat(60));

    const { createClient } = await import("@supabase/supabase-js");
    const { writeAaradhaneEvents, printWriteSummary } =
      await import("../lib/aaradhane/supabase-writer");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("\n\u274c Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
      console.error("No Firestore fallback is attempted; the run stops here.");
      process.exit(1);
    }

    const updateResult = await writeAaradhaneEvents(generateResult.events, {
      client: createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
      year: targetYear,
      apply: true,
    });

    printWriteSummary(updateResult);

    console.log("\n" + "=".repeat(60));
    console.log("GENERATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`\nGenerated Events: ${generateResult.summary.total}`);
    console.log(`\nSupabase Operations:`);
    console.log(`  Created: ${updateResult.summary.created}`);
    console.log(`  Updated: ${updateResult.summary.updated}`);
    console.log(`  Refused: ${updateResult.summary.refused}`);
    console.log(`  Errors:  ${updateResult.summary.errors}`);

    if (updateResult.summary.errors > 0 || updateResult.summary.refused > 0) {
      console.log("\n\u26a0\ufe0f Some rows were not written. Check the details above.");
      process.exit(1);
    }

  } catch (generationError) {
    console.error("\n\u274c Event generation failed:", generationError);

    const errorMsg = generationError instanceof Error ? generationError.message : String(generationError);

    if (errorMsg.includes("Panchanga")) {
      console.error("\nPanchanga data not found.");
      console.error("\nGenerate Panchanga data first:");
      console.error("  python scripts/generate_panchanga.py");
    } else if (/Supabase|SUPABASE|upsert/i.test(errorMsg)) {
      console.error("\nThe Supabase write failed. No Firestore fallback is attempted.");
      console.error("Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then retry.");
    }

    process.exit(1);
  }
}

function showHelp() {
  console.log(`
AARADHANE EVENT GENERATOR

Generates Guru Aaradhane events for a given year based on Hindu Panchanga,
reading Guru Parampara data from the local data file and persisting the result
to Supabase. Firestore is not used, and there is no Firestore fallback.

USAGE:
  npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts [OPTIONS]
  npm run generate:aaradhane -- [OPTIONS]

OPTIONS:
  --year, -y N     Generate events for year N (default: next year)
  --apply          Write the planned events to Supabase (omit for a dry run)
  --dry-run        Explicitly preview only. Cannot be combined with --apply.
  --check          Check that source data is available
  --help, -h       Show this help message

WORKFLOW:
  1. Preview:   npm run generate:aaradhane -- --year 2027
  2. Apply:     npm run generate:aaradhane -- --year 2027 --apply

DATA SOURCE:
  - Guru Parampara: data/aaradhane/gurus.ts (local data file)
  - Panchanga data: data/panchanga/{year}/ directory
  - Destination:    Supabase \`events\` table (keyed by firestore_id)

For Panchanga data generation:
  python scripts/generate_panchanga.py
`);
}

// Run main function
main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
