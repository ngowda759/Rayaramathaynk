// Multi-source Retrieval Service
// Handles unified queries combining data from multiple temple sources

import {
  DataSource,
  MultiSourceQuery,
  MultiSourceResponse,
  SourceResult,
  TempleSettingsData,
  TempleEvent,
  TempleSeva,
  TempleAnnouncement,
  PanchangaData,
  QuickQuery,
  RetrievalStats,
  DataFreshness,
  QueryHistoryEntry,
} from "@/types/multi-source-retrieval";
import { Intent } from "@/lib/ai/intent/types";

// ============ DATA RETRIEVAL ============

/**
 * Get temple settings data
 */
async function getSettingsData(): Promise<SourceResult<TempleSettingsData>> {
  const startTime = Date.now();
  
  try {
    // Import from existing retrieval modules
    const { getTempleSettings } = await import("@/lib/ai/retrieval/settings");
    const settings = await getTempleSettings();
    
    return {
      source: "settings",
      data: settings.data as TempleSettingsData | null,
      retrieved: !!settings.data,
      confidence: settings.confidence,
      retrievedAt: Date.now(),
      error: settings.data ? undefined : "No settings data available",
    };
  } catch (error) {
    return {
      source: "settings",
      data: null,
      retrieved: false,
      confidence: 0,
      retrievedAt: Date.now(),
      error: error instanceof Error ? error.message : "Failed to retrieve settings",
    };
  }
}

/**
 * Get panchanga data
 */
async function getPanchangaData(): Promise<SourceResult<PanchangaData>> {
  const startTime = Date.now();
  
  try {
    const { getTodayPanchanga } = await import("@/lib/ai/retrieval/panchanga");
    const panchanga = await getTodayPanchanga();
    
    return {
      source: "panchanga",
      data: panchanga.data as PanchangaData | null,
      retrieved: !!panchanga.data,
      confidence: panchanga.confidence,
      retrievedAt: Date.now(),
      error: panchanga.data ? undefined : "No panchanga data available",
    };
  } catch (error) {
    return {
      source: "panchanga",
      data: null,
      retrieved: false,
      confidence: 0,
      retrievedAt: Date.now(),
      error: error instanceof Error ? error.message : "Failed to retrieve panchanga",
    };
  }
}

/**
 * Get events data
 */
async function getEventsData(maxResults: number = 10): Promise<SourceResult<TempleEvent[]>> {
  try {
    const { getUpcomingEvents } = await import("@/lib/ai/retrieval/events");
    const events = await getUpcomingEvents();
    
    const eventsArray = (events.data || []).slice(0, maxResults).map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate instanceof Date ? e.startDate.toISOString() : String(e.startDate),
      endDate: e.endDate instanceof Date ? e.endDate.toISOString() : String(e.endDate),
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      category: e.category,
      featured: e.featured,
    })) as TempleEvent[];
    
    return {
      source: "events",
      data: eventsArray,
      retrieved: eventsArray.length > 0,
      confidence: events.confidence,
      retrievedAt: Date.now(),
    };
  } catch (error) {
    return {
      source: "events",
      data: null,
      retrieved: false,
      confidence: 0,
      retrievedAt: Date.now(),
      error: error instanceof Error ? error.message : "Failed to retrieve events",
    };
  }
}

/**
 * Get sevas data
 */
async function getSevasData(): Promise<SourceResult<TempleSeva[]>> {
  try {
    const { getActiveSevas } = await import("@/lib/ai/retrieval/sevas");
    const sevas = await getActiveSevas();
    
    const sevasArray = (sevas.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      amount: s.amount,
      duration: s.duration,
      available: s.active,
    })) as TempleSeva[];
    
    return {
      source: "sevas",
      data: sevasArray,
      retrieved: sevasArray.length > 0,
      confidence: sevas.confidence,
      retrievedAt: Date.now(),
    };
  } catch (error) {
    return {
      source: "sevas",
      data: null,
      retrieved: false,
      confidence: 0,
      retrievedAt: Date.now(),
      error: error instanceof Error ? error.message : "Failed to retrieve sevas",
    };
  }
}

/**
 * Get announcements data
 */
async function getAnnouncementsData(maxResults: number = 5): Promise<SourceResult<TempleAnnouncement[]>> {
  try {
    const { getActiveAnnouncements } = await import("@/lib/ai/retrieval/announcements");
    const announcements = await getActiveAnnouncements();
    
    const announcementsArray = (announcements.data || []).slice(0, maxResults).map((a: any) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      link: a.link,
      priority: a.priority,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    })) as TempleAnnouncement[];
    
    return {
      source: "announcements",
      data: announcementsArray,
      retrieved: announcementsArray.length > 0,
      confidence: announcements.confidence,
      retrievedAt: Date.now(),
    };
  } catch (error) {
    return {
      source: "announcements",
      data: null,
      retrieved: false,
      confidence: 0,
      retrievedAt: Date.now(),
      error: error instanceof Error ? error.message : "Failed to retrieve announcements",
    };
  }
}

// ============ COMBINED RESPONSES ============

/**
 * Generate combined response from multiple sources
 */
function generateCombinedResponse(
  query: string,
  results: Partial<Record<DataSource, SourceResult<any>>>,
  language: "en" | "kn" | "mixed" = "en"
): string {
  const parts: string[] = [];
  
  // Add settings info if available
  if (results.settings?.data) {
    const { settings } = results.settings.data;
    parts.push(`Temple: ${settings.name}`);
    parts.push(`Address: ${settings.address}`);
    parts.push(`Timings: Morning ${settings.timings.morning.open} - ${settings.timings.morning.close}, Evening ${settings.timings.evening.open} - ${settings.timings.evening.close}`);
    if (settings.phone) parts.push(`Phone: ${settings.phone}`);
  }
  
  // Add panchanga if available
  if (results.panchanga?.data) {
    const p = results.panchanga.data;
    parts.push(`Today's Panchanga: Tithi: ${p.tithi}, Nakshatra: ${p.nakshatra}, Yoga: ${p.yoga}`);
    parts.push(`Sunrise: ${p.sunrise}, Sunset: ${p.sunset}`);
  }
  
  // Add events if available
  if (results.events?.data && results.events.data.length > 0) {
    const eventList = results.events.data
      .slice(0, 3)
      .map((e) => `${e.title} on ${new Date(e.startDate).toLocaleDateString()}`)
      .join("; ");
    parts.push(`Upcoming Events: ${eventList}`);
  }
  
  // Add sevas if available
  if (results.sevas?.data && results.sevas.data.length > 0) {
    const sevaNames = results.sevas.data.slice(0, 5).map((s) => s.name).join(", ");
    parts.push(`Available Sevas: ${sevaNames}`);
  }
  
  // Add announcements if available
  if (results.announcements?.data && results.announcements.data.length > 0) {
    const announcementTitles = results.announcements.data
      .slice(0, 3)
      .map((a) => a.title)
      .join("; ");
    parts.push(`Announcements: ${announcementTitles}`);
  }
  
  if (parts.length === 0) {
    return "Unable to retrieve temple information. Please try again later.";
  }
  
  return parts.join("\n\n");
}

// ============ MAIN QUERY FUNCTION ============

/**
 * Execute a multi-source query
 */
export async function executeMultiSourceQuery(
  query: MultiSourceQuery
): Promise<MultiSourceResponse> {
  const startTime = Date.now();
  const results: Partial<Record<DataSource, SourceResult<any>>> = {};
  const sourcesUsed: DataSource[] = [];
  
  // Execute all requested retrievals in parallel
  const retrievalPromises: Promise<void>[] = [];
  
  if (query.sources.settings !== false) {
    retrievalPromises.push(
      getSettingsData().then((result) => {
        results.settings = result;
        if (result.retrieved) sourcesUsed.push("settings");
      })
    );
  }
  
  if (query.sources.panchanga !== false) {
    retrievalPromises.push(
      getPanchangaData().then((result) => {
        results.panchanga = result;
        if (result.retrieved) sourcesUsed.push("panchanga");
      })
    );
  }
  
  if (query.sources.events !== false) {
    retrievalPromises.push(
      getEventsData(query.maxResults?.events || 10).then((result) => {
        results.events = result;
        if (result.retrieved) sourcesUsed.push("events");
      })
    );
  }
  
  if (query.sources.sevas !== false) {
    retrievalPromises.push(
      getSevasData().then((result) => {
        results.sevas = result;
        if (result.retrieved) sourcesUsed.push("sevas");
      })
    );
  }
  
  if (query.sources.announcements !== false) {
    retrievalPromises.push(
      getAnnouncementsData(query.maxResults?.announcements || 5).then((result) => {
        results.announcements = result;
        if (result.retrieved) sourcesUsed.push("announcements");
      })
    );
  }
  
  await Promise.all(retrievalPromises);
  
  const combinedResponse = generateCombinedResponse(
    query.query,
    results,
    query.language || "en"
  );
  
  return {
    ...results,
    combinedResponse,
    metadata: {
      query: query.query,
      detectedIntent: query.intent,
      sourcesUsed,
      totalRetrievalTime: Date.now() - startTime,
      generatedAt: Date.now(),
    },
  };
}

/**
 * Get temple overview (all sources)
 */
export async function getTempleOverview(): Promise<MultiSourceResponse> {
  return executeMultiSourceQuery({
    query: "Temple overview",
    sources: {
      settings: true,
      panchanga: true,
      events: true,
      sevas: true,
      announcements: true,
    },
  });
}

/**
 * Get today's temple information
 */
export async function getTodayInfo(): Promise<MultiSourceResponse> {
  return executeMultiSourceQuery({
    query: "Today's temple information",
    sources: {
      settings: true,
      panchanga: true,
      events: true,
      announcements: true,
    },
  });
}

// ============ QUICK QUERIES ============

/**
 * Predefined quick queries
 */
export const QUICK_QUERIES: QuickQuery[] = [
  {
    id: "temple-overview",
    label: "Temple Overview",
    labelKn: "ದೇವಸ್ಥಾನ ಅವಲೋಕನ",
    query: "Get complete temple information including timings, panchanga, events, and announcements",
    sources: { settings: true, panchanga: true, events: true, announcements: true },
    icon: "🏛️",
  },
  {
    id: "today-darshan",
    label: "Today's Darshan",
    labelKn: "ಇಂದಿನ ದರ್ಶನ",
    query: "Today's temple timings, panchanga, and any special sevas or announcements",
    sources: { settings: true, panchanga: true, sevas: true, announcements: true },
    icon: "🕉️",
  },
  {
    id: "upcoming-events",
    label: "Upcoming Events",
    labelKn: "ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು",
    query: "List of upcoming temple events and festivals",
    sources: { events: true },
    icon: "📅",
  },
  {
    id: "sevas-info",
    label: "Sevas Information",
    labelKn: "ಸೇವೆಗಳ ಮಾಹಿತಿ",
    query: "Available sevas, their descriptions, and booking information",
    sources: { sevas: true },
    icon: "🙏",
  },
  {
    id: "important-announcements",
    label: "Important Announcements",
    labelKn: "ಮುಖ್ಯ ಘೋಷಣೆಗಳು",
    query: "Current temple announcements and updates",
    sources: { announcements: true },
    icon: "📢",
  },
  {
    id: "panchanga-details",
    label: "Panchanga Details",
    labelKn: "ಪಂಚಾಂಗ ವಿವರಗಳು",
    query: "Today's panchanga including tithi, nakshatra, yoga, and timings",
    sources: { panchanga: true, settings: true },
    icon: "🌙",
  },
];

/**
 * Get intent suggestions for sources
 */
export function getIntentSuggestions(): Array<{ intent: Intent; label: string; sources: DataSource[] }> {
  return [
    { intent: Intent.TEMPLE_TIMINGS, label: "Temple Timings", sources: ["settings"] },
    { intent: Intent.PANCHANGA, label: "Daily Panchanga", sources: ["panchanga", "settings"] },
    { intent: Intent.UPCOMING_EVENTS, label: "Upcoming Events", sources: ["events"] },
    { intent: Intent.SPECIAL_SEVAS, label: "Special Sevas", sources: ["sevas"] },
    { intent: Intent.ANNOUNCEMENTS, label: "Announcements", sources: ["announcements"] },
    { intent: Intent.CONTACT_INFORMATION, label: "Contact Information", sources: ["settings"] },
  ];
}

// ============ STATISTICS ============

let retrievalStats: RetrievalStats = {
  totalQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  averageRetrievalTime: 0,
  bySource: {
    settings: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
    panchanga: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
    events: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
    sevas: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
    announcements: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
  },
};

/**
 * Get retrieval statistics
 */
export function getRetrievalStats(): RetrievalStats {
  return { ...retrievalStats };
}

/**
 * Update retrieval statistics
 */
function updateStats(source: DataSource, success: boolean, time: number): void {
  retrievalStats.totalQueries++;
  if (success) {
    retrievalStats.successfulQueries++;
  } else {
    retrievalStats.failedQueries++;
  }
  
  retrievalStats.averageRetrievalTime = 
    (retrievalStats.averageRetrievalTime * (retrievalStats.totalQueries - 1) + time) / 
    retrievalStats.totalQueries;
  
  retrievalStats.bySource[source].requests++;
  if (success) {
    retrievalStats.bySource[source].successes++;
  } else {
    retrievalStats.bySource[source].failures++;
  }
  retrievalStats.bySource[source].averageTime = 
    (retrievalStats.bySource[source].averageTime * (retrievalStats.bySource[source].requests - 1) + time) / 
    retrievalStats.bySource[source].requests;
}

/**
 * Reset statistics
 */
export function resetRetrievalStats(): void {
  retrievalStats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageRetrievalTime: 0,
    bySource: {
      settings: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      panchanga: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      events: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      sevas: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
      announcements: { requests: 0, successes: 0, failures: 0, averageTime: 0 },
    },
  };
}

// ============ DATA FRESHNESS ============

const freshnessCache: Record<DataSource, { lastUpdated: number; data: any }> = {
  settings: { lastUpdated: 0, data: null },
  panchanga: { lastUpdated: 0, data: null },
  events: { lastUpdated: 0, data: null },
  sevas: { lastUpdated: 0, data: null },
  announcements: { lastUpdated: 0, data: null },
};

/**
 * Update data freshness timestamp
 */
export function updateFreshness(source: DataSource, data: any): void {
  freshnessCache[source] = {
    lastUpdated: Date.now(),
    data,
  };
}

/**
 * Get data freshness information
 */
export function getDataFreshness(): DataFreshness[] {
  const now = Date.now();
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes
  
  return Object.entries(freshnessCache).map(([source, cache]) => {
    const elapsed = now - cache.lastUpdated;
    let freshnessScore: "fresh" | "stale" | "unknown" = "unknown";
    
    if (cache.lastUpdated > 0) {
      freshnessScore = elapsed < cacheExpiry ? "fresh" : "stale";
    }
    
    return {
      source: source as DataSource,
      lastUpdated: cache.lastUpdated,
      freshnessScore,
      cacheExpiry: cache.lastUpdated > 0 ? cache.lastUpdated + cacheExpiry : undefined,
    };
  });
}

// ============ QUERY HISTORY ============

const queryHistory: QueryHistoryEntry[] = [];
const MAX_HISTORY = 100;

/**
 * Add query to history
 */
export function addToQueryHistory(entry: Omit<QueryHistoryEntry, "id" | "timestamp">): void {
  const historyEntry: QueryHistoryEntry = {
    ...entry,
    id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };
  
  queryHistory.unshift(historyEntry);
  
  // Keep only recent history
  if (queryHistory.length > MAX_HISTORY) {
    queryHistory.pop();
  }
}

/**
 * Get query history
 */
export function getQueryHistory(limit: number = 20): QueryHistoryEntry[] {
  return queryHistory.slice(0, limit);
}

/**
 * Clear query history
 */
export function clearQueryHistory(): void {
  queryHistory.length = 0;
}
