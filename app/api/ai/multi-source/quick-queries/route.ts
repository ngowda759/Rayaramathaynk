// API Route: /api/ai/multi-source/quick-queries
// Get predefined quick queries
//
// Raya AI administration surface: the same guard as every other /api/ai route.

import { NextRequest, NextResponse } from "next/server";
import { QUICK_QUERIES, getIntentSuggestions } from "@/services/multi-source-retrieval.service";
import { requireRayaAdminUser } from "@/lib/auth/raya-admin-auth";

export async function GET(request: NextRequest) {
  const guard = await requireRayaAdminUser(request);
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    quickQueries: QUICK_QUERIES,
    intentSuggestions: getIntentSuggestions(),
  });
}
