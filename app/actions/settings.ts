"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { SiteSettingsPayload } from "@/types/settings";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { checkAdminAuth, isUserAdmin } from "@/lib/auth/admin";

async function verifyAdminForAction(): Promise<boolean> {
  // If we are in dev mode without token, allow
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      return true;
  }
  const headersList = await headers();
  const req = new NextRequest("http://localhost", { headers: headersList });
  const auth = await checkAdminAuth(req);
  if (!auth) return false;
  if (auth.uid === "api-admin" || auth.uid === "dev-admin") return true;

  return await isUserAdmin(auth.uid);
}

export async function createSettingsAction(payload: SiteSettingsPayload): Promise<string> {
  const isAuthorized = await verifyAdminForAction();
  if(!isAuthorized) {
       throw new Error('Unauthorized');
  }

  // Validate payload (similar to zod if available)
  if (!payload.templeName || typeof payload.templeName !== "string") {
      throw new Error("Invalid payload: templeName is required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .insert({
      temple_name: payload.templeName,
      contact_email: payload.contactEmail || "",
      contact_phone: payload.contactPhone || "",
      address: payload.address || "",
      footer_text: payload.footerText || "",
      welcome_message: payload.welcomeMessage || "",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating site settings:", error);
    throw new Error("Failed to create site settings");
  }

  return data.id;
}

export async function updateSettingsAction(id: string, payload: Partial<SiteSettingsPayload>) {
  const isAuthorized = await verifyAdminForAction();
  if(!isAuthorized) {
       throw new Error('Unauthorized');
  }

  if (!id || typeof id !== "string") {
      throw new Error("Invalid id");
  }

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
    throw new Error("Failed to update site settings");
  }
}
