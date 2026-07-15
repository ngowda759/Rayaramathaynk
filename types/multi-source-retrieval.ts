// Multi-source Retrieval Types for Sprint C
// Defines types for unified answers combining multiple data sources

import { Intent } from "@/lib/ai/intent/types";
import { RetrievalType } from "@/lib/ai/intent/types";

/**
 * Data source types
 */
export type DataSource =
  | "settings"      // Temple settings (timings, contact, address)
  | "panchanga"     // Daily panchanga data
  | "events"        // Temple events
  | "sevas"         // Available sevas
  | "announcements"; // Current announcements

/**
 * Query sources configuration
 */
export interface QuerySources {
  settings?: boolean;
  panchanga?: boolean;
  events?: boolean;
  sevas?: boolean;
  announcements?: boolean;
}

/**
 * Multi-source query request
 */
export interface MultiSourceQuery {
  query: string;
  intent?: Intent;
  sources: QuerySources;
  language?: "en" | "kn" | "mixed";
  maxResults?: {
    events?: number;
    sevas?: number;
    announcements?: number;
  };
}

/**
 * Individual source result
 */
export interface SourceResult<T> {
  source: DataSource;
  data: T | null;
  retrieved: boolean;
  confidence: number;
  retrievedAt: number;
  error?: string;
}

/**
 * Unified query response
 */
export interface MultiSourceResponse {
  // Individual source results
  settings?: SourceResult<TempleSettingsData>;
  panchanga?: SourceResult<PanchangaData>;
  events?: SourceResult<TempleEvent[]>;
  sevas?: SourceResult<TempleSeva[]>;
  announcements?: SourceResult<TempleAnnouncement[]>;

  // Combined response
  combinedResponse: string;
  
  // Metadata
  metadata: {
    query: string;
    detectedIntent?: Intent;
    sourcesUsed: DataSource[];
    totalRetrievalTime: number;
    generatedAt: number;
  };
}

/**
 * Temple settings data for multi-source
 */
export interface TempleSettingsData {
  name: string;
  address: string;
  phone: string;
  email: string;
  timings: {
    morning: { open: string; close: string };
    evening: { open: string; close: string };
  };
  location?: {
    latitude?: number;
    longitude?: number;
    googleMapsUrl?: string;
  };
}

/**
 * Temple event data for multi-source
 */
export interface TempleEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: string;
  category?: string;
  featured?: boolean;
}

/**
 * Temple seva data for multi-source
 */
export interface TempleSeva {
  id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  duration?: string;
  available?: boolean;
}

/**
 * Temple announcement data for multi-source
 */
export interface TempleAnnouncement {
  id: string;
  title: string;
  message: string;
  link?: string;
  priority?: "high" | "normal" | "low";
  createdAt: string;
}

/**
 * Panchanga data for multi-source
 */
export interface PanchangaData {
  date: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  moonrise?: string;
  moonset?: string;
}

/**
 * Combined temple information response
 */
export interface TempleInfoCombined {
  settings?: TempleSettingsData;
  panchanga?: PanchangaData;
  todayEvents?: TempleEvent[];
  upcomingEvents?: TempleEvent[];
  sevas?: {
    daily: TempleSeva[];
    special: TempleSeva[];
    all: TempleSeva[];
  };
  announcements?: TempleAnnouncement[];
}

/**
 * Query intent suggestions based on sources
 */
export interface IntentSuggestion {
  intent: Intent;
  label: string;
  description: string;
  sources: DataSource[];
}

/**
 * Predefined queries for quick access
 */
export interface QuickQuery {
  id: string;
  label: string;
  labelKn?: string; // Kannada label
  query: string;
  sources: QuerySources;
  icon?: string;
}

/**
 * Retrieval statistics
 */
export interface RetrievalStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageRetrievalTime: number;
  bySource: Record<DataSource, {
    requests: number;
    successes: number;
    failures: number;
    averageTime: number;
  }>;
}

/**
 * Response templates for combining multiple sources
 */
export interface ResponseTemplate {
  sources: DataSource[];
  template: string;
  language: "en" | "kn" | "mixed";
}

/**
 * Data freshness information
 */
export interface DataFreshness {
  source: DataSource;
  lastUpdated: number;
  freshnessScore: "fresh" | "stale" | "unknown";
  cacheExpiry?: number;
}

/**
 * Query history entry
 */
export interface QueryHistoryEntry {
  id: string;
  query: string;
  sources: DataSource[];
  responseTime: number;
  timestamp: number;
  successful: boolean;
}
