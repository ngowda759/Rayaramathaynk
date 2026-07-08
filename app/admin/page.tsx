"use client";

import { useEffect, useState } from "react";
import { 
  Bell, HeartHandshake, Image, Plus, CalendarDays, 
  BookOpen, Clock, Users, HandCoins, Book
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  totalSevas: number;
  totalGalleryImages: number;
  totalAnnouncements: number;
  totalTimings: number;
  totalDonations: number;
  totalSevaBookings: number;
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: any }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm text-stone-500">{title}</p>
      </div>
      <p className="text-3xl font-bold text-stone-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { dashboardService } = await import("@/services/dashboard.service");
        const data = await dashboardService.getStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hour = today.getHours();
  let greeting = "Good Evening";
  if (hour < 12) greeting = "Good Morning";
  else if (hour < 17) greeting = "Good Afternoon";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-orange-500 to-amber-500 p-6 md:p-8 text-white shadow-lg w-full">
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">
            {greeting}, Administrator 👋
          </h1>
          <div className="flex items-center gap-2 text-orange-100">
            <CalendarDays className="h-5 w-5" />
            <span>{formattedDate}</span>
          </div>
          <p className="pt-2 text-orange-50">
            Welcome back to the Temple Administration Portal.
          </p>
        </div>
        <div className="absolute right-4 md:right-6 top-4 md:top-6 text-6xl md:text-8xl opacity-10">
          🏛
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
        </div>
      ) : stats ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Users" value={stats.totalUsers} icon={Users} />
          <StatCard title="Events" value={stats.totalEvents} icon={CalendarDays} />
          <StatCard title="Sevas" value={stats.totalSevas} icon={BookOpen} />
          <StatCard title="Gallery" value={stats.totalGalleryImages} icon={Image} />
          <StatCard title="Announcements" value={stats.totalAnnouncements} icon={Bell} />
          <StatCard title="Temple Timings" value={stats.totalTimings} icon={Clock} />
          <StatCard title="Donations" value={stats.totalDonations} icon={HeartHandshake} />
          <StatCard title="Bookings" value={stats.totalSevaBookings} icon={HandCoins} />
        </div>
      ) : (
        <div className="rounded-2xl border bg-red-50 p-6 text-center text-red-600">
          Failed to load statistics. Please refresh.
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <a href="/admin/events" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted transition-colors">
            <Plus className="h-5 w-5 text-amber-600" />
            <span>Add Event</span>
          </a>
          <a href="/admin/gallery" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted transition-colors">
            <Image className="h-5 w-5 text-amber-600" />
            <span>Upload Gallery</span>
          </a>
          <a href="/admin/announcements" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted transition-colors">
            <Bell className="h-5 w-5 text-amber-600" />
            <span>Announcements</span>
          </a>
          <a href="/admin/donations" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted transition-colors">
            <HeartHandshake className="h-5 w-5 text-amber-600" />
            <span>Donations</span>
          </a>
        </div>
      </div>
    </div>
  );
}
