"use client";

import toast from "react-hot-toast";

import Button from "@/components/ui/button";

import {
  SevaBooking,
  SevaBookingStatus,
} from "@/types/seva-booking";

import { sevaBookingService } from "@/services/sevaBooking.service";

import BookingStatusBadge from "./BookingStatusBadge";

interface BookingDetailsProps {
  booking: SevaBooking;
}

export default function BookingDetails({
  booking,
}: BookingDetailsProps) {
  async function updateStatus(
    status: SevaBookingStatus
  ) {
    try {
      await sevaBookingService.updateBookingStatus(
        booking.id,
        status
      );

      toast.success("Booking updated.");

      window.location.reload();
    } catch {
      toast.error("Failed to update booking.");
    }
  }

  return (
    <div className="space-y-6 rounded-xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Booking Details
        </h2>

        <BookingStatusBadge
          status={booking.status}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Info
          label="Devotee"
          value={booking.userName}
        />

        <Info
          label="Email"
          value={booking.userEmail}
        />

        <Info
          label="Phone"
          value={booking.userPhone}
        />

        <Info
          label="Seva"
          value={booking.sevaTitle}
        />

        <Info
          label="Amount"
          value={`₹${booking.sevaAmount}`}
        />

        <Info
          label="Preferred Date"
          value={booking.preferredDate}
        />
      </div>

      <div>
        <h3 className="mb-2 font-medium">
          Notes
        </h3>

        <div className="rounded-lg border bg-stone-50 p-4">
          {booking.notes || "-"}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() =>
            updateStatus("confirmed")
          }
        >
          Confirm
        </Button>

        <Button
          onClick={() =>
            updateStatus("completed")
          }
        >
          Complete
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            updateStatus("cancelled")
          }
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div className="text-sm text-stone-500">
        {label}
      </div>

      <div className="font-medium">
        {value}
      </div>
    </div>
  );
}
