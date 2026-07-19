import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/services/search.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/suggestions?q=query
 * Get search suggestions
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    const suggestions = await getSearchSuggestions(query);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
