/**
 * @jest-environment node
 *
 * Supabase-only admin authentication. Supabase Auth is the only identity
 * provider: a token Supabase rejects is refused outright, with no fallback to
 * any other provider. `public.users` (keyed by `auth_user_id`) is the only
 * authorization source.
 */

import { NextRequest } from "next/server";
import {
  verifyAdminUserResult,
  requireAdminUser,
} from "../../lib/auth/admin-auth";

jest.mock("server-only", () => ({}), { virtual: true });

const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockCreateAdminClient = jest.fn(() => ({
  from: mockFrom,
  auth: { getUser: mockGetUser },
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

function makeRequest(authHeader: string | null) {
  return {
    headers: {
      get: jest.fn((name: string) =>
        name.toLowerCase() === "authorization" ? authHeader : null
      ),
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAdminClient.mockReturnValue({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  });
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
});

describe("Supabase Admin Auth — Primary Path (Supabase Auth)", () => {
  it("authenticates a valid Supabase admin and labels provider as supabase", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-admin-uuid-1", email: "sb.admin@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "super_admin", active: true, email: "sb.admin@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-valid-jwt"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("supabase");
      expect(result.user).toEqual({
        uid: "sb-admin-uuid-1",
        email: "sb.admin@example.org",
        role: "super_admin",
        provider: "supabase",
      });
    }

    // Looked up by auth_user_id
    expect(mockEq).toHaveBeenCalledWith("auth_user_id", "sb-admin-uuid-1");
  });

  it("refuses an inactive Supabase user with inactive_user (403)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-inactive-uuid", email: "inactive@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", active: false, email: "inactive@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-jwt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("inactive_user");
      expect(result.status).toBe(403);
    }
  });

  it("refuses a Supabase user with insufficient role with 403", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-devotee-uuid", email: "devotee@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee@example.org" },
      error: null,
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-jwt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_role");
      expect(result.status).toBe(403);
    }
  });

  it("refuses a Supabase user missing a public.users authorization row with user_not_found (403)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-unmapped-uuid", email: "unmapped@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-jwt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("user_not_found");
      expect(result.status).toBe(403);
    }
  });

  it("strictly prevents privilege escalation: an unauthorized or inactive Supabase identity is never retried", async () => {
    // 1. Inactive Supabase user with bearer token
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-inactive-uuid-2", email: "inactive2@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", active: false, email: "inactive2@example.org" },
      error: null,
    });

    const inactiveResult = await verifyAdminUserResult(makeRequest("Bearer sb-inactive-token"));
    expect(inactiveResult.ok).toBe(false);
    expect(inactiveResult.ok ? null : inactiveResult.reason).toBe("inactive_user");

    // 2. Devotee role Supabase user with bearer token
    mockGetUser.mockResolvedValue({
      data: { user: { id: "sb-devotee-uuid-2", email: "devotee2@example.org" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "devotee", active: true, email: "devotee2@example.org" },
      error: null,
    });

    const nonAdminResult = await verifyAdminUserResult(makeRequest("Bearer sb-devotee-token"));
    expect(nonAdminResult.ok).toBe(false);
    expect(nonAdminResult.ok ? null : nonAdminResult.reason).toBe("insufficient_role");
  });

  it("identifies expired Supabase token and returns expired_token (401)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired: token has expired at 1700000000" },
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-expired-token"));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.reason).toBe("expired_token");
    expect(result.ok ? null : result.status).toBe(401);
  });
});

describe("Supabase Admin Auth — No fallback path", () => {
  it("refuses a token Supabase rejects: no second provider is consulted", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT token" },
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer not-a-supabase-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_token");
      expect(result.status).toBe(401);
    }
    // The authorization table must never be queried for a token that failed verification.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns auth_unavailable (503) when Supabase Auth cannot answer (5xx)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "upstream unavailable", status: 503 },
    });

    const result = await verifyAdminUserResult(makeRequest("Bearer sb-token"));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.reason).toBe("auth_unavailable");
    expect(result.ok ? null : result.status).toBe(503);
  });
});

describe("Supabase Admin Auth — Common Security Controls", () => {
  it("rejects missing authorization header with missing_token (401)", async () => {
    const result = await verifyAdminUserResult(makeRequest(null));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_token");
      expect(result.status).toBe(401);
    }
  });

  it("rejects non-Bearer scheme with missing_token (401)", async () => {
    const result = await verifyAdminUserResult(makeRequest("Custom xyz"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_token");
      expect(result.status).toBe(401);
    }
  });

  it("does not leak secret tokens in the rejection response of requireAdminUser", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const secretToken = "super-sensitive-secret-token-12345";
    const res = await requireAdminUser(makeRequest(`Bearer ${secretToken}`));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const body = await res.response.json();
      expect(JSON.stringify(body)).not.toContain(secretToken);
    }
  });
});
