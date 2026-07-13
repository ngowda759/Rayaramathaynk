import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { Auth, getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { Firestore, getFirestore, getDocs, collection } from "firebase/firestore";
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

// Helper to convert various date formats to Date object
function toDate(dateValue: Date | number | string | { toDate: () => Date } | null | undefined): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && 'toDate' in dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  if (typeof dateValue === 'number') return new Date(dateValue);
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export async function getNextUpcomingEvent(): Promise<NextEventInfo | null> {
  if (!db) {
    console.log("[getNextUpcomingEvent] Firebase db not available");
    return null;
  }

  try {
    const now = new Date();
    console.log("[getNextUpcomingEvent] Fetching events at:", now.toISOString());
    
    // Get all events without complex query (avoiding index requirements)
    const snapshot = await getDocs(collection(db, "events"));
    
    console.log("[getNextUpcomingEvent] Total events in DB:", snapshot.size);
    
    if (snapshot.empty) {
      return null;
    }

    // Filter and sort client-side
    const upcomingEvents: Array<{ title: string; date: Date; endDate: Date }> = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip unpublished events (if published field exists and is false)
      if (data.published === false) {
        continue;
      }
      
      const startDate = toDate(data.startDate);
      const endDate = toDate(data.endDate);
      
      if (!startDate && !endDate) {
        continue;
      }
      
      // Use endDate if available, otherwise startDate
      const eventEndDate = endDate || startDate!;
      const eventStartDate = startDate || endDate!;
      
      // Skip past events
      if (eventEndDate < now) {
        continue;
      }
      
      upcomingEvents.push({
        title: data.title || "Upcoming Event",
        date: eventStartDate,
        endDate: eventEndDate,
      });
    }
    
    // Sort by start date ascending
    upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    console.log("[getNextUpcomingEvent] Upcoming events count:", upcomingEvents.length);
    
    if (upcomingEvents.length === 0) {
      return null;
    }
    
    const nextEvent = upcomingEvents[0];
    console.log("[getNextUpcomingEvent] Next event:", nextEvent.title, "on", nextEvent.date.toISOString());
    
    return {
      title: nextEvent.title,
      date: nextEvent.date,
    };
  } catch (error) {
    console.error("[getNextUpcomingEvent] Error fetching events:", error);
    return null;
  }
}

export { app, auth, db, storage, isFirebaseConfigured, initializeAuth };
export { validateFirebaseConfig };
export default app;
