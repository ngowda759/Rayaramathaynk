"use client";

import Link from "next/link";
import { 
  Bell, HeartHandshake, Image, Plus, CalendarDays, 
  BookOpen, Clock, Users, HandCoins
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

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

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: LucideIcon }) {
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
  // Static stats - update when database is connected
  const stats: DashboardStats = {
    totalUsers: 0,
    totalEvents: 0,
    totalSevas: 0,
    totalGalleryImages: 0,
    totalAnnouncements: 0,
    totalTimings: 0,
    totalDonations: 0,
    totalSevaBookings: 0,
  };

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
    <div className="space-y-6">
      {/* Welcome Banner - Compact */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-stone-800">
              {greeting}, Admin 👋
            </h1>
            <p className="text-sm text-stone-500 flex items-center gap-2 mt-1">
              <CalendarDays className="h-4 w-4" />
              {formattedDate}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
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
          <Link href="/admin/donations" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted transition-colors">
            <HeartHandshake className="h-5 w-5 text-amber-600" />
            <span>Donations</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
