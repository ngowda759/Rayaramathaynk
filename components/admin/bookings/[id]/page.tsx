"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import BookingDetails from "@/components/admin/bookings/BookingDetails";

import { sevaBookingService } from "@/services/sevaBooking.service";
import { SevaBooking } from "@/types/seva-booking";

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [booking, setBooking] =
    useState<SevaBooking | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadBooking() {
      try {
        const data =
          await sevaBookingService.getBookingById(
            id
          );

        if (!data) {
          toast.error("Booking not found.");

          router.push("/admin/bookings");
          return;
        }

        setBooking(data);
      } catch (error) {
        console.error(error);

        toast.error(
          "Failed to load booking."
        );

        router.push("/admin/bookings");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadBooking();
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Booking Details"
          description="Loading booking..."
        />

        <div className="rounded-xl border bg-white p-8">
          Loading booking...
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Booking Details"
        description="View and manage seva booking."
      />

      <BookingDetails booking={booking} />
    </div>
  );
}
