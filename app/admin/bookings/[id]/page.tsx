"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle, XCircle, User, Phone, Mail, CreditCard, Check } from "lucide-react";
import toast from "react-hot-toast";
import { sevaBookingService } from "@/services/sevaBooking.service";
import { SevaBooking, SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";
import Button from "@/components/ui/button";

const statusConfig: Record<SevaBookingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800", icon: <CheckCircle className="h-4 w-4" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> },
};

const paymentStatusConfig: Record<PaymentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> },
  completed: { label: "Paid", color: "bg-green-100 text-green-800", icon: <Check className="h-4 w-4" /> },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> },
};

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<SevaBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadBooking() {
      if (!params.id) return;
      
      try {
        const data = await sevaBookingService.getBookingById(params.id as string);
        setBooking(data);
      } catch (error) {
        console.error("Failed to load booking:", error);
        toast.error("Failed to load booking");
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [params.id]);

  async function updateStatus(status: SevaBookingStatus) {
    if (!booking) return;
    
    setUpdating(true);
    try {
      await sevaBookingService.updateBookingStatus(booking.id, status);
      toast.success(`Booking marked as ${status}`);
      setBooking({ ...booking, status });
    } catch (error) {
      console.error("Failed to update:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-stone-500">Booking not found</p>
        <Link href="/admin/bookings" className="mt-4 inline-block text-amber-600 hover:underline">
          Back to Bookings
        </Link>
      </div>
    );
  }

  const status = statusConfig[booking.status as SevaBookingStatus] || statusConfig.pending;
  const paymentStatus = paymentStatusConfig[booking.paymentStatus as PaymentStatus] || paymentStatusConfig.pending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 hover:bg-stone-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Booking Details</h1>
          <p className="text-sm text-stone-500">View and manage this booking</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Booking Information</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${status.color}`}>
                  {status.icon}
                  {status.label}
                </span>
              </div>
              <span className="text-sm text-stone-400">
                {new Date(booking.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-stone-500">Seva</p>
              <p className="text-lg font-semibold text-stone-900">{booking.sevaTitle}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                ₹{booking.sevaAmount.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-stone-500">Preferred Date</p>
              <p className="font-medium text-stone-900">{booking.preferredDate || "Not specified"}</p>
            </div>

            {booking.notes && (
              <div>
                <p className="text-sm text-stone-500">Notes</p>
                <p className="text-stone-700">{booking.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Devotee Information</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <User className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-stone-900">{booking.userName}</p>
                  <p className="text-sm text-stone-500">Devotee</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-stone-400" />
                <span className="text-stone-700">{booking.userEmail}</span>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-stone-400" />
                <span className="text-stone-700">{booking.userPhone || "Not provided"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Payment Information</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Payment Status</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${paymentStatus.color}`}>
                  {paymentStatus.icon}
                  {paymentStatus.label}
                </span>
              </div>

              {booking.paymentMethod && (
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-stone-400" />
                  <span className="text-stone-700">{booking.paymentMethod}</span>
                </div>
              )}

              {booking.paymentReference ? (
                <div>
                  <p className="text-sm text-stone-500">Transaction ID / Reference</p>
                  <p className="font-mono text-sm text-stone-900 bg-stone-50 px-3 py-2 rounded-lg mt-1">
                    {booking.paymentReference}
                  </p>
                </div>
              ) : (
                <div className="text-sm text-stone-400 italic">
                  No payment reference provided
                </div>
              )}

              {booking.paymentDate && (
                <div>
                  <p className="text-sm text-stone-500">Payment Date</p>
                  <p className="font-medium text-stone-900">
                    {new Date(booking.paymentDate).toLocaleDateString()} {new Date(booking.paymentDate).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Update Status</h2>
        
        <div className="flex flex-wrap gap-3">
          {booking.status !== "confirmed" && (
            <Button
              onClick={() => updateStatus("confirmed")}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm
            </Button>
          )}
          {booking.status !== "completed" && (
            <Button
              onClick={() => updateStatus("completed")}
              disabled={updating}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Completed
            </Button>
          )}
          {booking.status !== "cancelled" && (
            <Button
              onClick={() => updateStatus("cancelled")}
              disabled={updating}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
