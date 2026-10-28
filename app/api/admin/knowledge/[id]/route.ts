import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import {
  clearKnowledgeCache,
  deleteArticle,
  getArticleById,
  updateArticle,
} from "@/lib/ai/knowledge/repository";

export const dynamic = "force-dynamic";

/** GET /api/admin/knowledge/[id] - one article. Admin-only. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const article = await getArticleById(id);
    if (!article) {
      return NextResponse.json({ success: false, error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, article });
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch article" }, { status: 500 });
  }
}

/** PUT /api/admin/knowledge/[id] - update an article and keep it published. Admin-only. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, keywords, category, language, slug } = body;

    await updateArticle(id, {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(keywords !== undefined && { keywords }),
      ...(category !== undefined && { category }),
      ...(language !== undefined && { language }),
      ...(slug !== undefined && { slug }),
      approved: true,
    });
    clearKnowledgeCache();

    return NextResponse.json({ success: true, message: "Article updated and published successfully" });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json({ success: false, error: "Failed to update article" }, { status: 500 });
  }
}

/** DELETE /api/admin/knowledge/[id] - remove an article. Admin-only. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await deleteArticle(id);
    clearKnowledgeCache();
    return NextResponse.json({ success: true, message: "Article deleted successfully" });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json({ success: false, error: "Failed to delete article" }, { status: 500 });
  }
}
