/**
 * Repository for managing homepage configuration.
 * This repository provides get/update operations for homepage using JSON storage.
 */

import { HomepageConfig } from "@/types/homepage";
import { readJson, writeJson } from "@/lib/storage";

const STORAGE_FILE = "homepage.json";

const defaultConfig: HomepageConfig = {
  heroTitle: "Welcome to Rayara Math",
  heroSubtitle: "Experience devotion and tradition",
  heroImage: "",
  announcement: "",
  morningOpen: "06:00 AM",
  morningClose: "12:00 PM",
  eveningOpen: "05:00 PM",
  eveningClose: "08:30 PM",
  featuredFestival: "",
  festivalDate: "",
  donationTitle: "Support Rayara Math",
  donationSubtitle: "Your generous contribution helps preserve our traditions.",
  templeName: "Rayara Math",
  templeLocation: "",
  isTempleOpen: true,
  heroPrimaryButton: "Book Seva",
  heroSecondaryButton: "Donate",
  footerCopyright: "",
  todaySeva: "Daily Pooja Morning",
  todaySevaTime: "09:30 AM",
  featuredFestivalDescription: "Coming Soon",
  morningSchedule: [
    "Suprabhata Seva",
    "Alankara",
    "Darshan",
    "Theertha & Prasada",
  ],
  eveningSchedule: [
    "Evening Pooja",
    "Mangalarati",
    "Darshan",
    "Temple Closing",
  ],
  festivalScheduleNote:
    "Temple timings may be extended during festivals, Raghavendra Swamygala Aaradhane, Navaratri and other special occasions. Please check announcements before visiting.",
};

export const homepageRepository = {
  /**
   * Get the homepage configuration
   */
  async get(): Promise<HomepageConfig> {
    const data = await readJson<HomepageConfig & { id?: string }>(STORAGE_FILE);
    if (!data) return defaultConfig;

    // Merge with defaults to ensure all fields exist
    return {
      ...defaultConfig,
      ...data,
    };
  },

  /**
   * Get the default configuration
   */
  getDefault(): HomepageConfig {
    return { ...defaultConfig };
  },

  /**
   * Save the homepage configuration
   */
  async save(config: HomepageConfig): Promise<void> {
    await writeJson(STORAGE_FILE, {
      ...config,
      updatedAt: new Date().toISOString(),
    });
  },
};
