/**
 * app/auth/callback/route.ts — the PKCE callback.
 *
 * Covers the four things that can go wrong on an attacker-controlled request, and the one that can
 * go wrong on a legitimate one:
 *
 *  - no `code` / a provider error  → a coarse redirect, never a 500;
 *  - a failed or throwing exchange → a coarse redirect, never a token in the URL;
 *  - an off-site `next`            → `/`, so the route is not an open redirect;
 *  - provisioning                  → devotee-only creation, refusals never claim a row.
 */

import { NextRequest } from "next/server";

const mockExchangeCodeForSession = jest.fn();
const mockCreateServerClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateServerClient(),
}));

const mockProvisionDevoteeRow = jest.fn();
jest.mock("@/lib/auth/provisioning", () => ({
  ...jest.requireActual("@/lib/auth/provisioning"),
  provisionDevoteeRow: (...args: unknown[]) => mockProvisionDevoteeRow(...args),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: jest.fn() }),
}));

import { GET } from "@/app/auth/callback/route";

const ORIGIN = "https://www.srsmathaynk.com";
const UID = "8f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b";
const EMAIL = "devotee@example.test";

function callbackRequest(query: string): NextRequest {
  return new NextRequest(`${ORIGIN}/auth/callback${query}`);
}

function exchangeReturns(user: Record<string, unknown> | null, error: unknown = null) {
  mockCreateServerClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => {
        mockExchangeCodeForSession(...args);
        return Promise.resolve({ data: { user, session: user ? { access_token: "secret-token" } : null }, error });
      },
    },
  });
}

function locationOf(response: Response): URL {
  return new URL(response.headers.get("location") ?? "");
}

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN = "true";
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN;
  else process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN = ORIGINAL_FLAG;
});

describe("feature flag", () => {
  it("does not exchange a code while Google sign-in is disabled", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN;
    exchangeReturns({ id: UID, email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z" });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(locationOf(response).pathname).toBe("/login");
    expect(locationOf(response).searchParams.get("error")).toBe("provider_error");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockProvisionDevoteeRow).not.toHaveBeenCalled();
  });

  it("treats any value other than 'true' as disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN = "1";

    const response = await GET(callbackRequest("?code=abc123"));

    expect(response.status).toBe(307);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("origin validation", () => {
  it("refuses to answer on a host that is not allow-listed", async () => {
    const response = await GET(new NextRequest("https://evil.example/auth/callback?code=abc123"));

    expect(response.status).toBe(400);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("rejecting bad callback input", () => {
  it("redirects to /login with a coarse error when the code is missing", async () => {
    const response = await GET(callbackRequest(""));

    expect(response.status).toBe(307);
    const location = locationOf(response);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("missing_code");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects with a coarse error when the provider reported one, without exchanging anything", async () => {
    const response = await GET(callbackRequest("?error=access_denied&error_description=user+denied&code=abc"));

    expect(response.status).toBe(307);
    const location = locationOf(response);
    expect(location.searchParams.get("error")).toBe("provider_error");
    // The provider's own text is not relayed.
    expect(response.headers.get("location")).not.toMatch(/access_denied|user\+denied/);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("never 500s and never leaks the code when the exchange fails", async () => {
    exchangeReturns(null, { message: "invalid grant for code abc123", code: "invalid_grant" });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(response.status).toBe(307);
    const location = locationOf(response);
    expect(location.searchParams.get("error")).toBe("exchange_failed");
    expect(response.headers.get("location")).not.toMatch(/abc123|invalid_grant|secret-token/);
  });

  it("never 500s when the exchange throws", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: () => {
          throw new Error("network down for code abc123");
        },
      },
    });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(response.status).toBe(307);
    expect(locationOf(response).searchParams.get("error")).toBe("exchange_failed");
    expect(response.headers.get("location")).not.toMatch(/abc123|network down/);
  });

  it("treats an exchange that yields no identity as a failure", async () => {
    exchangeReturns(null);

    const response = await GET(callbackRequest("?code=abc123"));

    expect(locationOf(response).searchParams.get("error")).toBe("exchange_failed");
    expect(mockProvisionDevoteeRow).not.toHaveBeenCalled();
  });
});

describe("open-redirect protection", () => {
  beforeEach(() => {
    exchangeReturns({ id: UID, email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z" });
    mockProvisionDevoteeRow.mockResolvedValue({
      status: "linked",
      row: { id: "row-1", auth_user_id: UID },
    });
  });

  it.each([
    ["an absolute external URL", "https%3A%2F%2Fevil.example"],
    ["an http URL", "http%3A%2F%2Fevil.example"],
    ["a protocol-relative URL", "%2F%2Fevil.example"],
    ["a triple-slash URL", "%2F%2F%2Fevil.example"],
    ["a javascript: URL", "javascript%3Aalert(1)"],
    ["a data: URL", "data%3Atext%2Fhtml%2C%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["a backslash trick", "%2F%5Cevil.example"],
    ["a double-backslash trick", "%5C%5Cevil.example"],
    ["a dot segment that normalises to //host", "%2F.%2F%2Fevil.example"],
    ["a dot-dot path that escapes via //host", "%2Fseva%2F..%2F..%2F%2Fevil.example"],
    ["a double-encoded protocol-relative URL", "%2F%252F%252Fevil.example"],
    ["a control character", "%2Fseva%00"],
  ])("does not follow %s after a successful sign-in", async (_label, encodedNext) => {
    const response = await GET(callbackRequest(`?code=abc123&next=${encodedNext}`));

    expect(response.status).toBe(307);
    const location = locationOf(response);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/");
    expect(location.search).toBe("");
    expect(location.hash).toBe("");
  });

  it("follows an approved internal path", async () => {
    const response = await GET(callbackRequest("?code=abc123&next=%2Fprofile"));

    expect(locationOf(response).pathname).toBe("/profile");
  });

  it("preserves an internal path with a query string", async () => {
    const response = await GET(callbackRequest("?code=abc123&next=%2Fseva%3Fstatus%3Dchanged"));

    const location = locationOf(response);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/seva");
    expect(location.search).toBe("?status=changed");
  });

  it("preserves an internal path with a fragment", async () => {
    const response = await GET(callbackRequest("?code=abc123&next=%2Fprofile%23bookings"));

    const location = locationOf(response);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe("/profile");
    expect(location.hash).toBe("#bookings");
  });

  it("lands on / when no next is given", async () => {
    const response = await GET(callbackRequest("?code=abc123"));

    expect(locationOf(response).pathname).toBe("/");
  });

  it("lands on / when next is empty", async () => {
    const response = await GET(callbackRequest("?code=abc123&next="));

    expect(locationOf(response).pathname).toBe("/");
  });
});

describe("provisioning on a successful exchange", () => {
  it("exchanges the code and provisions the verified Supabase user", async () => {
    exchangeReturns({
      id: UID,
      email: EMAIL,
      email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: { full_name: "Devotee" },
    });
    mockProvisionDevoteeRow.mockResolvedValue({ status: "created", row: { id: "row-1", auth_user_id: UID } });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(mockProvisionDevoteeRow).toHaveBeenCalledTimes(1);
    expect(mockProvisionDevoteeRow.mock.calls[0][1]).toMatchObject({
      uid: UID,
      email: EMAIL,
      displayName: "Devotee",
    });
    expect(locationOf(response).pathname).toBe("/");
  });

  it("refuses to provision an unverified address and reads no profile data", async () => {
    exchangeReturns({ id: UID, email: EMAIL, email_confirmed_at: null });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(locationOf(response).searchParams.get("error")).toBe("provisioning_failed");
    expect(mockProvisionDevoteeRow).not.toHaveBeenCalled();
  });

  it("sends an email conflict to the contact-the-office message, claiming nothing", async () => {
    exchangeReturns({ id: UID, email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z" });
    mockProvisionDevoteeRow.mockResolvedValue({ status: "conflict" });

    const response = await GET(callbackRequest("?code=abc123&next=%2Fprofile"));

    const location = locationOf(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("account_conflict");
    // The requested destination survives as a sanitized path, so the retry keeps its context.
    expect(location.searchParams.get("redirect")).toBe("/profile");
  });

  it("fails closed when provisioning errors", async () => {
    exchangeReturns({ id: UID, email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z" });
    mockProvisionDevoteeRow.mockResolvedValue({ status: "error" });

    const response = await GET(callbackRequest("?code=abc123"));

    expect(locationOf(response).searchParams.get("error")).toBe("provisioning_failed");
  });

  it("fails closed when provisioning throws (e.g. no service-role key)", async () => {
    exchangeReturns({ id: UID, email: EMAIL, email_confirmed_at: "2026-01-01T00:00:00Z" });
    mockProvisionDevoteeRow.mockRejectedValue(new Error("Missing Supabase environment variables"));

    const response = await GET(callbackRequest("?code=abc123"));

    expect(response.status).toBe(307);
    expect(locationOf(response).searchParams.get("error")).toBe("provisioning_failed");
    expect(response.headers.get("location")).not.toMatch(/Missing\+Supabase|environment/);
  });
});
