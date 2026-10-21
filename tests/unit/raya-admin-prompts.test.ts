import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { POST } from "../../app/api/ai/settings/prompts/route";
import { NextRequest } from "next/server";
import { aiSettingsService } from "../../lib/ai/ai-settings";
import { requireRayaAdminUser } from "../../lib/auth/raya-admin-auth";

jest.mock("../../lib/auth/raya-admin-auth", () => ({
  requireRayaAdminUser: jest.fn(),
}));

jest.mock("../../lib/ai/ai-settings", () => ({
  aiSettingsService: {
    createPromptVersion: jest.fn(),
  },
}));

describe("POST /api/ai/settings/prompts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a prompt when authorized", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.createPromptVersion as jest.Mock).mockResolvedValue("prompt_v1_123");

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({
        content: "New Master Prompt",
        name: "Test Prompt",
        status: "draft",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.versionId).toBe("prompt_v1_123");
    expect(json.name).toBe("Test Prompt");

    expect(aiSettingsService.createPromptVersion).toHaveBeenCalledWith(
      "New Master Prompt",
      "admin-uid",
      undefined,
      "Test Prompt",
      "draft"
    );
  });

  it("should reject unauthorized users", async () => {
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
    });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({
        content: "New Master Prompt",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(aiSettingsService.createPromptVersion).not.toHaveBeenCalled();
  });

  it("should require content", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({
        name: "Missing Content",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Content is required");
    expect(aiSettingsService.createPromptVersion).not.toHaveBeenCalled();
  });
});
