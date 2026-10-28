import "server-only";

/**
 * Testimonials, stored in Supabase `testimonials`.
 *
 * There is no Firestore path and no built-in set of sample testimonials: devotee
 * testimonials are not invented (docs/CONTENT-GUIDELINES.md — "Fabricated facts").
 * Until a real testimonial is approved, the public page shows its own empty state.
 *
 * Reads use the public client (RLS exposes approved rows); writes use the service-role
 * admin client. A read failure throws so the caller sees a real error.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { Testimonial } from "@/types/homepage";

const TABLE = "testimonials";

function rowToTestimonial(row: any): Testimonial {
  return {
    id: row.firestore_id || row.id,
    name: row.name || "",
    location: row.location || "",
    quote: row.quote || "",
    years: row.years || "",
    image: row.image || undefined,
    phone: row.phone || undefined,
    approved: row.approved ?? false,
    rejected: row.rejected ?? false,
    rejectionReason: row.rejection_reason || undefined,
    submittedBy: row.submitted_by || "public",
    createdAt: row.created_at,
  } as Testimonial;
}

export async function getPendingTestimonials(): Promise<Testimonial[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("submitted_by", "public")
    .eq("approved", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not read pending testimonials: ${error.message}`);
  return (data ?? []).map(rowToTestimonial);
}

export async function rejectTestimonial(id: string, reason?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      rejected: true,
      approved: false,
      rejection_reason: reason || "Your testimonial did not meet our guidelines.",
    })
    .eq("firestore_id", id);
  if (error) throw new Error(`Could not reject testimonial: ${error.message}`);
}

export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not read testimonials: ${error.message}`);
  return (data ?? []).map(rowToTestimonial);
}

export async function getAllTestimonials(): Promise<Testimonial[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not read testimonials: ${error.message}`);
  return (data ?? []).map(rowToTestimonial);
}

export async function getTestimonial(id: string): Promise<Testimonial | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("firestore_id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read testimonial: ${error.message}`);
  return data ? rowToTestimonial(data) : null;
}

export async function createTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: testimonial.name,
      location: testimonial.location,
      quote: testimonial.quote,
      years: testimonial.years || "",
      image: testimonial.image || null,
      phone: testimonial.phone || null,
      approved: testimonial.approved ?? false,
      rejected: testimonial.rejected ?? false,
      submitted_by: testimonial.submittedBy || "admin",
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Could not create testimonial: ${error.message}`);
  return data.firestore_id || data.id;
}

export async function submitTestimonial(submission: {
  name: string;
  location: string;
  quote: string;
  phone?: string;
  image?: string;
}): Promise<string> {
  let imageUrl: string | undefined = submission.image;

  // A base64 data URL is uploaded to storage; a failure is non-fatal.
  if (submission.image && submission.image.startsWith("data:")) {
    try {
      const { storageService } = await import("@/services/storage.service");
      const sanitizedName = storageService.sanitizeFilename(submission.name);
      const cleanPhone = submission.phone ? submission.phone.replace(/[^0-9+]/g, "") : "";
      const filename = cleanPhone
        ? `${sanitizedName}_${cleanPhone}.jpg`
        : `${sanitizedName}_${Date.now()}.jpg`;
      const result = await storageService.uploadBase64Image(submission.image, `images/testimonials/${filename}`);
      imageUrl = result.url;
    } catch (error) {
      console.error("[Testimonials] Failed to upload image, saving without image:", error);
      imageUrl = undefined;
    }
  }

  return createTestimonial({
    name: submission.name,
    location: submission.location,
    quote: submission.quote,
    years: "Devotee",
    image: imageUrl,
    phone: submission.phone,
    submittedBy: "public",
    approved: false,
    rejected: false,
  });
}

export async function updateTestimonial(
  id: string,
  data: Partial<Omit<Testimonial, "id" | "createdAt">>
): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.location !== undefined) update.location = data.location;
  if (data.quote !== undefined) update.quote = data.quote;
  if (data.years !== undefined) update.years = data.years;
  if (data.image !== undefined) update.image = data.image || null;
  if (data.approved !== undefined) update.approved = data.approved;
  if (data.rejected !== undefined) update.rejected = data.rejected;
  const { error } = await supabase.from(TABLE).update(update).eq("firestore_id", id);
  if (error) throw new Error(`Could not update testimonial: ${error.message}`);
}

export async function approveTestimonial(id: string): Promise<void> {
  await updateTestimonial(id, { approved: true });
}

export async function deleteTestimonial(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("firestore_id", id);
  if (error) throw new Error(`Could not delete testimonial: ${error.message}`);
}
