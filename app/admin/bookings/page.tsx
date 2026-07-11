"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import { bookingColumns } from "./columns";
import { sevaBookingService } from "@/services/sevaBooking.service";
import {
  SevaBooking,
  SevaBookingStatus,
  PaymentStatus,
} from "@/types/seva-booking";
export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<
    SevaBooking[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<SevaBookingStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentStatus | "all">("all");
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const data =
        await sevaBookingService.getAllBookings();
      setBookings(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return bookings.filter((booking) => {
      const matchesSearch =
        !keyword ||
        [
          booking.sevaTitle,
          booking.userName,
          booking.userEmail,
          booking.userPhone,
          booking.paymentReference,
        ].some((value) =>
          value
            .toLowerCase()
            .includes(keyword)
        );
      const matchesStatus =
        statusFilter === "all" ||
        booking.status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" ||
        booking.paymentStatus === paymentFilter;
      return (
        matchesSearch && matchesStatus && matchesPayment
      );
    });
  }, [bookings, search, statusFilter, paymentFilter]);
  async function updateStatus(
    booking: SevaBooking,
    status: SevaBookingStatus
  ) {
    try {
      await sevaBookingService.updateBookingStatus(
        booking.id,
        status
      );
      toast.success("Status updated.");
      await loadBookings();
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to update status."
      );
    }
  }
  async function handleDelete(
    booking: SevaBooking
  ) {
    if (
      !window.confirm(
        `Delete booking for ${booking.userName}?`
      )
    ) {
      return;
    }
    try {
      await sevaBookingService.deleteBooking(
        booking.id
      );
      toast.success("Booking deleted.");
      await loadBookings();
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to delete booking."
      );
    }
  }
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Seva Bookings"
        description="Manage devotee bookings."
      />
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search bookings..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target
                .value as SevaBookingStatus | "all"
            )
          }
          className="rounded-xl border border-stone-300 bg-white px-4 py-3"
        >
          <option value="all">
            All Status
          </option>
          <option value="pending">
            Pending
          </option>
          <option value="confirmed">
            Confirmed
          </option>
          <option value="completed">
            Completed
          </option>
          <option value="cancelled">
            Cancelled
          </option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(
              e.target
                .value as PaymentStatus | "all"
            )
          }
          className="rounded-xl border border-stone-300 bg-white px-4 py-3"
        >
          <option value="all">
            All Payments
          </option>
          <option value="pending">
            Payment Pending
          </option>
          <option value="completed">
            Payment Done
          </option>
          <option value="failed">
            Payment Failed
          </option>
        </select>
      </div>
      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading bookings...
        </div>
      ) : (
        <CrudTable<SevaBooking>
          data={filteredBookings}
          columns={bookingColumns}
          emptyMessage="No bookings found."
          actions={{
            onView: (booking) =>
              router.push(
                `/admin/bookings/${booking.id}`
              ),
            onEdit: (booking) =>
              updateStatus(
                booking,
                "confirmed"
              ),
            onDelete: handleDelete,
          }}
        />
      )}
    </div>
  );
}
