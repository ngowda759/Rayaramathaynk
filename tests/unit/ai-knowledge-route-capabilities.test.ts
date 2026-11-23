/**
 * @jest-environment node
 *
 * F-04.5: route-level proof that Raya AI administration and the knowledge
 * workflow use the real capability map. The identity verifier is stubbed;
 * `requireAdminCapability` and the role map run for real.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest } from "next/server";

const mockVerifyAdminUserResult = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminUserResult: (...args: unknown[]) => mockVerifyAdminUserResult(...args),
}));

const mockGetAISettings = jest.fn();
const mockUpdateGeneralSettings = jest.fn();
jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAISettings: (...a: unknown[]) => mockGetAISettings(...a),
    updateGeneralSettings: (...a: unknown[]) => mockUpdateGeneralSettings(...a),
  },
}));

const mockSubmitCommitteeVote = jest.fn();
const mockGetUserDrafts = jest.fn();
const mockDeleteDraft = jest.fn();
jest.mock("@/services/knowledge-workflow.service", () => ({
  submitCommitteeVote: (...a: unknown[]) => mockSubmitCommitteeVote(...a),
  getUserDrafts: (...a: unknown[]) => mockGetUserDrafts(...a),
  deleteDraft: (...a: unknown[]) => mockDeleteDraft(...a),
  saveDraft: jest.fn(),
}));

jest.mock("@/lib/ai/knowledge/types", () => ({}));

import { GET as aiSettingsGet, POST as aiSettingsPost } from "../../app/api/ai/settings/route";
import { POST as approvalsPost } from "../../app/api/knowledge/workflow/approvals/route";
import { DELETE as draftsDelete, GET as draftsGet } from "../../app/api/knowledge/workflow/drafts/route";

function verified(role: string) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: true,
    provider: "supabase",
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

function req(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAISettings.mockResolvedValue({ id: "main" });
  mockUpdateGeneralSettings.mockResolvedValue(undefined);
  mockSubmitCommitteeVote.mockResolvedValue(undefined);
  mockGetUserDrafts.mockResolvedValue([]);
  mockDeleteDraft.mockResolvedValue(undefined);
});

describe("AI settings", () => {
  test("priest may read AI settings", async () => {
    verified("priest");
    const response = await aiSettingsGet(req("GET", "http://localhost/api/ai/settings"));
    expect(response.status).toBe(200);
  });

  test("billing may not read AI settings", async () => {
    verified("billing");
    const response = await aiSettingsGet(req("GET", "http://localhost/api/ai/settings"));
    expect(response.status).toBe(403);
    expect(mockGetAISettings).not.toHaveBeenCalled();
  });

  test("priest may not write AI settings", async () => {
    verified("priest");
    const response = await aiSettingsPost(
      req("POST", "http://localhost/api/ai/settings", {
        action: "updateGeneralSettings",
        data: { name: "x" },
      }),
    );
    expect(response.status).toBe(403);
    expect(mockUpdateGeneralSettings).not.toHaveBeenCalled();
  });

  test("temple_admin may write AI settings", async () => {
    verified("temple_admin");
    const response = await aiSettingsPost(
      req("POST", "http://localhost/api/ai/settings", {
        action: "updateGeneralSettings",
        data: { name: "x" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mockUpdateGeneralSettings).toHaveBeenCalledWith({ name: "x" }, "uid-1");
  });
});

describe("knowledge approvals", () => {
  test("priest may not cast a committee vote (approve -> deny by default)", async () => {
    verified("priest");
    const response = await approvalsPost(
      req("POST", "http://localhost/api/knowledge/workflow/approvals", {
        approvalId: "a1",
        decision: "approve",
      }),
    );
    expect(response.status).toBe(403);
    expect(mockSubmitCommitteeVote).not.toHaveBeenCalled();
  });

  test("temple_admin may cast a committee vote as themselves", async () => {
    verified("temple_admin");
    const response = await approvalsPost(
      req("POST", "http://localhost/api/knowledge/workflow/approvals", {
        approvalId: "a1",
        decision: "approve",
      }),
    );
    expect(response.status).toBe(200);
    expect(mockSubmitCommitteeVote).toHaveBeenCalledWith(
      "a1",
      "uid-1",
      "admin@example.com",
      "approve",
      undefined,
    );
  });
});

describe("knowledge drafts", () => {
  test("staff may read their drafts", async () => {
    verified("staff");
    const response = await draftsGet(req("GET", "http://localhost/api/knowledge/workflow/drafts"));
    expect(response.status).toBe(200);
    expect(mockGetUserDrafts).toHaveBeenCalledWith("uid-1");
  });

  test("office_staff may not read drafts", async () => {
    verified("office_staff");
    const response = await draftsGet(req("GET", "http://localhost/api/knowledge/workflow/drafts"));
    expect(response.status).toBe(403);
  });

  test("staff may not delete a draft", async () => {
    verified("staff");
    const response = await draftsDelete(
      req("DELETE", "http://localhost/api/knowledge/workflow/drafts?draftId=d1"),
    );
    expect(response.status).toBe(403);
    expect(mockDeleteDraft).not.toHaveBeenCalled();
  });

  test("temple_admin may delete a draft", async () => {
    verified("temple_admin");
    const response = await draftsDelete(
      req("DELETE", "http://localhost/api/knowledge/workflow/drafts?draftId=d1"),
    );
    expect(response.status).toBe(200);
    expect(mockDeleteDraft).toHaveBeenCalledWith("d1");
  });
});
