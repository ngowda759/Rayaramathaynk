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
 * Parse a Supabase timestamp column into a Date, or `null` when the value is
 * missing or unparseable. `start_date`/`end_date` are `timestamptz NOT NULL` in
 * the schema, but a malformed value must not silently become "now" (which would
 * make a stale event look upcoming).
 */
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return null;
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fetch published, not-yet-ended events from Supabase `events`.
 *
 * The upcoming boundary is applied by the database (`end_date >= now`) *before*
 * the limit. Ordering ascending by `start_date` and limiting first would return
 * the oldest historical events and filter them all out in memory, which is how
 * the retriever reported "no upcoming events" while upcoming rows existed.
 *
 * `end_date` is the boundary (not `start_date`) so an event that has already
 * begun but has not ended is still returned as ongoing.
 */
async function fetchFromSupabase(maxEvents = 10): Promise<TempleEvent[]> {
  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await getSupabase()
      .from("events")
      .select("id, title, description, start_date, end_date, start_time, end_time, location, featured, category")
      .eq("published", true)
      .gte("end_date", nowIso)
      .order("start_date", { ascending: true })
      .limit(maxEvents);

    if (error) {
      console.error("[Events Retrieval] Error fetching events:", error.message);
      return cachedEvents;
    }

    const events: TempleEvent[] = [];
    for (const doc of data || []) {
      const startDate = parseDate(doc.start_date);
      const endDate = parseDate(doc.end_date);
      // Skip rows whose dates cannot be interpreted rather than fabricating them.
      if (!startDate || !endDate) {
        continue;
      }
      events.push({
        id: doc.id,
        title: doc.title || "Event",
        description: doc.description || "",
        startDate,
        endDate,
        startTime: doc.start_time ?? undefined,
        endTime: doc.end_time ?? undefined,
        location: doc.location || "",
        featured: doc.featured || false,
        category: doc.category ?? undefined,
      });
    }

    return events;
  } catch (error) {
    console.error("[Events Retrieval] Error fetching events:", error);
    return cachedEvents;
  }
}

/**
 * Keep only events that have not yet ended, preserving ascending `start_date`
 * order. Defensive layer on top of the database `end_date` filter.
 */
function filterUpcoming(events: TempleEvent[], now: Date): TempleEvent[] {
  return events.filter(
    (event) => event.endDate instanceof Date && event.endDate.getTime() >= now.getTime()
  );
}

/**
 * Get upcoming events with caching
 */
export async function getUpcomingEvents(maxEvents = 5): Promise<RetrievedData<TempleEvent[]>> {
  const now = Date.now();
  const fromCache = lastFetchTime > 0 && now - lastFetchTime < CACHE_DURATION;

  if (fromCache) {
    const upcoming = filterUpcoming(cachedEvents, new Date(now));
    return {
      data: upcoming.slice(0, maxEvents),
      source: RetrievalType.REPOSITORY,
      confidence: 95,
      retrievedAt: lastFetchTime,
      fromCache: true,
    };
  }

  try {
    const events = await fetchFromSupabase(20); // Fetch more than requested so the slice is stable
    cachedEvents = events;
    lastFetchTime = now;

    const upcoming = filterUpcoming(events, new Date(now));

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
