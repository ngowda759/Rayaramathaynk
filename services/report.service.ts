import { donationService } from "@/services/donation.service";
import { sevaBookingService } from "@/services/sevaBooking.service";

import { ReportSummary } from "@/types/report";

class ReportService {
  async getSummary(): Promise<ReportSummary> {
    const [donations, bookings] = await Promise.all([
      donationService.getDonations(),
      sevaBookingService.getAllBookings(),
    ]);

    const donationRevenue = donations
      .filter((d) => d.status === "received")
      .reduce((sum, d) => sum + d.amount, 0);

    const sevaRevenue = bookings
      .filter(
        (b) =>
          b.status === "confirmed" ||
          b.status === "completed"
      )
      .reduce((sum, b) => sum + b.sevaAmount, 0);

    return {
      revenue: {
        donationRevenue,
        sevaRevenue,
        totalRevenue:
          donationRevenue + sevaRevenue,
      },

      donations: {
        total: donations.length,
        pending: donations.filter(
          (d) => d.status === "pending"
        ).length,
        received: donations.filter(
          (d) => d.status === "received"
        ).length,
        failed: donations.filter(
          (d) => d.status === "failed"
        ).length,
        totalAmount: donationRevenue,
      },

      bookings: {
        total: bookings.length,
        pending: bookings.filter(
          (b) => b.status === "pending"
        ).length,
        confirmed: bookings.filter(
          (b) => b.status === "confirmed"
        ).length,
        completed: bookings.filter(
          (b) => b.status === "completed"
        ).length,
        cancelled: bookings.filter(
          (b) => b.status === "cancelled"
        ).length,
      },
    };
  }
}

export const reportService = new ReportService();
