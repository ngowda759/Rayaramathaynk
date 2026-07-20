#!/usr/bin/env npx tsx
/**
 * Check Firestore Collections
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
});

const db = getFirestore();

async function checkCollections() {
  console.log("=== Checking Firestore Collections ===\n");
  
  // Check 'aaradhane' collection
  const aaradhaneSnap = await db.collection("aaradhane").get();
  console.log(`'aaradhane' collection: ${aaradhaneSnap.size} documents`);
  
  // Check 'aaradhanes' collection  
  const aaradhanesSnap = await db.collection("aaradhanes").get();
  console.log(`'aaradhanes' collection: ${aaradhanesSnap.size} documents`);
  
  // Check 'events' collection
  const eventsSnap = await db.collection("events").get();
  console.log(`'events' collection: ${eventsSnap.size} documents`);
  
  // List documents in aaradhane
  console.log("\n--- Documents in 'aaradhane' ---");
  if (aaradhaneSnap.empty) {
    console.log("  (empty)");
  } else {
    aaradhaneSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}: ${data.title || data.name || 'Untitled'}`);
    });
  }
  
  // List documents in aaradhanes
  console.log("\n--- Documents in 'aaradhanes' ---");
  if (aaradhanesSnap.empty) {
    console.log("  (empty)");
  } else {
    aaradhanesSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}: ${data.title || data.name || 'Untitled'}`);
    });
  }
  
  console.log("\n✅ Total from aaradhane + aaradhanes:", aaradhaneSnap.size + aaradhanesSnap.size);
}

checkCollections().catch(console.error);
