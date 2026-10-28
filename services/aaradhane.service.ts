import { apiFetch } from "@/lib/api/fetch";
import { Aaradhane, AaradhaneStats } from "@/types/aaradhane";

/**
 * Aaradhane records, stored in Supabase `aaradhanes`.
 *
 * The browser never talks to Supabase directly: writes go through the admin-guarded
 * `/api/admin/aaradhane` routes and public reads through `/api/aaradhane`, both of
 * which use the service role server-side. There is no Firestore path, and the old
 * two-collection (`aaradhane`/`aaradhanes`) merge is gone — there is a single table.
 */
export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    return apiFetch<Aaradhane[]>("/api/aaradhane", { auth: false });
  },

  async getAaradhaneById(id: string): Promise<Aaradhane | null> {
    try {
      return await apiFetch<Aaradhane>(`/api/aaradhane/${encodeURIComponent(id)}`, { auth: false });
    } catch {
      return null;
    }
  },

  async createAaradhane(
    data: Omit<Aaradhane, "id" | "createdAt" | "createdBy">,
    _userEmail?: string
  ): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/admin/aaradhane", {
      method: "POST",
      body: data,
    });
    return id;
  },

  async updateAaradhane(
    id: string,
    data: Partial<Omit<Aaradhane, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    await apiFetch(`/api/admin/aaradhane/${encodeURIComponent(id)}`, { method: "PUT", body: data });
  },

  async deleteAaradhane(id: string): Promise<void> {
    await apiFetch(`/api/admin/aaradhane/${encodeURIComponent(id)}`, { method: "DELETE" });
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
