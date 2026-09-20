// Aaradhane Retrieval - Sri Raghavendra Swamy Aaradhane information
// Single source of truth for aaradhane data

import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, DocumentData } from "firebase/firestore";
import { AaradhaneEvent, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for aaradhane
let cachedAaradhanes: AaradhaneEvent[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if dates are upcoming
 */
function isUpcoming(dates: string[]): boolean {
  if (!dates || dates.length === 0) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  return dates.some((dateStr) => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= now;
  });
}

/**
 * Convert Firebase doc to AaradhaneEvent
 */
function docToAaradhane(doc: DocumentData): AaradhaneEvent | null {
  try {
    const data = doc.data();
    if (!data) return null;

    const dates = data.dates || [];
    
    return {
      id: doc.id,
      title: data.title || "Sri Raghavendra Swamy Aaradhane",
      guruName: data.guruName || "Sri Raghavendra Swamy",
      dates,
      description: data.description || "",
      significance: data.significance || "",
      rituals: data.rituals || [],
      offerings: data.offerings || [],
      isUpcoming: isUpcoming(dates),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch aaradhanes from Firebase
 */
async function fetchFromFirebase(): Promise<AaradhaneEvent[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const q = query(
      collection(db, "aaradhane"),
      orderBy("displayOrder", "asc")
    );
    
    const snapshot = await getDocs(q);
    const aaradhanes: AaradhaneEvent[] = [];
    
    snapshot.docs.forEach((doc) => {
      const aaradhane = docToAaradhane(doc);
      if (aaradhane) {
        aaradhanes.push(aaradhane);
      }
    });
    
    return aaradhanes;
  } catch (error) {
    console.error("[Aaradhane Retrieval] Error fetching:", error);
    return cachedAaradhanes;
  }
}

/**
 * Get all aaradhanes
 */
export async function getAaradhanes(): Promise<RetrievedData<AaradhaneEvent[]>> {
  const now = Date.now();
  const fromCache = cachedAaradhanes.length > 0 && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    return {
      data: cachedAaradhanes,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    const aaradhanes = await fetchFromFirebase();
    cachedAaradhanes = aaradhanes;
    lastFetchTime = now;

    return {
      data: aaradhanes,
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Aaradhane Retrieval] Error:", error);
    return {
      data: cachedAaradhanes,
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get upcoming aaradhanes
 */
export async function getUpcomingAaradhanes(): Promise<RetrievedData<AaradhaneEvent[]>> {
  const result = await getAaradhanes();
  
  const upcoming = (result.data || []).filter((a) => a.isUpcoming);
  
  return {
    data: upcoming,
    source: result.source,
    confidence: result.confidence,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Get next aaradhane
 */
export async function getNextAaradhane(): Promise<RetrievedData<AaradhaneEvent | null>> {
  const result = await getUpcomingAaradhanes();
  
  const next = result.data?.[0] || null;
  
  return {
    data: next,
    source: result.source,
    confidence: next ? 95 : 0,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Format aaradhane for display
 */
export function formatAaradhaneForDisplay(aaradhane: AaradhaneEvent): string {
  let text = `🙏 **${aaradhane.title}**\n\n`;
  
  if (aaradhane.dates.length > 0) {
    const nextDate = aaradhane.dates[0];
    const date = new Date(nextDate);
    const formattedDate = date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    text += `📅 **Date:** ${formattedDate}\n\n`;
  }
  
  if (aaradhane.description) {
    text += `${aaradhane.description}\n\n`;
  }
  
  if (aaradhane.significance) {
    text += `✨ **Significance:** ${aaradhane.significance}\n\n`;
  }
  
  if (aaradhane.rituals.length > 0) {
    text += `🪔 **Rituals:**\n`;
    aaradhane.rituals.forEach((ritual) => {
      text += `• ${ritual}\n`;
    });
    text += "\n";
  }
  
  return text.trim();
}

/**
 * Format upcoming aaradhanes for display
 */
export function formatUpcomingAaradhanes(aaradhanes: AaradhaneEvent[]): string {
  if (!aaradhanes || aaradhanes.length === 0) {
    return "No upcoming Aaradhane celebrations at the moment.";
  }
  
  let text = "🙏 **Upcoming Aaradhane Celebrations:**\n\n";
  
  aaradhanes.forEach((aaradhane, index) => {
    text += `**${index + 1}. ${aaradhane.title}**\n`;
    
    if (aaradhane.dates.length > 0) {
      const nextDate = aaradhane.dates[0];
      const date = new Date(nextDate);
      const formattedDate = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      text += `📅 ${formattedDate}\n`;
    }
    
    if (aaradhane.description) {
      text += `${aaradhane.description.substring(0, 100)}...\n`;
    }
    
    text += "\n";
  });
  
  return text.trim();
}

/**
 * Clear aaradhane cache
 */
export function clearAaradhaneCache(): void {
  cachedAaradhanes = [];
  lastFetchTime = 0;
}
