/**
 * Admin Content Management API
 * Provides content auto-tagging, freshness, and related questions features
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  autoTagArticle, 
  getContentFreshness, 
  getFreshnessLabel,
  getRelatedQuestions,
  getArticlesNeedingReview,
  batchFreshnessCheck,
  type AutoTagResult,
  type ContentFreshness,
  type RelatedQuestion
} from "@/services/content.service";

/**
 * GET /api/admin/content
 * Get content management features
 * 
 * Query params:
 * - action: 'freshness' | 'related' | 'review' | 'batch'
 * - intent: intent string for related questions
 * - language: 'en' | 'kn' | 'mixed'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const intent = searchParams.get('intent') || undefined;
  const language = (searchParams.get('language') as 'en' | 'kn' | 'mixed') || 'en';

  try {
    switch (action) {
      case 'related': {
        const questions = getRelatedQuestions(intent, language);
        return NextResponse.json({
          success: true,
          intent,
          language,
          questions,
        });
      }

      case 'freshness': {
        // This would normally take an article ID
        // For now, return a sample response
        return NextResponse.json({
          success: true,
          message: "Provide articleId in POST body for freshness check",
          example: {
            articleId: "article-123",
            freshness: {
              daysSinceUpdate: 45,
              freshnessLabel: "stale",
              reviewRecommended: true,
            },
            label: "Updated 1 month ago"
          }
        });
      }

      case 'review': {
        // This would normally query the knowledge base
        return NextResponse.json({
          success: true,
          message: "Query articles from knowledge base and pass to batchFreshnessCheck",
          articlesNeedingReview: 0,
        });
      }

      default: {
        return NextResponse.json({
          success: true,
          availableActions: [
            { action: 'autotag', method: 'POST', description: 'Auto-tag content based on text' },
            { action: 'freshness', method: 'GET', description: 'Get content freshness info' },
            { action: 'related', method: 'GET', description: 'Get related questions for an intent' },
            { action: 'review', method: 'GET', description: 'Get articles needing review' },
          ]
        });
      }
    }
  } catch (error) {
    console.error("[Content API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/content
 * Auto-tag content or check freshness
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'autotag': {
        const { title, content, existingKeywords = [] } = body;
        
        if (!title || !content) {
          return NextResponse.json(
            { success: false, error: "title and content are required" },
            { status: 400 }
          );
        }

        const result: AutoTagResult = autoTagArticle(title, content, existingKeywords);
        
        return NextResponse.json({
          success: true,
          action: 'autotag',
          result,
        });
      }

      case 'freshness': {
        const { article } = body;
        
        if (!article) {
          return NextResponse.json(
            { success: false, error: "article is required" },
            { status: 400 }
          );
        }

        const freshness: ContentFreshness = getContentFreshness(article);
        const label: string = getFreshnessLabel(freshness.daysSinceUpdate);
        
        return NextResponse.json({
          success: true,
          action: 'freshness',
          freshness,
          label,
        });
      }

      case 'batchFreshness': {
        const { articles } = body;
        
        if (!articles || !Array.isArray(articles)) {
          return NextResponse.json(
            { success: false, error: "articles array is required" },
            { status: 400 }
          );
        }

        const results: ContentFreshness[] = batchFreshnessCheck(articles);
        const articlesNeedingReview = results.filter(r => r.reviewRecommended);
        
        return NextResponse.json({
          success: true,
          action: 'batchFreshness',
          total: results.length,
          needingReview: articlesNeedingReview.length,
          results,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action. Use: autotag, freshness, batchFreshness" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Content API] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
