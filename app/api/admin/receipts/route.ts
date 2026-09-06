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
    const isExport = url.searchParams.get("export") === "true";
    const isReport = url.searchParams.get("report") === "true";
    const page = Number.isInteger(rawPage)&&rawPage>0?rawPage:1;
    const maxPageSize = (isExport || isReport) ? 10000 : 100;
    const pageSize = Number.isInteger(rawPageSize)?Math.min(Math.max(rawPageSize,1),maxPageSize):50;

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

    if (isReport) {
      const summary = {
        total: receipts.length,
        collection: 0,
        upiCollection: 0,
      };
      const sevaAgg: Record<string, { quantity: number; amount: number }> = {};
      const timelineAgg: Record<string, { count: number; amount: number }> = {};

      const diffDays = from && to ? (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 3600 * 24) : 30;
      const isYear = diffDays > 90; // Use month grouping if range > 3 months

      receipts.forEach((r: any) => {
        summary.collection += Number(r.totalAmount || 0);
        if (r.paymentMode === "upi") {
          summary.upiCollection += Number(r.totalAmount || 0);
        }

        (r.items || []).forEach((item: any) => {
          if (!sevaAgg[item.sevaName]) {
            sevaAgg[item.sevaName] = { quantity: 0, amount: 0 };
          }
          sevaAgg[item.sevaName].quantity += Number(item.quantity || 0);
          sevaAgg[item.sevaName].amount += Number(item.amount || 0);
        });

        let date: Date;
        if (r.createdAt?.toDate) {
          date = r.createdAt.toDate();
        } else if (r.createdAt?.seconds) {
          date = new Date(r.createdAt.seconds * 1000);
        } else {
          date = new Date(r.createdAt);
        }

        let key = "";
        if (isYear) {
          key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        } else {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          key = `${y}-${m}-${d}`;
        }

        if (!timelineAgg[key]) {
          timelineAgg[key] = { count: 0, amount: 0 };
        }
        timelineAgg[key].count += 1;
        timelineAgg[key].amount += Number(r.totalAmount || 0);
      });

      const sevaWise = Object.entries(sevaAgg).map(([seva, data]) => ({ seva, ...data })).sort((a, b) => b.amount - a.amount);
      const timeline = Object.entries(timelineAgg).map(([period, data]) => ({ period, ...data })).sort((a, b) => {
        if (isYear) {
          return new Date(a.period).getTime() - new Date(b.period).getTime();
        }
        return new Date(b.period).getTime() - new Date(a.period).getTime();
      });

      return NextResponse.json({
        success: true,
        summary,
        sevaWise,
        timeline,
      });
    }

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