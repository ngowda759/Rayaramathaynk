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
  created_at: string | null;
}

function toDate(firestoreTimestamp: any): string | null {
  if (!firestoreTimestamp) return null;
  if (typeof firestoreTimestamp.toDate === "function") {
    return firestoreTimestamp.toDate().toISOString();
  }
  if (typeof firestoreTimestamp === "string") {
    return new Date(firestoreTimestamp).toISOString();
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

    const collectionRef = db.collection("dailyPoojas");
    const snapshot = await collectionRef.get();
    const totalDocs = snapshot.size;

    console.log(`Found ${totalDocs} documents in Firestore 'dailyPoojas'.`);

    if (totalDocs === 0) {
      console.log("No documents to migrate.");
      process.exit(0);
    }

    const recordsToUpsert: TargetDailyPooja[] = [];
    const failures: { id: string; reason: string }[] = [];

    // 1. Extraction and Transformation
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

        const created_at = toDate(data.createdAt) || new Date().toISOString();

        recordsToUpsert.push({
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
        });
      } catch (err: any) {
        failures.push({ id, reason: err.message });
      }
    }

    // 2. Loading (Upsert)
    let newInsertsCount = 0;
    let updateCount = 0;
    let writeFailureCount = 0;

    if (!isDryRun && recordsToUpsert.length > 0) {
      const { data: existingRecords, error: lookupError } = await supabase
        .from("daily_poojas")
        .select("firestore_id")
        .in(
          "firestore_id",
          recordsToUpsert.map((r) => r.firestore_id)
        );

      if (lookupError) {
        console.error("Error looking up existing records in Supabase:", lookupError);
        throw lookupError;
      }

      const existingIds = new Set(existingRecords?.map((r) => r.firestore_id) || []);

      const { error } = await supabase.from("daily_poojas").upsert(recordsToUpsert, { onConflict: "firestore_id" });

      if (error) {
        console.error("Batch upsert failed, falling back to individual inserts to isolate errors...");
        for (const record of recordsToUpsert) {
          const { error: individualError } = await supabase.from("daily_poojas").upsert(record, { onConflict: "firestore_id" });
          if (individualError) {
            writeFailureCount++;
            failures.push({ id: record.firestore_id, reason: individualError.message });
          } else {
            if (existingIds.has(record.firestore_id)) updateCount++;
            else newInsertsCount++;
          }
        }
      } else {
        for (const record of recordsToUpsert) {
          if (existingIds.has(record.firestore_id)) updateCount++;
          else newInsertsCount++;
        }
      }
    } else if (isDryRun) {
      newInsertsCount = recordsToUpsert.length;
    }

    // 3. Reconciliation
    let finalSupabaseCount = 0;
    let duplicateIdsCount = 0;
    let fieldMismatchesCount = 0;

    const validationFailureCount = failures.length - writeFailureCount;

    if (!isDryRun) {
      // 3.1 Fetch all from Supabase
      const { data: sbData, count: sbCount, error: countError } = await supabase
        .from("daily_poojas")
        .select("*", { count: "exact" });

      if (countError) throw countError;
      finalSupabaseCount = sbCount || 0;

      // 3.2 Compare field-by-field
      if (sbData) {
        const sbMap = new Map(sbData.map(r => [r.firestore_id, r]));

        // Count duplicates
        const fsIds = recordsToUpsert.map(r => r.firestore_id);
        const uniqueFsIds = new Set(fsIds);
        duplicateIdsCount = fsIds.length - uniqueFsIds.size;

        for (const source of recordsToUpsert) {
          const target = sbMap.get(source.firestore_id);
          if (!target) continue;

          let mismatch = false;
          let mismatchReason = "";

          // Timestamps
          if (source.created_at && target.created_at) {
            if (new Date(source.created_at).getTime() !== new Date(target.created_at).getTime()) {
              mismatch = true;
              mismatchReason += "timestamp, ";
            }
          }

          // Amounts
          if (Number(source.seva_amount) !== Number(target.seva_amount)) {
            mismatch = true;
            mismatchReason += "amount, ";
          }

          // Days Array
          const targetDays = target.days || [];
          if (source.days.length !== targetDays.length || !source.days.every((val, index) => val === targetDays[index])) {
            mismatch = true;
            mismatchReason += "days-array, ";
          }

          // Status & Display Order
          if (source.is_active !== target.is_active) {
            mismatch = true;
            mismatchReason += "active, ";
          }
          if (source.display_order !== target.display_order) {
            mismatch = true;
            mismatchReason += "display-order, ";
          }

          // Title/Description
          if (source.title !== target.title || source.description !== target.description || source.category !== target.category) {
            mismatch = true;
            mismatchReason += "string-fields, ";
          }

          if (mismatch) {
            fieldMismatchesCount++;
            failures.push({ id: source.firestore_id, reason: `Reconciliation mismatch: ${mismatchReason}` });
          }
        }
      }
    }

    const matchedCount = newInsertsCount + updateCount;
    const missingCount = totalDocs - matchedCount - validationFailureCount;

    // Report
    console.log(`\n=== FINAL REPORT ===`);
    console.log(`SOURCE COUNT: ${totalDocs}`);
    console.log(`SUPABASE COUNT: ${isDryRun ? "N/A (Dry Run)" : finalSupabaseCount}`);
    console.log(`MATCHED: ${matchedCount}`);
    console.log(`MISSING: ${missingCount}`);
    console.log(`EXTRA: ${isDryRun ? "N/A" : Math.max(0, finalSupabaseCount - totalDocs)}`);
    console.log(`DUPLICATES: ${duplicateIdsCount}`);
    console.log(`FIELD MISMATCHES: ${fieldMismatchesCount + validationFailureCount}`);

    const isClean = missingCount === 0 && writeFailureCount === 0 && fieldMismatchesCount === 0;

    console.log(`\nRESULT: ${isClean ? "PASS" : "FAIL"}`);

    if (failures.length > 0) {
      console.log(`\nFailures details:`);
      failures.forEach((f) => console.log(` - ID: ${f.id}, Reason: ${f.reason}`));
    }
  } catch (error: any) {
    console.error("Migration failed:", error);
    console.log(`\n=== FINAL REPORT ===\nRESULT: BLOCKED\nReason: ${error.message}`);
    process.exit(1);
  }
}

run();
