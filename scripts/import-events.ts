#!/usr/bin/env npx tsx
/**
 * Import Events to Firestore
 * 
 * Uses Firebase Admin SDK with environment variables.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { Firestore, getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

process.env.TZ = "Asia/Kolkata";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

// Replace literal \n with actual newlines (handles both escaped and unescaped)
privateKey = privateKey.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing Firebase environment variables:");
  console.error("   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  console.error("\nPrivate key starts with:", privateKey.substring(0, 50));
  process.exit(1);
}

// Validate private key format
if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
  console.error("❌ Invalid private key format - missing BEGIN marker");
  process.exit(1);
}

console.log("Initializing Firebase Admin SDK...");
initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
});

const db = getFirestore();

async function importEvents(year: number): Promise<void> {
  const exportFile = path.join(process.cwd(), "data", "exports", `aaradhane-events-${year}.json`);
  
  if (!fs.existsSync(exportFile)) {
    console.error(`❌ Export file not found: ${exportFile}`);
    console.log(`\nRun: npx tsx scripts/generate-events-firestore.ts`);
    return;
  }

  const events = JSON.parse(fs.readFileSync(exportFile, "utf-8"));
  
  console.log(`\n===========================================`);
  console.log(`IMPORTING EVENTS TO FIRESTORE - ${year}`);
  console.log(`===========================================\n`);
  console.log(`Events to import: ${events.length}\n`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const { startDate, endDate, ...rest } = event;
    
    try {
      await db.collection("events").add({
        ...rest,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`✓ ${i + 1}. ${event.title}`);
    } catch (error: any) {
      console.error(`✗ ${i + 1}. ${event.title} - ${error.message}`);
    }
  }
  
  console.log(`\n✅ Done! ${events.length} events imported to 'events' collection.`);
}

async function main() {
  const args = process.argv.slice(2);
  let year = 2026;
  
  const yearIndex = args.indexOf("--year");
  if (yearIndex !== -1 && args[yearIndex + 1]) {
    year = parseInt(args[yearIndex + 1], 10);
  }

  console.log("Firebase Project:", projectId);
  await importEvents(year);
}

main().catch(console.error);
