export interface RevenueReport {
  donationRevenue: number;
  sevaRevenue: number;
  totalRevenue: number;
}

export interface BookingReport {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export interface DonationReport {
  total: number;
  pending: number;
  received: number;
  failed: number;
  totalAmount: number;
}

export interface ReportSummary {
  revenue: RevenueReport;
  bookings: BookingReport;
  donations: DonationReport;
}
