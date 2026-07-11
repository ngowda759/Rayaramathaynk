import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";

// Validate Firebase configuration
interface FirebaseConfigValidation {
  isValid: boolean;
  missingFields: string[];
}

const validateFirebaseConfig = (): FirebaseConfigValidation => {
  const requiredFields = [
    { key: "NEXT_PUBLIC_FIREBASE_API_KEY", name: "API Key" },
    { key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", name: "Auth Domain" },
    { key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", name: "Project ID" },
    { key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", name: "Storage Bucket" },
    { key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", name: "Messaging Sender ID" },
    { key: "NEXT_PUBLIC_FIREBASE_APP_ID", name: "App ID" },
  ];

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = process.env[field.key];
    if (!value || value === "" || value === "your-api-key") {
      missingFields.push(field.name);
    }
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
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "SET" : "NOT SET",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "SET" : "NOT SET",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "SET" : "NOT SET",
  });
  return result.isValid;
};

// Get validation details (for debugging)
export const getFirebaseConfigStatus = (): FirebaseConfigValidation => {
  return validateFirebaseConfig();
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
  storage = getStorage(app);
}

export { app, auth, db, storage, isFirebaseConfigured };
export default app;
