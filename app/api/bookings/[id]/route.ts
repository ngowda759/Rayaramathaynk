import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { bookingAdminUpdateSchema, bookingSelfPaymentSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { sevaBookingService } from "@/services/sevaBooking.server";

/**
 * GET    /api/bookings/[id] - read a booking (its owner, or an admin).
 * PATCH  /api/bookings/[id] - an admin may change status/payment; a devotee may
 *                             only record their own payment reference.
 * DELETE /api/bookings/[id] - delete a booking (admin only).
 *
 * Ownership is checked against the verified token's uid, never a value from the
 * request, so one devotee cannot read, pay for or delete another's booking. A
 * devotee's self-service PATCH cannot set an arbitrary status - only the payment
 * sub-object is accepted, and the service derives the resulting status from it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminUser(request);
  if (!admin.ok) {
    const caller = await verifyBearerIdToken(request);
    if (!caller) return admin.response;
    const booking = await sevaBookingService.getBookingById(id);
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.userId !== caller.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(booking);
  }
  const booking = await sevaBookingService.getBookingById(id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminUser(request);

  if (admin.ok) {
    const parsed = await parseJsonBody(request, bookingAdminUpdateSchema);
    if (!parsed.ok) return parsed.response;
    try {
      if (parsed.data.status) await sevaBookingService.updateBookingStatus(id, parsed.data.status);
      if (parsed.data.payment) await sevaBookingService.updatePayment(id, parsed.data.payment);
      return NextResponse.json({ message: "Booking updated" });
    } catch (error) {
      console.error("[bookings/:id] update failed:", error);
      return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
    }
  }

  // Not an admin: allow the booking's own devotee to record a payment reference.
  const caller = await verifyBearerIdToken(request);
  if (!caller) return admin.response;

  if (!allowPublicWrite(request, { scope: "bookings:pay", identity: caller.uid, limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, bookingSelfPaymentSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const booking = await sevaBookingService.getBookingById(id);
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.userId !== caller.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await sevaBookingService.updatePayment(id, {
      paymentReference: parsed.data.payment.paymentReference,
      paymentStatus: "completed",
      paymentMethod: parsed.data.payment.paymentMethod,
    });
    return NextResponse.json({ message: "Payment recorded" });
  } catch (error) {
    console.error("[bookings/:id] self-service payment failed:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await sevaBookingService.deleteBooking(id);
    return NextResponse.json({ message: "Booking deleted" });
  } catch (error) {
    console.error("[bookings/:id] delete failed:", error);
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}
