import { NextResponse } from "next/server";
import {
  getArticleById,
  clearKnowledgeCache,
} from "@/lib/ai/knowledge/repository";
import { updateDocument, deleteDocument } from "@/lib/firebase-admin-rest";

const COLLECTION_NAME = "knowledge";

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
 * Uses REST Admin SDK to bypass security rules
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, keywords, category, language, slug } = body;

    // Use REST Admin SDK for write operations (bypasses security rules)
    await updateDocument(COLLECTION_NAME, id, {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(keywords !== undefined && { keywords }),
      ...(category !== undefined && { category }),
      ...(language !== undefined && { language }),
      ...(slug !== undefined && { slug }),
      approved: true,
      updatedAt: new Date(),
    });

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
 * Uses REST Admin SDK to bypass security rules
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Use REST Admin SDK for write operations (bypasses security rules)
    await deleteDocument(COLLECTION_NAME, id);
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
