import { authService } from "@/services/auth.service";

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

describe("authService (Supabase)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("calls supabase.auth.signInWithPassword with email and password", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: "test-uuid-1", email: "user@example.com" },
          session: { access_token: "mock-token" },
        },
        error: null,
      });

      const result = await authService.login("user@example.com", "password123");

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
      expect(result.data.user.id).toBe("test-uuid-1");
    });

    it("throws error when signInWithPassword fails", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error("Invalid credentials"),
      });

      await expect(
        authService.login("user@example.com", "wrongpassword")
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("logout", () => {
    it("calls supabase.auth.signOut", async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await authService.logout();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("calls supabase.auth.resetPasswordForEmail with email", async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      await authService.forgotPassword("user@example.com");

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        expect.any(Object)
      );
    });
  });

  describe("getUserProfile", () => {
    it("fetches user authorization profile from public.users table", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: {
          id: "rec-1",
          auth_user_id: "test-uuid-1",
          email: "user@example.com",
          display_name: "Test User",
          phone_number: "9876543210",
          role: "devotee",
          active: true,
          created_at: "2026-11-01T00:00:00Z",
          updated_at: "2026-11-01T00:00:00Z",
        },
        error: null,
      });

      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
      mockFrom.mockReturnValue({ select: mockSelect });

      const profile = await authService.getUserProfile("test-uuid-1");

      expect(profile).not.toBeNull();
      expect(profile?.role).toBe("devotee");
      expect(profile?.email).toBe("user@example.com");
      expect(profile?.name).toBe("Test User");
    });

    it("returns null when user profile is not found", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
      mockFrom.mockReturnValue({ select: mockSelect });

      const profile = await authService.getUserProfile("nonexistent-id");

      expect(profile).toBeNull();
    });
  });
});
