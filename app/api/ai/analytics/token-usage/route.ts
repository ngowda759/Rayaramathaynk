// API Route: /api/ai/analytics/token-usage
// Returns token usage data and summary

import { NextRequest, NextResponse } from "next/server";
import { getTokenUsage } from "@/services/ai-analytics.service";
import { Intent } from "@/lib/ai/intent/types";
import { requireAdminUser } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const intent = searchParams.get("intent");
    const limit = searchParams.get("limit");
    
    const response = await getTokenUsage({
      startDate: startDate ? parseInt(startDate, 10) : undefined,
      endDate: endDate ? parseInt(endDate, 10) : undefined,
      intent: intent as Intent | undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching token usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch token usage" },
      { status: 500 }
    );
  }
}
