import { getAdminFirestore } from "@/lib/admin-firebase";
import { createAdminClient } from "@/lib/supabase/admin";

interface TargetSeva {
  firestore_id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  image_url: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string | null;
}

function toDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("=== STARTING SEVAS DATA MIGRATION ===");
  if (isDryRun) {
    console.log("=== RUNNING IN DRY-RUN MODE (No data will be written) ===");
  }

  try {
    const db = await getAdminFirestore();
    const supabase = createAdminClient();

    // 1. Fetch Source Set
    const collectionRef = db.collection("sevas");
    const snapshot = await collectionRef.get();
    const totalSourceDocs = snapshot.size;

    console.log(`Found ${totalSourceDocs} documents in Firestore 'sevas'.`);

    if (totalSourceDocs === 0) {
      console.log("No documents to migrate.");
      process.exit(0);
    }

    const recordsToUpsert: TargetSeva[] = [];
    const extractionFailures: { id: string; reason: string }[] = [];
    const sourceIdsMap = new Map<string, TargetSeva>();
    let duplicateSourceIdsCount = 0;

    // 2. Extraction and Validation
    for (const doc of snapshot.docs) {
      const id = doc.id;
      const data = doc.data();

      try {
        if (typeof data.name !== "string" || !data.name) throw new Error("Missing required field: name");
        if (typeof data.description !== "string" || !data.description) throw new Error("Missing required field: description");
        if (typeof data.category !== "string" || !data.category) throw new Error("Missing required field: category");
        if (typeof data.amount !== "number") throw new Error(`Invalid or missing required field 'amount': ${data.amount}`);
        if (typeof data.duration !== "number") throw new Error(`Invalid or missing required field 'duration': ${data.duration}`);

        const created_at = toDate(data.createdAt);
        if (!created_at) throw new Error(`Missing or invalid timestamp for createdAt: ${data.createdAt}`);
        const updated_at = toDate(data.updatedAt);

        const record: TargetSeva = {
          firestore_id: id,
          name: data.name,
          description: data.description,
          category: data.category,
          amount: data.amount,
          duration: data.duration,
          image_url: data.imageUrl || null,
          active: data.active !== undefined ? data.active : true,
          display_order: typeof data.displayOrder === "number" ? data.displayOrder : 0,
          created_at,
          updated_at
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

    // Supabase current count
    let targetDocsCount = 0;
    const { count: sbCount, error: countError } = await supabase.from("sevas").select("*", { count: "exact", head: true });
    if (countError) {
      console.warn("Could not fetch target count:", countError.message);
    } else {
      targetDocsCount = sbCount || 0;
    }

    // 3. Loading (Upsert)
    const writeFailures: { id: string; reason: string }[] = [];

    if (!isDryRun && recordsToUpsert.length > 0) {
      const { error } = await supabase.from("sevas").upsert(recordsToUpsert, { onConflict: "firestore_id" });

      if (error) {
        console.error("Batch upsert failed, falling back to individual inserts to isolate errors...");
        for (const record of recordsToUpsert) {
          const { error: individualError } = await supabase.from("sevas").upsert(record, { onConflict: "firestore_id" });
          if (individualError) {
            writeFailures.push({ id: record.firestore_id, reason: individualError.message });
          }
        }
      }
    }

    // 4. Independent Reconciliation
    let duplicateTargetIdsCount = 0;
    const missingTargetIds: string[] = [];
    const extraTargetIds: string[] = [];
    const fieldMismatches: { id: string; reason: string }[] = [];
    let matchedIdsCount = 0;

    if (!isDryRun) {
      const { data: sbData, error: fetchError } = await supabase.from("sevas").select("*");
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

        if (sourceRecord.name !== targetRecord.name) mismatchReason += "name, ";
        if (sourceRecord.description !== targetRecord.description) mismatchReason += "description, ";
        if (sourceRecord.category !== targetRecord.category) mismatchReason += "category, ";
        if (Number(sourceRecord.amount) !== Number(targetRecord.amount)) mismatchReason += "amount, ";
        if (Number(sourceRecord.duration) !== Number(targetRecord.duration)) mismatchReason += "duration, ";
        if (sourceRecord.image_url !== targetRecord.image_url) mismatchReason += "image_url, ";
        if (sourceRecord.active !== targetRecord.active) mismatchReason += "active, ";
        if (sourceRecord.display_order !== targetRecord.display_order) mismatchReason += "display_order, ";

        if (new Date(sourceRecord.created_at).getTime() !== new Date(targetRecord.created_at).getTime()) {
          mismatchReason += "created_at, ";
        }

        if (sourceRecord.updated_at && targetRecord.updated_at) {
          if (new Date(sourceRecord.updated_at).getTime() !== new Date(targetRecord.updated_at).getTime()) {
            mismatchReason += "updated_at, ";
          }
        } else if (sourceRecord.updated_at !== targetRecord.updated_at) {
          mismatchReason += "updated_at, ";
        }

        if (mismatchReason) {
          fieldMismatches.push({ id: sourceId, reason: mismatchReason });
        }
      }
    }

    // 5. Final Report
    console.log(`\n=== FINAL REPORT ===`);
    let isClean = false;

    if (isDryRun) {
       console.log(`FIRESTORE SOURCE COUNT: ${totalSourceDocs}`);
       console.log(`SUPABASE CURRENT COUNT: ${targetDocsCount}`);
       console.log(`VALID SOURCE RECORDS: ${recordsToUpsert.length}`);
       console.log(`TRANSFORMATION FAILURES: ${extractionFailures.length}`);

       isClean = extractionFailures.length === 0 && duplicateSourceIdsCount === 0;
       console.log(`\nRESULT: ${isClean ? "DRY RUN PASS" : "DRY RUN FAIL"}`);
    } else {
       const totalFailures = duplicateSourceIdsCount + duplicateTargetIdsCount + missingTargetIds.length + extraTargetIds.length + fieldMismatches.length + extractionFailures.length + writeFailures.length;
       isClean = totalFailures === 0 && targetDocsCount === totalSourceDocs;

       console.log(`SOURCE COUNT: ${totalSourceDocs}`);
       console.log(`DESTINATION COUNT: ${targetDocsCount}`);
       console.log(`MATCHED: ${matchedIdsCount}`);
       console.log(`MISSING: ${missingTargetIds.length}`);
       console.log(`EXTRA: ${extraTargetIds.length}`);
       console.log(`DUPLICATES: ${duplicateSourceIdsCount + duplicateTargetIdsCount}`);
       console.log(`FIELD MISMATCHES: ${fieldMismatches.length}`);
       console.log(`TRANSFORMATION FAILURES: ${extractionFailures.length}`);
       console.log(`WRITE FAILURES: ${writeFailures.length}`);
       console.log(`\nRESULT: ${isClean ? "PASS" : "FAIL"}`);
    }

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