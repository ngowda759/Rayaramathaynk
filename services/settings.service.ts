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
    // Next.js server actions / api routes can use the server component client
    // For services, we dynamically import admin client to avoid client-side bundling issues.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("site_settings")
      .insert({
        temple_name: payload.templeName,
        contact_email: payload.contactEmail,
        contact_phone: payload.contactPhone,
        address: payload.address,
        footer_text: payload.footerText,
        welcome_message: payload.welcomeMessage,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating site settings:", error);
      throw error;
    }

    return data.id;
  }

  async updateSettings(id: string, payload: Partial<SiteSettingsPayload>) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const updates: any = {};
    if (payload.templeName !== undefined) updates.temple_name = payload.templeName;
    if (payload.contactEmail !== undefined) updates.contact_email = payload.contactEmail;
    if (payload.contactPhone !== undefined) updates.contact_phone = payload.contactPhone;
    if (payload.address !== undefined) updates.address = payload.address;
    if (payload.footerText !== undefined) updates.footer_text = payload.footerText;
    if (payload.welcomeMessage !== undefined) updates.welcome_message = payload.welcomeMessage;

    const { error } = await supabase
      .from("site_settings")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating site settings:", error);
      throw error;
    }
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
