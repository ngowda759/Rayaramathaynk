import { NextResponse } from "next/server";
import { knowledgeService } from "@/services/knowledge.service";

export const dynamic = "force-dynamic";

interface ArticleRouteProps {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/knowledge/article/[slug]
 * Get article page data by slug
 */
export async function GET(
  request: Request,
  { params }: ArticleRouteProps
) {
  try {
    const { slug } = await params;
    const data = await knowledgeService.getArticlePageData(slug);

    if (!data) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}
