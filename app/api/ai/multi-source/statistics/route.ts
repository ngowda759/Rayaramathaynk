// API Route: /api/ai/multi-source/statistics
// Get retrieval statistics and freshness
//
// Raya AI administration surface: the same guard as every other /api/ai route.

import { NextRequest, NextResponse } from "next/server";
import { getRetrievalStats, getDataFreshness, getQueryHistory } from "@/services/multi-source-retrieval.service";
import { requireAdminCapability } from "@/lib/auth/admin-capabilities";

export async function GET(request: NextRequest) {
  const guard = await requireAdminCapability(request, "ai.analytics.read");
  if (!guard.ok) return guard.response;

  try {
    const stats = getRetrievalStats();
    const freshness = getDataFreshness();
    const history = getQueryHistory();

    return NextResponse.json({
      statistics: stats,
      freshness,
      recentQueries: history.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
