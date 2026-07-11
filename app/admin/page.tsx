"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: number; icon: LucideIcon; loading?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm text-stone-500">{title}</p>
      </div>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-stone-200" />
      ) : (
        <p className="text-3xl font-bold text-stone-900">{value}</p>
      )}
    </div>
  );
}

async function fetchCollectionCount(collectionName: string): Promise<number> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (!apiKey || !projectId) return 0;
  
  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?key=${apiKey}`
    );
    if (!response.ok) return 0;
    const data = await response.json();
    return data.documents?.length || 0;
  } catch {
    return 0;
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalEvents: 0,
    totalSevas: 0,
    totalGalleryImages: 0,
    totalAnnouncements: 0,
    totalTimings: 0,
    totalDonations: 0,
    totalSevaBookings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [eventsCount, galleryAlbumsCount, galleryMediaCount, announcementsCount] = await Promise.all([
          fetchCollectionCount("events"),
          fetchCollectionCount("galleryAlbums"),
          fetchCollectionCount("galleryMedia"),
          fetchCollectionCount("announcements"),
        ]);

        setStats({
          totalUsers: 0,
          totalEvents: eventsCount,
          totalSevas: 0,
          totalGalleryImages: galleryAlbumsCount,
          totalAnnouncements: announcementsCount,
          totalTimings: 0,
          totalDonations: 0,
          totalSevaBookings: 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
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
        <StatCard title="Users" value={stats.totalUsers} icon={Users} loading={loading} />
        <StatCard title="Events" value={stats.totalEvents} icon={CalendarDays} loading={loading} />
        <StatCard title="Sevas" value={stats.totalSevas} icon={BookOpen} loading={loading} />
        <StatCard title="Gallery" value={stats.totalGalleryImages} icon={Image} loading={loading} />
        <StatCard title="Announcements" value={stats.totalAnnouncements} icon={Bell} loading={loading} />
        <StatCard title="Temple Timings" value={stats.totalTimings} icon={Clock} loading={loading} />
        <StatCard title="Donations" value={stats.totalDonations} icon={HeartHandshake} loading={loading} />
        <StatCard title="Bookings" value={stats.totalSevaBookings} icon={HandCoins} loading={loading} />
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
