import { NextResponse } from "next/server";
import { knowledgeService } from "@/services/knowledge.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge/categories
 * Get all knowledge categories
 */
export async function GET() {
  try {
    const categories = await knowledgeService.getKnowledgeCategories();

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
