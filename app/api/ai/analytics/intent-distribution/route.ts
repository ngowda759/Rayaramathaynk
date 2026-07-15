// API Route: /api/ai/analytics/intent-distribution
// Returns intent distribution data and summary

import { NextRequest, NextResponse } from "next/server";
import { getIntentDistribution } from "@/services/ai-analytics.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const language = searchParams.get("language");
    const limit = searchParams.get("limit");
    
    const response = await getIntentDistribution({
      startDate: startDate ? parseInt(startDate, 10) : undefined,
      endDate: endDate ? parseInt(endDate, 10) : undefined,
      language: language as "en" | "kn" | "mixed" | undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching intent distribution:", error);
    return NextResponse.json(
      { error: "Failed to fetch intent distribution" },
      { status: 500 }
    );
  }
}
