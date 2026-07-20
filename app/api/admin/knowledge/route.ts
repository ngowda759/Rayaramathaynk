import { NextResponse } from "next/server";
import {
  getKnowledgeArticles,
  getPendingArticles,
  clearKnowledgeCache,
} from "@/lib/ai/knowledge/repository";
import { addDocument } from "@/lib/firebase-admin-rest";

const COLLECTION_NAME = "knowledge";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/knowledge
 * Get all knowledge articles (including unpublished)
 */
export async function GET() {
  try {
    const articles = await getKnowledgeArticles();
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
 * Create a new knowledge article (auto-approved for admin)
 * Uses REST Admin SDK to bypass security rules
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
    
    // Use REST Admin SDK for write operations (bypasses security rules)
    const id = await addDocument(COLLECTION_NAME, {
      slug: slug || `article-${Date.now()}`,
      title,
      content: content || "",
      keywords: keywords || [],
      category: category || "general",
      language: language || "en",
      approved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    clearKnowledgeCache();

    return NextResponse.json({
      success: true,
      id,
      message: "Article created and published successfully",
    });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create article" },
      { status: 500 }
    );
  }
}
