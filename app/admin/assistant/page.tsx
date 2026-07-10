"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import AdminAssistant from "@/components/admin/common/AdminAssistant";
import { eventService } from "@/services/event.service";
import { galleryService } from "@/services/gallery.service";
import { poojaService } from "@/services/pooja.service";
import { sevaService } from "@/services/seva.service";
import { sevaBookingService } from "@/services/sevaBooking.service";
import { aaradhaneService } from "@/services/aaradhane.service";

type Recommendation = {
  title: string;
  description: string;
  href: string;
  action: string;
};

export default function AdminAssistantPage() {
  const [loading, setLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [featuredImages, setFeaturedImages] = useState(0);
  const [totalPoojas, setTotalPoojas] = useState(0);
  const [activePoojas, setActivePoojas] = useState(0);
  const [totalSevas, setTotalSevas] = useState(0);
  const [activeSevas, setActiveSevas] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [pendingBookings, setPendingBookings] = useState(0);
  const [completedBookings, setCompletedBookings] = useState(0);
  const [totalAaradhanes, setTotalAaradhanes] = useState(0);
  const [upcomingAaradhanes, setUpcomingAaradhanes] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, images, poojas, sevas, bookings, aaradhanes] = await Promise.all([
          eventService.getEvents().catch(() => []),
          galleryService.getImages().catch(() => []),
          poojaService.getPoojas().catch(() => []),
          sevaService.getAllSevas().catch(() => []),
          sevaBookingService.getAllBookings().catch(() => []),
          aaradhaneService.getAaradhanes().catch(() => []),
        ]);

        setTotalEvents(events.length);
        setUpcomingEvents(
          events.filter((event) => event.status === "Upcoming").length
        );

        const featuredCount = images.filter((image: any) => image.isFeatured).length;
        setTotalImages(images.length);
        setFeaturedImages(featuredCount);

        setTotalPoojas(poojas.length);
        setActivePoojas(poojas.filter((pooja: any) => pooja.isActive).length);

        setTotalSevas(sevas.length);
        setActiveSevas(sevas.filter((seva: any) => seva.active).length);

        setTotalBookings(bookings.length);
        setPendingBookings(bookings.filter((b: any) => b.status === "pending").length);
        setCompletedBookings(bookings.filter((b: any) => b.status === "completed" || b.status === "confirmed").length);

        setTotalAaradhanes(aaradhanes.length);
        setUpcomingAaradhanes(aaradhanes.filter((a: any) => a.isUpcoming).length);

        const recs: Recommendation[] = [];

        // Aaradhane recommendations
        if (aaradhanes.length === 0) {
          recs.push({
            title: "Add Aaradhane events",
            description: "No aaradhana configured. Add events for devotees.",
            href: "/admin/aaradhane",
            action: "Add Aaradhane",
          });
        }

        // Gallery recommendations
        if (images.length > 0 && featuredCount / images.length < 0.15) {
          recs.push({
            title: "Feature more gallery images",
            description: "Less than 15% of gallery items are marked as featured.",
            href: "/admin/gallery",
            action: "Review Gallery",
          });
        }

        // Event recommendations
        if (events.some((event: any) => event.status === "Upcoming" && !event.location)) {
          recs.push({
            title: "Complete upcoming event details",
            description: "Some upcoming events are missing location information.",
            href: "/admin/events",
            action: "Review Events",
          });
        }

        // Pooja recommendations
        if (poojas.some((pooja: any) => !pooja.notes)) {
          recs.push({
            title: "Add more pooja details",
            description: "Several pooja schedules do not include notes.",
            href: "/admin/pooja",
            action: "Review Poojas",
          });
        }

        // Booking recommendations
        const pendingCount = bookings.filter((b: any) => b.status === "pending").length;
        if (pendingCount > 5) {
          recs.push({
            title: "Review pending seva bookings",
            description: `You have ${pendingCount} pending booking requests to review.`,
            href: "/admin/bookings",
            action: "Review Bookings",
          });
        }

        // Seva recommendations
        if (sevas.length === 0) {
          recs.push({
            title: "Add special sevas",
            description: "No sevas configured. Add some for devotees to book.",
            href: "/admin/sevas",
            action: "Add Sevas",
          });
        }

        if (recs.length === 0) {
          recs.push({
            title: "All systems look healthy",
            description: "Your temple management is in great shape!",
            href: "/admin",
            action: "Go to Dashboard",
          });
        }

        setRecommendations(recs);
      } catch (error) {
        console.error("Error loading assistant data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Assistant"
        description="Get quick insights and recommended actions."
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border bg-white">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent"></div>
        </div>
      ) : (
        <AdminAssistant
          totalEvents={totalEvents}
          upcomingEvents={upcomingEvents}
          totalImages={totalImages}
          featuredImages={featuredImages}
          totalPoojas={totalPoojas}
          activePoojas={activePoojas}
          totalSevas={totalSevas}
          activeSevas={activeSevas}
          totalBookings={totalBookings}
          pendingBookings={pendingBookings}
          completedBookings={completedBookings}
          totalAaradhanes={totalAaradhanes}
          upcomingAaradhanes={upcomingAaradhanes}
          recommendations={recommendations}
        />
      )}
    </div>
  );
}
