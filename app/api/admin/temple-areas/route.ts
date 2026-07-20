import { NextRequest, NextResponse } from "next/server";
import { templeAreasService } from "@/services/temple-areas.service";
import { addDocument } from "@/lib/firebase-admin-rest";

const COLLECTION = "temple_areas";

export async function GET() {
  try {
    const areas = await templeAreasService.getAreas();
    return NextResponse.json({ success: true, areas });
  } catch (error) {
    console.error("[API] Error fetching temple areas:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch temple areas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!body.category) {
      return NextResponse.json({ success: false, error: "Category is required" }, { status: 400 });
    }

    // Use REST Admin SDK for write operations (bypasses security rules)
    await addDocument(COLLECTION, {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return NextResponse.json({ success: true, message: "Temple area created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating temple area:", error);
    return NextResponse.json({ success: false, error: "Failed to create temple area" }, { status: 500 });
  }
}
