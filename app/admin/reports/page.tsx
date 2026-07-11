"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  HandCoins,
  HeartHandshake,
  Calendar,
  Printer,
} from "lucide-react";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import ReportCard from "@/components/admin/reports/ReportCard";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

import { donationService } from "@/services/donation.service";
import { sevaBookingService } from "@/services/sevaBooking.service";
import { DonationRecord } from "@/types/donation";
import { SevaBooking } from "@/types/seva-booking";

type DateRange = "today" | "week" | "month" | "quarter" | "year" | "custom";

function ReportsPageContent() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [summary, setSummary] = useState({
    revenue: { donationRevenue: 0, sevaRevenue: 0, totalRevenue: 0 },
    donations: { total: 0, received: 0, pending: 0, failed: 0 },
    bookings: { total: 0, confirmed: 0, completed: 0, pending: 0, cancelled: 0 },
  });
  const [recentDonations, setRecentDonations] = useState<DonationRecord[]>([]);
  const [recentBookings, setRecentBookings] = useState<SevaBooking[]>([]);

  const dateRangeLabel = useMemo(() => {
    switch (dateRange) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "quarter": return "This Quarter";
      case "year": return "This Year";
      case "custom": return `${customStart} to ${customEnd}`;
      default: return "This Month";
    }
  }, [dateRange, customStart, customEnd]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "custom":
        startDate = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = customEnd ? new Date(customEnd) : now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange();

        const [donations, bookings] = await Promise.all([
          donationService.getDonations(),
          sevaBookingService.getAllBookings(),
        ]);

        // Filter by date range
        const filteredDonations = donations.filter((d: DonationRecord) => {
          const date = new Date(d.createdAt);
          return date >= startDate && date <= endDate;
        });

        const filteredBookings = bookings.filter((b: SevaBooking) => {
          const date = new Date(b.createdAt);
          return date >= startDate && date <= endDate;
        });

        // Calculate summary
        const donationRevenue = filteredDonations
          .filter((d: DonationRecord) => d.status === "received")
          .reduce((sum: number, d: DonationRecord) => sum + (d.amount || 0), 0);

        const sevaRevenue = filteredBookings
          .filter((b: SevaBooking) => b.status === "completed" || b.status === "confirmed")
          .reduce((sum: number, b: SevaBooking) => sum + (b.sevaAmount || 0), 0);

        setSummary({
          revenue: {
            donationRevenue,
            sevaRevenue,
            totalRevenue: donationRevenue + sevaRevenue,
          },
          donations: {
            total: filteredDonations.length,
            received: filteredDonations.filter((d: DonationRecord) => d.status === "received").length,
            pending: filteredDonations.filter((d: DonationRecord) => d.status === "pending").length,
            failed: filteredDonations.filter((d: DonationRecord) => d.status === "failed").length,
          },
          bookings: {
            total: filteredBookings.length,
            confirmed: filteredBookings.filter((b: SevaBooking) => b.status === "confirmed").length,
            completed: filteredBookings.filter((b: SevaBooking) => b.status === "completed").length,
            pending: filteredBookings.filter((b: SevaBooking) => b.status === "pending").length,
            cancelled: filteredBookings.filter((b: SevaBooking) => b.status === "cancelled").length,
          },
        });

        setRecentDonations(filteredDonations.slice(0, 10));
        setRecentBookings(filteredBookings.slice(0, 10));
      } catch (error) {
        console.error("Failed to load reports:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [dateRange, customStart, customEnd]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Reports & Analytics"
        description="Overview of temple revenue and activity."
      />

      {/* Date Filter & Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-5 w-5 text-stone-400" />
          
          <div className="flex rounded-lg border bg-white p-1">
            {(["today", "week", "month", "quarter", "year"] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateRange === range
                    ? "bg-amber-600 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setDateRange("custom"); setCustomStart(e.target.value); }}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
              placeholder="Start date"
            />
            <span className="text-stone-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setDateRange("custom"); setCustomEnd(e.target.value); }}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
              placeholder="End date"
            />
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 print:hidden"
        >
          <Printer className="h-4 w-4" />
          Print Report
        </button>
      </div>

      {/* Date Range Display */}
      <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Showing data for: <strong>{dateRangeLabel}</strong>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Revenue Cards */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <ReportCard
              title="Donation Revenue"
              value={`₹${summary.revenue.donationRevenue.toLocaleString()}`}
              icon={<HeartHandshake size={28} />}
            />

            <ReportCard
              title="Seva Revenue"
              value={`₹${summary.revenue.sevaRevenue.toLocaleString()}`}
              icon={<BookOpen size={28} />}
            />

            <ReportCard
              title="Total Revenue"
              value={`₹${summary.revenue.totalRevenue.toLocaleString()}`}
              icon={<HandCoins size={28} />}
            />
          </div>

          {/* Summary Cards */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-xl font-semibold">
                Donation Summary ({summary.donations.total})
              </h2>

              <div className="space-y-3">
                <SummaryRow
                  label="Received"
                  value={summary.donations.received}
                  color="green"
                />
                <SummaryRow
                  label="Pending"
                  value={summary.donations.pending}
                  color="yellow"
                />
                <SummaryRow
                  label="Failed"
                  value={summary.donations.failed}
                  color="red"
                />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-xl font-semibold">
                Booking Summary ({summary.bookings.total})
              </h2>

              <div className="space-y-3">
                <SummaryRow
                  label="Confirmed"
                  value={summary.bookings.confirmed}
                  color="blue"
                />
                <SummaryRow
                  label="Completed"
                  value={summary.bookings.completed}
                  color="green"
                />
                <SummaryRow
                  label="Pending"
                  value={summary.bookings.pending}
                  color="yellow"
                />
                <SummaryRow
                  label="Cancelled"
                  value={summary.bookings.cancelled}
                  color="red"
                />
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-xl font-semibold">Recent Donations</h2>
              {recentDonations.length === 0 ? (
                <p className="text-stone-500">No donations in this period</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentDonations.map((donation) => (
                    <div key={donation.id} className="flex items-center justify-between border-b py-2 last:border-none">
                      <div>
                        <p className="font-medium text-stone-900">{donation.donorName}</p>
                        <p className="text-sm text-stone-500">{donation.purpose || "General"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-600">₹{donation.amount?.toLocaleString()}</p>
                        <StatusBadge status={donation.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-xl font-semibold">Recent Bookings</h2>
              {recentBookings.length === 0 ? (
                <p className="text-stone-500">No bookings in this period</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between border-b py-2 last:border-none">
                      <div>
                        <p className="font-medium text-stone-900">{booking.userName}</p>
                        <p className="text-sm text-stone-500">{booking.sevaTitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-600">₹{booking.sevaAmount?.toLocaleString()}</p>
                        <StatusBadge status={booking.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AdminAuthGuard requiredPermission="admin">
      <ReportsPageContent />
    </AdminAuthGuard>
  );
}

function SummaryRow({
  label,
  value,
  color = "stone",
}: {
  label: string;
  value: number;
  color?: "stone" | "green" | "yellow" | "red" | "blue";
}) {
  const colorClasses = {
    stone: "text-stone-900",
    green: "text-green-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };

  return (
    <div className="flex items-center justify-between border-b py-2 last:border-none">
      <span className="text-stone-600">{label}</span>
      <span className={`font-semibold ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    received: "bg-green-100 text-green-800",
    confirmed: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${statusColors[status] || "bg-stone-100 text-stone-800"}`}>
      {status}
    </span>
  );
}
