// Announcements Retrieval - Temple announcements
// Single source of truth for announcement information

import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, DocumentData } from "firebase/firestore";
import { TempleAnnouncement, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for announcements
let cachedAnnouncements: TempleAnnouncement[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (announcements change more frequently)

/**
 * Convert Firebase doc to TempleAnnouncement
 */
function docToAnnouncement(doc: DocumentData): TempleAnnouncement | null {
  try {
    const data = doc.data();
    if (!data) return null;

    let createdAt = new Date();
    if (data.createdAt) {
      if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (typeof data.createdAt.toDate === "function") {
        createdAt = data.createdAt.toDate();
      } else if (typeof data.createdAt === "string") {
        createdAt = new Date(data.createdAt);
      } else if (typeof data.createdAt === "number") {
        createdAt = new Date(data.createdAt);
      }
    }

    return {
      id: doc.id,
      title: data.title || "",
      message: data.message || "",
      link: data.link || "",
      isActive: data.isActive ?? true,
      createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch active announcements from Firebase
 */
async function fetchFromFirebase(): Promise<TempleAnnouncement[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const q = query(
      collection(db, "announcements"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const announcements: TempleAnnouncement[] = [];
    
    snapshot.docs.forEach((doc) => {
      const announcement = docToAnnouncement(doc);
      if (announcement) {
        announcements.push(announcement);
      }
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
    const announcements = await fetchFromFirebase();
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
