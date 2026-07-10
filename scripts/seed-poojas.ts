import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCrryMVL/BrePgi
e7L3yTRr6sr8OnGdqvF7ah11JO1aOS++eCsT09V30+Q+KMbswMk5zzdnuia77P/3
gi5oZdLL1erfYT6Pm1VQpQ0UIF9UC5FeQMo1/rzqOxndCohEeAbFtwJ09VjaRx2t
AHs3aJHeJPki7kvFeT246TunxElngREwVRyJ7rZapjl6f8Zh9bJkd2z7IhkcF8EZ
SzEQxQ4+qMU0DUxTlImpkIbe7BQmBEVGszpCRpdnZ8uG6R+y4bIC2zzBLdmsl50p
urz5fWt3zXp+BSrEHzQ4CmExPfHUPFsmUj+zJUispHkL11h09L+hlEAxvyywQnnw
40JUm5VhAgMBAAECggEAKuQ9Woy4ftEhBNRsmNUOoKtu/ObI/b/4RoHzTBHmrnS9
BdPVx0VT/nTUf+cGE53yZ9vqFqL+DFMge8BtQa22pTATVq1fyNbg0J37j3yq9D9T
mP2Mx0KWBdqwEnYQJzLpVjnrhjbJdPbxZghJwEUCtEH+cAiiq3onvmueeMJkKFRA
qQiRZe3qdnAv0Pdc4fJsHAVsDxIUOlwobUa75KMYxEBaccBGpopYkf5Y3JutH4bE
3HKawW2QKFzDMVrZmoXCfDxvggPhGLEfA7lhVM+yHAzhUC50Y2gvGjLNOMw/Ordf
GCCXNAogiLcQToNk9xIHgWSl51u0Tpvd8kc004NgcQKBgQDUhDdt0/GsS6IVaRxH
dO2rZQFrXJenIlg+ajb5N8K+706lX3jpR4iZhnKIRYibez2/VQ0bOng/bauBao/n
CL/AucKlKA8qMRa+/BJ1rlQGF+9vjhaU9ynnrWg1CBzlts+IZwF52YIAXS3zfFjU
w7zp3S6ARt1EimBAEtW5dUga7QKBgQDO0Bbz0+DrqF/m0j/tashr1wTt3SyoqWQn
1bo3s3/nSBRlEA+6o9YKbkc+RIK7HWKnOoDHzK7oOtPL7jEd8AyBkelsg+l95LIT
z36D5M+yRhmnuqJaa045yeFtWe+PgCdjkjZH+XtvKsXTGoOap04nTLiQ9smFS6QE
9GDCwmWxxQKBgQCvJCP2TJTAtThoQs7+iPwSo9SOoamOIXzuO2UA8RZ7eweqvMsO
HlkShb5AVmXmFaRm2fZKOV6+j2in6KWd9xTpBW7H5ALTd89SKLYh7EDtIK7Ali5A
KI6Nk9js07nVC1twA8wwmrRMDn7/Srx+5K39Yr6fE0fp48y9IYioJmL9ZQKBgQC8
f1N8N1DY2aVXR6i2p043ZEp81ss+iu3blOTeof9g+QSFvKbpcSzEYxESQvV4wGbL
jvoToY6F4iBqzhX8eG+dpTVBD9ZARbK9dbCVXHalwVje1K/ng8hPyZ5qwb8kZyT/
jyNkZJLJlw2pxI/Q5M7J6RaMIjM5B+FeFrMesHpqFQKBgQDRHofHt0uyDmiKMlgW
Sew3chIXFwkhDz4LyYJWSsia15TeaB2MQdJAxlqqr02Mz7Tp6HFRIer8KjH9PNFz
XRqd7UonUevdW58l2K7QUbqGX6EV+XAEW4+BO76m9DNlMEuZcBJhBpBCZt8abGxp
vwHm2b//G+nR0ivqDn1UYeA67A==
-----END PRIVATE KEY-----`;

  const serviceAccount = {
    type: "service_account",
    project_id: "sri-raghavendra-mutt",
    private_key_id: "9f5e950d788ea927d8ef01a18b3d115a239a152a",
    private_key: privateKey,
    client_email: "firebase-adminsdk-fbsvc@sri-raghavendra-mutt.iam.gserviceaccount.com",
    client_id: "123456789",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  };

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount as any),
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
