// Unknown Questions API Route
// GET /api/ai/settings/unknown-questions - Get unknown questions
// POST /api/ai/settings/unknown-questions - Log new unknown question
// PUT /api/ai/settings/unknown-questions - Update unknown question
// DELETE /api/ai/settings/unknown-questions - Delete unknown question

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const assignedTo = searchParams.get("assignedTo") || undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;

    const questions = await aiSettingsService.getUnknownQuestions({
      status,
      assignedTo,
      limit,
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Error fetching unknown questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch unknown questions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, detectedIntent, confidence, language, sessionId } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    await aiSettingsService.logUnknownQuestion(
      question,
      detectedIntent || "UNKNOWN",
      confidence || 0,
      language || "en",
      sessionId || "manual"
    );

    return NextResponse.json({
      message: "Unknown question logged successfully",
    });
  } catch (error) {
    console.error("Error logging unknown question:", error);
    return NextResponse.json(
      { error: "Failed to log unknown question" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, action, ...updates } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "assign":
        await aiSettingsService.assignUnknownQuestion(questionId, updates.assignedTo);
        break;
      case "resolve":
        await aiSettingsService.resolveUnknownQuestion(
          questionId,
          updates.response,
          updates.addToKnowledge,
          updates.articleId
        );
        break;
      case "update":
        await aiSettingsService.updateUnknownQuestion(questionId, updates);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Unknown question ${action} successful`,
    });
  } catch (error) {
    console.error("Error updating unknown question:", error);
    return NextResponse.json(
      { error: "Failed to update unknown question" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    await aiSettingsService.deleteUnknownQuestion(questionId);

    return NextResponse.json({
      message: "Unknown question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting unknown question:", error);
    return NextResponse.json(
      { error: "Failed to delete unknown question" },
      { status: 500 }
    );
  }
}
