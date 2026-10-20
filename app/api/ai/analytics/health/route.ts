// API Route: /api/ai/analytics/health
// Returns AI system health status

import { NextRequest, NextResponse } from "next/server";
import { checkAIHealth } from "@/services/ai-analytics.service";
import { requireAdminUser } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireAdminUser(request);
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
