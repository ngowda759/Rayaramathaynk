// API Route: /api/ai/analytics/latency
// Returns latency metrics and summary

import { NextRequest, NextResponse } from "next/server";
import { getLatencyMetrics } from "@/services/ai-analytics.service";
import { Intent } from "@/lib/ai/intent/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const intent = searchParams.get("intent");
    const limit = searchParams.get("limit");
    
    const response = await getLatencyMetrics({
      startDate: startDate ? parseInt(startDate, 10) : undefined,
      endDate: endDate ? parseInt(endDate, 10) : undefined,
      intent: intent as Intent | undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching latency metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch latency metrics" },
      { status: 500 }
    );
  }
}
