// Tests for the AI behavior settings write path (P2.6/P2.7).
//
// The route used to default `confidenceThreshold` to the literal `85` while the
// persisted schema expects a 0-1 ratio, and it wrote without validation. A saved
// `85` then failed the read path's zod parse and silently reset the assistant to
// non-persisted defaults. These tests pin the 0-1 representation and the rejection
// of out-of-scale input.

jest.mock("server-only", () => ({}), { virtual: true });

const getAIBehavior = jest.fn();
const setConfidenceThreshold = jest.fn();
const updateAIBehavior = jest.fn();

jest.mock("@/lib/ai/ai-settings", () => ({
  aiSettingsService: {
    getAIBehavior: (...args: unknown[]) => getAIBehavior(...args),
    setConfidenceThreshold: (...args: unknown[]) => setConfidenceThreshold(...args),
    updateAIBehavior: (...args: unknown[]) => updateAIBehavior(...args),
    setDebugMode: jest.fn(),
    setStreamingResponses: jest.fn(),
  },
}));

jest.mock("@/lib/auth/raya-admin-auth", () => ({
  requireRayaAdminUser: jest.fn(() =>
    Promise.resolve({ ok: true, user: { uid: "admin-1" } })
  ),
}));

import { PUT } from "@/app/api/ai/settings/ai-behavior/route";
import { NextRequest } from "next/server";

const storedBehavior = {
  confidenceThreshold: 0.85,
  semanticThreshold: 0.7,
  maxRelatedArticles: 3,
  conversationTimeout: 30,
  streaming: false,
  debugMode: false,
  unknownLogging: true,
};

function putRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.test/api/ai/settings/ai-behavior", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getAIBehavior.mockResolvedValue({ ...storedBehavior });
});

describe("PUT /api/ai/settings/ai-behavior — confidenceThreshold", () => {
  it("accepts a 0-1 confidenceThreshold (0.85)", async () => {
    const response = await PUT(putRequest({ setting: "confidenceThreshold", value: 0.85 }));

    expect(response.status).toBe(200);
    expect(setConfidenceThreshold).toHaveBeenCalledWith(0.85, "admin-1");
  });

  it("rejects a percentage confidenceThreshold (85) instead of coercing it", async () => {
    const response = await PUT(putRequest({ setting: "confidenceThreshold", value: 85 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/confidenceThreshold/i);
    expect(setConfidenceThreshold).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric confidenceThreshold", async () => {
    const response = await PUT(putRequest({ setting: "confidenceThreshold", value: "high" }));

    expect(response.status).toBe(400);
    expect(setConfidenceThreshold).not.toHaveBeenCalled();
  });
});

describe("PUT /api/ai/settings/ai-behavior — bulk 'all' update", () => {
  it("defaults to the 0-1 scale when the field is omitted", async () => {
    const response = await PUT(
      putRequest({ setting: "all", data: { semanticThreshold: 0.7, maxRelatedArticles: 4 } })
    );

    expect(response.status).toBe(200);
    const [payload] = updateAIBehavior.mock.calls[0];
    expect(payload.confidenceThreshold).toBe(0.85);
    expect(payload.semanticThreshold).toBe(0.7);
  });

  it("rejects a bulk payload containing a percentage threshold", async () => {
    const response = await PUT(
      putRequest({ setting: "all", data: { confidenceThreshold: 85, semanticThreshold: 70 } })
    );

    expect(response.status).toBe(400);
    expect(updateAIBehavior).not.toHaveBeenCalled();
  });

  it("accepts a valid bulk payload", async () => {
    const response = await PUT(
      putRequest({
        setting: "all",
        data: { confidenceThreshold: 0.7, semanticThreshold: 0.6, maxRelatedArticles: 3 },
      })
    );

    expect(response.status).toBe(200);
    expect(updateAIBehavior).toHaveBeenCalledTimes(1);
    const [payload] = updateAIBehavior.mock.calls[0];
    expect(payload.confidenceThreshold).toBe(0.7);
  });
});
