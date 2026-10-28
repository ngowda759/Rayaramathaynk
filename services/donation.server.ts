import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { DonationRecord, DonationRequest, DonationStatus } from "@/types/donation";

const TABLE = "donations";

/**
 * Donations, stored in Supabase `donations`.
 *
 * The whole service uses the service-role client: donations carry donor contact and
 * payment details and the table is deny-all under RLS. There is no Firestore path; a
 * read failure throws rather than returning an empty list.
 */
function rowToDonation(row: any): DonationRecord {
  return {
    id: row.firestore_id || row.id,
    donorName: row.donor_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    amount: Number(row.amount ?? 0),
    purpose: row.purpose ?? "",
    campaignId: row.campaign_id ?? "",
    message: row.message ?? "",
    paymentMode: row.payment_mode ?? "cash",
    status: row.status ?? "pending",
    receiptNumber: row.receipt_number ?? "",
    adminRemarks: row.admin_remarks ?? "",
    collectedBy: row.collected_by ?? "",
    collectedAt: row.collected_at ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

class DonationService {
  async createDonation(data: DonationRequest): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        donor_name: data.donorName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        amount: data.amount,
        purpose: data.purpose,
        campaign_id: data.campaignId,
        message: data.message,
        payment_mode: data.paymentMode,
        status: "pending",
        receipt_number: "",
        admin_remarks: "",
        collected_by: "",
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create donation: ${error.message}`);
    return row.firestore_id || row.id;
  }

  async getDonations(): Promise<DonationRecord[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read donations: ${error.message}`);
    return (data ?? []).map(rowToDonation);
  }

  async getDonationById(donationId: string): Promise<DonationRecord | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(rowIdFilter(donationId))
      .maybeSingle();
    if (error) throw new Error(`Could not read donation: ${error.message}`);
    return data ? rowToDonation(data) : null;
  }

  async updateDonationStatus(donationId: string, status: DonationStatus): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "received") update.collected_at = new Date().toISOString();
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(donationId));
    if (error) throw new Error(`Could not update donation: ${error.message}`);
  }

  async updateDonation(donationId: string, data: Partial<DonationRecord>): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (data.donorName !== undefined) update.donor_name = data.donorName;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.address !== undefined) update.address = data.address;
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.purpose !== undefined) update.purpose = data.purpose;
    if (data.campaignId !== undefined) update.campaign_id = data.campaignId;
    if (data.message !== undefined) update.message = data.message;
    if (data.paymentMode !== undefined) update.payment_mode = data.paymentMode;
    if (data.status !== undefined) update.status = data.status;
    if (data.receiptNumber !== undefined) update.receipt_number = data.receiptNumber;
    if (data.adminRemarks !== undefined) update.admin_remarks = data.adminRemarks;
    if (data.collectedBy !== undefined) update.collected_by = data.collectedBy;
    if (data.collectedAt !== undefined) update.collected_at = data.collectedAt || null;
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(donationId));
    if (error) throw new Error(`Could not update donation: ${error.message}`);
  }

  async deleteDonation(donationId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().or(rowIdFilter(donationId));
    if (error) throw new Error(`Could not delete donation: ${error.message}`);
  }
}

export const donationService = new DonationService();
