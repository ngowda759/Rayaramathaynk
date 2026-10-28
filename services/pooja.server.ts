import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { DailyPooja, PoojaStats } from "@/types/pooja";

const TABLE = "daily_poojas";

/**
 * Daily pooja schedule, stored in Supabase `daily_poojas`.
 *
 * Reads use the public client; writes use the service-role admin client (the table is
 * deny-all under RLS). There is no Firestore path. A read failure throws instead of
 * returning an empty list.
 */
function rowToPooja(row: any): DailyPooja {
  return {
    id: row.firestore_id || row.id,
    title: row.title || "",
    description: row.description || "",
    startTime: row.start_time || "",
    duration: row.duration || "",
    category: row.category || "Morning",
    sevaAmount: row.seva_amount ?? 0,
    isActive: row.is_active ?? true,
    displayOrder: row.display_order ?? 0,
    days: row.days || ["All"],
    notes: row.notes || "",
    createdAt: row.created_at || new Date().toISOString(),
    createdBy: row.created_by || "",
  };
}

export const poojaService = {
  async getPoojas(): Promise<DailyPooja[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read daily poojas: ${error.message}`);
    return (data ?? []).map(rowToPooja);
  },

  async getPoojaById(id: string): Promise<DailyPooja | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(rowIdFilter(id))
      .maybeSingle();
    if (error) throw new Error(`Could not read daily pooja: ${error.message}`);
    return data ? rowToPooja(data) : null;
  },

  async createPooja(
    data: Omit<DailyPooja, "id" | "createdAt" | "createdBy">,
    userEmail: string
  ): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({
        title: data.title,
        description: data.description,
        start_time: data.startTime,
        duration: data.duration,
        category: data.category,
        seva_amount: data.sevaAmount,
        is_active: data.isActive,
        display_order: data.displayOrder,
        days: data.days,
        notes: data.notes,
        created_by: userEmail,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create daily pooja: ${error.message}`);
    return row.firestore_id || row.id;
  },

  async updatePooja(
    id: string,
    data: Partial<Omit<DailyPooja, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.startTime !== undefined) update.start_time = data.startTime;
    if (data.duration !== undefined) update.duration = data.duration;
    if (data.category !== undefined) update.category = data.category;
    if (data.sevaAmount !== undefined) update.seva_amount = data.sevaAmount;
    if (data.isActive !== undefined) update.is_active = data.isActive;
    if (data.displayOrder !== undefined) update.display_order = data.displayOrder;
    if (data.days !== undefined) update.days = data.days;
    if (data.notes !== undefined) update.notes = data.notes;
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(`Could not update daily pooja: ${error.message}`);
  },

  async deletePooja(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().or(rowIdFilter(id));
    if (error) throw new Error(`Could not delete daily pooja: ${error.message}`);
  },

  async getStats(): Promise<PoojaStats> {
    const poojas = await this.getPoojas();
    const byCategory: Record<string, number> = {};
    poojas.forEach((p) => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });
    return {
      total: poojas.length,
      active: poojas.filter((p) => p.isActive).length,
      byCategory,
      withSeva: poojas.filter((p) => p.sevaAmount > 0).length,
    };
  },
};
