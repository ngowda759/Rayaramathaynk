// API Route: /api/ai/multi-source/overview
// Get temple overview (all sources)

import { NextResponse } from "next/server";
import { getTempleOverview } from "@/services/multi-source-retrieval.service";

export async function GET() {
  try {
    const response = await getTempleOverview();
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching temple overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch temple overview" },
      { status: 500 }
    );
  }
}
