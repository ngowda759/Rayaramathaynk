import {
  BookOpen,
  HandCoins,
  HeartHandshake,
} from "lucide-react";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import ReportCard from "@/components/admin/reports/ReportCard";

import { reportService } from "@/services/report.service";

export default async function ReportsPage() {
  const summary =
    await reportService.getSummary();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Reports & Analytics"
        description="Overview of temple revenue and activity."
      />

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Donation Summary
          </h2>

          <div className="space-y-3">
            <SummaryRow
              label="Total Donations"
              value={summary.donations.total}
            />

            <SummaryRow
              label="Received"
              value={summary.donations.received}
            />

            <SummaryRow
              label="Pending"
              value={summary.donations.pending}
            />

            <SummaryRow
              label="Failed"
              value={summary.donations.failed}
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Booking Summary
          </h2>

          <div className="space-y-3">
            <SummaryRow
              label="Total Bookings"
              value={summary.bookings.total}
            />

            <SummaryRow
              label="Confirmed"
              value={summary.bookings.confirmed}
            />

            <SummaryRow
              label="Completed"
              value={summary.bookings.completed}
            />

            <SummaryRow
              label="Pending"
              value={summary.bookings.pending}
            />

            <SummaryRow
              label="Cancelled"
              value={summary.bookings.cancelled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-none">
      <span className="text-stone-600">
        {label}
      </span>

      <span className="font-semibold">
        {value}
      </span>
    </div>
  );
}
