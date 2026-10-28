import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { sevaBookingService } from "@/services/sevaBooking.server";
import type { SevaBookingStatus, PaymentStatus } from "@/types/seva-booking";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const booking = await sevaBookingService.getBookingById(id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      status?: SevaBookingStatus;
      payment?: { paymentReference: string; paymentStatus: PaymentStatus; paymentMethod: string };
    };
    if (body.status) await sevaBookingService.updateBookingStatus(id, body.status);
    if (body.payment) await sevaBookingService.updatePayment(id, body.payment);
    return NextResponse.json({ message: "Booking updated" });
  } catch (error) {
    console.error("[bookings/:id] update failed:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
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
