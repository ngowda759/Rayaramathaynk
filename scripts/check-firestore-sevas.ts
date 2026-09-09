import { getAdminFirestore } from "../lib/admin-firebase";

async function checkFirestore() {
  try {
    console.log("Attempting to connect to Firestore...");
    const db = await getAdminFirestore();

    console.log("Attempting to read 'sevas' collection...");
    const snapshot = await db.collection("sevas").get();

    const count = snapshot.size;
    const docIds = snapshot.docs.map(doc => doc.id);

    console.log(`\nFIRESTORE READ: SUCCESS`);
    console.log(`FIRESTORE SEVAS COUNT: ${count}`);
    console.log(`FIRESTORE DOCUMENT IDS: \n - ${docIds.join('\n - ')}`);
    console.log(`\nNEXT ACTION: REAL MIGRATION`);
  } catch (error: any) {
    if (error.message && error.message.includes("RESOURCE_EXHAUSTED")) {
      console.log(`\nFIRESTORE READ: BLOCKED`);
      console.log(`FIRESTORE SEVAS COUNT: UNKNOWN`);
      console.log(`FIRESTORE DOCUMENT IDS: NONE`);
      console.log(`\nNEXT ACTION: QUOTA WORKAROUND REQUIRED`);
    } else {
      console.error("\nUnexpected error:", error);
    }
  }
  process.exit(0);
}

checkFirestore();
