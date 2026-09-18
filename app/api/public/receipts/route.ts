import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    if (!search || search.trim() === "") {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const searchQuery = search.trim();
    const supabase = await createClient();

    // The prompt says: "should use supabase existing db schema"
    // We're querying `seva_bookings`
    let query = supabase.from("seva_bookings").select("*");

    // Attempt to match against user_phone, user_email, firestore_id, or payment_reference
    query = query.or(`user_phone.ilike.*${searchQuery}*,user_email.ilike.*${searchQuery}*,firestore_id.ilike.*${searchQuery}*,payment_reference.ilike.*${searchQuery}*`);

    const { data: bookings, error } = await query
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[Public Receipts API] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to search receipts." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      receipts: bookings,
    });
  } catch (error) {
    console.error("[Public Receipts API] Error:", error);
    return NextResponse.json(
      { error: "Failed to search receipts." },
      { status: 500 }
    );
  }
}
