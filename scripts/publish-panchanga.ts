/**
 * Publish one generated Panchanga record to Supabase Storage.
 *
 * The workflow generates the JSON into a temporary file, then invokes this
 * script. Validation runs before any credential is read, so a malformed record
 * is rejected without opening a connection. `--dry-run` is the default behaviour
 * of the workflow until the owner enables publication.
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { describeStorageConfig, resolveWriteSettings } from "../lib/data-flows/config";
import { parseJson } from "../lib/data-flows/json";
import { publishPanchangaRecord } from "../lib/data-flows/panchanga-publisher";
import { validatePanchangaRecord } from "../lib/data-flows/schemas";
import { createSupabaseStorage } from "../lib/data-flows/storage";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      date: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  if (!values.file) {
    console.error("Usage: publish-panchanga.ts --file <path> --date <YYYY-MM-DD> [--dry-run]");
    process.exit(2);
  }

  const raw = readFileSync(values.file, "utf8");
  const parsed = parseJson(raw);
  if (!parsed.ok) {
    console.error(`Refusing to publish: ${values.file} is not valid JSON: ${parsed.error}`);
    process.exit(1);
  }

  const validation = validatePanchangaRecord(parsed.value, values.date);
  if (!validation.ok || !validation.value) {
    console.error("Refusing to publish: the generated record is invalid.");
    for (const error of validation.errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const record = validation.value;
  console.log(`Validated Panchanga record for ${record.date}`);

  if (values["dry-run"]) {
    console.log("Dry run: no object was written.");
    return;
  }

  const settings = resolveWriteSettings();
  if (!settings) {
    const summary = describeStorageConfig("write");
    console.error(
      `Publishing requires a service-role key. Missing: ${summary.missing.join(", ")}. ` +
        "No object was written."
    );
    process.exit(1);
  }

  const storage = createSupabaseStorage(settings);
  const result = await publishPanchangaRecord(storage, record, {
    expectedDate: record.date,
    generatedAt: new Date().toISOString(),
  });

  console.log(`Published ${result.dailyPath}`);
  console.log(`Verified ${result.yearPath} (${result.yearlyDayCount} days)`);
  console.log(`Updated ${result.currentPath}`);
}

main().catch((error) => {
  console.error("Panchanga publication failed:", error);
  process.exit(1);
});
