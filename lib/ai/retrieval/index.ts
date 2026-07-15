// Retrieval Module - Exports all structured data retrieval functions
// Single source of truth for temple information

export * from "./types";
export * from "./settings";
export * from "./events";
export * from "./sevas";
export * from "./announcements";
export * from "./panchanga";
export * from "./donations";
export * from "./aaradhane";

import {
  getTempleSettings,
  getTempleTimings,
  getContactInfo,
  clearSettingsCache,
} from "./settings";

import {
  getUpcomingEvents,
  getFeaturedEvent,
  formatEventForDisplay,
  formatEventsListForDisplay,
  clearEventsCache,
} from "./events";

import {
  getActiveSevas,
  getSevasByCategory,
  getDailySevas,
  getSpecialSevas,
  formatSevasListForDisplay,
  formatSevaForDisplay,
  clearSevasCache,
} from "./sevas";

import {
  getActiveAnnouncements,
  getLatestAnnouncements,
  formatAnnouncementsForDisplay,
  clearAnnouncementsCache,
} from "./announcements";

import {
  getTodayPanchanga,
  getPanchangaForDate,
  formatPanchangaForDisplay,
  formatPanchangaSimple,
  clearPanchangaCache,
} from "./panchanga";

import {
  getDonationInfo,
  formatDonationInfoForDisplay,
  format80GInfo,
  clearDonationInfoCache,
} from "./donations";

import {
  getNextAaradhane,
  getUpcomingAaradhanes,
  formatAaradhaneForDisplay,
  formatUpcomingAaradhanes,
  clearAaradhaneCache,
} from "./aaradhane";

import {
  TempleSettings,
  TempleEvent,
  TempleSeva,
  TempleAnnouncement,
  PanchangaData,
  AaradhaneEvent,
  DonationInfo,
  AIResponseContext,
} from "./types";

import { Intent, RetrievalType } from "../intent/types";
import { IntentRetrievalMapping } from "./types";

/**
 * Intent to retrieval mapping
 * Defines which data retrievers to use for each intent
 */
export const INTENT_RETRIEVAL_MAP: IntentRetrievalMapping[] = [
  {
    intent: Intent.TEMPLE_TIMINGS,
    retrievers: [{ name: "settings", priority: 1 }],
  },
  {
    intent: Intent.CONTACT_INFORMATION,
    retrievers: [{ name: "settings", priority: 1 }],
  },
  {
    intent: Intent.LOCATION,
    retrievers: [{ name: "settings", priority: 1 }],
  },
  {
    intent: Intent.ADDRESS,
    retrievers: [{ name: "settings", priority: 1 }],
  },
  {
    intent: Intent.UPCOMING_EVENTS,
    retrievers: [{ name: "events", priority: 1 }],
  },
  {
    intent: Intent.NEXT_AARADHANE,
    retrievers: [{ name: "aaradhane", priority: 1 }],
  },
  {
    intent: Intent.FESTIVAL_INFO,
    retrievers: [
      { name: "aaradhane", priority: 1 },
      { name: "events", priority: 2 },
    ],
  },
  {
    intent: Intent.SPECIAL_SEVAS,
    retrievers: [{ name: "sevas", priority: 1 }],
  },
  {
    intent: Intent.DAILY_POOJA,
    retrievers: [{ name: "sevas", priority: 1 }],
  },
  {
    intent: Intent.DONATION,
    retrievers: [{ name: "donations", priority: 1 }],
  },
  {
    intent: Intent.DONATION_PURPOSE,
    retrievers: [{ name: "donations", priority: 1 }],
  },
  {
    intent: Intent.DONATION_80G,
    retrievers: [{ name: "donations", priority: 1 }],
  },
  {
    intent: Intent.ANNOUNCEMENTS,
    retrievers: [{ name: "announcements", priority: 1 }],
  },
  {
    intent: Intent.PANCHANGA,
    retrievers: [{ name: "panchanga", priority: 1 }],
  },
  {
    intent: Intent.VISITOR_GUIDELINES,
    retrievers: [{ name: "settings", priority: 1 }],
  },
  {
    intent: Intent.DRESS_CODE,
    retrievers: [{ name: "settings", priority: 1 }],
  },
];

/**
 * Get context data for hybrid AI response based on intent
 */
export async function getContextForIntent(
  intent: Intent
): Promise<{
  context: AIResponseContext;
  sources: RetrievalType[];
}> {
  const sources = new Set<RetrievalType>();

  // Get mapping for this intent
  const mapping = INTENT_RETRIEVAL_MAP.find((m) => m.intent === intent);
  
  if (!mapping) {
    return { context: {}, sources: [] };
  }

  const context: AIResponseContext = {};

  // Fetch data based on retrievers
  for (const retriever of mapping.retrievers.sort((a, b) => a.priority - b.priority)) {
    switch (retriever.name) {
      case "settings":
        const settings = await getTempleSettings();
        if (settings.data) {
          context.templeSettings = settings.data;
          sources.add(settings.source);
        }
        break;
        
      case "events":
        const events = await getUpcomingEvents();
        if (events.data) {
          context.upcomingEvents = events.data;
          sources.add(events.source);
        }
        break;
        
      case "sevas":
        const sevas = await getActiveSevas();
        if (sevas.data) {
          context.availableSevas = sevas.data;
          sources.add(sevas.source);
        }
        break;
        
      case "announcements":
        const announcements = await getActiveAnnouncements();
        if (announcements.data) {
          context.currentAnnouncements = announcements.data;
          sources.add(announcements.source);
        }
        break;
        
      case "panchanga":
        const panchanga = await getTodayPanchanga();
        if (panchanga.data) {
          context.todayPanchanga = panchanga.data;
          sources.add(panchanga.source);
        }
        break;
        
      case "donations":
        const donationInfo = await getDonationInfo();
        if (donationInfo.data) {
          context.donationInfo = donationInfo.data;
          sources.add(donationInfo.source);
        }
        break;
        
      case "aaradhane":
        const nextAaradhane = await getNextAaradhane();
        if (nextAaradhane.data) {
          context.nextAaradhane = nextAaradhane.data;
          sources.add(nextAaradhane.source);
        }
        break;
    }
  }

  return { context, sources: Array.from(sources) };
}

/**
 * Clear all retrieval caches
 */
export function clearAllCaches(): void {
  clearSettingsCache();
  clearEventsCache();
  clearSevasCache();
  clearAnnouncementsCache();
  clearPanchangaCache();
  clearDonationInfoCache();
  clearAaradhaneCache();
}

// Re-export all types
export type {
  TempleSettings,
  TempleEvent,
  TempleSeva,
  TempleAnnouncement,
  PanchangaData,
  AaradhaneEvent,
  DonationInfo,
  AIResponseContext,
};
