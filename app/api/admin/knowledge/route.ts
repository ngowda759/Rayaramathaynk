import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  approveArticle,
  clearKnowledgeCache,
  createArticle,
  getKnowledgeArticles,
  getPendingArticles,
} from "@/lib/ai/knowledge/repository";
import { SEED_ARTICLES } from "@/lib/ai/knowledge/seed";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/knowledge - every knowledge article, approved or pending.
 *
 * Reads Supabase `ai_knowledge` through the repository. The seed corpus is appended
 * read-only so the console shows what the assistant falls back to; it is never written.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const [approved, pending] = await Promise.all([getKnowledgeArticles(), getPendingArticles()]);
    const stored = [...approved, ...pending].map((a) => ({ ...a, isSeed: false }));

    const seedArticles = SEED_ARTICLES.map((article, index) => ({
      id: (article as unknown as { id?: string }).id || article.slug || `seed-${index}`,
      slug: article.slug || "",
      title: article.title || "",
      kannadaTitle: article.kannadaTitle,
      category: article.category || "general",
      keywords: article.keywords || [],
      content: article.content || "",
      kannadaContent: article.kannadaContent,
      language: article.language || "en",
      approved: true,
      createdAt: article.createdAt ?? new Date(),
      updatedAt: article.updatedAt ?? new Date(),
      isSeed: true,
    }));

    const articles = [...stored, ...seedArticles];

    return NextResponse.json({
      success: true,
      articles,
      count: articles.length,
      storedCount: stored.length,
      seedCount: seedArticles.length,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch articles" }, { status: 500 });
  }
}

/**
 * POST /api/admin/knowledge - create a knowledge article, published immediately.
 *
 * Admin-authored articles are trusted, so they skip the review queue and are stored
 * approved. Admin-only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { slug, title, content, keywords, category, language } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const id = await createArticle({
      slug: slug || `article-${Date.now()}`,
      title,
      content: content || "",
      keywords: keywords || [],
      category: category || "general",
      language: language || "en",
    });
    await approveArticle(id);
    clearKnowledgeCache();

    return NextResponse.json({
      success: true,
      id,
      message: "Article created and published successfully",
    });
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json({ success: false, error: "Failed to create article" }, { status: 500 });
  }
}
