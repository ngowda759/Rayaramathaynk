import { NextRequest, NextResponse } from "next/server";
import { templeAreasService } from "@/services/temple-areas.service";

export async function GET() {
  try {
    const areas = await templeAreasService.getAreas();
    return NextResponse.json(areas);
  } catch (error) {
    console.error("[API] Error fetching temple areas:", error);
    return NextResponse.json({ error: "Failed to fetch temple areas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }
    
    await templeAreasService.addArea(body);
    return NextResponse.json({ message: "Temple area created successfully" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating temple area:", error);
    return NextResponse.json({ error: "Failed to create temple area" }, { status: 500 });
  }
}
