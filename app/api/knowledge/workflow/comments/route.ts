// API Route: /api/knowledge/workflow/comments
// Review comments operations

import { NextRequest, NextResponse } from "next/server";
import {
  addReviewComment,
  getArticleComments,
  resolveComment,
} from "@/services/knowledge-workflow.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, content, createdBy, versionId } = body;

    if (!articleId || !content || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const commentId = await addReviewComment(articleId, content, createdBy, versionId);

    return NextResponse.json({ commentId }, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { commentId, resolvedBy } = body;

    if (!commentId || !resolvedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await resolveComment(commentId, resolvedBy);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resolving comment:", error);
    return NextResponse.json(
      { error: "Failed to resolve comment" },
      { status: 500 }
    );
  }
}
