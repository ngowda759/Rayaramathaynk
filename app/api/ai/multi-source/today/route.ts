// API Route: /api/ai/multi-source/today
// Get today's temple information

import { NextResponse } from "next/server";
import { getTodayInfo } from "@/services/multi-source-retrieval.service";

export async function GET() {
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
