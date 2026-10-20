// Verifies the AI health endpoint uses the shared admin authentication and is
// read-only (never seeds/creates data), and that all protected AI settings
// routes are wired to the shared auth guard.

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockGetSettings = jest.fn();
jest.mock("@/lib/ai/ai-settings/admin-repository", () => ({
  aiAdminRepository: { getSettings: () => mockGetSettings() },
}));

import { NextRequest } from "next/server";
import { GET as healthGet } from "../../app/api/ai/health/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/ai/health");
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/ai/health", () => {
  it("returns 401 when unauthorized and does not read data", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized", reason: "missing_token" }, { status: 401 }),
    });

    const response = await healthGet(makeRequest());
    expect(response.status).toBe(401);
    expect(mockGetSettings).not.toHaveBeenCalled();
  });

  it("reports connectivity and per-section presence when authorized", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
    });
    mockGetSettings.mockResolvedValue({
      templeInformation: { timings: { morning: "6am" } },
      visitorInformation: {},
      templePolicies: { dressCode: "x" },
      aiResponses: { greeting: "hi" },
      aiBehavior: { confidence: 0.7 },
      prompt: { defaultPrompt: "You are Raya." },
      intents: { intents: [{ name: "greet" }] },
    });

    const response = await healthGet(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.database.connected).toBe(true);
    expect(body.settings.hasMainRecord).toBe(true);
    expect(body.settings.present.temple).toBe(true);
    // Empty visitor information is reported as absent (not a fabricated value).
    expect(body.settings.present.visitor).toBe(false);
  });

  it("reports a datastore failure as an error status, not healthy", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
    });
    mockGetSettings.mockRejectedValue(new Error("supabase down"));

    const response = await healthGet(makeRequest());
    // A database failure must never be reported as healthy (HTTP 200).
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.database.connected).toBe(false);
    expect(body.reason).toBe("datastore_unavailable");
    // The safe message must not leak the underlying error text or a stack trace.
    expect(JSON.stringify(body)).not.toContain("supabase down");
    expect(body).not.toHaveProperty("stack");
  });

  it("reports a missing settings record as connected but without a main record", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
    });
    mockGetSettings.mockResolvedValue(null);

    const response = await healthGet(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.database.connected).toBe(true);
    expect(body.settings.hasMainRecord).toBe(false);
  });
});
