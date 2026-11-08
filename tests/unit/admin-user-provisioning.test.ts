import { NextRequest } from "next/server";
import { POST as createAdminPost } from "@/app/api/admin/users/create-admin/route";
import { POST as setRolePost } from "@/app/api/admin/users/set-role/route";
import { SevaError } from "@/lib/seva/errors";

const mockRequireStaffAdmin = jest.fn();
const mockOnboardStaff = jest.fn();
const mockSetAccountRole = jest.fn();

jest.mock("@/lib/seva/server/staff", () => ({
  requireStaffAdmin: (...args: unknown[]) => mockRequireStaffAdmin(...args),
  onboardStaff: (...args: unknown[]) => mockOnboardStaff(...args),
  setAccountRole: (...args: unknown[]) => mockSetAccountRole(...args),
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ success: true }),
  getClientIP: () => "127.0.0.1",
  createRateLimitResponse: () => new Response("Rate limited", { status: 429 }),
}));

const mockGetUserByEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockListUsers = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        listUsers: (...args: unknown[]) => mockListUsers(...args),
      },
    },
  }),
}));

jest.mock("@/lib/admin-firebase", () => ({
  getAdminApp: jest.fn().mockResolvedValue({}),
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    createUser: jest.fn().mockResolvedValue({ uid: "fb-uid-1" }),
    getUserByEmail: jest.fn().mockRejectedValue({ code: "auth/user-not-found" }),
  }),
}));

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Admin User Provisioning Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/admin/users/create-admin", () => {
    it("fails closed when caller is not an authorized staff admin", async () => {
      mockRequireStaffAdmin.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: { code: "forbidden" } }), { status: 403 }),
      });

      const req = makeRequest("http://localhost/api/admin/users/create-admin", {
        email: "newadmin@example.com",
        password: "Password123!",
        name: "New Admin",
      });

      const res = await createAdminPost(req);
      expect(res.status).toBe(403);
    });

    it("provisions Supabase Auth admin identity and onboards staff as super_admin", async () => {
      mockRequireStaffAdmin.mockResolvedValue({
        ok: true,
        actor: { staffId: "actor-1", role: "super_admin", staffNo: 1, name: "Owner" },
      });
      mockGetUserByEmail.mockResolvedValue({ data: { user: null }, error: null });
      mockCreateUser.mockResolvedValue({
        data: { user: { id: "550e8400-e29b-41d4-a716-446655440001" } },
        error: null,
      });
      mockOnboardStaff.mockResolvedValue({
        staffId: "staff-rec-1",
        staffNo: 42,
      });

      const req = makeRequest("http://localhost/api/admin/users/create-admin", {
        email: "newadmin@example.com",
        password: "Password123!",
        name: "New Admin",
      });

      const res = await createAdminPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.staffNo).toBe(42);
      expect(mockOnboardStaff).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: "newadmin@example.com",
          role: "super_admin",
        }),
        expect.objectContaining({
          authUserId: "550e8400-e29b-41d4-a716-446655440001",
        })
      );
    });

    it("fails closed if Supabase Auth identity creation fails", async () => {
      mockRequireStaffAdmin.mockResolvedValue({
        ok: true,
        actor: { staffId: "actor-1", role: "super_admin", staffNo: 1, name: "Owner" },
      });
      mockGetUserByEmail.mockResolvedValue({ data: { user: null }, error: null });
      mockCreateUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Supabase auth rate limit exceeded"),
      });

      const req = makeRequest("http://localhost/api/admin/users/create-admin", {
        email: "newadmin@example.com",
        password: "Password123!",
        name: "New Admin",
      });

      const res = await createAdminPost(req);
      expect(res.status).toBe(500);
      expect(mockOnboardStaff).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/users/set-role", () => {
    it("resolves target user via Supabase Auth and updates role", async () => {
      mockRequireStaffAdmin.mockResolvedValue({
        ok: true,
        actor: { staffId: "actor-1", role: "super_admin", staffNo: 1, name: "Owner" },
      });
      mockGetUserByEmail.mockResolvedValue({
        data: { user: { id: "550e8400-e29b-41d4-a716-446655440002" } },
        error: null,
      });
      mockSetAccountRole.mockResolvedValue(undefined);

      const req = makeRequest("http://localhost/api/admin/users/set-role", {
        email: "target@example.com",
        role: "admin",
      });

      const res = await setRolePost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.userId).toBe("550e8400-e29b-41d4-a716-446655440002");
      expect(mockSetAccountRole).toHaveBeenCalledWith(
        expect.anything(),
        { externalUid: "550e8400-e29b-41d4-a716-446655440002", role: "admin" }
      );
    });
  });
});
