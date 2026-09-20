// Settings Retrieval - Temple contact info, timings, address
// Single source of truth for all temple basic information

import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { TempleSettings, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for settings
let cachedSettings: TempleSettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Default settings as fallback
 */
const DEFAULT_SETTINGS: TempleSettings = {
  name: "Sri Raghavendra Swamy Matha",
  address: "Yelahanka New Town, Bengaluru, Karnataka, India",
  phone: "+91 80 2847 1234",
  email: "info@sriraghavendra.org",
  timings: {
      morningOpen: "6:00 AM",
      morningClose: "12:00 PM",
      eveningOpen: "5:00 PM",
      eveningClose: "8:30 PM",
  },
  contact: {
    phone: "+91 80 2847 1234",
    email: "info@sriraghavendra.org",
    address: "Yelahanka New Town, Bengaluru, Karnataka, India"
  },
  officeHours: {
    weekday: "9:00 AM - 5:00 PM",
    weekend: "10:00 AM - 4:00 PM"
  },
  visitorInfo: {
    guidelines: "Please maintain silence.",
    dressCode: "Traditional wear requested.",
    photographyPolicy: "Not allowed inside sanctum.",
    parking: "Available outside.",
    facilities: "Restrooms and drinking water available.",
    wheelchairAccess: "Available.",
    drinkingWater: "Available.",
    restrooms: "Available.",
    prasada: "Available after daily pooja.",
    annadanam: "Available on special occasions.",
    accommodation: "Not available.",
    volunteerInfo: "Contact office.",
    testimonials: "Available on website.",
    contact: "+91 80 2847 1234"
  }
};

/**
 * Fetch temple settings from Firebase settings collection
 */
async function fetchFromFirebase(): Promise<TempleSettings> {
  if (!isFirebaseConfigured() || !db) {
    return DEFAULT_SETTINGS;
  }

  try {
    const q = query(
      collection(db, "settings"),
      orderBy("updatedAt", "desc")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return DEFAULT_SETTINGS;
    }

    const data = snapshot.docs[0].data();
    
    return {
      name: data.templeName || DEFAULT_SETTINGS.name,
      address: data.address || DEFAULT_SETTINGS.address,
      phone: data.contactPhone || data.phone || DEFAULT_SETTINGS.phone,
      email: data.contactEmail || data.email || DEFAULT_SETTINGS.email,
      timings: {
        morningOpen: data.morningOpen || DEFAULT_SETTINGS.timings.morningOpen,
        morningClose: data.morningClose || DEFAULT_SETTINGS.timings.morningClose,
        eveningOpen: data.eveningOpen || DEFAULT_SETTINGS.timings.eveningOpen,
        eveningClose: data.eveningClose || DEFAULT_SETTINGS.timings.eveningClose,
      },
      contact: DEFAULT_SETTINGS.contact,
      officeHours: DEFAULT_SETTINGS.officeHours,
      visitorInfo: DEFAULT_SETTINGS.visitorInfo,
      googleMapsUrl: data.googleMapsUrl,
    };
  } catch (error) {
    console.error("[Settings Retrieval] Error fetching from Firebase:", error);
    return cachedSettings || DEFAULT_SETTINGS;
  }
}

/**
 * Fetch timings specifically from Firebase timings collection
 */
async function fetchTimingsFromFirebase(): Promise<TempleSettings["timings"] | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  try {
    const snapshot = await getDocs(collection(db, "timings"));
    
    if (snapshot.empty) {
      return null;
    }

    const data = snapshot.docs[0].data();
    return {
      morningOpen: data.morningOpen || data.open || DEFAULT_SETTINGS.timings.morningOpen,
      morningClose: data.morningClose || data.close || DEFAULT_SETTINGS.timings.morningClose,
      eveningOpen: data.eveningOpen || DEFAULT_SETTINGS.timings.eveningOpen,
      eveningClose: data.eveningClose || DEFAULT_SETTINGS.timings.eveningClose,
    };
  } catch (error) {
    console.error("[Settings Retrieval] Error fetching timings:", error);
    return null;
  }
}

/**
 * Get temple settings with caching
 */
export async function getTempleSettings(): Promise<RetrievedData<TempleSettings>> {
  const now = Date.now();
  const fromCache = cachedSettings && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    return {
      data: cachedSettings,
      source: RetrievalType.REPOSITORY,
      confidence: 100,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    // Try to get timings from separate collection
    const timings = await fetchTimingsFromFirebase();
    
    // Fetch base settings
    const settings = await fetchFromFirebase();
    
    // Override timings if available from separate collection
    if (timings) {
      settings.timings = timings;
    }

    cachedSettings = settings;
    lastFetchTime = now;

    return {
      data: settings,
      source: RetrievalType.REPOSITORY,
      confidence: 95, // Slightly less than 100 due to potential defaults
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Settings Retrieval] Error:", error);
    return {
      data: cachedSettings || DEFAULT_SETTINGS,
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get only temple timings
 */
export async function getTempleTimings(): Promise<RetrievedData<TempleSettings["timings"]>> {
  const result = await getTempleSettings();
  
  return {
    data: result.data?.timings || DEFAULT_SETTINGS.timings,
    source: result.source,
    confidence: result.confidence,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Get only contact information
 */
export async function getContactInfo(): Promise<RetrievedData<{
  phone: string;
  email: string;
  address: string;
}>> {
  const result = await getTempleSettings();
  
  return {
    data: result.data ? {
      phone: result.data.phone,
      email: result.data.email,
      address: result.data.address,
    } : null,
    source: result.source,
    confidence: result.confidence,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Clear settings cache (useful after admin updates)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
  lastFetchTime = 0;
}
