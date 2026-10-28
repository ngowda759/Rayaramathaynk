import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { Seva, SevaRequest } from "@/types/seva";
import { getAllSevasAction, getSevaByIdAction } from "@/app/actions/sevas";

/**
 * Seva catalogue.
 *
 * Reads go through the public server actions in `app/actions/sevas.ts`, which query
 * Supabase `sevas` with the service role and return only active, online-offered rows.
 * There is no Firestore path: if the read fails it throws, so an empty list can only
 * mean "no sevas", never a swallowed permission or connectivity failure.
 *
 * Writes use the service-role client directly (the table is deny-all under RLS).
 */

class SevaService {
  async getAllSevas(): Promise<Seva[]> {
    const data = await getAllSevasAction();
    return (data ?? []).map((item: any) => ({
      id: item.firestore_id || item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      amount: Number(item.amount),
      duration: item.duration,
      imageUrl: item.image_url || "",
      active: item.active,
      displayOrder: item.display_order,
      createdAt: item.created_at,
      updatedAt: item.updated_at || item.created_at,
    })) as Seva[];
  }

  async getSevaById(id: string): Promise<Seva | null> {
    try {
      const item = await getSevaByIdAction(id);
      return {
        id: item.firestore_id || item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        amount: Number(item.amount),
        duration: item.duration,
        imageUrl: item.image_url || "",
        active: item.active,
        displayOrder: item.display_order,
        createdAt: item.created_at,
        updatedAt: item.updated_at || item.created_at,
      } as Seva;
    } catch (error) {
      // A single missing row is a legitimate "not found"; anything else is surfaced.
      if (error && typeof error === "object" && "code" in error && (error as any).code === "PGRST116") {
        return null;
      }
      throw error;
    }
  }

  async createSeva(data: SevaRequest) {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from("sevas")
      .insert({
        name: data.name,
        description: data.description,
        category: data.category,
        amount: data.amount,
        duration: data.duration,
        image_url: data.imageUrl,
        active: data.active,
        display_order: data.displayOrder,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create seva: ${error.message}`);
    return row.firestore_id || row.id;
  }

  async updateSeva(id: string, data: Partial<SevaRequest>) {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.category !== undefined) update.category = data.category;
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.duration !== undefined) update.duration = data.duration;
    if (data.imageUrl !== undefined) update.image_url = data.imageUrl;
    if (data.active !== undefined) update.active = data.active;
    if (data.displayOrder !== undefined) update.display_order = data.displayOrder;
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from("sevas").update(update).or(rowIdFilter(id));
    if (error) throw new Error(`Could not update seva: ${error.message}`);
  }

  async deleteSeva(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from("sevas").delete().or(rowIdFilter(id));
    if (error) throw new Error(`Could not delete seva: ${error.message}`);
  }
}

export const sevaService = new SevaService();
