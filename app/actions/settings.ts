"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { SiteSettingsPayload } from "@/types/settings";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { checkAdminAuth, isUserAdmin } from "@/lib/auth/admin";
import { z } from "zod";

const settingsSchema = z.object({
  templeName: z.string().min(1, "templeName is required").max(200),
  contactEmail: z.string().email("Invalid email format").optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  footerText: z.string().max(500).optional(),
  welcomeMessage: z.string().max(2000).optional()
});

const settingsUpdateSchema = settingsSchema.partial();

async function verifyAdminForAction(): Promise<boolean> {
  const headersList = await headers();
  const req = new NextRequest("http://localhost", { headers: headersList });
  const auth = await checkAdminAuth(req);
  if (!auth) return false;
  if (auth.uid === "api-admin") return true; // Standard API key integration for server scripts

  return await isUserAdmin(auth.uid);
}

export async function createSettingsAction(payload: SiteSettingsPayload): Promise<string> {
  const isAuthorized = await verifyAdminForAction();
  if(!isAuthorized) {
       throw new Error('Unauthorized');
  }

  const parseResult = settingsSchema.safeParse(payload);
  if (!parseResult.success) {
      throw new Error(`Invalid payload: ${parseResult.error.message}`);
  }

  const validatedPayload = parseResult.data;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .insert({
      temple_name: validatedPayload.templeName,
      contact_email: validatedPayload.contactEmail || "",
      contact_phone: validatedPayload.contactPhone || "",
      address: validatedPayload.address || "",
      footer_text: validatedPayload.footerText || "",
      welcome_message: validatedPayload.welcomeMessage || "",
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

  const parseResult = settingsUpdateSchema.safeParse(payload);
  if (!parseResult.success) {
      throw new Error(`Invalid payload: ${parseResult.error.message}`);
  }
  const validatedPayload = parseResult.data;

  if (Object.keys(validatedPayload).length === 0) {
      throw new Error("Invalid payload: Update payload cannot be empty");
  }

  const supabase = createAdminClient();
  const updates: any = {};
  if (validatedPayload.templeName !== undefined) updates.temple_name = validatedPayload.templeName;
  if (validatedPayload.contactEmail !== undefined) updates.contact_email = validatedPayload.contactEmail;
  if (validatedPayload.contactPhone !== undefined) updates.contact_phone = validatedPayload.contactPhone;
  if (validatedPayload.address !== undefined) updates.address = validatedPayload.address;
  if (validatedPayload.footerText !== undefined) updates.footer_text = validatedPayload.footerText;
  if (validatedPayload.welcomeMessage !== undefined) updates.welcome_message = validatedPayload.welcomeMessage;

  const { error } = await supabase
    .from("site_settings")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating site settings:", error);
    throw new Error("Failed to update site settings");
  }
}
