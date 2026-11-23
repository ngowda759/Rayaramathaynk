import { supabaseIdentityAdapter } from "@/lib/seva/server/identity-supabase";
import { SevaError } from "@/lib/seva/errors";

const mockFrom = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockListUsers = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateUserById = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      admin: {
        getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
        listUsers: (...args: unknown[]) => mockListUsers(...args),
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  }),
}));

jest.mock("@/lib/auth/verify-id-token", () => ({
  checkBearerIdToken: jest.fn(),
}));

describe("supabaseIdentityAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAccessProfile", () => {
    it("returns role and active status from public.users table", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { role: "receptionist", active: true },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const profile = await supabaseIdentityAdapter.getAccessProfile(
        "550e8400-e29b-41d4-a716-446655440000"
      );

      expect(profile).toEqual({
        role: "receptionist",
        isActive: true,
      });
    });

    it("returns null when user is not found in public.users", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const profile = await supabaseIdentityAdapter.getAccessProfile(
        "550e8400-e29b-41d4-a716-446655440000"
      );

      expect(profile).toBeNull();
    });

    it("throws internal SevaError on DB failure", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("DB connection refused"),
      });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(
        supabaseIdentityAdapter.getAccessProfile("550e8400-e29b-41d4-a716-446655440000")
      ).rejects.toThrow(SevaError);
    });
  });

  describe("getAccessProfile resolves only by auth_user_id (F-01)", () => {
    type Row = Record<string, unknown>;

    /** Minimal PostgREST-like builder that filters fake rows by the queried column. */
    function fakeUsersTable(rows: Row[]) {
      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            maybeSingle: async () => ({
              data: rows.find((row) => row[column] === value) ?? null,
              error: null,
            }),
          }),
          or: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    }

    it("does not resolve a row whose id equals the Auth UID but auth_user_id is NULL", async () => {
      const uid = "550e8400-e29b-41d4-a716-4466554400aa";
      mockFrom.mockReturnValue(
        fakeUsersTable([{ id: uid, auth_user_id: null, role: "super_admin", active: true }]),
      );

      await expect(supabaseIdentityAdapter.getAccessProfile(uid)).resolves.toBeNull();
    });

    it("does not resolve a row whose id equals the Auth UID but auth_user_id is a different UUID", async () => {
      const uid = "550e8400-e29b-41d4-a716-4466554400bb";
      mockFrom.mockReturnValue(
        fakeUsersTable([
          {
            id: uid,
            auth_user_id: "550e8400-e29b-41d4-a716-4466554400cc",
            role: "super_admin",
            active: true,
          },
        ]),
      );

      await expect(supabaseIdentityAdapter.getAccessProfile(uid)).resolves.toBeNull();
    });

    it("resolves a row whose auth_user_id matches the Auth UID", async () => {
      const uid = "550e8400-e29b-41d4-a716-4466554400dd";
      mockFrom.mockReturnValue(
        fakeUsersTable([{ id: "an-independent-row-id", auth_user_id: uid, role: "receptionist", active: true }]),
      );

      await expect(supabaseIdentityAdapter.getAccessProfile(uid)).resolves.toEqual({
        role: "receptionist",
        isActive: true,
      });
    });

    it("queries auth_user_id only and never the id column", async () => {
      const uid = "550e8400-e29b-41d4-a716-4466554400ee";
      const mockEq = jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockOr = jest.fn();
      mockFrom.mockReturnValue({ select: () => ({ eq: mockEq, or: mockOr }) });

      await supabaseIdentityAdapter.getAccessProfile(uid);

      expect(mockEq).toHaveBeenCalledWith("auth_user_id", uid);
      expect(mockOr).not.toHaveBeenCalled();
    });
  });


  describe("findLoginByEmail", () => {
    it("finds user login by email", async () => {
      mockGetUserByEmail.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            email: "staff@example.com",
            user_metadata: { name: "Staff Member" },
            email_confirmed_at: "2026-11-01T00:00:00Z",
          },
        },
        error: null,
      });

      const result = await supabaseIdentityAdapter.findLoginByEmail("staff@example.com");

      expect(result).toEqual({
        externalUid: "user-1",
        displayName: "Staff Member",
        emailVerified: true,
        disabled: false,
      });
    });

    it("returns null when user is not found", async () => {
      mockGetUserByEmail.mockResolvedValue({
        data: { user: null },
        error: { message: "User not found" },
      });
      mockListUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const result = await supabaseIdentityAdapter.findLoginByEmail("nobody@example.com");
      expect(result).toBeNull();
    });
  });

  describe("createLogin", () => {
    it("creates user in Supabase Auth", async () => {
      mockCreateUser.mockResolvedValue({
        data: {
          user: { id: "created-uuid" },
        },
        error: null,
      });

      const result = await supabaseIdentityAdapter.createLogin({
        email: "new@example.com",
        displayName: "New Person",
      });

      expect(result.externalUid).toBe("created-uuid");
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "new@example.com",
        user_metadata: { name: "New Person", displayName: "New Person" },
        email_confirm: false,
      });
    });
  });
});
