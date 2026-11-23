// API Route: /api/ai/multi-source/today
// Get today's temple information
//
// Raya AI administration surface: the same guard as every other /api/ai route.

import { NextRequest, NextResponse } from "next/server";
import { getTodayInfo } from "@/services/multi-source-retrieval.service";
import { requireAdminCapability } from "@/lib/auth/admin-capabilities";

export async function GET(request: NextRequest) {
  const guard = await requireAdminCapability(request, "ai.analytics.read");
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
