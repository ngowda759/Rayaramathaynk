import { getCountFromServer, collection } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { DashboardStats } from "@/types/dashboard";

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    if (!db) throw new Error("Firebase not configured");
    
    const [
      users,
      events,
      sevas,
      gallery,
      announcements,
      timings,
      donations,
      bookings,
    ] = await Promise.all([
      getCountFromServer(collection(db, "users")),
      getCountFromServer(collection(db, "events")),
      getCountFromServer(collection(db, "sevas")),
      getCountFromServer(collection(db, "gallery")),
      getCountFromServer(collection(db, "announcements")),
      getCountFromServer(collection(db, "timings")),
      getCountFromServer(collection(db, "donations")),
      getCountFromServer(collection(db, "sevaBookings")),
    ]);

    return {
      totalUsers: users.data().count,
      totalEvents: events.data().count,
      totalSevas: sevas.data().count,
      totalGalleryImages: gallery.data().count,
      totalAnnouncements: announcements.data().count,
      totalTimings: timings.data().count,
      totalDonations: donations.data().count,
      totalSevaBookings: bookings.data().count,
    };
  }
}

export const dashboardService = new DashboardService();
