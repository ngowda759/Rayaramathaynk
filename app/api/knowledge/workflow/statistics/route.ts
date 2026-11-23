// API Route: /api/knowledge/workflow/statistics
// Workflow statistics

import { NextRequest, NextResponse } from "next/server";
import { getWorkflowStatistics } from "@/services/knowledge-workflow.service";
import { requireAdminCapability } from "@/lib/auth/admin-capabilities";

export async function GET(request: NextRequest) {
  const auth = await requireAdminCapability(request, "knowledge.read");
  if (!auth.ok) return auth.response;
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
