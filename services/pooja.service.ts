import { apiFetch } from "@/lib/api/fetch";
import { DailyPooja, PoojaStats } from "@/types/pooja";

/**
 * Daily pooja schedule, stored in Supabase `daily_poojas`.
 *
 * The browser never talks to Supabase directly: reads go through `/api/poojas` and
 * writes through the admin-guarded `/api/admin/poojas` routes, which use the service
 * role server-side. There is no Firestore path. A failure throws instead of returning
 * an empty list.
 */
export const poojaService = {
  async getPoojas(): Promise<DailyPooja[]> {
    return apiFetch<DailyPooja[]>("/api/poojas", { auth: false });
  },

  async getPoojaById(id: string): Promise<DailyPooja | null> {
    try {
      return await apiFetch<DailyPooja>(`/api/poojas/${encodeURIComponent(id)}`, { auth: false });
    } catch {
      return null;
    }
  },

  async createPooja(
    data: Omit<DailyPooja, "id" | "createdAt" | "createdBy">,
    _userEmail?: string
  ): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/admin/poojas", {
      method: "POST",
      body: data,
    });
    return id;
  },

  async updatePooja(
    id: string,
    data: Partial<Omit<DailyPooja, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    await apiFetch(`/api/admin/poojas/${encodeURIComponent(id)}`, { method: "PUT", body: data });
  },

  async deletePooja(id: string): Promise<void> {
    await apiFetch(`/api/admin/poojas/${encodeURIComponent(id)}`, { method: "DELETE" });
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
