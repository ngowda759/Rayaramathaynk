import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { ReceiptSevaInput } from "@/types/receiptSeva";
import {
  sanitizeReceiptSevaInput,
  validateReceiptSevaInput,
} from "@/lib/receipt/validation";

export const dynamic = "force-dynamic";

const RECEIPT_SEVAS_COLLECTION = "sevas";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}



export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  try {
    const db = await getAdminFirestore();
    let snapshot = await db.collection(RECEIPT_SEVAS_COLLECTION).get();



    const rawDocs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Unknown Seva",
        description: data.description || "",
        amount: typeof data.amount === "number" ? data.amount : (Number(data.amount) || 0),
        active: data.active !== false, // default true unless explicitly false
        displayOrder: typeof data.displayOrder === "number" ? data.displayOrder : 9999, // default 9999 so it goes to bottom
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    rawDocs.sort((a, b) => a.displayOrder - b.displayOrder);
    const sevas = rawDocs;
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
      duration: 30,
      category: "Special",
      imageUrl: "",
    });

    return NextResponse.json({ success: true, id: docRef.id, message: "Seva created successfully" }, { status: 201 });
   } catch (error) {
    console.error("[Admin Receipt Sevas API] Error creating seva:", error);
    return NextResponse.json({ error: "Failed to create seva." }, { status: 500 });
   }
}