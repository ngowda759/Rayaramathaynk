import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { toIsoString } from "../lib/supabase/migration-helpers";
import {
  mapSettingsDocument,
  isSiteSettingsDoc,
  mapEvent,
} from "../lib/supabase/migration-mappers";

const SOCIAL_LINKS_DOC = "socialLinks";

interface FailureRecord {
  id: string;
  reason: string;
  type: "validation" | "write";
}

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=== PHASE 1 MIGRATION (settings & events) ===");
  if (isDryRun) {
    console.log("=== DRY-RUN MODE: no data will be written ===");
  }

  const supabase = createAdminClient();

  // 1. Settings
  console.log("\n--- Processing 'settings' collection ---");
  const settingsFile = path.join(process.cwd(), "data", "firestore-dump", "settings.json");
  let settingsData: any[] = [];
  let settingsCount = 0;
  if (!fs.existsSync(settingsFile)) {
    console.error(`FATAL: Missing export file: ${settingsFile}.`);
    process.exit(1);
  } else {
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      if (!Array.isArray(parsed)) throw new Error("Settings dump is not an array");
      settingsData = parsed;
      settingsCount = settingsData.length;
      console.log(`Found ${settingsCount} settings documents in export.`);
    } catch (err: any) {
      console.error(`FATAL: Malformed export file ${settingsFile}: ${err.message}`);
      process.exit(1);
    }
  }

  const settingsFailures: FailureRecord[] = [];
  const siteSettingsRows: Record<string, any>[] = [];
  const socialLinkRows: Record<string, any>[] = [];
  const settingsDocumentRows: Record<string, any>[] = [];

  for (const doc of settingsData) {
    const id = doc.id || doc.name?.split("/").pop();
    const data = doc;
    delete data.id;

    try {
      if (id === SOCIAL_LINKS_DOC) {
        const row: Record<string, any> = {
          firestore_id: id,
          facebook: data.facebook ?? null,
          instagram: data.instagram ?? null,
          youtube: data.youtube ?? null,
          whatsapp: data.whatsapp ?? null,
          twitter: data.twitter ?? null,
          linkedin: data.linkedin ?? null,
          map_url: data.mapUrl ?? null,
        };
        const showFlags: [string, string][] = [
          ["showFacebook", "show_facebook"],
          ["showInstagram", "show_instagram"],
          ["showYoutube", "show_youtube"],
          ["showWhatsapp", "show_whatsapp"],
          ["showTwitter", "show_twitter"],
          ["showLinkedin", "show_linkedin"],
          ["showMap", "show_map"],
        ];
        for (const [source, column] of showFlags) {
          if (typeof data[source] === "boolean") row[column] = data[source];
        }
        socialLinkRows.push(row);
        continue;
      }

      if (isSiteSettingsDoc(data)) {
        if (typeof data.templeName !== "string" || !data.templeName.trim()) {
          throw new Error("Missing required field: templeName");
        }
        if (typeof data.contactEmail !== "string" || !data.contactEmail.trim()) {
          throw new Error("Missing required field: contactEmail");
        }

        const row: Record<string, any> = {
          firestore_id: id,
          temple_name: data.templeName,
          contact_email: data.contactEmail,
        };

        for (const [source, column] of [
          ["contactPhone", "contact_phone"],
          ["address", "address"],
          ["footerText", "footer_text"],
          ["welcomeMessage", "welcome_message"],
        ] as [string, string][]) {
          if (data[source] !== undefined && data[source] !== null) {
            row[column] = String(data[source]);
          }
        }

        const updatedAt = toIsoString(data.updatedAt);
        if (updatedAt) row.updated_at = updatedAt;

        siteSettingsRows.push(row);
        continue;
      }

      settingsDocumentRows.push(mapSettingsDocument(id, data));
    } catch (err: any) {
      settingsFailures.push({ id, reason: err?.message || "Validation error", type: "validation" });
    }
  }

  // 2. Events
  console.log("\n--- Processing 'events' collection ---");
  const eventsFile = path.join(process.cwd(), "data", "firestore-dump", "events.json");
  let eventsData: any[] = [];
  let eventsCount = 0;
  if (!fs.existsSync(eventsFile)) {
    console.error(`FATAL: Missing export file: ${eventsFile}.`);
    process.exit(1);
  } else {
    try {
      const parsed = JSON.parse(fs.readFileSync(eventsFile, "utf8"));
      if (!Array.isArray(parsed)) throw new Error("Events dump is not an array");
      eventsData = parsed;
      eventsCount = eventsData.length;
      console.log(`Found ${eventsCount} events documents in export.`);
    } catch (err: any) {
      console.error(`FATAL: Malformed export file ${eventsFile}: ${err.message}`);
      process.exit(1);
    }
  }

  const { data: existingEventsData, count: existingEventsCount, error: existingEventsError } = await supabase.from('events').select('firestore_id', { count: 'exact' });
  if (existingEventsError) {
     console.error(`FATAL: Failed to query existing events from Supabase: ${existingEventsError.message}`);
     process.exit(1);
  }
  console.log(`Supabase existing events: ${existingEventsCount || 0}`);

  const eventsFailures: FailureRecord[] = [];
  const eventRows: Record<string, any>[] = [];

  for (const doc of eventsData) {
    const id = doc.id || doc.name?.split("/").pop();
    const data = doc;
    delete data.id;

    try {
      eventRows.push(mapEvent(id, data));
    } catch (err: any) {
      eventsFailures.push({ id, reason: err?.message || "Validation error", type: "validation" });
    }
  }

  // Apply changes or dry run
  const writeFailures: FailureRecord[] = [];
  let inserts = 0;
  let updates = 0;

  const targets = [
    { table: "site_settings", rows: siteSettingsRows },
    { table: "social_links", rows: socialLinkRows },
    { table: "settings_documents", rows: settingsDocumentRows },
    { table: "events", rows: eventRows },
  ];

  for (const { table, rows } of targets) {
    console.log(`\n${table}: ${rows.length} document(s) mapped.`);
    if (rows.length === 0) continue;

    const { data: existing, error } = await supabase
      .from(table)
      .select("firestore_id")
      .in(
        "firestore_id",
        rows.map((r) => r.firestore_id)
      );

    if (error) {
      console.error(`FATAL: Failed to read from ${table}: ${error.message}`);
      process.exit(1);
    }

    const existingIds = new Set((existing || []).map((r: any) => r.firestore_id));

    let tableInserts = 0;
    let tableUpdates = 0;

    for (const row of rows) {
      if (existingIds.has(row.firestore_id)) {
        tableUpdates++;
      } else {
        tableInserts++;
      }
    }

    inserts += tableInserts;
    updates += tableUpdates;

    if (isDryRun) {
      console.log(`  [DRY RUN] Would insert: ${tableInserts}, update: ${tableUpdates}`);
      continue;
    }

    console.log(`  Inserting: ${tableInserts}, Updating: ${tableUpdates}...`);
    const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: "firestore_id" });

    if (upsertError) {
      console.warn(`Batch upsert into ${table} failed (${upsertError.message}); retrying row by row.`);
      for (const row of rows) {
        const { error: rowError } = await supabase
          .from(table)
          .upsert(row, { onConflict: "firestore_id" });
        if (rowError) {
          writeFailures.push({ id: row.firestore_id, reason: rowError.message, type: "write" });
        }
      }
    }
  }

  const totalValidationFailures = settingsFailures.length + eventsFailures.length;

  console.log("\n=== FINAL REPORT ===");
  console.log(`Source documents:      ${settingsCount + eventsCount} (settings: ${settingsCount}, events: ${eventsCount})`);
  console.log(`Planned inserts:       ${inserts}`);
  console.log(`Planned updates:       ${updates}`);
  console.log(`Validation failures:   ${totalValidationFailures}`);
  console.log(`Write failures:        ${writeFailures.length}`);

  const allFailures = [...settingsFailures, ...eventsFailures, ...writeFailures];
  if (allFailures.length > 0) {
    console.log("\nFailure details:");
    allFailures.forEach((f) => console.log(` - [${f.type.toUpperCase()}] ${f.id}: ${f.reason}`));
  }

  const modeStatus = isDryRun ? "DRY-RUN MODE" : "PRODUCTION MODE";

  const report = `# Phase 1 Migration Report

## Source
* Firestore export timestamp: ${new Date().toISOString()}
* Firebase project: sri-raghavendra-mutt
* Collections: \`settings\`, \`events\`
* Document count: Settings (${settingsCount}), Events (${eventsCount})

## Before
* Supabase events row count: ${existingEventsCount || 0}

## Migration (${modeStatus})
* Planned Inserts: ${inserts}
* Planned Updates: ${updates}
* Validation Failures: ${totalValidationFailures}
* Write Failures: ${writeFailures.length}

## After
* Migration completed ${allFailures.length === 0 ? "successfully" : "with failures"} in ${modeStatus}.
`;

  fs.writeFileSync(path.join(process.cwd(), "MIGRATION_PHASE_1_REPORT.md"), report);

  if (isDryRun) {
     console.log(`\nDRY RUN COMPLETE. ${allFailures.length > 0 ? "ERRORS ENCOUNTERED" : "SUCCESS"}`);
     if (allFailures.length > 0) process.exit(1);
     return;
  }

  if (allFailures.length > 0) {
    console.log("\nRESULT: COMPLETED WITH ERRORS");
    process.exit(1);
  }

  console.log("\nRESULT: PASS. Wrote MIGRATION_PHASE_1_REPORT.md");
}

run();
