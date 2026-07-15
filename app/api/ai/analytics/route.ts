// API Route: /api/ai/analytics
// Returns full analytics dashboard data

import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsDashboard } from "@/services/ai-analytics.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    const start = startDate ? parseInt(startDate, 10) : undefined;
    const end = endDate ? parseInt(endDate, 10) : undefined;
    
    const response = await getAnalyticsDashboard(start, end);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching analytics dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics dashboard" },
      { status: 500 }
    );
  }
}
