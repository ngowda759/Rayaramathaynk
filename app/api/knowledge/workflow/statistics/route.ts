// API Route: /api/knowledge/workflow/statistics
// Workflow statistics

import { NextResponse } from "next/server";
import { getWorkflowStatistics } from "@/services/knowledge-workflow.service";

export async function GET() {
  try {
    const statistics = await getWorkflowStatistics();
    return NextResponse.json({ statistics });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
