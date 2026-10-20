// Events Retrieval - Temple events and festivals
// Single source of truth for event information

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/client";
import { TempleEvent, RetrievedData } from "./types";
import { RetrievalType } from "../intent/types";

// Cache for events
let cachedEvents: TempleEvent[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getSupabase() {
  return typeof window === "undefined" ? createAdminClient() : createClient();
}

/**
 * Fetch published events from Supabase `events`.
 */
async function fetchFromSupabase(maxEvents = 10): Promise<TempleEvent[]> {
  try {
    const { data, error } = await getSupabase()
      .from("events")
      .select("id, title, description, start_date, end_date, start_time, end_time, location, featured, category")
      .eq("published", true)
      .order("start_date", { ascending: true })
      .limit(maxEvents);

    if (error) {
      console.error("[Events Retrieval] Error fetching events:", error.message);
      return cachedEvents;
    }

    return (data || []).map((doc) => ({
      id: doc.id,
      title: doc.title || "Event",
      description: doc.description || "",
      startDate: doc.start_date ? new Date(doc.start_date) : new Date(),
      endDate: doc.end_date ? new Date(doc.end_date) : new Date(),
      startTime: doc.start_time ?? undefined,
      endTime: doc.end_time ?? undefined,
      location: doc.location || "",
      featured: doc.featured || false,
      category: doc.category ?? undefined,
    }));
  } catch (error) {
    console.error("[Events Retrieval] Error fetching events:", error);
    return cachedEvents;
  }
}

/**
 * Get upcoming events with caching
 */
export async function getUpcomingEvents(maxEvents = 5): Promise<RetrievedData<TempleEvent[]>> {
  const now = Date.now();
  const fromCache = cachedEvents.length > 0 && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    const upcoming = cachedEvents.filter(
      (event) => event.endDate >= new Date()
    );
    return {
      data: upcoming.slice(0, maxEvents),
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    const events = await fetchFromSupabase(20); // Fetch more to filter
    cachedEvents = events;
    lastFetchTime = now;

    const upcoming = events.filter((event) => event.endDate >= new Date());
    
    return {
      data: upcoming.slice(0, maxEvents),
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: now,
      fromCache: false,
    };
  } catch (error) {
    console.error("[Events Retrieval] Error:", error);
    return {
      data: cachedEvents.slice(0, maxEvents),
      source: RetrievalType.FALLBACK,
      confidence: 50,
      retrievedAt: now,
      fromCache: false,
    };
  }
}

/**
 * Get featured event
 */
export async function getFeaturedEvent(): Promise<RetrievedData<TempleEvent | null>> {
  const result = await getUpcomingEvents(10);
  
  const featured = result.data?.find((event) => event.featured) || null;
  
  return {
    data: featured,
    source: result.source,
    confidence: featured ? 95 : 0,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Get event by category
 */
export async function getEventsByCategory(
  category: string,
  maxEvents = 5
): Promise<RetrievedData<TempleEvent[]>> {
  const result = await getUpcomingEvents(20);
  
  const filtered = (result.data || []).filter(
    (event) => event.category?.toLowerCase() === category.toLowerCase()
  );
  
  return {
    data: filtered.slice(0, maxEvents),
    source: result.source,
    confidence: filtered.length > 0 ? 90 : 0,
    retrievedAt: result.retrievedAt,
    fromCache: result.fromCache,
  };
}

/**
 * Format event for display
 */
export function formatEventForDisplay(event: TempleEvent): string {
  const startDate = event.startDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  
  const time = event.startTime ? ` at ${event.startTime}` : "";
  const location = event.location ? ` at ${event.location}` : "";
  
  let text = `**${event.title}**\n`;
  text += `📅 ${startDate}${time}`;
  
  if (location) {
    text += `\n📍 ${location}`;
  }
  
  if (event.description) {
    text += `\n\n${event.description.substring(0, 200)}${event.description.length > 200 ? "..." : ""}`;
  }
  
  return text;
}

/**
 * Format events list for display
 */
export function formatEventsListForDisplay(events: TempleEvent[]): string {
  if (!events || events.length === 0) {
    return "No upcoming events at the moment.";
  }
  
  let text = "📅 **Upcoming Events:**\n\n";
  
  events.forEach((event, index) => {
    const startDate = event.startDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    const time = event.startTime ? ` at ${event.startTime}` : "";
    
    text += `${index + 1}. **${event.title}**\n`;
    text += `   📅 ${startDate}${time}\n\n`;
  });
  
  return text.trim();
}

/**
 * Clear events cache
 */
export function clearEventsCache(): void {
  cachedEvents = [];
  lastFetchTime = 0;
}
