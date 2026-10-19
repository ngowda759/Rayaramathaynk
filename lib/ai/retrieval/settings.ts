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

const AI_SETTINGS_TABLE = "ai_settings";
const AI_SETTINGS_ID = "main";

function getSupabase() {
  return typeof window === "undefined" ? createAdminClient() : createClient();
}

type AiSettingsRow = {
  temple_information?: Record<string, unknown> | null;
  visitor_information?: Record<string, unknown> | null;
  temple_policies?: Record<string, unknown> | null;
} | null;

/**
 * Read a non-empty string from an untyped JSON column value.
 */
function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

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
 * Fetch temple settings from the Supabase `ai_settings` row.
 *
 * `ai_settings.temple_information` is the authoritative store for temple
 * timings, contact details and office hours (the same row the AI Settings admin
 * page edits); `visitor_information` / `temple_policies` hold visitor guidance.
 * There is no Firestore fallback.
 */
async function fetchFromSupabase(): Promise<TempleSettings> {
  try {
    const { data, error } = await getSupabase()
      .from(AI_SETTINGS_TABLE)
      .select("temple_information, visitor_information, temple_policies")
      .eq("id", AI_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      console.error("[Settings Retrieval] Error fetching settings:", error.message);
      return cachedSettings || DEFAULT_SETTINGS;
    }

    const row = data as AiSettingsRow;
    if (!row) {
      return DEFAULT_SETTINGS;
    }

    const templeInfo = (row.temple_information || {}) as Record<string, unknown>;
    const visitorInfo = (row.visitor_information || {}) as Record<string, unknown>;
    const templePolicies = (row.temple_policies || {}) as Record<string, unknown>;
    const timings = (templeInfo.timings || {}) as Record<string, unknown>;
    const contact = (templeInfo.contact || {}) as Record<string, unknown>;
    const officeHours = (templeInfo.officeHours || {}) as Record<string, unknown>;

    return {
      name: DEFAULT_SETTINGS.name,
      address: asString(contact.address) || DEFAULT_SETTINGS.address,
      phone: asString(contact.phone) || DEFAULT_SETTINGS.phone,
      email: asString(contact.email) || DEFAULT_SETTINGS.email,
      timings: {
        morningOpen: asString(timings.morningOpen) || DEFAULT_SETTINGS.timings.morningOpen,
        morningClose: asString(timings.morningClose) || DEFAULT_SETTINGS.timings.morningClose,
        eveningOpen: asString(timings.eveningOpen) || DEFAULT_SETTINGS.timings.eveningOpen,
        eveningClose: asString(timings.eveningClose) || DEFAULT_SETTINGS.timings.eveningClose,
      },
      contact: {
        phone: asString(contact.phone) || DEFAULT_SETTINGS.contact.phone,
        email: asString(contact.email) || DEFAULT_SETTINGS.contact.email,
        address: asString(contact.address) || DEFAULT_SETTINGS.contact.address,
      },
      officeHours: {
        weekday: asString(officeHours.weekday) || DEFAULT_SETTINGS.officeHours.weekday,
        weekend: asString(officeHours.weekend) || DEFAULT_SETTINGS.officeHours.weekend,
        notes: asString(officeHours.notes) || DEFAULT_SETTINGS.officeHours.notes,
      },
      visitorInfo: {
        guidelines: asString(visitorInfo.guidelines) || DEFAULT_SETTINGS.visitorInfo.guidelines,
        dressCode: asString(templePolicies.dressCode) || asString(visitorInfo.dressCode) || DEFAULT_SETTINGS.visitorInfo.dressCode,
        photographyPolicy: asString(templePolicies.photographyPolicy) || asString(visitorInfo.photographyPolicy) || DEFAULT_SETTINGS.visitorInfo.photographyPolicy,
        parking: asString(visitorInfo.parking) || DEFAULT_SETTINGS.visitorInfo.parking,
        facilities: asString(visitorInfo.facilities) || DEFAULT_SETTINGS.visitorInfo.facilities,
        wheelchairAccess: asString(visitorInfo.wheelchairAccess) || DEFAULT_SETTINGS.visitorInfo.wheelchairAccess,
        drinkingWater: asString(visitorInfo.drinkingWater) || DEFAULT_SETTINGS.visitorInfo.drinkingWater,
        restrooms: asString(visitorInfo.restrooms) || DEFAULT_SETTINGS.visitorInfo.restrooms,
        prasada: asString(visitorInfo.prasada) || DEFAULT_SETTINGS.visitorInfo.prasada,
        annadanam: asString(visitorInfo.annadanam) || DEFAULT_SETTINGS.visitorInfo.annadanam,
        accommodation: asString(visitorInfo.accommodation) || DEFAULT_SETTINGS.visitorInfo.accommodation,
        volunteerInfo: asString(visitorInfo.volunteerInfo) || DEFAULT_SETTINGS.visitorInfo.volunteerInfo,
        testimonials: asString(visitorInfo.testimonials) || DEFAULT_SETTINGS.visitorInfo.testimonials,
        contact: asString(visitorInfo.contact) || DEFAULT_SETTINGS.visitorInfo.contact,
      },
      googleMapsUrl: asString(contact.googleMapsUrl),
    };
  } catch (error) {
    console.error("[Settings Retrieval] Error fetching settings:", error);
    return cachedSettings || DEFAULT_SETTINGS;
  }
}

/**
 * Fetch timings from `ai_settings.temple_information.timings`.
 */
async function fetchTimingsFromSupabase(): Promise<TempleSettings["timings"] | null> {
  try {
    const { data, error } = await getSupabase()
      .from(AI_SETTINGS_TABLE)
      .select("temple_information")
      .eq("id", AI_SETTINGS_ID)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const templeInfo = ((data as AiSettingsRow)?.temple_information || {}) as Record<string, unknown>;
    const timings = templeInfo.timings as Record<string, unknown> | undefined;
    if (!timings) {
      return null;
    }

    return {
      morningOpen: asString(timings.morningOpen) || DEFAULT_SETTINGS.timings.morningOpen,
      morningClose: asString(timings.morningClose) || DEFAULT_SETTINGS.timings.morningClose,
      eveningOpen: asString(timings.eveningOpen) || DEFAULT_SETTINGS.timings.eveningOpen,
      eveningClose: asString(timings.eveningClose) || DEFAULT_SETTINGS.timings.eveningClose,
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
