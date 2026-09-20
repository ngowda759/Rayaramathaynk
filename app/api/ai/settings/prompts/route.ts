// Prompt Management API Route
// GET /api/ai/settings/prompts - Get prompt versions
// POST /api/ai/settings/prompts - Create new prompt version
// PUT /api/ai/settings/prompts - Update prompt version

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { verifyAdminUser } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminUser(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const promptVersions = await aiSettingsService.getPromptVersions();
    const currentPrompt = await aiSettingsService.getCurrentPrompt();
    const promptSettings = await aiSettingsService.getPromptSettings();
    return NextResponse.json({
      versions: promptVersions,
      currentPrompt,
      currentPromptId: promptSettings.currentPromptId,
    });
  } catch (error) {
    console.error("Error fetching prompt versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt versions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = adminUser.uid;
    const body = await request.json();
    const { name, content, status, changeNotes } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const versionId = await aiSettingsService.createPromptVersion(
      content,
      userId,
      changeNotes,
      name,
      status
    );

    return NextResponse.json({ 
      versionId, 
      name,
      message: `Prompt "${name || 'New Prompt'}" created successfully` 
    });
  } catch (error) {
    console.error("Error creating prompt version:", error);
    const message = error instanceof Error ? error.message : "Failed to create prompt version";
    return NextResponse.json(
      { error: message },
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
    const { versionId, action, ...updates } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: "Version ID is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "update":
        await aiSettingsService.updatePromptVersion(versionId, updates, userId);
        break;
      case "publish":
        await aiSettingsService.publishPromptVersion(versionId, userId);
        break;
      case "rollback":
        await aiSettingsService.rollbackPromptVersion(versionId, userId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const promptVersions = await aiSettingsService.getPromptVersions();
    return NextResponse.json({
      versions: promptVersions,
      message: `Prompt version ${action} successful`,
    });
  } catch (error) {
    console.error("Error updating prompt version:", error);
    return NextResponse.json(
      { error: "Failed to update prompt version" },
      { status: 500 }
    );
  }
}
