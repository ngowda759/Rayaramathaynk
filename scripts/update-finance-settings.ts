import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function updateFinanceSettings() {
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
  const settingsDoc = db.collection("settings").doc("financeSettings");

  // Update finance settings with UPI details
  const financeSettings = {
    enabled: true,
    upi: {
      enabled: true,
      id: "9886364462@ptsbi", // User's UPI ID
      displayName: "Sri Raghavendra Swamy Matha",
    },
    bankTransfer: {
      enabled: false,
      accountName: "",
      accountNumber: "",
      bankName: "",
      ifscCode: "",
      branch: "",
    },
    specialSevas: [
      {
        id: "1",
        title: "Annadanam",
        description: "Sponsor prasada and meals for devotees visiting the temple.",
        amount: 501,
        icon: "heart",
        isActive: true,
        order: 1,
      },
      {
        id: "2",
        title: "Goshala",
        description: "Support the care and maintenance of our sacred cows.",
        amount: 1001,
        icon: "cows",
        isActive: true,
        order: 2,
      },
      {
        id: "3",
        title: "Temple Development",
        description: "Contribute towards renovation and future development projects.",
        amount: 5001,
        icon: "building",
        isActive: true,
        order: 3,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  try {
    await settingsDoc.set(financeSettings);
    console.log("✅ Finance settings updated successfully!");
    console.log("UPI ID: 9886364462@ptsbi");
    console.log("UPI Display Name: Sri Raghavendra Swamy Matha");
    console.log("UPI Enabled: true");
  } catch (error) {
    console.error("Error updating finance settings:", error);
  }
}

updateFinanceSettings().catch(console.error);
