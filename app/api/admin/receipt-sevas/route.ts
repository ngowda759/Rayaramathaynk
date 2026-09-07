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

const INITIAL_SEVAS: ReceiptSevaInput[] = [
  { name: "Panchamrutha Seva", description: "Traditional Panchamrutha Abhisheka performed with devotion and Vedic rituals.", amount: 105, active: true, displayOrder: 1 },
  { name: "Paaduka Pooja, Tottillu, Pallakki Seva", description: "Paaduka Pooja, Tottillu and Pallakki seva performed for divine blessings.", amount: 505, active: true, displayOrder: 2 },
  { name: "Rajatha Rathotsava / Gajavahana Seva", description: "Silver chariot (Rajatha Rathotsava) or elephant-vahana seva of Sri Raghavendra Swamy.", amount: 1505, active: true, displayOrder: 3 },
  { name: "Pushpalankara Seva", description: "Floral decoration (Pushpalankara) seva offered to the Lord.", amount: 1005, active: true, displayOrder: 4 },
  { name: "Kanakabhisheka Seva", description: "Kanakabhisheka,a golden abhisheka ritual performed for divine blessings.", amount: 1005, active: true, displayOrder: 5 },
  { name: "Alankara Brahmanara Seva", description: "Alankara (ornamentation) Brahmanara seva performed for prosperity.", amount: 2505, active: true, displayOrder: 6 },
  { name: "Annadana Seva", description: "Sponsor Annadana and receive the blessings of serving devotees at the temple.", amount: 5005, active: true, displayOrder: 7 },
  { name: "Sampoorna Seva (1 Day)", description: "Comprehensive one-day seva package covering all major rituals.", amount: 25005, active: true, displayOrder: 8 },
  { name: "Annadana Seva (1 Day)", description: "Sponsor one day of Annadana (community meal) for temple devotees.", amount: 50005, active: true, displayOrder: 9 },
  { name: "Sampoorna Seva (3 Day)", description: "Comprehensive three-day seva package covering all major rituals.", amount: 100005, active: true, displayOrder: 10 },
];

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return unauthorized();

  try {
    const db = await getAdminFirestore();
    let snapshot = await db
      .collection(RECEIPT_SEVAS_COLLECTION)
      .orderBy("displayOrder", "asc")
      .get();

    // Auto-seed if empty
    if (snapshot.empty) {
      const batch = db.batch();
      const now = new Date();
      for (const seva of INITIAL_SEVAS) {
        const docRef = db.collection(RECEIPT_SEVAS_COLLECTION).doc();
        batch.set(docRef, { ...seva, createdAt: now, updatedAt: now });
      }
      await batch.commit();

      // Refetch after seeding
      snapshot = await db
        .collection(RECEIPT_SEVAS_COLLECTION)
        .orderBy("displayOrder", "asc")
        .get();
    }

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