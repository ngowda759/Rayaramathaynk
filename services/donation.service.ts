import { apiFetch } from "@/lib/api/fetch";
import { DonationRecord, DonationRequest, DonationStatus } from "@/types/donation";

/**
 * Donations, stored in Supabase `donations`.
 *
 * The table carries donor contact and payment details and is deny-all under RLS, so
 * the browser never reads it directly: public submission posts to `/api/donations`
 * and the admin console reads and edits through the admin-guarded routes. The server
 * uses the service role. There is no Firestore path; a failure throws rather than
 * returning an empty list.
 */
class DonationService {
  async createDonation(data: DonationRequest): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/donations", { method: "POST", body: data });
    return id;
  }

  async getDonations(): Promise<DonationRecord[]> {
    return apiFetch<DonationRecord[]>("/api/admin/donations");
  }

  async getDonationById(donationId: string): Promise<DonationRecord | null> {
    try {
      return await apiFetch<DonationRecord>(`/api/admin/donations/${encodeURIComponent(donationId)}`);
    } catch {
      return null;
    }
  }

  async updateDonationStatus(donationId: string, status: DonationStatus): Promise<void> {
    await apiFetch(`/api/admin/donations/${encodeURIComponent(donationId)}`, {
      method: "PATCH",
      body: { status },
    });
  }

  async updateDonation(donationId: string, data: Partial<DonationRecord>): Promise<void> {
    await apiFetch(`/api/admin/donations/${encodeURIComponent(donationId)}`, {
      method: "PUT",
      body: data,
    });
  }

  async deleteDonation(donationId: string): Promise<void> {
    await apiFetch(`/api/admin/donations/${encodeURIComponent(donationId)}`, { method: "DELETE" });
  }
}

export const donationService = new DonationService();
