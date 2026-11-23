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

      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const profile = await authService.getUserProfile("test-uuid-1");

      expect(mockEq).toHaveBeenCalledWith("auth_user_id", "test-uuid-1");
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
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const profile = await authService.getUserProfile("nonexistent-id");

      expect(profile).toBeNull();
    });
  });

  describe("register", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("sends the sign-up access token when the address is already confirmed", async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: {
            id: "test-uuid-1",
            email: "user@example.com",
            email_confirmed_at: "2026-01-01T00:00:00Z",
          },
          session: { access_token: "signup-access-token" },
        },
        error: null,
      });
      const fetchMock = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await authService.register({
        name: "Test User",
        email: "user@example.com",
        phone: "9876543210",
        password: "password123",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/auth/register");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer signup-access-token"
      );
      expect(JSON.parse(String(init.body))).toMatchObject({
        userId: "test-uuid-1",
        email: "user@example.com",
      });
      expect(result.provisioning).toBe("provisioned");
    });

    it("does not provision while the address is unconfirmed", async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: "test-uuid-2", email: "pending@example.com", email_confirmed_at: null },
          session: null,
        },
        error: null,
      });
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await authService.register({
        name: "Pending User",
        email: "pending@example.com",
        phone: "",
        password: "password123",
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.provisioning).toBe("pending");
    });
  });
});
