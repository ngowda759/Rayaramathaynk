// API Route: /api/ai/analytics/health
// Returns AI system health status

import { NextResponse } from "next/server";
import { checkAIHealth } from "@/services/ai-analytics.service";

export async function GET() {
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
