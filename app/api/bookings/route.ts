import { NextRequest, NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { allowPublicWrite } from "@/lib/api/public-rate-limit";
import { bookingCreateSchema } from "@/lib/validation/public-submissions";
import { parseJsonBody } from "@/lib/validation/http";
import { sevaBookingService, SevaBookingError } from "@/services/sevaBooking.server";

/**
 * POST /api/bookings - public devotee booking submission.
 * GET  /api/bookings - the signed-in devotee's own bookings.
 *
 * The booking owner is always derived from the verified ID token when one is sent;
 * a caller-supplied `userId` is never trusted, so nobody can file a booking under
 * another devotee's account. Anonymous submissions are recorded under the reserved
 * "anonymous" key (the booking form asks a devotee to sign in, but the route does
 * not require it).
 *
 * The seva's title and price are resolved server-side from `sevas`; the client's
 * `sevaTitle`/`sevaAmount` are advisory and cannot change what is stored.
 */
export async function POST(request: NextRequest) {
  if (!allowPublicWrite(request, { scope: "bookings:create", limit: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, bookingCreateSchema);
  if (!parsed.ok) return parsed.response;

  const preferredDate = new Date(parsed.data.preferredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preferredDate < today) {
    return NextResponse.json({ error: "Cannot book for past dates" }, { status: 400 });
  }

  const caller = await verifyBearerIdToken(request);
  const data = parsed.data;

  try {
    const id = await sevaBookingService.createBooking({
      sevaId: data.sevaId,
      // Advisory only: the service stores the seva's own title and price.
      sevaTitle: data.sevaTitle,
      sevaAmount: data.sevaAmount,
      userId: caller?.uid ?? "anonymous",
      userName: data.userName,
      userEmail: data.userEmail || caller?.email || "",
      userPhone: data.userPhone,
      gotra: data.gotra,
      nakshatra: data.nakshatra,
      raashi: data.raashi,
      preferredDate: data.preferredDate,
      notes: data.notes,
    });
    return NextResponse.json({ id, message: "Booking created successfully" }, { status: 201 });
  } catch (error) {
    if (error instanceof SevaBookingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
