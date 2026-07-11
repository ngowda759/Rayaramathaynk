"use client";

import { useEffect, useState } from "react";
import { sevaBookingService } from "@/services/sevaBooking.service";
import { SevaBooking } from "@/types/seva-booking";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import Button from "@/components/ui/button";

export default function AdminSevasPage() {
  const [bookings, setBookings] = useState<SevaBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true);
        const data = await sevaBookingService.getAllBookings();
        setBookings(data);
      } catch (error) {
        console.error("Failed to load seva bookings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);

  const filteredBookings = bookings.filter((booking) => {
    const keyword = search.toLowerCase();
    return (
      booking.sevaTitle.toLowerCase().includes(keyword) ||
      booking.userName.toLowerCase().includes(keyword) ||
      booking.userEmail.toLowerCase().includes(keyword) ||
      booking.status.toLowerCase().includes(keyword)
    );
  });

  async function updateBookingStatus(
    bookingId: string,
    status: SevaBooking["status"]
  ) {
    try {
      setUpdatingBookingId(bookingId);
      await sevaBookingService.updateBookingStatus(bookingId, status);
      const data = await sevaBookingService.getAllBookings();
      setBookings(data);
    } catch (error) {
      console.error("Failed to update booking status:", error);
    } finally {
      setUpdatingBookingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Special Sevas"
        description="View and manage online seva booking requests."
      />

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Seva Bookings
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Online seva booking requests submitted by devotees.
            </p>
          </div>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search seva bookings..."
          />
        </div>

        {loading ? (
          <div className="mt-8 text-stone-500">Loading bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="mt-8 text-stone-500">
            No seva bookings found.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-3xl border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50 text-left text-sm uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Devotee</th>
                  <th className="px-4 py-3">Seva</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Preferred Date</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white text-sm text-stone-700">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-stone-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-stone-900">
                        {booking.userName}
                      </div>
                      <div className="text-xs text-stone-500">
                        {booking.userEmail}
                      </div>
                      {booking.userPhone && (
                        <div className="text-xs text-stone-400">
                          {booking.userPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium">{booking.sevaTitle}</div>
                      {booking.notes && (
                        <div className="text-xs text-stone-500 max-w-[200px] truncate" title={booking.notes}>
                          {booking.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 font-medium">₹{booking.sevaAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4 text-stone-500">{booking.preferredDate}</td>
                    <td className="px-4 py-4">
                      {booking.paymentStatus === "completed" ? (
                        <div>
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                            Paid
                          </span>
                          {booking.paymentReference && (
                            <div className="text-xs text-stone-500 mt-1 font-mono" title={booking.paymentReference}>
                              {booking.paymentReference.slice(0, 15)}...
                            </div>
                          )}
                        </div>
                      ) : booking.paymentStatus === "failed" ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          Pending
                        </span>
                      )}
                      {booking.paymentMethod && (
                        <div className="text-xs text-stone-400 mt-1">{booking.paymentMethod}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        booking.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-700"
                          : booking.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : booking.status === "completed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {booking.status === "pending" ? (
                          <>
                            <Button
                              variant="secondary"
                              loading={updatingBookingId === booking.id}
                              onClick={() => updateBookingStatus(booking.id, "confirmed")}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="destructive"
                              loading={updatingBookingId === booking.id}
                              onClick={() => updateBookingStatus(booking.id, "cancelled")}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : booking.status === "confirmed" ? (
                          <Button
                            variant="primary"
                            loading={updatingBookingId === booking.id}
                            onClick={() => updateBookingStatus(booking.id, "completed")}
                          >
                            Complete
                          </Button>
                        ) : (
                          <span className="text-sm text-stone-500">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
