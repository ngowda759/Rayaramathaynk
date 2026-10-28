import { HomepageConfig } from "@/types/homepage";

/**
 * Public homepage configuration, stored in Supabase `settings_documents`
 * (`document_key = 'homepage'`), the same lossless JSONB container the guru-parampara
 * and other complex settings documents use.
 *
 * `settings_documents` is deny-all under RLS, so the browser never reads it directly:
 * this module calls the public `/api/public/homepage` route, which reads with the
 * service role. There is no Firestore path. `getDefaultConfig` returns the built-in
 * defaults synchronously so the first paint is never blank.
 *
 * The admin form reads and writes through `useSettingsDocument("homepage", …, { admin: true })`,
 * not through this module.
 */
class HomepageService {
  async getHomepage(): Promise<HomepageConfig> {
    try {
      const response = await fetch("/api/public/homepage", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = (await response.json()) as Partial<HomepageConfig>;
      return { ...this.getDefaultConfig(), ...data };
    } catch (error) {
      console.error("[homepage] Failed to load homepage settings:", error);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig(): HomepageConfig {
    return {
      heroTitle: "Welcome to Rayara Math",
      heroSubtitle: "Experience devotion and tradition",
      heroImage: "",
      announcement: "",
      announcement2: "",
      morningOpen: "06:00 AM",
      morningClose: "01:00 PM",
      eveningOpen: "01:00 PM",
      eveningClose: "08:30 PM",
      featuredFestival: "",
      festivalDate: "",
      donationTitle: "Support Rayara Math",
      donationSubtitle: "Your generous contribution helps preserve our traditions.",
      templeName: "Rayara Math",
      templeLocation: "",
      templeAddress: "",
      contactEmail: "",
      contactPhone: "",
      isTempleOpen: true,
      heroPrimaryButton: "Book Seva",
      heroSecondaryButton: "Donate",
      footerCopyright: "",
      todaySeva: "Daily Pooja Morning",
      todaySevaTime: "09:30 AM",
      featuredFestivalDescription: "Coming Soon",
      morningSchedule: ["Suprabhata Seva", "Alankara", "Darshan", "Theertha & Prasada"],
      eveningSchedule: ["Evening Pooja", "Mangalarati", "Darshan", "Temple Closing"],
      festivalScheduleNote:
        "Temple timings may be extended during festivals, Raghavendra Swamygala Aaradhane, Navaratri and other special occasions. Please check announcements before visiting.",
      panchanga: { tithi: "", nakshatra: "", yoga: "", karana: "", rahuKalam: "", gulikaKalam: "", masa: "" },
      heroStats: {
        stat1Label: "Daily",
        stat1Value: "Pooja",
        stat1Description: "",
        stat2Label: "365",
        stat2Value: "Days of Seva",
        stat2Description: "",
        stat3Label: "Guru",
        stat3Value: "Blessings",
        stat3Description: "",
      },
    } as HomepageConfig;
  }
}

export const homepageService = new HomepageService();
