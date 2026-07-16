/**
 * Admin Analytics API
 * Provides analytics summary and feedback endpoints for admin dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsSummary, logIntentFeedback, type IntentFeedback } from "@/services/analytics.service";

/**
 * GET /api/admin/analytics
 * Get complete analytics summary for admin dashboard
 */
export async function GET() {
  try {
    const summary = await getAnalyticsSummary();

    return NextResponse.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Analytics API] Failed to get summary:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/analytics/feedback
 * Submit intent correction feedback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const feedback: IntentFeedback = {
      question: body.question,
      detectedIntent: body.detectedIntent,
      correctIntent: body.correctIntent,
      isCorrect: body.isCorrect,
      sessionId: body.sessionId,
      adminId: body.adminId,
      notes: body.notes,
    };

    if (!feedback.question || !feedback.detectedIntent || !feedback.correctIntent || typeof feedback.isCorrect !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const feedbackId = await logIntentFeedback(feedback);

    return NextResponse.json({
      success: true,
      feedbackId,
      message: feedback.isCorrect ? "Intent confirmed as correct" : "Intent correction logged",
    });
  } catch (error) {
    console.error("[Analytics API] Failed to log feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
