import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

const sevas = [
  // Special Sevas
  { name: "Shaswatha Annadana Seva", description: "Shaswatha Annadana Seva", category: "Special", amount: 10000, duration: 30, imageUrl: "", active: true, displayOrder: 1 },
  { name: "Srinivasa Kalyana", description: "Srinivasa Kalyana", category: "Special", amount: 7000, duration: 60, imageUrl: "", active: true, displayOrder: 2 },
  { name: "Pratyaksha Govu Daana", description: "Pratyaksha Govu Daana", category: "Special", amount: 5000, duration: 30, imageUrl: "", active: true, displayOrder: 3 },
  { name: "Reshme Vastra Seva", description: "Reshme Vastra Seva", category: "Special", amount: 5000, duration: 30, imageUrl: "", active: true, displayOrder: 4 },
  { name: "Anantapadmanabha Vruta", description: "Anantapadmanabha Vruta", category: "Special", amount: 4000, duration: 30, imageUrl: "", active: true, displayOrder: 5 },
  { name: "Rajatakavacha Samarpana", description: "Rajatakavacha Samarpana", category: "Special", amount: 2500, duration: 30, imageUrl: "", active: true, displayOrder: 6 },
  { name: "Prasada Seva", description: "Prasada Seva", category: "Special", amount: 2500, duration: 30, imageUrl: "", active: true, displayOrder: 7 },
  { name: "Grutha Nandadeepa", description: "Grutha Nandadeepa", category: "Special", amount: 2500, duration: 30, imageUrl: "", active: true, displayOrder: 8 },
  { name: "Chataka Shraddha", description: "Chataka Shraddha", category: "Special", amount: 1500, duration: 30, imageUrl: "", active: true, displayOrder: 9 },
  { name: "Satyanarayana Pooja", description: "Satyanarayana Pooja", category: "Special", amount: 1200, duration: 30, imageUrl: "", active: true, displayOrder: 10 },
  { name: "Kanakabhisheka", description: "Kanakabhisheka", category: "Special", amount: 1001, duration: 30, imageUrl: "", active: true, displayOrder: 11 },
  { name: "Rathotsava", description: "Rathotsava", category: "Special", amount: 1000, duration: 30, imageUrl: "", active: true, displayOrder: 12 },
  { name: "Annaprashana / Aksharaabhysa", description: "Annaprashana / Aksharaabhysa", category: "Special", amount: 1000, duration: 30, imageUrl: "", active: true, displayOrder: 13 },
  { name: "Maha Pooja", description: "Maha Pooja", category: "Special", amount: 1000, duration: 30, imageUrl: "", active: true, displayOrder: 14 },
  { name: "Sankalpa Shraddha", description: "Sankalpa Shraddha", category: "Special", amount: 1000, duration: 30, imageUrl: "", active: true, displayOrder: 15 },
  { name: "Taila Nandadeepa", description: "Taila Nandadeepa", category: "Special", amount: 1000, duration: 30, imageUrl: "", active: true, displayOrder: 16 },
  // Daily Sevas
  { name: "Anna Santharpana Seva", description: "Anna Santharpana Seva", category: "Daily", amount: 2500, duration: 30, imageUrl: "", active: true, displayOrder: 17 },
  { name: "Padapooja", description: "Padapooja", category: "Daily", amount: 500, duration: 30, imageUrl: "", active: true, displayOrder: 18 },
  { name: "Annadana Seve", description: "Annadana Seve", category: "Daily", amount: 500, duration: 30, imageUrl: "", active: true, displayOrder: 19 },
  { name: "Hastodaka", description: "Hastodaka", category: "Daily", amount: 250, duration: 30, imageUrl: "", active: true, displayOrder: 20 },
  { name: "Totillu Seva", description: "Totillu Seva", category: "Daily", amount: 250, duration: 30, imageUrl: "", active: true, displayOrder: 21 },
  { name: "Madhu Abhisheka", description: "Madhu Abhisheka", category: "Daily", amount: 200, duration: 30, imageUrl: "", active: true, displayOrder: 22 },
  { name: "Vahana Pooja", description: "Vahana Pooja", category: "Daily", amount: 200, duration: 30, imageUrl: "", active: true, displayOrder: 23 },
  { name: "Panchamrutha", description: "Panchamrutha", category: "Daily", amount: 100, duration: 30, imageUrl: "", active: true, displayOrder: 24 },
  { name: "Archane with Arati", description: "Archane with Arati", category: "Daily", amount: 50, duration: 30, imageUrl: "", active: true, displayOrder: 25 },
  { name: "Arati", description: "Arati", category: "Daily", amount: 20, duration: 30, imageUrl: "", active: true, displayOrder: 26 },
];

async function seedSevas() {
  // Initialize Firebase Admin
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  };

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount as any),
    });
  }

  const db = getFirestore();
  const sevasCollection = collection(db, "sevas");

  // Delete existing sevas
  console.log("Deleting existing sevas...");
  const existingSevas = await getDocs(sevasCollection);
  const deletePromises = existingSevas.docs.map((doc) => deleteDoc(doc(db, "sevas", doc.id)));
  await Promise.all(deletePromises);
  console.log(`Deleted ${existingSevas.docs.length} existing sevas`);

  // Add new sevas
  console.log("Adding new sevas...");
  for (const seva of sevas) {
    await addDoc(sevasCollection, {
      ...seva,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`Added: ${seva.name}`);
  }

  console.log(`\nSuccessfully added ${sevas.length} sevas!`);
  process.exit(0);
}

seedSevas().catch((error) => {
  console.error("Error seeding sevas:", error);
  process.exit(1);
});
