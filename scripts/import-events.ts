#!/usr/bin/env npx tsx
/**
 * Import Events to Firestore
 * 
 * Uses Firebase Admin SDK with the service account from scripts/lib/admin-credentials.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { Firestore, getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { loadServiceAccount } from "./lib/admin-credentials";
import * as fs from "fs";
import * as path from "path";

process.env.TZ = "Asia/Kolkata";

const sa = loadServiceAccount();
const projectId = sa.projectId;

console.log("Initializing Firebase Admin SDK...");
initializeApp({
  credential: cert(sa),
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
