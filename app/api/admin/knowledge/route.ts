import { NextResponse } from "next/server";
import {
  getKnowledgeArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  getArticleById,
} from "@/lib/ai/knowledge/repository";
import { KnowledgeArticleUpdate } from "@/lib/ai/knowledge/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/knowledge
 * Get all knowledge articles (including unpublished)
 */
export async function GET() {
  try {
    const articles = await getKnowledgeArticles();
    
    // Also get unpublished articles
    const { getPendingArticles } = await import("@/lib/ai/knowledge/repository");
    const pending = await getPendingArticles();
    
    const allArticles = [...articles, ...pending.filter(p => !articles.find(a => a.id === p.id))];
    
    return NextResponse.json({
      success: true,
      articles: allArticles,
      count: allArticles.length,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/knowledge
 * Create a new knowledge article
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, title, content, keywords, category, language } = body;
    
    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }
    
    const id = await createArticle({
      slug: slug || `article-${Date.now()}`,
      title,
      content: content || "",
      keywords: keywords || [],
      category: category || "general",
      language: language || "en",
    });
    
    return NextResponse.json({
      success: true,
      id,
      message: "Article created successfully",
    });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create article" },
      { status: 500 }
    );
  }
}
