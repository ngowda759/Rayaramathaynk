#!/usr/bin/env node

/**
 * Migration Script: AI Collections (Firestore -> Supabase)
 * This script reads AI-related collections from Firestore and upserts them to Supabase PostgreSQL.
 * Run with --dry-run to test without writing.
 */

import { getAdminFirestore } from "../lib/admin-firebase";
import { createAdminClient } from "../lib/supabase/admin";
import { CollectionReference } from "firebase-admin/firestore";

const BATCH_SIZE = 500;

// Utility to convert Firestore Timestamp to ISODate string
function toDate(fbTimestamp: any): string | null {
  if (!fbTimestamp) return null;
  if (typeof fbTimestamp.toDate === "function") {
    return fbTimestamp.toDate().toISOString();
  }
  // Handle raw object {_seconds, _nanoseconds}
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

  // Try to get total count
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

    // 1. chat_sessions
    await migrateCollection(db, supabase, "chat_sessions", "chat_sessions", (id, data) => {
      const created_at = toDate(data.createdAt) || new Date().toISOString();
      const updated_at = toDate(data.updatedAt) || created_at;

      return {
        firestore_id: id,
        user_id: data.userId || null,
        message_count: typeof data.messageCount === 'number' ? data.messageCount : 0,
        last_message: data.lastMessage || null,
        detected_language: data.detectedLanguage || null,
        created_at,
        updated_at
      };
    }, isDryRun);

    // 2. messages -> chat_messages
    await migrateCollection(db, supabase, "messages", "chat_messages", (id, data) => {
      if (!data.sessionId) throw new Error("Missing sessionId");
      if (!data.role) throw new Error("Missing role");
      if (!data.content && data.content !== "") throw new Error("Missing content");

      const timestamp = toDate(data.timestamp);
      if (!timestamp) throw new Error("Missing or invalid timestamp");

      return {
        firestore_id: id,
        session_id: data.sessionId,
        role: data.role,
        content: data.content,
        timestamp,
        model: data.model || null,
        latency: typeof data.latency === 'number' ? data.latency : null,
        detected_language: data.detectedLanguage || null
      };
    }, isDryRun);

    // 3. unknown_questions
    await migrateCollection(db, supabase, "unknown_questions", "unknown_questions", (id, data) => {
      if (!data.question) throw new Error("Missing question");

      const timestamp = toDate(data.timestamp) || new Date().toISOString();

      return {
        firestore_id: id,
        question: data.question,
        question_lower: data.questionLower || data.question.toLowerCase(),
        detected_intent: data.detectedIntent || data.intent || null,
        confidence: typeof data.confidence === 'number' ? data.confidence : null,
        language: data.language || null,
        timestamp,
        session_id: data.sessionId || null,
        times_asked: typeof data.timesAsked === 'number' ? data.timesAsked : 1,
        status: data.status || 'pending',
        assigned_to: data.assignedTo || 'unassigned',
        last_asked: toDate(data.lastAsked) || null,
        reviewed_by: data.reviewedBy || null,
        reviewed_at: toDate(data.reviewedAt) || null,
        response: data.response || null,
        added_to_knowledge_article_id: data.addedToKnowledgeArticleId || null,
        notes: data.notes || null
      };
    }, isDryRun);

    // 4. ai_intent_distribution
    await migrateCollection(db, supabase, "ai_intent_distribution", "ai_intent_distribution", (id, data) => {
      if (!data.intent) throw new Error("Missing intent");

      const timestamp = toDate(data.timestamp) || new Date().toISOString();

      return {
        firestore_id: id,
        intent: data.intent,
        category: data.category || null,
        language: data.language || null,
        confidence: typeof data.confidence === 'number' ? data.confidence : null,
        timestamp,
        session_id: data.sessionId || null,
        message_id: data.messageId || null
      };
    }, isDryRun);

    // 5. ai_latency_records
    await migrateCollection(db, supabase, "ai_latency_records", "ai_latency_records", (id, data) => {
      if (typeof data.totalLatency !== 'number') throw new Error("Missing totalLatency");

      const timestamp = toDate(data.timestamp) || new Date().toISOString();

      return {
        firestore_id: id,
        total_latency: data.totalLatency,
        intent_detection_time: typeof data.intentDetectionTime === 'number' ? data.intentDetectionTime : 0,
        retrieval_time: typeof data.retrievalTime === 'number' ? data.retrievalTime : 0,
        generation_time: typeof data.generationTime === 'number' ? data.generationTime : 0,
        timestamp,
        success: data.success !== undefined ? data.success : true,
        error_type: data.errorType || null,
        model: data.model || null,
        session_id: data.sessionId || null
      };
    }, isDryRun);

    console.log("\nMigration completed.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
