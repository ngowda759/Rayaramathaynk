// API Route: /api/ai/multi-source/query
// Execute multi-source queries

import { NextRequest, NextResponse } from "next/server";
import { executeMultiSourceQuery, addToQueryHistory } from "@/services/multi-source-retrieval.service";
import { MultiSourceQuery } from "@/types/multi-source-retrieval";
import { Intent } from "@/lib/ai/intent/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, intent, sources, language, maxResults } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const multiSourceQuery: MultiSourceQuery = {
      query,
      intent: intent as Intent | undefined,
      sources: sources || {
        settings: true,
        panchanga: true,
        events: true,
        sevas: true,
        announcements: true,
      },
      language: language || "en",
      maxResults,
    };

    const response = await executeMultiSourceQuery(multiSourceQuery);

    // Add to query history
    addToQueryHistory({
      query,
      sources: response.metadata.sourcesUsed,
      responseTime: response.metadata.totalRetrievalTime,
      successful: response.metadata.sourcesUsed.length > 0,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error executing multi-source query:", error);
    return NextResponse.json(
      { error: "Failed to execute query" },
      { status: 500 }
    );
  }
}
