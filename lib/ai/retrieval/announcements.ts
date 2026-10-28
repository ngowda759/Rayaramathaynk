// Announcements Retrieval - Temple announcements
// Single source of truth for announcement information
//
// Reads the Supabase `announcements` table. There is no Firestore path and no
// fallback to one: if Supabase is unavailable the result is an empty list with the
// retrieval marked as a failure, never stale Firestore content.

import { createClient } from "@/lib/supabase/client";
import { TempleAnnouncement, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for announcements
let cachedAnnouncements: TempleAnnouncement[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (announcements change more frequently)

/** Convert a Supabase `announcements` row to `TempleAnnouncement`. */
function rowToAnnouncement(row: any): TempleAnnouncement {
  return {
    id: row.firestore_id || row.id,
    title: row.title || "",
    message: row.message || "",
    link: row.link || "",
    isActive: row.is_active ?? true,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

/**
 * Fetch active announcements from Supabase.
 *
 * Throws on a database error so the caller can distinguish "no announcements" from
 * "the database refused or failed". The error is never swallowed into a stale cache.
 */
async function fetchFromSupabase(): Promise<TempleAnnouncement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Could not read announcements from Supabase: ${error.message}`);
  }

  return (data ?? []).map(rowToAnnouncement);
}

/**
 * Get all active announcements with caching
 */
export async function getActiveAnnouncements(): Promise<RetrievedData<TempleAnnouncement[]>> {
  const now = Date.now();
  const fromCache = cachedAnnouncements.length > 0 && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    return {
      data: cachedAnnouncements,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    const announcements = await fetchFromSupabase();
    cachedAnnouncements = announcements;
    lastFetchTime = now;

    return {
      data: announcements,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Announcements Retrieval] Error reading announcements from Supabase:", error);
    // No Firestore fallback: report the failure with an empty list.
    return {
      data: [],
      source: RetrievalType.FALLBACK,
      confidence: 0,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get latest announcements (limited)
 */
export async function getLatestAnnouncements(
  limit = 3
): Promise<RetrievedData<TempleAnnouncement[]>> {
  const result = await getActiveAnnouncements();

  return {
    data: (result.data || []).slice(0, limit),
    source: result.source,
    confidence: result.confidence,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Format announcements for display
 */
export function formatAnnouncementsForDisplay(announcements: TempleAnnouncement[]): string {
  if (!announcements || announcements.length === 0) {
    return "No current announcements.";
  }

  let text = "📢 **Current Announcements:**\n\n";

  announcements.forEach((announcement, index) => {
    text += `**${index + 1}. ${announcement.title}**\n`;
    text += `${announcement.message}\n`;

    if (announcement.link) {
      text += `🔗 ${announcement.link}\n`;
    }

    text += "\n";
  });

  return text.trim();
}

/**
 * Clear announcements cache
 */
export function clearAnnouncementsCache(): void {
  cachedAnnouncements = [];
  lastFetchTime = 0;
}
