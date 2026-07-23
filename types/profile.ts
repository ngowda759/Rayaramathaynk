/**
 * Profile Types - User preferences and devotee profile
 */

import { Locale } from "@/lib/i18n";
import { Timestamp } from "firebase/firestore";

export type Theme = "light" | "dark" | "system";

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  dailyPanchanga: boolean;
  dailyQuote: boolean;
  events: boolean;
  festivals: boolean;
  liveStream: boolean;
  aaradhane: boolean;
  announcements: boolean;
}

export interface DevicePreferences {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoPlayVideo: boolean;
  highQualityImages: boolean;
}

export interface UserPreferences {
  language: Locale;
  timezone: string;
  theme: Theme;
  notifications: NotificationPreferences;
  device: DevicePreferences;
}

export interface DevoteeProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  bio?: string;
  gotra?: string;
  nakshatra?: string;
  preferences: UserPreferences;
  favorites: string[];
  recentlyViewed: string[];
  bookmarks: Bookmark[];
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Bookmark {
  id: string;
  type: BookmarkType;
  itemId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  createdAt: Date;
}

export type BookmarkType = 
  | "event"
  | "article"
  | "gallery"
  | "quote"
  | "stotra"
  | "video"
  | "audio"
  | "book";

export interface ProfileUpdateData {
  name?: string;
  phone?: string;
  bio?: string;
  gotra?: string;
  nakshatra?: string;
  profileImage?: string;
}

export interface PreferencesUpdateData {
  language?: Locale;
  timezone?: string;
  theme?: Theme;
  notifications?: Partial<NotificationPreferences>;
  device?: Partial<DevicePreferences>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  push: true,
  dailyPanchanga: true,
  dailyQuote: true,
  events: true,
  festivals: true,
  liveStream: true,
  aaradhane: true,
  announcements: true,
};

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoPlayVideo: false,
  highQualityImages: true,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: "en",
  timezone: "Asia/Kolkata",
  theme: "system",
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  device: DEFAULT_DEVICE_PREFERENCES,
};

export const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST)", offset: "UTC+5:30" },
  { value: "Asia/Hyderabad", label: "India - Hyderabad", offset: "UTC+5:30" },
  { value: "Asia/Bengaluru", label: "India - Bengaluru", offset: "UTC+5:30" },
  { value: "Asia/Mysore", label: "India - Mysore", offset: "UTC+5:30" },
  { value: "Asia/Chennai", label: "India - Chennai", offset: "UTC+5:30" },
  { value: "Asia/Mumbai", label: "India - Mumbai", offset: "UTC+5:30" },
  { value: "Asia/Delhi", label: "India - Delhi", offset: "UTC+5:30" },
  { value: "Asia/Kolkata", label: "Asia - Kolkata", offset: "UTC+5:30" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", offset: "UTC+8:00" },
  { value: "Asia/Dubai", label: "UAE (GST)", offset: "UTC+4:00" },
  { value: "America/New_York", label: "USA - New York (EST)", offset: "UTC-5:00" },
  { value: "America/Los_Angeles", label: "USA - Los Angeles (PST)", offset: "UTC-8:00" },
  { value: "Europe/London", label: "UK (GMT)", offset: "UTC+0:00" },
  { value: "Europe/Paris", label: "Europe - Paris (CET)", offset: "UTC+1:00" },
  { value: "Australia/Sydney", label: "Australia - Sydney (AEST)", offset: "UTC+10:00" },
];

export const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "💻" },
];
