import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardStats } from "@/types/dashboard";

/**
 * Admin dashboard counts (client-side entry point).
 *
 * Reads Supabase directly with the service-role admin client; this module must only
 * be imported by admin-only server code. There is no Firestore path.
 */
class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const supabase = createAdminClient();

    async function count(table: string): Promise<number> {
      const { count: value, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`Could not count ${table}: ${error.message}`);
      return value ?? 0;
    }

    const [
      totalUsers,
      totalEvents,
      totalSevas,
      totalGalleryImages,
      totalAnnouncements,
      totalTimings,
      totalDonations,
      totalSevaBookings,
    ] = await Promise.all([
      count("users"),
      count("events"),
      count("sevas"),
      count("gallery_media"),
      count("announcements"),
      count("daily_poojas"),
      count("donations"),
      count("seva_receipts"),
    ]);

    return {
      totalUsers,
      totalEvents,
      totalSevas,
      totalGalleryImages,
      totalAnnouncements,
      totalTimings,
      totalDonations,
      totalSevaBookings,
    };
  }
}

export const dashboardService = new DashboardService();
