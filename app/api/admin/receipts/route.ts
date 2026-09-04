import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { createReceiptWithAdmin } from "@/lib/receipt/admin";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { ReceiptCreateInput } from "@/types/receipt";

export const dynamic = "force-dynamic";

const RECEIPTS_COLLECTION = "receipts";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * GET /api/admin/receipts
 * List receipts (newest first) for authorized admins.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  try {
    const db = await getAdminFirestore();
    const snapshot = await db
      .collection(RECEIPTS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const receipts = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data };
    });

    return NextResponse.json({ success: true, receipts, count: receipts.length });
  } catch (error) {
    console.error("[Admin Receipts API] Error listing receipts:", error);
    return NextResponse.json({ error: "Failed to load receipts." }, { status: 500 });
  }
}

/**
 * POST /api/admin/receipts
 * Create a receipt as an authorized admin. The receipt number is allocated
 * server-side in a transaction and totals are recomputed server-side from
 * the current seva catalogue (historical snapshot store der inside the item).
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  let body: ReceiptCreateInput;
  try {
    body = (await request.json() as ReceiptCreateInput);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await createReceiptWithAdmin(body, admin);
    return NextResponse.json(
      { success: true, id: result.id, receiptNumber: result.receiptNumber, message: "Receipt created successfully" },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Invalid receipt:") || message.startsWith("Unknown seva") || message.startsWith("Seva is disabled") || message.startsWith("Seva has invalid amount") || message === "Invalid seva quantity." || message === "At least one seva is required.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[Admin Receipts API] Error creating receipt:", error);
    return NextResponse.json({ error: "Failed to create receipt." }, { status: 500 });
  }
}