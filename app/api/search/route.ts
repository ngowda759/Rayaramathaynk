import { NextResponse } from "next/server";
import { searchAll, getSearchSuggestions, groupResultsByType } from "@/services/search.service";
import { SearchFilters, SearchResultType } from "@/types/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=query&types=type1,type2
 * Global search across all content types
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const typesParam = searchParams.get("types");
    const grouped = searchParams.get("grouped") === "true";

    if (!query.trim() || query.length < 2) {
      return NextResponse.json({
        results: [],
        totalResults: 0,
        grouped: {},
      });
    }

    // Parse filters
    const filters: SearchFilters = {};
    if (typesParam) {
      filters.types = typesParam.split(",") as SearchResultType[];
    }

    const results = await searchAll(query, filters);
    
    if (grouped) {
      return NextResponse.json({
        results,
        totalResults: results.length,
        grouped: groupResultsByType(results),
      });
    }

    return NextResponse.json({
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", results: [], totalResults: 0 },
      { status: 500 }
    );
  }
}
