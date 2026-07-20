import { NextRequest, NextResponse } from "next/server";
import { templeAreasService } from "@/services/temple-areas.service";
import { updateDocument, deleteDocument } from "@/lib/firebase-admin-rest";

const COLLECTION = "temple_areas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const area = await templeAreasService.getArea(id);

    if (!area) {
      return NextResponse.json({ success: false, error: "Temple area not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, area });
  } catch (error) {
    console.error("[API] Error fetching temple area:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch temple area" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Use REST Admin SDK for write operations (bypasses security rules)
    await updateDocument(COLLECTION, id, { ...body, updatedAt: new Date() });
    
    return NextResponse.json({ success: true, message: "Temple area updated successfully" });
  } catch (error) {
    console.error("[API] Error updating temple area:", error);
    return NextResponse.json({ success: false, error: "Failed to update temple area" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Use REST Admin SDK for write operations (bypasses security rules)
    await deleteDocument(COLLECTION, id);
    
    return NextResponse.json({ success: true, message: "Temple area deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting temple area:", error);
    return NextResponse.json({ success: false, error: "Failed to delete temple area" }, { status: 500 });
  }
}
