// API Route: /api/ai/multi-source/quick-queries
// Get predefined quick queries
//
// Raya AI administration surface: the same guard as every other /api/ai route.

import { NextRequest, NextResponse } from "next/server";
import { QUICK_QUERIES, getIntentSuggestions } from "@/services/multi-source-retrieval.service";
import { requireAdminCapability } from "@/lib/auth/admin-capabilities";

export async function GET(request: NextRequest) {
  const guard = await requireAdminCapability(request, "ai.analytics.read");
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    quickQueries: QUICK_QUERIES,
    intentSuggestions: getIntentSuggestions(),
  });
}
