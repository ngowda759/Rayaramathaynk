import { getAdminFirestore } from "@/lib/admin-firebase";
import { createAdminClient } from "@/lib/supabase/admin";

interface TargetDailyPooja {
  firestore_id: string;
  title: string;
  description: string;
  start_time: string;
  duration: string;
  category: string;
  seva_amount: number;
  is_active: boolean;
  display_order: number;
  days: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

function toDate(firestoreTimestamp: any): string | null {
  if (!firestoreTimestamp) return null;
  if (typeof firestoreTimestamp.toDate === "function") {
    return firestoreTimestamp.toDate().toISOString();
  }
  if (typeof firestoreTimestamp === "string") {
    const d = new Date(firestoreTimestamp);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("=== STARTING DAILY POOJAS DATA MIGRATION ===");
  if (isDryRun) {
    console.log("=== RUNNING IN DRY-RUN MODE (No data will be written) ===");
  }

  try {
    const db = await getAdminFirestore();
    const supabase = createAdminClient();

    // 1. Fetch Source Set
    const collectionRef = db.collection("dailyPoojas");
    const snapshot = await collectionRef.get();
    const totalSourceDocs = snapshot.size;

    console.log(`Found ${totalSourceDocs} documents in Firestore 'dailyPoojas'.`);

    if (totalSourceDocs === 0) {
      console.log("No documents to migrate.");
      process.exit(0);
    }

    const recordsToUpsert: TargetDailyPooja[] = [];
    const extractionFailures: { id: string; reason: string }[] = [];
    const sourceIdsMap = new Map<string, TargetDailyPooja>();
    let duplicateSourceIdsCount = 0;

    // 2. Extraction and Validation
    for (const doc of snapshot.docs) {
      const id = doc.id;
      const data = doc.data();

      try {
        if (typeof data.title !== "string" || !data.title) throw new Error("Missing required field: title");
        if (typeof data.description !== "string" || !data.description) throw new Error("Missing required field: description");
        if (typeof data.startTime !== "string" || !data.startTime) throw new Error("Missing required field: startTime");
        if (typeof data.duration !== "string" || !data.duration) throw new Error("Missing required field: duration");
        if (typeof data.category !== "string" || !data.category) throw new Error("Missing required field: category");
        if (typeof data.sevaAmount !== "number") throw new Error(`Invalid or missing required field 'sevaAmount': ${data.sevaAmount}`);
        if (!Array.isArray(data.days)) throw new Error("Missing or invalid required field 'days'");

        const created_at = toDate(data.createdAt);
        if (!created_at) throw new Error(`Missing or invalid timestamp for createdAt: ${data.createdAt}`);

        const record: TargetDailyPooja = {
          firestore_id: id,
          title: data.title,
          description: data.description,
          start_time: data.startTime,
          duration: data.duration,
          category: data.category,
          seva_amount: data.sevaAmount,
          is_active: data.isActive !== undefined ? data.isActive : true,
          display_order: typeof data.displayOrder === "number" ? data.displayOrder : 0,
          days: data.days,
          notes: data.notes || null,
          created_by: data.createdBy || null,
          created_at,
        };

        if (sourceIdsMap.has(id)) {
          duplicateSourceIdsCount++;
          throw new Error("Duplicate source ID");
        }

        sourceIdsMap.set(id, record);
        recordsToUpsert.push(record);
      } catch (err: any) {
        extractionFailures.push({ id, reason: err.message });
      }
    }

    // 3. Loading (Upsert)
    const writeFailures: { id: string; reason: string }[] = [];

    if (!isDryRun && recordsToUpsert.length > 0) {
      const { error } = await supabase.from("daily_poojas").upsert(recordsToUpsert, { onConflict: "firestore_id" });

      if (error) {
        console.error("Batch upsert failed, falling back to individual inserts to isolate errors...");
        for (const record of recordsToUpsert) {
          const { error: individualError } = await supabase.from("daily_poojas").upsert(record, { onConflict: "firestore_id" });
          if (individualError) {
            writeFailures.push({ id: record.firestore_id, reason: individualError.message });
          }
        }
      }
    }

    // 4. Independent Reconciliation
    let targetDocsCount = 0;
    let duplicateTargetIdsCount = 0;
    const missingTargetIds: string[] = [];
    const extraTargetIds: string[] = [];
    const fieldMismatches: { id: string; reason: string }[] = [];
    let matchedIdsCount = 0;

    if (!isDryRun) {
      const { data: sbData, error: fetchError } = await supabase.from("daily_poojas").select("*");
      if (fetchError) throw fetchError;

      targetDocsCount = sbData.length;
      const targetIdsMap = new Map<string, any>();

      for (const row of sbData) {
        const id = row.firestore_id;
        if (targetIdsMap.has(id)) {
          duplicateTargetIdsCount++;
        }
        targetIdsMap.set(id, row);

        if (!sourceIdsMap.has(id)) {
          extraTargetIds.push(id);
        }
      }

      for (const [sourceId, sourceRecord] of sourceIdsMap) {
        if (!targetIdsMap.has(sourceId)) {
          missingTargetIds.push(sourceId);
          continue;
        }

        matchedIdsCount++;
        const targetRecord = targetIdsMap.get(sourceId);
        let mismatchReason = "";

        if (sourceRecord.title !== targetRecord.title) mismatchReason += "title, ";
        if (sourceRecord.description !== targetRecord.description) mismatchReason += "description, ";
        if (sourceRecord.start_time !== targetRecord.start_time) mismatchReason += "start_time, ";
        if (sourceRecord.duration !== targetRecord.duration) mismatchReason += "duration, ";
        if (sourceRecord.category !== targetRecord.category) mismatchReason += "category, ";
        if (Number(sourceRecord.seva_amount) !== Number(targetRecord.seva_amount)) mismatchReason += "seva_amount, ";
        if (sourceRecord.is_active !== targetRecord.is_active) mismatchReason += "is_active, ";
        if (sourceRecord.display_order !== targetRecord.display_order) mismatchReason += "display_order, ";

        const targetDays = targetRecord.days || [];
        if (sourceRecord.days.length !== targetDays.length || !sourceRecord.days.every((val, i) => val === targetDays[i])) {
          mismatchReason += "days, ";
        }

        if (sourceRecord.notes !== targetRecord.notes) mismatchReason += "notes, ";
        if (sourceRecord.created_by !== targetRecord.created_by) mismatchReason += "created_by, ";

        if (new Date(sourceRecord.created_at).getTime() !== new Date(targetRecord.created_at).getTime()) {
          mismatchReason += "created_at, ";
        }

        if (mismatchReason) {
          fieldMismatches.push({ id: sourceId, reason: mismatchReason });
        }
      }
    }

    // 5. Final Report
    const totalFailures = duplicateSourceIdsCount + duplicateTargetIdsCount + missingTargetIds.length + extraTargetIds.length + fieldMismatches.length + extractionFailures.length + writeFailures.length;
    const isClean = !isDryRun && totalFailures === 0 && targetDocsCount === totalSourceDocs;

    console.log(`\n=== FINAL REPORT ===`);
    console.log(`SOURCE COUNT: ${totalSourceDocs}`);
    console.log(`DESTINATION COUNT: ${isDryRun ? "N/A (Dry Run)" : targetDocsCount}`);
    console.log(`MATCHED: ${isDryRun ? "N/A" : matchedIdsCount}`);
    console.log(`MISSING: ${isDryRun ? "N/A" : missingTargetIds.length}`);
    console.log(`EXTRA: ${isDryRun ? "N/A" : extraTargetIds.length}`);
    console.log(`DUPLICATES: ${duplicateSourceIdsCount + duplicateTargetIdsCount}`);
    console.log(`FIELD MISMATCHES: ${isDryRun ? "N/A" : fieldMismatches.length}`);
    console.log(`TRANSFORMATION FAILURES: ${extractionFailures.length}`);
    console.log(`WRITE FAILURES: ${writeFailures.length}`);

    console.log(`\nRESULT: ${isClean ? "PASS" : "FAIL"}`);

    if (extractionFailures.length > 0) {
      console.log("\nTransformation Failures:");
      extractionFailures.forEach(f => console.log(` - ${f.id}: ${f.reason}`));
    }
    if (writeFailures.length > 0) {
      console.log("\nWrite Failures:");
      writeFailures.forEach(f => console.log(` - ${f.id}: ${f.reason}`));
    }
    if (missingTargetIds.length > 0) {
      console.log("\nMissing Destination IDs:");
      missingTargetIds.forEach(id => console.log(` - ${id}`));
    }
    if (extraTargetIds.length > 0) {
      console.log("\nExtra Destination IDs:");
      extraTargetIds.forEach(id => console.log(` - ${id}`));
    }
    if (fieldMismatches.length > 0) {
      console.log("\nField Mismatches:");
      fieldMismatches.forEach(f => console.log(` - ${f.id}: ${f.reason}`));
    }

    if (!isClean && !isDryRun) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\nMigration unexpectedly failed:", error);
    console.log(`\n=== FINAL REPORT ===\nRESULT: BLOCKED\nReason: ${error.message}`);
    process.exit(1);
  }
}

run();
