// AI Responses API Route
// GET /api/ai/settings/ai-responses - Get AI response templates
// PUT /api/ai/settings/ai-responses - Update AI response templates

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { AIResponses, AIResponseTemplates } from "@/types/ai-settings";

export async function GET() {
  try {
    const aiResponses = await aiSettingsService.getAIResponses();
    return NextResponse.json(aiResponses);
  } catch (error) {
    console.error("Error fetching AI responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI responses" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const body = await request.json();
    const { templateKey, template } = body;

    if (templateKey && template) {
      await aiSettingsService.updateResponseTemplate(
        templateKey as keyof AIResponseTemplates,
        template,
        userId
      );
    } else {
      await aiSettingsService.updateAIResponses(body as AIResponses, userId);
    }

    const updatedAIResponses = await aiSettingsService.getAIResponses();
    return NextResponse.json(updatedAIResponses);
  } catch (error) {
    console.error("Error updating AI responses:", error);
    return NextResponse.json(
      { error: "Failed to update AI responses" },
      { status: 500 }
    );
  }
}
