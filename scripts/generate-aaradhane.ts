#!/usr/bin/env npx ts-node
/**
 * Aaradhane Event Generator Script
 *
 * Generates all Guru Aaradhane events for a given year from the yearly Panchanga
 * dataset stored in Supabase Storage, and can publish the generated dataset back
 * to the independent Aaradhane Storage flow.
 *
 * Source data:
 *   - Guru Parampara: data/aaradhane/gurus.ts (repository data file)
 *   - Panchanga: Data_flows/Panchanga/years/YYYY.json (Supabase Storage)
 *   - Destination: Data_flows/Aaradhane/years/YYYY.json (with --publish)
 *
 * The optional `--apply` path still writes generated events to the Supabase
 * `events` table through `lib/aaradhane/supabase-writer.ts`. It is unrelated to
 * the Storage publication and is never passed by the scheduled workflow.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year 2027
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts --year 2027 --publish
 */

import { parseArgs } from "util";

import { GURU_AARADHANES } from "../data/aaradhane/gurus";
import { createSupabaseStorage } from "../lib/data-flows/storage";
import { resolveReadSettings, resolveWriteSettings } from "../lib/data-flows/config";
import { readYearlyPanchanga } from "../lib/data-flows/panchanga-reader";
import { publishAaradhaneYearDataset } from "../lib/data-flows/aaradhane-publisher";
import {
  buildAaradhaneYearDataset,
  validateAaradhaneYearDataset,
  type AaradhaneEvent,
} from "../lib/data-flows/schemas";
import { panchangaYearPath } from "../lib/data-flows/paths";
import { generateEventsFromGurus } from "../lib/aaradhane/local-generator";
import { printGenerateSummary, validateGeneratedEvents } from "../lib/aaradhane/generator";
import { yearlyPanchangaFromDataset } from "../lib/aaradhane/panchanga";
import type { GenerateResult } from "../types/aaradhane-generator";

// Consistent date handling for the generator itself.
process.env.TZ = "Asia/Kolkata";

function showHelp(): void {
  console.log(`
AARADHANE EVENT GENERATOR

Generates Guru Aaradhane events for a given year from the yearly Panchanga
dataset in Supabase Storage, and optionally publishes the generated dataset to
the independent Aaradhane Storage flow.

USAGE:
  npx ts-node --project tsconfig.scripts.json scripts/generate-aaradhane.ts [OPTIONS]

OPTIONS:
  --year, -y N     Generate events for year N (default: next year)
  --publish        Publish the generated dataset to Supabase Storage
  --apply          Write generated events to the Supabase events table
  --dry-run        Explicitly preview only. Cannot be combined with --apply.
  --check          Check that the yearly Panchanga source is reachable
  --help, -h       Show this help message

DATA SOURCES:
  - Guru Parampara: data/aaradhane/gurus.ts
  - Panchanga:      Data_flows/Panchanga/years/{year}.json (Supabase Storage)
  - Destination:    Data_flows/Aaradhane/years/{year}.json (Supabase Storage)
`);
}

async function loadYearlyPanchangaFromStorage(year: number) {
  const settings = resolveReadSettings();
  if (!settings) {
    throw new Error(
      "Supabase Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and a " +
      "read key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY)."
    );
  }

  const storage = createSupabaseStorage(settings);
  const result = await readYearlyPanchanga(storage, year);
  if (result.status !== "ok" || !result.dataset) {
    throw new Error(
      `Could not load Panchanga ${panchangaYearPath(year)} from Supabase Storage: ${result.error ?? "unknown error"}`
    );
  }
  return result.dataset;
}

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("GURU AARADHANE EVENT GENERATOR");
  console.log("=".repeat(60));

  const { values } = parseArgs({
    options: {
      year: { type: "string", short: "y" },
      apply: { type: "boolean", default: false },
      publish: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values["dry-run"] && values.apply) {
    console.error("Error: --apply and --dry-run are mutually exclusive.");
    process.exit(1);
  }
  if (values["dry-run"] && values.publish) {
    console.error("Error: --publish and --dry-run are mutually exclusive.");
    process.exit(1);
  }

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  const targetYear = values.year
    ? Number.parseInt(values.year, 10)
    : new Date().getFullYear() + 1;

  if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 2200) {
    console.error("Error: year must be a four-digit year");
    process.exit(1);
  }

  console.log(`\nTarget Year: ${targetYear}`);
  console.log("Timezone: Asia/Kolkata");

  try {
    const dataset = await loadYearlyPanchangaFromStorage(targetYear);
    console.log(`Panchanga source: ${panchangaYearPath(targetYear)} (${Object.keys(dataset.days).length} days)`);

    if (values.check) {
      console.log("\n\u2713 Panchanga source is reachable and valid");
      process.exit(0);
    }

    console.log("\n" + "-".repeat(60));
    console.log("STEP 1: Generating events from the Storage Panchanga dataset");
    console.log("-".repeat(60));

    const transformedGurus = GURU_AARADHANES.map((guru) => ({
      id: guru.id,
      guruName: guru.guruName,
      aaradhaneTitle: guru.title,
      paramparaNumber: guru.paramparaNumber,
      lunarMonth: guru.lunarMonth,
      paksha: guru.paksha,
      tithiNumber: guru.tithiNumber,
      tithi: guru.tithi,
      durationDays: guru.durationDays,
      raghavendraPhase: guru.raghavendraPhase,
      importance: guru.importance,
      enabled: true,
      description: guru.description,
    }));

    const generateResult: GenerateResult = generateEventsFromGurus(
      transformedGurus,
      yearlyPanchangaFromDataset(dataset),
      targetYear
    );
    printGenerateSummary(generateResult, targetYear);

    console.log("\n" + "-".repeat(60));
    console.log("STEP 2: Validating generated events");
    console.log("-".repeat(60));

    const eventValidation = validateGeneratedEvents(generateResult, targetYear);
    if (!eventValidation.valid) {
      console.error("Generated events failed validation:");
      for (const error of eventValidation.errors) console.error(`  - ${error}`);
      process.exit(1);
    }
    console.log("\n\u2713 All events validated successfully");

    const generatedAt = new Date().toISOString();
    const publishedDataset = buildAaradhaneYearDataset(
      targetYear,
      generateResult.events as AaradhaneEvent[],
      panchangaYearPath(targetYear),
      generatedAt
    );
    const datasetValidation = validateAaradhaneYearDataset(publishedDataset, targetYear);
    if (!datasetValidation.ok || !datasetValidation.value) {
      console.error("Generated dataset failed schema validation:");
      for (const error of datasetValidation.errors) console.error(`  - ${error}`);
      process.exit(1);
    }

    if (values.publish) {
      console.log("\n" + "-".repeat(60));
      console.log("STEP 3: Publishing the Aaradhane dataset to Supabase Storage");
      console.log("-".repeat(60));

      const writeSettings = resolveWriteSettings();
      if (!writeSettings) {
        console.error("\n\u274c Publishing requires SUPABASE_SERVICE_ROLE_KEY.");
        console.error("No object was written. Set the key and retry.");
        process.exit(1);
      }

      const writeStorage = createSupabaseStorage(writeSettings);
      const result = await publishAaradhaneYearDataset(writeStorage, datasetValidation.value);
      console.log(`\n\u2713 Published ${result.yearPath}`);
      console.log(`  Events: ${result.eventCount}`);
      console.log(`  Current updated: ${result.currentPath}`);
      console.log(`  Previous snapshot: ${result.snapshotPath ?? "(none)"}`);
    }

    if (values.apply && !values["dry-run"]) {
      console.log("\n" + "-".repeat(60));
      console.log("STEP 4: Upserting events into Supabase (legacy database path)");
      console.log("-".repeat(60));

      const { createClient } = await import("@supabase/supabase-js");
      const { writeAaradhaneEvents, printWriteSummary } =
        await import("../lib/aaradhane/supabase-writer");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.error("\n\u274c Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
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

      if (updateResult.summary.errors > 0 || updateResult.summary.refused > 0) {
        console.error("\n\u26a0\ufe0f Some rows were not written.");
        process.exit(1);
      }
    }

    if (!values.publish && !values.apply) {
      console.log("\n" + "=".repeat(60));
      console.log("DRY RUN MODE - no object or database was written");
      console.log("=".repeat(60));
      console.log("\nRe-run with --publish to write the dataset to Supabase Storage.");
    }
  } catch (error) {
    console.error("\n\u274c Event generation failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n\u274c Unexpected error:", error);
  process.exit(1);
});
