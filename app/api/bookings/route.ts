import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { sevaBookingService } from "@/services/sevaBooking.server";
import type { SevaBookingRequest } from "@/types/seva-booking";

/**
 * POST /api/bookings - public devotee booking submission.
 * GET  /api/bookings?user=<uid> - the signed-in devotee's own bookings.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SevaBookingRequest;
    if (!body?.sevaId) {
      return NextResponse.json({ error: "Seva ID is required" }, { status: 400 });
    }
    if (!body.preferredDate) {
      return NextResponse.json({ error: "Preferred date is required" }, { status: 400 });
    }

    const selectedDate = new Date(body.preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return NextResponse.json({ error: "Cannot book for past dates" }, { status: 400 });
    }

    const id = await sevaBookingService.createBooking(body);
    return NextResponse.json({ id, message: "Booking created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[bookings] create failed:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // The booking list carries devotee contact details, so it is scoped to the
  // authenticated caller's own bookings.
  const caller = await verifyBearerIdToken(request);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sevaBookingService.getBookingsByUser(caller.uid));
  } catch (error) {
    console.error("[bookings] read failed:", error);
    return NextResponse.json({ error: "Failed to read bookings" }, { status: 500 });
  }
}
