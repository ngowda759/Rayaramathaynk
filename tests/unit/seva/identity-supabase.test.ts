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
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
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
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
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
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(
        supabaseIdentityAdapter.getAccessProfile("550e8400-e29b-41d4-a716-446655440000")
      ).rejects.toThrow(SevaError);
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
