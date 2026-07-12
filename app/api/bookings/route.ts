import { NextRequest, NextResponse } from "next/server";
import { sevaBookingService } from "@/services/sevaBooking.service";

export async function GET() {
  try {
    const bookings = await sevaBookingService.getAllBookings();
    return NextResponse.json(bookings);
  } catch (error) {
    console.error("[API] Error fetching bookings:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation
    if (!body.sevaId) {
      return NextResponse.json({ error: "Seva ID is required" }, { status: 400 });
    }
    if (!body.preferredDate) {
      return NextResponse.json({ error: "Preferred date is required" }, { status: 400 });
    }
    
    // Check for past date
    const selectedDate = new Date(body.preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return NextResponse.json({ error: "Cannot book for past dates" }, { status: 400 });
    }
    
    const bookingId = await sevaBookingService.createBooking(body);
    return NextResponse.json({ id: bookingId, message: "Booking created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating booking:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
