/**
 * @jest-environment node
 *
 * F-04.4: route-level proof that the legacy admin APIs use the real capability
 * map (not a mocked guard). The identity verifier is stubbed; everything below
 * it — `requireAdminCapability` and the role map — runs for real.
 */

jest.mock("server-only", () => ({}), { virtual: true });

import { NextRequest } from "next/server";

const mockVerifyAdminUserResult = jest.fn();
jest.mock("@/lib/auth/admin-auth", () => ({
  verifyAdminUserResult: (...args: unknown[]) => mockVerifyAdminUserResult(...args),
}));

const mockGetDonation = jest.fn();
const mockUpdateDonationStatus = jest.fn();
const mockUpdateDonation = jest.fn();
const mockDeleteDonation = jest.fn();
jest.mock("@/services/donation.server", () => ({
  donationService: {
    getDonationById: (...a: unknown[]) => mockGetDonation(...a),
    updateDonationStatus: (...a: unknown[]) => mockUpdateDonationStatus(...a),
    updateDonation: (...a: unknown[]) => mockUpdateDonation(...a),
    deleteDonation: (...a: unknown[]) => mockDeleteDonation(...a),
  },
}));

const mockGetMember = jest.fn();
const mockUpdateMember = jest.fn();
const mockDeleteMember = jest.fn();
jest.mock("@/services/volunteer.server", () => ({
  memberService: {
    getMemberById: (...a: unknown[]) => mockGetMember(...a),
    updateMember: (...a: unknown[]) => mockUpdateMember(...a),
    deleteMember: (...a: unknown[]) => mockDeleteMember(...a),
  },
  volunteerService: {},
}));

const mockGetUsers = jest.fn();
jest.mock("@/services/user.server", () => ({
  userService: {
    getUsers: (...a: unknown[]) => mockGetUsers(...a),
    getUser: jest.fn(),
  },
}));

const mockGuruGet = jest.fn();
const mockGuruSave = jest.fn();
jest.mock("@/services/guru-parampara.service", () => {
  class GuruParamparaConflictError extends Error {}
  class GuruParamparaValidationError extends Error {}
  return {
    computeRevision: jest.fn(() => "rev-1"),
    GuruParamparaConflictError,
    GuruParamparaValidationError,
    guruParamparaService: {
      getWithRevision: (...a: unknown[]) => mockGuruGet(...a),
      save: (...a: unknown[]) => mockGuruSave(...a),
    },
  };
});

import { PATCH as donationPatch, DELETE as donationDelete } from "../../app/api/admin/donations/[id]/route";
import { DELETE as memberDelete } from "../../app/api/admin/members/[id]/route";
import { GET as usersGet } from "../../app/api/admin/users/route";
import { PUT as guruPut } from "../../app/api/admin/settings/guru-parampara/route";

function verified(role: string) {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: true,
    provider: "supabase",
    user: { uid: "uid-1", email: "admin@example.com", role, provider: "supabase" },
  });
}

function unauthenticated() {
  mockVerifyAdminUserResult.mockResolvedValue({
    ok: false,
    reason: "missing_token",
    status: 401,
    message: "Missing token",
  });
}

function req(method: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/test", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "row-1" }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateDonationStatus.mockResolvedValue(undefined);
  mockUpdateDonation.mockResolvedValue(undefined);
  mockDeleteDonation.mockResolvedValue(undefined);
  mockDeleteMember.mockResolvedValue(undefined);
  mockGetUsers.mockResolvedValue([]);
  mockGuruSave.mockResolvedValue({ revision: "rev-2" });
});

describe("donations/[id]", () => {
  test("billing cannot update a donation (confirm -> deny by default)", async () => {
    verified("billing");
    const response = await donationPatch(req("PATCH", { status: "received" }), params);
    expect(response.status).toBe(403);
    expect(mockUpdateDonationStatus).not.toHaveBeenCalled();
  });

  test("temple_admin can update a donation", async () => {
    verified("temple_admin");
    const response = await donationPatch(req("PATCH", { status: "received" }), params);
    expect(response.status).toBe(200);
    expect(mockUpdateDonationStatus).toHaveBeenCalledWith("row-1", "received");
  });

  test("temple_admin cannot delete a donation", async () => {
    verified("temple_admin");
    const response = await donationDelete(req("DELETE"), params);
    expect(response.status).toBe(403);
    expect(mockDeleteDonation).not.toHaveBeenCalled();
  });

  test("super_admin can delete a donation", async () => {
    verified("super_admin");
    const response = await donationDelete(req("DELETE"), params);
    expect(response.status).toBe(200);
    expect(mockDeleteDonation).toHaveBeenCalledWith("row-1");
  });
});

describe("members/[id]", () => {
  test("staff cannot delete a member", async () => {
    verified("staff");
    const response = await memberDelete(req("DELETE"), params);
    expect(response.status).toBe(403);
    expect(mockDeleteMember).not.toHaveBeenCalled();
  });

  test("temple_admin cannot delete a member (super-admin-only initially)", async () => {
    verified("temple_admin");
    const response = await memberDelete(req("DELETE"), params);
    expect(response.status).toBe(403);
    expect(mockDeleteMember).not.toHaveBeenCalled();
  });

  test("super_admin can delete a member", async () => {
    verified("super_admin");
    const response = await memberDelete(req("DELETE"), params);
    expect(response.status).toBe(200);
    expect(mockDeleteMember).toHaveBeenCalledWith("row-1");
  });

  test("a caller-supplied role cannot escalate a staff caller", async () => {
    verified("staff");
    const response = await memberDelete(
      req("DELETE", { role: "super_admin" }, { "x-role": "super_admin" }),
      params,
    );
    expect(response.status).toBe(403);
  });
});

describe("users directory", () => {
  test("staff may read the directory", async () => {
    verified("staff");
    const response = await usersGet(req("GET"));
    expect(response.status).toBe(200);
  });

  test("office_staff may not read the directory (confirm -> deny by default)", async () => {
    verified("office_staff");
    const response = await usersGet(req("GET"));
    expect(response.status).toBe(403);
    expect(mockGetUsers).not.toHaveBeenCalled();
  });

  test("an anonymous caller is rejected", async () => {
    unauthenticated();
    const response = await usersGet(req("GET"));
    expect(response.status).toBe(401);
    expect(mockGetUsers).not.toHaveBeenCalled();
  });
});

describe("settings/guru-parampara", () => {
  test("billing cannot write general settings", async () => {
    verified("billing");
    const response = await guruPut(req("PUT", { expectedRevision: "rev-1", data: {} }));
    expect(response.status).toBe(403);
    expect(mockGuruSave).not.toHaveBeenCalled();
  });

  test("temple_admin may write general settings", async () => {
    verified("temple_admin");
    const response = await guruPut(req("PUT", { expectedRevision: "rev-1", data: {} }));
    expect(response.status).toBe(200);
    expect(mockGuruSave).toHaveBeenCalled();
  });
});
