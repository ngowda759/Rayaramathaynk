import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { getAdminFirestore } from "@/lib/admin-firebase";

export const dynamic = "force-dynamic";

const RECEIPTS_COLLECTION = "receipts";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * GET /api/admin/receipts/[id]
 * Fetch a single receipt for an authorized admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  try {
    const { id } = await params;
    const db = await getAdminFirestore();
    const snap = await db.collection(RECEIPTS_COLLECTION).doc(id).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, receipt: { id: snap.id, ...snap.data() } });
  } catch (error) {
    console.error("[Admin Receipts API] Error fetching receipt:", error);
    return NextResponse.json({ error: "Failed to load receipt." }, { status: 500 });
  }
}