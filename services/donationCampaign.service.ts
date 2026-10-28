import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { DonationCampaign, DonationCampaignRequest } from "@/types/donationCampaign";

const TABLE = "donation_campaigns";

/**
 * Donation campaigns, stored in Supabase `donation_campaigns`.
 *
 * Reads use the public client; writes use the service-role admin client (the table is
 * deny-all under RLS). There is no Firestore path; a read failure throws.
 */
function rowToCampaign(row: any): DonationCampaign {
  return {
    id: row.firestore_id || row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    suggestedAmount: Number(row.suggested_amount ?? 0),
    active: row.active ?? true,
    displayOrder: Number(row.display_order ?? 0),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

class DonationCampaignService {
  async getCampaigns(): Promise<DonationCampaign[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read donation campaigns: ${error.message}`);
    return (data ?? []).map(rowToCampaign);
  }

  async getActiveCampaigns(): Promise<DonationCampaign[]> {
    const campaigns = await this.getCampaigns();
    return campaigns.filter((campaign) => campaign.active);
  }

  async getCampaignById(id: string): Promise<DonationCampaign | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("firestore_id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read donation campaign: ${error.message}`);
    return data ? rowToCampaign(data) : null;
  }

  async createCampaign(data: DonationCampaignRequest) {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        title: data.title,
        description: data.description,
        image_url: data.imageUrl,
        suggested_amount: data.suggestedAmount,
        active: data.active,
        display_order: data.displayOrder,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create donation campaign: ${error.message}`);
    return row.firestore_id || row.id;
  }

  async updateCampaign(id: string, data: Partial<DonationCampaignRequest>) {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.imageUrl !== undefined) update.image_url = data.imageUrl;
    if (data.suggestedAmount !== undefined) update.suggested_amount = data.suggestedAmount;
    if (data.active !== undefined) update.active = data.active;
    if (data.displayOrder !== undefined) update.display_order = data.displayOrder;
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from(TABLE).update(update).eq("firestore_id", id);
    if (error) throw new Error(`Could not update donation campaign: ${error.message}`);
  }

  async deleteCampaign(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().eq("firestore_id", id);
    if (error) throw new Error(`Could not delete donation campaign: ${error.message}`);
  }
}

export const donationCampaignService = new DonationCampaignService();
