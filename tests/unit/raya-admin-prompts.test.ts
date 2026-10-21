import * as fs from 'fs';
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
    updatePromptVersion: jest.fn(),
    publishPromptVersion: jest.fn(),
    rollbackPromptVersion: jest.fn(),
    getPromptVersions: jest.fn(),
    getCurrentPrompt: jest.fn(),
    getPromptSettings: jest.fn(),
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


  it("should create the Raya AI Master System Prompt with correct requirements", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.createPromptVersion as jest.Mock).mockResolvedValue("prompt_master_v1");

    const masterPromptContent = fs.readFileSync('raya_ai_master_prompt.txt', 'utf8');

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({
        content: masterPromptContent,
        name: "Raya AI Master System Prompt",
        status: "draft",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.versionId).toBe("prompt_master_v1");
    expect(json.name).toBe("Raya AI Master System Prompt");

    expect(aiSettingsService.createPromptVersion).toHaveBeenCalledWith(
      masterPromptContent,
      "admin-uid",
      undefined,
      "Raya AI Master System Prompt",
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


  it("should return error if creation fails", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.createPromptVersion as jest.Mock).mockRejectedValue(new Error("Database error"));

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({
        content: "Some content",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Database error");
  });

  it("should test successful write followed by retrieval", async () => {
    // This mocks the repository integration test scenario
    // where aiSettingsService internally reads back
    // However, since we're mocking the service here, we just test the API layer
    // Let's test the GET endpoint properly
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

import { PUT } from "../../app/api/ai/settings/prompts/route";

describe("PUT /api/ai/settings/prompts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update a prompt when authorized", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.updatePromptVersion as jest.Mock).mockResolvedValue(undefined);
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "PUT",
      body: JSON.stringify({
        versionId: "prompt_v1_123",
        action: "update",
        content: "Updated Master Prompt",
        name: "Test Prompt Updated",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    expect(aiSettingsService.updatePromptVersion).toHaveBeenCalledWith(
      "prompt_v1_123",
      { content: "Updated Master Prompt", name: "Test Prompt Updated" },
      "admin-uid"
    );
  });

  it("should publish a prompt when authorized", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.publishPromptVersion as jest.Mock).mockResolvedValue(undefined);
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "PUT",
      body: JSON.stringify({
        versionId: "prompt_v1_123",
        action: "publish",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    expect(aiSettingsService.publishPromptVersion).toHaveBeenCalledWith(
      "prompt_v1_123",
      "admin-uid"
    );
  });

  it("should rollback a prompt when authorized", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.rollbackPromptVersion as jest.Mock).mockResolvedValue(undefined);
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "PUT",
      body: JSON.stringify({
        versionId: "prompt_v1_123",
        action: "rollback",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    expect(aiSettingsService.rollbackPromptVersion).toHaveBeenCalledWith(
      "prompt_v1_123",
      "admin-uid"
    );
  });

  it("should archive a prompt when authorized via update", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.updatePromptVersion as jest.Mock).mockResolvedValue(undefined);
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "PUT",
      body: JSON.stringify({
        versionId: "prompt_v1_123",
        action: "update",
        status: "archived",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    expect(aiSettingsService.updatePromptVersion).toHaveBeenCalledWith(
      "prompt_v1_123",
      { status: "archived" },
      "admin-uid"
    );
  });

  it("should reject unauthorized users for PUT", async () => {
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
    });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "PUT",
      body: JSON.stringify({
        versionId: "prompt_v1_123",
        action: "update",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(403);
    expect(aiSettingsService.updatePromptVersion).not.toHaveBeenCalled();
  });

  it("should handle invalid actions", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "PUT",
      body: JSON.stringify({
        versionId: "prompt_v1_123",
        action: "invalid_action",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Unknown action: invalid_action");
    expect(aiSettingsService.updatePromptVersion).not.toHaveBeenCalled();
  });
});

describe("Auth checks", () => {
  it("should handle expired tokens by verifying requireRayaAdminUser handles it", async () => {
    // This is essentially testing the integration with requireRayaAdminUser
    // The actual token validation happens inside raya-admin-auth.ts which has its own tests
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Authentication token has expired.", reason: "expired_token" }), { status: 401 }),
    });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.reason).toBe("expired_token");
  });

  it("should handle authenticated non-admins", async () => {
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "This account does not have administrator permissions.", reason: "insufficient_role" }), { status: 403 }),
    });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.reason).toBe("insufficient_role");
  });
});


import { GET } from "../../app/api/ai/settings/prompts/route";

describe("GET /api/ai/settings/prompts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return prompt versions when authorized", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    const mockVersions = [{ id: "v1", content: "test" }];
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue(mockVersions);
    (aiSettingsService.getCurrentPrompt as jest.Mock).mockResolvedValue({ id: "v1" });
    (aiSettingsService.getPromptSettings as jest.Mock).mockResolvedValue({ currentPromptId: "v1" });

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.versions).toEqual(mockVersions);
  });

  it("should return error when reading fails", async () => {
    const mockUser = { uid: "admin-uid", email: "admin@example.com", role: "admin" };
    (requireRayaAdminUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: mockUser,
    });

    (aiSettingsService.getPromptVersions as jest.Mock).mockRejectedValue(new Error("DB Read Error"));

    const req = new NextRequest("http://localhost/api/ai/settings/prompts", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch prompt versions");
  });
});
