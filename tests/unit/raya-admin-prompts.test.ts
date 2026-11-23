import * as fs from 'fs';
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { DELETE, POST } from "../../app/api/ai/settings/prompts/route";
import { NextRequest } from "next/server";
import { aiSettingsService } from "../../lib/ai/ai-settings";
import { PromptVersionDeleteError } from "../../lib/ai/ai-settings/prompt-errors";
import { requireAdminCapability } from "../../lib/auth/admin-capabilities";

jest.mock("../../lib/auth/admin-capabilities", () => ({
  requireAdminCapability: jest.fn(),
}));

jest.mock("../../lib/ai/ai-settings", () => ({
  aiSettingsService: {
    createPromptVersion: jest.fn(),
    updatePromptVersion: jest.fn(),
    publishPromptVersion: jest.fn(),
    rollbackPromptVersion: jest.fn(),
    deletePromptVersion: jest.fn(),
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
  it("should handle expired tokens by verifying requireAdminCapability handles it", async () => {
    // This is essentially testing the integration with requireAdminCapability
    // The actual token validation happens inside raya-admin-auth.ts which has its own tests
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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
    (requireAdminCapability as jest.Mock).mockResolvedValue({
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

describe("DELETE /api/ai/settings/prompts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const version = {
    id: "prompt_v2",
    name: "Draft",
    version: 2,
    content: "text",
    status: "draft" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "admin-uid",
  };

  function makeRequest(versionId?: string) {
    const url = versionId
      ? `http://localhost/api/ai/settings/prompts?versionId=${versionId}`
      : "http://localhost/api/ai/settings/prompts";
    return new NextRequest(url, { method: "DELETE" });
  }

  function authorize() {
    (requireAdminCapability as jest.Mock).mockResolvedValue({
      ok: true,
      user: { uid: "admin-uid", email: "admin@example.com", role: "admin" },
    });
  }

  it("deletes only the selected version and returns the refreshed list", async () => {
    authorize();
    (aiSettingsService.deletePromptVersion as jest.Mock).mockResolvedValue(undefined);
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue([version]);

    const res = await DELETE(makeRequest("prompt_v2"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.versions).toEqual([version]);
    expect(aiSettingsService.deletePromptVersion).toHaveBeenCalledWith(
      "prompt_v2",
      "admin-uid"
    );
  });

  it("rejects the request before touching data when unauthorized", async () => {
    (requireAdminCapability as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized", reason: "missing_token" }), { status: 401 }),
    });

    const res = await DELETE(makeRequest("prompt_v2"));
    expect(res.status).toBe(401);
    expect(aiSettingsService.deletePromptVersion).not.toHaveBeenCalled();
    expect(aiSettingsService.getPromptVersions).not.toHaveBeenCalled();
  });

  it("refuses to delete the active prompt with 409", async () => {
    authorize();
    (aiSettingsService.deletePromptVersion as jest.Mock).mockRejectedValue(
      new PromptVersionDeleteError("in_use", "This is the active prompt.")
    );

    const res = await DELETE(makeRequest("prompt_v1_seed"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.reason).toBe("in_use");
  });

  it("returns 404 for an unknown version", async () => {
    authorize();
    (aiSettingsService.deletePromptVersion as jest.Mock).mockRejectedValue(
      new PromptVersionDeleteError("not_found", "Prompt version not found")
    );

    const res = await DELETE(makeRequest("does_not_exist"));
    expect(res.status).toBe(404);
  });

  it("requires a versionId", async () => {
    authorize();
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(400);
    expect(aiSettingsService.deletePromptVersion).not.toHaveBeenCalled();
  });

  it("surfaces a failed delete as 500 without a success payload", async () => {
    authorize();
    (aiSettingsService.deletePromptVersion as jest.Mock).mockRejectedValue(
      new Error("write failed")
    );
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await DELETE(makeRequest("prompt_v2"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to delete prompt version");
    expect(json.versions).toBeUndefined();
    consoleError.mockRestore();
  });

  it("does not claim success when the repository throws", async () => {
    authorize();
    (aiSettingsService.deletePromptVersion as jest.Mock).mockRejectedValue(
      new Error("boom")
    );
    (aiSettingsService.getPromptVersions as jest.Mock).mockResolvedValue([version]);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await DELETE(makeRequest("prompt_v2"));
    expect(res.status).toBe(500);
    expect(aiSettingsService.getPromptVersions).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
