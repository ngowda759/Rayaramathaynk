// Settings Retrieval - Temple contact info, timings, address
// Single source of truth for all temple basic information

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/client";
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
 * Fetch temple settings from Supabase settings collection
 */
async function fetchFromSupabase(): Promise<TempleSettings> {
  const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
  try {
    const { data, error } = await supabase
      .from('ai_settings')
      .select('temple_information, visitor_information, temple_policies')
      .eq('id', 'main')
      .single();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }

    const templeInfo = data.temple_information || {};
    const visitorInfo = data.visitor_information || {};
    const templePolicies = data.temple_policies || {};
    const timings = templeInfo.timings || {};
    const contact = templeInfo.contact || {};

    return {
      name: DEFAULT_SETTINGS.name,
      address: contact.address || DEFAULT_SETTINGS.address,
      phone: contact.phone || DEFAULT_SETTINGS.phone,
      email: contact.email || DEFAULT_SETTINGS.email,
      timings: {
        morningOpen: timings.morningOpen || DEFAULT_SETTINGS.timings.morningOpen,
        morningClose: timings.morningClose || DEFAULT_SETTINGS.timings.morningClose,
        eveningOpen: timings.eveningOpen || DEFAULT_SETTINGS.timings.eveningOpen,
        eveningClose: timings.eveningClose || DEFAULT_SETTINGS.timings.eveningClose,
      },
      contact: {
        phone: contact.phone || DEFAULT_SETTINGS.contact.phone,
        email: contact.email || DEFAULT_SETTINGS.contact.email,
        address: contact.address || DEFAULT_SETTINGS.contact.address
      },
      officeHours: templeInfo.officeHours || DEFAULT_SETTINGS.officeHours,
      visitorInfo: {
        guidelines: visitorInfo.guidelines || DEFAULT_SETTINGS.visitorInfo.guidelines,
        dressCode: templePolicies.dressCode || DEFAULT_SETTINGS.visitorInfo.dressCode,
        photographyPolicy: templePolicies.photographyPolicy || DEFAULT_SETTINGS.visitorInfo.photographyPolicy,
        parking: visitorInfo.parking || DEFAULT_SETTINGS.visitorInfo.parking,
        facilities: visitorInfo.facilities || DEFAULT_SETTINGS.visitorInfo.facilities,
        wheelchairAccess: visitorInfo.wheelchairAccess || DEFAULT_SETTINGS.visitorInfo.wheelchairAccess,
        drinkingWater: visitorInfo.drinkingWater || DEFAULT_SETTINGS.visitorInfo.drinkingWater,
        restrooms: visitorInfo.restrooms || DEFAULT_SETTINGS.visitorInfo.restrooms,
        prasada: visitorInfo.prasada || DEFAULT_SETTINGS.visitorInfo.prasada,
        annadanam: visitorInfo.annadanam || DEFAULT_SETTINGS.visitorInfo.annadanam,
        accommodation: visitorInfo.accommodation || DEFAULT_SETTINGS.visitorInfo.accommodation,
        volunteerInfo: visitorInfo.volunteerInfo || DEFAULT_SETTINGS.visitorInfo.volunteerInfo,
        testimonials: visitorInfo.testimonials || DEFAULT_SETTINGS.visitorInfo.testimonials,
        contact: visitorInfo.contact || DEFAULT_SETTINGS.visitorInfo.contact
      },
      googleMapsUrl: undefined,
    };
  } catch (error) {
    console.error("[Settings Retrieval] Error fetching from Supabase:", error);
    return cachedSettings || DEFAULT_SETTINGS;
  }
}

/**
 * Fetch timings specifically from Supabase timings collection
 */
async function fetchTimingsFromSupabase(): Promise<TempleSettings["timings"] | null> {
  const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
  try {
    const { data, error } = await supabase
      .from('ai_settings')
      .select('temple_information')
      .eq('id', 'main')
      .single();

    if (error || !data || !data.temple_information || !data.temple_information.timings) {
      return null;
    }

    const timings = data.temple_information.timings;
    return {
      morningOpen: timings.morningOpen || DEFAULT_SETTINGS.timings.morningOpen,
      morningClose: timings.morningClose || DEFAULT_SETTINGS.timings.morningClose,
      eveningOpen: timings.eveningOpen || DEFAULT_SETTINGS.timings.eveningOpen,
      eveningClose: timings.eveningClose || DEFAULT_SETTINGS.timings.eveningClose,
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
    const timings = await fetchTimingsFromSupabase();
    
    // Fetch base settings
    const settings = await fetchFromSupabase();
    
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
