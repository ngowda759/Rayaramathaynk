/**
 * GET /api/public/receipts - the signed-in caller's own seva bookings.
 *
 * Requires a Firebase ID token (Authorization: Bearer). Returns at most 20 of the caller's bookings, newest first,
 * with only the fields a devotee needs to recognise a booking - never phone, email, notes or payment references.
 * Any ?search= parameter from older clients is ignored. Plan B replaces this route with "My seva bookings".
 */
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";

export const dynamic = "force-dynamic";

const BOOKINGS_COLLECTION = "sevaBookings";
const OWNER_FIELD = "userId";
const MAX_RECEIPTS = 20;

interface PublicBookingRow {
  id: string;
  sevaTitle: string;
  preferredDate: string | null;
  status: string | null;
  paymentStatus: string | null;
  amount: number | null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function toRow(id: string, data: Record<string, unknown>): PublicBookingRow {
  return {
    id,
    sevaTitle: typeof data.sevaTitle === "string" ? data.sevaTitle : "",
    preferredDate: textOrNull(data.preferredDate),
    status: textOrNull(data.status),
    paymentStatus: textOrNull(data.paymentStatus),
    amount: typeof data.sevaAmount === "number" && Number.isFinite(data.sevaAmount) ? data.sevaAmount : null,
  };
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const caller = await verifyBearerIdToken(request);
  if (!caller) {
    return errorResponse("unauthenticated", "Please sign in to see your seva receipts.", 401);
  }

  try {
    const db = await getAdminFirestore();
    const snapshot = await db
      .collection(BOOKINGS_COLLECTION)
      .where(OWNER_FIELD, "==", caller.uid)
      .orderBy("createdAt", "desc")
      .limit(MAX_RECEIPTS)
      .get();

    const receipts = snapshot.docs.map((doc) => toRow(doc.id, doc.data()));
    return NextResponse.json({ receipts });
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    console.error(
      "[public-receipts] lookup failed:",
      typeof code === "string" || typeof code === "number" ? code : "no_code"
    );
    return errorResponse("internal", "Could not load your receipts right now. Please try again.", 500);
  }
}
