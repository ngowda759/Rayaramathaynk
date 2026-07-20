import { NextRequest, NextResponse } from "next/server";
import { aaradhaneService } from "@/services/aaradhane.service";
import { Aaradhane } from "@/types/aaradhane";

/**
 * GET /api/admin/aaradhane
 * Get all aaradhanes from Firestore
 */
export async function GET() {
  try {
    const aaradhanes = await aaradhaneService.getAaradhanes();
    return NextResponse.json({
      success: true,
      data: aaradhanes,
      count: aaradhanes.length,
    });
  } catch (error) {
    console.error("Error fetching aaradhanes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch aaradhanes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/aaradhane
 * Create a new aaradhane
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userEmail = request.headers.get("x-user-email") || "admin";
    
    const id = await aaradhaneService.createAaradhane(
      body as Omit<Aaradhane, "id" | "createdAt" | "createdBy">,
      userEmail
    );
    
    return NextResponse.json({
      success: true,
      message: "Aaradhane created successfully",
      id,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating aaradhane:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create aaradhane" },
      { status: 500 }
    );
  }
}
