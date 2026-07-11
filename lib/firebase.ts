import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";

// Validate Firebase configuration
interface FirebaseConfigValidation {
  isValid: boolean;
  missingFields: string[];
}

// Fixed: Use direct env var access for Turbopack compatibility
const validateFirebaseConfig = (): FirebaseConfigValidation => {
  const missingFields: string[] = [];

  // Access env vars directly (required for Turbopack compatibility)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || apiKey === "" || apiKey === "your-api-key") {
    missingFields.push("API Key");
  }
  if (!authDomain || authDomain === "") {
    missingFields.push("Auth Domain");
  }
  if (!projectId || projectId === "") {
    missingFields.push("Project ID");
  }
  if (!messagingSenderId || messagingSenderId === "") {
    missingFields.push("Messaging Sender ID");
  }
  if (!appId || appId === "") {
    missingFields.push("App ID");
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

// Check if Firebase is properly configured
const isFirebaseConfigured = (): boolean => {
  const result = validateFirebaseConfig();
  console.log("🔥 isFirebaseConfigured check:", {
    isValid: result.isValid,
    missingFields: result.missingFields,
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? `SET (${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 10)}...)` : "NOT SET",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "NOT SET",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "NOT SET",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "NOT SET",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "NOT SET",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "NOT SET",
  });
  return result.isValid;
};

// Get validation details (for debugging)
export const getFirebaseConfigStatus = (): FirebaseConfigValidation => {
  const status = validateFirebaseConfig();


  console.log("Firebase Config Status:", status);


  return status;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

// Initialize Firebase only if properly configured
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // Only initialize storage if storage bucket is configured
  if (firebaseConfig.storageBucket) {
    storage = getStorage(app);
  }
}

export { app, auth, db, storage, isFirebaseConfigured };
export { validateFirebaseConfig };
export default app;
