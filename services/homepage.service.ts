import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { HomepageConfig } from "@/types/homepage";

const DOCUMENT_KEY = "homepage";

/**
 * Homepage configuration, stored in Supabase `settings_documents`
 * (`document_key = 'homepage'`), the same lossless JSONB container the guru-parampara
 * and other complex settings documents use.
 *
 * Reads use the public client (settings_documents is deny-all under RLS, so the public
 * read is served through the admin-guarded path in practice; the admin form and the
 * server use the service-role client). There is no Firestore path.
 */
class HomepageService {
  async getHomepage(): Promise<HomepageConfig> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings_documents")
      .select("data")
      .eq("document_key", DOCUMENT_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not read homepage settings: ${error.message}`);
    }
    if (!data) {
      return this.getDefaultConfig();
    }

    return {
      ...this.getDefaultConfig(),
      ...(data.data as HomepageConfig),
    };
  }

  async saveHomepage(config: HomepageConfig): Promise<void> {
    const supabase = createAdminClient();
    const cleanData = this.removeUndefined(config);
    const { error } = await supabase.from("settings_documents").upsert(
      {
        document_key: DOCUMENT_KEY,
        data: cleanData,
        source_field_count: Object.keys(cleanData).length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "document_key" }
    );
    if (error) {
      throw new Error(`Could not save homepage settings: ${error.message}`);
    }
  }

  /** Recursively remove undefined values, which JSONB cannot store. */
  private removeUndefined(obj: any): any {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    if (Array.isArray(obj)) return obj.map((item) => this.removeUndefined(item));
    if (typeof obj === "object") {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value !== undefined) result[key] = this.removeUndefined(value);
      }
      return result;
    }
    return obj;
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
