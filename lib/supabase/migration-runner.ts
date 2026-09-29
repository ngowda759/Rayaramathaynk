/**
 * Shared collection migrator for the Firestore -> Supabase ETL scripts.
 *
 * Guarantees, uniformly across every collection:
 *  - dry-run never writes (it only validates and reads existing ids);
 *  - source documents are fully accounted for, so nothing silently disappears;
 *  - source fields with no declared disposition are reported;
 *  - a run with any validation failure, write failure, reconciliation gap or
 *    unmapped field reports a non-zero exit code.
 */

import {
  reconcileCounts,
  ReconciliationResult,
  auditFieldCoverage,
  FieldCoverageSpec,
  FieldCoverageResult,
} from "./migration-helpers";

export interface MigrationStats {
  collection: string;
  table: string;
  sourceCount: number;
  inserts: number;
  updates: number;
  validationFailures: number;
  writeFailures: number;
  /** Rows already present in the destination before this run. */
  existingRecords: number;
  /** Destination rows for this collection after the run. */
  destinationRecords: number | null;
  reconciliation: ReconciliationResult;
  fieldCoverage?: FieldCoverageResult;
}

export interface FailureRecord {
  id: string;
  reason: string;
  type: "validation" | "write" | "lookup";
}

const BATCH_SIZE = 200;

/**
 * Migrate a single Firestore collection into a Supabase table.
 *
 * `mapFn` must throw on invalid source data rather than invent values; thrown
 * errors are recorded as validation failures.
 */
export async function migrateSupabaseCollection<T extends { firestore_id: string }>(
  db: any,
  supabase: any,
  collectionName: string,
  tableName: string,
  mapFn: (id: string, data: any) => T,
  isDryRun: boolean,
  fieldSpec?: FieldCoverageSpec
): Promise<MigrationStats> {
  console.log(`\n--- ${collectionName} -> ${tableName} ---`);

  const colRef = db.collection(collectionName);

  let sourceCount = 0;
  try {
    const countSnap = await colRef.count().get();
    sourceCount = countSnap.data().count;
    console.log(`Firestore documents: ${sourceCount}`);
  } catch {
    console.warn(`Could not read count for ${collectionName}; counting as we page.`);
  }

  let processed = 0;
  let inserts = 0;
  let updates = 0;
  let validationFailures = 0;
  let writeFailures = 0;
  const failures: FailureRecord[] = [];
  const observedFields = new Set<string>();
  let existingRecords = 0;

  let query = colRef.orderBy("__name__").limit(BATCH_SIZE);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batchDocs = snapshot.docs;
    const records: T[] = [];

    for (const doc of batchDocs) {
      const raw = doc.data();
      if (fieldSpec && raw && typeof raw === "object") {
        for (const key of Object.keys(raw)) observedFields.add(key);
      }
      try {
        records.push(mapFn(doc.id, raw));
      } catch (err: any) {
        validationFailures++;
        failures.push({
          id: doc.id,
          reason: err?.message || "Validation error",
          type: "validation",
        });
      }
    }

    if (records.length > 0) {
      const ids = records.map((r) => r.firestore_id);
      const { data: existing, error: lookupError } = await supabase
        .from(tableName)
        .select("firestore_id")
        .in("firestore_id", ids);

      if (lookupError) {
        for (const record of records) {
          writeFailures++;
          failures.push({
            id: record.firestore_id,
            reason: `Lookup error: ${lookupError.message}`,
            type: "lookup",
          });
        }
      } else {
        const existingIds = new Set<string>((existing || []).map((r: any) => r.firestore_id));
        existingRecords += existingIds.size;

        if (isDryRun) {
          for (const record of records) {
            if (existingIds.has(record.firestore_id)) updates++;
            else inserts++;
          }
        } else {
          const { error } = await supabase
            .from(tableName)
            .upsert(records, { onConflict: "firestore_id" });

          if (!error) {
            for (const record of records) {
              if (existingIds.has(record.firestore_id)) updates++;
              else inserts++;
            }
          } else {
            console.warn(`Batch upsert into ${tableName} failed; retrying row by row.`);
            for (const record of records) {
              const { error: rowError } = await supabase
                .from(tableName)
                .upsert(record, { onConflict: "firestore_id" });
              if (rowError) {
                writeFailures++;
                failures.push({
                  id: record.firestore_id,
                  reason: rowError.message,
                  type: "write",
                });
              } else if (existingIds.has(record.firestore_id)) {
                updates++;
              } else {
                inserts++;
              }
            }
          }
        }
      }
    }

    processed += batchDocs.length;
    const lastVisible = batchDocs[batchDocs.length - 1];
    query = colRef.orderBy("__name__").startAfter(lastVisible).limit(BATCH_SIZE);
  }

  // When the count API is unavailable, fall back to what we actually paged.
  if (sourceCount === 0) sourceCount = processed;

  const reconciliation = reconcileCounts({
    sourceCount,
    inserts,
    updates,
    validationFailures,
    writeFailures,
  });

  let fieldCoverage: FieldCoverageResult | undefined;
  if (fieldSpec) {
    fieldCoverage = auditFieldCoverage(collectionName, observedFields, fieldSpec);
  }

  // Destination-side comparison (only meaningful against a reachable target).
  let destinationRecords: number | null = null;
  try {
    const { count } = await supabase
      .from(tableName)
      .select("firestore_id", { count: "exact", head: true });
    destinationRecords = typeof count === "number" ? count : null;
  } catch {
    destinationRecords = null;
  }

  console.log(`\nREPORT FOR: ${collectionName.toUpperCase()}`);
  console.log(`Source documents:        ${sourceCount}`);
  console.log(`Valid mappings:          ${inserts + updates + writeFailures}`);
  console.log(`Validation failures:     ${validationFailures}`);
  console.log(`Existing destination:    ${existingRecords}`);
  console.log(`Inserted:                ${inserts}`);
  console.log(`Updated:                 ${updates}`);
  console.log(`Write failures:          ${writeFailures}`);
  console.log(`Total successful:        ${inserts + updates}`);
  console.log(
    `Destination records:     ${destinationRecords === null ? "unknown" : destinationRecords}`
  );
  if (destinationRecords !== null) {
    const missingInDestination = Math.max(0, sourceCount - destinationRecords);
    const extraInDestination = Math.max(0, destinationRecords - sourceCount);
    console.log(`Missing in destination:  ${missingInDestination}`);
    console.log(`Extra in destination:    ${extraInDestination}`);
  }
  console.log(`Reconciliation:          ${reconciliation.ok ? "PASS" : "FAIL"}`);
  if (!reconciliation.ok) {
    console.error(
      `  ${reconciliation.missing} document(s) unaccounted for. ${reconciliation.details}`
    );
  }

  if (fieldCoverage) {
    if (fieldCoverage.unmapped.length > 0) {
      console.error(
        `Field coverage:          FAIL - unmapped source fields: ${fieldCoverage.unmapped.join(", ")}`
      );
    } else {
      console.log(`Field coverage:          PASS (no unmapped source fields)`);
    }
  }

  if (failures.length > 0) {
    console.log(`Failure details (first 10 of ${failures.length}):`);
    failures.slice(0, 10).forEach((f) => {
      console.log(` - [${f.type.toUpperCase()}] ${f.id}: ${f.reason}`);
    });
  }

  return {
    collection: collectionName,
    table: tableName,
    sourceCount,
    inserts,
    updates,
    validationFailures,
    writeFailures,
    existingRecords,
    destinationRecords,
    reconciliation,
    fieldCoverage,
  };
}

/**
 * Exit non-zero when any collection reported a failure that would hide data
 * loss. Called once at the end of a migrator so the process status reflects the
 * worst outcome across all collections.
 */
export function reportMigrationOutcome(stats: MigrationStats[]): void {
  const problems: string[] = [];

  for (const s of stats) {
    if (!s.reconciliation.ok) {
      problems.push(`${s.collection}: ${s.reconciliation.missing} unaccounted document(s)`);
    }
    if (s.validationFailures > 0) {
      problems.push(`${s.collection}: ${s.validationFailures} validation failure(s)`);
    }
    if (s.writeFailures > 0) {
      problems.push(`${s.collection}: ${s.writeFailures} write failure(s)`);
    }
    if (s.fieldCoverage && s.fieldCoverage.unmapped.length > 0) {
      problems.push(
        `${s.collection}: unmapped fields (${s.fieldCoverage.unmapped.join(", ")})`
      );
    }
  }

  const totals = stats.reduce(
    (acc, s) => {
      acc.source += s.sourceCount;
      acc.inserts += s.inserts;
      acc.updates += s.updates;
      acc.validation += s.validationFailures;
      acc.write += s.writeFailures;
      return acc;
    },
    { source: 0, inserts: 0, updates: 0, validation: 0, write: 0 }
  );

  console.log("\n=== OVERALL SUMMARY ===");
  console.log(`Collections processed:  ${stats.length}`);
  console.log(`Source documents:       ${totals.source}`);
  console.log(`Inserted:               ${totals.inserts}`);
  console.log(`Updated:                ${totals.updates}`);
  console.log(`Validation failures:    ${totals.validation}`);
  console.log(`Write failures:         ${totals.write}`);

  if (problems.length > 0) {
    console.error("\nRESULT: FAIL");
    problems.forEach((p) => console.error(` - ${p}`));
    process.exit(1);
  }

  console.log("\nRESULT: PASS");
}
