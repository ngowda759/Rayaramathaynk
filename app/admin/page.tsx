"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Bell, HeartHandshake, Image, Plus, CalendarDays, 
  BookOpen, Clock, Users, HandCoins, ArrowRight, Sparkles
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

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

function StatCard({ title, value, icon: Icon, loading, index }: { title: string; value: number; icon: LucideIcon; loading?: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative overflow-hidden rounded-3xl border border-amber-200/60 bg-white p-6 shadow-xl shadow-amber-500/5 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/15 hover:border-amber-300"
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 to-orange-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Decorative corner */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-100/40 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
        </div>
        {loading ? (
          <div className="h-10 w-20 rounded-xl skeleton-temple" />
        ) : (
          <p className="text-4xl font-bold text-stone-900 tracking-tight">{value}</p>
        )}
      </div>
    </motion.div>
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

async function fetchUsersCount(): Promise<number> {
  if (!db) return 0;
  try {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.size;
  } catch {
    return 0;
  }
}

export default function DashboardPage() {
  const { profile, normalizedRole } = useAuth();
  
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
        const [eventsCount, galleryAlbumsCount, announcementsCount, timingsCount, usersCount] = await Promise.all([
          fetchCollectionCount("events"),
          fetchCollectionCount("galleryAlbums"),
          fetchCollectionCount("announcements"),
          fetchCollectionCount("timings"),
          fetchUsersCount(),
        ]);

        setStats({
          totalUsers: usersCount,
          totalEvents: eventsCount,
          totalSevas: 0,
          totalGalleryImages: galleryAlbumsCount,
          totalAnnouncements: announcementsCount,
          totalTimings: timingsCount,
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

  const userName = profile?.name || "Admin";
  const roleDisplay = {
    super_admin: "Super Admin",
    admin: "Temple Admin",
    billing: "Billing Staff",
    volunteer: "Volunteer",
    devotee: "Devotee",
  }[normalizedRole] || "Admin";

  return (
    <div className="space-y-8">
      {/* Welcome Banner - Enhanced */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-amber-200/50 bg-gradient-to-r from-white via-amber-50/50 to-orange-50/30 p-6 shadow-lg shadow-amber-500/5"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-200/20 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-orange-200/20 to-transparent rounded-tr-full" />
        
        {/* Decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">
              {greeting}, {userName} 👋
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-stone-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formattedDate}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {roleDisplay}
              </span>
            </div>
          </div>
          
          {/* Quick View Website Button */}
          <Link 
            href="/" 
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-xl hover:scale-105"
          >
            <span>View Website</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Users" value={stats.totalUsers} icon={Users} loading={loading} index={0} />
        <StatCard title="Events" value={stats.totalEvents} icon={CalendarDays} loading={loading} index={1} />
        <StatCard title="Sevas" value={stats.totalSevas} icon={BookOpen} loading={loading} index={2} />
        <StatCard title="Gallery" value={stats.totalGalleryImages} icon={Image} loading={loading} index={3} />
        <StatCard title="Announcements" value={stats.totalAnnouncements} icon={Bell} loading={loading} index={4} />
        <StatCard title="Temple Timings" value={stats.totalTimings} icon={Clock} loading={loading} index={5} />
        <StatCard title="Donations" value={stats.totalDonations} icon={HeartHandshake} loading={loading} index={6} />
        <StatCard title="Bookings" value={stats.totalSevaBookings} icon={HandCoins} loading={loading} index={7} />
      </div>

      {/* Quick Actions - Enhanced */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative overflow-hidden rounded-[32px] border border-amber-200/50 bg-white p-8 shadow-xl shadow-amber-500/5"
      >
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-100/30 to-transparent rounded-bl-full" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Quick Actions</h2>
              <p className="text-sm text-stone-500">Common tasks at your fingertips</p>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { href: "/admin/events", icon: Plus, label: "Add Event", desc: "Create new events" },
              { href: "/admin/gallery", icon: Image, label: "Upload Gallery", desc: "Add images" },
              { href: "/admin/announcements", icon: Bell, label: "Announcements", desc: "Manage notices" },
              { href: "/admin/donations", icon: HeartHandshake, label: "Donations", desc: "View contributions" },
            ].map((action, i) => (
              <motion.a
                key={action.href}
                href={action.href}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                whileHover={{ y: -4 }}
                className="group relative flex items-center gap-4 rounded-2xl border border-amber-100/60 bg-gradient-to-br from-white to-amber-50/50 p-5 shadow-lg transition-all hover:border-amber-200 hover:shadow-xl hover:shadow-amber-500/10"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 shadow-md group-hover:scale-110 transition-transform">
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-800 group-hover:text-amber-700 transition-colors">{action.label}</p>
                  <p className="text-sm text-stone-500 truncate">{action.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-stone-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </motion.a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
