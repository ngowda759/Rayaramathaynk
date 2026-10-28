// API Route: /api/knowledge/workflow/comments
// Review comments operations

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { addReviewComment, resolveComment } from "@/services/knowledge-workflow.service";

/** Add or resolve a review comment. Admin-only; the author is the verified caller. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { articleId, content, versionId } = body;
    if (!articleId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const commentId = await addReviewComment(articleId, content, auth.user.email, versionId);
    return NextResponse.json({ commentId }, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { commentId } = body;
    if (!commentId) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    await resolveComment(commentId, auth.user.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resolving comment:", error);
    return NextResponse.json({ error: "Failed to resolve comment" }, { status: 500 });
  }
}
