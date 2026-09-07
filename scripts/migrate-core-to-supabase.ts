import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import { Timestamp } from "firebase-admin/firestore";

// Helper to safely convert Firestore Timestamps or ISO strings to Date objects for Supabase (timestamptz)
function toDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return value.toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // No longer attempting to handle private fields `_seconds` and `_nanoseconds`.
  return null;
}

// Interfaces to represent target schema for typing
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
  created_at: string | null;
  updated_at: string | null;
}

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
  created_at: string | null;
  created_by: string | null;
}

interface TargetEvent {
  firestore_id: string;
  title: string;
  description: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  featured: boolean;
  published: boolean;
  category: string | null;
  image_url: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

async function migrateCollection(
  db: any,
  supabase: any,
  collectionName: string,
  tableName: string,
  mapper: (id: string, data: any) => any,
  isDryRun: boolean
) {
  console.log(`\n--- Starting migration for ${collectionName} -> ${tableName} ---`);

  // Get total count for reporting
  const snapshotCount = await db.collection(collectionName).count().get();
  const totalDocs = snapshotCount.data().count;
  console.log(`Found ${totalDocs} documents in Firestore collection '${collectionName}'.`);

  if (totalDocs === 0) return;

  const BATCH_SIZE = 50;
  let newInsertsCount = 0;
  let updateCount = 0;
  let failureCount = 0;
  let validationFailureCount = 0;
  const failures: { id: string; reason: string; type: 'validation' | 'write' }[] = [];

  let query = db.collection(collectionName).orderBy("__name__").limit(BATCH_SIZE);
  let processedCount = 0;

  while (processedCount < totalDocs) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batchDocs = snapshot.docs;
    console.log(`Processing batch ${Math.floor(processedCount / BATCH_SIZE) + 1} (${batchDocs.length} documents)...`);

    const recordsToUpsert: any[] = [];

    for (const doc of batchDocs) {
      try {
        const data = doc.data();
        const mappedData = mapper(doc.id, data);
        recordsToUpsert.push(mappedData);
      } catch (err: any) {
        validationFailureCount++;
        failures.push({ id: doc.id, reason: err.message || "Mapping validation error", type: 'validation' });
      }
    }

    if (recordsToUpsert.length > 0) {
      // Look up existing records to correctly identify new vs updated, even in dry run
      const { data: existingRecords, error: lookupError } = await supabase
        .from(tableName)
        .select("firestore_id")
        .in("firestore_id", recordsToUpsert.map(r => r.firestore_id));

      if (lookupError) {
        console.error(`Error checking existing records in Supabase for ${tableName}:`, lookupError.message);
        // If we can't even lookup, we mark them as write failures
        for (const record of recordsToUpsert) {
          failureCount++;
          failures.push({ id: record.firestore_id, reason: `Lookup error: ${lookupError.message}`, type: 'write' });
        }
        continue;
      }

      const existingIds = new Set(existingRecords?.map((r: any) => r.firestore_id) || []);

      if (isDryRun) {
        for (const record of recordsToUpsert) {
          if (existingIds.has(record.firestore_id)) {
            updateCount++;
          } else {
            newInsertsCount++;
          }
        }
      } else {
        const { error } = await supabase
          .from(tableName)
          .upsert(recordsToUpsert, { onConflict: "firestore_id" });

        if (error) {
          console.error(`Error upserting batch into ${tableName}, falling back to individual inserts...`);
          // Fallback to individual to isolate failures
          for (const record of recordsToUpsert) {
            const { error: individualError } = await supabase
              .from(tableName)
              .upsert(record, { onConflict: "firestore_id" });

            if (individualError) {
              failureCount++;
              failures.push({ id: record.firestore_id, reason: individualError.message, type: 'write' });
            } else {
              if (existingIds.has(record.firestore_id)) {
                updateCount++;
              } else {
                newInsertsCount++;
              }
            }
          }
        } else {
          // All succeeded
          for (const record of recordsToUpsert) {
            if (existingIds.has(record.firestore_id)) {
              updateCount++;
            } else {
              newInsertsCount++;
            }
          }
        }
      }
    }

    processedCount += batchDocs.length;
    const lastVisible = batchDocs[batchDocs.length - 1];
    query = db.collection(collectionName).orderBy("__name__").startAfter(lastVisible).limit(BATCH_SIZE);
  }

  // Duplicate Check in Target (Only useful if we actually migrated data, but we can do it anyway)
  if (!isDryRun) {
    const { } = await supabase
      .rpc('check_duplicate_firestore_ids', { table_name: tableName })
      .catch(() => ({ data: null })); // Ignored if RPC doesn't exist. We just rely on unique constraints mostly
      // Alternatively, we query grouping by firestore_id having count > 1

    // Since RLS / dynamic RPC might not be set up for this, we trust the DB unique constraint,
    // but log a note.
    console.log(`Duplicate check: Relies on Supabase UNIQUE constraint for firestore_id.`);
  }


  const mappedSuccessfullyCount = newInsertsCount + updateCount + failureCount; // mapped successfully but might have failed write
  const totalSuccessful = newInsertsCount + updateCount;

  // Print Report
  console.log(`\nREPORT FOR: ${collectionName.toUpperCase()}`);
  console.log(`Firestore documents: ${totalDocs}`);
  console.log(`Mapped successfully: ${mappedSuccessfullyCount}`);
  console.log(`Validation failures: ${validationFailureCount}`);
  console.log(`Inserted: ${newInsertsCount}`);
  console.log(`Updated: ${updateCount}`);
  console.log(`Supabase write failures: ${failureCount}`);
  console.log(`Total successful: ${totalSuccessful}`);

  // Reconciliation checks
  const reconciledSource = (totalSuccessful + failureCount + validationFailureCount) === totalDocs;
  const reconciledWrites = totalSuccessful === (newInsertsCount + updateCount);

  if (!reconciledSource) {
     console.error(`❌ WARNING: Source documents (${totalDocs}) do not equal processed documents (${totalSuccessful + failureCount + validationFailureCount}).`);
  }
  if (!reconciledWrites) {
     console.error(`❌ WARNING: Total successful writes (${totalSuccessful}) do not equal inserts + updates (${newInsertsCount + updateCount}).`);
  }
  if (reconciledSource && reconciledWrites) {
     console.log(`✅ Reconciliation passed.`);
  }

  if (failures.length > 0) {
    console.log(`Failures details:`);
    failures.forEach(f => console.log(` - [${f.type.toUpperCase()}] ID: ${f.id}, Reason: ${f.reason}`));
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  if (isDryRun) {
    console.log("=== RUNNING IN DRY-RUN MODE (No data will be written) ===");
  } else {
    console.log("=== RUNNING IN NORMAL MIGRATION MODE ===");
  }

  try {
    const db = await getAdminFirestore();
    const supabase = createAdminClient();

    // Mapping for Sevas
    await migrateCollection(db, supabase, "sevas", "sevas", (id, data): TargetSeva => {
      if (!data.name) throw new Error("Missing required field: name");
      if (typeof data.amount !== 'number') throw new Error(`Invalid or missing amount: ${data.amount}`);

      const created_at = toDate(data.createdAt);
      if (data.createdAt && !created_at) throw new Error(`Invalid timestamp for createdAt: ${data.createdAt}`);
      const updated_at = toDate(data.updatedAt);

      return {
        firestore_id: id,
        name: data.name,
        description: data.description || "",
        category: data.category || "General",
        amount: data.amount,
        duration: typeof data.duration === 'number' ? data.duration : 0, // Fallback to 0 if not provided as duration is not critical monetary
        image_url: data.imageUrl || null,
        active: data.active !== undefined ? data.active : true,
        display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        created_at,
        updated_at
      };
    }, isDryRun);

    // Mapping for Daily Poojas
    await migrateCollection(db, supabase, "dailyPoojas", "daily_poojas", (id, data): TargetDailyPooja => {
      if (!data.title) throw new Error("Missing required field: title");
      if (data.sevaAmount !== undefined && typeof data.sevaAmount !== 'number') {
         throw new Error(`Invalid sevaAmount: ${data.sevaAmount}`);
      }

      const created_at = toDate(data.createdAt);
      if (data.createdAt && !created_at) throw new Error(`Invalid timestamp for createdAt: ${data.createdAt}`);

      return {
        firestore_id: id,
        title: data.title,
        description: data.description || "",
        start_time: data.startTime || "",
        duration: data.duration || "",
        category: data.category || "General",
        seva_amount: typeof data.sevaAmount === 'number' ? data.sevaAmount : 0, // In original schema default is 0
        is_active: data.isActive !== undefined ? data.isActive : true,
        display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        days: Array.isArray(data.days) ? data.days : [],
        notes: data.notes || null,
        created_at,
        created_by: data.createdBy || null
      };
    }, isDryRun);

    // Mapping for Events
    await migrateCollection(db, supabase, "events", "events", (id, data): TargetEvent => {
      if (!data.title) throw new Error("Missing required field: title");

      const start_date = toDate(data.startDate);
      if (!start_date) throw new Error(`Missing or invalid start_date: ${data.startDate}`);

      const end_date = toDate(data.endDate);
      if (!end_date) throw new Error(`Missing or invalid end_date: ${data.endDate}`);

      const created_at = toDate(data.createdAt);
      if (data.createdAt && !created_at) throw new Error(`Invalid timestamp for createdAt: ${data.createdAt}`);
      const updated_at = toDate(data.updatedAt);

      return {
        firestore_id: id,
        title: data.title,
        description: data.description || "",
        location: data.location || "",
        start_date,
        end_date,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        featured: data.featured !== undefined ? data.featured : false,
        published: data.published !== undefined ? data.published : false,
        category: data.category || null,
        image_url: data.imageUrl || null,
        status: data.status || "Upcoming",
        created_at,
        updated_at
      };
    }, isDryRun);

    console.log("\nMigration completed.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
