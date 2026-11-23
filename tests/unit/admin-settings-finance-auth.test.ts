/**
 * @jest-environment node
 *
 * F-04.2: `financeSettings` and `device` documents are super-admin-only writes.
 *
 * `financeSettings` carries the counter's UPI payee; `device` carries device
 * security settings. Any admin-console role could previously write both through
 * `PUT /api/admin/settings/[key]`. These tests pin the super-admin gate, prove
 * the mutation never reaches the service on refusal, and keep the general
 * settings read/write behaviour intact.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest, NextResponse } from "next/server";

const mockRequireAdminUser = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  requireAdminUser: (...args: unknown[]) => mockRequireAdminUser(...args),
}));

const mockSaveSettingsDocument = jest.fn();
const mockGetSettingsDocument = jest.fn();
jest.mock("@/services/settings-document.service", () => ({
  isSettingsDocumentKey: (key: string) =>
    ["financeSettings", "device", "footer"].includes(key),
  saveSettingsDocument: (...args: unknown[]) => mockSaveSettingsDocument(...args),
  getSettingsDocument: (...args: unknown[]) => mockGetSettingsDocument(...args),
}));

import { GET, PUT } from "../../app/api/admin/settings/[key]/route";

function authorized(role: string) {
  mockRequireAdminUser.mockResolvedValue({
    ok: true,
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

function unauthorized() {
  mockRequireAdminUser.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
  });
}

function params(key: string): { params: Promise<{ key: string }> } {
  return { params: Promise.resolve({ key }) };
}

function put(key: string, body: unknown = { value: 1 }): NextRequest {
  return new NextRequest(`http://localhost/api/admin/settings/${key}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function get(key: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/settings/${key}`, { method: "GET" });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveSettingsDocument.mockResolvedValue(undefined);
  mockGetSettingsDocument.mockResolvedValue({ upiVpa: "temple@bank" });
});

describe("PUT /api/admin/settings/financeSettings", () => {
  test("super_admin succeeds and writes the document", async () => {
    authorized("super_admin");
    const response = await PUT(put("financeSettings"), params("financeSettings"));
    expect(response.status).toBe(200);
    expect(mockSaveSettingsDocument).toHaveBeenCalledWith("financeSettings", { value: 1 });
  });

  test.each(["temple_admin", "admin", "billing", "priest", "staff", "office_staff", "unknown"])(
    "%s is refused with 403 and performs no write",
    async (role) => {
      authorized(role);
      const response = await PUT(put("financeSettings"), params("financeSettings"));
      expect(response.status).toBe(403);
      expect(mockSaveSettingsDocument).not.toHaveBeenCalled();
    },
  );

  test("an anonymous caller is rejected and performs no write", async () => {
    unauthorized();
    const response = await PUT(put("financeSettings"), params("financeSettings"));
    expect(response.status).toBe(401);
    expect(mockSaveSettingsDocument).not.toHaveBeenCalled();
  });

  test("an invalid JSON body is rejected for a super_admin", async () => {
    authorized("super_admin");
    const request = new NextRequest("http://localhost/api/admin/settings/financeSettings", {
      method: "PUT",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const response = await PUT(request, params("financeSettings"));
    expect(response.status).toBe(400);
    expect(mockSaveSettingsDocument).not.toHaveBeenCalled();
  });

  test("an unknown document key is 404", async () => {
    authorized("super_admin");
    const response = await PUT(put("notASetting"), params("notASetting"));
    expect(response.status).toBe(404);
    expect(mockSaveSettingsDocument).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/settings/device", () => {
  test("super_admin succeeds", async () => {
    authorized("super_admin");
    const response = await PUT(put("device"), params("device"));
    expect(response.status).toBe(200);
    expect(mockSaveSettingsDocument).toHaveBeenCalledWith("device", { value: 1 });
  });

  test("temple_admin is refused with 403", async () => {
    authorized("temple_admin");
    const response = await PUT(put("device"), params("device"));
    expect(response.status).toBe(403);
    expect(mockSaveSettingsDocument).not.toHaveBeenCalled();
  });
});

describe("general settings behaviour is preserved", () => {
  test("super_admin and temple_admin can still write a general document", async () => {
    authorized("super_admin");
    expect((await PUT(put("footer"), params("footer"))).status).toBe(200);
    authorized("temple_admin");
    expect((await PUT(put("footer"), params("footer"))).status).toBe(200);
    expect(mockSaveSettingsDocument).toHaveBeenCalledTimes(2);
  });

  test("the admin read of financeSettings is not restricted", async () => {
    authorized("temple_admin");
    const response = await GET(get("financeSettings"), params("financeSettings"));
    expect(response.status).toBe(200);
    expect(mockGetSettingsDocument).toHaveBeenCalledWith("financeSettings");
  });
});
