import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { buildReceiptPdf, ReceiptTempleContact } from "@/lib/receipt/pdf";
import type { Receipt } from "@/types/receipt";

export const dynamic = "force-dynamic";

const RECEIPTS_COLLECTION = "receipts";
const SETTINGS_COLLECTION = "settings";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const FALLBACK_TEMPLE: ReceiptTempleContact = {
  templeName: "Sri Raghavendra Swamy Matha",
  subtitle: "Yelahanka New Town, Bengaluru",
  address: "Sri Rayara Matha, Yelahanka New Town, Bengaluru",
  phone: "+91 9886364462",
  email: "ngowda759@gmail.com",
};

async function loadTempleContact(): Promise<ReceiptTempleContact> {
  try {
    const db = await getAdminFirestore();
    const snapshot = await db.collection(SETTINGS_COLLECTION).orderBy("updatedAt", "desc").limit(1).get();
    if (snapshot.empty) {
      return FALLBACK_TEMPLE;
    }
    const data = snapshot.docs[0].data() || {};
    return {
      templeName: String(data.templeName || FALLBACK_TEMPLE.templeName),
      subtitle: String(data.subtitle || FALLBACK_TEMPLE.subtitle),
      address: String(data.address || FALLBACK_TEMPLE.address),
      phone: String(data.contactPhone || data.phone || FALLBACK_TEMPLE.phone),
      email: String(data.contactEmail || data.email || FALLBACK_TEMPLE.email),
    };
  } catch (error) {
    console.error("[Admin Receipt PDF] Failed to load temple settings:", error);
    return FALLBACK_TEMPLE;
  }
}

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
    const receipt = { id: snap.id, ...snap.data() } as Receipt;
    const temple = await loadTempleContact();
    const bytes = await buildReceiptPdf(receipt, { temple });
    return new NextResponse(Buffer.from(bytes),{
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Rayaramatha-Receipt-${receipt.receiptNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Admin Receipt PDF] Error generating receipt PDF:", error);
    return NextResponse.json({ error: "Failed to generate receipt PDF." }, { status: 500 });
  }
}