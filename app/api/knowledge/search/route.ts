import { NextResponse } from "next/server";
import { knowledgeService } from "@/services/knowledge.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/search?q=query
 * Search knowledge articles
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const results = await knowledgeService.searchKnowledge(query, limit);

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error searching articles:", error);
    return NextResponse.json(
      { error: "Failed to search articles" },
      { status: 500 }
    );
  }
}
