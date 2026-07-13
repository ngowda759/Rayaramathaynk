import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { Auth, getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { Firestore, getFirestore, getDocs, collection, query, where, orderBy } from "firebase/firestore";
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
  return result.isValid;
};

// Get validation details (for debugging)
export const getFirebaseConfigStatus = (): FirebaseConfigValidation => {
  const status = validateFirebaseConfig();
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
let authInitialized = false;

async function initializeAuth(authInstance: Auth): Promise<void> {
  if (authInitialized) return;
  
  try {
    // Set auth persistence to LOCAL (persists across browser sessions)
    await setPersistence(authInstance, browserLocalPersistence);
    authInitialized = true;
    console.log("Firebase auth persistence set to LOCAL");
  } catch (error) {
    console.error("Failed to set auth persistence:", error);
    // Fallback to session persistence
    try {
      await setPersistence(authInstance, browserSessionPersistence);
      console.log("Firebase auth persistence set to SESSION (fallback)");
    } catch (sessionError) {
      console.error("Failed to set session persistence:", sessionError);
    }
  }
}

if (isFirebaseConfigured()) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Initialize auth with persistence
  initializeAuth(auth);
  
  db = getFirestore(app);
  // Only initialize storage if storage bucket is configured
  if (firebaseConfig.storageBucket) {
    storage = getStorage(app);
  }
}

// Helper to get next upcoming event
export interface NextEventInfo {
  title: string;
  date: Date;
}

export async function getNextUpcomingEvent(): Promise<NextEventInfo | null> {
  if (!db) {
    return null;
  }

  try {
    const now = new Date();
    const eventsRef = collection(db, "events");
    
    // Query for upcoming published events
    const q = query(
      eventsRef,
      where("published", "==", true),
      orderBy("startDate", "asc")
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    // Find the first event that hasn't ended yet
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let eventEndDate: Date;
      
      if (data.endDate) {
        // Handle Firestore Timestamp
        if (data.endDate.toDate && typeof data.endDate.toDate === 'function') {
          eventEndDate = data.endDate.toDate();
        } else if (data.endDate instanceof Date) {
          eventEndDate = data.endDate;
        } else {
          eventEndDate = new Date(data.endDate);
        }
      } else if (data.startDate) {
        // If no endDate, use startDate
        if (data.startDate.toDate && typeof data.startDate.toDate === 'function') {
          eventEndDate = data.startDate.toDate();
        } else if (data.startDate instanceof Date) {
          eventEndDate = data.startDate;
        } else {
          eventEndDate = new Date(data.startDate);
        }
      } else {
        continue;
      }

      // If event hasn't ended, this is our next event
      if (eventEndDate >= now) {
        let eventStartDate: Date;
        if (data.startDate) {
          if (data.startDate.toDate && typeof data.startDate.toDate === 'function') {
            eventStartDate = data.startDate.toDate();
          } else if (data.startDate instanceof Date) {
            eventStartDate = data.startDate;
          } else {
            eventStartDate = new Date(data.startDate);
          }
        } else {
          eventStartDate = eventEndDate;
        }

        return {
          title: data.title || "Upcoming Event",
          date: eventStartDate,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching next event:", error);
    return null;
  }
}

export { app, auth, db, storage, isFirebaseConfigured, initializeAuth };
export { validateFirebaseConfig };
export default app;
