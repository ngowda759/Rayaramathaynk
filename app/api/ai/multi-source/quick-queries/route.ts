// API Route: /api/ai/multi-source/quick-queries
// Get predefined quick queries

import { NextResponse } from "next/server";
import { QUICK_QUERIES, getIntentSuggestions } from "@/services/multi-source-retrieval.service";

export async function GET() {
  return NextResponse.json({
    quickQueries: QUICK_QUERIES,
    intentSuggestions: getIntentSuggestions(),
  });
}
