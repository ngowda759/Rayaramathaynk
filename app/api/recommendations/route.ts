import { NextResponse } from "next/server";
import {
  getHomepageRecommendations,
  getRecommendationsForUser,
} from "@/services/recommendation.service";
import { UserBehavior } from "@/types/recommendation";

export const dynamic = "force-dynamic";

/**
 * GET /api/recommendations
 * Get personalized recommendations
 * 
 * Query params:
 * - type: 'homepage' | 'personalized' | 'page'
 * - pageId: string (for page-specific recommendations)
 * - pageType: string (for page-specific recommendations)
 * - pageCategory: string (for page-specific recommendations)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "homepage";

    let recommendations;

    if (type === "homepage") {
      // Homepage recommendations - featured content
      recommendations = await getHomepageRecommendations();
    } else if (type === "personalized") {
      // Personalized recommendations based on user behavior
      // In a real app, this would come from a cookie/session
      const userBehavior: UserBehavior = {
        viewedArticles: [],
        bookmarkedArticles: [],
        searchQueries: [],
        visitedCategories: [],
        lastVisit: new Date(),
      };
      recommendations = await getRecommendationsForUser(userBehavior);
    } else {
      // Page-specific recommendations
      const pageId = searchParams.get("pageId") || "";
      const pageType = searchParams.get("pageType") || "knowledge";
      const pageCategory = searchParams.get("pageCategory") || undefined;

      if (pageId) {
        const {
          getRecommendationsForPage,
        } = await import("@/services/recommendation.service");
        recommendations = await getRecommendationsForPage(
          pageId,
          pageType as Parameters<typeof getRecommendationsForPage>[1],
          pageCategory
        );
      } else {
        recommendations = await getHomepageRecommendations();
      }
    }

    return NextResponse.json(
      {
        recommendations,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations", recommendations: [] },
      { status: 500 }
    );
  }
}
