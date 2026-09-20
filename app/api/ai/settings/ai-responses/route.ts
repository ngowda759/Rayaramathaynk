// AI Responses API Route
// GET /api/ai/settings/ai-responses - Get AI response templates
// PUT /api/ai/settings/ai-responses - Update AI response templates

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { AIResponses, AIResponseTemplates } from "@/types/ai-settings";
import { verifyAdminUser } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const adminUser = await verifyAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = adminUser.uid;
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
