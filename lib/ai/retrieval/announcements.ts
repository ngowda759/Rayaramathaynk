// Announcements Retrieval - Temple announcements
// Single source of truth for announcement information

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { TempleAnnouncement, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for announcements
let cachedAnnouncements: TempleAnnouncement[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (announcements change more frequently)

/**
 * Fetch active announcements from Supabase
 */
async function fetchFromSupabase(): Promise<TempleAnnouncement[]> {
  const supabase = typeof window === 'undefined' ? createAdminClient() : createClient();
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, link, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error("[Announcements Retrieval] Error fetching from Supabase:", error);
      return cachedAnnouncements;
    }

    const announcements: TempleAnnouncement[] = data.map(doc => {
      return {
        id: doc.id,
        title: doc.title || "",
        message: doc.message || "",
        link: doc.link || "",
        isActive: doc.is_active ?? true,
        createdAt: doc.created_at ? new Date(doc.created_at) : new Date(),
      };
    });
    
    return announcements;
  } catch (error) {
    console.error("[Announcements Retrieval] Error fetching announcements:", error);
    return cachedAnnouncements;
  }
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
    console.error("[Announcements Retrieval] Error:", error);
    return {
      data: cachedAnnouncements,
      source: RetrievalType.FALLBACK,
      confidence: 50,
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
