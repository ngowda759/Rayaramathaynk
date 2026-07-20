import { NextRequest, NextResponse } from "next/server";
import { aaradhaneService } from "@/services/aaradhane.service";

/**
 * GET /api/admin/aaradhane/:id
 * Get a specific aaradhane by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const aaradhane = await aaradhaneService.getAaradhaneById(id);
    
    if (!aaradhane) {
      return NextResponse.json(
        { success: false, error: "Aaradhane not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: aaradhane,
    });
  } catch (error) {
    console.error("Error fetching aaradhane:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch aaradhane" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/aaradhane/:id
 * Update an aaradhane
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    await aaradhaneService.updateAaradhane(id, body);
    
    return NextResponse.json({
      success: true,
      message: "Aaradhane updated successfully",
    });
  } catch (error) {
    console.error("Error updating aaradhane:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update aaradhane" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/aaradhane/:id
 * Delete an aaradhane
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await aaradhaneService.deleteAaradhane(id);
    
    return NextResponse.json({
      success: true,
      message: "Aaradhane deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting aaradhane:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete aaradhane" },
      { status: 500 }
    );
  }
}
