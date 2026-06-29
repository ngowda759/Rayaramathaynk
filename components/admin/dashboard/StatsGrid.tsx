import {
  HeartHandshake,
  CalendarDays,
  Users,
  Image,
} from "lucide-react";

import StatCard from "@/components/admin/common/StatCard";
import { DashboardStats } from "@/types/dashboard";

interface StatsGridProps {
  stats: DashboardStats;
}

export default function StatsGrid({
  stats,
}: StatsGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Today's Donations"
        value={`₹${stats.donationsToday}`}
        icon={HeartHandshake}
      />

      <StatCard
        title="Upcoming Events"
        value={stats.upcomingEvents}
        icon={CalendarDays}
      />

      <StatCard
        title="Registered Users"
        value={stats.registeredUsers}
        icon={Users}
      />

      <StatCard
        title="Gallery Images"
        value={stats.galleryImages}
        icon={Image}
      />
    </div>
  );
}
