import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { getAdminFirestore } from "@/lib/admin-firebase";
import { createAdminClient } from "@/lib/supabase/admin";

import { ReceiptSevaInput } from "@/types/receiptSeva";
import {
  sanitizeReceiptSevaInput,
  validateReceiptSevaInput,
} from "@/lib/receipt/validation";

export const dynamic = "force-dynamic";

export const revalidate = 0;
const RECEIPT_SEVAS_COLLECTION = "sevas";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}



export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  try {
    const supabase = createAdminClient();
    const { data: snapshot, error: fetchError } = await supabase.from(RECEIPT_SEVAS_COLLECTION).select("*");

    if (fetchError) throw fetchError;

    const rawDocs = (snapshot || []).map((data) => {
      return {
        id: data.firestore_id || data.id,
        name: data.name || "Unknown Seva",
        description: data.description || "",
        amount: typeof data.amount === "number" ? data.amount : (Number(data.amount) || 0),
        active: data.active !== false, // default true unless explicitly false
        displayOrder: typeof data.display_order === "number" ? data.display_order : 9999, // default 9999 so it goes to bottom
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    });

    rawDocs.sort((a, b) => a.displayOrder - b.displayOrder);
    const sevas = rawDocs;
    return NextResponse.json({ success: true, sevas, count: sevas.length });
  } catch (error) {
    console.error("[Admin Receipt Sevas API] Error listing sevas:", error instanceof Error ? error.stack : error);
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
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const newSeva = {
      ...sanitized,
      created_at: now,
      updated_at: now,
      duration: 30,
      category: "Special",
      image_url: "",
      display_order: sanitized.displayOrder
    };

    // Using upsert/insert without generating firestore_id if not required, or we could generate a UUID.
    const { data, error: insertError } = await supabase.from(RECEIPT_SEVAS_COLLECTION).insert([newSeva]).select().single();
    if (insertError) throw insertError;

    // Also mirror to Firestore for backward compatibility if needed, but the prompt says they come from Supabase.
    const db = await getAdminFirestore();
    const docRef = db.collection(RECEIPT_SEVAS_COLLECTION).doc();
    // we can update the firestore_id in Supabase
    await supabase.from(RECEIPT_SEVAS_COLLECTION).update({ firestore_id: docRef.id }).eq("id", data.id);

    await docRef.set({
      ...sanitized,
      createdAt: new Date(),
      updatedAt: new Date(),
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