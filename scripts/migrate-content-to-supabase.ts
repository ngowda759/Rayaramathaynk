import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";

const BATCH_SIZE = 100;

function toDate(fbTimestamp: any): string | null {
  if (!fbTimestamp) return null;
  if (typeof fbTimestamp.toDate === "function") {
    return fbTimestamp.toDate().toISOString();
  }
  if (fbTimestamp._seconds !== undefined) {
    return new Date(fbTimestamp._seconds * 1000).toISOString();
  }
  if (typeof fbTimestamp === "number") {
      return new Date(fbTimestamp).toISOString();
  }
  if (typeof fbTimestamp === "string") {
    const d = new Date(fbTimestamp);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

async function migrateCollection<T extends { firestore_id: string }>(
  db: FirebaseFirestore.Firestore,
  supabase: any,
  collectionName: string,
  tableName: string,
  mapFn: (id: string, data: any) => T,
  isDryRun: boolean
) {
  console.log(`\n--- Starting migration for ${collectionName} -> ${tableName} ---`);

  const colRef = db.collection(collectionName);

  let totalDocs = 0;
  try {
    const countSnap = await colRef.count().get();
    totalDocs = countSnap.data().count;
    console.log(`Found ${totalDocs} documents in Firestore.`);
  } catch (error) {
    console.warn(`Could not get count for ${collectionName}, proceeding with batched read.`);
  }

  let processedCount = 0;
  let validationFailureCount = 0;
  let newInsertsCount = 0;
  let updateCount = 0;
  let failureCount = 0;
  const failures: { id: string; reason: string; type: string }[] = [];

  let query = colRef.orderBy("__name__").limit(BATCH_SIZE);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batchDocs = snapshot.docs;
    const recordsToUpsert: T[] = [];

    for (const doc of batchDocs) {
      try {
        const mapped = mapFn(doc.id, doc.data());
        recordsToUpsert.push(mapped);
      } catch (err: any) {
        validationFailureCount++;
        failures.push({ id: doc.id, reason: err.message, type: 'validation' });
      }
    }

    if (recordsToUpsert.length > 0) {
      const { data: existingRecords, error: lookupError } = await supabase
        .from(tableName)
        .select("firestore_id")
        .in("firestore_id", recordsToUpsert.map((r) => r.firestore_id));

      if (lookupError) {
        console.error(`Error checking existing records in Supabase for ${tableName}:`, lookupError.message);
        for (const record of recordsToUpsert) {
          failureCount++;
          failures.push({ id: record.firestore_id, reason: `Lookup error: ${lookupError.message}`, type: 'write' });
        }
      } else {
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
    }

    processedCount += batchDocs.length;
    process.stdout.write(`Processed ${processedCount}/${totalDocs}...\r`);

    const lastVisible = batchDocs[batchDocs.length - 1];
    query = colRef.orderBy("__name__").startAfter(lastVisible).limit(BATCH_SIZE);
  }

  const mappedSuccessfullyCount = newInsertsCount + updateCount + failureCount;
  const totalSuccessful = newInsertsCount + updateCount;

  console.log(`\nREPORT FOR: ${collectionName.toUpperCase()}`);
  console.log(`Firestore documents: ${totalDocs || processedCount}`);
  console.log(`Mapped successfully: ${mappedSuccessfullyCount}`);
  console.log(`Validation failures: ${validationFailureCount}`);
  console.log(`Inserted: ${newInsertsCount}`);
  console.log(`Updated: ${updateCount}`);
  console.log(`Supabase write failures: ${failureCount}`);
  console.log(`Total successful: ${totalSuccessful}`);

  if (failures.length > 0) {
    console.log(`Failures details (first 10):`);
    failures.slice(0, 10).forEach(f => console.log(` - [${f.type.toUpperCase()}] ID: ${f.id}, Reason: ${f.reason}`));
    if (failures.length > 10) console.log(`   ... and ${failures.length - 10} more.`);
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

    // 4.4. users
    await migrateCollection(db, supabase, "users", "users", (id, data) => {
      if (!data.email) throw new Error("Missing email");
      return {
        firestore_id: id,
        email: data.email,
        display_name: data.displayName || null,
        phone_number: data.phoneNumber || null,
        photo_url: data.photoUrl || null,
        role: data.role || 'user',
        active: data.active !== undefined ? data.active : true,
        created_at: toDate(data.createdAt) || new Date().toISOString(),
        updated_at: toDate(data.updatedAt) || new Date().toISOString()
      };
    }, isDryRun);

    // 4.5. profiles
    await migrateCollection(db, supabase, "profiles", "profiles", (id, data) => {
      if (!data.uid) throw new Error("Missing uid");
      if (!data.name) throw new Error("Missing name");
      if (!data.email) throw new Error("Missing email");
      return {
        firestore_id: id,
        uid: data.uid,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        profile_image: data.profileImage || null,
        bio: data.bio || null,
        gotra: data.gotra || null,
        nakshatra: data.nakshatra || null,
        preferences: data.preferences || {},
        favorites: data.favorites || [],
        recently_viewed: data.recentlyViewed || [],
        bookmarks: data.bookmarks || [],
        created_at: toDate(data.createdAt) || new Date().toISOString(),
        updated_at: toDate(data.updatedAt) || new Date().toISOString()
      };
    }, isDryRun);

    // 4.7. donation_campaigns
    await migrateCollection(db, supabase, "donation_campaigns", "donation_campaigns", (id, data) => {
      if (!data.title) throw new Error("Missing title");
      if (!data.description) throw new Error("Missing description");
      if (!data.imageUrl) throw new Error("Missing imageUrl");
      if (typeof data.suggestedAmount !== 'number') throw new Error("Missing suggestedAmount");
      return {
        firestore_id: id,
        title: data.title,
        description: data.description,
        image_url: data.imageUrl,
        suggested_amount: data.suggestedAmount,
        active: data.active !== undefined ? data.active : true,
        display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        created_at: toDate(data.createdAt) || new Date().toISOString(),
        updated_at: toDate(data.updatedAt) || new Date().toISOString()
      };
    }, isDryRun);

    // 4.6. donations
    await migrateCollection(db, supabase, "donations", "donations", (id, data) => {
      if (!data.donorName) throw new Error("Missing donorName");
      if (!data.email) throw new Error("Missing email");
      if (!data.phone) throw new Error("Missing phone");
      if (!data.address) throw new Error("Missing address");
      if (typeof data.amount !== 'number') throw new Error("Missing amount");
      if (!data.purpose) throw new Error("Missing purpose");
      if (!data.message && data.message !== "") throw new Error("Missing message");
      if (!data.paymentMode) throw new Error("Missing paymentMode");
      if (!data.status) throw new Error("Missing status");
      if (!data.receiptNumber) throw new Error("Missing receiptNumber");
      if (!data.adminRemarks && data.adminRemarks !== "") throw new Error("Missing adminRemarks");
      if (!data.collectedBy) throw new Error("Missing collectedBy");
      return {
        firestore_id: id,
        donor_name: data.donorName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        amount: data.amount,
        purpose: data.purpose,
        campaign_id: data.campaignId || null,
        message: data.message,
        payment_mode: data.paymentMode,
        status: data.status,
        receipt_number: data.receiptNumber,
        admin_remarks: data.adminRemarks,
        collected_by: data.collectedBy,
        collected_at: toDate(data.collectedAt) || null
      };
    }, isDryRun);

    // 4.8. gallery_albums
    await migrateCollection(db, supabase, "galleryAlbums", "gallery_albums", (id, data) => {
      if (!data.title) throw new Error("Missing title");
      if (!data.slug) throw new Error("Missing slug");
      if (!data.description) throw new Error("Missing description");
      if (!data.coverImage) throw new Error("Missing coverImage");
      return {
        firestore_id: id,
        title: data.title,
        slug: data.slug,
        description: data.description,
        cover_image: data.coverImage,
        active: data.active !== undefined ? data.active : true,
        display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        created_at: toDate(data.createdAt) || new Date().toISOString(),
        updated_at: toDate(data.updatedAt) || new Date().toISOString()
      };
    }, isDryRun);

    // 4.9. gallery_media
    await migrateCollection(db, supabase, "galleryMedia", "gallery_media", (id, data) => {
      if (!data.title) throw new Error("Missing title");
      if (!data.description) throw new Error("Missing description");
      if (!data.category) throw new Error("Missing category");
      if (!data.type) throw new Error("Missing type");
      if (!data.imagePath) throw new Error("Missing imagePath");
      if (!data.altText && data.altText !== "") throw new Error("Missing altText");
      if (!data.uploadedBy) throw new Error("Missing uploadedBy");
      return {
        firestore_id: id,
        album_id: data.albumId || null,
        title: data.title,
        description: data.description,
        category: data.category,
        type: data.type,
        image_path: data.imagePath,
        video_url: data.videoUrl || null,
        alt_text: data.altText,
        is_featured: data.isFeatured !== undefined ? data.isFeatured : false,
        display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        tags: data.tags || [],
        uploaded_by: data.uploadedBy,
        uploaded_at: toDate(data.uploadedAt) || null
      };
    }, isDryRun);

    // 4.10. testimonials
    await migrateCollection(db, supabase, "testimonials", "testimonials", (id, data) => {
      if (!data.name) throw new Error("Missing name");
      if (!data.location) throw new Error("Missing location");
      if (!data.quote) throw new Error("Missing quote");
      if (!data.years) throw new Error("Missing years");
      return {
        firestore_id: id,
        name: data.name,
        location: data.location,
        quote: data.quote,
        years: data.years,
        image: data.image || null,
        phone: data.phone || null,
        approved: data.approved !== undefined ? data.approved : false,
        rejected: data.rejected !== undefined ? data.rejected : false,
        rejection_reason: data.rejectionReason || null,
        submitted_by: data.submittedBy || null,
        created_at: toDate(data.createdAt) || new Date().toISOString()
      };
    }, isDryRun);

    // 4.11. aaradhanes
    await migrateCollection(db, supabase, "aaradhane", "aaradhanes", (id, data) => {
      if (!data.title) throw new Error("Missing title");
      if (!data.guruName) throw new Error("Missing guruName");
      if (!data.description) throw new Error("Missing description");
      if (!data.significance) throw new Error("Missing significance");
      if (!data.imageUrl) throw new Error("Missing imageUrl");
      if (!data.createdBy) throw new Error("Missing createdBy");
      return {
        firestore_id: id,
        title: data.title,
        guru_name: data.guruName,
        dates: data.dates || [],
        description: data.description,
        significance: data.significance,
        rituals: data.rituals || [],
        offerings: data.offerings || [],
        image_url: data.imageUrl,
        seva_details: data.sevaDetails || [],
        is_upcoming: data.isUpcoming !== undefined ? data.isUpcoming : false,
        display_order: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        created_by: data.createdBy,
        created_at: toDate(data.createdAt) || new Date().toISOString()
      };
    }, isDryRun);

    // 4.13. volunteer_requests
    await migrateCollection(db, supabase, "volunteer_requests", "volunteer_requests", (id, data) => {
      if (!data.volunteerId) throw new Error("Missing volunteerId");
      if (!data.name) throw new Error("Missing name");
      if (!data.phone) throw new Error("Missing phone");
      if (!data.sex) throw new Error("Missing sex");
      if (!data.address) throw new Error("Missing address");
      return {
        firestore_id: id,
        volunteer_id: data.volunteerId,
        name: data.name,
        phone: data.phone,
        sex: data.sex,
        active: data.active !== undefined ? data.active : true,
        address: data.address,
        created_at: toDate(data.createdAt) || new Date().toISOString(),
        updated_at: toDate(data.updatedAt) || new Date().toISOString()
      };
    }, isDryRun);

    console.log("Migration script finished successfully.");
  } catch(e) {
    console.error("error initializing script", e);
  }
}
run();
