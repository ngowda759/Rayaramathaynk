import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadServiceAccount } from "./lib/admin-credentials";

const poojas = [
  // Daily Sevas - sorted by amount ASC
  { title: "Arati", description: "Arati", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 20, isActive: true, displayOrder: 1, days: ["All"], notes: "" },
  { title: "Panchamrutha", description: "Panchamrutha", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 100, isActive: true, displayOrder: 2, days: ["All"], notes: "" },
  { title: "Madhu Abhisheka", description: "Madhu Abhisheka", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 200, isActive: true, displayOrder: 3, days: ["All"], notes: "" },
  { title: "Vahana Pooja", description: "Vahana Pooja", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 200, isActive: true, displayOrder: 4, days: ["All"], notes: "" },
  { title: "Hastodaka", description: "Hastodaka", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 250, isActive: true, displayOrder: 5, days: ["All"], notes: "" },
  { title: "Totillu Seva", description: "Totillu Seva", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 250, isActive: true, displayOrder: 6, days: ["All"], notes: "" },
  { title: "Padapooja", description: "Padapooja", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 500, isActive: true, displayOrder: 7, days: ["All"], notes: "" },
  { title: "Annadana Seve", description: "Annadana Seve", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 500, isActive: true, displayOrder: 8, days: ["All"], notes: "" },
  { title: "Anna Santharpana Seva", description: "Anna Santharpana Seva", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 2500, isActive: true, displayOrder: 9, days: ["All"], notes: "" },
  { title: "Archane with Arati", description: "Archane with Arati", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 50, isActive: true, displayOrder: 10, days: ["All"], notes: "" },
  // Special Sevas - sorted by amount ASC
  { title: "Rathotsava", description: "Rathotsava", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 11, days: ["All"], notes: "" },
  { title: "Annaprashana / Aksharaabhysa", description: "Annaprashana / Aksharaabhysa", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 12, days: ["All"], notes: "" },
  { title: "Maha Pooja", description: "Maha Pooja", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 13, days: ["All"], notes: "" },
  { title: "Sankalpa Shraddha", description: "Sankalpa Shraddha", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 14, days: ["All"], notes: "" },
  { title: "Taila Nandadeepa", description: "Taila Nandadeepa", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 15, days: ["All"], notes: "" },
  { title: "Kanakabhisheka", description: "Kanakabhisheka", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1001, isActive: true, displayOrder: 16, days: ["All"], notes: "" },
  { title: "Satyanarayana Pooja", description: "Satyanarayana Pooja", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1200, isActive: true, displayOrder: 17, days: ["All"], notes: "" },
  { title: "Chataka Shraddha", description: "Chataka Shraddha", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1500, isActive: true, displayOrder: 18, days: ["All"], notes: "" },
  { title: "Rajatakavacha Samarpana", description: "Rajatakavacha Samarpana", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 2500, isActive: true, displayOrder: 19, days: ["All"], notes: "" },
  { title: "Prasada Seva", description: "Prasada Seva", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 2500, isActive: true, displayOrder: 20, days: ["All"], notes: "" },
  { title: "Grutha Nandadeepa", description: "Grutha Nandadeepa", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 2500, isActive: true, displayOrder: 21, days: ["All"], notes: "" },
  { title: "Anantapadmanabha Vruta", description: "Anantapadmanabha Vruta", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 4000, isActive: true, displayOrder: 22, days: ["All"], notes: "" },
  { title: "Pratyaksha Govu Daana", description: "Pratyaksha Govu Daana", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 5000, isActive: true, displayOrder: 23, days: ["All"], notes: "" },
  { title: "Reshme Vastra Seva", description: "Reshme Vastra Seva", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 5000, isActive: true, displayOrder: 24, days: ["All"], notes: "" },
  { title: "Srinivasa Kalyana", description: "Srinivasa Kalyana", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 7000, isActive: true, displayOrder: 25, days: ["All"], notes: "" },
  { title: "Shaswatha Annadana Seva", description: "Shaswatha Annadana Seva", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 10000, isActive: true, displayOrder: 26, days: ["All"], notes: "" },
];

async function seedPoojas() {
  const sa = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
    });
  }

  const db = getFirestore();
  const poojasCollection = db.collection("dailyPoojas");

  // Delete existing poojas
  console.log("Deleting existing poojas...");
  const existingPoojas = await poojasCollection.get();
  const deletePromises = existingPoojas.docs.map((d) => d.ref.delete());
  await Promise.all(deletePromises);
  console.log(`Deleted ${existingPoojas.size} existing poojas`);

  // Add new poojas in sorted order
  console.log("\nAdding poojas sorted by amount (ASC)...");
  for (const pooja of poojas) {
    await poojasCollection.add({
      ...pooja,
      createdAt: new Date().toISOString(),
      createdBy: "system",
    });
    console.log(`Added: ${pooja.title} - INR ${pooja.sevaAmount}`);
  }

  console.log(`\nSuccessfully added ${poojas.length} poojas sorted by amount!`);
  process.exit(0);
}

seedPoojas().catch((error) => {
  console.error("Error seeding poojas:", error);
  process.exit(1);
});
