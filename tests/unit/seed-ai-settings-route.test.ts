import { NextRequest } from "next/server";

jest.mock("server-only", () => ({}), { virtual: true });

const mockMaybeSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
let lastUpdatePayload: Record<string, unknown> | null = null;

const mockFrom = jest.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
  insert: (rows: unknown) => mockInsert(rows),
  update: (vals: Record<string, unknown>) => {
    lastUpdatePayload = vals;
    mockUpdate(vals);
    return { eq: () => Promise.resolve({ error: null }) };
  },
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/raya-admin-auth", () => ({
  requireRayaAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

jest.mock("@/lib/ai/ai-settings/seed-data", () => ({
  getDefaultSeedPayload: () => ({
    id: "main",
    general: { name: "Default" },
    safety: { level: "standard" },
    extended_behavior: { tone: "respectful" },
    temple_information: { timings: { morning: "6am" } },
    visitor_information: { guidelines: "welcome" },
    temple_policies: { dressCode: "traditional" },
    ai_responses: { greeting: "Namaste" },
    ai_behavior: { confidence: 0.7 },
    prompt: { defaultPrompt: "You are Raya." },
    intents: { intents: [{ name: "greet" }] },
  }),
}));

import { POST } from "../../app/api/seed-ai-settings/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/seed-ai-settings", {
    method: "POST",
  });
}

const authorized = {
  ok: true as const,
  user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
};

beforeEach(() => {
  jest.clearAllMocks();
  lastUpdatePayload = null;
  mockInsert.mockResolvedValue({ error: null });
});

describe("POST /api/seed-ai-settings", () => {
  it("never seeds when the request is unauthorized", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("initializes defaults when no record exists", async () => {
    mockRequireAdminUser.mockResolvedValue(authorized);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toBe("initialized");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const inserted = mockInsert.mock.calls[0][0][0];
    expect(inserted.updated_by).toBe("admin-1");
    expect(body.sections.templeInformation.status).toBe("initialized");
  });

  it("is idempotent: does nothing when the record is complete", async () => {
    mockRequireAdminUser.mockResolvedValue(authorized);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "main",
        general: { name: "Custom" },
        safety: { level: "standard" },
        extended_behavior: { tone: "respectful" },
        temple_information: { timings: { morning: "6am" } },
        visitor_information: { guidelines: "welcome" },
        temple_policies: { dressCode: "traditional" },
        ai_responses: { greeting: "Namaste" },
        ai_behavior: { confidence: 0.7 },
        prompt: { defaultPrompt: "custom" },
        intents: { intents: [{ name: "greet" }] },
      },
      error: null,
    });

    const response = await POST(makeRequest());
    const body = await response.json();
    expect(body.outcome).toBe("already_present");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(body.sections.general.status).toBe("already_present");
  });

  it("repairs only the missing section and preserves existing values", async () => {
    mockRequireAdminUser.mockResolvedValue(authorized);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "main",
        general: { name: "CUSTOM NAME" },
        safety: { level: "standard" },
        extended_behavior: { tone: "respectful" },
        temple_information: null, // missing
        visitor_information: { guidelines: "welcome" },
        temple_policies: { dressCode: "traditional" },
        ai_responses: { greeting: "Namaste" },
        ai_behavior: { confidence: 0.7 },
        prompt: { defaultPrompt: "custom" },
        intents: { intents: [{ name: "greet" }] },
      },
      error: null,
    });

    const response = await POST(makeRequest());
    const body = await response.json();
    expect(body.outcome).toBe("repaired");
    expect(body.sections.templeInformation.status).toBe("repaired");
    expect(body.sections.general.status).toBe("already_present");

    // Only the missing column is written, and the customized value is untouched.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(lastUpdatePayload).toHaveProperty("temple_information");
    expect(lastUpdatePayload).not.toHaveProperty("general");
    expect(lastUpdatePayload?.general).toBeUndefined();
  });

  it("returns 500 (not success) when the datastore write fails", async () => {
    mockRequireAdminUser.mockResolvedValue(authorized);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: { message: "db down" } });

    const response = await POST(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
