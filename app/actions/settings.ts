"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { SiteSettingsPayload } from "@/types/settings";

export async function createSettingsAction(payload: SiteSettingsPayload): Promise<string> {
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

export async function updateSettingsAction(id: string, payload: Partial<SiteSettingsPayload>) {
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
