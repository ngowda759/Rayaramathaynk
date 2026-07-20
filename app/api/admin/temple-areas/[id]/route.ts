import { NextRequest, NextResponse } from "next/server";
import { templeAreasService } from "@/services/temple-areas.service";

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

    await templeAreasService.updateArea(id, body);
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
    await templeAreasService.deleteArea(id);
    return NextResponse.json({ success: true, message: "Temple area deleted successfully" });
  } catch (error) {
    console.error("[API] Error deleting temple area:", error);
    return NextResponse.json({ success: false, error: "Failed to delete temple area" }, { status: 500 });
  }
}
