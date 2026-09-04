import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { ReceiptSevaInput } from "@/types/receiptSeva";
import {
  sanitizeReceiptSevaInput,
  validateReceiptSevaInput,
} from "@/lib/receipt/validation";

export const dynamic = "force-dynamic";

const RECEIPT_SEVAS_COLLECTION = "receiptSevas";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  const { id } = await params;

  let body: Partial<ReceiptSevaInput>;
  try {
    body = (await request.json() as Partial<ReceiptSevaInput>);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
   }

  const errors = validateReceiptSevaInput(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
   }

  try {
    const db = await getAdminFirestore();
    const docRef = db.collection(RECEIPT_SEVAS_COLLECTION).doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Seva not found" }, { status: 404 });
    }

    const current = snap.data() as ReceiptSevaInput;

    const sanitized = sanitizeReceiptSevaInput({
      ...current,
      ...body,
    } as ReceiptSevaInput);

    await docRef.update({
      name: sanitized.name,
      description: sanitized.description,
      amount: sanitized.amount,
      active: sanitized.active,
      displayOrder: sanitized.displayOrder,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, message: "Seva updated successfully" });
  } catch (error) {
    console.error("[Admin Receipt Sevas API] Error updating seva:", error);
    return NextResponse.json({ error: "Failed to update seva." }, { status: 500 });
   }
}