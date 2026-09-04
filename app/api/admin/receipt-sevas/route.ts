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

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  try {
    const db = await getAdminFirestore();
    const snapshot = await db
      .collection(RECEIPT_SEVAS_COLLECTION)
      .orderBy("displayOrder", "asc")
      .get();

    const sevas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json({ success: true, sevas, count: sevas.length });
  } catch (error) {
    console.error("[Admin Receipt Sevas API] Error listing sevas:", error);
    return NextResponse.json({ error: "Failed to load seva catalogue." }, { status: 500 });
   }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  let body: ReceiptSevaInput;
  try {
    body = (await request.json() as ReceiptSevaInput);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
   }

  const errors = validateReceiptSevaInput(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
   }

  try {
    const sanitized = sanitizeReceiptSevaInput(body);
    const db = await getAdminFirestore();
    const now = new Date();
    const docRef = db.collection(RECEIPT_SEVAS_COLLECTION).doc();
    await docRef.set({
      ...sanitized,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, id: docRef.id, message: "Seva created successfully" }, { status: 201 });
   } catch (error) {
    console.error("[Admin Receipt Sevas API] Error creating seva:", error);
    return NextResponse.json({ error: "Failed to create seva." }, { status: 500 });
   }
}