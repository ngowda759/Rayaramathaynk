import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { Announcement, AnnouncementRequest } from "@/types/announcement";

const TABLE = "announcements";

function rowToAnnouncement(row: any): Announcement {
  return {
    id: row.firestore_id || row.id,
    title: row.title || "",
    message: row.message || "",
    link: row.link || "",
    isActive: row.is_active ?? true,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  };
}

/**
 * Temple announcements, stored in Supabase `announcements`.
 *
 * Reads use the public client (RLS exposes active rows); writes use the service-role
 * admin client because the table is deny-all for writes under RLS. There is no
 * Firestore path. A read failure throws so the caller sees a real error rather than
 * an empty list that looks like "no announcements".
 */
class AnnouncementService {
  async getAnnouncements(): Promise<Announcement[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read announcements: ${error.message}`);
    return (data ?? []).map(rowToAnnouncement);
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read announcements: ${error.message}`);
    return (data ?? []).map(rowToAnnouncement);
  }

  async addAnnouncement(announcement: AnnouncementRequest): Promise<string> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        title: announcement.title,
        message: announcement.message ?? "",
        link: announcement.link ?? "",
        is_active: announcement.isActive ?? true,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create announcement: ${error.message}`);
    return data.firestore_id || data.id;
  }

  async updateAnnouncement(id: string, announcement: Partial<AnnouncementRequest>): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (announcement.title !== undefined) update.title = announcement.title;
    if (announcement.message !== undefined) update.message = announcement.message;
    if (announcement.link !== undefined) update.link = announcement.link;
    if (announcement.isActive !== undefined) update.is_active = announcement.isActive;
    const { error } = await supabase.from(TABLE).update(update).eq("firestore_id", id);
    if (error) throw new Error(`Could not update announcement: ${error.message}`);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().eq("firestore_id", id);
    if (error) throw new Error(`Could not delete announcement: ${error.message}`);
  }

  async getAnnouncement(id: string): Promise<Announcement | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("firestore_id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read announcement: ${error.message}`);
    return data ? rowToAnnouncement(data) : null;
  }
}

export const announcementService = new AnnouncementService();
