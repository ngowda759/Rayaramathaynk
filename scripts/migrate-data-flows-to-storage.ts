#!/usr/bin/env npx ts-node
/**
 * Historical Panchanga / Aaradhane migration validator.
 *
 * Dry run by default. It scans the repository's historical Panchanga files,
 * normalises the two fields the 2026 files predate (`metadata.valid_for` and
 * `metadata.timezone`), validates every record and yearly dataset, regenerates
 * the Aaradhane dataset for each year from those Panchanga records, and reports
 * coverage. Nothing is uploaded unless BOTH `--publish --confirm-production` and
 * `DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED=true` are supplied.
 *
 * Usage:
 *   npx tsx scripts/migrate-data-flows-to-storage.ts
 *   npx tsx scripts/migrate-data-flows-to-storage.ts --report /tmp/historical.json
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { GURU_AARADHANES } from "../data/aaradhane/gurus";
import { createSupabaseStorage } from "../lib/data-flows/storage";
import { describeStorageConfig, resolveWriteSettings } from "../lib/data-flows/config";
import { publishPanchangaYearDataset } from "../lib/data-flows/panchanga-publisher";
import { publishAaradhaneYearDataset } from "../lib/data-flows/aaradhane-publisher";
import {
  buildAaradhaneYearDataset,
  buildPanchangaYearDataset,
  validateAaradhaneYearDataset,
  validatePanchangaRecord,
  validatePanchangaYearDataset,
  type AaradhaneEvent,
  type PanchangaRecord,
  type PanchangaYearDataset,
} from "../lib/data-flows/schemas";
import { panchangaYearPath } from "../lib/data-flows/paths";
import { IST_TIME_ZONE, isValidDateString, isValidYear, yearOfDate } from "../lib/data-flows/time";
import { generateEventsFromGurus } from "../lib/aaradhane/local-generator";
import { validateGeneratedEvents } from "../lib/aaradhane/generator";
import { yearlyPanchangaFromDataset } from "../lib/aaradhane/panchanga";

interface YearValidation {
  year: number;
  files: number;
  valid: number;
  invalid: number;
  errors: string[];
  firstDate: string | null;
  lastDate: string | null;
  missingDays: string[];
  dataset: PanchangaYearDataset | null;
}

interface AaradhaneYearValidation {
  year: number;
  generated: number;
  legacyExportCount: number | null;
  valid: boolean;
  errors: string[];
  dataset: ReturnType<typeof buildAaradhaneYearDataset> | null;
}

interface Report {
  generatedAt: string;
  mode: "dry-run" | "publish";
  panchanga: Omit<YearValidation, "dataset">[];
  aaradhane: Omit<AaradhaneYearValidation, "dataset">[];
  totals: {
    years: number;
    records: number;
    validRecords: number;
    invalidRecords: number;
    aaradhaneYears: number;
    aaradhaneEvents: number;
  };
  published: { panchangaYears: number[]; aaradhaneYears: number[] } | null;
}

function allDatesInYear(year: number): string[] {
  const dates: string[] = [];
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  for (let ms = start; ms <= end; ms += 86_400_000) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Add the fields the older files do not have. Nothing astronomical is invented:
 * only `valid_for` (equal to the file's date) and the fixed temple timezone.
 */
function normalizeRecord(raw: unknown, dateFromFilename: string): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const record = raw as Record<string, unknown>;
  const metadata =
    typeof record.metadata === "object" && record.metadata !== null
      ? { ...(record.metadata as Record<string, unknown>) }
      : {};

  metadata.generator ??= "Rayara Panchanga Engine";
  metadata.version ??= "1.0.0";
  metadata.valid_for ??= dateFromFilename;
  metadata.timezone ??= IST_TIME_ZONE;

  const location =
    typeof record.location === "object" && record.location !== null
      ? { ...(record.location as Record<string, unknown>) }
      : record.location;
  if (typeof location === "object" && location !== null) {
    (location as Record<string, unknown>).timezone ??= IST_TIME_ZONE;
  }

  return { ...record, metadata, location };
}

function scanPanchangaYear(root: string, year: number): YearValidation {
  const dir = join(root, String(year));
  const result: YearValidation = {
    year,
    files: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    firstDate: null,
    lastDate: null,
    missingDays: [],
    dataset: null,
  };

  if (!existsSync(dir)) return result;

  const records = new Map<string, PanchangaRecord>();
  const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  result.files = files.length;

  for (const file of files) {
    const dateFromFilename = file.replace(/\.json$/, "");
    if (!isValidDateString(dateFromFilename)) {
      result.invalid++;
      result.errors.push(`${file}: filename is not a YYYY-MM-DD date`);
      continue;
    }
    if (yearOfDate(dateFromFilename) !== year) {
      result.invalid++;
      result.errors.push(`${file}: filename year does not match directory ${year}`);
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      result.invalid++;
      result.errors.push(`${file}: invalid JSON (${error instanceof Error ? error.message : "parse error"})`);
      continue;
    }

    const validation = validatePanchangaRecord(normalizeRecord(raw, dateFromFilename), dateFromFilename);
    if (!validation.ok || !validation.value) {
      result.invalid++;
      result.errors.push(`${file}: ${validation.errors.join("; ")}`);
      continue;
    }

    if (records.has(validation.value.date)) {
      result.invalid++;
      result.errors.push(`${file}: duplicate record for ${validation.value.date}`);
      continue;
    }

    records.set(validation.value.date, validation.value);
    result.valid++;
  }

  const sorted = [...records.keys()].sort();
  result.firstDate = sorted[0] ?? null;
  result.lastDate = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  result.missingDays = allDatesInYear(year).filter((date) => !records.has(date));

  const dataset = buildPanchangaYearDataset(year, [...records.values()], new Date().toISOString());
  const datasetValidation = validatePanchangaYearDataset(dataset, year);
  if (!datasetValidation.ok || !datasetValidation.value) {
    result.errors.push(`year dataset: ${datasetValidation.errors.join("; ")}`);
  } else {
    result.dataset = datasetValidation.value;
  }

  return result;
}

function validateAaradhaneYear(
  year: number,
  panchanga: PanchangaYearDataset,
  legacyExportPath: string
): AaradhaneYearValidation {
  const result: AaradhaneYearValidation = {
    year,
    generated: 0,
    legacyExportCount: null,
    valid: false,
    errors: [],
    dataset: null,
  };

  if (existsSync(legacyExportPath)) {
    try {
      const legacy = JSON.parse(readFileSync(legacyExportPath, "utf8")) as unknown;
      if (Array.isArray(legacy)) result.legacyExportCount = legacy.length;
    } catch {
      result.errors.push(`${legacyExportPath}: legacy export is not valid JSON`);
    }
  }

  const transformed = GURU_AARADHANES.map((guru) => ({
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

  const generated = generateEventsFromGurus(
    transformed,
    yearlyPanchangaFromDataset(panchanga),
    year
  );
  result.generated = generated.events.length;

  const generatedValidation = validateGeneratedEvents(generated, year);
  if (!generatedValidation.valid) {
    result.errors.push(...generatedValidation.errors);
  }

  const dataset = buildAaradhaneYearDataset(
    year,
    generated.events as AaradhaneEvent[],
    panchangaYearPath(year),
    new Date().toISOString()
  );
  const datasetValidation = validateAaradhaneYearDataset(dataset, year);
  if (!datasetValidation.ok || !datasetValidation.value) {
    result.errors.push(...datasetValidation.errors);
  } else {
    result.dataset = datasetValidation.value;
  }

  result.valid = result.errors.length === 0 && result.dataset !== null;
  return result;
}

function discoverYears(root: string): number[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter(isValidYear)
    .sort();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "panchanga-dir": { type: "string", default: "data/panchanga" },
      "aaradhane-exports-dir": { type: "string", default: "data/exports" },
      report: { type: "string" },
      publish: { type: "boolean", default: false },
      "confirm-production": { type: "boolean", default: false },
    },
  });

  const panchangaRoot = values["panchanga-dir"] as string;
  const exportsRoot = values["aaradhane-exports-dir"] as string;
  const years = discoverYears(panchangaRoot);

  const panchanga = years.map((year) => scanPanchangaYear(panchangaRoot, year));
  const aaradhane = panchanga
    .filter((entry): entry is YearValidation & { dataset: PanchangaYearDataset } => entry.dataset !== null)
    .map((entry) =>
      validateAaradhaneYear(
        entry.year,
        entry.dataset,
        join(exportsRoot, `aaradhane-events-${entry.year}.json`)
      )
    );

  const report: Report = {
    generatedAt: new Date().toISOString(),
    mode: values.publish ? ("publish" as const) : ("dry-run" as const),
    panchanga: panchanga.map(({ dataset: _dataset, ...entry }) => entry),
    aaradhane: aaradhane.map(({ dataset: _dataset, ...entry }) => entry),
    totals: {
      years: panchanga.length,
      records: panchanga.reduce((sum, entry) => sum + entry.files, 0),
      validRecords: panchanga.reduce((sum, entry) => sum + entry.valid, 0),
      invalidRecords: panchanga.reduce((sum, entry) => sum + entry.invalid, 0),
      aaradhaneYears: aaradhane.length,
      aaradhaneEvents: aaradhane.reduce((sum, entry) => sum + entry.generated, 0),
    },
    published: null,
  };

  console.log("Historical data-flow validation");
  console.log("=".repeat(60));
  for (const entry of panchanga) {
    console.log(
      `${entry.year}: files=${entry.files} valid=${entry.valid} invalid=${entry.invalid} ` +
        `range=${entry.firstDate ?? "-"}..${entry.lastDate ?? "-"} missingDays=${entry.missingDays.length}`
    );
    for (const error of entry.errors.slice(0, 10)) console.log(`  error: ${error}`);
    if (entry.errors.length > 10) console.log(`  ... ${entry.errors.length - 10} more errors`);
  }
  for (const entry of aaradhane) {
    console.log(
      `${entry.year} Aaradhane: generated=${entry.generated} legacyExport=${entry.legacyExportCount ?? "n/a"} valid=${entry.valid}`
    );
    for (const error of entry.errors.slice(0, 10)) console.log(`  error: ${error}`);
  }
  console.log(
    `Totals: years=${report.totals.years} records=${report.totals.records} ` +
      `valid=${report.totals.validRecords} invalid=${report.totals.invalidRecords} ` +
      `aaradhaneEvents=${report.totals.aaradhaneEvents}`
  );

  const invalid = panchanga.some((entry) => entry.invalid > 0 || entry.dataset === null) ||
    aaradhane.some((entry) => !entry.valid);

  if (values.publish) {
    if (!values["confirm-production"]) {
      console.error("Refusing to publish: --confirm-production is required with --publish.");
      process.exit(1);
    }
    if (process.env.DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED !== "true") {
      console.error(
        "Refusing to publish: set DATA_FLOWS_HISTORICAL_UPLOAD_APPROVED=true after owner approval."
      );
      process.exit(1);
    }
    if (invalid) {
      console.error("Refusing to publish: the local historical dataset failed validation.");
      process.exit(1);
    }

    const settings = resolveWriteSettings();
    if (!settings) {
      const summary = describeStorageConfig("write");
      console.error(`Refusing to publish: missing ${summary.missing.join(", ")}.`);
      process.exit(1);
    }

    const storage = createSupabaseStorage(settings);
    const published = { panchangaYears: [] as number[], aaradhaneYears: [] as number[] };

    for (const entry of panchanga) {
      if (!entry.dataset) continue;
      await publishPanchangaYearDataset(storage, entry.dataset, {
        updateCurrent: false,
        overwriteExisting: false,
      });
      published.panchangaYears.push(entry.year);
      console.log(`Published Panchanga ${entry.year}`);
    }

    for (const entry of aaradhane) {
      if (!entry.dataset) continue;
      await publishAaradhaneYearDataset(storage, entry.dataset, { updateCurrent: false });
      published.aaradhaneYears.push(entry.year);
      console.log(`Published Aaradhane ${entry.year}`);
    }

    report.published = published;
  }

  if (values.report) {
    writeFileSync(values.report, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report written to ${values.report}`);
  }

  if (!values.publish) {
    console.log("Dry run: no object was written.");
  }
  if (invalid) process.exit(1);
}

main().catch((error) => {
  console.error("Historical validation failed:", error);
  process.exit(1);
});
