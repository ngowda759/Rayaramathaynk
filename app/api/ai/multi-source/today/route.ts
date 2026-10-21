// API Route: /api/ai/multi-source/today
// Get today's temple information
//
// Raya AI administration surface: the same guard as every other /api/ai route.

import { NextRequest, NextResponse } from "next/server";
import { getTodayInfo } from "@/services/multi-source-retrieval.service";
import { requireRayaAdminUser } from "@/lib/auth/raya-admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireRayaAdminUser(request);
  if (!guard.ok) return guard.response;

  try {
    const response = await getTodayInfo();
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching today's info:", error);
    return NextResponse.json(
      { error: "Failed to fetch today's information" },
      { status: 500 }
    );
  }
}
