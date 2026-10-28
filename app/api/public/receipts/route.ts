/**
 * GET /api/public/receipts - the signed-in caller's own seva bookings.
 *
 * Requires a Firebase ID token (Authorization: Bearer). Returns at most 20 of the
 * caller's bookings, newest first, with only the fields a devotee needs to recognise a
 * booking - never phone, email, notes or payment references. Reads Supabase
 * `seva_bookings` through the service role, scoped to the verified token's uid; there
 * is no Firestore path. Plan B replaces this route with "My seva bookings".
 */
import { NextResponse } from "next/server";

import { verifyBearerIdToken } from "@/lib/auth/verify-id-token";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_RECEIPTS = 20;

interface PublicBookingRow {
  id: string;
  sevaTitle: string;
  preferredDate: string | null;
  status: string | null;
  paymentStatus: string | null;
  amount: number | null;
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
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("seva_bookings")
      .select("id, firestore_id, seva_title, preferred_date, status, payment_status, seva_amount")
      .eq("user_id", caller.uid)
      .order("created_at", { ascending: false })
      .limit(MAX_RECEIPTS);

    if (error) throw error;

    const receipts: PublicBookingRow[] = (data ?? []).map((row) => ({
      id: row.firestore_id || row.id,
      sevaTitle: row.seva_title ?? "",
      preferredDate: row.preferred_date ?? null,
      status: row.status ?? null,
      paymentStatus: row.payment_status ?? null,
      amount: typeof row.seva_amount === "number" ? row.seva_amount : null,
    }));

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error("[public-receipts] lookup failed:", error);
    return errorResponse("internal", "Could not load your receipts right now. Please try again.", 500);
  }
}
