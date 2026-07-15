// Retrieval Types for Structured Data Access
// Types for the hybrid AI retrieval system

import { RetrievalType, Intent } from "../intent/types";

/**
 * Base interface for all retrieved data
 */
export interface RetrievedData<T = unknown> {
  data: T | null;
  source: RetrievalType;
  confidence: number;
  retrievedAt: number;
  fromCache: boolean;
}

/**
 * Temple Settings - contact info, timings, address
 */
export interface TempleSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  timings: {
    morning: {
      open: string;
      close: string;
    };
    evening: {
      open: string;
      close: string;
    };
  };
  googleMapsUrl?: string;
}

/**
 * Event data
 */
export interface TempleEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  location: string;
  featured: boolean;
  category?: string;
}

/**
 * Seva data
 */
export interface TempleSeva {
  id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  active: boolean;
}

/**
 * Announcement data
 */
export interface TempleAnnouncement {
  id: string;
  title: string;
  message: string;
  link?: string;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Panchanga data
 */
export interface PanchangaData {
  date: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
}

/**
 * Aaradhane data
 */
export interface AaradhaneEvent {
  id: string;
  title: string;
  guruName: string;
  dates: string[];
  description: string;
  significance: string;
  rituals: string[];
  offerings: string[];
  isUpcoming: boolean;
}

/**
 * Donation information
 */
export interface DonationInfo {
  purposes: Array<{
    name: string;
    description: string;
  }>;
  has80G: boolean;
  paymentMethods: string[];
  websiteUrl: string;
}

/**
 * Response context for hybrid AI
 */
export interface AIResponseContext {
  templeSettings?: TempleSettings;
  upcomingEvents?: TempleEvent[];
  currentAnnouncements?: TempleAnnouncement[];
  availableSevas?: TempleSeva[];
  todayPanchanga?: PanchangaData;
  nextAaradhane?: AaradhaneEvent;
  donationInfo?: DonationInfo;
  knowledgeArticles?: KnowledgeArticle[];
}

/**
 * Knowledge article for RAG
 */
export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
  language: "en" | "kn" | "mixed";
  lastReviewed?: Date;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Intent to retrieval mapping
 */
export interface IntentRetrievalMapping {
  intent: Intent;
  retrievers: Array<{
    name: string;
    priority: number;
  }>;
  fallbackIntent?: Intent;
}

/**
 * Unknown question log entry
 */
export interface UnknownQuestionLog {
  id: string;
  question: string;
  timestamp: number;
  sessionId: string;
  intent: Intent;
  detectedIntent: Intent;
  confidence: number;
  language: "en" | "kn" | "mixed";
  userAgent?: string;
  ip?: string;
}
