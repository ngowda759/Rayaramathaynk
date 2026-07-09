import { DashboardStats } from "@/types/dashboard";

import {
  eventsRepository,
  sevasRepository,
  galleryRepository,
  announcementsRepository,
  timingsRepository,
  donationsRepository,
  sevaBookingsRepository,
} from "@/repositories";

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const [
      events,
      sevas,
      gallery,
      announcements,
      timings,
      donations,
      bookings,
    ] = await Promise.all([
      eventsRepository.count(),
      sevasRepository.count(),
      galleryRepository.countMedia(),
      announcementsRepository.count(),
      timingsRepository.count(),
      donationsRepository.count(),
      sevaBookingsRepository.count(),
    ]);

    return {
      totalUsers: 0, // Users come from Firebase Auth
      totalEvents: events,
      totalSevas: sevas,
      totalGalleryImages: gallery,
      totalAnnouncements: announcements,
      totalTimings: timings,
      totalDonations: donations,
      totalSevaBookings: bookings,
    };
  }
}

export const dashboardService = new DashboardService();
