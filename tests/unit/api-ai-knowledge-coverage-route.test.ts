// Verifies the AI knowledge coverage route enforces admin authorization before
// it reads through the service-role client (which bypasses RLS), and that it
// reports datastore failures as errors rather than fabricated coverage.

jest.mock("server-only", () => ({}), { virtual: true });

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockEq = jest.fn();
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockCreateAdminClient = jest.fn(() => ({ from: mockFrom }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

import { NextRequest } from "next/server";
import { GET as coverageGet } from "../../app/api/ai/knowledge/coverage/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/ai/knowledge/coverage");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAdminClient.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
});

describe("GET /api/ai/knowledge/coverage", () => {
  it("returns 401 and reads nothing when unauthorized", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "Unauthorized", reason: "missing_token" },
        { status: 401 }
      ),
    });

    const response = await coverageGet(makeRequest());
    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated caller without admin privilege", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "Forbidden", reason: "insufficient_role" },
        { status: 403 }
      ),
    });

    const response = await coverageGet(makeRequest());
    expect(response.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns coverage from Supabase for an authorized admin", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
    });
    mockEq.mockResolvedValue({
      data: [
        {
          id: "1",
          slug: "about",
          title: "About",
          category: "about",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const response = await coverageGet(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.summary.total).toBeGreaterThan(0);
    // The single approved "about" article must register as present.
    expect(body.data.coverage.find((c: { id: string }) => c.id === "about").status).toBe(
      "present"
    );
  });

  it("reports a datastore failure as 500, not fabricated coverage", async () => {
    mockRequireAdminUser.mockResolvedValue({
      ok: true,
      user: { uid: "admin-1", email: "a@b.c", role: "super_admin" },
    });
    mockEq.mockResolvedValue({ data: null, error: { message: "relation missing" } });

    const response = await coverageGet(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    // The safe message must not leak the raw database error.
    expect(JSON.stringify(body)).not.toContain("relation missing");
  });
});
