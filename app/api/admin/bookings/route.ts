import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { sevaBookingService } from "@/services/sevaBooking.server";

/** Admin seva booking list. `seva_bookings` is deny-all under RLS. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await sevaBookingService.getAllBookings());
  } catch (error) {
    console.error("[admin/bookings] read failed:", error);
    return NextResponse.json({ error: "Failed to read bookings" }, { status: 500 });
  }
}
