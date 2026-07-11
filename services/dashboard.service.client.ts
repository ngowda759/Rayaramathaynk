import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DashboardStats } from "@/types/dashboard";

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    if (!db) throw new Error("Firebase not configured");
    
    const collections = [
      "users",
      "events", 
      "sevas",
      "gallery",
      "announcements",
      "timings",
      "donations",
      "sevaBookings"
    ];

    const counts = await Promise.all(
      collections.map(async (col) => {
        if (!db) return 0;
        try {
          const q = query(collection(db, col));
          const snapshot = await getDocs(q);
          return snapshot.size;
        } catch (error) {
          console.error(`Error fetching ${col}:`, error);
          return 0;
        }
      })
    );

    return {
      totalUsers: counts[0],
      totalEvents: counts[1],
      totalSevas: counts[2],
      totalGalleryImages: counts[3],
      totalAnnouncements: counts[4],
      totalTimings: counts[5],
      totalDonations: counts[6],
      totalSevaBookings: counts[7],
    };
  }
}

export const dashboardService = new DashboardService();
