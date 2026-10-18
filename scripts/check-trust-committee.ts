import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadServiceAccount } from "./lib/admin-credentials";

async function checkTrustCommittee() {
  const sa = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
    });
  }

  const db = getFirestore();
  const settingsRef = db.collection("settings").doc("trustCommittee");

  console.log("Fetching trust committee data from Firebase...");
  const doc = await settingsRef.get();
  
  if (doc.exists) {
    console.log("Document found!");
    const data = doc.data();
    console.log("Number of members:", data?.members?.length || 0);
    console.log("Heading:", data?.heading);
    console.log("First member:", JSON.stringify(data?.members?.[0], null, 2));
  } else {
    console.log("Document NOT found!");
  }
  
  process.exit(0);
}

checkTrustCommittee().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
