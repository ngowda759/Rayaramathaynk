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
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sevaId = url.searchParams.get("sevaId");
    const rawPage = Number(url.searchParams.get("page"));
    const rawPageSize = Number(url.searchParams.get("pageSize"));
    const page = Number.isInteger(rawPage)&&rawPage>0?rawPage:1;
    const pageSize = Number.isInteger(rawPageSize)?Math.min(Math.max(rawPageSize,1),100):50;

    let query = db.collection(RECEIPTS_COLLECTION)as FirebaseFirestore.Query;
    query = query.orderBy("createdAt","desc");

    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        query = query.where("createdAt",">=",fromDate);
      }
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23,59,999);
      if (!Number.isNaN(toDate.getTime())) {
        query = query.where("createdAt","<=",toDate);
      }
    }
    if (sevaId) {
      query = query.where("sevaIds","array-contains",sevaId);
    }

    const snapshot = await query
      .limit(pageSize)
      .offset((page-1)*pageSize)
      .get();
    const receipts = snapshot.docs.map((doc)=> {
      const data = doc.data();
      return { id: doc.id,...data };
    });
    return NextResponse.json({
      success: true,
      receipts,
      count: receipts.length,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[Admin Receipts API] Error listing receipts:",error);
    return NextResponse.json({ error: "Failed to load receipts." },{ status: 500 });
  }
}

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