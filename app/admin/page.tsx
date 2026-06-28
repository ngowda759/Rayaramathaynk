"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardCard from "@/components/admin/DashboardCard";
import {
  CalendarDays,
  Image,
  HandCoins,
  Clock3,
  Bell,
} from "lucide-react";
import { eventService } from "@/services/event.service";
import { galleryService } from "@/services/gallery.service";
import { poojaService } from "@/services/pooja.service";

export default function AdminDashboard() {
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [galleryImages, setGalleryImages] = useState(0);
  const [todayPoojas, setTodayPoojas] = useState(0);

  useEffect(() => {
    async function loadDashboardCounts() {
      try {
        const [events, images, poojas] = await Promise.all([
          eventService.getEvents(),
          galleryService.getImages(),
          poojaService.getPoojas(),
        ]);

        setUpcomingEvents(
          events.filter((event) => event.status === "Upcoming").length
        );
        setGalleryImages(images.length);
        setTodayPoojas(poojas.filter((pooja) => pooja.isActive).length);
      } catch (error) {
        console.error("Failed to load dashboard counts:", error);
      }
    }

    loadDashboardCounts();
  }, []);

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
          value={upcomingEvents}
          icon={CalendarDays}
        />

        <DashboardCard
          title="Gallery Images"
          value={galleryImages}
          icon={Image}
        />

        <DashboardCard
          title="Today's Poojas"
          value={todayPoojas}
          icon={Clock3}
        />

        <Link href="/admin/assistant" className="block">
          <DashboardCard
            title="Admin Assistant"
            value="Open"
            icon={Bell}
          />
        </Link>
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
