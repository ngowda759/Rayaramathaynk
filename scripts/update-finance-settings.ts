import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadServiceAccount } from "./lib/admin-credentials";

async function updateFinanceSettings() {
  const sa = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
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
