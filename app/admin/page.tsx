import DashboardCard from "@/components/admin/DashboardCard";
import {
  CalendarDays,
  Image,
  HandCoins,
  Clock3,
} from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-stone-800">
          Dashboard
        </h1>

        <p className="mt-2 text-stone-500">
          Welcome to the Sri Raghavendra Swamy Temple Admin Portal.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Upcoming Events"
          value={8}
          icon={CalendarDays}
        />

        <DashboardCard
          title="Gallery Images"
          value={124}
          icon={Image}
        />

        <DashboardCard
          title="Today's Poojas"
          value={5}
          icon={Clock3}
        />

        <DashboardCard
          title="Donations"
          value="₹1,25,000"
          icon={HandCoins}
        />
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">
          Recent Activity
        </h2>

        <p className="mt-4 text-stone-500">
          Firebase integration will display recent events,
          donations, gallery uploads and announcements here.
        </p>
      </div>
    </div>
  );
}
