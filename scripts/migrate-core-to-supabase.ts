import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import { Timestamp } from "firebase-admin/firestore";

// Helper to safely convert Firestore Timestamps or ISO strings to Date objects for Supabase (timestamptz)
function toDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Timestamp || (value._seconds !== undefined && value._nanoseconds !== undefined)) {
    // Handle Firestore Timestamp
    const seconds = value._seconds ?? value.seconds;
    return new Date(seconds * 1000).toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
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
  const failures: { id: string; reason: string }[] = [];

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
        failureCount++;
        failures.push({ id: doc.id, reason: err.message || "Mapping error" });
      }
    }

    if (recordsToUpsert.length > 0) {
      if (isDryRun) {
        console.log(`[DRY RUN] Would upsert ${recordsToUpsert.length} records into '${tableName}'.`);
        // We consider these new inserts in a dry run unless we do a pre-check, which is slow.
        newInsertsCount += recordsToUpsert.length;
      } else {
        // Find existing to distinguish insert/update
        const { data: existingRecords } = await supabase
          .from(tableName)
          .select("firestore_id")
          .in("firestore_id", recordsToUpsert.map(r => r.firestore_id));

        const existingIds = new Set(existingRecords?.map((r: any) => r.firestore_id) || []);

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
              failures.push({ id: record.firestore_id, reason: individualError.message });
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

  // Print Report
  console.log(`\nREPORT FOR: ${collectionName.toUpperCase()}`);
  console.log(`Firestore documents: ${totalDocs}`);
  console.log(`Successfully migrated (new): ${newInsertsCount}`);
  console.log(`Updated existing: ${updateCount}`);
  console.log(`Failed: ${failureCount}`);

  if (failures.length > 0) {
    console.log(`Failures details:`);
    failures.forEach(f => console.log(` - ID: ${f.id}, Reason: ${f.reason}`));
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
    await migrateCollection(db, supabase, "sevas", "sevas", (id, data): TargetSeva => ({
      firestore_id: id,
      name: data.name || "Unknown Seva",
      description: data.description || "",
      category: data.category || "General",
      amount: typeof data.amount === 'number' ? data.amount : 0,
      duration: typeof data.duration === 'number' ? data.duration : 1,
      image_url: data.imageUrl || null,
      active: data.active !== undefined ? data.active : true,
      display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
      created_at: toDate(data.createdAt),
      updated_at: toDate(data.updatedAt)
    }), isDryRun);

    // Mapping for Daily Poojas
    await migrateCollection(db, supabase, "dailyPoojas", "daily_poojas", (id, data): TargetDailyPooja => ({
      firestore_id: id,
      title: data.title || "Unknown Pooja",
      description: data.description || "",
      start_time: data.startTime || "",
      duration: data.duration || "",
      category: data.category || "General",
      seva_amount: typeof data.sevaAmount === 'number' ? data.sevaAmount : 0,
      is_active: data.isActive !== undefined ? data.isActive : true,
      display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
      days: Array.isArray(data.days) ? data.days : [],
      notes: data.notes || null,
      created_at: toDate(data.createdAt),
      created_by: data.createdBy || null
    }), isDryRun);

    // Mapping for Events
    await migrateCollection(db, supabase, "events", "events", (id, data): TargetEvent => ({
      firestore_id: id,
      title: data.title || "Unknown Event",
      description: data.description || "",
      location: data.location || "",
      start_date: toDate(data.startDate),
      end_date: toDate(data.endDate),
      start_time: data.startTime || null,
      end_time: data.endTime || null,
      featured: data.featured !== undefined ? data.featured : false,
      published: data.published !== undefined ? data.published : false,
      category: data.category || null,
      image_url: data.imageUrl || null,
      status: data.status || "Upcoming",
      created_at: toDate(data.createdAt),
      updated_at: toDate(data.updatedAt)
    }), isDryRun);

    console.log("\nMigration completed.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();