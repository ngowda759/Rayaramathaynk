import { NextResponse } from "next/server";
import {
  getArticleById,
  updateArticle,
  deleteArticle,
  approveArticle,
  clearKnowledgeCache,
} from "@/lib/ai/knowledge/repository";
import { KnowledgeArticleUpdate } from "@/lib/ai/knowledge/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/knowledge/[id]
 * Get a single knowledge article by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await getArticleById(id);
    
    if (!article) {
      return NextResponse.json(
        { success: false, error: "Article not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/knowledge/[id]
 * Update a knowledge article (auto-approve for admin)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, keywords, category, language, slug } = body;

    const updateData: KnowledgeArticleUpdate = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (category !== undefined) updateData.category = category;
    if (language !== undefined) updateData.language = language;
    if (slug !== undefined) updateData.slug = slug;

    await updateArticle(id, updateData);
    await approveArticle(id);
    clearKnowledgeCache();

    return NextResponse.json({
      success: true,
      message: "Article updated and published successfully",
    });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update article" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/knowledge/[id]
 * Delete a knowledge article
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteArticle(id);
    clearKnowledgeCache();
    
    return NextResponse.json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete article" },
      { status: 500 }
    );
  }
}
