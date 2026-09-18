import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/admin-firebase";

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

    const searchQuery = search.trim().toLowerCase();
    const db = await getAdminFirestore();
    const receiptsRef = db.collection("sevaBookings");

    // Firestore does not support OR queries across multiple fields with substring matching well in older SDKs.
    // However, since it's an admin API, we can fetch all and filter in memory if the dataset is small,
    // OR we can do multiple queries if it's exact match, but this search might be partial.
    // The previous implementation used ilike (substring).
    // To replicate ilike on Firestore, we need to fetch all and filter, or fetch recent and filter.
    // Let's fetch the most recent 1000 and filter in memory, taking the top 20 matches.
    const snapshot = await receiptsRef.orderBy("createdAt", "desc").limit(1000).get();

    const matchedBookings = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userPhone = String(data.userPhone || "");
      const userEmail = String(data.userEmail || "");
      const paymentReference = String(data.paymentReference || "");
      const firestoreId = doc.id;

      const phoneMatch = userPhone.toLowerCase().includes(searchQuery);
      const emailMatch = userEmail.toLowerCase().includes(searchQuery);
      const idMatch = firestoreId.toLowerCase().includes(searchQuery);
      const refMatch = paymentReference.toLowerCase().includes(searchQuery);

      if (phoneMatch || emailMatch || idMatch || refMatch) {
        matchedBookings.push({
          id: doc.id,
          firestore_id: doc.id,
          seva_id: data.sevaId,
          seva_title: data.sevaTitle,
          seva_amount: data.sevaAmount,
          user_id: data.userId,
          user_name: data.userName,
          user_email: userEmail,
          user_phone: userPhone,
          preferred_date: data.preferredDate,
          notes: data.notes,
          status: data.status,
          payment_reference: paymentReference,
          payment_status: data.paymentStatus,
          payment_date: data.paymentDate,
          payment_method: data.paymentMethod,
          created_at: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updated_at: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        });
      }

      if (matchedBookings.length >= 20) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      receipts: matchedBookings,
    });
  } catch (error) {
    console.error("[Public Receipts API] Error:", error);
    return NextResponse.json(
      { error: "Failed to search receipts." },
      { status: 500 }
    );
  }
}
