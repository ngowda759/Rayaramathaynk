import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardStats } from "@/types/dashboard";

/**
 * Admin dashboard counts, read directly from Supabase with the service-role client
 * (the source tables are deny-all under RLS). There is no Firestore path.
 *
 * The Firestore counters read collections (`gallery`, `timings`, `sevaBookings`) that
 * no longer exist as Supabase tables; the corresponding Supabase tables are used
 * instead. `totalTimings` is served by `daily_poojas`, the table that holds the temple
 * pooja/timing schedule.
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
