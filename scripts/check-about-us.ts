import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadServiceAccount } from "./lib/admin-credentials";

async function checkAboutUs() {
  const sa = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({ credential: cert(sa) });
  }

  const db = getFirestore();
  const docRef = db.collection("settings").doc("aboutUs");

  console.log("Fetching aboutUs data from Firebase...");
  const doc = await docRef.get();
  
  if (doc.exists) {
    const data = doc.data();
    console.log("Data found:");
    console.log("Visit Title:", data?.visitTitle);
    console.log("Address:", data?.address);
    console.log("Phone:", data?.phone);
    console.log("Phone2:", data?.phone2);
    console.log("Email:", data?.email);
  } else {
    console.log("Document NOT found!");
  }
}

checkAboutUs().catch(console.error);
