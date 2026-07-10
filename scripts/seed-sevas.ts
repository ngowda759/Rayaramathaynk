import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
  const sevasCollection = db.collection("sevas");

  // Check existing sevas
  console.log("Checking existing sevas...");
  const existingSevas = await sevasCollection.get();
  console.log(`Found ${existingSevas.size} existing sevas`);

  // Add new sevas (keeping existing ones)
  console.log("\nAdding new sevas...");
  for (const seva of sevas) {
    await sevasCollection.add({
      ...seva,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`Added: ${seva.name}`);
  }

  console.log(`\nSuccessfully added ${sevas.length} new sevas!`);
  console.log(`Total sevas in database: ${existingSevas.size + sevas.length}`);
  process.exit(0);
}

seedSevas().catch((error) => {
  console.error("Error seeding sevas:", error);
  process.exit(1);
});
