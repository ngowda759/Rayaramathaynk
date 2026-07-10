import {
  Bell,
  BookOpen,
  CalendarDays,
  Clock,
  HandCoins,
  HeartHandshake,
  Image,
  Users,
} from "lucide-react";

import StatCard from "@/components/admin/common/StatCard";
import { DashboardStats } from "@/types/dashboard";

interface StatsGridProps {
  stats: DashboardStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Users" value={stats.totalUsers} icon={Users} />
      <StatCard title="Events" value={stats.totalEvents} icon={CalendarDays} />
      <StatCard title="Sevas" value={stats.totalSevas} icon={BookOpen} />
      <StatCard title="Gallery" value={stats.totalGalleryImages} icon={Image} />
      <StatCard title="Announcements" value={stats.totalAnnouncements} icon={Bell} />
      <StatCard title="Timings" value={stats.totalTimings} icon={Clock} />
      <StatCard title="Donations" value={stats.totalDonations} icon={HeartHandshake} />
      <StatCard title="Bookings" value={stats.totalSevaBookings} icon={HandCoins} />
    </div>
  );
}
