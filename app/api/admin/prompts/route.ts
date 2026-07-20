// Prompt Management API Route for Admin
// Proxies to /api/ai/settings/prompts with admin wrapper

import { NextRequest, NextResponse } from "next/server";
import { aiSettingsService } from "@/lib/ai/ai-settings";

// Environment variable for admin API key (optional additional auth)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// Helper to verify admin access
function verifyAdmin(request: Request): boolean {
  // In production, you would verify Firebase ID token here
  // For now, allow if no restriction or if admin API key matches
  if (process.env.NODE_ENV === "production" && ADMIN_API_KEY) {
    const apiKey = request.headers.get("x-admin-api-key");
    return apiKey === ADMIN_API_KEY;
  }
  return true;
}

/**
 * GET /api/admin/prompts
 * Get all prompt versions and current prompt
 */
export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const promptVersions = await aiSettingsService.getPromptVersions();
    const currentPrompt = await aiSettingsService.getCurrentPrompt();
    const promptSettings = await aiSettingsService.getPromptSettings();

    return NextResponse.json({
      success: true,
      versions: promptVersions,
      currentPrompt,
      currentPromptId: promptSettings?.currentPromptId,
      count: promptVersions.length,
    });
  } catch (error) {
    console.error("Error fetching prompt versions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prompt versions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/prompts
 * Create a new prompt version
 * Body: { content, name?, changeNotes?, status? }
 */
export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const body = await request.json();
    const { content, name, changeNotes, status } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content is required" },
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
      success: true,
      versionId,
      name: name || "New Prompt",
      message: "Prompt version created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating prompt version:", error);
    const message = error instanceof Error ? error.message : "Failed to create prompt";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/prompts
 * Update or publish prompt versions
 * Body: { versionId, action: "update" | "publish" | "rollback", ...updates }
 */
export async function PUT(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = request.headers.get("x-user-id") || "admin";
    const body = await request.json();
    const { versionId, action, ...updates } = body;

    if (!versionId) {
      return NextResponse.json(
        { success: false, error: "Version ID is required" },
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
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const promptVersions = await aiSettingsService.getPromptVersions();

    return NextResponse.json({
      success: true,
      versions: promptVersions,
      message: `Prompt version ${action} successful`,
    });
  } catch (error) {
    console.error("Error updating prompt version:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update prompt version" },
      { status: 500 }
    );
  }
}
