import { apiFetch } from "@/lib/api/fetch";
import { Testimonial } from "@/types/homepage";

/**
 * Devotee testimonials, stored in Supabase `testimonials`.
 *
 * The table is deny-all under RLS, so the browser never reads it directly: approved
 * testimonials are served from `/api/testimonials/devotee`, public submission posts
 * there, and the admin console uses the admin-guarded `/api/admin/testimonials`
 * routes. The server uses the service role. There is no Firestore path and no
 * built-in sample testimonials: devotee testimonials are not invented
 * (docs/CONTENT-GUIDELINES.md — "Fabricated facts"). Until a real testimonial is
 * approved, the public page shows its own empty state.
 */

export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  return apiFetch<Testimonial[]>("/api/testimonials/devotee", { auth: false });
}

export async function getPendingTestimonials(): Promise<Testimonial[]> {
  return apiFetch<Testimonial[]>("/api/admin/testimonials?pending=1");
}

export async function getAllTestimonials(): Promise<Testimonial[]> {
  return apiFetch<Testimonial[]>("/api/admin/testimonials");
}

export async function getTestimonial(id: string): Promise<Testimonial | null> {
  try {
    return await apiFetch<Testimonial>(`/api/admin/testimonials/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function createTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/admin/testimonials", {
    method: "POST",
    body: testimonial,
  });
  return id;
}

export async function submitTestimonial(submission: {
  name: string;
  location: string;
  quote: string;
  phone?: string;
  image?: string;
}): Promise<string> {
  let imageUrl: string | undefined = submission.image;

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

  const { id } = await apiFetch<{ id: string }>("/api/testimonials/devotee", {
    method: "POST",
    body: { ...submission, image: imageUrl },
  });
  return id;
}

export async function updateTestimonial(
  id: string,
  data: Partial<Omit<Testimonial, "id" | "createdAt">>
): Promise<void> {
  await apiFetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, { method: "PUT", body: data });
}

export async function approveTestimonial(id: string): Promise<void> {
  await apiFetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { approved: true },
  });
}

export async function rejectTestimonial(id: string, reason?: string): Promise<void> {
  await apiFetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { rejected: true, rejectionReason: reason },
  });
}

export async function deleteTestimonial(id: string): Promise<void> {
  await apiFetch(`/api/admin/testimonials/${encodeURIComponent(id)}`, { method: "DELETE" });
}
