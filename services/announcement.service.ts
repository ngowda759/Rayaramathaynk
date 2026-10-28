import { apiFetch } from "@/lib/api/fetch";
import { Announcement, AnnouncementRequest } from "@/types/announcement";

/**
 * Temple announcements, stored in Supabase `announcements`.
 *
 * The browser never talks to Supabase directly: the table is deny-all for writes
 * under RLS, so this module calls the same-origin `/api/announcements` routes. The
 * server reads with the service role and requires an authenticated administrator for
 * every write. There is no Firestore path. A failure throws so the caller sees a real
 * error rather than an empty list that looks like "no announcements".
 */
class AnnouncementService {
  async getAnnouncements(): Promise<Announcement[]> {
    return apiFetch<Announcement[]>("/api/announcements", { auth: false });
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const all = await apiFetch<Announcement[]>("/api/announcements?active=1", { auth: false });
    return all;
  }

  async addAnnouncement(announcement: AnnouncementRequest): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/announcements", {
      method: "POST",
      body: announcement,
    });
    return id;
  }

  async updateAnnouncement(id: string, announcement: Partial<AnnouncementRequest>): Promise<void> {
    await apiFetch(`/api/announcements/${encodeURIComponent(id)}`, { method: "PUT", body: announcement });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await apiFetch(`/api/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async getAnnouncement(id: string): Promise<Announcement | null> {
    try {
      return await apiFetch<Announcement>(`/api/announcements/${encodeURIComponent(id)}`, { auth: false });
    } catch {
      return null;
    }
  }
}

export const announcementService = new AnnouncementService();
