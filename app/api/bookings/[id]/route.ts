import { NextRequest, NextResponse } from "next/server";
import { sevaBookingService } from "@/services/sevaBooking.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await sevaBookingService.getBookingById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json(booking);
  } catch (error) {
    console.error("[API] Error fetching booking:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await sevaBookingService.deleteBooking(id);
    return NextResponse.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting booking:", error);
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (body.status) {
      await sevaBookingService.updateBookingStatus(id, body.status);
    }
    if (body.payment) {
      await sevaBookingService.updatePayment(id, body.payment);
    }
    
    return NextResponse.json({ message: "Booking updated successfully" });
  } catch (error) {
    console.error("[API] Error updating booking:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
