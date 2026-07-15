// API Route: /api/ai/analytics/unknown-questions
// Returns unknown questions data and summary

import { NextRequest, NextResponse } from "next/server";
import { getUnknownQuestions, markUnknownQuestionReviewed } from "@/services/ai-analytics.service";
import { Intent } from "@/lib/ai/intent/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const intent = searchParams.get("intent");
    const limit = searchParams.get("limit");
    
    const response = await getUnknownQuestions({
      startDate: startDate ? parseInt(startDate, 10) : undefined,
      endDate: endDate ? parseInt(endDate, 10) : undefined,
      intent: intent as Intent | undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching unknown questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch unknown questions" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, reviewedBy, addedToKnowledge, knowledgeArticleId } = body;
    
    if (!questionId || !reviewedBy) {
      return NextResponse.json(
        { error: "questionId and reviewedBy are required" },
        { status: 400 }
      );
    }
    
    await markUnknownQuestionReviewed(
      questionId,
      reviewedBy,
      addedToKnowledge || false,
      knowledgeArticleId
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating unknown question:", error);
    return NextResponse.json(
      { error: "Failed to update unknown question" },
      { status: 500 }
    );
  }
}
