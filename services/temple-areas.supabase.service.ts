import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TempleArea, TempleAreaCategory } from "@/types/temple-explorer";
import { TEMPLE_AREAS as DEFAULT_TEMPLE_AREAS } from "@/types/temple-explorer";

const TABLE_NAME = "temple_areas";

export class TempleAreasSupabaseService {
  /**
   * Get all temple areas from Supabase (uses admin client for server-side fetching in admin routes)
   */
  async getAreas(): Promise<TempleArea[]> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .order("order", { ascending: true });

      if (error) {
        console.error("[TempleAreasSupabaseService] Error fetching areas:", error);
        return [];
      }

      return this.mapToTempleAreas(data);
    } catch (error) {
      console.error("[TempleAreasSupabaseService] Exception fetching areas:", error);
      return [];
    }
  }

  /**
   * Get public areas (uses public client with RLS)
   */
  async getPublicAreas(): Promise<TempleArea[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .order("order", { ascending: true });

      if (error) {
        console.error("[TempleAreasSupabaseService] Error fetching public areas:", error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return this.mapToTempleAreas(data);
    } catch (error) {
      console.error("[TempleAreasSupabaseService] Exception fetching public areas:", error);
      return [];
    }
  }

  async getArea(id: string): Promise<TempleArea | null> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq('id', id)
        .single();

      if (error || !data) return null;

      return this.mapToTempleArea(data);
    } catch (error) {
      console.error("[TempleAreasSupabaseService] Exception fetching area:", error);
      return null;
    }
  }

  async getPublicArea(id: string): Promise<TempleArea | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToTempleArea(data);
    } catch (error) {
      console.error("[TempleAreasSupabaseService] Exception fetching public area:", error);
      return null;
    }
  }

  async addArea(area: Omit<TempleArea, "id">) {
    const supabase = createAdminClient();

    const id = area.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const insertData = {
      id: id,
      name: area.name,
      name_kannada: area.nameKannada,
      description: area.description,
      significance: area.significance,
      icon: area.icon,
      image_url: area.imageUrl,
      category: area.category,
      features: area.features || [],
      best_time_to_visit: area.bestTimeToVisit,
      tips: area.tips || [],
      has360_view: area.has360View,
      "order": area.order || 0
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateArea(id: string, area: Partial<TempleArea>) {
    const supabase = createAdminClient();

    const updateData: any = {};
    if (area.name !== undefined) updateData.name = area.name;
    if (area.nameKannada !== undefined) updateData.name_kannada = area.nameKannada;
    if (area.description !== undefined) updateData.description = area.description;
    if (area.significance !== undefined) updateData.significance = area.significance;
    if (area.icon !== undefined) updateData.icon = area.icon;
    if (area.imageUrl !== undefined) updateData.image_url = area.imageUrl;
    if (area.category !== undefined) updateData.category = area.category;
    if (area.features !== undefined) updateData.features = area.features;
    if (area.bestTimeToVisit !== undefined) updateData.best_time_to_visit = area.bestTimeToVisit;
    if (area.tips !== undefined) updateData.tips = area.tips;
    if (area.has360View !== undefined) updateData.has360_view = area.has360View;
    if (area.order !== undefined) updateData["order"] = area.order;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deleteArea(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  private mapToTempleArea(row: any): TempleArea {
    return {
      id: row.id,
      name: row.name,
      nameKannada: row.name_kannada,
      description: row.description,
      significance: row.significance,
      icon: row.icon,
      imageUrl: row.image_url,
      category: row.category as TempleAreaCategory,
      features: row.features || [],
      bestTimeToVisit: row.best_time_to_visit,
      tips: row.tips || [],
      has360View: row.has360_view,
      order: row.order
    };
  }

  private mapToTempleAreas(rows: any[]): TempleArea[] {
    return rows.map(this.mapToTempleArea);
  }
}

export const templeAreasSupabaseService = new TempleAreasSupabaseService();
