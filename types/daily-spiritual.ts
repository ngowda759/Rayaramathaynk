/**
 * Daily Spiritual Dashboard Types
 * Epic 1: Dynamic homepage dashboard with daily spiritual information
 */

import type { Announcement } from "./announcement";

export type { Announcement };

/**
 * Temple open/closed status with current time information
 */
export interface TempleStatus {
  isOpen: boolean;
  currentTime: string;
  morningOpen: string;
  morningClose: string;
  eveningOpen: string;
  eveningClose: string;
  session: "morning" | "evening" | "closed";
  nextOpenTime?: string;
  message?: string;
}

/**
 * Panchanga summary for dashboard display
 */
export interface PanchangaSummary {
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  sunrise: string;
  sunset: string;
  rahuKalam: string;
  gulikaKalam: string;
  masa: string;
  isFestival: boolean;
  festivalName?: string;
  isEkadashi: boolean;
  ekadashiName?: string;
}

/**
 * Daily spiritual quote
 */
export interface DailyQuote {
  id: string;
  text: string;
  source: string;
  language: "en" | "kn" | "mixed";
  category: string;
}

/**
 * Prasada information for the day
 */
export interface PrasadaInfo {
  name: string;
  description: string;
  available: boolean;
  distributionTime?: string;
}

/**
 * Featured event for the day
 */
export interface FeaturedEvent {
  id: string;
  title: string;
  description: string;
  startDate?: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
  category: string;
  imageUrl?: string;
  isToday: boolean;
  isOngoing: boolean;
  daysRemaining?: number;
}

/**
 * Dashboard data bundle
 */
export interface DailySpiritualDashboard {
  templeStatus: TempleStatus;
  quote: DailyQuote | null;
  featuredEvent: FeaturedEvent | null;
  announcements: Announcement[];
  lastUpdated: string;
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
  visibleOnMobile: boolean;
}

/**
 * Default quotes for daily spiritual content
 */
export const DEFAULT_QUOTES: DailyQuote[] = [
  {
    id: "quote-1",
    text: "ಓಂ ನಮೋ ಭಗವತೇ ವಾಸುದೇವಾಯ | ಓಂ ನಮೋ ಶ್ರೀ ರಾಘವೇಂದ್ರಾಯ",
    source: "Daily Prayer",
    language: "kn",
    category: "prayer"
  },
  {
    id: "quote-2",
    text: "ಯದಿ ಪದ್ಮಾಸನಸಂಸ್ಥಾಃ ಪ್ರಣವಂತಿ ಸುಧಾರಯಃ | ಸರ್ವಾಸಾಧು ಭವಂತ್ಯೇವ ತದ್ವಿಷ್ಣೋಃ ಪ್ರಸಾದತಃ ||",
    source: "Sri Raghavendra Stotra",
    language: "kn",
    category: "spiritual"
  },
  {
    id: "quote-3",
    text: "ಶ್ರೀಮದ್ರಾಮಪಾದಾರವಿಂದಮಧುಪಃ ಶ್ರೀಮಧ್ವವಂಶಾಧಿಪಃ",
    source: "Sri Raghavendra Mangalashtakam",
    language: "kn",
    category: "devotion"
  },
  {
    id: "quote-4",
    text: "Service to humanity is service to God",
    source: "Sri Raghavendra Swamy",
    language: "en",
    category: "wisdom"
  },
  {
    id: "quote-5",
    text: "ಭಕ್ತಿಯೆ ಮಹಾ ಪ್ರಭುವಿನ ಸ್ವರೂಪ | ಭಕ್ತಿಯೆ ಮುಕ್ತಿಯ ಮೂಲವಾಗಿ",
    source: "Madhwa Philosophy",
    language: "kn",
    category: "philosophy"
  }
];

/**
 * Default prasada info
 */
export const DEFAULT_PRASADA: PrasadaInfo = {
  name: "Theertha & Prasada",
  description: "Holy water and blessed offerings from the temple",
  available: true,
  distributionTime: "Available after morning poojas"
};
