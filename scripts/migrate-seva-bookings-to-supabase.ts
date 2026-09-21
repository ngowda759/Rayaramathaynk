import { getAdminFirestore } from "@/lib/admin-firebase";
import { createAdminClient } from "@/lib/supabase/admin";

interface TargetSevaBooking {
  firestore_id: string;
  seva_id: string;
  seva_title: string;
  seva_amount: number;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  gotra: string | null;
  nakshatra: string | null;
  raashi: string | null;
  preferred_date: string;
  notes: string;
  status: string;
  payment_reference: string;
  payment_status: string;
  payment_date: string;
  payment_method: string;
  created_at: string | null;
  updated_at: string | null;
}

function toDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (value._seconds !== undefined) {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("=== STARTING SEVA BOOKINGS DATA MIGRATION ===");
  if (isDryRun) {
    console.log("=== RUNNING IN DRY-RUN MODE (No data will be written) ===");
  }

  try {
    const db = await getAdminFirestore();
    const supabase = createAdminClient();

    // 1. Fetch Source Set
    const collectionRef = db.collection("sevaBookings");
    const snapshot = await collectionRef.get();
    const totalSourceDocs = snapshot.size;

    console.log(`Found ${totalSourceDocs} documents in Firestore 'sevaBookings'.`);

    if (totalSourceDocs === 0) {
      console.log("No documents to migrate.");
      process.exit(0);
    }

    const recordsToUpsert: TargetSevaBooking[] = [];
    const extractionFailures: { id: string; reason: string }[] = [];
    const sourceIdsMap = new Map<string, TargetSevaBooking>();
    let duplicateSourceIdsCount = 0;

    // 2. Extraction and Validation
    for (const doc of snapshot.docs) {
      const id = doc.id;
      const data = doc.data();

      try {
        if (typeof data.sevaId !== "string" || !data.sevaId) throw new Error("Missing required field: sevaId");
        if (typeof data.sevaTitle !== "string" || !data.sevaTitle) throw new Error("Missing required field: sevaTitle");
        if (typeof data.sevaAmount !== "number") throw new Error(`Invalid or missing required field 'sevaAmount': ${data.sevaAmount}`);
        if (typeof data.userId !== "string" || !data.userId) throw new Error("Missing required field: userId");
        if (typeof data.userName !== "string" || !data.userName) throw new Error("Missing required field: userName");
        if (typeof data.userEmail !== "string" || !data.userEmail) throw new Error("Missing required field: userEmail");
        if (typeof data.userPhone !== "string" || !data.userPhone) throw new Error("Missing required field: userPhone");
        if (typeof data.preferredDate !== "string" || !data.preferredDate) throw new Error("Missing required field: preferredDate");
        if (typeof data.notes !== "string") throw new Error("Missing required field: notes");
        if (typeof data.status !== "string" || !data.status) throw new Error("Missing required field: status");

        const record: TargetSevaBooking = {
          firestore_id: id,
          seva_id: data.sevaId,
          seva_title: data.sevaTitle,
          seva_amount: data.sevaAmount,
          user_id: data.userId,
          user_name: data.userName,
          user_email: data.userEmail,
          user_phone: data.userPhone,
          gotra: data.gotra || null,
          nakshatra: data.nakshatra || null,
          raashi: data.raashi || null,
          preferred_date: data.preferredDate,
          notes: data.notes,
          status: data.status,
          // The booking service writes empty strings for these at creation time;
          // mirror that rather than inventing values.
          payment_reference: data.paymentReference || "",
          payment_status: data.paymentStatus || "pending",
          payment_date: data.paymentDate || "",
          payment_method: data.paymentMethod || "",
          created_at: toDate(data.createdAt),
          updated_at: toDate(data.updatedAt)
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

    let targetDocsCount = 0;
    const { count: sbCount, error: countError } = await supabase
      .from("seva_bookings")
      .select("*", { count: "exact", head: true });
    if (countError) {
      console.warn("Could not fetch target count:", countError.message);
    } else {
      targetDocsCount = sbCount || 0;
    }

    // 3. Loading (Upsert)
    const writeFailures: { id: string; reason: string }[] = [];

    if (!isDryRun && recordsToUpsert.length > 0) {
      const { error } = await supabase
        .from("seva_bookings")
        .upsert(recordsToUpsert, { onConflict: "firestore_id" });

      if (error) {
        console.error("Batch upsert failed, falling back to individual inserts to isolate errors...");
        for (const record of recordsToUpsert) {
          const { error: individualError } = await supabase
            .from("seva_bookings")
            .upsert(record, { onConflict: "firestore_id" });
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
      const { data: sbData, error: fetchError } = await supabase.from("seva_bookings").select("*");
      if (fetchError) throw fetchError;

      targetDocsCount = sbData.length;
      const targetIdsMap = new Map<string, any>();

      for (const row of sbData) {
        const id = row.firestore_id;
        if (targetIdsMap.has(id)) duplicateTargetIdsCount++;
        targetIdsMap.set(id, row);
        if (!sourceIdsMap.has(id)) extraTargetIds.push(id);
      }

      for (const [sourceId, sourceRecord] of sourceIdsMap) {
        if (!targetIdsMap.has(sourceId)) {
          missingTargetIds.push(sourceId);
          continue;
        }

        matchedIdsCount++;
        const targetRecord = targetIdsMap.get(sourceId);
        let mismatchReason = "";

        if (sourceRecord.seva_id !== targetRecord.seva_id) mismatchReason += "seva_id, ";
        if (sourceRecord.seva_title !== targetRecord.seva_title) mismatchReason += "seva_title, ";
        if (Number(sourceRecord.seva_amount) !== Number(targetRecord.seva_amount)) mismatchReason += "seva_amount, ";
        if (sourceRecord.user_id !== targetRecord.user_id) mismatchReason += "user_id, ";
        if (sourceRecord.user_name !== targetRecord.user_name) mismatchReason += "user_name, ";
        if (sourceRecord.user_email !== targetRecord.user_email) mismatchReason += "user_email, ";
        if (sourceRecord.user_phone !== targetRecord.user_phone) mismatchReason += "user_phone, ";
        if (sourceRecord.preferred_date !== targetRecord.preferred_date) mismatchReason += "preferred_date, ";
        if (sourceRecord.notes !== targetRecord.notes) mismatchReason += "notes, ";
        if (sourceRecord.status !== targetRecord.status) mismatchReason += "status, ";
        if (sourceRecord.payment_reference !== targetRecord.payment_reference) mismatchReason += "payment_reference, ";
        if (sourceRecord.payment_status !== targetRecord.payment_status) mismatchReason += "payment_status, ";
        if (sourceRecord.payment_date !== targetRecord.payment_date) mismatchReason += "payment_date, ";
        if (sourceRecord.payment_method !== targetRecord.payment_method) mismatchReason += "payment_method, ";

        if (mismatchReason) {
          fieldMismatches.push({ id: sourceId, reason: mismatchReason });
        }
      }
    }

    // 5. Final Report
    console.log(`\n=== FINAL REPORT ===`);
    console.log(`SOURCE COUNT: ${totalSourceDocs}`);
    let isClean = false;

    if (isDryRun) {
      console.log(`VALID RECORDS: ${recordsToUpsert.length}`);
      console.log(`TRANSFORMATION FAILURES: ${extractionFailures.length}`);
      console.log(`DUPLICATE SOURCE IDs: ${duplicateSourceIdsCount}`);
      console.log(`SUPABASE WRITE: NOT PERFORMED`);
      isClean = extractionFailures.length === 0 && duplicateSourceIdsCount === 0;
      console.log(`\nRESULT: ${isClean ? "DRY RUN PASS" : "DRY RUN FAIL"}`);
    } else {
      const totalFailures =
        duplicateSourceIdsCount + duplicateTargetIdsCount + missingTargetIds.length +
        extraTargetIds.length + fieldMismatches.length + extractionFailures.length + writeFailures.length;
      isClean = totalFailures === 0 && targetDocsCount === totalSourceDocs;

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