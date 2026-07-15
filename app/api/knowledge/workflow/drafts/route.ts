// API Route: /api/knowledge/workflow/drafts
// Draft management

import { NextRequest, NextResponse } from "next/server";
import { saveDraft, getUserDrafts, deleteDraft } from "@/services/knowledge-workflow.service";
import { KnowledgeCategory, KnowledgeLanguage } from "@/lib/ai/knowledge/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const drafts = await getUserDrafts(userId);

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, keywords, language, createdBy, draftId } = body;

    if (!title || !content || !category || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = await saveDraft(
      {
        title,
        content,
        category: category as KnowledgeCategory,
        keywords: keywords || [],
        language: language as KnowledgeLanguage || "en",
        createdBy,
      },
      draftId
    );

    return NextResponse.json({ draftId: id }, { status: 201 });
  } catch (error) {
    console.error("Error saving draft:", error);
    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const draftId = searchParams.get("draftId");

    if (!draftId) {
      return NextResponse.json(
        { error: "draftId is required" },
        { status: 400 }
      );
    }

    await deleteDraft(draftId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    );
  }
}
