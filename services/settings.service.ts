import { createClient } from "@/lib/supabase/client";
import { SiteSettings, SiteSettingsPayload } from "@/types/settings";

export interface SocialLinksData {
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
  twitter: string;
  linkedin: string;
  mapUrl: string;
  showFacebook: boolean;
  showInstagram: boolean;
  showYoutube: boolean;
  showWhatsapp: boolean;
  showTwitter: boolean;
  showLinkedin: boolean;
  showMap: boolean;
}

const defaultSocialLinks: SocialLinksData = {
  facebook: "https://www.facebook.com/srs.mutt.yelahanka.newtown",
  instagram: "https://www.instagram.com/srs_mutt_yelahanka_newtown",
  youtube: "https://www.youtube.com/@Guru_Raghavendra_Rayaru",
  whatsapp: "https://whatsapp.com/channel/0029VbDCCue5Ejy3d6EQfh1g",
  twitter: "",
  linkedin: "",
  mapUrl: "https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8",
  showFacebook: true,
  showInstagram: true,
  showYoutube: true,
  showWhatsapp: true,
  showTwitter: false,
  showLinkedin: false,
  showMap: true,
};

class SettingsService {
  async getSettings(): Promise<SiteSettings | null> {
    // Reads are public, so client works fine
    const supabase = createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      console.error("Error fetching site settings:", error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      templeName: data.temple_name,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      address: data.address,
      footerText: data.footer_text || "",
      welcomeMessage: data.welcome_message || "",
      updatedAt: data.updated_at,
    };
  }

  async createSettings(payload: SiteSettingsPayload): Promise<string> {
    const { createSettingsAction } = await import("@/app/actions/settings");
    return createSettingsAction(payload);
  }

  async updateSettings(id: string, payload: Partial<SiteSettingsPayload>) {
    const { updateSettingsAction } = await import("@/app/actions/settings");
    return updateSettingsAction(id, payload);
  }

  async getSocialLinks(): Promise<SocialLinksData> {
    // Reads are public, so client works fine
    const supabase = createClient();
    const { data, error } = await supabase
      .from("social_links")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error("Error fetching social links:", error);
      }
      return defaultSocialLinks;
    }

    if (!data) return defaultSocialLinks;

    return {
      facebook: data.facebook || "",
      instagram: data.instagram || "",
      youtube: data.youtube || "",
      whatsapp: data.whatsapp || "",
      twitter: data.twitter || "",
      linkedin: data.linkedin || "",
      mapUrl: data.map_url || "",
      showFacebook: data.show_facebook,
      showInstagram: data.show_instagram,
      showYoutube: data.show_youtube,
      showWhatsapp: data.show_whatsapp,
      showTwitter: data.show_twitter,
      showLinkedin: data.show_linkedin,
      showMap: data.show_map,
    };
  }
}

export const settingsService = new SettingsService();
