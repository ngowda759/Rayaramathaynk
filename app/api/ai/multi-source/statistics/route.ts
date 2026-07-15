// API Route: /api/ai/multi-source/statistics
// Get retrieval statistics and freshness

import { NextResponse } from "next/server";
import { getRetrievalStats, getDataFreshness, getQueryHistory } from "@/services/multi-source-retrieval.service";

export async function GET() {
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
