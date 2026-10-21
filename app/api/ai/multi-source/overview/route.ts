// API Route: /api/ai/multi-source/overview
// Get temple overview (all sources)
//
// Raya AI administration surface: the same guard as every other /api/ai route.

import { NextRequest, NextResponse } from "next/server";
import { getTempleOverview } from "@/services/multi-source-retrieval.service";
import { requireRayaAdminUser } from "@/lib/auth/raya-admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireRayaAdminUser(request);
  if (!guard.ok) return guard.response;

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
