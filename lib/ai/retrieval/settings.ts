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
 * Fetch temple settings from the Supabase `ai_settings` row.
 *
 * `ai_settings.temple_information` is the authoritative store for temple
 * timings, contact details and office hours (the same row the AI Settings admin
 * page edits); `visitor_information` / `temple_policies` hold visitor guidance.
 * There is no Firestore fallback.
 *
 * Returns `null` when the `main` row is missing or the query fails. It never
 * substitutes invented temple facts (phone numbers, addresses, timings) — a
 * wrong phone number is worse than an honest "unavailable" response.
 */
async function fetchFromSupabase(): Promise<TempleSettings | null> {
  const { data, error } = await getSupabase()
    .from(AI_SETTINGS_TABLE)
    .select("temple_information, visitor_information, temple_policies")
    .eq("id", AI_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    console.error("[Settings Retrieval] Error fetching settings:", error.message);
    return null;
  }

  const row = data as AiSettingsRow;
  if (!row) {
    console.warn("[Settings Retrieval] No ai_settings 'main' row found.");
    return null;
  }

  const templeInfo = (row.temple_information || {}) as Record<string, unknown>;
  const visitorInfo = (row.visitor_information || {}) as Record<string, unknown>;
  const templePolicies = (row.temple_policies || {}) as Record<string, unknown>;
  const timings = (templeInfo.timings || {}) as Record<string, unknown>;
  const contact = (templeInfo.contact || {}) as Record<string, unknown>;
  const officeHours = (templeInfo.officeHours || {}) as Record<string, unknown>;

  const name = asString(templeInfo.name);
  const address = asString(contact.address);
  const phone = asString(contact.phone);
  const email = asString(contact.email);

  // An `ai_settings` row with an empty `temple_information` (the table default is
  // `'{}'`) carries no facts at all. Report it as unavailable rather than
  // returning blank fields that the composer would render as "Phone: ".
  const hasTempleFacts =
    Boolean(name || address || phone || email) ||
    Boolean(asString(timings.morningOpen) || asString(timings.eveningOpen));
  if (!hasTempleFacts) {
    console.warn(
      "[Settings Retrieval] ai_settings 'main' row has empty temple_information; treating temple settings as unavailable."
    );
    return null;
  }

  return {
    name: name ?? "",
    address: address ?? "",
    phone: phone ?? "",
    email: email ?? "",
    timings: {
      morningOpen: asString(timings.morningOpen) ?? "",
      morningClose: asString(timings.morningClose) ?? "",
      eveningOpen: asString(timings.eveningOpen) ?? "",
      eveningClose: asString(timings.eveningClose) ?? "",
    },
    contact: {
      phone: phone ?? "",
      email: email ?? "",
      address: address ?? "",
    },
    officeHours: {
      weekday: asString(officeHours.weekday) ?? "",
      weekend: asString(officeHours.weekend) ?? "",
      notes: asString(officeHours.notes) ?? "",
    },
    visitorInfo: {
      guidelines: asString(visitorInfo.guidelines) ?? "",
      dressCode: asString(templePolicies.dressCode) || asString(visitorInfo.dressCode) || "",
      photographyPolicy:
        asString(templePolicies.photographyPolicy) ||
        asString(visitorInfo.photographyPolicy) ||
        "",
      parking: asString(visitorInfo.parking) ?? "",
      facilities: asString(visitorInfo.facilities) ?? "",
      wheelchairAccess: asString(visitorInfo.wheelchairAccess) ?? "",
      drinkingWater: asString(visitorInfo.drinkingWater) ?? "",
      restrooms: asString(visitorInfo.restrooms) ?? "",
      prasada: asString(visitorInfo.prasada) ?? "",
      annadanam: asString(visitorInfo.annadanam) ?? "",
      accommodation: asString(visitorInfo.accommodation) ?? "",
      volunteerInfo: asString(visitorInfo.volunteerInfo) ?? "",
      testimonials: asString(visitorInfo.testimonials) ?? "",
      contact: asString(visitorInfo.contact) ?? "",
    },
    googleMapsUrl: asString(contact.googleMapsUrl),
  };
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
      morningOpen: asString(timings.morningOpen) ?? "",
      morningClose: asString(timings.morningClose) ?? "",
      eveningOpen: asString(timings.eveningOpen) ?? "",
      eveningClose: asString(timings.eveningClose) ?? "",
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
    // Override timings only when the dedicated query returned usable values.
    const timings = await fetchTimingsFromSupabase();
    const settings = await fetchFromSupabase();

    if (!settings) {
      return {
        data: null,
        source: RetrievalType.FALLBACK,
        confidence: 0,
        retrievedAt: now,
        fromCache: false,
      };
    }

    if (timings) {
      settings.timings = timings;
    }

    cachedSettings = settings;
    lastFetchTime = now;

    return {
      data: settings,
      source: RetrievalType.REPOSITORY,
      confidence: 95, // Slightly less than 100 due to potential partial data
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Settings Retrieval] Error:", error);
    return {
      data: null,
      source: RetrievalType.FALLBACK,
      confidence: 0,
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
    data: result.data?.timings ?? null,
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
