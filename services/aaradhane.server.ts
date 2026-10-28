import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { Aaradhane, AaradhaneStats } from "@/types/aaradhane";

const TABLE = "aaradhanes";

/**
 * Aaradhane records, stored in Supabase `aaradhanes`.
 *
 * Reads use the public client; writes use the service-role admin client (`aaradhanes`
 * is deny-all under RLS). There is no Firestore path, and the old two-collection
 * (`aaradhane`/`aaradhanes`) merge is gone — there is a single table.
 */
function isAaradhaneUpcoming(dates: string[]): boolean {
  if (!dates || dates.length === 0) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return dates.some((dateStr) => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= now;
  });
}

function rowToAaradhane(row: any): Aaradhane {
  const dates = row.dates || [];
  return {
    id: row.firestore_id || row.id,
    title: row.title || "",
    guruName: row.guru_name || "",
    dates,
    description: row.description || "",
    significance: row.significance || "",
    rituals: row.rituals || [],
    offerings: row.offerings || [],
    imageUrl: row.image_url || "",
    sevaDetails: row.seva_details || [],
    isUpcoming: isAaradhaneUpcoming(dates),
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at || new Date().toISOString(),
    createdBy: row.created_by || "",
  };
}

export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read aaradhanes: ${error.message}`);
    return (data ?? []).map(rowToAaradhane);
  },

  async getAaradhaneById(id: string): Promise<Aaradhane | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(rowIdFilter(id))
      .maybeSingle();
    if (error) throw new Error(`Could not read aaradhane: ${error.message}`);
    return data ? rowToAaradhane(data) : null;
  },

  async createAaradhane(
    data: Omit<Aaradhane, "id" | "createdAt" | "createdBy">,
    userEmail: string
  ): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        title: data.title,
        guru_name: data.guruName,
        dates: data.dates,
        description: data.description,
        significance: data.significance,
        rituals: data.rituals,
        offerings: data.offerings,
        image_url: data.imageUrl,
        seva_details: data.sevaDetails,
        is_upcoming: data.isUpcoming,
        display_order: data.displayOrder,
        created_by: userEmail,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create aaradhane: ${error.message}`);
    return row.firestore_id || row.id;
  },

  async updateAaradhane(
    id: string,
    data: Partial<Omit<Aaradhane, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.guruName !== undefined) update.guru_name = data.guruName;
    if (data.dates !== undefined) update.dates = data.dates;
    if (data.description !== undefined) update.description = data.description;
    if (data.significance !== undefined) update.significance = data.significance;
    if (data.rituals !== undefined) update.rituals = data.rituals;
    if (data.offerings !== undefined) update.offerings = data.offerings;
    if (data.imageUrl !== undefined) update.image_url = data.imageUrl;
    if (data.sevaDetails !== undefined) update.seva_details = data.sevaDetails;
    if (data.isUpcoming !== undefined) update.is_upcoming = data.isUpcoming;
    if (data.displayOrder !== undefined) update.display_order = data.displayOrder;

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(`Could not update aaradhane: ${error.message}`);
  },

  async deleteAaradhane(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .or(rowIdFilter(id))
      .select("id");
    if (error) throw new Error(`Could not delete aaradhane: ${error.message}`);
    if (!data || data.length === 0) {
      throw new Error(`Could not delete Aaradhane: ${id}. Record not found.`);
    }
  },

  async getStats(): Promise<AaradhaneStats> {
    const items = await this.getAaradhanes();
    return {
      total: items.length,
      upcoming: items.filter((i) => i.isUpcoming).length,
      past: items.filter((i) => !i.isUpcoming).length,
    };
  },
};
