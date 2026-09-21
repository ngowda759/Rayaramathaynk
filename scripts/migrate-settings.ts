import { getAdminFirestore } from "@/lib/admin-firebase";
import { createAdminClient } from "@/lib/supabase/admin";
import { toIsoString, reconcileCounts } from "@/lib/supabase/migration-helpers";
import {
  mapSettingsDocument,
  isSiteSettingsDoc,
} from "@/lib/supabase/migration-mappers";

/**
 * Settings collection migrator.
 *
 * The Firestore `settings` collection is a bag of unrelated documents keyed by
 * name. Two have dedicated normalized tables because application code already
 * reads those shapes:
 *
 *   settings/socialLinks  -> social_links
 *   <site settings doc>   -> site_settings
 *
 * Every other document (financeSettings, poojaSchedule, festivalCalendar,
 * aboutUs, trustCommittee, guruParampara, and any future settings doc such as
 * facilities/futurePlans/ai/device/config) is preserved in full inside
 * `settings_documents.data` as JSONB. Nothing is flattened and nothing is
 * silently skipped.
 *
 * No value is ever invented: absent fields are omitted so schema defaults apply,
 * and a missing NOT NULL value is a validation failure.
 */

const SOCIAL_LINKS_DOC = "socialLinks";

interface FailureRecord {
  id: string;
  reason: string;
  type: "validation" | "write";
}

async function run() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=== SETTINGS MIGRATION (Firestore -> Supabase) ===");
  if (isDryRun) {
    console.log("=== DRY-RUN MODE: no data will be written ===");
  }

  try {
    const firestore = await getAdminFirestore();
    const supabase = createAdminClient();

    const snapshot = await firestore.collection("settings").get();
    const sourceCount = snapshot.size;
    console.log(`\nFound ${sourceCount} settings documents in Firestore.`);

    if (sourceCount === 0) {
      console.log("No settings documents to migrate.");
      return;
    }

    const failures: FailureRecord[] = [];
    const siteSettingsRows: Record<string, any>[] = [];
    const socialLinkRows: Record<string, any>[] = [];
    const settingsDocumentRows: Record<string, any>[] = [];

    for (const doc of snapshot.docs) {
      const id = doc.id;
      const data = doc.data() as Record<string, any>;

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

          // Optional columns: copy only real values, let defaults apply otherwise.
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

        // Everything else is preserved losslessly as a JSONB document.
        settingsDocumentRows.push(mapSettingsDocument(id, data));
      } catch (err: any) {
        failures.push({ id, reason: err?.message || "Validation error", type: "validation" });
      }
    }

    const writeFailures: FailureRecord[] = [];

    const targets: { table: string; rows: Record<string, any>[] }[] = [
      { table: "site_settings", rows: siteSettingsRows },
      { table: "social_links", rows: socialLinkRows },
      { table: "settings_documents", rows: settingsDocumentRows },
    ];

    for (const { table, rows } of targets) {
      console.log(`\n${table}: ${rows.length} document(s) mapped.`);
      if (rows.length === 0) continue;

      if (isDryRun) {
        // Target-compatibility check only; no writes.
        const { data: existing, error } = await supabase
          .from(table)
          .select("firestore_id")
          .in(
            "firestore_id",
            rows.map((r) => r.firestore_id)
          );

        if (error) {
          for (const row of rows) {
            writeFailures.push({
              id: row.firestore_id,
              reason: `Dry-run target check failed: ${error.message}`,
              type: "write",
            });
          }
        } else {
          const existingIds = new Set((existing || []).map((r: any) => r.firestore_id));
          for (const row of rows) {
            console.log(
              `  [DRY RUN] would ${existingIds.has(row.firestore_id) ? "update" : "insert"} ${row.firestore_id}`
            );
          }
        }
        continue;
      }

      const { error } = await supabase.from(table).upsert(rows, { onConflict: "firestore_id" });
      if (error) {
        console.warn(`Batch upsert into ${table} failed; retrying row by row.`);
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

    const validationFailures = failures.filter((f) => f.type === "validation").length;

    const reconciliation = reconcileCounts({
      sourceCount,
      inserts:
        siteSettingsRows.length + socialLinkRows.length + settingsDocumentRows.length,
      updates: 0,
      validationFailures,
      writeFailures: writeFailures.length,
    });

    console.log("\n=== FINAL REPORT ===");
    console.log(`Source documents:      ${sourceCount}`);
    console.log(`site_settings:         ${siteSettingsRows.length}`);
    console.log(`social_links:          ${socialLinkRows.length}`);
    console.log(`settings_documents:    ${settingsDocumentRows.length}`);
    console.log(`Validation failures:   ${validationFailures}`);
    console.log(`Write failures:        ${writeFailures.length}`);
    console.log(`Reconciliation:        ${reconciliation.ok ? "PASS" : "FAIL"}`);
    if (!reconciliation.ok) {
      console.error(`  ${reconciliation.missing} document(s) unaccounted for.`);
      console.error(`  ${reconciliation.details}`);
    }

    const allFailures = [...failures, ...writeFailures];
    if (allFailures.length > 0) {
      console.log("\nFailure details:");
      allFailures.forEach((f) => console.log(` - [${f.type.toUpperCase()}] ${f.id}: ${f.reason}`));
    }

    if (!reconciliation.ok || allFailures.length > 0) {
      process.exit(1);
    }

    console.log("\nRESULT: PASS");
  } catch (error: any) {
    console.error("\nMigration unexpectedly failed:", error);
    console.log(`\n=== FINAL REPORT ===\nRESULT: BLOCKED\nReason: ${error?.message || error}`);
    process.exit(1);
  }
}

run();