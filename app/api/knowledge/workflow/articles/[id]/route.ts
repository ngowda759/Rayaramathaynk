// API Route: /api/knowledge/workflow/articles/[id]
// Single article operations

import { NextRequest, NextResponse } from "next/server";
import {
  getWorkflowArticleById,
  updateWorkflowArticle,
  performWorkflowAction,
  getArticleHistory,
  getArticleVersions,
  getArticleComments,
  getArticleCommitteeApproval,
} from "@/services/knowledge-workflow.service";
import { WorkflowActionType } from "@/types/knowledge-workflow";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get("includeHistory") === "true";
    const includeVersions = searchParams.get("includeVersions") === "true";
    const includeComments = searchParams.get("includeComments") === "true";
    const includeApprovals = searchParams.get("includeApprovals") === "true";

    const article = await getWorkflowArticleById(id);

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const response: any = { article };

    if (includeHistory) {
      response.history = await getArticleHistory(id);
    }
    if (includeVersions) {
      response.versions = await getArticleVersions(id);
    }
    if (includeComments) {
      response.comments = await getArticleComments(id);
    }
    if (includeApprovals) {
      response.committeeApproval = await getArticleCommitteeApproval(id);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, updatedBy, changeDescription, ...updateData } = body;

    // If this is a workflow action
    if (action) {
      const result = await performWorkflowAction(
        id,
        action as WorkflowActionType,
        updatedBy,
        body.comment
      );
      return NextResponse.json({ action: result });
    }

    // Otherwise, it's an update
    await updateWorkflowArticle(
      id,
      updateData,
      updatedBy,
      changeDescription || "Content update"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}
