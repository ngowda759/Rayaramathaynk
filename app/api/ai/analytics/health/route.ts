// API Route: /api/ai/analytics/health
// Returns AI system health status

import { NextRequest, NextResponse } from "next/server";
import { checkAIHealth } from "@/services/ai-analytics.service";
import { requireRayaAdminUser } from "@/lib/auth/raya-admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireRayaAdminUser(request);
  if (!guard.ok) return guard.response;
  try {
    const response = await checkAIHealth();
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error checking AI health:", error);
    return NextResponse.json(
      { 
        status: "unhealthy",
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}
